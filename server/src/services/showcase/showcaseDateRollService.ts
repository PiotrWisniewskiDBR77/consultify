/**
 * Showcase Date-Roll Service (SR-1)
 *
 * Shifts PLANNING dates in showcase/demo organizations forward so demo data
 * never goes stale ("things currently in progress" stay in progress). This is
 * the contract for the SR-1 roll; the nightly job and the SUPERADMIN endpoint
 * both call `rollShowcaseDates`.
 *
 * Scope is deliberately limited to GROUP (a) planning fields measured on line
 * cb81468b97 (see OD_QODERA [A] Wpis 31 KROK 0). GROUP (c) fields — OKR/KPI
 * periods, lifecycle markers (started_at/completed_at/...), cadence schedules
 * outside report_schedules, and the weekend/"Weekly stand-up" day-of-week rule —
 * AWAIT A PER-FIELD CTO DECISION and are intentionally NOT listed here.
 * Adding a group-(c) column to SHOWCASE_DATE_FIELDS requires a new [A] entry.
 */

import { all as dbAll, transaction as dbTransaction } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

/**
 * Storage kind of a planning column. The roll needs distinct write paths
 * because the group-(a) columns are heterogeneous on the live schema:
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

export interface ShowcaseDateTable {
  /** Physical table name (all group-(a) tables live in the `public` schema). */
  table: string;
  /** Column that scopes rows to an organization (all group-(a) tables use this). */
  orgColumn: string;
  /** GROUP (a) planning columns to shift, all by the same per-org delta. */
  columns: ShowcaseDateColumn[];
}

/**
 * SINGLE SOURCE OF TRUTH for the SR-1 roll: the explicit table→columns list for
 * GROUP (a) planning fields (23 columns / 9 tables), measured authoritatively on
 * line cb81468b97. GROUP (c) is excluded pending a per-field CTO decision — do
 * not add lifecycle / OKR / KPI columns here without a new [A] entry.
 */
export const SHOWCASE_DATE_FIELDS: ShowcaseDateTable[] = [
  {
    table: 'tasks',
    orgColumn: 'organization_id',
    columns: [
      { column: 'due_date', kind: 'timestamptz' },
      { column: 'milestone_target_date', kind: 'date' },
      { column: 'sla_due_at', kind: 'text' },
    ],
  },
  {
    table: 'calendar_events',
    orgColumn: 'organization_id',
    columns: [
      { column: 'start_at', kind: 'text' },
      { column: 'end_at', kind: 'text' },
    ],
  },
  {
    table: 'decisions',
    orgColumn: 'organization_id',
    columns: [
      { column: 'deadline', kind: 'timestamp' },
      { column: 'escalation_deadline', kind: 'timestamp' },
    ],
  },
  {
    table: 'initiatives',
    orgColumn: 'organization_id',
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
    columns: [
      { column: 'target_date', kind: 'date' },
      { column: 'baseline_date', kind: 'date' },
    ],
  },
  {
    table: 'meetings',
    orgColumn: 'organization_id',
    columns: [
      { column: 'start_at', kind: 'text' },
      { column: 'end_at', kind: 'text' },
    ],
  },
  {
    table: 'v8_calendar_items',
    orgColumn: 'organization_id',
    columns: [
      { column: 'start_at', kind: 'text' },
      { column: 'end_at', kind: 'text' },
    ],
  },
  {
    table: 'interview_assignments',
    orgColumn: 'organization_id',
    columns: [{ column: 'due_at', kind: 'timestamp' }],
  },
  {
    table: 'report_schedules',
    orgColumn: 'organization_id',
    columns: [{ column: 'next_run_at', kind: 'timestamp' }],
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

// ---------------------------------------------------------------------------
// SQL builders. $1 = orgId, $2 = delta (whole days, integer).
// ---------------------------------------------------------------------------

/** Canonical date-only text: '2026-09-17'. */
const TEXT_DATE_ONLY = String.raw`^\d{4}-\d{2}-\d{2}$`;
/** Canonical UTC ISO timestamp with an explicit Z/offset: '2026-09-17T00:00:00.000Z'. */
const TEXT_ISO_TS = String.raw`^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$`;

function shiftExpression(col: string, kind: ShowcaseDateColumnKind): string {
  const q = `"${col}"`;
  switch (kind) {
    case 'date':
      return `(${q} + $2::int)`;
    case 'timestamp':
      return `(${q} + make_interval(days => $2::int))`;
    case 'timestamptz':
      return `(((${q} AT TIME ZONE 'UTC') + make_interval(days => $2::int)) AT TIME ZONE 'UTC')`;
    case 'text':
      return (
        `(CASE` +
        ` WHEN ${q} ~ '${TEXT_DATE_ONLY}' THEN to_char((${q}::date + $2::int), 'YYYY-MM-DD')` +
        ` WHEN ${q} ~ '${TEXT_ISO_TS}' THEN to_char(((${q}::timestamptz AT TIME ZONE 'UTC') + make_interval(days => $2::int)), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` +
        ` ELSE ${q} END)`
      );
  }
}

function anyNotNull(columns: ShowcaseDateColumn[]): string {
  return columns.map((c) => `"${c.column}" IS NOT NULL`).join(' OR ');
}

/** One UPDATE per table shifting every group-(a) column by $2 for org $1. */
function buildTableUpdateSql(t: ShowcaseDateTable): string {
  const sets = t.columns.map((c) => `"${c.column}" = ${shiftExpression(c.column, c.kind)}`).join(', ');
  return (
    `UPDATE public."${t.table}" SET ${sets} ` +
    `WHERE "${t.orgColumn}" = $1 AND (${anyNotNull(t.columns)})`
  );
}

/** dryRun candidate count: org rows with at least one non-null group-(a) column. */
function buildTableCountSql(t: ShowcaseDateTable): string {
  return (
    `SELECT count(*)::int AS n FROM public."${t.table}" ` +
    `WHERE "${t.orgColumn}" = $1 AND (${anyNotNull(t.columns)})`
  );
}

const UPSERT_WATERMARK_SQL =
  `INSERT INTO public.showcase_date_roll (org_id, last_rolled_on, updated_at) ` +
  `VALUES ($1, $2::date, now()) ` +
  `ON CONFLICT (org_id) DO UPDATE SET last_rolled_on = EXCLUDED.last_rolled_on, updated_at = now()`;

// ---------------------------------------------------------------------------
// Per-org roll.
// ---------------------------------------------------------------------------

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
      await db.transaction([{ sql: UPSERT_WATERMARK_SQL, params: [orgId, todayIso] }]);
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

  // Idempotent: a second pass the same day has delta 0 → 0 changes, no write.
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

  const perTable: Record<string, number> = {};

  if (dryRun) {
    for (const t of SHOWCASE_DATE_FIELDS) {
      const r = await db.all<{ n: number }>(buildTableCountSql(t), [orgId]);
      perTable[t.table] = Number(r[0]?.n ?? 0);
    }
    return { orgId, lastRolledOn: lastIso, deltaDays: delta, perTable, skipped: 'dry_run' };
  }

  // One transaction per org: all table UPDATEs + the watermark upsert, atomically.
  const statements: ShowcaseRollStatement[] = SHOWCASE_DATE_FIELDS.map((t) => ({
    sql: buildTableUpdateSql(t),
    params: [orgId, delta],
  }));
  statements.push({ sql: UPSERT_WATERMARK_SQL, params: [orgId, todayIso] });

  const tx = await db.transaction(statements);
  if (!tx.success) {
    logger.error(`[ShowcaseRoll] org ${orgId}: transaction failed: ${tx.error}`);
    return { orgId, lastRolledOn: lastIso, deltaDays: delta, perTable: {}, skipped: 'error' };
  }

  // results[i] aligns with SHOWCASE_DATE_FIELDS[i]; the last result is the upsert.
  SHOWCASE_DATE_FIELDS.forEach((t, i) => {
    perTable[t.table] = Number(tx.results[i]?.changes ?? 0);
  });
  logger.info(`[ShowcaseRoll] org ${orgId}: rolled +${delta}d`, { perTable });

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
 * Rolls planning dates forward for the given showcase orgs (group (a) only).
 *
 *  - delta = floor((today − last_rolled_on) / 1 day); first run (no watermark
 *    row) initializes last_rolled_on = today WITHOUT shifting (delta 0).
 *  - one transaction per org; all group-(a) columns shifted by the same delta.
 *  - idempotent: a second pass the same day has delta 0 → 0 changes, no write.
 *  - never touches orgs outside `orgIds` (every statement filters by org).
 */
export async function rollShowcaseDates(
  input: RollShowcaseDatesInput
): Promise<ShowcaseRollResult> {
  return buildShowcaseDateRoll().roll(input);
}

export default { rollShowcaseDates, buildShowcaseDateRoll, SHOWCASE_DATE_FIELDS, computeDeltaDays };
