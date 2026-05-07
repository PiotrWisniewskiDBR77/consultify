/**
 * presentationTemplateGovernance (Epic C2)
 *
 * Read/write client for the per-org Template Registry Governance
 * surface. Wraps the Sprint 13 endpoints behind the same envelope
 * pattern used by `presentationGovernanceAlertSubscriptions` and
 * peers — every helper resolves with a `{ status, ... }` envelope
 * and NEVER throws so the SuperAdmin view can render honest
 * forbidden / unavailable / not_found banners.
 *
 *   GET    /api/presentations/templates/:id/governance
 *   POST   /api/presentations/templates/:id/governance/transition
 *   POST   /api/presentations/templates/:id/governance/deprecate
 *   GET    /api/presentations/templates/governance/by-state/:state
 *   GET    /api/presentations/templates/:id/governance/lineage
 */

import { Api } from '@/services/api';

export type TemplateLifecycleState = 'draft' | 'approved' | 'deprecated';

export type TemplateGovernanceFetchStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'unavailable'
  | 'conflict'
  | 'invalid';

export type TemplateGovernanceEventType =
  | 'submitted_for_approval'
  | 'approved'
  | 'rejected'
  | 'deprecated'
  | 'cloned'
  | 'reverted';

export interface ClientTemplateGovernanceEvent {
  id: string;
  templateId: string;
  organizationId: string;
  eventType: TemplateGovernanceEventType;
  fromState: TemplateLifecycleState | null;
  toState: TemplateLifecycleState | null;
  actorId: string | null;
  actorRole: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ClientTemplateLineageNode {
  id: string;
  name: string;
  lifecycleState: TemplateLifecycleState;
  lineageVersion: number;
  lineageParentId: string | null;
}

export interface ClientTemplateGovernance {
  templateId: string;
  name: string;
  lifecycleState: TemplateLifecycleState;
  lineage: {
    parentId: string | null;
    rootId: string;
    version: number;
    chain: ClientTemplateLineageNode[];
    chainStatus: 'ok' | 'not_found' | 'storage_error';
  };
  approval: {
    approvedAt: string | null;
    approvedBy: string | null;
    deprecatedAt: string | null;
    deprecatedBy: string | null;
    deprecationReason: string | null;
  };
  events: ClientTemplateGovernanceEvent[];
  warnings: string[];
}

export interface ClientTemplateRegistryRow {
  id: string;
  name: string;
  lifecycleState: TemplateLifecycleState;
  lineageVersion: number;
  lineageRootId: string | null;
  updatedAt: string;
}

export interface FetchTemplateGovernanceResult {
  status: TemplateGovernanceFetchStatus;
  data?: ClientTemplateGovernance;
  error?: string;
}

export interface TransitionTemplateLifecycleResult {
  status: TemplateGovernanceFetchStatus;
  record?: {
    id: string;
    name: string;
    lifecycleState: TemplateLifecycleState;
    lineageVersion: number;
  };
  warnings?: string[];
  requiredCapability?: 'template_approve';
  error?: string;
}

export interface DeprecateTemplateResult {
  status: TemplateGovernanceFetchStatus;
  record?: {
    id: string;
    name: string;
    lifecycleState: TemplateLifecycleState;
  };
  error?: string;
}

export interface ListTemplatesByLifecycleStateResult {
  status: TemplateGovernanceFetchStatus;
  state: TemplateLifecycleState;
  templates: ClientTemplateRegistryRow[];
  error?: string;
}

export interface FetchTemplateLineageResult {
  status: TemplateGovernanceFetchStatus;
  templateId: string;
  chain: ClientTemplateLineageNode[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_STATES: ReadonlySet<TemplateLifecycleState> = new Set([
  'draft',
  'approved',
  'deprecated',
]);

const VALID_EVENT_TYPES: ReadonlySet<TemplateGovernanceEventType> = new Set([
  'submitted_for_approval',
  'approved',
  'rejected',
  'deprecated',
  'cloned',
  'reverted',
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

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asLifecycleState(value: unknown, fallback: TemplateLifecycleState = 'draft'): TemplateLifecycleState {
  return typeof value === 'string' && VALID_STATES.has(value as TemplateLifecycleState)
    ? (value as TemplateLifecycleState)
    : fallback;
}

function asLifecycleStateOrNull(value: unknown): TemplateLifecycleState | null {
  if (typeof value !== 'string') return null;
  return VALID_STATES.has(value as TemplateLifecycleState)
    ? (value as TemplateLifecycleState)
    : null;
}

function asEventType(value: unknown): TemplateGovernanceEventType {
  return typeof value === 'string' && VALID_EVENT_TYPES.has(value as TemplateGovernanceEventType)
    ? (value as TemplateGovernanceEventType)
    : 'submitted_for_approval';
}

function statusFromHttp(code: number): TemplateGovernanceFetchStatus {
  if (code === 400) return 'invalid';
  if (code === 401) return 'error';
  if (code === 403) return 'forbidden';
  if (code === 404) return 'not_found';
  if (code === 409) return 'conflict';
  if (code === 503) return 'unavailable';
  return 'error';
}

function statusFromError(err: unknown): TemplateGovernanceFetchStatus {
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
} {
  return Api as unknown as {
    get?: (url: string) => Promise<unknown>;
    post?: (url: string, data: unknown) => Promise<unknown>;
  };
}

function normalizeLineageNode(raw: unknown): ClientTemplateLineageNode | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    name: asString(raw.name, ''),
    lifecycleState: asLifecycleState(raw.lifecycle_state ?? raw.lifecycleState),
    lineageVersion: asNumber(raw.lineage_version ?? raw.lineageVersion, 1),
    lineageParentId: asStringOrNull(raw.lineage_parent_id ?? raw.lineageParentId),
  };
}

function normalizeEvent(raw: unknown): ClientTemplateGovernanceEvent | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    templateId: asString(raw.templateId ?? raw.template_id),
    organizationId: asString(raw.organizationId ?? raw.organization_id),
    eventType: asEventType(raw.eventType ?? raw.event_type),
    fromState: asLifecycleStateOrNull(raw.fromState ?? raw.from_state),
    toState: asLifecycleStateOrNull(raw.toState ?? raw.to_state),
    actorId: asStringOrNull(raw.actorId ?? raw.actor_id),
    actorRole: asStringOrNull(raw.actorRole ?? raw.actor_role),
    reason: asStringOrNull(raw.reason),
    createdAt: asString(raw.createdAt ?? raw.created_at, ''),
  };
}

function normalizeRegistryRow(raw: unknown): ClientTemplateRegistryRow | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    name: asString(raw.name, ''),
    lifecycleState: asLifecycleState(raw.lifecycle_state ?? raw.lifecycleState),
    lineageVersion: asNumber(raw.lineage_version ?? raw.lineageVersion, 1),
    lineageRootId: asStringOrNull(raw.lineage_root_id ?? raw.lineageRootId),
    updatedAt: asString(raw.updated_at ?? raw.updatedAt, ''),
  };
}

function normalizeGovernance(raw: unknown): ClientTemplateGovernance | undefined {
  if (!isRecord(raw)) return undefined;
  const templateId = asString(raw.templateId ?? raw.template_id);
  if (!templateId) return undefined;
  const lineageRaw = isRecord(raw.lineage) ? raw.lineage : {};
  const approvalRaw = isRecord(raw.approval) ? raw.approval : {};
  const eventsRaw = Array.isArray(raw.events) ? raw.events : [];
  const warningsRaw = Array.isArray(raw.warnings) ? raw.warnings : [];

  const chainRaw = Array.isArray(lineageRaw.chain) ? lineageRaw.chain : [];
  const chain = chainRaw
    .map(normalizeLineageNode)
    .filter((n): n is ClientTemplateLineageNode => n !== null);

  return {
    templateId,
    name: asString(raw.name, ''),
    lifecycleState: asLifecycleState(raw.lifecycleState ?? raw.lifecycle_state),
    lineage: {
      parentId: asStringOrNull(lineageRaw.parentId),
      rootId: asString(lineageRaw.rootId, templateId),
      version: asNumber(lineageRaw.version, 1),
      chain,
      chainStatus:
        lineageRaw.chainStatus === 'storage_error' || lineageRaw.chainStatus === 'not_found'
          ? lineageRaw.chainStatus
          : 'ok',
    },
    approval: {
      approvedAt: asStringOrNull(approvalRaw.approvedAt),
      approvedBy: asStringOrNull(approvalRaw.approvedBy),
      deprecatedAt: asStringOrNull(approvalRaw.deprecatedAt),
      deprecatedBy: asStringOrNull(approvalRaw.deprecatedBy),
      deprecationReason: asStringOrNull(approvalRaw.deprecationReason),
    },
    events: eventsRaw
      .map(normalizeEvent)
      .filter((e): e is ClientTemplateGovernanceEvent => e !== null),
    warnings: warningsRaw.filter((w): w is string => typeof w === 'string'),
  };
}

// ---------------------------------------------------------------------------
// fetchTemplateGovernance
// ---------------------------------------------------------------------------

export async function fetchTemplateGovernance(
  templateId: string
): Promise<FetchTemplateGovernanceResult> {
  const safeId = encodeURIComponent(String(templateId || '').trim());
  if (!safeId) return { status: 'invalid', error: 'templateId is required' };
  const path = `/presentations/templates/${safeId}/governance`;
  const api = getApiClient();

  if (typeof api.get === 'function') {
    try {
      const res = await api.get(path);
      const data = normalizeGovernance(unwrapData(res));
      if (!data) return { status: 'error', error: 'invalid_payload' };
      return { status: 'ok', data };
    } catch (err) {
      return { status: statusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) return { status: statusFromHttp(res.status), error: `http_${res.status}` };
    const json: unknown = await res.json().catch(() => null);
    const data = normalizeGovernance(unwrapData(json));
    if (!data) return { status: 'error', error: 'invalid_payload' };
    return { status: 'ok', data };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

// ---------------------------------------------------------------------------
// transitionTemplateLifecycle
// ---------------------------------------------------------------------------

export async function transitionTemplateLifecycle(
  templateId: string,
  targetState: TemplateLifecycleState,
  reason?: string
): Promise<TransitionTemplateLifecycleResult> {
  const safeId = encodeURIComponent(String(templateId || '').trim());
  if (!safeId) return { status: 'invalid', error: 'templateId is required' };
  if (!VALID_STATES.has(targetState)) {
    return { status: 'invalid', error: 'invalid_target_state' };
  }
  const path = `/presentations/templates/${safeId}/governance/transition`;
  const body = { targetState, reason: typeof reason === 'string' ? reason : undefined };
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(path, body);
      const data = unwrapData(res);
      if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
      const recordRaw = isRecord(data.record) ? data.record : null;
      const warnings = Array.isArray(data.warnings)
        ? data.warnings.filter((w): w is string => typeof w === 'string')
        : undefined;
      return {
        status: 'ok',
        ...(recordRaw
          ? {
              record: {
                id: asString(recordRaw.id),
                name: asString(recordRaw.name),
                lifecycleState: asLifecycleState(recordRaw.lifecycle_state),
                lineageVersion: asNumber(recordRaw.lineage_version, 1),
              },
            }
          : {}),
        ...(warnings && warnings.length > 0 ? { warnings } : {}),
      };
    } catch (err) {
      const fallback = isRecord(err) && isRecord(err.data) ? err.data : null;
      return {
        status: statusFromError(err),
        error: safeMessage(err),
        ...(fallback && typeof fallback.requiredCapability === 'string'
          ? { requiredCapability: fallback.requiredCapability as 'template_approve' }
          : {}),
      };
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
      const errJson: unknown = await res.json().catch(() => null);
      return {
        status: statusFromHttp(res.status),
        error: `http_${res.status}`,
        ...(isRecord(errJson) && typeof errJson.requiredCapability === 'string'
          ? { requiredCapability: errJson.requiredCapability as 'template_approve' }
          : {}),
      };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

// ---------------------------------------------------------------------------
// deprecateTemplate
// ---------------------------------------------------------------------------

export async function deprecateTemplate(
  templateId: string,
  reason: string
): Promise<DeprecateTemplateResult> {
  const safeId = encodeURIComponent(String(templateId || '').trim());
  if (!safeId) return { status: 'invalid', error: 'templateId is required' };
  const safeReason = String(reason || '').trim();
  if (!safeReason) return { status: 'invalid', error: 'reason_required' };
  const path = `/presentations/templates/${safeId}/governance/deprecate`;
  const body = { reason: safeReason };
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(path, body);
      const data = unwrapData(res);
      if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
      const recordRaw = isRecord(data.record) ? data.record : null;
      return {
        status: 'ok',
        ...(recordRaw
          ? {
              record: {
                id: asString(recordRaw.id),
                name: asString(recordRaw.name),
                lifecycleState: asLifecycleState(recordRaw.lifecycle_state),
              },
            }
          : {}),
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
    if (!res.ok) return { status: statusFromHttp(res.status), error: `http_${res.status}` };
    return { status: 'ok' };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

// ---------------------------------------------------------------------------
// listTemplatesByLifecycleState
// ---------------------------------------------------------------------------

export async function listTemplatesByLifecycleState(
  state: TemplateLifecycleState
): Promise<ListTemplatesByLifecycleStateResult> {
  if (!VALID_STATES.has(state)) {
    return { status: 'invalid', state, templates: [], error: 'invalid_state' };
  }
  const path = `/presentations/templates/governance/by-state/${encodeURIComponent(state)}`;
  const api = getApiClient();

  if (typeof api.get === 'function') {
    try {
      const res = await api.get(path);
      const data = unwrapData(res);
      if (!isRecord(data)) return { status: 'error', state, templates: [], error: 'invalid_payload' };
      const templatesRaw = Array.isArray(data.templates) ? data.templates : [];
      const templates = templatesRaw
        .map(normalizeRegistryRow)
        .filter((r): r is ClientTemplateRegistryRow => r !== null);
      return { status: 'ok', state, templates };
    } catch (err) {
      return { status: statusFromError(err), state, templates: [], error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      return {
        status: statusFromHttp(res.status),
        state,
        templates: [],
        error: `http_${res.status}`,
      };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) return { status: 'error', state, templates: [], error: 'invalid_payload' };
    const templatesRaw = Array.isArray(data.templates) ? data.templates : [];
    const templates = templatesRaw
      .map(normalizeRegistryRow)
      .filter((r): r is ClientTemplateRegistryRow => r !== null);
    return { status: 'ok', state, templates };
  } catch {
    return { status: 'unavailable', state, templates: [], error: 'network_error' };
  }
}

// ---------------------------------------------------------------------------
// fetchTemplateLineage
// ---------------------------------------------------------------------------

export async function fetchTemplateLineage(
  templateId: string
): Promise<FetchTemplateLineageResult> {
  const safeId = encodeURIComponent(String(templateId || '').trim());
  if (!safeId) {
    return { status: 'invalid', templateId, chain: [], error: 'templateId is required' };
  }
  const path = `/presentations/templates/${safeId}/governance/lineage`;
  const api = getApiClient();

  if (typeof api.get === 'function') {
    try {
      const res = await api.get(path);
      const data = unwrapData(res);
      if (!isRecord(data)) {
        return { status: 'error', templateId, chain: [], error: 'invalid_payload' };
      }
      const chainRaw = Array.isArray(data.chain) ? data.chain : [];
      const chain = chainRaw
        .map(normalizeLineageNode)
        .filter((n): n is ClientTemplateLineageNode => n !== null);
      return { status: 'ok', templateId: asString(data.templateId, templateId), chain };
    } catch (err) {
      return { status: statusFromError(err), templateId, chain: [], error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      return {
        status: statusFromHttp(res.status),
        templateId,
        chain: [],
        error: `http_${res.status}`,
      };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) {
      return { status: 'error', templateId, chain: [], error: 'invalid_payload' };
    }
    const chainRaw = Array.isArray(data.chain) ? data.chain : [];
    const chain = chainRaw
      .map(normalizeLineageNode)
      .filter((n): n is ClientTemplateLineageNode => n !== null);
    return { status: 'ok', templateId: asString(data.templateId, templateId), chain };
  } catch {
    return { status: 'unavailable', templateId, chain: [], error: 'network_error' };
  }
}
