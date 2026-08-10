/**
 * Case Workspace — CAPABILITY ADAPTERS.
 *
 * Implements docs/product/case-workspace/05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md
 * §5 ("Adapter and module ownership contract") and §6 (CommandEnvelope) on top
 * of the registry that capabilityRegistryService.ts already owns.
 *
 * §5 verbatim: "All adapters accept the same execution envelope, validate typed
 * input, enforce idempotency and return a normalized result with canonical
 * artifact references. They do not write another module's tables or drive its
 * UI."
 *
 * ===========================================================================
 * WHAT EXISTS TODAY, AND WHAT THIS FILE ADDS
 * ===========================================================================
 * capabilityRegistryService.ts persists capability DEFINITIONS — schema refs,
 * policy, health, idempotency strategy — but nothing in this program can
 * EXECUTE one. §5's six adapters (InternalCommand, MCP, HttpApi, Connector,
 * Agent, LegacyTool) had zero implementations, which is why
 * capabilityRegistryService's own open_questions flag "the adapter-presence
 * half of CW-GR-016 is out of this packet's scope". This file closes two of
 * the six — `INTERNAL` and `HTTP_API` — behind ONE interface, so the remaining
 * four are new adapters rather than a new execution model.
 *
 * ===========================================================================
 * THIS FILE DOES NOT MODIFY capabilityRegistryService.ts
 * ===========================================================================
 * Registration goes through its PUBLIC API (registerCapability), and
 * idempotency goes through its PUBLIC recordIdempotencyKeyCheck. Nothing here
 * writes `case_workspace_capabilities` or
 * `case_workspace_capability_idempotency_keys` directly — that table belongs to
 * that service, and §5's "they do not write another module's tables" applies to
 * this program's own internal seams too.
 *
 * ===========================================================================
 * THE ERROR TAXONOMY IS THE POINT, NOT AN AFTERTHOUGHT
 * ===========================================================================
 * Every failure — a bad input, a socket reset, a 500 from a vendor, a timeout —
 * leaves through the SAME small closed set of codes (CapabilityErrorCode), and
 * the provider's own message NEVER leaves this file. It is replaced by
 * `errorDetailRef`, a digest.
 *
 * That is not tidiness. A provider error body is the single most common way a
 * bearer token, a full request echo or a client's name ends up in a durable
 * audit row and then on a screen (doc 06 §6/§9: payloads are REFERENCED, not
 * copied). It also keeps error handling honest: a caller cannot branch on
 * substring-matching a vendor message, so retry/compensation decisions are made
 * on classified facts (`retryable`) instead of on prose that changes with the
 * vendor's next release.
 *
 * ===========================================================================
 * TIMEOUTS ARE ENFORCED HERE, NOT HOPED FOR
 * ===========================================================================
 * Node's fetch has no default timeout; an unresponsive peer holding a socket
 * open would otherwise pin a worker until its NodeRun lease lapsed — turning a
 * slow vendor into a stuck node. Every adapter therefore races the call against
 * an AbortController, and the abort is `finally`-cleared so a fast success does
 * not leave a live timer behind.
 */

import { createHash, randomUUID } from 'node:crypto';

import logger from '../../utils/Logger.js';
import { withPgTransaction } from '../../utils/queryHelpers.js';
import {
  type CapabilityRegistryEntry,
  type RegisterCapabilityInput,
  getCapabilityVersion,
  recordIdempotencyKeyCheck,
  registerCapability,
} from './capabilityRegistryService.js';
import { publishEvent, redact } from './eventOutboxService.js';

// ---------------------------------------------------------------------------
// The closed error taxonomy (§5 "error taxonomy")
// ---------------------------------------------------------------------------

/**
 * Deliberately SMALL and closed. Each code answers exactly one operational
 * question, and nothing else is ever emitted:
 *   *_INPUT_INVALID / *_OUTPUT_INVALID — a contract bug on our side or theirs;
 *                                        never retry, the same input fails again.
 *   *_NOT_FOUND / *_UNAVAILABLE        — configuration/health; a human fixes it.
 *   *_UNAUTHORIZED                     — credentials; never retry blindly.
 *   *_TIMEOUT / *_TRANSPORT_ERROR      — the outcome is UNKNOWN. Retry only
 *                                        behind readback reconciliation (doc 06
 *                                        §8), because the effect may have landed.
 *   *_RATE_LIMITED                     — retry after backoff, effect did NOT land.
 *   *_REMOTE_ERROR                     — the peer answered, and answered badly.
 *   *_INTERNAL_ERROR                   — our own bug; the catch-all, kept last
 *                                        so nothing silently maps to a
 *                                        friendlier code than it deserves.
 */
export type CapabilityErrorCode =
  | 'CAPABILITY_INPUT_INVALID'
  | 'CAPABILITY_NOT_FOUND'
  | 'CAPABILITY_UNAVAILABLE'
  | 'CAPABILITY_UNAUTHORIZED'
  | 'CAPABILITY_RATE_LIMITED'
  | 'CAPABILITY_TIMEOUT'
  | 'CAPABILITY_TRANSPORT_ERROR'
  | 'CAPABILITY_REMOTE_ERROR'
  | 'CAPABILITY_OUTPUT_INVALID'
  | 'CAPABILITY_INTERNAL_ERROR';

/**
 * Which codes it is SAFE to retry without a readback first.
 *
 * TIMEOUT and TRANSPORT_ERROR are deliberately absent: in both, the request may
 * have been fully processed by the peer and only the response was lost. Doc 06
 * §8 — "External effects without provider idempotency require readback
 * reconciliation before retry" — is exactly this case, and marking them
 * blithely retryable here is how a system charges a card twice.
 */
const RETRYABLE_WITHOUT_READBACK: ReadonlySet<CapabilityErrorCode> = new Set([
  'CAPABILITY_RATE_LIMITED',
  'CAPABILITY_UNAVAILABLE',
]);

/**
 * The outcome is UNKNOWN for these — the effect may or may not have landed.
 * A caller must reconcile (readback) before retrying, per doc 06 §8.
 */
const REQUIRES_READBACK_BEFORE_RETRY: ReadonlySet<CapabilityErrorCode> = new Set([
  'CAPABILITY_TIMEOUT',
  'CAPABILITY_TRANSPORT_ERROR',
]);

// ---------------------------------------------------------------------------
// The single execution envelope (§6 CommandEnvelope, adapter-facing subset)
// ---------------------------------------------------------------------------

export type CapabilityActorType = 'HUMAN' | 'AGENT' | 'SYSTEM';

export interface CapabilityExecutionEnvelope {
  /** §6 commandId. Minted by the caller; echoed back on the result. */
  commandId?: string;
  capabilityId: string;
  capabilityVersion: string;
  organizationId: string;
  projectId?: string | null;
  actor: { type: CapabilityActorType; actorId: string };
  caseId?: string | null;
  runId?: string | null;
  /** §10 correlation chain — now a REAL NodeRun id (see nodeRunService). */
  nodeRunId?: string | null;
  /** §10 correlation chain — a REAL attempt id from the NodeRun attempt ledger. */
  attemptId?: string | null;
  /**
   * §5 "enforce idempotency". Must be STABLE for the intended business effect
   * (doc 04 §3.4), i.e. derived from the command, never freshly generated on a
   * transport retry — otherwise the second delivery looks like new work.
   */
  idempotencyKey: string;
  correlationId?: string | null;
  causationId?: string | null;
  payload: Record<string, unknown>;
  /** Per-call override of the registry's timeoutDefaults. */
  timeoutMs?: number;
}

export type CapabilityExecutionOutcome = 'SUCCEEDED' | 'FAILED' | 'DUPLICATE_SUPPRESSED';

export interface CapabilityExecutionResult {
  outcome: CapabilityExecutionOutcome;
  commandId: string;
  capabilityId: string;
  capabilityVersion: string;
  providerType: string | null;
  /** Normalized output. Always `{}` on failure — never a partial provider body. */
  output: Record<string, unknown>;
  /** §5 "canonical artifact references" — the pointer to the real result. */
  resultRef: string | null;
  errorCode: CapabilityErrorCode | null;
  /** `sha256:<hex>` digest. NEVER the provider's message. */
  errorDetailRef: string | null;
  /** Classified retry guidance; see the two sets above. */
  retryable: boolean;
  requiresReadbackBeforeRetry: boolean;
  durationMs: number;
}

/** §5: "All adapters accept the same execution envelope". This is that contract. */
export interface CapabilityAdapter {
  readonly kind: string;
  /** Must map EVERY failure into the taxonomy; it may not throw raw errors. */
  execute(
    envelope: CapabilityExecutionEnvelope,
    binding: CapabilityBinding
  ): Promise<AdapterInvocationResult>;
}

/** What an adapter returns before the shared wrapper normalizes it. */
export interface AdapterInvocationResult {
  ok: boolean;
  output?: Record<string, unknown>;
  resultRef?: string | null;
  errorCode?: CapabilityErrorCode;
  /** Raw, for digesting ONLY. Never propagated to the caller or to the DB. */
  errorDetail?: string;
}

// ---------------------------------------------------------------------------
// Bindings — the concrete, resolved target of a registered capability
// ---------------------------------------------------------------------------

/**
 * doc 05 §4: "Provider-neutral graph bindings resolve to a concrete connection
 * at publish or Run validation." The registry row says WHAT a capability is;
 * the binding says WHERE it actually goes. They are separate on purpose — an
 * endpoint URL or a header set is environment configuration, and putting it in
 * the registry table would make a durable definition environment-specific and
 * put credentials one `SELECT *` away.
 */
export type CapabilityBinding = InternalCommandBinding | HttpApiBinding;

export interface InternalCommandBinding {
  kind: 'INTERNAL';
  /** The in-process handler. Registered at boot, never resolved from input. */
  handler: (
    payload: Record<string, unknown>,
    context: CapabilityExecutionEnvelope
  ) => Promise<{ output?: Record<string, unknown>; resultRef?: string | null }>;
  validateInput?: (payload: Record<string, unknown>) => boolean;
  validateOutput?: (output: Record<string, unknown>) => boolean;
  timeoutMs?: number;
}

export interface HttpApiBinding {
  kind: 'HTTP_API';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  /** Static headers (auth material lives here, never in the registry row). */
  headers?: Record<string, string>;
  /**
   * The provider's own idempotency header, when it has one. When ABSENT, doc 06
   * §8 requires readback reconciliation before any retry — which is what
   * `requiresReadbackBeforeRetry` on the result reports.
   */
  idempotencyHeader?: string;
  timeoutMs?: number;
  validateInput?: (payload: Record<string, unknown>) => boolean;
  validateOutput?: (output: Record<string, unknown>) => boolean;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 256 * 1024;
const CAPABILITY_AGGREGATE_TYPE = 'CAPABILITY';
const SYSTEM_ACTOR_ADAPTER = 'system:case-workspace-capability-adapter';

/** Registered bindings, keyed `${capabilityId}@${capabilityVersion}`. */
const bindings = new Map<string, CapabilityBinding>();

function bindingKey(capabilityId: string, capabilityVersion: string): string {
  return `${capabilityId}@${capabilityVersion}`;
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function optionalTrimmed(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

/**
 * The one-way door for provider detail. Whatever went wrong is reduced to a
 * digest: still correlatable across occurrences (identical failures share a
 * ref), no longer a copy of anything sensitive.
 */
function toErrorDetailRef(detail: string | null | undefined): string | null {
  const trimmed = optionalTrimmed(detail);
  if (trimmed === null) return null;
  return `sha256:${createHash('sha256').update(trimmed).digest('hex').slice(0, 32)}`;
}

/**
 * HTTP status -> taxonomy. 429 is split out from 4xx because it is the ONE
 * client-side status that is genuinely retryable, and 401/403 are split out
 * because retrying them is never useful and hides a credential problem behind
 * a generic "remote error".
 */
function mapHttpStatusToErrorCode(status: number): CapabilityErrorCode {
  if (status === 401 || status === 403) return 'CAPABILITY_UNAUTHORIZED';
  if (status === 404) return 'CAPABILITY_NOT_FOUND';
  if (status === 408) return 'CAPABILITY_TIMEOUT';
  if (status === 429) return 'CAPABILITY_RATE_LIMITED';
  if (status === 503 || status === 502 || status === 504) return 'CAPABILITY_UNAVAILABLE';
  if (status >= 400 && status < 500) return 'CAPABILITY_INPUT_INVALID';
  return 'CAPABILITY_REMOTE_ERROR';
}

/**
 * Transport-level throw -> taxonomy. An AbortError is OUR timeout firing; a DNS
 * or socket failure is a transport error. Both land in
 * REQUIRES_READBACK_BEFORE_RETRY, because in neither case do we know whether
 * the peer processed the request.
 */
function mapTransportErrorToCode(error: unknown): CapabilityErrorCode {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'AbortError' || name === 'TimeoutError') return 'CAPABILITY_TIMEOUT';
  return 'CAPABILITY_TRANSPORT_ERROR';
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/**
 * §5 `InternalCommandAdapter`. Invokes an in-process handler that was
 * registered at boot.
 *
 * The handler comes from the BINDING, never from the envelope — a capability id
 * arriving over the wire can only ever select among handlers an operator
 * already registered, so no payload can name arbitrary code to run.
 *
 * Even an in-process call is raced against the timeout: an internal handler
 * that awaits a hung external client is just as capable of pinning a worker as
 * a slow vendor, and "it's internal" is not a liveness guarantee.
 */
export const internalCommandAdapter: CapabilityAdapter = {
  kind: 'INTERNAL',
  async execute(envelope, binding) {
    if (binding.kind !== 'INTERNAL') {
      return { ok: false, errorCode: 'CAPABILITY_INTERNAL_ERROR', errorDetail: 'binding_kind_mismatch' };
    }
    if (binding.validateInput && !binding.validateInput(envelope.payload)) {
      return { ok: false, errorCode: 'CAPABILITY_INPUT_INVALID', errorDetail: 'input_schema_rejected' };
    }

    const timeoutMs = envelope.timeoutMs ?? binding.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let timer: NodeJS.Timeout | undefined;
    try {
      const result = await Promise.race([
        binding.handler(envelope.payload, envelope),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            const error = new Error('internal_command_timeout');
            error.name = 'TimeoutError';
            reject(error);
          }, timeoutMs);
          if (typeof timer.unref === 'function') timer.unref();
        }),
      ]);

      const output = result?.output ?? {};
      if (binding.validateOutput && !binding.validateOutput(output)) {
        return {
          ok: false,
          errorCode: 'CAPABILITY_OUTPUT_INVALID',
          errorDetail: 'output_schema_rejected',
        };
      }
      return { ok: true, output, resultRef: result?.resultRef ?? null };
    } catch (error) {
      const name = (error as { name?: string } | null)?.name ?? '';
      return {
        ok: false,
        errorCode: name === 'TimeoutError' ? 'CAPABILITY_TIMEOUT' : 'CAPABILITY_INTERNAL_ERROR',
        errorDetail: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Without this a fast success leaves a live timer holding the event loop
      // reference (and, unref'd or not, a rejection handler that fires later).
      if (timer) clearTimeout(timer);
    }
  },
};

/**
 * §5 `HttpApiCapabilityAdapter`.
 *
 * Sends the provider's idempotency header when the binding declares one — that
 * header is the ONLY thing that makes a transport retry safe. When the binding
 * declares none, the result reports requiresReadbackBeforeRetry on the UNKNOWN
 * outcomes, which is doc 06 §8's rule made machine-readable rather than left to
 * the caller's memory.
 *
 * The response body is read with a hard size ceiling and, on failure, is NOT
 * parsed or returned — only digested. A failing endpoint's body is exactly
 * where stack traces and echoed request bodies live.
 */
export const httpApiCapabilityAdapter: CapabilityAdapter = {
  kind: 'HTTP_API',
  async execute(envelope, binding) {
    if (binding.kind !== 'HTTP_API') {
      return { ok: false, errorCode: 'CAPABILITY_INTERNAL_ERROR', errorDetail: 'binding_kind_mismatch' };
    }
    if (binding.validateInput && !binding.validateInput(envelope.payload)) {
      return { ok: false, errorCode: 'CAPABILITY_INPUT_INVALID', errorDetail: 'input_schema_rejected' };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(binding.url);
    } catch {
      return { ok: false, errorCode: 'CAPABILITY_UNAVAILABLE', errorDetail: 'binding_url_invalid' };
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return { ok: false, errorCode: 'CAPABILITY_UNAVAILABLE', errorDetail: 'binding_url_scheme_rejected' };
    }

    const timeoutMs = envelope.timeoutMs ?? binding.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const fetchImpl = binding.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        // §10 correlation, propagated so the provider's logs can be joined to
        // ours during an incident.
        'x-correlation-id': envelope.correlationId ?? envelope.commandId ?? '',
        ...(binding.headers ?? {}),
      };
      if (binding.idempotencyHeader) {
        headers[binding.idempotencyHeader] = envelope.idempotencyKey;
      }

      const response = await fetchImpl(binding.url, {
        method: binding.method,
        headers,
        body: binding.method === 'GET' ? undefined : JSON.stringify(envelope.payload ?? {}),
        signal: controller.signal,
      });

      const rawBody = await response.text();
      if (rawBody.length > MAX_RESPONSE_BYTES) {
        return {
          ok: false,
          errorCode: 'CAPABILITY_OUTPUT_INVALID',
          errorDetail: 'response_body_too_large',
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          errorCode: mapHttpStatusToErrorCode(response.status),
          // The body is digested, never surfaced. `status` is a safe, stable
          // fact and is the only thing carried forward verbatim.
          errorDetail: `http_${response.status}:${rawBody.slice(0, 2000)}`,
        };
      }

      let output: Record<string, unknown> = {};
      if (rawBody.trim()) {
        try {
          const parsed = JSON.parse(rawBody);
          output = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : { value: parsed };
        } catch {
          return {
            ok: false,
            errorCode: 'CAPABILITY_OUTPUT_INVALID',
            errorDetail: 'response_body_not_json',
          };
        }
      }
      if (binding.validateOutput && !binding.validateOutput(output)) {
        return {
          ok: false,
          errorCode: 'CAPABILITY_OUTPUT_INVALID',
          errorDetail: 'output_schema_rejected',
        };
      }
      return {
        ok: true,
        output,
        resultRef:
          typeof output.resultRef === 'string' ? output.resultRef : null,
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: mapTransportErrorToCode(error),
        errorDetail: error instanceof Error ? `${error.name}:${error.message}` : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

const ADAPTERS: Record<string, CapabilityAdapter> = {
  INTERNAL: internalCommandAdapter,
  HTTP_API: httpApiCapabilityAdapter,
};

// ---------------------------------------------------------------------------
// Registration — through capabilityRegistryService's PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Register a capability DEFINITION (delegated verbatim to
 * capabilityRegistryService.registerCapability — this file never writes that
 * table) AND its concrete binding.
 *
 * The two are deliberately coupled in one call: doc 05 §4 says "A capability is
 * active only when its version, adapter, schema, policy and health are
 * present", and a definition registered without a binding is precisely the
 * "active" capability that fails at first invocation. Registering the binding
 * first, then the row, means a partially-registered capability is never
 * executable.
 *
 * Requires ADMIN in the caller's organization — enforced inside
 * registerCapability, not re-implemented here.
 */
export async function registerCapabilityWithAdapter(
  input: RegisterCapabilityInput,
  binding: CapabilityBinding,
  callerOrganizationId: string
): Promise<CapabilityRegistryEntry> {
  const capabilityId = requireNonBlank(input.capabilityId, 'capability_id_required');
  const capabilityVersion = requireNonBlank(input.capabilityVersion, 'capability_version_required');
  if (!binding || typeof binding !== 'object') throw new Error('capability_binding_required');
  if (binding.kind !== input.providerType) {
    // A row that says HTTP_API bound to an INTERNAL handler would execute
    // through the wrong adapter for the rest of its life.
    throw new Error('capability_binding_provider_type_mismatch');
  }
  if (!ADAPTERS[binding.kind]) throw new Error('capability_adapter_not_implemented');

  const entry = await registerCapability(input, callerOrganizationId);
  bindings.set(bindingKey(capabilityId, capabilityVersion), binding);
  return entry;
}

/** Bind (or re-bind) an ALREADY-registered capability, e.g. on process boot. */
export function registerCapabilityBinding(
  capabilityId: string,
  capabilityVersion: string,
  binding: CapabilityBinding
): void {
  const id = requireNonBlank(capabilityId, 'capability_id_required');
  const version = requireNonBlank(capabilityVersion, 'capability_version_required');
  if (!ADAPTERS[binding?.kind]) throw new Error('capability_adapter_not_implemented');
  bindings.set(bindingKey(id, version), binding);
}

/** Test/teardown helper. */
export function clearCapabilityBindings(): void {
  bindings.clear();
}

export function getRegisteredAdapterKinds(): string[] {
  return Object.keys(ADAPTERS);
}

// ---------------------------------------------------------------------------
// executeCapability — the one entry point
// ---------------------------------------------------------------------------

/**
 * §5's full contract in one function: resolve the registry row, check health
 * and lifecycle, enforce idempotency, dispatch to the adapter, normalize the
 * result, emit an audit event.
 *
 * ORDER MATTERS AND IS NOT ARBITRARY:
 *   1. registry lookup — an unregistered capability is never executed, so a
 *      binding alone cannot smuggle in an unreviewed capability;
 *   2. lifecycle/health gate — doc 05 §4: UNAVAILABLE "cannot be inserted into
 *      a publishable graph", and an UNHEALTHY capability is refused before any
 *      side effect rather than after;
 *   3. idempotency — recordIdempotencyKeyCheck BEFORE dispatch. A duplicate is
 *      suppressed without invoking the provider at all, which is the only
 *      placement that actually prevents a double effect. Checking afterwards
 *      would merely label one.
 *   4. dispatch;
 *   5. audit event, in its own short transaction (see below).
 *
 * WHY THE EVENT IS NOT IN THE CALLER'S TRANSACTION. Every other service here
 * publishes on the caller's open transaction, because their mutation and their
 * event must commit together. A capability invocation is NOT a database
 * mutation — it is an outbound side effect that already happened, possibly over
 * a network, and it cannot be rolled back. Holding a transaction open across a
 * multi-second HTTP call would pin a connection and lengthen every lock it
 * holds. So the event is written afterwards, in its own short transaction, and
 * a failure to write it is logged rather than thrown: losing the audit line is
 * bad, but converting an already-executed capability into a thrown error would
 * make the caller retry an effect that has already landed.
 *
 * NEVER THROWS for an expected failure — the taxonomy is the return value.
 * Callers branch on `outcome`/`errorCode`, and a NodeRun attempt is closed from
 * those fields (nodeRunService.completeNodeRunAttempt).
 */
export async function executeCapability(
  envelope: CapabilityExecutionEnvelope
): Promise<CapabilityExecutionResult> {
  const capabilityId = requireNonBlank(envelope.capabilityId, 'capability_id_required');
  const capabilityVersion = requireNonBlank(
    envelope.capabilityVersion,
    'capability_version_required'
  );
  const organizationId = requireNonBlank(
    envelope.organizationId,
    'capability_organization_id_required'
  );
  const actorId = requireNonBlank(envelope.actor?.actorId, 'capability_actor_required');
  const idempotencyKey = requireNonBlank(
    envelope.idempotencyKey,
    'capability_idempotency_key_required'
  );
  const commandId = optionalTrimmed(envelope.commandId) ?? `cwcmd-${randomUUID()}`;
  const startedAt = Date.now();

  const fail = (
    errorCode: CapabilityErrorCode,
    detail: string,
    providerType: string | null
  ): CapabilityExecutionResult => ({
    outcome: 'FAILED',
    commandId,
    capabilityId,
    capabilityVersion,
    providerType,
    output: {},
    resultRef: null,
    errorCode,
    errorDetailRef: toErrorDetailRef(detail),
    retryable: RETRYABLE_WITHOUT_READBACK.has(errorCode),
    requiresReadbackBeforeRetry: REQUIRES_READBACK_BEFORE_RETRY.has(errorCode),
    durationMs: Date.now() - startedAt,
  });

  // 1. Registry lookup. Uses the registry's own read (which applies its own
  //    org-membership check) rather than a local SELECT.
  let entry: CapabilityRegistryEntry | null;
  try {
    entry = await getCapabilityVersion(capabilityId, capabilityVersion, actorId, organizationId);
  } catch (error) {
    return fail(
      'CAPABILITY_INTERNAL_ERROR',
      error instanceof Error ? error.message : String(error),
      null
    );
  }
  if (!entry) return fail('CAPABILITY_NOT_FOUND', 'capability_registry_row_missing', null);

  // 2. Lifecycle / health gate.
  if (entry.lifecycle !== 'ACTIVE') {
    return fail('CAPABILITY_UNAVAILABLE', `lifecycle_${entry.lifecycle}`, entry.providerType);
  }
  if (entry.health === 'UNHEALTHY') {
    return fail('CAPABILITY_UNAVAILABLE', 'health_unhealthy', entry.providerType);
  }

  const binding = bindings.get(bindingKey(capabilityId, capabilityVersion));
  if (!binding) {
    // doc 05 §4: a capability is active only when its ADAPTER is present. A row
    // marked ACTIVE with no binding is a configuration error, not a 404.
    return fail('CAPABILITY_UNAVAILABLE', 'capability_binding_missing', entry.providerType);
  }
  const adapter = ADAPTERS[binding.kind];
  if (!adapter) {
    return fail('CAPABILITY_UNAVAILABLE', 'capability_adapter_not_implemented', entry.providerType);
  }

  // 3. Idempotency, BEFORE dispatch. Delegated to capabilityRegistryService's
  //    public API — the digest of the request payload is part of the record
  //    there, so replaying the same key with a DIFFERENT payload throws
  //    idempotency_key_conflict instead of silently suppressing real work.
  try {
    const idempotency = await recordIdempotencyKeyCheck(
      {
        capabilityRegistryId: entry.capabilityRegistryId,
        idempotencyKey,
        requestPayload: envelope.payload ?? {},
        actorId,
      },
      organizationId
    );
    if (idempotency.isDuplicate) {
      return {
        outcome: 'DUPLICATE_SUPPRESSED',
        commandId,
        capabilityId,
        capabilityVersion,
        providerType: entry.providerType,
        output: {},
        resultRef: null,
        errorCode: null,
        errorDetailRef: null,
        retryable: false,
        requiresReadbackBeforeRetry: false,
        durationMs: Date.now() - startedAt,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'idempotency_key_conflict') {
      // Same key, different payload — a caller bug, and the one case where
      // suppressing would hide real work.
      return fail('CAPABILITY_INPUT_INVALID', message, entry.providerType);
    }
    return fail('CAPABILITY_INTERNAL_ERROR', message, entry.providerType);
  }

  // 4. Dispatch. A throwing adapter is itself a bug (the contract says map, do
  //    not throw), so it is caught and classified rather than propagated.
  let invocation: AdapterInvocationResult;
  try {
    invocation = await adapter.execute({ ...envelope, commandId }, binding);
  } catch (error) {
    invocation = {
      ok: false,
      errorCode: 'CAPABILITY_INTERNAL_ERROR',
      errorDetail: error instanceof Error ? error.message : String(error),
    };
  }

  const errorCode = invocation.ok ? null : invocation.errorCode ?? 'CAPABILITY_INTERNAL_ERROR';
  const result: CapabilityExecutionResult = {
    outcome: invocation.ok ? 'SUCCEEDED' : 'FAILED',
    commandId,
    capabilityId,
    capabilityVersion,
    providerType: entry.providerType,
    output: invocation.ok ? invocation.output ?? {} : {},
    resultRef: invocation.ok ? invocation.resultRef ?? null : null,
    errorCode,
    errorDetailRef: invocation.ok ? null : toErrorDetailRef(invocation.errorDetail),
    retryable: errorCode ? RETRYABLE_WITHOUT_READBACK.has(errorCode) : false,
    requiresReadbackBeforeRetry: errorCode
      ? REQUIRES_READBACK_BEFORE_RETRY.has(errorCode) &&
        // A provider that honours an idempotency header makes the unknown
        // outcome safe to retry directly; that is the entire value of the
        // header, and it is the binding — not the caller — that knows.
        !(binding.kind === 'HTTP_API' && Boolean(binding.idempotencyHeader))
      : false,
    durationMs: Date.now() - startedAt,
  };

  // 5. Audit, in its own short transaction. See the header for why it is not in
  //    the caller's.
  try {
    await withPgTransaction(async (client) => {
      await publishEvent(client, {
        eventType: result.outcome === 'SUCCEEDED' ? 'capability.invoked' : 'capability.invocation_failed',
        organizationId,
        projectId: optionalTrimmed(envelope.projectId),
        aggregateType: CAPABILITY_AGGREGATE_TYPE,
        aggregateId: entry.capabilityRegistryId,
        caseId: optionalTrimmed(envelope.caseId),
        runId: optionalTrimmed(envelope.runId),
        nodeRunId: optionalTrimmed(envelope.nodeRunId),
        attemptId: optionalTrimmed(envelope.attemptId),
        actorUserId:
          envelope.actor.type === 'HUMAN' ? actorId : `${SYSTEM_ACTOR_ADAPTER}:${envelope.actor.type.toLowerCase()}`,
        correlationId: optionalTrimmed(envelope.correlationId),
        causationId: optionalTrimmed(envelope.causationId),
        redactedSummary: redact({
          capabilityId,
          capabilityVersion,
          providerType: entry.providerType,
          operationClass: entry.operationClass,
          effectClass: entry.effectClass,
          outcome: result.outcome,
          errorCode: result.errorCode,
          durationMs: result.durationMs,
          requiresReadbackBeforeRetry: result.requiresReadbackBeforeRetry,
        }),
        // The digest, not the detail — the event carries no provider text.
        payloadRef: result.errorDetailRef,
      });
    });
  } catch (error) {
    // The effect already happened and cannot be undone by throwing here.
    logger.error(
      `[capabilityAdapter] failed to record audit event for ${capabilityId}@${capabilityVersion}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return result;
}
