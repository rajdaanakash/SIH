"""
Aadhaar Secure QR Payload Parser
Implements UIDAI V2/V3 Secure QR byte-level unpacking and QDA XML extraction:
- Decompresses gzip/zlib binary payload.
- Extracts trailing 256 bytes RSA signature and preceding data bytes.
- Parses 0xFF delimiter-separated demographic fields (Reference ID, Name, DOB, Gender, Address).
- Reconstructs embedded JPEG photo into an OpenCV BGR buffer and Base64 string.
- Zero-Trust validation for plain text / counterfeit URLs.
"""

import io
import zlib
import gzip
import base64
import logging
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional, Tuple, List
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

logger = logging.getLogger("aadhaar_qr")

DELIMITER = b"\xff"
JPEG_SOI = b"\xff\xd8\xff"
JPEG_EOI = b"\xff\xd9"


def decompress_qr_payload(raw_payload: Any) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Decompresses raw QR payload (raw bytes or base-10 numerical string).
    Returns (decompressed_bytes, error_message).
    """
    byte_stream: Optional[bytes] = None

    if isinstance(raw_payload, bytes):
        byte_stream = raw_payload
    elif isinstance(raw_payload, int):
        byte_len = (raw_payload.bit_length() + 7) // 8
        byte_stream = raw_payload.to_bytes(byte_len, byteorder="big")
    elif isinstance(raw_payload, str):
        # Could be base-10 numeric string (UIDAI V2 big integer format)
        stripped = raw_payload.strip()
        if stripped.isdigit() and len(stripped) > 50:
            try:
                big_int = int(stripped)
                byte_len = (big_int.bit_length() + 7) // 8
                byte_stream = big_int.to_bytes(byte_len, byteorder="big")
            except Exception as e:
                logger.warning(f"Failed to convert big integer string to bytes: {e}")
                byte_stream = stripped.encode("latin-1")
        else:
            byte_stream = stripped.encode("latin-1")
    else:
        return None, f"Unsupported payload type: {type(raw_payload)}"

    if not byte_stream:
        return None, "Empty payload stream"

    # Attempt 1: zlib decompression with header detection (16 + MAX_WBITS for gzip/zlib)
    try:
        decomp = zlib.decompress(byte_stream, 16 + zlib.MAX_WBITS)
        return decomp, None
    except Exception:
        pass

    # Attempt 2: standard zlib decompression
    try:
        decomp = zlib.decompress(byte_stream)
        return decomp, None
    except Exception:
        pass

    # Attempt 3: raw gzip decompression
    try:
        decomp = gzip.decompress(byte_stream)
        return decomp, None
    except Exception:
        pass

    # Attempt 4: raw byte stream might already be decompressed
    if DELIMITER in byte_stream or b"<QDA" in byte_stream or b"<PrintLetterBarcodeData" in byte_stream:
        return byte_stream, None

    return None, "Unable to decompress QR payload: invalid compression format"


def extract_jpeg_from_bytes(data: bytes) -> Tuple[Optional[bytes], Optional[np.ndarray], Optional[str]]:
    """
    Extracts JPEG photo bytes from byte buffer, converts to OpenCV BGR image and Base64 string.
    Returns (jpeg_bytes, bgr_image, b64_uri).
    """
    soi_idx = data.find(JPEG_SOI)
    if soi_idx == -1:
        # Fallback to standard 0xFF 0xD8 marker
        soi_idx = data.find(b"\xff\xd8")

    if soi_idx == -1:
        return None, None, None

    eoi_idx = data.rfind(JPEG_EOI)
    if eoi_idx != -1 and eoi_idx > soi_idx:
        jpeg_bytes = data[soi_idx : eoi_idx + 2]
    else:
        jpeg_bytes = data[soi_idx:]

    bgr_img = None
    b64_uri = None

    if cv2 is not None and len(jpeg_bytes) > 32:
        try:
            nparr = np.frombuffer(jpeg_bytes, np.uint8)
            bgr_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            logger.warning(f"OpenCV failed to decode extracted JPEG buffer: {e}")

    if len(jpeg_bytes) > 32:
        b64_str = base64.b64encode(jpeg_bytes).decode("ascii")
        b64_uri = f"data:image/jpeg;base64,{b64_str}"

    return jpeg_bytes, bgr_img, b64_uri


def parse_v2_v3_payload(decompressed: bytes) -> Dict[str, Any]:
    """
    Parses decompressed V2/V3 Aadhaar Secure QR payload.
    Specification:
    - Trailing 256 bytes is the RSA-2048 SHA-256 digital signature.
    - Preceding bytes is the data payload.
    - Fields are delimited by 0xFF (255).
    """
    if len(decompressed) < 256:
        raise ValueError(f"Payload too short for RSA-2048 signature ({len(decompressed)} < 256 bytes)")

    data_block = decompressed[:-256]
    signature_bytes = decompressed[-256:]

    # Parse 0xFF delimited segments
    segments = data_block.split(DELIMITER)
    fields: Dict[str, Any] = {}

    def safe_decode(b: bytes) -> str:
        try:
            return b.decode("utf-8").strip()
        except UnicodeDecodeError:
            try:
                return b.decode("latin-1").strip()
            except Exception:
                return ""

    if len(segments) >= 1:
        fields["email_mobile_present"] = safe_decode(segments[0])
    if len(segments) >= 2:
        fields["reference_id"] = safe_decode(segments[1])
    if len(segments) >= 3:
        fields["name"] = safe_decode(segments[2])
    if len(segments) >= 4:
        fields["dob"] = safe_decode(segments[3])
    if len(segments) >= 5:
        fields["gender"] = safe_decode(segments[4])

    # Address reconstruction from trailing segments
    addr_parts: List[str] = []
    # Segments between index 5 and photo are address fields
    photo_segment_idx = -1
    for i, seg in enumerate(segments[5:], start=5):
        if JPEG_SOI in seg or b"\xff\xd8" in seg:
            photo_segment_idx = i
            break

    if photo_segment_idx != -1:
        addr_segments = segments[5:photo_segment_idx]
    else:
        addr_segments = segments[5:]

    for seg in addr_segments:
        text = safe_decode(seg)
        if text:
            addr_parts.append(text)

    fields["address"] = ", ".join(addr_parts)

    # Attempt to extract pincode from last address part if 6 digits
    for part in reversed(addr_parts):
        cleaned = "".join(filter(str.isdigit, part))
        if len(cleaned) == 6:
            fields["pincode"] = cleaned
            break

    # Extract portrait JPEG
    photo_bytes, photo_bgr, b64_uri = extract_jpeg_from_bytes(data_block)

    logger.info(f"[CHECKPOINT 4: Decompress/Parse] (V2_SECURE_QR) Payload unpacked successfully. Segments={len(segments)}")
    logger.info(f"[CHECKPOINT 5: Parsed fields] (V2_SECURE_QR) Name='{fields.get('name')}', DOB='{fields.get('dob')}', Gender='{fields.get('gender')}', Ref='{fields.get('reference_id')}'")
    logger.info(f"[CHECKPOINT 6: Signature block] (V2_SECURE_QR) Extracted RSA signature: {len(signature_bytes)} bytes, Data block: {len(data_block)} bytes")

    return {
        "version": "V2_SECURE_QR",
        "is_secure_qr": True,
        "data_block": data_block,
        "signature_bytes": signature_bytes,
        "fields": fields,
        "photo_bytes": photo_bytes,
        "photo_bgr": photo_bgr,
        "qr_face_image_buffer": b64_uri,
    }


def parse_qda_xml_payload(text_or_bytes: Any) -> Dict[str, Any]:
    """
    Parses UIDAI <QDA> or <PrintLetterBarcodeData> XML formats.
    """
    if isinstance(text_or_bytes, bytes):
        try:
            text = text_or_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = text_or_bytes.decode("latin-1")
    else:
        text = str(text_or_bytes)

    # Extract root element
    start_tag = "<QDA" if "<QDA" in text else "<PrintLetterBarcodeData"
    end_tag = "/>" if "/>" in text else ">"
    s_idx = text.find(start_tag)
    if s_idx == -1:
        raise ValueError("No valid QDA or PrintLetterBarcodeData XML tag found")

    e_idx = text.find(end_tag, s_idx)
    if e_idx != -1:
        xml_str = text[s_idx : e_idx + len(end_tag)]
    else:
        xml_str = text[s_idx:]

    root = ET.fromstring(xml_str)
    attrib = root.attrib

    fields: Dict[str, Any] = {}
    if "n" in attrib:
        fields["name"] = attrib["n"]
    if "d" in attrib:
        fields["dob"] = attrib["d"]
    if "g" in attrib:
        fields["gender"] = attrib["g"]
    if "u" in attrib:
        fields["reference_id"] = attrib["u"].replace("x", "")
    # Address and pincode extraction
    raw_addr = attrib.get("a", "")
    fields["address"] = raw_addr
    addr_parts = [p.strip() for p in raw_addr.split(",") if p.strip()]
    if addr_parts:
        last_part = addr_parts[-1]
        if last_part.isdigit() and len(last_part) == 6:
            fields["pincode"] = last_part
    if "pc" in attrib:
        fields["pincode"] = attrib["pc"]

    # Legacy attributes for PrintLetterBarcodeData
    if "name" in attrib:
        fields["name"] = attrib["name"]
    if "dob" in attrib:
        fields["dob"] = attrib["dob"]
    if "gender" in attrib:
        fields["gender"] = attrib["gender"]
    if "uid" in attrib:
        fields["reference_id"] = attrib["uid"][-4:] if len(attrib["uid"]) >= 4 else attrib["uid"]

    # Extract signature
    raw_sig = attrib.get("s", "")
    sig_bytes = b""
    if raw_sig:
        try:
            sig_bytes = base64.b64decode(raw_sig)
        except Exception:
            try:
                sig_bytes = bytes.fromhex(raw_sig)
            except Exception:
                sig_bytes = raw_sig.encode("latin-1")

    # Data block for QDA signature verification
    # UIDAI signs the XML string excluding signature attribute
    data_block = xml_str.encode("utf-8")

    logger.info(f"[CHECKPOINT 4: Decompress/Parse] QDA XML parsed successfully. Attributes={len(attrib)}, XML bytes={len(data_block)}")
    logger.info(f"[CHECKPOINT 5: Parsed fields] (QDA_XML) Name='{fields.get('name')}', DOB='{fields.get('dob')}', Gender='{fields.get('gender')}', Ref='{fields.get('reference_id')}'")
    logger.info(f"[CHECKPOINT 6: Signature block] (QDA_XML) Extracted RSA signature: {len(sig_bytes)} bytes, Data block: {len(data_block)} bytes")

    return {
        "version": "QDA_XML",
        "is_secure_qr": True,
        "data_block": data_block,
        "signature_bytes": sig_bytes,
        "fields": fields,
        "photo_bytes": None,
        "photo_bgr": None,
        "qr_face_image_buffer": None,
    }


def parse_aadhaar_payload(raw_bytes: bytes, text_data: Optional[str] = None) -> Dict[str, Any]:
    """
    Main payload router:
    Detects format (V2/V3 Secure QR binary, QDA XML, or plain text / counterfeit).
    Enforces Zero-Trust gate: flags unencrypted URLs or counterfeit dummy text.
    """
    # 1. Zero-Trust Check for Fake URLs / Plain text
    sample_text = ""
    if text_data:
        sample_text = text_data
    else:
        try:
            sample_text = raw_bytes[:128].decode("utf-8", errors="ignore")
        except Exception:
            pass

    lower_sample = sample_text.lower()
    if any(prefix in lower_sample for prefix in ("http://", "https://", "www.", "dummy", "fake", "specimen")):
        logger.warning(f"[ZERO-TRUST GATE] Rejecting unencrypted plain text / URL QR payload: {lower_sample[:60]}")
        return {
            "version": "COUNTERFEIT_URL",
            "is_secure_qr": False,
            "security_error_code": "ERR_QR_SIGNATURE_INVALID",
            "status": "COUNTERFEIT_TAMPERED",
            "message": "QR payload contains an unencrypted URL or plain-text string, violating UIDAI Secure QR specification.",
            "fields": {},
            "data_block": b"",
            "signature_bytes": b"",
        }

    # 2. Check for XML format
    if (text_data and ("<QDA" in text_data or "<PrintLetterBarcodeData" in text_data)) or (
        raw_bytes and (b"<QDA" in raw_bytes or b"<PrintLetterBarcodeData" in raw_bytes)
    ):
        try:
            return parse_qda_xml_payload(text_data or raw_bytes)
        except Exception as e:
            logger.warning(f"Failed to parse QDA XML: {e}")

    # 3. Attempt V2/V3 binary decompression
    decompressed, decomp_err = decompress_qr_payload(raw_bytes)
    if decompressed is not None:
        try:
            # Check if decompressed payload is XML
            if b"<QDA" in decompressed or b"<PrintLetterBarcodeData" in decompressed:
                return parse_qda_xml_payload(decompressed)
            # Otherwise parse as V2/V3 binary
            return parse_v2_v3_payload(decompressed)
        except Exception as e:
            logger.warning(f"V2/V3 payload parsing error: {e}")
            return {
                "version": "V2_SECURE_QR",
                "is_secure_qr": True,
                "security_error_code": "ERR_QR_SIGNATURE_INVALID",
                "status": "COUNTERFEIT_TAMPERED",
                "message": f"Malformed Aadhaar byte structure: {str(e)}",
                "fields": {},
                "data_block": b"",
                "signature_bytes": b"",
            }

    # 4. If payload cannot be decompressed or recognized
    return {
        "version": "UNKNOWN",
        "is_secure_qr": False,
        "security_error_code": "ERR_QR_UNREADABLE",
        "status": "QR_PARSE_FAILED",
        "message": decomp_err or "Unrecognized QR payload format",
        "fields": {},
        "data_block": b"",
        "signature_bytes": b"",
    }
