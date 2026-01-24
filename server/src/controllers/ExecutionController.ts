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

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';

// Valid execution statuses
const EXECUTION_STATUSES = ['EXECUTING', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED'];

// Escalation thresholds
const ESCALATION_AMBER_DAYS = 3;
const ESCALATION_RED_DAYS = 7;

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
      const initiatives = await queryHelpers.queryAll(initiativesSql, [projectId, orgId]) || [];

      // Get tasks for the project
      const tasksSql = `
        SELECT id, status, due_date
        FROM tasks
        WHERE project_id = ? AND organization_id = ?
      `;
      const tasks = await queryHelpers.queryAll(tasksSql, [projectId, orgId]) || [];

      const now = Date.now();
      const onTrackTasks = tasks.filter((t: any) => 
        t.status !== 'BLOCKED' && (!t.due_date || new Date(t.due_date).getTime() > now)
      ).length;
      const atRiskTasks = tasks.filter((t: any) => {
        if (!t.due_date) return false;
        const daysUntilDue = Math.ceil((new Date(t.due_date).getTime() - now) / (1000 * 60 * 60 * 24));
        return daysUntilDue > 0 && daysUntilDue <= 3 && t.status !== 'DONE';
      }).length;
      const blockedTasks = tasks.filter((t: any) => t.status === 'BLOCKED').length;

      const totalProgress = initiatives.reduce((sum: number, i: any) => sum + (i.progress || 0), 0);
      const completionPercentage = initiatives.length > 0 
        ? Math.round(totalProgress / initiatives.length) 
        : 0;

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
      const blockedInitiatives = await queryHelpers.queryAll(blockedInitiativesSql, [projectId, orgId]) || [];

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
      const blockedTasks = await queryHelpers.queryAll(blockedTasksSql, [projectId, orgId]) || [];

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
            WHERE di.decision_id = d.id AND di.is_blocker = 1
          )
        ORDER BY d.deadline ASC
      `;
      const blockingDecisions = await queryHelpers.queryAll(blockingDecisionsSql, [projectId, orgId]) || [];

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
            AND di.is_blocker = 1
        `;
        const pendingResult = await queryHelpers.queryOne<{ count: number }>(
          pendingDecisionsSql,
          [initiativeId, projectId]
        );

        if (pendingResult && pendingResult.count > 0) {
          canAdvance = false;
          errors.push(`${pendingResult.count} blocking decision(s) must be resolved before completing`);
        }
      }

      // Check for blocked tasks when completing
      if (targetStatus === 'DONE' && initiativeId) {
        const blockedTasksSql = `
          SELECT COUNT(*) as count
          FROM tasks
          WHERE initiative_id = ? AND status = 'BLOCKED'
        `;
        const blockedResult = await queryHelpers.queryOne<{ count: number }>(
          blockedTasksSql,
          [initiativeId]
        );

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
        SELECT id, name, status, progress, cost_capex, cost_opex
        FROM initiatives
        WHERE project_id = ? AND organization_id = ?
          AND status IN ('EXECUTING', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED')
      `;
      const initiatives = await queryHelpers.queryAll(initiativesSql, [projectId, orgId]) || [];

      // Get tasks
      const tasksSql = `
        SELECT id, status, due_date
        FROM tasks
        WHERE project_id = ? AND organization_id = ?
      `;
      const tasks = await queryHelpers.queryAll(tasksSql, [projectId, orgId]) || [];

      // Get decisions
      const decisionsSql = `
        SELECT id, status, deadline, priority, impact
        FROM decisions
        WHERE project_id = ? AND organization_id = ?
          AND status IN ('pending', 'escalated')
      `;
      const decisions = await queryHelpers.queryAll(decisionsSql, [projectId, orgId]) || [];

      // Calculate metrics
      const totalInitiatives = initiatives.filter((i: any) => 
        ['EXECUTING', 'BLOCKED'].includes(i.status)
      ).length;
      const blockedCount = initiatives.filter((i: any) => i.status === 'BLOCKED').length;
      const onTrackCount = totalInitiatives - blockedCount;
      const atRiskCount = blockedCount;

      const avgProgress = totalInitiatives > 0
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
      const taskHealth = tasks.length > 0 
        ? Math.round((completedTasks / tasks.length) * 100) 
        : 0;

      const decisionHealth = totalDecisions > 0
        ? Math.max(0, 100 - Math.round((overdueDecisions / totalDecisions) * 100))
        : 100;

      const riskHealth = totalInitiatives > 0
        ? Math.max(0, 100 - Math.round((blockedCount / totalInitiatives) * 100))
        : 100;

      const healthScore = Math.round((avgProgress + decisionHealth + taskHealth + riskHealth) / 4);

      // Budget health (simplified - percentage of initiatives with budget data)
      const budgetValues = initiatives
        .filter((i: any) => i.cost_capex || i.cost_opex)
        .length;
      const budgetHealth = initiatives.length > 0 
        ? Math.round((budgetValues / initiatives.length) * 100) 
        : null;

      const metrics: PortfolioHealthMetrics = {
        healthScore,
        onTrackCount,
        atRiskCount,
        blockedCount,
        avgProgress,
        overdueDecisions,
        totalDecisions,
        budgetHealth,
        breakdown: {
          execution: avgProgress,
          decisions: decisionHealth,
          capacity: taskHealth,
          risk: riskHealth,
        },
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

      const stats = await queryHelpers.queryAll(sql, params) || [];

      const result = EXECUTION_STATUSES.reduce((acc, status) => {
        const stat = stats.find((s: any) => s.status === status);
        acc[status] = {
          count: stat?.count || 0,
          avgProgress: Math.round(stat?.avg_progress || 0),
        };
        return acc;
      }, {} as Record<string, { count: number; avgProgress: number }>);

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

      const overdueDecisions = await queryHelpers.queryAll(decisionsSql, params) || [];

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

      const start = startDate ? new Date(String(startDate)).toISOString() : new Date().toISOString();
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

      const tasks = await queryHelpers.queryAll(tasksSql, taskParams) || [];

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

      const decisions = await queryHelpers.queryAll(decisionsSql, decisionParams) || [];

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
}

export default ExecutionController;
