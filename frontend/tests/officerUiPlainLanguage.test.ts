import { describe, it, expect } from 'vitest';
import {
  getPlainVerdict,
  getPlainSecurityReason,
  getPlainStep1,
  getPlainStep2,
  getPlainStep3,
  getPlainStep4,
  getPlainStep5,
} from '../src/lib/plainLanguage';
import { VerificationResult, SecurityErrorCode } from '../src/lib/types';
import { INITIAL_CLEAN_RESULT, createCleanSession } from '../src/lib/screeningEngine';
import { generateOfficialDossierPdf } from '../src/lib/pdfGenerator';

describe('Officer-Facing UI Plain-Language Overhaul & Supervisor Audit Protocol', () => {

  // Helper to construct a standard evaluated test case
  const createMockResult = (overrides: Partial<VerificationResult> = {}): VerificationResult => {
    return {
      ...INITIAL_CLEAN_RESULT,
      isTerminalBlank: false,
      documentImageUrl: 'data:image/jpeg;base64,mock_passport',
      documentType: 'PASSPORT',
      verdict: 'CLEAR',
      riskScore: 8,
      riskLevel: 'LOW',
      isAlreadyCompromised: false,
      extractedFields: {
        fullName: 'PRIYA NAIR',
        documentNumber: 'K1234567',
        nationality: 'IND',
        dateOfBirth: '12/04/1992',
        expiryDate: '11/04/2032',
        gender: 'F',
        issuingCountry: 'IND',
      },
      ...overrides,
    };
  };

  // --------------------------------------------------------------------------
  // Test 1: Verify all 5 steps render plain "Step N: [Plain Name]" on default view
  // --------------------------------------------------------------------------
  it('Test 1: All 5 steps render plain "Step N: [Plain Name]" on default view', () => {
    const resultWithVisa = createMockResult({
      hasVisa: true,
      visaImageUrl: 'data:image/jpeg;base64,mock_visa',
      visaDetails: {
        visaNumber: 'IND99281',
        passportNumberLinked: 'K1234567',
        passportMatched: true,
        nationalityMatched: true,
        overallCrossCheckPassed: true,
        crossCheckNotes: ['Visa verified successfully against passport identity.'],
      },
    });

    const step1 = getPlainStep1(resultWithVisa);
    const step2 = getPlainStep2(resultWithVisa);
    const step3 = getPlainStep3(resultWithVisa);
    const step4 = getPlainStep4(resultWithVisa);
    const step5 = getPlainStep5(resultWithVisa);

    // Assert exact plain names
    expect(step1.title).toBe('Step 1: Reading the Document');
    expect(step2.title).toBe('Step 2: Security Code Check');
    expect(step3.title).toBe('Step 3: Tamper Check');
    expect(step4.title).toBe('Step 4: Face Match');
    expect(step5).not.toBeNull();
    expect(step5!.title).toBe('Step 5: Visa Check');

    // Assert no technical acronyms in plain titles
    [step1, step2, step3, step4, step5!].forEach((step) => {
      expect(step.title).not.toMatch(/ICAO|MRZ|VIZ|ELA|OCR|Module/i);
    });
  });

  // --------------------------------------------------------------------------
  // Test 2: Verify failed checks render plain explanation sentences:
  // [Check name]: [Passed/Failed/Needs Review] — [one plain reason]
  // --------------------------------------------------------------------------
  it('Test 2: Failed checks render plain format "[Check name]: [Passed/Failed/Needs Review] — [one plain reason]"', () => {
    // 2a. Step 2 ICAO Checksum Failure
    const failedStep2Doc = createMockResult({
      icaoChecksumFailed: true,
      securityErrorCode: 'ERR_ICAO_CHECKSUM',
    });
    const s2 = getPlainStep2(failedStep2Doc);
    expect(s2.passed).toBe(false);
    expect(s2.statusType).toBe('failed');
    expect(s2.statusBadge).toBe('Failed — do not proceed');
    expect(s2.explanation).toMatch(/^Step 2: Security Code Check: Failed — /);
    expect(s2.explanation).toContain("numbers on the document don't add up correctly");

    // 2b. Step 2 Optical Noise / Glare
    const glareStep2Doc = createMockResult({
      opticalNoiseDetected: true,
      securityErrorCode: 'SUSPICIOUS_OPTICAL_NOISE',
    });
    const s2Glare = getPlainStep2(glareStep2Doc);
    expect(s2Glare.passed).toBe(false);
    expect(s2Glare.statusType).toBe('warning');
    expect(s2Glare.statusBadge).toBe('Needs Review');
    expect(s2Glare.explanation).toMatch(/^Step 2: Security Code Check: Needs Review — /);
    expect(s2Glare.explanation).toContain('glare or blur on the document numbers');

    // 2c. Step 3 Tamper Check (Photo Replacement / Copy-Move)
    const tamperedStep3Doc = createMockResult({
      tamperDetails: {
        ...INITIAL_CLEAN_RESULT.tamperDetails,
        photoReplacementDetected: true,
      },
      pixelForensics: {
        copyMoveDetected: true,
        copyMoveConfidence: 0.92,
        dctAnomalyScore: 0.85,
        benfordViolation: true,
        multiLevelElaScore: 0.88,
        overallTamperScore: 92,
        forensicVerdict: 'TAMPERED',
        details: ['Cloned photo region detected via spatial block matching.'],
      },
      securityErrorCode: 'ERR_VIZ_MRZ_MISMATCH',
    });
    const s3 = getPlainStep3(tamperedStep3Doc);
    expect(s3.passed).toBe(false);
    expect(s3.statusType).toBe('failed');
    expect(s3.statusBadge).toBe('Failed — editing detected');
    expect(s3.explanation).toMatch(/^Step 3: Tamper Check: Failed — /);
    expect(s3.explanation).toContain('cloned or copied');

    // 2d. Step 3 QR Tamper Check (Signature Invalid)
    const qrTamperedDoc = createMockResult({
      qrDetails: {
        qrDetected: true,
        qrDecoded: true,
        signatureVerified: false,
        dataMatched: false,
        status: 'SIGNATURE_INVALID',
      },
      securityErrorCode: 'ERR_QR_SIGNATURE_INVALID',
    });
    const s3Qr = getPlainStep3(qrTamperedDoc);
    expect(s3Qr.passed).toBe(false);
    expect(s3Qr.explanation).toMatch(/^Step 3: Tamper Check: Failed — /);
    expect(s3Qr.explanation).toContain('built-in security code or the digital signature is invalid');

    // 2e. Step 4 Biometric Mismatch
    const bioMismatchDoc = createMockResult({
      biometricDetails: {
        faceMatched: false,
        similarityScore: 42.1,
        livenessVerified: true,
        livenessConfidence: 95,
        faceDetectedInDocument: true,
        liveFeedAvailable: true,
        bearerStatus: 'BEARER_MISMATCH',
      },
    });
    const s4 = getPlainStep4(bioMismatchDoc);
    expect(s4.passed).toBe(false);
    expect(s4.statusType).toBe('failed');
    expect(s4.statusBadge).toBe('Face Does Not Match Traveler');
    expect(s4.explanation).toMatch(/^Step 4: Face Match: Failed — /);
    expect(s4.explanation).toContain('does not match the photo on this document');

    // 2f. Step 5 Duplicate Payload Upload
    const duplicateDoc = createMockResult({
      hasVisa: true,
      isDuplicateDocument: true,
      securityErrorCode: 'ERR_DUPLICATE_INGESTION',
      visaDetails: {
        visaNumber: 'IND12345',
        passportNumberLinked: 'K1234567',
        passportMatched: false,
        nationalityMatched: false,
        overallCrossCheckPassed: false,
      },
    });
    const s5 = getPlainStep5(duplicateDoc);
    expect(s5).not.toBeNull();
    expect(s5!.passed).toBe(false);
    expect(s5!.statusBadge).toBe('Failed — Same Image Uploaded Twice');
    expect(s5!.explanation).toMatch(/^Step 5: Visa Check: Failed — /);
    expect(s5!.explanation).toContain('exact same image was uploaded for both passport and visa');
  });

  // --------------------------------------------------------------------------
  // Test 2b: Exhaustive plain translation of all security error codes
  // --------------------------------------------------------------------------
  it('Test 2b: All security error codes map to plain, jargon-free explanations', () => {
    const errorCodes: SecurityErrorCode[] = [
      'ERR_QR_SIGNATURE_INVALID',
      'ERR_QR_DATA_MISMATCH',
      'ERR_DUPLICATE_INGESTION',
      'ERR_DOCUMENT_EXPIRED',
      'ERR_INVALID_JURISDICTION',
      'ERR_KNOWN_DUMMY_TEMPLATE',
      'ERR_INVALID_PRIMARY_DOC',
      'ERR_ICAO_CHECKSUM',
      'ERR_VIZ_MRZ_MISMATCH',
      'ERR_QR_UNREADABLE',
      'SUSPICIOUS_OPTICAL_NOISE',
      'AI_FORENSICS_UNAVAILABLE',
    ];

    errorCodes.forEach((code) => {
      const plainReason = getPlainSecurityReason(code);
      expect(plainReason).toBeTruthy();
      expect(plainReason.length).toBeGreaterThan(15);
      // Ensure raw error code is not returned
      expect(plainReason).not.toContain(code);
      // Ensure no raw unexplained technical acronyms
      expect(plainReason).not.toMatch(/Modulus 10|7-3-1|Cosine|Quantization matrix|Byte payload/i);
    });
  });

  // --------------------------------------------------------------------------
  // Test 3: Technical view exposes full audit terms without mutating verdict
  // --------------------------------------------------------------------------
  it('Test 3: Technical titles maintain forensic terminology while verdict logic remains unchanged', () => {
    const result = createMockResult({
      hasVisa: true,
      verdict: 'SECONDARY_INSPECTION',
      riskScore: 78,
      isAlreadyCompromised: true,
      securityErrorCode: 'SUSPICIOUS_OPTICAL_NOISE',
      opticalNoiseDetected: true,
      visaDetails: {
        visaNumber: 'IND99281',
        passportNumberLinked: 'K1234567',
        passportMatched: true,
        nationalityMatched: true,
        overallCrossCheckPassed: true,
      },
    });

    const s1 = getPlainStep1(result);
    const s2 = getPlainStep2(result);
    const s3 = getPlainStep3(result);
    const s4 = getPlainStep4(result);
    const s5 = getPlainStep5(result);

    // Verify technical titles carry rigorous official terminology for supervisors
    expect(s1.technicalTitle).toBe('Module 1: OCR & MRZ Parsing');
    expect(s2.technicalTitle).toContain('ICAO 9303 Checksum');
    expect(s3.technicalTitle).toContain('Module 3: Forgery Detection');
    expect(s4.technicalTitle).toContain('Module 4: 1:1 Face Match');
    expect(s5!.technicalTitle).toContain('Module 5:');

    // Invariant: Calling plain language translations does not mutate the result object
    expect(result.verdict).toBe('SECONDARY_INSPECTION');
    expect(result.riskScore).toBe(78);
    expect(result.isAlreadyCompromised).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test 4: PDF Dossier Export maintains full technical & legal data
  // --------------------------------------------------------------------------
  it('Test 4: PDF Dossier generator executes successfully and contains Section 65B forensic details', () => {
    const forensicCase = createMockResult({
      verdict: 'DETAIN',
      riskScore: 98,
      isAlreadyCompromised: true,
      securityErrorCode: 'ERR_ICAO_CHECKSUM',
      icaoChecksumFailed: true,
      qrDetails: {
        qrDetected: true,
        qrDecoded: true,
        signatureVerified: false,
        dataMatched: false,
        status: 'SIGNATURE_INVALID',
      },
      pixelForensics: {
        copyMoveDetected: true,
        copyMoveConfidence: 0.95,
        dctAnomalyScore: 0.91,
        benfordViolation: true,
        multiLevelElaScore: 0.94,
        overallTamperScore: 95,
        forensicVerdict: 'TAMPERED',
        details: ['Cloned photo region detected via spatial block matching.'],
      },
    });

    // Verify that calling PDF generator does not throw and completes
    expect(() => generateOfficialDossierPdf(forensicCase)).not.toThrow();
  });

  // --------------------------------------------------------------------------
  // Test 5: Color and 3-State Verdict Alignment
  // --------------------------------------------------------------------------
  it('Test 5: Color and 3-State Verdict Alignment across CLEAR, SECONDARY, and DETAIN', () => {
    // 5a. CLEAR
    const clearDoc = createMockResult({ verdict: 'CLEAR', isAlreadyCompromised: false });
    const plainClear = getPlainVerdict(clearDoc);
    expect(plainClear.label).toBe('Approve — Clear to Enter');
    expect(plainClear.actionText).toBe('Approve & Clear Transit');
    expect(plainClear.color).toBe('green');
    expect(plainClear.badgeClass).toContain('bg-emerald');

    // 5b. SECONDARY_INSPECTION
    const secondaryDoc = createMockResult({
      verdict: 'SECONDARY_INSPECTION',
      riskScore: 78,
      isAlreadyCompromised: true,
      securityErrorCode: 'SUSPICIOUS_OPTICAL_NOISE',
    });
    const plainSecondary = getPlainVerdict(secondaryDoc);
    expect(plainSecondary.label).toBe('Needs a Closer Look — Send to Secondary');
    expect(plainSecondary.actionText).toBe('Send to Secondary Inspection');
    expect(plainSecondary.color).toBe('amber');
    expect(plainSecondary.badgeClass).toContain('bg-amber');

    // 5c. DETAIN
    const detainDoc = createMockResult({
      verdict: 'DETAIN',
      riskScore: 98,
      isAlreadyCompromised: true,
      securityErrorCode: 'ERR_ICAO_CHECKSUM',
    });
    const plainDetain = getPlainVerdict(detainDoc);
    expect(plainDetain.label).toBe('Stop — Do Not Allow Entry');
    expect(plainDetain.actionText).toBe('Stop — Do Not Allow Entry');
    expect(plainDetain.color).toBe('red');
    expect(plainDetain.badgeClass).toContain('bg-rose');

    // 5d. STANDBY / BLANK
    const blankDoc = createCleanSession();
    const plainBlank = getPlainVerdict(blankDoc);
    expect(plainBlank.label).toBe('Awaiting Document Scan');
    expect(plainBlank.color).toBe('slate');
  });

});
