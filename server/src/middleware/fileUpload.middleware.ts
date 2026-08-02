/**
 * File Upload Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Secure file upload handling for assessment documents
 */

import * as crypto from 'crypto';
import { Request } from 'express';
import * as fs from 'fs';
import multer from 'multer';
import * as path from 'path';

import { uploadsDir } from '../utils/storagePaths.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface _FileRequest extends AuthRequest {
  file?: Express.Multer.File;
}

// ==========================================
// CONSTANTS - upload roots
// ==========================================

// Was `path.resolve(__dirname, '../../../uploads/assessments')` — equivalent
// to `process.cwd()/uploads/assessments` at runtime, but hardcoded to
// process.cwd() and blind to STORAGE_DIR/RAILWAY_VOLUME_MOUNT_PATH. Routed
// through the shared helper (utils/storagePaths.ts) for G2 volume readiness;
// behavior is unchanged while no storage env var is set.
export const ASSESSMENTS_UPLOAD_ROOT = uploadsDir('assessments');

export const MAX_CLIENT_ORIGINALNAME_LENGTH = 255;

// ==========================================
// CONSTANTS - error codes and messages
// ==========================================

export const FILE_UPLOAD_DISALLOWED_TYPE_CODE = 'FILE_UPLOAD_DISALLOWED_TYPE';
export const FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE =
  'Only PDF, Excel, and Word documents are allowed';

export const FILE_UPLOAD_INVALID_FILENAME_CODE = 'FILE_UPLOAD_INVALID_FILENAME';
export const FILE_UPLOAD_INVALID_FILENAME_MESSAGE = 'Filename contains disallowed characters';

export const FILE_UPLOAD_FILTER_RUNTIME_CODE = 'FILE_UPLOAD_FILTER_RUNTIME';
export const FILE_UPLOAD_FILTER_RUNTIME_MESSAGE = 'Failed to validate uploaded file metadata';

export const FILE_UPLOAD_WORKSPACE_UNAVAILABLE_CODE = 'FILE_UPLOAD_WORKSPACE_UNAVAILABLE';
export const FILE_UPLOAD_WORKSPACE_UNAVAILABLE_MESSAGE = 'Upload workspace unavailable';

// ==========================================
// HELPERS
// ==========================================

function makeCodedError(message: string, code: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

/**
 * Regex matching characters disallowed in upload filenames:
 *   - C0 control chars (0x00-0x1F) - includes null byte, LF, CR, tab
 *   - DEL (0x7F)
 *   - C1 control chars (0x80-0x9F)
 *   - Zero-width / invisible Unicode (U+200B-U+200F: ZWSP, ZWNJ, ZWJ, LRM, RLM)
 *   - Line/paragraph separators (U+2028, U+2029)
 *   - Bidirectional formatting chars (U+202A-U+202E)
 *   - BOM / zero-width no-break space (U+FEFF)
 */
// eslint-disable-next-line no-control-regex
// Two forms: test (stateless, no /g) and strip (replaces all occurrences)
const DISALLOWED_FILENAME_RE =
  // eslint-disable-next-line no-control-regex -- sanityzacja: celowe znaki kontrolne w walidacji nazw plików
  /[\x00-\x1f\x7f\x80-\x9f\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/;
const DISALLOWED_FILENAME_STRIP_RE =
  // eslint-disable-next-line no-control-regex -- sanityzacja: celowe znaki kontrolne w walidacji nazw plików
  /[\x00-\x1f\x7f\x80-\x9f\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/g;

/**
 * Reject org ids that contain path separators, traversal sequences, or are
 * excessively long so they can never escape the upload root.
 */
export function sanitizeOrgIdForUploadPath(orgId: string): string {
  if (
    typeof orgId !== 'string' ||
    orgId.length > 128 ||
    orgId.includes('/') ||
    orgId.includes('\\') ||
    orgId === '..' ||
    orgId.startsWith('../') ||
    orgId.includes('/../') ||
    orgId.endsWith('/..')
  ) {
    return 'unknown';
  }
  return orgId;
}

/**
 * Check whether `child` is nested inside `parent` (both must be absolute,
 * already-resolved paths).
 */
export function isPathInsideDir(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Mapping: file extension -> ordered list of allowed MIME base-types (exact match)
const EXT_TO_MIME_BASES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  doc: ['application/msword'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xls: ['application/vnd.ms-excel'],
  // FIN-005: CSV statement import. Browsers/OS's are inconsistent about the
  // client-declared MIME for .csv (Excel-generated exports commonly send
  // application/vnd.ms-excel; some browsers send text/csv, some fall back to
  // text/plain or application/octet-stream) — accept the realistic set, and
  // rely on sniffFileSignature() (below) plus the extension/path hardening
  // already in this file for the actual safety guarantee rather than the
  // client-supplied header alone.
  csv: [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/octet-stream',
  ],
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(EXT_TO_MIME_BASES));

// Known-safe extension set used by buildSafeUploadedFilename
const KNOWN_SAFE_EXTS = ALLOWED_EXTENSIONS;

// ==========================================
// CONTENT SNIFFING (magic bytes)
// ==========================================

export const FILE_UPLOAD_SIGNATURE_MISMATCH_CODE = 'FILE_UPLOAD_SIGNATURE_MISMATCH';
export const FILE_UPLOAD_SIGNATURE_MISMATCH_MESSAGE =
  'File content does not match its declared type';

/**
 * Verify the FIRST BYTES of an already-saved upload actually match the
 * claimed extension, instead of trusting only the client-supplied `mimetype`
 * header (which fileFilter checks, but which the client fully controls).
 *
 * - pdf: `%PDF-` signature.
 * - xlsx/docx: PK zip local-file-header signature (both are OOXML zip
 *   containers) — this only confirms "is a zip", not "is a valid xlsx"; real
 *   structural validation happens when XLSX.read() parses it.
 * - xls (legacy binary): OLE2 compound-file signature.
 * - doc (legacy binary): same OLE2 signature as xls — both are CFBF
 *   containers, cannot be told apart from the header alone.
 * - csv: no reliable magic number for plain text. We instead reject files
 *   that look like a DIFFERENT known binary format (zip/OLE2/PDF) wearing a
 *   `.csv` extension, and reject a null byte in the first chunk (real CSV
 *   text never contains one; a null byte this early is a strong signal of a
 *   disguised binary).
 */
export function sniffFileSignature(buffer: Buffer, ext: string): boolean {
  const normalizedExt = String(ext || '').toLowerCase();
  const head = buffer.subarray(0, 8);

  const isPdf = head.subarray(0, 5).toString('latin1') === '%PDF-';
  const isZip =
    head.length >= 4 &&
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07) &&
    (head[3] === 0x04 || head[3] === 0x06 || head[3] === 0x08);
  const isOle2 =
    head.length >= 8 &&
    head[0] === 0xd0 &&
    head[1] === 0xcf &&
    head[2] === 0x11 &&
    head[3] === 0xe0 &&
    head[4] === 0xa1 &&
    head[5] === 0xb1 &&
    head[6] === 0x1a &&
    head[7] === 0xe1;

  switch (normalizedExt) {
    case 'pdf':
      return isPdf;
    case 'xlsx':
    case 'docx':
      return isZip;
    case 'xls':
    case 'doc':
      // Some producers still emit legacy .xls as a plain CSV/TSV with an .xls
      // extension — accept OLE2 (real BIFF) but do not hard-fail plain text,
      // since that False-positive would break real-world exports; only
      // reject a mismatched OTHER binary signature.
      return isOle2 || (!isZip && !isPdf);
    case 'csv':
      // Reject disguised binaries; a genuine CSV/TSV is never a zip/OLE2/PDF.
      if (isPdf || isZip || isOle2) return false;
      return !buffer.subarray(0, 4096).includes(0x00);
    default:
      return true;
  }
}

/**
 * Build a filesystem-safe unique filename from the client-supplied originalname.
 * Format: `<timestamp>-<16-hex-entropy>-<sanitized-basename>.<lowercased-ext>`
 *
 * - Falls back to `unknown.file.bin` when originalname is not a string or
 *   accessing it throws.
 * - Extensions not in the allow-list are replaced with `.bin`.
 * - Control characters and zero-width Unicode are stripped from the basename.
 * - Windows-style path separators are normalized; only the tail segment is used.
 * - The full output is capped at 200 characters.
 */
export function buildSafeUploadedFilename(originalname: unknown): string {
  const timestamp = Date.now();
  const entropy = crypto.randomBytes(8).toString('hex'); // 16 hex chars
  const prefix = `${timestamp}-${entropy}-`;

  const FALLBACK = 'unknown.file.bin';

  let rawName: string;
  try {
    if (typeof originalname !== 'string') {
      return `${prefix}${FALLBACK}`;
    }
    rawName = originalname;
  } catch {
    return `${prefix}${FALLBACK}`;
  }

  // Normalize Windows-style backslash separators; take only the tail segment
  rawName = rawName.replace(/\\/g, '/');
  rawName = rawName.split('/').pop() ?? '';

  // Strip control characters and zero-width Unicode from the whole name
  rawName = rawName.replace(DISALLOWED_FILENAME_STRIP_RE, '');

  const dotExt = path.extname(rawName).toLowerCase(); // e.g. ".pdf"
  const ext = dotExt.slice(1); // e.g. "pdf"
  const basename = path.basename(rawName, dotExt);

  const safeExt = KNOWN_SAFE_EXTS.has(ext) ? ext : 'bin';
  const safeDotExt = `.${safeExt}`;

  if (!basename) {
    return `${prefix}${FALLBACK}`;
  }

  // Truncate so the total length stays at or below 200 chars
  const maxBasenameLen = 200 - prefix.length - safeDotExt.length;
  const truncatedBasename = basename.slice(0, Math.max(0, maxBasenameLen));

  if (!truncatedBasename) {
    return `${prefix}${FALLBACK}`;
  }

  return `${prefix}${truncatedBasename}${safeDotExt}`;
}

// ==========================================
// DIRECTORY RESOLUTION
// ==========================================

/**
 * Resolve (and create if missing) the upload directory for the requesting org.
 * Returns the real, canonical path.
 */
export function resolveAssessmentUploadDir(req: Request): string {
  const rawOrgId = (req as AuthRequest).user?.organizationId ?? 'unknown';
  const safeOrgId = sanitizeOrgIdForUploadPath(rawOrgId);
  const dir = path.join(ASSESSMENTS_UPLOAD_ROOT, safeOrgId);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } else {
    // Ensure permissions are correct even if directory already exists
    fs.chmodSync(dir, 0o700);
  }

  // Verify the resolved directory is still inside the upload root (traversal guard)
  const real = fs.realpathSync(dir);
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(ASSESSMENTS_UPLOAD_ROOT);
  } catch {
    realRoot = ASSESSMENTS_UPLOAD_ROOT;
  }

  if (!isPathInsideDir(realRoot, real) && real !== realRoot) {
    throw makeCodedError(
      FILE_UPLOAD_WORKSPACE_UNAVAILABLE_MESSAGE,
      FILE_UPLOAD_WORKSPACE_UNAVAILABLE_CODE
    );
  }

  return real;
}

/**
 * Multer-compatible destination resolver that catches errors from the inner
 * resolver and always supplies a non-empty fallback path to the callback so
 * multer can clean up its temp stream.
 */
export function resolveUploadDestinationForMulter(
  req: Request,
  cb: (error: Error | null, destination: string) => void,
  resolver: (req: Request) => string = resolveAssessmentUploadDir
): void {
  try {
    const dest = resolver(req);
    cb(null, dest);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(FILE_UPLOAD_WORKSPACE_UNAVAILABLE_MESSAGE);
    cb(error, ASSESSMENTS_UPLOAD_ROOT);
  }
}

// ==========================================
// FILE FILTER
// ==========================================

/**
 * Multer file filter - allows only PDF, Excel and Word files.
 *
 * Hardening:
 * - Wraps all property accesses in try/catch (throwing getter protection)
 * - Rejects oversized originalname metadata
 * - Rejects filenames containing control characters or zero-width Unicode
 * - Strips MIME charset parameters before comparison
 * - Enforces extension <-> MIME pairing (no cross-type spoofing)
 * - Handles Windows-style path separators in originalname
 */
export const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void
): void => {
  let originalname: string;
  let mimetype: string;

  // Guard against throwing accessors
  try {
    originalname = file.originalname;
    mimetype = file.mimetype;
  } catch {
    cb(
      makeCodedError(FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE, FILE_UPLOAD_DISALLOWED_TYPE_CODE),
      false
    );
    return;
  }

  // Reject oversized metadata before anything else
  if (typeof originalname !== 'string' || originalname.length > MAX_CLIENT_ORIGINALNAME_LENGTH) {
    cb(
      makeCodedError(FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE, FILE_UPLOAD_DISALLOWED_TYPE_CODE),
      false
    );
    return;
  }

  // Reject filenames containing control characters or zero-width Unicode
  if (DISALLOWED_FILENAME_RE.test(originalname)) {
    cb(
      makeCodedError(FILE_UPLOAD_INVALID_FILENAME_MESSAGE, FILE_UPLOAD_INVALID_FILENAME_CODE),
      false
    );
    return;
  }

  // Normalize Windows path separators; take only the tail segment
  const tailName = originalname.replace(/\\/g, '/').split('/').pop() ?? '';
  const ext = path.extname(tailName).toLowerCase().slice(1); // without leading dot

  // Strip MIME charset/parameter suffix (e.g. "application/pdf; charset=binary")
  const mimeBase = (mimetype ?? '').split(';')[0].trim().toLowerCase();

  const allowedMimesForExt = EXT_TO_MIME_BASES[ext];

  if (!allowedMimesForExt || !allowedMimesForExt.includes(mimeBase)) {
    cb(
      makeCodedError(FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE, FILE_UPLOAD_DISALLOWED_TYPE_CODE),
      false
    );
    return;
  }

  cb(null, true);
};

// ==========================================
// STORAGE CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
  destination: (
    req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    resolveUploadDestinationForMulter(req, cb);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    cb(null, buildSafeUploadedFilename(file.originalname));
  },
});

// ==========================================
// MULTER LIMITS
// ==========================================

export const uploadLimits = {
  fileSize: 10 * 1024 * 1024, // 10 MB max
  files: 1, // Single file upload
  fields: 24,
  parts: 48,
  fieldSize: 256 * 1024, // 256 KB per field
  fieldNameSize: 256,
  headerPairs: 1000,
};

// ==========================================
// MULTER INSTANCE
// ==========================================

export const upload = multer({
  storage,
  limits: uploadLimits,
  fileFilter: fileFilter as any,
});
