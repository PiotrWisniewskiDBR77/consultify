# DEEP RE-VERIFICATION — Module 19 Portal Partnerski

**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Method:** code-verified, no builds
**Prior score:** 69/100 (COMPLETION_19) | **Confirmed score:** ~69/100, with material new findings on dead-code surface and live-path deprecation.

This pass re-verified every claim in `COMPLETION_19_portal-partnerski.md` through the stack. Most REAL claims hold. Several line numbers drifted (re-stated below). Three structural facts the prior dossier got **wrong or missed** are flagged with **[NEW]**.

---

## Lens 1 — Functionalities (feature-by-feature through the stack)

| Feature | Verdict | Evidence (file:line) |
|---|---|---|
| Registration / connect | **WORKS** | `partners.routes.ts:303` POST `/connect` — idempotent (re-uses existing org via `getActivePartnerOrgIdForUser:310`), else transactional INSERT into `partner_organizations` + `partner_users` (`:376–389`), then `ensurePartnerReferralIdentity:398` + `ensurePartnerDemoDataset:399`. Returns full org payload. Schema-missing guarded (`:392`). |
| Connection status (no-403) | **WORKS** | `partners.routes.ts:228` GET `/connection` returns `{connected:false}` instead of 403; loads specializations + regions. |
| Referral codes + links | **WORKS** | `partners.routes.ts:733` GET `/referral-tools` → `PartnerReferralService.getReferralTools`; fallback `normalizeReferralToolsForPartner:746` self-heals missing identity. |
| Campaign links (UTM) create/delete | **WORKS** | `partners.routes.ts:761` POST `/campaign-links` (validates name, persists), `:795` DELETE with 404-on-miss. |
| Click analytics | **WORKS** | `partners.routes.ts:821` GET `/referral-analytics` → `PartnerReferralService.getReferralAnalytics(orgId, days)`; graceful fallback to zeroed analytics on DB error (`:830`). |
| Attributions | **WORKS** | `partners.routes.ts:853` GET `/attributions`; V8 mirror `v8/partner.routes.ts:689`. |
| Earnings / statements | **WORKS** | `partners.routes.ts:888` GET `/earnings`, `:921` `/commission-transactions`; V8 `/earnings-summary` (`v8/partner.routes.ts:724`). |
| Payouts request + history | **WORKS** | `partners.routes.ts:959` POST `/payouts/request` → `PartnerCommissionService.requestPayout`; guards "no approved commissions / below threshold" → 400 (`:976`). History `:991`. |
| Payout settings + lifecycle guard | **WORKS** | `partners.routes.ts:683/706` GET/PUT `/payout-settings` → `getPartnerPayoutSettings` / `updatePartnerPayoutSettings` (`partnerPayoutSettingsService.ts:146/195`, completeness check `:135`). V8 lifecycle phase guard: `v8/partner.routes.ts:153` POST `/program/lifecycle/request-payout-phase`. Sensitive-payout dual-control 428 gate: `partners.routes.ts:78–94`. |
| Certifications matrix + exam | **WORKS** | `partners.routes.ts:1440` GET `/certifications`, `:1559/1628/1709/1745` module detail / exam start / submit / certificate. |
| Resources | **WORKS** | `partners.routes.ts:1942` GET `/resources` — tier-gated query on `partner_resources` + docsBridge static links + cert matrix ensure. |
| Profile / specializations / regions / listing | **WORKS** | `partners.routes.ts:454/524/557/607/651` GET/PUT org, specializations, regions, listing. |
| Dashboard + metrics | **WORKS** | `partners.routes.ts:1034` `/dashboard`, `:1209` `/metrics`. |
| Attribution → billing discount | **WORKS (end-to-end confirmed)** | Signup write: `auth.routes.ts:1650–1738` validates code → `createAttribution` → INSERT `organization_discounts` (`:1690`) → partner email (`:1718`). Consumption: `BillingCommandService.ts:391` `getPartnerDiscount` reads `organization_discounts` (ACTIVE, unexpired), `:462` calls it inside `createSubscription`, `:468` creates a Stripe coupon `percent_off` for 12 months. Full chain real. |

### Dead / stub surface (re-confirmed, line numbers UPDATED from prior dossier)

**12 stub endpoints — all return `featureUnavailable` (HTTP 503, `partners.routes.ts:66`), none nav-linked except POST /clients:**

| Endpoint | file:line | Verdict |
|---|---|---|
| POST `/clients` | `partners.routes.ts:1284` | **MOCK/503** — *is* reachable via Add Organization button (see Lens-1 dead buttons) |
| GET `/clients/:clientId` | `:1297` | 503 |
| POST `/employees` | `:1350` | 503 (GET `/employees:1312` is REAL) |
| GET `/stats` | `:1370` | 503 |
| POST `/access-links` | `:1387` | 503 |
| GET `/licenses` | `:1836` | 503 |
| POST `/licenses/order` | `:1849` | 503 |
| GET `/invoices` | `:1908` | 503 |
| GET `/invoices/:invoiceId/download` | `:1925` | 503 |

(Prior dossier also listed `1908/1925` for invoices and `1836/1849` for licenses — confirmed. Prior cited `2128 /tiers` and `2444/2463` legacy attributions as stubs; `/tiers:2126` and the attribution routes now resolve to real handlers or were removed — only the 9 above remain pure 503 in the current file.)

**Dead UI buttons (no `onClick`):**
- **Export CSV** — `EarningsSection.tsx:745` — `<button>` with Download icon, **no handler**. DEAD.
- **Get QR Code** — `ReferralToolsSection.tsx:714` — no handler. DEAD.
- **Preview** — `ReferralToolsSection.tsx:718` — no handler. DEAD.
- **Add Organization** — `PartnerPortalView.tsx:1135` — no `onClick`; the surrounding flow targets POST `/api/partners/clients` which is 503. BROKEN.

---

## Lens 2 — Cross-module flow

- **Attribution → Billing (Module 08):** WORKS end-to-end (see table). The `organization_discounts` table is the contract surface between `auth.routes.ts` (writer) and `BillingCommandService.ts` (reader). No missing consumer.
- **Partner org scoping:** Robust triple self-heal in `partnerOrgResolution.ts:11` `getActivePartnerOrgIdForUser` — (1) `partner_users` lookup (`:16`), (2) fallback to `partner_organizations.created_by` (`:33`), (3) org-scoped member inheritance that **persists** a `partner_users` link (`:67/85`). Used by both legacy and V8 routes; this is why partner reads never degrade to tenant 404.
- **V8 mount:** `v8/index.ts:53` mounts `/partner` with `attachV8Context` **before** `v8OrgGate` — deliberately bypassing tenant gate because partner scope is its own boundary (`:50–52` comment). V8 surface is comprehensive: 24 routes incl. `/program/status`, `/program/ledger`, `/program/lifecycle/request-payout-phase`, onboarding accept-terms/select-tier/complete, referral-tools/analytics, attributions, earnings-summary, payouts, org mutations, payout-settings (`v8/partner.routes.ts:81–1239`). **V8 routes carry no `@ts-nocheck`** (clean).
- **SuperAdmin control tower:** `superadmin/partner-settlements`, `partner-config`, `partner-outreach` all mounted (`Gateway.ts:888–890`). Frontend `PartnerSettlementsView.tsx` + `PartnerProgramConfig.tsx` call real endpoints. PARTIAL but wired.

### **[NEW] Finding A — `/api/partners/*` is officially deprecated, yet the live portal depends on it.**
`Gateway.ts:887` mounts the legacy routes behind `deprecationHeader('/api/v8/partner')`. But the **live, routed** `PartnerPortalView` (`PartnerPortalViewNew`) calls legacy `/api/partners/*` for the majority of its data: dashboard (`PartnerPortalView.tsx:162`), metrics (`:679`), certifications (`:1422/1456/1484/1508`), resources (`:2097/2121`), organization GET/PUT (`:2354/2395/2423/2452/2482`), connection (`:2864`), connect (`:3110`). V8 (`V8PartnerApi`) is used only for getClients/getProjects/getOnboardingStatus (`:1037/1053/224`), each with a legacy fallback. **Consequence:** the `@ts-nocheck` 2898-line file is squarely on the live hot path — removing it (P0-1) cannot be deprioritized as "deprecated/dead."

### **[NEW] Finding B — Most partner sub-views are orphaned (lazy-imported, never routed).**
`AppRoutes.tsx:261–284` lazy-imports `CommissionView`, `PartnerDashboardView`, `ClientAccessView`, `DirectoryView`, `ResourcesView`, `ProviderHomeView` — but only `PartnerPortalViewNew` (`:2186`) and `PartnerPricingView` (`:846`) are actually rendered in a `<Route>`. The other six are dead lazy chunks. This means `CommissionView` (the only consumer of `EcosystemAnalytics`) never renders in production.

### **[NEW] Finding C — `usePartnerEcosystem` is fully orphaned (prior dossier overstated its reach).**
`grep` shows `usePartnerEcosystem` is imported by **zero** files (only its own definition). The prior dossier claimed it "drives EcosystemAnalytics, CommissionIntelligence, AcademyProgress" — that is **not true in current code**. `CommissionIntelligence`, `AcademyProgress`, and `PartnerLifecycleCanonPanel` have **no renderer** anywhere in `src/`. So the hardcoded mock data in `usePartnerEcosystem.ts:19–67` (metrics, deals, statements, health score 78) is **dead code**, not a live MOCK feeding the UI. Correct remediation = **delete** the hook + orphaned components, not "wire to V8."

---

## Lens 3 — Teresa wiring

**NONE.** Re-confirmed. `CommissionIntelligence.tsx:46` computes `aiInsights` via `useMemo` over `deals`/`statements` props (win-rate, pipeline value, stalled-deal heuristics at `:50–90`) — pure client-side rules, labelled "AI-powered" (`:4`, Brain/Sparkles icons). No LLM, no Teresa context, no chat bridge. And per Finding C this component is **not even rendered**. `partnerKnowledge` remains a static doc-link registry. Teresa integration is a greenfield P2 opportunity, not a regression.

---

## Lens 4 — Contextual memory

Minimal. No per-partner conversational/contextual memory store. Lifecycle phase (`G4_ACTIVATION` etc.) and `whatNext` hints exist as static enums/derived values (`usePartnerEcosystem.ts`, V8 `/program/status`), not persisted AI context. Note only — no action required for GA.

---

## Server type safety

`@ts-nocheck` confirmed at `partners.routes.ts:1` only. V8 routes (`v8/partner.routes.ts`) and all `partner*Service.ts` files are clean (grep over the set returned only `partners.routes.ts`). Given Finding A, this single file is on the live path → P0-1 stands and is **not** mitigated by the deprecation header.

---

## Revised completion deltas vs prior dossier

| Item | Prior | Corrected this pass |
|---|---|---|
| `usePartnerEcosystem` MOCK feeding UI | "wire to V8 (P1-3)" | **DEAD CODE — delete hook + 3 orphaned components**; not live |
| `CommissionIntelligence` "AI-powered" | MOCK-DERIVED, live | DERIVED **and unrendered** |
| `@ts-nocheck` deprioritizable? | implied low (deprecated routes) | **NO — live portal calls legacy `/api/partners/*`** (Finding A) |
| 6 partner sub-views | implied active | **orphaned lazy chunks, never routed** (Finding B) |
| Stub line numbers | 1284/1297/1350/1370/1387/1836/1849/1908/1925 (+ 2128/2444/2463) | first 9 confirmed; `/tiers:2126` and legacy attributions now resolve (not 503) |

## Priority actions (unchanged core, refined)
- **P0-1** Remove `@ts-nocheck` from `partners.routes.ts:1` (live path — Finding A). M.
- **P0-2** Remove or wire Add Organization (`PartnerPortalView.tsx:1135` → 503 POST /clients). S.
- **P1** Delete dead code: `usePartnerEcosystem.ts`, `CommissionIntelligence.tsx`, `AcademyProgress.tsx`, `PartnerLifecycleCanonPanel.tsx`, and the 6 orphaned lazy imports in `AppRoutes.tsx:261–284` (or route them intentionally). Removes the "MOCK" smell entirely.
- **P1** Wire/remove Export CSV (`EarningsSection.tsx:745`), QR + Preview (`ReferralToolsSection.tsx:714/718`).
- **P1/P2** Implement POST /clients + GET /invoices, or hide their entry points.
- **P2** Teresa context-priming; tier auto-promotion (owner-gated thresholds).

**Net:** the *real backend* (connect, referral, attribution→billing, payouts, certs, resources, V8 bridge) is solid and GA-ready. The *gaps are concentrated in the frontend portal layer*: a `@ts-nocheck` live route file, ~3 dead buttons, 9 503 stubs, and a sizeable orphaned-component graveyard the prior audit mistook for live mocks.
