/**
 * presentationAlertPlayground (Sprint 12)
 *
 * Read/write client for the Webhook Playground self-test surface:
 *
 *   POST /api/presentations/governance/alerts/playground/dispatch
 *   POST /api/presentations/governance/alerts/playground/inbox
 *
 * Mirrors the Api/fetch fallback pattern of the other `presentation*`
 * clients and ALWAYS resolves with a `{ status, data?, error? }` envelope
 * (never throws) so the SuperAdmin tester can render honest forbidden /
 * unavailable banners without try/catch noise.
 *
 * SECURITY: the playground signing secret is held in memory by the
 * caller (the React tester). This module deliberately does not store it
 * anywhere and re-sends it back to the server only when the tester
 * explicitly invokes `verifyPlaygroundInbox`.
 */

import { Api } from '@/services/api';

export type PlaygroundFetchStatus = 'ok' | 'error' | 'forbidden' | 'unavailable';

export type PlaygroundSeverity = 'BLOCKED_P0' | 'BLOCKED_P1';

export interface ClientPlaygroundDispatchPlan {
  eventId: string;
  bodyJson: string;
  payloadPreview: {
    eventId: string;
    toVerdict: string;
    deckId: string;
    generatedAt: string;
  };
  /** 64 hex chars; only present once, never re-fetchable. */
  signingSecret: string;
  headers: Record<string, string>;
  canonicalString: string;
  signature: string;
  generatedAt: string;
}

export interface DispatchPlaygroundInput {
  syntheticVerdict?: PlaygroundSeverity;
  syntheticDeckId?: string;
  /** When omitted, the server generates a fresh secret and returns it ONCE. */
  signingSecret?: string;
}

export interface DispatchPlaygroundResult {
  status: PlaygroundFetchStatus;
  data?: ClientPlaygroundDispatchPlan;
  error?: string;
}

export type ClientPlaygroundInboxStatus =
  | 'verified'
  | 'unsigned'
  | 'invalid_signature'
  | 'missing_headers'
  | 'parse_error'
  | 'mismatched_event';

export interface ClientPlaygroundInboxResult {
  status: ClientPlaygroundInboxStatus;
  verified: boolean;
  reason: string;
  receivedAt?: string;
  payloadPreview?: {
    eventId: string;
    toVerdict: string;
    deckId: string;
  };
}

export interface VerifyPlaygroundInboxInput {
  bodyJson: string;
  signature?: string;
  signatureAlgorithm?: string;
  timestamp?: string;
  eventId?: string;
  signingSecret: string;
}

export interface VerifyPlaygroundInboxResult {
  status: PlaygroundFetchStatus;
  data?: ClientPlaygroundInboxResult;
  error?: string;
}

const VALID_INBOX_STATUSES = new Set<ClientPlaygroundInboxStatus>([
  'verified',
  'unsigned',
  'invalid_signature',
  'missing_headers',
  'parse_error',
  'mismatched_event',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function unwrapData(payload: unknown): unknown {
  if (isRecord(payload) && 'data' in payload) {
    const inner = (payload as { data: unknown }).data;
    if (isRecord(inner) && 'data' in inner) {
      return (inner as { data: unknown }).data;
    }
    return inner;
  }
  return payload;
}

function statusFromHttp(code: number): PlaygroundFetchStatus {
  if (code === 401 || code === 403) return 'forbidden';
  if (code === 404) return 'error';
  if (code >= 500) return 'unavailable';
  return 'error';
}

function statusFromError(err: unknown): PlaygroundFetchStatus {
  if (isRecord(err) && typeof err.status === 'number') return statusFromHttp(err.status);
  return 'unavailable';
}

function safeMessage(err: unknown): string | undefined {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  return undefined;
}

function getApiClient(): {
  post?: (url: string, data: unknown) => Promise<unknown>;
} {
  return Api as unknown as {
    post?: (url: string, data: unknown) => Promise<unknown>;
  };
}

function normalizePlan(raw: unknown): ClientPlaygroundDispatchPlan | undefined {
  if (!isRecord(raw)) return undefined;
  const eventId = asString(raw.eventId);
  const bodyJson = asString(raw.bodyJson);
  const signingSecret = asString(raw.signingSecret);
  const signature = asString(raw.signature);
  const canonicalString = asString(raw.canonicalString);
  const generatedAt = asString(raw.generatedAt);
  if (!eventId || !bodyJson || !signingSecret || !signature) return undefined;

  const headersRaw = isRecord(raw.headers) ? raw.headers : {};
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(headersRaw)) {
    if (typeof v === 'string') headers[k] = v;
  }

  const previewRaw = isRecord(raw.payloadPreview) ? raw.payloadPreview : {};
  return {
    eventId,
    bodyJson,
    payloadPreview: {
      eventId: asString(previewRaw.eventId, eventId),
      toVerdict: asString(previewRaw.toVerdict, 'BLOCKED_P0'),
      deckId: asString(previewRaw.deckId, 'playground_deck'),
      generatedAt: asString(previewRaw.generatedAt, generatedAt),
    },
    signingSecret,
    headers,
    canonicalString,
    signature,
    generatedAt,
  };
}

function normalizeInboxResult(raw: unknown): ClientPlaygroundInboxResult | undefined {
  if (!isRecord(raw)) return undefined;
  const status = asString(raw.status);
  if (!VALID_INBOX_STATUSES.has(status as ClientPlaygroundInboxStatus)) return undefined;
  const previewRaw = isRecord(raw.payloadPreview) ? raw.payloadPreview : null;
  const payloadPreview = previewRaw
    ? {
        eventId: asString(previewRaw.eventId),
        toVerdict: asString(previewRaw.toVerdict),
        deckId: asString(previewRaw.deckId),
      }
    : undefined;
  return {
    status: status as ClientPlaygroundInboxStatus,
    verified: asBool(raw.verified, false),
    reason: asString(raw.reason, ''),
    receivedAt: typeof raw.receivedAt === 'string' ? raw.receivedAt : undefined,
    ...(payloadPreview ? { payloadPreview } : {}),
  };
}

// ============================================================================
// DISPATCH
// ============================================================================

export async function generatePlaygroundDispatch(
  input: DispatchPlaygroundInput = {}
): Promise<DispatchPlaygroundResult> {
  const path = '/presentations/governance/alerts/playground/dispatch';
  const body: Record<string, unknown> = {};
  if (input.syntheticVerdict) body.syntheticVerdict = input.syntheticVerdict;
  if (input.syntheticDeckId) body.syntheticDeckId = input.syntheticDeckId;
  if (typeof input.signingSecret === 'string' && input.signingSecret.length > 0) {
    body.signingSecret = input.signingSecret;
  }
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(path, body);
      const data = unwrapData(res);
      const plan = normalizePlan(data);
      if (!plan) return { status: 'error', error: 'invalid_payload' };
      return { status: 'ok', data: plan };
    } catch (err) {
      return { status: statusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { status: statusFromHttp(res.status), error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    const plan = normalizePlan(data);
    if (!plan) return { status: 'error', error: 'invalid_payload' };
    return { status: 'ok', data: plan };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

// ============================================================================
// INBOX
// ============================================================================

export async function verifyPlaygroundInbox(
  input: VerifyPlaygroundInboxInput
): Promise<VerifyPlaygroundInboxResult> {
  const path = '/presentations/governance/alerts/playground/inbox';
  const body: Record<string, unknown> = {
    bodyJson: input.bodyJson,
    signingSecret: input.signingSecret,
  };
  if (typeof input.signature === 'string') body.signature = input.signature;
  if (typeof input.signatureAlgorithm === 'string') {
    body.signatureAlgorithm = input.signatureAlgorithm;
  }
  if (typeof input.timestamp === 'string') body.timestamp = input.timestamp;
  if (typeof input.eventId === 'string') body.eventId = input.eventId;

  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(path, body);
      const data = unwrapData(res);
      const result = normalizeInboxResult(data);
      if (!result) return { status: 'error', error: 'invalid_payload' };
      return { status: 'ok', data: result };
    } catch (err) {
      return { status: statusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { status: statusFromHttp(res.status), error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    const result = normalizeInboxResult(data);
    if (!result) return { status: 'error', error: 'invalid_payload' };
    return { status: 'ok', data: result };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
