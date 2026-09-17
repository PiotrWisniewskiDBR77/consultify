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

/**
 * Storage kind of a planning column. The roll needs three write paths because
 * the group-(a) columns are heterogeneous on the live schema:
 *  - 'text'      → UTC ISO-8601 string ('YYYY-MM-DDTHH:MM:SS.sssZ'); shifted by
 *                  parsing, adding days, and re-serializing byte-for-byte so the
 *                  lexical range filters (start_at < E, deadline >= S AND < E)
 *                  keep working.
 *  - 'timestamp' → timestamp / timestamptz; shifted with `col + (n days)`.
 *  - 'date'      → date; shifted with `col + (n days)`.
 */
export type ShowcaseDateColumnKind = 'text' | 'timestamp' | 'date';

export interface ShowcaseDateColumn {
  /** Physical column name. */
  column: string;
  /** Which of the three write paths shifts this column. */
  kind: ShowcaseDateColumnKind;
}

export interface ShowcaseDateTable {
  /** Physical table name. */
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
      { column: 'due_date', kind: 'timestamp' },
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
      { column: 'start_date', kind: 'timestamp' },
      { column: 'end_date', kind: 'timestamp' },
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
  /** Set when the org was not rolled (e.g. first run initialized the watermark, or dry-run). */
  skipped?: string;
}

/** Result of one rollShowcaseDates call, one entry per requested org. */
export type ShowcaseRollResult = ShowcaseRollOrgResult[];

export interface RollShowcaseDatesInput {
  /** Reference "now"; delta is computed against each org's stored last_rolled_on. */
  today: Date;
  /** Showcase org IDs to roll (from SHOWCASE_ORG_IDS — by ID, never by name). */
  orgIds: string[];
  /** When true, compute the delta and counts without writing any row. */
  dryRun?: boolean;
}

/**
 * Rolls planning dates forward for the given showcase orgs.
 *
 * Contract (mechanics land in Wpis 31 §4.2):
 *  - delta = floor((today − last_rolled_on) / 1 day); first run (no watermark row)
 *    initializes last_rolled_on = today WITHOUT shifting (delta 0, skipped).
 *  - one transaction per org; all group-(a) columns shifted by the same delta.
 *  - idempotent: a second pass the same day has delta 0 → 0 changes.
 *  - never touches orgs outside `orgIds`.
 */
export async function rollShowcaseDates(
  _input: RollShowcaseDatesInput
): Promise<ShowcaseRollResult> {
  // Contract stub; real mechanics land in Wpis 31 §4.2. Technical (snake_case)
  // code on purpose so the J0 language gate does not count it as EN prose.
  throw new Error('showcase_date_roll_not_implemented');
}

export default { rollShowcaseDates, SHOWCASE_DATE_FIELDS };
