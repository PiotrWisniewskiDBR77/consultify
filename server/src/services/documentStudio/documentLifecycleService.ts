/**
 * Consultify Document Studio — Document Lifecycle Service (Epic E5).
 *
 * Owns the lifecycle status of every Document Studio artifact:
 *
 *   draft → in_review → approved → published → archived
 *
 * The service maintains a synchronous in-process registry of lifecycle
 * state per `${organizationId}::${artifactId}` and overlays it onto the
 * schema returned from wave5. We deliberately do NOT push status into
 * wave5 metadata on every transition because:
 *   - Status transitions are very frequent vs. wave5 mutations.
 *   - The wave5 mutation envelope is heavyweight (proposal → approval
 *     → commit) and reserved for structural content changes.
 *   - Persisting lifecycle state in a sibling DAO keeps the wave5 row
 *     immutable wrt status churn and lets us roll lifecycle storage
 *     into a wave5 swap later without a content migration.
 *
 * The DAO mirrors the source-pack DAO design: in-memory write-through
 * with a stable surface so the wave5 / Postgres swap is mechanical.
 *
 * Tenant safety: every call accepts and validates `organizationId`;
 * cross-tenant reads return `null` deny-by-default.
 */

import type {
  DocumentAuditEntry,
  DocumentStatus,
} from './documentStudioTypes.js';

// =============================================================================
// Lifecycle state shape
// =============================================================================

export interface DocumentLifecycleState {
  artifactId: string;
  organizationId: string;
  status: DocumentStatus;
  /** ISO timestamp of the last status change (or initial draft). */
  statusChangedAt: string;
  /** User id who triggered the last transition. `system` for auto-set draft. */
  statusChangedBy: string;
  /** Optional human-readable reason captured with the transition. */
  statusReason?: string;
  /** History of transitions. Append-only; mirrored in audit trail too. */
  history: DocumentLifecycleTransition[];
}

export interface DocumentLifecycleTransition {
  from: DocumentStatus;
  to: DocumentStatus;
  occurredAt: string;
  actorId: string;
  reason?: string;
}

// =============================================================================
// Allowed transitions matrix
// =============================================================================

/**
 * Lifecycle transition matrix. Stays narrow and explicit on purpose so
 * UI affordances and route validation can reason about exactly which
 * transitions are reachable from each state.
 *
 *   draft       → in_review  (submit for review)
 *               → archived   (drop the working copy)
 *   in_review   → approved   (clear for publication)
 *               → draft      (sent back for revision)
 *               → archived   (drop after rejection)
 *   approved    → published  (publish externally)
 *               → in_review  (un-approve to revise)
 *               → archived   (cancel before publication)
 *   published   → archived   (only path out; revisions create a new
 *                             artifact OR roll back to a snapshot)
 *   archived    → draft      (restore for further work)
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<DocumentStatus, ReadonlyArray<DocumentStatus>>> =
  Object.freeze({
    draft: Object.freeze<DocumentStatus[]>(['in_review', 'archived']),
    in_review: Object.freeze<DocumentStatus[]>(['approved', 'draft', 'archived']),
    approved: Object.freeze<DocumentStatus[]>(['published', 'in_review', 'archived']),
    published: Object.freeze<DocumentStatus[]>(['archived']),
    archived: Object.freeze<DocumentStatus[]>(['draft']),
  });

export class DocumentLifecycleTransitionError extends Error {
  readonly code: 'invalid_transition' | 'unknown_status' | 'unknown_artifact';
  readonly from?: DocumentStatus;
  readonly to?: DocumentStatus;
  constructor(
    code: 'invalid_transition' | 'unknown_status' | 'unknown_artifact',
    message: string,
    details?: { from?: DocumentStatus; to?: DocumentStatus }
  ) {
    super(message);
    this.name = 'DocumentLifecycleTransitionError';
    this.code = code;
    this.from = details?.from;
    this.to = details?.to;
  }
}

const VALID_STATUSES: ReadonlySet<DocumentStatus> = new Set([
  'draft',
  'in_review',
  'approved',
  'published',
  'archived',
]);

export function isValidDocumentStatus(value: unknown): value is DocumentStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value as DocumentStatus);
}

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  if (!isValidDocumentStatus(from) || !isValidDocumentStatus(to)) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// =============================================================================
// In-process registry + write-through
// =============================================================================

const lifecycleStore = new Map<string, DocumentLifecycleState>();
// In-memory DAO mirror — the wave5 / Postgres swap will replace these
// two maps without changing the surface above.
const persistedLifecycleStore = new Map<string, DocumentLifecycleState>();

function key(organizationId: string, artifactId: string): string {
  return `${organizationId}::${artifactId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function cloneState(state: DocumentLifecycleState): DocumentLifecycleState {
  return {
    ...state,
    history: state.history.map((entry) => ({ ...entry })),
  };
}

async function persistLifecycleState(state: DocumentLifecycleState): Promise<{ ok: boolean }> {
  if (!state || !state.artifactId || !state.organizationId) return { ok: false };
  persistedLifecycleStore.set(key(state.organizationId, state.artifactId), cloneState(state));
  return { ok: true };
}

async function loadLifecycleStateForOrg(
  organizationId: string
): Promise<DocumentLifecycleState[]> {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: DocumentLifecycleState[] = [];
  for (const [k, state] of persistedLifecycleStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    out.push(cloneState(state));
  }
  return out;
}

const hydratedOrgs = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();

async function ensureHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  const inflight = hydrationInflight.get(organizationId);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const states = await loadLifecycleStateForOrg(organizationId);
      for (const state of states) {
        lifecycleStore.set(key(state.organizationId, state.artifactId), state);
      }
    } catch {
      // best-effort hydration; in-process state remains operational
    }
    hydratedOrgs.add(organizationId);
  })();
  hydrationInflight.set(organizationId, promise);
  try {
    await promise;
  } finally {
    hydrationInflight.delete(organizationId);
  }
}

export async function ensureDocumentLifecycleHydrated(organizationId: string): Promise<void> {
  return ensureHydrated(organizationId);
}

// =============================================================================
// Audit pump (the lifecycle service does not own the audit store; the
// caller injects a `pushAuditEntry` so the documentStudioService keeps
// owning DocumentAuditEntry persistence in one place).
// =============================================================================

type AuditPump = (entry: DocumentAuditEntry) => void;
let auditPump: AuditPump | null = null;

/**
 * Wire the documentStudioService.pushAuditEntry function so lifecycle
 * transitions, snapshot creation and rollback all land in the same
 * audit timeline as proposals + QA decisions. Called once at module
 * load by the studio service.
 */
export function registerDocumentLifecycleAuditPump(pump: AuditPump): void {
  auditPump = pump;
}

function recordAudit(entry: DocumentAuditEntry): void {
  if (!auditPump) return;
  auditPump(entry);
}

// =============================================================================
// Public surface — initialization + transitions
// =============================================================================

export interface InitializeLifecycleParams {
  organizationId: string;
  artifactId: string;
  /** Optional explicit initial status; defaults to 'draft'. */
  initialStatus?: DocumentStatus;
  actorId?: string;
}

/**
 * Seed lifecycle state for a freshly materialized artifact. Idempotent
 * on existing rows (returns the existing state untouched). Defaults
 * `initialStatus` to `'draft'` so callers do not have to think about
 * the entry state.
 */
export function initializeDocumentLifecycle(
  params: InitializeLifecycleParams
): DocumentLifecycleState {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.artifactId) throw new Error('artifactId is required');

  const existing = lifecycleStore.get(key(params.organizationId, params.artifactId));
  if (existing) return cloneState(existing);

  const now = nowIso();
  const state: DocumentLifecycleState = {
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    status: params.initialStatus ?? 'draft',
    statusChangedAt: now,
    statusChangedBy: params.actorId ?? 'system',
    history: [],
  };
  lifecycleStore.set(key(params.organizationId, params.artifactId), state);
  void persistLifecycleState(state).catch(() => undefined);
  return cloneState(state);
}

export interface TransitionDocumentStatusParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  to: DocumentStatus;
  reason?: string;
}

/**
 * Mutate the lifecycle status of a document artifact. Validates the
 * transition against `ALLOWED_TRANSITIONS`, records an audit entry, and
 * appends a `DocumentLifecycleTransition` to the state history.
 *
 * Throws `DocumentLifecycleTransitionError`:
 *   - 'unknown_status'    — `to` is not a recognized DocumentStatus.
 *   - 'unknown_artifact'  — no lifecycle state exists for this artifact
 *                           (initializeDocumentLifecycle must run first).
 *   - 'invalid_transition'— `from → to` is not in ALLOWED_TRANSITIONS.
 */
export function transitionDocumentStatus(
  params: TransitionDocumentStatusParams
): DocumentLifecycleState {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.artifactId) throw new Error('artifactId is required');
  if (!params.userId) throw new Error('userId is required');
  if (!isValidDocumentStatus(params.to)) {
    throw new DocumentLifecycleTransitionError(
      'unknown_status',
      `unknown DocumentStatus: ${params.to}`
    );
  }

  const state = lifecycleStore.get(key(params.organizationId, params.artifactId));
  if (!state) {
    throw new DocumentLifecycleTransitionError(
      'unknown_artifact',
      `no lifecycle state for artifact ${params.artifactId}`
    );
  }

  if (state.status === params.to) {
    // Idempotent: same-state transitions are a no-op (no audit, no
    // history entry). Callers that want to record a re-affirmation
    // should issue a meaningful transition (e.g. approved → in_review
    // → approved) instead.
    return cloneState(state);
  }

  if (!canTransition(state.status, params.to)) {
    throw new DocumentLifecycleTransitionError(
      'invalid_transition',
      `transition not allowed: ${state.status} → ${params.to}`,
      { from: state.status, to: params.to }
    );
  }

  const now = nowIso();
  const transition: DocumentLifecycleTransition = {
    from: state.status,
    to: params.to,
    occurredAt: now,
    actorId: params.userId,
    reason: params.reason?.trim() || undefined,
  };
  const next: DocumentLifecycleState = {
    ...state,
    status: params.to,
    statusChangedAt: now,
    statusChangedBy: params.userId,
    statusReason: params.reason?.trim() || undefined,
    history: [...state.history, transition],
  };

  lifecycleStore.set(key(params.organizationId, params.artifactId), next);
  void persistLifecycleState(next).catch(() => undefined);

  recordAudit({
    auditId: makeId('document-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    action: 'document_status_changed',
    actorId: params.userId,
    occurredAt: now,
    details: { from: transition.from, to: transition.to, reason: transition.reason },
  });

  return cloneState(next);
}

export function getDocumentLifecycleState(
  artifactId: string,
  organizationId: string
): DocumentLifecycleState | null {
  if (!artifactId || !organizationId) return null;
  const state = lifecycleStore.get(key(organizationId, artifactId));
  return state ? cloneState(state) : null;
}

/**
 * @internal
 *
 * System-driven status mutation that bypasses `ALLOWED_TRANSITIONS`.
 * Reserved for rollback (Epic E5 Slice 5.3): when an operator rolls a
 * document back from any state (incl. `published`) to a previous
 * snapshot, we always reset the live status to `'draft'` so the
 * editor / reviewer flow restarts cleanly. The audit pump still emits
 * a `document_status_changed` row, with `details.system: 'rollback'`
 * so reviewers can distinguish system bypasses from operator-driven
 * transitions.
 *
 * NOT exposed via the studio service public surface; only the
 * rollback orchestrator imports it.
 */
export function __forceTransitionDocumentStatusForRollback(params: {
  organizationId: string;
  artifactId: string;
  userId: string;
  to: DocumentStatus;
  reason: string;
}): DocumentLifecycleState {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.artifactId) throw new Error('artifactId is required');
  if (!params.userId) throw new Error('userId is required');
  if (!isValidDocumentStatus(params.to)) {
    throw new DocumentLifecycleTransitionError(
      'unknown_status',
      `unknown DocumentStatus: ${params.to}`
    );
  }
  const state = lifecycleStore.get(key(params.organizationId, params.artifactId));
  if (!state) {
    throw new DocumentLifecycleTransitionError(
      'unknown_artifact',
      `no lifecycle state for artifact ${params.artifactId}`
    );
  }
  const now = nowIso();
  const transition: DocumentLifecycleTransition = {
    from: state.status,
    to: params.to,
    occurredAt: now,
    actorId: params.userId,
    reason: params.reason,
  };
  const next: DocumentLifecycleState = {
    ...state,
    status: params.to,
    statusChangedAt: now,
    statusChangedBy: params.userId,
    statusReason: params.reason,
    history: [...state.history, transition],
  };
  lifecycleStore.set(key(params.organizationId, params.artifactId), next);
  void persistLifecycleState(next).catch(() => undefined);
  recordAudit({
    auditId: makeId('document-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    action: 'document_status_changed',
    actorId: params.userId,
    occurredAt: now,
    details: {
      from: transition.from,
      to: transition.to,
      reason: params.reason,
      system: 'rollback',
    },
  });
  return cloneState(next);
}

/**
 * Returns the lifecycle status overlay for an artifact, defaulting to
 * `'draft'` when no state exists. Used by `getDocumentArtifact` to
 * project status onto historical schemas that pre-date Epic E5.
 */
export function getDocumentStatusOrDefault(
  artifactId: string,
  organizationId: string
): {
  status: DocumentStatus;
  statusChangedAt?: string;
  statusChangedBy?: string;
  statusReason?: string;
} {
  const state = getDocumentLifecycleState(artifactId, organizationId);
  if (!state) return { status: 'draft' };
  return {
    status: state.status,
    statusChangedAt: state.statusChangedAt,
    statusChangedBy: state.statusChangedBy,
    statusReason: state.statusReason,
  };
}

// =============================================================================
// Test-only helpers
// =============================================================================

/** @internal */
export function __resetDocumentLifecycleForTests(): void {
  lifecycleStore.clear();
  persistedLifecycleStore.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
}
