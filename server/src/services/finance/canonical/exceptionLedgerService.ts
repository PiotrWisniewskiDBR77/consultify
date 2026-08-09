/**
 * Finance v3 canonical — exception / reconciliation ledger service.
 *
 * Gate C, WP-C02 "compatibility services". Wraps the append-only
 * `finance_exceptions` table and its `finance_exceptions_current` view
 * (migration `20260809_finance_v3_b05_exception_ledger.sql`), per
 * `docs/validation/finance-v3/generated/gate-b/WP-B05_exception_ledger_ADR.md`.
 *
 * Every state change is a NEW row sharing `exception_group_id` with the
 * original `RAISED` row — never an `UPDATE` (the DB append-only trigger
 * would reject one anyway; this service does not attempt one).
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';

export type ExceptionEventType = 'RAISED' | 'ACCEPTED' | 'WAIVED' | 'RESOLVED' | 'ESCALATED' | 'REOPENED' | 'EXPIRED';
export type ExceptionSeverity = 'INFO' | 'WARNING' | 'MATERIAL' | 'CRITICAL_DATA' | 'SECURITY';
export type ExceptionBlockingCategory = 'TENANT_BREACH' | 'UNDEFINED_MATH';
export type ExceptionCurrentState = 'OPEN' | 'ACCEPTED' | 'RESOLVED' | 'WAIVED';

export interface FinanceExceptionRow {
  id: string;
  exception_group_id: string;
  organization_id: string;
  artifact_id: string;
  business_version_id: string | null;
  working_revision_id: string | null;
  event_type: ExceptionEventType;
  severity: ExceptionSeverity;
  blocking_category: ExceptionBlockingCategory | null;
  source_ref: unknown;
  expected: string | null;
  observed: string | null;
  delta: string | null;
  unit: string | null;
  reason_code: string | null;
  reason: string | null;
  dedup_key: string | null;
  owner: string | null;
  raised_by: string | null;
  accepted_by: string | null;
  expiry: string | null;
  evidence: unknown;
  created_at: string;
  created_by: string | null;
}

export interface FinanceExceptionCurrentRow extends FinanceExceptionRow {
  state: ExceptionCurrentState;
}

export interface RaiseExceptionParams {
  organizationId: string;
  artifactId: string;
  businessVersionId?: string | null;
  workingRevisionId?: string | null;
  severity: ExceptionSeverity;
  blockingCategory?: ExceptionBlockingCategory | null;
  sourceRef: Record<string, unknown>;
  expected?: number | null;
  observed?: number | null;
  delta?: number | null;
  unit?: string | null;
  reasonCode?: string | null;
  dedupKey?: string | null;
  owner?: string | null;
  raisedBy: string;
  evidence?: Record<string, unknown> | null;
}

export type RaiseExceptionResult =
  | { ok: true; exception: FinanceExceptionRow }
  | { ok: false; code: 'BLOCKING_CATEGORY_REQUIRED' | 'BLOCKING_CATEGORY_FORBIDDEN'; message: string };

/** RAISED — the first event of a new exception_group. `id` doubles as `exception_group_id`. */
export async function raise(params: RaiseExceptionParams): Promise<RaiseExceptionResult> {
  // Mirror chk_finance_exceptions_blocking_category app-side for a typed error
  // instead of a raw 23514 constraint-violation surfacing to the caller.
  if (params.severity === 'SECURITY' && !params.blockingCategory) {
    return { ok: false, code: 'BLOCKING_CATEGORY_REQUIRED', message: 'SECURITY severity requires blockingCategory' };
  }
  if (params.severity !== 'SECURITY' && params.blockingCategory) {
    return { ok: false, code: 'BLOCKING_CATEGORY_FORBIDDEN', message: 'blockingCategory is only valid for SECURITY severity' };
  }

  const id = uuidv4();
  const exception = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceExceptionRow>(
      `INSERT INTO finance_exceptions (
         id, exception_group_id, organization_id, artifact_id, business_version_id, working_revision_id,
         event_type, severity, blocking_category, source_ref, expected, observed, delta, unit,
         reason_code, dedup_key, owner, raised_by, evidence, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, 'RAISED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        id,
        id,
        params.organizationId,
        params.artifactId,
        params.businessVersionId ?? null,
        params.workingRevisionId ?? null,
        params.severity,
        params.blockingCategory ?? null,
        JSON.stringify(params.sourceRef),
        params.expected ?? null,
        params.observed ?? null,
        params.delta ?? null,
        params.unit ?? null,
        params.reasonCode ?? null,
        params.dedupKey ?? null,
        params.owner ?? null,
        params.raisedBy,
        params.evidence ? JSON.stringify(params.evidence) : null,
        params.raisedBy,
      ]
    )
  );
  if (!exception) throw new Error('finance_exceptions RAISED insert returned no row');
  return { ok: true, exception };
}

export interface FollowOnEventParams {
  organizationId: string;
  exceptionGroupId: string;
  actorId: string;
  reason: string;
  /** WAIVED above INFO requires an expiry (chk_finance_exceptions_expiry_required). */
  expiry?: string | null;
}

export type FollowOnEventResult =
  | { ok: true; exception: FinanceExceptionRow }
  | { ok: false; code: 'GROUP_NOT_FOUND' | 'NOT_OPEN' | 'EXPIRY_REQUIRED'; message: string };

async function insertFollowOnEvent(
  eventType: Exclude<ExceptionEventType, 'RAISED'>,
  params: FollowOnEventParams,
  extra: { acceptedBy?: string | null; expiry?: string | null } = {}
): Promise<FollowOnEventResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<FinanceExceptionCurrentRow>(
      `SELECT * FROM finance_exceptions_current WHERE organization_id = ? AND exception_group_id = ?`,
      [params.organizationId, params.exceptionGroupId]
    );
    if (!current) return { ok: false, code: 'GROUP_NOT_FOUND', message: 'Exception group not found' };
    if (current.state !== 'OPEN') {
      return { ok: false, code: 'NOT_OPEN', message: `Exception is ${current.state}, not OPEN` };
    }
    if (eventType === 'WAIVED' && current.severity !== 'INFO' && !extra.expiry) {
      return { ok: false, code: 'EXPIRY_REQUIRED', message: 'WAIVED above INFO severity requires an expiry' };
    }

    const inserted = await tx.queryOne<FinanceExceptionRow>(
      `INSERT INTO finance_exceptions (
         id, exception_group_id, organization_id, artifact_id, business_version_id, working_revision_id,
         event_type, severity, blocking_category, source_ref, reason, owner, accepted_by, expiry, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        uuidv4(),
        params.exceptionGroupId,
        params.organizationId,
        current.artifact_id,
        current.business_version_id,
        current.working_revision_id,
        eventType,
        current.severity,
        current.blocking_category,
        JSON.stringify(current.source_ref),
        params.reason,
        current.owner,
        extra.acceptedBy ?? null,
        extra.expiry ?? null,
        params.actorId,
      ]
    );
    if (!inserted) throw new Error(`finance_exceptions ${eventType} insert returned no row`);
    return { ok: true, exception: inserted };
  });
}

/** ACCEPTED — risk acknowledged, no further action required. */
export async function accept(params: FollowOnEventParams): Promise<FollowOnEventResult> {
  return insertFollowOnEvent('ACCEPTED', params, { acceptedBy: params.actorId });
}

/** WAIVED — temporarily suppressed; `finance_exceptions_current`'s state reverts to OPEN once `expiry` passes. */
export async function waive(params: FollowOnEventParams): Promise<FollowOnEventResult> {
  return insertFollowOnEvent('WAIVED', params, { acceptedBy: params.actorId, expiry: params.expiry ?? null });
}

/** RESOLVED — underlying cause fixed. */
export async function resolve(params: FollowOnEventParams): Promise<FollowOnEventResult> {
  return insertFollowOnEvent('RESOLVED', params, { acceptedBy: params.actorId });
}

export async function getCurrent(organizationId: string, exceptionGroupId: string): Promise<FinanceExceptionCurrentRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceExceptionCurrentRow>(
      `SELECT * FROM finance_exceptions_current WHERE organization_id = ? AND exception_group_id = ?`,
      [organizationId, exceptionGroupId]
    )
  );
}

export async function listOpen(organizationId: string, artifactId?: string): Promise<FinanceExceptionCurrentRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FinanceExceptionCurrentRow>(
      artifactId
        ? `SELECT * FROM finance_exceptions_current WHERE organization_id = ? AND artifact_id = ? AND state = 'OPEN' ORDER BY created_at DESC`
        : `SELECT * FROM finance_exceptions_current WHERE organization_id = ? AND state = 'OPEN' ORDER BY created_at DESC`,
      artifactId ? [organizationId, artifactId] : [organizationId]
    )
  );
}
