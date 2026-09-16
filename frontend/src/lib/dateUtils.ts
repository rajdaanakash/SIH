/**
 * Date and Document Expiration Verification Utilities & Payload Gatekeepers
 * SSB Border Security & Immigration Terminal
 * 
 * Enforces strict temporal validation against operating calendar (Year 2026).
 * Any document whose expiry date is in the past is strictly marked EXPIRED,
 * triggering an immediate DETAIN verdict.
 */

export interface ExpiryCheckResult {
  isExpired: boolean;
  expiryDate: Date | null;
  formattedDate: string;
  yearsExpired: number;
  statusText: string;
}

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function isValidCalendarDate(year: number, monthZeroIndexed: number, day: number): boolean {
  if (monthZeroIndexed < 0 || monthZeroIndexed > 11) return false;
  if (day < 1) return false;

  const daysInMonths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonths[monthZeroIndexed];
}

/**
 * Parses dates formatted as:
 * - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (e.g. "22/11/2006", "02/09/2034")
 * - YYYY-MM-DD, YYYY/MM/DD (e.g. "2006-11-22")
 * - DDMMMYYYY, DD-MMM-YYYY, DD MMM YYYY (e.g. "22NOV2006", "22-NOV-2006", "22 NOV 2006")
 * - MRZ 6-digit YYMMDD (e.g. "061122", "340902")
 */
export function parseDocumentDate(dateStr?: string | null, isDob: boolean = false): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim().toUpperCase();
  if (!clean || clean === 'N/A' || clean === 'PERMANENT') return null;

  // 1. Check DDMMMYYYY (e.g., "22NOV2006" or "22 NOV 2006" or "22-NOV-2006")
  const mmmMatch = clean.match(/^(\d{1,2})[\s\-\/\.]?([A-Z]{3})[\s\-\/\.]?(\d{4})$/);
  if (mmmMatch) {
    const day = parseInt(mmmMatch[1], 10);
    const monthStr = mmmMatch[2];
    const year = parseInt(mmmMatch[3], 10);
    const month = MONTH_MAP[monthStr];
    if (month !== undefined && isValidCalendarDate(year, month, day)) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // 2. Check standard DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // 3. Check ISO YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // 4. Check MRZ 6-digit format YYMMDD (e.g., "061122" = 22 Nov 2006)
  const mrzMatch = clean.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (mrzMatch) {
    const yy = parseInt(mrzMatch[1], 10);
    const mm = parseInt(mrzMatch[2], 10) - 1;
    const dd = parseInt(mrzMatch[3], 10);

    // ICAO Doc 9303 standard century rollover:
    // Operating Year is 2026.
    let year: number;
    if (isDob) {
      // For Date of Birth:
      // If yy <= 26 -> 2000 + yy (e.g. 02 -> 2002, 24 -> 2024)
      // If yy > 26 -> 1900 + yy (e.g. 85 -> 1985, 94 -> 1994)
      year = yy <= 26 ? 2000 + yy : 1900 + yy;
    } else {
      // For Expiration Date:
      // Passports max validity is 10 years.
      // If yy < 26 -> 2000 + yy (e.g. 06 -> 2006, 15 -> 2015, which are expired relative to 2026)
      // If yy >= 26 && yy <= 45 -> 2000 + yy (e.g. 34 -> 2034)
      // If yy > 45 -> 1900 + yy (e.g. 99 -> 1999, expired)
      year = (yy >= 26 && yy <= 45) ? 2000 + yy : (yy < 26 ? 2000 + yy : 1900 + yy);
    }

    if (isValidCalendarDate(year, mm, dd)) {
      return new Date(Date.UTC(year, mm, dd));
    }
  }

  // Fallback: standard Date.parse
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

/**
 * Validates whether an expiration date is expired relative to current operating time (2026).
 */
export function checkDocumentExpiry(dateStr?: string | null): ExpiryCheckResult {
  if (!dateStr) {
    return {
      isExpired: false,
      expiryDate: null,
      formattedDate: 'N/A',
      yearsExpired: 0,
      statusText: 'No Expiry Specified',
    };
  }

  const expiry = parseDocumentDate(dateStr, false);
  if (!expiry) {
    return {
      isExpired: false,
      expiryDate: null,
      formattedDate: dateStr,
      yearsExpired: 0,
      statusText: 'Unparsed Date Format',
    };
  }

  const now = new Date();
  const isExpired = expiry.getTime() < now.getTime();

  const diffMs = now.getTime() - expiry.getTime();
  const yearsExpired = isExpired ? Math.max(0.1, Number((diffMs / (365.25 * 24 * 3600 * 1000)).toFixed(1))) : 0;

  const day = String(expiry.getUTCDate()).padStart(2, '0');
  const month = String(expiry.getUTCMonth() + 1).padStart(2, '0');
  const year = expiry.getUTCFullYear();
  const formattedDate = `${day}/${month}/${year}`;

  let statusText = 'Valid Document';
  if (isExpired) {
    statusText = yearsExpired >= 1 
      ? `EXPIRED (~${yearsExpired} years ago on ${formattedDate})`
      : `EXPIRED (on ${formattedDate})`;
  }

  return {
    isExpired,
    expiryDate: expiry,
    formattedDate,
    yearsExpired,
    statusText,
  };
}

/**
 * Cryptographic SHA-256 hash calculation for image bytes.
 * Works uniformly in both Browser (crypto.subtle) and Node.js environments.
 */
export async function computeSha256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let uint8: Uint8Array;

  if (typeof data === 'string') {
    if (data.startsWith('data:')) {
      const parts = data.split(',');
      const base64 = parts[1] || '';
      if (typeof Buffer !== 'undefined') {
        uint8 = new Uint8Array(Buffer.from(base64, 'base64'));
      } else {
        const binary = atob(base64);
        uint8 = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          uint8[i] = binary.charCodeAt(i);
        }
      }
    } else {
      uint8 = new TextEncoder().encode(data);
    }
  } else if (data instanceof Uint8Array) {
    uint8 = data;
  } else {
    uint8 = new Uint8Array(data);
  }

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8 as unknown as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js crypto fallback
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(uint8).digest('hex');
  } catch {
    // Deterministic simple hash fallback if crypto is absent
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < uint8.length; i++) {
      h1 = Math.imul(h1 ^ uint8[i], 2654435761);
      h2 = Math.imul(h2 ^ uint8[i], 1597334677);
    }
    return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padStart(64, '0');
  }
}

/**
 * Byte-level SHA-256 duplicate payload detection.
 * Compares actual decoded bytes of Passport vs Visa specimen.
 */
export async function isDuplicatePayload(
  file1?: File | null,
  file2?: File | null,
  data1?: string | null,
  data2?: string | null
): Promise<boolean> {
  // Fast reference equality check
  if (file1 && file2 && file1 === file2) return true;

  // File metadata check
  if (file1 && file2) {
    if (file1.name === file2.name && file1.size === file2.size && file1.lastModified === file2.lastModified) {
      return true;
    }
  }

  // Cryptographic byte hashing
  let hash1: string | null = null;
  let hash2: string | null = null;

  if (file1) {
    const buf1 = await file1.arrayBuffer();
    hash1 = await computeSha256(buf1);
  } else if (data1) {
    hash1 = await computeSha256(data1);
  }

  if (file2) {
    const buf2 = await file2.arrayBuffer();
    hash2 = await computeSha256(buf2);
  } else if (data2) {
    hash2 = await computeSha256(data2);
  }

  if (hash1 && hash2 && hash1 === hash2) {
    return true;
  }

  // Fast string fallback
  if (data1 && data2) {
    return isDuplicateUpload(file1, file2, data1, data2);
  }

  return false;
}

/**
 * Synchronous string-level duplicate upload checker (fast pre-filter)
 */
export function isDuplicateUpload(
  file1?: File | null,
  file2?: File | null,
  base64_1?: string | null,
  base64_2?: string | null
): boolean {
  if (file1 && file2) {
    if (file1 === file2) return true;
    if (file1.name === file2.name && file1.size === file2.size && file1.lastModified === file2.lastModified) {
      return true;
    }
  }

  if (base64_1 && base64_2) {
    const clean1 = base64_1.replace(/^data:image\/[a-z]+;base64,/, '').trim();
    const clean2 = base64_2.replace(/^data:image\/[a-z]+;base64,/, '').trim();
    if (clean1.length > 50 && clean1 === clean2) {
      return true;
    }
    // Partial signature check for compressed frames
    if (clean1.length > 300 && clean1.length === clean2.length) {
      if (clean1.slice(0, 200) === clean2.slice(0, 200) && clean1.slice(-200) === clean2.slice(-200)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Enforces upload hardening limits:
 * - Rejects > 15MB payloads
 * - Enforces valid image MIME types
 */
export function validateUploadPayload(file: { name?: string; size?: number; type?: string }): {
  valid: boolean;
  error?: string;
} {
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  if (file.size && file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `Payload exceeds maximum allowable threshold of 15MB (${(file.size / (1024 * 1024)).toFixed(1)}MB detected). Upload blocked to prevent edge memory exhaustion.`,
    };
  }

  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
  const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'];

  if (file.type && !ALLOWED_MIME.includes(file.type.toLowerCase())) {
    const name = (file.name || '').toLowerCase();
    const hasValidExt = ALLOWED_EXT.some(ext => name.endsWith(ext));
    if (!hasValidExt) {
      return {
        valid: false,
        error: `Invalid file MIME type '${file.type}'. Only government identity document image formats (JPEG, PNG, WebP) are authorized.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Image dimension bomb mitigation
 */
export function validateImageDimensions(width: number, height: number): {
  valid: boolean;
  error?: string;
} {
  const MAX_DIM = 8192;
  const MAX_PIXELS = 40_000_000;

  if (width > MAX_DIM || height > MAX_DIM || width * height > MAX_PIXELS) {
    return {
      valid: false,
      error: `Image dimensions (${width}x${height}) exceed hardware security threshold. Potential decompression bomb detected.`,
    };
  }
  return { valid: true };
}
