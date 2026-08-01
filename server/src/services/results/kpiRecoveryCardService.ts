/**
 * kpiRecoveryCardService — RES-003A KPI Recovery Card adapter.
 *
 * Thin org-scoped CRUD/state-machine layer over kpi_recovery_cards /
 * kpi_recovery_actions / kpi_recovery_checkpoints — see
 * server/migrations/20260801_res003a_kpi_recovery_card.sql for the full
 * schema and the rationale behind each guard below (evidence-required close
 * check, optimistic-concurrency `version`, partial-unique idempotency keys).
 *
 * Follows the `db: IDatabase` adapter convention already used by
 * kpiDeviationService.ts / resultsEnterpriseService.ts: callers build the
 * adapter (see server/src/routes/v8/results.routes.ts), this module never
 * imports a concrete DB client directly — keeps it testable with a stub.
 */
import type { IDatabase } from '../../database/IDatabase.js';
import { evaluateKpiPoint, type KpiDefinitionForEval } from './kpiDeviationService.js';

export type RecoveryPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecoveryLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'UNDER_REVIEW' | 'CLOSED';
export type RecoveryDecision = 'CONTINUE' | 'ESCALATE' | 'CLOSE';
export type RecoveryEffectivenessStatus = 'NOT_YET_DUE' | 'PENDING_ASSESSMENT' | 'ASSESSED';
export type RecoveryEffectivenessRating = 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';
export type RecoveryActionType = 'IMMEDIATE' | 'DURABLE';
export type RecoveryActionStatus = 'OPEN' | 'DONE' | 'CANCELLED';
export type RecoveryTaskLinkStatus = 'NONE' | 'PENDING' | 'LINKED' | 'LINK_FAILED';
export type RecoveryCheckpointStatus = 'PENDING' | 'MET' | 'MISSED' | 'CANCELLED';

export interface RecoveryReferenceItem {
  description: string;
  relatedId?: string;
  note?: string;
}

/** Raw DB row shape (snake_case) for kpi_recovery_cards. */
export interface RecoveryCardRow {
  id: string;
  organization_id: string;
  deviation_case_id: string;
  kpi_id: string;
  hypothesis: string | null;
  confirmed_cause: string | null;
  impact_description: string | null;
  priority: RecoveryPriority;
  expected_impact: string | null;
  dependencies: unknown;
  risks: unknown;
  expected_recovery_date: string | null;
  effectiveness_criteria: string | null;
  effectiveness_status: RecoveryEffectivenessStatus;
  effectiveness_rating: RecoveryEffectivenessRating | null;
  lifecycle_status: RecoveryLifecycleStatus;
  decision: RecoveryDecision | null;
  active_since: string;
  version: number;
  evidence_text: string | null;
  evidence_ref: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  closed_by: string | null;
  closed_at: string | null;
}

/** Raw DB row shape (snake_case) for kpi_recovery_actions. */
export interface RecoveryActionRow {
  id: string;
  organization_id: string;
  recovery_card_id: string;
  action_type: RecoveryActionType;
  title: string;
  description: string | null;
  owner_user_id: string | null;
  due_date: string | null;
  status: RecoveryActionStatus;
  linked_task_id: string | null;
  task_link_status: RecoveryTaskLinkStatus;
  task_link_error: string | null;
  task_link_attempted_at: string | null;
  idempotency_key: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecoveryCheckpointRow {
  id: string;
  organization_id: string;
  recovery_card_id: string;
  checkpoint_date: string;
  status: RecoveryCheckpointStatus;
  kpi_time_series_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

/**
 * API response shapes (camelCase). These are the ONLY shapes route handlers
 * should ever send to the client — never spread a raw *Row straight into a
 * response (see the RES-003A contract-fix packet: the earlier round of this
 * file did exactly that for the card, and left actions/checkpoints as raw
 * snake_case rows entirely).
 */
export interface RecoveryActionDTO {
  id: string;
  actionType: RecoveryActionType;
  title: string;
  description: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  status: RecoveryActionStatus;
  linkedTaskId: string | null;
  taskLinkStatus: RecoveryTaskLinkStatus;
  taskLinkError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryCheckpointDTO {
  id: string;
  checkpointDate: string;
  status: RecoveryCheckpointStatus;
  notes: string | null;
  kpiTimeSeriesId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface RecoveryCardDTO {
  id: string;
  deviationCaseId: string;
  kpiId: string;
  hypothesis: string | null;
  confirmedCause: string | null;
  impactDescription: string | null;
  priority: RecoveryPriority;
  expectedImpact: string | null;
  dependencies: RecoveryReferenceItem[];
  risks: RecoveryReferenceItem[];
  expectedRecoveryDate: string | null;
  effectivenessCriteria: string | null;
  effectivenessStatus: RecoveryEffectivenessStatus;
  effectivenessRating: RecoveryEffectivenessRating | null;
  lifecycleStatus: RecoveryLifecycleStatus;
  decision: RecoveryDecision | null;
  version: number;
  evidenceText: string | null;
  evidenceRef: string | null;
  actions: RecoveryActionDTO[];
  checkpoints: RecoveryCheckpointDTO[];
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  closedBy: string | null;
  closedAt: string | null;
}

/**
 * Service errors carry a stable `.code` so route handlers can translate them
 * into the right HTTP status without string-matching `.message`.
 */
export class RecoveryCardServiceError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
    this.name = 'RecoveryCardServiceError';
  }
}

function serviceError(code: string, message?: string): RecoveryCardServiceError {
  return new RecoveryCardServiceError(code, message);
}

function parseJsonArray(value: unknown): RecoveryReferenceItem[] {
  if (Array.isArray(value)) return value as RecoveryReferenceItem[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** kpi_recovery_actions row -> camelCase ActionDTO, field-by-field. */
export function toActionDTO(row: RecoveryActionRow): RecoveryActionDTO {
  return {
    id: row.id,
    actionType: row.action_type,
    title: row.title,
    description: row.description,
    ownerUserId: row.owner_user_id,
    dueDate: row.due_date,
    status: row.status,
    linkedTaskId: row.linked_task_id,
    taskLinkStatus: row.task_link_status,
    taskLinkError: row.task_link_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** kpi_recovery_checkpoints row -> camelCase CheckpointDTO, field-by-field. */
export function toCheckpointDTO(row: RecoveryCheckpointRow): RecoveryCheckpointDTO {
  return {
    id: row.id,
    checkpointDate: row.checkpoint_date,
    status: row.status,
    notes: row.notes,
    kpiTimeSeriesId: row.kpi_time_series_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

/**
 * kpi_recovery_cards row -> camelCase CardDTO, field-by-field, with
 * already-mapped actions/checkpoints embedded. `dependencies`/`risks` are
 * parsed from JSONB into the real `{description, relatedId?, note?}[]` shape
 * (never flattened to strings) — same parseJsonArray used by
 * updateRecoveryCard's read-after-write below, so the JSONB round-trip is
 * handled identically everywhere in this file regardless of whether the DB
 * driver already parsed the column or returned it as a JSON string.
 */
export function toCardDTO(
  row: RecoveryCardRow,
  actions: RecoveryActionDTO[],
  checkpoints: RecoveryCheckpointDTO[]
): RecoveryCardDTO {
  return {
    id: row.id,
    deviationCaseId: row.deviation_case_id,
    kpiId: row.kpi_id,
    hypothesis: row.hypothesis,
    confirmedCause: row.confirmed_cause,
    impactDescription: row.impact_description,
    priority: row.priority,
    expectedImpact: row.expected_impact,
    dependencies: parseJsonArray(row.dependencies),
    risks: parseJsonArray(row.risks),
    expectedRecoveryDate: row.expected_recovery_date,
    effectivenessCriteria: row.effectiveness_criteria,
    effectivenessStatus: row.effectiveness_status,
    effectivenessRating: row.effectiveness_rating,
    lifecycleStatus: row.lifecycle_status,
    decision: row.decision,
    version: Number(row.version),
    evidenceText: row.evidence_text,
    evidenceRef: row.evidence_ref,
    actions,
    checkpoints,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
  };
}

async function fetchRecoveryActionRows(
  db: IDatabase,
  orgId: string,
  recoveryCardId: string
): Promise<RecoveryActionRow[]> {
  return db.all<RecoveryActionRow>(
    `SELECT * FROM kpi_recovery_actions WHERE recovery_card_id = ? AND organization_id = ? ORDER BY created_at ASC`,
    [recoveryCardId, orgId]
  );
}

async function fetchRecoveryCheckpointRows(
  db: IDatabase,
  orgId: string,
  recoveryCardId: string
): Promise<RecoveryCheckpointRow[]> {
  return db.all<RecoveryCheckpointRow>(
    `SELECT * FROM kpi_recovery_checkpoints WHERE recovery_card_id = ? AND organization_id = ? ORDER BY checkpoint_date ASC`,
    [recoveryCardId, orgId]
  );
}

/**
 * Builds the full CardDTO (embedded actions/checkpoints) for an
 * already-loaded card row. Exported so route handlers can reuse the exact
 * same embedding logic for both the "success" and the "409 conflict, return
 * fresh state" branches, instead of two DTO-building code paths drifting
 * apart.
 */
export async function buildRecoveryCardDTO(
  db: IDatabase,
  orgId: string,
  row: RecoveryCardRow
): Promise<RecoveryCardDTO> {
  const [actionRows, checkpointRows] = await Promise.all([
    fetchRecoveryActionRows(db, orgId, row.id),
    fetchRecoveryCheckpointRows(db, orgId, row.id),
  ]);
  return toCardDTO(row, actionRows.map(toActionDTO), checkpointRows.map(toCheckpointDTO));
}

/**
 * Loads a card by id (org-scoped) and returns the full embedded DTO, or
 * `null` if it doesn't exist / isn't owned by this org. Used by every route
 * that returns the "full card" shape: GET, POST create, PUT update, close,
 * continue, escalate — including each of their 409 conflict/refetch
 * branches, so a version conflict still returns actions/checkpoints, not a
 * bare card.
 */
export async function getRecoveryCardDTO(
  db: IDatabase,
  orgId: string,
  recoveryCardId: string
): Promise<RecoveryCardDTO | null> {
  const row = await db.get<RecoveryCardRow>(
    `SELECT * FROM kpi_recovery_cards WHERE id = ? AND organization_id = ?`,
    [recoveryCardId, orgId]
  );
  if (!row) return null;
  return buildRecoveryCardDTO(db, orgId, row);
}

const MAX_REFERENCE_ITEMS = 50;
const MAX_REFERENCE_LIST_BYTES = 64 * 1024;
const ALLOWED_REFERENCE_KEYS = new Set(['description', 'relatedId', 'note']);
const VALID_PRIORITIES: RecoveryPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_ACTION_TYPES: RecoveryActionType[] = ['IMMEDIATE', 'DURABLE'];

/**
 * Validate a dependencies/risks payload per the threat-model note in the
 * schema review (Tor F, DoS-by-size/shape): the JSONB column has no size
 * limit at the schema level, so bound array length, reject unknown per-item
 * keys, and cap the serialized size here, BEFORE any write is attempted.
 */
function validateReferenceList(value: unknown, fieldName: string): RecoveryReferenceItem[] {
  if (!Array.isArray(value)) {
    throw serviceError('VALIDATION_ERROR', `${fieldName} must be an array`);
  }
  if (value.length > MAX_REFERENCE_ITEMS) {
    throw serviceError(
      'VALIDATION_ERROR',
      `${fieldName} may contain at most ${MAX_REFERENCE_ITEMS} items`
    );
  }
  const cleaned: RecoveryReferenceItem[] = value.map((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw serviceError('VALIDATION_ERROR', `${fieldName}[${idx}] must be an object`);
    }
    const record = item as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!ALLOWED_REFERENCE_KEYS.has(key)) {
        throw serviceError('VALIDATION_ERROR', `${fieldName}[${idx}] has unknown key "${key}"`);
      }
    }
    const description = record.description;
    if (typeof description !== 'string' || !description.trim()) {
      throw serviceError('VALIDATION_ERROR', `${fieldName}[${idx}].description is required`);
    }
    const relatedId = record.relatedId;
    const note = record.note;
    if (relatedId !== undefined && typeof relatedId !== 'string') {
      throw serviceError('VALIDATION_ERROR', `${fieldName}[${idx}].relatedId must be a string`);
    }
    if (note !== undefined && typeof note !== 'string') {
      throw serviceError('VALIDATION_ERROR', `${fieldName}[${idx}].note must be a string`);
    }
    return {
      description: description.trim(),
      ...(relatedId !== undefined ? { relatedId } : {}),
      ...(note !== undefined ? { note } : {}),
    };
  });
  const byteSize = Buffer.byteLength(JSON.stringify(cleaned), 'utf8');
  if (byteSize > MAX_REFERENCE_LIST_BYTES) {
    throw serviceError(
      'VALIDATION_ERROR',
      `${fieldName} payload exceeds ${MAX_REFERENCE_LIST_BYTES} bytes`
    );
  }
  return cleaned;
}

// severity -> initial priority mapping for auto-created cards. RED deviations
// start HIGH priority; AMBER starts MEDIUM (also the table default). There is
// no CRITICAL auto-assignment in this round — a human upgrades explicitly via
// updateRecoveryCard.
function priorityForSeverity(severity: 'AMBER' | 'RED'): RecoveryPriority {
  return severity === 'RED' ? 'HIGH' : 'MEDIUM';
}

// ============================================================================
// ensureRecoveryCardForCase
// ============================================================================

export interface EnsureRecoveryCardForCaseInput {
  db: IDatabase;
  orgId: string;
  kpiId: string;
  caseId: string;
  severity: 'AMBER' | 'RED';
  actorUserId?: string | null;
}

export interface EnsureRecoveryCardForCaseResult {
  cardId: string;
  created: boolean;
}

export async function ensureRecoveryCardForCase(
  input: EnsureRecoveryCardForCaseInput
): Promise<EnsureRecoveryCardForCaseResult | null> {
  const { db, caseId, severity, actorUserId } = input;

  // Do NOT trust caller-supplied orgId/kpiId for the INSERT — re-derive both
  // from the parent deviation case so the card can never denormalize away
  // from its case (adversarial schema review, Tor C: caller-trust gap where
  // a caller-supplied orgId/kpiId could drift from the real parent row).
  const parentCase = await db.get<{ organization_id: string; kpi_id: string }>(
    `SELECT organization_id, kpi_id FROM kpi_deviation_cases WHERE id = ?`,
    [caseId]
  );
  if (!parentCase?.organization_id || !parentCase?.kpi_id) {
    return null;
  }
  const orgId = parentCase.organization_id;
  const kpiId = parentCase.kpi_id;

  const inserted = await db.all<{ id: string }>(
    `
    INSERT INTO kpi_recovery_cards (
      organization_id, deviation_case_id, kpi_id, priority,
      lifecycle_status, active_since, created_by, updated_by
    )
    VALUES (?, ?, ?, ?, 'ACTIVE', now(), ?, ?)
    ON CONFLICT (deviation_case_id) DO NOTHING
    RETURNING id
    `,
    [orgId, caseId, kpiId, priorityForSeverity(severity), actorUserId || null, actorUserId || null]
  );
  if (inserted[0]?.id) {
    return { cardId: inserted[0].id, created: true };
  }

  const existing = await db.get<{ id: string; lifecycle_status: RecoveryLifecycleStatus }>(
    `SELECT id, lifecycle_status FROM kpi_recovery_cards WHERE deviation_case_id = ? AND organization_id = ?`,
    [caseId, orgId]
  );
  if (!existing?.id) return null;

  if (existing.lifecycle_status === 'CLOSED') {
    // Reopen, conditional on lifecycle_status='CLOSED' so a concurrent
    // reopen (two parallel time-series writes racing this same case) is
    // idempotent — the loser's UPDATE affects 0 rows and just falls through
    // to returning the id below.
    await db.run(
      `
      UPDATE kpi_recovery_cards
      SET lifecycle_status = 'ACTIVE', decision = NULL,
          effectiveness_status = 'NOT_YET_DUE', effectiveness_rating = NULL,
          active_since = now(), updated_by = ?, updated_at = now(), version = version + 1
      WHERE id = ? AND organization_id = ? AND lifecycle_status = 'CLOSED'
      `,
      [actorUserId || null, existing.id, orgId]
    );
  }

  return { cardId: existing.id, created: false };
}

// ============================================================================
// ensureRecoveryAction
// ============================================================================

export interface EnsureRecoveryActionInput {
  db: IDatabase;
  orgId: string;
  recoveryCardId: string;
  actionType: RecoveryActionType;
  title: string;
  description?: string | null;
  ownerUserId?: string | null;
  dueDate?: string | null;
  idempotencyKey?: string | null;
  actorUserId?: string | null;
}

export interface EnsureRecoveryActionResult {
  actionId: string;
  created: boolean;
}

export async function ensureRecoveryAction(
  input: EnsureRecoveryActionInput
): Promise<EnsureRecoveryActionResult> {
  const {
    db,
    orgId,
    recoveryCardId,
    actionType,
    title,
    description,
    ownerUserId,
    dueDate,
    idempotencyKey,
    actorUserId,
  } = input;

  if (!VALID_ACTION_TYPES.includes(actionType)) {
    throw serviceError(
      'VALIDATION_ERROR',
      `actionType must be one of: ${VALID_ACTION_TYPES.join(', ')}`
    );
  }
  const safeTitle = typeof title === 'string' ? title.trim() : '';
  if (!safeTitle) {
    throw serviceError('VALIDATION_ERROR', 'title is required');
  }

  const card = await db.get<{ id: string }>(
    `SELECT id FROM kpi_recovery_cards WHERE id = ? AND organization_id = ?`,
    [recoveryCardId, orgId]
  );
  if (!card?.id) {
    throw serviceError('NOT_FOUND', 'Recovery card not found');
  }

  const key = idempotencyKey ? String(idempotencyKey).trim() || null : null;

  if (key) {
    const inserted = await db.all<{ id: string }>(
      `
      INSERT INTO kpi_recovery_actions (
        organization_id, recovery_card_id, action_type, title, description,
        owner_user_id, due_date, idempotency_key, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (recovery_card_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
      RETURNING id
      `,
      [
        orgId,
        recoveryCardId,
        actionType,
        safeTitle,
        description || null,
        ownerUserId || null,
        dueDate || null,
        key,
        actorUserId || null,
      ]
    );
    if (inserted[0]?.id) {
      return { actionId: inserted[0].id, created: true };
    }
    const existing = await db.get<{ id: string }>(
      `SELECT id FROM kpi_recovery_actions WHERE recovery_card_id = ? AND idempotency_key = ? AND organization_id = ?`,
      [recoveryCardId, key, orgId]
    );
    if (!existing?.id) {
      // ON CONFLICT DO NOTHING implies a colliding row exists; if the
      // re-select can't find it, something is genuinely wrong upstream.
      throw serviceError('CONFLICT', 'Recovery action idempotency conflict could not be resolved');
    }
    return { actionId: existing.id, created: false };
  }

  const inserted = await db.all<{ id: string }>(
    `
    INSERT INTO kpi_recovery_actions (
      organization_id, recovery_card_id, action_type, title, description,
      owner_user_id, due_date, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
    `,
    [orgId, recoveryCardId, actionType, safeTitle, description || null, ownerUserId || null, dueDate || null, actorUserId || null]
  );
  if (!inserted[0]?.id) {
    throw serviceError('INSERT_FAILED', 'Failed to create recovery action');
  }
  return { actionId: inserted[0].id, created: true };
}

// ============================================================================
// linkRecoveryActionTask / markRecoveryActionTaskLinkFailed
// ============================================================================

export interface LinkRecoveryActionTaskInput {
  db: IDatabase;
  orgId: string;
  actionId: string;
  taskId: string;
}

export interface LinkRecoveryActionTaskResult {
  linked: boolean;
  linkedTaskId: string | null;
}

export async function linkRecoveryActionTask(
  input: LinkRecoveryActionTaskInput
): Promise<LinkRecoveryActionTaskResult> {
  const { db, orgId, actionId, taskId } = input;

  const ownedTask = await db.get<{ id: string }>(
    `SELECT id FROM tasks WHERE id = ? AND organization_id = ?`,
    [taskId, orgId]
  );
  if (!ownedTask?.id) {
    // Never link a task belonging to a different org, even if the caller is
    // otherwise authorized on this recovery action.
    throw serviceError('TASK_NOT_FOUND', 'Task not found for this organization');
  }

  try {
    const updated = await db.all<{ linked_task_id: string }>(
      `
      UPDATE kpi_recovery_actions
      SET linked_task_id = ?, task_link_status = 'LINKED', task_link_attempted_at = now(), updated_at = now()
      WHERE id = ? AND organization_id = ? AND task_link_status != 'LINKED'
      RETURNING linked_task_id
      `,
      [taskId, actionId, orgId]
    );
    if (updated[0]?.linked_task_id) {
      return { linked: true, linkedTaskId: updated[0].linked_task_id };
    }
  } catch (err: unknown) {
    // uq_kpi_recovery_actions_linked_task: the task is already linked from a
    // DIFFERENT recovery action. Surface as a distinct code instead of a
    // generic 500.
    if ((err as { code?: string })?.code === '23505') {
      throw serviceError('TASK_ALREADY_LINKED', 'Task is already linked to another recovery action');
    }
    throw err;
  }

  // 0 rows: either this action doesn't exist/isn't ours, or it is already
  // LINKED (idempotent retry). Re-select to tell the two apart and return the
  // current linked task either way.
  const existing = await db.get<{ id: string; linked_task_id: string | null }>(
    `SELECT id, linked_task_id FROM kpi_recovery_actions WHERE id = ? AND organization_id = ?`,
    [actionId, orgId]
  );
  if (!existing?.id) {
    throw serviceError('NOT_FOUND', 'Recovery action not found');
  }
  return { linked: false, linkedTaskId: existing.linked_task_id || null };
}

export interface MarkRecoveryActionTaskLinkFailedInput {
  db: IDatabase;
  orgId: string;
  actionId: string;
  error: string;
}

export async function markRecoveryActionTaskLinkFailed(
  input: MarkRecoveryActionTaskLinkFailedInput
): Promise<void> {
  const { db, orgId, actionId, error } = input;
  await db.run(
    `
    UPDATE kpi_recovery_actions
    SET task_link_status = 'LINK_FAILED', task_link_error = ?, task_link_attempted_at = now()
    WHERE id = ? AND organization_id = ? AND task_link_status != 'LINKED'
    `,
    [String(error || '').slice(0, 2000), actionId, orgId]
  );
}

// ============================================================================
// closeRecoveryCard
// ============================================================================

export interface CloseRecoveryCardInput {
  db: IDatabase;
  orgId: string;
  recoveryCardId: string;
  expectedVersion: number;
  evidenceText?: string | null;
  evidenceRef?: string | null;
  effectivenessRating: RecoveryEffectivenessRating;
  actorUserId?: string | null;
}

export type CloseRecoveryCardFailureReason =
  | 'MISSING_EVIDENCE'
  | 'VERSION_CONFLICT'
  | 'STALE_MEASUREMENT'
  | 'STILL_BREACHING';

export interface CloseRecoveryCardLatestMeasurement {
  value: number;
  createdAt: string;
  status: 'AMBER' | 'RED';
}

export type CloseRecoveryCardResult =
  | { closed: true; card: RecoveryCardDTO }
  | {
      closed: false;
      reason: CloseRecoveryCardFailureReason;
      latestMeasurement?: CloseRecoveryCardLatestMeasurement;
    };

export async function closeRecoveryCard(
  input: CloseRecoveryCardInput
): Promise<CloseRecoveryCardResult> {
  const {
    db,
    orgId,
    recoveryCardId,
    expectedVersion,
    evidenceText,
    evidenceRef,
    effectivenessRating,
    actorUserId,
  } = input;

  // Step 1: evidence guard fires BEFORE any DB touch (mirrors the schema's
  // own kpi_recovery_cards_close_requires_evidence_check, but checked early
  // so we can return a clean {closed:false} instead of a raw CHECK violation).
  const safeEvidenceText = typeof evidenceText === 'string' ? evidenceText.trim() : '';
  const safeEvidenceRef = typeof evidenceRef === 'string' ? evidenceRef.trim() : '';
  if (!safeEvidenceText && !safeEvidenceRef) {
    return { closed: false, reason: 'MISSING_EVIDENCE' };
  }

  // Step 2: load the card + its KPI's evaluation definition in one round trip.
  const row = await db.get<{
    kpi_id: string;
    active_since: string;
    version: number | string;
    k_id: string;
    k_name: string | null;
    target_value: number | string | null;
    direction: string | null;
    threshold_mode: string | null;
    amber_threshold_pct: number | string | null;
    red_threshold_pct: number | string | null;
    amber_threshold_abs: number | string | null;
    red_threshold_abs: number | string | null;
  }>(
    `
    SELECT c.kpi_id, c.active_since, c.version,
           k.id AS k_id, k.name AS k_name, k.target_value, k.direction, k.threshold_mode,
           k.amber_threshold_pct, k.red_threshold_pct, k.amber_threshold_abs, k.red_threshold_abs
    FROM kpi_recovery_cards c
    JOIN initiative_kpis k ON k.id = c.kpi_id
    WHERE c.id = ? AND c.organization_id = ?
    `,
    [recoveryCardId, orgId]
  );
  if (!row?.k_id) {
    throw serviceError('NOT_FOUND', 'Recovery card not found');
  }

  // Step 3: version guard.
  if (Number(row.version) !== Number(expectedVersion)) {
    return { closed: false, reason: 'VERSION_CONFLICT' };
  }

  // Step 4: freshness guard — a measurement recorded strictly after the card
  // most recently went ACTIVE (active_since), not just after the original
  // deviation was detected (see schema comment on active_since for why).
  //
  // TIMEZONE FIX (bug found by real-PG acceptance test, see the header
  // comment in tests/acceptance/res003a-kpi-recovery-card.e2e.test.ts):
  // kpi_time_series.created_at is `timestamp without time zone` (stored as
  // UTC wall-clock digits — the column's DEFAULT is CURRENT_TIMESTAMP under
  // the app DB session's UTC default; see server/migrations-v2/
  // 001_baseline_20260413.sql) while kpi_recovery_cards.active_since is
  // `timestamptz`. Comparing them used to bind `row.active_since` as a bare
  // parameter: node-pg serializes a JS Date using the Node PROCESS's local
  // wall-clock digits plus an explicit UTC offset, and when Postgres infers
  // the parameter's type from the naive `created_at` column (`timestamp`,
  // no zone) it silently DISCARDS that offset — shifting the effective
  // comparison value by the server process's local UTC offset. On a
  // non-UTC process TZ (e.g. Europe/Warsaw, UTC+2) this turned a
  // 2-second-fresher measurement into one read back as ~2 hours STALER,
  // wrongly blocking closure with STALE_MEASUREMENT.
  //
  // Fix: force the parameter's SQL type to `timestamptz` via an explicit
  // cast (so Postgres honours the offset node-pg attaches, regardless of
  // what timezone the Node process happens to be in), then project that
  // absolute instant onto UTC wall-clock digits with `AT TIME ZONE 'UTC'`
  // — the same representation `created_at` is stored in. This makes the
  // comparison correct independent of the Node process's TZ (dev machine,
  // CI, or Railway container).
  const measurement = await db.get<{ value: number | string; created_at: string }>(
    `
    SELECT value, created_at FROM kpi_time_series
    WHERE kpi_id = ? AND organization_id = ?
      AND created_at > (?::timestamptz AT TIME ZONE 'UTC')
    ORDER BY created_at DESC LIMIT 1
    `,
    [row.kpi_id, orgId, row.active_since]
  );
  if (!measurement) {
    return { closed: false, reason: 'STALE_MEASUREMENT' };
  }

  // Step 5: re-run the exact same band evaluation the deviation-detection
  // path uses, on the fresh measurement — never trust "no new AMBER/RED case
  // was opened" as a proxy for "the KPI recovered".
  const def: KpiDefinitionForEval = {
    id: row.k_id,
    organizationId: orgId,
    name: row.k_name || '',
    targetValue: row.target_value != null ? Number(row.target_value) : null,
    direction: (row.direction as KpiDefinitionForEval['direction']) || null,
    thresholdMode: (row.threshold_mode as KpiDefinitionForEval['thresholdMode']) || null,
    amberThresholdPct: row.amber_threshold_pct != null ? Number(row.amber_threshold_pct) : null,
    redThresholdPct: row.red_threshold_pct != null ? Number(row.red_threshold_pct) : null,
    amberThresholdAbs: row.amber_threshold_abs != null ? Number(row.amber_threshold_abs) : null,
    redThresholdAbs: row.red_threshold_abs != null ? Number(row.red_threshold_abs) : null,
  };
  const evalRes = evaluateKpiPoint(def, Number(measurement.value));
  if (evalRes.status === 'AMBER' || evalRes.status === 'RED') {
    return {
      closed: false,
      reason: 'STILL_BREACHING',
      latestMeasurement: {
        value: Number(measurement.value),
        createdAt: measurement.created_at,
        status: evalRes.status,
      },
    };
  }

  // Step 6: atomic close, still version-guarded — someone else could have
  // mutated the card between step 2's read and this write.
  const updated = await db.all<RecoveryCardRow>(
    `
    UPDATE kpi_recovery_cards
    SET lifecycle_status = 'CLOSED', decision = 'CLOSE', effectiveness_status = 'ASSESSED',
        effectiveness_rating = ?, evidence_text = ?, evidence_ref = ?,
        closed_by = ?, closed_at = now(), updated_by = ?, updated_at = now(), version = version + 1
    WHERE id = ? AND organization_id = ? AND version = ?
    RETURNING *
    `,
    [
      effectivenessRating,
      safeEvidenceText || null,
      safeEvidenceRef || null,
      actorUserId || null,
      actorUserId || null,
      recoveryCardId,
      orgId,
      expectedVersion,
    ]
  );
  if (!updated[0]) {
    return { closed: false, reason: 'VERSION_CONFLICT' };
  }
  return { closed: true, card: await buildRecoveryCardDTO(db, orgId, updated[0]) };
}

// ============================================================================
// progressRecoveryCard (CONTINUE / ESCALATE)
// ============================================================================

export interface ProgressRecoveryCardInput {
  db: IDatabase;
  orgId: string;
  recoveryCardId: string;
  expectedVersion: number;
  decision: 'CONTINUE' | 'ESCALATE';
  // Accepted but NOT persisted anywhere yet — see NEEDS_CODEX_DECISION note
  // at the route handler: this schema slice has no comment/activity-log
  // table to hang a free-text note off, and building one is out of scope
  // for this round.
  note?: string | null;
  actorUserId?: string | null;
}

export type ProgressRecoveryCardResult =
  | { ok: true; card: RecoveryCardDTO }
  | { ok: false; reason: 'VERSION_CONFLICT' };

export async function progressRecoveryCard(
  input: ProgressRecoveryCardInput
): Promise<ProgressRecoveryCardResult> {
  const { db, orgId, recoveryCardId, expectedVersion, decision, actorUserId } = input;
  if (decision !== 'CONTINUE' && decision !== 'ESCALATE') {
    throw serviceError('VALIDATION_ERROR', "decision must be 'CONTINUE' or 'ESCALATE'");
  }

  // NOTE (conscious scope cut): this does NOT determine an escalation
  // addressee or send any notification. `escalationForSignal` (the closest
  // existing concept in this codebase) is dead code with zero callers —
  // building a real time-based escalation/notification system is a separate,
  // larger piece of work, deliberately not attempted here.
  const updated = await db.all<RecoveryCardRow>(
    `
    UPDATE kpi_recovery_cards
    SET decision = ?,
        lifecycle_status = CASE WHEN ? = 'ESCALATE' THEN 'UNDER_REVIEW' ELSE lifecycle_status END,
        updated_by = ?, updated_at = now(), version = version + 1
    WHERE id = ? AND organization_id = ? AND version = ?
    RETURNING *
    `,
    [decision, decision, actorUserId || null, recoveryCardId, orgId, expectedVersion]
  );
  if (!updated[0]) {
    return { ok: false, reason: 'VERSION_CONFLICT' };
  }
  return { ok: true, card: await buildRecoveryCardDTO(db, orgId, updated[0]) };
}

// ============================================================================
// updateRecoveryCard
// ============================================================================

export interface UpdateRecoveryCardPatch {
  hypothesis?: string | null;
  confirmedCause?: string | null;
  impactDescription?: string | null;
  priority?: RecoveryPriority;
  expectedImpact?: string | null;
  dependencies?: unknown;
  risks?: unknown;
  expectedRecoveryDate?: string | null;
  effectivenessCriteria?: string | null;
}

export interface UpdateRecoveryCardInput {
  db: IDatabase;
  orgId: string;
  recoveryCardId: string;
  expectedVersion: number;
  patch: UpdateRecoveryCardPatch;
  actorUserId?: string | null;
}

export type UpdateRecoveryCardResult =
  | { ok: true; card: RecoveryCardDTO }
  | { ok: false; reason: 'VERSION_CONFLICT' };

export async function updateRecoveryCard(
  input: UpdateRecoveryCardInput
): Promise<UpdateRecoveryCardResult> {
  const { db, orgId, recoveryCardId, expectedVersion, patch, actorUserId } = input;

  if (patch.priority !== undefined && !VALID_PRIORITIES.includes(patch.priority)) {
    throw serviceError('VALIDATION_ERROR', `priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
  // Validation happens BEFORE any write (threat-model requirement) — both
  // branches throw on bad shape/size, so a rejected patch never reaches SQL.
  const dependencies =
    patch.dependencies !== undefined ? validateReferenceList(patch.dependencies, 'dependencies') : undefined;
  const risks = patch.risks !== undefined ? validateReferenceList(patch.risks, 'risks') : undefined;

  const updated = await db.all<RecoveryCardRow>(
    `
    UPDATE kpi_recovery_cards
    SET
      hypothesis = COALESCE(?, hypothesis),
      confirmed_cause = COALESCE(?, confirmed_cause),
      impact_description = COALESCE(?, impact_description),
      priority = COALESCE(?, priority),
      expected_impact = COALESCE(?, expected_impact),
      dependencies = COALESCE(?::jsonb, dependencies),
      risks = COALESCE(?::jsonb, risks),
      expected_recovery_date = COALESCE(?, expected_recovery_date),
      effectiveness_criteria = COALESCE(?, effectiveness_criteria),
      updated_by = ?, updated_at = now(), version = version + 1
    WHERE id = ? AND organization_id = ? AND version = ?
    RETURNING *
    `,
    [
      patch.hypothesis ?? null,
      patch.confirmedCause ?? null,
      patch.impactDescription ?? null,
      patch.priority ?? null,
      patch.expectedImpact ?? null,
      dependencies !== undefined ? JSON.stringify(dependencies) : null,
      risks !== undefined ? JSON.stringify(risks) : null,
      patch.expectedRecoveryDate ?? null,
      patch.effectivenessCriteria ?? null,
      actorUserId || null,
      recoveryCardId,
      orgId,
      expectedVersion,
    ]
  );
  if (!updated[0]) {
    return { ok: false, reason: 'VERSION_CONFLICT' };
  }
  return { ok: true, card: await buildRecoveryCardDTO(db, orgId, updated[0]) };
}

// ============================================================================
// Checkpoints
// ============================================================================

export interface EnsureRecoveryCheckpointInput {
  db: IDatabase;
  orgId: string;
  recoveryCardId: string;
  checkpointDate: string;
  notes?: string | null;
  actorUserId?: string | null;
}

export async function ensureRecoveryCheckpoint(
  input: EnsureRecoveryCheckpointInput
): Promise<RecoveryCheckpointRow> {
  const { db, orgId, recoveryCardId, checkpointDate, notes, actorUserId } = input;

  const card = await db.get<{ id: string }>(
    `SELECT id FROM kpi_recovery_cards WHERE id = ? AND organization_id = ?`,
    [recoveryCardId, orgId]
  );
  if (!card?.id) {
    throw serviceError('NOT_FOUND', 'Recovery card not found');
  }
  const safeDate = typeof checkpointDate === 'string' ? checkpointDate.slice(0, 10) : '';
  if (!safeDate) {
    throw serviceError('VALIDATION_ERROR', 'checkpointDate is required');
  }

  const inserted = await db.all<RecoveryCheckpointRow>(
    `
    INSERT INTO kpi_recovery_checkpoints (organization_id, recovery_card_id, checkpoint_date, notes, created_by)
    VALUES (?, ?, ?, ?, ?)
    RETURNING *
    `,
    [orgId, recoveryCardId, safeDate, notes || null, actorUserId || null]
  );
  if (!inserted[0]) {
    throw serviceError('INSERT_FAILED', 'Failed to create recovery checkpoint');
  }
  return inserted[0];
}

export interface ResolveRecoveryCheckpointInput {
  db: IDatabase;
  orgId: string;
  recoveryCardId: string;
  checkpointId: string;
  status: 'MET' | 'MISSED';
  kpiTimeSeriesId?: string | null;
}

export async function resolveRecoveryCheckpoint(
  input: ResolveRecoveryCheckpointInput
): Promise<RecoveryCheckpointRow> {
  const { db, orgId, recoveryCardId, checkpointId, status, kpiTimeSeriesId } = input;
  if (status !== 'MET' && status !== 'MISSED') {
    throw serviceError('VALIDATION_ERROR', "status must be 'MET' or 'MISSED'");
  }

  const updated = await db.all<RecoveryCheckpointRow>(
    `
    UPDATE kpi_recovery_checkpoints
    SET status = ?, kpi_time_series_id = COALESCE(?, kpi_time_series_id), resolved_at = now()
    WHERE id = ? AND recovery_card_id = ? AND organization_id = ?
    RETURNING *
    `,
    [status, kpiTimeSeriesId || null, checkpointId, recoveryCardId, orgId]
  );
  if (!updated[0]) {
    throw serviceError('NOT_FOUND', 'Recovery checkpoint not found');
  }
  return updated[0];
}
