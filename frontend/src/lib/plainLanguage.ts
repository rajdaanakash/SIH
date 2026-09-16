/**
 * SSB DRISHTI (SIH26188) — Plain-Language Officer UX Layer
 * 
 * Provides translation of technical forensic telemetry and error codes
 * into clear, unambiguous, action-oriented explanations for border officers.
 * 
 * Core Invariant: Presentation-layer only. Underneath, all deterministic
 * mathematical gatekeeping, error codes, and audit records remain intact.
 */

import { VerificationResult, Verdict, SecurityErrorCode } from './types';

export interface PlainVerdictInfo {
  label: string;
  actionText: string;
  color: 'green' | 'amber' | 'red' | 'slate';
  badgeClass: string;
  oneLineReason: string;
}

export function getPlainVerdict(result: VerificationResult): PlainVerdictInfo {
  const { verdict, isTerminalBlank, isAlreadyCompromised, securityErrorCode, executiveSummary } = result;

  if (isTerminalBlank || verdict === 'UNDETERMINED') {
    return {
      label: 'Awaiting Document Scan',
      actionText: 'Standby: Awaiting Passenger Scan',
      color: 'slate',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      oneLineReason: 'Ready for next traveler. Ingest passport and visa to evaluate.',
    };
  }

  if (verdict === 'DETAIN' || (isAlreadyCompromised && result.riskScore >= 95)) {
    return {
      label: 'Stop — Do Not Allow Entry',
      actionText: 'Stop — Do Not Allow Entry',
      color: 'red',
      badgeClass: 'bg-rose-50 text-rose-900 border-rose-400',
      oneLineReason: getPlainSecurityReason(securityErrorCode, executiveSummary),
    };
  }

  if (verdict === 'SECONDARY_INSPECTION' || isAlreadyCompromised) {
    return {
      label: 'Needs a Closer Look — Send to Secondary',
      actionText: 'Send to Secondary Inspection',
      color: 'amber',
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-400',
      oneLineReason: getPlainSecurityReason(securityErrorCode, executiveSummary),
    };
  }

  // verdict === 'CLEAR' and not compromised
  return {
    label: 'Approve — Clear to Enter',
    actionText: 'Approve & Clear Transit',
    color: 'green',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    oneLineReason: 'All security checks passed. Traveler is cleared to enter.',
  };
}

export function getPlainSecurityReason(errorCode?: SecurityErrorCode, fallback?: string): string {
  switch (errorCode) {
    case 'ERR_QR_SIGNATURE_INVALID':
      return 'Security code on ID could not be verified — digital signature is invalid or forged.';
    case 'ERR_QR_DATA_MISMATCH':
      return "Details on ID don't match its built-in security code — name or date contradicts the QR code.";
    case 'ERR_DUPLICATE_INGESTION':
      return 'Same image uploaded twice — identical file was submitted for both passport and visa.';
    case 'ERR_DOCUMENT_EXPIRED':
      return 'Document has expired — traveler cannot cross with an expired document.';
    case 'ERR_INVALID_JURISDICTION':
      return "Wrong country's visa presented — entry requires a valid Indian visa, not a foreign visa.";
    case 'ERR_KNOWN_DUMMY_TEMPLATE':
      return 'This looks like a sample/template document, not a real government document.';
    case 'ERR_INVALID_PRIMARY_DOC':
      return 'A visa sticker was uploaded instead of a passport booklet.';
    case 'ERR_ICAO_CHECKSUM':
      return "Security code check failed — the document's built-in numbers don't add up correctly.";
    case 'ERR_VIZ_MRZ_MISMATCH':
      return "The printed details don't match the document's built-in security code.";
    case 'ERR_QR_UNREADABLE':
      return 'Security code on ID is blurry or unreadable — manual check required.';
    case 'SUSPICIOUS_OPTICAL_NOISE':
      return 'Glare or blur detected on printed security numbers — secondary review required.';
    case 'AI_FORENSICS_UNAVAILABLE':
      return 'Automated photo review temporarily offline — physical inspection required.';
    default:
      if (fallback && fallback.trim()) {
        return fallback;
      }
      return 'Security review required before clearing traveler.';
  }
}

export interface PlainStepInfo {
  stepNumber: number;
  title: string;
  technicalTitle: string;
  statusBadge: string;
  explanation: string;
  passed: boolean;
  statusType: 'passed' | 'failed' | 'warning' | 'standby';
}

export function getPlainStep1(result: VerificationResult): PlainStepInfo {
  return {
    stepNumber: 1,
    title: 'Step 1: Reading the Document',
    technicalTitle: 'Module 1: OCR & MRZ Parsing',
    statusBadge: result.isTerminalBlank ? 'Awaiting Scan' : 'Document read successfully',
    explanation: result.isTerminalBlank
      ? 'Upload passport and visa to start reading credentials.'
      : 'Step 1: Reading the Document: Passed — the system successfully read the printed details on the document.',
    passed: !result.isTerminalBlank,
    statusType: result.isTerminalBlank ? 'standby' : 'passed',
  };
}

export function getPlainStep2(result: VerificationResult): PlainStepInfo {
  const { icaoDetails, opticalNoiseDetected, icaoChecksumFailed, isTerminalBlank } = result;

  if (isTerminalBlank) {
    return {
      stepNumber: 2,
      title: 'Step 2: Security Code Check',
      technicalTitle: 'Module 2: ICAO 9303 Checksum',
      statusBadge: 'Awaiting Scan',
      explanation: 'Security code verification will run automatically upon upload.',
      passed: false,
      statusType: 'standby',
    };
  }

  if (icaoChecksumFailed) {
    return {
      stepNumber: 2,
      title: 'Step 2: Security Code Check',
      technicalTitle: 'Module 2: ICAO 9303 Checksum (7-3-1 modulus 10)',
      statusBadge: 'Failed — do not proceed',
      explanation: "Step 2: Security Code Check: Failed — the numbers on the document don't add up correctly, which usually means it's been altered or is fake.",
      passed: false,
      statusType: 'failed',
    };
  }

  if (opticalNoiseDetected) {
    return {
      stepNumber: 2,
      title: 'Step 2: Security Code Check',
      technicalTitle: 'Module 2: ICAO 9303 Checksum (Optical Disambiguation)',
      statusBadge: 'Needs Review',
      explanation: 'Step 2: Security Code Check: Needs Review — glare or blur on the document numbers. An officer should double-check the printed text.',
      passed: false,
      statusType: 'warning',
    };
  }

  return {
    stepNumber: 2,
    title: 'Step 2: Security Code Check',
    technicalTitle: 'Module 2: ICAO 9303 Checksum',
    statusBadge: 'Passed',
    explanation: "Step 2: Security Code Check: Passed — the document's built-in numbers match official security standards.",
    passed: true,
    statusType: 'passed',
  };
}

export function getPlainStep3(result: VerificationResult): PlainStepInfo {
  const { tamperDetails, isTerminalBlank, pixelForensics, qrDetails } = result;

  if (isTerminalBlank) {
    return {
      stepNumber: 3,
      title: 'Step 3: Tamper Check',
      technicalTitle: 'Module 3: Forgery Detection & Forensics',
      statusBadge: 'Awaiting Scan',
      explanation: 'Digital and physical tampering checks will run automatically upon upload.',
      passed: false,
      statusType: 'standby',
    };
  }

  const isCopyMove = pixelForensics?.copyMoveDetected || tamperDetails.photoReplacementDetected;
  const isQrTampered = qrDetails?.status === 'SIGNATURE_INVALID' || qrDetails?.status === 'DATA_MISMATCH';
  const isTampered = isCopyMove || isQrTampered || tamperDetails.textManipulationDetected || tamperDetails.elaAnomalyScore > 0.50;

  if (isTampered) {
    let reason = 'Photo or text shows signs of being edited, pasted, or altered.';
    if (isQrTampered) {
      reason = "Details on ID don't match its built-in security code or the digital signature is invalid.";
    } else if (isCopyMove) {
      reason = 'Parts of the document photo or text appear to be cloned or copied from elsewhere.';
    }

    return {
      stepNumber: 3,
      title: 'Step 3: Tamper Check',
      technicalTitle: 'Module 3: Forgery Detection (ELA, Copy-Move, QR Crypto)',
      statusBadge: 'Failed — editing detected',
      explanation: `Step 3: Tamper Check: Failed — ${reason}`,
      passed: false,
      statusType: 'failed',
    };
  }

  if (pixelForensics?.forensicVerdict === 'SUSPICIOUS' || tamperDetails.elaAnomalyScore > 0.35) {
    return {
      stepNumber: 3,
      title: 'Step 3: Tamper Check',
      technicalTitle: 'Module 3: Forgery Detection (ELA Variance)',
      statusBadge: 'Needs Review',
      explanation: 'Step 3: Tamper Check: Needs Review — minor image compression differences found. Inspect physical document closely.',
      passed: false,
      statusType: 'warning',
    };
  }

  return {
    stepNumber: 3,
    title: 'Step 3: Tamper Check',
    technicalTitle: 'Module 3: Forgery Detection',
    statusBadge: 'Passed',
    explanation: 'Step 3: Tamper Check: Passed — no signs of editing or tampering found.',
    passed: true,
    statusType: 'passed',
  };
}

export function getPlainStep4(result: VerificationResult): PlainStepInfo {
  const { biometricDetails, isTerminalBlank } = result;

  if (isTerminalBlank) {
    return {
      stepNumber: 4,
      title: 'Step 4: Face Match',
      technicalTitle: 'Module 4: 1:1 Face Match & Liveness',
      statusBadge: 'Awaiting Camera',
      explanation: 'Snap or capture traveler photo to verify identity against document.',
      passed: false,
      statusType: 'standby',
    };
  }

  if (biometricDetails.similarityScore === 0) {
    return {
      stepNumber: 4,
      title: 'Step 4: Face Match',
      technicalTitle: 'Module 4: 1:1 Face Match',
      statusBadge: 'Needs Review — No Face Found',
      explanation: 'Step 4: Face Match: Needs Review — no face found in camera view. Please center the traveler in front of the camera.',
      passed: false,
      statusType: 'warning',
    };
  }

  if (biometricDetails.faceMatched) {
    return {
      stepNumber: 4,
      title: 'Step 4: Face Match',
      technicalTitle: 'Module 4: 1:1 Face Match (Cosine Similarity)',
      statusBadge: 'Face Matches Traveler',
      explanation: `Step 4: Face Match: Passed — traveler matches document photo (${biometricDetails.similarityScore}% match — looks like the same person).`,
      passed: true,
      statusType: 'passed',
    };
  }

  return {
    stepNumber: 4,
    title: 'Step 4: Face Match',
    technicalTitle: 'Module 4: 1:1 Face Match',
    statusBadge: 'Face Does Not Match Traveler',
    explanation: `Step 4: Face Match: Failed — traveler does not match the photo on this document (${biometricDetails.similarityScore}% match).`,
    passed: false,
    statusType: 'failed',
  };
}

export function getPlainStep5(result: VerificationResult): PlainStepInfo | null {
  if (!result.hasVisa || !result.visaDetails) return null;

  const { isDuplicateDocument, isInvalidJurisdiction, isExpired, visaDetails } = result;

  if (isDuplicateDocument) {
    return {
      stepNumber: 5,
      title: 'Step 5: Visa Check',
      technicalTitle: 'Module 5: Visa & IVFRT Cross-Reconciliation',
      statusBadge: 'Failed — Same Image Uploaded Twice',
      explanation: 'Step 5: Visa Check: Failed — the exact same image was uploaded for both passport and visa.',
      passed: false,
      statusType: 'failed',
    };
  }

  if (isInvalidJurisdiction) {
    return {
      stepNumber: 5,
      title: 'Step 5: Visa Check',
      technicalTitle: 'Module 5: Consular Jurisdiction Verification',
      statusBadge: 'Failed — Wrong Country Visa',
      explanation: "Step 5: Visa Check: Failed — this is a visa for another country, not India. A valid Indian visa is required.",
      passed: false,
      statusType: 'failed',
    };
  }

  if (isExpired) {
    return {
      stepNumber: 5,
      title: 'Step 5: Visa Check',
      technicalTitle: 'Module 5: Visa Temporal Expiry',
      statusBadge: 'Failed — Document Expired',
      explanation: 'Step 5: Visa Check: Failed — this travel credential has expired and cannot be used.',
      passed: false,
      statusType: 'failed',
    };
  }

  if (visaDetails.overallCrossCheckPassed === false || visaDetails.passportMatched === false) {
    return {
      stepNumber: 5,
      title: 'Step 5: Visa Check',
      technicalTitle: 'Module 5: Visa & IVFRT Cross-Reconciliation',
      statusBadge: 'Failed — Details Do Not Match',
      explanation: 'Step 5: Visa Check: Failed — the visa details do not match this passport or traveler.',
      passed: false,
      statusType: 'failed',
    };
  }

  return {
    stepNumber: 5,
    title: 'Step 5: Visa Check',
    technicalTitle: 'Module 5: Visa & IVFRT Cross-Reconciliation',
    statusBadge: 'Passed — Visa Matches Passport',
    explanation: 'Step 5: Visa Check: Passed — the visa was issued for this passport and traveler.',
    passed: true,
    statusType: 'passed',
  };
}
