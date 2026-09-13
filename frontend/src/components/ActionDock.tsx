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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-md border-t border-slate-300 p-2.5 sm:p-3 shadow-lg">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-xs text-slate-700 font-medium hidden sm:flex items-center gap-2">
          {cleared ? (
            <span className="text-emerald-800 font-bold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Transit Cleared • Authorization #TX-89412 Issued
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Audit Trail Cryptographically Logged to SSB Local Border Node</span>
            </span>
          )}
        </div>

        <div className="w-full sm:w-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {/* Next Passenger / Reset Button */}
          {onResetTerminal && (
            <button
              onClick={onResetTerminal}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs"
              title="Reset form for next passenger"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#0A2540]" />
              <span>Next Passenger</span>
            </button>
          )}

          {/* Export PDF Dossier */}
          <button
            onClick={handleExportPdf}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-[#0A2540] border border-[#0A2540]/30 flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs"
          >
            <FileDown className="w-3.5 h-3.5 text-[#0A2540]" />
            <span className="hidden sm:inline">Export</span>
            <span>Dossier (PDF)</span>
          </button>

          {/* Secondary Review */}
          <button
            onClick={() => alert('Passenger transferred to Secondary Inspection Officer for manual interrogation.')}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>Secondary Review</span>
          </button>

          {/* Approve or Detain Button */}
          {result.verdict === 'DETAIN' ? (
            <button
              onClick={() => alert('CRITICAL ALERT: Detention protocol engaged. Outpost turnstiles locked.')}
              className="px-4 py-2 rounded-lg text-xs font-black bg-rose-700 hover:bg-rose-800 text-white shadow-sm flex items-center gap-1.5 transition animate-pulse cursor-pointer shrink-0"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>DETAIN TRAVELER</span>
            </button>
          ) : (
            <button
              onClick={handleApprove}
              className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                cleared ? 'bg-emerald-800 ring-2 ring-emerald-400' : 'bg-emerald-700 hover:bg-emerald-800'
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
