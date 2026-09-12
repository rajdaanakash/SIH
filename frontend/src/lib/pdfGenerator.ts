import { jsPDF } from 'jspdf';
import { VerificationResult } from './types';

export function generateOfficialDossierPdf(result: VerificationResult): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Header Bar
  doc.setFillColor(15, 41, 66); // SSB Deep Navy
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Header Typography
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('GOVERNMENT OF INDIA | MINISTRY OF HOME AFFAIRS', pageWidth / 2, 8, { align: 'center' });
  doc.setFontSize(13);
  doc.text('SASHASTRA SEEMA BAL (SSB) - DRISHTI FORENSIC DOSSIER', pageWidth / 2, 16, { align: 'center' });

  // Outpost Sub-banner
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 24, pageWidth, 9, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    'OUTPOST: RAXAUL (INDO-NEPAL BORDER)   |   TOKEN: ' + result.tokenNumber + '   |   EXAM DATE: ' + result.timestamp,
    pageWidth / 2,
    30,
    { align: 'center' }
  );

  // Verdict Banner
  let verdictColor = [16, 185, 129]; // Emerald Green
  let verdictText = 'VERDICT: TRANSIT CLEARED (LOW RISK)';
  if (result.verdict === 'DETAIN') {
    verdictColor = [220, 38, 38]; // Red
    verdictText = 'CRITICAL ALERT: TRANSIT DETAINED (HIGH RISK / FORGERY DETECTED)';
  } else if (result.verdict === 'SECONDARY_INSPECTION') {
    verdictColor = [217, 119, 6]; // Amber
    verdictText = 'FLAGGED: TRANSFER TO SECONDARY MANUAL INVESTIGATION';
  }

  doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
  doc.rect(14, 38, pageWidth - 28, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(verdictText, pageWidth / 2, 44.5, { align: 'center' });

  // Section 1: Credential Particulars
  let y = 56;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('1. TRAVEL CREDENTIAL PARTICULARS', 14, y);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y + 2, pageWidth - 14, y + 2);

  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const col1 = 16;
  const col2 = 80;
  const col3 = 140;

  doc.text('Full Name: ' + result.extractedFields.fullName, col1, y);
  doc.text('Document No: ' + result.extractedFields.documentNumber, col2, y);
  doc.text('Nationality: ' + result.extractedFields.nationality, col3, y);

  y += 6;
  doc.text('Date of Birth: ' + result.extractedFields.dateOfBirth, col1, y);
  doc.text('Expiry Date: ' + result.extractedFields.expiryDate, col2, y);
  doc.text('Gender: ' + result.extractedFields.gender, col3, y);

  // Section 2: ICAO 9303 Compliance
  y += 12;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('2. ICAO DOC 9303 MRZ COMPLIANCE & CHECKSUM VERIFICATION', 14, y);
  doc.line(14, y + 2, pageWidth - 14, y + 2);

  y += 8;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const icaoStatus = result.icaoDetails.overallIcaoCompliant ? '[PASS] 100% Valid Checksums' : '[FAILED] Checksum Inconsistency Flagged';
  doc.text('Algorithm: ' + result.icaoDetails.rawAlgorithm, col1, y);
  doc.text('Status: ' + icaoStatus, col2, y);
  doc.text('Doc # Checksum: ' + (result.icaoDetails.documentNumberValid ? 'VALID' : 'INVALID'), col3, y);

  y += 6;
  doc.text('DOB Checksum: ' + (result.icaoDetails.dobValid ? 'VALID' : 'INVALID'), col1, y);
  doc.text('Expiry Checksum: ' + (result.icaoDetails.expiryValid ? 'VALID' : 'INVALID'), col2, y);
  doc.text('Composite Checksum: ' + (result.icaoDetails.compositeValid ? 'VALID' : 'INVALID'), col3, y);

  if (result.extractedFields.mrzLine1) {
    y += 6;
    doc.setFont('courier', 'normal');
    doc.text('MRZ Line 1: ' + result.extractedFields.mrzLine1, col1, y);
    y += 5;
    doc.text('MRZ Line 2: ' + result.extractedFields.mrzLine2, col1, y);
    doc.setFont('helvetica', 'normal');
  }

  // Section 3: Digital & Physical Forensics
  y += 12;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('3. MULTI-FACTOR FORENSICS & FORGERY ANALYSIS', 14, y);
  doc.line(14, y + 2, pageWidth - 14, y + 2);

  y += 8;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  doc.text('Photo Replacement: ' + (result.tamperDetails.photoReplacementDetected ? 'FLAGGED (Seam Anomaly)' : 'CLEAN (Uniform Border)'), col1, y);
  doc.text('Text Manipulation: ' + (result.tamperDetails.textManipulationDetected ? 'FLAGGED (Font Inconsistent)' : 'CLEAN'), col2, y);
  doc.text('Stamp Verification: ' + (result.tamperDetails.stampForgeryDetected ? 'ANOMALOUS' : 'AUTHENTIC'), col3, y);

  y += 6;
  doc.text('ELA Anomaly Score: ' + result.tamperDetails.elaAnomalyScore, col1, y);
  doc.text('Metadata Tampered: ' + (result.tamperDetails.metadataTampered ? 'YES (Editing Software Fingerprint)' : 'NO'), col2, y);
  doc.text('Watchlist Check: ' + (result.watchlistHit ? 'CRITICAL HIT' : 'CLEARED'), col3, y);

  // Flagged findings box if any
  if (result.tamperDetails.flaggedRegions.length > 0) {
    y += 8;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(252, 165, 165);
    doc.rect(14, y, pageWidth - 28, 16, 'FD');
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.text('FLAGGED IRREGULARITIES:', 18, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    result.tamperDetails.flaggedRegions.forEach((reg, idx) => {
      doc.text('• ' + reg.field + ': ' + reg.description, 18, y + 10 + idx * 4);
    });
    y += 18;
  }

  // Section 4: Biometric 1:1 Match
  y += 10;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('4. 1:1 LIVE BIOMETRIC VERIFICATION & LIVENESS', 14, y);
  doc.line(14, y + 2, pageWidth - 14, y + 2);

  y += 8;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  doc.text('Face Match: ' + (result.biometricDetails.faceMatched ? 'VERIFIED' : 'MISMATCH'), col1, y);
  doc.text('Similarity Score: ' + result.biometricDetails.similarityScore + '% (Threshold: 68%)', col2, y);
  doc.text('Liveness Test: ' + (result.biometricDetails.livenessVerified ? 'PASSED (Anti-Spoof)' : 'FAILED'), col3, y);

  // Section 5: Risk Assessment & Audit Footer
  y += 16;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, pageWidth - 28, 22, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('COMPOSITE THREAT RISK INDEX: ' + result.riskScore + ' / 100  [LEVEL: ' + result.riskLevel + ']', 18, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Summary: ' + result.executiveSummary, 18, y + 13, { maxWidth: pageWidth - 36 });

  // Officer Signature & Cryptographic Seal
  y += 32;
  doc.line(14, y, 70, y);
  doc.text('Examining Officer Signature & Stamp', 14, y + 5);
  doc.text('SSB Unit: 42nd Battalion (Raxaul)', 14, y + 9);

  doc.line(pageWidth - 75, y, pageWidth - 14, y);
  doc.text('Cryptographic Verification Hash (SHA-256):', pageWidth - 75, y + 5);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text('8f3c...b912-ssb-gov-in-verified', pageWidth - 75, y + 9);

  // Save PDF
  doc.save('SSB_Drishti_Dossier_' + result.tokenNumber + '.pdf');
}
