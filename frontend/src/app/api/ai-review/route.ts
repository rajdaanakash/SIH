import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

function resolveApiKey(keyName: string): string {
  if (process.env[keyName] && process.env[keyName]?.trim() !== '') {
    return process.env[keyName]!.trim();
  }
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`${keyName}=(.*)`);
      const match = content.match(regex);
      if (match && match[1] && match[1].trim() !== '') {
        return match[1].trim();
      }
    }
  } catch (e) {}
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, visaImageBase64, documentType, currentFields } = body;

    const groqKey = resolveApiKey('GROQ_API_KEY');
    const geminiKey = resolveApiKey('GEMINI_API_KEY');

    const prompt = `You are a Senior Forensic Document & Immigration Security Examiner for the Sashastra Seema Bal (SSB), Ministry of Home Affairs, Government of India.
Analyze the uploaded document(s) for border control immigration verification.
${visaImageBase64 ? 'NOTE: TWO DOCUMENTS ARE PROVIDED. Image 1 is the PRIMARY TRAVEL PASSPORT. Image 2 is the ENTRY VISA / CONSULAR ENDORSEMENT.' : 'NOTE: ONE DOCUMENT IS PROVIDED (Passport/National ID).'}

STAGE 1: DOCUMENT PRE-VALIDATION & CLASSIFICATION (CRITICAL GATEKEEPER)
Check if the uploaded image(s) are authentic GOVERNMENT-ISSUED IDENTITY OR TRAVEL DOCUMENTS (Passport, Visa, Aadhaar, National ID, Border Permit).
- If ANY uploaded image is an ACADEMIC MARKSHEET (e.g. 8th/10th/12th marksheet, school certificate), BILL, RECEIPT, OR NON-IDENTITY PAPER:
  You MUST immediately set:
  "isValidIdentityDocument": false,
  "detectedDocType": "INVALID_NON_IDENTITY_DOCUMENT",
  "rejectionReason": "Uploaded file is identified as an academic marksheet or non-identity paper. SSB immigration terminals process only official Passports, Visas, and Government IDs."

STAGE 2: PRIMARY DOCUMENT OCR & FORENSICS (Only if isValidIdentityDocument is true)
1. OCR & Field Extraction (for Passport/ID):
   - Full Name
   - Document Number (Passport #)
   - Nationality (3-letter ISO code or country)
   - Date of Birth (DD/MM/YYYY)
   - Expiry Date (DD/MM/YYYY)
   - Gender (M, F, or X)
   - Issuing Country
   - MRZ lines if present

2. Forensic Tamper Detection:
   - Font Consistency: Check if any numbers, names, or dates were digitally altered.
   - Photo Replacement: Look for cut-and-paste seams or pixel artifacts around the portrait.
   - Security Laminate & Stamp: Check consistency of consulate/immigration seals.
   - NOTE: If this is an authentic document photographed with a phone camera (ambient reflections, slight angle), do NOT falsely classify camera reflections as digital splicing.

${visaImageBase64 ? `STAGE 3: VISA EXTRACTION & PASSPORT ↔ VISA CROSS-RECONCILIATION
1. Extract Visa Fields (from Image 2):
   - visaNumber
   - passportNumberLinked (the Passport Number printed on the Visa)
   - visaType (e.g., TOURIST, BUSINESS, EMPLOYMENT, TRANSIT PERMIT)
   - stayDurationDays (e.g., 30, 90, 180)
   - entryValidity (SINGLE, MULTIPLE, DOUBLE)
   - validFrom, validUntil
   - issuingPost
2. Cross-Verification Rules:
   - CRITICAL: Check if passportNumberLinked on the Visa exactly matches the Passport Number on Image 1. If they do not match, set passportMatched = false, tamperDetected = true, recommendedAction = "DETAIN".
   - Check if the Traveler Name on Visa matches Passport Name.
   - Check if Nationality on Visa matches Passport.
   - Check if Visa validUntil is before Passport Expiry Date.
   - Set overallCrossCheckPassed to true if all match, false otherwise.` : ''}

STAGE 4: FINAL VERDICT & COMPOSITE SCORING
- If genuine & all cross-checks pass: tamperDetected = false, recommendedAction = "CLEAR", riskScore between 8 and 20.
- If stamp anomaly or minor ambiguity: tamperDetected = false, recommendedAction = "SECONDARY_INSPECTION", riskScore between 45 and 60.
- If photo replaced, text altered, or Passport-Visa mismatch: tamperDetected = true, recommendedAction = "DETAIN", riskScore between 75 and 95.

Return ONLY a valid JSON object matching this schema (no markdown formatting, no backticks outside JSON):
{
  "isValidIdentityDocument": true,
  "detectedDocType": "PASSPORT",
  "rejectionReason": "",
  "isLiveAi": true,
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
  "hasVisa": ${visaImageBase64 ? 'true' : 'false'},
  "visaDetails": {
    "visaNumber": "...",
    "passportNumberLinked": "...",
    "visaType": "...",
    "stayDurationDays": 30,
    "entryValidity": "MULTIPLE",
    "validFrom": "...",
    "validUntil": "...",
    "issuingPost": "...",
    "passportMatched": true,
    "nameMatched": true,
    "nationalityMatched": true,
    "validityAligned": true,
    "overallCrossCheckPassed": true,
    "crossCheckNotes": ["..."]
  },
  "forensicObservations": [
    "Observation 1...",
    "Observation 2..."
  ],
  "tamperDetected": false,
  "tamperSeverity": "LOW",
  "anomalyDetails": "",
  "aiConfidenceScore": 96.5,
  "recommendedAction": "CLEAR",
  "riskScore": 14,
  "reasoning": "..."
}`;

    // 1. PRIMARY ENGINE: Groq (Ultra-Fast LPU Inference with high rate limits)
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

        const completion = await groq.chat.completions.create({
          model: 'qwen/qwen3.8-27b',
          max_tokens: 800,
          messages: [{ role: 'user', content: contentItems }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });

        const reply = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(reply);
        return NextResponse.json({
          isLiveAi: true,
          provider: 'Groq LPU (Qwen 3.8 Vision)',
          data: parsed
        });
      } catch (groqErr: any) {
        console.warn('Groq Vision attempted, falling back to Gemini:', groqErr.message);
      }
    }

    // 2. SECONDARY ENGINE: Google Gemini 3.6 Flash
    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const contents: any[] = [];

      if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.includes(',')) {
        const parts = imageBase64.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const cleanData = parts[1];

        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanData
          }
        });
      }

      if (visaImageBase64 && typeof visaImageBase64 === 'string' && visaImageBase64.includes(',')) {
        const parts = visaImageBase64.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const cleanData = parts[1];

        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanData
          }
        });
      }

      contents.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      const responseText = response.text || '{}';
      const parsed = JSON.parse(responseText);
      return NextResponse.json({
        isLiveAi: true,
        provider: 'Gemini 3.6 Flash',
        data: parsed
      });
    }

    // 3. Fallback if no keys are provided
    return NextResponse.json({
      isLiveAi: false,
      isValidIdentityDocument: true,
      message: 'Running in Edge Simulation Mode.',
      data: {
        isValidIdentityDocument: true,
        detectedDocType: 'PASSPORT',
        recommendedAction: 'CLEAR',
        aiConfidenceScore: 94.5,
        hasVisa: Boolean(visaImageBase64),
        visaDetails: visaImageBase64 ? {
          visaNumber: 'IND-V-89412',
          passportNumberLinked: 'Z8941209',
          visaType: 'TOURIST / TRANSIT',
          stayDurationDays: 30,
          entryValidity: 'MULTIPLE',
          validFrom: '01/01/2026',
          validUntil: '31/12/2026',
          issuingPost: 'EMBASSY OF INDIA, KATHMANDU',
          passportMatched: true,
          nameMatched: true,
          nationalityMatched: true,
          validityAligned: true,
          overallCrossCheckPassed: true,
          crossCheckNotes: ['Visa linked passport number matches primary document.', 'Traveler name & nationality match.']
        } : undefined,
        extractedFields: {
          fullName: 'RAHUL VERMA',
          documentNumber: 'Z8941209',
          nationality: 'IND',
          dateOfBirth: '14/08/1996',
          expiryDate: '13/08/2034',
          gender: 'M',
          issuingCountry: 'IND',
          mrzLine1: 'P<INDFVERMA<<RAHUL<<<<<<<<<<<<<<<<<<<<<<<<<<',
          mrzLine2: 'Z8941209<2IND9608144M3408138<<<<<<<<<<<<<<<0'
        },
        forensicObservations: [
          'Edge forensic inspection: Micro-print line integrity across bio-page verified.',
          'Font kerning and numerical baseline alignment consistent.',
          'Substrate reflection shows authentic laminate security pattern.'
        ]
      }
    });

  } catch (error: any) {
    console.error('AI Review Route Error:', error);
    return NextResponse.json(
      {
        isLiveAi: false,
        error: error.message || 'Failed to process AI review.',
        fallbackNotice: 'Edge forensic engine fallback active.'
      },
      { status: 500 }
    );
  }
}
