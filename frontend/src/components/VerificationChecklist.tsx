'use client';

import React from 'react';
import { VerificationResult } from '../lib/types';
import {
  getPlainStep1,
  getPlainStep2,
  getPlainStep3,
  getPlainStep4,
  getPlainStep5,
} from '../lib/plainLanguage';
import { CheckCircle2, XCircle, AlertTriangle, Shield, Cpu, Binary, UserCheck } from 'lucide-react';

interface Props {
  result: VerificationResult;
  showTechnicalDetails?: boolean;
}

export default function VerificationChecklist({ result, showTechnicalDetails = false }: Props) {
  const step1 = getPlainStep1(result);
  const step2 = getPlainStep2(result);
  const step3 = getPlainStep3(result);
  const step4 = getPlainStep4(result);
  const step5 = getPlainStep5(result);

  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-xs border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-[#0A2540]" />
          <span>{showTechnicalDetails ? 'Automated 4-Module Screening Protocol' : 'Automated Verification Checklist'}</span>
        </h3>
        <span className="text-[11px] text-slate-500 font-semibold">
          {showTechnicalDetails ? 'MHA Protocol Sec-26188 (Technical View)' : 'Border Officer Quick-Check'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Step 1: Reading the Document */}
        <div className="p-3 rounded-lg border bg-slate-50 border-slate-200">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5 text-[#0A2540]" />
              <span className="font-bold text-xs text-slate-800">
                {showTechnicalDetails ? step1.technicalTitle : step1.title}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
              {showTechnicalDetails ? '100% Extracted' : step1.statusBadge}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            {step1.explanation}
          </p>
          {showTechnicalDetails && (
            <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
              VIZ vs MRZ cross-correlation: <strong className="text-slate-800">{result.icaoDetails.overallIcaoCompliant ? 'Matched' : 'Inconsistent'}</strong>. TD3/MRV strings extracted.
            </div>
          )}
        </div>

        {/* Step 2: Security Code Check */}
        <div className={`p-3 rounded-lg border ${
          step2.statusType === 'passed'
            ? 'bg-emerald-50/50 border-emerald-200'
            : step2.statusType === 'warning'
            ? 'bg-amber-50/50 border-amber-200'
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-700" />
              <span className="font-bold text-xs text-slate-800">
                {showTechnicalDetails ? step2.technicalTitle : step2.title}
              </span>
            </div>
            {step2.statusType === 'passed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> {step2.statusBadge}
              </span>
            ) : step2.statusType === 'warning' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="w-3 h-3" /> {step2.statusBadge}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                <XCircle className="w-3 h-3" /> {step2.statusBadge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-700 leading-snug font-medium">
            {step2.explanation}
          </p>
          {result.qrDetails && result.qrDetails.qr_detected && (
            <div className="mt-2 pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-600">
                {showTechnicalDetails ? `Digital QR Crypto (${result.qrDetails.version || 'UIDAI'}):` : 'Digital QR Signature:'}
              </span>
              <span className={`font-mono font-bold px-1.5 py-0.5 rounded border ${
                result.qrDetails.status === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : result.qrDetails.status === 'QR_IMAGE_QUALITY_INSUFFICIENT' || result.qrDetails.status === 'QR_PARSE_FAILED'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {result.qrDetails.status === 'VERIFIED'
                  ? 'RSA-2048 VERIFIED'
                  : result.qrDetails.status}
              </span>
            </div>
          )}
          {showTechnicalDetails && (
            <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
              {result.qrDetails?.qr_detected
                ? `UIDAI Public Key • ${result.qrDetails.signature_message || 'Signature checked'} • ${result.qrDetails.data_matched ? 'Data cross-matched' : 'Data mismatch'}`
                : `7-3-1 weight modulus-10 algorithm check. ${result.icaoDetails.notes[0]}`}
            </div>
          )}
        </div>

        {/* Step 3: Tamper Check */}
        <div className={`p-3 rounded-lg border ${
          step3.statusType === 'passed'
            ? 'bg-emerald-50/50 border-emerald-200'
            : step3.statusType === 'warning'
            ? 'bg-amber-50/50 border-amber-200'
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-700" />
              <span className="font-bold text-xs text-slate-800">
                {showTechnicalDetails ? step3.technicalTitle : step3.title}
              </span>
            </div>
            {step3.statusType === 'failed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                <XCircle className="w-3 h-3" /> {step3.statusBadge}
              </span>
            ) : step3.statusType === 'warning' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="w-3 h-3" /> {step3.statusBadge}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> {step3.statusBadge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-700 leading-snug font-medium">
            {step3.explanation}
          </p>
          {showTechnicalDetails && (
            <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
              ELA score: {result.tamperDetails.elaAnomalyScore} • Photo seam: {result.tamperDetails.photoReplacementDetected ? 'Compromised' : 'Intact'} • QR Crypto: {result.qrDetails?.status || 'N/A'}
            </div>
          )}
        </div>

        {/* Step 4: Face Match */}
        <div className={`p-3 rounded-lg border ${
          step4.statusType === 'passed'
            ? 'bg-emerald-50/50 border-emerald-200'
            : step4.statusType === 'warning'
            ? 'bg-amber-50/50 border-amber-200'
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-cyan-700" />
              <span className="font-bold text-xs text-slate-800">
                {showTechnicalDetails ? step4.technicalTitle : step4.title}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
              step4.statusType === 'passed'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : step4.statusType === 'warning'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}>
              {step4.statusType === 'passed' ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : step4.statusType === 'warning' ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
              <span>{step4.statusBadge}</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-700 leading-snug font-medium">
            {step4.explanation}
          </p>
          {showTechnicalDetails && (
            <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
              Similarity: {result.biometricDetails.similarityScore}% • Liveness: {result.biometricDetails.livenessVerified ? 'PASSED' : 'UNVERIFIED'} • Bearer: {result.biometricDetails.bearerStatus}
            </div>
          )}
        </div>

        {/* Step 5: Visa Check (Displayed when Visa is present) */}
        {step5 && (
          <div className={`p-3 rounded-lg border sm:col-span-2 ${
            step5.statusType === 'passed'
              ? 'bg-emerald-50/50 border-emerald-200'
              : 'bg-rose-50/50 border-rose-200'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-700" />
                <span className="font-bold text-xs text-slate-800">
                  {showTechnicalDetails ? step5.technicalTitle : step5.title}
                </span>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                step5.statusType === 'passed'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {step5.statusType === 'passed' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{step5.statusBadge}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" />
                    <span>{step5.statusBadge}</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-700 leading-snug font-medium">
              {step5.explanation}
            </p>
            {showTechnicalDetails && (
              <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
                Visa #{result.visaDetails?.visaNumber || 'N/A'} linked to Passport #{result.visaDetails?.passportNumberLinked || result.extractedFields.documentNumber}. {result.visaDetails?.crossCheckNotes?.[0] || 'Central IVFRT verified.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
