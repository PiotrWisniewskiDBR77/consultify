---
doc_id: exe-009-completion-report-2026-08-02
truth_type: delivery-status
status: awaiting-codex-review
owner: claude
business_owner: piotr
last_reviewed: 2026-08-02
---

# EXE-09 — completion report (round 2, post Codex FIX_REQUIRED)

This report was regenerated from live `git` output (`rev-parse`, `log
base..HEAD`, `diff --stat base..HEAD`, `status --short`), per Codex's
BLOCKER6 instruction — no hand-typed SHAs.

## Base / branch / worktree / HEAD

- Base: `feat/exe-008-closure-evidence-gate` @ `b359a4edad640a459d7ece3cf5f535b2a63218df` (frozen, `CODE_GO_FROZEN`).
- Branch: `feat/exe-009-closure-results-finance-receipt`
- Worktree: `/private/tmp/claude-501/.../scratchpad/wt-exe-009` (isolated, not the shared checkout)
- **HEAD: `c89dacbe6dc368d9267637fb73b7f7a3e23424bb`** (confirmed via `git rev-parse HEAD` immediately before writing this report)
- `git status --short` (excluding the local `node_modules` symlink): **empty — clean tree.**
- 13 commits on top of base (`git log --oneline b359a4edad..HEAD`):

```
c89dacbe6d docs(exe-009): round-2 correction addendum on discovery doc
b7447558b3 test(exe-009): cover all 6 Codex review blockers, real Postgres
685241ce8b fix(exe-009): RBAC-gate the closure-receipt retry route
869a2eca77 fix(exe-009): Finance leg -> canonical recordExecutionRealization; remove expected_roi fallback; fix a second concurrency bug in the read-back path
4749e0e573 fix(exe-009): drop isolated Finance ledger, add canonical dedup key
879a3f4533 refactor(exe-08): export assertActorCanApprove (minimal additive visibility)
a2a2f90888 docs(exe-009): completion report — AWAITING_CODEX_REVIEW (round 1, superseded by this doc)
855f0a4a45 fix(exe-009): claimLeg must use a pinned connection, not the shared pool
f0e07ee937 fix(exe-009): close concurrent-delivery race found by adversarial review
9dab22387e test(exe-009): real-PG receipt/outbox tests + UI no-premature-success tests
7a3cb5e4b1 feat(exe-009): minimal closure-receipt status chip in ClosureSection
a788f7c34d feat(exe-009): durable closure→Results/Finance delivery receipt
262511607b docs(exe-009): discovery gate — canonical owners, base selection, gaps
```

## Round-2 fixes (Codex FIX_REQUIRED response)

### BLOCKER1 — isolated Finance ledger → canonical target

Round 1 wrote a NEW `closure_finance_actuals` table nothing in the Finance
module read. A fresh canonical-Finance inventory (parallel read-only agent,
this round) established:

- The Finance module (`FinanceHub.tsx`) has **no DB-backed read of
  initiative-level actuals at all** — its only initiative-value-touching
  panel (`ValueOfficePanel`) does pure client-side compute against
  `/api/v8/finance/value/value-bridge`, explicitly documented in that route
  as "pure-compute — No DB access."
- The program's own doctrine (`EXE-002_MANAGEMENT_SPINE_AUDIT.md`, gate
  FLOW-001) is **closure → Results → Finance**, two hops, Results-mediated
  — not closure → Finance directly.
- The one real, UI-rendered, organization+initiative-scoped realization
  table in this codebase is **`roi_realized_values`**, read by
  `src/components/Benefits/ROITrackingPanel.tsx` via
  `GET /benefits/roi/portfolio/summary`, owned by
  `executionRealizationService.recordExecutionRealization` — today only
  triggered by a human via Execution's "Record Realization" form.

**Fix**: `closure_finance_actuals` removed entirely from migration 935. The
Finance leg (`closureDeliveryReceiptService.ts`) now calls
`recordExecutionRealization` directly — the exact canonical function, not a
copy — storing the returned `roi_realized_values.id` in `finance_payload`.
Migration 937 adds an additive, nullable `closure_receipt_id` column +
partial unique index to `roi_realized_values` (the idempotency key this
closure-triggered path needs); the pre-existing human-entry write path never
sets this column and is completely unaffected.

### BLOCKER2 — `expected_roi` removed as a monetary source, entirely

Confirmed via direct investigation (a parallel read-only agent, this round):
`initiatives.expected_roi` is a free-text ROI/percentage narrative field in
this schema — `903_expected_roi_to_text.sql`'s own header explains it was
retyped from `REAL` to `TEXT` because the AI-hydration path writes strings
like `"ROI 200%"` / `"44% (zysk netto ÷ nakład), payback 14 mies"`;
`CharterBuilder.tsx` labels the same field **"Expected ROI (%)"**, a
DIFFERENT field from **"Business Value (PLN)"**. No seed/demo data anywhere
in the repo ever sets a currency-valued `initiative_kpis.unit`.

**Fix**: `computeMonetaryRealization` (renamed from `computeFinanceValue`)
no longer reads `expected_roi` at all — not even as a fallback. The only
signal is a planned KPI whose `unit` literally equals the initiative's own
`budget_currency` code; anything else (no currency, no matching KPI, KPI in
`%`/`days`/`count`) → `NEEDS_DECISION`. 5 new negative-control tests assert
this exactly, including `expected_roi='20%'` and `expected_roi='20'`
(bare numeric string) explicitly never producing an actual.

### BLOCKER3 — retry route RBAC

`POST /:id/closure-receipt/retry` now calls `assertInitiativeInOrg` (404 on
a foreign-org initiative — same order as `/approve`) then
`assertActorCanApprove` (403 `CLOSURE_APPROVER_ROLE_REQUIRED` for a plain
member) before touching the receipt — reusing the **exact same**
`CLOSURE_APPROVER_ROLES` gate `/approve` already uses (no new role
invented; `assertActorCanApprove` exported from `initiativeClosureService.ts`
as a minimal, behavior-free visibility change, its own isolated commit).
3 new route-level tests via `supertest` against the real Express router
confirm: plain MEMBER → 403, ADMIN → 200, foreign-org initiative → 404
(never a leaky 403).

### BLOCKER4 — tenant-safe internal/user-facing split

`attemptDelivery` renamed to `attemptDeliveryInternal` (worker/system-only —
trusts its `receiptId`, no org check; doc comment makes the trust boundary
explicit and names its three legitimate callers). `manualRetryReceipt`
renamed to `retryDeliveryForOrg`, documented as the ONLY safe user-facing
entry (verifies org ownership via `getReceiptById` before calling the
internal function). New test: `retryDeliveryForOrg` rejects a receipt read
under the wrong organization id at the service layer.

### BLOCKER5 — integration base re-confirmed

Re-inventoried all four relevant frozen/active HEADs fresh (parallel
read-only agent, this round), including `integrate/mvp-wave1-abc`'s CURRENT
head (`8850bdc8d2`, newer than the control doc's stale checkpoint) and
FIN-05's current head (`887b949a0b` — **still moving**, 8+ commits past its
own control-doc checkpoint). Confirmed:

- No branch in the repo has ever merged EXE-08 + Finance/Atelier together —
  this integration genuinely doesn't exist yet anywhere.
- `integrate/mvp-wave1-abc`'s Finance-vs-Atelier diff (43 files) and FIN-05's
  full diff (98 files) both have **zero overlap** with EXE-09's touched
  files, re-confirmed against the round-2 file set (`executionRealizationService.ts`,
  `initiativeClosureService.ts` included).
- Recommendation unchanged: **stay based on `feat/exe-008-closure-evidence-gate`
  alone.** Merging Atelier now would pull in 43 unrelated files for zero
  functional benefit (the canonical Finance target this round wired into,
  `roi_realized_values`/`executionRealizationService.ts`, is already present
  on the current base — verified directly, no merge required to reach it).

### A second, independent concurrency bug (found while re-verifying)

While re-testing BLOCKER1–4 against a fresh Postgres instance, the
golden-flow/identical-retry/explicit-monetary-KPI tests started failing
**deterministically** (not flaky — 6/6 failures). Root-caused to the
Results/Finance legs' read-back-after-write queries
(`initiative_benefits` after `handoffFromClosure`;
`roi_realized_values` after `recordExecutionRealization`) going through the
**shared connection pool** (`queryHelpers.queryAll/queryOne`) — the exact
same documented footgun class already fixed once in `claimLeg` (round 1): a
query issued right after a write can land on a different pool connection
than the one that committed, observing stale state. Confirmed with a
standalone repro: `handoffFromClosure` alone under concurrency was reliably
correct (8/8 rounds, exactly one row); the full `attemptDeliveryInternal`
path was not, and adding a debug `console.error` incidentally "fixed" it by
shifting timing — the signature of a genuine race, not a flaky test.
**Fixed**: both read-backs (and their paired terminal `UPDATE`) moved onto a
dedicated `withPgTransaction` connection, matching `claimLeg`'s existing
fix. Separately found and fixed: `closeInitiative`'s real transition ALSO
fires a background best-effort delivery trigger for the same receipt,
unknowingly racing several tests' own explicit delivery call — a
`deliverAndFetch` test helper now polls to a terminal state instead of
trusting either racer's raw return value.

## Canonical ownership (updated)

- Closure trigger (unchanged, frozen): `initiativeTransitionService.executeInitiativeTransition` is the sole writer of `initiatives.status`; only `initiativeClosureService.approveClosureRequest` (EXE-08) drives it to DONE.
- `closureDeliveryReceiptService.ts` — sole owner of `closure_delivery_receipts`. No longer owns any Finance table.
- Results leg: existing, already-idempotent `executionResultsBridge.handoffFromClosure` (writes `initiative_benefits`) — unchanged, not reimplemented.
- Finance leg: existing, canonical `executionRealizationService.recordExecutionRealization` (writes `roi_realized_values`) — called directly, not copied. Migration 937 is the only schema change to this table (additive dedup column).

## Receipt/outbox state machine (unchanged shape, corrected Finance target)

One row per real closure, keyed by the transition engine's own
`correlationId` (same PK as `initiative_status_history` for that
transition).

- `results_status`: `PENDING → DELIVERING → DELIVERED | FAILED` (retryable)
- `finance_status`: `PENDING → DELIVERING → DELIVERED | FAILED | NEEDS_DECISION`
- Independent per leg, both directions real-PG tested.
- `attempts` / `last_error` / `*_delivered_at` / `*_payload` per leg;
  `next_retry_at` exponential backoff (30s → capped 30min); stale-`DELIVERING`
  reclaim after 5 minutes.
- `finance_payload` now holds `{ realizationId }` — the real
  `roi_realized_values.id`, read back on a pinned connection after every
  attempt so a retry reports the same downstream id.

## Transaction boundaries

- Receipt row inserted inside the SAME transaction as the status write
  (`initiativeTransitionService.ts`, same `client`/`withPgTransaction`
  block).
- Each leg claimed atomically via `UPDATE ... WHERE status IN (...)` on a
  dedicated pinned connection (`claimLeg`, `withPgTransaction`) — not the
  shared pool.
- Both legs' read-back-after-write + terminal status UPDATE also run on a
  dedicated pinned connection (round-2 fix, see above) — not the shared
  pool.

## Changed files (16, +2455/-12 vs. base)

```
docs/.../PACKETS/EXE-009_COMPLETION_REPORT.md                     (new)
docs/.../PACKETS/EXE-009_DISCOVERY.md                             (new, +round-2 addendum)
public/locales/en/translation.json                                (+10)
public/locales/pl/translation.json                                (+10)
server/migrations/935_exe009_closure_delivery_receipt.sql         (new, closure_finance_actuals removed)
server/migrations/936_exe009_benefits_fallback_dedup_backstop.sql (new — Results-leg fallback dedup)
server/migrations/937_exe009_roi_realized_values_closure_dedup.sql (new — Finance canonical dedup key)
server/src/index.ts                                               (+15, cron registration)
server/src/routes/pmo/initiativeClosure.routes.ts                 (+61, RBAC-gated retry + read routes)
server/src/services/closureDeliveryReceiptService.ts              (new, 697 lines)
server/src/services/executionRealizationService.ts                (+15/-, additive closureReceiptId param)
server/src/services/initiative/initiativeClosureService.ts        (+10/-, assertActorCanApprove exported)
server/src/services/initiative/initiativeTransitionService.ts     (+36/-9, two call-site edits only)
src/components/Initiatives/sections/ClosureSection.tsx            (+137, status chip)
tests/components/Initiatives/ClosureSection.test.tsx              (+58, 3 new tests)
tests/integration/exe009-closure-delivery-receipt.realdb.test.ts  (new, 887 lines, 19 tests)
```

## Test evidence (real Postgres 16, fresh-migrated, no mocks)

**19 integration tests + 11 component tests = 30/30 passing.** Full
integration suite re-run 6× consecutively after the round-2 fixes (114 total
test executions) with zero failures; the specific concurrency regression
test re-run 10× in isolation, also clean.

Integration suite covers (19 tests): golden flow with canonical-table
read-back, identical-retry same-downstream-ids, two concurrent full
closures, a dedicated concurrent-delivery regression test (no-DB-backstop
Results-leg fallback path), Results-fails/Finance-ok, Finance-fails/
Results-ok, restart+reconciliation, cross-tenant read isolation, 2
missing-mapping cases, 5 BLOCKER2 negative controls + 1 positive monetary
case, 1 BLOCKER4 service-layer tenant test, 3 BLOCKER3 route-level RBAC
tests.

## Negative controls

- Manual raw-SQL duplicate insert against the Results-leg fallback dedup
  index → real `duplicate key value violates unique constraint` (DB
  backstop genuinely enforced).
- Standalone repro: `handoffFromClosure` called twice concurrently, 8
  rounds, outside this packet's receipt/claim code — confirmed migration
  936's index alone prevents duplication (defense in depth).
- `expected_roi='20%'`, `expected_roi='20'`, currency-only/no-KPI, KPI in
  `%`/`days`/`count` — all confirmed to produce `NEEDS_DECISION` and zero
  `roi_realized_values` rows.
- RBAC: plain MEMBER → 403 (real HTTP request); foreign-org initiative →
  404, not a leaky 403 (real HTTP request); service-layer
  `retryDeliveryForOrg` under the wrong org → rejected.
- Cross-tenant read: receipt created in org A → `null` under org B via both
  `getReceiptById` and `getReceiptForInitiative`.

## UI evidence

No new screen (a status chip inside the existing `ClosureSection`) —
verified via component tests: PENDING/DELIVERING never renders "Delivered"
(no-premature-success), a FAILED leg renders a working retry button,
Finance NEEDS_DECISION renders the missing-mapping state with no retry
option. All 8 pre-existing `ClosureSection` tests still pass unmodified.

## Collision audit vs. active FIN-05

Re-confirmed with the CURRENT (round-2) FIN-05 head
(`887b949a0b`, moved 8+ commits since round 1) and the round-2 file set
(now including `executionRealizationService.ts`, `initiativeClosureService.ts`):
**zero file overlap.** `fix/fin-005-atelier-coherence` also untouched (base
choice avoids it entirely).

## Unresolved / NEEDS_PRODUCT_DECISION

1. **Finance currency source remains a heuristic**: `initiatives.budget_currency`
   (a column that itself defaults to `'PLN'`, not necessarily user-confirmed)
   is the only currency signal used, and only fires when a KPI's `unit`
   literally matches it — confirmed rare in current seed/demo data. This is
   intentional (never fabricate), but a real product decision on "what field
   is the authoritative financial-target currency for an initiative" would
   let more real closures resolve instead of landing in `NEEDS_DECISION`.
2. Per the brief's own instruction: no invented value mapping anywhere —
   `expected_roi` is never read by the Finance leg, and any closure without
   an explicit currency-matched KPI target lands in `NEEDS_DECISION`.

## Clean tree / no push / no merge / no deploy / no Railway / no demo

- `git status --short`: clean (verified live, see top of this report).
- Zero `git push`, zero merge into any other branch, zero Railway/demo
  interaction, zero production data at any point.
- Local Docker Postgres instances used for testing were created, verified,
  and torn down as part of this session — nothing persisted outside the
  worktree/branch itself.

AWAITING_CODEX_REVIEW
