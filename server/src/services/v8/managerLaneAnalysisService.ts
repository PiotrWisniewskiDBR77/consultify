/**
 * Manager Lane Analysis Service
 *
 * Orchestrates the 6-lane analytical engine:
 * Observations -> Insights -> Effects -> Suggestions -> Decisions -> Execution
 *
 * Gathers data from existing services (control tower, risk, delay, capacity)
 * and runs deterministic heuristics per lane.
 */

import { detectDelaySignals } from '../delayDetectionService.js';
import { detectRiskSignals } from '../riskDetectionService.js';
import {
  getExecutionControlTowerQueues,
} from '../v8ExecutionControlTowerService.js';
import { getLevelingAlerts } from '../workloadCapacityService.js';
import { all as dbAll } from '../../utils/DbPromise.js';
import { analyzeActionQueue } from './laneHeuristics/actionQueueHeuristics.js';
import { analyzeBlockers } from './laneHeuristics/blockersHeuristics.js';
import { analyzeDecisions } from './laneHeuristics/decisionsHeuristics.js';
import { analyzePeopleChange } from './laneHeuristics/peopleChangeHeuristics.js';
import { analyzeRisk } from './laneHeuristics/riskHeuristics.js';
import { analyzeWorkload } from './laneHeuristics/workloadHeuristics.js';
import type { HeuristicInput, LaneAnalysis } from './laneHeuristics/types.js';

type LaneId = 'action-queue' | 'decisions' | 'blockers' | 'workload' | 'risk' | 'people-change';

const HEURISTIC_MAP: Record<LaneId, (input: HeuristicInput) => ReturnType<typeof analyzeActionQueue>> = {
  'action-queue': analyzeActionQueue,
  'decisions': analyzeDecisions,
  'blockers': analyzeBlockers,
  'workload': analyzeWorkload,
  'risk': analyzeRisk,
  'people-change': analyzePeopleChange,
};

async function loadDecisions(organizationId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT d.id, d.title, d.status, d.priority, d.due_date as "dueDate",
             d.created_at as "createdAt",
             u.name as "ownerName", d.owner_id as "ownerId",
             d.related_object_id as "relatedObjectId"
      FROM decisions d
      LEFT JOIN users u ON u.id = d.owner_id
      WHERE d.organization_id = ?
    `;
    const params: unknown[] = [organizationId];
    if (projectId) {
      q += ' AND d.project_id = ?';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch {
    return [];
  }
}

async function loadInitiatives(organizationId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT id, name, status, owner_execution_id as "ownerId", assignee_id as "assigneeId",
             planned_start_date, planned_end_date, start_date, sla_deadline, project_id, updated_at
      FROM initiatives
      WHERE organization_id = ?
    `;
    const params: unknown[] = [organizationId];
    if (projectId) {
      q += ' AND project_id = ?';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch {
    return [];
  }
}

async function loadTasks(organizationId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT t.id, t.title, t.status, t.due_date, t.assignee_id, t.estimated_hours,
             t.initiative_id, t.project_id, t.updated_at,
             u.name as "assigneeName"
      FROM tasks t
      LEFT JOIN initiatives i ON i.id = t.initiative_id
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE i.organization_id = ?
    `;
    const params: unknown[] = [organizationId];
    if (projectId) {
      q += ' AND i.project_id = ?';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch {
    return [];
  }
}

async function loadLaneDecisions(organizationId: string, laneId: string): Promise<any[]> {
  try {
    const rows = (await dbAll(
      `SELECT id, suggestion_id as "suggestionId", state, decided_by as "decidedBy",
              decided_at as "decidedAt", notes
       FROM lane_decisions
       WHERE organization_id = ? AND lane_id = ?
       ORDER BY created_at DESC`,
      [organizationId, laneId]
    )) || [];
    return rows as any[];
  } catch {
    return [];
  }
}

async function loadLaneExecutionPlans(organizationId: string, laneId: string): Promise<any[]> {
  try {
    const rows = (await dbAll(
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
  } catch {
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
    getExecutionControlTowerQueues(organizationId, { projectId, queue: 'all' }).catch(() => ({ queues: {}, counts: {} })),
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
