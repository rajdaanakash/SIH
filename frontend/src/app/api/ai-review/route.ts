import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { verifyAadhaarQrBridge } from '@/lib/qrBridge';

const FlaggedRegionSchema = z.object({
  field: z.string().nullish().default('General Substrate'),
  description: z.string().nullish().default('Anomaly flagged'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullish().default('MEDIUM'),
  box: z.object({
    x: z.number().nullish().default(0),
    y: z.number().nullish().default(0),
    width: z.number().nullish().default(100),
    height: z.number().nullish().default(100),
  }).nullish().default({ x: 0, y: 0, width: 100, height: 100 }),
});

const AiForensicsSchema = z.object({
  isValidIdentityDocument: z.boolean().nullish().default(true),
  detectedDocType: z.string().nullish().default('PASSPORT'),
  tamperDetected: z.boolean().nullish().default(false),
  tamperSeverity: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullish().default('LOW'),
  forensicConfidenceScore: z.number().min(0).max(100).nullish().default(85),
  anomalyDetails: z.string().nullish().default(''),
  flaggedRegions: z.array(FlaggedRegionSchema).nullish().default([]),
  forensicObservations: z.array(z.string()).nullish().default([]),
  reasoning: z.string().nullish().default(''),
  extractedFields: z.object({
    fullName: z.string().nullish(),
    documentNumber: z.string().nullish(),
    nationality: z.string().nullish(),
    dateOfBirth: z.string().nullish(),
    expiryDate: z.string().nullish(),
    gender: z.string().nullish(),
    issuingCountry: z.string().nullish(),
    mrzLine1: z.string().nullish(),
    mrzLine2: z.string().nullish(),
    mrzLine3: z.string().nullish(),
  }).nullish().default({}),
  visaDetails: z.object({
    visaNumber: z.string().nullish(),
    passportNumberLinked: z.string().nullish(),
    visaType: z.string().nullish(),
    stayDurationDays: z.number().nullish(),
    entryValidity: z.string().nullish(),
    validFrom: z.string().nullish(),
    validUntil: z.string().nullish(),
    issuingPost: z.string().nullish(),
    passportMatched: z.boolean().nullish(),
    nameMatched: z.boolean().nullish(),
    nationalityMatched: z.boolean().nullish(),
    validityAligned: z.boolean().nullish(),
    overallCrossCheckPassed: z.boolean().nullish(),
    crossCheckNotes: z.array(z.string()).nullish(),
  }).nullish(),
});

function cleanNullFields(val: any): any {
  if (val === null || val === undefined) return undefined;
  if (Array.isArray(val)) return val.map(cleanNullFields).filter((v) => v !== undefined);
  if (typeof val === 'object') {
    const res: any = {};
    for (const [k, v] of Object.entries(val)) {
      const cleaned = cleanNullFields(v);
      if (cleaned !== undefined) {
        res[k] = cleaned;
      }
    }
    return res;
  }
  return val;
}

function getSecretKey(name: string): string {
  return (process.env[name] || '').trim();
}

const GROQ_TIMEOUT_MS = 3000; // 3000ms for edge roundtrip
const GEMINI_TIMEOUT_MS = 6000; // 6000ms per candidate model


async function executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, visaImageBase64 } = body;

    const groqKey = getSecretKey('GROQ_API_KEY');
    const geminiKey = getSecretKey('GEMINI_API_KEY');

    // Query local Python edge backend for pixel forensics and QR verification if available
    let pixelForensics: any = null;
    let qrDetails: any = null;

    if (imageBase64 && typeof imageBase64 === 'string') {
      // 1. Pixel Forensics (Copy-move, DCT, multi-level ELA)
      try {
        const pyForensics = await fetch('http://127.0.0.1:8000/api/forensics/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: imageBase64 }),
          signal: AbortSignal.timeout(1500),
        });
        if (pyForensics.ok) {
          pixelForensics = await pyForensics.json();
        }
      } catch {
        // Python edge forensics service offline or timed out; will fall back gracefully
      }

      // 2. Aadhaar Secure QR verification (queries microservice with zero-dependency CLI fallback)
      try {
        qrDetails = await verifyAadhaarQrBridge({
          imageBase64,
          printedFields: body.printedFields || body.currentFields,
        });
      } catch (qrErr) {
        console.warn('Aadhaar QR verification bridge error:', qrErr);
      }
    }

    const prompt = `You are an AI Visual Assistant providing non-authoritative descriptive context for immigration officers at an Indian Border Terminal (SSB Outpost Raxaul, Year 2026).
Your task is STRICTLY visual observation, optical character recognition (OCR), and document substrate description.
CRITICAL INVARIANTS:
1. DO NOT judge legal admissibility, mathematical checksums, or final screening clearance verdicts. Those are exclusively determined by the deterministic mathematical screening engine.
2. Your output is labeled strictly as "AI_VISUAL_DESCRIPTION (non-authoritative)".
3. Describe physical observations: substrate texture, typography consistency, photo borders, visible text.
4. Extract visible text (Full Name, Document Number, Nationality, DOB, Expiry, MRZ lines).
5. If Visa is present: extract visa details for cross-reconciliation.
6. Flag any visual anomalies or irregularities in bounding boxes.

Return ONLY a valid JSON object matching this schema:
{
  "isValidIdentityDocument": true,
  "detectedDocType": "PASSPORT",
  "tamperDetected": false,
  "tamperSeverity": "LOW",
  "forensicConfidenceScore": 92.0,
  "anomalyDetails": "",
  "flaggedRegions": [],
  "forensicObservations": ["Observation 1..."],
  "reasoning": "...",
  "extractedFields": {
    "fullName": "...",
    "documentNumber": "...",
    "nationality": "...",
    "dateOfBirth": "...",
    "expiryDate": "...",
    "gender": "M",
    "issuingCountry": "...",
    "mrzLine1": "...",
    "mrzLine2": "..."
  },
  "visaDetails": {
    "visaNumber": "...",
    "passportNumberLinked": "...",
    "visaType": "...",
    "issuingPost": "..."
  }
}`;

    // 1. PRIMARY ENGINE: Groq (Qwen 3.8 Vision with 3000ms timeout)
    if (groqKey) {
      try {
        const groq = new Groq({ apiKey: groqKey });
        const contentItems: any[] = [{ type: 'text', text: prompt }];

        if (imageBase64 && typeof imageBase64 === 'string') {
          const cleanUrl = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/jpeg;base64,${imageBase64}`;
          contentItems.push({
            type: 'image_url',
            image_url: { url: cleanUrl }
          });
        }

        if (visaImageBase64 && typeof visaImageBase64 === 'string') {
          const cleanVisaUrl = visaImageBase64.startsWith('data:')
            ? visaImageBase64
            : `data:image/jpeg;base64,${visaImageBase64}`;
          contentItems.push({
            type: 'image_url',
            image_url: { url: cleanVisaUrl }
          });
        }

        const groqCall = groq.chat.completions.create({
          model: 'qwen/qwen3.8-27b',
          max_tokens: 800,
          messages: [{ role: 'user', content: contentItems }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });

        const completion = await executeWithTimeout(groqCall, GROQ_TIMEOUT_MS, 'Groq Vision');
        const reply = completion.choices[0]?.message?.content || '{}';
        const parsedJson = JSON.parse(reply);
        const cleanedJson = cleanNullFields(parsedJson);
        const validated = AiForensicsSchema.parse(cleanedJson);

        const aiVisualDescription = {
          visualDescription: validated.reasoning || 'Visual analysis completed.',
          isNonAuthoritative: true as const,
          observations: validated.forensicObservations || [],
          flaggedRegions: validated.flaggedRegions || [],
        };

        return NextResponse.json({
          isLiveAi: true,
          provider: 'Groq LPU (Qwen 3.8 Vision)',
          data: {
            ...validated,
            aiVisualDescription,
            pixelForensics,
            qrDetails,
          },
        });
      } catch (groqErr: any) {
        console.warn('Groq Vision unavailable/timed out, falling back to Gemini:', groqErr.message);
      }
    }

    // 2. SECONDARY ENGINE: Google Gemini Flash Multimodal Vision
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const contents: any[] = [];

        if (imageBase64 && typeof imageBase64 === 'string') {
          if (imageBase64.includes(',')) {
            const parts = imageBase64.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const cleanData = parts[1];
            contents.push({
              inlineData: { mimeType, data: cleanData }
            });
          } else {
            contents.push({
              inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
            });
          }
        }

        if (visaImageBase64 && typeof visaImageBase64 === 'string') {
          if (visaImageBase64.includes(',')) {
            const parts = visaImageBase64.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const cleanData = parts[1];
            contents.push({
              inlineData: { mimeType, data: cleanData }
            });
          } else {
            contents.push({
              inlineData: { mimeType: 'image/jpeg', data: visaImageBase64 }
            });
          }
        }

        contents.push({ text: prompt });

        const candidateModels = Array.from(new Set([
          process.env.GEMINI_MODEL,
          'gemini-3.5-flash-lite',
          'gemini-3.6-flash',
          'gemini-3.7-flash',
        ].filter((m): m is string => Boolean(m && m.trim()))));

        for (const model of candidateModels) {
          try {
            const geminiCall = ai.models.generateContent({
              model,
              contents,
              config: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              }
            });

            const response = await executeWithTimeout(geminiCall, GEMINI_TIMEOUT_MS, `Gemini (${model})`);
            const responseText = response.text || '{}';
            const parsedJson = JSON.parse(responseText);
            const cleanedJson = cleanNullFields(parsedJson);
            const validated = AiForensicsSchema.parse(cleanedJson);

            const aiVisualDescription = {
              visualDescription: validated.reasoning || 'Visual analysis completed.',
              isNonAuthoritative: true as const,
              observations: validated.forensicObservations || [],
              flaggedRegions: validated.flaggedRegions || [],
            };

            return NextResponse.json({
              isLiveAi: true,
              provider: `Gemini (${model})`,
              data: {
                ...validated,
                aiVisualDescription,
                pixelForensics,
                qrDetails,
              },
            });
          } catch (modelErr: any) {
            console.warn(`Gemini model '${model}' failed:`, modelErr.message);
          }
        }
      } catch (geminiErr: any) {
        console.warn('Gemini vision engine failed:', geminiErr.message);
      }
    }

    // 3. FAIL-CLOSED FALLBACK: If both providers fail or timeout, route to SECONDARY_INSPECTION, NEVER CLEAR
    return NextResponse.json({
      isLiveAi: false,
      status: 'AI_FORENSICS_UNAVAILABLE',
      recommendedAction: 'SECONDARY_INSPECTION',
      riskScore: 48,
      message: 'AI Forensics gateway unavailable or timed out. Fail-closed security rule enforced.',
      data: {
        isValidIdentityDocument: true,
        detectedDocType: 'UNKNOWN_OR_UNINSPECTED',
        tamperDetected: false,
        tamperSeverity: 'MEDIUM',
        forensicConfidenceScore: 0,
        recommendedAction: 'SECONDARY_INSPECTION',
        riskScore: 48,
        reasoning: 'AI Forensics gateway timed out or offline. Traveler routed to Secondary Inspection for manual forensic inspection.',
        forensicObservations: [
          'Multimodal AI vision gateway unavailable/timed out.',
          'Deterministic Stage 1 & Stage 3 verification remain active.',
          'Mandatory physical inspection required under zero-trust border protocol.'
        ],
        aiVisualDescription: {
          visualDescription: 'AI visual gateway offline. Secondary inspection mandatory.',
          isNonAuthoritative: true,
          observations: [
            'Multimodal AI vision gateway unavailable/timed out.',
            'Mandatory physical inspection required under zero-trust border protocol.'
          ],
          flaggedRegions: [],
        },
        pixelForensics,
        qrDetails,
      }
    });

  } catch (error: any) {
    console.error('AI Review Gateway Error:', error);
    return NextResponse.json(
      {
        isLiveAi: false,
        status: 'AI_FORENSICS_UNAVAILABLE',
        recommendedAction: 'SECONDARY_INSPECTION',
        riskScore: 48,
        error: error.message || 'Failed to process AI review.',
        message: 'Fail-closed security rule enforced: Secondary inspection required.'
      },
      { status: 503 }
    );
  }
}
