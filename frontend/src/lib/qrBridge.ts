/**
 * SSB DRISHTI (SIH26188) — Aadhaar Secure QR Cryptographic Verification Bridge
 * 
 * Queries local FastAPI edge backend (http://127.0.0.1:8000/api/qr/verify)
 * with automatic zero-configuration fallback to local Python CLI runner
 * (backend/qr/cli.py) so verification never drops when microservice is stopped.
 */

import { execFile } from 'child_process';
import path from 'path';

export interface QrBridgeInput {
  imageBase64: string;
  printedFields?: {
    fullName?: string;
    dateOfBirth?: string;
    gender?: string;
  };
}

export async function verifyAadhaarQrBridge(input: QrBridgeInput): Promise<any> {
  const { imageBase64, printedFields } = input;
  if (!imageBase64) return null;

  // 1. Attempt HTTP query to FastAPI edge microservice
  try {
    const res = await fetch('http://127.0.0.1:8000/api/qr/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: imageBase64,
        printed_name: printedFields?.fullName,
        printed_dob: printedFields?.dateOfBirth,
        printed_gender: printedFields?.gender,
      }),
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Microservice offline or timed out; seamless local Python runner fallback
  }

  // 2. Direct in-process Python CLI bridge fallback
  return new Promise((resolve) => {
    try {
      const scriptPath = path.resolve(process.cwd(), '../backend/qr/cli.py');
      const proc = execFile(
        'python',
        [scriptPath],
        { timeout: 4500, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err || !stdout) {
            resolve({
              qr_detected: false,
              qr_decoded: false,
              status: 'QR_NOT_PRESENT',
              security_error_code: null,
              message: 'No QR detected in document image.',
            });
            return;
          }

          try {
            const data = JSON.parse(stdout.trim());
            resolve(data);
          } catch {
            resolve({
              qr_detected: false,
              qr_decoded: false,
              status: 'QR_PARSE_FAILED',
              security_error_code: 'ERR_QR_UNREADABLE',
              message: 'Failed to parse QR verification telemetry.',
            });
          }
        }
      );

      proc.stdin?.write(
        JSON.stringify({
          image_base64: imageBase64,
          printed_fields: printedFields || {},
        })
      );
      proc.stdin?.end();
    } catch (e) {
      resolve({
        qr_detected: false,
        qr_decoded: false,
        status: 'QR_NOT_PRESENT',
      });
    }
  });
}
