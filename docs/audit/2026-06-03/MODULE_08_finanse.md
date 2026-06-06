# Module 08/08b — Finanse — Re-Audit (2026-06-03)

**Readiness: 08b modeling 68/100 · 08 billing 59/100 (baseline 42 → avg ~64, Δ +22)**
**One-line verdict:** Both sub-modules closed their critical P0 regressions — fake `pm_*_mock` card flow is dead, all 35+ analytics surfaces are cleanly gated (no user-visible 503), and model labels now derive from real DB fields — but `billing.routes.ts` retains `@ts-nocheck` line 1, `createSetupIntent` still returns `mock_seti_*` when Stripe is absent, `processSeatPurchase` always returns `success:true` without charging, and the analytics component calls `/revenue/analytics/*` paths that don't exist on the server (server serves `/analytics/*`).

## Functionality (real / honest-gated / mock / broken)

**08b — Financial Modeling (real):**
- Label derivation (`financeModelLabels.ts:17-66`) reads `scenario`, `horizon_months`, `event_count` from real DB fields — hardcoded-string P0 resolved (`useFinanceData.ts:357-388`).
- `financialModelingService.ts` — full P&L/BS/CF engine with 3 consistency checks (Assets=Liab+Eq, ΔCash=OCF+ICF+FCF, retained-earnings tie-out) wired to DB; real.
- Teresa AI prelude (`buildFinanceTeresaPrompt`) shipped; model/prediction vs generic fork correct.
- Cross-module: `ExportToOutputDialog` mounted in `FinanceHub.tsx:2352`; `InitiativeFinancialIntegration.tsx` + `InitiativeLinkingPanel.tsx` exist and call `/api/initiatives/*` — real.
- Atelier demo: no synthetic fallback injected (`FinanceHub.tsx:1965` comment explicitly confirms no demo data); `shouldAllowDemoData()` guard present in `useFinanceData.ts:49`.

**08 — Billing (honest-gated + residual mock risk):**
- `AddCardModal.tsx:1-173` — fake `pm_<timestamp>_mock` flow killed; `isBillingSelfServeEnabled()` flag (default OFF) gates the whole card-add surface; manual-billing honest panel shown (`billing@consultify.app` contact). No fake-success path exists at any flag value.
- `SubscriptionAnalytics.tsx:114` — analytics surface gated behind `isBillingSelfServeEnabled()` (default OFF); renders honest "coming soon" empty state — no 503 fired to users.
- `BillingCommandService.ts:1197-1199` — `createSetupIntent` still returns `{ clientSecret: 'mock_secret_*', id: 'mock_seti_*' }` when `!deps.stripe`. This is server-side; the client already gates the call — low immediate blast radius but not clean.
- `BillingCommandService.ts:1390-1409` — `processSeatPurchase` returns `{ success: true }` unconditionally; no charge occurs. Not exposed to regular users today but the route exists.
- `billing.routes.ts:597` — `ltvToCac: '5.2:1'` is a hardcoded placeholder when Stripe is absent; only visible when analytics flag is ON.
- Admin billing ops (`billingAdmin.routes.ts`): `changePlanWithGuardrails`, `grantGracePeriod`, `upsertManualContract` — real DB writes + audit log + `billing_ops` RBAC guard.

## Intra-module flow & states

08b: `useFinanceData` → V8-first fetch with legacy fallback → label derivation from real fields → `FinanceHub` renders Table+Preview+GridView. `FinanceDegradedBanner` collects `degradedAlerts` array and renders only when non-empty. Five tabs (Models/Analysis/Prediction/Valuation/Investment) wired; all drive the same hook with `activeTab` discriminator.

08: `isBillingSelfServeEnabled()` (query > localStorage > env > default-OFF) controls both `AddCardModal` and `SubscriptionAnalytics`. Manual-invoice path: org gets `billing_rail='manual_invoice'` + `is_manual_override=true` via `billingAdminOps.upsertManualContract`; `createSubscription` throws correctly when that flag is set. Grace-period / reactivation states (`canceling` → `active`) are real.

## UI/UX adherence

08b: FinanceHub follows Golden Standard V3 (KANON v3) — `ModuleHub`, `TableWithPreviewLayout`, `FilterableTable`, `GridView`, tab pill counters, crimson/navy theming (`bg-crimson-50 text-crimson-600`), `rounded-xl` throughout. Fully compliant.

08: `AddCardModal` uses `bg-crimson-50 text-crimson-600 dark:bg-crimson-500/10` accent, `rounded-xl` panels, `Modal` primitive. Billing components (`SubscriptionManager`, `UsageMeters`, `TaxSettingsPanel`) still use bespoke layouts without `ModuleHub` shell — gap vs Finance module but low priority given D8 deferral.

## Cross-module handoffs

- Finance → Outputs: `ExportToOutputDialog` (`FinanceHub.tsx:2352`) present and callable. Wire verified.
- Finance → Initiatives: `InitiativeLinkingPanel` + `InitiativeFinancialIntegration` call `/api/initiatives/` — real bidirectional link.
- Billing → Mod 17 (Admin): `billingAdmin.routes.ts` provides `POST /billing/admin/change-plan`, `POST /billing/admin/grace-period`, `POST /billing/admin/contract` — all guarded by `requireSuperAdminCapability('billing_ops')`. Mod 17 admin panel can call these; confirmed wired.

## Risks / regressions / runtime

1. **`billing.routes.ts:1` — `@ts-nocheck`** file-wide type suppression (5 189-line file). Typing errors silently hidden; this was flagged in the previous audit and remains unresolved.
2. **`SubscriptionAnalytics.tsx:154-159`** calls `/revenue/analytics/mrr`, `/revenue/analytics/churn` etc., but the server routes are mounted at `/billing/analytics/mrr` (see `billing.routes.ts:319`). When flag is ON, every request would 404. Dead code when flag OFF; becomes a bug the moment self-serve is enabled.
3. **`BillingCommandService.ts:448`** `mock_sub_*` returned when `!deps.stripe` and no `manual_invoice` override — the org gets written as `billing_rail='stripe_subscription'` with an obviously fake sub ID, potentially confusing admin queries.
4. **`processSeatPurchase` fake-success** (`BillingCommandService.ts:1390-1409`) — no charge, always returns `success:true`. Route exists in billing routes; should be disabled or throw until Stripe is live.
5. **`@ts-nocheck` + no test coverage on FinanceHub** — Economics component directory has `__tests__/financeModelLabels.test.ts` and `__tests__/useFinanceData.test.tsx` (new, good), but zero tests for `FinanceHub.tsx` tab navigation and cross-module Export flow.

## Top remaining gaps (note: live Stripe = intentionally deferred D8)

1. **Fix analytics API path mismatch** (`SubscriptionAnalytics.tsx:154-159`): calls `/revenue/analytics/*`; server routes are at `/billing/analytics/*`. Will 404 on Stripe go-live. Low effort fix; high blast radius when flag flips ON.
2. **Remove `@ts-nocheck` from `billing.routes.ts:1`** — 5 189-line file with zero type checking is an ongoing regression risk for the entire billing surface.
3. **Stub-out or gate `processSeatPurchase`** (`BillingCommandService.ts:1390-1409`) to throw `NotImplementedError` until Stripe seat purchasing is real.
4. **Clean up `mock_sub_*` / `mock_seti_*` server returns** — replace with `BillingNotAvailableError` so any accidental self-serve path (flag accidentally ON without Stripe keys) fails loudly rather than writing junk sub IDs to DB.
5. **Add `FinanceHub` integration tests** — tab switching, V8/legacy fallback, Export-to-Output trigger. `financeModelLabels.test.ts` now exists (good); hub orchestration still untested.
