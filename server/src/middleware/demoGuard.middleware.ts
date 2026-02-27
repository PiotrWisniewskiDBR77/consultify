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
const DEMO_PREF_KEY = 'demo:enabled';

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

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Demo context middleware - attaches demo context to request
 */
export const demoContextMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const isDemoHeader = String(req.get('X-Demo-Mode') || '').toLowerCase() === 'true';
  if (isDemoHeader) {
    (req as DemoRequest).demo = { enabled: true, organizationId: DEMO_ORG_ID };
    // Legacy compatibility: many routes read org context from req/user.
    (req as any).organizationId = DEMO_ORG_ID;
    if ((req as any).user && typeof (req as any).user === 'object') {
      (req as any).user.organizationId = DEMO_ORG_ID;
      (req as any).user.organization_id = DEMO_ORG_ID;
    }
  }
  next();
};

/**
 * Demo write protection - prevents writes in demo mode
 */
export const demoWriteProtection = (options: { allowedRoutes?: string[] } = {}) => {
  const allowedRoutes = Array.isArray(options.allowedRoutes) ? options.allowedRoutes : [];

  return (req: Request, res: Response, next: NextFunction): void => {
    const isDemoHeader = String(req.get('X-Demo-Mode') || '').toLowerCase() === 'true';
    if (!isDemoHeader) return next();

    const method = String(req.method || '').toUpperCase();
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (!isWrite) return next();

    const url = String(req.originalUrl || req.url || '');
    const isAllowed = allowedRoutes.some((prefix) => url.startsWith(prefix));
    if (isAllowed) return next();

    res.status(403).json({
      error: 'Demo mode is read-only',
      code: 'DEMO_READ_ONLY',
    });
    return;
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
    `
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, key)
      )
    `,
    [],
    { fallback: false }
  );
}

/**
 * Check if user has demo preference enabled
 */
export const checkUserDemoPreference = async (userId: string): Promise<boolean> => {
  try {
    await requireUserPreferencesTable();
    const row = await dbGet<{ value: string }>(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, DEMO_PREF_KEY],
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
 * Set user demo preference
 */
export const setUserDemoPreference = async (userId: string, enabled: boolean): Promise<void> => {
  try {
    await requireUserPreferencesTable();
    const payload = JSON.stringify(Boolean(enabled));
    const now = new Date().toISOString();

    // Update-first strategy is portable across SQLite/Postgres and avoids ON CONFLICT
    // mismatches on environments with composite PK(user_id, key).
    const updated = await dbRun(
      `UPDATE user_preferences
       SET value = ?, updated_at = ?
       WHERE user_id = ? AND key = ?`,
      [payload, now, userId, DEMO_PREF_KEY],
      { fallback: false }
    );
    if ((updated.changes || 0) > 0) {
      return;
    }

    const inserted = await dbRun(
      `INSERT INTO user_preferences (user_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)`,
      [userId, DEMO_PREF_KEY, payload, now],
      { fallback: false }
    );
    if (!inserted.success) throw new Error(inserted.error || 'Failed to store demo preference');
  } catch (error: unknown) {
    if (isMissingTableError(error)) throw new Error('Demo preference storage unavailable');
    throw error;
  }
};

/**
 * Get demo organization
 */
export const getDemoOrganization = async (): Promise<DemoOrganization> => {
  try {
    const org = await dbGet<{ id: string; name: string }>(
      `SELECT id, name FROM organizations WHERE id = ?`,
      [DEMO_ORG_ID],
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
export const getDemoStats = async (): Promise<DemoStats> => {
  try {
    const [initiatives, tasks, decisions, users] = await Promise.all([
      dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM initiatives WHERE organization_id = ?`,
        [DEMO_ORG_ID],
        { fallback: false }
      ),
      dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM tasks WHERE organization_id = ?`,
        [DEMO_ORG_ID],
        {
          fallback: false,
        }
      ),
      dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM decisions WHERE organization_id = ?`,
        [DEMO_ORG_ID],
        { fallback: false }
      ),
      dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM users WHERE organization_id = ?`,
        [DEMO_ORG_ID],
        {
          fallback: false,
        }
      ),
    ]);

    return {
      initiatives: initiatives?.c || 0,
      tasks: tasks?.c || 0,
      decisions: decisions?.c || 0,
      users: users?.c || 0,
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
