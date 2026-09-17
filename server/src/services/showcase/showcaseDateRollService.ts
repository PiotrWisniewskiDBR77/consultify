/**
 * Showcase Date-Roll Service (SR-1)
 *
 * Shifts PLANNING dates in showcase/demo organizations forward so demo data
 * never goes stale ("things currently in progress" stay in progress). This is
 * the contract for the SR-1 roll; the nightly job and the SUPERADMIN endpoint
 * both call `rollShowcaseDates`.
 *
 * Field selection follows the CTO per-group decisions ([A] Wpis 38):
 *  - GROUP (a) planning fields (measured on line cb81468b97) — ALWAYS shifted.
 *  - GROUP (c) item 2 (OKR vNext cycle/key-result/set dates) — shifted.
 *  - GROUP (c) item 4 (KPI due / next-run / checkpoint / expected-recovery /
 *    response-due) — shifted.
 *  - GROUP (c) item 5 (other planning fields outside the My Work calendar) —
 *    NOT included: they are gated on "only fields the Northwind seed actually
 *    populates (COUNT(*) > 0)". The demo-en Northwind seed does not run to
 *    completion on the current integration line (schema/type drift: it inserts
 *    `initiatives.tags` / `projects.goal` and writes text into timestamptz
 *    columns that do not exist / no longer match on this line), so the per-column
 *    COUNT could not be established. Per Wpis 38 "0 = do not include", every
 *    item-5 candidate is excluded until the seed runs and the counts are proven.
 *  - GROUP (c) items 1 & 3 (lifecycle markers started_at/completed_at/... and
 *    KPI measurement periods period_start/end, baseline_period_*, ...) — NEVER
 *    shifted (history), per Wpis 38.
 *
 * Weekend / "Weekly stand-up" rule = VARIANT B (Wpis 38 item 6): one-off rows
 * shift by `delta`; weekly-recurring rows shift by `round(delta/7)*7` so a weekly
 * cadence stays on its weekday. Weekly recurrence is recognized ONLY via
 * `meetings.recurrence_rule` (FREQ=WEEKLY). Other recurrence-bearing event tables
 * (calendar_events.recurrence_rule, v8_calendar_items.recurrence_model_json) are
 * listed in the report but NOT rule-shifted — Wpis 38: "do not guess".
 */

import { all as dbAll, transaction as dbTransaction } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

/**
 * Storage kind of a planning column. The roll needs distinct write paths
 * because the shifted columns are heterogeneous on the live schema:
 *  - 'text'        → UTC ISO-8601 string. Shifted by parsing, adding days and
 *                    re-serializing byte-for-byte so the lexical range filters
 *                    (start_at < E, deadline >= S AND < E) keep working. Both
 *                    canonical forms are preserved: date-only stays date-only,
 *                    an ISO timestamp stays 'YYYY-MM-DDTHH:MM:SS.sssZ'. Anything
 *                    else is left untouched (defensive — never corrupt/crash).
 *  - 'timestamp'   → timestamp WITHOUT time zone; `col + make_interval(days)`.
 *  - 'timestamptz' → timestamp WITH time zone; normalized to UTC wall time,
 *                    shifted by whole calendar days, re-anchored as UTC so the
 *                    result is independent of the session TimeZone (DST-safe).
 *  - 'date'        → date; `col + integer` (whole days, no time component).
 */
export type ShowcaseDateColumnKind = 'text' | 'timestamp' | 'timestamptz' | 'date';

export interface ShowcaseDateColumn {
  /** Physical column name. */
  column: string;
  /** Which write path shifts this column. */
  kind: ShowcaseDateColumnKind;
}

/**
 * Per-table weekly-recurrence rule (VARIANT B). When present, rows matching
 * `weeklyWhen` shift by the weekly delta (round(delta/7)*7) instead of the raw
 * per-org delta, so a weekly cadence keeps its weekday. `weeklyWhen` is a SQL
 * boolean expression evaluated against the row (may reference its columns).
 */
export interface ShowcaseRecurrenceRule {
  weeklyWhen: string;
}

/** Provenance tag: which CTO decision group a table belongs to. */
export type ShowcaseFieldGroup = 'a' | 'c-okr' | 'c-kpi';

export interface ShowcaseDateTable {
  /** Physical table name (all shifted tables live in the `public` schema). */
  table: string;
  /**
   * Column that scopes rows to an organization. Defaults to 'organization_id'.
   * Omit when the table has no such column and `orgScopeSql` is used instead.
   */
  orgColumn?: string;
  /**
   * Custom org-scoping predicate (must reference $1) for tables with no direct
   * organization_id column — e.g. a child scoped through its parent's org.
   * Takes precedence over `orgColumn`.
   */
  orgScopeSql?: string;
  /** Planning columns to shift. */
  columns: ShowcaseDateColumn[];
  /** Decision-group provenance (defaults to 'a'). */
  group?: ShowcaseFieldGroup;
  /** When set, weekly-recurring rows shift by round(delta/7)*7 (VARIANT B). */
  recurrence?: ShowcaseRecurrenceRule;
}

/**
 * SINGLE SOURCE OF TRUTH for the SR-1 roll: the explicit table→columns list.
 * GROUP (a) = 9 tables / 23 columns (measured on cb81468b97). GROUP (c) per
 * Wpis 38: OKR item 2 (3 tables / 14 columns) + KPI item 4 (10 tables / 10
 * columns). Item 5 excluded (seed-gated, unproven — see header). Items 1 & 3
 * (lifecycle markers, KPI measurement periods) are NEVER listed here.
 */
export const SHOWCASE_DATE_FIELDS: ShowcaseDateTable[] = [
  // ── GROUP (a): planning fields ──────────────────────────────────────────
  {
    table: 'tasks',
    orgColumn: 'organization_id',
    group: 'a',
    columns: [
      { column: 'due_date', kind: 'timestamptz' },
      { column: 'milestone_target_date', kind: 'date' },
      { column: 'sla_due_at', kind: 'text' },
    ],
  },
  {
    table: 'calendar_events',
    orgColumn: 'organization_id',
    group: 'a',
    columns: [
      { column: 'start_at', kind: 'text' },
      { column: 'end_at', kind: 'text' },
    ],
  },
  {
    table: 'decisions',
    orgColumn: 'organization_id',
    group: 'a',
    columns: [
      { column: 'deadline', kind: 'timestamp' },
      { column: 'escalation_deadline', kind: 'timestamp' },
    ],
  },
  {
    table: 'initiatives',
    orgColumn: 'organization_id',
    group: 'a',
    columns: [
      { column: 'planned_start_date', kind: 'text' },
      { column: 'planned_end_date', kind: 'text' },
      { column: 'start_date', kind: 'timestamptz' },
      { column: 'end_date', kind: 'timestamptz' },
      { column: 'baseline_start_date', kind: 'text' },
      { column: 'baseline_end_date', kind: 'text' },
      { column: 'forecast_start_date', kind: 'text' },
      { column: 'forecast_end_date', kind: 'text' },
    ],
  },
  {
    table: 'initiative_milestones',
    orgColumn: 'organization_id',
    group: 'a',
    columns: [
      { column: 'target_date', kind: 'date' },
      { column: 'baseline_date', kind: 'date' },
    ],
  },
  {
    // VARIANT B: a weekly meeting (RRULE FREQ=WEEKLY) keeps its weekday —
    // shifted by round(delta/7)*7; a one-off meeting shifts by the raw delta.
    table: 'meetings',
    orgColumn: 'organization_id',
    group: 'a',
    recurrence: { weeklyWhen: `"recurrence_rule" ~* 'FREQ=WEEKLY'` },
    columns: [
      { column: 'start_at', kind: 'text' },
      { column: 'end_at', kind: 'text' },
    ],
  },
  {
    table: 'v8_calendar_items',
    orgColumn: 'organization_id',
    group: 'a',
    columns: [
      { column: 'start_at', kind: 'text' },
      { column: 'end_at', kind: 'text' },
    ],
  },
  {
    table: 'interview_assignments',
    orgColumn: 'organization_id',
    group: 'a',
    columns: [{ column: 'due_at', kind: 'timestamp' }],
  },
  {
    table: 'report_schedules',
    orgColumn: 'organization_id',
    group: 'a',
    columns: [{ column: 'next_run_at', kind: 'timestamp' }],
  },

  // ── GROUP (c) item 2: OKR vNext (Wpis 38 — YES only these) ──────────────
  {
    table: 'okr_vnext_cycles',
    orgColumn: 'organization_id',
    group: 'c-okr',
    columns: [
      { column: 'start_date', kind: 'date' },
      { column: 'end_date', kind: 'date' },
      { column: 'draft_open_at', kind: 'timestamptz' },
      { column: 'active_start_at', kind: 'timestamptz' },
      { column: 'review_open_at', kind: 'timestamptz' },
      { column: 'close_at', kind: 'timestamptz' },
      { column: 'submission_due_at', kind: 'timestamptz' },
      { column: 'approval_due_at', kind: 'timestamptz' },
      { column: 'manager_review_due_at', kind: 'timestamptz' },
      { column: 'final_update_due_at', kind: 'timestamptz' },
      { column: 'reflection_due_at', kind: 'timestamptz' },
      { column: 'midcycle_review_at', kind: 'timestamptz' },
    ],
  },
  {
    table: 'okr_vnext_key_results',
    orgColumn: 'organization_id',
    group: 'c-okr',
    columns: [{ column: 'deadline', kind: 'date' }],
  },
  {
    table: 'okr_vnext_sets',
    orgColumn: 'organization_id',
    group: 'c-okr',
    columns: [{ column: 'next_checkin_due_at', kind: 'timestamptz' }],
  },

  // ── GROUP (c) item 4: KPI due / schedule (Wpis 38 — YES only these) ─────
  {
    table: 'kpi_recovery_actions',
    orgColumn: 'organization_id',
    group: 'c-kpi',
    columns: [{ column: 'due_date', kind: 'date' }],
  },
  {
    table: 'rvn_kpi_recovery_actions',
    orgColumn: 'organization_id',
    group: 'c-kpi',
    columns: [{ column: 'due_date', kind: 'date' }],
  },
  {
    table: 'rvn_kpi_corrective_actions',
    orgColumn: 'organization_id',
    group: 'c-kpi',
    columns: [{ column: 'due_date', kind: 'timestamptz' }],
  },
  {
    // No organization_id column — scoped through the parent deviation case.
    table: 'kpi_deviation_actions',
    orgScopeSql: `case_id IN (SELECT id FROM public.kpi_deviation_cases WHERE organization_id = $1)`,
    group: 'c-kpi',
    columns: [{ column: 'due_date', kind: 'date' }],
  },
  {
    table: 'kpi_report_schedules',
    orgColumn: 'organization_id',
    group: 'c-kpi',
    columns: [{ column: 'next_run_at', kind: 'timestamp' }],
  },
  {
    table: 'kpi_connectors',
    orgColumn: 'organization_id',
    group: 'c-kpi',
    columns: [{ column: 'next_run_at', kind: 'timestamp' }],
  },
  {
    table: 'kpi_recovery_checkpoints',
    orgColumn: 'organization_id',
    group: 'c-kpi',
    columns: [{ column: 'checkpoint_date', kind: 'date' }],
  },
  {
    table: 'rvn_kpi_recovery_checkpoints',
    orgColumn: 'organization_id',
    group: 'c-kpi',
    columns: [{ column: 'checkpoint_date', kind: 'date' }],
  },
  {
    table: 'kpi_recovery_cards',
    orgColumn: 'organization_id',
    group: 'c-kpi',
    columns: [{ column: 'expected_recovery_date', kind: 'date' }],
  },
  {
    table: 'rvn_kpi_deviation_cases',
    orgColumn: 'organization_id',
    group: 'c-kpi',
    columns: [{ column: 'response_due_at', kind: 'timestamptz' }],
  },
];

/** Per-organization outcome of one roll pass. */
export interface ShowcaseRollOrgResult {
  orgId: string;
  /** The new last_rolled_on watermark for this org (== input.today, date-only). */
  lastRolledOn: string;
  /** delta = today − previous last_rolled_on, in whole days (0 on first run / same-day rerun). */
  deltaDays: number;
  /** Rows shifted per physical table (delta 0 → every count 0). */
  perTable: Record<string, number>;
  /** Set when the org was not rolled (first run / up-to-date / dry-run / error). */
  skipped?: string;
}

/** Result of one rollShowcaseDates call, one entry per requested org. */
export type ShowcaseRollResult = ShowcaseRollOrgResult[];

export interface RollShowcaseDatesInput {
  /** Reference "now"; delta is computed against each org's stored last_rolled_on. */
  today: Date;
  /** Showcase org IDs to roll (from SHOWCASE_ORG_IDS — by ID, never by name). */
  orgIds: string[];
  /** When true, compute the delta and candidate counts without writing any row. */
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Dependency injection (the service must be testable with an injected
// connection — Wpis 31 §4.2). Structurally compatible with utils/DbPromise.
// ---------------------------------------------------------------------------

export interface ShowcaseRollStatement {
  sql: string;
  params: unknown[];
}

export interface ShowcaseRollRunResult {
  success: boolean;
  changes?: number;
  error?: string;
}

export interface ShowcaseRollTransactionResult {
  success: boolean;
  results: ShowcaseRollRunResult[];
  error?: string;
}

export interface ShowcaseRollDb {
  all<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction(statements: ShowcaseRollStatement[]): Promise<ShowcaseRollTransactionResult>;
}

const defaultDb: ShowcaseRollDb = {
  all: <T,>(sql: string, params?: unknown[]): Promise<T[]> => dbAll<T>(sql, params),
  transaction: (statements: ShowcaseRollStatement[]) => dbTransaction(statements),
};

// ---------------------------------------------------------------------------
// Date helpers (all arithmetic in UTC whole days — deterministic, DST-safe).
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

/** Format a Date as a UTC 'YYYY-MM-DD' date-only string. */
export function toUtcDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Coerce a stored watermark (DATE → string 'YYYY-MM-DD' or a Date) to UTC midnight. */
function parseWatermark(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/**
 * delta = today − lastRolledOn, in whole UTC days (floored). Exposed for unit
 * tests. Both operands are reduced to UTC midnight so the time-of-day of `today`
 * never changes the result.
 */
export function computeDeltaDays(today: Date, lastRolledOn: Date): number {
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const l = Date.UTC(
    lastRolledOn.getUTCFullYear(),
    lastRolledOn.getUTCMonth(),
    lastRolledOn.getUTCDate()
  );
  return Math.floor((t - l) / MS_PER_DAY);
}

/**
 * VARIANT B weekly delta: `round(delta/7)*7`. A weekly cadence moves in whole
 * weeks so it lands on the same weekday; <3.5 days rounds to 0 (stays put),
 * 3.5–10.4 days rounds to 7, etc. Exposed for unit tests.
 */
export function computeWeeklyDeltaDays(delta: number): number {
  return Math.round(delta / 7) * 7;
}

// ---------------------------------------------------------------------------
// SQL builders. $1 = orgId, $2 = delta (whole days). Tables with a weekly
// recurrence rule also bind $3 = weekly delta and choose per row.
// ---------------------------------------------------------------------------

/** Canonical date-only text: '2026-09-17'. */
const TEXT_DATE_ONLY = String.raw`^\d{4}-\d{2}-\d{2}$`;
/** Canonical UTC ISO timestamp with an explicit Z/offset: '2026-09-17T00:00:00.000Z'. */
const TEXT_ISO_TS = String.raw`^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$`;

/**
 * The per-row day-count expression a column is shifted by. Plain tables use the
 * raw delta ($2). A weekly-recurring table picks $3 (weekly delta) for rows
 * matching its recurrence rule and $2 otherwise (VARIANT B).
 */
function deltaExpression(t: ShowcaseDateTable): string {
  return t.recurrence
    ? `(CASE WHEN ${t.recurrence.weeklyWhen} THEN $3::int ELSE $2::int END)`
    : `$2::int`;
}

function shiftExpression(col: string, kind: ShowcaseDateColumnKind, days: string): string {
  const q = `"${col}"`;
  switch (kind) {
    case 'date':
      return `(${q} + ${days})`;
    case 'timestamp':
      return `(${q} + make_interval(days => ${days}))`;
    case 'timestamptz':
      return `(((${q} AT TIME ZONE 'UTC') + make_interval(days => ${days})) AT TIME ZONE 'UTC')`;
    case 'text':
      return (
        `(CASE` +
        ` WHEN ${q} ~ '${TEXT_DATE_ONLY}' THEN to_char((${q}::date + ${days}), 'YYYY-MM-DD')` +
        ` WHEN ${q} ~ '${TEXT_ISO_TS}' THEN to_char(((${q}::timestamptz AT TIME ZONE 'UTC') + make_interval(days => ${days})), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` +
        ` ELSE ${q} END)`
      );
  }
}

function anyNotNull(columns: ShowcaseDateColumn[]): string {
  return columns.map((c) => `"${c.column}" IS NOT NULL`).join(' OR ');
}

/** Org-scoping predicate: a custom `orgScopeSql` override, else `"<orgColumn>" = $1`. */
function orgPredicate(t: ShowcaseDateTable): string {
  return t.orgScopeSql ?? `"${t.orgColumn ?? 'organization_id'}" = $1`;
}

/** One UPDATE per table shifting every column by the per-row day count for org $1. */
function buildTableUpdateSql(t: ShowcaseDateTable): string {
  const days = deltaExpression(t);
  const sets = t.columns.map((c) => `"${c.column}" = ${shiftExpression(c.column, c.kind, days)}`).join(', ');
  return (
    `UPDATE public."${t.table}" SET ${sets} ` +
    `WHERE ${orgPredicate(t)} AND (${anyNotNull(t.columns)})`
  );
}

/** Candidate count: org rows with at least one non-null shifted column. */
function buildTableCountSql(t: ShowcaseDateTable): string {
  return (
    `SELECT count(*)::int AS n FROM public."${t.table}" ` +
    `WHERE ${orgPredicate(t)} AND (${anyNotNull(t.columns)})`
  );
}

/**
 * Watermark + run-proof upsert. $1 org, $2 last_rolled_on, $3 delta_days,
 * $4 per_table (JSONB). A same-day no-op rerun never reaches this, so the proof
 * of the last ACTUAL roll is preserved.
 */
const UPSERT_WATERMARK_SQL =
  `INSERT INTO public.showcase_date_roll (org_id, last_rolled_on, delta_days, per_table, updated_at) ` +
  `VALUES ($1, $2::date, $3::int, $4::jsonb, now()) ` +
  `ON CONFLICT (org_id) DO UPDATE SET ` +
  `last_rolled_on = EXCLUDED.last_rolled_on, ` +
  `delta_days = EXCLUDED.delta_days, ` +
  `per_table = EXCLUDED.per_table, ` +
  `updated_at = now()`;

// ---------------------------------------------------------------------------
// Per-org roll.
// ---------------------------------------------------------------------------

/**
 * Count candidate rows per table. This equals the rows the subsequent UPDATEs
 * will change: the count and the UPDATE share the identical WHERE predicate
 * (org + any shifted column non-null) and a shift never flips a column's
 * null-ness, so Postgres writes (and reports) every matching row. Counting
 * up-front lets the run proof (`per_table`) be stored in the SAME transaction
 * as the shift, keeping watermark and data atomic.
 */
async function countCandidates(
  db: ShowcaseRollDb,
  orgId: string
): Promise<Record<string, number>> {
  const perTable: Record<string, number> = {};
  for (const t of SHOWCASE_DATE_FIELDS) {
    const r = await db.all<{ n: number }>(buildTableCountSql(t), [orgId]);
    perTable[t.table] = Number(r[0]?.n ?? 0);
  }
  return perTable;
}

async function rollOne(
  db: ShowcaseRollDb,
  orgId: string,
  today: Date,
  dryRun: boolean
): Promise<ShowcaseRollOrgResult> {
  const todayIso = toUtcDateOnly(today);

  // Cast to text so the DATE always arrives as 'YYYY-MM-DD' — the pg driver
  // otherwise returns a local-midnight Date whose UTC parts can be off by one
  // day for timezones ahead of UTC.
  const rows = await db.all<{ last_rolled_on: unknown }>(
    'SELECT last_rolled_on::text AS last_rolled_on FROM public.showcase_date_roll WHERE org_id = $1',
    [orgId]
  );
  const last = rows.length > 0 ? parseWatermark(rows[0]?.last_rolled_on) : null;

  // First run for this org: initialize the watermark WITHOUT shifting anything.
  if (!last) {
    if (!dryRun) {
      await db.transaction([
        { sql: UPSERT_WATERMARK_SQL, params: [orgId, todayIso, 0, '{}'] },
      ]);
    }
    return {
      orgId,
      lastRolledOn: todayIso,
      deltaDays: 0,
      perTable: {},
      skipped: dryRun ? 'initialized_dry_run' : 'initialized',
    };
  }

  const lastIso = toUtcDateOnly(last);
  const delta = computeDeltaDays(today, last);

  // Idempotent: a second pass the same day has delta 0 → no shift, and NO write
  // (overwriting delta_days/per_table here would erase the last real run proof).
  if (delta === 0) {
    return { orgId, lastRolledOn: lastIso, deltaDays: 0, perTable: {}, skipped: 'up_to_date' };
  }

  // Defensive: never roll backwards (clock skew / manual watermark edit).
  if (delta < 0) {
    logger.warn(
      `[ShowcaseRoll] org ${orgId}: negative delta ${delta} (today ${todayIso} < watermark ${lastIso}); skipping`
    );
    return { orgId, lastRolledOn: lastIso, deltaDays: delta, perTable: {}, skipped: 'negative_delta' };
  }

  const perTable = await countCandidates(db, orgId);

  if (dryRun) {
    return { orgId, lastRolledOn: lastIso, deltaDays: delta, perTable, skipped: 'dry_run' };
  }

  const weeklyDelta = computeWeeklyDeltaDays(delta);

  // One transaction per org: all table UPDATEs + the watermark/run-proof upsert.
  const statements: ShowcaseRollStatement[] = SHOWCASE_DATE_FIELDS.map((t) => ({
    sql: buildTableUpdateSql(t),
    params: t.recurrence ? [orgId, delta, weeklyDelta] : [orgId, delta],
  }));
  statements.push({
    sql: UPSERT_WATERMARK_SQL,
    params: [orgId, todayIso, delta, JSON.stringify(perTable)],
  });

  const tx = await db.transaction(statements);
  if (!tx.success) {
    logger.error(`[ShowcaseRoll] org ${orgId}: transaction failed: ${tx.error}`);
    return { orgId, lastRolledOn: lastIso, deltaDays: delta, perTable: {}, skipped: 'error' };
  }

  logger.info(`[ShowcaseRoll] org ${orgId}: rolled +${delta}d (weekly +${weeklyDelta}d)`, { perTable });

  return { orgId, lastRolledOn: todayIso, deltaDays: delta, perTable };
}

/**
 * Factory returning a `roll` bound to an injected connection — the seam used by
 * unit tests (Wpis 31 §4.2: "testable via build/roll with an injected
 * connection"). Production callers use `rollShowcaseDates` (default DbPromise).
 */
export function buildShowcaseDateRoll(db: ShowcaseRollDb = defaultDb) {
  return {
    async roll(input: RollShowcaseDatesInput): Promise<ShowcaseRollResult> {
      const today = input.today instanceof Date ? input.today : new Date(input.today);
      const orgIds = Array.from(new Set(input.orgIds ?? [])).filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      );
      const dryRun = input.dryRun === true;
      const out: ShowcaseRollResult = [];
      for (const orgId of orgIds) {
        out.push(await rollOne(db, orgId, today, dryRun));
      }
      return out;
    },
  };
}

/**
 * Rolls planning dates forward for the given showcase orgs.
 *
 *  - delta = floor((today − last_rolled_on) / 1 day); first run (no watermark
 *    row) initializes last_rolled_on = today WITHOUT shifting (delta 0).
 *  - one transaction per org; every shifted column moves by delta, except
 *    weekly-recurring meetings which move by round(delta/7)*7 (VARIANT B).
 *  - each actual roll persists its run proof (delta_days + per_table row counts).
 *  - idempotent: a second pass the same day has delta 0 → 0 changes, no write.
 *  - never touches orgs outside `orgIds` (every statement filters by org).
 */
export async function rollShowcaseDates(
  input: RollShowcaseDatesInput
): Promise<ShowcaseRollResult> {
  return buildShowcaseDateRoll().roll(input);
}

export default {
  rollShowcaseDates,
  buildShowcaseDateRoll,
  SHOWCASE_DATE_FIELDS,
  computeDeltaDays,
  computeWeeklyDeltaDays,
};
