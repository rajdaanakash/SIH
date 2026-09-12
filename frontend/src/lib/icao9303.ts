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
