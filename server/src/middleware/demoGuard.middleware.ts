/**
 * Demo Guard Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides demo mode protection and context
 */

import type { NextFunction, Request, Response } from 'express';

import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// CONSTANTS
// ==========================================

export const DEMO_ORG_ID = process.env.DEMO_ORG_ID || 'demo-org';
export const DEMO_ORG_NAME = process.env.DEMO_ORG_NAME || 'Demo Organization';
export const DEMO_SESSION_ORG_HEADER = 'X-Demo-Session-Org';
const MAX_DEMO_ORG_ID_CHARS = 128;
const MAX_DEMO_GUARD_URL_CHARS = 8192;
const MAX_DEMO_MODE_HEADER_CHARS = 64;
const MAX_DEMO_USER_ID_CHARS = 128;
const DEMO_PREF_KEY = 'demo:enabled';
const DEMO_STARTED_AT_KEY = 'demo:started_at';

// ==========================================
// TYPES
// ==========================================

export interface DemoOrganization {
  id: string;
  name: string;
  slug: string;
  description: string;
  settings: Record<string, unknown>;
}

export interface DemoStats {
  projects: number;
  initiatives: number;
  tasks: number;
  decisions: number;
  users: number;
}

type DemoRequest = Request & {
  demo?: {
    enabled: boolean;
    organizationId: string;
  };
};

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch {
    return fallback;
  }
}

function safeWrite(writer: () => void): boolean {
  try {
    writer();
    return true;
  } catch {
    return false;
  }
}

function responseWriteBlocked(res: Response): boolean {
  return Boolean(
    safeRead(() => res.headersSent, false) ||
      safeRead(() => (res as Response & { writableEnded?: boolean }).writableEnded === true, false) ||
      safeRead(() => (res as Response & { finished?: boolean }).finished === true, false) ||
      safeRead(() => (res as Response & { destroyed?: boolean }).destroyed === true, false)
  );
}

function sanitizeDemoOrgIdCandidate(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (normalized.length > MAX_DEMO_ORG_ID_CHARS) return '';
  if (!/^[a-zA-Z0-9_.:-]+$/.test(normalized)) return '';
  return normalized;
}

function sanitizeDemoPreferenceUserId(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  if (!normalized) return undefined;
  if (normalized.length > MAX_DEMO_USER_ID_CHARS) return undefined;
  return normalized;
}

function normalizeOrgIdForDemoComparison(value: unknown): string {
  return String(value ?? '').trim();
}

function isDemoModeHeaderTrue(value: unknown): boolean {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > MAX_DEMO_MODE_HEADER_CHARS) return false;
  const lowered = normalized.toLowerCase();
  return lowered === 'true' || lowered === '1';
}

function stripPathOnly(url: string): string {
  return url.split('?')[0]?.split('#')[0] || '';
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Demo context middleware - attaches demo context to request
 */
export const demoContextMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const isDemoHeader = isDemoModeHeaderTrue(safeRead(() => req.get?.('X-Demo-Mode'), ''));
  if (isDemoHeader) {
    const requestedSessionOrgId = sanitizeDemoOrgIdCandidate(
      safeRead(() => req.get?.(DEMO_SESSION_ORG_HEADER), '')
    );
    const effectiveOrgId = requestedSessionOrgId || DEMO_ORG_ID;
    (req as DemoRequest).demo = { enabled: true, organizationId: effectiveOrgId };
    // Legacy compatibility: many routes read org context from req/user.
    safeWrite(() => {
      (req as any).organizationId = effectiveOrgId;
    });
    const requestUser = safeRead(() => (req as any).user, undefined as unknown);
    if (requestUser && typeof requestUser === 'object') {
      safeWrite(() => {
        (requestUser as any).organizationId = effectiveOrgId;
      });
      safeWrite(() => {
        (requestUser as any).organization_id = effectiveOrgId;
      });
    }
  }
  next();
};

/**
 * Demo write protection - prevents writes in demo mode
 * Defense in depth: blocks when X-Demo-Mode header OR when target org is demo-org
 */
export const demoWriteProtection = (options: { allowedRoutes?: string[] } = {}) => {
  const allowedRoutes = Array.isArray(options.allowedRoutes)
    ? options.allowedRoutes.filter(
        (prefix): prefix is string => typeof prefix === 'string' && prefix.length > 0
      )
    : [];

  return (req: Request, res: Response, next: NextFunction): void => {
    const method = String(safeRead(() => req.method, '') || '').toUpperCase();
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (!isWrite) return next();

    const originalUrl = String(safeRead(() => req.originalUrl, '') || '').trim();
    const fallbackUrl = String(safeRead(() => req.url, '') || '').trim();
    const url = originalUrl || fallbackUrl;
    const pathForAllowlist =
      url.length > MAX_DEMO_GUARD_URL_CHARS ? '' : stripPathOnly(url);
    const isAllowed = allowedRoutes.some((prefix) => pathForAllowlist.startsWith(prefix));
    if (isAllowed) return next();

    const isDemoHeader = isDemoModeHeaderTrue(safeRead(() => req.get?.('X-Demo-Mode'), ''));
    const requestedSessionOrgId = sanitizeDemoOrgIdCandidate(
      safeRead(() => req.get?.(DEMO_SESSION_ORG_HEADER), '')
    );
    const orgId =
      safeRead(() => (req as DemoRequest).demo?.organizationId, undefined) ??
      safeRead(() => (req as any).organizationId, undefined) ??
      safeRead(() => (req as any).user?.organizationId, undefined) ??
      safeRead(() => (req as any).user?.organization_id, undefined);
    const isDemoOrg = normalizeOrgIdForDemoComparison(orgId) === normalizeOrgIdForDemoComparison(DEMO_ORG_ID);
    const isInteractiveSession =
      Boolean(requestedSessionOrgId) && requestedSessionOrgId !== DEMO_ORG_ID;

    if ((isDemoHeader && !isInteractiveSession) || isDemoOrg) {
      if (responseWriteBlocked(res)) {
        next();
        return;
      }
      try {
        safeWrite(() => {
          res.setHeader('Cache-Control', 'no-store');
        });
        safeWrite(() => {
          res.setHeader('Pragma', 'no-cache');
        });
        res.status(403).json({
          error: 'Demo mode is read-only',
          code: 'DEMO_READ_ONLY',
        });
      } catch (error) {
        next(error as Error);
      }
      return;
    }

    next();
  };
};

/**
 * Demo guard - alias for demoContextMiddleware
 */
export const demoGuard = demoContextMiddleware;

// ==========================================
// HELPERS
// ==========================================

function isMissingTableError(error: unknown): boolean {
  const message = (error as any)?.message;
  if (typeof message !== 'string') return false;
  return (
    message.includes('no such table') ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('Database not initialized')
  );
}

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }
  return false;
}

async function requireUserPreferencesTable(): Promise<void> {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS user_preferences (
       user_id TEXT NOT NULL,
       key TEXT NOT NULL,
       value TEXT NOT NULL,
       updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (user_id, key)
     )`,
    [],
    { fallback: false }
  );
  await dbRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_user_key ON user_preferences(user_id, key)`,
    [],
    { fallback: true }
  );
}

/**
 * Check if user has demo preference enabled
 */
export const checkUserDemoPreference = async (userId: string): Promise<boolean> => {
  const sanitizedUserId = sanitizeDemoPreferenceUserId(userId);
  if (!sanitizedUserId) return false;
  try {
    await requireUserPreferencesTable();
    const row = await dbGet<{ value: string }>(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
      [sanitizedUserId, DEMO_PREF_KEY],
      { fallback: false }
    );
    if (!row?.value) return false;
    try {
      return parseBool(JSON.parse(row.value));
    } catch {
      return parseBool(row.value);
    }
  } catch (error: unknown) {
    if (isMissingTableError(error)) throw new Error('Demo preference storage unavailable');
    throw error;
  }
};

/**
 * Set user demo preference and optionally demo_started_at (for duration tracking)
 */
export const setUserDemoPreference = async (
  userId: string,
  enabled: boolean,
  options?: { setStartedAt?: boolean }
): Promise<void> => {
  const sanitizedUserId = sanitizeDemoPreferenceUserId(userId);
  if (!sanitizedUserId) throw new Error('Invalid demo preference user id');
  try {
    await requireUserPreferencesTable();
    const payload = JSON.stringify(Boolean(enabled));
    const now = new Date().toISOString();

    await dbRun(
      `DELETE FROM user_preferences WHERE user_id = ? AND key = ?`,
      [sanitizedUserId, DEMO_PREF_KEY],
      { fallback: true }
    );
    await dbRun(
      `INSERT INTO user_preferences (user_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)`,
      [sanitizedUserId, DEMO_PREF_KEY, payload, now],
      { fallback: false }
    );

    if (enabled && options?.setStartedAt !== false) {
      await setDemoStartedAt(sanitizedUserId, now);
    }
  } catch (error: unknown) {
    if (isMissingTableError(error)) throw new Error('Demo preference storage unavailable');
    throw error;
  }
};

/**
 * Set demo_started_at timestamp (for duration tracking and follow-up)
 */
export const setDemoStartedAt = async (userId: string, isoDate?: string): Promise<void> => {
  const sanitizedUserId = sanitizeDemoPreferenceUserId(userId);
  if (!sanitizedUserId) throw new Error('Invalid demo preference user id');
  const value = isoDate || new Date().toISOString();
  await requireUserPreferencesTable();

  await dbRun(
    `DELETE FROM user_preferences WHERE user_id = ? AND key = ?`,
    [sanitizedUserId, DEMO_STARTED_AT_KEY],
    { fallback: true }
  );
  await dbRun(
    `INSERT INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)`,
    [sanitizedUserId, DEMO_STARTED_AT_KEY, value, value],
    { fallback: false }
  );
};

/**
 * Get demo_started_at timestamp (ISO string or null)
 */
export const getDemoStartedAt = async (userId: string): Promise<string | null> => {
  const sanitizedUserId = sanitizeDemoPreferenceUserId(userId);
  if (!sanitizedUserId) return null;
  try {
    await requireUserPreferencesTable();
    const row = await dbGet<{ value: string }>(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
      [sanitizedUserId, DEMO_STARTED_AT_KEY],
      { fallback: false }
    );
    return row?.value && typeof row.value === 'string' ? row.value : null;
  } catch (error: unknown) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
};

/**
 * Get demo organization
 */
export const getDemoOrganization = async (
  organizationId: string = DEMO_ORG_ID
): Promise<DemoOrganization> => {
  try {
    const org = await dbGet<{ id: string; name: string }>(
      `SELECT id, name FROM organizations WHERE id = ?`,
      [organizationId],
      { fallback: false }
    );
    if (!org?.id) throw new Error('Demo organization not configured');

    return {
      id: org.id,
      name: org.name || DEMO_ORG_NAME,
      slug: process.env.DEMO_ORG_SLUG || 'demo-org',
      description: process.env.DEMO_ORG_DESCRIPTION || 'Demo organization',
      settings: {},
    };
  } catch (error: unknown) {
    if (isMissingTableError(error)) throw new Error('Demo organization storage unavailable');
    throw error;
  }
};

/**
 * Get demo statistics
 */
export const getDemoStats = async (organizationId: string = DEMO_ORG_ID): Promise<DemoStats> => {
  try {
    const [projects, initiatives, tasks, decisions, users] = await Promise.all([
      dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM projects WHERE organization_id = ?`,
        [organizationId],
        { fallback: false }
      ),
      dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM initiatives WHERE organization_id = ?`,
        [organizationId],
        { fallback: false }
      ),
      dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM tasks WHERE organization_id = ?`,
        [organizationId],
        {
          fallback: false,
        }
      ),
      dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM decisions WHERE organization_id = ?`,
        [organizationId],
        { fallback: false }
      ),
      dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM users WHERE organization_id = ?`,
        [organizationId],
        {
          fallback: false,
        }
      ),
    ]);

    const toCount = (value: unknown): number => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    };
    return {
      projects: toCount(projects?.c),
      initiatives: toCount(initiatives?.c),
      tasks: toCount(tasks?.c),
      decisions: toCount(decisions?.c),
      users: toCount(users?.c),
    };
  } catch (error: unknown) {
    if (isMissingTableError(error)) throw new Error('Demo statistics unavailable');
    throw error;
  }
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default demoContextMiddleware;
