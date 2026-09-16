"""
Aadhaar Secure QR Code Decoder
Production-grade high-density QR extraction pipeline using zxing-cpp, OpenCV, and pyzbar.
Includes:
- Automated image preprocessing: Grayscale, CLAHE contrast normalization, bilateral filtering.
- Multi-engine detection (zxing-cpp raw byte extraction, bilateral filtered pass, pyzbar, quadrant ROIs).
- Direct raw binary byte preservation.
- Payload decompression, field extraction, and photo reconstruction via payload_parser.
- Structured logging at every pipeline checkpoint.
"""

import io
import time
import zlib
import gzip
import base64
import logging
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
    import zxingcpp
except ImportError:
    zxingcpp = None

try:
    from pyzbar.pyzbar import decode as pyzbar_decode
except ImportError:
    pyzbar_decode = None

from backend.qr.payload_parser import parse_aadhaar_payload


def check_image_quality(np_img: np.ndarray, w: int, h: int) -> Tuple[bool, float, str]:
    """
    Quality gate: Checks resolution and optical sharpness via Laplacian variance.
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


def preprocess_image_variants(np_img: np.ndarray) -> Dict[str, np.ndarray]:
    """
    Applies automated image preprocessing for noisy and high-density inputs:
    1. Grayscale conversion.
    2. Contrast Limited Adaptive Histogram Equalization (CLAHE).
    3. Edge-preserving bilateral filtering (removes noise while preserving sharp QR module edges).
    """
    variants: Dict[str, np.ndarray] = {}
    if cv2 is None or np_img is None:
        return variants

    try:
        gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY) if len(np_img.shape) == 3 else np_img
        variants["gray"] = gray

        # 2. CLAHE contrast normalization
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        clahe_img = clahe.apply(gray)
        variants["clahe"] = clahe_img

        # 3. Edge-preserving bilateral filter (d=9, sigmaColor=75, sigmaSpace=75)
        bilateral = cv2.bilateralFilter(clahe_img, 9, 75, 75)
        variants["bilateral"] = bilateral

        # 4. Adaptive thresholding
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        variants["thresh"] = thresh
    except Exception as e:
        logger.debug(f"Preprocessing variant notice: {e}")

    return variants


def extract_qr_raw_data(image_input: Any) -> Tuple[Optional[bytes], Optional[str], Optional[str]]:
    """
    Extracts raw QR data from an image (bytes, file-like, PIL Image, or numpy array).
    High-density multi-engine pipeline:
      Pass 1: zxing-cpp on direct image (captures raw uncompressed byte stream).
      Pass 2: zxing-cpp on edge-preserving bilateral filtered + CLAHE image.
      Pass 3: pyzbar direct & contrast enhanced.
      Pass 4: OpenCV QRCodeDetector / adaptive threshold.
      Pass 5: Aadhaar quadrant ROI crops (bottom-right, right-half, bottom-half) with zxing-cpp & pyzbar.
    Returns (raw_bytes, text_data, quality_error).
    """
    t0 = time.time()

    # 1. Convert to PIL Image and NumPy array
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

    # Checkpoint 2: Multi-Pass High-Density QR Decode Attempts
    logger.info("[CHECKPOINT 2: QR decode attempt] Starting high-density multi-engine detection...")

    # Engine 1: zxing-cpp (direct raw byte capture)
    if zxingcpp is not None:
        try:
            result = zxingcpp.read_barcode(np_img)
            if result is not None and result.format == zxingcpp.BarcodeFormat.QRCode:
                raw_bytes = bytes(result.bytes)
                text_data = result.text or ""
                elapsed = (time.time() - t0) * 1000
                logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 1 (zxing-cpp direct) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_bytes)}")
                return raw_bytes, text_data, None
        except Exception as e:
            logger.debug(f"zxing-cpp Pass 1 notice: {e}")

    # Compute automated preprocessing variants
    variants = preprocess_image_variants(np_img)

    # Engine 1b: zxing-cpp with Bilateral + CLAHE filtered variants
    if zxingcpp is not None:
        for vname in ("bilateral", "clahe", "gray", "thresh"):
            vimg = variants.get(vname)
            if vimg is not None:
                try:
                    result = zxingcpp.read_barcode(vimg)
                    if result is not None and result.format == zxingcpp.BarcodeFormat.QRCode:
                        raw_bytes = bytes(result.bytes)
                        text_data = result.text or ""
                        elapsed = (time.time() - t0) * 1000
                        logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 2 (zxing-cpp {vname}) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_bytes)}")
                        return raw_bytes, text_data, None
                except Exception as e:
                    logger.debug(f"zxing-cpp variant {vname} notice: {e}")

    # Engine 2: pyzbar direct & enhanced
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
                    logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 3 (pyzbar direct) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_data)}")
                    return raw_data, text_data, None
        except Exception as e:
            logger.debug(f"pyzbar Pass 3 notice: {e}")

        # Contrast enhancement
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
                    logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 3b (contrast enhanced) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_data)}")
                    return raw_data, text_data, None
        except Exception as e:
            logger.debug(f"pyzbar Pass 3b notice: {e}")

    # Engine 3: OpenCV QRCodeDetector
    if cv2 is not None and "gray" in variants:
        try:
            detector = cv2.QRCodeDetector()
            data, bbox, _ = detector.detectAndDecode(variants["gray"])
            if data:
                elapsed = (time.time() - t0) * 1000
                logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 4 (OpenCV QRCodeDetector) SUCCESS in {elapsed:.1f}ms!")
                return data.encode("latin-1"), data, None
        except Exception as e:
            logger.debug(f"OpenCV QRCodeDetector notice: {e}")

    # Engine 4: Aadhaar Quadrant ROI Crops (bottom-right, right-half, bottom-half)
    if cv2 is not None:
        try:
            h_img, w_img = np_img.shape[:2]
            rois = [
                ("bottom_right", np_img[int(h_img * 0.25):, int(w_img * 0.35):]),
                ("right_half", np_img[:, int(w_img * 0.40):]),
                ("bottom_half", np_img[int(h_img * 0.35):, :]),
            ]
            for roi_name, roi_img in rois:
                if roi_img.size == 0 or roi_img.shape[0] < 50 or roi_img.shape[1] < 50:
                    continue

                # Try zxing-cpp on ROI
                if zxingcpp is not None:
                    try:
                        res = zxingcpp.read_barcode(roi_img)
                        if res is not None and res.format == zxingcpp.BarcodeFormat.QRCode:
                            raw_bytes = bytes(res.bytes)
                            text_data = res.text or ""
                            elapsed = (time.time() - t0) * 1000
                            logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 5 ({roi_name} ROI zxing-cpp) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_bytes)}")
                            return raw_bytes, text_data, None
                    except Exception:
                        pass

                # Try pyzbar on ROI
                if pyzbar_decode is not None:
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
                            logger.info(f"[CHECKPOINT 2: QR decode attempt] Pass 5 ({roi_name} ROI pyzbar) SUCCESS in {elapsed:.1f}ms! Bytes={len(raw_data)}")
                            return raw_data, text_data, None
        except Exception as e:
            logger.debug(f"Pass 5 ROI crop notice: {e}")

    elapsed = (time.time() - t0) * 1000
    logger.info(f"[CHECKPOINT 2: QR decode attempt] All passes completed in {elapsed:.1f}ms. No QR code detected.")
    return None, None, None


def decode_aadhaar_qr(image_input: Any) -> Dict[str, Any]:
    """
    Complete end-to-end QR detection, quality verification, payload parsing, and photo extraction pipeline.
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
            "qr_metadata": {},
            "photo_bytes": None,
            "photo_bgr": None,
            "qr_face_image_buffer": None,
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
            "qr_metadata": {},
            "photo_bytes": None,
            "photo_bgr": None,
            "qr_face_image_buffer": None,
        }

    # Checkpoint 3: Decode succeeded
    logger.info(f"[CHECKPOINT 3: Decode result] QR detected successfully. Raw data size: {len(raw_bytes) if raw_bytes else 0} bytes.")

    # Checkpoint 4 & 5: Parse Payload via dedicated payload_parser
    try:
        parsed = parse_aadhaar_payload(raw_bytes or b"", text_data)
    except Exception as e:
        logger.error(f"[CHECKPOINT 7: Final Result] Status: QR_PARSE_FAILED. Exception during parse: {e}", exc_info=True)
        return {
            "qr_detected": True,
            "qr_decoded": False,
            "status": "QR_PARSE_FAILED",
            "security_error_code": "ERR_QR_UNREADABLE",
            "message": f"QR detected but payload could not be parsed: {str(e)}",
            "fields": {},
            "qr_metadata": {},
            "photo_bytes": None,
            "photo_bgr": None,
            "qr_face_image_buffer": None,
        }

    # Zero-Trust Check for Counterfeit/Tampered
    if parsed.get("status") == "COUNTERFEIT_TAMPERED":
        logger.warning(f"[CHECKPOINT 7: Final Result] Status: COUNTERFEIT_TAMPERED. {parsed.get('message')}")
        return {
            "qr_detected": True,
            "qr_decoded": False,
            "version": parsed.get("version", "COUNTERFEIT_URL"),
            "is_secure_qr": False,
            "status": "COUNTERFEIT_TAMPERED",
            "security_error_code": "ERR_QR_SIGNATURE_INVALID",
            "message": parsed.get("message", "Counterfeit or unencrypted QR payload detected."),
            "fields": {},
            "qr_metadata": {},
            "photo_bytes": None,
            "photo_bgr": None,
            "qr_face_image_buffer": None,
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
            "qr_metadata": {},
            "photo_bytes": None,
            "photo_bgr": None,
            "qr_face_image_buffer": None,
        }

    fields = parsed.get("fields", {})
    qr_metadata = {
        "name": fields.get("name", ""),
        "dob": fields.get("dob", ""),
        "gender": fields.get("gender", ""),
        "reference_id": fields.get("reference_id", ""),
        "pincode": fields.get("pincode", ""),
        "address": fields.get("address", ""),
    }

    logger.info(f"[CHECKPOINT 7: Final Result] Status: QR_DECODED_SUCCESS. Version={parsed['version']}, IsSecure={parsed['is_secure_qr']}")
    return {
        "qr_detected": True,
        "qr_decoded": True,
        "version": parsed["version"],
        "is_secure_qr": parsed["is_secure_qr"],
        "data_block": parsed["data_block"],
        "signature_bytes": parsed["signature_bytes"],
        "fields": fields,
        "qr_metadata": qr_metadata,
        "photo_bytes": parsed.get("photo_bytes"),
        "photo_bgr": parsed.get("photo_bgr"),
        "qr_face_image_buffer": parsed.get("qr_face_image_buffer"),
        "raw_text": text_data or "",
    }
