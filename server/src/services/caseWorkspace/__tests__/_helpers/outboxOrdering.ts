/**
 * CW-T-F1 — safe outbox-row ordering for tests.
 *
 * ===========================================================================
 * THE DEFECT THIS FILE DOCUMENTS AND GUARDS AGAINST
 * ===========================================================================
 * `case_workspace_event_outbox.created_at` is `TIMESTAMPTZ NOT NULL DEFAULT
 * now()` (server/migrations/20260810_case_workspace_event_outbox.sql:171).
 * Postgres's `now()` is fixed at TRANSACTION START, not per-statement — so
 * two rows committed by two DIFFERENT, genuinely concurrent transactions can
 * legitimately share the exact same `created_at` value. This was measured
 * directly against this schema (not assumed): 400 concurrent single-row
 * INSERT transactions produced only 86 DISTINCT timestamps, with up to 9
 * transactions sharing one value (docs/product/case-workspace/
 * TEST_DETERMINISM_REPORT.md §1.2). This is NOT rare under a busy parallel
 * test suite — it is the common case.
 *
 * Several existing test files (see `proposalApprovalService.pg.test.ts`'s
 * `readOutboxRowsForAggregate()`, line ~448–458 as of CW-T-F1) break
 * `created_at` ties with `event_id ASC` as a secondary sort key. `event_id`
 * is `cwevt-${randomUUID()}` (eventOutboxService.ts's `publishEvent`) — a
 * value with ZERO correlation to insertion order. Whenever two rows for the
 * SAME aggregate happen to tie on `created_at`, `ORDER BY created_at ASC,
 * event_id ASC` silently returns them in effectively RANDOM order instead of
 * true causal order — proven directly against this schema in
 * TEST_DETERMINISM_REPORT.md §1.1 (a 6-row same-transaction burst, ordered
 * by that exact clause, came back scrambled, not in insertion order).
 *
 * `eventOutboxService.ts`'s own `dispatchPendingEvents()` was very recently
 * given the SAME anti-pattern (`ORDER BY created_at, event_id` — see that
 * file, uncommitted as of this investigation under packet CW-T-E). This
 * class of bug is spreading, not shrinking — see TEST_DETERMINISM_REPORT.md
 * §4 for the exact fix recommendation (a monotonic append-order column).
 *
 * ===========================================================================
 * WHAT THIS FILE PROVIDES UNTIL THE SCHEMA GETS A MONOTONIC COLUMN
 * ===========================================================================
 * `assertOutboxRowsHaveNoTimestampTies()` — call this on any row set your
 * test is about to assert an exact `event_type` SEQUENCE over. It throws a
 * clear, actionable error identifying the exact tied rows if `created_at`
 * ties are present, INSTEAD OF letting a silent scramble either flip your
 * assertion to a false failure (a real flake) or, worse, a false pass (two
 * events land in a coincidentally-still-correct order and the test never
 * notices the ordering was never actually guaranteed).
 *
 * This does not fix the tie — it turns a silent, intermittent wrong-order
 * bug into a loud, immediate, first-failure diagnostic. The real fix (a
 * schema change) is out of this packet's allowlist; see
 * TEST_DETERMINISM_REPORT.md §4 for the migration recommendation and exactly
 * which files the coordinator needs to touch.
 */

export interface OutboxOrderingRow {
  event_type: string;
  created_at: Date | string;
  event_id: string;
}

/**
 * Throws if any two rows share an identical `created_at` (to the precision
 * the driver returns — see the module doc for why this happens even for
 * genuinely different transactions). Call this immediately after reading
 * outbox rows back, BEFORE asserting on their order, whenever the assertion
 * depends on `event_type` sequence rather than on `aggregate_version`
 * (which is set inside the SAME transaction as the row it belongs to and is
 * therefore reliable — prefer asserting on `aggregate_version` order over
 * `created_at` order wherever the row shape carries it).
 */
export function assertOutboxRowsHaveNoTimestampTies(rows: OutboxOrderingRow[]): void {
  const seen = new Map<string, OutboxOrderingRow[]>();
  for (const row of rows) {
    const key =
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
    const bucket = seen.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      seen.set(key, [row]);
    }
  }

  const tiedGroups = [...seen.entries()].filter(([, bucket]) => bucket.length > 1);
  if (tiedGroups.length === 0) return;

  const detail = tiedGroups
    .map(
      ([ts, bucket]) =>
        `  created_at=${ts}: ${bucket.map((r) => `${r.event_type}(${r.event_id})`).join(', ')}`
    )
    .join('\n');

  throw new Error(
    `outbox_created_at_tie_detected: ${tiedGroups.length} group(s) of rows share an identical ` +
      `created_at. Any test asserting an exact event_type SEQUENCE over these rows is not ` +
      `actually testing order — Postgres does not define tie-break order, and this codebase's ` +
      `ORDER BY created_at ASC, event_id ASC resolves ties by a random UUID with no relation to ` +
      `insertion order (see this file's module doc and TEST_DETERMINISM_REPORT.md §1). Prefer ` +
      `asserting on aggregate_version instead of relying on created_at/event_id order, or fix the ` +
      `race that produced the tie.\n${detail}`
  );
}

/**
 * `sortByAggregateVersionThenCreatedAt` — the ROBUST alternative sort for
 * tests that read rows back via `SELECT *` (unordered, or ordered only by
 * `created_at` without a tiebreaker) and need a deterministic sequence.
 * `aggregate_version` is written inside the SAME transaction as the mutation
 * that produced the row (see every caseWorkspace service's
 * `withPgTransaction`/`withRawPgTransaction` call sites) and is a real,
 * strictly-increasing-per-aggregate counter — unlike `event_id`, it actually
 * encodes causal order. Rows with a NULL aggregate_version (platform-global
 * aggregates — capability registry, feature flags — see
 * eventOutboxService.ts's own `ORDER BY aggregate_version ASC NULLS LAST,
 * occurred_at ASC, created_at ASC` for the established precedent) sort last,
 * in created_at order among themselves.
 */
export function sortByAggregateVersionThenCreatedAt<
  T extends { aggregate_version: number | null; created_at: Date | string },
>(rows: T[]): T[] {
  const toMillis = (v: Date | string): number =>
    v instanceof Date ? v.getTime() : new Date(v).getTime();
  return [...rows].sort((a, b) => {
    if (a.aggregate_version === null && b.aggregate_version === null) {
      return toMillis(a.created_at) - toMillis(b.created_at);
    }
    if (a.aggregate_version === null) return 1;
    if (b.aggregate_version === null) return -1;
    return a.aggregate_version - b.aggregate_version;
  });
}
