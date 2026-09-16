export type DocumentType = 'PASSPORT' | 'VISA' | 'NATIONAL_ID' | 'BORDER_PERMIT';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ExtractedFields {
  fullName: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
  expiryDate: string;
  gender: 'M' | 'F' | 'X';
  issuingCountry: string;
  mrzString?: string;
  mrzLine1?: string;
  mrzLine2?: string;
  mrzLine3?: string;
  visaType?: string;
  stayDurationDays?: number;
  entryValidity?: string;
}

export type Verdict = 'CLEAR' | 'SECONDARY_INSPECTION' | 'DETAIN' | 'UNDETERMINED';

export type SecurityErrorCode =
  | 'ERR_DUPLICATE_INGESTION'
  | 'ERR_DOCUMENT_EXPIRED'
  | 'ERR_INVALID_PRIMARY_DOC'
  | 'ERR_INVALID_JURISDICTION'
  | 'ERR_KNOWN_DUMMY_TEMPLATE'
  | 'ERR_ICAO_CHECKSUM'
  | 'ERR_VIZ_MRZ_MISMATCH'
  | 'SUSPICIOUS_OPTICAL_NOISE'
  | 'AI_FORENSICS_UNAVAILABLE'
  | 'ERR_QR_SIGNATURE_INVALID'
  | 'ERR_QR_DATA_MISMATCH'
  | 'ERR_QR_UNREADABLE';

export interface QrVerificationDetails {
  qrDetected: boolean;
  qrDecoded: boolean;
  signatureVerified: boolean;
  dataMatched: boolean;
  status: 'VERIFIED' | 'DATA_MISMATCH' | 'SIGNATURE_INVALID' | 'UNREADABLE' | 'NOT_PRESENT';
  algorithm?: string;
  decodedFields?: {
    name?: string;
    dob?: string;
    gender?: string;
    referenceId?: string;
    address?: string;
  };
  mismatchDetails?: string[];
  notes?: string[];
}

export interface PixelForensicDetails {
  copyMoveDetected: boolean;
  copyMoveConfidence: number;
  copyMoveRegions?: Array<{ x: number; y: number; width: number; height: number }>;
  dctAnomalyScore: number;
  benfordViolation: boolean;
  multiLevelElaScore: number;
  truforScore?: number;
  overallTamperScore: number; // 0 to 100
  forensicVerdict: 'CLEAN' | 'SUSPICIOUS' | 'TAMPERED';
  details: string[];
}

export interface IcaoChecksumDetails {
  documentNumberValid: boolean;
  dobValid: boolean;
  expiryValid: boolean;
  compositeValid: boolean;
  rawAlgorithm: string;
  overallIcaoCompliant: boolean;
  format?: 'TD1' | 'TD2' | 'TD3' | 'MRV_A' | 'MRV_B';
  opticalNoiseDetected?: boolean;
  opticalNoiseField?: string;
  opticalNoiseCandidate?: string;
  notes: string[];
}

export interface TamperDetectionResult {
  photoReplacementDetected: boolean;
  photoSeamConfidence: number; // 0.00 to 1.00
  textManipulationDetected: boolean;
  fontInconsistencyScore: number; // 0.00 to 1.00
  stampForgeryDetected: boolean;
  stampCircularityAnomaly: number; // 0.00 to 1.00
  elaAnomalyScore: number; // 0.00 to 1.00
  metadataTampered: boolean;
  detectedEditingSoftware?: string;
  flaggedRegions: Array<{
    field: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    box: { x: number; y: number; width: number; height: number };
  }>;
}

export interface BiometricMatchResult {
  faceMatched: boolean;
  similarityScore: number; // 0 to 100
  livenessVerified: boolean;
  livenessConfidence: number; // 0 to 100
  faceDetectedInDocument: boolean;
  liveFeedAvailable: boolean;
  bearerStatus?: 'BEARER_CONFIRMED' | 'BEARER_MISMATCH' | 'AWAITING_CAPTURE' | 'NO_FACE_DETECTED';
}

export interface VisaVerificationDetails {
  visaNumber?: string;
  passportNumberLinked?: string;
  visaType?: string;
  stayDurationDays?: number;
  entryValidity?: string;
  validFrom?: string;
  validUntil?: string;
  issuingPost?: string;
  passportMatched?: boolean;
  nameMatched?: boolean;
  nationalityMatched?: boolean;
  validityAligned?: boolean;
  overallCrossCheckPassed?: boolean;
  crossCheckNotes?: string[];
}

export interface VerificationResult {
  id: string;
  timestamp: string;
  tokenNumber: string;
  documentType: DocumentType;
  extractedFields: ExtractedFields;
  icaoDetails: IcaoChecksumDetails;
  tamperDetails: TamperDetectionResult;
  biometricDetails: BiometricMatchResult;
  watchlistHit: boolean;
  watchlistDetails?: string;
  riskScore: number; // 0 to 100
  riskLevel: RiskLevel;
  verdict: Verdict;
  isAlreadyCompromised?: boolean;
  executiveSummary: string;
  documentImageUrl: string;
  documentFaceUrl: string;
  liveTravelerPhotoUrl: string;
  isTerminalBlank?: boolean;
  isIndianNational?: boolean;
  requiresVisa?: boolean;
  hasVisa?: boolean;
  visaImageUrl?: string;
  visaDetails?: VisaVerificationDetails;
  aiAuditData?: any;
  isExpired?: boolean;
  expiryYearsExpired?: number;
  isDuplicateDocument?: boolean;
  isWrongDocumentType?: boolean;
  isInvalidJurisdiction?: boolean;
  isDummySpecimen?: boolean;
  vizMrzMismatch?: boolean;
  icaoChecksumFailed?: boolean;
  opticalNoiseDetected?: boolean;
  opticalNoiseDetails?: string;
  securityErrorCode?: SecurityErrorCode;
  securityAlertMessages?: string[];
  offlineBypassed?: boolean;
  documentHashSha256?: string;
  visaHashSha256?: string;
  qrDetails?: QrVerificationDetails;
  pixelForensics?: PixelForensicDetails;
  aiVisualDescription?: {
    visualDescription: string;
    isNonAuthoritative: true;
    observations: string[];
    flaggedRegions?: any[];
  };
}

export interface ScenarioPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  data: VerificationResult;
}
