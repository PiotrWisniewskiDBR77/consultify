# Module 19 — Portal Partnerski — Completion-to-100% Dossier
**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations
**Current score:** 69/100 — Tier: Beta
**Target:** 100/100 — Full partner/reseller channel

---

## 1. Purpose / Goal / Vision (far goal)

Module 19 is the **full partner-channel product**: lifecycle onboard → activate → earn → payout, with public directory, academy/certification, attribution-driven billing discounts, and a SuperAdmin control tower. Vision (docs/product/PARTNER_PROGRAM_V8_MASTER_SUMMARY.md) is an *ecosystem product*, not a commission widget — covering partner identity, tier progression, public listing quality, enablement communications, deal registration, and health governance. Channel-strategy decisions (partner types, GTM motions, who is gated) sit outside engineering scope and remain owner-owned.

---

## 2. Readiness to 100% — Score + Gap

**Current: 69/100.** Gap table:

| Domain | Status | Gap |
|---|---|---|
| Registration / connect | REAL | None |
| Referral + campaign links | REAL | None |
| Click analytics + attributions | REAL | None |
| Earnings / statements / payouts | REAL | None |
| Payout settings + lifecycle guard | REAL | None |
| Certification matrix | REAL | None |
| Resources section | REAL | None |
| Profile / specializations / regions | REAL | None |
| Public listing | REAL | None |
| Dashboard + metrics | REAL | None |
| Attribution → billing discount | REAL (BillingCommandService.ts:461–490 `createSubscription` calls `getPartnerDiscount`) | Confirmed wired; no missing consumer |
| Server type safety | BROKEN | `partners.routes.ts:1` — `@ts-nocheck` on 2898-line file |
| 12 stub endpoints | STUB | `partners.routes.ts:1284,1297,1350,1370,1387,1836,1849,1908,1925,2128,2444,2463` — 503, not nav-linked |
| Add Organization button | BROKEN | `PartnerPortalView.tsx:1135` — no `onClick`; calls `POST /clients` → 503 |
| Export CSV button | DEAD | `EarningsSection.tsx:745` — no handler |
| QR Code + Preview buttons | DEAD | `ReferralToolsSection.tsx:714–721` — no handlers |
| `usePartnerEcosystem` hook | MOCK | `src/hooks/usePartnerEcosystem.ts:19–55` — fully hardcoded: metrics, deals, statements; no API call |
| `CommissionIntelligence` component | MOCK-DERIVED | `src/components/Partner/CommissionIntelligence.tsx:46` — `aiInsights` computed from props (real data flow) but labelled "AI-powered"; no live AI call |
| Tier auto-promotion | MANUAL-ONLY | Tiers read from `partner_organizations.tier`; no automatic promotion logic; operator must update manually via SuperAdmin |
| Partner ecosystem health score | STUB | `usePartnerEcosystem.ts:23` — hardcoded `78`; `EcosystemAnalytics` component unused by main portal |
| SuperAdmin settlements | PARTIAL | `PartnerSettlementsView.tsx` + `PartnerProgramConfig.tsx` call real `/api/superadmin/partner-config/*` endpoints; wired |
| V8 layer scoping | REAL | All V8 routes use `getActivePartnerOrgIdForUser`, not JWT org |

**Previous concern resolved:** `organization_discounts` consumption by billing confirmed at `server/src/services/billing/BillingCommandService.ts:462` — `getPartnerDiscount` reads the table and applies a Stripe coupon during `createSubscription`. Not a gap.

---

## 3. Teresa Integration

**None.** There is no Teresa/AI chat integration in any partner flow. `CommissionIntelligence.tsx` is labelled "AI-powered" but computes `aiInsights` locally via `useMemo` from commission props — no LLM call, no Teresa context, no chat. `partnerKnowledge.ts` is a static doc-link registry only. This is a P2 opportunity (Teresa context-priming with partner lifecycle data), not a blocker.

---

## 4. System Integration

- **Attribution → Billing:** Confirmed wired. `auth.routes.ts:1651–1722` writes `partner_attributions` + `organization_discounts` at signup; `BillingCommandService.ts:462–490` reads `organization_discounts` and applies Stripe coupon at subscription creation.
- **V8 org scoping:** Triple self-heal in `partnerOrgResolution.ts:11–98` (partner_users → partner_organizations.created_by → org-scoped member lookup) ensures org context is always correct.
- **SuperAdmin control tower:** `PartnerProgramConfig` + `PartnerSettlementsView` + `PartnerOutreachPanel` form a real (if partial) control surface. Commission rate writes (`PUT /api/superadmin/partner-config/commission-rates`) and review queue are wired.
- **Tier system:** Tiers exist in schema and are read everywhere; there is no auto-promotion engine — tier upgrade requires operator action in SuperAdmin.

---

## 5. Completion Plan to 100%

### P0 — Correctness / type-safety blockers (must ship before GA)

| # | Task | File:line | Effort |
|---|---|---|---|
| P0-1 | Remove `@ts-nocheck` from `partners.routes.ts` and fix resulting TS errors (payout auth, commission service calls) | `partners.routes.ts:1` | M — 2898-line file; expect 20–40 type errors |
| P0-2 | Wire `Add Organization` button → modal/form or remove it | `PartnerPortalView.tsx:1135` | S — remove onClick-less button |

### P1 — Feature completeness (partner value prop)

| # | Task | File:line | Effort |
|---|---|---|---|
| P1-1 | Wire or remove Export CSV button in EarningsSection | `EarningsSection.tsx:745` | S — generate CSV from `transactions` state or drop button |
| P1-2 | Wire or remove QR Code + Preview buttons in ReferralToolsSection | `ReferralToolsSection.tsx:714–721` | S — QR via `qrcode` lib or drop |
| P1-3 | Replace `usePartnerEcosystem` hardcoded metrics/deals/statements with real V8 API calls | `src/hooks/usePartnerEcosystem.ts:19–55` | M — hook currently drives `EcosystemAnalytics`, `CommissionIntelligence`, `AcademyProgress` components; wire to V8 `/earnings-summary`, `/attributions`, `/referral-analytics` |
| P1-4 | Implement tier auto-promotion engine (rule: N referrals + certification level → tier advance) | `server/src/services/` (new) | L — owner-gated: requires business rule sign-off on tier thresholds |
| P1-5 | Implement `POST /clients` (client org registration by partner) | `partners.routes.ts:1284` | M — creates `organizations` row with `partner_org_id` attribution |
| P1-6 | Implement `GET /invoices` + `GET /invoices/download` | `partners.routes.ts:1908,1925` | M — reads `billing_invoices` or Stripe invoice list scoped to partner's attributed orgs |

### P2 — Ecosystem depth (post-GA polish)

| # | Task | File:line | Effort |
|---|---|---|---|
| P2-1 | Implement real ecosystem health score (formula: referral conversion rate + certification level + payout consistency) | `usePartnerEcosystem.ts:23` | M |
| P2-2 | Implement `GET /licenses` + `POST /licenses` (license seat purchasing for partner-managed clients) | `partners.routes.ts:1836,1849` | L — requires billing/licensing subsystem |
| P2-3 | Implement `GET /stats` (partner-scoped aggregate pipeline stats) | `partners.routes.ts:1370` | S |
| P2-4 | Implement `GET /tiers` (public tier ladder with thresholds) | `partners.routes.ts:2128` | S |
| P2-5 | Teresa context-priming for partner lifecycle guidance | new | M — feed `lifecyclePhase`, `whatNext`, `earningsSummary` to Teresa context; no LLM today |
| P2-6 | Remove remaining 7 stubs (`POST /access-links`, legacy `GET/DELETE /attributions`, `POST /employees`) or gate behind feature flag | `partners.routes.ts:1387,2444,2463,1350` | S |

---

## 6. Score Estimate After Each Wave

| Wave | Actions | Est. score |
|---|---|---|
| P0 only | @ts-nocheck removed, Add Org button fixed | **73/100** |
| P0 + P1 (minus tier engine) | CSV/QR wired, ecosystem hook real, clients endpoint, invoices | **84/100** |
| P0 + P1 full (with tier engine) | + auto-promotion | **90/100** |
| P2 full | + health score, licenses, stats, tiers, Teresa, stub cleanup | **100/100** |

**Channel-strategy / owner-gated blockers:** tier threshold rules, partner type GTM decisions, license-seat pricing model — none of these are implementation blockers for 84/100 but are required for 100/100 tier engine and licensing.
