import { describe, it, expect } from 'vitest';
import { getPlainStep2 } from '../src/lib/plainLanguage';
import { evaluateScreeningCase, INITIAL_CLEAN_RESULT } from '../src/lib/screeningEngine';
import { VerificationResult } from '../src/lib/types';
import fs from 'fs';
import path from 'path';

describe('Directive 10: Aadhaar Secure QR & QDA XML Verification & Plain UI Separation', () => {

  const createMockResult = (overrides: Partial<VerificationResult> = {}): VerificationResult => ({
    ...INITIAL_CLEAN_RESULT,
    isTerminalBlank: false,
    documentImageUrl: 'data:image/jpeg;base64,mock',
    documentType: 'PASSPORT',
    verdict: 'CLEAR',
    riskScore: 10,
    riskLevel: 'LOW',
    isAlreadyCompromised: false,
    ...overrides,
  });

  // --------------------------------------------------------------------------
  // Test Case 1: Plain Language Step 2 handles all QR Verification statuses
  // --------------------------------------------------------------------------
  it('Step 2 displays "Passed — Digital Signature Verified" on VERIFIED QR', () => {
    const result = createMockResult({
      qrDetails: {
        qr_detected: true,
        qr_decoded: true,
        status: 'VERIFIED',
        version: 'QDA_XML',
        signature_verified: true,
        data_matched: true,
      },
    });

    const step2 = getPlainStep2(result);
    expect(step2.statusBadge).toBe('Passed — Digital Signature Verified');
    expect(step2.statusType).toBe('passed');
    expect(step2.explanation).toContain('Official UIDAI digital signature verified');
    expect(step2.technicalTitle).toContain('UIDAI Digital Signature (QDA_XML)');
  });

  it('Step 2 displays "Failed — Signature Invalid" on forged digital signature', () => {
    const result = createMockResult({
      qrDetails: {
        qr_detected: true,
        qr_decoded: true,
        status: 'SIGNATURE_INVALID',
        version: 'V2_SECURE_QR',
        signature_verified: false,
      },
    });

    const step2 = getPlainStep2(result);
    expect(step2.statusBadge).toBe('Failed — Signature Invalid');
    expect(step2.statusType).toBe('failed');
    expect(step2.explanation).toContain('digital signature on the QR code is invalid');
  });

  it('Step 2 displays "Failed — Data Mismatch" on altered card fields', () => {
    const result = createMockResult({
      qrDetails: {
        qr_detected: true,
        qr_decoded: true,
        status: 'DATA_MISMATCH',
        version: 'QDA_XML',
        signature_verified: true,
        data_matched: false,
      },
    });

    const step2 = getPlainStep2(result);
    expect(step2.statusBadge).toBe('Failed — Data Mismatch');
    expect(step2.statusType).toBe('failed');
    expect(step2.explanation).toContain("Printed details on the card don't match the digitally signed QR data");
  });

  it('Step 2 displays "Needs Review — Image Quality Low" when blurry image fails quality gate', () => {
    const result = createMockResult({
      qrDetails: {
        qr_detected: true,
        status: 'QR_IMAGE_QUALITY_INSUFFICIENT',
      },
    });

    const step2 = getPlainStep2(result);
    expect(step2.statusBadge).toBe('Needs Review — Image Quality Low');
    expect(step2.statusType).toBe('warning');
    expect(step2.explanation).toContain('Image quality is too blurry or low-resolution');
  });

  // --------------------------------------------------------------------------
  // Test Case 2: Screening Engine routes QR_IMAGE_QUALITY_INSUFFICIENT to SECONDARY
  // --------------------------------------------------------------------------
  it('Screening engine routes QR_IMAGE_QUALITY_INSUFFICIENT to SECONDARY_INSPECTION with ERR_QR_UNREADABLE', async () => {
    const evaluated = await evaluateScreeningCase({
      passportPayload: 'data:image/jpeg;base64,mock_bytes',
      qrResult: {
        qr_detected: false,
        qr_decoded: false,
        status: 'QR_IMAGE_QUALITY_INSUFFICIENT',
        security_error_code: 'ERR_QR_UNREADABLE',
        message: 'Image resolution or sharpness insufficient to reliably decode high-density Aadhaar QR.',
      },
      offlineMode: true,
    });

    expect(evaluated.verdict).toBe('SECONDARY_INSPECTION');
    expect(evaluated.securityErrorCode).toBe('ERR_QR_UNREADABLE');
    expect(evaluated.riskScore).toBeGreaterThanOrEqual(45);
    expect(evaluated.securityAlertMessages?.some(m => m.includes('insufficient'))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test Case 3: Genuine QR passes Stage 1 & Stage 2 cleanly
  // --------------------------------------------------------------------------
  it('Genuine Aadhaar QDA XML payload with authentic signature clears QR checks', async () => {
    const evaluated = await evaluateScreeningCase({
      passportPayload: 'data:image/jpeg;base64,mock_bytes',
      extractedFields: {
        fullName: 'SHUBHAM VERMA',
        dateOfBirth: '11/07/2001',
        gender: 'M',
        nationality: 'IND',
        documentNumber: '5882',
      },
      qrResult: {
        qr_detected: true,
        qr_decoded: true,
        version: 'QDA_XML',
        status: 'VERIFIED',
        signature_verified: true,
        data_matched: true,
        decoded_fields: {
          name: 'SHUBHAM VERMA',
          dob: '11-07-2001',
          gender: 'M',
        },
      },
      aiData: {
        recommendedAction: 'CLEAR',
        forensicConfidenceScore: 95.0,
        tamperDetected: false,
      },
      offlineMode: false,
    });

    expect(evaluated.verdict).toBe('CLEAR');
    expect(evaluated.securityErrorCode).toBeUndefined();
    expect(evaluated.qrDetails?.status).toBe('VERIFIED');
  });

  // --------------------------------------------------------------------------
  // Test Case 4: UI Separation - AiReviewCard contains NO QR hardware signals
  // --------------------------------------------------------------------------
  it('AiReviewCard.tsx does NOT render Aadhaar Secure QR or Digital QR Signature inside supplementary card', () => {
    const cardPath = path.resolve(__dirname, '../src/components/AiReviewCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf-8');

    // Cryptographic QR status must NOT be rendered in AiReviewCard
    expect(content).not.toContain('Aadhaar Secure QR:');
    expect(content).not.toContain('Digital QR Signature:');
    expect(content).not.toContain('result.qrDetails');

    // VerificationChecklist.tsx MUST contain the authoritative check
    const checklistPath = path.resolve(__dirname, '../src/components/VerificationChecklist.tsx');
    const checklistContent = fs.readFileSync(checklistPath, 'utf-8');
    expect(checklistContent).toContain('result.qrDetails');
    expect(checklistContent).toContain('RSA-2048 VERIFIED');
  });

  // --------------------------------------------------------------------------
  // Test Case 5: Real Indian Aadhaar card with nationality "INDIAN (INDIA)"
  // --------------------------------------------------------------------------
  it('Real Indian Aadhaar card with "INDIAN (INDIA)" resolves isIndianNational: true, requiresVisa: false, documentType: AADHAAR', async () => {
    const evaluated = await evaluateScreeningCase({
      passportPayload: 'data:image/jpeg;base64,real_aadhaar_akash',
      extractedFields: {
        fullName: 'AKASH',
        documentNumber: '4797 6732 3110',
        nationality: 'INDIAN (INDIA)',
        dateOfBirth: '08/06/2007',
        gender: 'M',
        issuingCountry: 'INDIA',
      },
      aiData: {
        detectedDocType: 'AADHAAR',
        recommendedAction: 'CLEAR',
        forensicConfidenceScore: 94.0,
      },
      offlineMode: false,
    });

    expect(evaluated.isIndianNational).toBe(true);
    expect(evaluated.requiresVisa).toBe(false);
    expect(evaluated.documentType).toBe('AADHAAR');
    expect(evaluated.securityAlertMessages?.some(m => m.includes('FOREIGN CITIZEN'))).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Test Case 6: QR_NOT_PRESENT NEVER triggers "Aadhaar QR Forgery" or DETAIN
  // --------------------------------------------------------------------------
  it('QR_NOT_PRESENT with signature_verified: false NEVER flags Aadhaar QR Forgery or ERR_QR_SIGNATURE_INVALID', async () => {
    const evaluated = await evaluateScreeningCase({
      passportPayload: 'data:image/jpeg;base64,real_aadhaar_no_qr',
      extractedFields: {
        fullName: 'AKASH',
        documentNumber: '4797 6732 3110',
        nationality: 'INDIAN (INDIA)',
        dateOfBirth: '08/06/2007',
        gender: 'M',
      },
      qrResult: {
        qr_detected: false,
        qr_decoded: false,
        signature_verified: false, // Legacy bridge returned false
        status: 'QR_NOT_PRESENT',
      },
      offlineMode: false,
    });

    // Invariant: Must NOT be falsely accused of criminal cryptographic forgery!
    expect(evaluated.securityErrorCode).not.toBe('ERR_QR_SIGNATURE_INVALID');
    expect(evaluated.securityErrorCode).not.toBe('ERR_QR_DATA_MISMATCH');
    expect(evaluated.tamperDetails.flaggedRegions.some(r => r.field.includes('QR Forgery'))).toBe(false);
    expect(evaluated.verdict).not.toBe('DETAIN');
  });
});

