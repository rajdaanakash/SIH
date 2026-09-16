"""
SSB DRISHTI (SIH26188) — Stage 1 Aadhaar Cryptographic Engine Test Suite
Tests:
1. Valid mock signed V2/V3 byte payload (RSA-2048 SHA-256 signature verification, 0xFF segment unpacking, photo extraction).
2. 1-byte tampered payload (must fail signature verification and flag ERR_QR_SIGNATURE_INVALID).
3. Mismatched card surface OCR text (must trip ERR_QR_DATA_MISMATCH).
4. Counterfeit plain text / URL QR (Zero-Trust gate must flag COUNTERFEIT_TAMPERED).
5. Real physical document verification (shubham adhar.jpeg).
"""

import os
import sys
import zlib
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.qr.decode import decode_aadhaar_qr
from backend.qr.payload_parser import (
    decompress_qr_payload,
    parse_aadhaar_payload,
    parse_v2_v3_payload,
)
from backend.qr.verify_signature import (
    verify_qr_signature,
    cross_check_qr_against_ocr,
    load_uidai_public_key,
)

CERTS_DIR = os.path.join(REPO_ROOT, "backend", "qr", "certs")
SPECIMEN_KEY_PATH = os.path.join(CERTS_DIR, "test_specimen_signing_key.pem")
UIDAI_CERT_PATH = os.path.join(CERTS_DIR, "uidai_public_cert.pem")
REAL_CARD_PATH = r"C:\Users\Lenovo\Desktop\shubham adhar.jpeg"

# Minimal valid 1x1 JPEG image bytes
TINY_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
    b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
    b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00"
    b"\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00"
    b"\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00"
    b"\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
)


def create_signed_test_payload(
    name: str = "AARAV SHARMA",
    dob: str = "15-08-1992",
    gender: str = "M",
    ref_id: str = "458920260916",
    address: str = "House 12, MG Road, New Delhi, 110001",
    tamper_byte: bool = False
) -> bytes:
    """Helper to synthesize a cryptographically signed Aadhaar V2/V3 byte payload."""
    with open(SPECIMEN_KEY_PATH, "rb") as f:
        priv_key = serialization.load_pem_private_key(f.read(), password=None)

    fields = [
        b"3",  # Field 0: email & mobile present
        ref_id.encode("utf-8"),  # Field 1: reference ID
        name.encode("utf-8"),  # Field 2: name
        dob.encode("utf-8"),  # Field 3: DOB
        gender.encode("utf-8"),  # Field 4: Gender
        address.encode("utf-8"),  # Field 5: Address
        TINY_JPEG,  # Photo bytes
    ]

    data_block = b"\xff".join(fields)

    # Sign data block with RSA-2048 SHA-256
    sig = priv_key.sign(data_block, padding.PKCS1v15(), hashes.SHA256())
    assert len(sig) == 256, "Signature must be exactly 256 bytes (2048 bits)"

    if tamper_byte:
        # Flip 1 byte in data block to simulate forgery
        mutable = bytearray(data_block)
        mutable[10] ^= 0xFF
        data_block = bytes(mutable)

    full_uncompressed = data_block + sig
    return zlib.compress(full_uncompressed)


def test_valid_signed_payload():
    """Test 1: Fully authentic mock signed payload verifies RSA-2048 signature and extracts fields."""
    compressed = create_signed_test_payload()
    decompressed, err = decompress_qr_payload(compressed)
    assert err is None
    assert decompressed is not None

    parsed = parse_v2_v3_payload(decompressed)
    assert parsed["is_secure_qr"] is True
    assert parsed["version"] == "V2_SECURE_QR"
    assert parsed["fields"]["name"] == "AARAV SHARMA"
    assert parsed["fields"]["dob"] == "15-08-1992"
    assert parsed["fields"]["gender"] == "M"
    assert parsed["qr_face_image_buffer"] is not None
    assert parsed["qr_face_image_buffer"].startswith("data:image/jpeg;base64,")

    # Cryptographic verification against committed public cert
    is_valid, msg, err_code = verify_qr_signature(
        parsed["data_block"],
        parsed["signature_bytes"],
        cert_path=UIDAI_CERT_PATH,
        version="V2_SECURE_QR"
    )
    assert is_valid is True
    assert err_code is None

    # Cross check with matching printed fields
    ocr_res = cross_check_qr_against_ocr(
        parsed["fields"],
        {"fullName": "Aarav Sharma", "dateOfBirth": "15/08/1992", "gender": "Male"}
    )
    assert ocr_res["data_matched"] is True
    assert len(ocr_res["mismatches"]) == 0


def test_tampered_payload_signature_failure():
    """Test 2: Modifying 1 byte in payload invalidates RSA-2048 signature immediately."""
    tampered_compressed = create_signed_test_payload(tamper_byte=True)
    decompressed, _ = decompress_qr_payload(tampered_compressed)
    assert decompressed is not None

    parsed = parse_v2_v3_payload(decompressed)
    is_valid, msg, err_code = verify_qr_signature(
        parsed["data_block"],
        parsed["signature_bytes"],
        cert_path=UIDAI_CERT_PATH,
        version="V2_SECURE_QR"
    )
    assert is_valid is False
    assert err_code == "ERR_QR_SIGNATURE_INVALID"
    assert "failed" in msg.lower()


def test_ocr_metadata_mismatch():
    """Test 3: Valid signature but mismatched card surface OCR text trips ERR_QR_DATA_MISMATCH."""
    compressed = create_signed_test_payload(name="AARAV SHARMA", dob="15-08-1992")
    decompressed, _ = decompress_qr_payload(compressed)
    parsed = parse_v2_v3_payload(decompressed)

    # Simulate altered document where card displays different person
    mismatched_printed_ocr = {
        "fullName": "VIKRAM MALHOTRA",
        "dateOfBirth": "01/01/1985",
        "gender": "Female",
    }

    ocr_res = cross_check_qr_against_ocr(parsed["fields"], mismatched_printed_ocr)
    assert ocr_res["data_matched"] is False
    assert ocr_res["error_code"] == "ERR_QR_DATA_MISMATCH"
    assert any("NAME MISMATCH" in m for m in ocr_res["mismatches"])
    assert any("DOB MISMATCH" in m for m in ocr_res["mismatches"])
    assert any("GENDER MISMATCH" in m for m in ocr_res["mismatches"])


def test_counterfeit_plain_url_rejected():
    """Test 4: Fake card with plain text / URL QR is rejected by Zero-Trust gate."""
    fake_qr_data = b"https://eaadhaar.uidai.gov.in/dummy_verification_qr"
    parsed = parse_aadhaar_payload(fake_qr_data)

    assert parsed["status"] == "COUNTERFEIT_TAMPERED"
    assert parsed["security_error_code"] == "ERR_QR_SIGNATURE_INVALID"
    assert parsed["is_secure_qr"] is False


def test_real_card_ingestion():
    """Test 5: Real physical Aadhaar card (shubham adhar.jpeg) decodes with high-density engine."""
    assert os.path.exists(REAL_CARD_PATH), f"Target card not found at {REAL_CARD_PATH}"
    with open(REAL_CARD_PATH, "rb") as f:
        img_bytes = f.read()

    decoded = decode_aadhaar_qr(img_bytes)
    assert decoded["qr_detected"] is True
    assert decoded["qr_decoded"] is True
    assert decoded["version"] == "QDA_XML"

    sig_verified, msg, err = verify_qr_signature(
        decoded["data_block"],
        decoded["signature_bytes"],
        version=decoded["version"]
    )
    assert sig_verified is True
    assert err is None

    # Cross-match against real card text
    cross = cross_check_qr_against_ocr(
        decoded["fields"],
        {"fullName": "Shubham Verma", "dateOfBirth": "11/07/2001", "gender": "M"}
    )
    assert cross["data_matched"] is True
