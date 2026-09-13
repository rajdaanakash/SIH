import { IcaoChecksumDetails } from './types';

/**
 * Implements ICAO Doc 9303 Machine Readable Travel Document (MRTD) Checksum Algorithm
 * Weight cycle: 7, 3, 1 repeating
 */
export function calculateIcaoCheckDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i].toUpperCase();
    let val = 0;

    if (char >= '0' && char <= '9') {
      val = char.charCodeAt(0) - 48; // '0' -> 0
    } else if (char >= 'A' && char <= 'Z') {
      val = char.charCodeAt(0) - 65 + 10; // 'A' -> 10, 'Z' -> 35
    } else if (char === '<') {
      val = 0; // Filler character
    }

    sum += val * weights[i % 3];
  }

  return sum % 10;
}

/**
 * Validates check digit at the end of an MRZ field
 */
export function verifyIcaoField(dataString: string, expectedCheckDigit: string | number): boolean {
  const computed = calculateIcaoCheckDigit(dataString);
  return computed === Number(expectedCheckDigit);
}

/**
 * Parses and verifies standard 2-line TD3 passport MRZ
 */
export function parseAndVerifyTd3Mrz(line1: string, line2: string): IcaoChecksumDetails {
  const notes: string[] = [];

  if (!line2 || line2.length < 44) {
    return {
      documentNumberValid: false,
      dobValid: false,
      expiryValid: false,
      compositeValid: false,
      rawAlgorithm: 'ICAO 9303 (Modulus 10, 7-3-1 weights)',
      overallIcaoCompliant: false,
      notes: ['Invalid MRZ length: expected 44 characters for TD3 Line 2.'],
    };
  }

  const docNumber = line2.substring(0, 9);
  const docCheck = line2.substring(9, 10);
  const docValid = verifyIcaoField(docNumber, docCheck);
  if (!docValid) {
    notes.push('Doc # (' + docNumber + ') check digit mismatch: expected ' + calculateIcaoCheckDigit(docNumber) + ', found ' + docCheck);
  }

  const dob = line2.substring(13, 19);
  const dobCheck = line2.substring(19, 20);
  const dobValid = verifyIcaoField(dob, dobCheck);
  if (!dobValid) {
    notes.push('DOB (' + dob + ') check digit mismatch: expected ' + calculateIcaoCheckDigit(dob) + ', found ' + dobCheck);
  }

  const expiry = line2.substring(21, 27);
  const expiryCheck = line2.substring(27, 28);
  const expiryValid = verifyIcaoField(expiry, expiryCheck);
  if (!expiryValid) {
    notes.push('Expiry Date (' + expiry + ') check digit mismatch: expected ' + calculateIcaoCheckDigit(expiry) + ', found ' + expiryCheck);
  }

  // Composite check covers docNumber + check + dob + check + expiry + check + optional + check
  const compositeChunk = line2.substring(0, 10) + line2.substring(13, 20) + line2.substring(21, 43);
  const compositeCheck = line2.substring(43, 44);
  const compositeValid = verifyIcaoField(compositeChunk, compositeCheck);
  if (!compositeValid) {
    notes.push('Composite MRZ checksum validation failed: indicates manual modification of one or more fields.');
  }

  const overall = docValid && dobValid && expiryValid && compositeValid;

  return {
    documentNumberValid: docValid,
    dobValid: dobValid,
    expiryValid: expiryValid,
    compositeValid: compositeValid,
    rawAlgorithm: 'ICAO Doc 9303 Part 3/7 (Modulus 10, 7-3-1 weights)',
    overallIcaoCompliant: overall,
    notes,
  };
}

export interface DummyDetectionResult {
  isDummy: boolean;
  reason: string;
  matchedPattern?: string;
}

const KNOWN_DUMMY_NAMES = [
  'ARJUN KUMAR',
  'JOHN DOE',
  'JANE DOE',
  'SAMPLE PASSPORT',
  'SPECIMEN PASSPORT',
  'TEST USER',
  'DEMO USER',
  'CITIZEN SCAN',
  'PASSPORT HOLDER',
];

const KNOWN_DUMMY_DOC_NUMBERS = [
  'A1234567',
  'A12345678',
  '12345678',
  '1234567',
  '01234567',
  'X1234567',
  'P1234567',
  'T1234567',
  '00000000',
  '99999999',
  'TEST1234',
  'SP003369',
];

/**
 * Detects known internet templates, dummy names, sequential numbers, and specimen indicators.
 */
export function detectDummyOrSpecimen(
  fields: { fullName?: string; documentNumber?: string },
  rawText?: string
): DummyDetectionResult {
  const nameUpper = (fields.fullName || '').toUpperCase().trim();
  const docUpper = (fields.documentNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  const textUpper = (rawText || '').toUpperCase();

  // 1. Check known dummy document numbers (e.g. A1234567)
  for (const num of KNOWN_DUMMY_DOC_NUMBERS) {
    if (docUpper === num || docUpper.startsWith(num)) {
      return {
        isDummy: true,
        reason: `Known dummy/sample passport number detected ('${num}'). This is an internet mock-up template, not a legally issued passport.`,
        matchedPattern: num,
      };
    }
  }

  // 2. Sequential / placeholder digit patterns
  if (/1234567|012345|987654|000000|111111/.test(docUpper)) {
    return {
      isDummy: true,
      reason: `Document number contains test/sequential digits ('${docUpper}'). Legitimate passports never contain sequential test patterns.`,
      matchedPattern: docUpper,
    };
  }

  // 3. Known stock photo / sample dummy identity names
  for (const dummyName of KNOWN_DUMMY_NAMES) {
    if (nameUpper === dummyName || nameUpper.includes(dummyName)) {
      return {
        isDummy: true,
        reason: `Identity matches known dummy template specimen ('${dummyName}'). Internet sample documents cannot be cleared for border transit.`,
        matchedPattern: dummyName,
      };
    }
  }

  // 4. Watermarks / explicit template labels
  if (
    textUpper.includes('SPECIMEN') ||
    textUpper.includes('DUMMY PASSPORT') ||
    textUpper.includes('SAMPLE COPY') ||
    textUpper.includes('FOR PRACTICE ONLY') ||
    textUpper.includes('NOT FOR TRAVEL')
  ) {
    return {
      isDummy: true,
      reason: 'Document contains explicit "SPECIMEN" or "DUMMY" watermark indicators.',
      matchedPattern: 'SPECIMEN_WATERMARK',
    };
  }

  return { isDummy: false, reason: '' };
}

/**
 * Cross-checks Visual Inspection Zone (VIZ) textual fields against
 * Machine Readable Zone (MRZ) encoded data to catch forgery discrepancies.
 */
export function checkVizMrzConsistency(
  fields: { fullName?: string; documentNumber?: string; dateOfBirth?: string; expiryDate?: string },
  line1?: string,
  line2?: string
): { hasMismatch: boolean; notes: string[] } {
  const notes: string[] = [];
  if (!line2 || line2.length < 28) {
    return { hasMismatch: false, notes };
  }

  // 1. Compare Date of Birth: VIZ (DD/MM/YYYY) vs MRZ (YYMMDD)
  if (fields.dateOfBirth) {
    const dobMatch = fields.dateOfBirth.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dobMatch) {
      const dd = dobMatch[1].padStart(2, '0');
      const mm = dobMatch[2].padStart(2, '0');
      const yy = dobMatch[3].slice(-2);
      const expectedMrzDob = `${yy}${mm}${dd}`;

      const mrzDob = line2.substring(13, 19);
      if (mrzDob !== expectedMrzDob) {
        notes.push(
          `DOB DISCREPANCY: VIZ shows ${fields.dateOfBirth} (expected MRZ ${expectedMrzDob}), but MRZ encodes ${mrzDob} (month/day mismatch).`
        );
      }
    }
  }

  // 2. Compare Document Number: VIZ vs MRZ (chars 0..9)
  if (fields.documentNumber) {
    const cleanDoc = fields.documentNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const mrzDoc = line2.substring(0, 9).replace(/</g, '').trim();
    if (cleanDoc && mrzDoc && cleanDoc !== mrzDoc) {
      notes.push(`DOC # DISCREPANCY: VIZ shows '${cleanDoc}' but MRZ encodes '${mrzDoc}'.`);
    }
  }

  // 3. Compare Expiry Date: VIZ vs MRZ (chars 21..27)
  if (fields.expiryDate) {
    const expMatch = fields.expiryDate.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (expMatch) {
      const dd = expMatch[1].padStart(2, '0');
      const mm = expMatch[2].padStart(2, '0');
      const yy = expMatch[3].slice(-2);
      const expectedMrzExp = `${yy}${mm}${dd}`;

      const mrzExp = line2.substring(21, 27);
      if (mrzExp !== expectedMrzExp) {
        notes.push(`EXPIRY DISCREPANCY: VIZ shows ${fields.expiryDate} but MRZ encodes ${mrzExp}.`);
      }
    }
  }

  return {
    hasMismatch: notes.length > 0,
    notes,
  };
}
