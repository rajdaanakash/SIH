'use client';

import React, { useState } from 'react';
import Header from '../components/Header';
import ScenarioSelector from '../components/ScenarioSelector';
import DocumentViewer from '../components/DocumentViewer';
import VerificationChecklist from '../components/VerificationChecklist';
import BiometricMatcher from '../components/BiometricMatcher';
import RiskMeter from '../components/RiskMeter';
import ActionDock from '../components/ActionDock';
import AiReviewCard from '../components/AiReviewCard';
import { SCENARIO_PRESETS } from '../lib/presets';
import { ScenarioPreset, VerificationResult } from '../lib/types';
import { computeClientEla } from '../lib/elaEngine';
import { compressAndResizeImage } from '../lib/imageUtils';
import { validateUploadPayload } from '../lib/dateUtils';
import {
  createCleanSession,
  evaluateScreeningCase,
  updateBiometricsWithInvariant,
  INITIAL_CLEAN_RESULT,
  STAGE_1_DETAIN_FLOOR,
  SECONDARY_INSPECTION_FLOOR,
} from '../lib/screeningEngine';
import { ShieldCheck, RefreshCw, Smartphone, AlertCircle, AlertOctagon, Sparkles, RotateCcw, SlidersHorizontal } from 'lucide-react';

const BLANK_TERMINAL_RESULT: VerificationResult = INITIAL_CLEAN_RESULT;

export default function Home() {
  const [activePreset, setActivePreset] = useState<ScenarioPreset | null>(null);
  const [currentResult, setCurrentResult] = useState<VerificationResult>(BLANK_TERMINAL_RESULT);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [scanStatusText, setScanStatusText] = useState<string>('Analyzing document telemetry...');
  const [activeFocusModule, setActiveFocusModule] = useState<'PASSPORT' | 'TEXT' | 'PHOTO' | 'VISA' | null>(null);
  const [invalidDocAlert, setInvalidDocAlert] = useState<{
    detectedType: string;
    reason: string;
  } | null>(null);

  const handleResetTerminal = () => {
    setActivePreset(null);
    setActiveFocusModule(null);
    setInvalidDocAlert(null);
    setCurrentResult(createCleanSession());
  };

  const handleSelectPreset = (preset: ScenarioPreset) => {
    setActivePreset(preset);
    setActiveFocusModule(null);
    setCurrentResult(preset.data);
  };

  const handleDualUpload = async (passportFile: File, visaFile?: File) => {
    setIsScanning(true);
    setInvalidDocAlert(null);
    setActivePreset(null);
    setScanStatusText(
      visaFile
        ? 'Autonomous Pipeline: Ingesting & Cross-Reconciling Passport + Visa...'
        : 'Autonomous Pipeline: Running complete AI forensic & biometric screening...'
    );

    try {
      // 0. File Upload Payload Hardening (Reject >15MB or non-image MIME)
      const pCheck = validateUploadPayload(passportFile);
      if (!pCheck.valid) {
        setInvalidDocAlert({
          detectedType: 'PAYLOAD_REJECTED',
          reason: pCheck.error || 'Invalid primary document file.',
        });
        setIsScanning(false);
        return;
      }
      if (visaFile) {
        const vCheck = validateUploadPayload(visaFile);
        if (!vCheck.valid) {
          setInvalidDocAlert({
            detectedType: 'PAYLOAD_REJECTED',
            reason: vCheck.error || 'Invalid visa specimen file.',
          });
          setIsScanning(false);
          return;
        }
      }

      // 1. Convert and compress Passport
      const passportRawBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(passportFile);
      });
      const passportBase64Url = await compressAndResizeImage(passportRawBase64, 2048, 0.94);

      // 2. Convert and compress Visa (if provided)
      let visaBase64Url: string | undefined = undefined;
      if (visaFile) {
        const visaRawBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(visaFile);
        });
        visaBase64Url = await compressAndResizeImage(visaRawBase64, 2048, 0.94);
      }

      // 3. Compute client ELA for heatmap layer on passport
      let elaScore = 0.12;
      try {
        const img = new Image();
        img.src = passportBase64Url;
        await new Promise((resolve) => {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
        });
        const elaResult = await computeClientEla(img);
        elaScore = elaResult.anomalyScore;
      } catch (err) {
        console.warn('ELA computation notice:', err);
      }

      // 4. Call AI Vision endpoint (Stage 2) with offline resilience
      let aiData: any = null;
      try {
        const res = await fetch('/api/ai-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: passportBase64Url,
            visaImageBase64: visaBase64Url,
            documentType: 'PASSPORT',
          }),
        });
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          if (json && json.data) {
            aiData = json.data;
          }
        } catch {
          console.warn('AI review non-JSON reply.');
        }
      } catch (err) {
        console.warn('AI review network failure; falling back to offline edge engine:', err);
      }

      // 5. Pre-validation check: Is document an identity/travel document?
      if (aiData && aiData.isValidIdentityDocument === false) {
        setInvalidDocAlert({
          detectedType: aiData.detectedDocType || 'NON_IDENTITY_DOCUMENT',
          reason: aiData.rejectionReason || 'Uploaded file is a marksheet, certificate, or non-identity document.',
        });
        setIsScanning(false);
        return;
      }

      // 6. Execute deterministic screening pipeline
      const evaluated = await evaluateScreeningCase({
        passportPayload: passportBase64Url,
        visaPayload: visaBase64Url,
        passportFile,
        visaFile,
        aiData,
        elaScore,
        offlineMode: typeof navigator !== 'undefined' && !navigator.onLine,
      });

      setCurrentResult(evaluated);
    } catch (error: any) {
      console.error('Autonomous screening failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAttachVisa = async (visaFile: File) => {
    if (!currentResult.documentImageUrl || currentResult.isTerminalBlank) {
      alert('Please upload the primary passport first.');
      return;
    }

    setIsScanning(true);
    setScanStatusText('Autonomous Cross-Reconciliation: Ingesting & Verifying Entry Visa...');

    try {
      const vCheck = validateUploadPayload(visaFile);
      if (!vCheck.valid) {
        setInvalidDocAlert({
          detectedType: 'PAYLOAD_REJECTED',
          reason: vCheck.error || 'Invalid visa format or size.',
        });
        setIsScanning(false);
        return;
      }

      const visaRawBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(visaFile);
      });
      const visaBase64Url = await compressAndResizeImage(visaRawBase64, 2048, 0.94);

      let aiData: any = null;
      try {
        const res = await fetch('/api/ai-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: currentResult.documentImageUrl,
            visaImageBase64: visaBase64Url,
            documentType: 'PASSPORT',
          }),
        });
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          if (json && json.data) {
            aiData = json.data;
          }
        } catch {}
      } catch (err) {
        console.warn('AI review error during visa attach:', err);
      }

      const evaluated = await evaluateScreeningCase({
        passportPayload: currentResult.documentImageUrl,
        visaPayload: visaBase64Url,
        visaFile,
        extractedFields: currentResult.extractedFields,
        aiData,
        elaScore: currentResult.tamperDetails.elaAnomalyScore,
        offlineMode: typeof navigator !== 'undefined' && !navigator.onLine,
      });

      setCurrentResult((prev) => {
        // Invariant: If previously compromised, never upgrade or lower risk
        if (prev.isAlreadyCompromised || prev.verdict === 'DETAIN') {
          return {
            ...evaluated,
            isAlreadyCompromised: true,
            verdict: 'DETAIN',
            riskScore: Math.max(prev.riskScore, evaluated.riskScore, 95),
            documentImageUrl: prev.documentImageUrl,
            visaImageUrl: visaBase64Url,
          };
        }
        return {
          ...evaluated,
          riskScore: Math.max(prev.riskScore, evaluated.riskScore),
          documentImageUrl: prev.documentImageUrl,
          visaImageUrl: visaBase64Url,
        };
      });
    } catch (err) {
      console.error('Failed to attach Visa:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpdateBiometrics = (bioUpdate: {
    faceMatched: boolean;
    similarityScore: number;
    livePhotoUrl: string;
    observations?: string[];
  }) => {
    setCurrentResult((prev) => updateBiometricsWithInvariant(prev, bioUpdate));
  };

  const handleApplyAiResult = (aiData: any) => {
    if (!aiData) return;
    setCurrentResult((prev) => {
      const qrDetails = aiData.qrDetails || prev.qrDetails;
      const pixelForensics = aiData.pixelForensics || prev.pixelForensics;

      // QR Cryptographic Fraud / Data Mismatch locks to DETAIN
      const isQrFraud = qrDetails?.status === 'SIGNATURE_INVALID' || qrDetails?.status === 'DATA_MISMATCH';
      if (isQrFraud) {
        return {
          ...prev,
          aiAuditData: aiData,
          qrDetails,
          pixelForensics,
          isAlreadyCompromised: true,
          verdict: 'DETAIN',
          riskScore: Math.max(prev.riskScore, STAGE_1_DETAIN_FLOOR),
        };
      }

      // If already compromised, AI review CANNOT upgrade or lower risk
      if (prev.isAlreadyCompromised || prev.verdict === 'DETAIN' || prev.verdict === 'SECONDARY_INSPECTION') {
        const isDetain = prev.verdict === 'DETAIN' || prev.riskScore >= STAGE_1_DETAIN_FLOOR;
        return {
          ...prev,
          aiAuditData: aiData,
          qrDetails,
          pixelForensics,
          isAlreadyCompromised: true,
          verdict: isDetain ? 'DETAIN' : 'SECONDARY_INSPECTION',
          riskScore: isDetain
            ? Math.max(prev.riskScore, STAGE_1_DETAIN_FLOOR)
            : Math.max(prev.riskScore, SECONDARY_INSPECTION_FLOOR),
        };
      }

      // If AI review flagged secondary inspection, physical anomaly, or low-quality QR
      const isQrReview = qrDetails?.status === 'QR_IMAGE_QUALITY_INSUFFICIENT' || qrDetails?.status === 'QR_PARSE_FAILED';
      if (
        isQrReview ||
        aiData.recommendedAction === 'SECONDARY_INSPECTION' ||
        aiData.tamperDetected === true ||
        aiData.tamperSeverity === 'MEDIUM' ||
        aiData.tamperSeverity === 'HIGH'
      ) {
        return {
          ...prev,
          aiAuditData: aiData,
          qrDetails,
          pixelForensics,
          isAlreadyCompromised: true,
          verdict: 'SECONDARY_INSPECTION',
          riskScore: Math.max(prev.riskScore, SECONDARY_INSPECTION_FLOOR),
        };
      }

      return {
        ...prev,
        aiAuditData: aiData,
        qrDetails,
        pixelForensics,
      };
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased">
      {/* Official Government Header */}
      <Header />

      {/* Main Responsive Dashboard Container (National Portal Standard) */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-36 sm:pb-28">
        {/* Official MHA Security Classification Banner */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-extrabold text-[9.5px] sm:text-[10px] uppercase tracking-wider shrink-0">
              RESTRICTED
            </span>
            <span className="font-semibold text-slate-700 text-[11px] sm:text-xs truncate">
              <span className="sm:hidden">MHA Immigration Screening Console</span>
              <span className="hidden sm:inline">MHA Border Security Operations Console • Authorized Immigration Terminal</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowTechnicalDetails((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                showTechnicalDetails
                  ? 'bg-[#0A2540] text-white border-[#0A2540] shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
              title="Toggle between Officer Plain View and Supervisor Technical Details"
            >
              <SlidersHorizontal className="w-3 h-3 text-current" />
              <span>{showTechnicalDetails ? 'Hide Technical Details' : 'Show Technical Details'}</span>
            </button>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              Session Active: <strong className="text-slate-700 font-mono">SEC-SSB-2026</strong>
            </span>
            <button
              onClick={handleResetTerminal}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition cursor-pointer shrink-0"
              title="Reset terminal for next traveler"
            >
              <RotateCcw className="w-3 h-3 text-blue-700" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* 1. Evaluation Scenario Selector */}
        <ScenarioSelector
          activePresetId={activePreset?.id || ''}
          onSelectPreset={handleSelectPreset}
          onCustomUpload={handleDualUpload}
          onAttachVisa={handleAttachVisa}
          currentResult={currentResult}
          hasUploadedPassport={!currentResult.isTerminalBlank && Boolean(currentResult.documentImageUrl)}
          hasUploadedVisa={Boolean(currentResult.hasVisa && currentResult.visaImageUrl)}
          activeFocusModule={activeFocusModule}
          onSelectFocusModule={setActiveFocusModule}
        />

        {/* Invalid Document Pre-Validation Modal Alert */}
        {invalidDocAlert && (
          <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-500 text-slate-900 space-y-2 shadow-xs animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertOctagon className="w-5 h-5" />
                <span>INVALID DOCUMENT REJECTED</span>
              </div>
              <button
                onClick={() => setInvalidDocAlert(null)}
                className="px-3 py-1 rounded bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 cursor-pointer transition"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              {invalidDocAlert.reason}
            </p>
            <div className="text-[11px] text-slate-600 pt-1 border-t border-rose-200">
              ⚠️ <b>Security Notice:</b> SSB Drishti only processes Passports, Visas, Aadhaar, or National IDs. Academic marksheets, certificates, bills, and non-identity papers are rejected at gatekeeping.
            </div>
          </div>
        )}

        {/* Loading / Diagnostic Scanner Banner */}
        {isScanning && (
          <div className="p-3.5 rounded-xl bg-[#0A2540] text-white flex items-center gap-3 shadow-md border border-blue-900 animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin shrink-0 text-blue-300" />
            <div className="text-xs">
              <span className="font-bold block">Autonomous Document Ingestion in Progress</span>
              <span className="opacity-90">{scanStatusText}</span>
            </div>
          </div>
        )}

        {/* 2. Interactive Document Bio-Page Viewer */}
        <DocumentViewer result={currentResult} showTechnicalDetails={showTechnicalDetails} />

        {/* 3. Multimodal AI Forensic Audit Card (Gemini 3.6 Flash) */}
        <AiReviewCard
          result={currentResult}
          showTechnicalDetails={showTechnicalDetails}
          onApplyAiResult={handleApplyAiResult}
        />

        {/* 4. Automated 4-Module Screening Protocol */}
        <VerificationChecklist result={currentResult} showTechnicalDetails={showTechnicalDetails} />

        {/* 5. Biometric 1:1 Facial Matcher */}
        <BiometricMatcher
          result={currentResult}
          showTechnicalDetails={showTechnicalDetails}
          onUpdateBiometrics={handleUpdateBiometrics}
        />

        {/* 6. Threat Risk Meter & Assessment Gauge */}
        <RiskMeter
          score={currentResult.riskScore}
          level={currentResult.riskLevel}
          summary={currentResult.executiveSummary}
          qrDetails={currentResult.qrDetails}
          pixelForensics={currentResult.pixelForensics}
          showTechnicalDetails={showTechnicalDetails}
        />
      </main>

      {/* Sticky Quick-Action Dock with Next Passenger Reset */}
      <ActionDock
        result={currentResult}
        showTechnicalDetails={showTechnicalDetails}
        onResetTerminal={handleResetTerminal}
      />
    </div>
  );
}
