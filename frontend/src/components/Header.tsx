'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, MapPin, Award, Globe, Shield, Wifi } from 'lucide-react';

export default function Header() {
  const [time, setTime] = useState<string>('');
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(1); // 0=A-, 1=A, 2=A+
  const [language, setLanguage] = useState<'EN' | 'HI'>('EN');

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
    <header className="sticky top-0 z-40 shadow-md">
      {/* 1. Official GIGW (Guidelines for Indian Government Websites) Top Bar */}
      <div className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-700 px-3 sm:px-6 py-1">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Left: Country & Ministry Identification */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="flex items-center gap-1.5 font-semibold text-slate-900">
              <span className="w-3.5 h-2.5 inline-block tiranga-stripe rounded-[1px] border border-slate-300 shadow-xs"></span>
              <span>भारत सरकार</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="font-normal text-slate-700">Government of India</span>
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline text-slate-600 font-medium">
              गृह मंत्रालय | Ministry of Home Affairs
            </span>
          </div>

          {/* Right: GIGW Accessibility & Language Tools */}
          <div className="flex items-center gap-3">
            {/* Font Size Adjuster */}
            <div className="flex items-center gap-0.5 border-r border-slate-300 pr-2.5">
              <button
                onClick={() => setFontSizeLevel(0)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition ${
                  fontSizeLevel === 0 ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-600'
                }`}
                title="Decrease Font Size"
              >
                A-
              </button>
              <button
                onClick={() => setFontSizeLevel(1)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                  fontSizeLevel === 1 ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-600'
                }`}
                title="Normal Font Size"
              >
                A
              </button>
              <button
                onClick={() => setFontSizeLevel(2)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition ${
                  fontSizeLevel === 2 ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-600'
                }`}
                title="Increase Font Size"
              >
                A+
              </button>
            </div>

            {/* Bilingual Toggle */}
            <button
              onClick={() => setLanguage(language === 'EN' ? 'HI' : 'EN')}
              className="font-bold text-amber-700 hover:text-amber-800 transition flex items-center gap-1 cursor-pointer"
              title="Toggle Language"
            >
              <Globe className="w-3 h-3 text-amber-600" />
              <span>{language === 'EN' ? 'हिन्दी' : 'English'}</span>
            </button>

            <span className="text-slate-300 hidden sm:inline">•</span>

            {/* Official NIC Cloud Gateway indicator */}
            <div className="hidden sm:flex items-center gap-1 text-emerald-700 font-semibold text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>NIC Cloud Gateway • gov.in</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Official Deep Ashoka Navy Primary Header */}
      <div className="bg-gradient-to-r from-[#0a2540] via-[#0d3156] to-[#0a2540] text-white px-3 sm:px-6 py-3 border-b border-[#0f3b66]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Lion Capital & Portal Title */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Ashoka Lion Capital Insignia */}
            <div className="w-11 h-13 sm:w-12 sm:h-14 bg-white/10 border border-amber-400/40 rounded-lg p-1 flex flex-col items-center justify-center text-center shrink-0 shadow-sm backdrop-blur-xs">
              <span className="text-[8px] sm:text-[9px] font-black text-amber-300 tracking-tighter uppercase leading-none">
                सत्यमेव
              </span>
              <span className="text-[8px] sm:text-[9px] font-black text-amber-300 tracking-tighter uppercase leading-none">
                जयते
              </span>
              <div className="w-5 sm:w-6 h-0.5 bg-amber-400 my-0.5"></div>
              <span className="text-[7px] text-slate-200 font-bold uppercase tracking-wider">
                MHA-SSB
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider text-amber-400 uppercase">
                  सशस्त्र सीमा बल (SSB)
                </span>
                <span className="text-slate-300 hidden sm:inline text-xs">|</span>
                <span className="text-[10px] text-slate-200 hidden sm:inline font-semibold">
                  MINISTRY OF HOME AFFAIRS
                </span>
                <span className="text-[9px] bg-blue-900/80 text-blue-200 px-1.5 py-0.2 rounded border border-blue-600/50 font-semibold">
                  Official GovTech
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>SSB DRISHTI</span>
                <span className="text-xs font-normal text-amber-300/90 hidden sm:inline font-mono">
                  (AI-Powered Fake Identity & Document Screening System)
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-300 flex items-center gap-1.5">
                <span>Problem Statement SIH26188</span>
                <span>•</span>
                <span className="text-sky-300">ICAO Doc 9303 & ISO/IEC 19794-5 Certified Engine</span>
              </p>
            </div>
          </div>

          {/* Right: Station Status & Clock */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-white/10 border border-white/20 px-3 py-1.5 rounded-xl text-right backdrop-blur-xs">
              <div className="text-[10px] text-slate-300">
                Terminal: <span className="text-white font-mono font-bold">Raxaul-CP-04</span>
              </div>
              <div className="text-[10px] font-bold text-amber-300">
                Officer: Insp. R. Sharma (SSB)
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-end pl-2 border-l border-white/20">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Border Online</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-200 font-mono mt-0.5">
                <Clock className="w-3 h-3 text-slate-300" />
                <span>{time || '19:30:00 IST'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. National Tricolor Accent Ribbon */}
      <div className="h-1 w-full tiranga-stripe shadow-xs"></div>

      {/* 4. Border Checkpoint Sub-bar */}
      <div className="bg-[#071d33] px-3 sm:px-6 py-1.5 text-xs text-slate-300 border-b border-[#0b2846]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-medium">
            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Outpost: <strong className="text-white">Raxaul Land Border (Indo-Nepal Checkpoint)</strong></span>
            <span className="text-slate-400 hidden sm:inline">• Post ID: SSB-RX-04</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="text-slate-300">Encrypted Local Edge Node</span>
            </span>
            <span>•</span>
            <span>Watchlist Sync: <strong className="text-emerald-400 font-mono">14,289 Records OK</strong></span>
          </div>
        </div>
      </div>
    </header>
  );
}

