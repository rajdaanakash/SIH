'use client';

import React from 'react';
import { RiskLevel, VerificationResult } from '../lib/types';
import { getPlainVerdict } from '../lib/plainLanguage';
import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

interface Props {
  score: number;
  level: RiskLevel;
  summary: string;
  qrDetails?: any;
  pixelForensics?: any;
  result?: VerificationResult;
  showTechnicalDetails?: boolean;
}

export default function RiskMeter({
  score,
  level,
  summary,
  qrDetails,
  pixelForensics,
  result,
  showTechnicalDetails = false,
}: Props) {
  const isLow = level === 'LOW';
  const isMedium = level === 'MEDIUM';

  const barColor = isLow ? 'bg-emerald-600' : isMedium ? 'bg-amber-500' : 'bg-rose-600';
  const badgeStyle = isLow
    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
    : isMedium
    ? 'bg-amber-50 text-amber-900 border-amber-300'
    : 'bg-rose-50 text-rose-900 border-rose-300';

  // Plain-language verdict info if result is passed
  const plainInfo = result
    ? getPlainVerdict(result)
    : {
        label: isLow
          ? 'Approve — Clear to Enter'
          : isMedium
          ? 'Needs a Closer Look — Send to Secondary'
          : 'Stop — Do Not Allow Entry',
        oneLineReason: summary || (isLow ? 'All security checks passed.' : 'Security review required.'),
        badgeClass: badgeStyle,
      };

  return (
    <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <span>{showTechnicalDetails ? 'Composite Threat Risk Index' : 'Overall Result'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
            {showTechnicalDetails ? 'MHA Standard' : 'Officer Guidance'}
          </span>
        </span>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-black uppercase ${plainInfo.badgeClass}`}>
          {isLow ? (
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : isMedium ? (
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
          )}
          <span>
            {showTechnicalDetails
              ? (isLow ? 'LOW RISK (CLEARED)' : isMedium ? 'MEDIUM RISK (SECONDARY)' : 'HIGH RISK (CRITICAL THREAT)')
              : plainInfo.label}
          </span>
        </div>
      </div>

      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.max(5, score)}%` }}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
        <span className="text-slate-700 font-medium leading-relaxed">
          {plainInfo.oneLineReason}
        </span>
        {showTechnicalDetails && (
          <span className="font-mono text-slate-900 font-bold shrink-0 text-right">
            Risk Score: <strong className="text-slate-900">{score} / 100</strong>
          </span>
        )}
      </div>

      {/* Discrete Forensic Hardware Signals (Audit View Only) */}
      {showTechnicalDetails && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[10px]">
          <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 border border-slate-200">
            <span className="font-semibold text-slate-600">Aadhaar QR Crypto:</span>
            <span className={`font-black ${
              qrDetails?.status === 'VERIFIED'
                ? 'text-emerald-700'
                : qrDetails?.status === 'SIGNATURE_INVALID' || qrDetails?.status === 'DATA_MISMATCH'
                ? 'text-rose-700'
                : 'text-slate-500'
            }`}>
              {qrDetails?.status || 'NOT SCANNED'}
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 border border-slate-200">
            <span className="font-semibold text-slate-600">Pixel Forensics (CV):</span>
            <span className={`font-black ${
              pixelForensics?.forensicVerdict === 'TAMPERED'
                ? 'text-rose-700'
                : pixelForensics?.forensicVerdict === 'SUSPICIOUS'
                ? 'text-amber-700'
                : 'text-emerald-700'
            }`}>
              {pixelForensics?.overallTamperScore !== undefined ? `${pixelForensics.overallTamperScore}/100` : 'CALIBRATED'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
