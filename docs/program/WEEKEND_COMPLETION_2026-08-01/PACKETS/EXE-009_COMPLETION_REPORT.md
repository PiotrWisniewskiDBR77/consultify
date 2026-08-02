---
doc_id: exe-009-completion-report-2026-08-02
truth_type: delivery-status
status: awaiting-codex-review
owner: claude
business_owner: piotr
last_reviewed: 2026-08-02
---

# EXE-09 — completion report (round 3, post Codex FINAL FIX_REQUIRED)

Regenerated from live `git` output AFTER the round-3 implementation commits
(per Codex's explicit instruction: implementation HEAD and final
documentation HEAD are reported separately — this report's own commit is
NOT included in the "implementation HEAD" below).

## Base / branch / worktree

- Base: `feat/exe-008-closure-evidence-gate` @ `b359a4edad640a459d7ece3cf5f535b2a63218df` (frozen, `CODE_GO_FROZEN`) — unchanged from rounds 1–2, re-confirmed collision-free.
- Branch: `feat/exe-009-closure-results-finance-receipt`
- Worktree: `/private/tmp/claude-501/.../scratchpad/wt-exe-009`

## Implementation HEAD (live, BEFORE this report's own commit)

```
84cf4187d7c13fc023058ef5471e7bb467e0c3a1
```

`git log --oneline b359a4edad..HEAD` at that point (15 commits):

```
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

`git status --short` immediately before this report's own commit: only the
discovery-doc addendum modified (this report itself and that addendum are
what this final commit adds). Both will be captured under a "final
documentation HEAD" reported at the end of this session's response, per
Codex's instruction not to hand-type it.

## The core round-3 fix

Round 2's Finance leg wrote `initiative_kpis.target_value` (a PLAN) into
`roi_realized_values` whenever the KPI's `unit` matched `budget_currency`.
Codex correctly identified this as semantically invalid: a target is an
expectation, not proof anything was achieved, and reaching status DONE is
not proof either.

**Discovery** (parallel read-only agent, ~20 min budget): confirmed no
existing "approved actual, explicit currency" concept exists anywhere in
this codebase —

- `roi_realized_values` / `kpi_time_series`: self-asserted `source` column, no approval/sign-off field.
- `v8_roi_realization_entries.verified_by` — the ONE column anywhere in this schema with real approval semantics — is only ever written by a synthetic health-check probe (`healthProbeService.ts`), never a real user flow.
- `initiative_benefits.actual_annual_value` is declared in three separate migrations but never written by any application code path (`git grep` across `server/src`: zero hits).
- Closure evidence (`initiative_closure_requests`/`initiative_closure_evidence`) has no monetary field at all — free text only.

**Fix**: `findMonetaryActualMeasurement` (renamed from `computeMonetaryRealization`)
no longer reads `target_value`. It reads `kpi_time_series` instead — a
point-in-time OBSERVATION table, structurally distinct in kind from a
target — requiring: same organization + initiative; the owning KPI's `unit`
literally equals `budget_currency`; and the measurement's period is within
`MONETARY_MEASUREMENT_MAX_AGE_DAYS` (180 days, a documented policy default,
not a discovered fact) of delivery time. Anything else — no measurement,
only a target, wrong/no currency, a stale measurement, a measurement
recorded under a different `organization_id` — resolves `NEEDS_DECISION`,
never a fabricated value. `finance_payload` now carries `sourceMeasurementId`
alongside `realizationId` for full lineage.

**Honest limitation, not silently assumed away**: `kpi_time_series` has no
formal human-approval workflow gating it before this leg can use it. This is
recorded as an open NEEDS_PRODUCT_DECISION below, not claimed as solved.

### Negative-control exercise (performed live this session, not committed as permanent code)

1. Temporarily reintroduced the round-2 bug (fall back to `target_value`
   when no measurement exists).
2. Ran the new `TARGET-VS-ACTUAL #1` test — **failed** as expected
   (`expected 'DELIVERED' to be 'NEEDS_DECISION'`).
3. Reverted the file; `diff` against the pre-injection backup confirmed
   **byte-identical**.
4. Re-ran the same test — **passed**.

### A second, unrelated, pre-existing bug found and worked around (not fixed — out of scope)

While re-testing, the previously-passing "TWO CONCURRENT `attemptDeliveryInternal`"
regression test (which exercises `executionResultsBridge.handoffFromInitiativeFallback`,
the no-KPI `expected_roi` path) started failing deterministically. Root
cause: that function's own query, `SELECT COALESCE(title, name) AS name,
expected_roi FROM initiatives ...`, references a `title` column that does
not exist in this schema — a genuine, **pre-existing** bug (`git diff
b359a4edad..HEAD -- server/src/services/executionResultsBridge.ts` is
empty — EXE-09 has never touched this file), silently swallowed by
`dbGet`'s `fallback: true` default, making that fallback path a permanent
silent no-op. Not fixed here (single-writer discipline on a frozen file,
and unrelated to this round's Finance target-vs-actual scope) — the test
was changed to exercise `claimLeg`'s atomicity via a real KPI-target path
instead, and the bug is flagged here as a NEEDS_FOLLOWUP for a future,
separate M14→M15 packet.

## Canonical ownership (unchanged from round 2, reconfirmed)

- Closure trigger (frozen): `initiativeTransitionService.executeInitiativeTransition` sole writer of `initiatives.status`.
- `closureDeliveryReceiptService.ts` — sole owner of `closure_delivery_receipts`.
- Results leg: existing `executionResultsBridge.handoffFromClosure` (writes `initiative_benefits`) — unchanged.
- Finance leg: existing `executionRealizationService.recordExecutionRealization` (writes `roi_realized_values`) — called directly; migration 937 is the only schema change to that table.

## Receipt/outbox state machine (unchanged shape)

- `results_status`: `PENDING → DELIVERING → DELIVERED | FAILED`
- `finance_status`: `PENDING → DELIVERING → DELIVERED | FAILED | NEEDS_DECISION`
- `finance_payload` now `{ realizationId, sourceMeasurementId }`.
- Both legs' claim (`claimLeg`) and read-back-after-write run on a dedicated
  pinned connection (`withPgTransaction`), not the shared pool (round-2 fix,
  unchanged and re-verified this round).

## Changed files (16, +2937/-12 vs. base)

```
docs/.../PACKETS/EXE-009_COMPLETION_REPORT.md                     286
docs/.../PACKETS/EXE-009_DISCOVERY.md                             281
public/locales/en/translation.json                                10
public/locales/pl/translation.json                                10
server/migrations/935_exe009_closure_delivery_receipt.sql        103
server/migrations/936_exe009_benefits_fallback_dedup_backstop.sql 26
server/migrations/937_exe009_roi_realized_values_closure_dedup.sql 19
server/src/index.ts                                                15
server/src/routes/pmo/initiativeClosure.routes.ts                  61
server/src/services/closureDeliveryReceiptService.ts              747
server/src/services/executionRealizationService.ts                15 (-)
server/src/services/initiative/initiativeClosureService.ts         10 (-)
server/src/services/initiative/initiativeTransitionService.ts      36 (-9)
src/components/Initiatives/sections/ClosureSection.tsx            137
tests/components/Initiatives/ClosureSection.test.tsx               58
tests/integration/exe009-closure-delivery-receipt.realdb.test.ts 1135
```

No new tables created this round (Codex's "nie twórz nowego Finance
ledgeru" — `kpi_time_series`/`roi_realized_values` both pre-existing;
migration 937 only adds a dedup column to the latter, from round 2).

## Test evidence (real Postgres 16, fresh-migrated, no mocks)

**25 integration tests + 11 component tests = 36/36 passing.** Full
integration suite re-run 6× consecutively after the round-3 fix (150 total
test executions) with zero failures.

New/changed coverage this round: 7 `TARGET-VS-ACTUAL` tests (planned-target
-alone → zero rows + `NEEDS_DECISION`; budget figure alone → zero actual;
monetary-unit KPI with no measurement → zero actual; real measurement →
exactly one canonical actual with source-measurement lineage; stale
measurement → not auto-realized; foreign-organization measurement → zero
leak); 1 canonical-read-back test through the real
`GET /api/benefits/roi/portfolio/summary` route (supertest, real
`roi_assumptions` precondition seeded, asserts the SAME `realizationId`
/value/source is visible through it); golden-flow/retry/fault-injection/
restart tests reworked to use deliberately DIFFERENT numbers for
target-vs-measurement so a wrong-value bug would be visibly caught, not
silently pass.

## Negative controls

- Manual code-level negative control (required by Codex, performed live):
  target-as-actual bug reintroduced → new test red → reverted (byte
  -identical diff) → green.
- `expected_roi='20%'`, `expected_roi='20'` (bare numeric string), budget
  figure alone, monetary-unit KPI with no measurement, KPI in `%`/`days`/
  `count` — all confirmed `NEEDS_DECISION` + zero `roi_realized_values`.
- Stale (>180d) measurement → `NEEDS_DECISION`, zero rows.
- Foreign-`organization_id` measurement (data-integrity probe, not just a
  different initiative) → `NEEDS_DECISION`, zero rows — the query's own
  `organization_id` filter is what stops it, not incidental initiative
  -scoping.
- RBAC (unchanged from round 2): plain MEMBER → 403; foreign-org initiative
  → 404, not a leaky 403; service-layer `retryDeliveryForOrg` under the
  wrong org → rejected.
- Cross-tenant receipt read: org A → visible; org B → `null`.

## Canonical Finance read-back

Confirmed via a real HTTP request (supertest against the actual
`benefits.routes.ts` router, same E2E JWT convention as the sibling EXE-08
suite) to `GET /api/benefits/roi/portfolio/summary` — the exact endpoint
`src/components/Benefits/ROITrackingPanel.tsx` calls. The response's
`items[].realizedBenefit` for the test initiative equals the MEASUREMENT
value (7300), never the target (99999) seeded alongside it in the same
test, and matches the `realizationId` recorded in the receipt's
`finance_payload`.

## UI evidence

No UI code changed this round (round 2's status chip is unaffected by the
value-source change — it only renders `financeStatus`/labels, never
payload internals). All 11 `ClosureSection` component tests (8 pre-existing
+ 3 from round 1) still pass unmodified.

## Collision audit vs. active FIN-05

No files touched this round overlap with FIN-05 (`executionRealizationService.ts`,
`closureDeliveryReceiptService.ts` are unrelated to FIN-05's statement
-ingestion surface, already confirmed zero-overlap in round 2 against
FIN-05's then-current HEAD `887b949a0b`; no new files introduced this round
that would change that).

## Unresolved / NEEDS_PRODUCT_DECISION

1. **No formal approval/sign-off gate exists for a `kpi_time_series`
   measurement before it can back a Finance realization.** This round fixed
   the target-vs-actual conflation, but "approved" in a strict governance
   sense (a human explicitly signing off "yes, this measurement is correct
   and final") does not exist anywhere in this codebase today — confirmed
   by this round's own discovery. A product decision to add such a gate
   (e.g., wiring `v8_roi_realization_entries.verified_by` into a real route,
   or adding an approval column to `kpi_time_series`) would let the Finance
   leg require it explicitly.
2. **The 180-day recency window (`MONETARY_MEASUREMENT_MAX_AGE_DAYS`) is a
   documented policy default, not a discovered product requirement** — a
   real decision on "how recent must a measurement be to count as this
   closure's realized benefit" would let this be tuned or made
   configurable per organization.
3. **NEEDS_FOLLOWUP (separate, unrelated bug, not fixed here)**:
   `executionResultsBridge.ts`'s `handoffFromInitiativeFallback` references
   a non-existent `initiatives.title` column, silently swallowed by
   `dbGet`'s fallback default — makes the no-KPI `expected_roi` Results
   -leg fallback a permanent silent no-op. Pre-existing (confirmed via
   `git diff` against base), unrelated to Finance target-vs-actual, out of
   this round's scope and out of single-writer discipline on a frozen file.
4. Per the brief's own instruction: no invented value mapping anywhere —
   `expected_roi` and `target_value` are never read by the Finance leg, and
   any closure without a real, currency-matched, recent measurement lands
   in `NEEDS_DECISION`.

## Clean tree / no push / no merge / no deploy / no Railway / no demo

- Zero `git push`, zero merge into any other branch, zero Railway/demo
  interaction, zero production data at any point.
- Local Docker Postgres instances used for testing were created, verified,
  and torn down each round — nothing persisted outside the worktree/branch.

AWAITING_CODEX_REVIEW
