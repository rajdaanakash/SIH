'use client';

import React, { useRef, useState } from 'react';
import { SCENARIO_PRESETS } from '../lib/presets';
import { ScenarioPreset } from '../lib/types';
import { CheckCircle2, AlertTriangle, AlertOctagon, Upload, Sparkles, BookOpen, FileCheck2, Layers } from 'lucide-react';

interface Props {
  activePresetId: string;
  onSelectPreset: (preset: ScenarioPreset) => void;
  onCustomUpload: (passportFile: File, visaFile?: File) => void;
  hasUploadedPassport?: boolean;
  hasUploadedVisa?: boolean;
}

export default function ScenarioSelector({
  activePresetId,
  onSelectPreset,
  onCustomUpload,
  hasUploadedPassport = false,
  hasUploadedVisa = false,
}: Props) {
  const passportInputRef = useRef<HTMLInputElement>(null);
  const visaInputRef = useRef<HTMLInputElement>(null);
  const dualInputRef = useRef<HTMLInputElement>(null);

  const [pendingPassport, setPendingPassport] = useState<File | null>(null);

  const handlePassportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPendingPassport(file);
      // Immediately run verification with this passport
      onCustomUpload(file);
    }
  };

  const handleVisaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const visaFile = e.target.files[0];
      if (pendingPassport) {
        onCustomUpload(pendingPassport, visaFile);
      } else {
        // If no passport was selected yet, use this as primary document
        onCustomUpload(visaFile);
      }
    }
  };

  const handleDualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const pFile = e.target.files[0];
      const vFile = e.target.files[1] || undefined;
      setPendingPassport(pFile);
      onCustomUpload(pFile, vFile);
    }
  };

  return (
    <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200 space-y-3">
      {/* Top Header & Dual Upload Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#0A2540]" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block truncate">
              Immigration Document Ingestion (Passport + Visa)
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              Upload traveler Passport and Visa for automated cross-field reconciliation and tamper audit
            </span>
          </div>
        </div>

        {/* Simultaneous Dual Upload Button */}
        <button
          onClick={() => dualInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0A2540] hover:bg-[#081e35] text-white transition cursor-pointer shadow-xs shrink-0"
          title="Select both Passport and Visa files simultaneously from your device"
        >
          <Layers className="w-3.5 h-3.5 text-blue-200" />
          <span>Upload Passport + Visa (Dual)</span>
        </button>

        <input
          ref={dualInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={handleDualChange}
        />
        <input
          ref={passportInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handlePassportChange}
        />
        <input
          ref={visaInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleVisaChange}
        />
      </div>

      {/* Dual Upload Slots: Passport (Slot 1) & Visa (Slot 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Slot 1: Passport Document */}
        <div
          onClick={() => passportInputRef.current?.click()}
          className={`p-3 rounded-xl border-2 border-dashed flex items-center justify-between gap-3 cursor-pointer transition hover:bg-slate-50 ${
            hasUploadedPassport || pendingPassport
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-300 bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 border border-blue-200 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-900 truncate">1. Passport Specimen</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 uppercase">
                  Primary ID
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {pendingPassport ? `Selected: ${pendingPassport.name}` : 'Click to snap or upload Passport photo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-[11px] font-bold px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs shrink-0"
          >
            {hasUploadedPassport || pendingPassport ? 'Change' : 'Upload'}
          </button>
        </div>

        {/* Slot 2: Visa Endorsement */}
        <div
          onClick={() => visaInputRef.current?.click()}
          className={`p-3 rounded-xl border-2 border-dashed flex items-center justify-between gap-3 cursor-pointer transition hover:bg-slate-50 ${
            hasUploadedVisa
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-slate-300 bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-900 truncate">2. Visa Endorsement</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 uppercase">
                  Cross-Check
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {hasUploadedVisa ? 'Visa loaded & cross-checked' : 'Optional: Snap or upload Visa permit'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-[11px] font-bold px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs shrink-0"
          >
            {hasUploadedVisa ? 'Change' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Preset Profiles Section Header */}
      <div className="pt-2">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
          <span>Or Test With Pre-Configured Border Profiles (Evaluation Demos):</span>
          <span className="text-[9.5px] text-slate-400 font-normal">One-click live simulation</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {SCENARIO_PRESETS.map((preset) => {
            const isActive = preset.id === activePresetId;
            const isClear = preset.data.riskLevel === 'LOW';
            const isMedium = preset.data.riskLevel === 'MEDIUM';

            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                className={`text-left p-2.5 sm:p-3 rounded-xl border text-xs transition relative flex flex-col justify-between cursor-pointer ${
                  isActive
                    ? 'bg-blue-50/90 border-blue-600 text-blue-950 shadow-xs ring-1 ring-blue-500'
                    : 'bg-[#fafafa] hover:bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  {isClear ? (
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 shrink-0" />
                  ) : isMedium ? (
                    <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 shrink-0" />
                  ) : (
                    <AlertOctagon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-700 shrink-0" />
                  )}
                  <span
                    className={`text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      isClear
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : isMedium
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    {preset.data.verdict}
                  </span>
                </div>
                <div className="font-bold text-slate-900 truncate text-[11px] sm:text-[11.5px]">
                  {preset.title.split('(')[0].trim()}
                </div>
                <div className="text-[9.5px] sm:text-[10px] text-slate-500 font-medium truncate mt-0.5">
                  {preset.badge}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
