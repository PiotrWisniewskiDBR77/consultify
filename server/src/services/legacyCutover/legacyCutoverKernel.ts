/**
 * CLAUDE-NEXT-LEGACY-CUTOVER / T13 — one guard kernel for every domain.
 *
 * Consultify grew two independent cutover guards (`financeLegacyCutover.ts`,
 * `partnerLegacyCutover.ts`) which disagree on the things that matter most:
 * the partner guard records no tenant and has no idempotency, so partner
 * telemetry cannot answer "does any tenant still use this writer" — the only
 * question that authorizes retiring a writer. Adding a third, fourth and ninth
 * hand-written variant for the remaining domains would multiply that drift.
 *
 * This kernel therefore owns the five behaviours the Definition of Done demands,
 * once, for all domains:
 *
 *  1. TENANT ISOLATION — every observation is attributed to a resolved tenant or
 *     is explicitly marked unresolved. It is never attributed to a guessed one.
 *  2. IDEMPOTENCY — a retried request with the same `x-request-id` records one
 *     row, enforced in the database, not in application memory.
 *  3. FAIL-CLOSED TELEMETRY — a telemetry outage can never re-open a disabled
 *     writer. The block is decided before, and independently of, the recording.
 *  4. EXPLICIT REFUSAL — a disabled writer answers 410 with its canonical
 *     successor, or 409 when the specific record has no canonical identity yet
 *     (cutting it over would strand the record, so we refuse differently).
 *  5. NARROW, NON-DESTRUCTIVE ROLLBACK — re-enabling is per writer id, opt-in
 *     by environment variable, and recorded. It restores a route; it never
 *     rewrites or deletes data.
 *
 * A writer that is not `disabled` is never blocked by this kernel. Observation
 * is not enforcement: `observed` and `protected` writers keep working exactly as
 * before, which is what makes deploying the kernel safe ahead of any retirement.
 */

import type { NextFunction, Request, Response } from 'express';

import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { resolveCanonicalIdentity, type CanonicalIdentityStatus } from './canonicalIdentityBridge.js';
import {
  completeLegacyCutoverIntent,
  registerLegacyCutoverIntent,
  type LegacyIntentTerminalResult,
} from './legacyCutoverIntentService.js';

export type LegacyWriterState =
  /** Returns 410/409 by default today. */
  | 'disabled'
  /** Reachable, but a canonical successor exists and is proven; awaiting retirement authorization. */
  | 'protected'
  /** Reachable; recorded only. No successor proof yet. */
  | 'observed'
  /** Retiring it would require editing an integrator-owned file or an owner decision. */
  | 'owner-blocked';

export type LegacyAccessKind =
  | 'legacy_read'
  | 'legacy_uncovered_writer'
  | 'legacy_writer_blocked'
  | 'legacy_identity_unmapped'
  | 'rollback_writer';

export interface LegacyWriterRule {
  /** Stable inventory id, e.g. `FIN-W01`. Used as the rollback unit and report key. */
  writerId: string;
  method: string;
  /** Matched against the ROUTER-LOCAL path, because the guard runs on `router.use()`. */
  path: RegExp;
  state: LegacyWriterState;
  /** Canonical successor route. Required for `disabled`; informational otherwise. */
  successor: string | null;
  /** Legacy table this writer mutates, when it addresses a single record. */
  legacyTable?: string;
  /** Extracts the legacy record id from the router-local path. */
  legacyIdFromPath?: (path: string) => string;
  /**
   * Who actually enforces a `disabled` state.
   *
   * `kernel` (the default) — this guard refuses the request, and the kernel's
   * rollback variables are the operative lever.
   *
   * `domain` — the writer already refuses through a mechanism of its own (for
   * example the audit program writers, which check
   * `AUDIT_PROGRAM_LEGACY_WRITES_ENABLED` inside the handler). The registry
   * records them as `disabled` because that is the true state of the system,
   * but the kernel does NOT add a second gate: doing so would advertise a
   * rollback lever that cannot actually restore the route, since the domain's
   * own check would still refuse it. Name the real lever in `enforcedByEnv`.
   */
  enforcedBy?: 'kernel' | 'domain';
  /** The operative rollback variable when `enforcedBy` is `domain`. */
  enforcedByEnv?: string;
  /** Human-readable reason, surfaced in the report. */
  reason: string;
}

export interface LegacyCutoverDomainConfig {
  domain: string;
  /** Domain-wide emergency switch. Coarse; prefer the per-writer variable. */
  rollbackEnv: string;
  /** Comma-separated writer ids to re-enable. This is the narrow rollback unit. */
  rollbackWritersEnv: string;
  /** `code` returned on refusal, e.g. `FINANCE_LEGACY_WRITER_DISABLED`. */
  disabledCode: string;
  /** `code` returned when the record has no canonical identity yet. */
  unmappedCode: string;
  /** Documented bridge endpoint for clients that must translate an id. */
  idBridge?: string;
  /**
   * Whether to record GETs that match no inventoried writer rule. Default true,
   * which is what the Finance and Partner guards already did. Set false on a
   * high-volume public mount, where one telemetry INSERT per anonymous read is
   * write amplification bought for very little: an unmatched read cannot be
   * attributed to a writer, and on an unauthenticated mount it cannot be
   * attributed to a tenant either, so the row answers no retirement question.
   * Reads that DO match a rule, and every write, are always recorded.
   */
  recordUnmatchedReads?: boolean;
  writers: LegacyWriterRule[];
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function normalizeMethod(method: unknown): string {
  return String(method || '').toUpperCase();
}

export function normalizePath(path: unknown): string {
  return String(path || '/').split('?')[0] || '/';
}

export function findWriterRule(
  config: LegacyCutoverDomainConfig,
  method: unknown,
  path: unknown
): LegacyWriterRule | null {
  const normalizedMethod = normalizeMethod(method);
  const normalizedPath = normalizePath(path);
  return (
    config.writers.find(
      (rule) => rule.method === normalizedMethod && rule.path.test(normalizedPath)
    ) || null
  );
}

/**
 * Rollback is deliberately awkward to trigger: an operator must name the exact
 * writer id, or flip the whole domain. Neither is a default, neither is implied
 * by any other flag, and both are recorded on every subsequent call.
 */
export function rollbackDecision(
  config: LegacyCutoverDomainConfig,
  writerId: string,
  env: NodeJS.ProcessEnv = process.env
): { enabled: boolean; scope: 'writer' | 'domain' | 'none' } {
  const named = String(env[config.rollbackWritersEnv] || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (named.includes(writerId)) return { enabled: true, scope: 'writer' };
  if (env[config.rollbackEnv] === 'true') return { enabled: true, scope: 'domain' };
  return { enabled: false, scope: 'none' };
}

interface ResolvedTenant {
  organizationId: string | null;
  userId: string | null;
  resolution: 'resolved' | 'unresolved';
}

/**
 * Reads the tenant from whichever authentication shape the mount happens to
 * use. It never invents one: an unauthenticated or context-less call is
 * recorded as `unresolved`, which keeps it out of every retirement query
 * instead of silently inflating some tenant's usage count.
 */
export function resolveTenant(req: Request): ResolvedTenant {
  const anyReq = req as any;
  const organizationId =
    String(
      anyReq?.v8Context?.organizationId ||
        anyReq?.user?.organizationId ||
        anyReq?.organizationId ||
        ''
    ).trim() || null;
  const userId =
    String(anyReq?.v8Context?.userId || anyReq?.user?.id || anyReq?.userId || '').trim() || null;
  return {
    organizationId,
    userId,
    resolution: organizationId ? 'resolved' : 'unresolved',
  };
}

export interface RecordUsageInput {
  domain: string;
  writerId: string | null;
  organizationId: string | null;
  tenantResolution: 'resolved' | 'unresolved';
  requestId: string | null;
  userId: string | null;
  method: string;
  routePath: string;
  accessKind: LegacyAccessKind;
  successorPath: string | null;
  legacyTable: string | null;
  legacyId: string | null;
  canonicalArtifactId: string | null;
  canonicalBusinessVersionId: string | null;
  canonicalWorkingRevisionId: string | null;
  identityStatus: CanonicalIdentityStatus;
}

/**
 * Writes one observation. `fallback: false` matters: `DbPromise` otherwise
 * swallows SQL errors and reports success, which would turn a broken telemetry
 * table into a silently empty one — and an empty table reads exactly like
 * "nobody uses this writer", the false green that authorizes a bad retirement.
 */
export async function recordLegacyUsage(input: RecordUsageInput): Promise<void> {
  await DbPromise.run(
    `INSERT INTO legacy_cutover_usage_events
       (domain, writer_id, source, organization_id, tenant_resolution, request_id, user_id,
        method, route_path, access_kind, successor_path, legacy_table, legacy_id,
        canonical_artifact_id, canonical_business_version_id, canonical_working_revision_id,
        identity_status)
     VALUES (?,?,'runtime',?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT DO NOTHING`,
    [
      input.domain,
      input.writerId,
      input.organizationId,
      input.tenantResolution,
      input.requestId,
      input.userId,
      input.method,
      input.routePath,
      input.accessKind,
      input.successorPath,
      input.legacyTable,
      input.legacyId,
      input.canonicalArtifactId,
      input.canonicalBusinessVersionId,
      input.canonicalWorkingRevisionId,
      input.identityStatus,
    ],
    { fallback: false }
  );
}

/**
 * Builds the express middleware for one domain. Mount with `router.use(...)`
 * BEFORE the leaf routes, so a disabled writer never reaches its handler.
 */
export function createLegacyCutoverGuard(config: LegacyCutoverDomainConfig) {
  return async function legacyCutoverGuard(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const method = normalizeMethod(req.method);
    // Matching uses the ROUTER-LOCAL path, because Express strips the mount
    // prefix for path-mounted middleware. Recording uses the FULL path: the same
    // legacy writer is often reachable through two mounts (Finance model
    // approval is reachable at both /api/v8/finance and /api/financial-modeling)
    // and a router-local path would silently merge the two doors into one row.
    const routePath = normalizePath((req as any).path);
    const recordedPath = `${String((req as any).baseUrl || '')}${routePath}` || routePath;
    const rule = findWriterRule(config, method, routePath);
    const tenant = resolveTenant(req);
    const requestId = String(req.headers?.['x-request-id'] || '').trim() || null;
    const legacyTable = rule?.legacyTable || null;
    const legacyId = rule?.legacyIdFromPath ? rule.legacyIdFromPath(routePath).trim() || null : null;

    // --- decision, taken before any I/O that could fail -------------------
    const rollback = rule ? rollbackDecision(config, rule.writerId) : { enabled: false, scope: 'none' as const };
    // A writer whose refusal is enforced by its own domain mechanism is recorded
    // as disabled but not gated again here — see `enforcedBy`.
    const isDisabled =
      rule?.state === 'disabled' && (rule.enforcedBy ?? 'kernel') === 'kernel' && !rollback.enabled;

    // --- identity, best effort; never allowed to change the decision ------
    let identity = {
      status: 'not_applicable' as CanonicalIdentityStatus,
      artifactId: null as string | null,
      businessVersionId: null as string | null,
      workingRevisionId: null as string | null,
      reason: null as string | null,
    };
    if (legacyTable && legacyId) {
      try {
        identity = await resolveCanonicalIdentity({
          domain: config.domain,
          organizationId: tenant.organizationId,
          legacyTable,
          legacyId,
        });
      } catch (error) {
        logger.error(`[LegacyCutover:${config.domain}] identity resolution failed`, error);
      }
    }

    // A record with no canonical counterpart must NOT be told "this moved" —
    // there is nowhere for it to move to. 409 says: the route is retired for
    // migrated records, this record is not migrated, run the backfill.
    const strandedRecord =
      isDisabled && (identity.status === 'not_migrated' || identity.status === 'quarantined');

    const accessKind: LegacyAccessKind = isDisabled
      ? strandedRecord
        ? 'legacy_identity_unmapped'
        : 'legacy_writer_blocked'
      : rule && rollback.enabled
        ? 'rollback_writer'
        : READ_METHODS.has(method)
          ? 'legacy_read'
          : 'legacy_uncovered_writer';

    // See `recordUnmatchedReads`: an anonymous GET that matches no writer rule
    // answers no retirement question, so on mounts that opt out it is not worth
    // one INSERT per request. Writes and rule-matching reads are always recorded.
    if (!rule && config.recordUnmatchedReads === false && READ_METHODS.has(method)) {
      next();
      return;
    }

    const usage: RecordUsageInput = {
      domain: config.domain,
      writerId: rule?.writerId || null,
      organizationId: tenant.organizationId,
      tenantResolution: tenant.resolution,
      requestId,
      userId: tenant.userId,
      method,
      routePath: recordedPath,
      accessKind,
      successorPath: rule?.successor || null,
      legacyTable,
      legacyId,
      canonicalArtifactId: identity.artifactId,
      canonicalBusinessVersionId: identity.businessVersionId,
      canonicalWorkingRevisionId: identity.workingRevisionId,
      identityStatus: identity.status,
    };

    let intentId: string;
    try {
      intentId = (await registerLegacyCutoverIntent(
        usage,
        String(req.headers?.['idempotency-key'] || req.headers?.['x-idempotency-key'] || '').trim() || null
      )).intentId;
    } catch (error) {
      logger.error(`[LegacyCutover:${config.domain}] durable intent registration failed`, error);
      res.status(503).json({
        success: false,
        code: 'LEGACY_CUTOVER_INTENT_UNAVAILABLE',
        message: 'Legacy writer intent could not be registered',
      });
      return;
    }

    try {
      await recordLegacyUsage(usage);
    } catch (error) {
      // Telemetry is an observer, never a gate. A disabled writer stays
      // disabled below whether or not this insert succeeded; an available one
      // stays available so that a broken telemetry table cannot cause a second,
      // larger outage.
      logger.error(`[LegacyCutover:${config.domain}] failed to persist usage telemetry`, error);
    }

    if (!isDisabled) {
      let completed = false;
      const complete = (source: 'finish' | 'close') => {
        if (completed) return;
        completed = true;
        const responseFinished = Boolean((res as Response & { writableFinished?: boolean }).writableFinished);
        const result: LegacyIntentTerminalResult =
          source === 'close' && !responseFinished
            ? 'aborted_unknown'
            : rule && rollback.enabled
              ? 'rollback_passed'
              : 'passed';
        void completeLegacyCutoverIntent({
          intentId,
          terminalStatus: Number.isFinite(res.statusCode) ? res.statusCode : null,
          terminalResult: result,
          source,
        }).catch((error) => logger.error(`[LegacyCutover:${config.domain}] intent completion failed`, error));
      };
      res.once('finish', () => complete('finish'));
      res.once('close', () => complete('close'));
      next();
      return;
    }

    if (strandedRecord) {
      await completeLegacyCutoverIntent({
        intentId,
        terminalStatus: 409,
        terminalResult: 'refused_identity_unmapped',
        source: 'guard',
      });
      res.status(409).json({
        success: false,
        code: config.unmappedCode,
        writerId: rule?.writerId,
        message:
          'This legacy writer is retired for migrated records, but this record has no canonical identity yet. Run the canonical backfill before retrying.',
        successor: rule?.successor || null,
        identityStatus: identity.status,
        identityReason: identity.reason,
        idBridge: config.idBridge || null,
        rollbackEnv: config.rollbackEnv,
        rollbackWritersEnv: config.rollbackWritersEnv,
      });
      return;
    }

    await completeLegacyCutoverIntent({
      intentId,
      terminalStatus: 410,
      terminalResult: 'refused_gone',
      source: 'guard',
    });
    res.status(410).json({
      success: false,
      code: config.disabledCode,
      writerId: rule?.writerId,
      message: 'This legacy writer has been cut over to its canonical successor.',
      successor: rule?.successor || null,
      canonicalArtifactId: identity.artifactId,
      canonicalBusinessVersionId: identity.businessVersionId,
      canonicalWorkingRevisionId: identity.workingRevisionId,
      idBridge: config.idBridge || null,
      rollbackEnv: config.rollbackEnv,
      rollbackWritersEnv: config.rollbackWritersEnv,
    });
  };
}
