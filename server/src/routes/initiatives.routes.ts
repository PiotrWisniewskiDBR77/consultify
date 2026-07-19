/**
 * Initiatives Routes
 * CRUD for initiatives (assessment-sourced and others)
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/index.js';
import { requireInitiativeWriteAccess } from '../services/initiative/initiativeGovernanceGuard.js';
import logger from '../utils/Logger.js';
import { requireRequestOrganizationId } from '../utils/requestOrganization.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; email?: string };
}

// Helper to run a query and return all rows
const dbAll = <T = any>(sql: string, params: any[] = []): Promise<T[]> =>
  new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

const dbRun = (sql: string, params: any[] = []): Promise<void> =>
  new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(sql, params, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });

const dbGet = <T = any>(sql: string, params: any[] = []): Promise<T | null> =>
  new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(sql, params, (err: Error | null, row: T | null) => {
      if (err) reject(err);
      else resolve(row ?? null);
    });
  });

// Ensure initiatives table exists
async function ensureInitiativesTable() {
  await dbRun(`CREATE TABLE IF NOT EXISTS initiatives (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    title TEXT,
    description TEXT,
    status TEXT DEFAULT 'DRAFT',
    priority TEXT DEFAULT 'medium',
    impact TEXT DEFAULT 'medium',
    effort TEXT DEFAULT 'medium',
    category TEXT,
    source_type TEXT DEFAULT 'manual',
    source_id TEXT,
    report_id TEXT,
    report_name TEXT,
    estimated_budget REAL,
    estimated_timeline TEXT,
    created_by TEXT NOT NULL,
    updated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
}

// ============================================
// GET /api/initiatives — list initiatives
// ============================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    await ensureInitiativesTable();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const source = req.query?.source ? String(req.query.source) : null;
    const status = req.query?.status ? String(req.query.status) : null;
    const assessmentId = req.query?.assessmentId ? String(req.query.assessmentId) : null;

    const params: (string | number)[] = [organizationId];
    let sql = `
      SELECT 
        id, name, title, description, status, priority, impact, effort, category,
        source_type as "sourceType", source_id as "sourceId",
        report_id as "reportId", report_name as "reportName",
        estimated_budget as "estimatedBudget", estimated_timeline as "estimatedTimeline",
        created_by as "createdBy", updated_by as "updatedBy",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM initiatives
      WHERE organization_id = ?
    `;

    if (source) {
      sql += ` AND source_type = ?`;
      params.push(source);
    }
    if (status) {
      sql += ` AND UPPER(COALESCE(status,'DRAFT')) = ?`;
      params.push(status.toUpperCase());
    }
    if (assessmentId) {
      sql += ` AND source_id = ?`;
      params.push(assessmentId);
    }

    sql += ` ORDER BY updated_at DESC`;

    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (err: any) {
    logger.error('[initiatives] GET / error:', err?.message);
    res.status(500).json({ error: 'Failed to fetch initiatives' });
  }
});

// ============================================
// GET /api/initiatives/:id — get single initiative
// ============================================
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await ensureInitiativesTable();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const row = await dbGet(
      `SELECT 
        id, name, title, description, status, priority, impact, effort, category,
        source_type as "sourceType", source_id as "sourceId",
        report_id as "reportId", report_name as "reportName",
        estimated_budget as "estimatedBudget", estimated_timeline as "estimatedTimeline",
        created_by as "createdBy", updated_by as "updatedBy",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM initiatives WHERE id = ? AND organization_id = ?`,
      [req.params.id, organizationId]
    );
    if (!row) return res.status(404).json({ error: 'Initiative not found' });
    res.json(row);
  } catch (err: any) {
    logger.error('[initiatives] GET /:id error:', err?.message);
    res.status(500).json({ error: 'Failed to fetch initiative' });
  }
});

// ============================================
// POST /api/initiatives — create initiative
// ============================================
router.post('/', requireInitiativeWriteAccess(), async (req: AuthRequest, res: Response) => {
  try {
    await ensureInitiativesTable();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'system';
    const id = uuidv4();
    const now = new Date().toISOString();

    const {
      name,
      title,
      description,
      status = 'DRAFT',
      priority = 'medium',
      impact = 'medium',
      effort = 'medium',
      category,
      sourceType = 'manual',
      sourceId,
      reportId,
      reportName,
      estimatedBudget,
      estimatedTimeline,
    } = req.body;
    const normalizedSourceType = String(sourceType || 'manual')
      .trim()
      .toLowerCase();
    const normalizedSourceId = sourceId != null ? String(sourceId).trim() : '';
    if (normalizedSourceType !== 'manual' && !normalizedSourceId) {
      return res.status(400).json({ error: 'sourceId is required when sourceType is not manual' });
    }

    await dbRun(
      `INSERT INTO initiatives (
        id, organization_id, name, title, description, status,
        priority, impact, effort, category,
        source_type, source_id, report_id, report_name,
        estimated_budget, estimated_timeline,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        name || title || 'New Initiative',
        title || name,
        description || '',
        status,
        priority,
        impact,
        effort,
        category || null,
        normalizedSourceType,
        normalizedSourceId || null,
        reportId || null,
        reportName || null,
        estimatedBudget || null,
        estimatedTimeline || null,
        userId,
        userId,
        now,
        now,
      ]
    );

    res.status(201).json({ id, name: name || title, status });
  } catch (err: any) {
    logger.error('[initiatives] POST / error:', err?.message);
    res.status(500).json({ error: 'Failed to create initiative' });
  }
});

// ============================================
// PUT /api/initiatives/:id — update initiative
// ============================================
router.put('/:id', requireInitiativeWriteAccess(), async (req: AuthRequest, res: Response) => {
  try {
    await ensureInitiativesTable();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'system';
    const now = new Date().toISOString();

    const existing = await dbGet<{
      id: string;
      source_type?: string | null;
      source_id?: string | null;
    }>('SELECT id, source_type, source_id FROM initiatives WHERE id = ? AND organization_id = ?', [
      req.params.id,
      organizationId,
    ]);
    if (!existing) return res.status(404).json({ error: 'Initiative not found' });

    const sourceTypeCandidate =
      req.body.sourceType ?? req.body.source_type ?? existing.source_type ?? 'manual';
    const sourceIdCandidate = req.body.sourceId ?? req.body.source_id ?? existing.source_id ?? null;
    const normalizedSourceType = String(sourceTypeCandidate || 'manual')
      .trim()
      .toLowerCase();
    const normalizedSourceId = sourceIdCandidate != null ? String(sourceIdCandidate).trim() : '';
    if (normalizedSourceType !== 'manual' && !normalizedSourceId) {
      return res.status(400).json({ error: 'sourceId is required when sourceType is not manual' });
    }

    const fields: string[] = [];
    const params: any[] = [];
    const allowedFields = [
      'name',
      'title',
      'description',
      'status',
      'priority',
      'impact',
      'effort',
      'category',
      'source_type',
      'source_id',
      'report_id',
      'report_name',
      'estimated_budget',
      'estimated_timeline',
    ];

    for (const key of allowedFields) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (req.body[camelKey] !== undefined || req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(req.body[camelKey] ?? req.body[key]);
      }
    }

    const isPostgres = (process.env.DB_TYPE || '').toLowerCase() === 'postgres';
    if (!isPostgres) fields.push('updated_by = ?');
    fields.push('updated_at = ?');
    if (!isPostgres) params.push(userId);
    params.push(now, req.params.id, organizationId);

    await dbRun(
      `UPDATE initiatives SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[initiatives] PUT /:id error:', err?.message);
    res.status(500).json({ error: 'Failed to update initiative' });
  }
});

// ============================================
// DELETE /api/initiatives/:id — delete initiative
// ============================================
router.delete('/:id', requireInitiativeWriteAccess(), async (req: AuthRequest, res: Response) => {
  try {
    await ensureInitiativesTable();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    await dbRun('DELETE FROM initiatives WHERE id = ? AND organization_id = ?', [
      req.params.id,
      organizationId,
    ]);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('[initiatives] DELETE /:id error:', err?.message);
    res.status(500).json({ error: 'Failed to delete initiative' });
  }
});

export default router;
