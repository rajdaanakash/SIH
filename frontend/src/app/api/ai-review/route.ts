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
    const { imageBase64, documentType, currentFields } = body;

    const groqKey = resolveApiKey('GROQ_API_KEY');
    const geminiKey = resolveApiKey('GEMINI_API_KEY');

    const prompt = `You are a Senior Forensic Document & Immigration Security Examiner for the Sashastra Seema Bal (SSB), Ministry of Home Affairs, Government of India.
Analyze this uploaded file for border control verification.

STAGE 1: DOCUMENT PRE-VALIDATION & CLASSIFICATION (CRITICAL GATEKEEPER)
Check if this uploaded image is an authentic GOVERNMENT-ISSUED IDENTITY OR TRAVEL DOCUMENT (e.g. Passport, Visa, Aadhaar Card, Voter ID, Driver License, National ID, Border Permit).
- If the image is an ACADEMIC MARKSHEET (e.g. 8th/10th/12th class marksheet, school report card, college degree, certificate), BILL, RECEIPT, RANDOM PHOTO, MEME, LANDSCAPE, OR NON-IDENTITY PAPER:
  You MUST set:
  "isValidIdentityDocument": false,
  "detectedDocType": "INVALID_NON_IDENTITY_DOCUMENT",
  "rejectionReason": "The uploaded file is identified as a school marksheet or non-identity document. SSB Drishti accepts only official Passports, Visas, Aadhaar, or National IDs."

STAGE 2: EXTRACTION & FORENSICS (Only if isValidIdentityDocument is true)
1. OCR & Field Extraction:
   - Full Name
   - Document Number (e.g. Passport or Aadhaar number)
   - Nationality (3-letter ISO code or country)
   - Date of Birth (DD/MM/YYYY)
   - Expiry Date (DD/MM/YYYY)
   - Gender (M, F, or X)
   - Issuing Country
   - MRZ lines if present

2. Forensic Tamper Detection:
   - Font Consistency: Check if any numbers or dates were digitally altered.
   - Photo Tampering: Look for cut-and-paste borders around the portrait.
   - Seals & Holograms: Check for standard security seals.
   - NOTE: If this is an authentic document photographed with a camera (even with ambient lighting, hand holding, or slight reflections), DO NOT falsely flag normal photography as digital splicing.

3. Final Verdict:
   - If genuine: tamperDetected = false, tamperSeverity = "LOW", recommendedAction = "CLEAR", riskScore between 8 and 20.
   - If tampered: tamperDetected = true, tamperSeverity = "HIGH", recommendedAction = "DETAIN", riskScore between 65 and 95.

Return ONLY a valid JSON object matching this schema (no markdown, no backticks outside JSON):
{
  "isValidIdentityDocument": true or false,
  "detectedDocType": "PASSPORT" | "VISA" | "AADHAAR" | "NATIONAL_ID" | "INVALID_NON_IDENTITY_DOCUMENT",
  "rejectionReason": "..." (if invalid, otherwise ""),
  "isLiveAi": true,
  "extractedFields": {
    "fullName": "...",
    "documentNumber": "...",
    "nationality": "...",
    "dateOfBirth": "...",
    "expiryDate": "...",
    "gender": "...",
    "issuingCountry": "...",
    "mrzLine1": "...",
    "mrzLine2": "..."
  },
  "forensicObservations": [
    "Observation 1...",
    "Observation 2..."
  ],
  "tamperDetected": false,
  "tamperSeverity": "LOW",
  "anomalyDetails": "...",
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

        const completion = await groq.chat.completions.create({
          model: 'llama-3.2-11b-vision-preview',
          messages: [{ role: 'user', content: contentItems }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });

        const reply = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(reply);
        return NextResponse.json({
          isLiveAi: true,
          provider: 'Groq LPU (Llama 3.2 Vision)',
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
        aiConfidenceScore: 94.5
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
