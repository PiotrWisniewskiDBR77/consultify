import express, { type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import config from '../config/Config.js';
import adminAuditService from '../services/adminAuditService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = express.Router();

function makeSignedToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });
}

function deny(res: Response) {
  // Intentionally looks like a missing route (to avoid hinting at capabilities).
  return res.status(404).json({ error: 'Not found' });
}

function assertEnabled(req: Request, res: Response): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.NODE_ENV !== 'test') return false;
  if (process.env.ENABLE_TEST_SUPPORT !== 'true') return false;

  const expected = process.env.TEST_SUPPORT_KEY;
  const got = req.header('x-test-support-key');
  if (!expected || expected.length < 12) return false;
  if (!got || got !== expected) return false;

  return true;
}

async function ensureRunsTable() {
  await DbPromise.exec(`
    CREATE TABLE IF NOT EXISTS test_support_runs (
      run_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function listTables(): Promise<string[]> {
  const isPg =
    process.env.DB_TYPE === 'postgres' ||
    (!process.env.DB_TYPE && process.env.DATABASE_URL?.startsWith('postgres'));
  const rows = isPg
    ? await DbPromise.all<{ name: string }>(
        `SELECT table_name as name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
        [],
        { fallback: false }
      )
    : await DbPromise.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
        [],
        { fallback: false }
      );
  return rows.map((r) => r.name).filter((t) => typeof t === 'string' && t.length > 0);
}

async function listColumns(table: string): Promise<string[]> {
  const isPg =
    process.env.DB_TYPE === 'postgres' ||
    (!process.env.DB_TYPE && process.env.DATABASE_URL?.startsWith('postgres'));
  const rows = isPg
    ? await DbPromise.all<{ name: string }>(
        `SELECT column_name as name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ?`,
        [table],
        { fallback: false }
      )
    : await DbPromise.all<{ name: string }>(`PRAGMA table_info(${table})`, [], { fallback: false });
  return rows.map((r) => r.name).filter((c) => typeof c === 'string' && c.length > 0);
}

async function purgeByOrganizationId(organizationId: string): Promise<void> {
  const tables = await listTables();
  for (const table of tables) {
    // Table names come from the DB, but we still harden to avoid SQL injection.
    if (!/^[a-zA-Z0-9_]+$/.test(table)) continue;
    if (table === 'organizations') continue;
    if (table === 'users') continue;

    let columns: string[];
    try {
      columns = await listColumns(table);
    } catch {
      continue;
    }

    const hasOrganizationId = columns.includes('organization_id');
    const hasOrgId = columns.includes('org_id');
    if (!hasOrganizationId && !hasOrgId) continue;

    const col = hasOrganizationId ? 'organization_id' : 'org_id';
    try {
      await DbPromise.run(`DELETE FROM ${table} WHERE ${col} = ?`, [organizationId], {
        fallback: false,
      });
    } catch (e) {
      logger.warn('[TestSupport] purgeByOrganizationId delete failed (continuing)', {
        table,
        error: (e as Error)?.message || e,
      });
    }
  }
}

router.post(
  '/bootstrap',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const runId = String(req.body?.runId || '').trim();
    if (!runId || runId.length > 128) {
      return res.status(400).json({ error: 'runId is required' });
    }

    await ensureRunsTable();

    const existing = await DbPromise.get<{
      run_id: string;
      organization_id: string;
      user_id: string;
    }>(`SELECT run_id, organization_id, user_id FROM test_support_runs WHERE run_id = ?`, [runId], {
      fallback: false,
    });

    let organizationId = existing?.organization_id || '';
    let userId = existing?.user_id || '';

    if (!organizationId || !userId) {
      organizationId = uuidv4();
      userId = uuidv4();
      const memberId = uuidv4();
      const email = `e2e+${runId.replace(/[^a-zA-Z0-9_.-]/g, '-')}`.slice(0, 64) + '@local.test';

      await DbPromise.run(
        `INSERT INTO organizations (id, name, plan, status, is_active)
         VALUES (?, ?, ?, ?, ?)`,
        [organizationId, `E2E Tenant (${runId})`, 'enterprise', 'active', 1],
        { fallback: false }
      );

      await DbPromise.run(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, organizationId, email, 'e2e-not-used', 'ADMIN', 'active', 'E2E', 'Admin'],
        { fallback: false }
      );

      // Try to include permission_scope when the schema supports it.
      try {
        await DbPromise.run(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status, permission_scope)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [memberId, organizationId, userId, 'ADMIN', 'ACTIVE', JSON.stringify({ '*': true })],
          { fallback: false }
        );
      } catch {
        await DbPromise.run(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status)
           VALUES (?, ?, ?, ?, ?)`,
          [memberId, organizationId, userId, 'ADMIN', 'ACTIVE'],
          { fallback: false }
        );
      }

      await DbPromise.run(
        `INSERT INTO test_support_runs (run_id, organization_id, user_id)
         VALUES (?, ?, ?)`,
        [runId, organizationId, userId],
        { fallback: false }
      );
    }

    const token = makeSignedToken({
      id: userId,
      email: `e2e+${runId}@local.test`,
      name: 'E2E Admin',
      role: 'ADMIN',
      organizationId,
      runId,
      jti: uuidv4(),
    });

    try {
      await adminAuditService.logAction({
        adminId: 'test-support',
        actionType: 'test_support_bootstrap',
        details: { runId, organizationId, env: process.env.NODE_ENV },
      });
    } catch {
      /* audit best-effort */
    }

    return res.status(200).json({
      runId,
      organizationId,
      userId,
      token,
    });
  })
);

router.post(
  '/cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    if (!assertEnabled(req, res)) return deny(res);

    const runId = String(req.body?.runId || '').trim();
    if (!runId || runId.length > 128) {
      return res.status(400).json({ error: 'runId is required' });
    }

    await ensureRunsTable();

    const existing = await DbPromise.get<{
      run_id: string;
      organization_id: string;
      user_id: string;
    }>(`SELECT run_id, organization_id, user_id FROM test_support_runs WHERE run_id = ?`, [runId], {
      fallback: false,
    });

    if (!existing) {
      return res.status(200).json({ ok: true, runId, deleted: false });
    }

    await purgeByOrganizationId(existing.organization_id);

    // Delete users/org at the end
    await DbPromise.run(`DELETE FROM users WHERE id = ?`, [existing.user_id], { fallback: false });
    await DbPromise.run(`DELETE FROM organizations WHERE id = ?`, [existing.organization_id], {
      fallback: false,
    });
    await DbPromise.run(`DELETE FROM test_support_runs WHERE run_id = ?`, [runId], {
      fallback: false,
    });

    try {
      await adminAuditService.logAction({
        adminId: 'test-support',
        actionType: 'test_support_cleanup',
        details: { runId, organizationId: existing.organization_id, env: process.env.NODE_ENV },
      });
    } catch {
      /* audit best-effort */
    }

    return res.status(200).json({ ok: true, runId, deleted: true });
  })
);

export default router;
