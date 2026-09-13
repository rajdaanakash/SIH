'use client';

import React, { useRef, useState } from 'react';
import { SCENARIO_PRESETS } from '../lib/presets';
import { ScenarioPreset, VerificationResult } from '../lib/types';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Sparkles, 
  BookOpen, 
  FileCheck2, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Clock,
  Globe2
} from 'lucide-react';

interface Props {
  activePresetId: string;
  onSelectPreset: (preset: ScenarioPreset) => void;
  onCustomUpload: (passportFile: File, visaFile?: File) => void;
  onAttachVisa?: (visaFile: File) => void;
  currentResult: VerificationResult;
  hasUploadedPassport?: boolean;
  hasUploadedVisa?: boolean;
  activeFocusModule?: string | null;
  onSelectFocusModule?: (module: 'PASSPORT' | 'TEXT' | 'PHOTO' | 'VISA' | null) => void;
}

export default function ScenarioSelector({
  activePresetId,
  onSelectPreset,
  onCustomUpload,
  onAttachVisa,
  currentResult,
  hasUploadedPassport = false,
  hasUploadedVisa = false,
  activeFocusModule = null,
  onSelectFocusModule,
}: Props) {
  const passportInputRef = useRef<HTMLInputElement>(null);
  const visaInputRef = useRef<HTMLInputElement>(null);
  const dualInputRef = useRef<HTMLInputElement>(null);

  const [pendingPassport, setPendingPassport] = useState<File | null>(null);
  const [showDemoPresets, setShowDemoPresets] = useState<boolean>(false);

  const { 
    isTerminalBlank, 
    isIndianNational, 
    requiresVisa, 
    hasVisa, 
    extractedFields, 
    tamperDetails, 
    icaoDetails, 
    biometricDetails, 
    visaDetails 
  } = currentResult;

  const handlePassportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPendingPassport(file);
      onCustomUpload(file);
    }
  };

  const handleVisaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const visaFile = e.target.files[0];
      if (onAttachVisa && hasUploadedPassport) {
        onAttachVisa(visaFile);
      } else if (pendingPassport) {
        onCustomUpload(pendingPassport, visaFile);
      } else {
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

  // Card 1: Document & Citizenship Integrity
  const card1IsWrongType = !isTerminalBlank && currentResult.isWrongDocumentType;
  const card1IsDummy = !isTerminalBlank && currentResult.isDummySpecimen;
  const card1IsClear = !isTerminalBlank && (isIndianNational || !tamperDetails.photoReplacementDetected) && !card1IsWrongType && !card1IsDummy;
  const card1Title = isTerminalBlank 
    ? 'Valid Indian Passport' 
    : card1IsDummy
    ? 'Dummy Specimen Template'
    : card1IsWrongType
    ? 'Visa Sticker in Passport Slot'
    : isIndianNational 
    ? 'Valid Indian Passport' 
    : `Foreign Passport (${extractedFields.nationality || 'INTL'})`;
  const card1Badge = isTerminalBlank 
    ? 'READY' 
    : card1IsDummy
    ? 'DETAIN'
    : card1IsWrongType
    ? 'DETAIN'
    : isIndianNational 
    ? 'CLEAR' 
    : 'FOREIGN ID';
  const card1Subtitle = isTerminalBlank 
    ? 'Awaiting Document Scan' 
    : card1IsDummy
    ? `FRAUD (Dummy Specimen ${extractedFields.documentNumber || 'A1234567'})`
    : card1IsWrongType
    ? 'INVALID (Passport Booklet Required)'
    : isIndianNational 
    ? 'CLEAR (Indian Citizen • Visa Exempt)' 
    : `FOREIGN NATIONAL (${extractedFields.nationality || 'INTL'})`;

  // Card 2: Text & Expiry Date Integrity
  const card2IsExpired = !isTerminalBlank && currentResult.isExpired;
  const card2IsIcaoFailed = !isTerminalBlank && (currentResult.icaoChecksumFailed || !icaoDetails.overallIcaoCompliant);
  const card2IsVizMismatch = !isTerminalBlank && currentResult.vizMrzMismatch;
  const card2IsForged = !isTerminalBlank && (tamperDetails.textManipulationDetected || card2IsExpired || card2IsIcaoFailed || card2IsVizMismatch);
  const card2Title = isTerminalBlank
    ? 'Text & Expiry Integrity'
    : card2IsExpired
    ? 'Document Expired'
    : card2IsIcaoFailed
    ? 'ICAO Checksum Forgery'
    : card2IsVizMismatch
    ? 'VIZ vs MRZ Contradiction'
    : card2IsForged 
    ? 'Text-Forged Expiry Date' 
    : 'Text & Expiry Integrity';
  const card2Badge = isTerminalBlank 
    ? 'READY' 
    : card2IsForged 
    ? 'DETAIN' 
    : 'CLEAR';
  const card2Subtitle = isTerminalBlank 
    ? 'OCR & Checksum Engine' 
    : card2IsExpired
    ? `EXPIRED (${extractedFields.expiryDate || 'Past Date'})`
    : card2IsIcaoFailed
    ? 'FORGERY (ICAO Checksum Fail)'
    : card2IsVizMismatch
    ? 'DATA CONTRADICTION (DOB Differ)'
    : card2IsForged 
    ? 'FORGERY (Checksum Fail)' 
    : 'AUTHENTIC (Checksums Passed)';

  // Card 3: Photo & Biometric Forensics
  const card3IsImposter = !isTerminalBlank && (tamperDetails.photoReplacementDetected || (biometricDetails.similarityScore > 0 && !biometricDetails.faceMatched));
  const card3Title = card3IsImposter 
    ? 'Photo-Replaced Impersonation' 
    : 'Photo & Substrate Integrity';
  const card3Badge = isTerminalBlank 
    ? 'READY' 
    : card3IsImposter 
    ? 'DETAIN' 
    : 'CLEAR';
  const card3Subtitle = isTerminalBlank 
    ? 'ELA Heatmap & Biometrics' 
    : tamperDetails.photoReplacementDetected 
    ? 'IMPERSONATION (Seam Detected)' 
    : card3IsImposter 
    ? 'IMPERSONATION (Face Mismatch)' 
    : 'AUTHENTIC (No Seam Anomaly)';

  // Card 4: Visa & Entry Authorization
  const card4IsIndian = isIndianNational;
  const card4NeedsVisa = requiresVisa && !hasVisa;
  const card4IsDuplicate = !isTerminalBlank && currentResult.isDuplicateDocument;
  const card4IsInvalidJurisdiction = !isTerminalBlank && currentResult.isInvalidJurisdiction;
  const card4HasStampAnomaly = hasVisa && tamperDetails.stampForgeryDetected;
  const card4HasMismatch = hasVisa && visaDetails && !visaDetails.overallCrossCheckPassed;
  
  let card4Title = 'Visa & Entry Authorization';
  let card4Badge = 'READY';
  let card4Subtitle = 'Cross-Reconciliation Check';

  if (!isTerminalBlank) {
    if (card4IsDuplicate) {
      card4Title = 'Duplicate Specimen Fraud';
      card4Badge = 'DETAIN';
      card4Subtitle = 'FRAUD (Identical Upload)';
    } else if (card4IsInvalidJurisdiction) {
      card4Title = 'Foreign Jurisdiction Visa';
      card4Badge = 'DETAIN';
      card4Subtitle = 'REJECTED (US Visa at Indian Border)';
    } else if (card4IsIndian) {
      card4Title = 'Visa Requirement: Exempt';
      card4Badge = 'EXEMPT';
      card4Subtitle = 'CLEAR (Indian Citizen)';
    } else if (card4NeedsVisa) {
      card4Title = 'Indian Entry Visa Required';
      card4Badge = 'ACTION NEEDED';
      card4Subtitle = 'MANDATORY (Upload Visa)';
    } else if (card4HasStampAnomaly) {
      card4Title = 'Irregular Visa Entry Stamp';
      card4Badge = 'SECONDARY_INSPECTION';
      card4Subtitle = 'REVIEW (Stamp Anomaly)';
    } else if (card4HasMismatch) {
      card4Title = 'Visa Cross-Check Mismatch';
      card4Badge = 'DETAIN';
      card4Subtitle = 'MISMATCH (Credentials Differ)';
    } else if (hasVisa) {
      card4Title = 'Visa Cross-Reconciled';
      card4Badge = 'CLEAR';
      card4Subtitle = 'VERIFIED (IVFRT Matched)';
    }
  }

  return (
    <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200 space-y-3.5">
      {/* Top Header & Dual Upload Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#0A2540]" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block truncate">
              Autonomous Border Credential Ingestion
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              Upload passport: Indian citizens are Visa-Exempt; Foreign travelers automatically prompt for Visa cross-check
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

      {/* 4 Combined Verification Status Cards (Interactive • Zero-Reload Navigation) */}
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
            <span>Autonomous Combined Inspection Results (4 Pillars):</span>
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            Unified Single-Pass Analysis • Instant Tab Focus
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Card 1: Document & Citizenship Integrity */}
          <button
            type="button"
            onClick={() => onSelectFocusModule?.(activeFocusModule === 'PASSPORT' ? null : 'PASSPORT')}
            className={`text-left p-2.5 sm:p-3 rounded-xl border text-xs transition relative flex flex-col justify-between cursor-pointer ${
              activeFocusModule === 'PASSPORT'
                ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500 shadow-xs'
                : isTerminalBlank
                ? 'bg-slate-50/70 border-slate-200 text-slate-600 hover:border-slate-300'
                : isIndianNational
                ? 'bg-emerald-50/40 border-emerald-300 text-emerald-950 hover:bg-emerald-50/70'
                : 'bg-blue-50/40 border-blue-300 text-blue-950 hover:bg-blue-50/70'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              {card1IsClear ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : isTerminalBlank ? (
                <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
              )}
              <span
                className={`text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  card1IsClear
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : isTerminalBlank
                    ? 'bg-slate-200 text-slate-700 border border-slate-300'
                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}
              >
                {card1Badge}
              </span>
            </div>
            <div className="font-black text-slate-900 truncate text-[11px] sm:text-[11.5px]">
              {card1Title}
            </div>
            <div className="text-[9.5px] sm:text-[10px] text-slate-600 font-medium truncate mt-0.5">
              {card1Subtitle}
            </div>
          </button>

          {/* Card 2: Text-Forged Expiry Date Check */}
          <button
            type="button"
            onClick={() => onSelectFocusModule?.(activeFocusModule === 'TEXT' ? null : 'TEXT')}
            className={`text-left p-2.5 sm:p-3 rounded-xl border text-xs transition relative flex flex-col justify-between cursor-pointer ${
              activeFocusModule === 'TEXT'
                ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500 shadow-xs'
                : card2IsForged
                ? 'bg-rose-50/70 border-rose-400 text-rose-950 hover:bg-rose-100/70'
                : isTerminalBlank
                ? 'bg-slate-50/70 border-slate-200 text-slate-600 hover:border-slate-300'
                : 'bg-emerald-50/40 border-emerald-300 text-emerald-950 hover:bg-emerald-50/70'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              {card2IsForged ? (
                <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
              ) : isTerminalBlank ? (
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              )}
              <span
                className={`text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  card2IsForged
                    ? 'bg-rose-100 text-rose-900 border border-rose-300'
                    : isTerminalBlank
                    ? 'bg-slate-200 text-slate-700 border border-slate-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                {card2Badge}
              </span>
            </div>
            <div className="font-black text-slate-900 truncate text-[11px] sm:text-[11.5px]">
              {card2Title}
            </div>
            <div className="text-[9.5px] sm:text-[10px] text-slate-600 font-medium truncate mt-0.5">
              {card2Subtitle}
            </div>
          </button>

          {/* Card 3: Photo-Replaced Impersonation Check */}
          <button
            type="button"
            onClick={() => onSelectFocusModule?.(activeFocusModule === 'PHOTO' ? null : 'PHOTO')}
            className={`text-left p-2.5 sm:p-3 rounded-xl border text-xs transition relative flex flex-col justify-between cursor-pointer ${
              activeFocusModule === 'PHOTO'
                ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500 shadow-xs'
                : card3IsImposter
                ? 'bg-rose-50/70 border-rose-400 text-rose-950 hover:bg-rose-100/70'
                : isTerminalBlank
                ? 'bg-slate-50/70 border-slate-200 text-slate-600 hover:border-slate-300'
                : 'bg-emerald-50/40 border-emerald-300 text-emerald-950 hover:bg-emerald-50/70'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              {card3IsImposter ? (
                <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
              ) : isTerminalBlank ? (
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              )}
              <span
                className={`text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  card3IsImposter
                    ? 'bg-rose-100 text-rose-900 border border-rose-300'
                    : isTerminalBlank
                    ? 'bg-slate-200 text-slate-700 border border-slate-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                {card3Badge}
              </span>
            </div>
            <div className="font-black text-slate-900 truncate text-[11px] sm:text-[11.5px]">
              {card3Title}
            </div>
            <div className="text-[9.5px] sm:text-[10px] text-slate-600 font-medium truncate mt-0.5">
              {card3Subtitle}
            </div>
          </button>

          {/* Card 4: Visa & Entry Authorization Check */}
          <button
            type="button"
            onClick={() => {
              if (card4NeedsVisa) {
                visaInputRef.current?.click();
              } else {
                onSelectFocusModule?.(activeFocusModule === 'VISA' ? null : 'VISA');
              }
            }}
            className={`text-left p-2.5 sm:p-3 rounded-xl border text-xs transition relative flex flex-col justify-between cursor-pointer ${
              activeFocusModule === 'VISA'
                ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500 shadow-xs'
                : card4NeedsVisa
                ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400 text-amber-950 animate-pulse'
                : card4HasStampAnomaly || card4HasMismatch
                ? 'bg-amber-50/70 border-amber-400 text-amber-950 hover:bg-amber-100/70'
                : isTerminalBlank
                ? 'bg-slate-50/70 border-slate-200 text-slate-600 hover:border-slate-300'
                : 'bg-emerald-50/40 border-emerald-300 text-emerald-950 hover:bg-emerald-50/70'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              {card4NeedsVisa ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : card4HasStampAnomaly || card4HasMismatch ? (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              ) : isTerminalBlank ? (
                <FileCheck2 className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              )}
              <span
                className={`text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  card4NeedsVisa
                    ? 'bg-amber-200 text-amber-950 border border-amber-400'
                    : card4HasStampAnomaly || card4HasMismatch
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : isTerminalBlank
                    ? 'bg-slate-200 text-slate-700 border border-slate-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                {card4Badge}
              </span>
            </div>
            <div className="font-black text-slate-900 truncate text-[11px] sm:text-[11.5px]">
              {card4Title}
            </div>
            <div className="text-[9.5px] sm:text-[10px] text-slate-600 font-medium truncate mt-0.5">
              {card4Subtitle}
            </div>
          </button>
        </div>
      </div>

      {/* Immediate Notification: Foreign Passport Detected -> Direct Visa Upload Action */}
      {card4NeedsVisa && (
        <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-950 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-800" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-xs text-amber-950 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                <span>FOREIGN PASSPORT DETECTED ({extractedFields.nationality || 'FOREIGN NATIONAL'})</span>
                <span className="text-[9.5px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                  VISA MANDATORY
                </span>
              </div>
              <p className="text-[11.5px] text-amber-800 mt-0.5 leading-relaxed">
                Passenger <strong>{extractedFields.fullName}</strong> is traveling on a foreign passport (#{extractedFields.documentNumber}). In accordance with Indian Immigration Bureau protocols, an official Indian Entry Visa / Transit Permit is required for clearance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => visaInputRef.current?.click()}
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition shrink-0"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Upload Passenger Visa</span>
          </button>
        </div>
      )}

      {/* Reassuring Indian Citizen Status Banner */}
      {!isTerminalBlank && isIndianNational && (
        <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-300 text-emerald-950 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="truncate">
              <strong>Indian Citizen Verified ({extractedFields.fullName} • #{extractedFields.documentNumber}):</strong> Entry Visa is <strong>exempt</strong> under national sovereignty regulations.
            </span>
          </div>
          <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 uppercase tracking-wider shrink-0">
            VISA EXEMPT
          </span>
        </div>
      )}

      {/* Ingestion Slots (Step 1: Passport, Step 2: Visa) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                {hasUploadedPassport 
                  ? `Active: ${extractedFields.fullName} (${extractedFields.documentNumber})`
                  : 'Click to select or drag & drop Passport photo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-[11px] font-bold px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs shrink-0"
          >
            {hasUploadedPassport || pendingPassport ? 'Replace' : 'Upload'}
          </button>
        </div>

        {/* Slot 2: Visa Endorsement */}
        <div
          onClick={() => {
            if (isIndianNational) {
              alert('Notice: Passenger is an Indian citizen. Indian nationals do not require an entry visa.');
            } else {
              visaInputRef.current?.click();
            }
          }}
          className={`p-3 rounded-xl border-2 border-dashed flex items-center justify-between gap-3 transition ${
            isIndianNational
              ? 'border-slate-200 bg-slate-100/70 opacity-80 cursor-not-allowed'
              : card4NeedsVisa
              ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-400 cursor-pointer'
              : hasUploadedVisa
              ? 'border-emerald-500 bg-emerald-50/50 cursor-pointer'
              : 'border-slate-300 bg-slate-50/50 cursor-pointer hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              isIndianNational
                ? 'bg-slate-200 text-slate-600 border-slate-300'
                : card4NeedsVisa
                ? 'bg-amber-200 text-amber-900 border-amber-300'
                : 'bg-emerald-100 text-emerald-900 border-emerald-200'
            }`}>
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-900 truncate">2. Visa Endorsement</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  isIndianNational
                    ? 'bg-slate-200 text-slate-700'
                    : card4NeedsVisa
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {isIndianNational ? 'Exempt' : card4NeedsVisa ? 'Required' : 'Cross-Check'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {isIndianNational 
                  ? 'Exempt for Indian nationals (Not required)'
                  : hasUploadedVisa 
                  ? 'Visa loaded & cross-checked' 
                  : 'Mandatory for foreign passports: click to upload'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isIndianNational}
            className={`text-[11px] font-bold px-2.5 py-1 rounded border shadow-2xs shrink-0 ${
              isIndianNational
                ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            {isIndianNational ? 'Exempt' : hasUploadedVisa ? 'Replace' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Discrete Collapsible Section for Demo Benchmark Profiles */}
      <div className="pt-1 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setShowDemoPresets(!showDemoPresets)}
          className="w-full flex items-center justify-between text-slate-500 hover:text-slate-800 py-1 text-[10.5px] font-bold uppercase tracking-wider cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Evaluation Benchmarks (Demo Simulation Cases)</span>
          </span>
          <span className="flex items-center gap-1 text-slate-400 font-normal">
            <span>{showDemoPresets ? 'Hide Demos' : 'Show 4 Test Cases'}</span>
            {showDemoPresets ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {showDemoPresets && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mt-2 animate-in fade-in">
            {SCENARIO_PRESETS.map((preset) => {
              const isActive = preset.id === activePresetId;
              const isClear = preset.data.riskLevel === 'LOW';
              const isMedium = preset.data.riskLevel === 'MEDIUM';

              return (
                <button
                  key={preset.id}
                  onClick={() => onSelectPreset(preset)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition relative flex flex-col justify-between cursor-pointer ${
                    isActive
                      ? 'bg-blue-50/90 border-blue-600 text-blue-950 shadow-xs ring-1 ring-blue-500'
                      : 'bg-[#fafafa] hover:bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    {isClear ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    ) : isMedium ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    ) : (
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                    )}
                    <span
                      className={`text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
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
                  <div className="font-bold text-slate-900 truncate text-[11px]">
                    {preset.title.split('(')[0].trim()}
                  </div>
                  <div className="text-[9px] text-slate-500 font-medium truncate mt-0.5">
                    {preset.badge}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
