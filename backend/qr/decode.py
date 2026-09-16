"""
Aadhaar Secure QR Code Decoder
UIDAI Secure QR (V2/V3) and XML (V1) decoder using OpenCV / pyzbar and zlib.
"""

import io
import zlib
import gzip
import xml.etree.ElementTree as ET
from typing import Optional, Dict, Any, Tuple
import numpy as np
from PIL import Image

try:
    import cv2
except ImportError:
    cv2 = None

try:
    from pyzbar.pyzbar import decode as pyzbar_decode
except ImportError:
    pyzbar_decode = None


def extract_qr_raw_data(image_input: Any) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Extracts raw QR data from an image (bytes, file-like, PIL Image, or numpy array).
    Returns (raw_bytes, text_data).
    """
    # 1. Convert to PIL Image / NumPy array
    if isinstance(image_input, bytes):
        pil_img = Image.open(io.BytesIO(image_input)).convert("RGB")
    elif isinstance(image_input, Image.Image):
        pil_img = image_input.convert("RGB")
    elif isinstance(image_input, np.ndarray):
        pil_img = Image.fromarray(image_input)
    else:
        return None, None

    np_img = np.array(pil_img)

    # 2. Try pyzbar first (robust against rotated or low-contrast QRs)
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
                    return raw_data, text_data
        except Exception:
            pass

    # 3. Fallback to OpenCV QRCodeDetector
    if cv2 is not None:
        try:
            detector = cv2.QRCodeDetector()
            gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)
            data, bbox, _ = detector.detectAndDecode(gray)
            if data:
                return data.encode("utf-8"), data
        except Exception:
            pass

    return None, None


def parse_secure_qr_payload(raw_bytes: bytes, text_data: Optional[str] = None) -> Dict[str, Any]:
    """
    Decompresses and parses UIDAI Secure QR Code payload (V2/V3) or XML payload (V1).
    """
    result: Dict[str, Any] = {
        "version": "UNKNOWN",
        "is_secure_qr": False,
        "data_block": b"",
        "signature_bytes": b"",
        "fields": {},
        "raw_text": text_data or "",
    }

    # Case A: XML V1 QR Code
    text_content = text_data or ""
    if "<PrintLetterBarcodeData" in text_content or "<?xml" in text_content:
        try:
            root = ET.fromstring(text_content.strip())
            attrib = root.attrib
            result["version"] = "V1_XML"
            result["is_secure_qr"] = False
            result["fields"] = {
                "name": attrib.get("name", "").strip().upper(),
                "dob": attrib.get("dob", "").strip(),
                "gender": attrib.get("gender", "").strip().upper(),
                "reference_id": attrib.get("uid", "").strip()[-4:],
                "care_of": attrib.get("co", "").strip(),
                "district": attrib.get("dist", "").strip(),
                "state": attrib.get("state", "").strip(),
                "pincode": attrib.get("pc", "").strip(),
                "vtc": attrib.get("vtc", "").strip(),
            }
            return result
        except Exception:
            pass

    # Case B: UIDAI V2/V3 Secure QR Code
    # The text is either a base-10 large integer string or raw compressed bytes
    byte_stream = raw_bytes
    if text_content and text_content.strip().isdigit():
        try:
            big_int = int(text_content.strip())
            byte_len = (big_int.bit_length() + 7) // 8
            byte_stream = big_int.to_bytes(byte_len, byteorder="big")
        except Exception:
            byte_stream = raw_bytes

    # Attempt decompression (gzip or zlib)
    decompressed: Optional[bytes] = None
    for wbits in (16 + zlib.MAX_WBITS, zlib.MAX_WBITS, -zlib.MAX_WBITS):
        try:
            decompressed = zlib.decompress(byte_stream, wbits)
            break
        except Exception:
            continue

    if decompressed is None:
        try:
            decompressed = gzip.decompress(byte_stream)
        except Exception:
            # Maybe already decompressed
            if b"\xff" in byte_stream or len(byte_stream) > 256:
                decompressed = byte_stream

    if not decompressed or len(decompressed) < 256:
        return result

    # In UIDAI Secure QR, the trailing 256 bytes represent the RSA-2048 signature
    data_block = decompressed[:-256]
    signature_bytes = decompressed[-256:]

    result["version"] = "V2_SECURE_QR"
    result["is_secure_qr"] = True
    result["data_block"] = data_block
    result["signature_bytes"] = signature_bytes

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
    return result


def decode_aadhaar_qr(image_input: Any) -> Dict[str, Any]:
    """
    Complete end-to-end QR detection and decoding pipeline.
    """
    raw_bytes, text_data = extract_qr_raw_data(image_input)
    if not raw_bytes and not text_data:
        return {
            "qr_detected": False,
            "qr_decoded": False,
            "error_code": "ERR_QR_UNREADABLE",
            "message": "No QR code could be extracted or decoded from image.",
            "fields": {},
        }

    parsed = parse_secure_qr_payload(raw_bytes or b"", text_data)
    if not parsed.get("fields") and not parsed.get("data_block"):
        return {
            "qr_detected": True,
            "qr_decoded": False,
            "error_code": "ERR_QR_UNREADABLE",
            "message": "QR detected but payload could not be parsed.",
            "fields": {},
        }

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
