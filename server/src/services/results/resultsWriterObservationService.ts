/**
 * Results writer observability — the ONLY writer into
 * `results_writer_observations` (migration 20261014).
 *
 * WHY THIS EXISTS
 * The legacy -> vNext Results cutover is an owner decision that must rest on
 * observed traffic, not on source-scanning. `recordWriterObservation` is a
 * side-channel that answers "which Results writers are actually used, by which
 * tenant, how often" without touching the business write it observes.
 *
 * HARD SEMANTICS (each one is enforced below, not merely documented)
 *
 * 1. The business write stays authoritative. This function is called AFTER the
 *    business write has succeeded and its return value is ignored by callers.
 *    It never throws into a handler, never changes an HTTP status, and never
 *    influences a business result.
 *
 * 2. Fail-OPEN for the operation, fail-LOUD in the log. A telemetry failure is
 *    swallowed for the caller but always surfaces as a structured
 *    `WRITER_OBS_WRITE_FAILED` error entry. Silent telemetry loss would make
 *    "zero observed usage" indistinguishable from "observability is broken" —
 *    the single most dangerous false signal for a cutover decision.
 *
 * 3. `DbPromise.run` defaults to `fallback: true`, which RESOLVES `{success:
 *    false}` instead of rejecting — i.e. it swallows write errors. This module
 *    therefore passes `fallback: false` explicitly, so a real DB failure
 *    reaches the catch below and produces the structured error. With the
 *    default, a broken ledger would look green forever.
 *
 * 4. Tenant and actor are caller-supplied but must be SERVER-RESOLVED values
 *    (authenticated session), never request-body fields. The body has no
 *    authority over attribution; see each call site.
 *
 * 5. Retry safety is the DB's job: `uq_results_writer_observation_correlated_op`
 *    over (correlation_id, writer_family, operation) plus `ON CONFLICT DO
 *    NOTHING` here means a retried, equally-correlated operation records
 *    exactly one row under concurrency.
 *
 * 6. No business content. The payload shape below cannot carry KPI values,
 *    names, or request bodies — there is deliberately no field for them.
 *
 * Retention and rollout of this ledger remain OWNER_DECISION.
 */
import { randomUUID } from 'crypto';

import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

/**
 * The five real Results writer surfaces. Mirrors the CHECK constraint in
 * migration 20261014 — adding a value here without the migration (or vice
 * versa) fails closed at insert time rather than recording a mislabelled row.
 */
export type ResultsWriterFamily =
  | 'legacy_kpi_crud'
  | 'kpi_reports'
  | 'vnext_kpi'
  | 'execution_results'
  | 'results_finance';

export interface RecordWriterObservationInput {
  /** Server-resolved tenant of the business write. Never from the body. */
  organizationId: string;
  /**
   * Server-resolved actor, or null for writers that legitimately run outside a
   * request scope (closure handoff, budget health export).
   */
  actorUserId?: string | null;
  writerFamily: ResultsWriterFamily;
  /** Stable operation label, e.g. 'createKpi'. */
  operation: string;
  /** Mount-qualified route, or a `service:` pseudo-endpoint. */
  endpoint: string;
  /**
   * Validated request correlation id. `undefined` when the request carried
   * none — a fresh id is minted so the NOT NULL column holds, which also
   * means such a call is (correctly) not dedupable against anything.
   */
  correlationId?: string | null;
}

/**
 * Minimal structural shape of an Express request — deliberately not the
 * express/AuthenticatedRequest type, so this service stays transport-agnostic
 * and unit-testable without a request object.
 */
export interface CorrelationCarrier {
  correlationId?: unknown;
  get?: (header: string) => string | undefined;
}

/**
 * Resolve the correlation id for an observation.
 *
 * Uses the SAME value `apiLoggingMiddleware` already attached to the request
 * and wrote to `api_logs.correlation_id` (TEXT, sanitized to
 * `[A-Za-z0-9._~-]`), so an observation can be joined back to its request log.
 *
 * Deliberately NOT `routes/resultsVnext/correlationId.ts`'s UUID-shape check:
 * that helper exists because `rvn_platform_events.correlation_id` is a
 * Postgres `UUID` column and must reject non-UUID input. This ledger's column
 * is TEXT, and dropping a real-but-non-UUID correlation id here would both
 * break the `api_logs` join and silently weaken retry dedupe (a dropped id is
 * replaced by a freshly minted one, which matches nothing).
 */
export function correlationIdFromRequest(req: CorrelationCarrier): string | undefined {
  const attached = req.correlationId;
  if (typeof attached === 'string' && attached.trim()) return attached.trim();

  const header = req.get?.('X-Correlation-ID');
  if (typeof header === 'string' && header.trim()) return header.trim();

  return undefined;
}

/** Structured outcome. Callers ignore it; tests assert on it. */
export type RecordWriterObservationResult =
  | { recorded: true; deduped: boolean }
  | { recorded: false; errorCode: 'WRITER_OBS_WRITE_FAILED' };

/**
 * Record one observation. Resolves — never rejects — so a caller can `void`
 * it without risking an unhandled rejection that would surface as a 500 on an
 * already-successful business operation.
 */
export async function recordWriterObservation(
  input: RecordWriterObservationInput
): Promise<RecordWriterObservationResult> {
  const correlationId = input.correlationId || randomUUID();

  try {
    const result = await DbPromise.run(
      `INSERT INTO results_writer_observations
         (organization_id, actor_user_id, writer_family, operation, endpoint, correlation_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (correlation_id, writer_family, operation) DO NOTHING`,
      [
        input.organizationId,
        input.actorUserId ?? null,
        input.writerFamily,
        input.operation,
        input.endpoint,
        correlationId,
      ],
      // See semantic 3 in the module doc: the default `fallback: true` would
      // resolve `{success:false}` on a real failure and this catch would never
      // run, so the structured error could never be emitted.
      { fallback: false }
    );

    // `changes === 0` means the unique index absorbed a retry of the same
    // correlated operation — a successful dedupe, not a failure.
    return { recorded: true, deduped: (result.changes ?? 0) === 0 };
  } catch (error) {
    logger.error('[ResultsWriterObs] observation write failed', {
      code: 'WRITER_OBS_WRITE_FAILED',
      writerFamily: input.writerFamily,
      operation: input.operation,
      endpoint: input.endpoint,
      organizationId: input.organizationId,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { recorded: false, errorCode: 'WRITER_OBS_WRITE_FAILED' };
  }
}

/**
 * Fire-and-forget wrapper for call sites inside a request handler.
 *
 * `recordWriterObservation` already resolves on every path, so this adds a
 * belt-and-braces `.catch` for a genuinely unexpected synchronous throw (e.g.
 * a module-level failure) and makes the fire-and-forget intent explicit at the
 * call site rather than leaving a bare floating promise in a route file.
 */
export function observeWriter(input: RecordWriterObservationInput): void {
  void recordWriterObservation(input).catch((error: unknown) => {
    logger.error('[ResultsWriterObs] observation dispatch failed', {
      code: 'WRITER_OBS_WRITE_FAILED',
      writerFamily: input.writerFamily,
      operation: input.operation,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
