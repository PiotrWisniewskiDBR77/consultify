---
doc_id: exe-009-discovery-2026-08-02
truth_type: discovery
status: draft
owner: claude
business_owner: piotr
last_reviewed: 2026-08-02
---

# ★★★★ Round-3 correction (Codex review, same date) — target vs. actual

Round 2's Finance leg (below) resolved WHERE to write (canonical
`roi_realized_values`) but still got WHAT to write wrong: it summed
`initiative_kpis.target_value` (a PLAN) whenever the KPI's `unit` matched
`budget_currency`, and wrote that into the "realized" column. Codex
correctly flagged this as semantically invalid: a planned target is not
evidence a benefit was REALIZED, and reaching initiative status DONE is not
evidence either.

A fresh, targeted discovery pass (this round) confirmed **no existing
"approved actual, explicit currency" concept exists anywhere in this
codebase**: `roi_realized_values`/`kpi_time_series` both have a
self-asserted `source` column with no approval/sign-off field;
`v8_roi_realization_entries.verified_by` (the one column anywhere in this
schema with genuine approval semantics) is only ever written by a synthetic
health-check probe, never a real user flow; `initiative_benefits.actual_annual_value`
is declared but never written by any code path. See
`server/src/services/closureDeliveryReceiptService.ts`'s own header comment
for `findMonetaryActualMeasurement` for the full citation trail.

**Corrected design**: the Finance leg now reads `kpi_time_series` — a
point-in-time OBSERVATION table ("the KPI's value was measured as X at
period P"), structurally distinct in KIND from `target_value` (a one-shot
plan) — instead of the target. A measurement only counts if it belongs to
the same org+initiative, its owning KPI's `unit` literally matches
`budget_currency`, and it is within `MONETARY_MEASUREMENT_MAX_AGE_DAYS`
(180 days, a documented policy default) of delivery time. This is NOT a
claim that a formal human-approval gate exists before a measurement can back
a realization — that gap is real and is recorded as a NEEDS_PRODUCT_DECISION
in the completion report, not silently assumed away.

Verified with the negative-control exercise Codex required: the round-2 bug
was temporarily reintroduced, the new `TARGET-VS-ACTUAL #1` test went red,
the fix was restored (diff confirmed byte-identical to before the
injection), and the test went green again.

# ★★★ Round-2 correction (Codex review, same date)

Round 1 of this packet (below) built the Finance leg as a NEW, isolated
`closure_finance_actuals` table, with `expected_roi` as a fallback monetary
amount when no KPI target existed. **Codex review rejected both**: the new
table was written by nobody-reads-it code (not a real Finance delivery), and
`expected_roi` is a free-text ROI/percentage narrative field in this schema,
never a currency amount (confirmed: `903_expected_roi_to_text.sql`'s own
header, `CharterBuilder.tsx`'s "Expected ROI (%)" label as a field distinct
from "Business Value (PLN)").

**Corrected design** (see `closureDeliveryReceiptService.ts`'s own header for
the full rationale): the Finance leg now calls the EXISTING canonical
`executionRealizationService.recordExecutionRealization` (writes
`roi_realized_values`, read by the real `ROITrackingPanel.tsx` via
`GET /benefits/roi/portfolio/summary` — confirmed via a fresh canonical-
Finance inventory that this is the one real, UI-rendered,
organization+initiative-scoped realization table in the codebase, and that
the program's own doctrine, `EXE-002_MANAGEMENT_SPINE_AUDIT.md`'s FLOW-001,
is closure → Results → Finance, not closure → Finance directly). Migration
937 adds an additive `closure_receipt_id` dedup key to that table.
`expected_roi` is no longer read by the Finance leg at all — the only signal
used is a planned KPI whose `unit` literally equals the initiative's own
`budget_currency` code, which the round-1 discovery below already
established is rare in current seed/demo data, meaning `NEEDS_DECISION` is
the expected, correct outcome for most real closures today.

Also fixed in round 2: `POST .../closure-receipt/retry` now reuses the exact
`CLOSURE_APPROVER_ROLES` gate `/approve` uses (was previously open to any org
member); `attemptDelivery`/`manualRetryReceipt` renamed to
`attemptDeliveryInternal`/`retryDeliveryForOrg` to make the tenant-trust
boundary explicit; and a second real concurrency bug (shared-pool read-after-
write on the Results/Finance read-back queries, same root cause class as the
`claimLeg` fix below) was found and fixed while re-testing.

The base-selection reasoning below (stay on `feat/exe-008-closure-evidence-
gate` alone, do not merge Finance/Atelier) was independently re-verified
against fresh HEAD SHAs during the round-2 review and still holds — see the
EXE-009 completion report for the refreshed evidence.

# EXE-09 — discovery gate (closure → Results/Finance durable receipt)

Base decision, canonical ownership map, and known gaps established before any
implementation. Produced by six parallel read-only agents against
`integrate/mvp-wave1-abc` (for breadth) plus direct forensics on
`feat/exe-008-closure-evidence-gate` (for the actual base). Main working tree
was never checked out/reset during discovery.

## Base selection

**Base: `feat/exe-008-closure-evidence-gate` @ `b359a4edad`.** No merge.

Why not `integrate/mvp-wave1-abc` (`0b3381a876`, the only branch already
containing both EXE-08-shaped work and Results as real ancestors):

- Its EXE-08 content is **stale/less-hardened** than the frozen
  `b359a4edad` — missing the evidence cross-initiative ownership fix
  (`assertEvidenceRefBelongsToInitiative` vs the weaker
  `assertEvidenceRefBelongsToOrg`) and the crash-recovery
  (`reconcileClosureRequestStatus` + `__testFail*` seams) added after the
  branches diverged at `e281e88652`.
- Its Finance state predates `fix/fin-005-atelier-coherence` (`fbadd3c263`)
  by 51 commits and is missing the entire Atelier subsystem (37 files /
  23,916 insertions) — not a drift, a whole absent subsystem.
- Merging `fbadd3c263` (Atelier) or `feat/fin-005-statement-ingestion-golden-flow`
  (active, off-limits per this packet's mandate) in to catch up would touch
  92+ files including shared risk files (`server/src/Gateway.ts`,
  `PostgresDatabase.ts`, `fileUpload.middleware.ts`, and
  `src/components/Execution/ExecutionHub.tsx` — a file EXE-09 itself needs).

Why `b359a4edad` alone is sufficient (no Results/Finance merge needed):

- `feat/exe-008-closure-evidence-gate` and `integrate/mvp-wave1-abc` share a
  merge-base (`e281e88652`) only 6 commits behind exe-008 vs. 90 behind
  wave1-abc. exe-008 already carries `financeEnterpriseService.ts`,
  `resultsROIService.ts`, `kpiDeviationService.ts`,
  `notificationOutboxService.ts`, `WebhookService.ts`,
  `enterprisePlatformService.ts`, and the EXE-002/006 idempotency-key
  migrations from shared ancestry — everything this packet's receipt/outbox
  needs to model itself on.
- The one thing exe-008 is missing that wave1-abc has is
  `kpiRecoveryCardService.ts` (RES-002/003A recovery-card lifecycle). It is
  **not needed**: closure handoff does not write into the KPI
  measurement/deviation/recovery pipeline at all today (see below) — it
  writes into a separate "benefits register" surface that exe-008 already
  has in full.
- `git log <merge-base>..0b3381a876 -- executionResultsBridge.ts
  initiativeTransitionService.ts` shows wave1-abc never modified these files
  beyond picking them up in an unrelated integration merge — nothing to lose
  by not merging.

Documented gap: EXE-09 does **not** get the Atelier-coherence Finance fixes
or the RES-002/003A recovery-card feature. Neither is required for this
packet's contract; flagged here so a future integrator knows this branch is
not a superset of `integrate/mvp-wave1-abc` and needs its own forward-port.

## 1–3. Canonical closure owner + all CLOSED/DONE transitions + ExecutionResultsBridge

- Sole writer of `initiatives.status`: `initiativeTransitionService.executeInitiativeTransition`
  (`server/src/services/initiative/initiativeTransitionService.ts`). The only
  caller that drives it to `DONE` is EXE-08's
  `initiativeClosureService.approveClosureRequest` (closure request + evidence
  + approver gate). Direct `/complete` bypass is disabled (`410 Gone`,
  `InitiativeController.ts:2396`).
- Task-level `done` (`taskWorkflowService.ts`) is a separate, unrelated status
  machine — no handoff call from it today.
- `initiativeTransitionService.ts:1553` — on every transition to `DONE`:
  `fireClosureHandoff(orgId, id, actorId || null)`, a **fire-and-forget**
  call: `void handoffFromClosure(...).catch(err => logger.warn(...))`
  (`executionResultsBridge.ts`, header literally says "Fire-and-forget by
  design"). Failures are logged only — no retry, no queue, no visibility to
  caller/UI/operator. This is the exact defect EXE-09 replaces.
- `handoffFromClosure` writes **only** `initiative_benefits`
  (Results-side benefit register), deduped via a partial unique index
  `(initiative_id, kpi_id, source_tag) WHERE source_tag='M14_CLOSURE_HANDOFF'`
  (`server/migrations/783_benefits_register_closure_handoff.sql`). **No
  Finance-side write exists in this path at all** — confirmed independently
  by `MVP_FUNCTION_IMPLEMENTATION_STATUS_LEDGER.md`: "DONE uruchamia
  idempotentny, ale fire-and-forget Results handoff; brak transakcyjnego
  receipt i closure→Results→Finance actual round-trip."
- Other callers of the same fire-and-forget helper: `demoSeedService.ts`
  (seed materialization, bypasses the closure-request gate by design) and
  `executionBudgetService.ts` (`fireBudgetHealthExport`, a separate
  budget-health KPI signal, not in EXE-09 scope).

## 4. Results measurement/deviation/recovery — separate surface, not touched by closure

`kpi_time_series` (raw measurement, no idempotency), `kpi_deviation_cases`
(idempotent upsert on `(organization_id, kpi_id, period_start)`),
`kpi_recovery_cards/actions/checkpoints` (idempotent) are a **completely
separate pipeline** from `initiative_benefits`. RES-003A's own integration
contract confirms Execution-driven KPI updates
(`initiativeKpiAssignmentService.updateInitiativeKpiAssignment`) never write
into `kpi_time_series` and never trigger a Deviation Case — "aktualizacje KPI
z Execution/PMO nadal NIE tworzą Deviation Case ani Recovery Card." **There is
no existing closure→KPI-value mapping to hook into.** EXE-09's "Results
delivery" leg is therefore the existing `initiative_benefits` write
(already-defined target), not an invented KPI value.

## 5. Finance actuals/benefits — no push-based writer exists

No code path writes a Finance "actual" on initiative closure, anywhere, on
any branch. `resultsROIService.recordROIRealization` (writes
`v8_roi_realization_entries`) is only called by a health-check probe, never
production traffic. `resultsFinanceReconciliationService` is pull-based
(Finance pulls Results KPIs), never pushed into by Execution closure.
`benefitsRegisterService` is `@deprecated`, zero callers.

**Currency landmine**: `initiative_benefits.currency` defaults to `'USD'`
but the existing closure INSERT never sets it; Finance defaults to `'PLN'`
almost everywhere else (`financialModelingService.ts`, `valuationService.ts`).
`v8_roi_realization_entries` / `v8_kpi_finance_reconciliations` have **no
currency column at all**.

**Decision carried into the contract**: closure does not carry an explicit,
unambiguous financial target/benefit amount today — there is no established
mapping from "initiative closed" to "this many PLN/USD realized." Per this
packet's mandate ("nie wolno wymyślać mapowania wartości... zapisz
NEEDS_PRODUCT_DECISION"), the Finance delivery leg of the receipt will be
marked `NEEDS_PRODUCT_DECISION` whenever the closure evidence does not carry
an explicit financial target, rather than fabricating a value or currency.
The receipt/outbox machinery itself (durable state, retry, UI status) is
still built in full — only the *value mapping* is deferred.

## 6–7. Fire-and-forget inventory + reusable receipt/outbox precedent

Fire-and-forget/catch-and-log sites in scope: `executionResultsBridge.ts`
(`fireClosureHandoff`, `fireBudgetHealthExport`), both unawaited + swallow
errors via `.catch(logger.warn)`.

Reusable precedent, best-to-worst fit:

1. `server/src/services/notificationOutboxService.ts` — closest structural
   shape (`notification_outbox`: status PENDING/SENT/FAILED, dedupe_key,
   `drainOnce()`, cron drain every 60s) but **no attempts/last_error/backoff**
   — `FAILED` is terminal today.
2. `server/src/services/WebhookService.ts` — `webhook_deliveries` has
   `attempts` + `retry_policy {max_attempts, backoff}` — the attempts/backoff
   shape EXE-09 needs.
3. `server/src/services/enterprisePlatformService.ts` — `integration_queue`
   has `retry_count`, `max_retries`, `next_retry_at`, full
   pending/retry/completed/failed state machine — closest complete
   worker/backoff precedent.
4. `server/src/services/ai/toolChainExecutor.ts` — confirmed **dead code**,
   zero importers, in-memory only, no persistence. Contradicts a stale prior
   memory note calling it a "ready DAG engine" — verified live via grep, not
   reused for EXE-09.

EXE-09's `closure_receipts` (or similarly named) table combines pattern 2+3:
one row per closure event, `results_status` + `finance_status` columns each
independently PENDING/DELIVERED/FAILED/NEEDS_DECISION, `attempts`,
`last_error`, timestamps, idempotency key.

System actor convention: plain `system:<feature>` sentinel strings (not
FK'd to `users`), e.g. `SYSTEM_ACTOR_ID = 'system:initiative-auto-start'`
(`initiativeAutoStartJob.ts`); `AuditEventsService.ActorType` enum includes
`SYSTEM`. EXE-09 uses `system:exe-009-closure-receipt` as its actor label.

Idempotency-key convention (very recent, EXE-002/006 precedent, reuse
directly): `idempotency_key TEXT` column + partial unique index
`(scope_id[, action], idempotency_key) WHERE idempotency_key IS NOT NULL`
(`server/migrations/20260801_exe002004_idempotency_keys.sql`,
`20260802_exe005006_change_progress_spine.sql`).

## 8–9. Tenant/project/initiative binding + actor/audit trail

`organization_id` is always session-derived (`req.user.organizationId`),
never client-supplied, and joined with `initiative_id` in essentially every
query — no caller-trust bug class found on this path (unlike the known
`vault_project_id` issue elsewhere, see project memory). `initiatives`:
`organization_id NOT NULL REFERENCES organizations(id)`, `project_id`
nullable, no FK.

Existing causation-id concept to reuse, not reinvent: `correlationId =
uuidv4()` generated once per transition in `executeInitiativeTransition`,
used as the PK of `initiative_status_history` and embedded in
`initiative_history.notes` JSON — "ONE correlationId shared by both rows."
EXE-08's `initiative_closure_requests.transition_audit_ref` already points at
the `initiative_history` row written by the transition. EXE-09's
`closure_receipts` row will carry the same `correlationId` /
`transition_audit_ref` value so Execution, Results, and Finance share one
identifier end-to-end, per this packet's contract point 9.

Template for the new table's FK/index shape:
`execution_audit_log` / `initiative_closure_requests` — both
`organization_id NOT NULL REFERENCES organizations(id)` +
`initiative_id NOT NULL REFERENCES initiatives(id)`, indexed on both.

## 10. FIN-05 conflict audit — fully avoided by the base choice

Active `feat/fin-005-statement-ingestion-golden-flow` touches 92 files
(merge-base `c522a86183`): finance-statement migrations/routes/services,
`FinanceHub.tsx`, `FinancialStatementImportWizard.tsx`, plus shared files
`server/src/Gateway.ts`, `PostgresDatabase.ts`, `fileUpload.middleware.ts`,
and **`src/components/Execution/ExecutionHub.tsx`**. Because EXE-09 branches
from `feat/exe-008-closure-evidence-gate` directly (no merge with FIN-05 or
Atelier), none of FIN-05's files are touched by this base-selection step.
`ExecutionHub.tsx` is still a real collision risk going forward purely
because EXE-09 itself may need to edit it for the UI status chip — treat any
edit there as high-care/minimal-diff, and re-check FIN-05's live diff on that
file before touching it during implementation.

## Net contract for implementation

- One new table, e.g. `closure_delivery_receipts` — one row per closure
  event, keyed by `(organization_id, initiative_id, correlation_id)` unique,
  columns: `results_status`, `finance_status` (each
  `PENDING|DELIVERING|DELIVERED|FAILED|NEEDS_DECISION`), `attempts`,
  `last_error`, `results_delivered_at`, `finance_delivered_at`,
  `created_at`, `updated_at`, `actor_id` (`system:exe-009-closure-receipt`),
  `transition_audit_ref` (reuse existing correlationId/audit-ref concept).
- Written **inside the same transaction** as the closure's
  `executeInitiativeTransition` commit (or immediately after via the
  existing `reconcileClosureRequestStatus` recovery-marker pattern already
  proven for EXE-08's own two-unit atomicity) — never fire-and-forget.
- A worker/reconciliation sweep (new, modeled on
  `enterprisePlatformService.integration_queue`'s retry/backoff shape, or a
  cron drain like `notificationOutboxService`) processes PENDING/FAILED rows,
  calling the existing `handoffFromClosure` (Results) and a new additive
  Finance adapter, each independently, each retryable without duplicating
  downstream writes (reuse `initiative_benefits`' existing partial-unique
  dedup for Results; new adapter needs its own idempotency key for Finance).
- Finance adapter is new/additive — no existing file to extend safely
  without either fabricating a value mapping or touching FIN-05/Atelier
  territory. Where closure evidence has no explicit financial target, the
  adapter records `finance_status = NEEDS_DECISION` and stops — it does not
  invent a currency or amount.
- UI: extend the existing Closure/Evidence section (`ClosureSection.tsx`)
  with the minimal status chip contract requested (delivering / delivered /
  partially delivered / failed-retry / missing-mapping), sourced from a new
  read endpoint over `closure_delivery_receipts`, PL/EN, standard tokens —
  no new dashboard.
