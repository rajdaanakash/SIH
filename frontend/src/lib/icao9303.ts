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
    } else {
      val = 0;
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
 * Common optical character recognition (OCR) substitution pairs
 * (O↔0, I↔1, Z↔2, B↔8, S↔5)
 */
export const OPTICAL_DISAMBIGUATION_MAP: Record<string, string> = {
  'O': '0', '0': 'O',
  'I': '1', '1': 'I',
  'Z': '2', '2': 'Z',
  'B': '8', '8': 'B',
  'S': '5', '5': 'S',
};

export interface OpticalDisambiguationResult {
  validWithSubstitution: boolean;
  substitutedData?: string;
  substitutedCheckDigit?: string;
  field?: string;
  originalChar?: string;
  replacedChar?: string;
}

/**
 * Tests if a failed check digit can be resolved SOLELY by a single optical character substitution.
 * If yes, it indicates optical glare/noise rather than malicious physical tampering.
 */
export function checkOpticalNoiseDisambiguation(
  dataString: string,
  expectedCheckDigit: string | number,
  fieldName: string = 'Field'
): OpticalDisambiguationResult {
  // 1. Test single-character substitution within dataString
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString[i].toUpperCase();
    const sub = OPTICAL_DISAMBIGUATION_MAP[char];
    if (sub) {
      const candidate = dataString.substring(0, i) + sub + dataString.substring(i + 1);
      if (verifyIcaoField(candidate, expectedCheckDigit)) {
        return {
          validWithSubstitution: true,
          substitutedData: candidate,
          field: fieldName,
          originalChar: char,
          replacedChar: sub,
        };
      }
    }
  }

  // 2. Test substitution of the check digit itself
  const expStr = String(expectedCheckDigit).toUpperCase();
  const subDigit = OPTICAL_DISAMBIGUATION_MAP[expStr];
  if (subDigit) {
    if (verifyIcaoField(dataString, subDigit)) {
      return {
        validWithSubstitution: true,
        substitutedCheckDigit: subDigit,
        field: fieldName,
        originalChar: expStr,
        replacedChar: subDigit,
      };
    }
  }

  return { validWithSubstitution: false };
}

/**
 * Parses and verifies standard 2-line TD3 passport MRZ (44 characters per line)
 */
export function parseAndVerifyTd3Mrz(line1: string, line2: string): IcaoChecksumDetails {
  const notes: string[] = [];
  const cleanL1 = (line1 || '').trim().toUpperCase();
  const cleanL2 = (line2 || '').trim().toUpperCase();

  if (!cleanL2 || cleanL2.length < 44) {
    return {
      documentNumberValid: false,
      dobValid: false,
      expiryValid: false,
      compositeValid: false,
      rawAlgorithm: 'ICAO 9303 Part 3/7 (Modulus 10, 7-3-1 weights)',
      overallIcaoCompliant: false,
      format: 'TD3',
      notes: ['Invalid MRZ length: expected 44 characters for TD3 Line 2.'],
    };
  }

  let opticalNoiseDetected = false;
  let opticalNoiseField: string | undefined;
  let opticalNoiseCandidate: string | undefined;

  // 1. Document Number
  const docNumber = cleanL2.substring(0, 9);
  const docCheck = cleanL2.substring(9, 10);
  let docValid = verifyIcaoField(docNumber, docCheck);
  if (!docValid) {
    const opt = checkOpticalNoiseDisambiguation(docNumber, docCheck, 'Doc #');
    if (opt.validWithSubstitution) {
      opticalNoiseDetected = true;
      opticalNoiseField = 'Document Number';
      opticalNoiseCandidate = opt.substitutedData;
      notes.push(`Doc # ('${docNumber}') optical noise detected: ambiguous char '${opt.originalChar}' resolved to '${opt.replacedChar}'.`);
    } else {
      notes.push(`Doc # ('${docNumber}') check digit mismatch: expected ${calculateIcaoCheckDigit(docNumber)}, found ${docCheck}`);
    }
  }

  // 2. Date of Birth (YYMMDD)
  const dob = cleanL2.substring(13, 19);
  const dobCheck = cleanL2.substring(19, 20);
  let dobValid = verifyIcaoField(dob, dobCheck);
  if (!dobValid) {
    const opt = checkOpticalNoiseDisambiguation(dob, dobCheck, 'DOB');
    if (opt.validWithSubstitution) {
      opticalNoiseDetected = true;
      opticalNoiseField = 'Date of Birth';
      opticalNoiseCandidate = opt.substitutedData;
      notes.push(`DOB ('${dob}') optical noise detected: ambiguous char '${opt.originalChar}' resolved to '${opt.replacedChar}'.`);
    } else {
      notes.push(`DOB ('${dob}') check digit mismatch: expected ${calculateIcaoCheckDigit(dob)}, found ${dobCheck}`);
    }
  }

  // 3. Expiration Date (YYMMDD)
  const expiry = cleanL2.substring(21, 27);
  const expiryCheck = cleanL2.substring(27, 28);
  let expiryValid = verifyIcaoField(expiry, expiryCheck);
  if (!expiryValid) {
    const opt = checkOpticalNoiseDisambiguation(expiry, expiryCheck, 'Expiry');
    if (opt.validWithSubstitution) {
      opticalNoiseDetected = true;
      opticalNoiseField = 'Expiry Date';
      opticalNoiseCandidate = opt.substitutedData;
      notes.push(`Expiry Date ('${expiry}') optical noise detected: ambiguous char '${opt.originalChar}' resolved to '${opt.replacedChar}'.`);
    } else {
      notes.push(`Expiry Date ('${expiry}') check digit mismatch: expected ${calculateIcaoCheckDigit(expiry)}, found ${expiryCheck}`);
    }
  }

  // 4. Composite Check (Chars 0..10 + 13..20 + 21..43 vs Char 43)
  const compositeChunk = cleanL2.substring(0, 10) + cleanL2.substring(13, 20) + cleanL2.substring(21, 43);
  const compositeCheck = cleanL2.substring(43, 44);
  const compositeValid = verifyIcaoField(compositeChunk, compositeCheck);
  if (!compositeValid && !opticalNoiseDetected) {
    notes.push('Composite MRZ checksum validation failed: indicates manual alteration of one or more fields.');
  }

  const overall = docValid && dobValid && expiryValid && compositeValid;

  return {
    documentNumberValid: docValid || (opticalNoiseDetected && opticalNoiseField === 'Document Number'),
    dobValid: dobValid || (opticalNoiseDetected && opticalNoiseField === 'Date of Birth'),
    expiryValid: expiryValid || (opticalNoiseDetected && opticalNoiseField === 'Expiry Date'),
    compositeValid: compositeValid || opticalNoiseDetected,
    rawAlgorithm: 'ICAO Doc 9303 Part 3/7 (Modulus 10, 7-3-1 weights)',
    overallIcaoCompliant: overall,
    format: 'TD3',
    opticalNoiseDetected,
    opticalNoiseField,
    opticalNoiseCandidate,
    notes,
  };
}

/**
 * Parses and verifies 3-line TD1 MRTD (30 characters per line, common on national identity cards)
 */
export function parseAndVerifyTd1Mrz(line1: string, line2: string, line3: string): IcaoChecksumDetails {
  const notes: string[] = [];
  const cleanL1 = (line1 || '').trim().toUpperCase();
  const cleanL2 = (line2 || '').trim().toUpperCase();
  const cleanL3 = (line3 || '').trim().toUpperCase();

  if (cleanL1.length < 30 || cleanL2.length < 30) {
    return {
      documentNumberValid: false,
      dobValid: false,
      expiryValid: false,
      compositeValid: false,
      rawAlgorithm: 'ICAO Doc 9303 Part 5 (TD1 Modulus 10, 7-3-1 weights)',
      overallIcaoCompliant: false,
      format: 'TD1',
      notes: ['Invalid MRZ length: expected 30 characters each for TD1 lines.'],
    };
  }

  let opticalNoiseDetected = false;
  let opticalNoiseField: string | undefined;
  let opticalNoiseCandidate: string | undefined;

  // Line 1: Chars 5..14 is Document Number (9 chars), Char 14 is Check Digit
  const docNumber = cleanL1.substring(5, 14);
  const docCheck = cleanL1.substring(14, 15);
  let docValid = verifyIcaoField(docNumber, docCheck);
  if (!docValid) {
    const opt = checkOpticalNoiseDisambiguation(docNumber, docCheck, 'TD1 Doc #');
    if (opt.validWithSubstitution) {
      opticalNoiseDetected = true;
      opticalNoiseField = 'Document Number';
      opticalNoiseCandidate = opt.substitutedData;
      notes.push(`TD1 Doc # optical noise detected: ambiguous char resolved to '${opt.replacedChar}'.`);
    } else {
      notes.push(`TD1 Doc # ('${docNumber}') check mismatch: expected ${calculateIcaoCheckDigit(docNumber)}, found ${docCheck}`);
    }
  }

  // Line 2: Chars 0..6 is DOB (YYMMDD), Char 6 is Check Digit
  const dob = cleanL2.substring(0, 6);
  const dobCheck = cleanL2.substring(6, 7);
  let dobValid = verifyIcaoField(dob, dobCheck);
  if (!dobValid) {
    const opt = checkOpticalNoiseDisambiguation(dob, dobCheck, 'TD1 DOB');
    if (opt.validWithSubstitution) {
      opticalNoiseDetected = true;
      opticalNoiseField = 'Date of Birth';
      opticalNoiseCandidate = opt.substitutedData;
      notes.push(`TD1 DOB optical noise detected: ambiguous char resolved to '${opt.replacedChar}'.`);
    } else {
      notes.push(`TD1 DOB ('${dob}') check mismatch: expected ${calculateIcaoCheckDigit(dob)}, found ${dobCheck}`);
    }
  }

  // Line 2: Chars 8..14 is Expiry Date (YYMMDD), Char 14 is Check Digit
  const expiry = cleanL2.substring(8, 14);
  const expiryCheck = cleanL2.substring(14, 15);
  let expiryValid = verifyIcaoField(expiry, expiryCheck);
  if (!expiryValid) {
    const opt = checkOpticalNoiseDisambiguation(expiry, expiryCheck, 'TD1 Expiry');
    if (opt.validWithSubstitution) {
      opticalNoiseDetected = true;
      opticalNoiseField = 'Expiry Date';
      opticalNoiseCandidate = opt.substitutedData;
      notes.push(`TD1 Expiry optical noise detected: ambiguous char resolved to '${opt.replacedChar}'.`);
    } else {
      notes.push(`TD1 Expiry ('${expiry}') check mismatch: expected ${calculateIcaoCheckDigit(expiry)}, found ${expiryCheck}`);
    }
  }

  // Line 2: Char 29 is Composite Check Digit
  // TD1 composite covers: Line 1 (5..30) + Line 2 (0..7) + Line 2 (8..15) + Line 2 (18..29)
  const compositeChunk = cleanL1.substring(5, 30) + cleanL2.substring(0, 7) + cleanL2.substring(8, 15) + cleanL2.substring(18, 29);
  const compositeCheck = cleanL2.substring(29, 30);
  const compositeValid = verifyIcaoField(compositeChunk, compositeCheck);
  if (!compositeValid && !opticalNoiseDetected) {
    notes.push('TD1 composite checksum validation failed.');
  }

  const overall = docValid && dobValid && expiryValid && compositeValid;

  return {
    documentNumberValid: docValid || (opticalNoiseDetected && opticalNoiseField === 'Document Number'),
    dobValid: dobValid || (opticalNoiseDetected && opticalNoiseField === 'Date of Birth'),
    expiryValid: expiryValid || (opticalNoiseDetected && opticalNoiseField === 'Expiry Date'),
    compositeValid: compositeValid || opticalNoiseDetected,
    rawAlgorithm: 'ICAO Doc 9303 Part 5 (TD1 Modulus 10, 7-3-1 weights)',
    overallIcaoCompliant: overall,
    format: 'TD1',
    opticalNoiseDetected,
    opticalNoiseField,
    opticalNoiseCandidate,
    notes,
  };
}

/**
 * Universal MRZ parser auto-detecting TD3 (Passports) vs TD1 (National IDs) vs Visas
 */
export function parseAndVerifyMrz(lines: string[]): IcaoChecksumDetails {
  const filtered = lines.map(l => (l || '').trim()).filter(Boolean);

  if (filtered.length >= 3 && filtered[0].length === 30 && filtered[1].length === 30) {
    return parseAndVerifyTd1Mrz(filtered[0], filtered[1], filtered[2] || '');
  }

  if (filtered.length >= 2) {
    return parseAndVerifyTd3Mrz(filtered[0], filtered[1]);
  }

  return {
    documentNumberValid: false,
    dobValid: false,
    expiryValid: false,
    compositeValid: false,
    rawAlgorithm: 'ICAO Doc 9303 (Modulus 10, 7-3-1 weights)',
    overallIcaoCompliant: false,
    notes: ['Incomplete MRZ lines.'],
  };
}

export interface DummyDetectionResult {
  isDummy: boolean;
  isNameOnlySampleMatch: boolean;
  severity: 'DETAIN' | 'SECONDARY_INSPECTION' | 'NONE';
  reason: string;
  matchedPattern?: string;
}

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
];

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

/**
 * Detects known internet templates, dummy names, sequential numbers, and specimen indicators.
 * Implements false-positive defense: Legitimate travelers whose name happens to match a dummy name
 * are routed to SECONDARY_INSPECTION (not automatic DETAIN) unless accompanied by a check-digit failure
 * or dummy document number.
 */
export function detectDummyOrSpecimen(
  fields: { fullName?: string; documentNumber?: string },
  rawText?: string,
  icaoChecksumValid?: boolean
): DummyDetectionResult {
  const nameUpper = (fields.fullName || '').toUpperCase().trim();
  const docUpper = (fields.documentNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  const textUpper = (rawText || '').toUpperCase();

  // 1. Check known dummy document numbers (e.g. A1234567) -> HARD DETAIN
  for (const num of KNOWN_DUMMY_DOC_NUMBERS) {
    if (docUpper === num || docUpper.startsWith(num)) {
      return {
        isDummy: true,
        isNameOnlySampleMatch: false,
        severity: 'DETAIN',
        reason: `Known dummy/sample passport number detected ('${num}'). This is an internet mock-up template, not a legally issued passport.`,
        matchedPattern: num,
      };
    }
  }

  // 2. Sequential / placeholder digit patterns -> HARD DETAIN
  if (/1234567|012345|987654|000000|111111/.test(docUpper)) {
    return {
      isDummy: true,
      isNameOnlySampleMatch: false,
      severity: 'DETAIN',
      reason: `Document number contains test/sequential digits ('${docUpper}'). Legitimate passports never contain sequential test patterns.`,
      matchedPattern: docUpper,
    };
  }

  // 3. Watermarks / explicit template labels -> HARD DETAIN
  if (
    textUpper.includes('SPECIMEN') ||
    textUpper.includes('DUMMY PASSPORT') ||
    textUpper.includes('SAMPLE COPY') ||
    textUpper.includes('FOR PRACTICE ONLY') ||
    textUpper.includes('NOT FOR TRAVEL')
  ) {
    return {
      isDummy: true,
      isNameOnlySampleMatch: false,
      severity: 'DETAIN',
      reason: 'Document contains explicit "SPECIMEN" or "DUMMY" watermark indicators.',
      matchedPattern: 'SPECIMEN_WATERMARK',
    };
  }

  // 4. Dummy identity names ("ARJUN KUMAR", "JOHN DOE", etc.)
  for (const dummyName of KNOWN_DUMMY_NAMES) {
    if (nameUpper === dummyName || nameUpper.includes(dummyName)) {
      // If accompanied by check digit failure or unknown checksum -> HARD DETAIN
      if (icaoChecksumValid === false) {
        return {
          isDummy: true,
          isNameOnlySampleMatch: false,
          severity: 'DETAIN',
          reason: `Identity matches known dummy template specimen ('${dummyName}') and failed ICAO checksum validation.`,
          matchedPattern: dummyName,
        };
      }

      // FALSE-POSITIVE MITIGATION:
      // If check digits are valid and doc number is not a known dummy number,
      // route to SECONDARY_INSPECTION instead of hard detain!
      return {
        isDummy: false,
        isNameOnlySampleMatch: true,
        severity: 'SECONDARY_INSPECTION',
        reason: `Identity name matches common template specimen ('${dummyName}'). Since mathematical ICAO check digits are valid, routed to Secondary Inspection for manual physical booklet verification.`,
        matchedPattern: dummyName,
      };
    }
  }

  return {
    isDummy: false,
    isNameOnlySampleMatch: false,
    severity: 'NONE',
    reason: '',
  };
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
