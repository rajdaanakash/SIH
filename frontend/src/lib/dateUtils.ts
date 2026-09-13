/**
 * Date and Document Expiration Verification Utilities
 * SSB Border Security & Immigration Terminal
 * 
 * Enforces strict temporal validation against the current date (Year 2026).
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

/**
 * Parses dates formatted as:
 * - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (e.g. "22/11/2006", "02/09/2034")
 * - YYYY-MM-DD, YYYY/MM/DD (e.g. "2006-11-22")
 * - DDMMMYYYY, DD-MMM-YYYY, DD MMM YYYY (e.g. "22NOV2006", "22-NOV-2006", "22 NOV 2006")
 * - MRZ 6-digit YYMMDD (e.g. "061122", "340902")
 */
export function parseDocumentDate(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim().toUpperCase();
  if (!clean || clean === 'N/A' || clean === 'PERMANENT') return null;

  // 1. Check DDMMMYYYY (e.g., "22NOV2006" or "22 NOV 2006" or "22-NOV-2006")
  const mmmMatch = clean.match(/^(\d{1,2})[\s\-\/\.]?([A-Z]{3})[\s\-\/\.]?(\d{4})$/);
  if (mmmMatch) {
    const day = parseInt(mmmMatch[1], 10);
    const monthStr = mmmMatch[2];
    const year = parseInt(mmmMatch[3], 10);
    if (MONTH_MAP[monthStr] !== undefined) {
      return new Date(Date.UTC(year, MONTH_MAP[monthStr], day));
    }
  }

  // 2. Check standard DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // 3. Check ISO YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // 4. Check MRZ 6-digit format YYMMDD (e.g., "061122" = 22 Nov 2006)
  const mrzMatch = clean.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (mrzMatch) {
    const yy = parseInt(mrzMatch[1], 10);
    const mm = parseInt(mrzMatch[2], 10) - 1;
    const dd = parseInt(mrzMatch[3], 10);
    // ICAO Doc 9303 standard pivot: 
    // Expiry years > 50 are 19YY, <= 50 are 20YY
    const year = yy > 50 ? 1900 + yy : 2000 + yy;
    if (mm >= 0 && mm <= 11 && dd >= 1 && dd <= 31) {
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
 * Validates whether an expiration date is expired relative to current time (2026).
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

  const expiry = parseDocumentDate(dateStr);
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
 * Checks whether two uploaded specimens are duplicate (identical image submitted
 * for both passport and visa slots).
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
