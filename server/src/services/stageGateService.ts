/**
 * Stage Gate Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/stageGateService.js (CommonJS) to TypeScript (ES Modules)
 * Phase transition control - Step 3: PMO Objects, Statuses & Stage Gates
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { AppError } from '../types/index.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { normalizeProjectRole } from '../utils/roleNormalization.js';

// ==========================================
// TYPES
// ==========================================

export const GATE_TYPES = {
  READINESS_GATE: 'READINESS_GATE', // Context → Assessment
  DESIGN_GATE: 'DESIGN_GATE', // Assessment → Initiatives
  PLANNING_GATE: 'PLANNING_GATE', // Initiatives → Roadmap
  EXECUTION_GATE: 'EXECUTION_GATE', // Roadmap → Execution
  CLOSURE_GATE: 'CLOSURE_GATE', // Execution → Stabilization
} as const;

export type GateType = (typeof GATE_TYPES)[keyof typeof GATE_TYPES];

export const PHASE_ORDER = [
  'Context',
  'Assessment',
  'Initiatives',
  'Roadmap',
  'Execution',
  'Stabilization',
] as const;

export type Phase = (typeof PHASE_ORDER)[number];

interface GateCriteria {
  criterion: string;
  field: string;
}

interface CriterionResult {
  criterion: string;
  isMet: boolean;
  evidence: string;
}

interface GateEvaluationResult {
  gateType: GateType;
  projectId: string;
  status: 'READY' | 'NOT_READY';
  completionCriteria: CriterionResult[];
  missingElements: string[];
}

interface GatePassageResult {
  id: string;
  gateType: GateType;
  status: 'PASSED';
  toPhase: Phase | undefined;
}

interface Project {
  id: string;
  context_data?: string;
  current_phase?: Phase;
  [key: string]: unknown;
}

// ==========================================
// CONSTANTS
// ==========================================

const GATE_MAP: Record<string, GateType> = {
  Context_Assessment: GATE_TYPES.READINESS_GATE,
  Assessment_Initiatives: GATE_TYPES.DESIGN_GATE,
  Initiatives_Roadmap: GATE_TYPES.PLANNING_GATE,
  Roadmap_Execution: GATE_TYPES.EXECUTION_GATE,
  Execution_Stabilization: GATE_TYPES.CLOSURE_GATE,
};

const GATE_CRITERIA: Record<GateType, GateCriteria[]> = {
  [GATE_TYPES.READINESS_GATE]: [
    { criterion: 'hasStrategicGoals', field: 'hasStrategicGoals' },
    { criterion: 'hasChallenges', field: 'hasChallenges' },
    { criterion: 'hasConstraints', field: 'hasConstraints' },
    { criterion: 'contextReadinessOk', field: 'contextReadinessOk' },
  ],
  [GATE_TYPES.DESIGN_GATE]: [
    { criterion: 'assessmentComplete', field: 'assessmentComplete' },
    { criterion: 'gapAnalysisReviewed', field: 'gapAnalysisReviewed' },
  ],
  [GATE_TYPES.PLANNING_GATE]: [
    { criterion: 'hasInitiatives', field: 'hasInitiatives' },
    { criterion: 'allInitiativesOwned', field: 'allInitiativesOwned' },
    { criterion: 'prioritiesSet', field: 'prioritiesSet' },
  ],
  [GATE_TYPES.EXECUTION_GATE]: [
    { criterion: 'roadmapBaselined', field: 'roadmapBaselined' },
    { criterion: 'allAssignedToWaves', field: 'allAssignedToWaves' },
    { criterion: 'noDependencyConflicts', field: 'noDependencyConflicts' },
  ],
  [GATE_TYPES.CLOSURE_GATE]: [
    { criterion: 'allInitiativesClosed', field: 'allInitiativesClosed' },
    { criterion: 'noBlockingDecisions', field: 'noBlockingDecisions' },
    { criterion: 'kpisMeasured', field: 'kpisMeasured' },
  ],
};

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

/**
 * Set database instance (for testing)
 */
export function setDb(mockDb: IDatabase): void {
  db = mockDb;
}

/**
 * Get the gate type for a phase transition
 */
export function getGateType(fromPhase: string, toPhase: string): GateType | null {
  // Support legacy/UI naming: "Idea" is treated as "Context"
  const normalize = (p: string): string => (p === 'Idea' ? 'Context' : p);
  const key = `${normalize(fromPhase)}_${normalize(toPhase)}`;
  return GATE_MAP[key] || null;
}

/**
 * Evaluate gate readiness for a project
 */
export async function evaluateGate(
  projectId: string,
  gateType: GateType
): Promise<GateEvaluationResult> {
  const criteria = GATE_CRITERIA[gateType] || [];
  const results: CriterionResult[] = [];

  // Fetch project context
  const project = await DbPromise.get<Project>(db, `SELECT * FROM projects WHERE id = ?`, [
    projectId,
  ]);

  if (!project) {
    throw new Error('Project not found');
  }

  // Evaluate each criterion based on gate type
  for (const crit of criteria) {
    const isMet = await evaluateCriterion(projectId, crit.field);
    results.push({
      criterion: crit.criterion,
      isMet,
      evidence: isMet ? 'MET' : 'NOT_MET',
    });
  }

  const allMet = results.every((r) => r.isMet);

  return {
    gateType,
    projectId,
    status: allMet ? 'READY' : 'NOT_READY',
    completionCriteria: results,
    missingElements: results.filter((r) => !r.isMet).map((r) => r.criterion),
  };
}

/**
 * Evaluate a specific criterion
 */
async function evaluateCriterion(projectId: string, field: string): Promise<boolean> {
  switch (field) {
    case 'hasStrategicGoals':
      return await checkContextField(
        projectId,
        'strategicGoals',
        (arr) => !!(arr && Array.isArray(arr) && arr.length > 0)
      );
    case 'hasChallenges':
      return await checkContextField(
        projectId,
        'challenges',
        (arr) => !!(arr && Array.isArray(arr) && arr.length > 0)
      );
    case 'hasConstraints':
      return await checkContextField(
        projectId,
        'constraints',
        (arr) => !!(arr && Array.isArray(arr) && arr.length > 0)
      );
    case 'contextReadinessOk':
      return await checkContextReadiness(projectId);
    case 'assessmentComplete':
      return await checkAssessmentComplete(projectId);
    case 'gapAnalysisReviewed':
      return await checkGapAnalysisReviewed(projectId);
    case 'hasInitiatives':
      return (await countInitiatives(projectId)) > 0;
    case 'allInitiativesOwned':
      return await checkAllInitiativesHaveOwners(projectId);
    case 'prioritiesSet':
      return await checkInitiativePriorities(projectId);
    case 'roadmapBaselined':
      return await checkRoadmapBaselined(projectId);
    case 'allAssignedToWaves':
      return await checkAllInWaves(projectId);
    case 'noDependencyConflicts':
      return await checkNoDependencyConflicts(projectId);
    case 'allInitiativesClosed':
      return await checkAllInitiativesClosed(projectId);
    case 'noBlockingDecisions':
      return await checkNoBlockingDecisions(projectId);
    case 'kpisMeasured':
      return (await countKPIs(projectId)) > 0;
    default:
      return false;
  }
}

// Helper methods
async function checkContextField(
  projectId: string,
  field: string,
  validator: (value: unknown) => boolean
): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ context_data?: string }>(
      db,
      `SELECT context_data FROM projects WHERE id = ?`,
      [projectId]
    );
    if (!row) return false;
    const ctx = JSON.parse(row.context_data || '{}');
    return !!validator(ctx[field]);
  } catch {
    return false;
  }
}

async function checkContextReadiness(projectId: string): Promise<boolean> {
  // Simplified check - would use ContextService.calculateReadiness
  try {
    const row = await DbPromise.get<{ context_data?: string }>(
      db,
      `SELECT context_data FROM projects WHERE id = ?`,
      [projectId]
    );
    if (!row) return false;
    const ctx = JSON.parse(row.context_data || '{}');
    const hasGoals =
      ctx.strategicGoals && Array.isArray(ctx.strategicGoals) && ctx.strategicGoals.length > 0;
    const hasChallenges =
      ctx.challenges && Array.isArray(ctx.challenges) && ctx.challenges.length > 0;
    return hasGoals && hasChallenges;
  } catch {
    return false;
  }
}

async function checkAssessmentComplete(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ is_complete?: number }>(
      db,
      `SELECT is_complete FROM maturity_assessments WHERE project_id = ?`,
      [projectId]
    );
    return row ? row.is_complete === 1 : false;
  } catch {
    return false;
  }
}

async function checkGapAnalysisReviewed(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) AS cnt
         FROM assessment_report_reviews arr
         JOIN maturity_assessments ma ON ma.id = arr.assessment_id
        WHERE ma.project_id = ? AND LOWER(arr.status) = 'approved'`,
      [projectId]
    );
    return Number(row?.cnt ?? 0) > 0;
  } catch {
    return false;
  }
}

async function countInitiatives(projectId: string): Promise<number> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ?`,
      [projectId]
    );
    return row ? row.cnt : 0;
  } catch {
    return 0;
  }
}

async function checkAllInitiativesHaveOwners(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ? AND (owner_business_id IS NULL OR owner_business_id = '')`,
      [projectId]
    );
    return row ? Number(row.cnt) === 0 : false;
  } catch {
    return false;
  }
}

async function checkInitiativePriorities(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) AS cnt
         FROM initiatives
        WHERE project_id = ?
          AND (priority IS NULL OR TRIM(priority) = '' OR COALESCE(priority_order, 0) <= 0)`,
      [projectId]
    );
    return row ? Number(row.cnt) === 0 : false;
  } catch {
    return false;
  }
}

async function checkRoadmapBaselined(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) AS cnt FROM plan_baselines WHERE project_id = ?`,
      [projectId]
    );
    return row ? Number(row.cnt) > 0 : false;
  } catch {
    return false;
  }
}

async function checkAllInWaves(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) AS cnt
         FROM initiatives i
        WHERE i.project_id = ?
          AND (
            i.planned_start_date IS NULL OR i.planned_end_date IS NULL OR
            NOT EXISTS (
              SELECT 1 FROM roadmap_waves rw
               WHERE rw.project_id = i.project_id
                 AND NULLIF(rw.start_date, '')::date <= i.planned_start_date::date
                 AND NULLIF(rw.end_date, '')::date >= i.planned_end_date::date
            )
          )`,
      [projectId]
    );
    return row ? Number(row.cnt) === 0 : false;
  } catch {
    return false;
  }
}

async function checkNoDependencyConflicts(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) AS cnt
         FROM initiative_dependencies d
        WHERE d.project_id = ?
          AND (
            d.from_initiative_id = d.to_initiative_id OR
            EXISTS (
              SELECT 1 FROM initiative_dependencies reverse_dependency
               WHERE reverse_dependency.project_id = d.project_id
                 AND reverse_dependency.from_initiative_id = d.to_initiative_id
                 AND reverse_dependency.to_initiative_id = d.from_initiative_id
            )
          )`,
      [projectId]
    );
    return row ? Number(row.cnt) === 0 : false;
  } catch {
    return false;
  }
}

async function checkAllInitiativesClosed(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      // DEC-424 (P12-int-c): DONE -> CLOSED, CANCELLED -> REJECTED.
      `SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ? AND status NOT IN ('CLOSED', 'REJECTED')`,
      [projectId]
    );
    return row ? Number(row.cnt) === 0 : false;
  } catch {
    return false;
  }
}

async function checkNoBlockingDecisions(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) as cnt FROM decisions 
       WHERE project_id = ? 
       AND status IN ('pending', 'escalated')
       AND (
         LOWER(COALESCE(NULLIF(TRIM(required), ''), 'false')) NOT IN ('false', '0', 'no', 'off')
         OR type IN ('INITIATIVE_APPROVAL', 'PHASE_TRANSITION', 'EXECUTION')
       )`,
      [projectId],
      { fallback: false }
    );
    return row ? Number(row.cnt) === 0 : false;
  } catch (error) {
    throwStageGateCriterionError('noBlockingDecisions', projectId, error);
  }
}

async function countKPIs(projectId: string): Promise<number> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(DISTINCT measured.kpi_id) AS cnt
         FROM (
           SELECT pk.id AS kpi_id
             FROM project_kpis pk
            WHERE pk.project_id = ?
              AND pk.current_value IS NOT NULL
              AND pk.last_updated_at IS NOT NULL
           UNION
           SELECT km.kpi_id
             FROM initiatives i
             JOIN initiative_kpis ik ON ik.initiative_id = i.id
             JOIN kpi_measurements km ON km.kpi_id = ik.id
            WHERE i.project_id = ?
         ) measured`,
      [projectId, projectId],
      { fallback: false }
    );
    return Number(row?.cnt ?? 0);
  } catch (error) {
    throwStageGateCriterionError('kpisMeasured', projectId, error);
  }
}

function throwStageGateCriterionError(
  criterion: string,
  projectId: string,
  error: unknown
): never {
  logger.error('[StageGateService] Criterion query failed', {
    criterion,
    projectId,
    error: error instanceof Error ? error.message : String(error),
  });
  throw new AppError(
    500,
    `Unable to evaluate stage gate criterion: ${criterion}`,
    'STAGE_GATE_CRITERION_QUERY_FAILED'
  );
}

/**
 * Roles permitted to record a stage-gate passage. Stage gates are governance
 * transitions (PMO / sponsor / admin band). The pilot-restricted USER/GUEST band
 * is never permitted to record a passage.
 */
const STAGE_GATE_APPROVER_ROLES = new Set([
  'PROJECT_SPONSOR',
  'PROJECT_LEADER',
  'STEERING_COMMITTEE',
  'PMO',
]);

export class StageGateForbiddenError extends Error {
  readonly code = 'STAGE_GATE_ROLE_FORBIDDEN';
  readonly statusCode = 403;
  constructor(message = 'Role not permitted to record a stage gate passage') {
    super(message);
    this.name = 'StageGateForbiddenError';
  }
}

/**
 * Record gate passage.
 *
 * The actor's project role is read from `project_members` inside the same
 * transaction as the receipt and phase update. Application-level wildcards do
 * not grant a stage-gate decision without a project governance role.
 */
export async function passGate(
  projectId: string,
  gateType: GateType,
  userId: string,
  notes?: string,
  _actorRole?: string | null,
  governance?: {
    organizationId: string;
    decisionId?: string | null;
    policyId?: string | null;
    policyVersion?: number | null;
    quorumId?: string | null;
    quorumVersion?: number | null;
    quorumReceiptId?: string | null;
  }
): Promise<GatePassageResult> {
  const id = uuidv4();
  const gateKey = Object.keys(GATE_MAP).find((k) => GATE_MAP[k] === gateType);
  const fromPhase = gateKey?.split('_')[0] as Phase | undefined;
  const toPhase = gateKey?.split('_')[1] as Phase | undefined;

  if (!governance?.organizationId) {
    throw new AppError(
      500,
      'Organization context is required to record a project stage gate',
      'STAGE_GATE_ORGANIZATION_REQUIRED'
    );
  }

  const sql = `INSERT INTO stage_gates
                 (id, organization_id, project_id, gate_type, from_phase, to_phase, status,
                  decision_id, policy_id, policy_version, quorum_id, quorum_version,
                  quorum_receipt_id, requested_by, approved_by, approved_at, notes)
               VALUES (?, ?, ?, ?, ?, ?, 'PASSED', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;

  // M13 SECURITY (fix/inbox-failopen-stagegates-20260828, commit 2):
  // DbPromise.run() defaults to `fallback: true`, which resolves
  // `{success: false}` on a DB error INSTEAD OF rejecting — the same "cichy
  // catch maskujący błąd SQL" pattern guarded against elsewhere in this
  // codebase (see DbPromise.ts's isSilenceableMissingRelationError doc, and
  // stripe.routes.ts's tryBeginStripeEvent H6.3 comment). Left unchecked
  // here, a failed INSERT (e.g. `stage_gates` missing — true today on the
  // current schema, it exists only in migrations-v2/001_baseline) would
  // still fall through to `status: 'PASSED'` below: a fabricated success
  // telling the caller their gate passage was recorded when nothing was
  // written and no phase transition happened. `fallback: false` makes this
  // call REJECT on a DB error instead, so it propagates through the
  // controller's asyncHandler to the global error handler as an honest 5xx.
  try {
    await queryHelpers.withPgTransaction(async (client) => {
      const projectResult = await client.query<{ current_phase?: Phase }>(
        `SELECT current_phase FROM projects
          WHERE id = ? AND organization_id = ?
          FOR UPDATE`,
        [projectId, governance.organizationId]
      );
      const project = projectResult.rows[0];
      if (!project) {
        throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
      }
      const currentPhase = project.current_phase || 'Context';
      if (!fromPhase || !toPhase || currentPhase !== fromPhase) {
        throw new AppError(
          409,
          'Stage gate does not match the current project phase',
          'STAGE_GATE_PHASE_CONFLICT'
        );
      }

      const membershipResult = await client.query<{
        project_role?: string | null;
        normalized_project_role?: string | null;
      }>(
        `SELECT project_role, normalized_project_role
           FROM project_members
          WHERE project_id = ? AND user_id = ?
          LIMIT 1`,
        [projectId, userId]
      );
      const membership = membershipResult.rows[0];
      const projectRole = normalizeProjectRole(
        membership?.normalized_project_role || membership?.project_role
      );
      if (!projectRole || !STAGE_GATE_APPROVER_ROLES.has(projectRole)) {
        throw new StageGateForbiddenError();
      }

      const evaluation = await evaluateGate(projectId, gateType);
      if (evaluation.status !== 'READY') {
        throw new AppError(409, 'Stage gate is not ready', 'STAGE_GATE_NOT_READY');
      }

      const insertResult = await DbPromise.run(
        db,
        sql,
        [
          id,
          governance.organizationId,
          projectId,
          gateType,
          fromPhase,
          toPhase,
          governance.decisionId ?? null,
          governance.policyId ?? null,
          governance.policyVersion ?? null,
          governance.quorumId ?? null,
          governance.quorumVersion ?? null,
          governance.quorumReceiptId ?? null,
          userId,
          userId,
          notes || null,
        ],
        { fallback: false }
      );
      if (!insertResult.success) {
        throw new Error('stage gate insert returned no success');
      }

      const updateResult = await DbPromise.run(
        db,
        `UPDATE projects SET current_phase = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ? AND COALESCE(current_phase, 'Context') = ?`,
        [toPhase, projectId, governance.organizationId, fromPhase],
        { fallback: false }
      );
      if (!updateResult.success || updateResult.changes !== 1) {
        throw new Error('project phase update did not affect exactly one row');
      }
    });
  } catch (err) {
    if (err instanceof AppError || err instanceof StageGateForbiddenError) throw err;
    throw new AppError(
      500,
      'Failed to record stage gate passage due to a database error',
      'STAGE_GATE_WRITE_FAILED'
    );
  }
  return {
    id,
    gateType,
    status: 'PASSED',
    toPhase,
  };
}

// Default export for backward compatibility
const StageGateService = {
  GATE_TYPES,
  PHASE_ORDER,
  getGateType,
  evaluateGate,
  passGate,
  _setDb: setDb, // For testing
  setDependencies: (deps: { db: IDatabase }) => {
    if (deps.db) setDb(deps.db);
  },
};

export default StageGateService;
