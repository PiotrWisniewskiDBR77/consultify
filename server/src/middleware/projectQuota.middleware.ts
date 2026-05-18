// @ts-nocheck
/**
 * Project Quota Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces storage limits per project
 */

import { NextFunction, Request, Response } from 'express';
import * as fs from 'fs';
import os from 'os';
import path from 'path';

import usageService from '../services/usageService.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface UsageService {
  checkProjectQuota: (projectId: string) => Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    percentage: number;
  }>;
}

interface FileRequest extends Request {
  file?: any;
  body: any;
  query: any;
}

interface Dependencies {
  usageService: UsageService;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = { usageService };

const MAX_PROJECT_ID_LENGTH = 256;
const DEFAULT_TIMEOUT_MS = 8000;

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(typeof value === 'string' ? value : String(value));

const safeNext = (next: NextFunction, error?: unknown): void => {
  if (typeof next !== 'function') return;
  try {
    if (error !== undefined) next(error as any);
    else next();
  } catch {
    // Keep middleware fail-safe.
  }
};

const isCommitted = (res: Response): boolean =>
  Boolean((res as any).headersSent || (res as any).writableEnded);

const safeRead = <T>(reader: () => T): T | undefined => {
  try {
    return reader();
  } catch {
    return undefined;
  }
};

const coerceProjectId = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const coercePath = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const isValidProjectId = (projectId: string): boolean => {
  if (projectId.length > MAX_PROJECT_ID_LENGTH) return false;
  if (projectId.includes('..')) return false;
  if (projectId.includes('/') || projectId.includes('\\')) return false;
  return true;
};

const sanitizeNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const readTimeoutMs = (): number => {
  const fromEnv = Number(process.env.PROJECT_QUOTA_CHECK_TIMEOUT_MS);
  if (!Number.isFinite(fromEnv) || fromEnv <= 0) return DEFAULT_TIMEOUT_MS;
  return fromEnv;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('PROJECT_QUOTA_TIMEOUT')), timeoutMs);
    }),
  ]);
};

const responseJsonSafe = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): Error | null => {
  if (isCommitted(res)) return new Error('Response already committed');
  try {
    const statusWriter = (res as any).status;
    if (typeof statusWriter !== 'function') {
      return new Error('Response status writer is not callable');
    }
    const target = statusWriter.call(res, statusCode);
    const jsonWriter = target?.json;
    if (typeof jsonWriter !== 'function') {
      return new Error('Response json writer is not callable');
    }
    jsonWriter.call(target, payload);
    return null;
  } catch (error) {
    return toError(error);
  }
};

const isPathInsideRoot = (candidatePath: string, rootPath: string): boolean => {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedCandidate = path.resolve(candidatePath);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  );
};

const canCleanupTempFile = (candidatePath: string): boolean => {
  const tmpRoot = fs.realpathSync(os.tmpdir());
  try {
    const realPath = fs.realpathSync(candidatePath);
    return isPathInsideRoot(realPath, tmpRoot);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      const resolved = path.resolve(candidatePath);
      return isPathInsideRoot(resolved, tmpRoot) || isPathInsideRoot(resolved, os.tmpdir());
    }
    return false;
  }
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Enforce project storage quota
 */
export async function enforceProjectQuota(
  req: FileRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { usageService } = deps;
    const body = safeRead(() => req.body);
    const query = safeRead(() => req.query);

    const projectId =
      coerceProjectId((body as any)?.project_id) ?? coerceProjectId((query as any)?.projectId);

    // If no project specified, skip project-level check (falls back to Org check)
    if (!projectId) {
      safeNext(next);
      return;
    }

    if (!isValidProjectId(projectId)) {
      const writeErr = responseJsonSafe(res, 400, {
        error: 'Invalid project ID',
        code: 'INVALID_PROJECT_ID',
      });
      if (writeErr) safeNext(next, writeErr);
      return;
    }

    const timeoutMs = readTimeoutMs();
    const quota = await withTimeout(usageService.checkProjectQuota(projectId), timeoutMs);

    if (!quota || typeof quota.allowed !== 'boolean') {
      const malformedWriteError = responseJsonSafe(res, 500, {
        error: 'Failed to verify project quota',
      });
      if (malformedWriteError) safeNext(next, malformedWriteError);
      return;
    }

    if (!quota.allowed) {
      // Cleanup temp file if it exists (since we are rejecting after upload)
      const filePathValue = safeRead(() => req.file?.path);
      const filePath = coercePath(filePathValue);
      if (filePath && canCleanupTempFile(filePath)) {
        try {
          await fs.promises.unlink(filePath);
        } catch (e: unknown) {
          const err = e as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') {
            logger.error('Failed to cleanup temp file:', e);
          }
        }
      }

      const deniedWriteError = responseJsonSafe(res, 429, {
        error: 'Project storage quota exceeded',
        code: 'PROJECT_STORAGE_EXCEEDED',
        usage: {
          usedGB: (sanitizeNumber(quota.used) / (1024 * 1024 * 1024)).toFixed(2),
          limitGB: (sanitizeNumber(quota.limit) / (1024 * 1024 * 1024)).toFixed(2),
          percentage: sanitizeNumber(quota.percentage).toFixed(1),
        },
        message: 'This project has exceeded its storage limit.',
      });
      if (deniedWriteError) {
        safeNext(next, new Error('Failed to send project quota exceeded response'));
      }
      return;
    }

    safeNext(next);
  } catch (error: unknown) {
    logger.error('Project quota check error:', error);
    // Fail closed for safety
    const normalizedError = toError(error);
    if (isCommitted(res)) {
      safeNext(next, normalizedError);
      return;
    }
    const writeErr = responseJsonSafe(res, 500, { error: 'Failed to verify project quota' });
    if (writeErr) {
      safeNext(next, normalizedError);
    }
  }
}

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
