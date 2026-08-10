# AP-08 — Exception Inbox (query/aggregation layer)

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
**Source requirement:** `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
section 3 point 10 ("Exception inbox: tie-out fail, stale, compute failed, review assigned, blocker,
benchmark expired, unusual variance i import conflict z ownerem oraz deep linkiem").
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Date:** 2026-08-10
**Base commit:** `d87d98986e` (AP-02 Excel/CSV round-trip — the last commit on this branch before this
work package started)

---

## 1. What was read before touching anything

1. `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3 point 10 — the exact category list this
   work package implements: tie-out fail, stale, compute failed, review assigned, blocker, benchmark
   expired, unusual variance, import conflict; each item needs an owner and a deep link.
2. `docs/validation/finance-v3/generated/gate-b/WP-B05_exception_ledger_ADR.md`, in particular section 7
   ("Query wzorce — Exception Inbox"), which already designed the `finance_exceptions_current` dedup/SLA
   query pattern this work package reuses almost verbatim for the `tie_out_fail` category, and section 0,
   which documents that `finance_exceptions` is fed by multiple detection engines (reconciliation R1-R8,
   anomaly detector, shadow-parity), not a single "tie-out" source — see section 3 below for how that
   shaped the category-mapping decision.
3. `server/src/services/finance/canonical/exceptionLedgerService.ts` (Gate C, WP-C02) — the
   `finance_exceptions` / `finance_exceptions_current` wrapper this work package queries directly
   (read-only) rather than reimplementing.
4. `server/src/services/finance/canonical/commentService.ts` (AP-06) — `finance_comments` /
   `finance_comment_assignments`, the source for `blocker` and `review_assigned`. Its own doc comment
   on `hasUnresolvedBlockingComments()` explains why the blocking-comment predicate is inlined into
   `artifactVersionService.approveVersion()`'s own transaction rather than calling out to a shared
   function — this work package's `blocker` query is a third, independent read of the same underlying
   rows, which is consistent with that precedent (a read-only aggregation, no new coupling).
5. `server/migrations/20260809_finance_v3_b01_core_artifacts.sql` — confirmed
   `finance_business_versions.freshness` (`NEVER_COMPUTED`/`CURRENT`/`STALE_SOURCE`/`STALE_ASSUMPTIONS`/
   `COMPUTE_FAILED`), `.freshness_reason`, `.stale_since` are real, already-shipped columns (no migration
   needed for `stale`/most of `compute_failed`).
6. `server/migrations/20260809_finance_v3_b04_compute_jobs.sql` — confirmed `compute_jobs` has no
   `business_version_id` column (only `input_artifact_id`) — this shaped the dedupe-scope decision for
   job-sourced `compute_failed` entries (section 3 below).
7. `server/migrations/20260809_finance_v3_d03_analysis_01_tables.sql` — checked
   `finance_analysis_benchmarks` (no `expiry`/`valid_until` column exists) and `finance_analysis_variance`
   (has `owner`/`status`/`variance_pct`, usable for `unusual_variance`) — this is the "sprawdź" the task
   brief asked for on the benchmark-expiry question; see section 4 for the negative result.
8. `server/src/services/finance/canonical/financeImportService.ts` (AP-02) — confirmed `previewFinanceImport`
   is read-only and nothing is persisted unless `applyFinanceImport` is subsequently called; there is no
   "rejected preview" row anywhere in the schema. See section 4.
9. `server/src/services/finance/canonical/statementReconciliationService.ts` (WP-D02) — confirmed the
   `PROVISIONAL_MATERIALITY_THRESHOLD_PCT = 0.05` placeholder (`GATE_B_INTEGRATION_RECONCILIATION.md`
   section 7 / B02-Q4, `PROVISIONAL_PENDING_OWNER_DECISION`) is the one and only materiality number in
   this codebase — reused verbatim for `unusual_variance`, per the task's explicit "nie wymyślaj nowego
   progu".
10. `server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts` and
    `commentReviewService.pg.test.ts` — the ephemeral-Postgres test convention (`RUN_DB_TESTS=1`,
    `MOCK_DB=false`, `DATABASE_URL`, `describe.skipIf`) this work package's own test file follows.

## 2. What was built

**One new file, no migration, no new table.** `finance_exceptions` (WP-B05) already has the full
severity/owner/reason/expiry model DEC-FIN-009 requires; AP-08 is explicitly a query/aggregation layer
over data that already exists across five places:

### `server/src/services/finance/canonical/exceptionInboxService.ts`

`listExceptionInbox({ organizationId, artifactId? })` gathers raw candidate entries from six live
queries in parallel, assigns each a dedupe `groupKey`, merges same-key entries into one
`ExceptionInboxEntry`, and returns the result sorted by severity desc then most-recently-seen desc:

| Category | Source | Severity | Owner | Notes |
|---|---|---|---|---|
| `tie_out_fail` | `finance_exceptions_current`, `state='OPEN'`, `severity != 'INFO'` | real (`finance_exceptions.severity`) | `finance_exceptions.owner` | `INFO` excluded — WP-B05 §2: auto-log, "nie wymaga akcji" |
| `stale` | `finance_business_versions.freshness IN ('STALE_SOURCE','STALE_ASSUMPTIONS')` | fixed `WARNING` | defaulted: current working revision's `edited_by`, else business version's `created_by` | no `owner` column on this table at all |
| `compute_failed` | (a) `finance_business_versions.freshness = 'COMPUTE_FAILED'`, (b) `compute_jobs.status = 'failed'` (latest per artifact+job_type with no later `succeeded` attempt) | fixed `MATERIAL` | (a) same default as `stale`; (b) `compute_jobs.requested_by_user_id` | two sub-sources because `finance_business_versions.freshness` and `compute_job_outputs.freshness` (WP-B04) BOTH define a `COMPUTE_FAILED` value; job-sourced entries have no `business_version_id` (schema has none) so scope on `artifact_id` |
| `blocker` | `finance_comments`, `is_blocking=true`, `resolved_at IS NULL` | fixed `MATERIAL` | current assignee (`finance_comment_assignments`, latest by `assigned_at`), else comment author | same predicate `artifactVersionService.approveVersion()` step (a3b) enforces |
| `review_assigned` | `finance_comments`, `is_blocking=false`, `resolved_at IS NULL`, has a current assignment | fixed `INFO` | current assignee | deliberately excludes `is_blocking=true` rows so a blocking+assigned comment surfaces once, as `blocker`, not twice |
| `unusual_variance` | `finance_analysis_variance`, `status NOT IN ('RESOLVED','ACCEPTED')`, `ABS(variance_pct) > 0.05` | fixed `WARNING` | `finance_analysis_variance.owner` | threshold = the SAME `PROVISIONAL_MATERIALITY_THRESHOLD_PCT` reused from `statementReconciliationService.ts`, overridable per call |
| `benchmark_expired` | — | — | — | **not implemented** — see section 4 |
| `import_conflict` | — | — | — | **not implemented** — see section 4 |

**Deep link** (`ExceptionInboxEntry.deepLink`): `{ artifactId, businessVersionId, workingRevisionId,
cellRef, sourceRef, url }`, following the URL shape `WP-B05_exception_ledger_ADR.md` §7.3 already
specified: `/finance/artifacts/:artifactId[/versions/:businessVersionId]?focus=...&period=...&entity=...&<category-specific>=...`.
`cellRef` is a real AP-00 `CellRef` when the source is a comment anchor; `sourceRef` is the raw
`finance_exceptions.source_ref` JSONB passthrough for `tie_out_fail` entries (that column's shape is
looser than `CellRef` — WP-B05 §8 documents it as `statement_line_code`/`period_id`/`entity_id`/
`cell_ref`/`compute_run_id`/`legacy_*`, not every field always present).

**SLA**: reuses WP-B05 §7.2's window table verbatim (`INFO`=none, `WARNING`=30d, `MATERIAL`=5d,
`CRITICAL_DATA`=2d, `SECURITY`=0), computed live from `createdAt`, except `review_assigned` where an
explicit `finance_comment_assignments.due_date` overrides the computed window when present.

### Dedupe ("grouped by root cause, not by source table" — task requirement 1)

Every raw entry gets a `groupKey = <scope>::<causeKey>`:

- **Business-version-scoped sources** (`tie_out_fail` from `finance_exceptions`, `stale`/`compute_failed`
  from `finance_business_versions.freshness`) key on `bv:<business_version_id>::<normalized reason>`,
  where the normalized reason prefers `finance_exceptions.reason_code`, then `.reason`, then a business
  version's `freshness_reason` — the one piece of vocabulary genuinely shared between two different
  source tables describing the same real-world event (e.g. "upstream source changed" raising both an
  explicit exception AND flipping freshness to `STALE_SOURCE`).
- **Everything else** (comments, per-job compute failures, variance rows) keys on its own source-row id
  — deliberately NOT on free text (e.g. a comment's body), to avoid accidental merges of unrelated items
  that happen to share wording. Only the freshness/exception vocabulary is treated as a shared root-cause
  namespace; nothing else was asked to dedupe against anything else by the task brief.

When two-plus raw entries land in the same group, one representative is kept — chosen by
`CATEGORY_PRIORITY` (`tie_out_fail` > `compute_failed` > `blocker` > `review_assigned` > `stale` >
`unusual_variance`; an explicit, human/engine-raised exception outranks a derived freshness flag) — and
the rest fold into its `mergedCategories` and `sources` arrays, so no provenance is lost. Severity on the
merged entry is the MAX across all merged sources; owner prefers any explicit (non-defaulted) owner among
the merged sources over the representative's own possibly-defaulted owner.

## 3. Real-runtime test (ephemeral Postgres, per the branch's hard rule)

Own cluster only, per the CLAUDE.md hard prohibition on any shared/production database:

- `initdb --locale=C` (Homebrew `postgresql@15` binaries), data dir
  `/private/tmp/finance-v3-ap08-pgdata-90464`, port `57231` (55000-59999 range, verified free with `lsof`
  before use), `listen_addresses=127.0.0.1`. `LC_ALL=C` was required at `pg_ctl start` time — without it
  the server hits `FATAL: postmaster became multithreaded during startup` (a known local-machine quirk,
  not a schema issue).
- Ran `server/scripts/migrate.postgres.ts` against the empty database — the full migration history
  (hundreds of files, including the 26 existing `20260809_finance_v3_*` files) applied cleanly, ending
  `✅ Postgres migrations complete`.
- Ran the new suite:
  `server/src/services/finance/canonical/__tests__/exceptionInboxService.pg.test.ts` — **5/5 passed**.
- Re-ran the two neighboring Gate C/D suites this work package's queries touch adjacent tables of
  (`canonicalServices.pg.test.ts`, `commentReviewService.pg.test.ts`) to confirm no interference —
  **31/31 passed**.
- Teardown: `pg_ctl stop`, then `rm -rf` of the data directory. `ps aux` confirmed no process remained
  bound to that data directory afterward. The shared Homebrew Postgres instance (PID 911 per this
  branch's own prior work-package reports) was never touched; nothing was bound to port 5432.

### Test scenario ("3 different exception types on related GoldCo artifacts")

Two related artifacts under one `GoldCo AP-08 Test Org` organization:

1. **GoldCo Statement Pack 2026Q2** (`STATEMENT_PACK`) — hosts an explicit `finance_exceptions`
   `WARNING` row (`reason_code='ROUNDING_TOLERANCE_EXCEEDED'`, explicit `owner`) **and**, in a later
   step, `STALE_SOURCE` freshness (`freshness_reason='GOLDCO_UPSTREAM_SOURCE_REFRESH_2026Q2'`) on the
   SAME business version.
2. **GoldCo Baseline Model 2026Q2** (`BASELINE_MODEL`) — hosts one unresolved `is_blocking=true` review
   comment, no assignment (owner defaults to the comment author).

**Phase 1 result:** `listExceptionInbox({ organizationId })` returns exactly 3 entries —
`['blocker', 'stale', 'tie_out_fail']` — each with the expected severity, owner (explicit vs. correctly
defaulted), `businessVersionId`, and a deep-link URL containing the artifact id and the
category-specific query param (`focus=TOTAL_ASSETS`, `comment=<id>`).

**Phase 2 (dedupe) result:** a SECOND `finance_exceptions` row is raised on the SAME Statement Pack
business version, `severity='MATERIAL'`, `reason_code='GOLDCO_UPSTREAM_SOURCE_REFRESH_2026Q2'` — the
EXACT SAME string already sitting in the stale entry's `freshness_reason`. The inbox still returns
exactly 3 entries total (2 on that artifact, not 3): the pre-existing `stale` entry and the new
`tie_out_fail` row collapse into ONE merged entry with `mergedCategories = ['stale', 'tie_out_fail']`,
`category = 'tie_out_fail'` (priority-selected representative), `severity = 'MATERIAL'` (max across
merged sources), and `sources.length === 2` (full provenance retained). The first, unrelated
`ROUNDING_TOLERANCE_EXCEEDED` exception remains its own separate entry, confirming the dedupe key is
root-cause-specific and does not over-merge everything on the same business version.

## 4. Explicitly NOT implemented — future integration

Per the task's own permission ("jeśli to zbyt duży zakres, udokumentuj jako future integration"):

- **`benchmark_expired`.** Checked `finance_analysis_benchmarks`
  (`server/migrations/20260809_finance_v3_d03_analysis_01_tables.sql` §4): the table has `as_of_date`
  but no `expiry`/`valid_until` column and no org-level "benchmark max-age" policy exists anywhere in the
  schema. There is nothing for a query to compute "expired" from — this is a schema gap, not a query gap.
  Future integration: a WP-D03 follow-on migration would need to add an expiry column (or a policy the
  inbox can compare `as_of_date` against) before this category can return real rows. The
  `fetchBenchmarkExpiredEntries()` stub in `exceptionInboxService.ts` documents this and always returns
  `[]`.
- **`import_conflict`.** AP-02's `previewFinanceImport`/`applyFinanceImport`
  (`financeImportService.ts`) is a stateless preview -> apply pipeline: preview computes a diff read-only
  and returns it to the caller; nothing is persisted unless `applyFinanceImport` is subsequently called.
  A user who sees a conflicting preview and abandons it (or the frontend rejects it) leaves no row
  anywhere — there is no durable "rejected import attempt" state for AP-08 to query. Future integration:
  AP-02 would need to persist an explicit accepted/rejected/abandoned import-attempt record before this
  category can return real rows. The `fetchImportConflictEntries()` stub documents this and always
  returns `[]`.
- **`unusual_variance` is implemented, but is a genuinely thin first cut**, flagged here for completeness
  rather than silently presented as fully mature: `finance_analysis_variance` (WP-D03) already has
  `owner`/`status`/`variance_pct`, so the query itself is simple, but (a) there is no per-row frozen
  materiality threshold the way `finance_reconciliation_runs.materiality_threshold_applied` freezes one
  per run (WP-B05 §5.3) — this service applies the SAME 5% placeholder live, at query time, to every row,
  which means a later change to the org's materiality policy silently reclassifies old variance rows,
  unlike the frozen-per-run convention the rest of Gate B/C established; and (b) `comparison_type`
  (`PRIOR_PERIOD`/`BUDGET`/`FORECAST`) is not surfaced in the inbox entry's `title` today. Both are
  straightforward follow-ons, not open design questions, but were left out to keep this work package's
  surface area to what the test scenario actually exercises.

## 5. Known simplifications carried into this layer (not new, inherited)

- `tie_out_fail` surfaces EVERY open, non-`INFO` `finance_exceptions_current` row for the org/artifact,
  not only ones raised specifically by the reconciliation engine. WP-B05 §0 documents `finance_exceptions`
  as a SHARED ledger fed by reconciliation (R1-R8), the anomaly detector, and shadow-parity checks — the
  Addendum's fixed 8-category list has no generic "other exception" bucket, so every open exception
  (including a future anomaly-detector-raised or `SECURITY` row) surfaces as `tie_out_fail` today. Each
  entry still carries its real `reason_code`/`severity` so a consumer is not misled about what actually
  raised it. This is a documented simplification, not a defect — revisit if/when a `severity='SECURITY'`
  row's UX needs to look meaningfully different from a routine reconciliation residual in the inbox itself
  (today it is already visually distinguishable via `severity`, just not via `category`).
- SLA windows and the five fixed category severities (`stale`=WARNING, `compute_failed`=MATERIAL,
  `blocker`=MATERIAL, `review_assigned`=INFO, `unusual_variance`=WARNING) are this work package's own
  judgment calls, not literal values from any ADR — DEC-FIN-009's 5-level scale only has a defined
  meaning for `finance_exceptions` rows themselves. Configurable-per-org is a natural follow-on, not
  attempted here.

## 6. Files touched

- `server/src/services/finance/canonical/exceptionInboxService.ts` (new)
- `server/src/services/finance/canonical/__tests__/exceptionInboxService.pg.test.ts` (new)
- `docs/validation/finance-v3/generated/gate-d/AP-08_exception_inbox_report.md` (this file, new)

No migration files, no changes to any existing service or table.
