"""
Aadhaar Secure QR Signature Verification and Cross-Reconciliation Module
Verifies SHA256withRSA signature against UIDAI official public key certificate.
"""

import os
from typing import Dict, Any, Optional, Tuple
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.exceptions import InvalidSignature

DEFAULT_CERT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "certs",
    "uidai_offline_publickey.cer"
)


def load_uidai_public_key(cert_path: str = DEFAULT_CERT_PATH):
    """
    Loads UIDAI public key from committed offline X.509 certificate.
    """
    if not os.path.exists(cert_path):
        raise FileNotFoundError(f"UIDAI certificate not found at: {cert_path}")

    with open(cert_path, "rb") as f:
        cert_data = f.read()

    cert = x509.load_pem_x509_certificate(cert_data)
    return cert.public_key()


def verify_qr_signature(
    data_block: bytes,
    signature_bytes: bytes,
    cert_path: str = DEFAULT_CERT_PATH
) -> Tuple[bool, str, Optional[str]]:
    """
    Verifies SHA256withRSA signature using PKCS1v15 padding.
    Returns (is_valid, message, error_code).
    """
    if not data_block or not signature_bytes:
        return False, "Missing data block or signature bytes.", "ERR_QR_SIGNATURE_INVALID"

    try:
        public_key = load_uidai_public_key(cert_path)
        public_key.verify(
            signature_bytes,
            data_block,
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        return True, "UIDAI RSA-2048 digital signature verified authentic.", None
    except InvalidSignature:
        return False, "Digital signature verification failed (forged or altered QR payload).", "ERR_QR_SIGNATURE_INVALID"
    except Exception as e:
        return False, f"Signature verification exception: {str(e)}", "ERR_QR_SIGNATURE_INVALID"


TupleBoolMessage = Any


def cross_check_qr_against_ocr(
    qr_fields: Dict[str, Any],
    printed_fields: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Cross-checks decoded QR fields against printed/OCR'd fields on the card.
    Specifically checks Name, DOB, and Gender.
    """
    mismatches = []

    qr_name = (qr_fields.get("name") or "").strip().upper()
    printed_name = (printed_fields.get("fullName") or printed_fields.get("name") or "").strip().upper()

    if qr_name and printed_name:
        # Check name equality or significant word overlap
        qr_words = set(qr_name.replace(".", " ").split())
        printed_words = set(printed_name.replace(".", " ").split())
        # If no common words or complete mismatch
        if not qr_words.intersection(printed_words) and qr_name != printed_name:
            mismatches.append(
                f"NAME MISMATCH: QR encodes '{qr_name}' but printed document displays '{printed_name}'."
            )

    qr_dob = (qr_fields.get("dob") or "").replace("/", "-").replace(".", "-").strip()
    printed_dob = (printed_fields.get("dateOfBirth") or printed_fields.get("dob") or "").replace("/", "-").replace(".", "-").strip()

    if qr_dob and printed_dob and len(qr_dob) >= 4 and len(printed_dob) >= 4:
        # Check year or full date match
        if qr_dob != printed_dob and qr_dob[-4:] != printed_dob[-4:]:
            mismatches.append(
                f"DOB MISMATCH: QR encodes '{qr_dob}' but printed document displays '{printed_dob}'."
            )

    qr_gender = (qr_fields.get("gender") or "").strip().upper()
    printed_gender = (printed_fields.get("gender") or "").strip().upper()

    if qr_gender and printed_gender:
        qr_g_code = "M" if qr_gender.startswith("M") else "F" if qr_gender.startswith("F") else "T"
        pr_g_code = "M" if printed_gender.startswith("M") else "F" if printed_gender.startswith("F") else "T"
        if qr_g_code != pr_g_code:
            mismatches.append(
                f"GENDER MISMATCH: QR encodes '{qr_gender}' but printed document displays '{printed_gender}'."
            )

    data_matched = len(mismatches) == 0
    return {
        "data_matched": data_matched,
        "mismatches": mismatches,
        "error_code": "ERR_QR_DATA_MISMATCH" if not data_matched else None,
    }
