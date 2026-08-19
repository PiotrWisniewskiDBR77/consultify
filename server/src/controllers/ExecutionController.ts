/**
 * Execution Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles project execution summary, blockers, gate checks, portfolio health,
 * and execution statistics for the Execution Center module.
 *
 * Execution Center Statuses: EXECUTING, BLOCKED, DONE, CANCELLED, ARCHIVED
 */

import type { Response } from 'express';

import { derivePortfolioEvm } from '../services/evmService.js';
import { computeCanonicalExecutionHealth } from '../services/execution/canonicalExecutionHealthService.js';
import { getActualCostByInitiative } from '../services/executionBudgetService.js';
import { dispatchProjectCommunicationEvent } from '../services/integrations/communicationSyncService.js';
import {
  calculateRiskScore,
  categorizeScore,
  DEFAULT_THRESHOLDS,
} from '../services/raidScoringService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// Valid execution statuses
const EXECUTION_STATUSES = ['EXECUTING', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED'];

// Escalation thresholds
const ESCALATION_AMBER_DAYS = 3;
const ESCALATION_RED_DAYS = 7;

interface WhyRedChain {
  signals: Array<{ type: string; message: string; entityId?: string }>;
  risks: Array<{ id: string; title: string; severity?: string }>;
  decisions: Array<{ id: string; title: string; overdue?: boolean }>;
  tasks: Array<{ id: string; title: string; status: string }>;
}

interface InitiativeHealthItem {
  id: string;
  name: string;
  health: 'GREEN' | 'AMBER' | 'RED';
  whyRed?: WhyRedChain;
}

/**
 * M14/F3 — Cost-of-Delay ranking for the action queue (WSJF numerator).
 * CoD ≈ severity weight × urgency (days late) × blast radius (linked to an
 * initiative ⇒ affects more). No per-item job-size signal yet, so this is the
 * CoD numerator; the WSJF ÷ effort divisor lands when effort is captured.
 * Exported for unit testing the ranking.
 */
export function actionQueueCodScore(item: {
  type?: string;
  priority?: string;
  score?: number;
  severity?: string;
  dueDate?: string | null;
  periodStart?: string | null;
  initiativeId?: string | null;
}): number {
  const dayMs = 86_400_000;
  const daysLate = (ts?: string | null): number =>
    ts ? Math.max(0, (Date.now() - new Date(ts).getTime()) / dayMs) : 0;
  const weight = (): number => {
    switch (item.type) {
      case 'decision_overdue':
        return String(item.priority || '').toUpperCase() === 'CRITICAL' ? 10 : 6;
      case 'risk_high':
        return typeof item.score === 'number'
          ? item.score >= 10
            ? 9
            : item.score >= 8
              ? 7
              : 5
          : 6;
      case 'kpi_deviation_no_plan':
        return String(item.severity || '').toUpperCase() === 'RED' ? 6 : 4;
      case 'task_overdue':
        return 4;
      case 'comm_overdue':
        return 3;
      default:
        return 2;
    }
  };
  const urgency = 1 + daysLate(item.dueDate ?? item.periodStart);
  const blast = item.initiativeId ? 1.25 : 1;
  return weight() * urgency * blast;
}

interface PortfolioHealthMetrics {
  healthScore: number;
  onTrackCount: number;
  atRiskCount: number;
  blockedCount: number;
  avgProgress: number;
  overdueDecisions: number;
  totalDecisions: number;
  budgetHealth: number | null;
  breakdown: {
    execution: number;
    decisions: number;
    capacity: number;
    risk: number;
  };
  initiativeHealth?: InitiativeHealthItem[];
  // F2 — additive EVM roll-up (SPI/CPI/EAC…). Authoritative SPI/CPI facts feed
  // the same versioned health formula used by the other execution readers.
  evm?: ReturnType<typeof derivePortfolioEvm>;
  healthFormulaVersion: string;
  // True when authoritative EVM schedule or cost facts contribute to the one
  // canonical formula. There is no longer a separate flag-gated formula.
  evmHealthApplied?: boolean;
}

export class ExecutionController {
  /**
   * Get execution summary for a project
   */
  static getExecutionSummary = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get initiatives in execution phase
      const initiativesSql = `
        SELECT id, name, status, progress
        FROM initiatives
        WHERE project_id = ? AND organization_id = ?
          AND status IN ('EXECUTING', 'BLOCKED', 'DONE')
      `;
      const initiatives = (await queryHelpers.queryAll(initiativesSql, [projectId, orgId])) || [];

      // Get tasks for the project
      const tasksSql = `
        SELECT id, status, due_date
        FROM tasks
        WHERE project_id = ? AND organization_id = ?
      `;
      const tasks = (await queryHelpers.queryAll(tasksSql, [projectId, orgId])) || [];

      const now = Date.now();
      const onTrackTasks = tasks.filter(
        (t: any) => t.status !== 'BLOCKED' && (!t.due_date || new Date(t.due_date).getTime() > now)
      ).length;
      const atRiskTasks = tasks.filter((t: any) => {
        if (!t.due_date) return false;
        const daysUntilDue = Math.ceil(
          (new Date(t.due_date).getTime() - now) / (1000 * 60 * 60 * 24)
        );
        return daysUntilDue > 0 && daysUntilDue <= 3 && t.status !== 'DONE';
      }).length;
      const blockedTasks = tasks.filter((t: any) => t.status === 'BLOCKED').length;

      const totalProgress = initiatives.reduce((sum: number, i: any) => sum + (i.progress || 0), 0);
      const completionPercentage =
        initiatives.length > 0 ? Math.round(totalProgress / initiatives.length) : 0;

      res.json({
        projectId,
        completionPercentage,
        onTrackTasks,
        atRiskTasks,
        blockedTasks,
        totalInitiatives: initiatives.length,
        executingCount: initiatives.filter((i: any) => i.status === 'EXECUTING').length,
        doneCount: initiatives.filter((i: any) => i.status === 'DONE').length,
        updatedAt: new Date().toISOString(),
      });
    }
  );

  /**
   * Get blocked tasks for a project
   */
  static getBlockers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get blocked initiatives
      const blockedInitiativesSql = `
        SELECT i.id, i.name, i.blocked_reason, i.updated_at,
               u.first_name || ' ' || u.last_name as owner_name
        FROM initiatives i
        LEFT JOIN users u ON i.owner_business_id = u.id OR i.owner_execution_id = u.id
        WHERE i.project_id = ? AND i.organization_id = ?
          AND i.status = 'BLOCKED'
        ORDER BY i.updated_at DESC
      `;
      const blockedInitiatives =
        (await queryHelpers.queryAll(blockedInitiativesSql, [projectId, orgId])) || [];

      // Get blocked tasks
      const blockedTasksSql = `
        SELECT t.id, t.title, t.description, t.updated_at, t.initiative_id,
               u.first_name || ' ' || u.last_name as assignee_name,
               i.name as initiative_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE t.project_id = ? AND t.organization_id = ?
          AND t.status = 'BLOCKED'
        ORDER BY t.updated_at DESC
      `;
      const blockedTasks = (await queryHelpers.queryAll(blockedTasksSql, [projectId, orgId])) || [];

      // Get pending decisions that are blocking
      const blockingDecisionsSql = `
        SELECT d.id, d.title, d.deadline, d.decision_maker_id,
               u.first_name || ' ' || u.last_name as owner_name,
               CAST(julianday('now') - julianday(d.deadline) AS INTEGER) as days_overdue
        FROM decisions d
        LEFT JOIN users u ON d.decision_maker_id = u.id
        WHERE d.project_id = ? AND d.organization_id = ?
          AND d.status IN ('pending', 'escalated')
          AND EXISTS (
            SELECT 1 FROM decision_impacts di 
            WHERE di.decision_id = d.id AND di.is_blocker = TRUE
          )
        ORDER BY d.deadline ASC
      `;
      const blockingDecisions =
        (await queryHelpers.queryAll(blockingDecisionsSql, [projectId, orgId])) || [];

      res.json({
        blockedInitiatives: blockedInitiatives.map((b: any) => ({
          id: b.id,
          type: 'initiative',
          name: b.name,
          reason: b.blocked_reason,
          ownerName: b.owner_name,
          updatedAt: b.updated_at,
        })),
        blockedTasks: blockedTasks.map((t: any) => ({
          id: t.id,
          type: 'task',
          title: t.title,
          description: t.description,
          assigneeName: t.assignee_name,
          initiativeName: t.initiative_name,
          updatedAt: t.updated_at,
        })),
        blockingDecisions: blockingDecisions.map((d: any) => ({
          id: d.id,
          type: 'decision',
          title: d.title,
          ownerName: d.owner_name,
          dueDate: d.deadline,
          daysOverdue: Math.max(0, d.days_overdue || 0),
        })),
        totalBlockers: blockedInitiatives.length + blockedTasks.length + blockingDecisions.length,
      });
    }
  );

  /**
   * Perform gate check - validates if initiative can transition status
   */
  static checkGate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const { initiativeId, targetStatus } = req.body;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const errors: string[] = [];
      let canAdvance = true;

      // Check for pending blocking decisions
      if (targetStatus === 'DONE') {
        const pendingDecisionsSql = `
          SELECT COUNT(*) as count
          FROM decisions d
          JOIN decision_impacts di ON d.id = di.decision_id
          WHERE (d.initiative_id = ? OR d.project_id = ?)
            AND d.status IN ('pending', 'escalated')
            AND di.is_blocker = TRUE
        `;
        const pendingResult = await queryHelpers.queryOne<{ count: number }>(pendingDecisionsSql, [
          initiativeId,
          projectId,
        ]);

        if (pendingResult && pendingResult.count > 0) {
          canAdvance = false;
          errors.push(
            `${pendingResult.count} blocking decision(s) must be resolved before completing`
          );
        }
      }

      // Check for blocked tasks when completing
      if (targetStatus === 'DONE' && initiativeId) {
        const blockedTasksSql = `
          SELECT COUNT(*) as count
          FROM tasks
          WHERE initiative_id = ? AND status = 'BLOCKED'
        `;
        const blockedResult = await queryHelpers.queryOne<{ count: number }>(blockedTasksSql, [
          initiativeId,
        ]);

        if (blockedResult && blockedResult.count > 0) {
          canAdvance = false;
          errors.push(`${blockedResult.count} blocked task(s) must be resolved`);
        }
      }

      res.json({
        projectId,
        initiativeId,
        targetStatus,
        canAdvance,
        errors,
        message: canAdvance ? 'Gate check passed' : 'Gate check failed',
      });

      if (!canAdvance) {
        await dispatchProjectCommunicationEvent({
          organizationId: orgId,
          projectId,
          eventType: 'gate_pending',
          title: `Gate pending${initiativeId ? ' for initiative' : ''}`,
          body: errors.join(' ') || 'Execution gate requires follow-up before status can advance.',
          deepLink: initiativeId
            ? `/initiatives/${initiativeId}`
            : `/execution?projectId=${projectId}`,
          severity: 'high',
        }).catch((err: any) =>
          logger.warn('[ExecutionController] Gate communication sync failed:', err?.message)
        );
      }
    }
  );

  /**
   * Get portfolio health metrics for Execution Center dashboard
   */
  static getPortfolioHealth = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get initiatives in execution phase
      const initiativesSql = `
        SELECT id, name, status, progress, cost_capex, cost_opex, planned_start_date, planned_end_date
        FROM initiatives
        WHERE project_id = ? AND organization_id = ?
          AND status IN ('EXECUTING', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED')
      `;
      const initiatives = (await queryHelpers.queryAll(initiativesSql, [projectId, orgId])) || [];

      // Get tasks (initiative_id, title for whyRed chain)
      const tasksSql = `
        SELECT id, initiative_id, title, status, due_date
        FROM tasks
        WHERE project_id = ? AND organization_id = ?
      `;
      const tasks = (await queryHelpers.queryAll(tasksSql, [projectId, orgId])) || [];

      // Get decisions (initiative_id, title for whyRed chain)
      const decisionsSql = `
        SELECT id, initiative_id, project_id, title, status, deadline, priority, impact
        FROM decisions
        WHERE project_id = ? AND organization_id = ?
          AND status IN ('pending', 'escalated')
      `;
      const decisions = (await queryHelpers.queryAll(decisionsSql, [projectId, orgId])) || [];

      // Get RAID risks (initiative_id for whyRed chain)
      const risksSql = `
        SELECT id, initiative_id, title, impact as severity
        FROM raid_items
        WHERE organization_id = ?
          AND initiative_id IN (SELECT id FROM initiatives WHERE project_id = ? AND organization_id = ?)
          AND UPPER(type) = 'RISK' AND UPPER(COALESCE(status, 'OPEN')) IN ('OPEN', 'IN_PROGRESS')
      `;
      const raidRisks = (await queryHelpers.queryAll(risksSql, [orgId, projectId, orgId])) || [];

      // Calculate metrics
      const totalInitiatives = initiatives.filter((i: any) =>
        ['EXECUTING', 'BLOCKED'].includes(i.status)
      ).length;
      const blockedCount = initiatives.filter((i: any) => i.status === 'BLOCKED').length;
      const onTrackCount = totalInitiatives - blockedCount;
      const atRiskCount = blockedCount;

      const avgProgress =
        totalInitiatives > 0
          ? Math.round(
              initiatives
                .filter((i: any) => ['EXECUTING', 'BLOCKED'].includes(i.status))
                .reduce((sum: number, i: any) => sum + (i.progress || 0), 0) / totalInitiatives
            )
          : 0;

      const now = Date.now();
      const overdueDecisions = decisions.filter((d: any) => {
        if (!d.deadline) return false;
        return new Date(d.deadline).getTime() < now;
      }).length;
      const totalDecisions = decisions.length;

      const completedTasks = tasks.filter((t: any) => t.status === 'DONE').length;
      const taskHealth = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

      const decisionHealth =
        totalDecisions > 0
          ? Math.max(0, 100 - Math.round((overdueDecisions / totalDecisions) * 100))
          : 100;

      const riskHealth =
        totalInitiatives > 0
          ? Math.max(0, 100 - Math.round((blockedCount / totalInitiatives) * 100))
          : 100;

      // Budget health: NULL when there is no actual-spend signal here. The old
      // value returned budget-DATA COVERAGE (% of initiatives with a budget set)
      // mislabelled as "health" — a number that looked like a score but measured
      // completeness. Honest null > misleading number; real budget health
      // (CPI/overrun) is computed where actual spend exists (executionBudgetService, F2).
      const budgetHealth = null;

      // V4-EXEC-01: Per-initiative health + whyRed chain
      const initiativeHealth: InitiativeHealthItem[] = [];
      const execInitiatives = initiatives.filter((i: any) =>
        ['EXECUTING', 'BLOCKED'].includes(i.status)
      );
      for (const ini of execInitiatives) {
        const initiativeId = ini.id;
        const blockedTasksForIni = (tasks as any[]).filter(
          (t) => t.initiative_id === initiativeId && String(t.status).toUpperCase() === 'BLOCKED'
        );
        const overdueTasksForIni = (tasks as any[]).filter((t) => {
          if (t.initiative_id !== initiativeId) return false;
          if (String(t.status).toUpperCase() === 'DONE') return false;
          if (!t.due_date) return false;
          return new Date(t.due_date).getTime() < now;
        });
        const decisionsForIni = (decisions as any[]).filter(
          (d) => d.initiative_id === initiativeId || d.project_id === projectId
        );
        const overdueDecForIni = decisionsForIni.filter((d) => {
          if (!d.deadline) return false;
          return new Date(d.deadline).getTime() < now;
        });
        const pendingDecForIni = decisionsForIni.filter((d) =>
          ['pending', 'escalated'].includes(String(d.status).toLowerCase())
        );

        let health: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
        const whyRed: WhyRedChain = { signals: [], risks: [], decisions: [], tasks: [] };

        const risksForIni = (raidRisks as any[]).filter((r) => r.initiative_id === initiativeId);

        if (
          String(ini.status).toUpperCase() === 'BLOCKED' ||
          blockedTasksForIni.length > 0 ||
          overdueDecForIni.length > 0
        ) {
          health = 'RED';
          if (String(ini.status).toUpperCase() === 'BLOCKED') {
            whyRed.signals.push({ type: 'status', message: 'Initiative is BLOCKED' });
          }
          if (risksForIni.length > 0) {
            whyRed.signals.push({
              type: 'risks',
              message: `${risksForIni.length} open RAID risk(s)`,
            });
          }
          risksForIni.slice(0, 5).forEach((r: any) =>
            whyRed.risks.push({
              id: r.id,
              title: r.title || r.id,
              severity: r.severity,
            })
          );
          blockedTasksForIni
            .slice(0, 5)
            .forEach((t: any) =>
              whyRed.tasks.push({ id: t.id, title: t.title || t.id, status: 'BLOCKED' })
            );
          overdueTasksForIni
            .slice(0, 5)
            .forEach((t: any) =>
              whyRed.tasks.push({ id: t.id, title: t.title || t.id, status: 'OVERDUE' })
            );
          overdueDecForIni.slice(0, 5).forEach((d: any) =>
            whyRed.decisions.push({
              id: d.id,
              title: d.title || d.id,
              overdue: true,
            })
          );
        } else if (overdueTasksForIni.length > 0 || pendingDecForIni.length > 0) {
          health = 'AMBER';
          if (overdueTasksForIni.length > 0) {
            whyRed.signals.push({
              type: 'tasks',
              message: `${overdueTasksForIni.length} overdue task(s)`,
            });
          }
          if (pendingDecForIni.length > 0) {
            whyRed.signals.push({
              type: 'decisions',
              message: `${pendingDecForIni.length} pending decision(s)`,
            });
          }
        }

        initiativeHealth.push({
          id: initiativeId,
          name: ini.name || ini.title || 'Initiative',
          health,
          ...(health !== 'GREEN' && Object.values(whyRed).some((a) => a.length > 0)
            ? { whyRed }
            : {}),
        });
      }

      // F2 — additive portfolio EVM roll-up. PV from schedule, EV from progress,
      // AC from actual budget entries (CPI now real). Honest coverage shows how
      // many initiatives had a cost baseline. Does not alter healthScore yet.
      const actualByIni = await getActualCostByInitiative(
        orgId,
        (initiatives as any[]).map((i) => String(i.id))
      ).catch(() => new Map<string, number>());
      const portfolioEvm = derivePortfolioEvm(
        (initiatives as any[]).map((i) => ({
          bac: (Number(i.cost_capex) || 0) + (Number(i.cost_opex) || 0),
          plannedStart: i.planned_start_date,
          plannedEnd: i.planned_end_date,
          progressPct: Number(i.progress) || 0,
          actualCost: actualByIni.get(String(i.id)) ?? null,
        })),
        Date.now()
      );

      const canonicalHealth = computeCanonicalExecutionHealth({
        progressPct: avgProgress,
        taskCompletionPct: taskHealth,
        decisionHealthPct: decisionHealth,
        riskHealthPct: riskHealth,
        spi: portfolioEvm?.spi,
        cpi: portfolioEvm?.cpi,
      });
      const evmHealthApplied = canonicalHealth.components.schedule != null || canonicalHealth.components.cost != null;
      const executionDim = canonicalHealth.components.schedule ?? canonicalHealth.components.progress ?? 0;
      const effectiveHealthScore = canonicalHealth.score ?? 0;

      const metrics: PortfolioHealthMetrics = {
        healthScore: effectiveHealthScore,
        onTrackCount,
        atRiskCount,
        blockedCount,
        avgProgress,
        overdueDecisions,
        totalDecisions,
        budgetHealth,
        breakdown: {
          execution: executionDim,
          decisions: decisionHealth,
          capacity: taskHealth,
          risk: riskHealth,
        },
        initiativeHealth,
        evm: portfolioEvm,
        evmHealthApplied,
        healthFormulaVersion: canonicalHealth.formulaVersion,
      };

      res.json(metrics);
    }
  );

  /**
   * Get execution statistics by status
   */
  static getExecutionStats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.query;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      let sql = `
        SELECT 
          status,
          COUNT(*) as count,
          AVG(progress) as avg_progress
        FROM initiatives
        WHERE organization_id = ?
          AND status IN ('EXECUTING', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED')
      `;
      const params: (string | number)[] = [orgId];

      if (projectId) {
        sql += ` AND project_id = ?`;
        params.push(String(projectId));
      }

      sql += ` GROUP BY status`;

      const stats = (await queryHelpers.queryAll(sql, params)) || [];

      const result = EXECUTION_STATUSES.reduce(
        (acc, status) => {
          const stat = stats.find((s: any) => s.status === status);
          acc[status] = {
            count: stat?.count || 0,
            avgProgress: Math.round(stat?.avg_progress || 0),
          };
          return acc;
        },
        {} as Record<string, { count: number; avgProgress: number }>
      );

      res.json({
        stats: result,
        total: Object.values(result).reduce((sum, s) => sum + s.count, 0),
        updatedAt: new Date().toISOString(),
      });
    }
  );

  /**
   * Get escalations dashboard data
   */
  static getEscalations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.query;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get overdue decisions with escalation levels
      let decisionsSql = `
        SELECT 
          d.id, d.title, d.deadline, d.priority, d.impact, d.escalation_level,
          u.first_name || ' ' || u.last_name as owner_name,
          p.name as project_name,
          CAST(julianday('now') - julianday(d.deadline) AS INTEGER) as days_overdue
        FROM decisions d
        LEFT JOIN users u ON d.decision_maker_id = u.id
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.organization_id = ?
          AND d.status IN ('pending', 'escalated')
          AND d.deadline IS NOT NULL
          AND julianday('now') > julianday(d.deadline)
      `;
      const params: (string | number)[] = [orgId];

      if (projectId) {
        decisionsSql += ` AND d.project_id = ?`;
        params.push(String(projectId));
      }

      decisionsSql += ` ORDER BY days_overdue DESC LIMIT 50`;

      const overdueDecisions = (await queryHelpers.queryAll(decisionsSql, params)) || [];

      // Categorize by escalation level
      const amber = overdueDecisions.filter((d: any) => {
        const daysOverdue = d.days_overdue || 0;
        return daysOverdue > 0 && daysOverdue <= ESCALATION_RED_DAYS;
      });

      const red = overdueDecisions.filter((d: any) => {
        const daysOverdue = d.days_overdue || 0;
        const isCritical = d.priority === 'CRITICAL' || d.impact === 'HIGH';
        return daysOverdue > ESCALATION_RED_DAYS || isCritical;
      });

      res.json({
        escalations: {
          amber: amber.map((d: any) => ({
            id: d.id,
            title: d.title,
            ownerName: d.owner_name,
            projectName: d.project_name,
            daysOverdue: d.days_overdue,
            level: 'amber',
          })),
          red: red.map((d: any) => ({
            id: d.id,
            title: d.title,
            ownerName: d.owner_name,
            projectName: d.project_name,
            daysOverdue: d.days_overdue,
            level: 'red',
          })),
        },
        counts: {
          amber: amber.length,
          red: red.length,
          total: overdueDecisions.length,
        },
        updatedAt: new Date().toISOString(),
      });
    }
  );

  /**
   * Get calendar items (tasks and decisions with deadlines)
   */
  static getCalendarItems = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId, startDate, endDate } = req.query;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const start = startDate
        ? new Date(String(startDate)).toISOString()
        : new Date().toISOString();
      const end = endDate
        ? new Date(String(endDate)).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get tasks with due dates
      let tasksSql = `
        SELECT t.id, t.title, t.status, t.due_date, t.priority,
               u.first_name || ' ' || u.last_name as assignee_name,
               i.name as initiative_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE t.organization_id = ?
          AND t.due_date IS NOT NULL
          AND t.due_date BETWEEN ? AND ?
      `;
      const taskParams: (string | number)[] = [orgId, start, end];

      if (projectId) {
        tasksSql += ` AND t.project_id = ?`;
        taskParams.push(String(projectId));
      }

      tasksSql += ` ORDER BY t.due_date ASC`;

      const tasks = (await queryHelpers.queryAll(tasksSql, taskParams)) || [];

      // Get decisions with deadlines
      let decisionsSql = `
        SELECT d.id, d.title, d.status, d.deadline, d.priority,
               u.first_name || ' ' || u.last_name as owner_name,
               i.name as related_object_name
        FROM decisions d
        LEFT JOIN users u ON d.decision_maker_id = u.id
        LEFT JOIN initiatives i ON d.initiative_id = i.id
        WHERE d.organization_id = ?
          AND d.deadline IS NOT NULL
          AND d.deadline BETWEEN ? AND ?
          AND d.status IN ('pending', 'escalated')
      `;
      const decisionParams: (string | number)[] = [orgId, start, end];

      if (projectId) {
        decisionsSql += ` AND d.project_id = ?`;
        decisionParams.push(String(projectId));
      }

      decisionsSql += ` ORDER BY d.deadline ASC`;

      const decisions = (await queryHelpers.queryAll(decisionsSql, decisionParams)) || [];

      res.json({
        items: [
          ...tasks.map((t: any) => ({
            id: `task-${t.id}`,
            type: 'task',
            title: t.title,
            dueDate: t.due_date,
            status: t.status,
            priority: t.priority,
            initiativeName: t.initiative_name,
            ownerName: t.assignee_name,
          })),
          ...decisions.map((d: any) => ({
            id: `decision-${d.id}`,
            type: 'decision',
            title: d.title,
            dueDate: d.deadline,
            status: d.status,
            priority: d.priority,
            initiativeName: d.related_object_name,
            ownerName: d.owner_name,
          })),
        ].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
        updatedAt: new Date().toISOString(),
      });
    }
  );

  /**
   * V4-EXEC-02: Action Queue — overdue decisions, high P×I risks, overdue tasks
   * Used by ExecutionHub / Inbox for triage
   */
  static getActionQueue = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const projectFilter = projectId ? ` AND d.project_id = ?` : '';
      const projectFilterT = projectId ? ` AND t.project_id = ?` : '';
      const projectFilterR = projectId
        ? ` AND r.initiative_id IN (SELECT id FROM initiatives WHERE project_id = ? AND organization_id = ?)`
        : '';
      const projectFilterComm = projectId
        ? ` AND cp.initiative_id IN (SELECT id FROM initiatives WHERE project_id = ? AND organization_id = ?)`
        : '';
      const projectFilterKpi = projectId
        ? ` AND c.kpi_id IN (
              SELECT ik.id
              FROM initiative_kpis ik
              LEFT JOIN initiatives i ON i.id = ik.initiative_id
              WHERE COALESCE(ik.organization_id, i.organization_id) = ?
                AND i.project_id = ?
            )`
        : '';
      const paramsDec: (string | number)[] = [orgId];
      const paramsTask: (string | number)[] = [orgId];
      const paramsRisk: (string | number)[] = [orgId];
      const paramsComm: (string | number)[] = [orgId];
      const paramsKpi: (string | number)[] = [orgId];
      if (projectId) {
        paramsDec.push(String(projectId));
        paramsTask.push(String(projectId));
        paramsRisk.push(String(projectId), orgId);
        paramsComm.push(String(projectId), orgId);
        paramsKpi.push(orgId, String(projectId));
      }

      const safeQueryAll = async (sql: string, params: (string | number)[]) => {
        try {
          return (await queryHelpers.queryAll(sql, params)) || [];
        } catch (error: any) {
          const msg = String(error?.message || '').toLowerCase();
          if (
            msg.includes('no such table') ||
            msg.includes('does not exist') ||
            msg.includes('relation')
          ) {
            return [];
          }
          throw error;
        }
      };

      // Overdue decisions (pending/escalated, past deadline)
      const decisionsSql = `
        SELECT d.id, d.title, d.deadline, d.priority, d.impact, d.initiative_id,
               i.name as initiative_name,
               u.first_name || ' ' || u.last_name as owner_name
        FROM decisions d
        LEFT JOIN initiatives i ON d.initiative_id = i.id
        LEFT JOIN users u ON d.decision_maker_id = u.id
        WHERE d.organization_id = ?
          AND d.status IN ('pending', 'escalated')
          AND d.deadline IS NOT NULL
          AND (d.deadline < datetime('now') OR julianday(d.deadline) < julianday('now'))
          ${projectFilter}
        ORDER BY d.deadline ASC LIMIT 50
      `;
      const overdueDecisions = await safeQueryAll(decisionsSql, paramsDec);

      // High P×I risks (CRITICAL or HIGH impact, OPEN status)
      const risksSql = `
        SELECT r.id, r.title, r.impact, r.probability, r.initiative_id,
               i.name as initiative_name
        FROM raid_items r
        LEFT JOIN initiatives i ON r.initiative_id = i.id
        WHERE r.organization_id = ?
          AND UPPER(r.type) = 'RISK'
          AND UPPER(COALESCE(r.status, 'OPEN')) IN ('OPEN', 'IN_PROGRESS')
          ${projectFilterR}
        LIMIT 200
      `;
      const highRisksRaw = await safeQueryAll(risksSql, paramsRisk);
      // F1 — single canonical risk classifier (raidScoringService). Replaces the
      // ad-hoc `impact IN (CRITICAL,HIGH) OR probability=HIGH` SQL filter so the
      // action queue's "high risk" matches the heatmap and signals: surface
      // AMBER+RED (categorizeScore !== GREEN), ranked by the P×I score. One
      // definition of "high risk" across the module (was 3 divergent ones).
      const highRisks = (highRisksRaw as any[])
        .map((r) => ({
          ...r,
          _score: calculateRiskScore(String(r.probability || ''), String(r.impact || '')),
        }))
        .filter((r) => categorizeScore(r._score, DEFAULT_THRESHOLDS) !== 'GREEN')
        .sort((a, b) => b._score - a._score)
        .slice(0, 30);

      // Overdue tasks (not DONE, past due)
      const tasksSql = `
        SELECT t.id, t.title, t.due_date, t.status, t.initiative_id,
               i.name as initiative_name,
               u.first_name || ' ' || u.last_name as assignee_name
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        LEFT JOIN users u ON t.assignee_id = u.id
        WHERE t.organization_id = ?
          AND t.status NOT IN ('DONE', 'CANCELLED')
          AND t.due_date IS NOT NULL
          AND (t.due_date < datetime('now') OR julianday(t.due_date) < julianday('now'))
          ${projectFilterT}
        ORDER BY t.due_date ASC LIMIT 50
      `;
      const overdueTasks = await safeQueryAll(tasksSql, paramsTask);

      // Overdue stakeholder communication plans (active cadence past due)
      const commSql = `
        SELECT cp.id, cp.description, cp.cadence, cp.next_due_at, cp.initiative_id,
               i.name as initiative_name,
               u.first_name || ' ' || u.last_name as owner_name
        FROM communication_plans cp
        LEFT JOIN initiatives i ON cp.initiative_id = i.id
        LEFT JOIN users u ON cp.owner_user_id = u.id
        WHERE cp.organization_id = ?
          AND cp.is_active = 1
          AND cp.next_due_at IS NOT NULL
          AND (cp.next_due_at < datetime('now') OR julianday(cp.next_due_at) < julianday('now'))
          ${projectFilterComm}
        ORDER BY cp.next_due_at ASC
        LIMIT 30
      `;
      const overdueComms = await safeQueryAll(commSql, paramsComm);

      // KPI deviations without an open mitigation action plan
      const kpiSql = `
        SELECT c.id, c.severity, c.period_start, c.kpi_id, c.owner_user_id, c.deviation_summary,
               k.name as kpi_name,
               i.id as initiative_id,
               i.name as initiative_name,
               u.first_name || ' ' || u.last_name as owner_name
        FROM kpi_deviation_cases c
        LEFT JOIN initiative_kpis k ON k.id = c.kpi_id
        LEFT JOIN initiatives i ON i.id = k.initiative_id
        LEFT JOIN users u ON u.id = COALESCE(c.owner_user_id, k.owner_user_id)
        WHERE c.organization_id = ?
          AND UPPER(COALESCE(c.status, 'OPEN')) IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'MITIGATING')
          AND NOT EXISTS (
            SELECT 1
            FROM kpi_deviation_actions a
            WHERE a.case_id = c.id
              AND UPPER(COALESCE(a.status, 'OPEN')) = 'OPEN'
          )
          ${projectFilterKpi}
        ORDER BY CASE UPPER(COALESCE(c.severity, 'AMBER')) WHEN 'RED' THEN 1 ELSE 2 END, c.period_start ASC
        LIMIT 30
      `;
      const kpiDeviations = await safeQueryAll(kpiSql, paramsKpi);

      const items = [
        ...overdueDecisions.map((d: any) => ({
          type: 'decision_overdue' as const,
          id: d.id,
          title: d.title,
          dueDate: d.deadline,
          priority: d.priority,
          initiativeId: d.initiative_id,
          initiativeName: d.initiative_name,
          ownerName: d.owner_name,
        })),
        ...highRisks.map((r: any) => ({
          type: 'risk_high' as const,
          id: r.id,
          title: r.title,
          impact: r.impact,
          probability: r.probability,
          score: r._score,
          initiativeId: r.initiative_id,
          initiativeName: r.initiative_name,
        })),
        ...overdueTasks.map((t: any) => ({
          type: 'task_overdue' as const,
          id: t.id,
          title: t.title,
          dueDate: t.due_date,
          status: t.status,
          initiativeId: t.initiative_id,
          initiativeName: t.initiative_name,
          assigneeName: t.assignee_name,
        })),
        ...overdueComms.map((c: any) => ({
          type: 'comm_overdue' as const,
          id: c.id,
          title: c.description || 'Stakeholder communication due',
          dueDate: c.next_due_at,
          cadence: c.cadence,
          initiativeId: c.initiative_id,
          initiativeName: c.initiative_name,
          ownerName: c.owner_name,
        })),
        ...kpiDeviations.map((k: any) => ({
          type: 'kpi_deviation_no_plan' as const,
          id: k.id,
          title: k.kpi_name || 'KPI deviation',
          severity: k.severity,
          periodStart: k.period_start,
          summary: k.deviation_summary,
          initiativeId: k.initiative_id,
          initiativeName: k.initiative_name,
          ownerName: k.owner_name,
        })),
      ].sort((a: any, b: any) => actionQueueCodScore(b) - actionQueueCodScore(a));

      res.json({
        items,
        counts: {
          decision_overdue: overdueDecisions.length,
          risk_high: highRisks.length,
          task_overdue: overdueTasks.length,
          comm_overdue: overdueComms.length,
          kpi_deviation_no_plan: kpiDeviations.length,
          total: items.length,
        },
        updatedAt: new Date().toISOString(),
      });
    }
  );
}

export default ExecutionController;
