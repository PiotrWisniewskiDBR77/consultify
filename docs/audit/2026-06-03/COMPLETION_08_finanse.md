# COMPLETION DOSSIER — Module 08 Finanse / Finance
**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Auditor:** agent

---

## 1. Purpose / Vision

**Goal:** Finance intelligence engine — a reasoning and advisory tool for consultants.  
Full loop: `statement ingestion → normalisation → model → analysis → forecast → valuation → investment decision → report → audit trail → Results/ROI linkage`.  
**Billing** is a parallel sub-domain (D8: fast-follow, Stripe-gated, not GA).  
Source: `docs/modules/08_finanse/01_PURPOSE.md`, `RAW_TARGET_STATE_2_0_PACKET.md §3`.

---

## 2. Readiness Score (honest)

| Sub-module | Score | Delta from baseline |
|---|---|---|
| **08b Financial Modeling** (consulting tool) | **72 / 100** | +30 vs Jun-02 baseline of 42 |
| **08 Billing** (platform billing) | **62 / 100** | +20 vs Jun-02 baseline |

### 2a — Financial Modeling gaps to 100%

**Real / working:**
- P&L/BS/CF engine with 3 consistency checks, real DB (`financialModelingService.ts`)
- V8-first fetch with legacy fallback (`useFinanceData.ts:88-112`)
- Label derivation from live DB fields — `deriveForecastWindowLabel`, `deriveVariantLabel`, `deriveAnalyticalDepthLabel` (`financeModelLabels.ts:17-66`)
- 6-tab hub (statements / models / analysis / prediction / valuation / investment), `FinanceHub.tsx:2119`
- Finance → Outputs export (`ExportToOutputDialog` at `FinanceHub.tsx:2362`, routes to `/reports/builder/`)
- Finance → Initiatives deep-link (`InitiativeLinkingPanel`, `InitiativeFinancialIntegration`)
- Teresa prelude shipped — `buildFinanceTeresaPrompt` (`financeModelLabels.ts:55-66`)

**Gaps:**
- `ExportToOutputDialog` at `FinanceHub.tsx:2362` — `relatedInitiativeIds` prop never passed; initiative traceability silently dropped on every export
- `loadValuations` (`useFinanceData.ts:140`) and `loadBudgets` (line 157) have **no V8 path** — always call legacy `/api/economics/valuations|budgets`; if legacy is deprecated these tabs silently empty
- Business-case endpoint `POST /api/economics/analyses/:id/business-case` (`economics.routes.ts:1166`) returns a plain-text `data:` URL with hardcoded template strings — no AI narrative, no Teresa call (`economics.routes.ts:1198-1215`)
- `FinanceModelDocumentView.tsx:39` sets `isEstimated=true` silently when outputs are empty; no user-visible warning
- `loadError` goes only to `FinanceDegradedBanner` via V8 lane path; non-V8 users see blank table on failure (`useFinanceData.ts` error paths)
- No `financial_models` rows in Atelier demo seed (`seed-demo-dataset-contract.ts:8`) — modeling tab empty for demo org
- Zero automated tests for `FinanceHub` tab orchestration, V8/legacy toggle, export flow (only `financeModelLabels.test.ts` + `useFinanceData.test.tsx` exist)

### 2b — Billing gaps to 100% (Stripe-gated)

**Honest/working:**
- `isBillingSelfServeEnabled()` default OFF gates `AddCardModal` + `SubscriptionAnalytics`; manual-billing contact shown (`AddCardModal.tsx:37`)
- All 35+ analytics surfaces cleanly gated — no user-visible 503
- Admin: `changePlanWithGuardrails`, `grantGracePeriod`, `upsertManualContract` — real DB + audit log + `billing_ops` RBAC (`billingAdmin.routes.ts`)

**Residual problems (flag-off hides blast radius today):**
- `billing.routes.ts:1` — `@ts-nocheck` on entire 5,188-line file; typing errors silently hidden
- `SubscriptionAnalytics.tsx:154-159` calls `/revenue/analytics/mrr|churn|ltv|cohorts|expansion`; server mounts at `/billing/analytics/mrr` (`billing.routes.ts:319`). Every analytics call will 404 when self-serve flag flips ON
- `BillingCommandService.ts:448` — `mock_sub_${orgId}` written to DB when Stripe absent; org gets `billing_rail='stripe_subscription'` with junk sub ID
- `BillingCommandService.ts:1196-1202` — `createSetupIntent` returns `mock_seti_*` when `!deps.stripe`
- `BillingCommandService.ts:1390-1409` — `processSeatPurchase` always returns `success:true`, no charge
- `billing.routes.ts:597` — `ltvToCac: '5.2:1'` hardcoded placeholder

---

## 3. Teresa Integration — Depth + Missing

**Shipped:**
- `buildFinanceTeresaPrompt` (`financeModelLabels.ts:55-66`) forks `models`/`prediction` tabs into an NPV/ROI/payback business-case prompt; all other tabs get generic financial-deliverable prompt
- Wired at per-row chat (`FinanceHub.tsx:244`), hub-level AI button (`FinanceHub.tsx:1533`), and models empty-state (`FinanceHub.tsx:2058`)

**Missing:**
- Teresa prompt is a static string — it does **not** inject actual model values (NPV, payback, scenario name, horizon) into the prelude; consultant gets a generic ask, not a context-aware opener
- `BusinessCaseGenerator.tsx:111` calls `Api.generateBusinessCase` → `economics.routes.ts:1166` — this endpoint returns a plain `.txt` template; **no AI narrative is generated, no Teresa call exists in that route**. The business-case document is a data stub, not a reasoning output
- `AIRecommendationsPanel.tsx` contains no Teresa/AI call integration; it is a display panel only
- No streaming — finance AI interactions are one-shot; no progressive narrative reveal

---

## 4. System Integration

| Handoff | State | File:line |
|---|---|---|
| Finance → Outputs export | Working | `FinanceHub.tsx:2362`, routes to `/reports/builder/` |
| Finance → Initiatives link | Working | `InitiativeLinkingPanel.tsx`, `InitiativeFinancialIntegration.tsx` call `/api/initiatives/*` |
| Export `relatedInitiativeIds` | **BROKEN** — prop not passed | `FinanceHub.tsx:2362` (missing prop) vs `ExportToOutputDialog.tsx:24` (prop exists) |
| Initiatives → Finance deep-link | Working | `FinanceHub.tsx:719` URL param `initiativeName` pre-fills |
| Admin manual billing | Working | `billingAdmin.routes.ts` `billing_ops` guard |
| Analytics client → server path | **BROKEN** — wrong prefix | `SubscriptionAnalytics.tsx:154` `/revenue/analytics/` vs server `/billing/analytics/` |

---

## 5. Completion Plan to 100%

### P0 — Correctness blockers (must close before GA)

| ID | Gap | File:line | Effort |
|---|---|---|---|
| P0-1 | Pass `relatedInitiativeIds` to `ExportToOutputDialog` — initiative trace silently dropped | `FinanceHub.tsx:2362` | 1h |
| P0-2 | Fix `SubscriptionAnalytics` API prefix `/revenue/` → `/billing/` (6 paths) | `SubscriptionAnalytics.tsx:154-159` | 30m |
| P0-3 | Replace `mock_sub_*` / `mock_seti_*` server returns with `BillingNotAvailableError` when Stripe absent | `BillingCommandService.ts:448,1201` | 2h |
| P0-4 | Stub `processSeatPurchase` to throw `NotImplementedError` until Stripe seat purchasing is real | `BillingCommandService.ts:1390-1409` | 1h |
| P0-5 | Remove `@ts-nocheck` from `billing.routes.ts:1` and fix resulting type errors | `billing.routes.ts:1` | 4h |

### P1 — Quality gaps (needed for production confidence)

| ID | Gap | File:line | Effort |
|---|---|---|---|
| P1-1 | Inject actual model values (NPV, payback, scenario, horizon) into `buildFinanceTeresaPrompt` | `financeModelLabels.ts:55-66`, `FinanceHub.tsx:244,1533` | 2h |
| P1-2 | Replace business-case stub with real Teresa-streamed narrative (`POST /economics/analyses/:id/business-case`) | `economics.routes.ts:1162-1217` | 1d |
| P1-3 | Add V8 fetch paths for `loadValuations` + `loadBudgets` (currently always legacy) | `useFinanceData.ts:140,157` | 3h |
| P1-4 | Show `isEstimated` warning inline in `FinanceModelDocumentView` when outputs are empty/estimated | `FinanceModelDocumentView.tsx:39` | 1h |
| P1-5 | Show inline `loadError` in table area (not just degraded banner) | `useFinanceData.ts` error paths + `FinanceHub.tsx` | 2h |
| P1-6 | Seed Atelier `financial_models` row in demo dataset | `seed-demo-dataset-contract.ts:8` | 1h |
| P1-7 | Remove `ltvToCac: '5.2:1'` hardcoded placeholder; compute from real data or omit | `billing.routes.ts:597` | 1h |

### P2 — Coverage + polish (path to 100%)

| ID | Gap | File:line | Effort |
|---|---|---|---|
| P2-1 | `FinanceHub` integration tests: tab switch, V8/legacy toggle, export-to-output trigger | `src/components/Economics/__tests__/` | 1d |
| P2-2 | Per-function test matrix (7 functions × P0/P1/P2 evidence) per `IMPLEMENTATION_TASK_BOARD.md` | `function-cards/*.md` | 2d |
| P2-3 | Initiative-proposal flow for `financial_model` source type in `ExportToOutputDialog` | `ExportToOutputDialog.tsx:138` | 3h |
| P2-4 | Billing UI components (`SubscriptionManager`, `UsageMeters`, `TaxSettingsPanel`) to use `ModuleHub` shell | `src/components/billing/*.tsx` | 4h |
| P2-5 | Connect Stripe (owner decision D8) — unblocks P0-3/4, `createSetupIntent`, `processSeatPurchase` | `BillingCommandService.ts` + Stripe key + webhook | Gated |

---

## 6. Owner-Decision Gates

- **Stripe activation (D8)** — required before P2-5, P0-3/4 can fully close. Everything else above is code-only and owner-independent.
- `ltvToCac` placeholder (P1-7) requires owner decision on whether CAC data sourcing is in scope for v1.

---

## Summary

**08b Financial Modeling: 72/100.** Core engine is real and GA-capable with two blocking fixes: pass `relatedInitiativeIds` at export callsite (P0-1) and inject live model values into Teresa prelude (P1-1). The business-case endpoint is a data stub with no AI narrative — the vision's "reasoning engine" is not met here. Valuation/budget tabs have no V8 migration and will silently degrade. Atelier demo is empty for modeling tab.

**08 Billing: 62/100.** Correctly honest-gated with no user-visible fake-payments. Three server-side mock returns (`mock_sub_*`, `mock_seti_*`, `processSeatPurchase` fake-success) plus a client→server API path mismatch will explode the moment the self-serve flag is toggled ON. Fix those five P0 items before enabling self-serve, regardless of Stripe timeline.
