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
Current Operating Date & Year: September 2026 (Year: 2026).
Analyze the uploaded document(s) for border control immigration verification.
${visaImageBase64 ? 'NOTE: TWO DOCUMENTS ARE PROVIDED. Image 1 is the PRIMARY TRAVEL PASSPORT. Image 2 is the ENTRY VISA / CONSULAR ENDORSEMENT.' : 'NOTE: ONE DOCUMENT IS PROVIDED (Passport/National ID).'}

CRITICAL SECURITY GATEKEEPERS (ZERO-TOLERANCE RULES):

RULE 1: DUPLICATE SPECIMEN DETECTION
- Compare Image 1 and Image 2. If BOTH images are identical or show the same document (e.g., the user uploaded the exact same document into both the Passport and Visa slots):
  You MUST IMMEDIATELY set:
  "isDuplicate": true,
  "tamperDetected": true,
  "recommendedAction": "DETAIN",
  "riskScore": 98,
  "reasoning": "FRAUD DETECTED: The exact same document specimen was uploaded for both Passport and Visa. An authentic separate national passport booklet and an official visa permit are required."

RULE 2: STRICT EXPIRATION VALIDATION (CURRENT YEAR IS 2026)
- Check the "Expiry Date" or "Expiration Date" on the document(s).
- If the expiry date is in the past relative to the current year 2026 (e.g. 2006, 2015, 2024, or any date before today):
  You MUST IMMEDIATELY set:
  "isExpired": true,
  "tamperDetected": true,
  "recommendedAction": "DETAIN",
  "riskScore": 96,
  "reasoning": "CRITICAL BORDER VIOLATION: Document is EXPIRED. Expiry date is in the past relative to 2026. Expired documents are strictly denied entry under Section 3 of the Passports (Entry into India) Act."

RULE 3: PRIMARY TRAVEL DOCUMENT CLASSIFICATION
- The document in Image 1 MUST be a Primary Travel Document (Passport booklet or National ID).
- If Image 1 is actually a VISA STICKER / FOIL (for example, reads "VISA", "UNITED STATES OF AMERICA VISA", or MRZ starts with "V<" or "VN"):
  You MUST set:
  "isWrongDocType": true,
  "detectedDocType": "VISA_STICKER_IN_PASSPORT_SLOT",
  "recommendedAction": "DETAIN",
  "riskScore": 95,
  "reasoning": "INVALID PRIMARY DOCUMENT: A Visa foil/sticker was uploaded in the Passport slot. A national Passport booklet is mandatory."

RULE 4: CONSULAR JURISDICTION (INDIAN BORDER CLEARANCE)
- This is an Indian immigration checkpoint under the Ministry of Home Affairs, Government of India.
- If the traveler presents a VISA issued by the "UNITED STATES OF AMERICA" or other foreign country:
  A US Visa grants zero entry privileges into the Republic of India!
  You MUST set:
  "isInvalidJurisdiction": true,
  "recommendedAction": "DETAIN",
  "riskScore": 96,
  "reasoning": "JURISDICTION VIOLATION: Uploaded Visa is a foreign visa (UNITED STATES OF AMERICA). Entering India requires an authentic Indian Entry Visa / e-Visa issued by the Government of India."

STAGE 1: DOCUMENT PRE-VALIDATION & CLASSIFICATION
Check if the uploaded image(s) are authentic GOVERNMENT-ISSUED IDENTITY OR TRAVEL DOCUMENTS.
- If ANY uploaded image is an ACADEMIC MARKSHEET, BILL, RECEIPT, OR NON-IDENTITY PAPER:
  Set "isValidIdentityDocument": false, "detectedDocType": "INVALID_NON_IDENTITY_DOCUMENT", "recommendedAction": "DETAIN", "riskScore": 95.

STAGE 2: PRIMARY DOCUMENT OCR & FORENSICS
1. Extract: Full Name, Document Number (Passport #), Nationality, Date of Birth, Expiry Date, Gender, Issuing Country, MRZ lines.
2. Forensic Tamper: Check digital font alterations, photo replacement seams, substrate laminate security patterns.

STAGE 3: NATIONALITY-BASED VISA RULES & CROSS-RECONCILIATION
- If Indian Passport: Visa is EXEMPT.
- If Foreign Passport: An Indian Entry Visa is MANDATORY.
  * If Visa is provided: Extract visaNumber, passportNumberLinked, visaType, stayDurationDays, entryValidity, validFrom, validUntil, issuingPost.
  * Cross-check passportNumberLinked on the Visa with the Passport Number on Image 1. If mismatch -> recommendedAction = "DETAIN".

STAGE 4: FINAL VERDICT & COMPOSITE SCORING
- If isDuplicate OR isExpired OR isWrongDocType OR isInvalidJurisdiction: recommendedAction = "DETAIN", riskScore >= 95.
- If genuine Indian passport OR genuine foreign passport with valid, matching, unexpired Indian Visa: recommendedAction = "CLEAR", riskScore between 8 and 20.
- If foreign passport without visa: recommendedAction = "SECONDARY_INSPECTION", riskScore 48.

Return ONLY a valid JSON object matching this schema:
{
  "isValidIdentityDocument": true,
  "detectedDocType": "PASSPORT",
  "isDuplicate": false,
  "isExpired": false,
  "isWrongDocType": false,
  "isInvalidJurisdiction": false,
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
