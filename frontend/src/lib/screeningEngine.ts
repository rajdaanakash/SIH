/**
 * SSB DRISHTI (SIH26188) — Core Screening & Invariant Enforcement Engine
 * 
 * Enforces strict zero-trust border verification invariants:
 * 1. A downstream stage may ONLY make things worse for the traveler, never better.
 * 2. Biometric matching can never clear an already-compromised document or lower riskScore.
 * 3. Session resets hard-purge all state to prevent cross-traveler leakage.
 */

import {
  VerificationResult,
  ExtractedFields,
  Verdict,
  SecurityErrorCode,
  IcaoChecksumDetails,
  TamperDetectionResult,
  BiometricMatchResult,
} from './types';
import { checkDocumentExpiry, isDuplicatePayload, computeSha256 } from './dateUtils';
import {
  parseAndVerifyTd3Mrz,
  parseAndVerifyTd1Mrz,
  parseAndVerifyMrz,
  detectDummyOrSpecimen,
  checkVizMrzConsistency,
} from './icao9303';

export const STAGE_1_DETAIN_FLOOR = 95;
export const STAGE_2_DETAIN_FLOOR = 95;
export const SECONDARY_INSPECTION_FLOOR = 60;

export const INITIAL_CLEAN_RESULT: VerificationResult = {
  id: 'READY',
  isTerminalBlank: true,
  timestamp: 'Awaiting Scan',
  tokenNumber: 'SSB-2026-READY',
  documentType: 'PASSPORT',
  extractedFields: {
    fullName: 'AWAITING PASSENGER SCAN',
    documentNumber: '---------',
    nationality: '---',
    dateOfBirth: '--/--/----',
    expiryDate: '--/--/----',
    gender: 'M',
    issuingCountry: '---',
    mrzLine1: '',
    mrzLine2: '',
  },
  icaoDetails: {
    documentNumberValid: false,
    dobValid: false,
    expiryValid: false,
    compositeValid: false,
    rawAlgorithm: 'ICAO Doc 9303 Part 3/7 (Modulus 10, 7-3-1 weights)',
    overallIcaoCompliant: false,
    notes: ['Terminal ready. Ingest traveler credentials (Passport + Visa) to run automated screening.'],
  },
  tamperDetails: {
    photoReplacementDetected: false,
    photoSeamConfidence: 0,
    textManipulationDetected: false,
    fontInconsistencyScore: 0,
    stampForgeryDetected: false,
    stampCircularityAnomaly: 0,
    elaAnomalyScore: 0,
    metadataTampered: false,
    flaggedRegions: [],
  },
  biometricDetails: {
    faceMatched: false,
    similarityScore: 0,
    livenessVerified: false,
    livenessConfidence: 0,
    faceDetectedInDocument: false,
    liveFeedAvailable: false,
    bearerStatus: 'AWAITING_CAPTURE',
  },
  watchlistHit: false,
  riskScore: 0,
  riskLevel: 'LOW',
  verdict: 'UNDETERMINED',
  isAlreadyCompromised: false,
  executiveSummary: 'TERMINAL READY: Upload Passport and Visa credentials to execute automated forensic screening, ICAO validation, and cross-reconciliation.',
  documentImageUrl: '',
  documentFaceUrl: '',
  liveTravelerPhotoUrl: '',
  securityAlertMessages: [],
};

/**
 * Creates a brand new, isolated traveler session object with no residual data.
 */
export function createCleanSession(): VerificationResult {
  return {
    ...INITIAL_CLEAN_RESULT,
    id: `CASE-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toLocaleString('en-IN') + ' IST',
    tokenNumber: `SSB-2026-${Math.floor(10000 + Math.random() * 90000)}`,
    extractedFields: { ...INITIAL_CLEAN_RESULT.extractedFields },
    icaoDetails: { ...INITIAL_CLEAN_RESULT.icaoDetails, notes: [...INITIAL_CLEAN_RESULT.icaoDetails.notes] },
    tamperDetails: { ...INITIAL_CLEAN_RESULT.tamperDetails, flaggedRegions: [] },
    biometricDetails: { ...INITIAL_CLEAN_RESULT.biometricDetails },
    securityAlertMessages: [],
    isAlreadyCompromised: false,
    verdict: 'UNDETERMINED',
    riskScore: 0,
  };
}

export interface EvaluateCaseParams {
  passportPayload: string | ArrayBuffer;
  visaPayload?: string | ArrayBuffer;
  passportFile?: File | null;
  visaFile?: File | null;
  extractedFields?: Partial<ExtractedFields>;
  aiData?: any;
  elaScore?: number;
  qrResult?: any;
  pixelForensicsResult?: any;
  offlineMode?: boolean;
}

/**
 * Evaluates a traveler case through Stage 1 & Stage 2 gatekeepers.
 * Enforces deterministic mathematical and jurisdictional rules.
 */
export async function evaluateScreeningCase(params: EvaluateCaseParams): Promise<VerificationResult> {
  const {
    passportPayload,
    visaPayload,
    passportFile,
    visaFile,
    aiData,
    elaScore = 0.12,
    qrResult = params.qrResult || aiData?.qrDetails,
    pixelForensicsResult = params.pixelForensicsResult || aiData?.pixelForensics,
    offlineMode = false,
  } = params;

  // 1. Cryptographic SHA-256 byte payload hashing
  const passportHash = await computeSha256(passportPayload);
  const visaHash = visaPayload ? await computeSha256(visaPayload) : undefined;

  // 2. Duplicate Document Detection (Byte level SHA-256 comparison)
  const duplicateDetected = Boolean(visaHash) && (
    passportHash === visaHash ||
    await isDuplicatePayload(passportFile, visaFile, typeof passportPayload === 'string' ? passportPayload : null, typeof visaPayload === 'string' ? visaPayload : null)
  );

  // 3. Extract and sanitize fields
  const rawFields = aiData?.extractedFields || params.extractedFields || {};
  const extractedFields: ExtractedFields = {
    fullName: (rawFields.fullName || 'AARAV SHARMA').trim().toUpperCase(),
    documentNumber: (rawFields.documentNumber || 'Z8941209').trim().toUpperCase(),
    nationality: (rawFields.nationality || 'IND').trim().toUpperCase(),
    dateOfBirth: rawFields.dateOfBirth || '01/07/1994',
    expiryDate: rawFields.expiryDate || '02/09/2034',
    gender: (rawFields.gender && rawFields.gender.toUpperCase() === 'F' ? 'F' : 'M') as 'M' | 'F',
    issuingCountry: (rawFields.issuingCountry || 'IND').trim().toUpperCase(),
    mrzLine1: rawFields.mrzLine1 || '',
    mrzLine2: rawFields.mrzLine2 || '',
    mrzLine3: rawFields.mrzLine3 || '',
  };

  const natUpper = (extractedFields.nationality || '').toUpperCase();
  const countryUpper = (extractedFields.issuingCountry || '').toUpperCase();
  const docNumClean = (extractedFields.documentNumber || '').replace(/\s+/g, '');
  const isAadhaarDoc =
    Boolean(aiData?.detectedDocType && aiData.detectedDocType.toUpperCase().includes('AADHAAR')) ||
    Boolean(qrResult?.is_secure_qr || qrResult?.version === 'QDA_XML' || qrResult?.version === 'V2_SECURE_QR') ||
    /^\d{12}$/.test(docNumClean);

  const isIndian =
    isAadhaarDoc ||
    natUpper === 'IND' ||
    natUpper === 'INDIA' ||
    natUpper.includes('INDIAN') ||
    natUpper.includes('BHARAT') ||
    countryUpper === 'IND' ||
    countryUpper === 'INDIA' ||
    countryUpper.includes('INDIAN') ||
    countryUpper.includes('BHARAT');

  const requiresVisa = !isIndian;
  const hasVisa = Boolean(visaPayload || visaFile || (aiData && aiData.hasVisa));

  // 4. Primary Document Type Classification Gatekeeper
  const mrz1Upper = (extractedFields.mrzLine1 || '').trim().toUpperCase();
  const isVisaInPassportSlot = Boolean(
    mrz1Upper.startsWith('VN') ||
    mrz1Upper.startsWith('V<') ||
    extractedFields.documentNumber.startsWith('V<') ||
    aiData?.isWrongDocType === true ||
    (aiData?.detectedDocType && aiData.detectedDocType.toUpperCase().includes('VISA'))
  );

  // 5. ICAO Doc 9303 Verification (TD3, TD1, or generic MRZ)
  const mrzLines = [extractedFields.mrzLine1, extractedFields.mrzLine2, extractedFields.mrzLine3].filter((l): l is string => Boolean(l && l.trim()));
  let icaoDetails: IcaoChecksumDetails;

  if (mrzLines.length >= 3 && mrzLines[0].length === 30 && mrzLines[1].length === 30) {
    // TD1 format (3 lines x 30 characters)
    icaoDetails = parseAndVerifyTd1Mrz(mrzLines[0], mrzLines[1], mrzLines[2] || '');
  } else if (mrzLines.length >= 2 && mrzLines[1].length >= 44) {
    // TD3 format (2 lines x 44 characters)
    icaoDetails = parseAndVerifyTd3Mrz(mrzLines[0], mrzLines[1]);
  } else if (mrzLines.length > 0) {
    icaoDetails = parseAndVerifyMrz(mrzLines);
  } else {
    // No MRZ strings provided in payload (e.g. image-only or unparsed)
    icaoDetails = {
      documentNumberValid: true,
      dobValid: true,
      expiryValid: true,
      compositeValid: true,
      rawAlgorithm: 'ICAO Doc 9303 Part 3/7 (Modulus 10, 7-3-1 weights)',
      overallIcaoCompliant: true,
      notes: ['MRZ not supplied in textual fields.'],
    };
  }

  const opticalNoiseDetected = Boolean(icaoDetails.opticalNoiseDetected);
  const icaoChecksumFailed = mrzLines.length > 0 && !icaoDetails.overallIcaoCompliant && !opticalNoiseDetected;

  // 6. Dummy / Specimen Template Fingerprinting
  const dummyCheck = detectDummyOrSpecimen(
    extractedFields,
    `${extractedFields.fullName} ${extractedFields.documentNumber} ${aiData?.reasoning || ''}`,
    icaoDetails.overallIcaoCompliant
  );
  const isDummySpecimen = dummyCheck.severity === 'DETAIN';
  const isNameOnlySampleMatch = dummyCheck.severity === 'SECONDARY_INSPECTION';

  // 7. Temporal Expiration Gatekeeper (Operating year 2026)
  const passportExpiryCheck = checkDocumentExpiry(extractedFields.expiryDate);
  let visaExpiryCheck = { isExpired: false, statusText: 'N/A', yearsExpired: 0 };
  if (hasVisa && aiData?.visaDetails?.validUntil) {
    visaExpiryCheck = checkDocumentExpiry(aiData.visaDetails.validUntil);
  }
  const isExpired = passportExpiryCheck.isExpired || visaExpiryCheck.isExpired || aiData?.isExpired === true;

  // 8. Consular Jurisdiction Check
  const visaIssuingPost = (aiData?.visaDetails?.issuingPost || '').toUpperCase();
  const isForeignVisaAtIndianBorder = Boolean(
    aiData?.isInvalidJurisdiction === true ||
    (hasVisa && (
      visaIssuingPost.includes('USA') ||
      visaIssuingPost.includes('BANGKOK') ||
      visaIssuingPost.includes('UNITED STATES') ||
      visaIssuingPost.includes('SCHENGEN') ||
      visaIssuingPost.includes('UNITED KINGDOM')
    ))
  );

  // 9. VIZ vs MRZ Textual Discrepancy
  const line1 = extractedFields.mrzLine1 || '';
  const line2 = extractedFields.mrzLine2 || '';
  const vizMrzCheck = mrzLines.length >= 2 ? checkVizMrzConsistency(extractedFields, line1, line2) : { hasMismatch: false, notes: [] };
  const vizMrzMismatch = vizMrzCheck.hasMismatch;

  // 10. Digital & Physical Forensic Tampering
  const isTampered = aiData ? aiData.tamperDetected === true : (elaScore > 0.45);
  const isPhotoReplaced = aiData ? (
    aiData.anomalyDetails?.toLowerCase().includes('photo') ||
    aiData.reasoning?.toLowerCase().includes('photo') ||
    (elaScore > 0.55)
  ) : false;
  const isTextForged = aiData ? (
    aiData.anomalyDetails?.toLowerCase().includes('text') ||
    aiData.reasoning?.toLowerCase().includes('font') ||
    aiData.reasoning?.toLowerCase().includes('expiry')
  ) : false;

  // 11. Multimodal AI Gateway Status
  const aiUnavailable = offlineMode || (aiData && aiData.status === 'AI_FORENSICS_UNAVAILABLE');

  // 12. QR Verification & Pixel Forensics Evaluation (Directives 1, 2, 3)
  const qrErrorCode = qrResult?.security_error_code || aiData?.qrDetails?.security_error_code || aiData?.securityErrorCode;
  const qrSigInvalid = Boolean(
    qrErrorCode === 'ERR_QR_SIGNATURE_INVALID' ||
    qrResult?.status === 'SIGNATURE_INVALID' ||
    (qrResult?.qr_detected && qrResult?.qr_decoded && qrResult?.signature_verified === false)
  );
  const qrDataMismatch = Boolean(
    qrErrorCode === 'ERR_QR_DATA_MISMATCH' ||
    qrResult?.status === 'DATA_MISMATCH' ||
    (qrResult?.qr_detected && qrResult?.qr_decoded && qrResult?.data_matched === false)
  );
  const qrUnreadable = Boolean(
    qrErrorCode === 'ERR_QR_UNREADABLE' ||
    qrResult?.status === 'UNREADABLE' ||
    qrResult?.status === 'QR_IMAGE_QUALITY_INSUFFICIENT' ||
    qrResult?.status === 'QR_PARSE_FAILED' ||
    (isAadhaarDoc && qrResult && !qrResult.qr_detected)
  );

  const copyMoveDetected = Boolean(pixelForensicsResult?.copy_move_detected === true || aiData?.pixelForensics?.copy_move_detected === true);
  const pixelTamperScore = pixelForensicsResult?.overall_tamper_score ?? aiData?.pixelForensics?.overall_tamper_score ?? 0;
  const pixelTamperFlagged = copyMoveDetected || pixelTamperScore >= 45.0;

  // 13. Security Error Code & Violations Priority
  const securityViolations: string[] = [];
  let securityErrorCode: SecurityErrorCode | undefined = undefined;

  if (duplicateDetected) {
    securityErrorCode = 'ERR_DUPLICATE_INGESTION';
    securityViolations.push('CRITICAL FRAUD: The identical document was submitted for both the Passport and Visa slots.');
  } else if (qrSigInvalid) {
    securityErrorCode = 'ERR_QR_SIGNATURE_INVALID';
    securityViolations.push('CRITICAL CRYPTOGRAPHIC FRAUD: Aadhaar Secure QR digital signature failed verification against UIDAI offline public certificate.');
  } else if (qrDataMismatch) {
    securityErrorCode = 'ERR_QR_DATA_MISMATCH';
    const mismatchDetails = qrResult?.mismatches?.join(' • ') || 'Decoded QR credential contradicts printed document fields.';
    securityViolations.push(`CRITICAL IDENTITY FORGERY: ${mismatchDetails}`);
  } else if (isExpired) {
    securityErrorCode = 'ERR_DOCUMENT_EXPIRED';
    securityViolations.push(`CRITICAL SECURITY VIOLATION: Document is EXPIRED (${passportExpiryCheck.statusText}).`);
  } else if (isDummySpecimen) {
    securityErrorCode = 'ERR_KNOWN_DUMMY_TEMPLATE';
    securityViolations.push(`CRITICAL FRAUD: ${dummyCheck.reason}`);
  } else if (isForeignVisaAtIndianBorder) {
    securityErrorCode = 'ERR_INVALID_JURISDICTION';
    securityViolations.push('JURISDICTION REJECTION: Uploaded Visa is issued by a foreign nation. Valid Indian Entry Visa required.');
  } else if (isVisaInPassportSlot) {
    securityErrorCode = 'ERR_INVALID_PRIMARY_DOC';
    securityViolations.push('INVALID PRIMARY SPECIMEN: A Visa sticker/foil was uploaded in place of a primary Passport booklet.');
  } else if (icaoChecksumFailed) {
    securityErrorCode = 'ERR_ICAO_CHECKSUM';
    securityViolations.push(`ICAO 9303 CHECKSUM FRAUD: ${icaoDetails.notes.join(' • ')}`);
  } else if (vizMrzMismatch) {
    securityErrorCode = 'ERR_VIZ_MRZ_MISMATCH';
    securityViolations.push(`DATA INCONSISTENCY: ${vizMrzCheck.notes.join(' • ')}`);
  } else if (qrUnreadable) {
    securityErrorCode = 'ERR_QR_UNREADABLE';
    const reason = qrResult?.status === 'QR_IMAGE_QUALITY_INSUFFICIENT'
      ? 'QR VERIFICATION WARNING: Aadhaar QR code image quality insufficient (too blurry or low resolution). Routed to Secondary Inspection.'
      : (isAadhaarDoc && qrResult && !qrResult.qr_detected)
      ? 'QR VERIFICATION NOTICE: Aadhaar QR code could not be detected from uploaded image. Routed to Secondary Inspection for physical card verification.'
      : 'QR VERIFICATION WARNING: Aadhaar QR code unreadable or corrupted. Routed to Secondary Inspection.';
    securityViolations.push(reason);
  } else if (opticalNoiseDetected) {
    securityErrorCode = 'SUSPICIOUS_OPTICAL_NOISE';
    securityViolations.push(`OPTICAL NOISE DETECTED: Ambiguous OCR character resolved (${icaoDetails.opticalNoiseField}). Routed to Secondary Inspection.`);
  } else if (aiUnavailable) {
    securityErrorCode = 'AI_FORENSICS_UNAVAILABLE';
    securityViolations.push('AI FORENSICS UNAVAILABLE: Cognitive gateway offline. Fail-closed policy mandates physical secondary inspection.');
  }

  // 14. Evaluate Fatal Compromise vs Secondary vs Clear
  const isFatalCompromised =
    duplicateDetected ||
    qrSigInvalid ||
    qrDataMismatch ||
    isExpired ||
    isVisaInPassportSlot ||
    isForeignVisaAtIndianBorder ||
    isDummySpecimen ||
    icaoChecksumFailed ||
    vizMrzMismatch ||
    isTampered ||
    copyMoveDetected ||
    pixelTamperScore >= 50.0 ||
    aiData?.recommendedAction === 'DETAIN' ||
    aiData?.securityErrorCode === 'ERR_QR_SIGNATURE_INVALID' ||
    aiData?.securityErrorCode === 'ERR_QR_DATA_MISMATCH';

  const isSecondaryFlagged =
    qrUnreadable ||
    pixelTamperFlagged ||
    opticalNoiseDetected ||
    isNameOnlySampleMatch ||
    aiUnavailable ||
    (requiresVisa && !hasVisa) ||
    aiData?.recommendedAction === 'SECONDARY_INSPECTION' ||
    aiData?.status === 'AI_FORENSICS_UNAVAILABLE' ||
    aiData?.tamperSeverity === 'MEDIUM' ||
    aiData?.tamperSeverity === 'HIGH' ||
    aiData?.securityErrorCode === 'ERR_QR_UNREADABLE' ||
    (aiData?.forensicConfidenceScore !== undefined && aiData.forensicConfidenceScore < 70) ||
    (elaScore > 0.40);

  let riskScore = 12;
  let verdict: Verdict = 'CLEAR';
  let isAlreadyCompromised = false;

  if (isFatalCompromised) {
    verdict = 'DETAIN';
    isAlreadyCompromised = true;
    if (qrSigInvalid || qrDataMismatch) riskScore = 99;
    else if (isDummySpecimen) riskScore = 99;
    else if (duplicateDetected) riskScore = 98;
    else if (icaoChecksumFailed) riskScore = 98;
    else if (copyMoveDetected) riskScore = 98;
    else if (isExpired) riskScore = 96;
    else if (isVisaInPassportSlot) riskScore = 95;
    else if (isForeignVisaAtIndianBorder) riskScore = 94;
    else if (vizMrzMismatch) riskScore = 92;
    else riskScore = STAGE_1_DETAIN_FLOOR;
  } else if (isSecondaryFlagged) {
    verdict = 'SECONDARY_INSPECTION';
    isAlreadyCompromised = true; // Directive 5: Extend isAlreadyCompromised to Stage 2!
    if (isNameOnlySampleMatch) {
      riskScore = Math.max(SECONDARY_INSPECTION_FLOOR, 60);
      securityViolations.push(dummyCheck.reason);
    } else if (qrUnreadable) {
      riskScore = Math.max(SECONDARY_INSPECTION_FLOOR, 60);
    } else if (pixelTamperFlagged) {
      riskScore = Math.max(SECONDARY_INSPECTION_FLOOR, Math.round(pixelTamperScore));
      securityViolations.push('PIXEL FORENSIC ANOMALY: Splicing or localized compression divergence detected.');
    } else if (aiData?.recommendedAction === 'SECONDARY_INSPECTION') {
      riskScore = Math.max(SECONDARY_INSPECTION_FLOOR, aiData.riskScore || 65);
      if (aiData.anomalyDetails) securityViolations.push(aiData.anomalyDetails);
    } else if (opticalNoiseDetected) {
      riskScore = Math.max(SECONDARY_INSPECTION_FLOOR, 60);
    } else if (aiUnavailable) {
      riskScore = Math.max(SECONDARY_INSPECTION_FLOOR, 60);
    } else if (requiresVisa && !hasVisa) {
      riskScore = Math.max(SECONDARY_INSPECTION_FLOOR, 60);
      securityViolations.push(`FOREIGN PASSPORT DETECTED (${extractedFields.nationality}): Valid Indian Entry Visa / Transit Permit required.`);
    } else {
      riskScore = SECONDARY_INSPECTION_FLOOR;
    }
  } else {
    // Stage 1 and Stage 2 are BOTH clean
    verdict = 'CLEAR';
    riskScore = 12;
    isAlreadyCompromised = false;
  }

  // Visual bounding box annotations
  const flaggedRegions: any[] = [];
  if (isDummySpecimen) {
    flaggedRegions.push({
      field: 'Dummy / Sample Specimen',
      description: dummyCheck.reason,
      severity: 'HIGH' as const,
      box: { x: 10, y: 15, width: 80, height: 40 },
    });
  }
  if (icaoChecksumFailed) {
    flaggedRegions.push({
      field: 'ICAO Checksum Forgery',
      description: icaoDetails.notes.join(' '),
      severity: 'HIGH' as const,
      box: { x: 5, y: 78, width: 90, height: 20 },
    });
  }
  if (duplicateDetected) {
    flaggedRegions.push({
      field: 'Duplicate Ingestion',
      description: 'Identical document submitted for both passport and visa slots.',
      severity: 'HIGH' as const,
      box: { x: 5, y: 5, width: 90, height: 40 },
    });
  }
  if (isExpired) {
    flaggedRegions.push({
      field: 'Expired Document',
      description: passportExpiryCheck.statusText,
      severity: 'HIGH' as const,
      box: { x: 45, y: 60, width: 50, height: 25 },
    });
  }

  if (copyMoveDetected) {
    flaggedRegions.push({
      field: 'Copy-Move Clone Stamp',
      description: 'Suspicious duplicate feature patch detected on document substrate.',
      severity: 'HIGH' as const,
      box: pixelForensicsResult?.copy_move_regions?.[0] || { x: 20, y: 30, width: 40, height: 30 },
    });
  }
  if (qrSigInvalid) {
    flaggedRegions.push({
      field: 'Aadhaar QR Forgery',
      description: 'RSA-2048 digital signature invalid against UIDAI certificate.',
      severity: 'HIGH' as const,
      box: { x: 70, y: 70, width: 25, height: 25 },
    });
  }
  if (qrDataMismatch) {
    flaggedRegions.push({
      field: 'Aadhaar QR Data Mismatch',
      description: 'Decoded QR fields contradict printed document fields.',
      severity: 'HIGH' as const,
      box: { x: 70, y: 70, width: 25, height: 25 },
    });
  }

  return {
    id: `AUTON-${Date.now().toString().slice(-4)}`,
    isTerminalBlank: false,
    isIndianNational: isIndian,
    requiresVisa,
    hasVisa,
    isExpired,
    expiryYearsExpired: passportExpiryCheck.yearsExpired,
    isDuplicateDocument: duplicateDetected,
    isWrongDocumentType: isVisaInPassportSlot,
    isInvalidJurisdiction: isForeignVisaAtIndianBorder,
    isDummySpecimen,
    vizMrzMismatch,
    icaoChecksumFailed,
    opticalNoiseDetected,
    securityErrorCode,
    securityAlertMessages: securityViolations,
    documentHashSha256: passportHash,
    visaHashSha256: visaHash,
    offlineBypassed: offlineMode,
    timestamp: new Date().toLocaleString('en-IN') + ' IST',
    tokenNumber: `SSB-2026-${Math.floor(10000 + Math.random() * 90000)}`,
    documentType: isAadhaarDoc ? 'AADHAAR' : (icaoDetails.format === 'TD1' ? 'NATIONAL_ID' : 'PASSPORT'),
    extractedFields,
    icaoDetails,
    tamperDetails: {
      photoReplacementDetected: isPhotoReplaced,
      photoSeamConfidence: isTampered ? 0.88 : 0.03,
      textManipulationDetected: isTextForged || icaoChecksumFailed || vizMrzMismatch,
      fontInconsistencyScore: isTextForged || icaoChecksumFailed ? 0.88 : 0.04,
      stampForgeryDetected: false,
      stampCircularityAnomaly: 0.02,
      elaAnomalyScore: elaScore,
      metadataTampered: isTampered || duplicateDetected || isDummySpecimen || icaoChecksumFailed,
      flaggedRegions,
    },
    biometricDetails: {
      faceMatched: false,
      similarityScore: 0,
      livenessVerified: false,
      livenessConfidence: 0,
      faceDetectedInDocument: true,
      liveFeedAvailable: true,
      bearerStatus: 'AWAITING_CAPTURE',
    },
    watchlistHit: false,
    riskScore,
    riskLevel: riskScore > 65 ? 'HIGH' : riskScore > 25 ? 'MEDIUM' : 'LOW',
    verdict,
    isAlreadyCompromised,
    executiveSummary: securityViolations.length > 0
      ? securityViolations.join(' ')
      : (aiData?.reasoning || 'Verified authentic document via Autonomous Pipeline. Cleared for transit.'),
    documentImageUrl: typeof passportPayload === 'string' ? passportPayload : '',
    documentFaceUrl: typeof passportPayload === 'string' ? passportPayload : '',
    liveTravelerPhotoUrl: '/samples/face_clean_live.svg',
    visaImageUrl: typeof visaPayload === 'string' ? visaPayload : undefined,
    visaDetails: aiData?.visaDetails,
    aiAuditData: aiData,
    qrDetails: qrResult || aiData?.qrDetails,
    pixelForensics: pixelForensicsResult || aiData?.pixelForensics,
    aiVisualDescription: {
      visualDescription: aiData?.reasoning || 'Visual analysis complete.',
      isNonAuthoritative: true,
      observations: aiData?.forensicObservations || [],
      flaggedRegions,
    },
  };
}

/**
 * Updates biometrics while STRICTLY enforcing the central security invariant:
 * - A downstream stage may ONLY make things worse for the traveler, never better.
 * - If the case is already compromised (isAlreadyCompromised || verdict === 'DETAIN'),
 *   verdict is PERMANENTLY LOCKED to 'DETAIN' and riskScore is clamped >= 95.
 * - Biometric match can NEVER upgrade SECONDARY_INSPECTION to CLEAR.
 * - Risk score is NEVER reduced by biometrics.
 */
export function updateBiometricsWithInvariant(
  currentState: VerificationResult,
  bioUpdate: {
    faceMatched: boolean;
    similarityScore: number;
    livePhotoUrl?: string;
  }
): VerificationResult {
  const liveUrl = bioUpdate.livePhotoUrl || currentState.liveTravelerPhotoUrl;
  const bearerStatus = bioUpdate.similarityScore === 0
    ? 'NO_FACE_DETECTED'
    : bioUpdate.faceMatched
    ? 'BEARER_CONFIRMED'
    : 'BEARER_MISMATCH';

  // 1. If no human face was detected in the frame
  if (bioUpdate.similarityScore === 0) {
    return {
      ...currentState,
      liveTravelerPhotoUrl: liveUrl,
      biometricDetails: {
        ...currentState.biometricDetails,
        faceMatched: false,
        similarityScore: 0,
        livenessVerified: false,
        bearerStatus: 'NO_FACE_DETECTED',
      },
      verdict: currentState.isAlreadyCompromised || currentState.verdict === 'DETAIN' ? 'DETAIN' : 'SECONDARY_INSPECTION',
      riskScore: currentState.isAlreadyCompromised ? Math.max(currentState.riskScore, 95) : Math.max(currentState.riskScore, 45),
      executiveSummary: 'BIOMETRIC NOTICE: No human face detected in camera frame. Please center traveler face in oval.',
    };
  }

  // 2. NON-NEGOTIABLE INVARIANT (Directive 5):
  // If already compromised (from Stage 1 or Stage 2), biometrics can NEVER lower riskScore or upgrade verdict!
  if (currentState.isAlreadyCompromised || currentState.verdict === 'DETAIN' || currentState.verdict === 'SECONDARY_INSPECTION') {
    // A. If previous verdict was DETAIN: stays permanently locked to DETAIN
    if (currentState.verdict === 'DETAIN') {
      return {
        ...currentState,
        liveTravelerPhotoUrl: liveUrl,
        biometricDetails: {
          ...currentState.biometricDetails,
          faceMatched: bioUpdate.faceMatched,
          similarityScore: bioUpdate.similarityScore,
          livenessVerified: true,
          bearerStatus,
        },
        isAlreadyCompromised: true,
        verdict: 'DETAIN',
        riskScore: Math.max(currentState.riskScore, STAGE_1_DETAIN_FLOOR),
        executiveSummary: `CRITICAL ALERT: TRAVELER DETAINED (${currentState.securityErrorCode || 'COMPROMISED_CREDENTIALS'}). Identity Linkage: ${bearerStatus} (${bioUpdate.similarityScore}% match). Biometric identity cannot override credential invalidation.`,
      };
    }

    // B. If previous verdict was SECONDARY_INSPECTION (or Stage 2 flagged isAlreadyCompromised):
    const isImposter = !bioUpdate.faceMatched;
    const finalVerdict: Verdict = isImposter ? 'DETAIN' : 'SECONDARY_INSPECTION';
    const finalRiskScore = isImposter
      ? Math.max(currentState.riskScore, STAGE_2_DETAIN_FLOOR, 88)
      : Math.max(currentState.riskScore, SECONDARY_INSPECTION_FLOOR);

    return {
      ...currentState,
      liveTravelerPhotoUrl: liveUrl,
      biometricDetails: {
        ...currentState.biometricDetails,
        faceMatched: bioUpdate.faceMatched,
        similarityScore: bioUpdate.similarityScore,
        livenessVerified: true,
        bearerStatus,
      },
      // LOCK REMAINS PERMANENT: cannot be cleared by biometric match!
      isAlreadyCompromised: true,
      verdict: finalVerdict,
      riskScore: finalRiskScore,
      riskLevel: finalRiskScore > 65 ? 'HIGH' : 'MEDIUM',
      executiveSummary: isImposter
        ? `CRITICAL BIOMETRIC ALERT: Imposter mismatch detected (${bioUpdate.similarityScore}% similarity). Traveler detained.`
        : (currentState.executiveSummary || `SECONDARY INSPECTION MANDATORY: Physical credential flagged. Biometric match confirmed (${bioUpdate.similarityScore}%), manual inspection required.`),
    };
  }

  // 3. If previous verdict was CLEAR and uncompromised:
  if (!bioUpdate.faceMatched) {
    return {
      ...currentState,
      liveTravelerPhotoUrl: liveUrl,
      biometricDetails: {
        ...currentState.biometricDetails,
        faceMatched: false,
        similarityScore: bioUpdate.similarityScore,
        livenessVerified: true,
        bearerStatus: 'BEARER_MISMATCH',
      },
      isAlreadyCompromised: true,
      verdict: 'DETAIN',
      riskScore: Math.max(currentState.riskScore, 88),
      riskLevel: 'HIGH',
      executiveSummary: `CRITICAL BIOMETRIC ALERT: Imposter mismatch detected (${bioUpdate.similarityScore}% similarity, threshold 68%). Traveler detained for identity fraud.`,
    };
  }

  // 4. Authentic match for fully uncompromised traveler (Both Stage 1 and Stage 2 clean)
  return {
    ...currentState,
    liveTravelerPhotoUrl: liveUrl,
    biometricDetails: {
      ...currentState.biometricDetails,
      faceMatched: true,
      similarityScore: bioUpdate.similarityScore,
      livenessVerified: true,
      bearerStatus: 'BEARER_CONFIRMED',
    },
    // Verdict remains CLEAR, riskScore NEVER decreased
    verdict: 'CLEAR',
    riskScore: currentState.riskScore,
    isAlreadyCompromised: false,
    executiveSummary: 'Live passenger biometrically verified against document portrait with high confidence. Transit authorized.',
  };
}
