/**
 * Postgres serialization-safe coercion helpers.
 *
 * node-pg returns `bigint`(int8) columns as JavaScript STRINGS ("1"/"0") and
 * `jsonb`/`json` columns as already-parsed OBJECTS. That silently breaks the
 * common dev-on-SQLite idioms:
 *   - `row.flag === 1`        → "1" === 1 is false
 *   - `!row.flag`             → !"0" is false (non-empty string is truthy)
 *   - `Boolean(row.flag)`     → Boolean("0") is true
 *   - `JSON.parse(row.col)`   → JSON.parse(object) throws ("[object Object]")
 *
 * Use these helpers at any site that reads a boolean-intent or JSON column out
 * of the DB so the code is correct on int4 (number), int8 (string), boolean,
 * TEXT-JSON and native JSONB alike.
 *
 * See finding_pg_bigint_jsonb_serialization (project memory) for the full class.
 */

/** Coerce a 0/1 flag (number, bigint-string, boolean, or null) to a real boolean. */
export function flagOn(v: unknown): boolean {
  return v === true || Number(v) === 1;
}

/**
 * Parse a column that may be a JSON string (TEXT) or an already-parsed object
 * (native jsonb on Postgres). Returns `fallback` on null/undefined/invalid.
 */
export function parseMaybeJson<T = unknown>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
