# AP-11 point 9 — lineage staleness propagation: from phantom to runtime

**Status:** `IMPLEMENTED` — proven on a real PostgreSQL 15 cluster, negative-controlled, regression-clean.
**Branch:** `codex/finance-v3-apwave-ap11-staleness` (branched from the frozen, accepted `19b4b06934`)
**Worktree:** `/Users/piotrwisniewski/consultify-wt/apwave-ap11-staleness`
**Date:** 2026-08-10
**Design source:** `docs/validation/finance-v3/generated/gate-b/WP-B03_lineage_staleness_ADR.md` §6
**Not pushed, not merged, no migration run against any shared/staging/production database.**

---

## 1. What was actually wrong

`server/migrations/20260809_finance_v3_b03_lineage_freshness.sql` creates the append-only ledger
`finance_lineage_freshness_events`, and `..._b01_core_artifacts.sql` creates
`finance_business_versions.freshness / freshness_reason / stale_since`. A `grep` over all of
`server/src` before this work package found **zero writers and zero readers of that ledger**, and
**nothing anywhere that ever set a version to `STALE_SOURCE` as a consequence of an upstream
change**. `workspace/lineageNavigatorContract.ts` only renders freshness handed to it by its
caller.

So AP-11 point 9 was unprovable in *both* directions:

- "a source version change marks its descendants stale" — never happened;
- "…without automatic recomputation" — vacuously true, because nothing happened at all.

That second half is the trap: a reviewer checking only "is anything recomputed?" would have
recorded a pass on a feature that did not exist.

## 2. What was built

### 2.1 New service — `server/src/services/finance/canonical/lineageFreshnessService.ts`

| ADR clause | Implementation |
|---|---|
| §6.2 row 1 — new approved source version | `propagateStalenessInTransaction(tx, {rootVersionId, reasonCode:'NEW_SOURCE_VERSION'})` |
| §6.2 row 2 — ancestor invalidated | same entry point, `reasonCode:'SOURCE_INVALIDATED'` |
| §6.3 step 1 — idempotent upsert | identical `(freshness, freshness_reason)` ⇒ **no `UPDATE` at all**, so `stale_since` keeps the original age of the staleness |
| §6.3 step 2 — append-only ledger | one `finance_lineage_freshness_events` row per real transition, with `triggering_edge_id`, `triggering_version_id`, `previous_state`, `new_state`, `reason_code` |
| §6.3 step 6 — nearest ancestor | `triggering_version_id` is the *source of the edge that reached this node*, not the root |
| §6.3 step 7 — fixed point | `visited` set; a diamond node is processed once |
| §6.3 step 5 — depth limit | `MAX_PROPAGATION_DEPTH = 20` (the ADR's own number), overridable per call |
| §6.3 — **no auto-recompute** | no code path enqueues a compute job, writes a snapshot, or mints a version/working revision; the returned summary carries a literal `recomputeEnqueued: false` |
| §6.4 — severity ordering | `SOURCE_INVALIDATED` > `ASSUMPTION_REGISTRY_CHANGED` > `NEW_SOURCE_VERSION` > `COMPUTE_ERROR`; a weaker reason never overwrites a stronger one but **is still written to the ledger** ("pełna historia zachowana") |
| §5 — tenant safety | every edge read and every version write carries `organization_id = ?`, on top of the composite FKs that make a cross-organization edge physically unstorable |

Two details worth naming because they are decisions, not incidentals:

- **`stale_since` is "how long has this been stale", not "when was it last re-flagged".** A node
  already in a stale state keeps its original timestamp even when the reason *escalates*
  (`NEW_SOURCE_VERSION` → `SOURCE_INVALIDATED`). Encoded in SQL as a `CASE` over the pre-update
  row, so it is atomic rather than read-then-write.
- **The CAS counter `version` is deliberately not bumped.** Freshness is an annotation about the
  content, not the content (§6.1). Bumping it would make an unrelated upstream approval steal an
  analyst's optimistic lock. This is also what makes marking an **APPROVED** descendant legal at
  all: `finance_bv_enforce_immutability()` (B01 §6) whitelists exactly
  `freshness`/`freshness_reason`/`stale_since` (plus status metadata) for APPROVED rows — and
  `version` is *not* on that list. See §5 below, where that same whitelist turns out to be a
  pre-existing landmine elsewhere.
- **An unrecognised incumbent `freshness_reason`** (the column is free TEXT with no CHECK; e.g.
  `exceptionInboxService`'s tests write an arbitrary root-cause string) is treated as the weakest
  value, so a real reason always wins over an opaque one. The alternative would let a stray string
  freeze a version's reason forever.

### 2.2 Trigger wiring — where and why

Both call sites are **one additive call inside the transaction that already exists**. No transaction
was restructured, no existing statement was reordered, no existing behaviour changed. The only other
edits to `artifactVersionService.ts` are the two result types gaining an optional
`freshnessPropagation` field.

| Trigger | Location | Propagation root | Reason |
|---|---|---|---|
| New version approved | `approveVersion()`, after step (d) audit log | `current.parent_version_id` — **the version just superseded**, not the newly approved one | `NEW_SOURCE_VERSION` |
| Version invalidated | `transition()`, after the audit log, only when `action === 'invalidate'` | the invalidated version itself | `SOURCE_INVALIDATED` |

The root being the *superseded parent* is the load-bearing subtlety: lineage edges point at concrete,
immutable `business_version_id`s (ADR §1.2), so downstream artifacts reference the **old** id. A
first approval has no parent, has nothing downstream, and takes a path byte-identical to the
pre-AP-11 behaviour.

### 2.3 Synchronous, not queued — and why that is the honest choice

The ADR §6.3 splits propagation into a synchronous level-1 pass plus an **asynchronous level-2+ job**
on the WP-B04 queue. That second phase was deliberately **not** used. `computeJobService` has
`enqueue()` and `claim()`, but **nothing in this codebase runs a worker loop** — `claim()` has no
production caller. An enqueued `LINEAGE_FRESHNESS_PROPAGATION` job would sit in `compute_jobs`
forever while every descendant at depth ≥ 2 silently stayed `CURRENT` and the ledger implied the
work had been handed off. That is a phantom of exactly the shape this work package exists to remove.

The full descendant closure is therefore walked synchronously inside the caller's transaction. This
is defensible on the ADR's own numbers — graph depth is structurally ≤ 6 (§2.1 stage ranks), and the
work per node is one single-row `UPDATE` plus one ledger `INSERT`, with no compute, no engine call,
no external I/O. Atomicity is a bonus the async design could not offer: freshness can never disagree
with the approval that caused it, and a rolled-back approve rolls back its propagation.

The risk the ADR was hedging (a pathological graph blocking `approve`) is retained and made
**visible** rather than assumed away: `maxDepth` bounds the walk, and hitting it is reported to the
caller (`depthLimitReached`, `truncatedAtVersionIds`) *and* written to the ledger as
`PROPAGATION_DEPTH_LIMIT_EXCEEDED` rows. Crucially, that flag is only raised when the frontier
genuinely still has outgoing edges — a walk that merely ran out of graph reports a clean completion,
because a decorative-but-false warning is the same failure mode as a decorative-but-false pass.

If Gate E ever measures a real approve-latency problem here, that is the moment to build the async
phase **together with the worker that drains it** — not before.

**No migration was needed.** The B03 ledger already has every column the algorithm writes, and
`reason_code` has no CHECK constraint to extend. An append-only deny-trigger on the ledger was
considered and rejected: it is not required by the requirement, and it would block the suite's own
cleanup while `finance_lineage_edges` (which does have one) already demonstrates the pattern.

## 3. Evidence — real PostgreSQL, physical rows

Ephemeral cluster: `postgresql@15` (15.15, Homebrew — **not** @16, whose missing pgvector breaks the
migration set), `initdb` and `pg_ctl` both under `LC_ALL=C`, `lsof`-checked port `55100`, short unix
socket, thrown away afterwards. Never `5432`, never a demo/staging/production host. Full migration
set applied strictly (no `--safe`): `✅ Postgres migrations complete`, 1463 tables in `public`.

Gate: `RUN_DB_TESTS=1` **and** `MOCK_DB=false` **and** a postgres `DATABASE_URL`. Without all three
the suite reports SKIPPED, never a false green — `NODE_ENV=test` alone yields a mock database in
which every write is a silent no-op.

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:55100/ap11 \
npx vitest run --config vitest.config.ts \
  src/services/finance/canonical/__tests__/lineageFreshnessService.pg.test.ts \
  --no-file-parallelism
→ Test Files 1 passed (1)   Tests 13 passed (13)
```

`server/src/services/finance/canonical/__tests__/lineageFreshnessService.pg.test.ts` — 13 tests, all
driven through the **real** `approveVersion()` / `transition()` entry points, all asserted by reading
rows back out of the database. Harness writes assert `changes === 1` before anything is concluded
from them, because in this program a zero-row `UPDATE` that "looks like a PASS" has already happened.

| # | Requirement | Result |
|---|---|---|
| 1 | direct child marked `STALE_SOURCE` | PASS — an **APPROVED** child (the case most likely to be rejected by the immutability trigger) |
| 2 | indirect descendants (depth 2, 3) | PASS |
| 3 | ledger rows written, content correct | PASS — 3 rows, `previous_state=CURRENT`, `new_state=STALE_SOURCE`, nearest-ancestor `triggering_version_id`, and each `triggering_edge_id` re-read from `finance_lineage_edges` to confirm it really joins those two versions |
| 4 | **nothing recomputed** | PASS — see below |
| 5 | severity ordering | PASS both ways: stronger escalates, weaker is suppressed but still logged |
| 6 | idempotency | PASS — replay: `unchanged=3, marked=0, eventsWritten=0`, `stale_since` identical instant |
| 7 | tenant isolation | PASS — see below |
| 8 | depth limit explicit | PASS — `maxDepth=2` on a 5-node chain: 2 marked, `depthLimitReached=true`, `truncatedAtVersionIds=[model]`, marker row in the ledger, nodes beyond the limit still `CURRENT`; the same graph at the default depth completes with `depthLimitReached=false` |

### 3.1 Proof that nothing was recomputed

Not a comment — a before/after fingerprint of every table a recompute would have to touch:

- `compute_jobs` = **0** before and after (so: no job was enqueued, under any job type);
- `compute_job_runs` = **0**, `compute_job_outputs` = **0**;
- `finance_compute_snapshots`, `finance_working_revisions`, `finance_business_versions` counts for
  the descendant artifacts: **unchanged** (the approved artifact itself legitimately gains one
  snapshot — that is approve's own step (b) — which is why the counts exclude it);
- per descendant row: `version` (CAS), `status`, `compute_snapshot_id`, `content_semantic_hash`,
  `source_working_revision_id` all byte-identical, while `freshness` **did** change — so the test
  cannot pass by nothing happening.

Independently confirmed in `psql` after the run:

```
SELECT count(*) FROM compute_jobs        WHERE organization_id LIKE 'org-ap11-%';  -- 0
SELECT count(*) FROM compute_job_outputs WHERE organization_id LIKE 'org-ap11-%';  -- 0
```

### 3.2 Tenant isolation

Two-part test. Org C carries a mirror of org A's graph and sits in the same database through all of
the above activity: it stays `CURRENT`, `freshness_reason IS NULL`, ledger empty. Then the
adversarial case — propagation requested with **org A's root version id while claiming org C** —
returns `visited=0, marked=0, eventsWritten=0` and writes nothing. Finally the mirror direction: org
C's own source change marks org C's child and leaves org A's three nodes and org A's ledger exactly
as they were.

### 3.3 The physical ledger

Run with `AP11_KEEP_LEDGER=1` (an affordance in the suite so a reviewer can inspect the rows rather
than trust the assertions), then read directly:

```
   org    | trig_ver | trig_edge |  target  | previous_state |  new_state   |           reason_code
----------+----------+-----------+----------+----------------+--------------+----------------------------------
 chain    | 0a13da33 | 1e0780d8  | 6da49474 | CURRENT        | STALE_SOURCE | NEW_SOURCE_VERSION
 chain    | d583ffad | 744ad1d0  | 0a13da33 | CURRENT        | STALE_SOURCE | NEW_SOURCE_VERSION
 chain    | e6e38ac8 | aa8334ef  | d583ffad | CURRENT        | STALE_SOURCE | NEW_SOURCE_VERSION
 depth    | 82513532 | 5eeb6acd  | 07554ca0 | CURRENT        | STALE_SOURCE | NEW_SOURCE_VERSION
 depth    | 48ca1593 | (none)    | 07554ca0 | STALE_SOURCE   | STALE_SOURCE | PROPAGATION_DEPTH_LIMIT_EXCEEDED
 depth    | 48ca1593 | a634ee43  | 82513532 | CURRENT        | STALE_SOURCE | NEW_SOURCE_VERSION
 depth    | 17efe699 | 0c8e1cc3  | e8173e3b | CURRENT        | STALE_SOURCE | NEW_SOURCE_VERSION
 depth    | 07554ca0 | a9c03a66  | 17efe699 | CURRENT        | STALE_SOURCE | NEW_SOURCE_VERSION
 priority | 2630cb9b | 50c31932  | 157b5dea | CURRENT        | STALE_SOURCE | NEW_SOURCE_VERSION
 priority | ff8e4f9a | 2d0101cb  | 157b5dea | STALE_SOURCE   | STALE_SOURCE | SOURCE_INVALIDATED
 priority | 754000a3 | 71dbd284  | 157b5dea | STALE_SOURCE   | STALE_SOURCE | NEW_SOURCE_VERSION
 tenant   | e61e0f12 | 6900780c  | 2d56e7ac | CURRENT        | STALE_SOURCE | NEW_SOURCE_VERSION
(12 rows)
```

The three `priority` rows on one target read, in order: marked by a new source version → escalated to
`SOURCE_INVALIDATED` (state unchanged, reason upgraded) → a later, weaker `NEW_SOURCE_VERSION`
recorded but **not** applied. That is ADR §6.4 as data.

## 4. Negative control

Every mutation was applied to the source, the suite re-run, and the change reverted; `git status`
was empty at the end.

| Mutation | Result |
|---|---|
| `approveVersion()` no longer calls the propagation | **10 failed** / 3 passed |
| severity ordering removed (`reasonOverrides` always `true`) | **2 failed** / 11 passed |
| idempotency short-circuit removed (always re-mark) | **2 failed** / 11 passed |
| `organization_id` filter dropped from the edge walk | **12 failed** / 1 passed |

Each mutation was `grep`-verified as actually applied before the run, so a "red" cannot come from a
mutation that silently failed to patch.

## 5. Pre-existing defect found in passing — NOT fixed here

**`transition()` cannot invalidate or archive an APPROVED version against a real database.**

`artifactVersionService.transition()` writes `SET status = ?, version = version + 1, ...` for every
action. `finance_bv_enforce_immutability()` (B01 migration §6) whitelists exactly
`status, superseded_by_version_id, invalidated_reason, updated_at, archived_by, archived_at,
superseded_at, freshness, freshness_reason, stale_since` for a row that is already `APPROVED` —
`version` is **not** on that list. The CAS bump therefore trips the trigger, and both transitions
whose only legal source state is `APPROVED` — **T10 `archive`** and **T11 `invalidate`** — throw a raw
Postgres error unconditionally:

```
ERROR: finance_business_versions: <id> is APPROVED; only status and its associated
       metadata columns may change
```

Confirmed in isolation with `psql`: the identical `UPDATE` **without** `version = version + 1`
succeeds. Nothing caught it before because the only coverage of invalidate/archive is
`lifecycleService.test.ts`, which unit-tests the pure `validateTransition()` decision table and never
reaches SQL.

Consequence for AP-11: the `SOURCE_INVALIDATED` trigger **is** wired into `transition()` and is
correct, but it cannot fire today because the statement before it throws. Rather than work around
this silently, the suite **pins the blocker** with an explicit test asserting the rejection; when
WP-B02 fixes the version bump that test goes red and the step-2 test should be rewritten to drive the
real `transition({action:'invalidate'})` path. The `SOURCE_INVALIDATED` propagation itself is proven
through the identical service call the blocked trigger makes.

Not fixed here because `transition()` is frozen-wave code accepted at `19b4b06934` and the fix
belongs to WP-B02 lifecycle, not to AP-11.

## 6. Regression

```
npx vitest run --config vitest.config.ts src/services/finance/canonical/__tests__ \
  --no-file-parallelism --retry=0
→ Test Files 24 passed (24)   Tests 345 passed (345)
```

`npx tsc --noEmit -p server/tsconfig.json` → clean.

## 7. Files

| File | Change |
|---|---|
| `server/src/services/finance/canonical/lineageFreshnessService.ts` | **new** — the propagation engine |
| `server/src/services/finance/canonical/artifactVersionService.ts` | +1 call in `approveVersion()`, +1 call in `transition()`, +1 optional field on each of the two `ok` result shapes |
| `server/src/services/finance/canonical/__tests__/lineageFreshnessService.pg.test.ts` | **new** — 13 real-Postgres tests |
| `docs/validation/finance-v3/generated/gate-d/APWAVE_11_staleness_report.md` | **new** — this report |

No migration added, no existing migration touched.

## 8. Open follow-ons (not this work package)

1. **WP-B02:** the `version = version + 1` immutability collision above — it kills T10/T11 outright.
2. **`ASSUMPTION_REGISTRY_CHANGED`** (ADR §6.2 row 3) has a working propagation path
   (`propagateStaleness()` with that reason) but still **no producer** — the org-level assumption
   registry has no owner in the program (ADR §10 point 3). Until one exists, that reason code is
   reachable only by an explicit caller, and this report does not claim otherwise.
3. **Recovery to `CURRENT`.** Nothing clears `freshness_reason`/`stale_since` when a version is
   successfully recomputed; that belongs to the compute path, not to propagation, and is untouched
   here.
4. **The async phase-2 job** (ADR §6.3) remains the right design *at the point where a worker exists
   to drain the queue*, with a measured latency problem to justify it. Both preconditions are absent
   today.
