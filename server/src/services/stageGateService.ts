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
import { normalizeApplicationRole } from '../utils/roleNormalization.js';

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
    { criterion: 'Strategic goals defined', field: 'hasStrategicGoals' },
    { criterion: 'Challenges documented', field: 'hasChallenges' },
    { criterion: 'Constraints identified', field: 'hasConstraints' },
    { criterion: 'Context readiness score >= 80%', field: 'contextReadinessOk' },
  ],
  [GATE_TYPES.DESIGN_GATE]: [
    { criterion: 'All axes assessed', field: 'assessmentComplete' },
    { criterion: 'Gap analysis reviewed', field: 'gapAnalysisReviewed' },
  ],
  [GATE_TYPES.PLANNING_GATE]: [
    { criterion: 'At least one initiative defined', field: 'hasInitiatives' },
    { criterion: 'All initiatives have owners', field: 'allInitiativesOwned' },
    { criterion: 'Initiative priorities set', field: 'prioritiesSet' },
  ],
  [GATE_TYPES.EXECUTION_GATE]: [
    { criterion: 'Roadmap baselined', field: 'roadmapBaselined' },
    { criterion: 'All initiatives assigned to waves', field: 'allAssignedToWaves' },
    { criterion: 'No dependency conflicts', field: 'noDependencyConflicts' },
  ],
  [GATE_TYPES.CLOSURE_GATE]: [
    { criterion: 'All initiatives completed or cancelled', field: 'allInitiativesClosed' },
    { criterion: 'No blocking decisions pending', field: 'noBlockingDecisions' },
    { criterion: 'KPIs measured', field: 'kpisMeasured' },
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
      evidence: isMet ? 'Verified' : 'Not met',
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
      return true; // Placeholder - would check review flag
    case 'hasInitiatives':
      return (await countInitiatives(projectId)) > 0;
    case 'allInitiativesOwned':
      return await checkAllInitiativesHaveOwners(projectId);
    case 'prioritiesSet':
      return true; // Placeholder
    case 'roadmapBaselined':
      return await checkRoadmapBaselined(projectId);
    case 'allAssignedToWaves':
      return await checkAllInWaves(projectId);
    case 'noDependencyConflicts':
      return true; // Placeholder - would check dependency graph
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
    return row ? row.cnt === 0 : false;
  } catch {
    return false;
  }
}

async function checkRoadmapBaselined(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) as cnt FROM roadmap_waves WHERE project_id = ? AND is_baselined = 1`,
      [projectId]
    );
    return row ? row.cnt > 0 : false;
  } catch {
    return false;
  }
}

async function checkAllInWaves(projectId: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ? AND (wave_id IS NULL OR wave_id = '')`,
      [projectId]
    );
    return row ? row.cnt === 0 : false;
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
    return row ? row.cnt === 0 : false;
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
       AND (required = 1 OR type IN ('INITIATIVE_APPROVAL', 'PHASE_TRANSITION', 'EXECUTION'))`,
      [projectId]
    );
    return row ? row.cnt === 0 : true;
  } catch {
    return true;
  }
}

async function countKPIs(projectId: string): Promise<number> {
  try {
    const row = await DbPromise.get<{ cnt: number }>(
      db,
      `SELECT COUNT(*) as cnt FROM kpi_results WHERE project_id = ?`,
      [projectId]
    );
    return row ? row.cnt : 0;
  } catch {
    return 0;
  }
}

/**
 * Roles permitted to record a stage-gate passage. Stage gates are governance
 * transitions (PMO / sponsor / admin band). The pilot-restricted USER/GUEST band
 * is never permitted to record a passage.
 */
const STAGE_GATE_FORBIDDEN_ROLE_BANDS = new Set(['USER', 'GUEST']);

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
 * M13 SECURITY: when `actorRole` is provided, a pilot-restricted (USER/GUEST)
 * role is rejected fail-closed before any write. This is defense-in-depth behind
 * the controller's `manage_stage_gates` capability check, so a direct service
 * call cannot bypass governance. `actorRole` is optional to preserve existing
 * callers/tests; omit it only for trusted internal callers.
 */
export async function passGate(
  projectId: string,
  gateType: GateType,
  userId: string,
  notes?: string,
  actorRole?: string | null
): Promise<GatePassageResult> {
  if (
    actorRole != null &&
    STAGE_GATE_FORBIDDEN_ROLE_BANDS.has(normalizeApplicationRole(actorRole))
  ) {
    throw new StageGateForbiddenError();
  }

  const id = uuidv4();
  const gateKey = Object.keys(GATE_MAP).find((k) => GATE_MAP[k] === gateType);
  const fromPhase = gateKey?.split('_')[0] as Phase | undefined;
  const toPhase = gateKey?.split('_')[1] as Phase | undefined;

  const sql = `INSERT INTO stage_gates (id, project_id, gate_type, from_phase, to_phase, status, approved_by, approved_at, notes)
                 VALUES (?, ?, ?, ?, ?, 'PASSED', ?, CURRENT_TIMESTAMP, ?)`;

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
  let insertResult: DbPromise.RunResult;
  try {
    insertResult = await DbPromise.run(
      db,
      sql,
      [id, projectId, gateType, fromPhase, toPhase, userId, notes || null],
      { fallback: false }
    );
  } catch (err) {
    throw new AppError(
      500,
      'Failed to record stage gate passage due to a database error',
      'STAGE_GATE_WRITE_FAILED'
    );
  }
  if (!insertResult.success) {
    throw new AppError(
      500,
      'Failed to record stage gate passage due to a database error',
      'STAGE_GATE_WRITE_FAILED'
    );
  }

  // Update project phase
  if (toPhase) {
    await DbPromise.run(db, `UPDATE projects SET current_phase = ? WHERE id = ?`, [
      toPhase,
      projectId,
    ]);
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
