---
doc_id: exe-009-completion-report-2026-08-02
truth_type: delivery-status
status: awaiting-codex-review
owner: claude
business_owner: piotr
last_reviewed: 2026-08-02
---

# EXE-09 — completion report (round 4, post Codex "ostatni wąski pakiet" FIX_REQUIRED)

Regenerated from live `git` output AFTER the round-4 implementation commits
(per Codex's explicit instruction: implementation HEAD and final
documentation HEAD are reported separately — this report's own commit is
NOT included in the "implementation HEAD" below).

## Base / branch / worktree

- Base: `feat/exe-008-closure-evidence-gate` @ `b359a4edad640a459d7ece3cf5f535b2a63218df` (frozen, `CODE_GO_FROZEN`) — unchanged from rounds 1–3.
- Branch: `feat/exe-009-closure-results-finance-receipt`
- Worktree: `/private/tmp/claude-501/.../scratchpad/wt-exe-009`

## Implementation HEAD (live, BEFORE this report's own commit)

```
6df1c59356bfa2faefeebb58cdc1ade047820204
```

`git log --oneline b359a4edad..HEAD` at that point (21 commits):

```
6df1c59356 test(exe-009): rewrite Finance-leg coverage for always-NEEDS_DECISION; add Results-fallback regression tests (Codex review round 4)
5d6784d25c fix(exe-009): Finance leg never auto-realizes; Results leg detects silent no-op (Codex review round 4, BLOCKER-A + B defense-in-depth)
0e07bf46ca fix(exe-08): handoffFromInitiativeFallback references a real column, no longer silently swallows a real error (Codex review round 4, BLOCKER-B)
c43a764b75 docs(exe-009): round-3 discovery addendum + completion report from live git output
84cf4187d7 test(exe-009): target-vs-actual coverage + real canonical read-back (round 3)
e1500b803d fix(exe-009): Finance actual must come from an OBSERVED measurement, never a planned target (Codex review round 3)
4534ad2b08 docs(exe-009): regenerate completion report from live git output (round 2)
c89dacbe6d docs(exe-009): round-2 correction addendum on discovery doc
b7447558b3 test(exe-009): cover all 6 Codex review blockers, real Postgres
685241ce8b fix(exe-009): RBAC-gate the closure-receipt retry route
869a2eca77 fix(exe-009): Finance leg -> canonical recordExecutionRealization; remove expected_roi fallback; fix a second concurrency bug in the read-back path
4749e0e573 fix(exe-009): drop isolated Finance ledger, add canonical dedup key
879a3f4533 refactor(exe-08): export assertActorCanApprove (minimal additive visibility)
a2a2f90888 docs(exe-009): completion report — AWAITING_CODEX_REVIEW
855f0a4a45 fix(exe-009): claimLeg must use a pinned connection, not the shared pool
f0e07ee937 fix(exe-009): close concurrent-delivery race found by adversarial review
9dab22387e test(exe-009): real-PG receipt/outbox tests + UI no-premature-success tests
7a3cb5e4b1 feat(exe-009): minimal closure-receipt status chip in ClosureSection
a788f7c34d feat(exe-009): durable closure→Results/Finance delivery receipt
262511607b docs(exe-009): discovery gate — canonical owners, base selection, gaps
```

(the 21st, `c43a764b75`, is round 3's own documentation commit, included
here since it's part of the branch's ancestry, not this round's new work.)

`git status --short` immediately before this report's own commit: clean
(empty) — this report and its accompanying discovery-doc addendum are the
only changes this final commit adds.

## The two round-4 fixes

### A. Finance leg: no approval process exists → ALWAYS `NEEDS_DECISION`

Round 3's fix read `kpi_time_series` (a genuine point-in-time OBSERVATION,
correct in *kind* vs. a planned target) but still auto-wrote
`roi_realized_values` whenever that measurement was currency-matched and
within an arbitrary 180-day recency window. Codex's finding: **recency plus
observation is not approval**. A fresh discovery pass this round confirmed
the gap is total, not a naming mismatch: `roi_realized_values`/
`kpi_time_series` carry only a self-asserted `source` column; the one
column anywhere in the schema with real approval semantics
(`v8_roi_realization_entries.verified_by`) is written exclusively by a
synthetic health-check probe, never a real user flow;
`initiative_benefits.actual_annual_value` is declared but never written by
any code path.

**Fix** (`closureDeliveryReceiptService.ts`, commit `5d6784d25c`):
`findMonetaryActualMeasurement` renamed to `findCandidateMonetaryMeasurement`
— the name itself now honestly describes what it returns. The 180-day
recency filter is removed from its SQL entirely (age is informational only,
never a gate — a stale candidate is exactly as (un)approved as a fresh one);
it now returns `ageDays` for transparency. The Finance leg's caller no
longer calls `recordExecutionRealization` under any circumstance and never
writes `roi_realized_values` automatically. It **always** terminates in
`NEEDS_DECISION`, with `finance_payload` carrying `candidateMeasurementId` +
`reason: 'MEASUREMENT_REQUIRES_APPROVAL'` (plus `candidateAmount`/
`candidateCurrency`/`candidateAgeDays`/`candidateValueSource` for
transparency) when a candidate measurement exists, or
`reason: 'NO_MONETARY_MEASUREMENT'` when none does.
`recordExecutionRealization` itself is untouched — still the exact function
a human uses today via Execution's manual "Record Realization" form; this
packet simply stopped auto-invoking it.

Building an actual approval/sign-off workflow is an explicit
NEEDS_PRODUCT_DECISION for Piotr/Codex — out of scope for this packet, not
silently built here.

### B. Results-leg fallback: `initiatives.title` does not exist → was a silent no-op

`executionResultsBridge.ts`'s `handoffFromInitiativeFallback` (the no-KPI,
`expected_roi`-driven path) queried `COALESCE(title, name)`. `initiatives`
has never had a `title` column in this schema (only `name`) — this query
has always thrown `column "title" does not exist`, and because the call
used `{ fallback: true }` (DbPromise's error-swallowing default), that error
was silently absorbed: the query resolved to `null`, and the ENTIRE fallback
path became a permanent silent no-op. A real "planned KPIs or expected_roi"
closure would report "nothing to hand off" and the receipt would mark
`resultsStatus = 'DELIVERED'` without ever creating a benefit row. Confirmed
100% pre-existing (EXE-08): `git diff b359a4edad..<pre-round-4-HEAD> --
server/src/services/executionResultsBridge.ts` was empty at the time of
discovery — no prior round of this packet had ever touched this file, and
no prior round's tests asserted `resultsStatus` on this exact code path, so
the bug was invisible until this round looked for it directly.

**Fix** (commit `0e07bf46ca`): the query now reads the real `name` column,
and the call now uses `{ fallback: false }` so any FUTURE genuine error in
this path throws instead of being silently swallowed — it propagates to
`attemptDeliveryInternal`'s caller, which records a retryable `FAILED`
status, never a false `DELIVERED`.

**Defense-in-depth added alongside the direct fix** (commit `5d6784d25c`): a
new `initiativeHadResultsSignal` check runs independently of
`handoffFromClosure`'s own return value. If the initiative genuinely had a
planned KPI target or a valid `expected_roi` (a real signal something
should have been handed off) but the post-write read-back finds zero
`initiative_benefits` rows, the Results leg now throws — recorded as a
retryable `FAILED`, never a false `DELIVERED` — guarding against this exact
class of bug recurring from a different future cause, not just the specific
`title` column.

## Negative-control exercise (performed live this session, not committed as permanent code)

1. **Title-column bug**: temporarily restored `COALESCE(title, name)` +
   `{ fallback: true }` in `executionResultsBridge.ts`. Re-ran the extended
   `BLOCKER2: expected_roi="20"...` test — **failed** as expected
   (`resultsStatus` came back `FAILED` via the `initiativeHadResultsSignal`
   guard, proving both this round's fixes work together defense-in-depth).
   Restored the file from a pre-edit backup; `git status --short` on the
   file was empty (byte-identical to the committed version). Re-ran —
   **passed**.
2. **Finance auto-realize bug**: temporarily changed the Finance leg's
   terminal `UPDATE` to set `finance_status = 'DELIVERED'` whenever a
   candidate measurement existed (mirroring round 3's rejected behavior).
   Re-ran the full suite — **8 of the round-4-rewritten tests failed**
   (golden flow, identical retry, both leg-independence tests, restart
   simulation, `TARGET-VS-ACTUAL #5`, `TARGET-VS-ACTUAL #6`, canonical
   NON-read-back), all others (RBAC, tenant isolation, the tests that were
   never asserting Finance auto-delivery) stayed green. Restored the file
   from a pre-edit backup; `git status --short` on the file was empty.
   Re-ran — **all 26 passed**.

## Canonical ownership (unchanged from round 3, reconfirmed)

- Closure trigger (frozen): `initiativeTransitionService.executeInitiativeTransition` sole writer of `initiatives.status`.
- `closureDeliveryReceiptService.ts` — sole owner of `closure_delivery_receipts`.
- Results leg: existing `executionResultsBridge.handoffFromClosure` (writes `initiative_benefits`) — this round's ONLY change to this frozen EXE-08 file, explicitly authorized by Codex this round (previously deferred as out-of-scope in round 3).
- Finance: no automatic writer anymore. `executionRealizationService.recordExecutionRealization` (writes `roi_realized_values`) remains the sole canonical writer, reachable only through the existing human "Record Realization" flow — not called by this packet's automatic delivery path as of this round.

## Receipt/outbox state machine

- `results_status`: `PENDING → DELIVERING → DELIVERED | FAILED`
- `finance_status`: `PENDING → DELIVERING → NEEDS_DECISION | FAILED` — **`DELIVERED` is no longer a reachable value for the Finance leg from the automatic delivery path** (the enum/type still includes it structurally for forward-compatibility and because a future approval workflow may legitimately reach it; nothing in this packet's code sets it today).
- `finance_payload` now `{ reason, candidateMeasurementId?, candidateAmount?, candidateCurrency?, candidateAgeDays?, candidateValueSource? }` (candidate fields present only when `reason === 'MEASUREMENT_REQUIRES_APPROVAL'`).
- Both legs' claim (`claimLeg`) and read-back-after-write run on a dedicated pinned connection (`withPgTransaction`), not the shared pool (round-1/2 fix, unchanged and re-verified this round).

## Changed files (17, +3042/-14 vs. base — `git diff --stat b359a4edad..HEAD`)

```
docs/.../PACKETS/EXE-009_COMPLETION_REPORT.md                       255 (+)
docs/.../PACKETS/EXE-009_DISCOVERY.md                                318 (+)
public/locales/en/translation.json                                    10 (+)
public/locales/pl/translation.json                                    10 (+)
server/migrations/935_exe009_closure_delivery_receipt.sql            103 (+)
server/migrations/936_exe009_benefits_fallback_dedup_backstop.sql      26 (+)
server/migrations/937_exe009_roi_realized_values_closure_dedup.sql     19 (+)
server/src/index.ts                                                   15 (+)
server/src/routes/pmo/initiativeClosure.routes.ts                     61 (+)
server/src/services/closureDeliveryReceiptService.ts                751 (+)
server/src/services/executionRealizationService.ts                   15 (+/-)
server/src/services/executionResultsBridge.ts                        18 (+/-)  <- NEW this round (was 0)
server/src/services/initiative/initiativeClosureService.ts            10 (+/-)
server/src/services/initiative/initiativeTransitionService.ts         36 (+/-)
src/components/Initiatives/sections/ClosureSection.tsx               137 (+/-)
tests/components/Initiatives/ClosureSection.test.tsx                   58 (+)
tests/integration/exe009-closure-delivery-receipt.realdb.test.ts    1214 (+)

17 files changed, 3042 insertions(+), 14 deletions(-)
```

No new tables created this round (no new migrations added — 935/936/937
are all pre-existing from rounds 1–2). `executionResultsBridge.ts` is the
one file in this diff that is NOT new to this branch; its 18-line delta is
entirely this round's title-column fix, the first time this packet has
touched it.

## Test evidence (real Postgres 16, fresh-migrated, no mocks)

**26 integration tests + 11 component tests = 37/37 passing.** Fresh
Docker container (`pgvector/pgvector:pg16`) created, migrated
(`--safe` + `--only 293_initiative_milestones.sql,247_initiative_enhancements.sql,063_raid_items.sql`
for the documented fresh-install gap), full integration suite run 4×
consecutively (104 total test executions across the 4 runs) with zero
failures, then torn down.

Net test count: 25 (round 3) → 26 (round 4) — one net-new test (`Results
fallback, genuinely empty case`), plus one existing test (`BLOCKER2:
expected_roi="20"...`) substantially extended in place rather than added as
a separate test.

Round-4 rewrites (Finance leg's contract changed from "auto-realizes a
clean candidate" to "always NEEDS_DECISION"): golden flow, identical retry,
Results-fails/Finance-independent, Finance-fails/Results-independent,
restart simulation, `TARGET-VS-ACTUAL #5` (was: real measurement auto
-realizes; now: even a real measurement never auto-realizes),
`TARGET-VS-ACTUAL #6` (was: stale measurement rejected by a recency gate;
now: age is purely informational, never a gate — a very old measurement
resolves identically to a fresh one), and the canonical read-back test
(renamed to "canonical NON-read-back" — proves the honest inverse through
the same real `GET /api/benefits/roi/portfolio/summary` route: a clean
candidate never appears as a realized benefit).

New coverage for the title-column fix: `BLOCKER2: expected_roi="20"...` now
also asserts the no-KPI fallback path produces a REAL `initiative_benefits`
row (`kpi_id IS NULL`) with `resultsStatus DELIVERED` — direct regression
coverage for the bug class just fixed. A new adjacent test confirms the
genuinely-empty case (no KPI, no `expected_roi` at all) still correctly
resolves `DELIVERED` with zero rows, distinguishing the legitimate empty
state from the silent-no-op bug.

## Negative controls (cumulative, this round's additions in bold)

- **Title-column bug reintroduced → `BLOCKER2` fallback test red → reverted (byte-identical) → green.**
- **Finance auto-realize reintroduced → 8 tests red → reverted (byte-identical) → all 26 green.**
- Round-3 negative control (target-as-actual bug): still valid, unchanged this round.
- `expected_roi='20%'`, `expected_roi='20'` (bare numeric string), budget figure alone, monetary-unit KPI with no measurement, KPI in `%`/`days`/`count` — all confirmed `NEEDS_DECISION` + zero `roi_realized_values`.
- A measurement 400 days old → `NEEDS_DECISION` + zero rows, same as a fresh one (age is no longer a gate — round 4 changed the ASSERTION here, not just re-confirmed round 3's).
- Foreign-`organization_id` measurement (data-integrity probe) → `NEEDS_DECISION`, `reason: 'NO_MONETARY_MEASUREMENT'`, zero rows.
- RBAC (unchanged from round 2): plain MEMBER → 403; foreign-org initiative → 404, not a leaky 403; service-layer `retryDeliveryForOrg` under the wrong org → rejected.
- Cross-tenant receipt read: org A → visible; org B → `null`.
- A downstream failure occurring after a leg has been claimed remains retryable: both the Results-fails and Finance-fails fault-injection tests retry without the injected fault and reach their real terminal state (`DELIVERED` / `NEEDS_DECISION` respectively) — `claimLeg`'s own `WHERE status IN ('PENDING','FAILED')` is what allows the retry.

## Canonical Finance NON-read-back

Confirmed via a real HTTP request (supertest against the actual
`benefits.routes.ts` router) to `GET /api/benefits/roi/portfolio/summary` —
the exact endpoint `src/components/Benefits/ROITrackingPanel.tsx` calls.
For a closure with a real, clean, currency-matched, freshly observed
candidate measurement, the response shows **no realized benefit** for that
initiative (`hasRealized` falsy or absent, `realizedBenefit` zero/absent) —
proving the "never auto-realizes" claim holds through the real read model a
human/UI actually uses, not just via a raw SQL row count.

## UI evidence

No UI code changed this round. `ClosureSection.tsx`'s status chip only
reads `resultsStatus`/`financeStatus`, never payload internals (confirmed
again this round) — its existing `NEEDS_DECISION` copy ("Results delivered
— Finance mapping needs a product decision") remains accurate and required
no changes for the `reason`/`candidateMeasurementId` distinction. All 11
`ClosureSection` component tests pass unmodified.

**Worth stating plainly**: with no approval process in this codebase, the
Finance leg of every closure will now ALWAYS resolve to `NEEDS_DECISION` —
there is currently no automatic code path, however clean the underlying
data, that reaches `finance_status = 'DELIVERED'`. This means the UI's
`bothDelivered` ("Delivered to Results & Finance") success state is
presently unreachable in production. This is the correct, honest behavior
per this round's review, not a regression — flagged here so nobody mistakes
"Finance never shows Delivered" for a bug in a future session.

## Collision audit vs. active FIN-05

No files touched this round overlap with FIN-05
(`server/src/services/executionResultsBridge.ts` and
`closureDeliveryReceiptService.ts` are unrelated to FIN-05's statement
-ingestion surface — FIN-05 branches present in this repo:
`feat/fin-005-statement-ingestion-golden-flow`,
`fix/fin-005-atelier-coherence`, `wip/fin-005-assumption-caveats-r10`, none
touched or read by this session).

## Unresolved / NEEDS_PRODUCT_DECISION (round-4 state)

1. **No formal approval/sign-off gate exists for a `kpi_time_series`
   measurement anywhere in this codebase — confirmed total, not a naming
   gap, by this round's fresh discovery pass.** As of this round, the
   Finance leg does NOT attempt to work around this: it always resolves
   `NEEDS_DECISION` and surfaces a candidate (when one exists) purely for
   transparency. A product decision to add a real approval gate (e.g.,
   wiring `v8_roi_realization_entries.verified_by` into a real route, or
   adding an approval column to `kpi_time_series`) is required before any
   automatic Finance realization can be built — explicitly NOT built this
   round, per Codex's instruction ("nie rozszerzaj zakresu na budowę
   systemu zatwierdzania pomiarów").
2. Per the brief's own instruction: no invented value mapping anywhere —
   `expected_roi` and `target_value` are never read by the Finance leg, and
   NO closure automatically lands anywhere but `NEEDS_DECISION` for Finance,
   regardless of how clean the underlying measurement looks.
3. The `title`-column bug in `executionResultsBridge.ts` (round 3's
   NEEDS_FOLLOWUP) is now FIXED this round — no longer an open item.

## Clean tree / no push / no merge / no deploy / no Railway / no demo

- Zero `git push`, zero merge into any other branch, zero Railway/demo
  interaction, zero production data at any point.
- Local Docker Postgres instance used for this round's testing
  (`consultify-exe009-pg-r4`) was created, verified, and torn down at the
  end of this round — nothing persisted outside the worktree/branch.
- `git status --short`: empty. `git diff --check`: clean. Scoped `tsc
  --noCheck` build: clean. Secret scan (common credential/key patterns) over
  this round's diff: zero matches.

AWAITING_CODEX_REVIEW
