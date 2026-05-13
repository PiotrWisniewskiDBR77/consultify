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

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const safeToFixed = (value: unknown, decimals: number, fallback: string): string => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : fallback;
};

const sendJsonIfHeadersOpen = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean => {
  const blocked =
    safeRead(() => res.headersSent, false) ||
    safeRead(() => (res as Response & { writableEnded?: boolean }).writableEnded === true, false) ||
    safeRead(() => (res as Response & { destroyed?: boolean }).destroyed === true, false);
  if (blocked) return false;
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch {
    return false;
  }
};
const PROJECT_QUOTA_UPLOAD_ROOT = path.resolve(process.env.UPLOAD_TMP_DIR || os.tmpdir());
const MAX_PROJECT_ID_LENGTH = 256;
const canSafelyCleanupFilePath = (filePath: string): boolean => {
  const resolved = path.resolve(filePath);
  if (!resolved) return false;
  return (
    resolved === PROJECT_QUOTA_UPLOAD_ROOT ||
    resolved.startsWith(`${PROJECT_QUOTA_UPLOAD_ROOT}${path.sep}`)
  );
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
      normalizeOptionalString(safeRead(() => req.body?.project_id, undefined)) ||
      normalizeOptionalString(safeRead(() => req.query?.projectId, undefined));

    // If no project specified, skip project-level check (falls back to Org check)
    if (!projectId) {
      next();
      return;
    }
    if (projectId.length > MAX_PROJECT_ID_LENGTH) {
      if (
        !sendJsonIfHeadersOpen(res, 400, {
          error: 'Invalid project id',
          code: 'INVALID_PROJECT_ID',
        })
      ) {
        next(new Error('Invalid project id'));
      }
      return;
    }

    const quota = await usageService.checkProjectQuota(projectId);
    if (!quota || typeof quota !== 'object' || typeof quota.allowed !== 'boolean') {
      logger.error('Invalid project quota payload');
      if (!sendJsonIfHeadersOpen(res, 500, { error: 'Failed to verify project quota' })) {
        next(new Error('Failed to verify project quota'));
      }
      return;
    }

    if (!quota.allowed) {
      // Cleanup temp file if it exists (since we are rejecting after upload)
      const filePath = normalizeOptionalString(safeRead(() => req.file?.path, undefined));
      if (filePath) {
        try {
          if (canSafelyCleanupFilePath(filePath)) {
            if (safeRead(() => fs.existsSync(filePath), false)) {
              fs.unlinkSync(filePath);
            }
          } else {
            logger.warn('Skipped project quota temp cleanup outside upload root', {
              filePath: path.basename(filePath),
            });
          }
        } catch (e: unknown) {
          logger.error('Failed to cleanup temp file:', e);
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
        next(new Error('Failed to send project quota exceeded response'));
      }
      return;
    }

    next();
  } catch (error: unknown) {
    logger.error('Project quota check error:', error);
    // Fail closed for safety
    if (!safeRead(() => res.headersSent, false)) {
      if (!sendJsonIfHeadersOpen(res, 500, { error: 'Failed to verify project quota' })) {
        next(error as Error);
      }
      return;
    }
    next(error as Error);
    return;
  }
}

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
