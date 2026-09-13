'use client';

import React, { useRef } from 'react';
import { SCENARIO_PRESETS } from '../lib/presets';
import { ScenarioPreset } from '../lib/types';
import { CheckCircle2, AlertTriangle, AlertOctagon, Upload, Sparkles } from 'lucide-react';

interface Props {
  activePresetId: string;
  onSelectPreset: (preset: ScenarioPreset) => void;
  onCustomUpload: (file: File) => void;
}

export default function ScenarioSelector({ activePresetId, onSelectPreset, onCustomUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onCustomUpload(e.target.files[0]);
    }
  };

  return (
    <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200">
      <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-blue-900" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 block truncate">
              <span className="sm:hidden">Border Test Profiles</span>
              <span className="hidden sm:inline">Border Evaluation Test Scenarios (SIH Module 1)</span>
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:block truncate">
              Select an official border screening profile or upload custom travel credential
            </span>
          </div>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition cursor-pointer shadow-2xs shrink-0"
        >
          <Upload className="w-3.5 h-3.5 text-blue-800" />
          <span className="sm:hidden">Upload</span>
          <span className="hidden sm:inline">Upload Custom ID</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
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
  );
}
