'use client';

import React, { useState } from 'react';
import { VerificationResult } from '../lib/types';
import { generateOfficialDossierPdf } from '../lib/pdfGenerator';
import { Check, AlertTriangle, ShieldAlert, FileDown, CheckCircle2, RotateCcw } from 'lucide-react';

interface Props {
  result: VerificationResult;
  onResetTerminal?: () => void;
}

export default function ActionDock({ result, onResetTerminal }: Props) {
  const [cleared, setCleared] = useState<boolean>(false);

  const handleApprove = () => {
    setCleared(true);
    setTimeout(() => setCleared(false), 5000);
  };

  const handleExportPdf = () => {
    generateOfficialDossierPdf(result);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium hidden sm:flex items-center gap-1.5">
          {cleared ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Transit Cleared • Authorization #TX-89412 Issued
            </span>
          ) : (
            <span>Audit Trail Cryptographically Logged to SSB Local Node</span>
          )}
        </div>

        <div className="w-full sm:w-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {/* Next Passenger / Reset Button */}
          {onResetTerminal && (
            <button
              onClick={onResetTerminal}
              className="px-2.5 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer shrink-0"
              title="Reset form for next passenger"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>Next Passenger</span>
            </button>
          )}

          {/* Export PDF Dossier */}
          <button
            onClick={handleExportPdf}
            className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Export</span>
            <span>Dossier (PDF)</span>
          </button>

          {/* Secondary Review */}
          <button
            onClick={() => alert('Passenger transferred to Secondary Inspection Officer for manual interrogation.')}
            className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 transition cursor-pointer shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Secondary Review</span>
          </button>

          {/* Approve or Detain Button */}
          {result.verdict === 'DETAIN' ? (
            <button
              onClick={() => alert('CRITICAL ALERT: Detention protocol engaged. Outpost turnstiles locked.')}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5 transition animate-pulse cursor-pointer shrink-0"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>DETAIN TRAVELER</span>
            </button>
          ) : (
            <button
              onClick={handleApprove}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                cleared ? 'bg-emerald-700 ring-2 ring-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{cleared ? 'APPROVED ✓' : 'APPROVE & CLEAR TRANSIT'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
