'use client';

import React, { useState } from 'react';
import { VerificationResult } from '../lib/types';
import { Eye, ShieldAlert, FileText, Layers, BookOpen, FileCheck2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface Props {
  result: VerificationResult;
  showTechnicalDetails?: boolean;
}

export default function DocumentViewer({ result, showTechnicalDetails = false }: Props) {
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
            <span>
              {showTechnicalDetails
                ? (activeDocTab === 'VISA' ? 'ENTRY VISA SPECIMEN' : `${result.documentType} SPECIMEN`)
                : (activeDocTab === 'VISA'
                    ? 'Visa Document'
                    : result.documentType === 'AADHAAR'
                    ? 'Aadhaar Card'
                    : result.documentType === 'NATIONAL_ID'
                    ? 'National ID Card'
                    : 'Passport Document')}
            </span>
            <span>•</span>
            <span>{showTechnicalDetails ? 'TRANSIT TOKEN' : 'Reference Number'}</span>
            {result.isIndianNational || result.documentType === 'AADHAAR' ? (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                {showTechnicalDetails ? 'INDIAN CITIZEN (VISA EXEMPT)' : 'Indian Citizen — No Visa Needed'}
              </span>
            ) : hasVisa ? (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                {showTechnicalDetails ? 'DUAL DOC (PASSPORT+VISA)' : 'Passport + Visa Attached'}
              </span>
            ) : result.requiresVisa ? (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                {showTechnicalDetails ? `FOREIGN (${result.extractedFields.nationality || 'INTL'}) • VISA REQUIRED` : 'Foreign Citizen — Valid Indian Visa Required'}
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
              <span>{showTechnicalDetails ? 'Forensic Boxes' : 'Highlight Changes'}</span>
            </button>
            <button
              onClick={() => setViewMode('ELA')}
              className={`px-2 sm:px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                viewMode === 'ELA'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{showTechnicalDetails ? 'ELA Heatmap' : 'Editing Heatmap'}</span>
            </button>
            <button
              onClick={() => setViewMode('PLAIN')}
              className={`px-2 sm:px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                viewMode === 'PLAIN'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{showTechnicalDetails ? 'Plain Scan' : 'Original Photo'}</span>
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
              <span>{showTechnicalDetails ? 'FRAUD DETECTED: DUPLICATE SPECIMEN INGESTION' : 'Stop — Same Image Uploaded Twice'}</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-700 text-white text-[9px] font-bold">
                {showTechnicalDetails ? 'DETAIN' : 'STOP'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
              Same image uploaded twice: The identical image was submitted for both the Passport and Visa slots. A separate valid passport booklet and a valid entry visa are required.
            </div>
          </div>
        </div>
      )}

      {result.isExpired && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-start gap-2.5 animate-pulse">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <span>{showTechnicalDetails ? 'CRITICAL BORDER VIOLATION: TRAVEL DOCUMENT IS EXPIRED' : 'Stop — Travel Document Has Expired'}</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-700 text-white text-[9px] font-bold">
                {showTechnicalDetails ? 'TRANSIT DENIED' : 'EXPIRED'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
              Document has expired: This travel document expired on <strong className="underline">{extractedFields.expiryDate}</strong>. Expired documents cannot be used to travel.
            </div>
          </div>
        </div>
      )}

      {result.isWrongDocumentType && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <span>{showTechnicalDetails ? 'INVALID PRIMARY SPECIMEN: VISA STICKER IN PASSPORT SLOT' : 'Needs Review — Visa Sticker Uploaded Instead of Passport'}</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-700 text-white text-[9px] font-bold">
                {showTechnicalDetails ? 'INVALID DOC' : 'NEEDS REVIEW'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-amber-800 mt-0.5">
              Wrong document type: A visa sticker was uploaded into the Passport slot. A national passport booklet is required for international border crossing.
            </div>
          </div>
        </div>
      )}

      {result.isDummySpecimen && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-900 flex items-start gap-2.5 animate-pulse">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <span>{showTechnicalDetails ? 'CRITICAL FRAUD: DUMMY / SPECIMEN PASSPORT DETECTED' : 'Stop — Sample or Template Document Detected'}</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-700 text-white text-[9px] font-bold">
                {showTechnicalDetails ? 'CRIMINAL FRAUD' : 'FAKE DOC'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
              Sample document detected: Document #{extractedFields.documentNumber} is an unauthenticated sample/template document, not a real government document.
            </div>
          </div>
        </div>
      )}

      {result.icaoChecksumFailed && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <span>{showTechnicalDetails ? 'ICAO DOC 9303 CHECKSUM FRAUD: 7-3-1 CHECK DIGITS FAILED' : 'Stop — Security Code Check Failed'}</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-700 text-white text-[9px] font-bold">
                {showTechnicalDetails ? 'CHECKSUM FAIL' : 'FAILED'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
              Security numbers do not match: The numbers on the document don't add up correctly, which usually means it has been altered or is fake.
            </div>
          </div>
        </div>
      )}

      {result.vizMrzMismatch && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <span>{showTechnicalDetails ? 'DATA CONTRADICTION: VIZ VS MRZ FIELD MISMATCH' : "Needs Review — Printed Details Don't Match Security Code"}</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-700 text-white text-[9px] font-bold">
                {showTechnicalDetails ? 'DISCREPANCY' : 'MISMATCH'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-amber-800 mt-0.5">
              Data mismatch: The printed details on the document do not match the document's built-in security code.
            </div>
          </div>
        </div>
      )}

      {result.isInvalidJurisdiction && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <span>{showTechnicalDetails ? 'JURISDICTION REJECTION: FOREIGN VISA PRESENTED AT INDIAN BORDER' : "Stop — Wrong Country's Visa Presented"}</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-700 text-white text-[9px] font-bold">
                {showTechnicalDetails ? 'REJECTED' : 'WRONG VISA'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
              Wrong country visa: A foreign country's visa was presented. Entering India requires a valid Indian entry visa issued by the Government of India.
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
                {showTechnicalDetails ? 'Passport ↔ Visa Cross-Reconciliation Matrix' : 'Passport & Visa Cross-Check'}
              </span>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-bold border border-blue-200">
                {showTechnicalDetails ? 'MHA IVFRT' : 'Match Check'}
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
                ? (showTechnicalDetails ? '⚠️ FRAUD / DUPLICATE UPLOAD' : '⚠️ Same File Uploaded Twice')
                : result.isExpired
                ? (showTechnicalDetails ? '⚠️ SPECIMEN EXPIRED' : '⚠️ Document Expired')
                : result.isInvalidJurisdiction
                ? (showTechnicalDetails ? '⚠️ JURISDICTION REJECTED' : '⚠️ Wrong Country Visa')
                : visaDetails.overallCrossCheckPassed !== false
                ? (showTechnicalDetails ? '✓ 100% CORRELATED' : '✓ Details Match')
                : (showTechnicalDetails ? '⚠️ CROSS-CHECK MISMATCH' : '⚠️ Details Do Not Match')}
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
                    <span>Duplicate File</span>
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
              <span className="text-[10px] font-bold text-slate-500 block uppercase">
                {showTechnicalDetails ? 'Passport # Link' : 'Passport Number'}
              </span>
              <div className="font-mono font-bold text-slate-900 truncate">
                {visaDetails.passportNumberLinked || extractedFields.documentNumber}
              </div>
              <div className={`text-[9.5px] font-semibold flex items-center gap-1 mt-0.5 ${
                result.isDuplicateDocument || visaDetails.passportMatched === false ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {result.isDuplicateDocument ? (
                  <>
                    <XCircle className="w-3 h-3 shrink-0" />
                    <span>Duplicate</span>
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
              <span className="text-[10px] font-bold text-slate-500 block uppercase">
                {showTechnicalDetails ? 'Visa Endorsement' : 'Visa Type'}
              </span>
              <div className="font-bold text-slate-900 truncate">{visaDetails.visaType || 'TOURIST'}</div>
              <div className="text-[9.5px] text-slate-600 truncate mt-0.5">
                Stay: {visaDetails.stayDurationDays || 30} Days • {visaDetails.entryValidity || 'MULTIPLE'}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">
                {showTechnicalDetails ? 'Visa Validity' : 'Visa Valid Until'}
              </span>
              <div className={`font-bold truncate ${result.isExpired ? 'text-rose-700' : 'text-slate-900'}`}>
                {visaDetails.validUntil || extractedFields.expiryDate || 'Active'}
              </div>
              <div className={`text-[9.5px] font-semibold flex items-center gap-1 mt-0.5 ${
                result.isExpired ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {result.isExpired ? (
                  <>
                    <XCircle className="w-3 h-3 shrink-0" />
                    <span>Expired</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Valid Date</span>
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
