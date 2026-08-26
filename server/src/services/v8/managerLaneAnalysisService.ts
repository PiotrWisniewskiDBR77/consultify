/**
 * Manager Lane Analysis Service
 *
 * Orchestrates the 6-lane analytical engine:
 * Observations -> Insights -> Effects -> Suggestions -> Decisions -> Execution
 *
 * Gathers data from existing services (control tower, risk, delay, capacity)
 * and runs deterministic heuristics per lane.
 */

import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { detectDelaySignals } from '../delayDetectionService.js';
import { detectRiskSignals } from '../riskDetectionService.js';
import { getExecutionControlTowerQueues } from '../v8ExecutionControlTowerService.js';
import { getLevelingAlerts } from '../workloadCapacityService.js';
import { analyzeActionQueue } from './laneHeuristics/actionQueueHeuristics.js';
import { analyzeBlockers } from './laneHeuristics/blockersHeuristics.js';
import { analyzeDecisions } from './laneHeuristics/decisionsHeuristics.js';
import { getDemoAnalysis, isEmptyAnalysis } from './laneHeuristics/demoData.js';
import { analyzePeopleChange } from './laneHeuristics/peopleChangeHeuristics.js';
import { analyzeRisk } from './laneHeuristics/riskHeuristics.js';
import type { HeuristicInput, LaneAnalysis } from './laneHeuristics/types.js';
import { analyzeWorkload } from './laneHeuristics/workloadHeuristics.js';

type LaneId = 'action-queue' | 'decisions' | 'blockers' | 'workload' | 'risk' | 'people-change';

const HEURISTIC_MAP: Record<
  LaneId,
  (input: HeuristicInput) => ReturnType<typeof analyzeActionQueue>
> = {
  'action-queue': analyzeActionQueue,
  decisions: analyzeDecisions,
  blockers: analyzeBlockers,
  workload: analyzeWorkload,
  risk: analyzeRisk,
  'people-change': analyzePeopleChange,
};

async function loadDecisions(organizationId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT d.id, d.title, d.status, d.priority,
             d.deadline as "dueDate",
             d.created_at as "createdAt",
             COALESCE(u.first_name || ' ' || u.last_name, '') as "ownerName",
             COALESCE(d.decision_owner_id, d.decision_maker_id) as "ownerId",
             d.initiative_id as "relatedObjectId"
      FROM decisions d
      LEFT JOIN users u ON u.id = COALESCE(d.decision_owner_id, d.decision_maker_id)
      WHERE d.organization_id = ?
    `;
    const params: unknown[] = [organizationId];
    if (projectId) {
      q += ' AND d.project_id = ?';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch (err) {
    logger.error('[managerLaneAnalysisService] loadDecisions failed', {
      error: err instanceof Error ? err.message : String(err),
      organizationId,
      projectId,
    });
    return [];
  }
}

async function loadInitiatives(organizationId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT id, name, status, owner_execution_id as "ownerId", owner_execution_id as "assigneeId",
             planned_start_date, planned_end_date, start_date, planned_end_date as sla_deadline,
             project_id, updated_at
      FROM initiatives
      WHERE organization_id = ?
    `;
    const params: unknown[] = [organizationId];
    if (projectId) {
      q += ' AND project_id = ?';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch (err) {
    logger.error('[managerLaneAnalysisService] loadInitiatives failed', {
      error: err instanceof Error ? err.message : String(err),
      organizationId,
      projectId,
    });
    return [];
  }
}

async function loadTasks(organizationId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT t.id, t.title, t.status, t.due_date, t.assignee_id, t.estimated_hours,
             t.initiative_id, t.project_id, t.updated_at,
             COALESCE(u.first_name || ' ' || u.last_name, '') as "assigneeName"
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.organization_id = ?
    `;
    const params: unknown[] = [organizationId];
    if (projectId) {
      q += ' AND t.project_id = ?';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch (err) {
    logger.error('[managerLaneAnalysisService] loadTasks failed', {
      error: err instanceof Error ? err.message : String(err),
      organizationId,
      projectId,
    });
    return [];
  }
}

async function loadLaneDecisions(organizationId: string, laneId: string): Promise<any[]> {
  try {
    const rows =
      (await dbAll(
        `SELECT id, suggestion_id as "suggestionId", state, decided_by as "decidedBy",
              decided_at as "decidedAt", notes
       FROM lane_decisions
       WHERE organization_id = ? AND lane_id = ?
       ORDER BY created_at DESC`,
        [organizationId, laneId]
      )) || [];
    return rows as any[];
  } catch (err) {
    logger.error('[managerLaneAnalysisService] loadLaneDecisions failed', {
      error: err instanceof Error ? err.message : String(err),
      organizationId,
      laneId,
    });
    return [];
  }
}

async function loadLaneExecutionPlans(organizationId: string, laneId: string): Promise<any[]> {
  try {
    const rows =
      (await dbAll(
        `SELECT id, decision_id as "decisionId", tasks_json as "tasksJson",
              before_state as "beforeState", after_state as "afterState",
              verification_status as "verificationStatus"
       FROM lane_execution_plans
       WHERE organization_id = ? AND lane_id = ?
       ORDER BY created_at DESC`,
        [organizationId, laneId]
      )) || [];
    return (rows as any[]).map((r) => ({
      ...r,
      tasks: r.tasksJson ? JSON.parse(r.tasksJson) : [],
    }));
  } catch (err) {
    // Also catches JSON.parse failures on a corrupted tasks_json row — a
    // real data-integrity bug that a silent catch{} previously hid entirely.
    logger.error('[managerLaneAnalysisService] loadLaneExecutionPlans failed', {
      error: err instanceof Error ? err.message : String(err),
      organizationId,
      laneId,
    });
    return [];
  }
}

export async function analyzeLane(
  organizationId: string,
  laneId: string,
  projectId?: string
): Promise<LaneAnalysis> {
  const heuristicFn = HEURISTIC_MAP[laneId as LaneId];
  if (!heuristicFn) {
    return emptyAnalysis();
  }

  const [
    controlTower,
    riskSignals,
    delaySignals,
    capacityAlerts,
    decisions,
    initiatives,
    tasks,
    laneDecisions,
    laneExecPlans,
  ] = await Promise.all([
    getExecutionControlTowerQueues(organizationId, { projectId, queue: 'all' }).catch(() => ({
      queues: {},
      counts: {},
    })),
    detectRiskSignals(organizationId, projectId).catch(() => []),
    detectDelaySignals(organizationId, projectId).catch(() => []),
    getLevelingAlerts(organizationId).catch(() => []),
    loadDecisions(organizationId, projectId),
    loadInitiatives(organizationId, projectId),
    loadTasks(organizationId, projectId),
    loadLaneDecisions(organizationId, laneId),
    loadLaneExecutionPlans(organizationId, laneId),
  ]);

  const input: HeuristicInput = {
    organizationId,
    projectId,
    controlTowerQueues: (controlTower as any).queues || {},
    controlTowerCounts: (controlTower as any).counts || {},
    riskSignals: riskSignals as any[],
    delaySignals: delaySignals as any[],
    capacityAlerts: capacityAlerts as any[],
    decisions,
    initiatives,
    tasks,
  };

  const { observations, insights, effects, suggestions } = heuristicFn(input);

  // If heuristics produced no results (empty DB), return demo data for testing
  const heuristicResult = { observations, insights, effects, suggestions };
  if (
    isEmptyAnalysis({
      ...heuristicResult,
      decisions: [],
      executionPlan: [],
      severity: 'ok',
      confidence: 'degraded',
      lastRefreshed: '',
    })
  ) {
    const demo = getDemoAnalysis(laneId);
    if (demo) {
      return { ...demo, lastRefreshed: new Date().toISOString() };
    }
  }

  // Compute severity
  const criticalObs = observations.filter((o) => o.severity === 'critical').length;
  const warningObs = observations.filter((o) => o.severity === 'warning').length;
  const severity = criticalObs > 0 ? 'critical' : warningObs > 0 ? 'warning' : 'ok';

  // Compute confidence
  const lowConfInsights = insights.filter((i) => i.confidence === 'low').length;
  const noData = observations.length === 0;
  const confidence = noData ? 'degraded' : lowConfInsights > insights.length * 0.5 ? 'low' : 'high';

  return {
    observations,
    insights,
    effects,
    suggestions,
    decisions: laneDecisions as any,
    executionPlan: laneExecPlans as any,
    severity: severity as any,
    confidence: confidence as any,
    lastRefreshed: new Date().toISOString(),
  };
}

function emptyAnalysis(): LaneAnalysis {
  return {
    observations: [],
    insights: [],
    effects: [],
    suggestions: [],
    decisions: [],
    executionPlan: [],
    severity: 'ok',
    confidence: 'degraded',
    lastRefreshed: new Date().toISOString(),
  };
}
