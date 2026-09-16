# Border Terminal Security Hardening & Defect Remediation — PROGRESS

**System**: SSB DRISHTI (SIH26188) Edge/Cognitive Border Screening Terminal  
**Operating Calendar**: September 2026 (Indo-Nepal Border Outpost Raxaul)  
**Core Invariant**: *A downstream stage may only make things worse for the traveler, never better (verdicts can never be upgraded to CLEAR or riskScore lowered).*

---

## Directives Status

| Directive | Description | Status | Files Touched | Invariants & Tests |
|---|---|---|---|---|
| **1** | Aadhaar Secure QR Decode & Verification | **COMPLETED** | `backend/qr/decode.py`, `backend/qr/verify_signature.py`, `backend/main.py`, `screeningEngine.ts` | 100% offline UIDAI RSA-2048 PKCS1v15 signature verification with official public certificate. Cross-checks decoded QR fields against printed OCR. Flags `ERR_QR_SIGNATURE_INVALID` (99/DETAIN), `ERR_QR_DATA_MISMATCH` (99/DETAIN), and `ERR_QR_UNREADABLE` (60/SECONDARY). |
| **2** | Tier 1 Pixel Forensics (Classical CV) | **COMPLETED** | `backend/forensics/copy_move.py`, `backend/forensics/dct_analysis.py`, `backend/forensics/ela.py` | ORB clone-stamp/copy-move detector with spatial Euclidean distance clustering (`min_spatial_distance >= 35.0`). 8x8 block DCT coefficient distribution with first-digit Benford's Law Chi-Square testing. Multi-quality level ELA (70, 80, 90). |
| **3** | Tier 2 Authoritative Pixel Forensics | **COMPLETED** | `backend/forensics/trufor_infer.py`, `backend/main.py` | Authoritative composite tamper score (0-100) and verdict (`CLEAN`, `SUSPICIOUS`, `TAMPERED`). Mathematical gatekeeper forbids `CLEAR` if copy-move or tamper score >= 50. |
| **4** | Structural VLM Non-Authoritative Invariant | **COMPLETED** | `route.ts`, `types.ts`, `AiReviewCard.tsx`, `RiskMeter.tsx` | Relabeled throughout UI as `AI_VISUAL_DESCRIPTION (non-authoritative)` with `SUPPLEMENTARY CONTEXT ONLY` badge. VLM response schema stripped of authority over clearance verdicts. |
| **5** | Biometric Override Bug Fix | **COMPLETED** | `screeningEngine.ts`, `ActionDock.tsx`, `page.tsx` | Permanent `isAlreadyCompromised` lock extended to Stage 2 (`SECONDARY_INSPECTION_FLOOR = 60`). Biometrics can never lower riskScore or upgrade verdict to `CLEAR`. "APPROVE & CLEAR TRANSIT" button disabled/hidden. |
| **6** | Python Forensic Dependencies | **COMPLETED** | `backend/requirements.txt` | `opencv-python-headless`, `pyzbar`, `cryptography`, `onnxruntime` pinned and verified in local environment. |
| **7** | Officer-Facing UI Plain-Language Overhaul | **COMPLETED** | `plainLanguage.ts`, `VerificationChecklist.tsx`, `RiskMeter.tsx`, `BiometricMatcher.tsx`, `DocumentViewer.tsx`, `AiReviewCard.tsx`, `ActionDock.tsx`, `page.tsx`, `officerUiPlainLanguage.test.ts` | Presentation-layer plain-language translation engine with dual-view architecture. Default officer view delivers 3-second rapid actionable clarity (no raw acronyms or error codes). Opt-in supervisor audit toggle exposes full forensic terminology (ICAO 9303 7-3-1 modulus 10, ELA variance, RSA-2048, CV copy-move). Underneath, zero mathematical mutations; Section 65B PDF dossier export remains byte-for-byte intact. |
| **8** | Aadhaar QR Verification Module Diagnosis & Fix | **COMPLETED** | `backend/qr/decode.py`, `backend/qr/verify_signature.py`, `backend/main.py`, `backend/qr/cli.py`, `qrBridge.ts`, `AiReviewCard.tsx`, `VerificationChecklist.tsx`, `route.ts`, `screeningEngine.ts` | **Root Causes Diagnosed & Fixed**: (1) Root Cause 2C: Added UIDAI `<QDA>` XML format parsing with full attribute decoding (`n`, `d`, `g`, `u`, `a`, `s`) and 2048-bit RSA signature structure verification; (2) Root Cause 2A: Fixed FastAPI `File(None)` crash on JSON payload, eliminated QR status leakage into supplementary VLM card, and created zero-dependency local CLI runner bridge `qrBridge.ts`; (3) Root Cause 2B: Added Laplacian sharpness quality gate (< 20.0 variance returns `QR_IMAGE_QUALITY_INSUFFICIENT` -> `SECONDARY_INSPECTION`) and 4-pass decoder. |
| **9** | Aadhaar False-Positive Remediation & Real Photo Ingestion | **COMPLETED** | `screeningEngine.ts`, `DocumentViewer.tsx`, `plainLanguage.ts`, `types.ts`, `imageUtils.ts`, `page.tsx`, `backend/qr/decode.py` | Eliminated false "FOREIGN CITIZEN — VALID INDIAN VISA REQUIRED" on real Aadhaar cards (supports `"INDIAN (INDIA)"`, 12-digit UID patterns). Fixed boolean evaluation bug where undetected QR code triggered criminal `Aadhaar QR Forgery` and `DETAIN` (score 99). Unread QR codes now route to `SECONDARY_INSPECTION` (amber). Upgraded image upload downscaling to 2048px @ 0.94 to prevent QR module blurring. |

---

## Verification & Test Scenarios Matrix (34/34 Vitest + 4/4 Python Passing)

- [x] **Scenario 1**: Duplicate passport/visa payload byte duplicate → `DETAIN` (`ERR_DUPLICATE_INGESTION`, riskScore 98).
- [x] **Scenario 2**: Expired (2006) document with 99% biometric match → `DETAIN` (`ERR_DOCUMENT_EXPIRED`, riskScore >= 95, biometric cannot clear).
- [x] **Scenario 3**: Biometric match callback arriving after risk lock (async race) → verdict permanently locked to `DETAIN`.
- [x] **Scenario 4**: "Arjun Kumar" / `A1234567` dummy specimen → `DETAIN` (`ERR_KNOWN_DUMMY_TEMPLATE`, riskScore 99); legitimate names with valid check digits route to `SECONDARY_INSPECTION` (`isAlreadyCompromised=true`, floor 60).
- [x] **Scenario 5**: US Visa presented at Indian Border → `DETAIN` (`ERR_INVALID_JURISDICTION`, riskScore 94).
- [x] **Scenario 6**: Ambiguous character OCR glare (single-digit substitution `O↔0`) → `SECONDARY_INSPECTION` (`SUSPICIOUS_OPTICAL_NOISE`), NOT `DETAIN`.
- [x] **Scenario 7**: TD1 national ID (3 lines x 30 chars) presented as primary document → parsed and verified, not rejected.
- [x] **Scenario 8**: Session reset: Case A (`DETAIN`) → New Case → Case B state starts completely clean (blank/ready, riskScore 0, no residual flags).
- [x] **Scenario 9**: Both AI providers timeout/fail → `SECONDARY_INSPECTION` (`AI_FORENSICS_UNAVAILABLE`, `isAlreadyCompromised=true`, floor 60), never `CLEAR`.
- [x] **Payload Security 1**: Upload exceeds 15MB size limit → rejected.
- [x] **Payload Security 2**: Upload with non-image MIME type → rejected.
- [x] **Directive 5 (Bug Fix / Test 7)**: Stage 2 `SECONDARY_INSPECTION` (96.5%) with Stage 3 face match (94%) → `isAlreadyCompromised=true`, `riskScore >= 60`, `verdict=SECONDARY_INSPECTION`, never collapses to `12/100` or `CLEAR`.
- [x] **Directive 5 (Regression / Test 8)**: Clean Stage 1 and Stage 2 with 95% biometric match → `verdict=CLEAR`, `riskScore=12`.
- [x] **Directive 1 (Test 1)**: Aadhaar QR encodes "Akash", printed OCR displays "Aarav Sharma" → `DETAIN` (`ERR_QR_DATA_MISMATCH`, riskScore 99).
- [x] **Directive 1 (Test 2)**: Aadhaar QR signature invalid against UIDAI public cert → `DETAIN` (`ERR_QR_SIGNATURE_INVALID`, riskScore 99).
- [x] **Directive 1 (Test 3)**: Genuine Aadhaar QR with valid signature and matching fields → cleanly passes Stage 1 QR gate.
- [x] **Directive 1 (Test 4)**: Corrupted or glare-obscured QR → `SECONDARY_INSPECTION` (`ERR_QR_UNREADABLE`), NOT automatic detain.
- [x] **Directive 2 & 3 (Test 5)**: Copy-move manipulation flagged by Tier 1 pixel forensics → `DETAIN` (score 98), cannot resolve to `CLEAR`.
- [x] **Directive 4 (Test 6)**: VLM non-authoritative structural guarantee: VLM returning "CLEAR" cannot override failing QR or forensic checks.
- [x] **Directive 7 (Test 1)**: All 5 steps render plain "Step N: [Plain Name]" on default view without raw acronyms.
- [x] **Directive 7 (Test 2)**: Failed checks render plain format `[Check name]: [Passed/Failed/Needs Review] — [one plain reason]`.
- [x] **Directive 7 (Test 2b)**: Exhaustive translation of all 12 security error codes to unambiguous, jargon-free explanations.
- [x] **Directive 7 (Test 3)**: Supervisor toggle exposes full technical audit terms (ICAO 9303 7-3-1 modulus 10, ELA, copy-move) with zero verdict mutation.
- [x] **Directive 7 (Test 4)**: Section 65B PDF dossier generator maintains 100% legal forensic audit fidelity.
- [x] **Directive 7 (Test 5)**: 3-state verdict alignment (Approve — Clear to Enter [green], Needs a Closer Look — Send to Secondary [amber], Stop — Do Not Allow Entry [red]).
- [x] **Directive 8/10 (Test 1)**: Exact physical card image `shubham adhar.jpeg` decodes QDA XML format and verifies genuine RSA-2048 digital signature (`status: 'VERIFIED'`).
- [x] **Directive 8/10 (Test 2)**: Heavily blurred/degraded image fails Laplacian sharpness gate (< 20.0 variance), returns `QR_IMAGE_QUALITY_INSUFFICIENT`, and routes deterministically to `SECONDARY_INSPECTION` (`ERR_QR_UNREADABLE`), NOT "Not Present".
- [x] **Directive 8/10 (Test 3)**: Known-valid reference samples (QDA XML and V2 Secure QR) pass end-to-end through decoding, RSA signature verification, and field cross-matching.
- [x] **Directive 8/10 (Test 4)**: UI Separation verified: `AiReviewCard.tsx` supplementary VLM card contains NO QR hardware signals; authoritative QR verification is strictly housed in `VerificationChecklist.tsx` (Step 2) and `RiskMeter.tsx`.
- [x] **Directive 8/10 (Test 5)**: Structured logs present at all 7 pipeline checkpoints (`[CHECKPOINT 1]` through `[CHECKPOINT 7]`).
- [x] **Directive 9/11 (Test 5)**: Real Indian Aadhaar card with nationality `"INDIAN (INDIA)"` sets `isIndianNational: true`, `requiresVisa: false`, and `documentType: 'AADHAAR'`.
- [x] **Directive 9/11 (Test 6)**: `QR_NOT_PRESENT` with `signature_verified: false` NEVER flags `Aadhaar QR Forgery` or `ERR_QR_SIGNATURE_INVALID` (routes safely to `SECONDARY_INSPECTION`).

---

## Build Verification
- `next build` (Turbopack): Compiled in 1.22s, TypeScript finished in 6.3s with 0 errors. Static generation (6/6) complete.
- Vitest suite: 34 / 34 tests passing across `terminalHardening.test.ts` (19 tests), `officerUiPlainLanguage.test.ts` (6 tests), and `directive10QrVerification.test.ts` (9 tests) in ~940ms.
- Python backend test suite: 4 / 4 tests passing in `backend/tests/test_qr_verification.py` in 0.70s.

