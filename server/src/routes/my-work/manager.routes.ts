/**
 * Manager snapshot — ONE coherent point-in-time read for the My Work → Manager
 * dashboard (finding M02-008).
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this route the Manager surface stitched its numbers from seven
 * independent requests, each with its own clock, its own scope and — in one
 * case — a `LIMIT` that silently became the headline value:
 *
 *   - `GET /my-work/stats?period=week` → `total` counted tasks CREATED in the
 *     last 7 days (=1) while `byStatus.overdue` counted the ALL-TIME open
 *     backlog (=71). The KPI card printed "0% · 0/1" next to "Overdue 71".
 *   - `GET /my-work/decisions?limit=10&onlyPending=true` → the dashboard used
 *     `list.length` as "Decisions pending", so the number could never exceed
 *     the page size. It read 10 because the LIMIT was 10.
 *   - `aiOperatorService.getExecutionOverview()` counts the SAME words
 *     ("overdue", "pending") ORGANIZATION-wide, so its copy said 77 / 54 next
 *     to the owner-scoped 71 / 10 with no visible difference in meaning.
 *
 * The fix is not "make the numbers equal" — owner-scoped and org-scoped truths
 * genuinely differ. The fix is: compute every number the surface renders in ONE
 * request, from ONE `generatedAt`, and return the BASIS of each figure so the
 * UI can label it. Two numbers may differ; they may never differ *silently*.
 *
 * SCOPE / OWNERSHIP
 * -----------------
 * Read-only. This route creates no rows and mutates nothing, so it does not
 * touch Tasks/Decisions owner persistence (owned by agents A/B).
 *
 * RBAC: same gate as `/my-work/team-workload` — this exposes org-wide rollups
 * (every member's utilization, org backlog), so it is a manager surface and
 * fails CLOSED with 403 for plain USER/VIEWER/GUEST. That mirrors the client
 * gate `canViewManager` in MyWorkHub.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { getCapacityOverview } from '../../services/workloadCapacityService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { requireUser } from './_helpers.js';
import {
  buildCoherenceChecks,
  type ManagerSnapshot,
  num,
  pct,
} from './managerSnapshot.contract.js';

const router = Router();

const isPostgres = process.env.DB_TYPE === 'postgres';
/** Age of a row in fractional days, in the dialect the server is running on. */
const ageInDaysSql = (column: string) =>
  isPostgres
    ? `EXTRACT(EPOCH FROM (NOW() - ${column})) / 86400`
    : `(julianday('now') - julianday(${column}))`;

/** Statuses that mean "this task is no longer open work". */
const CLOSED_TASK_STATUSES = "('done','completed','validated','cancelled')";
/** Decision statuses that mean "still waiting on a human". */
const OPEN_DECISION_STATUSES = "('pending','escalated')";

/**
 * GET /api/my-work/manager/snapshot?period=week
 */
router.get(
  '/manager/snapshot',
  requireRole('manager', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    // ONE clock for the whole snapshot. Every query below is bound to these
    // values, so nothing can drift between sub-reads.
    const generatedAtMs = Date.now();
    const generatedAt = new Date(generatedAtMs).toISOString();
    const period = String(req.query.period || 'week') === 'month' ? 'month' : 'week';
    const days = period === 'month' ? 30 : 7;
    const windowStart = new Date(generatedAtMs - days * 86_400_000).toISOString();
    const prevWindowStart = new Date(generatedAtMs - 2 * days * 86_400_000).toISOString();
    const today = new Date(generatedAtMs).toISOString().slice(0, 10);

    const openTaskSql = (ownerScoped: boolean) => `
      SELECT
        COUNT(*) AS "openTotal",
        SUM(CASE WHEN due_date IS NOT NULL AND date(due_date) < date(?) THEN 1 ELSE 0 END) AS "overdue",
        SUM(CASE WHEN lower(coalesce(status,'')) = 'blocked'
                   OR blocked_reason IS NOT NULL
                   OR blocked_by_decision_id IS NOT NULL THEN 1 ELSE 0 END) AS "blocked"
      FROM tasks
      WHERE organization_id = ?
        ${ownerScoped ? 'AND assignee_id = ?' : ''}
        AND lower(coalesce(status,'')) NOT IN ${CLOSED_TASK_STATUSES}
    `;

    const decisionSql = (ownerScoped: boolean) => `
      SELECT
        SUM(CASE WHEN lower(coalesce(status,'')) IN ${OPEN_DECISION_STATUSES} THEN 1 ELSE 0 END) AS "pending",
        SUM(CASE WHEN lower(coalesce(status,'')) = 'escalated' THEN 1 ELSE 0 END) AS "escalated",
        SUM(CASE WHEN lower(coalesce(status,'')) IN ${OPEN_DECISION_STATUSES}
                  AND upper(coalesce(priority,'')) = 'CRITICAL' THEN 1 ELSE 0 END) AS "critical"
      FROM decisions
      WHERE organization_id = ?
        ${ownerScoped ? 'AND decision_maker_id = ?' : ''}
    `;

    const [
      ownerOpen,
      orgOpen,
      ownerDecisions,
      orgDecisions,
      ownerWindow,
      ownerPrevWindow,
      ownerWait,
      approvals,
      capacity,
    ] = await Promise.all([
      queryHelpers.queryOne<any>(openTaskSql(true), [today, orgId, userId]),
      queryHelpers.queryOne<any>(openTaskSql(false), [today, orgId]),
      queryHelpers.queryOne<any>(decisionSql(true), [orgId, userId]),
      queryHelpers.queryOne<any>(decisionSql(false), [orgId]),
      queryHelpers.queryOne<any>(
        `SELECT
           SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS "created",
           SUM(CASE WHEN completed_at IS NOT NULL AND completed_at >= ? THEN 1 ELSE 0 END) AS "completed",
           SUM(CASE WHEN completed_at IS NOT NULL AND completed_at >= ?
                     AND due_date IS NOT NULL AND completed_at <= due_date THEN 1 ELSE 0 END) AS "onTime"
         FROM tasks
         WHERE organization_id = ? AND assignee_id = ?`,
        [windowStart, windowStart, windowStart, orgId, userId]
      ),
      queryHelpers.queryOne<any>(
        `SELECT
           SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS "created",
           SUM(CASE WHEN completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ? THEN 1 ELSE 0 END) AS "completed"
         FROM tasks
         WHERE organization_id = ? AND assignee_id = ?`,
        [prevWindowStart, windowStart, prevWindowStart, windowStart, orgId, userId]
      ),
      queryHelpers.queryOne<any>(
        `SELECT AVG(${ageInDaysSql('created_at')}) AS "avgWaitDays"
         FROM decisions
         WHERE organization_id = ? AND decision_maker_id = ?
           AND lower(coalesce(status,'')) IN ${OPEN_DECISION_STATUSES}`,
        [orgId, userId]
      ),
      queryHelpers.queryOne<any>(
        `SELECT
           SUM(CASE WHEN status = 'proposed' THEN 1 ELSE 0 END) AS "proposed",
           SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS "accepted",
           SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) AS "executed"
         FROM ai_typed_actions
         WHERE organization_id = ?`,
        [orgId]
      ),
      getCapacityOverview(orgId).catch(() => ({ users: [] as any[] })),
    ]);

    const ownerOpenTotal = num(ownerOpen, 'openTotal');
    const ownerOverdue = num(ownerOpen, 'overdue');
    const ownerBlocked = num(ownerOpen, 'blocked');

    const windowCreated = num(ownerWindow, 'created');
    const windowCompleted = num(ownerWindow, 'completed');
    const windowOnTime = num(ownerWindow, 'onTime');
    const prevCreated = num(ownerPrevWindow, 'created');
    const prevCompleted = num(ownerPrevWindow, 'completed');

    // Denominator = whichever is larger, work that ENTERED the window or work
    // that was CLOSED in it. Counting only `created` made a week spent clearing
    // carry-over backlog read as "0% · 0/1"; taking the max keeps the ratio
    // inside 0..100 while never hiding closed work.
    const windowDenominator = Math.max(windowCreated, windowCompleted);
    const prevDenominator = Math.max(prevCreated, prevCompleted);
    const completionPct = pct(windowCompleted, windowDenominator);
    const previousCompletionPct = pct(prevCompleted, prevDenominator);
    const onTimePct = pct(windowOnTime, windowCompleted);

    const trend: 'up' | 'down' | 'stable' =
      completionPct > previousCompletionPct + 5
        ? 'up'
        : completionPct < previousCompletionPct - 5
          ? 'down'
          : 'stable';

    const ownerPending = num(ownerDecisions, 'pending');
    const ownerEscalated = num(ownerDecisions, 'escalated');
    const ownerCritical = num(ownerDecisions, 'critical');
    const orgPending = num(orgDecisions, 'pending');
    const orgEscalated = num(orgDecisions, 'escalated');

    const members = Array.isArray((capacity as any)?.users) ? (capacity as any).users : [];
    const memberCount = members.length;
    const avgUtilizationPct =
      memberCount > 0
        ? Math.round(
            members.reduce((sum: number, m: any) => sum + Number(m.utilizationPercent || 0), 0) /
              memberCount
          )
        : 0;
    const overloaded = members.filter((m: any) => Number(m.utilizationPercent || 0) > 100).length;
    const available = members.filter((m: any) => Number(m.utilizationPercent || 0) < 50).length;
    // Backlog hours divided by a weekly budget produces readings like 512%.
    // Say so rather than printing a number nobody can act on.
    const utilizationCredible = memberCount > 0 && avgUtilizationPct <= 130;

    const executionScore = completionPct;
    const decisionsScore = ownerPending === 0 ? 100 : Math.max(20, 100 - ownerPending * 10);
    const capacityScore = utilizationCredible ? Math.min(100, avgUtilizationPct) : 0;
    const riskScore =
      ownerOpenTotal > 0
        ? Math.max(0, 100 - Math.round((ownerBlocked / ownerOpenTotal) * 100))
        : 100;
    const healthScore = Math.round(
      executionScore * 0.4 + decisionsScore * 0.2 + capacityScore * 0.2 + riskScore * 0.2
    );
    const previousHealthScore = Math.round(
      previousCompletionPct * 0.4 + decisionsScore * 0.2 + capacityScore * 0.2 + riskScore * 0.2
    );

    const riskLevel: ManagerSnapshot['risk']['level'] =
      ownerOverdue > 5 || orgEscalated > 3
        ? 'high'
        : ownerOverdue > 2 || orgEscalated > 1
          ? 'medium'
          : 'low';

    const base: Omit<ManagerSnapshot, 'coherence'> = {
      generatedAt,
      window: { period, days, start: windowStart, end: generatedAt, today },
      scope: { organizationId: orgId, ownerUserId: userId },
      owner: {
        basis: 'owner',
        tasks: {
          openTotal: ownerOpenTotal,
          overdue: ownerOverdue,
          blocked: ownerBlocked,
          windowCreated,
          windowCompleted,
          completionPct,
          onTimePct,
          previousWindowCreated: prevCreated,
          previousWindowCompleted: prevCompleted,
          previousCompletionPct,
          trend,
        },
        decisions: {
          pending: ownerPending,
          escalated: ownerEscalated,
          critical: ownerCritical,
          avgWaitDays: Math.round(Number((ownerWait as any)?.avgWaitDays || 0) * 10) / 10,
        },
      },
      organization: {
        basis: 'organization',
        tasks: {
          openTotal: num(orgOpen, 'openTotal'),
          overdue: num(orgOpen, 'overdue'),
          blocked: num(orgOpen, 'blocked'),
        },
        decisions: { pending: orgPending, escalated: orgEscalated },
        approvals: {
          proposed: num(approvals, 'proposed'),
          accepted: num(approvals, 'accepted'),
          executed: num(approvals, 'executed'),
        },
      },
      team: {
        basis: 'organization',
        memberCount,
        avgUtilizationPct,
        overloaded,
        available,
        utilizationCredible,
      },
      health: {
        score: healthScore,
        previousScore: previousHealthScore,
        trend,
        breakdown: {
          execution: executionScore,
          decisions: decisionsScore,
          capacity: capacityScore,
          risk: riskScore,
        },
      },
      risk: { level: riskLevel, blockers: ownerOverdue, escalations: orgEscalated },
    };

    res.json({ ...base, coherence: buildCoherenceChecks(base) } satisfies ManagerSnapshot);
  })
);

export default router;
