'use client';

import React, { useState } from 'react';
import { VerificationResult } from '../lib/types';
import { Camera, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  result: VerificationResult;
}

export default function BiometricMatcher({ result }: Props) {
  const { biometricDetails } = result;
  const [liveMode, setLiveMode] = useState<boolean>(false);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Biometric Comparison (1:1 Face Verification)
          </span>
          <span className="text-[10px] text-slate-500 block">Cosine Similarity & Liveness Anti-Spoofing</span>
        </div>
        <button
          onClick={() => setLiveMode(!liveMode)}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>{liveMode ? 'Show Preset' : 'Toggle Live Camera'}</span>
        </button>
      </div>

      <div className="flex items-center justify-around gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-slate-300 dark:border-slate-600 shadow-xs bg-slate-200 flex items-center justify-center">
            <img src={result.documentFaceUrl} alt="Doc Photo" className="w-full h-full object-cover" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1.5 uppercase">
            Document Photo
          </span>
        </div>

        <div className="flex flex-col items-center px-2">
          <div className="text-xs font-extrabold font-mono text-slate-800 dark:text-slate-200">
            {biometricDetails.similarityScore}%
          </div>
          <div className="w-16 sm:w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full my-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                biometricDetails.faceMatched ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${biometricDetails.similarityScore}%` }}
            />
          </div>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              biometricDetails.faceMatched
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
            }`}
          >
            {biometricDetails.faceMatched ? 'MATCHED' : 'MISMATCH'}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 shadow-xs bg-slate-200 flex items-center justify-center relative ${
            biometricDetails.faceMatched ? 'border-emerald-500 ring-2 ring-emerald-400/20' : 'border-rose-500 ring-2 ring-rose-400/20'
          }`}>
            <img src={result.liveTravelerPhotoUrl} alt="Live Selfie" className="w-full h-full object-cover" />
            <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1.5 uppercase flex items-center gap-1">
            <span>Live Traveler</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </span>
        </div>
      </div>
    </div>
  );
}
