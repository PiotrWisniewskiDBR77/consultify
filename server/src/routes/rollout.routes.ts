/**
 * Rollout Routes — Module 06 Realizacja (Execution) — rollout sub-resources.
 *
 * Persistence layer for the Rollout sub-tab inside ExecutionHub
 * (src/components/Execution/RolloutTab.tsx). Replaces the legacy in-memory
 * `fullSession` writes of FullRolloutView + Rollout*Tab.tsx, which lost all
 * data on refresh.
 *
 * Backed by migration server/migrations/20260608_rollout_tables.sql.
 * Mounted at /api/rollout in server/src/Gateway.ts.
 *
 * Resources (all org-scoped, optional projectId filter):
 *   - /kpis      KPI tracking + /kpis/:id/history time-series
 *   - /risks     risk register
 *   - /changes   change log
 *   - /closures  closure checklist
 */
import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { requireOrgRole } from '../middleware/rbac.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

// All rollout routes require an authenticated org member (read access).
// `project_manager` is listed explicitly: toCanonicalRole leaves it as
// 'project_manager' (not 'user'), and roleSatisfies only ranks admin/user, so a
// bare requireOrgRole('user') would 403 the PMO tier out of reads entirely.
router.use(verifyToken, isAuthenticated, requireOrgRole('user', 'project_manager'));

// L-01 / M14 PMO tier: Rollout mutations (create/update/delete) are enforced
// server-side, not only via the FE `readOnly` flag. Reads stay at `user`; writes
// require the `MANAGE_ROLLOUT` permission.
//
// Decision 2026-06-17: the editor tier is project-manager / PMO, not org-admin
// only. requireOrgRole can't express this — toCanonicalRole collapses
// project_manager → 'user', so a role-list gate would over-grant every member.
// MANAGE_ROLLOUT resolves through PermissionService.hasPermission:
//   - SUPERADMIN / OWNER bypass; ADMIN + PROJECT_MANAGER granted via the role
//     fallback (no regression vs the prior admin floor — admins keep full CRUD);
//   - TEAM_MEMBER / VIEWER / pilots get a 403, not a silent 200;
//   - per-user org overrides (org_user_permissions GRANT/REVOKE) still win, so an
//     org can extend or withdraw rollout access for a specific user.
const requireRolloutWrite = requirePermission('MANAGE_ROLLOUT');

const requireOrg = (req: AuthRequest, res: Response): string | null => {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return orgId;
};

const projectFilter = (projectId: unknown): { clause: string; params: string[] } => {
  if (typeof projectId === 'string' && projectId.trim()) {
    return { clause: ' AND project_id = ?', params: [projectId.trim()] };
  }
  return { clause: '', params: [] };
};

// ================================================================
// KPIs
// ================================================================

const KpiCreateSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1).max(255).optional(),
  baseline: z.number().optional(),
  target: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().max(16).optional(),
});

const KpiUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  baseline: z.number().optional(),
  target: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().max(16).optional(),
});

router.get(
  '/kpis',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const pf = projectFilter(req.query.projectId);
    const rows = await dbAll(
      `SELECT id, organization_id, project_id, name, baseline, target, current_value, unit,
              created_by, created_at, updated_at
       FROM rollout_kpis
       WHERE organization_id = ?${pf.clause}
       ORDER BY created_at ASC`,
      [orgId, ...pf.params]
    );
    return res.json({ kpis: rows, count: rows.length });
  })
);

router.post(
  '/kpis',
  requireRolloutWrite,
  validateBody(KpiCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const userId = req.user?.id || null;
    const b = req.body as z.infer<typeof KpiCreateSchema>;
    const rows = await dbAll(
      `INSERT INTO rollout_kpis
         (organization_id, project_id, name, baseline, target, current_value, unit, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, organization_id, project_id, name, baseline, target, current_value, unit,
                 created_by, created_at, updated_at`,
      [
        orgId,
        b.projectId || null,
        b.name ?? 'New KPI',
        b.baseline ?? 0,
        b.target ?? 100,
        b.currentValue ?? 0,
        b.unit ?? '%',
        userId,
      ],
      { fallback: false }
    );

    /*
     * PIERWSZY PUNKT HISTORII przy założeniu KPI.
     *
     * Do 2026-09-05 wiersz w `rollout_kpi_history` powstawał WYŁĄCZNIE w PATCH
     * niżej („Record a history point whenever current value moves"), więc
     * wartość, z którą KPI został założony, nie trafiała do serii NIGDY.
     * Skutek widoczny w produkcie (odbiór na żywo 05.09, `execution-tab-rollout`):
     * kolumna Trend pisała „No history yet" dla KAŻDEGO KPI, bo wykres
     * (`KpiSparkline`) wymaga DWÓCH punktów — a pierwsza zmiana wartości dawała
     * dopiero jeden. Trend pojawiał się więc najwcześniej po DRUGIEJ edycji.
     * Zapis wartości początkowej domyka serię od chwili założenia.
     *
     * Best-effort: nieudany zapis punktu historii nie ma prawa wywrócić
     * utworzenia samego KPI (odpowiedź 201 poniżej jest kontraktem).
     */
    const createdKpi = rows[0] as { id?: string; current_value?: number } | undefined;
    if (createdKpi?.id !== undefined) {
      try {
        await dbRun(
          `INSERT INTO rollout_kpi_history (kpi_id, value) VALUES (?, ?)`,
          [createdKpi.id, createdKpi.current_value ?? b.currentValue ?? 0],
          { fallback: false }
        );
      } catch {
        // niekrytyczne — KPI istnieje, seria dorośnie przy pierwszej edycji
      }
    }
    return res.status(201).json({ kpi: rows[0] });
  })
);

router.patch(
  '/kpis/:id',
  requireRolloutWrite,
  validateBody(KpiUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof KpiUpdateSchema>;
    const existing = await dbGet(
      `SELECT current_value FROM rollout_kpis WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'KPI not found' });

    const rows = await dbAll(
      `UPDATE rollout_kpis SET
         name = COALESCE(?, name),
         baseline = COALESCE(?, baseline),
         target = COALESCE(?, target),
         current_value = COALESCE(?, current_value),
         unit = COALESCE(?, unit),
         updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?
       RETURNING id, organization_id, project_id, name, baseline, target, current_value, unit,
                 created_by, created_at, updated_at`,
      [
        b.name ?? null,
        b.baseline ?? null,
        b.target ?? null,
        b.currentValue ?? null,
        b.unit ?? null,
        req.params.id,
        orgId,
      ],
      { fallback: false }
    );

    // Record a history point whenever current value moves.
    if (b.currentValue !== undefined) {
      await dbRun(
        `INSERT INTO rollout_kpi_history (kpi_id, value) VALUES (?, ?)`,
        [req.params.id, b.currentValue],
        { fallback: false }
      );
    }

    return res.json({ kpi: rows[0] });
  })
);

router.delete(
  '/kpis/:id',
  requireRolloutWrite,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const result = await dbRun(
      `DELETE FROM rollout_kpis WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId],
      { fallback: false }
    );
    if (!result.changes) return res.status(404).json({ error: 'KPI not found' });
    return res.json({ success: true });
  })
);

router.get(
  '/kpis/:id/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const kpi = await dbGet(`SELECT id FROM rollout_kpis WHERE id = ? AND organization_id = ?`, [
      req.params.id,
      orgId,
    ]);
    if (!kpi) return res.status(404).json({ error: 'KPI not found' });
    const rows = await dbAll(
      `SELECT id, kpi_id, value, recorded_at FROM rollout_kpi_history
       WHERE kpi_id = ? ORDER BY recorded_at ASC`,
      [req.params.id]
    );
    return res.json({ history: rows, count: rows.length });
  })
);

// ================================================================
// Risks
// ================================================================

const RiskCreateSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).max(255).optional(),
  probability: z.string().max(32).optional(),
  impact: z.string().max(32).optional(),
  mitigation: z.string().max(4000).optional(),
  status: z.string().max(32).optional(),
  ownerId: z.string().optional(),
});

const RiskUpdateSchema = RiskCreateSchema.omit({ projectId: true });

router.get(
  '/risks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const pf = projectFilter(req.query.projectId);
    const rows = await dbAll(
      `SELECT id, organization_id, project_id, title, probability, impact, mitigation, status,
              owner_id, created_at, updated_at
       FROM rollout_risks
       WHERE organization_id = ?${pf.clause}
       ORDER BY created_at ASC`,
      [orgId, ...pf.params]
    );
    return res.json({ risks: rows, count: rows.length });
  })
);

router.post(
  '/risks',
  requireRolloutWrite,
  validateBody(RiskCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof RiskCreateSchema>;
    const rows = await dbAll(
      `INSERT INTO rollout_risks
         (organization_id, project_id, title, probability, impact, mitigation, status, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, organization_id, project_id, title, probability, impact, mitigation, status,
                 owner_id, created_at, updated_at`,
      [
        orgId,
        b.projectId || null,
        b.title ?? 'New Risk',
        b.probability ?? 'medium',
        b.impact ?? 'medium',
        b.mitigation ?? null,
        b.status ?? 'OPEN',
        b.ownerId || null,
      ],
      { fallback: false }
    );
    return res.status(201).json({ risk: rows[0] });
  })
);

router.patch(
  '/risks/:id',
  requireRolloutWrite,
  validateBody(RiskUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof RiskUpdateSchema>;
    const existing = await dbGet(
      `SELECT id FROM rollout_risks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Risk not found' });
    const rows = await dbAll(
      `UPDATE rollout_risks SET
         title = COALESCE(?, title),
         probability = COALESCE(?, probability),
         impact = COALESCE(?, impact),
         mitigation = COALESCE(?, mitigation),
         status = COALESCE(?, status),
         owner_id = COALESCE(?, owner_id),
         updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?
       RETURNING id, organization_id, project_id, title, probability, impact, mitigation, status,
                 owner_id, created_at, updated_at`,
      [
        b.title ?? null,
        b.probability ?? null,
        b.impact ?? null,
        b.mitigation ?? null,
        b.status ?? null,
        b.ownerId ?? null,
        req.params.id,
        orgId,
      ],
      { fallback: false }
    );
    return res.json({ risk: rows[0] });
  })
);

router.delete(
  '/risks/:id',
  requireRolloutWrite,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const result = await dbRun(
      `DELETE FROM rollout_risks WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId],
      { fallback: false }
    );
    if (!result.changes) return res.status(404).json({ error: 'Risk not found' });
    return res.json({ success: true });
  })
);

// ================================================================
// Changes
// ================================================================

const ChangeCreateSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).max(255).optional(),
  type: z.string().max(32).optional(),
  status: z.string().max(32).optional(),
  impact: z.string().max(4000).optional(),
});

const ChangeUpdateSchema = ChangeCreateSchema.omit({ projectId: true });

router.get(
  '/changes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const pf = projectFilter(req.query.projectId);
    const rows = await dbAll(
      `SELECT id, organization_id, project_id, title, type, status, impact, approved_by,
              created_at, updated_at
       FROM rollout_changes
       WHERE organization_id = ?${pf.clause}
       ORDER BY created_at ASC`,
      [orgId, ...pf.params]
    );
    return res.json({ changes: rows, count: rows.length });
  })
);

router.post(
  '/changes',
  requireRolloutWrite,
  validateBody(ChangeCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof ChangeCreateSchema>;
    const rows = await dbAll(
      `INSERT INTO rollout_changes
         (organization_id, project_id, title, type, status, impact)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id, organization_id, project_id, title, type, status, impact, approved_by,
                 created_at, updated_at`,
      [
        orgId,
        b.projectId || null,
        b.title ?? 'New Change',
        b.type ?? 'process',
        b.status ?? 'PROPOSED',
        b.impact ?? null,
      ],
      { fallback: false }
    );
    return res.status(201).json({ change: rows[0] });
  })
);

router.patch(
  '/changes/:id',
  requireRolloutWrite,
  validateBody(ChangeUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const userId = req.user?.id || null;
    const b = req.body as z.infer<typeof ChangeUpdateSchema>;
    const existing = await dbGet(
      `SELECT id FROM rollout_changes WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Change not found' });
    // Stamp approver when a change is approved.
    const approvedBy = b.status && b.status.toUpperCase() === 'APPROVED' ? userId : null;
    const rows = await dbAll(
      `UPDATE rollout_changes SET
         title = COALESCE(?, title),
         type = COALESCE(?, type),
         status = COALESCE(?, status),
         impact = COALESCE(?, impact),
         approved_by = COALESCE(?, approved_by),
         updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?
       RETURNING id, organization_id, project_id, title, type, status, impact, approved_by,
                 created_at, updated_at`,
      [
        b.title ?? null,
        b.type ?? null,
        b.status ?? null,
        b.impact ?? null,
        approvedBy,
        req.params.id,
        orgId,
      ],
      { fallback: false }
    );
    return res.json({ change: rows[0] });
  })
);

router.delete(
  '/changes/:id',
  requireRolloutWrite,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const result = await dbRun(
      `DELETE FROM rollout_changes WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId],
      { fallback: false }
    );
    if (!result.changes) return res.status(404).json({ error: 'Change not found' });
    return res.json({ success: true });
  })
);

// ================================================================
// Closures
// ================================================================

const ClosureCreateSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).max(255).optional(),
  category: z.string().max(32).optional(),
  status: z.string().max(32).optional(),
  dueDate: z.string().optional(),
});

const ClosureUpdateSchema = ClosureCreateSchema.omit({ projectId: true });

router.get(
  '/closures',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const pf = projectFilter(req.query.projectId);
    const rows = await dbAll(
      `SELECT id, organization_id, project_id, title, category, status, due_date, resolved_at,
              created_at, updated_at
       FROM rollout_closures
       WHERE organization_id = ?${pf.clause}
       ORDER BY created_at ASC`,
      [orgId, ...pf.params]
    );
    return res.json({ closures: rows, count: rows.length });
  })
);

router.post(
  '/closures',
  requireRolloutWrite,
  validateBody(ClosureCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof ClosureCreateSchema>;
    const rows = await dbAll(
      `INSERT INTO rollout_closures
         (organization_id, project_id, title, category, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id, organization_id, project_id, title, category, status, due_date, resolved_at,
                 created_at, updated_at`,
      [
        orgId,
        b.projectId || null,
        b.title ?? 'New Closure Item',
        b.category ?? 'handover',
        b.status ?? 'OPEN',
        b.dueDate || null,
      ],
      { fallback: false }
    );
    return res.status(201).json({ closure: rows[0] });
  })
);

router.patch(
  '/closures/:id',
  requireRolloutWrite,
  validateBody(ClosureUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof ClosureUpdateSchema>;
    const existing = await dbGet(
      `SELECT id FROM rollout_closures WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Closure not found' });
    const isDone = b.status && b.status.toUpperCase() === 'DONE';
    const rows = await dbAll(
      `UPDATE rollout_closures SET
         title = COALESCE(?, title),
         category = COALESCE(?, category),
         status = COALESCE(?, status),
         due_date = COALESCE(?, due_date),
         resolved_at = CASE WHEN ? THEN datetime('now') ELSE resolved_at END,
         updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?
       RETURNING id, organization_id, project_id, title, category, status, due_date, resolved_at,
                 created_at, updated_at`,
      [
        b.title ?? null,
        b.category ?? null,
        b.status ?? null,
        b.dueDate ?? null,
        Boolean(isDone),
        req.params.id,
        orgId,
      ],
      { fallback: false }
    );
    return res.json({ closure: rows[0] });
  })
);

router.delete(
  '/closures/:id',
  requireRolloutWrite,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const result = await dbRun(
      `DELETE FROM rollout_closures WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId],
      { fallback: false }
    );
    if (!result.changes) return res.status(404).json({ error: 'Closure not found' });
    return res.json({ success: true });
  })
);

export default router;
