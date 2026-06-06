# DEEP RE-VERIFICATION — Module 08 Finanse (financial modeling + billing)
**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Method:** end-to-end UI→route→DB/Stripe trace, no builds
**Prior split score:** 72 (modeling) / 62 (billing)

---

## 1. Per-feature verification (WORKS / PARTIAL / MOCK / BROKEN)

| Feature | Status | Evidence (file:line) | Notes |
|---|---|---|---|
| **Financial model build (create)** | **WORKS** | `financial-modeling.routes.ts:60,102` → `financialModelingService.ts:1016 createModel`; mounted `Gateway.ts:945` (`/api/financial-modeling`) | Real DB insert into `financial_models`. |
| **Model edit / events** | **WORKS** | `financial-modeling.routes.ts:217 updateModel`, `:352,395 addEvent` → service `:1128,1200` | Full CRUD on model + `financial_model_events`. |
| **Scenario calc (compute engine)** | **WORKS (real math)** | `financialModelingService.ts:643 computeModel`; persisted `:927 persistComputeResult` w/ scenario (`financial-modeling.routes.ts:280`) | Double-entry P&L/BS/CF, running balances `:684-693`, event expansion `:713-715`, baseline % extrapolation `:697-744`. NOT mock. |
| **Consistency checks (3-way)** | **WORKS** | `financialModelingService.ts:865 BS_EQUATION`, `:882 CASH_TIEOUT`, `:898 CASH_BS_CF_MATCH` | Assets=L+E, ΔCash tie-out, BS↔CF recon. Real. |
| **Scenario param threading** | **WORKS** | persist `:280` uses `model.scenario`; getOutputs scenario filter `financial-modeling.routes.ts:463`, service `:1320` | Per-scenario output rows. |
| **Statements/Models/Analyses load (V8-first)** | **WORKS** | `useFinanceData.ts:63,92,118` `V8FinanceApi.get*` w/ legacy fallback | V8 lane real. |
| **Valuations tab load** | **PARTIAL** | `useFinanceData.ts:140-155` — legacy-only `GET /api/economics/valuations`, **no V8 path** | Silently empties if legacy deprecated. Compute exists `economics.routes.ts:1905 /valuations/:id/compute`. |
| **Budgets tab load** | **PARTIAL** | `useFinanceData.ts:157-172` — legacy-only `GET /api/economics/budgets`, no V8 path | Same risk. |
| **AI-assist: business-case** | **MOCK** | `economics.routes.ts:1165-1216` returns `data:text/plain` template `:1198-1210`; no AI/Teresa call | Reads real `analysis_financials` (npv/irr/roi/payback `:1189`) but emits a static `.txt` stub. "Reasoning engine" vision unmet. |
| **AI-assist: live preview / valuation compute** | **WORKS** | `economics.routes.ts:1709 computeLivePreview`, `:1910 computeValuation` | Real service calls. |
| **Teresa prelude builder** | **PARTIAL/DEAD** | `financeModelLabels.ts:55-66 buildFinanceTeresaPrompt` | Static i18n string; injects NO live model values (NPV/payback/scenario). |
| **Teresa chat handoff** | **PARTIAL (prompt dropped)** | `FinanceHub.tsx:244-256` passes `teresaPrompt` inside `contextData`; `useOpenChatWithContext.ts:122-127` stores it as `entityData` — **nothing reads `teresaPrompt`** (grep: only producers, no consumer) | Chat opens with entity context, but the built prompt is never sent/displayed. Opener is dead. |
| **Billing self-serve gating** | **WORKS (honest)** | `AddCardModal.tsx:41,78` flag-off shows manual-contact panel; `:128` "Stripe connected but card form not available" | No fake payments surfaced. |
| **Stripe subscription create** | **MOCK when Stripe absent** | `BillingCommandService.ts:440-448` writes `billing_rail='stripe_subscription'` + `mock_sub_${orgId}` to DB | Junk sub ID persisted. Real path `:485-514` is correct when `deps.stripe` present. |
| **createSetupIntent** | **MOCK when Stripe absent** | `BillingCommandService.ts:1196-1203` returns `mock_seti_*`/`mock_secret_*` | |
| **processSeatPurchase** | **MOCK (fake success)** | `BillingCommandService.ts:1390-1409` always `success:true`, **no charge ever** | Even with Stripe present — no PaymentIntent. |
| **Partner discount → Stripe coupon** | **WORKS** | getter `BillingCommandService.ts:391-419` (reads `organization_discounts`); applied `:461-491` (`stripe.coupons.create` + `discounts:[{coupon}]`) | Real coupon path. Prior cite 462-490 → now 461-491. |
| **Manual invoices / admin billing** | **WORKS** | `billingAdmin.routes.ts` `billing_ops` RBAC; `BillingCommandService.ts:436,522` manual_invoice override guards | Real DB + audit. |
| **Subscription analytics (MRR/churn/LTV)** | **WORKS — prior audit WRONG** | client `SubscriptionAnalytics.tsx:154-159 /revenue/analytics/*`; server **mounted** `Gateway.ts:639 /api/revenue` → `revenue.routes.ts:857-1089` real DB queries | See Correction below. |
| **ltvToCac metric** | **MOCK** | `billing/billing.routes.ts:597 ltvToCac:'5.2:1'` hardcoded | Placeholder (this is the legacy `/api/billing` route, separate from `/revenue`). |
| **billing.routes type safety** | **RISK** | `billing/billing.routes.ts:1 @ts-nocheck` over 5,188 lines | Type errors hidden. |

### Correction to prior dossier (P0-2 is INVALID)
Prior dossier P0-2 / §4 claimed every analytics call 404s because client uses `/revenue/` and "server mounts `/billing/analytics`". **This is wrong.** A dedicated `revenue.routes.ts` IS mounted at `/api/revenue` (`Gateway.ts:639`) and serves `/analytics/mrr,mrr/trend,churn,ltv,cohorts,expansion` (`revenue.routes.ts:857,921,982,1030,1073,1089`) with real DB-backed responses shaped for `SubscriptionAnalytics`. The `/api/billing/analytics/*` handlers are a *parallel* legacy surface. Client→server path for analytics is **CONNECTED**, not broken. Downgrade P0-2 to non-issue (optionally: dedupe the two analytics surfaces).

---

## 2. Four Lenses

### Lens 1 — Functionalities verified
Modeling core (build/edit/event/compute/scenario/consistency) is genuinely real and end-to-end via `/api/financial-modeling`. Valuation/budget tabs are legacy-only (degradation risk). Billing is honestly flag-gated; three server mocks (`mock_sub`, `mock_seti`, fake seat purchase) remain. Business-case "AI" output is a text stub.

### Lens 2 — Cross-module flow
- **Finance ⇐ Results/Initiatives:** Initiatives→Finance deep-link real (`FinanceHub.tsx:719` `initiativeName` prefill); `analysis_financials`/initiative financials aggregated in AI context (`aiContextBuilder.ts:1387-1477`). Initiative-link panels call `/api/initiatives/*`. **CONNECTED.**
- **Finance ⇒ Outputs(09):** `ExportToOutputDialog` (`FinanceHub.tsx:2362`) routes to `/reports/builder/`. WORKS, but `relatedInitiativeIds` prop still not passed at callsite → initiative traceability dropped on export (P0, still valid).
- **Billing ⇒ Admin(17) limits:** plan/limit enforcement via `subscription_plans` (`token_limit`, `storage_limit_gb`) + admin guardrails (`billingAdmin.routes.ts`, `changePlanWithGuardrails`). **CONNECTED.**
- **Billing ⇐ Partner(19) attribution:** `organization_discounts` written by Partner path (`partner-code.routes.ts:171`, `partnerConfigService.ts:357`, `auth.routes.ts:1691`); consumed by `getPartnerDiscount` → Stripe coupon. **CONNECTED end-to-end.**

### Lens 3 — Teresa wiring real or dead
**Mostly DEAD at the seam.** `buildFinanceTeresaPrompt` is invoked (`FinanceHub.tsx:244,1533,2058`) and `openChatWithContext` truly opens the chat panel with workspace/pmo context (`useOpenChatWithContext.ts:109-127`) — but the `teresaPrompt` string is stuffed into `contextData` and **no consumer reads it** (verified: grep finds only producers). So: chat opens with entity context = real; the crafted finance opener is never sent or shown. Plus the prompt carries no live model values. Net: PARTIAL — context handoff works, the finance-specific AI prompt is a no-op.

### Lens 4 — Contextual memory (org financial context)
The model AI *does* build org financial context: `aiContextBuilder.ts:1387-1477` aggregates capex/opex/avg ROI from `analysis_financials`, statement-pack + model-version counts, and injects `financialData` into context (`:213,318`). **BUT** `filterContextByPolicy` (`contextGovernance.ts:109,129-131`) `delete`s `filtered.financialData` whenever `ORG_FINANCIAL_SUMMARY` is not allowed — and its **DEFAULT is `false`** (`contextGovernance.ts:38`). So unless an org admin opts in via `organization_ai_settings.context_policy_json`, **Teresa never sees org financials by default.** The pipeline is fully built but governance-disabled out of the box. (Surfaced in admin UI `AIGovernanceTab.tsx:41,280`.)

---

## 3. P0 / P1 / P2 (file:line)

### P0 — Correctness blockers
| ID | Gap | File:line |
|---|---|---|
| P0-1 | `relatedInitiativeIds` prop never passed to export — initiative trace dropped | `FinanceHub.tsx:2362` |
| P0-2 | `mock_sub_${orgId}` persisted to DB w/ `billing_rail='stripe_subscription'` when Stripe absent → throw `BillingNotAvailableError` instead | `BillingCommandService.ts:440-448` |
| P0-3 | `createSetupIntent` returns `mock_seti_*` when Stripe absent | `BillingCommandService.ts:1196-1203` |
| P0-4 | `processSeatPurchase` always `success:true`, no charge (even with Stripe) → throw NotImplemented | `BillingCommandService.ts:1390-1409` |
| P0-5 | `@ts-nocheck` on 5,188-line billing routes | `billing/billing.routes.ts:1` |
| ~~P0(old-2)~~ | **INVALID** — analytics path is connected via `revenue.routes.ts` mounted at `/api/revenue` | `Gateway.ts:639`, `revenue.routes.ts:857` |

### P1 — Quality
| ID | Gap | File:line |
|---|---|---|
| P1-1 | Teresa `teresaPrompt` is dead — nothing consumes `contextData.teresaPrompt`; wire it into initial message dispatch | `FinanceHub.tsx:244-256`, `useOpenChatWithContext.ts:122-127` |
| P1-2 | Inject live model values (NPV/payback/scenario/horizon) into prelude | `financeModelLabels.ts:55-66` |
| P1-3 | Business-case endpoint is `.txt` stub, no AI narrative | `economics.routes.ts:1165-1216` |
| P1-4 | Default `ORG_FINANCIAL_SUMMARY=false` strips org financials from AI context — confirm intended; document opt-in | `contextGovernance.ts:38,129-131` |
| P1-5 | Valuations: legacy-only fetch, no V8 path | `useFinanceData.ts:140-155` |
| P1-6 | Budgets: legacy-only fetch, no V8 path | `useFinanceData.ts:157-172` |
| P1-7 | `ltvToCac:'5.2:1'` hardcoded | `billing/billing.routes.ts:597` |
| P1-8 | `FinanceModelDocumentView` silent `isEstimated=true` on empty outputs | `FinanceModelDocumentView.tsx:39` |

### P2 — Coverage / polish
| ID | Gap | File:line |
|---|---|---|
| P2-1 | Dedupe parallel analytics surfaces (`/revenue/analytics/*` vs `/billing/analytics/*`) | `revenue.routes.ts` vs `billing/billing.routes.ts:319` |
| P2-2 | Seed Atelier `financial_models` row (modeling tab empty for demo) | `seed-demo-dataset-contract.ts` |
| P2-3 | FinanceHub integration tests (tab switch, V8/legacy toggle, export trigger) | `src/components/Economics/__tests__/` |
| P2-4 | Initiative-proposal flow for `financial_model` source type | `ExportToOutputDialog.tsx` |

---

## 4. Score (re-verified)
- **08b Financial Modeling: 74/100** (+2 vs prior 72) — engine confirmed genuinely real (compute + 3-way checks + scenario), CRUD wired via `/api/financial-modeling`. Held back by: dead Teresa prompt seam, value-free prelude, business-case stub, legacy-only valuation/budget, governance-stripped financial context, empty demo seed.
- **08 Billing: 65/100** (+3 vs prior 62) — analytics path correction removes a false P0; partner-discount→Stripe coupon and manual-invoice admin paths confirmed real end-to-end. Held back by three Stripe-absent mock returns (sub/setup-intent/seat), `@ts-nocheck`, hardcoded `ltvToCac`.
