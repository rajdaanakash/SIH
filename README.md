# SSB DRISHTI: AI-Based Fake Identity & Document Screening System
**Smart India Hackathon 2026 | Problem Statement ID: SIH26188**  
**Organization**: Ministry of Home Affairs (MHA)  
**Department**: Sashastra Seema Bal (SSB), Police II Division  
**Category**: Software | **Theme**: Blockchain & Cybersecurity  

---

## 🌟 Overview
**SSB Drishti** is an automated, mobile-first AI document screening platform engineered for border security personnel stationed at transit checkpoints (such as Raxaul on the Indo-Nepal border). It reduces passenger document inspection time from 3–5 minutes down to **under 5 seconds**, while detecting sophisticated physical and digital forgeries that bypass manual human scrutiny.

---

## 🧩 4 Core Modules (As Specified in SIH26188)
1. **Module 1: OCR & MRZ Extraction**: Automatically parses Visual Inspection Zone (VIZ) text and standard ICAO Doc 9303 2-line/3-line Machine Readable Zones.
2. **Module 2: Document Validation & Checksum Engine**: Computes strict 7-3-1 weight modulus-10 check digits on Document Number, DOB, and Expiry Date; cross-matches VIZ against MRZ strings.
3. **Module 3: Tampering & Forgery Detection (Core AI Innovation)**:
   - Photo Replacement Seam Detector (boundary cut/paste artifacts).
   - Text & Font Manipulation Detector (inconsistent font kerning & baselines).
   - Stamp Forgery Analyzer (circular contour and ink hue variance).
   - Error Level Analysis (ELA) Heatmaps (exposes digital JPEG re-compression patches).
4. **Module 4: 1:1 Live Biometric Verification & Liveness**: Compares document portrait to live traveler camera with passive anti-spoof liveness check.

---

## 🚀 Quick Start Guide

### 1. Frontend (Next.js Mobile-First Web Application)
```bash
cd frontend
npm run dev
```
Open your browser at [http://localhost:3000](http://localhost:3000).  
*Tip: Open Chrome Developer Tools (`F12`) and toggle the **Mobile Device Toolbar** (e.g. iPhone / Pixel view) to experience the handheld field interface.*

### 2. Backend (Optional Python FastAPI Microservice)
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows
pip install -r requirements.txt
python main.py
```
FastAPI server runs at [http://localhost:8000](http://localhost:8000) with interactive Swagger documentation at `/docs`.

---

## 🏆 Presentation & Evaluation Features
- **One-Click Preloaded Test Presets**:
  1. *Valid Indian Passport*: 100% checks pass, 96.4% face match, Risk Score: 12 (🟢 Low Risk / Cleared).
  2. *Forged Expiry Date*: Expiry altered from 2024 to 2034, ICAO check digit fails, ELA variance flags tampered text, Risk Score: 88 (🔴 High Threat / Detain).
  3. *Photo-Replaced Impersonation*: Seam anomaly flagged on photo border, live facial match fails at 34.2%, Interpol SLTD watchlist hit, Risk Score: 96 (🔴 Critical Threat / Detain).
  4. *Irregular Visa Stamp*: Non-circular contour distortion & hue mismatch, Risk Score: 54 (🟡 Secondary Review).
- **Interactive ELA Heatmap Toggle**: Switch live between Plain Scan, Forensic Bounding Boxes, and Error Level Analysis Heatmaps.
- **Official Court-Admissible PDF Evidence Dossier**: Generates a standardized, timestamped investigation report with MHA/SSB watermarks and digital verification hashes.
