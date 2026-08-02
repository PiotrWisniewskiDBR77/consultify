---
doc_id: exe-009-completion-report-2026-08-02
truth_type: delivery-status
status: awaiting-codex-review
owner: claude
business_owner: piotr
last_reviewed: 2026-08-02
---

# EXE-09 — completion report

## Base / branch / worktree / HEAD

- Base: `feat/exe-008-closure-evidence-gate` @ `b359a4edad` (frozen, `CODE_GO_FROZEN`) — chosen over `integrate/mvp-wave1-abc` because that branch's EXE-08 content is stale/less-hardened and its Finance state predates `fix/fin-005-atelier-coherence` by 51 commits (missing the whole Atelier subsystem). Full rationale: `docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/EXE-009_DISCOVERY.md`.
- Branch: `feat/exe-009-closure-results-finance-receipt`
- Worktree: `/private/tmp/claude-501/.../scratchpad/wt-exe-009` (isolated, not the shared checkout)
- HEAD: `855f0a4a45a5aa821e30ab456f8dde99aa31dbf5`
- 6 commits on top of base, discovery → schema/service/wiring → routes/cron → UI → tests → adversarial-review fixes (two separate fix commits, since the review surfaced a second, independent bug while verifying the first fix).

## Canonical ownership

- Closure trigger (unchanged, frozen): `initiativeTransitionService.executeInitiativeTransition` is the sole writer of `initiatives.status`; only `initiativeClosureService.approveClosureRequest` (EXE-08) drives it to DONE.
- New: `closureDeliveryReceiptService.ts` — sole owner of `closure_delivery_receipts` and `closure_finance_actuals`. Nothing else writes these tables.
- Results leg reuses the existing, already-idempotent `executionResultsBridge.handoffFromClosure` (writes `initiative_benefits`) — not reimplemented.
- Finance leg is new and additive (`closure_finance_actuals`) — does not touch any existing Finance table/service, `fix/fin-005-atelier-coherence`, or the active `feat/fin-005-statement-ingestion-golden-flow`.

## Receipt/outbox state machine

One row per real closure, **keyed by the transition engine's own `correlationId`** (same value already used as the PK of `initiative_status_history` for that transition) — this is the literal shared identifier across Execution/Results/Finance the contract asked for, not an invented second causation concept.

- `results_status`: `PENDING → DELIVERING → DELIVERED | FAILED` (retryable)
- `finance_status`: `PENDING → DELIVERING → DELIVERED | FAILED | NEEDS_DECISION` (retryable, except NEEDS_DECISION which is terminal until a human acts)
- Independent per leg — a Results failure never blocks/hides a Finance success and vice versa (real-PG tested both directions).
- `attempts` / `last_error` / `*_delivered_at` / `*_payload` per leg; `next_retry_at` with exponential backoff (30s → capped 30min).
- Finance value: computed independently from `initiative_kpis.target_value` (only KPIs whose `unit` literally matches `initiatives.budget_currency` — not any numeric target) or `initiatives.expected_roi`, paired with `budget_currency`. No unambiguous currency/amount → `NEEDS_DECISION`, never a fabricated value.

## Transaction boundaries

- Receipt row is **inserted inside the SAME transaction** as the status write (`initiativeTransitionService.ts`, same `client`, same `withPgTransaction` block) — a closure cannot commit without its receipt existing.
- Delivery itself happens outside that transaction (best-effort immediate trigger post-commit + a cron reconciliation sweep every 30s), by design — the receipt's durability does not depend on delivery ever running.
- Each leg is claimed atomically via a single `UPDATE ... WHERE status IN ('PENDING','FAILED')` on a **dedicated pinned connection** (`withPgTransaction`, not the shared pool — see "adversarial review" below for why that distinction mattered). Stale `DELIVERING` (crash mid-attempt) is reclaimed after 5 minutes.

## Changed files (12, +1950/-9)

```
docs/.../PACKETS/EXE-009_DISCOVERY.md                (new)
public/locales/en/translation.json                   (+10)
public/locales/pl/translation.json                    (+10)
server/migrations/935_exe009_closure_delivery_receipt.sql       (new)
server/migrations/936_exe009_benefits_fallback_dedup_backstop.sql (new)
server/src/index.ts                                   (+15, cron registration)
server/src/routes/pmo/initiativeClosure.routes.ts      (+50, 2 new GET/POST routes)
server/src/services/closureDeliveryReceiptService.ts   (new, 635 lines)
server/src/services/initiative/initiativeTransitionService.ts (+36/-9, two call-site edits only)
src/components/Initiatives/sections/ClosureSection.tsx (+137, status chip)
tests/components/Initiatives/ClosureSection.test.tsx   (+58, 3 new tests)
tests/integration/exe009-closure-delivery-receipt.realdb.test.ts (new, 611 lines)
```

## Test evidence (real Postgres 16, fresh-migrated, no mocks)

10 integration tests + 11 component tests = **21/21 passing**, re-run 16× consecutively after the concurrency fix with zero failures (vs. 4-5 failures per 8 runs before it — see below).

Integration suite covers: golden flow (receipt→Results→Finance read-back, causation-id match with `initiative_status_history`), identical-retry same-downstream-ids, two concurrent full closures (exactly one receipt), a **dedicated concurrent-`attemptDelivery` regression test** on the no-DB-backstop fallback path, Results-fails/Finance-ok, Finance-fails/Results-ok, restart+reconciliation (receipt left untouched, recovered by the sweep alone), cross-tenant read isolation, two missing-mapping (NEEDS_DECISION) cases.

## Negative controls

- Manual raw-SQL duplicate insert against `closure_finance_actuals` → real `duplicate key value violates unique constraint` (DB backstop genuinely enforced, not just app-level).
- Standalone repro calling `handoffFromClosure` twice concurrently, 8 rounds, outside any of this packet's code — confirmed migration 936's index prevents duplication on its own (defense in depth, not just claimLeg).
- Cross-tenant: receipt created in org A returns `null` when read under org B, both via direct service call and via `getReceiptForInitiative`.

## UI evidence

No browser render (this is a backend-adjacent status chip inside an existing section, not a new screen) — verified via component tests instead: PENDING/DELIVERING never renders "Delivered" (no-premature-success), a FAILED leg renders a working retry button, Finance NEEDS_DECISION renders the missing-mapping state with no retry option. All existing 8 ClosureSection tests still pass unmodified.

## Independent adversarial review — findings and fixes

Ran a fully independent agent review (no access to my reasoning, only the diff) before finalizing. It found two real issues, both fixed and now regression-tested:

1. **HIGH — concurrent-delivery race.** `attemptDelivery` had three unsynchronized callers (post-commit trigger, operator retry route, cron sweep) but only the sweep claimed rows. Worst case: the no-KPI `expected_roi` fallback benefit path has no DB unique index, so two concurrent deliveries could produce two `initiative_benefits` rows. **Fixed**: `attemptDelivery` now atomically claims each leg via `UPDATE ... WHERE status IN (...)` before doing any work; added migration 936 as a DB-level backstop for that fallback path; added stale-lease reclaim for a leg abandoned mid-crash.
2. **While fixing #1, flakiness testing (8× repeat) surfaced a second, independent bug**: the claim's affected-row read went through the shared connection pool, which this codebase's own `queryHelpers.ts` documents as an unreliable pattern under concurrency (a prior real incident is cited there). Isolated with a standalone repro proving the pre-existing code was fine and the pool read was the actual fault. **Fixed**: `claimLeg` now uses a dedicated pinned connection (`withPgTransaction`). 16/16 clean re-runs after.
3. **MEDIUM — value mislabeling.** `computeFinanceValue` originally summed every planned KPI's `target_value` regardless of unit, mislabeling non-monetary targets (%, days, count) as currency. **Fixed**: only sums KPIs whose unit matches the initiative's own currency code; a genuine zero is no longer silently discarded in favor of the ROI fallback.
4. **MEDIUM, not fixed — policy question, not a bug**: the retry route (`POST .../closure-receipt/retry`) only requires org membership, unlike `/approve`'s explicit approver-role check. Flagged as a product decision, not changed unilaterally.
5. **LOW, not fixed — defense-in-depth suggestion**: `attemptDelivery` trusts its `receiptId` param without its own org filter; every current caller enforces this before reaching it, so not exploitable today, but flagged for a future caller to be careful about.

## Collision audit vs. active FIN-05

Confirmed zero overlap between this branch's 12 changed files and the active `feat/fin-005-statement-ingestion-golden-flow`'s ~92-file diff (migrations, `finance-statements.routes.ts`, `financialStatementService.ts`, `FinanceHub.tsx`, `Gateway.ts`, `PostgresDatabase.ts`, `ExecutionHub.tsx`, etc. — none touched). `fix/fin-005-atelier-coherence` also untouched (base-selection avoided it entirely, see discovery doc).

## Unresolved / NEEDS_PRODUCT_DECISION

1. **Finance currency source is a heuristic, not an explicit decision**: uses `initiatives.budget_currency` (a column that itself defaults to `'PLN'` — not necessarily user-confirmed) as the authoritative currency. This is the least certain part of the packet; documented prominently in the discovery doc and in code comments. A real product decision on "what field is the authoritative financial-target currency for an initiative" would let this be tightened.
2. **Retry-route authorization** (finding #4 above) — left at org-membership-only; a product call on whether it needs an approver/admin role like `/approve`.
3. Per the brief's own instruction, no invented value mapping: any closure without an explicit KPI-target-in-matching-currency or `expected_roi` lands in `NEEDS_DECISION`, not a guess.

## Clean tree / no push / no merge / no deploy / no Railway / no demo

- `git status --short` in the worktree: clean (verified just before this report).
- Zero `git push`, zero merge into any other branch, zero Railway/demo interaction, zero production data at any point.
- Local Docker Postgres used for testing was created, verified, and torn down (`docker stop/rm`) as part of this session — nothing persisted outside the worktree/branch itself.

AWAITING_CODEX_REVIEW
