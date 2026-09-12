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
    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            SIH Evaluation Test Scenarios
          </span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Custom</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SCENARIO_PRESETS.map((preset) => {
          const isActive = preset.id === activePresetId;
          const isClear = preset.data.riskLevel === 'LOW';
          const isMedium = preset.data.riskLevel === 'MEDIUM';

          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`text-left p-2.5 rounded-lg border text-xs transition relative flex flex-col justify-between cursor-pointer ${
                isActive
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/20'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                {isClear ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : isMedium ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : (
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isClear
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : isMedium
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {preset.data.verdict}
                </span>
              </div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                {preset.title.split('(')[0]}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {preset.badge}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
