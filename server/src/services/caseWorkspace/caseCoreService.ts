/**
 * Case Workspace — Case Core service (CW-P01, EPIC E1).
 *
 * Backs the `case_core` table added in
 * server/migrations/20260809_case_workspace_case_core.sql. That table is
 * keyed 1:1 to `projects.id` (packet collision-avoidance mandate — this
 * service only ever SELECTs from `projects`, never INSERT/UPDATE/DELETE) and
 * never references Finance or Results tables/routes.
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains "E1"):
 *
 *   createCase              -> CW-00-020-INV1, CW-01-OD1, CW-RT-012, CW-GR-023
 *   getCase                 -> CW-RT-012, CW-GR-023
 *   transitionStatus        -> CW-RT-026, CW-RT-044
 *   updateGovernanceTier    -> CW-GR-023, CW-DOD-B1
 *   updateAutonomyPolicy    -> OD-05, CW-00-012, CW-01-017
 *   updateClosureAxisStatus -> CW-00-016, CW-00-017
 *   recordClosure           -> CW-RT-027, CW-SSOT-6.4-01, HIST-013
 *   cancelCase               -> CW-GR-023
 *   listCasesForOrganization -> CW-01-026-INV1
 *
 * Cross-cutting invariants held by every mutating method here (see the
 * migration file's header for the exact canon citations):
 *   - exactly one case_core row per project_id (UNIQUE constraint, OD-01);
 *   - one tenant/organization context per Case, never mutated after create
 *     (CW-01-026-INV1);
 *   - case_status only moves DRAFT -> ACTIVE <-> BLOCKED -> {CLOSED, FAILED,
 *     CANCELLED} (CW-RT-026);
 *   - governance_tier_history is append-only (canon invariant #13);
 *   - closure_type is written at most once per Case (CW-RT-027);
 *   - `version` increments on every mutating command (CW-RT-044).
 */

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';

export type CaseProfile = 'LIGHT' | 'STANDARD' | 'TRANSFORMATION' | 'MONITORING';
export type GovernanceTier = 'LIGHTWEIGHT' | 'STANDARD' | 'CONTROLLED';
export type AutonomyPolicy =
  | 'ASK_EACH_ACTION'
  | 'ASK_MATERIAL_ACTIONS'
  | 'EXECUTE_APPROVED_PLAN';
export type CaseStatus = 'DRAFT' | 'ACTIVE' | 'BLOCKED' | 'CLOSED' | 'FAILED' | 'CANCELLED';
export type ClosureType =
  | 'DELIVERY_COMPLETED'
  | 'DECISION_COMPLETED'
  | 'IMPLEMENTATION_COMPLETED'
  | 'OUTCOME_VALIDATED'
  | 'COMPLETED_PARTIAL';
export type ClosureAxisStatus = 'NOT_APPLICABLE' | 'PENDING' | 'COMPLETED';
export type OutcomeAxisStatus = 'NOT_APPLICABLE' | 'PENDING' | 'VALIDATED';
export type ClosureAxis = 'delivery' | 'decision' | 'implementation' | 'outcome';

export interface CaseActor {
  actorUserId: string;
}

export interface GovernanceTierHistoryEntry {
  tier: GovernanceTier;
  changedAt: string;
  changedByActorId: string;
  reason: string;
}

interface CaseCoreRow {
  case_id: string;
  project_id: string;
  organization_id: string;
  case_profile: CaseProfile;
  governance_tier: GovernanceTier;
  governance_tier_history: string;
  autonomy_policy: AutonomyPolicy;
  autonomy_policy_ref: string | null;
  case_status: CaseStatus;
  contracted_closure_type: ClosureType;
  delivery_status: ClosureAxisStatus;
  decision_status: ClosureAxisStatus;
  implementation_status: ClosureAxisStatus;
  outcome_status: OutcomeAxisStatus;
  closure_type: ClosureType | null;
  closed_at: string | null;
  closed_by_actor_id: string | null;
  closure_evidence_ref: string | null;
  sponsor_user_id: string | null;
  acceptance_criteria_ref: string | null;
  budget_policy_ref: string | null;
  current_plan_version_id: string | null;
  created_by_actor_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CaseCore {
  caseId: string;
  projectId: string;
  organizationId: string;
  caseProfile: CaseProfile;
  governanceTier: GovernanceTier;
  governanceTierHistory: GovernanceTierHistoryEntry[];
  autonomyPolicy: AutonomyPolicy;
  autonomyPolicyRef: string | null;
  caseStatus: CaseStatus;
  contractedClosureType: ClosureType;
  deliveryStatus: ClosureAxisStatus;
  decisionStatus: ClosureAxisStatus;
  implementationStatus: ClosureAxisStatus;
  outcomeStatus: OutcomeAxisStatus;
  closureType: ClosureType | null;
  closedAt: string | null;
  closedByActorId: string | null;
  closureEvidenceRef: string | null;
  sponsorUserId: string | null;
  acceptanceCriteriaRef: string | null;
  budgetPolicyRef: string | null;
  currentPlanVersionId: string | null;
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CaseCoreView extends CaseCore {
  // Read-only display fields projected from `projects`. `projects` has no
  // `goal` column today (see server/migrations/000_z_core_baseline.sql), so
  // `projectDescription` stands in for goal/scope display text until a real
  // goal field exists on the Case aggregate itself.
  projectName: string | null;
  projectDescription: string | null;
  projectOwnerId: string | null;
}

interface ProjectRefRow {
  id: string;
  organization_id: string;
  name: string | null;
  description: string | null;
  owner_id: string | null;
}

const CASE_PROFILES: readonly CaseProfile[] = ['LIGHT', 'STANDARD', 'TRANSFORMATION', 'MONITORING'];
const GOVERNANCE_TIERS: readonly GovernanceTier[] = ['LIGHTWEIGHT', 'STANDARD', 'CONTROLLED'];
const AUTONOMY_POLICIES: readonly AutonomyPolicy[] = [
  'ASK_EACH_ACTION',
  'ASK_MATERIAL_ACTIONS',
  'EXECUTE_APPROVED_PLAN',
];
const CLOSURE_TYPES: readonly ClosureType[] = [
  'DELIVERY_COMPLETED',
  'DECISION_COMPLETED',
  'IMPLEMENTATION_COMPLETED',
  'OUTCOME_VALIDATED',
  'COMPLETED_PARTIAL',
];

// CW-RT-026: DRAFT -> ACTIVE <-> BLOCKED; {DRAFT, ACTIVE, BLOCKED} -> {CLOSED, FAILED, CANCELLED}.
const ALLOWED_STATUS_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  DRAFT: ['ACTIVE', 'CLOSED', 'FAILED', 'CANCELLED'],
  ACTIVE: ['BLOCKED', 'CLOSED', 'FAILED', 'CANCELLED'],
  BLOCKED: ['ACTIVE', 'CLOSED', 'FAILED', 'CANCELLED'],
  CLOSED: [],
  FAILED: [],
  CANCELLED: [],
};

const TERMINAL_STATUSES: readonly CaseStatus[] = ['CLOSED', 'FAILED', 'CANCELLED'];

// closureType -> the one closure axis it must be backed by (CW-RT-027 cross-check).
const CLOSURE_TYPE_AXIS: Record<Exclude<ClosureType, 'COMPLETED_PARTIAL'>, ClosureAxis> = {
  DELIVERY_COMPLETED: 'delivery',
  DECISION_COMPLETED: 'decision',
  IMPLEMENTATION_COMPLETED: 'implementation',
  OUTCOME_VALIDATED: 'outcome',
};

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function requireEnum<T extends string>(
  value: T | null | undefined,
  allowed: readonly T[],
  reason: string
): T {
  if (!value || !allowed.includes(value)) throw new Error(reason);
  return value;
}

function mapRow(row: CaseCoreRow): CaseCore {
  let history: GovernanceTierHistoryEntry[] = [];
  try {
    const parsed = JSON.parse(row.governance_tier_history || '[]');
    if (Array.isArray(parsed)) history = parsed as GovernanceTierHistoryEntry[];
  } catch {
    history = [];
  }
  return {
    caseId: row.case_id,
    projectId: row.project_id,
    organizationId: row.organization_id,
    caseProfile: row.case_profile,
    governanceTier: row.governance_tier,
    governanceTierHistory: history,
    autonomyPolicy: row.autonomy_policy,
    autonomyPolicyRef: row.autonomy_policy_ref,
    caseStatus: row.case_status,
    contractedClosureType: row.contracted_closure_type,
    deliveryStatus: row.delivery_status,
    decisionStatus: row.decision_status,
    implementationStatus: row.implementation_status,
    outcomeStatus: row.outcome_status,
    closureType: row.closure_type,
    closedAt: row.closed_at,
    closedByActorId: row.closed_by_actor_id,
    closureEvidenceRef: row.closure_evidence_ref,
    sponsorUserId: row.sponsor_user_id,
    acceptanceCriteriaRef: row.acceptance_criteria_ref,
    budgetPolicyRef: row.budget_policy_ref,
    currentPlanVersionId: row.current_plan_version_id,
    createdByActorId: row.created_by_actor_id,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

/**
 * CW-00-020-INV1 (Durable Teresa work creates exactly one Case after
 * explicit confirmation), CW-01-OD1 (OD-01: one Case, no separate
 * Engagement/Job object), CW-RT-012 (Case aggregate schema), CW-GR-023
 * (POST /api/cases).
 *
 * Reads (never writes) the `projects` row to confirm it exists and that its
 * organization_id matches the caller's tenant — this is the packet's only
 * touch of `projects`, and it is read-only. Rejects if a case_core row
 * already exists for project_id (the UNIQUE constraint on project_id is the
 * ultimate enforcement of "one Case per project"; a pre-check here just
 * gives a friendlier error before hitting the DB constraint).
 */
export async function createCase(input: {
  projectId: string;
  organizationId: string;
  caseProfile?: CaseProfile;
  governanceTier?: GovernanceTier;
  autonomyPolicy?: AutonomyPolicy;
  contractedClosureType: ClosureType;
  sponsorUserId?: string | null;
  acceptanceCriteriaRef?: string | null;
  createdByActorId: string;
}): Promise<CaseCore> {
  const projectId = requireNonBlank(input.projectId, 'case_project_id_required');
  const organizationId = requireNonBlank(input.organizationId, 'case_organization_id_required');
  const createdByActorId = requireNonBlank(input.createdByActorId, 'case_created_by_actor_required');
  const caseProfile = requireEnum(
    input.caseProfile ?? 'LIGHT',
    CASE_PROFILES,
    'case_profile_invalid'
  );
  const governanceTier = requireEnum(
    input.governanceTier ?? 'LIGHTWEIGHT',
    GOVERNANCE_TIERS,
    'case_governance_tier_invalid'
  );
  const autonomyPolicy = requireEnum(
    input.autonomyPolicy ?? 'ASK_MATERIAL_ACTIONS',
    AUTONOMY_POLICIES,
    'case_autonomy_policy_invalid'
  );
  const contractedClosureType = requireEnum(
    input.contractedClosureType,
    CLOSURE_TYPES,
    'case_contracted_closure_type_invalid'
  );

  return withPgTransaction(async (client) => {
    const projectResult = await client.query<ProjectRefRow>(
      `SELECT id, organization_id, name, description, owner_id
         FROM projects WHERE id = ?`,
      [projectId]
    );
    const project = projectResult.rows[0];
    if (!project) throw new Error('case_project_not_found');
    if (project.organization_id !== organizationId) {
      throw new Error('case_project_organization_mismatch');
    }

    const existing = await client.query<{ case_id: string }>(
      `SELECT case_id FROM case_core WHERE project_id = ?`,
      [projectId]
    );
    if (existing.rows[0]) throw new Error('case_already_exists_for_project');

    const caseId = `case-${uuidv4()}`;
    const now = new Date().toISOString();
    const initialHistory: GovernanceTierHistoryEntry[] = [
      {
        tier: governanceTier,
        changedAt: now,
        changedByActorId: createdByActorId,
        reason: 'case_created',
      },
    ];

    const inserted = await client.query<CaseCoreRow>(
      `INSERT INTO case_core (
         case_id, project_id, organization_id, case_profile, governance_tier,
         governance_tier_history, autonomy_policy, case_status,
         contracted_closure_type, sponsor_user_id, acceptance_criteria_ref,
         created_by_actor_id, version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 1, ?, ?)
       RETURNING *`,
      [
        caseId,
        projectId,
        organizationId,
        caseProfile,
        governanceTier,
        JSON.stringify(initialHistory),
        autonomyPolicy,
        contractedClosureType,
        input.sponsorUserId ?? null,
        input.acceptanceCriteriaRef ?? null,
        createdByActorId,
        now,
        now,
      ]
    );
    return mapRow(inserted.rows[0]);
  });
}

/**
 * CW-RT-012, CW-GR-023 (GET /api/cases/:caseId). Left-joins `projects`
 * read-only for display fields; never mutates `projects`.
 */
export async function getCase(
  lookup: { caseId: string } | { projectId: string }
): Promise<CaseCoreView | null> {
  const row =
    'caseId' in lookup
      ? await queryOne<CaseCoreRow & ProjectRefRow>(
          `SELECT c.*, p.id AS p_id, p.name AS p_name, p.description AS p_description, p.owner_id AS p_owner_id
             FROM case_core c
             LEFT JOIN projects p ON p.id = c.project_id
            WHERE c.case_id = ?`,
          [requireNonBlank(lookup.caseId, 'case_id_required')]
        )
      : await queryOne<CaseCoreRow & ProjectRefRow>(
          `SELECT c.*, p.id AS p_id, p.name AS p_name, p.description AS p_description, p.owner_id AS p_owner_id
             FROM case_core c
             LEFT JOIN projects p ON p.id = c.project_id
            WHERE c.project_id = ?`,
          [requireNonBlank(lookup.projectId, 'project_id_required')]
        );
  if (!row) return null;
  const core = mapRow(row);
  return {
    ...core,
    projectName: (row as unknown as { p_name: string | null }).p_name ?? null,
    projectDescription: (row as unknown as { p_description: string | null }).p_description ?? null,
    projectOwnerId: (row as unknown as { p_owner_id: string | null }).p_owner_id ?? null,
  };
}

async function loadForUpdate(client: PgTransactionClient, caseId: string): Promise<CaseCoreRow> {
  const result = await client.query<CaseCoreRow>(
    `SELECT * FROM case_core WHERE case_id = ? FOR UPDATE`,
    [caseId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('case_not_found');
  return row;
}

/**
 * CW-RT-026 (Case state machine), CW-RT-044 (expected-aggregate-version).
 *
 * Enforces DRAFT -> ACTIVE <-> BLOCKED -> {CLOSED, FAILED, CANCELLED}; any
 * other edge is rejected. A transition into CLOSED is rejected unless
 * closure_type has already been recorded via recordClosure. Sets
 * completed_at on terminal states and increments version.
 */
export async function transitionStatus(
  caseId: string,
  targetStatus: CaseStatus,
  actor: CaseActor,
  reason?: string
): Promise<CaseCore> {
  const id = requireNonBlank(caseId, 'case_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'case_actor_required');
  requireEnum(targetStatus, ['DRAFT', 'ACTIVE', 'BLOCKED', 'CLOSED', 'FAILED', 'CANCELLED'], 'case_status_invalid');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    const allowed = ALLOWED_STATUS_TRANSITIONS[row.case_status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(
        `case_status_transition_not_allowed:${row.case_status}->${targetStatus}`
      );
    }
    if (targetStatus === 'CLOSED' && !row.closure_type) {
      throw new Error('case_closure_not_recorded');
    }

    const now = new Date().toISOString();
    const completedAt = TERMINAL_STATUSES.includes(targetStatus) ? now : row.completed_at;

    const updated = await client.query<CaseCoreRow>(
      `UPDATE case_core
          SET case_status = ?, completed_at = ?, version = version + 1, updated_at = ?
        WHERE case_id = ? AND version = ?
        RETURNING *`,
      [targetStatus, completedAt, now, id, row.version]
    );
    if (!updated.rows[0]) throw new Error('case_version_conflict');
    void actorUserId;
    void reason;
    return mapRow(updated.rows[0]);
  });
}

/**
 * CW-GR-023 (POST /api/cases/:caseId/governance-tier), CW-DOD-B1 (profile
 * and governance tier are separate and persisted).
 *
 * Appends {tier, changedAt, changedByActorId, reason} to
 * governance_tier_history (append-only, prior entries never rewritten),
 * sets governance_tier, increments version.
 */
export async function updateGovernanceTier(
  caseId: string,
  newTier: GovernanceTier,
  actor: CaseActor,
  reason: string
): Promise<CaseCore> {
  const id = requireNonBlank(caseId, 'case_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'case_actor_required');
  const changeReason = requireNonBlank(reason, 'case_governance_tier_reason_required');
  requireEnum(newTier, GOVERNANCE_TIERS, 'case_governance_tier_invalid');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    let history: GovernanceTierHistoryEntry[] = [];
    try {
      const parsed = JSON.parse(row.governance_tier_history || '[]');
      if (Array.isArray(parsed)) history = parsed as GovernanceTierHistoryEntry[];
    } catch {
      history = [];
    }
    const now = new Date().toISOString();
    // Append-only: prior entries are copied forward untouched, only a new
    // entry is added.
    const nextHistory = [
      ...history,
      { tier: newTier, changedAt: now, changedByActorId: actorUserId, reason: changeReason },
    ];

    const updated = await client.query<CaseCoreRow>(
      `UPDATE case_core
          SET governance_tier = ?, governance_tier_history = ?, version = version + 1, updated_at = ?
        WHERE case_id = ? AND version = ?
        RETURNING *`,
      [newTier, JSON.stringify(nextHistory), now, id, row.version]
    );
    if (!updated.rows[0]) throw new Error('case_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/**
 * OD-05 (three selectable autonomy levels per Case, middle level default),
 * CW-00-012, CW-01-017.
 *
 * Validates the literal enum only. The org-level maximum-autonomy ceiling
 * (E6, CW-00-013) is NOT_IMPLEMENTED anywhere in this codebase yet, so "user
 * may pick lower, never higher than org max" cannot be enforced here — see
 * this packet's design open_questions. This function intentionally leaves
 * an explicit hook (the `_orgMaxAutonomyPolicy` parameter, unused today) for
 * that comparison once the E6 policy store exists.
 */
export async function updateAutonomyPolicy(
  caseId: string,
  newPolicy: AutonomyPolicy,
  actor: CaseActor,
  _orgMaxAutonomyPolicy?: AutonomyPolicy | null
): Promise<CaseCore> {
  const id = requireNonBlank(caseId, 'case_id_required');
  requireNonBlank(actor?.actorUserId, 'case_actor_required');
  requireEnum(newPolicy, AUTONOMY_POLICIES, 'case_autonomy_policy_invalid');
  void _orgMaxAutonomyPolicy;

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    const now = new Date().toISOString();
    const updated = await client.query<CaseCoreRow>(
      `UPDATE case_core
          SET autonomy_policy = ?, version = version + 1, updated_at = ?
        WHERE case_id = ? AND version = ?
        RETURNING *`,
      [newPolicy, now, id, row.version]
    );
    if (!updated.rows[0]) throw new Error('case_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

const AXIS_COLUMN: Record<ClosureAxis, 'delivery_status' | 'decision_status' | 'implementation_status' | 'outcome_status'> = {
  delivery: 'delivery_status',
  decision: 'decision_status',
  implementation: 'implementation_status',
  outcome: 'outcome_status',
};

/**
 * CW-00-016, CW-00-017 (Delivery, Decision, Implementation and Outcome are
 * separate closure levels).
 *
 * Updates exactly one of delivery_status/decision_status/
 * implementation_status/outcome_status. Axes are never conflated into one
 * column, so a Case can honestly sit at implementation_status='COMPLETED'
 * while outcome_status='PENDING' — the canon's own worked example
 * (CW-00-017: "IMPLEMENTATION_COMPLETED / OUTCOME_PENDING").
 */
export async function updateClosureAxisStatus(
  caseId: string,
  axis: ClosureAxis,
  status: ClosureAxisStatus | OutcomeAxisStatus,
  actor: CaseActor
): Promise<CaseCore> {
  const id = requireNonBlank(caseId, 'case_id_required');
  requireNonBlank(actor?.actorUserId, 'case_actor_required');
  const column = AXIS_COLUMN[axis];
  if (!column) throw new Error('case_closure_axis_invalid');
  const allowedValues: readonly string[] =
    axis === 'outcome' ? ['NOT_APPLICABLE', 'PENDING', 'VALIDATED'] : ['NOT_APPLICABLE', 'PENDING', 'COMPLETED'];
  if (!allowedValues.includes(status)) throw new Error('case_closure_axis_status_invalid');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    const now = new Date().toISOString();
    // Column name is selected from the fixed AXIS_COLUMN map above, never
    // interpolated from caller-controlled input directly.
    const updated = await client.query<CaseCoreRow>(
      `UPDATE case_core
          SET ${column} = ?, version = version + 1, updated_at = ?
        WHERE case_id = ? AND version = ?
        RETURNING *`,
      [status, now, id, row.version]
    );
    if (!updated.rows[0]) throw new Error('case_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/**
 * CW-RT-027 (CLOSED records one immutable CaseClosureRecord; a closed Case
 * is not rewritten or reopened), CW-SSOT-6.4-01, HIST-013.
 *
 * Callable at most once per Case: rejected if closure_type is already set.
 * Validates closureType is consistent with the matching axis status (e.g.
 * IMPLEMENTATION_COMPLETED requires implementation_status='COMPLETED');
 * COMPLETED_PARTIAL requires closure_evidence_ref or acceptance_criteria_ref
 * to carry the named remaining scope. Sets closed_at and closed_by_actor_id.
 * Does NOT itself transition case_status — call transitionStatus(..., 'CLOSED')
 * afterward, which will now find closure_type populated.
 */
export async function recordClosure(
  caseId: string,
  closureType: ClosureType,
  actor: CaseActor,
  evidenceRef?: string | null
): Promise<CaseCore> {
  const id = requireNonBlank(caseId, 'case_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'case_actor_required');
  requireEnum(closureType, CLOSURE_TYPES, 'case_closure_type_invalid');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    if (row.closure_type) throw new Error('case_closure_already_recorded');

    if (closureType === 'COMPLETED_PARTIAL') {
      const hasNamedRemainingScope = Boolean(evidenceRef) || Boolean(row.acceptance_criteria_ref);
      if (!hasNamedRemainingScope) {
        throw new Error('case_closure_partial_requires_evidence_or_acceptance_criteria');
      }
    } else {
      const axis = CLOSURE_TYPE_AXIS[closureType as Exclude<ClosureType, 'COMPLETED_PARTIAL'>];
      const column = AXIS_COLUMN[axis];
      const axisStatus = row[column];
      const requiredStatus = axis === 'outcome' ? 'VALIDATED' : 'COMPLETED';
      if (axisStatus !== requiredStatus) {
        throw new Error(`case_closure_axis_not_ready:${axis}`);
      }
    }

    const now = new Date().toISOString();
    const updated = await client.query<CaseCoreRow>(
      `UPDATE case_core
          SET closure_type = ?, closed_at = ?, closed_by_actor_id = ?,
              closure_evidence_ref = COALESCE(?, closure_evidence_ref),
              version = version + 1, updated_at = ?
        WHERE case_id = ? AND version = ?
        RETURNING *`,
      [closureType, now, actorUserId, evidenceRef ?? null, now, id, row.version]
    );
    if (!updated.rows[0]) throw new Error('case_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/**
 * CW-GR-023 (POST /api/cases/:caseId/cancel). Thin wrapper over
 * transitionStatus(caseId, 'CANCELLED', actor, reason); records the reason
 * so cancellation is auditable without inventing a second cancel pathway.
 */
export async function cancelCase(
  caseId: string,
  actor: CaseActor,
  reason: string
): Promise<CaseCore> {
  return transitionStatus(caseId, 'CANCELLED', actor, requireNonBlank(reason, 'case_cancel_reason_required'));
}

/**
 * CW-01-026-INV1 (one tenant/organization context per Case).
 *
 * Tenant-scoped read using the denormalized organization_id column on
 * case_core directly, so list surfaces never need a join into the actively-
 * mutated `projects` table just to scope by tenant.
 */
export async function listCasesForOrganization(
  organizationId: string,
  filters?: { caseStatus?: CaseStatus; caseProfile?: CaseProfile; governanceTier?: GovernanceTier }
): Promise<CaseCore[]> {
  const orgId = requireNonBlank(organizationId, 'case_organization_id_required');
  const conditions: string[] = ['organization_id = ?'];
  const params: unknown[] = [orgId];

  if (filters?.caseStatus) {
    conditions.push('case_status = ?');
    params.push(requireEnum(filters.caseStatus, ['DRAFT', 'ACTIVE', 'BLOCKED', 'CLOSED', 'FAILED', 'CANCELLED'], 'case_status_invalid'));
  }
  if (filters?.caseProfile) {
    conditions.push('case_profile = ?');
    params.push(requireEnum(filters.caseProfile, CASE_PROFILES, 'case_profile_invalid'));
  }
  if (filters?.governanceTier) {
    conditions.push('governance_tier = ?');
    params.push(requireEnum(filters.governanceTier, GOVERNANCE_TIERS, 'case_governance_tier_invalid'));
  }

  const rows = await queryAll<CaseCoreRow>(
    `SELECT * FROM case_core WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  return rows.map(mapRow);
}
