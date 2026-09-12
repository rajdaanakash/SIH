'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Radio, Clock, MapPin, Award } from 'lucide-react';

export default function Header() {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#0f2942] text-white shadow-md border-b border-[#1e3a8a]">
      {/* Top Ministry Banner */}
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold tracking-wider text-amber-400 uppercase">
                सशस्त्र सीमा बल
              </h1>
              <span className="text-xs text-slate-300 hidden sm:inline">|</span>
              <span className="text-xs text-slate-300 font-semibold hidden sm:inline">
                MINISTRY OF HOME AFFAIRS
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
              SSB DRISHTI <span className="text-xs font-normal text-sky-300 ml-1">v2.4 (Border Guard AI)</span>
            </h2>
          </div>
        </div>

        {/* Status Badge & Clock */}
        <div className="flex flex-col items-end gap-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Edge Node Active</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{time || '19:30:00 IST'}</span>
          </div>
        </div>
      </div>

      {/* Outpost Sub-Bar */}
      <div className="bg-[#0b1e32] px-4 py-1.5 border-t border-[#1a3754] text-xs text-slate-300">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Outpost: <strong className="text-white">Raxaul (Indo-Nepal Border)</strong></span>
            <span className="hidden sm:inline text-slate-400">• Post ID: SSB-RX-04</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Officer ID: <span className="font-mono text-white">SSB-7412</span>
          </div>
        </div>
      </div>
    </header>
  );
}
