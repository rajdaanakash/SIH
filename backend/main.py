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
    doc_valid = calculate_icao_check_digit(req.document_number) == int(req.doc_check_digit)
    dob_valid = calculate_icao_check_digit(req.date_of_birth) == int(req.dob_check_digit)
    exp_valid = calculate_icao_check_digit(req.expiry_date) == int(req.expiry_check_digit)
    overall = doc_valid and dob_valid and exp_valid

    return {
        "doc_number_valid": doc_valid,
        "dob_valid": dob_valid,
        "expiry_valid": exp_valid,
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
