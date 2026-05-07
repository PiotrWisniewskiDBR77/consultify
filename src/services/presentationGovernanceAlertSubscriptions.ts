/**
 * presentationGovernanceAlertSubscriptions
 *
 * Read/write client for the per-org Governance Alert subscription surface.
 * Wraps the Sprint 8 endpoints (list/create/delete) and the Sprint 11
 * subscriber-onboarding endpoints (rotate-secret, test-delivery):
 *
 *   GET    /api/presentations/governance/alert-subscriptions
 *   POST   /api/presentations/governance/alert-subscriptions
 *   DELETE /api/presentations/governance/alert-subscriptions/:id
 *   POST   /api/presentations/governance/alert-subscriptions/:id/rotate-secret
 *   POST   /api/presentations/governance/alert-subscriptions/:id/test-delivery
 *
 * Mirrors the Api/fetch fallback pattern of the other `presentation*` clients
 * and ALWAYS resolves with a `{ status, ... }` envelope (never throws) so
 * the SuperAdmin view can render honest forbidden / unavailable / not_found
 * banners.
 *
 * SECURITY: the `rotate-secret` server endpoint is the ONLY place a raw
 * signing secret leaves the database. List responses NEVER echo the secret
 * — only the server-redacted target. The client therefore deliberately does
 * not store the secret anywhere; the view shows it once and discards.
 */

import { Api } from '@/services/api';

export type AlertChannel = 'webhook' | 'email' | 'slack';
export type AlertSeverity = 'BLOCKED_P0' | 'BLOCKED_P1';

export interface ClientSubscription {
  id: string;
  channel: AlertChannel;
  targetRedacted: string;
  minSeverity: AlertSeverity;
  active: boolean;
  signingSecretRotatedAt: string | null;
  lastDispatchAt: string | null;
  lastDispatchStatus: string | null;
  createdAt: string;
}

export type SubscriptionFetchStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'unavailable'
  | 'conflict';

export interface ListSubscriptionsResult {
  status: SubscriptionFetchStatus;
  subscriptions: ClientSubscription[];
  warnings?: string[];
  error?: string;
}

export interface CreateSubscriptionInput {
  channel: AlertChannel;
  target: string;
  minSeverity: AlertSeverity;
}

export interface CreateSubscriptionResult {
  status: SubscriptionFetchStatus;
  subscription?: ClientSubscription;
  error?: string;
}

export interface DeleteSubscriptionResult {
  status: SubscriptionFetchStatus;
  error?: string;
}

export interface RotateSecretClientSubscription {
  id: string;
  channel: AlertChannel;
  targetRedacted: string;
  minSeverity: AlertSeverity;
}

export interface RotateSecretResult {
  status: SubscriptionFetchStatus;
  subscription?: RotateSecretClientSubscription;
  /** 64 hex chars; only present once, never re-fetchable. */
  oneTimeSecret?: string;
  error?: string;
}

export type TestDeliveryStatus =
  | 'ok'
  | 'not_found'
  | 'unsigned'
  | 'fetch_unavailable'
  | 'http_error'
  | 'network_error'
  | 'inactive';

export interface TestDeliveryPayloadPreview {
  eventId: string;
  toVerdict: AlertSeverity;
  deckId: string;
  generatedAt: string;
}

export interface TestDeliveryResult {
  status: TestDeliveryStatus;
  attempted: boolean;
  signed: boolean;
  httpStatus?: number;
  errorCategory?: string;
  signaturePreview?: string;
  payloadPreview?: TestDeliveryPayloadPreview;
  durationMs?: number;
}

export interface TestDeliveryClientResult {
  status: 'ok' | 'error' | 'forbidden' | 'not_found' | 'unavailable';
  data?: TestDeliveryResult;
  error?: string;
}

const VALID_CHANNELS = new Set<AlertChannel>(['webhook', 'email', 'slack']);
const VALID_SEVERITIES = new Set<AlertSeverity>(['BLOCKED_P0', 'BLOCKED_P1']);
const VALID_TEST_STATUSES = new Set<TestDeliveryStatus>([
  'ok',
  'not_found',
  'unsigned',
  'fetch_unavailable',
  'http_error',
  'network_error',
  'inactive',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true' || value === 'TRUE' || value === 't')
    return true;
  if (value === 0 || value === '0' || value === 'false' || value === 'FALSE' || value === 'f')
    return false;
  return fallback;
}

function asChannel(value: unknown): AlertChannel {
  const lc = String(value || '').toLowerCase();
  return VALID_CHANNELS.has(lc as AlertChannel) ? (lc as AlertChannel) : 'webhook';
}

function asSeverity(value: unknown): AlertSeverity {
  const s = String(value || '');
  return VALID_SEVERITIES.has(s as AlertSeverity) ? (s as AlertSeverity) : 'BLOCKED_P1';
}

function normalizeSubscription(raw: unknown): ClientSubscription | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    channel: asChannel(raw.channel),
    targetRedacted: asString(raw.targetRedacted, '***'),
    minSeverity: asSeverity(raw.minSeverity),
    active: asBool(raw.active, true),
    signingSecretRotatedAt: asStringOrNull(raw.signingSecretRotatedAt),
    lastDispatchAt: asStringOrNull(raw.lastDispatchAt),
    lastDispatchStatus: asStringOrNull(raw.lastDispatchStatus),
    createdAt: asString(raw.createdAt, ''),
  };
}

function normalizeRotateSubscription(raw: unknown): RotateSecretClientSubscription | undefined {
  if (!isRecord(raw)) return undefined;
  const id = asString(raw.id);
  if (!id) return undefined;
  return {
    id,
    channel: asChannel(raw.channel),
    targetRedacted: asString(raw.targetRedacted, '***'),
    minSeverity: asSeverity(raw.minSeverity),
  };
}

function normalizeTestDeliveryResult(raw: unknown): TestDeliveryResult | undefined {
  if (!isRecord(raw)) return undefined;
  const status = String(raw.status || '');
  if (!VALID_TEST_STATUSES.has(status as TestDeliveryStatus)) return undefined;
  const payloadPreviewRaw = isRecord(raw.payloadPreview) ? raw.payloadPreview : null;
  const payloadPreview: TestDeliveryPayloadPreview | undefined = payloadPreviewRaw
    ? {
        eventId: asString(payloadPreviewRaw.eventId, ''),
        toVerdict: asSeverity(payloadPreviewRaw.toVerdict),
        deckId: asString(payloadPreviewRaw.deckId, ''),
        generatedAt: asString(payloadPreviewRaw.generatedAt, ''),
      }
    : undefined;
  return {
    status: status as TestDeliveryStatus,
    attempted: asBool(raw.attempted, false),
    signed: asBool(raw.signed, false),
    httpStatus: asNumber(raw.httpStatus),
    errorCategory: typeof raw.errorCategory === 'string' ? raw.errorCategory : undefined,
    signaturePreview: typeof raw.signaturePreview === 'string' ? raw.signaturePreview : undefined,
    payloadPreview,
    durationMs: asNumber(raw.durationMs),
  };
}

function statusFromHttp(code: number): SubscriptionFetchStatus {
  if (code === 401) return 'error';
  if (code === 403) return 'forbidden';
  if (code === 404) return 'not_found';
  if (code === 409) return 'conflict';
  return 'error';
}

function statusFromError(err: unknown): SubscriptionFetchStatus {
  if (isRecord(err) && typeof err.status === 'number') return statusFromHttp(err.status);
  return 'unavailable';
}

function safeMessage(err: unknown): string | undefined {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  return undefined;
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

function getApiClient(): {
  get?: (url: string) => Promise<unknown>;
  post?: (url: string, data: unknown) => Promise<unknown>;
  delete?: (url: string) => Promise<unknown>;
} {
  return Api as unknown as {
    get?: (url: string) => Promise<unknown>;
    post?: (url: string, data: unknown) => Promise<unknown>;
    delete?: (url: string) => Promise<unknown>;
  };
}

// ============================================================================
// LIST
// ============================================================================

export async function listAlertSubscriptions(): Promise<ListSubscriptionsResult> {
  const path = '/presentations/governance/alert-subscriptions';
  const api = getApiClient();

  if (typeof api.get === 'function') {
    try {
      const res = await api.get(path);
      const data = unwrapData(res);
      if (!isRecord(data)) {
        return { status: 'error', subscriptions: [], error: 'invalid_payload' };
      }
      const rawSubs = Array.isArray(data.subscriptions) ? data.subscriptions : [];
      const subscriptions = rawSubs
        .map(normalizeSubscription)
        .filter((s): s is ClientSubscription => s !== null);
      const warnings = Array.isArray(data.warnings)
        ? data.warnings.filter((w): w is string => typeof w === 'string')
        : undefined;
      return {
        status: 'ok',
        subscriptions,
        ...(warnings && warnings.length > 0 ? { warnings } : {}),
      };
    } catch (err) {
      return { status: statusFromError(err), subscriptions: [], error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      return {
        status: statusFromHttp(res.status),
        subscriptions: [],
        error: `http_${res.status}`,
      };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) return { status: 'error', subscriptions: [], error: 'invalid_payload' };
    const rawSubs = Array.isArray(data.subscriptions) ? data.subscriptions : [];
    const subscriptions = rawSubs
      .map(normalizeSubscription)
      .filter((s): s is ClientSubscription => s !== null);
    return { status: 'ok', subscriptions };
  } catch {
    return { status: 'unavailable', subscriptions: [], error: 'network_error' };
  }
}

// ============================================================================
// CREATE
// ============================================================================

export async function createAlertSubscription(
  input: CreateSubscriptionInput
): Promise<CreateSubscriptionResult> {
  const path = '/presentations/governance/alert-subscriptions';
  const body = {
    channel: input.channel,
    target: input.target,
    minSeverity: input.minSeverity,
  };
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(path, body);
      const data = unwrapData(res);
      if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
      const subscription = normalizeSubscription(data.subscription);
      return { status: 'ok', ...(subscription ? { subscription } : {}) };
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
    if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
    const subscription = normalizeSubscription(data.subscription);
    return { status: 'ok', ...(subscription ? { subscription } : {}) };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteAlertSubscription(id: string): Promise<DeleteSubscriptionResult> {
  const safeId = encodeURIComponent(String(id || '').trim());
  if (!safeId) return { status: 'error', error: 'id_required' };
  const path = `/presentations/governance/alert-subscriptions/${safeId}`;
  const api = getApiClient();

  if (typeof api.delete === 'function') {
    try {
      await api.delete(path);
      return { status: 'ok' };
    } catch (err) {
      return { status: statusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      return { status: statusFromHttp(res.status), error: `http_${res.status}` };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

// ============================================================================
// ROTATE SECRET
// ============================================================================

export async function rotateAlertSubscriptionSecret(id: string): Promise<RotateSecretResult> {
  const safeId = encodeURIComponent(String(id || '').trim());
  if (!safeId) return { status: 'error', error: 'id_required' };
  const path = `/presentations/governance/alert-subscriptions/${safeId}/rotate-secret`;
  const body = { confirm: true };
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(path, body);
      const data = unwrapData(res);
      if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
      const subscription = normalizeRotateSubscription(data.subscription);
      const oneTimeSecret =
        typeof data.oneTimeSecret === 'string' && data.oneTimeSecret.length > 0
          ? data.oneTimeSecret
          : undefined;
      return {
        status: 'ok',
        ...(subscription ? { subscription } : {}),
        ...(oneTimeSecret ? { oneTimeSecret } : {}),
      };
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
    if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
    const subscription = normalizeRotateSubscription(data.subscription);
    const oneTimeSecret =
      typeof data.oneTimeSecret === 'string' && data.oneTimeSecret.length > 0
        ? data.oneTimeSecret
        : undefined;
    return {
      status: 'ok',
      ...(subscription ? { subscription } : {}),
      ...(oneTimeSecret ? { oneTimeSecret } : {}),
    };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

// ============================================================================
// TEST DELIVERY
// ============================================================================

export interface TestDeliveryOptions {
  syntheticDeckId?: string;
  syntheticVerdict?: AlertSeverity;
}

export async function sendAlertSubscriptionTestDelivery(
  id: string,
  opts?: TestDeliveryOptions
): Promise<TestDeliveryClientResult> {
  const safeId = encodeURIComponent(String(id || '').trim());
  if (!safeId) return { status: 'error', error: 'id_required' };
  const path = `/presentations/governance/alert-subscriptions/${safeId}/test-delivery`;
  const body: Record<string, unknown> = {};
  if (opts?.syntheticDeckId) body.syntheticDeckId = opts.syntheticDeckId;
  if (opts?.syntheticVerdict) body.syntheticVerdict = opts.syntheticVerdict;
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(path, body);
      const data = unwrapData(res);
      if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
      const result = normalizeTestDeliveryResult(data);
      if (!result) return { status: 'error', error: 'invalid_payload' };
      return { status: 'ok', data: result };
    } catch (err) {
      const status = statusFromError(err);
      if (status === 'forbidden') return { status: 'forbidden', error: safeMessage(err) };
      if (status === 'not_found') return { status: 'not_found', error: safeMessage(err) };
      if (status === 'unavailable') return { status: 'unavailable', error: safeMessage(err) };
      return { status: 'error', error: safeMessage(err) };
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
      const httpStatus = statusFromHttp(res.status);
      if (httpStatus === 'forbidden') return { status: 'forbidden', error: `http_${res.status}` };
      if (httpStatus === 'not_found') return { status: 'not_found', error: `http_${res.status}` };
      return { status: 'error', error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
    const result = normalizeTestDeliveryResult(data);
    if (!result) return { status: 'error', error: 'invalid_payload' };
    return { status: 'ok', data: result };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
