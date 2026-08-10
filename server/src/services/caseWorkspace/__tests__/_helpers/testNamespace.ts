/**
 * CW-T-F1 — shared test-isolation helpers, namespace generator.
 *
 * WHY THIS EXISTS
 * ----------------
 * Every `*.pg.test.ts` file in this directory already generates its own
 * per-test IDs via `${label}-${randomUUID()}` inline (see
 * `proposalApprovalService.pg.test.ts`'s `seedOrgProjectCase()`,
 * `runBindingService.pg.test.ts`'s equivalent, etc.) — that pattern is
 * ALREADY collision-safe (UUIDv4 has ~2^122 bits of entropy; no interference
 * was found to originate from ID collisions across the 30 files audited for
 * CW-T-F1, see docs/product/case-workspace/TEST_DETERMINISM_REPORT.md §2).
 *
 * This helper does not replace that pattern — it standardizes it, so new
 * packets don't hand-roll a slightly different (and potentially less safe —
 * e.g. `Date.now()`-based, or file-scoped counters that reset per fork)
 * scheme, and so every generated id carries a stable, greppable marker
 * (`cwtest-`) that a human or a cleanup script can filter on without having
 * to know every individual packet's naming convention.
 *
 * NOT a fix for the CW-T-F1 root causes documented in
 * TEST_DETERMINISM_REPORT.md §1 (the `pg_class_relname_nsp_index`
 * concurrent-DDL race in `initDb()`, and the outbox read query's
 * non-monotonic tie-break) — those are structural/schema-level and need the
 * fixes listed in that report's §4, not a naming convention.
 */

import { randomUUID } from 'node:crypto';

/** Stable marker every id from this helper carries, for greppability/cleanup. */
export const TEST_NAMESPACE_MARKER = 'cwtest';

/**
 * One unique, human-greppable id: `cwtest-<label>-<uuid>`.
 *
 * `label` should identify the CALLING TEST (not just the file) — e.g.
 * `'outbox-lifecycle'`, `'tie-break-regression'` — so a failure's fixture
 * rows are traceable back to the specific `it()` block that created them
 * without needing the uuid.
 */
export function uniqueTestId(label: string): string {
  const safeLabel = label.trim().replace(/[^a-zA-Z0-9-]+/g, '-');
  return `${TEST_NAMESPACE_MARKER}-${safeLabel}-${randomUUID()}`;
}

/**
 * A matched set of ids for the common org/project/case/actor fixture
 * quadruple every `*.pg.test.ts` file in this directory seeds per test.
 * Callers still do their own INSERTs (this helper has no DB dependency,
 * intentionally — it must work identically whether the caller uses the
 * test's own `control: pg.Pool`, `withPgTransaction`, or
 * `withRawPgTransaction`) — it only guarantees the IDS are unique and
 * traceable, matching the existing `seedOrgProjectCase(label)` shape used
 * across the suite so adoption is a pure rename, not a rewrite.
 */
export interface TestFixtureIds {
  orgId: string;
  projectId: string;
  caseId: string;
  actorId: string;
}

/**
 * Generates the four ids `seedOrgProjectCase()`-style helpers need, WITHOUT
 * touching the database. `caseId` is included for callers that mint their
 * own case_core row id client-side rather than reading it back from
 * `caseCoreService.createCase()`'s return value — most existing tests read
 * `created.caseId` back instead and can ignore this field.
 */
export function testFixtureIds(label: string): TestFixtureIds {
  const suffix = randomUUID();
  const safeLabel = label.trim().replace(/[^a-zA-Z0-9-]+/g, '-');
  return {
    orgId: `${TEST_NAMESPACE_MARKER}-org-${safeLabel}-${suffix}`,
    projectId: `${TEST_NAMESPACE_MARKER}-project-${safeLabel}-${suffix}`,
    caseId: `${TEST_NAMESPACE_MARKER}-case-${safeLabel}-${suffix}`,
    actorId: `${TEST_NAMESPACE_MARKER}-actor-${safeLabel}-${suffix}`,
  };
}
