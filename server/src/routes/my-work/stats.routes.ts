/**
 * Stats, team workload, and AI context summary — extracted from my-work.routes.ts
 * Mounted under /api/my-work by the parent router.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { getWorkloadAssessment } from '../../services/aiWorkloadAssessment.js';
import { getCapacityOverview } from '../../services/workloadCapacityService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { requireTables, requireUser } from './_helpers.js';

const router = Router();

const isPostgres = process.env.DB_TYPE === 'postgres';
const nowSql = () => (isPostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')");
const daysAgoSql = (days: number) =>
  isPostgres ? `CURRENT_TIMESTAMP - INTERVAL '${days} days'` : `datetime('now', '-${days} days')`;

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

/**
 * GET /api/my-work/stats?period=week
 * Aggregates for ExecutiveDashboard — real trend + previous period comparison
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const period = String(req.query.period || 'week');
    const days = period === 'month' ? 30 : 7;
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const prevSinceIso = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString();
    const today = todayIsoDate();

    // --- Current period ---
    const totals = await queryHelpers.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM tasks WHERE organization_id = ? AND assignee_id = ? AND created_at >= ?`,
      [orgId, userId, sinceIso]
    );
    const completed = await queryHelpers.queryOne<{ completed: number }>(
      `SELECT COUNT(*) as completed FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ?`,
      [orgId, userId, sinceIso]
    );
    const overdue = await queryHelpers.queryOne<{ overdue: number }>(
      `SELECT COUNT(*) as overdue FROM tasks
       WHERE organization_id = ? AND assignee_id = ?
         AND due_date IS NOT NULL AND date(due_date) < date(?)
         AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
      [orgId, userId, today]
    );
    const onTime = await queryHelpers.queryOne<{ onTime: number; totalDone: number }>(
      `SELECT
         SUM(CASE WHEN due_date IS NOT NULL AND completed_at IS NOT NULL AND completed_at <= due_date THEN 1 ELSE 0 END) as "onTime",
         SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as "totalDone"
       FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ?`,
      [orgId, userId, sinceIso]
    );

    // --- Previous period (for trend calculation) ---
    const prevTotals = await queryHelpers.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM tasks WHERE organization_id = ? AND assignee_id = ? AND created_at >= ? AND created_at < ?`,
      [orgId, userId, prevSinceIso, sinceIso]
    );
    const prevCompleted = await queryHelpers.queryOne<{ completed: number }>(
      `SELECT COUNT(*) as completed FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?`,
      [orgId, userId, prevSinceIso, sinceIso]
    );
    const prevOnTime = await queryHelpers.queryOne<{ onTime: number; totalDone: number }>(
      `SELECT
         SUM(CASE WHEN due_date IS NOT NULL AND completed_at IS NOT NULL AND completed_at <= due_date THEN 1 ELSE 0 END) as "onTime",
         SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as "totalDone"
       FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?`,
      [orgId, userId, prevSinceIso, sinceIso]
    );

    // --- Escalations count ---
    const escalations = await queryHelpers.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM decisions
       WHERE organization_id = ? AND lower(coalesce(status,'')) = 'escalated'`,
      [orgId]
    );

    // --- Blocked tasks count ---
    const blocked = await queryHelpers.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM tasks
       WHERE organization_id = ? AND assignee_id = ?
         AND (lower(coalesce(status,'')) = 'blocked' OR blocked_reason IS NOT NULL OR blocked_by_decision_id IS NOT NULL)
         AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
      [orgId, userId]
    );

    const total = Number((totals as any)?.total || 0);
    const completedCount = Number((completed as any)?.completed || 0);
    const overdueCount = Number((overdue as any)?.overdue || 0);
    const totalDone = Number((onTime as any)?.totalDone || 0);
    const onTimeRate =
      totalDone > 0 ? Math.round((Number((onTime as any)?.onTime || 0) / totalDone) * 100) : 0;

    const prevTotal = Number((prevTotals as any)?.total || 0);
    const prevCompletedCount = Number((prevCompleted as any)?.completed || 0);
    const prevTotalDone = Number((prevOnTime as any)?.totalDone || 0);
    const prevOnTimeRate =
      prevTotalDone > 0
        ? Math.round((Number((prevOnTime as any)?.onTime || 0) / prevTotalDone) * 100)
        : 0;

    const currentScore = total > 0 ? (completedCount / total) * 100 : 0;
    const prevScore = prevTotal > 0 ? (prevCompletedCount / prevTotal) * 100 : 0;
    const trend: 'up' | 'down' | 'stable' =
      currentScore > prevScore + 5 ? 'up' : currentScore < prevScore - 5 ? 'down' : 'stable';

    res.json({
      total,
      completed: completedCount,
      onTimeRate,
      trend,
      byStatus: {
        overdue: overdueCount,
        blocked: Number((blocked as any)?.cnt || 0),
        escalated: Number((escalations as any)?.cnt || 0),
      },
      previous: {
        total: prevTotal,
        completed: prevCompletedCount,
        onTimeRate: prevOnTimeRate,
      },
    });
  })
);

/**
 * GET /api/my-work/team-workload
 * Simple team rollup for ExecutiveDashboard (no mock data).
 *
 * RBAC: org-wide roll-up — exposes EVERY user's capacity/utilization, so it is
 * a manager surface. Mirrors the client gate (MyWorkHub `canViewManager` =
 * admin | manager | superadmin/owner; see useUserCan). requireRole('manager',
 * 'admin') admits manager (exact), admin (level ≥ 2) and superadmin/owner
 * (short-circuit) while blocking plain USER/VIEWER/GUEST — who previously could
 * read the whole team's workload directly despite the Manager tab being hidden.
 */
router.get(
  '/team-workload',
  requireRole('manager', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const [overview, completedRows] = await Promise.all([
      getCapacityOverview(orgId),
      queryHelpers.queryAll<{ assignee_id: string; cnt: number }>(
        `SELECT assignee_id, COUNT(*) as cnt
         FROM tasks
         WHERE organization_id = ? AND completed_at IS NOT NULL
          AND completed_at >= ${daysAgoSql(7)}
         GROUP BY assignee_id`,
        [orgId]
      ),
    ]);
    const completedMap = new Map(
      (completedRows || []).map((row) => [String(row.assignee_id), Number(row.cnt || 0)])
    );
    res.json(
      overview.users.map((user) => ({
        id: user.userId,
        name: user.name,
        capacity: user.utilizationPercent,
        tasksAssigned: Math.round(user.allocatedHours),
        tasksCompleted: completedMap.get(user.userId) || 0,
        capacityHours: user.capacityHours,
        allocatedHours: user.allocatedHours,
        backlogHours: user.backlogHours,
        overloaded: user.overloaded,
      }))
    );
  })
);

/**
 * GET /api/my-work/team-workload/ai-assessment?refresh=1
 * (#24d) AI-ocena REALNEGO obciążenia: łączy czas w kalendarzu (v8_calendar_items)
 * z obciążeniem zadaniami (estymaty×alokacja) i syntetyzuje ocenę per osoba.
 * Read-only. Wynik cache'owany per (org, tydzień) — jedno wywołanie AI / tydzień.
 *
 * RBAC: identyczny jak /team-workload — org-wide roll-up = powierzchnia managera.
 */
router.get(
  '/team-workload/ai-assessment',
  requireRole('manager', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const refresh = String(req.query.refresh || '') === '1';
    const assessment = await getWorkloadAssessment(orgId, { refresh });
    res.json(assessment);
  })
);

/**
 * M1 — Chat Context Enrichment
 * Aggregates the user's current MyWork state for AI system prompt enrichment.
 */
router.get(
  '/context-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const summary: Record<string, any> = {};

    try {
      const taskCols = await getTableColumns('tasks');
      if (taskCols.has('assignee_id')) {
        const taskStats = await queryHelpers.queryAll<{ status: string; cnt: number }>(
          `SELECT status, COUNT(*) as cnt FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND status != 'done'
           GROUP BY status`,
          [userId, orgId]
        );
        summary.tasksByStatus = {};
        let totalOpen = 0;
        for (const row of taskStats || []) {
          summary.tasksByStatus[row.status] = row.cnt;
          totalOpen += row.cnt;
        }
        summary.totalOpenTasks = totalOpen;

        const overdue = await queryHelpers.queryAll<{ id: string; title: string }>(
          `SELECT id, title FROM tasks 
           WHERE assignee_id = ? AND organization_id = ? AND status != 'done' 
           AND due_date IS NOT NULL AND due_date < ${nowSql()}
           ORDER BY due_date ASC LIMIT 3`,
          [userId, orgId]
        );
        summary.overdueTasks = overdue || [];
        summary.overdueCount = summary.overdueTasks.length;
      }

      const decCols = await getTableColumns('decisions');
      const decisionDueColumn = decCols.has('due_date')
        ? 'due_date'
        : decCols.has('deadline')
          ? 'deadline'
          : null;
      if (decCols.has('decision_maker_id')) {
        const pendingDecs = await queryHelpers.queryAll<{
          id: string;
          title: string;
          due_date: string | null;
        }>(
          `SELECT id, title, ${decisionDueColumn ? `${decisionDueColumn} as due_date` : 'NULL as due_date'} FROM decisions 
           WHERE (decision_maker_id = ? OR created_by = ?) AND organization_id = ? AND status = 'pending'
           ORDER BY ${decisionDueColumn ? `${decisionDueColumn} ASC NULLS LAST,` : ''} updated_at DESC LIMIT 3`,
          [userId, userId, orgId]
        );
        summary.pendingDecisions = pendingDecs || [];
        summary.pendingDecisionCount = summary.pendingDecisions.length;
      }

      if (await requireTables(res, ['my_work_inbox_triage'])) {
        const notifCols = await getTableColumns('notifications');
        if (notifCols.size > 0) {
          const readExpr = notifCols.has('read')
            ? 'COALESCE(read, 0)'
            : notifCols.has('is_read')
              ? `CASE
                   WHEN COALESCE(is_read::text, '0') IN ('1','true','t','TRUE','T') THEN 1
                   ELSE 0
                 END`
              : '0';
          const unprocessed = await queryHelpers.queryOne<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM notifications 
             WHERE user_id = ? AND organization_id = ? AND ${readExpr} = 0`,
            [userId, orgId]
          );
          summary.inboxUnprocessed = unprocessed?.cnt || 0;
        }
      }

      if (await requireTables(res, ['my_work_focus_state'])) {
        const todayCount = await queryHelpers.queryOne<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM my_work_focus_state 
           WHERE user_id = ? AND column_name = 'today'`,
          [userId]
        );
        summary.focusTodayCount = todayCount?.cnt || 0;
      }
    } catch (err) {
      logger.error('[context-summary]', err);
    }

    res.json(summary);
  })
);

export default router;
