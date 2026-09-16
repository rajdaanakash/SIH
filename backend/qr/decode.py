"""
Aadhaar Secure QR Code Decoder
UIDAI Secure QR (V2/V3) and XML (V1/QDA) decoder using OpenCV / pyzbar and zlib.
Includes pre-decode image quality gate and structured logging at every pipeline checkpoint.
"""

import io
import time
import zlib
import gzip
import base64
import logging
import xml.etree.ElementTree as ET
from typing import Optional, Dict, Any, Tuple
import numpy as np
from PIL import Image, ImageEnhance

# Configure structured logging
logger = logging.getLogger("aadhaar_qr")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] [AADHAAR_QR] %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

try:
    import cv2
except ImportError:
    cv2 = None

try:
    from pyzbar.pyzbar import decode as pyzbar_decode
except ImportError:
    pyzbar_decode = None


def check_image_quality(np_img: np.ndarray, w: int, h: int) -> Tuple[bool, float, str]:
    """
    Quality gate: Checks resolution and sharpness (Laplacian variance).
    Returns (passes_quality, sharpness_score, reason).
    """
    if w < 120 or h < 120:
        return False, 0.0, f"Image dimensions ({w}x{h}) are too small for high-density QR resolution (min 120x120 required)."

    if cv2 is not None and np_img is not None:
        try:
            gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY) if len(np_img.shape) == 3 else np_img
            sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            if sharpness < 20.0:
                return False, sharpness, f"Optical blur detected (Laplacian variance {sharpness:.2f} < 20.0 is insufficient for QR decodability)."
            return True, sharpness, "Sharpness and resolution within operating thresholds."
        except Exception as e:
            logger.debug(f"Quality check fallback: {e}")

    return True, 100.0, "Quality check passed (standard)."


def extract_qr_raw_data(image_input: Any) -> Tuple[Optional[bytes], Optional[str], Optional[str]]:
    """
    Extracts raw QR data from an image (bytes, file-like, PIL Image, or numpy array).
    Multi-pass decoder:
      Pass 1: Raw image with pyzbar.
      Pass 2: CLAHE / contrast enhancement with pyzbar.
      Pass 3: Adaptive thresholding with pyzbar.
      Pass 4: OpenCV QRCodeDetector.
    Returns (raw_bytes, text_data, quality_error).
    """
    t0 = time.time()

    # 1. Convert to PIL Image / NumPy array
    if isinstance(image_input, bytes):
        try:
            pil_img = Image.open(io.BytesIO(image_input)).convert("RGB")
        except Exception as e:
            logger.error(f"[CHECKPOINT 1: Image received] Failed to load image bytes: {e}")
            return None, None, "IMAGE_CORRUPTED"
    elif isinstance(image_input, Image.Image):
        pil_img = image_input.convert("RGB")
    elif isinstance(image_input, np.ndarray):
        pil_img = Image.fromarray(image_input)
    else:
        logger.error(f"[CHECKPOINT 1: Image received] Unsupported image input type: {type(image_input)}")
        return None, None, "INVALID_INPUT_TYPE"

    w, h = pil_img.size
    np_img = np.array(pil_img)
    byte_len = len(image_input) if isinstance(image_input, bytes) else 0

    logger.info(f"[CHECKPOINT 1: Image received] Dimensions={w}x{h}, Mode={pil_img.mode}, Bytes={byte_len}")

    # Checkpoint 1b: Image Quality Gate
    passes_quality, sharpness, quality_reason = check_image_quality(np_img, w, h)
    logger.info(f"[CHECKPOINT 1b: Quality Gate] Sharpness={sharpness:.2f}, Passed={passes_quality}. {quality_reason}")

    if not passes_quality:
        logger.warning(f"[CHECKPOINT 1b: Quality Gate REJECTED] {quality_reason}")
        return None, None, "QR_IMAGE_QUALITY_INSUFFICIENT"

    # Checkpoint 2: Multi-Pass QR Decode Attempts
    logger.info("[CHECKPOINT 2: QR decode attempt] Starting multi-pass detection...")

    # Pass 1: Standard pyzbar
    if pyzbar_decode is not None:
        try:
            decoded_objects = pyzbar_decode(pil_img)
            for obj in decoded_objects:
                if obj.type == "QRCODE":
                    raw_data = obj.data
                    try:
                        text_data = raw_data.decode("utf-8")
                    except UnicodeDecodeError:
                        text_data = raw_data.decode("latin-1", errors="ignore")
                    elapsed = (time.time() - t0) * 1000
                    logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 1 (pyzbar direct) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_data)}")
                    return raw_data, text_data, None
        except Exception as e:
            logger.debug(f"pyzbar Pass 1 notice: {e}")

    # Pass 2: Contrast Enhancement (for low-contrast or faded prints)
    if pyzbar_decode is not None:
        try:
            enhancer = ImageEnhance.Contrast(pil_img)
            enhanced_img = enhancer.enhance(2.0)
            decoded_objects = pyzbar_decode(enhanced_img)
            for obj in decoded_objects:
                if obj.type == "QRCODE":
                    raw_data = obj.data
                    try:
                        text_data = raw_data.decode("utf-8")
                    except UnicodeDecodeError:
                        text_data = raw_data.decode("latin-1", errors="ignore")
                    elapsed = (time.time() - t0) * 1000
                    logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 2 (contrast enhanced) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_data)}")
                    return raw_data, text_data, None
        except Exception as e:
            logger.debug(f"pyzbar Pass 2 notice: {e}")

    # Pass 3: OpenCV Adaptive Thresholding
    if cv2 is not None and pyzbar_decode is not None:
        try:
            gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
            thresh_pil = Image.fromarray(thresh)
            decoded_objects = pyzbar_decode(thresh_pil)
            for obj in decoded_objects:
                if obj.type == "QRCODE":
                    raw_data = obj.data
                    try:
                        text_data = raw_data.decode("utf-8")
                    except UnicodeDecodeError:
                        text_data = raw_data.decode("latin-1", errors="ignore")
                    elapsed = (time.time() - t0) * 1000
                    logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 3 (adaptive threshold) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_data)}")
                    return raw_data, text_data, None
        except Exception as e:
            logger.debug(f"pyzbar Pass 3 notice: {e}")

    # Pass 4: Fallback to OpenCV QRCodeDetector
    if cv2 is not None:
        try:
            detector = cv2.QRCodeDetector()
            gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)
            data, bbox, _ = detector.detectAndDecode(gray)
            if data:
                elapsed = (time.time() - t0) * 1000
                logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 4 (OpenCV QRCodeDetector) SUCCESS in {elapsed:.1f}ms!")
                return data.encode("utf-8"), data, None
        except Exception as e:
            logger.debug(f"OpenCV QRCodeDetector notice: {e}")

    # Pass 5: Aadhaar Quadrant ROI Crops & Sharpening (for phone photos with margins)
    if cv2 is not None and pyzbar_decode is not None:
        try:
            h, w = np_img.shape[:2]
            rois = [
                ("bottom_right", np_img[int(h * 0.25):, int(w * 0.35):]),
                ("right_half", np_img[:, int(w * 0.40):]),
                ("bottom_half", np_img[int(h * 0.35):, :]),
            ]
            for roi_name, roi_img in rois:
                if roi_img.size == 0 or roi_img.shape[0] < 50 or roi_img.shape[1] < 50:
                    continue
                
                # 5a: Direct ROI with pyzbar
                roi_pil = Image.fromarray(roi_img)
                decoded_objects = pyzbar_decode(roi_pil)
                for obj in decoded_objects:
                    if obj.type == "QRCODE":
                        raw_data = obj.data
                        try:
                            text_data = raw_data.decode("utf-8")
                        except UnicodeDecodeError:
                            text_data = raw_data.decode("latin-1", errors="ignore")
                        elapsed = (time.time() - t0) * 1000
                        logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 5 ({roi_name} ROI direct) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_data)}")
                        return raw_data, text_data, None

                # 5b: Sharpened ROI
                gray_roi = cv2.cvtColor(roi_img, cv2.COLOR_RGB2GRAY) if len(roi_img.shape) == 3 else roi_img
                kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
                sharpened = cv2.filter2D(gray_roi, -1, kernel)
                sharpened_pil = Image.fromarray(sharpened)
                decoded_objects = pyzbar_decode(sharpened_pil)
                for obj in decoded_objects:
                    if obj.type == "QRCODE":
                        raw_data = obj.data
                        try:
                            text_data = raw_data.decode("utf-8")
                        except UnicodeDecodeError:
                            text_data = raw_data.decode("latin-1", errors="ignore")
                        elapsed = (time.time() - t0) * 1000
                        logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 5 ({roi_name} sharpened) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_data)}")
                        return raw_data, text_data, None

                # 5c: Otsu threshold on ROI
                _, otsu_roi = cv2.threshold(gray_roi, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                otsu_pil = Image.fromarray(otsu_roi)
                decoded_objects = pyzbar_decode(otsu_pil)
                for obj in decoded_objects:
                    if obj.type == "QRCODE":
                        raw_data = obj.data
                        try:
                            text_data = raw_data.decode("utf-8")
                        except UnicodeDecodeError:
                            text_data = raw_data.decode("latin-1", errors="ignore")
                        elapsed = (time.time() - t0) * 1000
                        logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 5 ({roi_name} Otsu) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_data)}")
                        return raw_data, text_data, None
        except Exception as e:
            logger.debug(f"Pass 5 ROI crop notice: {e}")

    elapsed = (time.time() - t0) * 1000
    logger.info(f"[CHECKPOINT 2: QR decode attempt] All passes completed in {elapsed:.1f}ms. No QR code detected.")
    return None, None, None


def parse_secure_qr_payload(raw_bytes: bytes, text_data: Optional[str] = None) -> Dict[str, Any]:
    """
    Decompresses and parses UIDAI Secure QR Code payload (V2/V3) or XML payload (V1 / QDA).
    Explicitly handles:
      1. XML <QDA> (Quick Data Access) format with base64 digital signature attribute 's'.
      2. XML <PrintLetterBarcodeData> / <?xml> format.
      3. Binary V2/V3 Secure QR (base-10 integer string or raw zlib/gzip stream).
    """
    result: Dict[str, Any] = {
        "version": "UNKNOWN",
        "is_secure_qr": False,
        "data_block": b"",
        "signature_bytes": b"",
        "fields": {},
        "raw_text": text_data or "",
    }

    text_content = (text_data or "").strip()

    # -------------------------------------------------------------
    # Checkpoint 4: Decompress / XML Parse Attempt
    # -------------------------------------------------------------

    # Format 1 & 2: XML Payload (<QDA> or <PrintLetterBarcodeData>)
    if "<" in text_content and ("<PrintLetterBarcodeData" in text_content or "<?xml" in text_content or "<QDA" in text_content):
        logger.info("[CHECKPOINT 4: Decompress/Parse] Detected XML Aadhaar QR format.")
        try:
            # Extract clean XML element string
            xml_str = text_content[text_content.find("<"):text_content.rfind(">") + 1]
            root = ET.fromstring(xml_str)
            attrib = root.attrib
            tag = root.tag
            logger.info(f"[CHECKPOINT 4: Decompress/Parse] Root tag='{tag}', Attribute keys={list(attrib.keys())}")

            # Sub-format A: <QDA> (Quick Data Access / mAadhaar standard)
            if tag == "QDA" or "<QDA" in text_content:
                result["version"] = "QDA_XML"
                sig_b64 = attrib.get("s", "")
                sig_bytes = b""
                if sig_b64:
                    try:
                        sig_bytes = base64.b64decode(sig_b64)
                    except Exception as e:
                        logger.warning(f"[CHECKPOINT 4] Base64 signature decode notice: {e}")

                result["is_secure_qr"] = len(sig_bytes) >= 128
                result["signature_bytes"] = sig_bytes
                # Strip out signature attribute to produce raw canonical data block
                clean_xml = xml_str.replace(f' s="{sig_b64}"', '').replace(f's="{sig_b64}"', '')
                result["data_block"] = clean_xml.encode("utf-8")

                fields = {
                    "name": attrib.get("n", "").strip().upper(),
                    "dob": attrib.get("d", "").strip(),
                    "gender": attrib.get("g", "").strip().upper(),
                    "reference_id": attrib.get("u", "").strip()[-4:],
                    "address": attrib.get("a", "").strip(),
                }
                # Parse address segments if available
                addr_parts = [p.strip() for p in attrib.get("a", "").split(",") if p.strip()]
                if addr_parts:
                    if addr_parts[-1].isdigit() and len(addr_parts[-1]) == 6:
                        fields["pincode"] = addr_parts[-1]
                        if len(addr_parts) >= 2:
                            fields["state"] = addr_parts[-2]
                    else:
                        fields["state"] = addr_parts[-1]

                result["fields"] = fields
                logger.info(f"[CHECKPOINT 5: Parsed fields] (QDA_XML) Name='{fields['name']}', DOB='{fields['dob']}', Gender='{fields['gender']}', Ref='{fields['reference_id']}'")
                logger.info(f"[CHECKPOINT 6: Signature block] (QDA_XML) Extracted RSA signature: {len(sig_bytes)} bytes")
                return result

            # Sub-format B: <PrintLetterBarcodeData> (Legacy XML V1)
            else:
                result["version"] = "V1_XML"
                result["is_secure_qr"] = False
                fields = {
                    "name": attrib.get("name", "").strip().upper(),
                    "dob": attrib.get("dob", "").strip() or attrib.get("yob", "").strip(),
                    "gender": attrib.get("gender", "").strip().upper(),
                    "reference_id": attrib.get("uid", "").strip()[-4:],
                    "care_of": attrib.get("co", "").strip(),
                    "district": attrib.get("dist", "").strip(),
                    "state": attrib.get("state", "").strip(),
                    "pincode": attrib.get("pc", "").strip(),
                    "vtc": attrib.get("vtc", "").strip(),
                }
                result["fields"] = fields
                logger.info(f"[CHECKPOINT 5: Parsed fields] (V1_XML) Name='{fields['name']}', DOB='{fields['dob']}', Gender='{fields['gender']}'")
                return result

        except Exception as e:
            logger.error(f"[CHECKPOINT 4: XML parse exception] Failed parsing XML QR payload: {e}", exc_info=True)
            result["version"] = "CORRUPTED_XML"
            return result

    # Format 3: UIDAI V2/V3 Secure QR Code (Binary compressed payload)
    logger.info("[CHECKPOINT 4: Decompress/Parse] Attempting V2/V3 binary Secure QR decompression...")
    byte_stream = raw_bytes
    if text_content and text_content.strip().isdigit():
        try:
            big_int = int(text_content.strip())
            byte_len = (big_int.bit_length() + 7) // 8
            byte_stream = big_int.to_bytes(byte_len, byteorder="big")
            logger.info(f"[CHECKPOINT 4: Decompress/Parse] Converted base-10 integer to {len(byte_stream)} bytes.")
        except Exception as e:
            logger.debug(f"Base-10 integer conversion notice: {e}")
            byte_stream = raw_bytes

    # Attempt decompression (gzip or zlib)
    decompressed: Optional[bytes] = None
    for wbits in (16 + zlib.MAX_WBITS, zlib.MAX_WBITS, -zlib.MAX_WBITS):
        try:
            decompressed = zlib.decompress(byte_stream, wbits)
            logger.info(f"[CHECKPOINT 4: Decompress/Parse] zlib decompression succeeded with wbits={wbits}! Decompressed {len(decompressed)} bytes.")
            break
        except Exception:
            continue

    if decompressed is None:
        try:
            decompressed = gzip.decompress(byte_stream)
            logger.info(f"[CHECKPOINT 4: Decompress/Parse] gzip decompression succeeded! Decompressed {len(decompressed)} bytes.")
        except Exception:
            # Maybe already decompressed binary stream with 0xFF delimiters
            if b"\xff" in byte_stream and len(byte_stream) > 256:
                decompressed = byte_stream
                logger.info("[CHECKPOINT 4: Decompress/Parse] Treating payload as raw uncompressed byte stream.")

    if not decompressed or len(decompressed) < 256:
        logger.warning(f"[CHECKPOINT 4: Decompress/Parse] Decompressed payload insufficient (<256 bytes): {len(decompressed) if decompressed else 0} bytes.")
        return result

    # In UIDAI Secure QR, the trailing 256 bytes represent the RSA-2048 signature
    data_block = decompressed[:-256]
    signature_bytes = decompressed[-256:]

    result["version"] = "V2_SECURE_QR"
    result["is_secure_qr"] = True
    result["data_block"] = data_block
    result["signature_bytes"] = signature_bytes

    logger.info(f"[CHECKPOINT 6: Signature block] (V2_SECURE_QR) Extracted RSA signature: {len(signature_bytes)} bytes, Data block: {len(data_block)} bytes")

    # Delimited by 0xFF (255)
    parts = data_block.split(b"\xff")
    field_names = [
        "email_mobile_flag",
        "reference_id",
        "name",
        "dob",
        "gender",
        "care_of",
        "district",
        "landmark",
        "house",
        "location",
        "pincode",
        "post_office",
        "state",
        "street",
        "sub_district",
        "vtc",
    ]

    fields: Dict[str, Any] = {}
    for i, part in enumerate(parts):
        if i < len(field_names):
            try:
                fields[field_names[i]] = part.decode("utf-8").strip()
            except UnicodeDecodeError:
                fields[field_names[i]] = part.decode("latin-1", errors="ignore").strip()
        elif i == 16:
            # 17th item is photo JPEG bytes
            fields["photo_bytes_length"] = len(part)

    # Normalize standard fields
    if "name" in fields:
        fields["name"] = fields["name"].upper()
    if "gender" in fields:
        fields["gender"] = fields["gender"].upper()

    result["fields"] = fields
    logger.info(f"[CHECKPOINT 5: Parsed fields] (V2_SECURE_QR) Name='{fields.get('name')}', DOB='{fields.get('dob')}', Gender='{fields.get('gender')}', Ref='{fields.get('reference_id')}'")
    return result


def decode_aadhaar_qr(image_input: Any) -> Dict[str, Any]:
    """
    Complete end-to-end QR detection, quality verification, and decoding pipeline.
    Produces structured logs at every checkpoint.
    """
    logger.info("=== [AADHAAR QR VERIFICATION PIPELINE STARTED] ===")

    raw_bytes, text_data, quality_err = extract_qr_raw_data(image_input)

    # Quality Gate Rejection
    if quality_err == "QR_IMAGE_QUALITY_INSUFFICIENT":
        logger.warning("[CHECKPOINT 7: Final Result] Status: QR_IMAGE_QUALITY_INSUFFICIENT -> Routing to SECONDARY_INSPECTION")
        return {
            "qr_detected": False,
            "qr_decoded": False,
            "status": "QR_IMAGE_QUALITY_INSUFFICIENT",
            "security_error_code": "ERR_QR_UNREADABLE",
            "message": "Image resolution or sharpness insufficient to reliably decode high-density Aadhaar QR. Secondary physical inspection required.",
            "fields": {},
        }

    # No QR Detected
    if not raw_bytes and not text_data:
        logger.info("[CHECKPOINT 7: Final Result] Status: QR_NOT_PRESENT (No QR code detected in document)")
        return {
            "qr_detected": False,
            "qr_decoded": False,
            "status": "QR_NOT_PRESENT",
            "security_error_code": None,
            "message": "No QR code could be detected in document image.",
            "fields": {},
        }

    # Checkpoint 3: Decode succeeded
    logger.info(f"[CHECKPOINT 3: Decode result] QR detected successfully. Raw data size: {len(raw_bytes) if raw_bytes else 0} bytes.")

    # Checkpoint 4 & 5: Parse Payload
    try:
        parsed = parse_secure_qr_payload(raw_bytes or b"", text_data)
    except Exception as e:
        logger.error(f"[CHECKPOINT 7: Final Result] Status: QR_PARSE_FAILED. Exception during parse: {e}", exc_info=True)
        return {
            "qr_detected": True,
            "qr_decoded": False,
            "status": "QR_PARSE_FAILED",
            "security_error_code": "ERR_QR_UNREADABLE",
            "message": f"QR detected but payload could not be parsed: {str(e)}",
            "fields": {},
        }

    if not parsed.get("fields") and not parsed.get("data_block"):
        logger.warning("[CHECKPOINT 7: Final Result] Status: QR_PARSE_FAILED. Empty fields and data block.")
        return {
            "qr_detected": True,
            "qr_decoded": False,
            "status": "QR_PARSE_FAILED",
            "security_error_code": "ERR_QR_UNREADABLE",
            "message": "QR detected but payload contains unrecognized or corrupted data structure.",
            "fields": {},
        }

    logger.info(f"[CHECKPOINT 7: Final Result] Status: QR_DECODED_SUCCESS. Version={parsed['version']}, IsSecure={parsed['is_secure_qr']}")
    return {
        "qr_detected": True,
        "qr_decoded": True,
        "version": parsed["version"],
        "is_secure_qr": parsed["is_secure_qr"],
        "data_block": parsed["data_block"],
        "signature_bytes": parsed["signature_bytes"],
        "fields": parsed["fields"],
        "raw_text": parsed.get("raw_text", ""),
    }
