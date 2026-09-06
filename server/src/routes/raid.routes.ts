/**
 * RAID Routes (Risks, Actions, Issues, Dependencies)
 * API endpoints for RAID log management
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import {
  buildHeatmap,
  calculateRiskScore,
  categorizeScore,
  DEFAULT_THRESHOLDS,
} from '../services/raidScoringService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

// Tenant-scoping helper (P0 IDOR fix): a raid_items row belonging to
// another organization must be indistinguishable from a row that does
// not exist at all — 404, never 403 (403 would confirm the row's
// existence to a caller in a foreign org). organizationId comes ONLY
// from the verified token (req.user.organizationId), never from
// body/query, and this must run BEFORE any mutation on the row.
function raidItemNotFoundError(): Error {
  const err = new Error('RAID item not found');
  (err as any).code = 'NOT_FOUND';
  (err as any).status = 404;
  return err;
}

async function assertRaidItemInOrganization(itemId: string, organizationId?: string) {
  if (!organizationId) throw raidItemNotFoundError();
  const row = (await dbGet('SELECT id FROM raid_items WHERE id = ? AND organization_id = ?', [
    itemId,
    organizationId,
  ])) as any;
  if (!row) throw raidItemNotFoundError();
  return row;
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { projectId, initiativeId, type } = req.query;
    // 1.12-R1b: Kokpit (`ExecutionSummaryOneLook`, przez `ExecutionHub`) otwiera
    // podgląd pozycji RAID i pokazuje „plan mitygacji" — kolumna istnieje od
    // migracji 063 (`mitigation_plan`, NIE `mitigation_status` — ta druga to
    // osobna, niepowiązana kolumna warsztatu V8 execution-control), ale do
    // teraz nie była wystawiana przez ten endpoint.
    let query = `SELECT id, initiative_id as "initiativeId", type, title, description,
               impact as severity, status, owner_id as "ownerId", due_date as "dueDate",
               probability, impact, risk_score as "riskScore", score_category as "scoreCategory",
               mitigation_plan as "mitigationPlan",
               created_at as "createdAt" FROM raid_items WHERE organization_id = ?`;
    const params: any[] = [orgId];
    if (initiativeId) {
      query += ' AND initiative_id = ?';
      params.push(initiativeId);
    }
    if (projectId) {
      query +=
        ' AND initiative_id IN (SELECT id FROM initiatives WHERE project_id = ? AND organization_id = ?)';
      params.push(projectId, orgId);
    }
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    query += ' ORDER BY created_at DESC';
    const rows = (await dbAll(query, params)) || [];
    res.json(Array.isArray(rows) ? rows : []);
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const {
      projectId,
      initiativeId,
      type,
      title,
      description,
      severity,
      probability,
      ownerId,
      dueDate,
    } = req.body;
    if (!type || !title) return res.status(400).json({ error: 'Type and title required' });
    const id = uuidv4();
    const initId = initiativeId || null;
    const impactVal = severity ? String(severity).toUpperCase() : null;
    const probVal = probability ? String(probability).toUpperCase() : null;
    const riskScore = calculateRiskScore(probVal || 'LOW', impactVal || 'LOW');
    const scoreCategory = categorizeScore(riskScore, DEFAULT_THRESHOLDS);
    await dbRun(
      `INSERT INTO raid_items (id, organization_id, initiative_id, type, title, description, 
                            impact, probability, risk_score, score_category, status, owner_id, due_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, datetime('now'), datetime('now'))`,
      [
        id,
        orgId,
        initId,
        String(type).toUpperCase(),
        title,
        description || '',
        impactVal,
        probVal,
        riskScore,
        scoreCategory,
        ownerId || userId,
        dueDate || null,
      ]
    );
    res.status(201).json({ success: true, id, riskScore, scoreCategory });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    await assertRaidItemInOrganization(req.params.id, orgId);

    const { title, description, severity, probability, status, ownerId, dueDate } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (severity !== undefined) {
      updates.push('impact = ?');
      params.push(String(severity).toUpperCase());
    }
    if (probability !== undefined) {
      updates.push('probability = ?');
      params.push(String(probability).toUpperCase());
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(String(status).toUpperCase());
    }
    if (ownerId !== undefined) {
      updates.push('owner_id = ?');
      params.push(ownerId);
    }
    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(dueDate);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });

    if (severity !== undefined || probability !== undefined) {
      const existing = (await dbGet(
        'SELECT probability, impact FROM raid_items WHERE id = ? AND organization_id = ?',
        [req.params.id, orgId]
      )) as any;
      const finalProb = probability
        ? String(probability).toUpperCase()
        : existing?.probability || 'LOW';
      const finalImpact = severity ? String(severity).toUpperCase() : existing?.impact || 'LOW';
      const riskScore = calculateRiskScore(finalProb, finalImpact);
      const scoreCategory = categorizeScore(riskScore, DEFAULT_THRESHOLDS);
      updates.push('risk_score = ?');
      params.push(riskScore);
      updates.push('score_category = ?');
      params.push(scoreCategory);
    }

    updates.push("updated_at = datetime('now')");
    params.push(req.params.id, orgId);
    await dbRun(
      `UPDATE raid_items SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    res.json({ success: true });
  })
);

router.patch(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    await assertRaidItemInOrganization(req.params.id, orgId);

    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status required' });
    await dbRun(
      `UPDATE raid_items SET status = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
      [String(status).toUpperCase(), req.params.id, orgId]
    );
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    await assertRaidItemInOrganization(req.params.id, orgId);

    await dbRun('DELETE FROM raid_items WHERE id = ? AND organization_id = ?', [
      req.params.id,
      orgId,
    ]);
    res.json({ success: true });
  })
);

router.get(
  '/summary',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const summary = await dbAll(
      `
    SELECT type, status, COUNT(*) as count FROM raid_items
    WHERE organization_id = ? GROUP BY type, status
  `,
      [orgId]
    );
    res.json(summary || []);
  })
);

// --- Scoring endpoints ---

router.get(
  '/scoring/heatmap',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { initiativeId, type } = req.query;

    const thresholdRow = (await dbGet(
      initiativeId
        ? `SELECT green_max, amber_max, red_min FROM raid_appetite_thresholds WHERE organization_id = ? AND initiative_id = ?`
        : `SELECT green_max, amber_max, red_min FROM raid_appetite_thresholds WHERE organization_id = ? AND initiative_id IS NULL`,
      initiativeId ? [orgId, initiativeId] : [orgId]
    )) as any;

    const thresholds = thresholdRow
      ? {
          greenMax: thresholdRow.green_max,
          amberMax: thresholdRow.amber_max,
          redMin: thresholdRow.red_min,
        }
      : DEFAULT_THRESHOLDS;

    let query = `SELECT id, title, probability, impact, initiative_id as "initiativeId"
                 FROM raid_items WHERE organization_id = ? AND status NOT IN ('CLOSED', 'REALIZED')`;
    const params: any[] = [orgId];
    if (initiativeId) {
      query += ' AND initiative_id = ?';
      params.push(initiativeId);
    }
    if (type) {
      query += ' AND type = ?';
      params.push(String(type).toUpperCase());
    }

    const rows = ((await dbAll(query, params)) || []) as any[];
    const heatmap = buildHeatmap(rows, thresholds);

    const summary = { total: rows.length, green: 0, amber: 0, red: 0 };
    for (const cell of heatmap) {
      if (cell.category === 'GREEN') summary.green += cell.count;
      else if (cell.category === 'AMBER') summary.amber += cell.count;
      else summary.red += cell.count;
    }

    res.json({ heatmap, thresholds, summary });
  })
);

router.get(
  '/scoring/thresholds',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { initiativeId } = req.query;

    const row = (await dbGet(
      initiativeId
        ? `SELECT * FROM raid_appetite_thresholds WHERE organization_id = ? AND initiative_id = ?`
        : `SELECT * FROM raid_appetite_thresholds WHERE organization_id = ? AND initiative_id IS NULL`,
      initiativeId ? [orgId, initiativeId] : [orgId]
    )) as any;

    if (!row) {
      res.json({
        organizationId: orgId,
        initiativeId: initiativeId || null,
        riskAppetiteLevel: 'moderate',
        ...DEFAULT_THRESHOLDS,
        autoEscalateAbove: 12,
        isDefault: true,
      });
      return;
    }

    res.json({
      id: row.id,
      organizationId: row.organization_id,
      initiativeId: row.initiative_id,
      riskAppetiteLevel: row.risk_appetite_level,
      greenMax: row.green_max,
      amberMax: row.amber_max,
      redMin: row.red_min,
      autoEscalateAbove: row.auto_escalate_above,
      isDefault: false,
    });
  })
);

router.put(
  '/scoring/thresholds',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { initiativeId, riskAppetiteLevel, greenMax, amberMax, redMin, autoEscalateAbove } =
      req.body;

    const existing = (await dbGet(
      initiativeId
        ? `SELECT id FROM raid_appetite_thresholds WHERE organization_id = ? AND initiative_id = ?`
        : `SELECT id FROM raid_appetite_thresholds WHERE organization_id = ? AND initiative_id IS NULL`,
      initiativeId ? [orgId, initiativeId] : [orgId]
    )) as any;

    if (existing) {
      await dbRun(
        `UPDATE raid_appetite_thresholds
         SET risk_appetite_level = COALESCE(?, risk_appetite_level),
             green_max = COALESCE(?, green_max),
             amber_max = COALESCE(?, amber_max),
             red_min = COALESCE(?, red_min),
             auto_escalate_above = COALESCE(?, auto_escalate_above),
             updated_at = datetime('now')
         WHERE id = ?`,
        [
          riskAppetiteLevel ?? null,
          greenMax ?? null,
          amberMax ?? null,
          redMin ?? null,
          autoEscalateAbove ?? null,
          existing.id,
        ]
      );
      res.json({ success: true, id: existing.id });
    } else {
      const id = uuidv4();
      await dbRun(
        `INSERT INTO raid_appetite_thresholds (id, organization_id, initiative_id, risk_appetite_level, green_max, amber_max, red_min, auto_escalate_above, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          id,
          orgId,
          initiativeId || null,
          riskAppetiteLevel || 'moderate',
          greenMax ?? DEFAULT_THRESHOLDS.greenMax,
          amberMax ?? DEFAULT_THRESHOLDS.amberMax,
          redMin ?? DEFAULT_THRESHOLDS.redMin,
          autoEscalateAbove ?? 12,
        ]
      );
      res.status(201).json({ success: true, id });
    }
  })
);

router.post(
  '/scoring/recalculate',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;

    const thresholdRow = (await dbGet(
      `SELECT green_max, amber_max, red_min FROM raid_appetite_thresholds WHERE organization_id = ? AND initiative_id IS NULL`,
      [orgId]
    )) as any;
    const thresholds = thresholdRow
      ? {
          greenMax: thresholdRow.green_max,
          amberMax: thresholdRow.amber_max,
          redMin: thresholdRow.red_min,
        }
      : DEFAULT_THRESHOLDS;

    const rows = ((await dbAll(
      `SELECT id, probability, impact FROM raid_items WHERE organization_id = ? AND status NOT IN ('CLOSED', 'REALIZED')`,
      [orgId]
    )) || []) as any[];

    let updated = 0;
    for (const row of rows) {
      const score = calculateRiskScore(row.probability || 'LOW', row.impact || 'LOW');
      const category = categorizeScore(score, thresholds);
      await dbRun(
        `UPDATE raid_items SET risk_score = ?, score_category = ?, updated_at = datetime('now') WHERE id = ?`,
        [score, category, row.id]
      );
      updated++;
    }

    res.json({ success: true, updated });
  })
);

export default router;
