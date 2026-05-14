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

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};
const invokeNextSafely = (next: NextFunction, err?: Error): void => {
  try {
    if (typeof next === 'function') {
      next(err);
    }
  } catch {
    // fail-open: quota middleware should not crash request lifecycle
  }
};
const PROJECT_QUOTA_CHECK_TIMEOUT_MS = 8_000;
const readCheckTimeoutMs = (): number => {
  const raw = Number(process.env.PROJECT_QUOTA_CHECK_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return PROJECT_QUOTA_CHECK_TIMEOUT_MS;
  return Math.min(Math.trunc(raw), 60_000);
};
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Project quota check timed out'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};
const normalizeProjectIdInput = (value: unknown): string | undefined => {
  const normalizedString = normalizeOptionalString(value);
  if (normalizedString) return normalizedString;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const safeToFixed = (value: unknown, decimals: number, fallback: string): string => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : fallback;
};
const isResponseTerminal = (res: Response): boolean =>
  safeRead(() => res.headersSent, false) ||
  safeRead(() => (res as Response & { writableEnded?: boolean }).writableEnded === true, false) ||
  safeRead(() => (res as Response & { destroyed?: boolean }).destroyed === true, false);

const sendJsonIfHeadersOpen = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean => {
  if (isResponseTerminal(res)) return false;
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch {
    return false;
  }
};
const PROJECT_QUOTA_UPLOAD_ROOT = path.resolve(process.env.UPLOAD_TMP_DIR || os.tmpdir());
const PROJECT_QUOTA_UPLOAD_ROOT_REAL = safeRead(
  () => fs.realpathSync(PROJECT_QUOTA_UPLOAD_ROOT),
  PROJECT_QUOTA_UPLOAD_ROOT
);
const MAX_PROJECT_ID_LENGTH = 256;
const PROJECT_ID_DISALLOWED_CHARS = /[\/\\\u0000]/;
const hasUnsafeProjectIdShape = (projectId: string): boolean =>
  PROJECT_ID_DISALLOWED_CHARS.test(projectId) || projectId.includes('..');
const canSafelyCleanupFilePath = (filePath: string): boolean => {
  const resolved = path.resolve(filePath);
  if (!resolved) return false;
  const realResolved = safeRead(() => fs.realpathSync(resolved), resolved);
  return (
    realResolved === PROJECT_QUOTA_UPLOAD_ROOT_REAL ||
    realResolved.startsWith(`${PROJECT_QUOTA_UPLOAD_ROOT_REAL}${path.sep}`)
  );
};
const toMiddlewareError = (caught: unknown): Error => {
  if (caught instanceof Error) return caught;
  if (typeof caught === 'string') return new Error(caught);
  try {
    const serialized = JSON.stringify(caught);
    return new Error(serialized || 'Non-Error rejection');
  } catch {
    return new Error('Non-Error rejection');
  }
};

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

    const projectId =
      normalizeProjectIdInput(safeRead(() => req.body?.project_id, undefined)) ||
      normalizeProjectIdInput(safeRead(() => req.query?.projectId, undefined));

    // If no project specified, skip project-level check (falls back to Org check)
    if (!projectId) {
      invokeNextSafely(next);
      return;
    }
    if (projectId.length > MAX_PROJECT_ID_LENGTH) {
      if (
        !sendJsonIfHeadersOpen(res, 400, {
          error: 'Invalid project id',
          code: 'INVALID_PROJECT_ID',
        })
      ) {
        invokeNextSafely(next, new Error('Invalid project id'));
      }
      return;
    }
    if (hasUnsafeProjectIdShape(projectId)) {
      if (
        !sendJsonIfHeadersOpen(res, 400, {
          error: 'Invalid project id',
          code: 'INVALID_PROJECT_ID',
        })
      ) {
        invokeNextSafely(next, new Error('Invalid project id'));
      }
      return;
    }

    const quota = await withTimeout(
      usageService.checkProjectQuota(projectId),
      readCheckTimeoutMs()
    );
    if (!quota || typeof quota !== 'object' || typeof quota.allowed !== 'boolean') {
      logger.error('Invalid project quota payload');
      if (!sendJsonIfHeadersOpen(res, 500, { error: 'Failed to verify project quota' })) {
        invokeNextSafely(next, new Error('Failed to verify project quota'));
      }
      return;
    }

    if (!quota.allowed) {
      // Cleanup temp file if it exists (since we are rejecting after upload)
      const filePath = normalizeOptionalString(safeRead(() => req.file?.path, undefined));
      if (filePath) {
        try {
          if (canSafelyCleanupFilePath(filePath)) {
            await fs.promises.unlink(filePath);
          } else {
            logger.warn('Skipped project quota temp cleanup outside upload root', {
              filePath: path.basename(filePath),
            });
          }
        } catch (e: unknown) {
          if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
            // Missing temporary file is safe to ignore.
          } else {
          logger.error('Failed to cleanup temp file:', e);
          }
        }
      }

      if (
        !sendJsonIfHeadersOpen(res, 429, {
        error: 'Project storage quota exceeded',
        code: 'PROJECT_STORAGE_EXCEEDED',
        usage: {
          usedGB: safeToFixed(quota.used / (1024 * 1024 * 1024), 2, '0.00'),
          limitGB: safeToFixed(quota.limit / (1024 * 1024 * 1024), 2, '0.00'),
          percentage: safeToFixed(quota.percentage, 1, '0.0'),
        },
        message: 'This project has exceeded its storage limit.',
      })
      ) {
        invokeNextSafely(next, new Error('Failed to send project quota exceeded response'));
      }
      return;
    }

    invokeNextSafely(next);
  } catch (error: unknown) {
    logger.error('Project quota check error:', error);
    const middlewareError = toMiddlewareError(error);
    // Fail closed for safety
    if (isResponseTerminal(res)) {
      invokeNextSafely(next, middlewareError);
      return;
    }
    if (!sendJsonIfHeadersOpen(res, 500, { error: 'Failed to verify project quota' })) {
      invokeNextSafely(next, middlewareError);
    }
    return;
  }
}

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
