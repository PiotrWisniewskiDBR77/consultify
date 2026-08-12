/**
 * OKR-E006 — Support request / comment / recognition command layer.
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §8.2, ratified by
 * the §-IO Integration Owner rulings block at the top of that document.
 *
 * One table (`okr_vnext_support_requests`), `kind` discriminator
 * (comment | recognition | support_request) — only `support_request`
 * carries a status lifecycle (open -> acknowledged -> resolved, or
 * open/acknowledged -> dismissed).
 *
 * No self-approval-denial class exists here (design §11, IO ruling
 * confirmed no AC establishes a maker-checker pair for support requests —
 * a KR Owner resolving their own raised request after unblocking
 * themselves is a normal, expected action, unlike approving your own OKR
 * commitment).
 *
 * No ACL "contribute" gate is enforced inside these commands — matching the
 * verified precedent every other OKR-E002+ write command follows (see
 * okr.routes.ts's own §OKR-E002 header comment: "no route in this codebase
 * currently implements a live per-route ACL gate check... consistent with
 * ROI/KPI"). Authorization is: org membership (`requireOrgAccess()`) plus
 * the route layer's ABAC pre-fetch of the parent Set via `getOkrSet`
 * (returns null/404 for a caller who cannot see the Set at all).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { assertCommandCapability, type CommandAccessContext } from '../platform/commandCapabilityGuard.js';
import { completeObligation, createObligation } from '../platform/obligations.js';

import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';
import {
  toOkrSupportRequest,
  type OkrRecognitionVisibility,
  type OkrSupportRequest,
  type OkrSupportRequestRow,
} from './okrSupportTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class OkrSupportRequestValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrSupportRequestValidationError';
    this.code = code;
    this.details = details;
  }
}

/** Design §8.2: "Fail-closed on program.recognition_enabled = false...
 * throws OkrRecognitionDisabledError (409) before any write" — mirrors
 * createOkrSet's fail-closed-on-no-active-visibility-policy pattern
 * (OKR-E002 §4.1). */
export class OkrRecognitionDisabledError extends Error {
  code = 'RECOGNITION_DISABLED';
  details: Record<string, unknown>;
  constructor(programId: string) {
    super(`Recognition is disabled for OKR program ${programId} (program.recognition_enabled = false)`);
    this.name = 'OkrRecognitionDisabledError';
    this.details = { programId };
  }
}

// ==========================================
// MyWork obligation constants (design §8.2/plan §13 — literal name)
// ==========================================

export const OKR_SUPPORT_REQUEST_REFERENCE_TYPE = 'okr_support_request';
export const RESPOND_TO_SUPPORT_REQUEST_OBLIGATION_TYPE = 'respond_to_support_request';

// ==========================================
// Shared helpers
// ==========================================

async function assertObjectiveAndKeyResultBelongToSet(
  client: PoolClient,
  params: { setId: string; objectiveId: string; keyResultId: string | null; organizationId: string }
): Promise<void> {
  const { setId, objectiveId, keyResultId, organizationId } = params;
  const objectiveResult = await client.query<{ objective_id: string; set_id: string }>(
    `SELECT objective_id, set_id FROM okr_vnext_objectives WHERE objective_id = $1 AND organization_id = $2`,
    [objectiveId, organizationId]
  );
  const objectiveRow = objectiveResult.rows[0];
  if (!objectiveRow) {
    throw new OkrSupportRequestValidationError(`Objective ${objectiveId} not found`, 'OBJECTIVE_NOT_FOUND', { objectiveId });
  }
  if (objectiveRow.set_id !== setId) {
    throw new OkrSupportRequestValidationError(
      `Objective ${objectiveId} does not belong to Set ${setId}`,
      'OBJECTIVE_SET_MISMATCH',
      { objectiveId, setId }
    );
  }
  if (keyResultId) {
    const krResult = await client.query<{ key_result_id: string; objective_id: string }>(
      `SELECT key_result_id, objective_id FROM okr_vnext_key_results WHERE key_result_id = $1 AND organization_id = $2`,
      [keyResultId, organizationId]
    );
    const krRow = krResult.rows[0];
    if (!krRow) {
      throw new OkrSupportRequestValidationError(`KeyResult ${keyResultId} not found`, 'KEY_RESULT_NOT_FOUND', { keyResultId });
    }
    if (krRow.objective_id !== objectiveId) {
      throw new OkrSupportRequestValidationError(
        `KeyResult ${keyResultId} does not belong to Objective ${objectiveId}`,
        'KEY_RESULT_OBJECTIVE_MISMATCH',
        { keyResultId, objectiveId }
      );
    }
  }
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md).
// postComment/postRecognition/raiseSupportRequest are deliberately left
// UNGATED (see each command's own `void access` comment below) — same
// "brand-new row, no baseline capability path exists in this package's
// allowlist, restricting to admin-only would be a real functional
// regression" shape as createKpiDraft/createOkrSet, but for a DIFFERENT
// underlying reason: this file's own header states the INTENDED model is
// "org membership plus the route layer's ABAC pre-fetch of the parent Set"
// — team-wide-by-design, not owner/reviewer-restricted (unlike everything
// else in the OKR domain). acknowledgeSupportRequest/resolveSupportRequest/
// dismissSupportRequest act on an EXISTING request with a real assignee, so
// those three ARE gated.
export const OKR_SUPPORT_CAPABILITIES = {
  acknowledge: 'results.okr.support.acknowledge',
  resolve: 'results.okr.support.resolve',
  dismiss: 'results.okr.support.dismiss',
} as const;

async function loadSupportRequestForUpdate(
  client: PoolClient,
  requestId: string,
  organizationId: string
): Promise<OkrSupportRequestRow | undefined> {
  const result = await client.query<OkrSupportRequestRow>(
    `SELECT * FROM okr_vnext_support_requests WHERE request_id = $1 AND organization_id = $2 FOR UPDATE`,
    [requestId, organizationId]
  );
  return result.rows[0];
}
const supportRequestRowVersion = (row: OkrSupportRequestRow) => row.row_version;

// ==========================================
// postComment (design §8.2)
// ==========================================

export interface PostCommentInput {
  setId: string;
  objectiveId: string;
  keyResultId?: string | null;
  organizationId: string;
  body: string;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function postComment(input: PostCommentInput): Promise<AtomicCommandOutcome<OkrSupportRequest>> {
  const {
    setId,
    objectiveId,
    keyResultId = null,
    organizationId,
    body,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  if (!body || !body.trim()) {
    throw new OkrSupportRequestValidationError('body is required', 'BODY_REQUIRED');
  }

  return executeAtomicCreate<OkrSupportRequest>({
    organizationId,
    applyMutation: async (client) => {
      // RN-G5 DECISION (documented, not an oversight): see this file's own
      // OKR_SUPPORT_CAPABILITIES comment — commenting is team-wide-by-design,
      // not owner/reviewer-restricted.
      void access;

      await assertObjectiveAndKeyResultBelongToSet(client, { setId, objectiveId, keyResultId, organizationId });
      const insertResult = await client.query<OkrSupportRequestRow>(
        `INSERT INTO okr_vnext_support_requests
           (organization_id, set_id, objective_id, key_result_id, kind, body, created_by)
         VALUES ($1, $2, $3, $4, 'comment', $5, $6)
         RETURNING *`,
        [organizationId, setId, objectiveId, keyResultId, body, createdBy]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[postComment] insert returned no row');
      return toOkrSupportRequest(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { supportRequest: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_support.comment_posted',
        aggregateType: 'okr_set',
        aggregateId: setId,
        organizationId,
        actorUserId: createdBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: result.rowVersion,
        payload: { objectiveId, keyResultId, requestId: result.requestId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// postRecognition (design §8.2)
// ==========================================

export interface PostRecognitionInput {
  setId: string;
  objectiveId: string;
  keyResultId?: string | null;
  organizationId: string;
  body: string;
  recognitionVisibility: OkrRecognitionVisibility;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function postRecognition(input: PostRecognitionInput): Promise<AtomicCommandOutcome<OkrSupportRequest>> {
  const {
    setId,
    objectiveId,
    keyResultId = null,
    organizationId,
    body,
    recognitionVisibility,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  if (!body || !body.trim()) {
    throw new OkrSupportRequestValidationError('body is required', 'BODY_REQUIRED');
  }

  return executeAtomicCreate<OkrSupportRequest>({
    organizationId,
    applyMutation: async (client) => {
      // RN-G5 DECISION: same as postComment — team-wide-by-design.
      void access;

      await assertObjectiveAndKeyResultBelongToSet(client, { setId, objectiveId, keyResultId, organizationId });

      // Fail-closed on program.recognition_enabled = false, checked via the
      // Set's own program_id — BEFORE any write (design §8.2).
      const programResult = await client.query<{ program_id: string; recognition_enabled: boolean }>(
        `SELECT p.program_id, p.recognition_enabled
           FROM okr_vnext_programs p
           JOIN okr_vnext_sets s ON s.program_id = p.program_id
          WHERE s.set_id = $1 AND s.organization_id = $2 AND p.organization_id = $2`,
        [setId, organizationId]
      );
      const programRow = programResult.rows[0];
      if (!programRow) {
        throw new OkrSupportRequestValidationError(`Set ${setId} or its Program not found`, 'SET_NOT_FOUND', { setId });
      }
      if (!programRow.recognition_enabled) {
        throw new OkrRecognitionDisabledError(programRow.program_id);
      }

      const insertResult = await client.query<OkrSupportRequestRow>(
        `INSERT INTO okr_vnext_support_requests
           (organization_id, set_id, objective_id, key_result_id, kind, body, recognition_visibility, created_by)
         VALUES ($1, $2, $3, $4, 'recognition', $5, $6, $7)
         RETURNING *`,
        [organizationId, setId, objectiveId, keyResultId, body, recognitionVisibility, createdBy]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[postRecognition] insert returned no row');
      return toOkrSupportRequest(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { supportRequest: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_support.recognition_posted',
        aggregateType: 'okr_set',
        aggregateId: setId,
        organizationId,
        actorUserId: createdBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: result.rowVersion,
        // plan §13's distinct notification category, carried in the event
        // payload for the (not-yet-built) notification projection to read.
        payload: { objectiveId, keyResultId, requestId: result.requestId, notificationCategory: 'positive_recognition' },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// raiseSupportRequest (design §8.2)
// ==========================================

export interface RaiseSupportRequestInput {
  setId: string;
  objectiveId: string;
  keyResultId?: string | null;
  organizationId: string;
  body: string;
  /** Required (design §8.2/§16 Open Question #5) — no server-side inference
   * of "the Manager"; the caller (typically the UI defaulting to
   * `set.reviewerUserId`) must pass an explicit value. */
  assignedToUserId: string;
  originCheckInId?: string | null;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function raiseSupportRequest(
  input: RaiseSupportRequestInput
): Promise<AtomicCommandOutcome<OkrSupportRequest>> {
  const {
    setId,
    objectiveId,
    keyResultId = null,
    organizationId,
    body,
    assignedToUserId,
    originCheckInId = null,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  if (!body || !body.trim()) {
    throw new OkrSupportRequestValidationError('body is required', 'BODY_REQUIRED');
  }
  if (!assignedToUserId) {
    throw new OkrSupportRequestValidationError('assignedToUserId is required', 'ASSIGNEE_REQUIRED');
  }

  return executeAtomicCreate<OkrSupportRequest>({
    organizationId,
    applyMutation: async (client) => {
      // RN-G5 DECISION: same as postComment — team-wide-by-design (anyone
      // who can see the Set may raise a support request against it and
      // assign it to whoever they choose).
      void access;

      await assertObjectiveAndKeyResultBelongToSet(client, { setId, objectiveId, keyResultId, organizationId });

      if (originCheckInId) {
        const checkInResult = await client.query<{ checkin_id: string }>(
          `SELECT checkin_id FROM okr_vnext_checkins WHERE checkin_id = $1 AND organization_id = $2 AND set_id = $3`,
          [originCheckInId, organizationId, setId]
        );
        if (!checkInResult.rows[0]) {
          throw new OkrSupportRequestValidationError(
            `Check-in ${originCheckInId} not found under Set ${setId}`,
            'ORIGIN_CHECKIN_NOT_FOUND',
            { originCheckInId }
          );
        }
      }

      const insertResult = await client.query<OkrSupportRequestRow>(
        `INSERT INTO okr_vnext_support_requests
           (organization_id, set_id, objective_id, key_result_id, kind, body, origin_checkin_id,
            status, assigned_to_user_id, created_by)
         VALUES ($1, $2, $3, $4, 'support_request', $5, $6, 'open', $7, $8)
         RETURNING *`,
        [organizationId, setId, objectiveId, keyResultId, body, originCheckInId, assignedToUserId, createdBy]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[raiseSupportRequest] insert returned no row');
      const supportRequest = toOkrSupportRequest(row);

      // Obligation type name taken literally from plan §13's MyWork catalog.
      await createObligation(client, {
        organizationId,
        assigneeUserId: assignedToUserId,
        referenceType: OKR_SUPPORT_REQUEST_REFERENCE_TYPE,
        referenceId: supportRequest.requestId,
        aggregateVersionAtCreation: supportRequest.rowVersion,
        obligationType: RESPOND_TO_SUPPORT_REQUEST_OBLIGATION_TYPE,
        deduplicationKey: `${organizationId}:${OKR_SUPPORT_REQUEST_REFERENCE_TYPE}:${supportRequest.requestId}:${RESPOND_TO_SUPPORT_REQUEST_OBLIGATION_TYPE}`,
      });

      return supportRequest;
    },
    buildEvent: ({ result }) => {
      const afterState = { supportRequest: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_support.request_raised',
        aggregateType: 'okr_set',
        aggregateId: setId,
        organizationId,
        actorUserId: createdBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: result.rowVersion,
        payload: { objectiveId, keyResultId, requestId: result.requestId, assignedToUserId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// acknowledgeSupportRequest (design §8.2)
// ==========================================

export interface AcknowledgeSupportRequestInput {
  requestId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function acknowledgeSupportRequest(
  input: AcknowledgeSupportRequestInput
): Promise<AtomicCommandOutcome<OkrSupportRequest>> {
  const {
    requestId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrSupportRequestRow, OkrSupportRequest>({
    organizationId,
    aggregateId: requestId,
    expectedVersion,
    loadForUpdate: loadSupportRequestForUpdate,
    getCurrentVersion: supportRequestRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertCommandCapability({
        access,
        actorUserId,
        capability: OKR_SUPPORT_CAPABILITIES.acknowledge,
        responsibleUserIds: [currentRow.assigned_to_user_id, currentRow.created_by],
      });

      if (currentRow.kind !== 'support_request' || currentRow.status !== 'open') {
        throw new OkrSupportRequestValidationError(
          `Support request ${requestId} is not open (kind=${currentRow.kind}, status=${currentRow.status})`,
          'INVALID_TRANSITION',
          { requestId, kind: currentRow.kind, status: currentRow.status }
        );
      }
      beforeState = { supportRequest: toOkrSupportRequest(currentRow) };

      const updateResult = await client.query<OkrSupportRequestRow>(
        `UPDATE okr_vnext_support_requests
            SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = now(),
                row_version = $2, updated_at = now()
          WHERE request_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, requestId]
      );
      const row = updateResult.rows[0];
      if (!row) throw new Error(`[acknowledgeSupportRequest] update returned no row for ${requestId}`);
      return toOkrSupportRequest(row);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { supportRequest: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_support.request_acknowledged',
        aggregateType: 'okr_set',
        aggregateId: result.setId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { requestId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// resolveSupportRequest (design §8.2) — no self-approval-denial guard, see
// file header / design §11.
// ==========================================

export interface ResolveSupportRequestInput {
  requestId: string;
  organizationId: string;
  expectedVersion: number;
  resolutionNote: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function resolveSupportRequest(
  input: ResolveSupportRequestInput
): Promise<AtomicCommandOutcome<OkrSupportRequest>> {
  const {
    requestId,
    organizationId,
    expectedVersion,
    resolutionNote,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  if (!resolutionNote || !resolutionNote.trim()) {
    throw new OkrSupportRequestValidationError('resolutionNote is required', 'RESOLUTION_NOTE_REQUIRED');
  }

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrSupportRequestRow, OkrSupportRequest>({
    organizationId,
    aggregateId: requestId,
    expectedVersion,
    loadForUpdate: loadSupportRequestForUpdate,
    getCurrentVersion: supportRequestRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertCommandCapability({
        access,
        actorUserId,
        capability: OKR_SUPPORT_CAPABILITIES.resolve,
        responsibleUserIds: [currentRow.assigned_to_user_id, currentRow.created_by],
      });

      if (currentRow.kind !== 'support_request' || !['open', 'acknowledged'].includes(currentRow.status ?? '')) {
        throw new OkrSupportRequestValidationError(
          `Support request ${requestId} cannot be resolved from its current state (kind=${currentRow.kind}, status=${currentRow.status})`,
          'INVALID_TRANSITION',
          { requestId, kind: currentRow.kind, status: currentRow.status }
        );
      }
      beforeState = { supportRequest: toOkrSupportRequest(currentRow) };

      const updateResult = await client.query<OkrSupportRequestRow>(
        `UPDATE okr_vnext_support_requests
            SET status = 'resolved', resolved_by = $1, resolved_at = now(), resolution_note = $2,
                row_version = $3, updated_at = now()
          WHERE request_id = $4
          RETURNING *`,
        [actorUserId, resolutionNote, nextVersion, requestId]
      );
      const row = updateResult.rows[0];
      if (!row) throw new Error(`[resolveSupportRequest] update returned no row for ${requestId}`);
      const supportRequest = toOkrSupportRequest(row);

      await completeObligation(client, {
        organizationId,
        referenceType: OKR_SUPPORT_REQUEST_REFERENCE_TYPE,
        referenceId: requestId,
        obligationType: RESPOND_TO_SUPPORT_REQUEST_OBLIGATION_TYPE,
        completedViaCommand: 'resolveSupportRequest',
      });

      return supportRequest;
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { supportRequest: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_support.request_resolved',
        aggregateType: 'okr_set',
        aggregateId: result.setId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { requestId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// dismissSupportRequest — design addition, NOT named by any AC (§16 Open
// Question #7), stated explicitly per this program's "state additions,
// never silently add" discipline (OKR-E001 §6.5, OKR-E002 D15). A dismissed
// request is still "responded to" — completes the obligation too.
// ==========================================

export interface DismissSupportRequestInput {
  requestId: string;
  organizationId: string;
  expectedVersion: number;
  dismissedReason: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function dismissSupportRequest(
  input: DismissSupportRequestInput
): Promise<AtomicCommandOutcome<OkrSupportRequest>> {
  const {
    requestId,
    organizationId,
    expectedVersion,
    dismissedReason,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  if (!dismissedReason || !dismissedReason.trim()) {
    throw new OkrSupportRequestValidationError('dismissedReason is required', 'DISMISSED_REASON_REQUIRED');
  }

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrSupportRequestRow, OkrSupportRequest>({
    organizationId,
    aggregateId: requestId,
    expectedVersion,
    loadForUpdate: loadSupportRequestForUpdate,
    getCurrentVersion: supportRequestRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertCommandCapability({
        access,
        actorUserId,
        capability: OKR_SUPPORT_CAPABILITIES.dismiss,
        responsibleUserIds: [currentRow.assigned_to_user_id, currentRow.created_by],
      });

      if (currentRow.kind !== 'support_request' || !['open', 'acknowledged'].includes(currentRow.status ?? '')) {
        throw new OkrSupportRequestValidationError(
          `Support request ${requestId} cannot be dismissed from its current state (kind=${currentRow.kind}, status=${currentRow.status})`,
          'INVALID_TRANSITION',
          { requestId, kind: currentRow.kind, status: currentRow.status }
        );
      }
      beforeState = { supportRequest: toOkrSupportRequest(currentRow) };

      const updateResult = await client.query<OkrSupportRequestRow>(
        `UPDATE okr_vnext_support_requests
            SET status = 'dismissed', dismissed_reason = $1,
                row_version = $2, updated_at = now()
          WHERE request_id = $3
          RETURNING *`,
        [dismissedReason, nextVersion, requestId]
      );
      const row = updateResult.rows[0];
      if (!row) throw new Error(`[dismissSupportRequest] update returned no row for ${requestId}`);
      const supportRequest = toOkrSupportRequest(row);

      await completeObligation(client, {
        organizationId,
        referenceType: OKR_SUPPORT_REQUEST_REFERENCE_TYPE,
        referenceId: requestId,
        obligationType: RESPOND_TO_SUPPORT_REQUEST_OBLIGATION_TYPE,
        completedViaCommand: 'dismissSupportRequest',
      });

      return supportRequest;
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { supportRequest: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_support.request_dismissed',
        aggregateType: 'okr_set',
        aggregateId: result.setId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { requestId },
      } satisfies AtomicEventInput;
    },
  });
}

// Re-export so route/test callers do not need a second import for the
// resource type constant this file's events key off of.
export { OKR_SET_RESOURCE_TYPE };
