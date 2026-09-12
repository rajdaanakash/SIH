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
    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Automated 4-Module Screening Protocol</span>
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">SIH26188 Compliance</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Module 1: OCR Extraction */}
        <div className="p-3 rounded-lg border bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Module 1: OCR & MRZ Parsing</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              100% Extracted
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
            Extracted VIZ fields & standard TD3/MRV strings. VIZ vs MRZ cross-correlation: {icaoDetails.overallIcaoCompliant ? 'Matched' : 'Inconsistent'}.
          </p>
        </div>

        {/* Module 2: ICAO 9303 Validation */}
        <div className={`p-3 rounded-lg border ${
          icaoDetails.overallIcaoCompliant
            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Module 2: ICAO 9303 Checksum</span>
            </div>
            {icaoDetails.overallIcaoCompliant ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> Valid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                <XCircle className="w-3 h-3" /> FAILED
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
            7-3-1 weight modulus-10 algorithm check on Doc #, DOB, and Expiry. {icaoDetails.notes[0]}
          </p>
        </div>

        {/* Module 3: Tampering & Forensics */}
        <div className={`p-3 rounded-lg border ${
          !tamperDetails.photoReplacementDetected && !tamperDetails.textManipulationDetected && !tamperDetails.stampForgeryDetected
            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Module 3: Forgery Detection</span>
            </div>
            {tamperDetails.photoReplacementDetected || tamperDetails.textManipulationDetected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-3 h-3" /> SPLICING FOUND
              </span>
            ) : tamperDetails.stampForgeryDetected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3 h-3" /> STAMP ANOMALY
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> Clean
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
            ELA variance score: <strong>{tamperDetails.elaAnomalyScore}</strong>. Photo border seam: {tamperDetails.photoReplacementDetected ? 'Compromised' : 'Intact'}.
          </p>
        </div>

        {/* Module 4: Face Verification */}
        <div className={`p-3 rounded-lg border ${
          biometricDetails.faceMatched
            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Module 4: 1:1 Face Match</span>
            </div>
            {biometricDetails.faceMatched ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {biometricDetails.similarityScore}% Match
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                {biometricDetails.similarityScore}% MISMATCH
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
            Document photo vs. live camera comparison. Liveness test: <strong>{biometricDetails.livenessVerified ? 'PASSED (Anti-Spoof)' : 'FAILED'}</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
