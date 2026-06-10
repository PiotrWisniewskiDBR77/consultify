# Module 08 — Finanse — Readiness Scorecard

**Readiness: 42/100 — Tier: Alpha**
**Route(s):** `/finance` (alias `/economics`), `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id`; billing at `/billing/*`
**One-line verdict:** The core finance analytics domain (statements/models/analysis/valuation) has real backend wiring via two parallel route stacks (legacy `/api/economics` + V8 `/api/v8/finance`), but ~35 billing/analytics endpoints silently serve HTTP 503 "schema unavailable", AddCardModal generates fake `pm_TIMESTAMP_mock` payment method IDs instead of using Stripe Elements, and model summary columns (variants, depth, forecast window) are entirely hardcoded strings — making the billing sub-module non-functional and the finance display layer partially cosmetic.

## What's REAL (verified + backend-wired)

- `server/src/routes/v8/finance.routes.ts:237` — `GET /api/v8/finance/dashboard` hits `financeIntegrationService.getFinanceDashboard`; 46 route handlers across statements, models, analyses, valuations, budgets, lane, versions.
- `server/src/routes/economics.routes.ts:68` — `GET /api/economics/analyses` queries DB; 61 route handlers for analyses, budgets, valuations, financial-analyses, ROI, initiative proposals.
- `server/src/routes/financial-modeling.routes.ts:1-502` — full CRUD for models, events, compute, approve, validations, outputs wired to `financialModelingService`.
- `server/src/routes/finance-enterprise.routes.ts:38` — V4 enterprise routes (versioning, compare, rolling forecast, connectors, valuation audit, ROI links) wired to `financeEnterpriseService`.
- `src/components/Economics/hooks/useFinanceData.ts:54-166` — V8-first loader with legacy fallback; no demo data arrays (comment: "Dead demo data arrays removed — D1 cleanup"); real API calls confirmed.
- `server/src/services/billing/BillingCommandService.ts:249` — Stripe customer create/retrieve via real `stripe` SDK, controlled by `STRIPE_SECRET_KEY` env.
- `server/src/routes/billing/billing.routes.ts:2698` — `/billing/setup-intent` conditionally calls `stripe.setupIntents.create` when `STRIPE_SECRET_KEY` is set.
- `server/src/services/billing/billingSandboxGuard.ts` — proper sandbox guard for QA flows.
- `server/src/services/billing/__tests__/` — 3 unit test files for BillingCommandService, BillingQueryService, BillingDependencyLoader; integration tests in `tests/integration/billing-api.test.ts` and `tests/e2e/billing.spec.ts`.

## What's MOCK / hardcoded / stub

- `src/components/billing/AddCardModal.tsx:95` — `const mockPaymentMethodId = 'pm_${Date.now()}_mock'` submitted to backend instead of Stripe.js `confirmSetup()`. Comment: "In production, this would be stripe.confirmSetup()".
- `src/components/Economics/hooks/useFinanceData.ts:355-356` — model list renders `variantLabel: 'base / optimistic / conservative'` and `analyticalDepthLabel: 'L1-L3'` as hardcoded display strings, regardless of actual DB data.
- `src/components/Economics/hooks/useFinanceData.ts:354` — `forecastWindowLabel` derived only from `start_date` year +2, not actual forecast horizon or named scenarios.
- `server/migrations/223_billing_mock_seed.sql` — seeds `plan-mock-basic`, `plan-mock-pro`, `sub-mock-001` into production tables; migration name signals intent but runs in DB.
- `server/src/routes/billing/billing.routes.ts:72-78` — `respondSchemaUnavailable` returns HTTP 503 `not_configured` when DB tables missing; used at 35 call sites across analytics and advanced billing features.

## What's BROKEN / NO_GO / missing

- **Payment card add flow is entirely fake**: `AddCardModal.tsx:95` always submits `pm_TIMESTAMP_mock` — no real Stripe Elements integration exists. Any card added by a customer is meaningless.
- **~35 billing analytics and advanced endpoints silently return 503**: MRR trend analytics (`:461`), churn analytics (`:557`), cohort analytics (`:669`), expansion analytics (`:746`), admin plan CRUD (`:774-924`), user seat plans (`:936-963`), billing transactions (`:971`), usage tracking (`:3020`), tax settings (`:3361`/`:3416`), VAT validation (`:3530`), revenue forecasts (`:4235`/`:4287`), subscription changes (`:4503`/`:4551`), revenue recognition (`:4665`/`:4710`), usage pricing tiers (`:4995-5181`) — all hit `respondSchemaUnavailable` on schema/table errors.
- **Duplicate billing route stacks**: `server/src/routes/billing.routes.ts` (1497 lines) and `server/src/routes/billing/billing.routes.ts` (5188 lines) both exist; unclear which is mounted in production — overlap risk.
- **No FinanceHub/EconomicsView UI tests**: confirmed by docs `STATUS.md:18` and verified — no test file under `src/components/Economics/` or `src/views/`.
- **V8 feature flag fallback coupling**: `useFinanceData.ts:6` falls back to legacy routes on 400/404/405/501; if V8 route responds 400 for malformed org context, data silently drops.

## Backend wiring

Finance analytics domain (V8 + legacy): real — `GET /api/v8/finance/*` (46 handlers) and `GET /api/economics/*` (61 handlers) read from SQLite DB.  
Billing subscription/invoice/plan core (non-Stripe): real — direct DB queries in `billing.routes.ts` and `billing/billing.routes.ts`.  
Billing Stripe integration: conditional on `STRIPE_SECRET_KEY` env; absent in repo's `.env.example` (file has 0 Stripe references). AddCardModal bypasses Stripe entirely with a mock PM ID.  
Advanced billing analytics (MRR trends, churn, cohort, revenue recognition, usage tiers): **broken/missing** — 35 endpoints return 503 when tables absent.

## UI/UX consistency

FinanceHub follows Golden Standard Table+Cards+Preview V3 (KANON v3) — `ModuleHub`, `TableWithPreviewLayout`, `FilterableTable`, `GridView`, tab pill counters. Consistent with approved shell.  
Billing components (`SubscriptionManager`, `CreditNotesPanel`, `TaxSettingsPanel`, `UsageMeters`) use their own bespoke layouts with no shared shell — diverge from Finance module's Golden Standard.

## Tests

Billing services: 3 unit test files (151 lines total, shallow coverage — only `createPlan` and `upsertOrgBilling`). Integration: `tests/integration/billing-api.test.ts`. E2E: `tests/e2e/billing.spec.ts`. Security boundary: `tests/security/billing/billing-auth-boundaries.test.ts`.  
Finance module (FinanceHub, EconomicsView, hooks): **zero tests**. Confirmed by `STATUS.md` and directory check.

## Doc-vs-code drift

`STATUS.md` claims `finance detail routes` are `real` — confirmed correct.  
`STATUS.md` says V8 mode has "legacy fallback toggles" — confirmed in `useFinanceData.ts` and `FinanceHub.tsx`.  
`CODEMAP.md` cites `financeTypes.ts` as runtime model definitions — confirmed.  
**Drift**: docs do not mention the mock payment method problem in AddCardModal, the 35 503-returning billing endpoints, the hardcoded `variantLabel`/`analyticalDepthLabel`, or the duplicate billing route file. All are post-May code reality.

## Top gaps to reach market-ready (prioritized)

1. **Replace AddCardModal mock with real Stripe.js Elements** — `src/components/billing/AddCardModal.tsx:78-97`. Without this, no customer can add a real payment method. Requires `@stripe/react-stripe-js` + `STRIPE_SECRET_KEY` env.
2. **Resolve the 35 `respondSchemaUnavailable` endpoints in billing** — audit which tables are missing and add migrations or remove endpoints; MRR/churn/cohort analytics are not optional for a billing module.
3. **Reconcile duplicate billing route files** — clarify which of `billing.routes.ts` (1497 ln) vs `billing/billing.routes.ts` (5188 ln) is mounted in `Gateway.ts` and delete the dead one.
4. **Replace hardcoded model summary strings** — `useFinanceData.ts:355-356`: `variantLabel` and `analyticalDepthLabel` must read actual model `scenario`, `horizon_months`, and event counts from DB.
5. **Add STRIPE_SECRET_KEY to `.env.example`** and document `MOCK_BILLING=true` for local dev; currently neither appears in repo env templates — onboarding gap.
6. **Add Finance module tests** — FinanceHub tab navigation, V8/legacy fallback, statement row normalization, filter logic. Zero coverage today is a critical gap for billing-sensitive data.
