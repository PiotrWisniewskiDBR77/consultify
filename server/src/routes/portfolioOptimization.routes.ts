/**
 * Portfolio Optimization Routes (Bundle 09 — T034–T038)
 */
import { type Response, Router } from 'express';
import { z } from 'zod';

import { isAuthenticated, type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../middleware/validation.middleware.js';
import { TaskAssignmentService } from '../services/taskAssignmentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

const buildInClause = (values: string[]) => {
  const safe = (values || []).map((v) => String(v)).filter(Boolean);
  if (safe.length === 0) return { sql: '(NULL)', params: [] as string[] };
  return { sql: `(${safe.map(() => '?').join(', ')})`, params: safe };
};

const toQuarterKey = (isoDate: string | null | undefined) => {
  const d = isoDate ? new Date(isoDate) : new Date();
  if (Number.isNaN(d.getTime())) return 'unknown';
  const year = d.getFullYear();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${year}-Q${q}`;
};

const normalizeToken = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (text: string): string[] => {
  const stop = new Set([
    'the',
    'and',
    'or',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'a',
    'an',
    'is',
    'are',
    'be',
    'as',
    'at',
    'by',
    'from',
    'it',
    'this',
    'that',
    'we',
    'our',
    'your',
    'you',
    'i',
    'but',
    'not',
    'do',
    'does',
    'did',
    'w',
    'z',
    'na',
    'do',
    'dla',
    'oraz',
    'że',
    'jak',
    'jest',
    'są',
    'aby',
    'się',
    'to',
  ]);

  return normalizeToken(text)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stop.has(t));
};

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
};

const writeAuditLog = async (params: {
  userId: string | null;
  organizationId: string;
  actionType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}) => {
  const { userId, organizationId, actionType, resourceType, resourceId, details, ipAddress, userAgent } =
    params;
  await dbRun(
    `INSERT INTO audit_logs (id, timestamp, user_id, action_type, resource_type, resource_id, organization_id, details, ip_address, user_agent, created_at)
     VALUES (gen_random_uuid()::TEXT, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      userId,
      actionType,
      resourceType || null,
      resourceId || null,
      organizationId,
      JSON.stringify(details ?? {}),
      ipAddress || null,
      userAgent || null,
    ]
  );
};

// -------------------- overlap (T034) --------------------
const OverlapRequestSchema = z.object({
  initiatives: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        summary: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .min(2)
    .max(80),
});

router.post(
  '/overlap',
  verifyToken,
  isAuthenticated,
  validateBody(OverlapRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const initiatives = req.body.initiatives as Array<{
      id: string;
      name: string;
      summary?: string;
      description?: string;
    }>;

    const items = initiatives.map((i) => {
      const text = `${i.name}\n${i.summary || ''}\n${i.description || ''}`.trim();
      return { ...i, tokens: tokenize(text) };
    });

    const suggestions: Array<{
      type: 'duplication';
      aId: string;
      bId: string;
      score: number;
      title: string;
      rationale: string;
      recommendation: string;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const score = jaccard(items[i].tokens, items[j].tokens);
        if (score < 0.35) continue;
        suggestions.push({
          type: 'duplication',
          aId: items[i].id,
          bId: items[j].id,
          score: Math.round(score * 100) / 100,
          title: `Potential overlap: "${items[i].name}" ↔ "${items[j].name}"`,
          rationale:
            score >= 0.55
              ? 'High textual overlap suggests these initiatives may duplicate scope.'
              : 'Moderate overlap suggests partial scope redundancy.',
          recommendation:
            'Review scope and deliverables; consider consolidating, splitting responsibilities, or clarifying boundaries.',
        });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    return res.json({ suggestions: suggestions.slice(0, 20) });
  })
);

// -------------------- non-human (T037) --------------------
const NonHumanAnalyzeSchema = z.object({
  initiativeIds: z.array(z.string().min(1)).min(1).max(80),
});

router.post(
  '/nonhuman/analyze',
  verifyToken,
  isAuthenticated,
  validateBody(NonHumanAnalyzeSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const initiativeIds = (req.body.initiativeIds as string[]) || [];
    const inClause = buildInClause(initiativeIds);

    const initiatives = (await dbAll(
      `SELECT id, planned_start_date, planned_end_date
       FROM initiatives
       WHERE organization_id = ?
         AND id IN ${inClause.sql}`,
      [orgId, ...inClause.params]
    )) as Array<{ id: string; planned_start_date: string | null; planned_end_date: string | null }>;

    const datesById = new Map<string, { plannedStart: string | null; plannedEnd: string | null }>();
    for (const row of initiatives || []) {
      datesById.set(String(row.id), {
        plannedStart: row.planned_start_date,
        plannedEnd: row.planned_end_date,
      });
    }

    const budgetItems = (await dbAll(
      `SELECT initiative_id, cost_type, amount, currency
       FROM initiative_budget_items
       WHERE organization_id = ?
         AND initiative_id IN ${inClause.sql}`,
      [orgId, ...inClause.params]
    )) as Array<{ initiative_id: string; cost_type: string; amount: number; currency: string }>;

    const tools = (await dbAll(
      `SELECT initiative_id, name, vendor, license_cost, cost_type
       FROM initiative_tools
       WHERE organization_id = ?
         AND initiative_id IN ${inClause.sql}`,
      [orgId, ...inClause.params]
    )) as Array<{
      initiative_id: string;
      name: string;
      vendor: string | null;
      license_cost: number | null;
      cost_type: string | null;
    }>;

    const quarterCurrencyMap = new Map<string, { capex: number; opex: number }>();
    const budgetByInitiative = new Map<
      string,
      { capex: number; opex: number; total: number; currencies: Set<string> }
    >();

    for (const b of budgetItems || []) {
      const initiativeId = String(b.initiative_id);
      const dates = datesById.get(initiativeId);
      const quarter = toQuarterKey(dates?.plannedStart || dates?.plannedEnd || null);
      const currency = String(b.currency || 'PLN');
      const costType = String(b.cost_type || 'OPEX').toUpperCase() === 'CAPEX' ? 'CAPEX' : 'OPEX';
      const amount = Number(b.amount || 0);

      const qKey = `${quarter}::${currency}`;
      if (!quarterCurrencyMap.has(qKey)) quarterCurrencyMap.set(qKey, { capex: 0, opex: 0 });
      const agg = quarterCurrencyMap.get(qKey)!;
      if (costType === 'CAPEX') agg.capex += amount;
      else agg.opex += amount;

      if (!budgetByInitiative.has(initiativeId)) {
        budgetByInitiative.set(initiativeId, {
          capex: 0,
          opex: 0,
          total: 0,
          currencies: new Set(),
        });
      }
      const bi = budgetByInitiative.get(initiativeId)!;
      if (costType === 'CAPEX') bi.capex += amount;
      else bi.opex += amount;
      bi.total += amount;
      bi.currencies.add(currency);
    }

    const budgetByQuarter = Array.from(quarterCurrencyMap.entries())
      .map(([key, v]) => {
        const [quarter, currency] = key.split('::');
        return {
          quarter,
          currency,
          capex: Math.round(v.capex * 100) / 100,
          opex: Math.round(v.opex * 100) / 100,
          total: Math.round((v.capex + v.opex) * 100) / 100,
        };
      })
      .sort((a, b) => a.quarter.localeCompare(b.quarter));

    const toolsByKey = new Map<
      string,
      { name: string; vendor: string | null; initiativeIds: Set<string> }
    >();
    for (const t of tools || []) {
      const key = `${normalizeToken(t.vendor || '')}::${normalizeToken(t.name || '')}`.trim();
      if (!key || key === '::') continue;
      if (!toolsByKey.has(key)) {
        toolsByKey.set(key, {
          name: String(t.name || ''),
          vendor: t.vendor ? String(t.vendor) : null,
          initiativeIds: new Set(),
        });
      }
      toolsByKey.get(key)!.initiativeIds.add(String(t.initiative_id));
    }

    const duplicatePurchases = Array.from(toolsByKey.values())
      .filter((v) => v.initiativeIds.size >= 2)
      .map((v) => ({
        type: 'duplicate_purchase' as const,
        severity:
          v.initiativeIds.size >= 4 ? 'high' : v.initiativeIds.size >= 3 ? 'medium' : 'low',
        tool: v.name,
        vendor: v.vendor,
        initiatives: Array.from(v.initiativeIds.values()),
        recommendation:
          'Consider consolidating procurement (shared license/contract) or verifying that tools are not redundant.',
      }))
      .slice(0, 20);

    return res.json({
      budgetByQuarter,
      budgetByInitiative: Array.from(budgetByInitiative.entries()).map(([initiativeId, v]) => ({
        initiativeId,
        capex: Math.round(v.capex * 100) / 100,
        opex: Math.round(v.opex * 100) / 100,
        total: Math.round(v.total * 100) / 100,
        currencies: Array.from(v.currencies.values()),
      })),
      duplicatePurchases,
      unknowns: { leadTime: true, budgetLimits: true },
    });
  })
);

// -------------------- apply scenario (T035/T038) --------------------
const TimelineApplySchema = z.object({
  scenarioType: z.string().optional(),
  schedule: z
    .array(
      z.object({
        id: z.string().min(1),
        plannedStartDate: z.string().datetime(),
        plannedEndDate: z.string().datetime(),
        quarter: z.string().optional(),
      })
    )
    .min(1)
    .max(120),
});

router.post(
  '/timeline/apply',
  verifyToken,
  isAuthenticated,
  validateBody(TimelineApplySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id || null;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { schedule, scenarioType } = req.body as {
      schedule: Array<{ id: string; plannedStartDate: string; plannedEndDate: string; quarter?: string }>;
      scenarioType?: string;
    };

    const ids = schedule.map((s) => String(s.id));
    const inClause = buildInClause(ids);
    const existing = (await dbAll(
      `SELECT id, planned_start_date, planned_end_date
       FROM initiatives
       WHERE organization_id = ?
         AND id IN ${inClause.sql}`,
      [orgId, ...inClause.params]
    )) as Array<{ id: string; planned_start_date: string | null; planned_end_date: string | null }>;
    const existingById = new Map(existing.map((r) => [String(r.id), r]));

    const updated: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const item of schedule) {
      const id = String(item.id);
      const row = existingById.get(id);
      if (!row) {
        skipped.push({ id, reason: 'not_found_or_no_access' });
        continue;
      }

      await dbRun(
        `UPDATE initiatives
         SET planned_start_date = ?, planned_end_date = ?, updated_at = NOW()
         WHERE id = ? AND organization_id = ?`,
        [item.plannedStartDate, item.plannedEndDate, id, orgId]
      );

      await writeAuditLog({
        userId,
        organizationId: orgId,
        actionType: 'portfolio_timeline_scenario_applied',
        resourceType: 'initiative',
        resourceId: id,
        details: {
          scenarioType: scenarioType || null,
          quarter: item.quarter || null,
          old: { plannedStartDate: row.planned_start_date, plannedEndDate: row.planned_end_date },
          new: { plannedStartDate: item.plannedStartDate, plannedEndDate: item.plannedEndDate },
        },
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || null,
        userAgent: String(req.headers['user-agent'] || ''),
      });

      updated.push(id);
    }

    return res.json({ success: true, updated, skipped });
  })
);

// -------------------- workload suggestions/apply (T036) --------------------
const WorkloadSuggestionsQuerySchema = z.object({
  projectId: z.string().uuid(),
  horizonDays: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 7))
    .pipe(z.number().int().min(3).max(30))
    .optional(),
});

router.get(
  '/workload/suggestions',
  verifyToken,
  isAuthenticated,
  validateQuery(WorkloadSuggestionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const projectId = String(req.query.projectId);
    const horizonDays = Number(req.query.horizonDays || 7);
    const endIso = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000).toISOString();

    const members = (await dbAll(
      `SELECT pm.user_id, pm.allocation_percent, u.first_name, u.last_name, u.avatar_url
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?`,
      [projectId]
    )) as Array<{
      user_id: string;
      allocation_percent: number;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    }>;

    const memberIds = (members || []).map((m) => String(m.user_id));
    const membersById = new Map(memberIds.map((id, idx) => [id, members[idx]]));

    const tasks = (await dbAll(
      `SELECT id, title, assignee_id, due_date, estimated_hours, priority, status
       FROM tasks
       WHERE organization_id = ?
         AND project_id = ?
         AND assignee_id IS NOT NULL
         AND lower(status) NOT IN ('done', 'completed', 'cancelled')
         AND due_date IS NOT NULL
         AND due_date <= ?`,
      [orgId, projectId, endIso]
    )) as Array<{
      id: string;
      title: string;
      assignee_id: string;
      due_date: string | null;
      estimated_hours: number | null;
      priority: string | null;
      status: string | null;
    }>;

    const hoursByAssignee = new Map<string, number>();
    const tasksByAssignee = new Map<string, typeof tasks>();
    for (const t of tasks || []) {
      const assigneeId = String(t.assignee_id);
      const est = Number(t.estimated_hours ?? 2);
      hoursByAssignee.set(assigneeId, (hoursByAssignee.get(assigneeId) || 0) + est);
      if (!tasksByAssignee.has(assigneeId)) tasksByAssignee.set(assigneeId, []);
      tasksByAssignee.get(assigneeId)!.push(t);
    }

    const capacityHours = (allocationPercent: number) => {
      const weekly = (Math.max(0, Math.min(100, Number(allocationPercent || 0))) / 100) * 40;
      return (weekly * horizonDays) / 7;
    };

    const people = memberIds.map((userId) => {
      const m = membersById.get(userId);
      const hours = hoursByAssignee.get(userId) || 0;
      const cap = capacityHours(m?.allocation_percent ?? 100);
      const util = cap > 0 ? hours / cap : 0;
      return {
        userId,
        name: `${m?.first_name || ''} ${m?.last_name || ''}`.trim() || 'Unknown',
        avatarUrl: m?.avatar_url || null,
        allocationPercent: m?.allocation_percent ?? 100,
        capacityHours: Math.round(cap * 10) / 10,
        plannedHours: Math.round(hours * 10) / 10,
        utilization: Math.round(util * 100),
      };
    });

    const overloaded = people
      .filter((p) => p.capacityHours > 0 && p.plannedHours > p.capacityHours * 1.1)
      .sort(
        (a, b) =>
          b.plannedHours / Math.max(1, b.capacityHours) -
          a.plannedHours / Math.max(1, a.capacityHours)
      );
    const underloaded = people
      .filter((p) => p.capacityHours > 0 && p.plannedHours < p.capacityHours * 0.7)
      .sort(
        (a, b) =>
          a.plannedHours / Math.max(1, a.capacityHours) -
          b.plannedHours / Math.max(1, b.capacityHours)
      );

    const suggestions: Array<{
      taskId: string;
      taskTitle: string;
      dueDate: string | null;
      estimatedHours: number;
      fromUserId: string;
      fromUserName: string;
      toUserId: string;
      toUserName: string;
      rationale: string;
    }> = [];

    for (const from of overloaded) {
      const fromTasks = (tasksByAssignee.get(from.userId) || []).slice();
      fromTasks.sort((a, b) => Number(a.estimated_hours ?? 2) - Number(b.estimated_hours ?? 2));
      for (const task of fromTasks.slice(0, 10)) {
        const est = Number(task.estimated_hours ?? 2);
        const candidate = underloaded.find((p) => p.userId !== from.userId);
        if (!candidate) break;
        suggestions.push({
          taskId: String(task.id),
          taskTitle: String(task.title || ''),
          dueDate: task.due_date || null,
          estimatedHours: Math.round(est * 10) / 10,
          fromUserId: from.userId,
          fromUserName: from.name,
          toUserId: candidate.userId,
          toUserName: candidate.name,
          rationale:
            'Reassigning this task reduces near-term overload and improves SLA likelihood based on allocation and due dates.',
        });
        from.plannedHours = Math.max(0, from.plannedHours - est);
        candidate.plannedHours = candidate.plannedHours + est;
      }
    }

    return res.json({
      horizonDays,
      people,
      suggestions: suggestions.slice(0, 12),
      unknowns: { skillsMatch: true, historicalVelocity: true },
    });
  })
);

const WorkloadApplySchema = z.object({
  reassignments: z
    .array(
      z.object({
        taskId: z.string().min(1),
        newAssigneeId: z.string().min(1),
        reason: z.string().optional(),
      })
    )
    .min(1)
    .max(30),
});

router.post(
  '/workload/apply',
  verifyToken,
  isAuthenticated,
  validateBody(WorkloadApplySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id || null;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { reassignments } = req.body as {
      reassignments: Array<{ taskId: string; newAssigneeId: string; reason?: string }>;
    };

    const results: Array<{ taskId: string; success: boolean; error?: string }> = [];

    for (const r of reassignments) {
      try {
        const task = await dbGet(`SELECT id FROM tasks WHERE id = ? AND organization_id = ?`, [
          r.taskId,
          orgId,
        ]);
        if (!task) {
          results.push({ taskId: r.taskId, success: false, error: 'Task not found' });
          continue;
        }

        await TaskAssignmentService.reassignTask(r.taskId, r.newAssigneeId, {
          reassignedById: userId,
          reason: r.reason || 'Workload balancing suggestion applied',
        });

        await writeAuditLog({
          userId,
          organizationId: orgId,
          actionType: 'portfolio_workload_suggestion_applied',
          resourceType: 'task',
          resourceId: r.taskId,
          details: { newAssigneeId: r.newAssigneeId, reason: r.reason || null },
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || null,
          userAgent: String(req.headers['user-agent'] || ''),
        });

        results.push({ taskId: r.taskId, success: true });
      } catch (err: any) {
        results.push({ taskId: r.taskId, success: false, error: err?.message || String(err) });
      }
    }

    return res.json({ success: true, results });
  })
);

// -------------------- audit write helper --------------------
const AuditWriteSchema = z.object({
  actionType: z.string().min(1),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

router.post(
  '/audit',
  verifyToken,
  isAuthenticated,
  validateBody(AuditWriteSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id || null;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { actionType, resourceType, resourceId, details } = req.body as {
      actionType: string;
      resourceType?: string;
      resourceId?: string;
      details?: Record<string, unknown>;
    };

    await writeAuditLog({
      userId,
      organizationId: orgId,
      actionType,
      resourceType: resourceType || null,
      resourceId: resourceId || null,
      details: details || {},
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || null,
      userAgent: String(req.headers['user-agent'] || ''),
    });

    return res.json({ success: true });
  })
);

export default router;

