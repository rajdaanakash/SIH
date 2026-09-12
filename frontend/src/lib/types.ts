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
  visaType?: string;
  stayDurationDays?: number;
  entryValidity?: string;
}

export interface IcaoChecksumDetails {
  documentNumberValid: boolean;
  dobValid: boolean;
  expiryValid: boolean;
  compositeValid: boolean;
  rawAlgorithm: string;
  overallIcaoCompliant: boolean;
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
  verdict: 'CLEAR' | 'SECONDARY_INSPECTION' | 'DETAIN';
  executiveSummary: string;
  documentImageUrl: string;
  documentFaceUrl: string;
  liveTravelerPhotoUrl: string;
}

export interface ScenarioPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  data: VerificationResult;
}
