'use client';

import React from 'react';
import { RiskLevel } from '../lib/types';
import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

interface Props {
  score: number;
  level: RiskLevel;
  summary: string;
}

export default function RiskMeter({ score, level, summary }: Props) {
  const isLow = level === 'LOW';
  const isMedium = level === 'MEDIUM';

  const barColor = isLow ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-rose-600';
  const textColor = isLow
    ? 'text-emerald-700 dark:text-emerald-400'
    : isMedium
    ? 'text-amber-700 dark:text-amber-400'
    : 'text-rose-700 dark:text-rose-400';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Composite Threat Risk Index
        </span>
        <div className="flex items-center gap-1.5">
          {isLow ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          ) : isMedium ? (
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          )}
          <span className={`text-xs font-black uppercase ${textColor}`}>
            {isLow ? 'LOW RISK (CLEARED)' : isMedium ? 'MEDIUM RISK (SECONDARY)' : 'HIGH RISK (CRITICAL THREAT)'}
          </span>
        </div>
      </div>

      <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.max(5, score)}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="font-mono text-slate-500">Risk Score: <strong className="text-slate-900 dark:text-white font-bold">{score} / 100</strong></span>
        <span className="text-slate-500 line-clamp-1 max-w-[240px] sm:max-w-none">{summary}</span>
      </div>
    </div>
  );
}
