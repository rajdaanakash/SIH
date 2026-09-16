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

  const handleDetain = () => {
    const reasons = result.securityAlertMessages && result.securityAlertMessages.length > 0
      ? result.securityAlertMessages.join('\n• ')
      : result.executiveSummary;
    alert(`🚨 CRITICAL SECURITY ALERT: DETENTION PROTOCOL ENGAGED\n\n• ${reasons}\n\nOutpost turnstiles locked. Interrogation officer notified.`);
  };

  const handleExportPdf = () => {
    if (result.isTerminalBlank) {
      alert('Terminal is in blank standby state. Ingest traveler credentials before exporting dossier.');
      return;
    }
    generateOfficialDossierPdf(result);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-md border-t border-slate-300 px-3 py-2 sm:px-6 sm:py-2.5 shadow-xl">
      <div className="max-w-6xl mx-auto">
        {/* --- MOBILE LAYOUT (Clean 2-tier stacked bar) --- */}
        <div className="sm:hidden flex flex-col gap-1.5">
          {/* Row 1: 3 Equal-Width Secondary Action Buttons */}
          <div className="grid grid-cols-3 gap-1.5 w-full">
            {onResetTerminal && (
              <button
                onClick={onResetTerminal}
                className="py-1.5 px-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-300 flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer"
                title="Reset for next passenger"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#0A2540] shrink-0" />
                <span>Next</span>
              </button>
            )}

            <button
              onClick={handleExportPdf}
              className="py-1.5 px-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-[#0A2540] border border-slate-300 flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer"
              title="Export Official PDF Dossier"
            >
              <FileDown className="w-3.5 h-3.5 text-[#0A2540] shrink-0" />
              <span>Dossier</span>
            </button>

            <button
              onClick={() => alert('Passenger transferred to Secondary Inspection Officer for manual interrogation.')}
              className="py-1.5 px-1 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-300 flex items-center justify-center gap-1 transition cursor-pointer"
              title="Flag for secondary interview"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Review</span>
            </button>
          </div>

          {/* Row 2: Full-Width Prominent Primary Action */}
          <div>
            {result.isTerminalBlank || result.verdict === 'UNDETERMINED' ? (
              <div className="w-full py-2.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center gap-2 select-none">
                <span>STANDBY: AWAITING PASSENGER SCAN</span>
              </div>
            ) : result.verdict === 'DETAIN' ? (
              <button
                onClick={handleDetain}
                className="w-full py-2.5 rounded-lg text-xs font-black bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white shadow-sm flex items-center justify-center gap-2 transition animate-pulse cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>DETAIN TRAVELER</span>
              </button>
            ) : result.verdict === 'SECONDARY_INSPECTION' ? (
              <button
                onClick={() => alert('Traveler transferred to Secondary Inspection Counter for manual physical interrogation.')}
                className="w-full py-2.5 rounded-lg text-xs font-black bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>TRANSFER TO SECONDARY INSPECTION</span>
              </button>
            ) : (
              <button
                onClick={handleApprove}
                className={`w-full py-2.5 rounded-lg text-xs font-black text-white shadow-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                  cleared
                    ? 'bg-emerald-800 ring-2 ring-emerald-400'
                    : 'bg-[#047857] hover:bg-[#065f46] active:bg-[#034d37]'
                }`}
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{cleared ? 'TRANSIT APPROVED ✓' : 'APPROVE & CLEAR TRANSIT'}</span>
              </button>
            )}
          </div>
        </div>

        {/* --- DESKTOP LAYOUT (Horizontal Flex Bar) --- */}
        <div className="hidden sm:flex items-center justify-between gap-3">
          <div className="text-xs text-slate-700 font-medium flex items-center gap-2">
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

          <div className="flex items-center justify-end gap-2">
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

            <button
              onClick={handleExportPdf}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-[#0A2540] border border-[#0A2540]/30 flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs"
            >
              <FileDown className="w-3.5 h-3.5 text-[#0A2540]" />
              <span className="hidden sm:inline">Export</span>
              <span>Dossier (PDF)</span>
            </button>

            <button
              onClick={() => alert('Passenger transferred to Secondary Inspection Officer for manual interrogation.')}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Secondary Review</span>
            </button>

            {result.isTerminalBlank || result.verdict === 'UNDETERMINED' ? (
              <div className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 flex items-center gap-1.5 shrink-0 select-none">
                <span>STANDBY: AWAITING PASSENGER SCAN</span>
              </div>
            ) : result.verdict === 'DETAIN' ? (
              <button
                onClick={handleDetain}
                className="px-4 py-2 rounded-lg text-xs font-black bg-rose-700 hover:bg-rose-800 text-white shadow-sm flex items-center gap-1.5 transition animate-pulse cursor-pointer shrink-0"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>DETAIN TRAVELER</span>
              </button>
            ) : result.verdict === 'SECONDARY_INSPECTION' ? (
              <button
                onClick={() => alert('Traveler transferred to Secondary Inspection Counter for manual physical interrogation.')}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>TRANSFER TO SECONDARY</span>
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
    </div>
  );
}
