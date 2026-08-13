# ROI-E005 — Benefits Realization — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
Fifth epic of the ROI domain, builds on ROI-E001-E004, all landed. Backend
only — UI Registry is RN-G2. **Zero-migration epic** — no new tables or
columns, purely new commands/reads over existing schema.

---

## 0. Epic boundary (confirmed, not just accepted)

Per `EPIC_LEDGER_LIVE.md`'s prose (verified verbatim):

> "ROI-E005 Benefits Realization (5 AC: Initiative Completed→Benefits
> Realization niezależnie od zamknięcia Initiative, MyWork obligations
> przetrwają zamknięcie Initiative, realization % z governed data,
> cancellation zachowuje actual, org perspective tylko z governed data)"

Five ACs, accepted verbatim:

1. **AC-01** — Initiative-Completed→Benefits-Realization, independent of Initiative closure.
2. **AC-02** — MyWork obligations survive Initiative closure.
3. **AC-03** — realization % computed from governed data.
4. **AC-04** — cancellation preserves Actual.
5. **AC-05** — org perspective only from governed data.

**ROI-E004's Decision D14 confirmed correct**, not just inherited: every one
of these 5 ACs is a status transition, an obligation-survival property, or a
read computed from tables E004 already built. None names a new Forecast/
Actual/Variance primitive.

---

## 1. Decisions

All 18 decision points from the design draft are ratified as specified,
including its own 5 flagged open questions — each is confirmed below rather
than left open, since the draft's own reasoning for each was sound and no
new information changes the calculus.

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | What triggers `'tracking'→'benefits_realization'`? | **Manual command**, `startRoiCaseBenefitsRealization`, `fromStatuses: ['tracking']`. No subscription to Initiative status changes. | `initiativeClosureService.ts` has zero references to any `rvn_*` table or to ROI/obligations — no event bus connects legacy Initiative lifecycle to this platform. Building one is a new cross-system integration no AC names. |
| D2 | Literal meaning of "independent of Initiative closure"? | **Both candidate readings converge on the same design**: the guard checks only the ROI Case's own `status`, never `initiatives.status`. **Confirmed** — if a future epic ever builds an Initiative→resultsVnext event bridge, this "no automatic cascade" decision needs explicit revisiting then, not silent inheritance now. | The epic's business-narrative name is not a literal precondition; AC-01 explicitly overrides the naive coupling the name suggests. |
| D3 | Does the transition need a readiness guard? | **No guard** — unconditional off `'tracking'`, same shape as `startRoiCaseTracking`. | No AC calls for a precondition; requiring prior Actual data would block the normal case (Benefits Realization is typically when actuals START accruing). |
| D4 | Does the transition create a MyWork obligation? | **Yes.** New `confirm_benefits_realization` type, assignee = `owner_user_id`. The pre-existing `track_roi_forecast_actuals` obligation is **not** touched — it covers the same ongoing duty across all of `ROI_TRACKING_ACTIVE_STATUSES` (already includes `'benefits_realization'`). | Mirrors ROI-E004's own D2 exactly. |
| D5 | AC-02 — does an auto-complete/auto-cancel hook on obligations exist that this epic must guard against? | **No — confirmed by reading, not assumed.** Zero call sites of `completeObligation` anywhere outside `obligations.ts` itself. `rvn_platform_obligations.reference_id` has no FK/CASCADE. `initiativeClosureService.ts` never writes to `rvn_platform_obligations`. **AC-02 is already structurally satisfied** — this epic's job on AC-02 is a realdb test PROVING it, not new production code. | Confirms rather than invents a problem; matches the task's own instruction not to guess at a fix for a bug that doesn't exist. |
| D6 | Does ROI-E005 build the `'cancelled'` transition? | **Yes.** New `cancelRoiCase`, `fromStatuses: ROI_TRACKING_ACTIVE_STATUSES`. | `'cancelled'` has been reserved in the CHECK constraint since ROI-E001 but no command transitions into it — genuinely unowned, and this is the epic whose AC (AC-04) is literally about cancellation's effect on data. Same class of narrow, explicitly-flagged gap-fill as ROI-E004's D8. |
| D7 | Why not also `draft`/`modeling`/`approved` as `fromStatuses`? | **Deliberately narrow** — cancelling a case with no Actual data has no AC-04 concern; a general "abandon at any stage" command is a different, unnamed feature. Filed as backlog, not silently built. | Keeps scope to exactly what AC-04 requires. |
| D8 | New audit columns for cancellation? | **No.** Reuses `updated_at`/`updated_by` plus the event log's `reason`. `reason: string` mandatory on the command's input type, same non-optional pattern `reopenApprovedRoiCaseForRevision` already uses. | Plain status transitions in this domain get no dedicated columns (only orthogonal flags or genuinely distinct-outcome columns earn one — precedent from ROI-E001 D4, ROI-E003 D6). |
| D9 | Does `cancelRoiCase` touch obligations? | **No** — left untouched, same as every other transition. Flagged as backlog (future ops concern), not built here. | No AC names it; D5 already established nothing anywhere auto-manages obligation status on any transition. |
| D10 | AC-03 — realization-% formula and "governed data" meaning? | **Numerator**: `rvn_roi_actual_snapshots.total_actual_financial_benefits` via `currentActualSnapshotId`. **Denominator**: the Approved snapshot's pinned `decisionCalculationRun.totalFinancialBenefits` via `latestApprovedSnapshotId` — **not** Forecast. `pct = (actual/approved)*100`, `null` if approved is `0`. **Confirmed** (draft's own flagged open question — no source doc states this explicitly, but the reasoning holds and no better-sourced alternative exists). | "Governed data" = the immutable, versioned `rvn_roi_*` tables, never the legacy tables ROI-E001 §2 permanently excluded. Approved (not Forecast) is the correct denominator: it's immutable-by-construction and can't be gamed by re-forecasting a smaller target, matching the standard meaning of "realization vs. the originally committed case." |
| D11 | Stored or live-computed? | **Live-computed, never persisted** — same half of E004's D9 split as `getRoiCaseCompareView`. | A pure ratio over two already-durable pointers; nothing to curate (no AC names a cause+contribution structure here, unlike Variance). |
| D12 | Missing-data shape? | **2-reason typed slot**, reusing `RoiCompareSlot`'s type, reasons restricted to `'not_yet_approved' \| 'no_actual_recorded'`. | Consistency with the established convention; strict subset of E004's reason set since Forecast isn't part of this ratio. |
| D13 | Full metric set, or financial-benefits only? | **Financial-benefits only**, labeled `benefitsRealizationPct`. **Confirmed** (draft's own flagged open question). | AC-03 names "realization %," singular. A speculative multi-metric superset (cost-realization, ROI-realization) is scope creep; cheap to extend later using the identical pattern if a real need surfaces. |
| D14 | Status-gated read? | **No** — readable in any status, same "no status restriction on GET routes" convention. | Actual data can exist during plain `'tracking'`, before `'benefits_realization'` — restricting the read would hide the number exactly when it starts being interesting. |
| D15 | AC-05 — is the org-perspective rollup in scope for this epic? | **Yes, built now, backend-only, narrowly** — mirrors `kpiPerspectivesRepository.ts`'s `listOrganizationKpiAttention` shape. **Confirmed** (draft's own flagged open question). | AC-05 is one of only 5 named ACs — skipping it would leave a named AC unaddressed. Scoped to a governed-data rollup only, not a portfolio dashboard (that remains RN-G2/reporting territory). |
| D16 | New `resource_type` for the rollup? | **No.** Reuses `resource_type='roi_case'` per-row visibility, plus a management-chain scope on `owner_user_id` on top — identical two-layer shape to `kpiPerspectivesRepository.ts`. | Nothing about "org perspective" implies finer-than-case visibility; it implies a manager-chain scope layered on the existing per-case visibility. |
| D17 | New error classes? | **None.** Existing `RoiCaseValidationError`/`AtomicWriteConflictError`/`AtomicWriteAggregateNotFoundError` and the existing null→404 read pattern cover every failure mode this epic produces. | Confirmed by reading `handleRoiRouteError`'s existing chain. |
| D18 | New migration? | **No.** Every deliverable reuses existing schema (CHECK constraint values, `rvn_platform_obligations`, ROI-E003/E004's existing tables). | Zero-migration epic. |

---

## 2. Command layer (`server/src/services/resultsVnext/roi/`)

Before implementing, re-read the current exact state of `roiCaseCommands.ts`
(`ROI_TRACKING_ACTIVE_STATUSES`, `NON_EDITABLE_STATUSES`), `roiTrackingCommands.ts`
(the direct template), `platform/obligations.ts`, and `roiCompareRepository.ts`
— this design describes their shape, not a guarantee of literal signatures
after four epics of edits.

**New** `roiBenefitsRealizationCommands.ts`:

- `startRoiCaseBenefitsRealization(input)` — hand-written
  `executeAtomicCommand`, `aggregateId=caseId`, structurally copied from
  `startRoiCaseTracking`: guard `status === 'tracking'` else
  `RoiCaseValidationError('INVALID_ROI_CASE_STATUS_TRANSITION', ...)`;
  `UPDATE rvn_roi_cases SET status='benefits_realization', row_version=$next,
  updated_by, updated_at=now()`; same-transaction `createObligation(client, {
  obligationType: 'confirm_benefits_realization', assigneeUserId:
  currentRow.owner_user_id, referenceType: 'roi_case', referenceId: caseId,
  aggregateVersionAtCreation: nextVersion, deduplicationKey:
  \`${organizationId}:roi_case:${caseId}:confirm_benefits_realization\` })`.
  `buildEvent`: `roi.benefits_realization_started`.
- `cancelRoiCase(input)` — hand-written `executeAtomicCommand`,
  `aggregateId=caseId`. `reason: string` mandatory. Guard
  `ROI_TRACKING_ACTIVE_STATUSES.includes(status)` else
  `RoiCaseValidationError('INVALID_ROI_CASE_STATUS_TRANSITION', ...)`.
  `UPDATE rvn_roi_cases SET status='cancelled', row_version=$next,
  updated_by, updated_at=now()`. No obligation writes. No touch of
  `rvn_roi_actual_entries`/`rvn_roi_actual_snapshots`/
  `rvn_roi_forecast_versions`/`rvn_roi_variances` anywhere in this
  function — structural proof of AC-04, not merely an assertion.
  `buildEvent`: `roi.case_cancelled`.

Both mountable via `roi.routes.ts`'s existing `mountTransitionRoute` helper,
same as `startRoiCaseTracking` already proves works for a hand-written,
side-effect-bearing command.

**New** `roiBenefitsRealizationRepository.ts`:

- `getRoiCaseBenefitsRealizationView({ userId, organizationId, caseId })` —
  pure read (D11), visibility-gated via the same pattern
  `getRoiCaseCompareView` uses. Reads `rvn_roi_approval_snapshots` via
  `latestApprovedSnapshotId` and `rvn_roi_actual_snapshots` via
  `currentActualSnapshotId`.

```typescript
interface RoiCaseBenefitsRealizationView {
  caseId: string;
  benefitsRealizationPct: RoiCompareSlot;  // reuses roiCompareRepository.ts's type
  approvedFinancialBenefits: number | null;
  actualFinancialBenefits: number | null;
  asOfActualSnapshotId: string | null;
}
```

Reasons restricted to `'not_yet_approved' | 'no_actual_recorded'` (D12) —
approved-missing checked first, then actual-missing.

**New** `roiOrgPerspectiveRepository.ts` (D15/D16, mirrors
`kpiPerspectivesRepository.ts`'s `listOrganizationKpiAttention`/
`buildScopedKpisBase` shape exactly):

- `buildScopedRoiCasesBase(managerId, organizationId)` — same
  `chain_members`/`scoped_cases` CTE pattern, `resource_type='roi_case'`.
- `listOrganizationRoiBenefitsRealization({ managerId, organizationId })` →

```typescript
interface OrganizationRoiBenefitsRealization {
  cases: Array<{
    caseId: string;
    initiativeId: string;
    title: string;
    status: RoiCaseStatus;
    approvedFinancialBenefits: number | null;
    actualFinancialBenefits: number | null;
    benefitsRealizationPct: number | null;  // null when either side missing — per-row detail via the single-case view
  }>;
  portfolioTotals: {
    totalApprovedFinancialBenefits: number;
    totalActualFinancialBenefits: number;
    caseCountWithActual: number;
    caseCountTotal: number;
  };
}
```

Scoped to cases with `status IN ROI_TRACKING_ACTIVE_STATUSES`, chain-scoped
on `owner_user_id`, visibility-scoped via the standard `rvn_visible_resources`
join — reads only `rvn_roi_cases`/`rvn_roi_approval_snapshots`/
`rvn_roi_actual_snapshots`, never a legacy table (the literal mechanism
satisfying AC-05).

---

## 3. Visibility

Confirmed (D16): every read inherits visibility via the existing
`case_id`→`resource_type='roi_case'` chain. No new `resource_type`. The
org-perspective rollup adds a management-chain scope on top, not instead of,
per-case visibility — identical two-layer shape to `kpiPerspectivesRepository.ts`.

---

## 4. API surface

**Changed** `server/src/routes/resultsVnext/roi.routes.ts`:

| Method | Path | Command/Repository |
|---|---|---|
| `POST` | `/cases/:caseId/transitions/start-benefits-realization` | `startRoiCaseBenefitsRealization` |
| `POST` | `/cases/:caseId/transitions/cancel` | `cancelRoiCase` (dedicated schema requiring `reason`) |
| `GET` | `/cases/:caseId/benefits-realization` | `getRoiCaseBenefitsRealizationView` |

**New** `server/src/routes/resultsVnext/roiPerspectives.routes.ts` (mirrors
`kpiPerspectives.routes.ts`'s dedicated-router pattern):

| Method | Path | Command/Repository |
|---|---|---|
| `GET` | `/org/benefits-realization` | `listOrganizationRoiBenefitsRealization` (`managerId` = `auth.userId`, server-derived, never client-supplied) |

Mounted at the same `/api/vnext/results/roi` prefix in `Gateway.ts`.
**Mount-order check required at implementation time**: verify
`/org/benefits-realization` doesn't collide with any `/cases/:caseId/...`
pattern against the literal current route table before shipping — expected
to be safe (no bare dynamic top-level segment in `roi.routes.ts` today) but
confirm, don't assume.

New validator: `RoiCaseCancellationSchema = RoiCaseTransitionSchema.extend({
reason: <required string field> })`, added to
`resultsVnextRoiForecastActual.validators.ts`. `startRoiCaseBenefitsRealization`
reuses the existing `RoiCaseTransitionSchema` unchanged.

**Changed** `atomicWrite.ts` — new event types: `roi.benefits_realization_started`
→ `['mywork_projection','finance_projection']`, `roi.case_cancelled` →
`['mywork_projection','finance_projection']`.

No new error classes (D17). No new migration (D18).

---

## 5. File list (backend only)

**New:**
- `server/src/services/resultsVnext/roi/roiBenefitsRealizationCommands.ts`
- `server/src/services/resultsVnext/roi/roiBenefitsRealizationRepository.ts`
- `server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.ts`
- `server/src/routes/resultsVnext/roiPerspectives.routes.ts`
- `tests/resultsVnext/roi/roiBenefitsRealizationTransition.realdb.test.ts` — the transition guard, obligation creation, and the AC-01 proof: transition succeeds/fails purely on the Case's own status, independent of the linked legacy `initiatives.status` (test both an Initiative left `'active'` and one already `'done'` — identical behavior either way).
- `tests/resultsVnext/roi/roiCaseCancellation.realdb.test.ts` — guard scope, mandatory `reason`, and the AC-04 proof: create Actual entries + publish a snapshot, cancel the case, assert every actual row is byte-unchanged after cancellation.
- `tests/resultsVnext/roi/roiObligationsSurviveInitiativeClosure.realdb.test.ts` — the AC-02 proof: create a case (→`start_roi_study`), start tracking (→`track_roi_forecast_actuals`), start benefits realization (→`confirm_benefits_realization`), then drive the LINKED legacy Initiative through `initiativeClosureService`'s real closure workflow to `'done'`, then assert all three obligations remain `status='open'`.
- `tests/resultsVnext/roi/roiBenefitsRealizationView.realdb.test.ts` — the 2-reason typed-slot behavior and the exact formula against known Approved/Actual values.
- `tests/resultsVnext/roi/roiOrgBenefitsRealizationPerspective.realdb.test.ts` — management-chain scoping + visibility, and confirmation that legacy tables are never referenced by the generated SQL.
- `server/src/routes/resultsVnext/__tests__/roiBenefitsRealization.routes.test.ts`

**Changed:**
- `server/src/routes/resultsVnext/roi.routes.ts` — 3 new routes.
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — 2 new event types.
- `server/src/validators/resultsVnextRoiForecastActual.validators.ts` — `RoiCaseCancellationSchema`.
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entries, explicit backlog notes for: cancellation from pre-tracking statuses (D7, deferred), obligations not auto-cancelled on case cancellation (D9, deferred), cost/ROI-realization variants beyond financial-benefits realization (D13, deferred), and a note for whoever designs ROI-E006 confirming the `benefits_realization`→`post_investment_review_due` and final `→closed` transitions remain E006's job, not built here.

**Read-only reference:** `roiCaseCommands.ts`, `roiTrackingCommands.ts`,
`roiCompareRepository.ts` (`RoiCompareSlot` type reused), `roiApprovalSnapshotTypes.ts`,
`roiForecastActualTypes.ts`, `platform/obligations.ts`,
`kpi/kpiPerspectivesRepository.ts` (org-perspective template),
`kpiPerspectives.routes.ts` (dedicated-router template),
`server/src/services/initiative/initiativeClosureService.ts` (AC-02's proof target).

---

## 6. Definition of done

- [ ] `startRoiCaseBenefitsRealization`/`cancelRoiCase` both work against real prior E001-E004 data
- [ ] AC-01 proven: transition outcome identical regardless of linked Initiative's status
- [ ] AC-02 proven: obligations remain `'open'` after driving the linked Initiative through real legacy closure
- [ ] AC-03 proven: `benefitsRealizationPct` matches hand-computed `(actual/approved)*100`, `null` on zero-approved
- [ ] AC-04 proven: cancellation leaves every Actual row byte-unchanged
- [ ] AC-05 proven: org rollup scoped correctly, provably reads only `rvn_roi_*` tables
- [ ] Zero new migration file confirmed
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Full existing KPI + ROI-E001-E004 test suite still green — before/after evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` ROI-E005 rows updated + backlog notes per §5
