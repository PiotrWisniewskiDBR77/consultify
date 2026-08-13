/**
 * Teresa intent builder — client-side wiring (S4, 2026-08-13).
 *
 * A tiny, deliberately un-clever function: turns a capability id + local
 * context into a `TeresaIntent`, validating against the SAME closed registry
 * `TeresaPreviewPanel`/the tool manifest read from
 * (`src/method-core/teresa/capabilities.ts`) so a capability that is not in
 * the registry — including any of the seven `TERESA_FORBIDDEN_EFFECTS`,
 * which are typed as a DISJOINT union from `TeresaCapabilityId` and so can
 * never satisfy this function's parameter type — is rejected before a
 * request is ever built, not just before it is sent.
 */
import type { TeresaCapabilityId, TeresaIntent } from '@/method-core/contracts';

import { getTeresaCapability, isKnownTeresaCapability } from './capabilities';

export interface TeresaIntentInput {
  readonly capabilityId: TeresaCapabilityId;
  readonly sessionId: string;
  readonly actorUserId: string;
  readonly unitId?: string;
  readonly level?: number;
  readonly questionId?: string;
  readonly utterance?: string;
  readonly invokedBy: 'conversation' | 'local_action';
}

export class TeresaIntentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeresaIntentError';
  }
}

/**
 * Builds a `TeresaIntent`, refusing at the client boundary (before any HTTP
 * call) when the capability is unknown or its declared `requiredContext`
 * (`src/method-core/teresa/capabilities.ts`) is missing from the input —
 * e.g. calling `draft_score_proposal` without a `level` is a client-side
 * error, not a confusing 400 from the server.
 */
export function buildTeresaIntent(input: TeresaIntentInput): TeresaIntent {
  if (!isKnownTeresaCapability(input.capabilityId)) {
    throw new TeresaIntentError(
      `„${input.capabilityId}” nie jest w zamkniętym zbiorze TERESA_CAPABILITIES — Teresa nie ma takiej możliwości.`
    );
  }
  const def = getTeresaCapability(input.capabilityId);
  const missing = def.requiredContext.filter((field) => input[field] === undefined || input[field] === '');
  if (missing.length > 0) {
    throw new TeresaIntentError(
      `„${def.labelPl}” wymaga ${missing.join(', ')} — brak w wywołaniu.`
    );
  }
  if (!input.sessionId) throw new TeresaIntentError('sessionId jest wymagany.');
  if (!input.actorUserId) throw new TeresaIntentError('actorUserId jest wymagany.');

  return {
    capabilityId: input.capabilityId,
    sessionId: input.sessionId,
    unitId: input.unitId,
    level: input.level,
    questionId: input.questionId,
    utterance: input.utterance,
    invokedBy: input.invokedBy,
    actorUserId: input.actorUserId,
  };
}
