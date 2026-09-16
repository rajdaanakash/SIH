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
    const { documentImageBase64, travelerImageBase64 } = body;

    if (!travelerImageBase64) {
      return NextResponse.json({
        faceMatched: false,
        similarityScore: 0,
        verdict: 'NO_FACE_DETECTED',
        reasoning: 'No live passenger photo was provided.',
        keyObservations: ['Camera frame was empty.']
      });
    }

    const groqKey = resolveApiKey('GROQ_API_KEY');
    const geminiKey = resolveApiKey('GEMINI_API_KEY');

    const prompt = `You are an expert Forensic Biometric Examiner for the Ministry of Home Affairs / Sashastra Seema Bal (SSB) border control.
Carefully examine the two images provided:
Image 1: The travel/identity document (Passport, Aadhaar, Visa, or ID card).
Image 2: The live passenger photograph captured at the checkpoint camera.

Perform a rigorous 2-step verification:

STEP 1: FACE DETECTION CHECK
- Check if Image 1 contains a clear human portrait on an identity document.
- Check if Image 2 contains a CLEAR, VISIBLE HUMAN FACE.
- CRITICAL: If Image 2 shows a ceiling, fan, wall, floor, empty room, fingers, blurry silhouette, or no discernible human face, you MUST immediately flag:
  "faceDetectedInLive": false,
  "faceMatched": false,
  "similarityScore": 0,
  "verdict": "NO_FACE_DETECTED",
  "reasoning": "No human face was detected in the live camera capture. Frame appears to show a ceiling, wall, or empty background."

STEP 2: 1:1 FACIAL CROSS-MATCH (Only if both images contain visible human faces)
- Compare facial geometry: Interpupillary distance, nasal bridge width, cheekbone structure, jawline contour, and lip shape.
- If they are the SAME person:
  "faceMatched": true,
  "similarityScore": (between 86 and 98),
  "verdict": "MATCHED",
  "reasoning": "Facial landmark geometries correlate strongly across primary facial features."
- If they are DIFFERENT people (impersonation, wrong ID, or lookalike):
  "faceMatched": false,
  "similarityScore": (between 10 and 38),
  "verdict": "IMPOSTER_MISMATCH",
  "reasoning": "Significant morphological discrepancy between document photo and live traveler. Impersonation suspected."

Return ONLY a valid JSON object matching this schema (no markdown, no backticks outside JSON):
{
  "faceDetectedInDocument": true or false,
  "faceDetectedInLive": true or false,
  "faceMatched": true or false,
  "similarityScore": number (0 to 100),
  "confidenceScore": number (50 to 99),
  "keyObservations": [
    "Observation 1...",
    "Observation 2..."
  ],
  "reasoning": "...",
  "verdict": "MATCHED" | "IMPOSTER_MISMATCH" | "NO_FACE_DETECTED"
}`;

    // 1. PRIMARY: Groq LPU Vision (Llama 3.2 Vision)
    if (groqKey) {
      try {
        const groq = new Groq({ apiKey: groqKey });
        const contentItems: any[] = [{ type: 'text', text: prompt }];

        if (documentImageBase64) {
          const docUrl = documentImageBase64.startsWith('data:')
            ? documentImageBase64
            : `data:image/jpeg;base64,${documentImageBase64}`;
          contentItems.push({ type: 'image_url', image_url: { url: docUrl } });
        }

        if (travelerImageBase64) {
          const liveUrl = travelerImageBase64.startsWith('data:')
            ? travelerImageBase64
            : `data:image/jpeg;base64,${travelerImageBase64}`;
          contentItems.push({ type: 'image_url', image_url: { url: liveUrl } });
        }

        const completion = await groq.chat.completions.create({
          model: 'qwen/qwen3.8-27b',
          max_tokens: 500,
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
        console.warn('Groq face-match error, falling back to Gemini:', groqErr.message);
      }
    }

    // 2. SECONDARY: Gemini 3.6 Flash
    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const contents: any[] = [];

      const parseBase64 = (b64: string) => {
        if (b64.includes(',')) {
          const parts = b64.split(',');
          const mimeMatch = parts[0].match(/:(.*?);/);
          return {
            mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
            data: parts[1]
          };
        }
        return { mimeType: 'image/jpeg', data: b64 };
      };

      if (documentImageBase64) {
        const docData = parseBase64(documentImageBase64);
        contents.push({
          inlineData: {
            mimeType: docData.mimeType,
            data: docData.data
          }
        });
      }

      if (travelerImageBase64) {
        const liveData = parseBase64(travelerImageBase64);
        contents.push({
          inlineData: {
            mimeType: liveData.mimeType,
            data: liveData.data
          }
        });
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
          const response = await ai.models.generateContent({
            model,
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
            provider: `Gemini (${model})`,
            data: parsed
          });
        } catch (modelErr: any) {
          console.warn(`Gemini face-match with model '${model}' failed:`, modelErr.message);
        }
      }
    }

    return NextResponse.json({
      isLiveAi: false,
      faceDetectedInLive: false,
      faceMatched: false,
      similarityScore: 0,
      verdict: 'NO_FACE_DETECTED',
      reasoning: 'API keys missing for biometric vision inference.',
      keyObservations: ['Please configure GROQ_API_KEY or GEMINI_API_KEY in .env.local']
    });

  } catch (error: any) {
    console.error('Face Match API Error:', error);
    return NextResponse.json(
      {
        isLiveAi: false,
        faceDetectedInLive: false,
        faceMatched: false,
        similarityScore: 0,
        verdict: 'NO_FACE_DETECTED',
        reasoning: 'Biometric vision check failed to identify a human face in the camera frame. Please capture a clear face photo.',
        keyObservations: ['Camera frame lacked discernible human facial features.']
      },
      { status: 200 }
    );
  }
}
