/**
 * Finance v3 canonical — AP-08 Exception Inbox (query/aggregation layer).
 *
 * Program: `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 10 ("Exception inbox: tie-out fail, stale, compute failed,
 * review assigned, blocker, benchmark expired, unusual variance, import
 * conflict — z ownerem oraz deep linkiem").
 *
 * This module creates NO new table. `finance_exceptions` (WP-B05, Gate C —
 * `exceptionLedgerService.ts`) already IS the exception ledger with the full
 * severity/owner/reason/expiry model described in
 * `docs/validation/finance-v3/generated/gate-b/WP-B05_exception_ledger_ADR.md`
 * section 7 ("Query wzorce — Exception Inbox"). AP-08 fans that ADR's query
 * pattern out to the OTHER sources of "something needs attention" that exist
 * today, and deduplicates them into one list:
 *
 *   - `finance_exceptions_current` (WP-B05)                    -> tie_out_fail
 *   - `finance_business_versions.freshness`                    -> stale, compute_failed
 *   - `compute_jobs.status = 'failed'`                          -> compute_failed
 *   - `finance_comments` (AP-06, `commentService.ts`)           -> blocker, review_assigned
 *   - `finance_analysis_variance` (WP-D03)                      -> unusual_variance
 *
 * `benchmark_expired` and `import_conflict` are NOT implemented — see the
 * two `fetch*` stubs near the bottom of this file and
 * `docs/validation/finance-v3/generated/gate-d/AP-08_exception_inbox_report.md`
 * for why (no expiry column exists yet on `finance_analysis_benchmarks`; no
 * durable "rejected import" record exists anywhere for AP-02's stateless
 * preview/apply flow to have left behind).
 *
 * ---------------------------------------------------------------------------
 * Dedupe — "grouped by root cause, not by source table" (task requirement 1)
 * ---------------------------------------------------------------------------
 * Every raw entry is assigned a `groupKey`:
 *
 *   - business-version-scoped sources (tie_out_fail from finance_exceptions,
 *     stale / compute_failed from finance_business_versions.freshness) key
 *     on `bv:<business_version_id>::<normalized reason>`, where "normalized
 *     reason" prefers the machine-classifiable field each source already
 *     carries (`finance_exceptions.reason_code`, then `.reason`; a business
 *     version's `freshness_reason`) over any source-specific id. This is
 *     deliberate: it is EXACTLY what lets an explicit `finance_exceptions`
 *     row and a `STALE_SOURCE` freshness flag on the SAME business version,
 *     raised for the SAME underlying reason, collapse into one inbox entry
 *     instead of two (see the report's dedupe test).
 *   - everything else (comments, per-job compute failures, variance rows)
 *     keys on its own source-row id — these are not expected to coincide
 *     with anything else by design (a review comment's root cause IS that
 *     comment), so using free text (e.g. comment body) as the dedupe key
 *     would risk ACCIDENTAL merges of unrelated items that merely happen to
 *     share wording. Only the freshness/exception vocabulary is shared
 *     between two different source tables for the same underlying event.
 *
 * When two or more raw entries land in the same group, one representative
 * entry is kept (picked by `CATEGORY_PRIORITY` — an explicit, human-raised
 * `finance_exceptions` row outranks a derived freshness flag, which outranks
 * a derived compute-job failure, and so on), and the others are folded into
 * its `mergedCategories`/`sources` arrays so no provenance is lost.
 */

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import type { CellRef } from '../../../types/finance/CellRef.js';
import { cellRefKey } from '../../../types/finance/CellRef.js';
import type { ExceptionSeverity } from './exceptionLedgerService.js';

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

export const ExceptionInboxCategoryValues = [
  'tie_out_fail',
  'stale',
  'compute_failed',
  'review_assigned',
  'blocker',
  'benchmark_expired',
  'unusual_variance',
  'import_conflict',
] as const;
export type ExceptionInboxCategory = (typeof ExceptionInboxCategoryValues)[number];

/** Best-effort common severity scale — reuses `exceptionLedgerService`'s 5-level DEC-FIN-009 scale (WP-B05 section 2) for every category, even the ones with no `severity` column of their own (a fixed, documented default; see `FIXED_SEVERITY_BY_CATEGORY` below). */
export type ExceptionInboxSeverity = ExceptionSeverity;

export interface ExceptionInboxDeepLink {
  artifactId: string;
  businessVersionId: string | null;
  workingRevisionId: string | null;
  /** Present only for comment-anchored entries (blocker/review_assigned) whose comment carries an AP-00 CellRef anchor. */
  cellRef: CellRef | null;
  /** Raw passthrough of `finance_exceptions.source_ref` (WP-B05 section 8) for tie_out_fail entries — looser shape than CellRef, see that ADR section. */
  sourceRef: Record<string, unknown> | null;
  /** ADR WP-B05 section 7.3 URL shape: `/finance/artifacts/:artifactId[/versions/:businessVersionId]?...`. */
  url: string;
}

export interface ExceptionInboxSourceRef {
  category: ExceptionInboxCategory;
  table: string;
  id: string;
}

export interface ExceptionInboxEntry {
  /** Stable id for THIS merged entry — `<representative category>:<representative source id>`. */
  id: string;
  category: ExceptionInboxCategory;
  /** Includes `category` itself plus any other category merged into this entry by dedupe. */
  mergedCategories: ExceptionInboxCategory[];
  severity: ExceptionInboxSeverity;
  title: string;
  reason: string | null;
  owner: string | null;
  /** True when `owner` was defaulted (task requirement 4 — "dla wpisów bez explicit ownera przypisz do ostatniego edytora/twórcy business_version"), not read from an explicit owner field. */
  ownerIsDefault: boolean;
  /** Earliest `created_at` among the merged sources — "how long has this root cause existed". */
  createdAt: string;
  /** Latest `created_at` among the merged sources. */
  lastSeenAt: string;
  /** null when the category has no SLA policy (mirrors WP-B05 section 7.2 — "Info" has no SLA). */
  slaDueAt: string | null;
  artifactId: string;
  businessVersionId: string | null;
  deepLink: ExceptionInboxDeepLink;
  sources: ExceptionInboxSourceRef[];
}

export interface ListExceptionInboxOptions {
  artifactId?: string;
}

// ---------------------------------------------------------------------------
// Internal raw-entry shape (pre-dedupe)
// ---------------------------------------------------------------------------

interface RawInboxEntry {
  category: ExceptionInboxCategory;
  severity: ExceptionInboxSeverity;
  title: string;
  reasonRaw: string | null;
  /** Used to build the dedupe root-cause key; see file header. Distinct from `reasonRaw` only in that it is never null (falls back to a source-row-unique string). */
  causeKey: string;
  owner: string | null;
  ownerIsDefault: boolean;
  createdAt: string;
  artifactId: string;
  businessVersionId: string | null;
  workingRevisionId: string | null;
  cellRef: CellRef | null;
  sourceRef: Record<string, unknown> | null;
  extraDeepLinkParams: Record<string, string>;
  sourceTable: string;
  sourceId: string;
  /** review_assigned only — an explicit due date overrides the computed SLA window. */
  explicitSlaDueAt: string | null;
}

const CATEGORY_PRIORITY: readonly ExceptionInboxCategory[] = [
  'tie_out_fail',
  'compute_failed',
  'blocker',
  'review_assigned',
  'stale',
  'unusual_variance',
  'benchmark_expired',
  'import_conflict',
];

const SEVERITY_RANK: Record<ExceptionInboxSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  MATERIAL: 2,
  CRITICAL_DATA: 3,
  SECURITY: 4,
};

/** Fixed severity assigned to categories whose source table carries no severity column of its own (everything except tie_out_fail, which reuses the real `finance_exceptions.severity`). Documented, not derived — a future work package may want these configurable per-org. */
const FIXED_SEVERITY_BY_CATEGORY: Partial<Record<ExceptionInboxCategory, ExceptionInboxSeverity>> = {
  stale: 'WARNING',
  compute_failed: 'MATERIAL',
  blocker: 'MATERIAL',
  review_assigned: 'INFO',
  unusual_variance: 'WARNING',
};

/** WP-B05 section 7.2 SLA windows, reused verbatim (Info=none, Warning=30d, Material=5d, CriticalData=2d, Security=immediate). Calendar days, same simplification the ADR itself uses ("nie jest osobna kolumna ... wyliczana z created_at + domyślne okno"). */
const SLA_WINDOW_MS: Record<ExceptionInboxSeverity, number | null> = {
  INFO: null,
  WARNING: 30 * 24 * 60 * 60 * 1000,
  MATERIAL: 5 * 24 * 60 * 60 * 1000,
  CRITICAL_DATA: 2 * 24 * 60 * 60 * 1000,
  SECURITY: 0,
};

/**
 * Reuses the SAME `PROVISIONAL_PENDING_OWNER_DECISION` 5% placeholder WP-B05
 * section 5.3 / `statementReconciliationService.ts` already use for the
 * reconciliation-residual materiality gate — task instruction is explicit
 * ("nie wymyślaj nowego progu"). `unusual_variance` reuses the identical
 * number for the same reason: no second, competing materiality concept.
 */
export const UNUSUAL_VARIANCE_MATERIALITY_THRESHOLD_PCT = 0.05;

function normalizeCause(raw: string | null | undefined, fallback: string): string {
  const trimmed = (raw ?? '').trim().toLowerCase();
  return trimmed || fallback;
}

function buildDeepLinkUrl(params: {
  artifactId: string;
  businessVersionId: string | null;
  focus: string | null;
  period: string | null;
  entity: string | null;
  extra: Record<string, string>;
}): string {
  const base = `/finance/artifacts/${params.artifactId}${params.businessVersionId ? `/versions/${params.businessVersionId}` : ''}`;
  const qs = new URLSearchParams();
  if (params.focus) qs.set('focus', params.focus);
  if (params.period) qs.set('period', params.period);
  if (params.entity) qs.set('entity', params.entity);
  for (const [key, value] of Object.entries(params.extra)) qs.set(key, value);
  const qsStr = qs.toString();
  return qsStr ? `${base}?${qsStr}` : base;
}

function parseJsonbMaybe<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

// ---------------------------------------------------------------------------
// Source 1 — tie_out_fail: finance_exceptions_current, state=OPEN, severity != INFO
// (INFO is an auto-log terminal state per WP-B05 section 2 — "nie wymaga akcji").
// ---------------------------------------------------------------------------

interface TieOutFailRow {
  id: string;
  exception_group_id: string;
  artifact_id: string;
  business_version_id: string | null;
  working_revision_id: string | null;
  severity: ExceptionInboxSeverity;
  reason_code: string | null;
  reason: string | null;
  owner: string | null;
  source_ref: unknown;
  created_at: string;
}

async function fetchTieOutFailEntries(organizationId: string, artifactId?: string): Promise<RawInboxEntry[]> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<TieOutFailRow>(
      `SELECT id, exception_group_id, artifact_id, business_version_id, working_revision_id,
              severity, reason_code, reason, owner, source_ref, created_at
         FROM finance_exceptions_current
        WHERE organization_id = ? AND state = 'OPEN' AND severity != 'INFO'
        ${artifactId ? 'AND artifact_id = ?' : ''}
        ORDER BY created_at ASC`,
      artifactId ? [organizationId, artifactId] : [organizationId]
    )
  );

  return rows.map((row) => {
    const sourceRef = parseJsonbMaybe<Record<string, unknown>>(row.source_ref);
    const focus = (sourceRef?.cell_ref as string | undefined) ?? (sourceRef?.statement_line_code as string | undefined) ?? null;
    const period = (sourceRef?.period_id as string | undefined) ?? null;
    const entity = (sourceRef?.entity_id as string | undefined) ?? null;
    const entry: RawInboxEntry & { __focus: string | null; __period: string | null; __entity: string | null } = {
      category: 'tie_out_fail',
      severity: row.severity,
      title: row.reason_code ? `Exception: ${row.reason_code}` : `Exception (${row.severity})`,
      reasonRaw: row.reason_code ?? row.reason,
      causeKey: normalizeCause(row.reason_code ?? row.reason, `exception:${row.id}`),
      owner: row.owner,
      ownerIsDefault: !row.owner,
      createdAt: row.created_at,
      artifactId: row.artifact_id,
      businessVersionId: row.business_version_id,
      workingRevisionId: row.working_revision_id,
      cellRef: null,
      sourceRef,
      extraDeepLinkParams: { exception: row.exception_group_id },
      sourceTable: 'finance_exceptions',
      sourceId: row.id,
      explicitSlaDueAt: null,
      __focus: focus,
      __period: period,
      __entity: entity,
    };
    return entry;
  });
}

// ---------------------------------------------------------------------------
// Source 2 — stale / compute_failed (business-version freshness)
// ---------------------------------------------------------------------------

interface FreshnessRow {
  business_version_id: string;
  artifact_id: string;
  freshness: string;
  freshness_reason: string | null;
  stale_since: string | null;
  created_by: string | null;
  updated_at: string;
  current_editor: string | null;
}

async function fetchFreshnessEntries(
  organizationId: string,
  category: 'stale' | 'compute_failed',
  freshnessValues: readonly string[],
  artifactId?: string
): Promise<RawInboxEntry[]> {
  const placeholders = freshnessValues.map(() => '?').join(', ');
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FreshnessRow>(
      `SELECT fbv.business_version_id, fbv.artifact_id, fbv.freshness, fbv.freshness_reason,
              fbv.stale_since, fbv.created_by, fbv.updated_at,
              (SELECT wr.edited_by FROM finance_working_revisions wr
                WHERE wr.artifact_id = fbv.artifact_id AND wr.is_current = true
                LIMIT 1) AS current_editor
         FROM finance_business_versions fbv
        WHERE fbv.organization_id = ? AND fbv.freshness IN (${placeholders})
        ${artifactId ? 'AND fbv.artifact_id = ?' : ''}
        ORDER BY fbv.updated_at ASC`,
      artifactId ? [organizationId, ...freshnessValues, artifactId] : [organizationId, ...freshnessValues]
    )
  );

  return rows.map((row) => {
    const owner = row.current_editor ?? row.created_by ?? null;
    const createdAt = row.stale_since ?? row.updated_at;
    return {
      category,
      severity: FIXED_SEVERITY_BY_CATEGORY[category] as ExceptionInboxSeverity,
      title: category === 'stale' ? `Freshness: ${row.freshness}` : 'Compute failed (last known state)',
      reasonRaw: row.freshness_reason,
      causeKey: normalizeCause(row.freshness_reason, `${category}:${row.business_version_id}`),
      owner,
      ownerIsDefault: true, // finance_business_versions has no dedicated "owner" column — always defaulted (task requirement 4).
      createdAt,
      artifactId: row.artifact_id,
      businessVersionId: row.business_version_id,
      workingRevisionId: null,
      cellRef: null,
      sourceRef: null,
      extraDeepLinkParams: { reason: row.freshness_reason ?? row.freshness },
      sourceTable: 'finance_business_versions',
      sourceId: row.business_version_id,
      explicitSlaDueAt: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Source 3 — compute_failed (compute_jobs.status = 'failed')
// ---------------------------------------------------------------------------

interface ComputeJobFailedRow {
  id: string;
  input_artifact_id: string;
  job_type: string;
  error: string | null;
  requested_by_user_id: string;
  created_at: string;
  finished_at: string | null;
}

/**
 * Only the LATEST failed attempt per (artifact, job_type) shows up, and only
 * when no LATER attempt of the same (artifact, job_type) already SUCCEEDED
 * (i.e. the failure was actually resolved by a retry) — otherwise every
 * historical failed attempt an org ever had would permanently clutter the
 * inbox. A later QUEUED/RUNNING/FAILED attempt does not suppress the entry:
 * the job is still not resolved yet.
 */
async function fetchComputeJobFailedEntries(organizationId: string, artifactId?: string): Promise<RawInboxEntry[]> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<ComputeJobFailedRow>(
      `SELECT cj.id, cj.input_artifact_id, cj.job_type, cj.error, cj.requested_by_user_id, cj.created_at, cj.finished_at
         FROM compute_jobs cj
        WHERE cj.organization_id = ? AND cj.status = 'failed'
        ${artifactId ? 'AND cj.input_artifact_id = ?' : ''}
          AND NOT EXISTS (
            SELECT 1 FROM compute_jobs cj2
             WHERE cj2.organization_id = cj.organization_id
               AND cj2.input_artifact_id = cj.input_artifact_id
               AND cj2.job_type = cj.job_type
               AND cj2.status = 'succeeded'
               AND cj2.created_at > cj.created_at
          )
        ORDER BY cj.created_at ASC`,
      artifactId ? [organizationId, artifactId] : [organizationId]
    )
  );

  return rows.map((row) => ({
    category: 'compute_failed',
    severity: FIXED_SEVERITY_BY_CATEGORY.compute_failed as ExceptionInboxSeverity,
    title: `Compute job failed (${row.job_type})`,
    reasonRaw: row.error,
    // No business_version_id on compute_jobs (WP-B04 schema) — scoped to the artifact only, own job id as cause (see file header: not expected to dedupe with anything).
    causeKey: `job:${row.id}`,
    owner: row.requested_by_user_id,
    ownerIsDefault: false,
    createdAt: row.finished_at ?? row.created_at,
    artifactId: row.input_artifact_id,
    businessVersionId: null,
    workingRevisionId: null,
    cellRef: null,
    sourceRef: null,
    extraDeepLinkParams: { job: row.id },
    sourceTable: 'compute_jobs',
    sourceId: row.id,
    explicitSlaDueAt: null,
  }));
}

// ---------------------------------------------------------------------------
// Source 4 — blocker: unresolved is_blocking=true finance_comments (AP-06)
// ---------------------------------------------------------------------------

interface BlockingCommentRow {
  id: string;
  artifact_id: string;
  business_version_id: string;
  anchor: unknown;
  author_id: string;
  body: string;
  created_at: string;
  current_assignee: string | null;
}

async function fetchBlockerEntries(organizationId: string, artifactId?: string): Promise<RawInboxEntry[]> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<BlockingCommentRow>(
      `SELECT c.id, c.artifact_id, c.business_version_id, c.anchor, c.author_id, c.body, c.created_at,
              (SELECT a.assignee_id FROM finance_comment_assignments a
                WHERE a.comment_id = c.id ORDER BY a.assigned_at DESC LIMIT 1) AS current_assignee
         FROM finance_comments c
        WHERE c.organization_id = ? AND c.is_blocking = true AND c.resolved_at IS NULL
        ${artifactId ? 'AND c.artifact_id = ?' : ''}
        ORDER BY c.created_at ASC`,
      artifactId ? [organizationId, artifactId] : [organizationId]
    )
  );

  return rows.map((row) => {
    const anchor = parseJsonbMaybe<CellRef>(row.anchor);
    return {
      category: 'blocker',
      severity: FIXED_SEVERITY_BY_CATEGORY.blocker as ExceptionInboxSeverity,
      title: 'Blocking review comment',
      reasonRaw: row.body,
      causeKey: `comment:${row.id}`,
      owner: row.current_assignee ?? row.author_id,
      ownerIsDefault: !row.current_assignee,
      createdAt: row.created_at,
      artifactId: row.artifact_id,
      businessVersionId: row.business_version_id,
      workingRevisionId: null,
      cellRef: anchor,
      sourceRef: null,
      extraDeepLinkParams: { comment: row.id },
      sourceTable: 'finance_comments',
      sourceId: row.id,
      explicitSlaDueAt: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Source 5 — review_assigned: non-blocking, unresolved, actively-assigned comments (AP-06)
// ---------------------------------------------------------------------------

interface ReviewAssignedRow {
  id: string;
  artifact_id: string;
  business_version_id: string;
  anchor: unknown;
  body: string;
  created_at: string;
  assignee_id: string;
  due_date: string | null;
  assigned_at: string;
}

async function fetchReviewAssignedEntries(organizationId: string, artifactId?: string): Promise<RawInboxEntry[]> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<ReviewAssignedRow>(
      `SELECT c.id, c.artifact_id, c.business_version_id, c.anchor, c.body, c.created_at,
              a.assignee_id, a.due_date, a.assigned_at
         FROM finance_comments c
         JOIN LATERAL (
           SELECT assignee_id, due_date, assigned_at FROM finance_comment_assignments fa
            WHERE fa.comment_id = c.id ORDER BY fa.assigned_at DESC LIMIT 1
         ) a ON true
        WHERE c.organization_id = ? AND c.is_blocking = false AND c.resolved_at IS NULL
        ${artifactId ? 'AND c.artifact_id = ?' : ''}
        ORDER BY c.created_at ASC`,
      artifactId ? [organizationId, artifactId] : [organizationId]
    )
  );

  return rows.map((row) => {
    const anchor = parseJsonbMaybe<CellRef>(row.anchor);
    return {
      category: 'review_assigned',
      severity: FIXED_SEVERITY_BY_CATEGORY.review_assigned as ExceptionInboxSeverity,
      title: 'Review comment assigned',
      reasonRaw: row.body,
      causeKey: `comment:${row.id}`,
      owner: row.assignee_id,
      ownerIsDefault: false,
      createdAt: row.assigned_at,
      artifactId: row.artifact_id,
      businessVersionId: row.business_version_id,
      workingRevisionId: null,
      cellRef: anchor,
      sourceRef: null,
      extraDeepLinkParams: { comment: row.id },
      sourceTable: 'finance_comments',
      sourceId: row.id,
      explicitSlaDueAt: row.due_date,
    };
  });
}

// ---------------------------------------------------------------------------
// Source 6 — unusual_variance: finance_analysis_variance (WP-D03), open, over materiality
// ---------------------------------------------------------------------------

interface VarianceRow {
  id: string;
  business_version_id: string;
  artifact_id: string;
  entity_id: string | null;
  period_id: string | null;
  variance_pct: string | null;
  comment: string | null;
  owner: string | null;
  created_at: string;
}

async function fetchUnusualVarianceEntries(
  organizationId: string,
  materialityThresholdPct: number,
  artifactId?: string
): Promise<RawInboxEntry[]> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<VarianceRow>(
      `SELECT v.id, v.business_version_id, fbv.artifact_id, v.entity_id, v.period_id, v.variance_pct,
              v.comment, v.owner, v.created_at
         FROM finance_analysis_variance v
         JOIN finance_business_versions fbv
           ON fbv.business_version_id = v.business_version_id AND fbv.organization_id = v.organization_id
        WHERE v.organization_id = ? AND v.status NOT IN ('RESOLVED', 'ACCEPTED')
          AND v.variance_pct IS NOT NULL AND ABS(v.variance_pct) > ?
        ${artifactId ? 'AND fbv.artifact_id = ?' : ''}
        ORDER BY v.created_at ASC`,
      artifactId ? [organizationId, materialityThresholdPct, artifactId] : [organizationId, materialityThresholdPct]
    )
  );

  return rows.map((row) => ({
    category: 'unusual_variance',
    severity: FIXED_SEVERITY_BY_CATEGORY.unusual_variance as ExceptionInboxSeverity,
    title: `Unusual variance (${row.variance_pct ? `${(Number(row.variance_pct) * 100).toFixed(1)}%` : 'n/a'})`,
    reasonRaw: row.comment,
    // Each variance row is its own root cause (no cross-source dedupe expected here) — see file header.
    causeKey: `variance:${row.id}`,
    owner: row.owner,
    ownerIsDefault: !row.owner,
    createdAt: row.created_at,
    artifactId: row.artifact_id,
    businessVersionId: row.business_version_id,
    workingRevisionId: null,
    cellRef: null,
    sourceRef: null,
    extraDeepLinkParams: { variance: row.id, ...(row.period_id ? { period: row.period_id } : {}), ...(row.entity_id ? { entity: row.entity_id } : {}) },
    sourceTable: 'finance_analysis_variance',
    sourceId: row.id,
    explicitSlaDueAt: null,
  }));
}

// ---------------------------------------------------------------------------
// Source 7 — benchmark_expired: NOT IMPLEMENTED
// ---------------------------------------------------------------------------

/**
 * `finance_analysis_benchmarks` (WP-D03, `20260809_finance_v3_d03_analysis_01_tables.sql`)
 * has `as_of_date` but NO `expiry`/`valid_until` column — checked against the
 * live migration DDL per this task's own instruction ("sprawdź"). There is
 * therefore nothing to query: "expired" cannot be computed from a table that
 * never recorded when a benchmark stops being valid. Always returns `[]`.
 * Future integration: WP-D03 (or a follow-on migration) would need to add an
 * expiry column (or an org-level "benchmark max-age" policy applied to
 * `as_of_date`) before this category can return real entries.
 */
async function fetchBenchmarkExpiredEntries(): Promise<RawInboxEntry[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Source 8 — import_conflict: NOT IMPLEMENTED
// ---------------------------------------------------------------------------

/**
 * AP-02 (`financeImportService.ts`, `previewFinanceImport` / `applyFinanceImport`)
 * is a stateless preview -> apply pipeline: `previewFinanceImport` computes a
 * diff read-only and returns it to the caller; nothing is persisted unless
 * the caller subsequently calls apply. There is no "the user saw a conflict
 * and rejected/abandoned it" row anywhere in the schema — a rejected preview
 * simply never becomes an apply call and leaves no trace. Always returns `[]`.
 * Future integration: AP-02 would need to persist an explicit
 * "import attempt" record (accepted/rejected/abandoned) before AP-08 could
 * query a durable "import_conflict" state.
 */
async function fetchImportConflictEntries(): Promise<RawInboxEntry[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Merge / dedupe
// ---------------------------------------------------------------------------

function groupScope(entry: RawInboxEntry): string {
  return entry.businessVersionId ? `bv:${entry.businessVersionId}` : `artifact:${entry.artifactId}`;
}

function groupKey(entry: RawInboxEntry): string {
  return `${groupScope(entry)}::${entry.causeKey}`;
}

function pickRepresentative(group: RawInboxEntry[]): RawInboxEntry {
  return [...group].sort((a, b) => {
    const rank = CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category);
    if (rank !== 0) return rank;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  })[0];
}

function computeSlaDueAt(entry: RawInboxEntry, createdAt: string): string | null {
  if (entry.explicitSlaDueAt) return entry.explicitSlaDueAt;
  const window = SLA_WINDOW_MS[entry.severity];
  if (window == null) return null;
  return new Date(new Date(createdAt).getTime() + window).toISOString();
}

function toInboxEntry(group: RawInboxEntry[]): ExceptionInboxEntry {
  const rep = pickRepresentative(group);
  const createdAt = group.reduce((min, e) => (e.createdAt < min ? e.createdAt : min), rep.createdAt);
  const lastSeenAt = group.reduce((max, e) => (e.createdAt > max ? e.createdAt : max), rep.createdAt);
  const severity = group.reduce<ExceptionInboxSeverity>(
    (max, e) => (SEVERITY_RANK[e.severity] > SEVERITY_RANK[max] ? e.severity : max),
    rep.severity
  );
  // Prefer an explicit (non-defaulted) owner from ANY merged source over the representative's own (possibly defaulted) owner.
  const explicitOwnerEntry = group.find((e) => e.owner && !e.ownerIsDefault);
  const owner = explicitOwnerEntry?.owner ?? rep.owner;
  const ownerIsDefault = !explicitOwnerEntry;

  const mergedCategories = Array.from(new Set(group.map((e) => e.category)));
  const sources: ExceptionInboxSourceRef[] = group.map((e) => ({ category: e.category, table: e.sourceTable, id: e.sourceId }));

  const focus = (rep as RawInboxEntry & { __focus?: string | null }).__focus ?? (rep.cellRef ? cellRefKey(rep.cellRef) : null);
  const period = (rep as RawInboxEntry & { __period?: string | null }).__period ?? null;
  const entity = (rep as RawInboxEntry & { __entity?: string | null }).__entity ?? null;

  const deepLink: ExceptionInboxDeepLink = {
    artifactId: rep.artifactId,
    businessVersionId: rep.businessVersionId,
    workingRevisionId: rep.workingRevisionId,
    cellRef: rep.cellRef,
    sourceRef: rep.sourceRef,
    url: buildDeepLinkUrl({
      artifactId: rep.artifactId,
      businessVersionId: rep.businessVersionId,
      focus,
      period,
      entity,
      extra: rep.extraDeepLinkParams,
    }),
  };

  return {
    id: `${rep.category}:${rep.sourceId}`,
    category: rep.category,
    mergedCategories,
    severity,
    title: rep.title,
    reason: rep.reasonRaw,
    owner,
    ownerIsDefault,
    createdAt,
    lastSeenAt,
    slaDueAt: computeSlaDueAt(rep, createdAt),
    artifactId: rep.artifactId,
    businessVersionId: rep.businessVersionId,
    deepLink,
    sources,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ListExceptionInboxParams extends ListExceptionInboxOptions {
  organizationId: string;
  /** Override for `unusual_variance`'s materiality gate — defaults to `UNUSUAL_VARIANCE_MATERIALITY_THRESHOLD_PCT`. See that constant's doc comment. */
  unusualVarianceMaterialityThresholdPct?: number;
}

/**
 * Aggregates, deduplicates (see file header), and returns every open
 * exception-like item across the sources listed at the top of this file,
 * sorted by severity desc then most-recently-seen desc (most urgent first).
 */
export async function listExceptionInbox(params: ListExceptionInboxParams): Promise<ExceptionInboxEntry[]> {
  const { organizationId, artifactId, unusualVarianceMaterialityThresholdPct } = params;

  const [tieOutFail, stale, computeFailedFreshness, computeFailedJobs, blockers, reviewAssigned, unusualVariance, benchmarkExpired, importConflict] =
    await Promise.all([
      fetchTieOutFailEntries(organizationId, artifactId),
      fetchFreshnessEntries(organizationId, 'stale', ['STALE_SOURCE', 'STALE_ASSUMPTIONS'], artifactId),
      fetchFreshnessEntries(organizationId, 'compute_failed', ['COMPUTE_FAILED'], artifactId),
      fetchComputeJobFailedEntries(organizationId, artifactId),
      fetchBlockerEntries(organizationId, artifactId),
      fetchReviewAssignedEntries(organizationId, artifactId),
      fetchUnusualVarianceEntries(organizationId, unusualVarianceMaterialityThresholdPct ?? UNUSUAL_VARIANCE_MATERIALITY_THRESHOLD_PCT, artifactId),
      fetchBenchmarkExpiredEntries(),
      fetchImportConflictEntries(),
    ]);

  const raw: RawInboxEntry[] = [
    ...tieOutFail,
    ...stale,
    ...computeFailedFreshness,
    ...computeFailedJobs,
    ...blockers,
    ...reviewAssigned,
    ...unusualVariance,
    ...benchmarkExpired,
    ...importConflict,
  ];

  const groups = new Map<string, RawInboxEntry[]>();
  for (const entry of raw) {
    const key = groupKey(entry);
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }

  const entries = Array.from(groups.values()).map(toInboxEntry);

  return entries.sort((a, b) => {
    const sevDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });
}
