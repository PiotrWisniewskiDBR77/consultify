/**
 * Finance — canonical period serializer (FIN-005).
 *
 * WHY THIS EXISTS
 * ---------------
 * `financial_statements.period_start/period_end` and
 * `financial_statement_packs.period_start/period_end` are Postgres `DATE`
 * columns. `node-pg` has no type parser registered for OID 1082 in this
 * codebase (`grep setTypeParser server/src` → no match), so every read hands
 * the application a **JS `Date` object**, not a string.
 *
 * Any code that then did `String(row.period_end)` produced the JS
 * `Date.prototype.toString()` form. On Railway (`TZ=UTC`) that is literally:
 *
 *   `Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)`
 *
 * which is exactly the string the 2026-08-01 staging probe saw rendered to the
 * user in the Finance → Statements PERIOD column. The concrete leak was
 * `packPeriodLabel()` in `financialStatementPackService.ts`:
 *
 *   normalizeText(statements[0]?.period_label) || normalizeText(statements[0]?.period_end)
 *
 * — a `Date` falling through `String(...)` into a column that is persisted and
 * then displayed. A frontend regex guard was added earlier
 * (`sanitizeStatementTitle` in `FinanceHub.tsx`), but a display-layer patch
 * cannot stop the bad value from being WRITTEN, and it does not cover every
 * surface that reads the column. This module is the owner-side fix.
 *
 * CONTRACT
 * --------
 * `formatPeriodLabel()` NEVER returns a raw `Date.toString()` form. Given any
 * of: `Date` | ISO datetime | ISO date | bare year | already-human label |
 * legacy `Date.toString()` string | `null` — it returns either a stable,
 * human-safe label or `''`.
 *
 * The serializer deliberately does NOT invent a period type it cannot know
 * (it will not turn `2026-03-31` into `Q1 2026`): a derived label is always the
 * ISO calendar date, because that is the only statement it can make truthfully.
 * Real period identity (`FY2014`, `Q1 2026`) comes from the ingest pipeline or
 * the canonical seed, and is passed through untouched.
 */

/** `Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)` and friends. */
const JS_DATE_TOSTRING_RE = /^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\b/;

/** `2014-12-31`, optionally with a time component. */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/;

/** A bare calendar year, as text or number: `2014`. */
const BARE_YEAR_RE = /^\d{4}$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Render a `Date` as the calendar date it actually denotes.
 *
 * THE TRAP (caught by running the seed against a real PostgreSQL, not a mock).
 * Two different kinds of `Date` reach this function and they need opposite
 * readings:
 *
 * - a Postgres `DATE` column (`period_start`, `period_end`) is parsed by
 *   node-pg into **local midnight** — `new Date(2014, 11, 31)`. Reading that
 *   with UTC getters in any timezone ahead of UTC yields `2014-12-30`: the
 *   period silently shifts a day backwards. This was observed live: a pack
 *   seeded as `2014-12-31` read back as `2014-12-30` on a `Europe/Warsaw` host.
 * - an ISO instant (`'2014-12-31T00:00:00.000Z'`, or a legacy
 *   `Date.toString()` string) denotes a moment in UTC. Reading THAT with local
 *   getters shifts it the other way in any timezone behind UTC.
 *
 * The discriminator is exact local midnight: a Postgres `DATE` always lands on
 * it, an instant essentially never does (and when it does — a UTC host — both
 * readings agree anyway, so the choice is harmless).
 *
 * The alternative, registering a global `pg` type parser for OID 1082, would fix
 * this at the source but changes date handling for every column in the product;
 * that is a platform decision, not a Finance one.
 */
function isoFromDate(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null;

  const isLocalMidnight =
    value.getHours() === 0 &&
    value.getMinutes() === 0 &&
    value.getSeconds() === 0 &&
    value.getMilliseconds() === 0;

  return isLocalMidnight
    ? `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
    : `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
}

/**
 * Coerce any period-ish value to a `YYYY-MM-DD` calendar date, or `null` when
 * the value does not denote a specific day (a bare year, a human label such as
 * `FY2014`, an empty value, or unparsable text).
 */
export function toPeriodIsoDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) return isoFromDate(value);

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // A 4-digit number is a year, not an epoch timestamp (epoch 2014 ms is
    // 1970-01-01 — silently wrong, and the kind of bug this module exists for).
    if (value >= 1000 && value <= 9999) return null;
    return isoFromDate(new Date(value));
  }

  const text = String(value).trim();
  if (!text) return null;

  const isoMatch = text.match(ISO_DATE_RE);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  if (JS_DATE_TOSTRING_RE.test(text)) {
    const parsed = new Date(text);
    return isoFromDate(parsed);
  }

  return null;
}

/**
 * Canonical, display-safe label for a single period value.
 *
 * - `Date` / ISO datetime / legacy `Date.toString()` → `YYYY-MM-DD`
 * - bare year (`2014`, `'2014'`) → `'2014'`
 * - an existing human label (`FY2014`, `Q1 2026`) → passed through, trimmed
 * - `null` / `undefined` / `''` / whitespace → `''`
 */
export function formatPeriodLabel(value: unknown): string {
  if (value === null || value === undefined) return '';

  const iso = toPeriodIsoDate(value);
  if (iso) return iso;

  if (typeof value === 'number') {
    return Number.isFinite(value) && BARE_YEAR_RE.test(String(value)) ? String(value) : '';
  }

  const text = String(value).trim();
  if (!text) return '';

  // A `Date.toString()` string that failed to parse must never reach the user;
  // returning it here would defeat the whole point of this module.
  if (JS_DATE_TOSTRING_RE.test(text)) return '';

  return text;
}

/**
 * Resolve the label to show for a statement or pack: the explicit period label
 * when there is one, otherwise a safe rendering of the period end.
 *
 * This is the exact fallback chain `packPeriodLabel()` used to implement with
 * bare `String(...)`, with the `Date` leak closed.
 */
export function resolvePeriodLabel(rawLabel: unknown, periodEnd?: unknown): string {
  return formatPeriodLabel(rawLabel) || formatPeriodLabel(periodEnd);
}

/** Row shape carrying any subset of the canonical Finance period columns. */
type PeriodBearingRow = Record<string, unknown>;

/**
 * Normalize the period columns of an API row in place-safe fashion (returns a
 * shallow copy). Applied at the read boundary of the Finance list/detail routes
 * so no `Date` object and no legacy `Date.toString()` string can reach a client
 * — including rows written before this fix, which still hold the bad label.
 *
 * Non-period fields are passed through untouched.
 */
export function serializeRowPeriodFields<T extends PeriodBearingRow>(row: T): T {
  if (!row || typeof row !== 'object') return row;

  const out: PeriodBearingRow = { ...row };

  if ('period_start' in out) {
    out.period_start = toPeriodIsoDate(out.period_start) ?? formatPeriodLabel(out.period_start);
  }
  if ('period_end' in out) {
    out.period_end = toPeriodIsoDate(out.period_end) ?? formatPeriodLabel(out.period_end);
  }
  if ('period_label' in out) {
    // A row whose label was persisted as a raw Date string is repaired on read
    // from its own period_end, so legacy rows display correctly with no
    // migration and no data mutation.
    out.period_label = resolvePeriodLabel(out.period_label, row.period_end) || null;
  }

  return out as T;
}

/** `serializeRowPeriodFields` over a list, tolerant of null/undefined input. */
export function serializeRowsPeriodFields<T extends PeriodBearingRow>(
  rows: T[] | null | undefined
): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => serializeRowPeriodFields(row));
}
