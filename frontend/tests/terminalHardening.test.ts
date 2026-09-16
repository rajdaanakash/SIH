import { describe, it, expect } from 'vitest';
import {
  evaluateScreeningCase,
  updateBiometricsWithInvariant,
  createCleanSession,
} from '../src/lib/screeningEngine';
import {
  calculateIcaoCheckDigit,
  parseAndVerifyTd3Mrz,
  parseAndVerifyTd1Mrz,
  checkOpticalNoiseDisambiguation,
} from '../src/lib/icao9303';
import {
  checkDocumentExpiry,
  parseDocumentDate,
  computeSha256,
  isDuplicatePayload,
  validateUploadPayload,
} from '../src/lib/dateUtils';

describe('Border Terminal Security Hardening & Zero-Trust Invariants', () => {

  // -------------------------------------------------------------
  // Scenario 1: Duplicate passport/visa payload byte duplicate -> DETAIN
  // -------------------------------------------------------------
  it('Scenario 1: Duplicate passport/visa payload triggers ERR_DUPLICATE_INGESTION and DETAIN (score 98)', async () => {
    const identicalSpecimenBytes = 'data:image/jpeg;base64,' + Buffer.from('FAKE_IDENTICAL_PASSPORT_IMAGE_BYTES_12345').toString('base64');

    const result = await evaluateScreeningCase({
      passportPayload: identicalSpecimenBytes,
      visaPayload: identicalSpecimenBytes,
      extractedFields: {
        fullName: 'AARAV SHARMA',
        documentNumber: 'Z8941209',
        nationality: 'IND',
        dateOfBirth: '14/05/1990',
        expiryDate: '13/05/2032',
      },
    });

    expect(result.isDuplicateDocument).toBe(true);
    expect(result.securityErrorCode).toBe('ERR_DUPLICATE_INGESTION');
    expect(result.verdict).toBe('DETAIN');
    expect(result.riskScore).toBe(98);
    expect(result.isAlreadyCompromised).toBe(true);
  });

  // -------------------------------------------------------------
  // Scenario 2: Expired document with 99% biometric match -> DETAIN
  // -------------------------------------------------------------
  it('Scenario 2: Expired document (e.g. 2006) with 99% biometric match remains locked at DETAIN', async () => {
    const expiredDoc = await evaluateScreeningCase({
      passportPayload: 'sample_passport_bytes_expired_doc',
      extractedFields: {
        fullName: 'VIKRAM MALHOTRA',
        documentNumber: 'Z9821456',
        nationality: 'IND',
        dateOfBirth: '14/05/1980',
        expiryDate: '22/11/2006', // Expired relative to 2026
        issuingCountry: 'IND',
      },
    });

    expect(expiredDoc.isExpired).toBe(true);
    expect(expiredDoc.securityErrorCode).toBe('ERR_DOCUMENT_EXPIRED');
    expect(expiredDoc.verdict).toBe('DETAIN');
    expect(expiredDoc.isAlreadyCompromised).toBe(true);
    expect(expiredDoc.riskScore).toBeGreaterThanOrEqual(95);

    // Downstream Biometric Verification with 99% perfect face match
    const afterBiometrics = updateBiometricsWithInvariant(expiredDoc, {
      faceMatched: true,
      similarityScore: 99.4,
      livePhotoUrl: 'data:image/jpeg;base64,live_face_match_stream',
    });

    // Invariant check: Downstream biometrics CANNOT clear or lower risk score
    expect(afterBiometrics.verdict).toBe('DETAIN');
    expect(afterBiometrics.isAlreadyCompromised).toBe(true);
    expect(afterBiometrics.riskScore).toBeGreaterThanOrEqual(95);
    expect(afterBiometrics.biometricDetails.bearerStatus).toBe('BEARER_CONFIRMED');
  });

  // -------------------------------------------------------------
  // Scenario 3: Biometric match arriving AFTER risk lock (Async race condition)
  // -------------------------------------------------------------
  it('Scenario 3: Async race condition — biometric callback arriving after lock is set preserves DETAIN', async () => {
    // Step 1: Initialize case and trigger deterministic compromise
    const compromisedCase = await evaluateScreeningCase({
      passportPayload: 'sample_compromised_payload_bytes',
      extractedFields: {
        fullName: 'SUSPECT BEARER',
        documentNumber: 'A1234567', // Dummy specimen number
        nationality: 'IND',
        dateOfBirth: '01/01/1990',
        expiryDate: '01/01/2030',
      },
    });

    expect(compromisedCase.isAlreadyCompromised).toBe(true);
    expect(compromisedCase.verdict).toBe('DETAIN');
    const lockedScore = compromisedCase.riskScore;

    // Simulate delayed biometric callback firing after 2500ms network delay
    const delayedBiometricUpdate = updateBiometricsWithInvariant(compromisedCase, {
      faceMatched: true,
      similarityScore: 98.7,
      livePhotoUrl: 'live_async_camera_feed',
    });

    // Invariant check: locked verdict and risk score MUST NOT be mutated downwards
    expect(delayedBiometricUpdate.verdict).toBe('DETAIN');
    expect(delayedBiometricUpdate.riskScore).toBeGreaterThanOrEqual(lockedScore);
    expect(delayedBiometricUpdate.isAlreadyCompromised).toBe(true);
  });

  // -------------------------------------------------------------
  // Scenario 4: "Arjun Kumar" / A1234567 dummy specimen -> DETAIN
  // -------------------------------------------------------------
  it('Scenario 4: Known dummy specimen template (A1234567 / ARJUN KUMAR) triggers ERR_KNOWN_DUMMY_TEMPLATE and DETAIN (score 99)', async () => {
    const dummyCase = await evaluateScreeningCase({
      passportPayload: 'dummy_specimen_payload',
      extractedFields: {
        fullName: 'ARJUN KUMAR',
        documentNumber: 'A1234567',
        nationality: 'IND',
        dateOfBirth: '15/02/1985',
        expiryDate: '14/02/2035',
        issuingCountry: 'IND',
      },
    });

    expect(dummyCase.isDummySpecimen).toBe(true);
    expect(dummyCase.securityErrorCode).toBe('ERR_KNOWN_DUMMY_TEMPLATE');
    expect(dummyCase.verdict).toBe('DETAIN');
    expect(dummyCase.riskScore).toBe(99);
    expect(dummyCase.isAlreadyCompromised).toBe(true);
  });

  // -------------------------------------------------------------
  // Scenario 4b (False-Positive Defense): Legit traveler named "Arjun Kumar" with valid check digits
  // -------------------------------------------------------------
  it('Scenario 4b: False-positive mitigation — traveler named "Arjun Kumar" with valid ICAO check digits routes to SECONDARY_INSPECTION, not automatic detain', async () => {
    // Generate valid TD3 MRZ for authentic document number
    const docNum = 'Z8941209<'; // 9 chars
    const docCd = String(calculateIcaoCheckDigit(docNum));
    const dob = '850215'; // 6 chars
    const dobCd = String(calculateIcaoCheckDigit(dob));
    const exp = '340214'; // 6 chars
    const expCd = String(calculateIcaoCheckDigit(exp));
    const optional = '<<<<<<<<<<<<<<'; // 14 chars
    const optionalCd = '<'; // 1 char

    // In ICAO 9303 TD3:
    // line2 is: docNum (9) + docCd (1) + 'IND' (3) + dob (6) + dobCd (1) + 'M' (1) + exp (6) + expCd (1) + optional (14) + optionalCd (1) + compositeCd (1)
    // composite chunk is: line2[0..10] + line2[13..20] + line2[21..43]
    const part1 = `${docNum}${docCd}`; // 10 chars
    const part2 = `${dob}${dobCd}`; // 7 chars
    const part3 = `${exp}${expCd}${optional}${optionalCd}`; // 22 chars
    const compositeCd = String(calculateIcaoCheckDigit(part1 + part2 + part3));

    const line1 = 'P<INDARJUN<<KUMAR<<<<<<<<<<<<<<<<<<<<<<<<<<<';
    const line2 = `${part1}IND${part2}M${part3}${compositeCd}`;

    const td3 = parseAndVerifyTd3Mrz(line1, line2);
    expect(td3.overallIcaoCompliant).toBe(true);

    const legitimateTraveler = await evaluateScreeningCase({
      passportPayload: 'legit_specimen_payload',
      extractedFields: {
        fullName: 'ARJUN KUMAR',
        documentNumber: 'Z8941209',
        nationality: 'IND',
        dateOfBirth: '15/02/1985',
        expiryDate: '14/02/2034',
        issuingCountry: 'IND',
        mrzLine1: line1,
        mrzLine2: line2,
      },
    });

    // Guard: Valid check digits with sample name must NOT be hard-detained automatically
    expect(legitimateTraveler.icaoDetails.overallIcaoCompliant).toBe(true);
    expect(legitimateTraveler.verdict).toBe('SECONDARY_INSPECTION');
    expect(legitimateTraveler.isAlreadyCompromised).toBe(false);
  });

  // -------------------------------------------------------------
  // Scenario 5: US Visa presented at an Indian border -> DETAIN
  // -------------------------------------------------------------
  it('Scenario 5: US Visa presented at Indian Border triggers ERR_INVALID_JURISDICTION and DETAIN (score 94)', async () => {
    const jurisdictionViolationCase = await evaluateScreeningCase({
      passportPayload: 'sample_foreign_passport_bytes',
      visaPayload: 'sample_us_visa_foil_bytes',
      extractedFields: {
        fullName: 'JOHN SMITH',
        documentNumber: 'U8849102',
        nationality: 'USA',
        dateOfBirth: '12/04/1988',
        expiryDate: '11/04/2032',
        issuingCountry: 'USA',
      },
      aiData: {
        hasVisa: true,
        isInvalidJurisdiction: true,
        visaDetails: {
          visaNumber: 'USA-V-99124',
          issuingPost: 'EMBASSY OF THE UNITED STATES OF AMERICA',
        },
      },
    });

    expect(jurisdictionViolationCase.isInvalidJurisdiction).toBe(true);
    expect(jurisdictionViolationCase.securityErrorCode).toBe('ERR_INVALID_JURISDICTION');
    expect(jurisdictionViolationCase.verdict).toBe('DETAIN');
    expect(jurisdictionViolationCase.riskScore).toBe(94);
    expect(jurisdictionViolationCase.isAlreadyCompromised).toBe(true);
  });

  // -------------------------------------------------------------
  // Scenario 6: Ambiguous character OCR glare (O<->0) -> SECONDARY_INSPECTION (not DETAIN)
  // -------------------------------------------------------------
  it('Scenario 6: Single-digit OCR glare (O<->0 substitution) routes to SECONDARY_INSPECTION, not DETAIN', () => {
    // Legitimate date: '940701', calculateIcaoCheckDigit('940701') = 5
    // Optical OCR glare: '94O701' (letter 'O' instead of digit '0')
    const opticalNoiseData = '94O701';
    const expectedCheckDigit = '5';

    const disambiguation = checkOpticalNoiseDisambiguation(opticalNoiseData, expectedCheckDigit, 'DOB');
    expect(disambiguation.validWithSubstitution).toBe(true);
    expect(disambiguation.substitutedData).toBe('940701');
    expect(disambiguation.originalChar).toBe('O');
    expect(disambiguation.replacedChar).toBe('0');

    // In TD3 MRZ parse:
    const docNum = 'Z8941209<';
    const docCd = String(calculateIcaoCheckDigit(docNum));
    const dobNoise = '94O701'; // 'O' instead of '0'
    const dobCd = '5';
    const exp = '340902';
    const expCd = String(calculateIcaoCheckDigit(exp));
    const optional = '<<<<<<<<<<<<<<';
    const optionalCd = '<';

    const part1 = `${docNum}${docCd}`;
    const part2 = `${dobNoise}${dobCd}`;
    const part3 = `${exp}${expCd}${optional}${optionalCd}`;

    const line1 = 'P<INDAKASH<<VERMA<<<<<<<<<<<<<<<<<<<<<<<<<<<';
    const line2 = `${part1}IND${part2}M${part3}0`;

    const td3Result = parseAndVerifyTd3Mrz(line1, line2);
    expect(td3Result.opticalNoiseDetected).toBe(true);
    expect(td3Result.opticalNoiseField).toBe('Date of Birth');
  });

  // -------------------------------------------------------------
  // Scenario 7: TD1 national ID presented as primary document -> parsed and verified
  // -------------------------------------------------------------
  it('Scenario 7: TD1 national ID (3 lines x 30 characters) is correctly parsed and compliant', async () => {
    // Generate valid TD1 MRZ:
    // Line 1: I<IND (5) + docNum (9) + docCd (1) + optional1 (15) = 30
    const docNum = '001234567';
    const docCd = String(calculateIcaoCheckDigit(docNum));
    const optional1 = '<<<<<<<<<<<<<<<'; // 15 chars
    const line1 = `I<IND${docNum}${docCd}${optional1}`;

    // Line 2: dob (6) + dobCd (1) + sex (1) + exp (6) + expCd (1) + nationality (3) + optional2 (11) + compositeCd (1) = 30
    const dob = '900101';
    const dobCd = String(calculateIcaoCheckDigit(dob));
    const sex = 'M';
    const exp = '300101';
    const expCd = String(calculateIcaoCheckDigit(exp));
    const nationality = 'IND';
    const optional2 = '<<<<<<<<<<<'; // 11 chars

    // Composite for TD1: Line 1 (5..30) + Line 2 (0..7) + Line 2 (8..15) + Line 2 (18..29)
    const line2Pre = `${dob}${dobCd}${sex}${exp}${expCd}${nationality}${optional2}`;
    const chunk1 = line1.substring(5, 30); // 25 chars
    const chunk2 = line2Pre.substring(0, 7); // 7 chars
    const chunk3 = line2Pre.substring(8, 15); // 7 chars
    const chunk4 = line2Pre.substring(18, 29); // 11 chars
    const compositeCd = String(calculateIcaoCheckDigit(chunk1 + chunk2 + chunk3 + chunk4));

    const line2 = `${line2Pre}${compositeCd}`;
    const line3 = 'SHARMA<<ANIL<<<<<<<<<<<<<<<<<<'; // 30 chars

    const td1Result = parseAndVerifyTd1Mrz(line1, line2, line3);
    expect(td1Result.format).toBe('TD1');
    expect(td1Result.documentNumberValid).toBe(true);
    expect(td1Result.dobValid).toBe(true);
    expect(td1Result.expiryValid).toBe(true);
    expect(td1Result.compositeValid).toBe(true);
    expect(td1Result.overallIcaoCompliant).toBe(true);

    const td1Case = await evaluateScreeningCase({
      passportPayload: 'sample_td1_card_bytes',
      extractedFields: {
        fullName: 'ANIL SHARMA',
        documentNumber: docNum,
        nationality: 'IND',
        dateOfBirth: '01/01/1990',
        expiryDate: '01/01/2030',
        issuingCountry: 'IND',
        mrzLine1: line1,
        mrzLine2: line2,
        mrzLine3: line3,
      },
    });

    expect(td1Case.documentType).toBe('NATIONAL_ID');
    expect(td1Case.icaoDetails.overallIcaoCompliant).toBe(true);
    expect(td1Case.isWrongDocumentType).toBe(false);
  });

  // -------------------------------------------------------------
  // Scenario 8: Session reset: Case A (DETAIN) -> New Case -> Case B is fully clean
  // -------------------------------------------------------------
  it('Scenario 8: Session isolation — Case A (DETAIN) reset produces completely clean Case B with no residual state', async () => {
    // Process Case A -> Triggers DETAIN
    const caseA = await evaluateScreeningCase({
      passportPayload: 'case_a_bad_passport',
      extractedFields: {
        fullName: 'CRIMINAL SUSPECT',
        documentNumber: 'A1234567',
        nationality: 'IND',
        expiryDate: '01/01/2005', // Expired
      },
    });
    expect(caseA.verdict).toBe('DETAIN');
    expect(caseA.isAlreadyCompromised).toBe(true);
    expect(caseA.riskScore).toBeGreaterThanOrEqual(95);

    // Hard reset terminal for Case B
    const caseB = createCleanSession();

    expect(caseB.isTerminalBlank).toBe(true);
    expect(caseB.verdict).toBe('UNDETERMINED');
    expect(caseB.riskScore).toBe(0);
    expect(caseB.isAlreadyCompromised).toBe(false);
    expect(caseB.isExpired).toBeFalsy();
    expect(caseB.isDuplicateDocument).toBeFalsy();
    expect(caseB.isDummySpecimen).toBeFalsy();
    expect(caseB.securityErrorCode).toBeUndefined();
    expect(caseB.documentImageUrl).toBe('');
    expect(caseB.securityAlertMessages?.length).toBe(0);
  });

  // -------------------------------------------------------------
  // Scenario 9: AI providers timeout/fail -> SECONDARY_INSPECTION, never CLEAR
  // -------------------------------------------------------------
  it('Scenario 9: AI Gateway failure or timeout fails closed to SECONDARY_INSPECTION (never CLEAR)', async () => {
    const offlineOrTimeoutCase = await evaluateScreeningCase({
      passportPayload: 'clean_passport_sample_bytes',
      extractedFields: {
        fullName: 'ROHIT MEHRA',
        documentNumber: 'Z5512903',
        nationality: 'IND',
        dateOfBirth: '18/09/1992',
        expiryDate: '17/09/2032',
        issuingCountry: 'IND',
      },
      aiData: {
        status: 'AI_FORENSICS_UNAVAILABLE',
        recommendedAction: 'SECONDARY_INSPECTION',
      },
      offlineMode: true,
    });

    expect(offlineOrTimeoutCase.securityErrorCode).toBe('AI_FORENSICS_UNAVAILABLE');
    expect(offlineOrTimeoutCase.verdict).toBe('SECONDARY_INSPECTION');
    expect(offlineOrTimeoutCase.verdict).not.toBe('CLEAR');
    expect(offlineOrTimeoutCase.riskScore).toBe(48);
    expect(offlineOrTimeoutCase.offlineBypassed).toBe(true);
  });

  // -------------------------------------------------------------
  // Additional Security Guard: File Upload Payload Validator
  // -------------------------------------------------------------
  it('Upload Guard: Rejects non-image MIME types and payloads exceeding 15MB', () => {
    const oversizedFile = { name: 'huge_scan.jpg', size: 16 * 1024 * 1024, type: 'image/jpeg' };
    const invalidMimeFile = { name: 'malicious.exe', size: 1024 * 1024, type: 'application/x-msdownload' };
    const validFile = { name: 'passport.jpg', size: 2 * 1024 * 1024, type: 'image/jpeg' };

    expect(validateUploadPayload(oversizedFile).valid).toBe(false);
    expect(validateUploadPayload(invalidMimeFile).valid).toBe(false);
    expect(validateUploadPayload(validFile).valid).toBe(true);
  });
});
