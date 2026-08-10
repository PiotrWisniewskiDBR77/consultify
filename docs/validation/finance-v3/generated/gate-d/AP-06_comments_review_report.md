# AP-06 — Comments / review / assignments / review checklist

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
**Source requirement:** `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3
point 6 ("Komentarze i review: komentarz do artefaktu/KPI/linii/komorki/okresu, mentions, assign,
resolve/reopen, blocking flag i review checklist") — one of the items section 3's "Krytyczna zmiana
priorytetow" moved from P2 to P0/P1.
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Date:** 2026-08-10
**Base commit:** `7ca4892918` (IF-19 bugfix report + GoldCo script re-run proof — the last commit on this
branch before this work package started)

---

## 1. What was read before touching anything

1. `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3 point 6 — the requirement list this work
   package implements verbatim (see title above).
2. `server/src/types/finance/CellRef.ts` (AP-00) and `ArtifactRef.ts` — the addressing foundation.
   `CellRef`'s own header documents the additive-extension contract ("adding a new domain table is
   additive — append one literal ... no existing branch ... needs to change") and that its
   `FinanceTableNameValues` union has exactly one member today (`finance_stmt_lines`), because WP-D03's
   `finance_analysis_kpi_values` has no CellRef branch yet.
3. `server/src/services/finance/canonical/artifactVersionService.ts` and `lifecycleService.ts` (Gate C,
   WP-C02, post-BUG-GOLDCO-03) — `approveVersion()`'s atomic four-step transaction (steps a/b/c/d), in
   particular step (a3)'s existing SECURITY-exception blocking check, which this work package's own
   blocking-comment check (a3b) is deliberately modeled on.
4. `docs/validation/finance-v3/generated/gate-b/WP-B02_lifecycle_concurrency_ADR.md` sections 3 (state
   machine / transition table T1-T12) and 7 (roles: `preparer`/`reviewer`/`approver`/`finance_admin`/
   `viewer`; risk tier; self-approval/SoD gate) — reused as-is, no new role model invented.
5. `server/src/services/finance/canonical/exceptionLedgerService.ts` and its migration
   (`20260809_finance_v3_b05_exception_ledger.sql`) — the closest existing precedent for a
   business-version-scoped, org-tenant-safe service with a "current state" query the approval gate reads.
   Comments deliberately do **not** copy the append-only event-chain pattern exceptions use (see section 3
   below for why).
6. `server/migrations/20260809_finance_v3_d01_statements_01_tables.sql` (`finance_stmt_lines`,
   `finance_stmt_entities`) and `server/src/services/finance/canonical/__tests__/statementServices.pg.test.ts`
   — the Statement Pack fixture pattern (calendar/period/entity/stmt-line inserts) this work package's own
   test file reuses.

## 2. What was built

### 2.1 Migration — `server/migrations/20260809_finance_v3_d_ap06_comments_01_tables.sql`

Additive only, three new tables, no change to any existing table or trigger:

- **`finance_comments`** — `organization_id`, `artifact_id`, `business_version_id` (all FK'd, tenant-safe
  composite FKs matching the rest of Gate C/D), `anchor` (nullable `JSONB`, holds a serialized AP-00
  `CellRef` when present; `NULL` = artifact-level comment), `author_id`, `body`, `mentions TEXT[]`,
  `is_blocking BOOLEAN`, `resolved_by`/`resolved_at` (paired by a `CHECK`), `created_by/at`, `updated_at`
  (auto-touched by trigger). A **partial index**
  `(organization_id, business_version_id) WHERE is_blocking AND resolved_at IS NULL` makes the approval
  gate's lookup (section 2.3 below) cheap regardless of resolved-comment history size. A GIN index on
  `mentions` and one on `anchor` support the query surface in `commentService.ts`.
- **`finance_comment_assignments`** — `comment_id`, `assignee_id`, `due_date`, `assigned_by/at`. Append
  semantics: a reassignment INSERTs a new row rather than overwriting the old one (so "who was this
  assigned to at time T" stays answerable); "current assignee" = latest row by `assigned_at`.
- **`finance_review_checklists`** — `business_version_id`, `item`, `required BOOLEAN`, `checked_by`/
  `checked_at` (paired by a `CHECK`), `created_by/at`.

**Decision — comments are mutable, not append-only.** `finance_exceptions` (WP-B05) is append-only by
design because exceptions need a full audit event chain (RAISED/ACCEPTED/WAIVED/RESOLVED/...) for
dedup/audit. A comment thread's lifecycle is simpler — `OPEN <-> RESOLVED`, tracked by `resolved_by`/
`resolved_at` on the same row — and the task brief's own verb list ("resolve/reopen") describes a
toggle, not an event log. `resolveComment()`/`reopenComment()` therefore `UPDATE` the same row. This is a
deliberate, documented divergence from the exceptions-ledger pattern, not an oversight.

**Decision — `anchor` reuses `CellRef` verbatim; no KPI anchor kind is modeled.** The task brief asks for
comments "do artefaktu/KPI/linii/komorki/okresu". A `CellRef`'s `rowKey` already carries
`canonicalLineId` and its `columnKey` already carries `periodId`, so "line" and "period" anchors are the
same JSON shape as a "cell" anchor (just conceptually broader). A **KPI** anchor is *not* modeled: per
`CellRef.ts`'s own header, no `finance_analysis_kpi_values` branch exists in its discriminated union yet
(WP-D03 has a schema but no CellRef branch). Inventing a parallel, non-`CellRef` addressing scheme for KPI
comments here would violate the "don't design what a future work package owns" discipline
`ArtifactRef.ts`'s header documents for itself. When a future work package adds that branch to
`CellRef.ts`, `finance_comments.anchor` needs **no migration** — it is untyped `JSONB` already.

Verified against the real migrated schema (ephemeral Postgres, see section 4): applies cleanly on top of
every prior Finance v3 migration plus the full non-finance schema (full `migrate.postgres.ts` run, 534
migrations, `init-pgvector.sql` included).

### 2.2 `server/src/services/finance/canonical/commentService.ts`

`createComment` (validates `body` non-empty and `anchor`, if present, against `CellRefSchema`),
`resolveComment`/`reopenComment` (each rejects the no-op case — `ALREADY_RESOLVED`/`NOT_RESOLVED`),
`assignComment`/`getCurrentAssignment`, and query surface: `getComment`, `listByArtifact`,
`listByBusinessVersion` (both with `unresolvedOnly`/`blockingOnly` filters), `listByCell` (JSONB
containment on `anchor`), `listMentioning`, and `hasUnresolvedBlockingComments` — the exact predicate
`approveVersion()` step (a3b) runs, exposed for callers that need the same answer outside that
transaction (e.g. a UI "can I approve?" preflight). `approveVersion()` itself does **not** call this
function — see section 2.3.

### 2.3 `server/src/services/finance/canonical/reviewChecklistService.ts`

Two independent halves:

- **Checklist CRUD** — `addChecklistItem`, `checkItem`/`uncheckItem`, `setChecklistItemRequired`,
  `listChecklistItems`, `allRequiredItemsChecked` (true on an empty checklist — "nothing outstanding").
- **Changed-only reviewer entry** — `getChangedCellsForStatementPack(organizationId, businessVersionId,
  opts?)`. Resolves "the previous APPROVED business version" (via `parent_version_id` first, else the
  highest `version_no` APPROVED sibling below the current one), then diffs `finance_stmt_lines` between
  the two versions. Returns a **three-way** result: `hasPreviousApproved:false` (no baseline — caller
  should show the full grid, not an empty "nothing changed" state), or `hasPreviousApproved:true` with a
  `changedCells: ChangedCellEntry[]` (each a `CellRef` + previous/current `{valueStatus, valueDecimal}`).
  STATEMENT_PACK-specific today, for the same reason `CellRef.ts` itself is: `finance_stmt_lines` is the
  only Gate D domain table with a shipped schema.

  **Bug caught and fixed before this shipped, not after:** the first draft of the diff query joined
  `cur.entity_id = prev.entity_id`. `finance_stmt_entities` rows are scoped **one-per-`business_version_id`**
  (`uq_finance_stmt_entities_version_code UNIQUE (business_version_id, entity_code)`) — a reopened business
  version gets no copy of its parent's entity rows (confirmed by reading `reopenVersion()`, which copies
  the working revision but never touches `finance_stmt_lines`/`finance_stmt_entities`). Joining on raw
  `entity_id` therefore made **every** cell look changed (100% false positive) the first time the new
  "50 cells, 3 changed" test was run against it. Fixed by joining through `finance_stmt_entities` on
  `entity_code` (the column's own documented "stable natural key across versions... for the same legal
  entity") instead. The returned `CellRef.rowKey.entityId` still prefers the **current** version's
  `entity_id` (falling back to the baseline's only for a cell that was fully removed) so the ref resolves
  against `businessVersionId`, the version actually being reviewed.

### 2.4 `approveVersion()` — the one line that matters

`server/src/services/finance/canonical/artifactVersionService.ts`, inside the existing atomic transaction,
immediately after step (a3)'s SECURITY-exception check and before step (a4)'s SoD gate:

```ts
// (a3b) no unresolved blocking comment (AP-06 ...).
const blockingComment = await tx.queryOne<{ id: string }>(
  `SELECT id FROM finance_comments
    WHERE organization_id = ? AND business_version_id = ? AND is_blocking = true AND resolved_at IS NULL
    LIMIT 1`,
  [params.organizationId, params.businessVersionId]
);
if (blockingComment) {
  return { ok: false, code: 'APPROVAL_BLOCKED', message: 'Unresolved blocking comment(s) present' };
}
```

**Approach taken and why:** the task brief offered two options — inline the check inside
`approveVersion()`, or a separate guard called before it from an orchestration layer. Inline was chosen:
(1) it reuses the existing `APPROVAL_BLOCKED` error code with zero new surface — the exact same pattern
the (a3) SECURITY-exception check already established one block above it; (2) a separate pre-flight guard
is something a caller could forget to invoke (the SECURITY-exception check is not implemented that way
either, for the same reason); (3) both checks must run on the **same pinned connection/transaction** as
the rest of the atomic approve — a `SELECT ... FOR UPDATE` already pins the row for the duration of this
transaction, and a second round-trip through a different connection could observe a comment resolved/
created mid-transaction that this transaction's own snapshot should not see. No new `ApproveErrorCode` was
added; no other step in `approveVersion()` was touched. `commentService.hasUnresolvedBlockingComments()`
duplicates the identical query for out-of-transaction callers (UI preflight, tests) — a deliberate small
duplication over adding a cross-service call into the middle of an atomic transaction.

## 3. Tests

New file: `server/src/services/finance/canonical/__tests__/commentReviewService.pg.test.ts` (7 tests, real
PostgreSQL, `describe.skipIf`-gated on `RUN_DB_TESTS=1`/`MOCK_DB=false`/a real `DATABASE_URL`, same
convention as every other `.pg.test.ts` in this directory):

| Test | Result |
|---|---|
| Unresolved `is_blocking` comment anchored to a `finance_stmt_lines` cell (via `CellRef`) in a Statement Pack rejects `approveVersion()` with `APPROVAL_BLOCKED`; resolving it lets the identical `approveVersion()` call through and reach `APPROVED` with a real `compute_snapshot_id` | PASS |
| A non-blocking comment does **not** gate `approveVersion()` | PASS |
| `createComment` persists `mentions`; `listMentioning` finds/excludes correctly; `assignComment`/`getCurrentAssignment` track the current assignee across a reassignment; `assignComment` on a nonexistent comment returns `NOT_FOUND` | PASS |
| `resolveComment`/`reopenComment` round-trip `resolved_by`/`resolved_at`; double-resolve -> `ALREADY_RESOLVED`; reopen-when-open -> `NOT_RESOLVED` | PASS |
| `addChecklistItem`/`checkItem`/`setChecklistItemRequired`/`allRequiredItemsChecked` — required-vs-optional item counting | PASS |
| **Changed-only**: 50 `finance_stmt_lines` cells (25 canonical lines x 2 periods) in an APPROVED v1, reopened to v2 with the identical 50 cells except 3 changed values -> `getChangedCellsForStatementPack` returns `hasPreviousApproved:true`, `previousBusinessVersionId` = v1, and **exactly** those 3 cells (by `canonicalLineId@periodId`), each with `previous.valueDecimal='1000'`/`current.valueDecimal='1234'` and a `CellRef` anchored to v2's own `entityId` | PASS |
| No previous APPROVED version -> `hasPreviousApproved:false`, `changedCells:null` (caller shows the full grid) | PASS |

```
Test Files  1 passed (1)
     Tests  7 passed (7)
```

## 4. Regression pack (required because `approveVersion()` was touched)

Per the task's own gate: `approveVersion()` was modified, so the full canonical + collaboration test pack
was re-run against a **fresh ephemeral PostgreSQL cluster** (own `initdb --locale=C`, port 57231 in the
55000-59999 range, data dir under `/private/tmp/`, never port 5432 — full 534-migration `migrate.postgres.ts`
run applied first, including `init-pgvector.sql`, then this work package's own AP-06 migration; cluster
`pg_ctl stop` + data dir `rm -rf` at the end of the session):

```
src/services/finance/canonical  -> Test Files  11 passed (11)   Tests  142 passed (142)
src/services/finance/collaboration -> Test Files  3 passed (3)  Tests  42 passed (42)
```

184/184 passing, **0 regressions**. This covers every existing canonical-service suite touching the
lifecycle/approval path directly or indirectly: `canonicalServices.pg.test.ts` (24 — includes the
pre-existing SECURITY-exception `approveVersion()` blocking test, still green, proving the new (a3b) check
did not disturb (a3)), `statementServices.pg.test.ts`, `kpiComputeService.pg.test.ts` (analysis),
`lifecycleService.test.ts`, `lineageService.test.ts`, `statementReconciliationService.test.ts`,
`baselineCircularitySolver.test.ts`, `baselineScheduleEngine.test.ts`, `formulaAstEvaluator.test.ts`,
`periodConventionResolver.test.ts`, plus this work package's own new file (11th canonical file), and all
three `collaboration` suites (`autosaveScheduler`, `operationStack`, `collaboration.pg.test.ts`). No
dedicated `prediction`/`valuation` `.pg.test.ts` suite exists yet in this codebase to include (searched
`server/src -iname "*valuation*test*"`/`*prediction*test*"` — none found under `finance/canonical`).

Type-checking: `esbuild` syntax check on all three new/edited files (clean) plus a scoped `tsc --noEmit`
pass covering `commentService.ts`/`reviewChecklistService.ts`/`artifactVersionService.ts` against
`server/tsconfig.json` (clean, no errors).

## 5. Known scope limitations / follow-on work

1. **KPI anchors** are not addressable yet (see section 2.1) — blocked on a future work package adding a
   `finance_analysis_kpi_values` branch to `CellRef.ts`'s discriminated union, not on anything in this
   migration.
2. **`allRequiredItemsChecked()` does not itself gate `approveVersion()`.** The task brief's blocking
   requirement was specifically about comments ("blocking flag" on a comment); the review checklist was
   asked for as "dodaj/sprawdz/wymagaj checklist items" (CRUD), not as a second approval gate. Wiring
   outstanding required checklist items into the approval gate as well is a reasonable follow-on but was
   out of this work package's literal scope and was not added speculatively.
3. **`finance_comment_assignments` has no "unassign" verb** — only reassignment (a new row with a
   different `assignee_id`). The task brief's verb list was "assign", not "unassign"; adding one is
   additive and cheap if a future work package needs it.

## 6. Commits

- `server/migrations/20260809_finance_v3_d_ap06_comments_01_tables.sql` (new)
- `server/src/services/finance/canonical/commentService.ts` (new)
- `server/src/services/finance/canonical/reviewChecklistService.ts` (new)
- `server/src/services/finance/canonical/artifactVersionService.ts` (edited — `approveVersion()` step
  (a3b) only)
- `server/src/services/finance/canonical/__tests__/commentReviewService.pg.test.ts` (new)
- `docs/validation/finance-v3/generated/gate-d/AP-06_comments_review_report.md` (this file)

See the branch's own `git log` for the exact commit SHA(s) this report was committed alongside.
