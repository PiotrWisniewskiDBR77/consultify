/**
 * OKR-E006 — Decision seam command layer (OKR-F-019-AC-01).
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §10, ratified by the
 * §-IO Integration Owner rulings block at the top of that document (IO-6
 * approves Open Question #1: build the seam as designed).
 *
 * DEVIATION FROM THE DESIGN DRAFT, stated explicitly (not silent): §10.4
 * imagined `requestDecisionFromSupportRequest` calling through
 * `DecisionController.createDecision`'s own Express handler ("import and
 * call the same function... or a new thin internal wrapper") and flagged
 * that this might not be atomic across two connection pools. Having now
 * read the real `DecisionController.createDecision` in full
 * (server/src/controllers/DecisionController.ts:1141-1487): it is a
 * `static ... = asyncHandler(async (req, res) => {...})` tightly coupled to
 * Express's `req`/`res` (reads `req.can('approve_changes')`, `req.user`,
 * writes the JSON response inline) and runs its own
 * `queryHelpers.withPgTransaction(...)` on the SHARED pool — genuinely not
 * cleanly extractable into a plain callable service function without either
 * (a) faking an Express request/response cycle, which is fragile and does
 * not compose with OKR's own actor model (`req.can('approve_changes')` has
 * no OKR-side equivalent), or (b) refactoring DecisionController itself,
 * which IO-6 explicitly forbids ("anything more invasive stops and
 * reports").
 *
 * This command therefore INSERTs directly into `decisions` on THIS
 * command's own pinned transaction client (the same client
 * `executeAtomicCreate` gives `applyMutation`), using the identical base
 * columns `DecisionController.createDecision`'s own primary INSERT uses
 * (id, organization_id, title, description, type, decision_maker_id,
 * deadline, status, created_by) plus the two IO-6-approved additive columns
 * (source_type, source_id — see the separate
 * `feat(okr-e006,decisions): additive sourceType/sourceId seam` commit to
 * `decision.validators.ts`/`DecisionController.ts`). This makes the
 * Decision-row write and the `okr_vnext_decision_links`/
 * `okr_vnext_support_requests` writes genuinely atomic (ONE transaction, ONE
 * connection) — BETTER than the design draft's worried-about cross-pool gap,
 * which only applies to a caller going through the Express layer. The
 * DecisionController extension itself is still built and still real (a
 * future caller hitting the public HTTP API with sourceType/sourceId also
 * works) — this command just does not depend on it at runtime.
 *
 * Known, disclosed gap from this deviation: `createDecision`'s own
 * side-effects that live OUTSIDE its transaction (the audit-log write via
 * `auditEventsService.log(...)`, the `dispatchProjectCommunicationEvent`
 * notification dispatch) are NOT replicated here — this command creates only
 * the `decisions` row itself, nothing else `createDecision` does downstream
 * of it. Restated in the closure entry, not silently dropped.
 *
 * Migration-932 independence (design §16 Open Question #2, this program's
 * most-repeated failure mode): every column this file reads or writes on
 * `decisions` — id, organization_id, title, description, type,
 * decision_maker_id, deadline, status, created_by, source_type, source_id
 * (write); status, decision_rationale, decided_at (read, in
 * `acknowledgeDecisionResolution`) — is defined in the BASE table
 * (`server/migrations/20260311_origin_tracking.sql`, an 8-digit-date
 * prefix, auto-run at boot). None of them require
 * `932_decision_workflow_canonical.sql` (`decisions.version`/`decided_by`,
 * confirmed by direct grep of `DatabaseInitializer.ts`'s migration-discovery
 * regex `/^(7\d{2}|\d{8})_.*\.sql$/` to NOT be picked up at boot — `932_` is
 * neither `7\d{2}` nor an 8-digit date). This design is therefore safe
 * regardless of whether migration 932 has been promoted to a given
 * environment.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { assertCommandCapability, type CommandAccessContext } from '../platform/commandCapabilityGuard.js';

import { OkrSupportRequestValidationError } from './okrSupportCommands.js';
import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import {
  toOkrDecisionLink,
  toOkrSupportRequest,
  type OkrDecisionLink,
  type OkrDecisionLinkRow,
  type OkrSupportRequest,
  type OkrSupportRequestRow,
} from './okrSupportTypes.js';

// decisionOutcomeService.ts is the SINGLE source of truth for "what counts
// as a terminal Decision outcome" (MW-DEC-001) — imported, never
// re-literalled, per design §16 Open Question #3's own instruction ("cross-
// check against decisionOutcomeService.ts's isTerminalDecisionOutcome
// before implementation, do not assume this design doc's literal string
// list is exhaustive").
import { isTerminalDecisionOutcome } from '../../decisionOutcomeService.js';

// ==========================================
// ERRORS
// ==========================================

export class OkrDecisionNotYetResolvedError extends Error {
  code = 'DECISION_NOT_YET_RESOLVED';
  details: Record<string, unknown>;
  constructor(linkId: string, decisionId: string, currentStatus: string | null) {
    super(`Decision ${decisionId} (link ${linkId}) has not reached a terminal outcome yet (status=${currentStatus ?? 'unknown'})`);
    this.name = 'OkrDecisionNotYetResolvedError';
    this.details = { linkId, decisionId, currentStatus };
  }
}

/** Value written to `decisions.source_type` — matches the string the
 * IO-6-approved `DecisionController.createDecision` extension reads/accepts. */
export const OKR_DECISION_SOURCE_TYPE = 'okr_support_request';

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md).
export const OKR_DECISION_CAPABILITIES = {
  requestFromSupportRequest: 'results.okr.decision.request_from_support_request',
  acknowledgeResolution: 'results.okr.decision.acknowledge_resolution',
} as const;

const OKR_DECISION_LINK_ELIGIBLE_STATUSES: readonly string[] = ['open', 'acknowledged'];

async function loadDecisionLinkForUpdate(
  client: PoolClient,
  linkId: string,
  organizationId: string
): Promise<OkrDecisionLinkRow | undefined> {
  const result = await client.query<OkrDecisionLinkRow>(
    `SELECT * FROM okr_vnext_decision_links WHERE link_id = $1 AND organization_id = $2 FOR UPDATE`,
    [linkId, organizationId]
  );
  return result.rows[0];
}
const decisionLinkRowVersion = (row: OkrDecisionLinkRow) => row.row_version;

// ==========================================
// requestDecisionFromSupportRequest (design §10.4)
// ==========================================

export interface RequestDecisionFromSupportRequestInput {
  requestId: string;
  organizationId: string;
  /** CAS precondition against the support request's own row_version (manual
   * check inside applyMutation — this command is a `create` from the
   * decision-link's own point of view, but a `command` against the parent
   * support request, so it re-implements the same STALE_VERSION shape
   * `executeAtomicCommand` uses rather than nesting a second helper call). */
  expectedVersion: number;
  requestedDecision: string;
  impactOfDelay: string;
  desiredDate?: string | null;
  requestedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export interface RequestDecisionFromSupportRequestResult {
  supportRequest: OkrSupportRequest;
  decisionLink: OkrDecisionLink;
}

export async function requestDecisionFromSupportRequest(
  input: RequestDecisionFromSupportRequestInput
): Promise<AtomicCommandOutcome<RequestDecisionFromSupportRequestResult>> {
  const {
    requestId,
    organizationId,
    expectedVersion,
    requestedDecision,
    impactOfDelay,
    desiredDate = null,
    requestedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  if (!requestedDecision || !requestedDecision.trim()) {
    throw new OkrSupportRequestValidationError('requestedDecision is required', 'REQUESTED_DECISION_REQUIRED');
  }
  if (!impactOfDelay || !impactOfDelay.trim()) {
    throw new OkrSupportRequestValidationError('impactOfDelay is required', 'IMPACT_OF_DELAY_REQUIRED');
  }

  return executeAtomicCreate<RequestDecisionFromSupportRequestResult>({
    organizationId,
    applyMutation: async (client) => {
      const srResult = await client.query<OkrSupportRequestRow>(
        `SELECT * FROM okr_vnext_support_requests WHERE request_id = $1 AND organization_id = $2 FOR UPDATE`,
        [requestId, organizationId]
      );
      const srRow = srResult.rows[0];
      if (!srRow) {
        throw new AtomicWriteAggregateNotFoundError(`Support request ${requestId} not found`);
      }

      assertCommandCapability({
        access,
        actorUserId: requestedBy,
        capability: OKR_DECISION_CAPABILITIES.requestFromSupportRequest,
        responsibleUserIds: [srRow.created_by, srRow.assigned_to_user_id],
      });

      if (srRow.kind !== 'support_request' || !OKR_DECISION_LINK_ELIGIBLE_STATUSES.includes(srRow.status ?? '')) {
        throw new OkrSupportRequestValidationError(
          `Support request ${requestId} cannot request a Decision from its current state (kind=${srRow.kind}, status=${srRow.status})`,
          'INVALID_TRANSITION',
          { requestId, kind: srRow.kind, status: srRow.status }
        );
      }
      if (srRow.decision_link_id) {
        throw new OkrSupportRequestValidationError(
          `Support request ${requestId} already has a Decision requested (link ${srRow.decision_link_id})`,
          'DECISION_ALREADY_REQUESTED',
          { requestId, decisionLinkId: srRow.decision_link_id }
        );
      }
      if (srRow.row_version !== expectedVersion) {
        throw new AtomicWriteConflictError('Support request was modified since it was last read', 'STALE_VERSION', {
          currentVersion: srRow.row_version,
          expectedVersion,
        });
      }

      const decisionId = randomUUID();
      const title = `OKR support request: ${requestedDecision}`.slice(0, 255);

      // Direct INSERT into `decisions` on THIS transaction's own pinned
      // client — see file header for why this does not go through
      // DecisionController.createDecision's Express handler. Columns match
      // that handler's own primary INSERT (base-table columns only, see
      // file header's migration-932-independence note) plus the two IO-6
      // additive columns.
      await client.query(
        `INSERT INTO decisions
           (id, organization_id, title, description, type, decision_maker_id, deadline, status,
            created_by, source_type, source_id)
         VALUES ($1, $2, $3, $4, 'GENERAL', $5, $6, 'pending', $7, $8, $9)`,
        [decisionId, organizationId, title, impactOfDelay, srRow.assigned_to_user_id, desiredDate, requestedBy, OKR_DECISION_SOURCE_TYPE, requestId]
      );

      const linkResult = await client.query<OkrDecisionLinkRow>(
        `INSERT INTO okr_vnext_decision_links
           (organization_id, set_id, support_request_id, objective_id, key_result_id, decision_id,
            requested_decision, impact_of_delay, desired_date, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          organizationId,
          srRow.set_id,
          requestId,
          srRow.objective_id,
          srRow.key_result_id,
          decisionId,
          requestedDecision,
          impactOfDelay,
          desiredDate,
          requestedBy,
        ]
      );
      const linkRow = linkResult.rows[0];
      if (!linkRow) throw new Error('[requestDecisionFromSupportRequest] decision-link insert returned no row');
      const decisionLink = toOkrDecisionLink(linkRow);

      const updatedSrResult = await client.query<OkrSupportRequestRow>(
        `UPDATE okr_vnext_support_requests
            SET decision_link_id = $1, row_version = row_version + 1, updated_at = now()
          WHERE request_id = $2
          RETURNING *`,
        [decisionLink.linkId, requestId]
      );
      const updatedSrRow = updatedSrResult.rows[0];
      if (!updatedSrRow) throw new Error(`[requestDecisionFromSupportRequest] support-request update returned no row for ${requestId}`);
      const supportRequest = toOkrSupportRequest(updatedSrRow);

      return { supportRequest, decisionLink };
    },
    buildEvent: ({ result }) => {
      const afterState = { supportRequest: result.supportRequest, decisionLink: result.decisionLink };
      return {
        schemaVersion: 1,
        eventType: 'okr_support.decision_requested',
        aggregateType: 'okr_set',
        aggregateId: result.supportRequest.setId,
        organizationId,
        actorUserId: requestedBy,
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
        resultingVersion: result.decisionLink.rowVersion,
        payload: { requestId, linkId: result.decisionLink.linkId, decisionId: result.decisionLink.decisionId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// acknowledgeDecisionResolution (design §10.4)
// ==========================================

export interface AcknowledgeDecisionResolutionInput {
  linkId: string;
  organizationId: string;
  expectedVersion: number;
  /** `null` for the scheduled/service-actor trigger (recommendation (b),
   * design §10.4/§16 Open Question #4 — presented, not silently picked; the
   * human-triggered path (a) passes the acknowledging user's id here). */
  actorUserId: string | null;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export interface AcknowledgeDecisionResolutionResult {
  decisionLink: OkrDecisionLink;
  decisionStatus: string | null;
  decisionRationale: string | null;
  decisionDecidedAt: string | null;
}

export async function acknowledgeDecisionResolution(
  input: AcknowledgeDecisionResolutionInput
): Promise<AtomicCommandOutcome<AcknowledgeDecisionResolutionResult>> {
  const {
    linkId,
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

  return executeAtomicCommand<OkrDecisionLinkRow, AcknowledgeDecisionResolutionResult>({
    organizationId,
    aggregateId: linkId,
    expectedVersion,
    loadForUpdate: loadDecisionLinkForUpdate,
    getCurrentVersion: decisionLinkRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // RN-G5: actorUserId may be null (okrDecisionResolutionScanner.ts's
      // scheduled/service-actor trigger, this input type's own documented
      // convention) — same system-wildcard shape as
      // financeProjectionConsumer.ts/okrCycleScheduler.ts.
      assertCommandCapability({
        access,
        actorUserId: actorUserId ?? '',
        capability: OKR_DECISION_CAPABILITIES.acknowledgeResolution,
        responsibleUserIds: [currentRow.requested_by],
      });

      if (currentRow.resolution_acknowledged) {
        throw new OkrSupportRequestValidationError(
          `Decision link ${linkId} resolution was already acknowledged`,
          'ALREADY_ACKNOWLEDGED',
          { linkId }
        );
      }

      const decisionResult = await client.query<{
        status: string | null;
        decision_rationale: string | null;
        decided_at: string | null;
      }>(`SELECT status, decision_rationale, decided_at FROM decisions WHERE id = $1 AND organization_id = $2`, [
        currentRow.decision_id,
        organizationId,
      ]);
      const decisionRow = decisionResult.rows[0];
      if (!decisionRow) {
        throw new OkrSupportRequestValidationError(
          `Decision ${currentRow.decision_id} referenced by link ${linkId} not found`,
          'DECISION_NOT_FOUND',
          { linkId, decisionId: currentRow.decision_id }
        );
      }
      if (!isTerminalDecisionOutcome(decisionRow.status)) {
        throw new OkrDecisionNotYetResolvedError(linkId, currentRow.decision_id, decisionRow.status);
      }

      beforeState = { decisionLink: toOkrDecisionLink(currentRow) };

      const updateResult = await client.query<OkrDecisionLinkRow>(
        `UPDATE okr_vnext_decision_links
            SET resolution_acknowledged = true, resolution_acknowledged_by = $1, resolution_acknowledged_at = now(),
                row_version = $2
          WHERE link_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, linkId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[acknowledgeDecisionResolution] update returned no row for ${linkId}`);

      return {
        decisionLink: toOkrDecisionLink(updatedRow),
        decisionStatus: decisionRow.status,
        decisionRationale: decisionRow.decision_rationale,
        decisionDecidedAt: decisionRow.decided_at,
      };
    },
    buildEvent: ({ result, nextVersion }) => {
      // Design §10.4/§10.5: this event IS the literal "resolution is written
      // back to the OKR timeline as an event" requirement — a snapshot copy
      // of the observed decisions row at acknowledgement time, not a live
      // pointer (no push mechanism exists in this platform today, per
      // EXECUTION_LEDGER.md §3.9's own finding on the missing transactional
      // outbox from the Decisions module's side).
      const afterState = {
        decisionLink: result.decisionLink,
        decisionStatus: result.decisionStatus,
        decisionRationale: result.decisionRationale,
        decisionDecidedAt: result.decisionDecidedAt,
      };
      return {
        schemaVersion: 1,
        eventType: 'okr_support.decision_resolution_acknowledged',
        aggregateType: 'okr_set',
        aggregateId: result.decisionLink.setId,
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
        payload: { linkId, decisionId: result.decisionLink.decisionId, decisionStatus: result.decisionStatus },
      } satisfies AtomicEventInput;
    },
  });
}
