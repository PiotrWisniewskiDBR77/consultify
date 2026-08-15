/**
 * outputs.ts — the output-approval saga:
 *   PROPOSED -> APPROVED | REJECTED -> MATERIALIZED | MATERIALIZATION_FAILED
 *
 * Ownership: Teresa (or any human meeting member) proposes; only an
 * authorized HUMAN approves/rejects — never Teresa. Materialization is
 * idempotent, keyed on `meeting_outputs.idempotency_key` (deterministic
 * from meeting_id+output_id, computed in repo.ts at proposal time) and
 * mirrored onto the target row's own `source_id` column so a retry can
 * recognize a partially-completed materialization instead of duplicating
 * work — see materializeOutput() below for the exact recovery sequence.
 */

import type { Pool } from 'pg';

import { resolvePgPool, withPgTransaction } from '../../utils/pgTransaction.js';
import { writeAuditEvent } from './auditLog.js';
import {
  ConflictError,
  ForbiddenError,
  IllegalTransitionError,
  MeetingNotFoundError,
  ValidationError,
} from './errors.js';
import type { OutputTargetMaterializer } from './outputsMaterializer.js';
import {
  getOutputByIdempotencyKeyRow,
  getOutputRow,
  getParticipantRoleRow,
  insertOutputRow,
  markOutputFailedFromMaterializingRow,
  markOutputFailedRow,
  markOutputMaterializedFromMaterializingRow,
  markOutputMaterializedRow,
  markOutputMaterializingRow,
  setOutputReviewedRow,
} from './repo.js';
import type { MeetingOutputRecord, NoteAuthorKind, OutputKind } from './types.js';

const PROPOSAL_ROLES = ['owner', 'facilitator', 'participant', 'teresa'] as const;
const REVIEW_ROLES = ['owner', 'facilitator', 'participant'] as const;
const MATERIALIZE_ROLES = ['owner', 'facilitator', 'participant', 'teresa'] as const;
// "wymagająca uprawnionego człowieka (te same role co approve)" — reconcile
// is a human judgment call about a saga stuck mid-flight, never something
// Teresa triggers, so this is deliberately the SAME set as REVIEW_ROLES
// (approve/reject), not MATERIALIZE_ROLES (which includes 'teresa').
const RECONCILE_ROLES = REVIEW_ROLES;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertSameProposal(
  existing: MeetingOutputRecord,
  input: {
    outputKind: OutputKind;
    payload: Record<string, unknown>;
    sourceNoteEntryId?: string | null;
  }
): void {
  const same =
    existing.outputKind === input.outputKind &&
    (existing.sourceNoteEntryId || null) === (input.sourceNoteEntryId || null) &&
    canonicalJson(existing.proposedPayload) === canonicalJson(input.payload);
  if (!same) {
    throw new ConflictError(
      'Idempotency-Key was already used for a different Meeting output proposal.'
    );
  }
}

function validatePayload(outputKind: OutputKind, payload: Record<string, unknown>): void {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!title) {
    throw new ValidationError(
      `proposeOutput: payload.title is required for output kind '${outputKind}'.`
    );
  }
  if (outputKind === 'decision') {
    const decisionMakerId =
      typeof payload.decisionMakerId === 'string' ? payload.decisionMakerId.trim() : '';
    if (!decisionMakerId) {
      throw new ValidationError(
        `proposeOutput: payload.decisionMakerId is required for output kind 'decision'.`
      );
    }
  }
}

export async function proposeOutput(
  input: {
    organizationId: string;
    meetingId: string;
    actorUserId: string;
    actorKind: NoteAuthorKind;
    outputKind: OutputKind;
    payload: Record<string, unknown>;
    sourceNoteEntryId?: string | null;
    /** Client request key. HTTP requires it; internal callers may omit it. */
    requestIdempotencyKey?: string;
  },
  pool?: Pool
): Promise<MeetingOutputRecord> {
  validatePayload(input.outputKind, input.payload);
  return withPgTransaction(async (client) => {
    const role = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    if (!role || !PROPOSAL_ROLES.includes(role as (typeof PROPOSAL_ROLES)[number])) {
      throw new ForbiddenError(
        `proposeOutput: role '${role ?? 'none'}' may not propose outputs (allowed: ${PROPOSAL_ROLES.join(', ')}).`
      );
    }
    const idempotencyKey = input.requestIdempotencyKey
      ? `meeting-output:${input.organizationId}:${input.meetingId}:${input.requestIdempotencyKey}`
      : undefined;
    if (idempotencyKey) {
      const existing = await getOutputByIdempotencyKeyRow(
        client,
        input.organizationId,
        input.meetingId,
        idempotencyKey
      );
      if (existing) {
        assertSameProposal(existing, input);
        return existing;
      }
    }
    const created = await insertOutputRow(client, {
      meetingId: input.meetingId,
      organizationId: input.organizationId,
      sourceNoteEntryId: input.sourceNoteEntryId || null,
      outputKind: input.outputKind,
      proposedPayload: input.payload,
      proposedBy: input.actorUserId,
      proposedByKind: input.actorKind,
      idempotencyKey,
    });
    if (!created) {
      // A concurrent request won the unique-key race. Re-read and apply the
      // same-payload contract instead of leaking a database error.
      const winner = idempotencyKey
        ? await getOutputByIdempotencyKeyRow(
            client,
            input.organizationId,
            input.meetingId,
            idempotencyKey
          )
        : null;
      if (!winner) throw new ConflictError('Meeting output proposal lost an idempotency race.');
      assertSameProposal(winner, input);
      return winner;
    }
    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      actorType: input.actorKind === 'system' ? 'SYSTEM' : 'USER',
      action: 'MEETING_OUTPUT_PROPOSED',
      resourceType: 'meeting_output',
      resourceId: created.id,
      organizationId: input.organizationId,
      metadata: { meetingId: input.meetingId, outputKind: input.outputKind },
    });
    return created;
  }, pool);
}

async function reviewOutput(
  input: {
    organizationId: string;
    meetingId: string;
    outputId: string;
    actorUserId: string;
    reason?: string;
  },
  next: 'APPROVED' | 'REJECTED',
  pool?: Pool
): Promise<MeetingOutputRecord> {
  return withPgTransaction(async (client) => {
    const output = await getOutputRow(
      client,
      input.organizationId,
      input.meetingId,
      input.outputId
    );
    if (!output) throw new MeetingNotFoundError('Meeting output not found');

    const role = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    // "Teresa nie zatwierdza outputów w imieniu człowieka" — the system role
    // is excluded from REVIEW_ROLES on purpose; only a real member reviews.
    if (!role || !REVIEW_ROLES.includes(role as (typeof REVIEW_ROLES)[number])) {
      throw new ForbiddenError(
        `${next === 'APPROVED' ? 'approveOutput' : 'rejectOutput'}: role '${role ?? 'none'}' may not review outputs (allowed: ${REVIEW_ROLES.join(', ')}).`
      );
    }
    if (output.status !== 'PROPOSED') {
      throw new IllegalTransitionError(
        `Cannot ${next === 'APPROVED' ? 'approve' : 'reject'} output ${output.id}: status is ${output.status}, expected PROPOSED.`
      );
    }

    const updated = await setOutputReviewedRow(client, output.id, next, input.actorUserId);
    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: next === 'APPROVED' ? 'MEETING_OUTPUT_APPROVED' : 'MEETING_OUTPUT_REJECTED',
      resourceType: 'meeting_output',
      resourceId: output.id,
      organizationId: input.organizationId,
      metadata: { meetingId: input.meetingId, reason: input.reason },
    });
    return updated;
  }, pool);
}

export async function approveOutput(
  input: { organizationId: string; meetingId: string; outputId: string; actorUserId: string },
  pool?: Pool
): Promise<MeetingOutputRecord> {
  return reviewOutput(input, 'APPROVED', pool);
}

export async function rejectOutput(
  input: {
    organizationId: string;
    meetingId: string;
    outputId: string;
    actorUserId: string;
    reason?: string;
  },
  pool?: Pool
): Promise<MeetingOutputRecord> {
  return reviewOutput(input, 'REJECTED', pool);
}

/**
 * Materializes an APPROVED output into its canonical target (task/decision).
 *
 * SAGA ORDER (mirrors the spec exactly):
 *   1. Load + authorize.
 *   2. Idempotent no-op if already MATERIALIZED.
 *   3. ATOMIC CLAIM (DEFEKT 2 fix — see markOutputMaterializingRow in
 *      repo.ts): flip APPROVED|MATERIALIZATION_FAILED -> MATERIALIZING with
 *      a single conditional UPDATE. Only one concurrent caller can win this;
 *      everyone else gets a clear, typed outcome instead of racing past the
 *      recovery lookup below (see the "lost the claim" branch).
 *   4. RECOVERY LOOKUP, before creating anything — a prior attempt may have
 *      created the target row but died before writing canonical_id back
 *      onto this meeting_outputs row (network blip, process restart, etc).
 *      We search the target table by (organizationId, idempotency_key) via
 *      the materializer, NOT by trusting output.canonicalId (which is
 *      exactly the field that may be stale/null after a partial failure).
 *      Now that step 3 guarantees exclusivity, this lookup is only ever
 *      racing against the CALLER'S OWN prior attempt, never a concurrent one.
 *   5. If nothing recoverable: call the target service. A thrown error here
 *      is an EXPECTED business outcome (not swallowed, not silently
 *      "completed") — persist MATERIALIZATION_FAILED + failure_reason,
 *      audit it, and return the (failed) record. This function does not
 *      throw for this case; the caller reads `.status`.
 *   6. Read back the canonical id, then atomically (single pg transaction)
 *      mark MATERIALIZED + write the audit row together.
 *
 * If step 6 itself fails after step 5 succeeded (target created, but this
 * confirmation write throws), the error propagates un-caught — we never
 * claim success we can't prove, and we never claim a rollback that didn't
 * happen. The target row keeps existing with source_id = idempotency_key;
 * the row is left in MATERIALIZING (not MATERIALIZED, not
 * MATERIALIZATION_FAILED) — the NEXT call still passes step 3's WHERE
 * clause is false for a bare retry (MATERIALIZING isn't in
 * ('APPROVED','MATERIALIZATION_FAILED')), which is intentional: a row stuck
 * mid-saga after a step-6 crash needs an operator/retry path that explicitly
 * clears MATERIALIZING, not a silent auto-retry that could race the
 * just-crashed writer's own not-yet-visible effects. This mirrors the
 * pre-existing "never claim a rollback that didn't happen" contract; closing
 * that stuck-MATERIALIZING gap further is a follow-up, not this defect.
 */
export async function materializeOutput(
  input: {
    organizationId: string;
    meetingId: string;
    outputId: string;
    actorUserId: string;
    requestIdempotencyKey?: string;
  },
  materializer: OutputTargetMaterializer,
  pool?: Pool
): Promise<MeetingOutputRecord> {
  const p = await resolvePgPool(pool);

  const output = await getOutputRow(p, input.organizationId, input.meetingId, input.outputId);
  if (!output) throw new MeetingNotFoundError('Meeting output not found');
  if (input.requestIdempotencyKey && input.requestIdempotencyKey !== output.idempotencyKey) {
    throw new ConflictError('Idempotency-Key does not match this Meeting output.');
  }

  const role = await getParticipantRoleRow(
    p,
    input.organizationId,
    input.meetingId,
    input.actorUserId
  );
  if (!role || !MATERIALIZE_ROLES.includes(role as (typeof MATERIALIZE_ROLES)[number])) {
    throw new ForbiddenError(
      `materializeOutput: role '${role ?? 'none'}' may not materialize outputs (allowed: ${MATERIALIZE_ROLES.join(', ')}).`
    );
  }

  if (output.status === 'MATERIALIZED') {
    return output; // idempotent no-op — never re-create, never re-report failure.
  }
  if (output.status !== 'APPROVED' && output.status !== 'MATERIALIZATION_FAILED') {
    throw new IllegalTransitionError(
      `Cannot materialize output ${output.id}: status is ${output.status}; must be APPROVED (or retry from MATERIALIZATION_FAILED).`
    );
  }

  // DEFEKT 2: claim exclusivity before doing anything observable. A lost
  // claim means another concurrent call is (or already finished) doing this
  // work — re-read and report a clear outcome rather than falling through to
  // the recovery lookup + create path, which is now only safe for the winner.
  const claimed = await markOutputMaterializingRow(p, output.id);
  if (!claimed) {
    const latest = await getOutputRow(p, input.organizationId, input.meetingId, input.outputId);
    if (latest?.status === 'MATERIALIZED') {
      return latest; // the other racer already finished — idempotent success, not a duplicate.
    }
    throw new ConflictError(
      `materializeOutput: lost the race to materialize output ${output.id} — another concurrent request is already handling it (status=${latest?.status ?? 'unknown'}).`
    );
  }

  const existingTarget =
    output.outputKind === 'task'
      ? await materializer.findTaskBySource(input.organizationId, output.idempotencyKey)
      : await materializer.findDecisionBySource(input.organizationId, output.idempotencyKey);

  let canonicalId: string;
  let recovered = false;

  if (existingTarget) {
    canonicalId = existingTarget.id;
    recovered = true;
  } else {
    try {
      const payload = output.proposedPayload;
      const title = String(payload.title || '');
      const description = typeof payload.description === 'string' ? payload.description : undefined;
      const created =
        output.outputKind === 'task'
          ? await materializer.createTask({
              organizationId: input.organizationId,
              title,
              description,
              sourceId: output.idempotencyKey,
            })
          : await materializer.createDecision({
              organizationId: input.organizationId,
              title,
              description,
              decisionMakerId: String(payload.decisionMakerId || ''),
              sourceId: output.idempotencyKey,
            });
      canonicalId = created.id;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return withPgTransaction(async (client) => {
        const failed = await markOutputFailedRow(client, output.id, reason);
        await writeAuditEvent(client, {
          actorId: input.actorUserId,
          action: 'MEETING_OUTPUT_MATERIALIZATION_FAILED',
          resourceType: 'meeting_output',
          resourceId: output.id,
          organizationId: input.organizationId,
          metadata: { meetingId: input.meetingId, reason },
        });
        return failed;
      }, pool);
    }
  }

  return withPgTransaction(async (client) => {
    const materialized = await markOutputMaterializedRow(client, output.id, canonicalId);
    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: 'MEETING_OUTPUT_MATERIALIZED',
      resourceType: 'meeting_output',
      resourceId: output.id,
      organizationId: input.organizationId,
      metadata: { meetingId: input.meetingId, canonicalId, recovered },
    });
    return materialized;
  }, pool);
}

/**
 * reconcileMaterializingOutput — DEFEKT 2 fix: the only way out of a stuck
 * MATERIALIZING output. Before this existed, a row that reached MATERIALIZING
 * (see markOutputMaterializingRow's atomic claim, above) and then never got
 * confirmed one way or the other — process died between step 3 and step 6 of
 * materializeOutput's saga, before or after the target was actually created —
 * had NO path forward: materializeOutput()'s own claim step deliberately only
 * accepts APPROVED or MATERIALIZATION_FAILED (never MATERIALIZING — widening
 * that set would reopen the exact race commit e51e57a4be closed), so a bare
 * retry always threw ConflictError forever. closeMeeting() also silently
 * omitted these rows from its report, so a meeting could close looking
 * "clean" with a permanently wedged output.
 *
 * This is a deliberately SEPARATE, explicit operation — gated to the same
 * human roles as approve/reject (never Teresa, since unwedging a stuck saga
 * is a judgment call about system state, not a routine step) — rather than
 * any change to the materialize claim itself.
 *
 * SEQUENCE:
 *   1. Load + authorize.
 *   2. Refuse anything that is not currently MATERIALIZING — this is not a
 *      generic "re-check" endpoint, it targets exactly the stuck state.
 *   3. Ask the materializer whether the target (task/decision) actually got
 *      created — the SAME findTaskBySource/findDecisionBySource lookup
 *      materializeOutput's own recovery path uses, keyed on idempotency_key
 *      (never on canonical_id, which is exactly the field a partial failure
 *      may have left null).
 *   4a. Found -> atomically flip MATERIALIZING -> MATERIALIZED with the
 *       discovered canonical_id.
 *   4b. Not found -> atomically flip MATERIALIZING -> MATERIALIZATION_FAILED
 *       with an explanatory reason, so the row re-enters materializeOutput's
 *       existing APPROVED|MATERIALIZATION_FAILED retry path — reconcile
 *       never leaves a still-recoverable output permanently unreachable.
 * Both finish-writes are guarded WHERE status='MATERIALIZING' (repo.ts) so a
 * concurrent second reconcile attempt on the same row loses cleanly (re-reads
 * and reports the now-resolved status, or throws ConflictError) instead of
 * double-applying — same atomic-claim mechanism as the materialize saga
 * itself, just for the other end of it. Both branches write their audit
 * event on the SAME pinned transaction client as the status write.
 */
export async function reconcileMaterializingOutput(
  input: { organizationId: string; meetingId: string; outputId: string; actorUserId: string },
  materializer: OutputTargetMaterializer,
  pool?: Pool
): Promise<MeetingOutputRecord> {
  const p = await resolvePgPool(pool);

  const output = await getOutputRow(p, input.organizationId, input.meetingId, input.outputId);
  if (!output) throw new MeetingNotFoundError('Meeting output not found');

  const role = await getParticipantRoleRow(
    p,
    input.organizationId,
    input.meetingId,
    input.actorUserId
  );
  if (!role || !RECONCILE_ROLES.includes(role as (typeof RECONCILE_ROLES)[number])) {
    throw new ForbiddenError(
      `reconcileMaterializingOutput: role '${role ?? 'none'}' may not reconcile outputs (allowed: ${RECONCILE_ROLES.join(', ')}).`
    );
  }

  if (output.status !== 'MATERIALIZING') {
    throw new IllegalTransitionError(
      `Cannot reconcile output ${output.id}: status is ${output.status}; reconcile only applies to a stuck MATERIALIZING output.`
    );
  }

  const existingTarget =
    output.outputKind === 'task'
      ? await materializer.findTaskBySource(input.organizationId, output.idempotencyKey)
      : await materializer.findDecisionBySource(input.organizationId, output.idempotencyKey);

  if (existingTarget) {
    return withPgTransaction(async (client) => {
      const resolved = await markOutputMaterializedFromMaterializingRow(
        client,
        output.id,
        existingTarget.id
      );
      if (!resolved) {
        const latest = await getOutputRow(
          client,
          input.organizationId,
          input.meetingId,
          input.outputId
        );
        if (latest?.status === 'MATERIALIZED') return latest; // someone else already reconciled — idempotent, not a duplicate.
        throw new ConflictError(
          `reconcileMaterializingOutput: lost the race reconciling output ${output.id} — status is now ${latest?.status ?? 'unknown'}.`
        );
      }
      await writeAuditEvent(client, {
        actorId: input.actorUserId,
        action: 'MEETING_OUTPUT_RECONCILED_MATERIALIZED',
        resourceType: 'meeting_output',
        resourceId: output.id,
        organizationId: input.organizationId,
        metadata: { meetingId: input.meetingId, canonicalId: existingTarget.id },
      });
      return resolved;
    }, pool);
  }

  const reason = `Reconciled from stuck MATERIALIZING: no ${output.outputKind} found for idempotency_key ${output.idempotencyKey} — the target was never created (or its own create call failed and the saga died before recording that). Safe to retry via materializeOutput.`;
  return withPgTransaction(async (client) => {
    const resolved = await markOutputFailedFromMaterializingRow(client, output.id, reason);
    if (!resolved) {
      const latest = await getOutputRow(
        client,
        input.organizationId,
        input.meetingId,
        input.outputId
      );
      if (latest?.status === 'MATERIALIZATION_FAILED' || latest?.status === 'MATERIALIZED')
        return latest; // already reconciled by someone else.
      throw new ConflictError(
        `reconcileMaterializingOutput: lost the race reconciling output ${output.id} — status is now ${latest?.status ?? 'unknown'}.`
      );
    }
    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: 'MEETING_OUTPUT_RECONCILED_FAILED',
      resourceType: 'meeting_output',
      resourceId: output.id,
      organizationId: input.organizationId,
      metadata: { meetingId: input.meetingId, reason },
    });
    return resolved;
  }, pool);
}
