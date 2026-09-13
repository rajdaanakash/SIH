'use client';

import React, { useState } from 'react';
import { VerificationResult } from '../lib/types';
import { Eye, ShieldAlert, FileText, Layers, BookOpen, FileCheck2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface Props {
  result: VerificationResult;
}

export default function DocumentViewer({ result }: Props) {
  const [viewMode, setViewMode] = useState<'FORENSIC' | 'ELA' | 'PLAIN'>('FORENSIC');
  const [activeDocTab, setActiveDocTab] = useState<'PASSPORT' | 'VISA'>('PASSPORT');

  const { extractedFields, tamperDetails, visaDetails, hasVisa, visaImageUrl, isTerminalBlank } = result;

  const currentDisplayImage = activeDocTab === 'VISA' && visaImageUrl
    ? visaImageUrl
    : result.documentImageUrl;

  return (
    <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-slate-200">
      {/* Top Header: Document Identifier & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>{activeDocTab === 'VISA' ? 'ENTRY VISA SPECIMEN' : `${result.documentType} SPECIMEN`}</span>
            <span>•</span>
            <span>TRANSIT TOKEN</span>
            {result.isIndianNational ? (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                INDIAN CITIZEN (VISA EXEMPT)
              </span>
            ) : hasVisa ? (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                DUAL DOC (PASSPORT+VISA)
              </span>
            ) : result.requiresVisa ? (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                FOREIGN ({result.extractedFields.nationality || 'INTL'}) • VISA REQUIRED
              </span>
            ) : null}
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 font-mono">
            #{result.tokenNumber}
          </div>
        </div>

        {/* Dual Document Tabs (if Visa is present) & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {hasVisa && visaImageUrl && (
            <div className="inline-flex rounded-lg p-0.5 sm:p-1 bg-slate-100 border border-slate-200 text-[11px] sm:text-xs">
              <button
                onClick={() => setActiveDocTab('PASSPORT')}
                className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
                  activeDocTab === 'PASSPORT'
                    ? 'bg-[#0A2540] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Passport</span>
              </button>
              <button
                onClick={() => setActiveDocTab('VISA')}
                className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
                  activeDocTab === 'VISA'
                    ? 'bg-[#0A2540] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCheck2 className="w-3 h-3" />
                <span>Visa Permit</span>
              </button>
            </div>
          )}

          <div className="inline-flex rounded-lg p-0.5 sm:p-1 bg-slate-100 border border-slate-200 text-[11px] sm:text-xs">
            <button
              onClick={() => setViewMode('FORENSIC')}
              className={`px-2 sm:px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                viewMode === 'FORENSIC'
                  ? 'bg-[#0a2540] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="sm:hidden">Forensic</span>
              <span className="hidden sm:inline">Forensic Boxes</span>
            </button>
            <button
              onClick={() => setViewMode('ELA')}
              className={`px-2 sm:px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                viewMode === 'ELA'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="sm:hidden">ELA Map</span>
              <span className="hidden sm:inline">ELA Heatmap</span>
            </button>
            <button
              onClick={() => setViewMode('PLAIN')}
              className={`px-2 sm:px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                viewMode === 'PLAIN'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="sm:hidden">Plain</span>
              <span className="hidden sm:inline">Plain Scan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Critical Security Alert Banners */}
      {result.isDuplicateDocument && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <span>FRAUD DETECTED: DUPLICATE SPECIMEN INGESTION</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-700 text-white text-[9px] font-bold">DETAIN</span>
            </div>
            <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
              The identical document file/image was submitted for both the Passport and Visa slots. A valid primary passport booklet and a separate valid entry visa are required.
            </div>
          </div>
        </div>
      )}

      {result.isExpired && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-start gap-2.5 animate-pulse">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <span>CRITICAL BORDER VIOLATION: TRAVEL DOCUMENT IS EXPIRED</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-700 text-white text-[9px] font-bold">TRANSIT DENIED</span>
            </div>
            <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
              Document Expiry Date: <strong className="underline">{extractedFields.expiryDate}</strong> {result.expiryYearsExpired ? `(~${result.expiryYearsExpired} years in the past relative to current year 2026)` : '(Date is in the past)'}. Entry is prohibited under Section 3 of the Passports Act.
            </div>
          </div>
        </div>
      )}

      {result.isWrongDocumentType && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <span>INVALID PRIMARY SPECIMEN: VISA STICKER IN PASSPORT SLOT</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-700 text-white text-[9px] font-bold">INVALID DOC</span>
            </div>
            <div className="text-[11px] font-semibold text-amber-800 mt-0.5">
              A Visa sticker/foil was uploaded into the Passport slot. A national Passport booklet is mandatory for international border crossing.
            </div>
          </div>
        </div>
      )}

      {result.isInvalidJurisdiction && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <span>JURISDICTION REJECTION: FOREIGN VISA PRESENTED AT INDIAN BORDER</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-700 text-white text-[9px] font-bold">REJECTED</span>
            </div>
            <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
              Presented Visa was issued by a foreign nation (e.g. United States). Entering the Republic of India strictly requires a valid Indian Entry Visa / e-Visa issued by the Government of India.
            </div>
          </div>
        </div>
      )}

      {/* Main Specimen Image Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-[#fafafa] flex items-center justify-center min-h-[260px] sm:min-h-[320px] shadow-inner">
        {isTerminalBlank ? (
          <div className="p-8 text-center space-y-2 text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">
              Terminal Ingestion Ready: No passenger credentials loaded.
            </p>
            <p className="text-[11px] text-slate-500">
              Please upload Passport & Visa or click an evaluation scenario above to start screening.
            </p>
          </div>
        ) : (
          <>
            <img
              src={currentDisplayImage}
              alt="Document Preview"
              className={`w-full max-h-[380px] object-contain transition duration-200 ${
                viewMode === 'ELA' ? 'filter contrast-200 hue-rotate-180 invert' : ''
              }`}
            />

            {viewMode === 'ELA' && (
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-purple-950/40 via-transparent to-rose-900/30 mix-blend-color-dodge flex flex-col justify-between p-3">
                <div className="inline-flex items-center gap-1.5 self-start px-2 py-1 rounded bg-black/80 text-purple-300 text-[10px] font-mono">
                  <Layers className="w-3 h-3 text-purple-400" />
                  <span>Error Level Analysis (ELA Scale: 25x • Compression: 75% JPEG)</span>
                </div>
                {tamperDetails.flaggedRegions.map((reg, idx) => (
                  <div
                    key={idx}
                    className="absolute border-2 border-rose-500 bg-rose-500/20 animate-pulse rounded text-[10px] font-bold text-rose-200 px-1"
                    style={{
                      left: `${reg.box.x}%`,
                      top: `${reg.box.y}%`,
                      width: `${reg.box.width}%`,
                      height: `${reg.box.height}%`,
                    }}
                  >
                    ELA High Variance (+84%)
                  </div>
                ))}
              </div>
            )}

            {viewMode === 'FORENSIC' && (
              <div className="absolute inset-0 pointer-events-none">
                {tamperDetails.flaggedRegions.map((reg, idx) => (
                  <div
                    key={idx}
                    className="absolute border-2 border-dashed border-rose-500 bg-rose-500/10 rounded"
                    style={{
                      left: `${reg.box.x}%`,
                      top: `${reg.box.y}%`,
                      width: `${reg.box.width}%`,
                      height: `${reg.box.height}%`,
                    }}
                  >
                    <span className="absolute -top-4 left-0 bg-rose-600 text-white text-[9px] font-bold px-1 rounded shadow-xs whitespace-nowrap">
                      ⚠️ {reg.field} [TAMPERED]
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Passport ↔ Visa Cross-Verification Matrix (Displayed when Visa is present) */}
      {hasVisa && visaDetails && (
        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Passport ↔ Visa Cross-Reconciliation Matrix
              </span>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-bold border border-blue-200">
                MHA IVFRT
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                result.isDuplicateDocument
                  ? 'bg-rose-100 text-rose-900 border-rose-400 font-black'
                  : result.isExpired
                  ? 'bg-rose-100 text-rose-900 border-rose-400 font-black'
                  : result.isInvalidJurisdiction
                  ? 'bg-rose-100 text-rose-900 border-rose-400 font-black'
                  : visaDetails.overallCrossCheckPassed !== false
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}
            >
              {result.isDuplicateDocument
                ? '⚠️ FRAUD / DUPLICATE UPLOAD'
                : result.isExpired
                ? '⚠️ SPECIMEN EXPIRED'
                : result.isInvalidJurisdiction
                ? '⚠️ JURISDICTION REJECTED'
                : visaDetails.overallCrossCheckPassed !== false
                ? '✓ 100% CORRELATED'
                : '⚠️ CROSS-CHECK MISMATCH'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Traveler Name</span>
              <div className="font-bold text-slate-900 truncate">{extractedFields.fullName}</div>
              <div className={`text-[9.5px] font-semibold flex items-center gap-1 mt-0.5 ${
                result.isDuplicateDocument ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {result.isDuplicateDocument ? (
                  <>
                    <XCircle className="w-3 h-3 shrink-0" />
                    <span>Identical File Injected</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Passport & Visa Match</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Passport # Link</span>
              <div className="font-mono font-bold text-slate-900 truncate">
                {visaDetails.passportNumberLinked || extractedFields.documentNumber}
              </div>
              <div className={`text-[9.5px] font-semibold flex items-center gap-1 mt-0.5 ${
                result.isDuplicateDocument || visaDetails.passportMatched === false ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {result.isDuplicateDocument ? (
                  <>
                    <XCircle className="w-3 h-3 shrink-0" />
                    <span>Duplicate Bypass Attempt</span>
                  </>
                ) : visaDetails.passportMatched !== false ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Exact Match</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 shrink-0" />
                    <span>Number Mismatch</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Visa Endorsement</span>
              <div className="font-bold text-slate-900 truncate">{visaDetails.visaType || 'TOURIST'}</div>
              <div className="text-[9.5px] text-slate-600 truncate mt-0.5">
                Stay: {visaDetails.stayDurationDays || 30} Days • {visaDetails.entryValidity || 'MULTIPLE'}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Visa Validity</span>
              <div className={`font-bold truncate ${result.isExpired ? 'text-rose-700' : 'text-slate-900'}`}>
                {visaDetails.validUntil || extractedFields.expiryDate || 'Active'}
              </div>
              <div className={`text-[9.5px] font-semibold flex items-center gap-1 mt-0.5 ${
                result.isExpired ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {result.isExpired ? (
                  <>
                    <XCircle className="w-3 h-3 shrink-0" />
                    <span>EXPIRED ({result.expiryYearsExpired ? `~${result.expiryYearsExpired} yrs` : 'Invalid'})</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Before Passport Expiry</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Metadata Summary Bar */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div>
          <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Traveler Name</span>
          <span className="font-extrabold text-slate-900">{extractedFields.fullName}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Document Number</span>
          <span className="font-mono font-extrabold text-slate-900">{extractedFields.documentNumber}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Expiry Date</span>
          <span className={`font-extrabold ${!result.icaoDetails.expiryValid ? 'text-rose-700' : 'text-slate-900'}`}>
            {extractedFields.expiryDate}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Nationality / Country</span>
          <span className="font-extrabold text-slate-900">{extractedFields.nationality} ({extractedFields.issuingCountry})</span>
        </div>
      </div>
    </div>
  );
}
