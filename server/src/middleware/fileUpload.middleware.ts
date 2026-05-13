/**
 * File Upload Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Secure file upload handling for assessment documents
 */

import { Request } from 'express';
import { randomBytes } from 'node:crypto';
import * as fs from 'fs';
import multer from 'multer';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type { AuthRequest } from './auth.middleware.js';

// ESM-safe __dirname (__dirname is not defined when "type": "module")
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// TYPES
// ==========================================

interface _FileRequest extends AuthRequest {
  file?: Express.Multer.File;
}

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const readOrgId = (req: Request): string =>
  normalizeOptionalString(safeRead(() => (req as AuthRequest).user?.organizationId, undefined)) ||
  normalizeOptionalString(safeRead(() => (req as AuthRequest).user?.organization_id, undefined)) ||
  'unknown';
const MAX_UPLOAD_ORG_ID_CHARS = 128;
const MAX_UPLOAD_BASENAME_CHARS = 120;
export const sanitizeOrgIdForUploadPath = (value: unknown): string => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return 'unknown';
  if (normalized.length > MAX_UPLOAD_ORG_ID_CHARS) return 'unknown';
  if (normalized === '.' || normalized === '..') return 'unknown';
  if (normalized.includes('..') || /[/\\\u0000]/.test(normalized)) return 'unknown';
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) return 'unknown';
  return normalized;
};
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const normalizeMimeType = (value: string): string => value.split(';')[0]?.trim().toLowerCase() || '';

export const buildSafeUploadedFilename = (originalname: unknown): string => {
  const normalizedOriginalName = normalizeOptionalString(originalname) || 'upload.bin';
  const ext = path.extname(normalizedOriginalName);
  const basename = path.basename(normalizedOriginalName, ext) || 'upload';
  const safeBasename =
    basename.length > MAX_UPLOAD_BASENAME_CHARS
      ? basename.slice(0, MAX_UPLOAD_BASENAME_CHARS)
      : basename;
  const entropy = randomBytes(8).toString('hex');
  const uniqueSuffix = `${Date.now()}-${entropy}`;
  return `${uniqueSuffix}-${safeBasename}${ext}`;
};
const assessmentsUploadRoot = path.resolve(path.join(__dirname, '../../../uploads/assessments'));
const isPathInsideDir = (baseDir: string, candidatePath: string): boolean => {
  const relative = path.relative(baseDir, candidatePath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
};
export const resolveAssessmentUploadDir = (req: Request): string => {
  const orgId = sanitizeOrgIdForUploadPath(readOrgId(req));
  const dir = path.resolve(path.join(assessmentsUploadRoot, orgId));
  if (!isPathInsideDir(assessmentsUploadRoot, dir)) {
    throw new Error('Upload path outside assessments root');
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// ==========================================
// STORAGE CONFIGURATION
// ==========================================

/**
 * Storage configuration
 */
const storage = multer.diskStorage({
  destination: (
    req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    try {
      const dir = resolveAssessmentUploadDir(req);
      cb(null, dir);
    } catch (error) {
      cb(error instanceof Error ? error : new Error('Upload workspace unavailable'), '');
    }
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const safeFilename = buildSafeUploadedFilename(safeRead(() => file.originalname, undefined));
    cb(null, safeFilename);
  },
});

/**
 * File filter - only allow PDF, Excel, Word
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void
): void => {
  const allowedExts = /pdf|xlsx|xls|docx|doc/;
  const allowedMimes = /pdf|spreadsheet|document|msword|ms-excel/;

  const originalName =
    normalizeOptionalString(safeRead(() => file.originalname, undefined)) || 'unknown.file';
  const mimeType =
    normalizeMimeType(normalizeOptionalString(safeRead(() => file.mimetype, undefined)) || '');
  const extname = safeRead(() => allowedExts.test(path.extname(originalName).toLowerCase()), false);
  const mimetype = safeRead(() => ALLOWED_MIME_TYPES.has(mimeType), false);

  if (extname && mimetype) {
    return cb(null, true);
  }

  cb(createDisallowedFileTypeError(), false);
};

/**
 * Multer upload middleware
 */
export const uploadLimits = {
  fileSize: 10 * 1024 * 1024, // 10MB max
  files: 1, // Single file upload
  fields: 24,
  parts: 48,
  fieldSize: 256 * 1024, // 256KB max text field payload
  fieldNameSize: 256,
  headerPairs: 1000,
};

export const FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE =
  'Only PDF, Excel, and Word documents are allowed';
export const FILE_UPLOAD_DISALLOWED_TYPE_CODE = 'FILE_UPLOAD_DISALLOWED_TYPE' as const;

const createDisallowedFileTypeError = (): Error => {
  const err = new Error(FILE_UPLOAD_DISALLOWED_TYPE_MESSAGE) as Error & {
    code?: typeof FILE_UPLOAD_DISALLOWED_TYPE_CODE;
  };
  err.code = FILE_UPLOAD_DISALLOWED_TYPE_CODE;
  return err;
};

export const upload = multer({
  storage,
  limits: uploadLimits,
  fileFilter: fileFilter as any,
});

export { fileFilter, isPathInsideDir };
