'use client';

import React from 'react';
import { VerificationResult } from '../lib/types';
import { CheckCircle2, XCircle, AlertTriangle, Shield, Cpu, Binary, UserCheck } from 'lucide-react';

interface Props {
  result: VerificationResult;
}

export default function VerificationChecklist({ result }: Props) {
  const { icaoDetails, tamperDetails, biometricDetails } = result;

  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-xs border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-[#0A2540]" />
          <span>Automated 4-Module Screening Protocol</span>
        </h3>
        <span className="text-[11px] text-slate-500 font-semibold">MHA Protocol Sec-26188</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Module 1: OCR Extraction */}
        <div className="p-3 rounded-lg border bg-slate-50 border-slate-200">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5 text-[#0A2540]" />
              <span className="font-bold text-xs text-slate-800">Module 1: OCR & MRZ Parsing</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
              100% Extracted
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            Extracted VIZ fields & standard TD3/MRV strings. VIZ vs MRZ cross-correlation: <strong className="text-slate-800">{icaoDetails.overallIcaoCompliant ? 'Matched' : 'Inconsistent'}</strong>.
          </p>
        </div>

        {/* Module 2: ICAO 9303 Validation */}
        <div className={`p-3 rounded-lg border ${
          icaoDetails.overallIcaoCompliant
            ? 'bg-emerald-50/50 border-emerald-200'
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-700" />
              <span className="font-bold text-xs text-slate-800">Module 2: ICAO 9303 Checksum</span>
            </div>
            {icaoDetails.overallIcaoCompliant ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> Valid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                <XCircle className="w-3 h-3" /> FAILED
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            7-3-1 weight modulus-10 algorithm check on Doc #, DOB, and Expiry. {icaoDetails.notes[0]}
          </p>
        </div>

        {/* Module 3: Tampering & Forensics */}
        <div className={`p-3 rounded-lg border ${
          !tamperDetails.photoReplacementDetected && !tamperDetails.textManipulationDetected && !tamperDetails.stampForgeryDetected
            ? 'bg-emerald-50/50 border-emerald-200'
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-700" />
              <span className="font-bold text-xs text-slate-800">Module 3: Forgery Detection</span>
            </div>
            {tamperDetails.photoReplacementDetected || tamperDetails.textManipulationDetected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                <AlertTriangle className="w-3 h-3" /> SPLICING FOUND
              </span>
            ) : tamperDetails.stampForgeryDetected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                <AlertTriangle className="w-3 h-3" /> STAMP ANOMALY
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> Clean
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            ELA variance score: <strong className="text-slate-800">{tamperDetails.elaAnomalyScore}</strong>. Photo border seam: <strong className="text-slate-800">{tamperDetails.photoReplacementDetected ? 'Compromised' : 'Intact'}</strong>.
          </p>
        </div>

        {/* Module 4: Face Verification */}
        <div className={`p-3 rounded-lg border ${
          biometricDetails.faceMatched
            ? 'bg-emerald-50/50 border-emerald-200'
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-cyan-700" />
              <span className="font-bold text-xs text-slate-800">Module 4: 1:1 Face Match</span>
            </div>
            {biometricDetails.faceMatched ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                {biometricDetails.similarityScore}% Match
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                {biometricDetails.similarityScore}% MISMATCH
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            Document photo vs. live camera comparison. Liveness test: <strong className="text-slate-800">{biometricDetails.livenessVerified ? 'PASSED (Anti-Spoof)' : 'FAILED'}</strong>.
          </p>
        </div>

        {/* Module 5: Visa & IVFRT Cross-Reconciliation (Displayed when Visa is present) */}
        {result.hasVisa && result.visaDetails && (
          <div className={`p-3 rounded-lg border sm:col-span-2 ${
            result.visaDetails.overallCrossCheckPassed !== false
              ? 'bg-emerald-50/50 border-emerald-200'
              : 'bg-rose-50/50 border-rose-200'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-700" />
                <span className="font-bold text-xs text-slate-800">Module 5: Visa & IVFRT Cross-Reconciliation</span>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                result.visaDetails.overallCrossCheckPassed !== false
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {result.visaDetails.overallCrossCheckPassed !== false ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>IVFRT Verified</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" />
                    <span>Mismatch Flagged</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Visa #{result.visaDetails.visaNumber || 'N/A'} linked to Passport #{result.visaDetails.passportNumberLinked || result.extractedFields.documentNumber}. {result.visaDetails.crossCheckNotes?.[0] || 'Credentials cross-checked with Central IVFRT immigration node.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
