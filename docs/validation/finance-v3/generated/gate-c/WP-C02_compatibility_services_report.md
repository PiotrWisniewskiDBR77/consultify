# WP-C02 — Compatibility Services Report (Gate C)

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`, Gate C / WP-C02
**Work package:** WP-C02 — canonical Finance services + API compatibility adapters. First round of real
application code (not ADR/docs) in this program.
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Input:** `docs/validation/finance-v3/generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` (schema
naming authority), `docs/validation/finance-v3/generated/gate-c/WP-C01_migration_report.md` +
`server/migrations/20260809_finance_v3_b0*.sql` (the real, tested DDL — treated as the source of truth
over the raw Gate B ADRs, per the brief), `docs/validation/finance-v3/generated/gate-a/WP-A02_api_freeze.md`
+ `WP-A02_api_fixtures.json` (frozen legacy contracts), and `WP-B02_lifecycle_concurrency_ADR.md` (state
machine / atomic approval / reopen algorithm — read in full since B01's migration header explicitly
defers to it for the columns/triggers it needed).

---

## 1. Database isolation

Same hard rule and same procedure as WP-C01 (`WP-C01_migration_report.md` §1): never the shared Homebrew
Postgres (`/opt/homebrew/opt/postgresql@15/bin/postgres -D /opt/homebrew/var/postgresql@15`, PID 911,
observed running throughout, left untouched).

- **Own ephemeral cluster:** data directory `/private/tmp/finance-v3-c02-pgdata-76277-2463` (random
  suffix), `initdb --locale=C` with the `/opt/homebrew/opt/postgresql@15/bin/` binaries.
- **Own port:** `56923`, picked from the 55000-59999 range and verified free with `lsof -iTCP -sTCP:LISTEN`
  before use; server bound to `listen_addresses=127.0.0.1` only.
- **Verification during the session:** `ps aux` at the point of peak activity showed three, fully separate
  `postgres` processes on this machine — PID 911 (shared instance, untouched), PID 72618 on
  `-D /private/tmp/finance-v3-c03-pgdata-1384022024 -p 57891` (a **different** work package's own ephemeral
  cluster, running concurrently in what appears to be a shared worktree/session — also left completely
  untouched, never connected to), and PID 76327 on `-D /private/tmp/finance-v3-c02-pgdata-76277-2463 -p
  56923` (this work package's own cluster).
- Ran the project's own migration runner (`server/scripts/migrate.postgres.ts`) against the empty ephemeral
  database: **all 586 migrations applied, 0 skipped, 0 errors** (same corpus WP-C01 validated, replayed
  fresh here since this is a separate cluster).
- **Teardown:** `pg_ctl stop` then `rm -rf` of the data directory, executed at the end of this work package.
  No process for this cluster was left running (`ps aux` re-checked immediately after: PID 911 and PID
  72618's cluster both still present and unaffected; port 56923 gone).
- An unrelated untracked file, `server/scripts/finance-v3-backfill-dry-run.ts`, appeared in this worktree
  during the session (not created by this work package) — evidence the worktree is shared with another
  concurrent session (consistent with the second Postgres cluster observed above). It was left untouched
  and is not part of this report's `git add`.

## 2. Canonical services delivered

All five, in `server/src/services/finance/canonical/` (new directory; zero existing files in
`server/src/services/finance/` modified):

| File | Responsibility | DB access pattern |
|---|---|---|
| `lifecycleService.ts` | WP-B02 state machine (T2-T7, T10-T11 transition table), risk-tier default/escalation, self-approval (SoD) check, `expectedVersion`/`If-Match` reconciliation | **None** — pure functions over plain data, zero imports from `pg`/`DbPromise`/Express |
| `artifactVersionService.ts` | `finance_artifacts`/`finance_business_versions`/`finance_working_revisions` CRUD, generic `transition()` (CAS + audit log), atomic `approveVersion()` (WP-B02 §5, 4 ordered steps), non-mutating `reopenVersion()` (WP-B02 §6) | `withPinnedPostgresTransaction` (real `BEGIN`/`SELECT ... FOR UPDATE`/`COMMIT` on one connection) |
| `lineageService.ts` | `finance_lineage_edges` insert + ancestor/descendant recursive-CTE queries; pure `stageRank`/`validateEdgeRank` mirror of the DB trigger for fast client-side 4xx | `withPinnedPostgresTransaction` + pure pre-check |
| `computeJobService.ts` | `compute_jobs`/`compute_job_runs`/`compute_job_outputs` — idempotent `enqueue`, `FOR UPDATE SKIP LOCKED` `claim`, `completeJobSuccess`/`failJob`/`cancelJob` | `withPinnedPostgresTransaction` |
| `exceptionLedgerService.ts` | `finance_exceptions` append-only ledger — `raise`/`accept`/`waive`/`resolve`, `finance_exceptions_current` reads | `withPinnedPostgresTransaction` |

**Why `withPinnedPostgresTransaction`, never `DbPromise`:** `DbPromise.run`/`.get`/`.all` default to
`fallback: true`, which swallows real DB errors and returns an empty/success-shaped result — the exact
"green tests, false success" failure mode this program's own audits keep finding elsewhere in Finance
(project memory: `p4-apator-realny-upload-2026-08-06`, `m04-complete-mvp-2026-08-05`, etc.). `approve`/
`reopen`/`claim` are multi-statement, must-be-atomic, must-fail-loud operations that also need
`SELECT ... FOR UPDATE` on one physical connection — `financialModelingService.ts`'s own
`withFinancialModelIdempotencyLock`/`setBaseline` functions already document why a `DbPromise`-based
"transaction" is not one. Every new service in this work package follows that same, already-established
pattern instead of inventing a new one.

### 2.1 Atomic approve — the four WP-B02 §5 steps, verified against the real triggers

`approveVersion()` runs, in one transaction: (a) `SELECT ... FOR UPDATE` + freshness/blocking-exception/SoD
validation: (b) `INSERT` (never `UPDATE`) into `finance_compute_snapshots`; (c) the status `UPDATE` that
sets `compute_snapshot_id` in the **same statement** as the status flip (satisfying the B01 migration's
own `trg_finance_bv_immutability` trigger, which rejects `APPROVED` without a `compute_snapshot_id`); (d)
an append-only `artifact_lifecycle_events` insert, same transaction. T9 (supersede the parent on a
successful reopen→approve) is attempted best-effort in the same transaction, per the tradeoff the ADR
itself documents in §5.2 (no background reconciliation job exists yet in this work package to repair a
post-commit T9 failure, so keeping it in-transaction is the safer default today).

### 2.2 Reopen — proven non-mutating, not just claimed

`reopenVersion()` never issues an `UPDATE` against the old (`vN`) row — the integration test
(`canonicalServices.pg.test.ts`, "reopen creates a new DRAFT vN+1 and leaves vN byte-for-byte unchanged")
reads `vN` back after a successful reopen and asserts it `toEqual`s the pre-reopen row exactly. This is the
literal bug class WP-B02 §6.1 documents (`financialModelingService.ts` lines 2001/2047/2059,
`UPDATE financial_models SET status='draft' ... WHERE status='approved'`) and is the reason this whole
lifecycle rewrite exists.

## 3. Adapters delivered

New router, `server/src/routes/v8/finance-v2/` (`index.ts` + `models.routes.ts`), mounted at
`/api/v8/finance-v2/*` in `server/src/routes/v8/index.ts` — the **only** existing file touched by this
work package, a 3-line addition (one import, one `v8Router.use('/finance-v2', financeV2Routes)`, one
comment) placed before the catch-all `/finance` mount. No other legacy route/service file was modified.
Mounting under the shared `v8Router` means this adapter inherits the exact same auth/context middleware
chain fixture F4 documents (`verifyToken` → `requireV8OrgContext` → `v8OrgGate` → `attachV8Context` →
`v8MetricsMiddleware` → `mutationAbortCanary`) with zero extra wiring.

Two endpoints, per the brief's "model approve, model reopen" suggestion:

| Endpoint | Legacy twin | Contract |
|---|---|---|
| `POST /api/v8/finance-v2/models/:modelId/approve` | Fixture **F4** (`WP-A02_api_fixtures.json`), `POST /api/v8/finance/models/:modelId/approve` | **Bit-identical** to the fixture for both documented outcomes — verified below |
| `POST /api/v8/finance-v2/models/:modelId/reopen` | **None** — grepped `finance.routes.ts`/`financial-modeling.routes.ts`: zero `reopen` routes exist anywhere in the legacy surface (the legacy "reopen" behavior is the in-place-mutation bug itself, not a contract worth freezing) | New canonical-only route, `{data, meta}` envelope, full WP-B02 §4.2 `Idempotency-Key`-required enforcement (no legacy compatibility constraint to relax it for) |

`:modelId` in both routes is a canonical `finance_artifacts.artifact_id` (artifact_type `BASELINE_MODEL`),
not a legacy `financial_models.id` — this work package proves the **contract shape and canonical-storage
wiring**, not a live legacy-row cutover. `finance_artifact_aliases` (the legacy→canonical id bridge table
from WP-B01) is explicitly WP-C03 scope per the WP-C01 migration report and was not populated here.

### 3.1 Bit-identical verification (not just claimed — asserted by a real HTTP test)

`server/src/routes/v8/finance-v2/__tests__/models.routes.pg.test.ts` builds a real `express()` app, mounts
the actual router, sends real HTTP requests via `supertest`, and asserts `res.body` with
`expect(res.body).toEqual(fixture.response.success_200)` / `.toEqual(fixture.response.error_409_version_conflict)`
— **the fixture object is read directly from `WP-A02_api_fixtures.json` on disk**, not re-typed by hand, so
the test cannot silently drift from the frozen contract file. Both assertions pass:

- `success_200`: adapter returns exactly `{"success":true,"status":"approved"}` — no extra keys, no
  `data`/`meta` envelope (unlike the rest of this program's `{data, meta}` convention — the fixture is
  authoritative here, not house style).
- `error_409_version_conflict`: adapter returns exactly `{"code":"VERSION_CONFLICT"}` on a stale
  `expectedVersion` — no `error` text key, matching the fixture's minimal shape exactly.

Every other outcome the canonical `approveVersion()` can produce (`STATE_PRECONDITION_FAILED`,
`APPROVAL_BLOCKED`, `SELF_APPROVAL_FORBIDDEN`, `WORKING_REVISION_NOT_FOUND`, `NOT_FOUND`) has **no**
fixture-frozen shape — the legacy endpoint had no freshness/SoD/blocking-exception gate at all, so nothing
froze those. The adapter returns a reasonable `{error, code}` superset for those and this is called out
explicitly in the route file's own comments as additive coverage, not a claimed byte-identical match.

`reopen` has no legacy fixture to match (§3 above), so its HTTP test only proves the round-trip works (201
`DRAFT` created, `Idempotency-Key` enforced with `400 IDEMPOTENCY_KEY_REQUIRED` when absent) — not a
bit-identical claim, because there is nothing to be identical to.

## 4. Test results

**54/54 passing**, three files, run twice consecutively against the same (non-reset) ephemeral database to
confirm idempotency of the test suite itself, not just of the code under test:

| File | Kind | Count | DB |
|---|---|---|---|
| `lifecycleService.test.ts` | Pure unit | 21 | none |
| `lineageService.test.ts` | Pure unit | 13 | none |
| `canonicalServices.pg.test.ts` | Real PostgreSQL integration | 17 | ephemeral (this work package's own) |
| `models.routes.pg.test.ts` | Real PostgreSQL + real HTTP | 3 | ephemeral (this work package's own) |

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:56923/finance_v3_c02 \
npx vitest run --config vitest.config.ts src/services/finance/canonical src/routes/v8/finance-v2 \
  --no-file-parallelism

 Test Files  4 passed (4)
      Tests  54 passed (54)
```

Pure-unit files (`lifecycleService.test.ts`, `lineageService.test.ts`) were additionally run standalone
with no `DATABASE_URL` set at all, confirming they need no database (34/34 pass). The two `.pg.test.ts`
files are `describe.skipIf`-gated on `RUN_DB_TESTS=1 && MOCK_DB=false && DATABASE_URL` starting with
`postgres`, matching this repo's established convention (`ini005-*.pg.test.ts`,
`documentSourcePackPersistence.pg.test.ts`) — a run with no real database reachable reports SKIPPED, never
a false green.

### 4.1 What the real-DB tests specifically prove (not restated from the pure-unit layer)

- **Atomic approve, end to end**: freshness gate blocks approval (`APPROVAL_BLOCKED`) until
  `freshness='CURRENT'`; a stale `expectedVersion` is rejected `VERSION_CONFLICT` with the real
  `currentVersion` read back; `compute_snapshot_id` is genuinely frozen (a real
  `finance_compute_snapshots` row exists afterward); an idempotency-key replay returns the same
  `businessVersionId`/status without a second DB write; a MATERIAL/HIGH_RISK self-approval attempt is
  rejected `SELF_APPROVAL_FORBIDDEN`; an `OPEN` `SECURITY`-severity exception blocks approval.
- **Reopen, end to end**: `vN` is read back byte-identical after reopen (see §2.2); a second reopen attempt
  against the same `vN` (open child already exists) is rejected `DRAFT_ALREADY_EXISTS` with the real
  existing child id; an idempotency-key replay of `reopen` returns the same child version, not a second
  one; missing reason / wrong role are rejected before any DB write.
- **Lineage cycle prevention via the real DB trigger, not just the app-level mirror**: one test inserts a
  backward edge (`BASELINE_MODEL → STATEMENT_PACK`) **directly** via a raw `INSERT`, bypassing
  `insertEdge()`'s own `validateEdgeRank()` pre-check entirely, and asserts the DB trigger itself
  (`finance_lineage_prevent_cycle`) rejects it — proving the authoritative enforcement point actually
  works, not merely that this service's own pure copy of the rule agrees with itself.
- **`FOR UPDATE SKIP LOCKED`, genuinely concurrent**: two `claim()` calls fired with `Promise.all` (real
  concurrency, not sequential awaits) against a shared 4-job pool never claim an overlapping set — a
  property that cannot be proven by a mock, only by real Postgres row locking.
- **Append-only enforcement discovered the hard way**: the first draft of this test file's `afterAll`
  cleanup attempted `DELETE FROM artifact_lifecycle_events` and the run failed with the DB's own
  `artifact_lifecycle_events is append-only; DELETE not permitted` error — i.e. the test suite's own
  cleanup code tripped the same guarantee its dedicated trigger tests exist to prove, one layer up. The
  cleanup was rewritten (see the test file's header comment) to only delete what is genuinely deletable
  (`compute_jobs`/`compute_job_runs`/`compute_job_outputs`, none of which carry a deny-delete trigger); the
  organization/artifact/version rows this suite creates are left in place by design, matching the
  established precedent in this exact repo (`documentSourcePackPersistence.pg.test.ts`'s header comment).

## 5. Judgment calls / documented deviations

1. **`:modelId` = canonical `artifact_id`, not a legacy-id bridge.** No `finance_artifact_aliases` lookup
   exists in this work package (WP-C03 scope per WP-C01's report). Flagged in both route file headers.
2. **`approve`'s non-fixture-frozen error outcomes are additive, not bit-identical-claimed.** Documented
   inline in `models.routes.ts` and in §3.1 above — the legacy endpoint simply never had a freshness/SoD/
   blocking-exception gate, so WP-A02 never froze a shape for those outcomes to match.
3. **`reopen` enforces `Idempotency-Key` as strictly required**, per WP-B02 §4.2's aspiration for *every*
   mutating lifecycle endpoint, rather than the "optional" compromise `approve` uses for backward
   compatibility with pre-ADR legacy behavior — justified because `reopen` has no legacy fixture
   constraining it either way, so there is no backward-compatibility reason to relax it.
4. **T9 (supersede-parent) kept in-transaction with `approve`**, per the ADR's own documented tradeoff
   (§5.2) rather than a separate follow-up transaction + reconciliation job, since no such job exists yet
   in this work package.
5. **SoD self-approval check uses `submitted_by` plus a caller-supplied `editorUserIds` list**, not a full
   query of every mutating edit since submission from `artifact_lifecycle_events` (WP-B02 §7.2.6's literal
   text) — the caller can supply that list; `approveVersion()` does not compute it internally in this work
   package. Documented in `ApproveVersionParams`'s doc comment.
6. **Materiality threshold is not implemented** (GATE_B_INTEGRATION_RECONCILIATION.md §7 —
   `PROVISIONAL_PENDING_OWNER_DECISION`, an explicit open owner decision, not this work package's to make).
   `risk_tier` escalation-by-threshold (`escalateRiskTier`) is implemented as a pure function but nothing
   calls it yet; only the static default-by-artifact-type is wired into `createArtifact`.
7. **Role assignment is a fixed org-role → Finance-role mapping** (`mapOrgRoleToFinanceRole` in
   `models.routes.ts`), per WP-B02 §7.1's own documented default mapping table — per-user Finance role
   assignment (AP-09) is explicitly out of scope for that ADR and for this work package.

## 6. Summary

- **5 canonical services** in `server/src/services/finance/canonical/` (new directory, zero legacy files
  modified): `lifecycleService.ts` (pure), `artifactVersionService.ts`, `lineageService.ts`,
  `computeJobService.ts`, `exceptionLedgerService.ts`.
- **2 adapters** in `server/src/routes/v8/finance-v2/` (new directory), mounted via a 3-line addition to
  `server/src/routes/v8/index.ts` (the only pre-existing file touched): `approve` (bit-identical to frozen
  fixture F4, HTTP-verified) and `reopen` (new canonical-only endpoint, no legacy contract to match).
- **54/54 tests pass** (34 pure unit, 20 real-PostgreSQL — 17 service-level + 3 real-HTTP), run twice
  consecutively for idempotency, against this work package's own ephemeral, isolated, torn-down-afterward
  Postgres cluster. Zero connections to the shared local instance, to any other session's concurrent
  ephemeral cluster (observed but untouched), or to any demo/staging/prod host.
- Every new `.ts` file individually passed an `esbuild --bundle` sanity check before commit (per-file, not
  a full project `tsc`).
