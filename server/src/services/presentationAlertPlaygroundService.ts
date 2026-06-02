/**
 * Presentation Alert Playground Service (Sprint 12)
 *
 * Self-contained "loop" that lets a brand-new alert subscriber verify
 * their HMAC verifier code WITHOUT ever touching the real subscription
 * table or the dispatch audit table. The playground:
 *
 *   1. `buildPlaygroundDispatchPlan` — assembles a synthetic transition,
 *      builds the canonical `BLOCKED_P0` / `BLOCKED_P1` payload via the
 *      existing `buildAlertPayload`, and signs it with HMAC-SHA256 using
 *      either the caller's secret or a freshly generated one. The plan
 *      returns EVERYTHING the verifier needs (headers, body bytes, the
 *      canonical signing string, the signature) plus the secret ONCE so
 *      the SuperAdmin UI can both display it and feed it back into the
 *      `verifyInboxRequest` step. No DB writes. No outbound fetch.
 *
 *   2. `verifyInboxRequest` — pure receiver-side verification. Mirrors
 *      what a subscriber's webhook handler must do: re-build the canonical
 *      string from the headers + body bytes, recompute the HMAC, compare
 *      timing-safely. Returns a discriminated `status` so the UI can
 *      render distinct banners for `verified`, `unsigned`, `missing_headers`,
 *      `parse_error`, `invalid_signature`, and `mismatched_event`.
 *
 * CRITICAL: never throw. Every entrypoint returns a typed result so the
 * route layer can map outcomes deterministically and callers (UI + tests)
 * never need a try/catch around the playground surface.
 */

import {
  type AlertSeverity,
  buildAlertPayload,
  buildCanonicalSigningString,
  buildSignedRequestHeaders,
  generateSigningSecret,
  signWebhookBody,
  verifyWebhookSignature,
} from './presentationGovernanceAlertService.js';

// ============================================================================
// TYPES
// ============================================================================

export type PlaygroundSeverity = 'BLOCKED_P0' | 'BLOCKED_P1';

export interface PlaygroundDispatchInput {
  organizationId: string;
  syntheticDeckId?: string;
  syntheticVerdict?: PlaygroundSeverity;
  /** When null/undefined/empty → a fresh 64-hex secret is generated and returned ONCE. */
  signingSecret?: string | null;
}

export interface PlaygroundPayloadPreview {
  eventId: string;
  toVerdict: PlaygroundSeverity;
  deckId: string;
  generatedAt: string;
}

export interface PlaygroundDispatchPlan {
  eventId: string;
  bodyJson: string;
  payloadPreview: PlaygroundPayloadPreview;
  /** 64 hex chars; one-time return — never re-emitted from any other endpoint. */
  signingSecret: string;
  headers: Record<string, string>;
  canonicalString: string;
  /** HMAC-SHA256 hex digest, 64 chars. */
  signature: string;
  generatedAt: string;
}

export interface PlaygroundInboxRequest {
  bodyJson: string;
  signature: string | null;
  signatureAlgorithm: string | null;
  timestamp: string | null;
  eventId: string | null;
  signingSecret: string;
}

export type PlaygroundInboxStatus =
  | 'verified'
  | 'unsigned'
  | 'invalid_signature'
  | 'missing_headers'
  | 'parse_error'
  | 'mismatched_event';

export interface PlaygroundInboxPayloadPreview {
  eventId: string;
  toVerdict: string;
  deckId: string;
}

export interface PlaygroundInboxResult {
  status: PlaygroundInboxStatus;
  verified: boolean;
  reason: string;
  receivedAt: string;
  payloadPreview?: PlaygroundInboxPayloadPreview;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

const VALID_SEVERITIES = new Set<PlaygroundSeverity>(['BLOCKED_P0', 'BLOCKED_P1']);

function normalizeSeverity(value: PlaygroundSeverity | undefined): PlaygroundSeverity {
  if (value && VALID_SEVERITIES.has(value)) return value;
  return 'BLOCKED_P0';
}

function normalizeDeckId(value: string | undefined): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed.slice(0, 128);
  }
  return 'playground_deck';
}

/**
 * Generate a self-describing event id with millisecond timestamp + random
 * tail so two playground runs in the same tick still collide-resistant.
 * Both segments are base36 to keep the id URL/header safe.
 */
function makePlaygroundEventId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e12).toString(36);
  return `playground_${ts}_${rand}`;
}

function safeParseBody(bodyJson: string): { ok: true; payload: unknown } | { ok: false } {
  try {
    return { ok: true, payload: JSON.parse(bodyJson) };
  } catch {
    return { ok: false };
  }
}

function extractInboxPreview(payload: unknown): PlaygroundInboxPayloadPreview | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const obj = payload as Record<string, unknown>;
  const deckId = typeof obj.deckId === 'string' ? obj.deckId : '';
  const toVerdict = typeof obj.toVerdict === 'string' ? obj.toVerdict : '';
  // The body schema does NOT carry an eventId — it lives on the header. We
  // mirror the header value here so the UI can render a single, consistent
  // preview row.
  return { eventId: '', toVerdict, deckId };
}

// ============================================================================
// DISPATCH PLAN
// ============================================================================

/**
 * Build a fully signed playground dispatch plan. The returned object is
 * everything the SuperAdmin UI needs to:
 *
 *   - display the canonical request (headers, body, canonical signing
 *     string, signature) so the operator can copy it into their verifier
 *     code,
 *   - feed every field back into `verifyInboxRequest` to prove the loop
 *     closes,
 *   - reveal the `signingSecret` ONCE when the caller did not supply one.
 *
 * The function never throws — invalid inputs fall back to safe defaults
 * (synthetic deck id `'playground_deck'`, severity `'BLOCKED_P0'`).
 */
export function buildPlaygroundDispatchPlan(
  input: PlaygroundDispatchInput
): PlaygroundDispatchPlan {
  const organizationId = String(input?.organizationId || '').trim() || 'playground_org';
  const toVerdict = normalizeSeverity(input?.syntheticVerdict);
  const deckId = normalizeDeckId(input?.syntheticDeckId);

  const signingSecret =
    typeof input?.signingSecret === 'string' && input.signingSecret.length > 0
      ? input.signingSecret
      : generateSigningSecret();

  const generatedAt = new Date().toISOString();

  const payload = buildAlertPayload({
    deckId,
    deckTitle: 'Playground Synthetic',
    fromVerdict: 'PASS',
    toVerdict: toVerdict as AlertSeverity,
    organizationId,
    generatedAt,
  });
  const bodyJson = JSON.stringify(payload);

  const eventId = makePlaygroundEventId();

  // We pin `nowIso` to `generatedAt` so the canonical string we expose
  // back to the UI matches the timestamp header byte-for-byte. Without
  // this, `buildSignedRequestHeaders` would call `new Date()` again and
  // we'd have to recompute the canonical string from the header.
  const headers = buildSignedRequestHeaders({
    eventId,
    bodyJson,
    secret: signingSecret,
    nowIso: generatedAt,
  });

  const canonicalString = buildCanonicalSigningString({
    eventId,
    timestamp: generatedAt,
    bodyJson,
  });
  const signature = signWebhookBody(signingSecret, canonicalString);

  return {
    eventId,
    bodyJson,
    payloadPreview: { eventId, toVerdict, deckId, generatedAt },
    signingSecret,
    headers: { ...headers } as Record<string, string>,
    canonicalString,
    signature,
    generatedAt,
  };
}

// ============================================================================
// INBOX VERIFICATION
// ============================================================================

/**
 * Receiver-side verification used by the playground inbox endpoint. Pure
 * function — performs no DB or network access. The result encodes failure
 * as a `status` field rather than throwing, so the route layer can return
 * 200 + `{ success: true, data }` regardless of outcome.
 */
export function verifyInboxRequest(input: PlaygroundInboxRequest): PlaygroundInboxResult {
  const receivedAt = new Date().toISOString();

  if (!input || typeof input.signingSecret !== 'string' || input.signingSecret.length === 0) {
    return {
      status: 'unsigned',
      verified: false,
      reason: 'No signing secret provided',
      receivedAt,
    };
  }

  const signature = typeof input.signature === 'string' ? input.signature : '';
  const timestamp = typeof input.timestamp === 'string' ? input.timestamp : '';
  const eventId = typeof input.eventId === 'string' ? input.eventId : '';
  const algorithm = typeof input.signatureAlgorithm === 'string' ? input.signatureAlgorithm : '';

  if (!signature || !timestamp || !eventId) {
    return {
      status: 'missing_headers',
      verified: false,
      reason: 'Missing one of: signature, timestamp, eventId',
      receivedAt,
    };
  }

  if (algorithm && algorithm !== 'HMAC-SHA256') {
    return {
      status: 'missing_headers',
      verified: false,
      reason: 'Unsupported algorithm',
      receivedAt,
    };
  }

  const bodyJson = typeof input.bodyJson === 'string' ? input.bodyJson : '';
  const parsed = safeParseBody(bodyJson);
  if (!parsed.ok) {
    return {
      status: 'parse_error',
      verified: false,
      reason: 'Body is not valid JSON',
      receivedAt,
    };
  }

  const canonical = buildCanonicalSigningString({ eventId, timestamp, bodyJson });
  const ok = verifyWebhookSignature(input.signingSecret, canonical, signature);
  if (!ok) {
    return {
      status: 'invalid_signature',
      verified: false,
      reason: 'HMAC mismatch',
      receivedAt,
    };
  }

  // Header eventId vs body eventId (`payload.deckId` is decoupled from the
  // event id — we use the alert payload's `generatedAt` + the header
  // eventId as the canonical correlation pair). The body schema does not
  // include an `eventId` field, so we ONLY mismatch when the caller has
  // injected one (e.g. via the playground UI's tamper toggle).
  const bodyPreview = extractInboxPreview(parsed.payload);
  const bodyEventId =
    parsed.ok &&
    typeof parsed.payload === 'object' &&
    parsed.payload !== null &&
    typeof (parsed.payload as Record<string, unknown>).eventId === 'string'
      ? String((parsed.payload as Record<string, unknown>).eventId)
      : null;
  if (bodyEventId !== null && bodyEventId !== eventId) {
    return {
      status: 'mismatched_event',
      verified: false,
      reason: 'Header eventId differs from body eventId',
      receivedAt,
      payloadPreview: bodyPreview ? { ...bodyPreview, eventId: bodyEventId } : undefined,
    };
  }

  return {
    status: 'verified',
    verified: true,
    reason: 'Signature OK',
    receivedAt,
    payloadPreview: bodyPreview ? { ...bodyPreview, eventId } : undefined,
  };
}

// ============================================================================
// INTERNAL EXPORTS (test-only)
// ============================================================================

export const __internal = {
  makePlaygroundEventId,
  normalizeSeverity,
  normalizeDeckId,
};
