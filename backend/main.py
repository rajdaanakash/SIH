from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import io
import numpy as np
from PIL import Image, ImageChops, ImageEnhance

app = FastAPI(
    title="SSB Drishti Document Forensics API",
    description="Backend microservice for SIH26188: AI-Based Fake Identity & Document Screening System",
    version="2.4.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def calculate_icao_check_digit(data: str) -> int:
    weights = [7, 3, 1]
    total = 0
    for i, char in enumerate(data.upper()):
        if '0' <= char <= '9':
            val = ord(char) - 48
        elif 'A' <= char <= 'Z':
            val = ord(char) - 65 + 10
        elif char == '<':
            val = 0
        else:
            val = 0
        total += val * weights[i % 3]
    return total % 10

class MrzVerificationRequest(BaseModel):
    document_number: str
    doc_check_digit: str
    date_of_birth: str
    dob_check_digit: str
    expiry_date: str
    expiry_check_digit: str
    composite_mrz: Optional[str] = None

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "SSB Drishti AI Document Forensics Engine",
        "outpost": "Raxaul (Indo-Nepal Border)",
        "version": "2.4.0",
        "problem_statement": "SIH26188 (MHA / SSB)"
    }

@app.post("/api/mrz/verify")
def verify_mrz(req: MrzVerificationRequest):
    try:
        doc_valid = calculate_icao_check_digit(req.document_number) == int(req.doc_check_digit)
    except (ValueError, TypeError):
        doc_valid = False

    try:
        dob_valid = calculate_icao_check_digit(req.date_of_birth) == int(req.dob_check_digit)
    except (ValueError, TypeError):
        dob_valid = False

    try:
        exp_valid = calculate_icao_check_digit(req.expiry_date) == int(req.expiry_check_digit)
    except (ValueError, TypeError):
        exp_valid = False

    composite_valid = True
    if req.composite_mrz and len(req.composite_mrz) > 1:
        try:
            comp_data = req.composite_mrz[:-1]
            comp_cd = int(req.composite_mrz[-1])
            composite_valid = calculate_icao_check_digit(comp_data) == comp_cd
        except (ValueError, TypeError, IndexError):
            composite_valid = False

    overall = doc_valid and dob_valid and exp_valid and composite_valid

    return {
        "doc_number_valid": doc_valid,
        "dob_valid": dob_valid,
        "expiry_valid": exp_valid,
        "composite_valid": composite_valid,
        "overall_icao_compliant": overall,
        "algorithm": "ICAO Doc 9303 (7-3-1 weight modulus 10)"
    }

@app.post("/api/forensics/ela")
async def analyze_ela(file: UploadFile = File(...)):
    contents = await file.read()
    orig = Image.open(io.BytesIO(contents)).convert("RGB")

    buffer = io.BytesIO()
    orig.save(buffer, "JPEG", quality=75)
    buffer.seek(0)
    recompressed = Image.open(buffer)

    diff = ImageChops.difference(orig, recompressed)
    stat = np.array(diff)
    mean_diff = float(np.mean(stat))
    anomaly_score = min(1.0, max(0.02, mean_diff / 40.0))

    return {
        "mean_difference": round(mean_diff, 2),
        "anomaly_score": round(anomaly_score, 2),
        "tamper_detected": anomaly_score > 0.45,
        "interpretation": "High-frequency localized compression variance" if anomaly_score > 0.45 else "Uniform compression pattern"
    }

class QrVerificationPayload(BaseModel):
    image_base64: Optional[str] = None
    printed_name: Optional[str] = None
    printed_dob: Optional[str] = None
    printed_gender: Optional[str] = None

@app.post("/api/qr/verify")
async def verify_qr_endpoint(
    payload: Optional[QrVerificationPayload] = None,
    file: Optional[UploadFile] = None
):
    contents = b""
    printed_fields = {}
    if file is not None and hasattr(file, "read"):
        contents = await file.read()
    elif payload and payload.image_base64:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
        import base64
        contents = base64.b64decode(raw_b64)
        printed_fields = {
            "fullName": payload.printed_name,
            "dateOfBirth": payload.printed_dob,
            "gender": payload.printed_gender,
        }

    from backend.qr import decode_aadhaar_qr, verify_qr_signature, cross_check_qr_against_ocr

    decoded = decode_aadhaar_qr(contents)
    if not decoded.get("qr_detected"):
        status = decoded.get("status", "QR_NOT_PRESENT")
        err_code = decoded.get("security_error_code")
        return {
            "qr_detected": False,
            "qr_decoded": False,
            "signature_verified": None,
            "data_matched": None,
            "status": status,
            "security_error_code": err_code,
            "message": decoded.get("message", "No QR code could be detected in image."),
        }

    if not decoded.get("qr_decoded"):
        status = decoded.get("status", "QR_PARSE_FAILED")
        err_code = decoded.get("security_error_code", "ERR_QR_UNREADABLE")
        return {
            "qr_detected": True,
            "qr_decoded": False,
            "signature_verified": False,
            "data_matched": False,
            "status": status,
            "security_error_code": err_code,
            "message": decoded.get("message", "QR detected but payload unreadable."),
        }

    sig_verified, sig_msg, sig_err = verify_qr_signature(
        decoded.get("data_block", b""),
        decoded.get("signature_bytes", b""),
        version=decoded.get("version", "V2_SECURE_QR")
    )

    cross_check = cross_check_qr_against_ocr(decoded.get("fields", {}), printed_fields)

    status = "VERIFIED"
    error_code = None
    if not sig_verified:
        status = "SIGNATURE_INVALID"
        error_code = "ERR_QR_SIGNATURE_INVALID"
    elif not cross_check.get("data_matched"):
        status = "DATA_MISMATCH"
        error_code = "ERR_QR_DATA_MISMATCH"

    return {
        "qr_detected": True,
        "qr_decoded": True,
        "is_secure_qr": decoded.get("is_secure_qr", False),
        "version": decoded.get("version"),
        "signature_verified": sig_verified,
        "signature_message": sig_msg,
        "data_matched": cross_check.get("data_matched", True),
        "mismatches": cross_check.get("mismatches", []),
        "status": status,
        "security_error_code": error_code,
        "decoded_fields": decoded.get("fields", {}),
    }

class ForensicsAnalyzePayload(BaseModel):
    image_base64: Optional[str] = None

@app.post("/api/forensics/analyze")
async def analyze_forensics_endpoint(
    payload: Optional[ForensicsAnalyzePayload] = None,
    file: Optional[UploadFile] = File(None)
):
    contents = b""
    if file:
        contents = await file.read()
    elif payload and payload.image_base64:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
        import base64
        contents = base64.b64decode(raw_b64)

    from backend.forensics import run_pixel_forensics
    result = run_pixel_forensics(contents)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
