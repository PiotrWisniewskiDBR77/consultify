/**
 * Teresa kernel — Intent -> Preview -> Human confirmation -> Commit -> Settle.
 *
 * Implements src/method-core/contracts/teresa.ts literally:
 *  - `propose()` is the ONLY way to obtain a `previewId`; a commit without one
 *    is unrepresentable (TeresaCommitRequest.previewId is required by the type).
 *  - `commit()` additionally refuses when the preview expired, was already
 *    consumed, or carries quality verdict `invalid` — all three are checked
 *    against what is ACTUALLY PERSISTED in `tool_session_events`, never an
 *    in-memory cache.
 *  - Every capability id is checked against TERESA_FORBIDDEN_EFFECTS before
 *    it can produce a preview OR be committed — belt and suspenders around
 *    the same data-level guarantee the contract's own test asserts.
 *  - Settle (accept path only) emits ARTIFACT_UPDATED with actorKind='human'
 *    (the confirming human is the actor) while the payload keeps
 *    `sourceProposalId` pointing at the TERESA_PROPOSAL_CREATED event, whose
 *    own actorKind stays 'teresa' — AI authorship is never erased by a human
 *    accept, per events.ts's MethodActorKind doc comment.
 */
import { v4 as uuidv4 } from 'uuid';

import type {
  TeresaCommitRefusal,
  TeresaCommitRequest,
  TeresaCommitResult,
  TeresaForbiddenEffect,
  TeresaIntent,
  TeresaPreview,
  TeresaProposedChange,
  TeresaQualityCheck,
} from '../../../../src/method-core/contracts/teresa';
import { TERESA_FORBIDDEN_EFFECTS } from '../../../../src/method-core/contracts/teresa';
import {
  assertCapabilityNotForbidden,
  TERESA_CAPABILITY_REGISTRY,
  type TeresaSwotSessionSnapshot,
} from './teresaCapabilities';
import {
  appendEvent,
  findConsumingEvent,
  getEventById,
  withTeresaTransaction,
  type TeresaEventRow,
} from './teresaEventStore';

/** Preview lifetime — long enough for a human to read and decide, short enough that a stale proposal cannot land later. */
const PREVIEW_TTL_MS = 15 * 60 * 1000;

export function isForbiddenEffect(capabilityId: string): boolean {
  return (TERESA_FORBIDDEN_EFFECTS as readonly string[]).includes(capabilityId);
}

interface StoredProposalPayload {
  proposalId: string;
  capabilityId: string;
  previewRef: string;
  qualityVerdict: 'valid' | 'needs_human_review' | 'invalid';
  failedChecks: string[];
  intent: TeresaIntent;
  statements: TeresaPreview['statements'];
  proposedChanges: readonly TeresaProposedChange[];
  createdAt: string;
  expiresAt: string;
}

function parsePayload(row: TeresaEventRow): StoredProposalPayload {
  const raw = row.payload_json;
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as StoredProposalPayload;
}

/**
 * Step 1+2 — Intent -> Preview. Always persists (even a `needs_human_review`
 * or `invalid` preview) because the human must be able to SEE why something
 * did not pass the quality gate; `commit()` is what refuses to act on it.
 */
export async function propose(intent: TeresaIntent, session: TeresaSwotSessionSnapshot): Promise<TeresaPreview> {
  assertCapabilityNotForbidden(intent.capabilityId);
  const entry = TERESA_CAPABILITY_REGISTRY[intent.capabilityId];
  if (!entry) {
    throw new Error(`teresaKernel.propose: unknown capability "${intent.capabilityId}"`);
  }
  if (!entry.handler) {
    throw new Error(
      `teresaKernel.propose: capability "${intent.capabilityId}" has no drafting implementation in this slice`
    );
  }

  const outcome = entry.handler({ intent, session });
  const previewId = uuidv4();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + PREVIEW_TTL_MS);

  const payload: StoredProposalPayload = {
    proposalId: previewId,
    capabilityId: intent.capabilityId,
    previewRef: previewId,
    qualityVerdict: outcome.quality.verdict,
    failedChecks: [...outcome.quality.failedChecks],
    intent,
    statements: outcome.statements,
    proposedChanges: outcome.proposedChanges,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await withTeresaTransaction(async (client) => {
    await appendEvent(client, {
      id: previewId,
      organizationId: session.organizationId,
      toolSessionId: session.sessionId,
      type: 'TERESA_PROPOSAL_CREATED',
      unitId: intent.unitId ?? null,
      level: intent.level ?? null,
      actorKind: 'teresa',
      actorUserId: intent.actorUserId,
      methodPackVersion: session.methodPackVersion,
      payload,
      idempotencyKey: null,
    });
  });

  return {
    previewId,
    intent,
    statements: outcome.statements,
    proposedChanges: outcome.proposedChanges,
    quality: outcome.quality,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export interface TeresaCommitContext {
  organizationId: string;
  toolSessionId: string;
  methodPackVersion: string;
}

/** Step 3+4 — Human confirmation -> Commit -> Settle. */
export async function commit(
  request: TeresaCommitRequest,
  ctx: TeresaCommitContext
): Promise<TeresaCommitResult> {
  return withTeresaTransaction(async (client) => {
    const previewRow = await getEventById(client, request.previewId);
    if (!previewRow || previewRow.event_type !== 'TERESA_PROPOSAL_CREATED') {
      return refusal({ kind: 'preview_not_found' });
    }

    const payload = parsePayload(previewRow);

    if (isForbiddenEffect(payload.capabilityId)) {
      return refusal({ kind: 'forbidden_effect', effect: payload.capabilityId as TeresaForbiddenEffect });
    }

    const now = new Date();
    const expiresAt = new Date(payload.expiresAt);
    if (now.getTime() > expiresAt.getTime()) {
      return refusal({ kind: 'preview_expired', expiredAt: payload.expiresAt });
    }

    const consuming = await findConsumingEvent(client, ctx.toolSessionId, request.previewId);
    if (consuming) {
      if (consuming.idempotency_key && consuming.idempotency_key === request.idempotencyKey) {
        // Idempotent replay of the SAME commit — return the same result, not an error.
        const settleEvents = await client.query(
          `SELECT id FROM tool_session_events
             WHERE tool_session_id = $1
               AND (idempotency_key = $2 OR idempotency_key LIKE $3)
             ORDER BY created_at ASC`,
          [ctx.toolSessionId, consuming.idempotency_key, `${consuming.idempotency_key}:settle:%`]
        );
        return { ok: true, eventIds: settleEvents.rows.map((r: { id: string }) => r.id) };
      }
      return refusal({ kind: 'preview_already_consumed' });
    }

    if (payload.qualityVerdict === 'invalid') {
      return refusal({ kind: 'quality_invalid', failedChecks: payload.failedChecks as TeresaQualityCheck[] });
    }

    if (request.decision === 'reject' || request.decision === 'rethink') {
      const { row } = await appendEvent(client, {
        organizationId: ctx.organizationId,
        toolSessionId: ctx.toolSessionId,
        type: 'TERESA_PROPOSAL_REJECTED',
        unitId: payload.intent.unitId ?? null,
        level: payload.intent.level ?? null,
        actorKind: 'human',
        actorUserId: request.actorUserId,
        methodPackVersion: ctx.methodPackVersion,
        payload: { proposalId: payload.proposalId, capabilityId: payload.capabilityId, previewRef: payload.previewRef, qualityVerdict: payload.qualityVerdict, decision: request.decision },
        supersedes: request.previewId,
        idempotencyKey: request.idempotencyKey,
      });
      return { ok: true, eventIds: [row.id] };
    }

    // accept | accept_with_edits
    const changes =
      request.decision === 'accept_with_edits' && request.editedChanges
        ? request.editedChanges
        : payload.proposedChanges;

    const { row: acceptedRow } = await appendEvent(client, {
      organizationId: ctx.organizationId,
      toolSessionId: ctx.toolSessionId,
      type: 'TERESA_PROPOSAL_ACCEPTED',
      unitId: payload.intent.unitId ?? null,
      level: payload.intent.level ?? null,
      actorKind: 'human',
      actorUserId: request.actorUserId,
      methodPackVersion: ctx.methodPackVersion,
      payload: {
        proposalId: payload.proposalId,
        capabilityId: payload.capabilityId,
        previewRef: payload.previewRef,
        qualityVerdict: payload.qualityVerdict,
        decision: request.decision,
        appliedChanges: changes,
      },
      supersedes: request.previewId,
      idempotencyKey: request.idempotencyKey,
    });

    const eventIds = [acceptedRow.id];
    for (let i = 0; i < changes.length; i += 1) {
      const change = changes[i];
      const { row: artifactRow } = await appendEvent(client, {
        organizationId: ctx.organizationId,
        toolSessionId: ctx.toolSessionId,
        type: 'ARTIFACT_UPDATED',
        unitId: payload.intent.unitId ?? null,
        level: payload.intent.level ?? null,
        // The confirming HUMAN is the actor of the settle — but authorship
        // stays traceable via sourceProposalId -> the 'teresa' create event.
        actorKind: 'human',
        actorUserId: request.actorUserId,
        methodPackVersion: ctx.methodPackVersion,
        payload: {
          target: change.target,
          targetId: change.targetId,
          before: change.before,
          after: change.after,
          teresaAuthored: true,
          sourceProposalId: payload.proposalId,
          sourceCapabilityId: payload.capabilityId,
        },
        supersedes: null,
        idempotencyKey: `${request.idempotencyKey}:settle:${i}`,
      });
      eventIds.push(artifactRow.id);
    }

    return { ok: true, eventIds };
  });
}

function refusal(refusalValue: TeresaCommitRefusal): TeresaCommitResult {
  return { ok: false, refusal: refusalValue };
}
