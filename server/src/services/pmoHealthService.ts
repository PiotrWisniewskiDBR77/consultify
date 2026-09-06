/**
 * PMO Health Service - Single Source of Truth
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/pmoHealthService.js (CommonJS) to TypeScript (ES Modules)
 * Step A: Canonical PMOHealthSnapshot for UI and AI context
 *
 * This service provides a canonical snapshot of PMO health for a project,
 * used by both UI and AI context builder to ensure consistency.
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { evaluateGate, getGateType, type Phase, PHASE_ORDER } from './stageGateService.js';

// ==========================================
// TYPES
// ==========================================

interface Project {
  id: string;
  name: string;
  current_phase?: Phase | null;
  [key: string]: unknown;
}

interface StageGate {
  gateType: string | null;
  isReady: boolean;
  missingCriteria: Array<{ criterion: string; evidence: string }>;
  metCriteria: Array<{ criterion: string; evidence: string }>;
}

interface TaskCounts {
  overdueCount: number;
  dueSoonCount: number;
  blockedCount: number;
}

interface DecisionCounts {
  pendingCount: number;
  overdueCount: number;
}

interface InitiativeCounts {
  atRiskCount: number;
  blockedCount: number;
}

interface Blocker {
  type: 'DECISION' | 'TASK' | 'GATE' | 'GOVERNANCE';
  message: string;
  ref?: {
    entityType: string;
    entityId: string;
  };
}

interface PMOHealthSnapshot {
  projectId: string;
  projectName: string;
  phase: {
    number: number;
    name: Phase;
  };
  stageGate: StageGate;
  blockers: Blocker[];
  tasks: TaskCounts;
  decisions: DecisionCounts;
  initiatives: InitiativeCounts;
  updatedAt: string;
}

interface TaskCountRow {
  overdueCount?: number;
  dueSoonCount?: number;
  blockedCount?: number;
}

interface DecisionCountRow {
  pendingCount?: number;
  overdueCount?: number;
}

interface InitiativeCountRow {
  atRiskCount?: number;
  blockedCount?: number;
}

interface TaskRow {
  id: string;
  title: string;
}

interface DecisionRow {
  id: string;
  title: string;
}

interface ProjectPhaseRow {
  current_phase?: Phase | null;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

/**
 * Get PMOHealthSnapshot for a project
 * Returns a canonical snapshot of project health status
 */
export async function getHealthSnapshot(projectId: string): Promise<PMOHealthSnapshot> {
  const startTime = Date.now();

  // 1. Get project and current phase
  // fallback: false — this lookup expects a definite row; without it,
  // DbPromise.get() silently swallows real DB errors (connection lost,
  // locked table, etc.) as `null`, which then gets reported below as the
  // generic "Project not found", masking the actual failure.
  const project = await DbPromise.get<Project>(
    db,
    `SELECT * FROM projects WHERE id = ?`,
    [projectId],
    { fallback: false }
  );

  if (!project) {
    throw new Error('Project not found');
  }

  const currentPhase = (project.current_phase || 'Context') as Phase;
  const phaseNumber = PHASE_ORDER.indexOf(currentPhase) + 1;

  // 2. Evaluate stage gate
  let stageGate: StageGate = {
    gateType: null,
    isReady: false,
    missingCriteria: [],
    metCriteria: [],
  };

  if (phaseNumber < PHASE_ORDER.length) {
    const nextPhase = PHASE_ORDER[phaseNumber];
    const gateType = getGateType(currentPhase, nextPhase);

    if (gateType) {
      const evaluation = await evaluateGate(projectId, gateType);
      stageGate = {
        gateType,
        isReady: evaluation.status === 'READY',
        missingCriteria: (evaluation.completionCriteria || [])
          .filter((c) => !c.isMet)
          .map((c) => ({ criterion: c.criterion, evidence: c.evidence })),
        metCriteria: (evaluation.completionCriteria || [])
          .filter((c) => c.isMet)
          .map((c) => ({ criterion: c.criterion, evidence: c.evidence })),
      };
    }
  }

  // 3. Get task counts with efficient SQL
  const taskCounts = await getTaskCounts(projectId);

  // 4. Get decision counts
  const decisionCounts = await getDecisionCounts(projectId);

  // 5. Get initiative counts
  const initiativeCounts = await getInitiativeCounts(projectId);

  // 6. Get blockers
  const blockers = await getBlockers(projectId);

  const duration = Date.now() - startTime;
  logger.info(`[PMOHealthService] Snapshot generated in ${duration}ms for project ${projectId}`);

  return {
    projectId,
    projectName: project.name,
    phase: {
      number: phaseNumber,
      name: currentPhase,
    },
    stageGate,
    blockers,
    tasks: taskCounts,
    decisions: decisionCounts,
    initiatives: initiativeCounts,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get task counts efficiently
 */
async function getTaskCounts(projectId: string): Promise<TaskCounts> {
  const today = new Date().toISOString().split('T')[0];
  const dueSoonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const row = await DbPromise.get<TaskCountRow>(
      db,
      `SELECT
                SUM(CASE WHEN due_date < ? AND status NOT IN ('done', 'DONE', 'cancelled', 'CANCELLED') THEN 1 ELSE 0 END) as "overdueCount",
                SUM(CASE WHEN due_date >= ? AND due_date <= ? AND status NOT IN ('done', 'DONE', 'cancelled', 'CANCELLED') THEN 1 ELSE 0 END) as "dueSoonCount",
                SUM(CASE WHEN status IN ('blocked', 'BLOCKED') THEN 1 ELSE 0 END) as "blockedCount"
            FROM tasks
            WHERE project_id = ?`,
      [today, today, dueSoonDate, projectId]
    );

    return {
      overdueCount: row?.overdueCount || 0,
      dueSoonCount: row?.dueSoonCount || 0,
      blockedCount: row?.blockedCount || 0,
    };
  } catch (err: any) {
    logger.error('[PMOHealthService] Task count error:', err);
    return { overdueCount: 0, dueSoonCount: 0, blockedCount: 0 };
  }
}

/**
 * Get decision counts efficiently
 */
async function getDecisionCounts(projectId: string): Promise<DecisionCounts> {
  const nowIso = new Date().toISOString();

  try {
    const row = await DbPromise.get<DecisionCountRow>(
      db,
      `SELECT
                SUM(CASE WHEN status IN ('pending', 'escalated') THEN 1 ELSE 0 END) as "pendingCount",
                SUM(CASE WHEN status IN ('pending', 'escalated') AND COALESCE(deadline, created_at) < ? THEN 1 ELSE 0 END) as "overdueCount"
            FROM decisions
            WHERE project_id = ?`,
      [nowIso, projectId]
    );

    return {
      pendingCount: row?.pendingCount || 0,
      overdueCount: row?.overdueCount || 0,
    };
  } catch (err: any) {
    logger.error('[PMOHealthService] Decision count error:', err);
    return { pendingCount: 0, overdueCount: 0 };
  }
}

/**
 * Get initiative counts efficiently
 */
async function getInitiativeCounts(projectId: string): Promise<InitiativeCounts> {
  try {
    const row = await DbPromise.get<InitiativeCountRow>(
      db,
      // DEC-424 (P12-int-c): BLOCKED -> IN_EXECUTION + flaga on_hold.
      `SELECT
                SUM(CASE WHEN risk_level = 'HIGH' OR status = 'AT_RISK' THEN 1 ELSE 0 END) as "atRiskCount",
                SUM(CASE WHEN status = 'IN_EXECUTION' AND on_hold THEN 1 ELSE 0 END) as "blockedCount"
            FROM initiatives
            WHERE project_id = ?`,
      [projectId]
    );

    return {
      atRiskCount: row?.atRiskCount || 0,
      blockedCount: row?.blockedCount || 0,
    };
  } catch (err: any) {
    logger.error('[PMOHealthService] Initiative count error:', err);
    return { atRiskCount: 0, blockedCount: 0 };
  }
}

/**
 * Get blockers across all types
 */
async function getBlockers(projectId: string): Promise<Blocker[]> {
  const blockers: Blocker[] = [];
  const today = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  // Overdue tasks
  try {
    const overdueTasks = await DbPromise.all<TaskRow>(
      db,
      `SELECT id, title FROM tasks 
             WHERE project_id = ? AND due_date < ? AND status NOT IN ('done', 'DONE', 'cancelled', 'CANCELLED')
             LIMIT 5`,
      [projectId, today]
    );

    for (const task of overdueTasks) {
      blockers.push({
        type: 'TASK',
        message: `Overdue: ${task.title}`,
        ref: { entityType: 'task', entityId: task.id },
      });
    }
  } catch (err: any) {
    logger.error('[PMOHealthService] Error fetching overdue tasks:', err);
  }

  // Pending decisions (7+ days)
  try {
    const pendingDecisions = await DbPromise.all<DecisionRow>(
      db,
      `SELECT id, title FROM decisions 
            WHERE project_id = ? AND status IN ('pending', 'escalated') AND COALESCE(deadline, created_at) < ?
             LIMIT 5`,
      [projectId, nowIso]
    );

    for (const decision of pendingDecisions) {
      blockers.push({
        type: 'DECISION',
        message: `Pending decision: ${decision.title}`,
        ref: { entityType: 'decision', entityId: decision.id },
      });
    }
  } catch (err: any) {
    logger.error('[PMOHealthService] Error fetching pending decisions:', err);
  }

  // Stage gate blockers (missing criteria)
  try {
    const currentPhase = await getCurrentPhase(projectId);
    const phaseNumber = PHASE_ORDER.indexOf(currentPhase) + 1;

    if (phaseNumber < PHASE_ORDER.length) {
      const nextPhase = PHASE_ORDER[phaseNumber];
      const gateType = getGateType(currentPhase, nextPhase);

      if (gateType) {
        const evaluation = await evaluateGate(projectId, gateType);
        const missing = (evaluation.completionCriteria || []).filter((c) => !c.isMet);

        if (missing.length > 0) {
          blockers.push({
            type: 'GATE',
            message: `Gate ${gateType}: ${missing.length} criteria not met`,
            ref: { entityType: 'gate', entityId: gateType },
          });
        }
      }
    }
  } catch (err: any) {
    logger.error('[PMOHealthService] Error evaluating stage gate:', err);
  }

  return blockers;
}

/**
 * Get current phase for a project
 */
async function getCurrentPhase(projectId: string): Promise<Phase> {
  const row = await DbPromise.get<ProjectPhaseRow>(
    db,
    `SELECT current_phase FROM projects WHERE id = ?`,
    [projectId]
  );

  return (row?.current_phase || 'Context') as Phase;
}

// Default export for backward compatibility
const PMOHealthService = {
  setDependencies,
  getHealthSnapshot,
};

export default PMOHealthService;
