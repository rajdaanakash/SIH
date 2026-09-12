'use client';

import React, { useState } from 'react';
import { VerificationResult } from '../lib/types';
import { Eye, ShieldAlert, FileText, Layers } from 'lucide-react';

interface Props {
  result: VerificationResult;
}

export default function DocumentViewer({ result }: Props) {
  const [viewMode, setViewMode] = useState<'FORENSIC' | 'ELA' | 'PLAIN'>('FORENSIC');

  const { extractedFields, tamperDetails } = result;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {result.documentType} • Transit Token
          </div>
          <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono">
            #{result.tokenNumber}
          </div>
        </div>

        <div className="inline-flex rounded-lg p-1 bg-slate-100 dark:bg-slate-800 text-xs">
          <button
            onClick={() => setViewMode('FORENSIC')}
            className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
              viewMode === 'FORENSIC'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Forensic Bounding Boxes
          </button>
          <button
            onClick={() => setViewMode('ELA')}
            className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
              viewMode === 'ELA'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            ELA Tamper Heatmap
          </button>
          <button
            onClick={() => setViewMode('PLAIN')}
            className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
              viewMode === 'PLAIN'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Plain Scan
          </button>
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 flex items-center justify-center min-h-[260px] sm:min-h-[320px]">
        <img
          src={result.documentImageUrl}
          alt="Document Preview"
          className={`w-full max-h-[380px] object-contain transition duration-200 ${
            viewMode === 'ELA' ? 'filter contrast-200 hue-rotate-180 invert' : ''
          }`}
        />

        {viewMode === 'ELA' && (
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-purple-950/40 via-transparent to-rose-900/30 mix-blend-color-dodge flex flex-col justify-between p-3">
            <div className="inline-flex items-center gap-1.5 self-start px-2 py-1 rounded bg-black/80 text-purple-300 text-[10px] font-mono">
              <Layers className="w-3 h-3 text-purple-400" />
              <span>Error Level Analysis (ELA Scale: 25x • Compression: 75% JPEG)</span>
            </div>
            {tamperDetails.flaggedRegions.map((reg, idx) => (
              <div
                key={idx}
                className="absolute border-2 border-rose-500 bg-rose-500/20 animate-pulse rounded text-[10px] font-bold text-rose-200 px-1"
                style={{
                  left: `${reg.box.x}%`,
                  top: `${reg.box.y}%`,
                  width: `${reg.box.width}%`,
                  height: `${reg.box.height}%`,
                }}
              >
                ELA High Variance (+84%)
              </div>
            ))}
          </div>
        )}

        {viewMode === 'FORENSIC' && (
          <div className="absolute inset-0 pointer-events-none">
            {tamperDetails.flaggedRegions.map((reg, idx) => (
              <div
                key={idx}
                className="absolute border-2 border-dashed border-rose-500 bg-rose-500/10 rounded"
                style={{
                  left: `${reg.box.x}%`,
                  top: `${reg.box.y}%`,
                  width: `${reg.box.width}%`,
                  height: `${reg.box.height}%`,
                }}
              >
                <span className="absolute -top-4 left-0 bg-rose-600 text-white text-[9px] font-bold px-1 rounded shadow-xs whitespace-nowrap">
                  ⚠️ {reg.field} [TAMPERED]
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {extractedFields.visaType && (
        <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500 text-slate-900">
              Visa Endorsement
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {extractedFields.visaType}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] text-slate-600 dark:text-slate-300">
            <span>Stay: <b>{extractedFields.stayDurationDays || 30} Days</b></span>
            <span>Entry: <b>{extractedFields.entryValidity || 'MULTIPLE'}</b></span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              ● IVFRT Active
            </span>
          </div>
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Name</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{extractedFields.fullName}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Document #</span>
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{extractedFields.documentNumber}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Expiry Date</span>
          <span className={`font-bold ${!result.icaoDetails.expiryValid ? 'text-rose-600 font-bold' : 'text-slate-900 dark:text-slate-100'}`}>
            {extractedFields.expiryDate}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Nationality</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{extractedFields.nationality} ({extractedFields.issuingCountry})</span>
        </div>
      </div>
    </div>
  );
}
