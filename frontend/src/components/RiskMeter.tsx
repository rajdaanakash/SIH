'use client';

import React from 'react';
import { RiskLevel } from '../lib/types';
import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

interface Props {
  score: number;
  level: RiskLevel;
  summary: string;
  qrDetails?: any;
  pixelForensics?: any;
}

export default function RiskMeter({ score, level, summary, qrDetails, pixelForensics }: Props) {
  const isLow = level === 'LOW';
  const isMedium = level === 'MEDIUM';

  const barColor = isLow ? 'bg-emerald-600' : isMedium ? 'bg-amber-500' : 'bg-rose-600';
  const badgeStyle = isLow
    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
    : isMedium
    ? 'bg-amber-50 text-amber-900 border-amber-300'
    : 'bg-rose-50 text-rose-900 border-rose-300';

  return (
    <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <span>Composite Threat Risk Index</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
            MHA Standard
          </span>
        </span>
        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-black uppercase ${badgeStyle}`}>
          {isLow ? (
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
          ) : isMedium ? (
            <AlertTriangle className="w-4 h-4 text-amber-700" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-rose-700" />
          )}
          <span>
            {isLow ? 'LOW RISK (CLEARED)' : isMedium ? 'MEDIUM RISK (SECONDARY)' : 'HIGH RISK (CRITICAL THREAT)'}
          </span>
        </div>
      </div>

      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.max(5, score)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="font-mono text-slate-600">Risk Score: <strong className="text-slate-900 font-bold">{score} / 100</strong></span>
        <span className="text-slate-600 font-medium line-clamp-1 max-w-[280px] sm:max-w-none">{summary}</span>
      </div>

      {/* Discrete Forensic Hardware Signals (Directive 4) */}
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
    </div>
  );
}
