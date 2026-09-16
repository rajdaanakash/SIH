"""
Aadhaar Secure QR Standalone CLI Runner
Provides a direct local JSON-over-stdin/stdout bridge for Next.js / Node.js
when the FastAPI HTTP microservice is not active.
"""

import sys
import json
import base64
import os

# Ensure backend package is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.qr.decode import decode_aadhaar_qr
from backend.qr.verify_signature import verify_qr_signature, cross_check_qr_against_ocr


def run_cli():
    try:
        input_data = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"error": f"Invalid JSON stdin: {str(e)}"}))
        sys.exit(1)

    raw_b64 = input_data.get("image_base64", "")
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",")[1]

    try:
        raw_bytes = base64.b64decode(raw_b64)
    except Exception as e:
        print(json.dumps({"error": f"Base64 decode failed: {str(e)}"}))
        sys.exit(1)

    printed_fields = input_data.get("printed_fields", {})

    decoded = decode_aadhaar_qr(raw_bytes)
    if not decoded.get("qr_detected"):
        status = decoded.get("status", "QR_NOT_PRESENT")
        err_code = decoded.get("security_error_code")
        print(json.dumps({
            "qr_detected": False,
            "qr_decoded": False,
            "signature_verified": None,
            "data_matched": None,
            "status": status,
            "security_error_code": err_code,
            "message": decoded.get("message", "No QR code could be detected in document image."),
            "decoded_fields": {}
        }))
        return

    if not decoded.get("qr_decoded"):
        status = decoded.get("status", "QR_PARSE_FAILED")
        err_code = decoded.get("security_error_code", "ERR_QR_UNREADABLE")
        print(json.dumps({
            "qr_detected": True,
            "qr_decoded": False,
            "signature_verified": False,
            "data_matched": False,
            "status": status,
            "security_error_code": err_code,
            "message": decoded.get("message", "QR detected but payload unreadable."),
            "decoded_fields": {}
        }))
        return

    sig_verified, sig_msg, sig_err = verify_qr_signature(
        decoded.get("data_block", b""),
        decoded.get("signature_bytes", b""),
        version=decoded.get("version", "V2_SECURE_QR")
    )

    cross = cross_check_qr_against_ocr(decoded.get("fields", {}), printed_fields)

    status = "VERIFIED"
    error_code = None
    if not sig_verified:
        status = "SIGNATURE_INVALID"
        error_code = "ERR_QR_SIGNATURE_INVALID"
    elif not cross.get("data_matched"):
        status = "DATA_MISMATCH"
        error_code = "ERR_QR_DATA_MISMATCH"

    qr_verified = bool(sig_verified and cross.get("data_matched", True))

    out = {
        "qr_detected": True,
        "qr_decoded": True,
        "qr_verified": qr_verified,
        "is_secure_qr": decoded.get("is_secure_qr", False),
        "version": decoded.get("version"),
        "signature_verified": sig_verified,
        "signature_message": sig_msg,
        "data_matched": cross.get("data_matched", True),
        "mismatches": cross.get("mismatches", []),
        "status": status,
        "security_error_code": error_code,
        "qr_metadata": decoded.get("qr_metadata", {}),
        "qr_face_image_buffer": decoded.get("qr_face_image_buffer"),
        "decoded_fields": decoded.get("fields", {})
    }
    print(json.dumps(out))


if __name__ == "__main__":
    run_cli()
