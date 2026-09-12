# 🛡️ SSB DRISHTI: AI-Based Fake Identity & Document Screening System

**Smart India Hackathon 2026 | Problem Statement ID: SIH26188**  
- **Ministry**: Ministry of Home Affairs (MHA)  
- **Department**: Sashastra Seema Bal (SSB), Police II Division  
- **Category**: Software | **Theme**: Blockchain & Cybersecurity  
- **Operational Target**: Outpost Raxaul (Indo-Nepal Border) & Checkpoint Immigration

---

## 📌 Executive Overview

**SSB DRISHTI** is a mobile-first, edge-capable forensic document verification terminal engineered for border security forces. It automates the inspection of Passports, Visas, and National IDs, reducing checkpoint transit inspection time from **3–5 minutes down to under 5 seconds**, while detecting digital photo replacements, altered expiry dates, forged rubber stamps, and ICAO 9303 checksum failures.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SSB DRISHTI ARCHITECTURE                       │
├──────────────────┬──────────────────────┬──────────────────────────────┤
│ 1. Ingestion     │ 2. Sub-Second Edge   │ 3. Cognitive Multimodal AI   │
│ • Flatbed Scan   │ • Tesseract OCR      │ • Gemini 3.6 Flash Vision    │
│ • Mobile Camera  │ • ICAO 9303 Engine   │ • Splicing & Font Kerning    │
│ • Custom Upload  │ • Error Level (ELA)  │ • 1:1 Live Biometric Cosine  │
└──────────────────┴──────────────────────┴──────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Official Action & Evidence Dossier (Court-Admissible PDF / Sec 65B)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 4 Mandatory Core Modules (SIH26188)

1. **Module 1: OCR & MRZ Parsing**:
   - Parses Visual Inspection Zone (VIZ) text and 2-line/3-line Machine Readable Zones (MRZ).
   - Cross-checks printed VIZ fields against MRZ text strings.
2. **Module 2: ICAO Doc 9303 Checksum Engine**:
   - Strict 7-3-1 modulus-10 check-digit validation across Document Number, Date of Birth, and Expiration Date.
   - Detects mathematical tampering instantly.
3. **Module 3: Forgery Detection & Forensic ELA**:
   - Error Level Analysis (ELA) reveals secondary JPEG compression patches.
   - Multimodal vision inspects font typography, baseline misalignment, photo cut-and-paste seams, and rubber stamp circularity.
4. **Module 4: 1:1 Live Biometric Verification**:
   - Extracts document portrait and compares it against live traveler camera feed using Cosine Distance embeddings.
   - Passive anti-spoof liveness testing prevents photo-of-screen attacks.

---

## 🛠️ Tech Stack & Requirements

### Frontend Requirements (`frontend/package.json`)
* **Next.js 16 (Turbopack)**: High-performance React framework.
* **React 19**: Modern UI rendering engine.
* **Tailwind CSS v4**: Mobile-first responsive GovTech styling.
* **@google/genai**: Official Google Gen AI SDK for Gemini 3.6 Flash multimodal vision.
* **Lucide React**: Vector icons.
* **jsPDF**: Client-side court-admissible legal evidence dossier PDF generation.

### Backend Requirements (`backend/requirements.txt`)
* `fastapi>=0.110.0` - High-speed asynchronous Python REST API.
* `uvicorn[standard]>=0.28.0` - ASGI production server.
* `python-multipart>=0.0.9` - File and multipart form upload handling.
* `pydantic>=2.6.0` - Strict payload and schema validation.
* `pillow>=10.2.0` - Image manipulation and ELA channel difference.
* `numpy>=1.26.0` - Numerical array operations for pixel variance.
* `opencv-python-headless>=4.9.0` - Edge contour & contour circularity detection.
* `google-genai>=1.0.0` - Python SDK for Google Gemini models.
* `python-dotenv>=1.0.0` - Environment variable management.
* `httpx>=0.27.0` & `requests>=2.31.0` - Async and sync HTTP clients.

---

## 💻 How to Run Locally

### Prerequisites
Make sure you have the following installed on your machine:
* **Node.js**: `v18.17+` or `v20+` ([Download Node.js](https://nodejs.org/))
* **Python**: `3.10+` ([Download Python](https://www.python.org/))
* **Git**: Installed and configured ([Download Git](https://git-scm.com/))
* **Google Gemini API Key**: Free from [Google AI Studio](https://aistudio.google.com/)

---

### Step 1: Run the Frontend (Next.js Terminal)

1. Open a terminal in the project root:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your API key:
   * Copy `.env.local.example` to `.env.local`:
     ```bash
     # Windows (PowerShell):
     Copy-Item .env.local.example .env.local
     # Linux / Mac:
     cp .env.local.example .env.local
     ```
   * Open `.env.local` and add your free Gemini API key:
     ```env
     GEMINI_API_KEY=AIzaSy...your_key_here
     ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser at:  
   👉 **`http://localhost:3000`**

*Tip: Press `F12` in Chrome/Edge, click the **Mobile Device Toggle** icon, and select **iPhone 14 / Pixel 7** for the authentic handheld terminal layout.*

---

### Step 2: Run the Backend Microservice (Optional FastAPI Terminal)

1. Open a second terminal window:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Create virtual environment
   python -m venv venv

   # Activate on Windows (PowerShell):
   venv\Scripts\activate

   # Activate on Mac / Linux:
   source venv/bin/activate
   ```
3. Install all Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Launch the FastAPI server:
   ```bash
   python main.py
   # Or using uvicorn:
   uvicorn main:app --reload --port 8000
   ```
5. Check backend health & interactive Swagger docs:  
   👉 **`http://localhost:8000/docs`**

---

### Step 3: Run on Mobile Phones (Border Outpost Simulation)

To test the mobile interface on your smartphone:

#### Option A: VS Code Dev Tunnels (Recommended)
1. In VS Code, click the **Ports** tab at the bottom.
2. Find Port `3000`.
3. Right-click Port 3000 -> **Port Visibility** -> Select **Public**.
4. Copy the generated `https://...devtunnels.ms` link and open it in your mobile phone browser.

#### Option B: Local Wi-Fi / Hotspot
1. Connect your phone and laptop to the same Wi-Fi network or mobile hotspot.
2. Run:
   ```bash
   cd frontend
   npm run dev -- -H 0.0.0.0
   ```
3. Open `http://<your-laptop-ip>:3000` on your phone browser.

---

## 🔄 Git Team Workflow: Pull, Change, and Push

Follow this exact guide when collaborating with your hackathon team.

### 1. First-Time Setup (Cloning the Repository)
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd SIH
```

### 2. Pull the Latest Code Before Starting Work
Always pull the latest changes from your teammates before writing code:
```bash
git checkout main
git pull origin main
```

### 3. Create a Feature Branch
Do not work directly on `main` to prevent accidental overwrites:
```bash
git checkout -b feature/your-feature-name
# Example: git checkout -b feature/visa-enhancements
```

### 4. Make Your Code Changes and Verify
After editing code, always ensure the project builds with zero errors:
```bash
cd frontend
npm run build
```

### 5. Check What Changed
```bash
git status
git diff
```

### 6. Stage and Commit Your Changes
> [!NOTE]
> The root `.gitignore` is already configured. It automatically keeps your private `.env.local` API key safe from being accidentally committed to GitHub.

```bash
git add .
git commit -m "feat: describe what you changed clearly"
# Example: git commit -m "feat: added gemini 3.6 flash vision OCR for custom uploads"
```

### 7. Push Changes to GitHub
```bash
git push -u origin feature/your-feature-name
```

### 8. Create a Pull Request (PR) or Merge to Main
1. Go to your GitHub repository in your browser.
2. Click **Compare & pull request**.
3. Review changes and click **Merge pull request**.
4. Teammates can then update their local machines by running:
   ```bash
   git checkout main
   git pull origin main
   ```

---

## 🏆 SIH Evaluation Demo Walkthrough (3-Minute Pitch)

1. **Preset 1 (Valid Passport - Green)**: Show 100% check pass, 94.8% face match, Risk Score: 12 (Clear).
2. **Preset 2 (Forged Expiry - Red)**: Expiry altered from 2024 to 2034. ICAO 9303 check digit fails in red.
3. **Preset 3 (Photo Impersonation - Red)**: Splicing seam flagged on portrait boundary. Face match fails at 31.2%.
4. **Preset 4 (Irregular Visa Stamp - Amber)**: Visa endorsement banner activates, rubber stamp circularity anomaly flagged for secondary inspection.
5. **Upload Custom**: Select any real passport photo. Watch Gemini 3.6 Flash autonomously extract the real name, passport number, and dates in real time.
6. **Export Dossier (PDF)**: Tap the bottom button to download a standardized, court-admissible forensic legal report (Section 65B compliant).

---

## ⚖️ Legal & Security Compliance
* **Zero Hardcoded Secrets**: All keys loaded via local environment configurations.
* **Bharatiya Sakshya Adhiniyam / Section 65B Indian Evidence Act**: Exported evidence dossiers feature officer badge verification, timestamp telemetry, and SHA-256 integrity hashes.
* **Privacy & Data Protection**: Document scans are ephemeral and processed in-memory or on local edge nodes without unauthorized cloud retention.
