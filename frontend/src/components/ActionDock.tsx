'use client';

import React, { useState } from 'react';
import { VerificationResult } from '../lib/types';
import { generateOfficialDossierPdf } from '../lib/pdfGenerator';
import { Check, AlertTriangle, ShieldAlert, FileDown, CheckCircle2 } from 'lucide-react';

interface Props {
  result: VerificationResult;
}

export default function ActionDock({ result }: Props) {
  const [cleared, setCleared] = useState<boolean>(false);

  const handleApprove = () => {
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  const handleExportPdf = () => {
    generateOfficialDossierPdf(result);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium hidden sm:flex items-center gap-1.5">
          {cleared ? (
            <span className="text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Transit Authorization Code #TX-89412 Issued
            </span>
          ) : (
            <span>Decision Audit Trail Logged to SSB Local Node</span>
          )}
        </div>

        <div className="w-full sm:w-auto flex items-center justify-end gap-2">
          <button
            onClick={handleExportPdf}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Export Official</span>
            <span>Dossier (PDF)</span>
          </button>

          <button
            onClick={() => alert('Passenger flagged and transferred to Secondary Inspection Officer.')}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Secondary Review</span>
          </button>

          {result.verdict === 'DETAIN' ? (
            <button
              onClick={() => alert('CRITICAL ALERT: Officer initiated detention protocol. Security gate locked.')}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5 transition animate-pulse cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>DETAIN TRAVELER</span>
            </button>
          ) : (
            <button
              onClick={handleApprove}
              className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer ${
                cleared ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{cleared ? 'CLEARED' : 'APPROVE & CLEAR TRANSIT'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
