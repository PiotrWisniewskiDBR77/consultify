# Module 19 — Portal Partnerski — Readiness Scorecard
**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations
**Baseline:** 48/100 (2026-06-02) | **Now: 69/100 — Tier: Beta** | **Delta: +21**

---

## 1. Readiness (score + delta vs 48)

**69/100 — Tier: Beta (+21)**

All five P0 baseline blockers verified fixed; demo seed is production-guarded; frontend is fully typed; no dead PerformanceSection; stubs are not in sidebar nav. Score capped by: `partners.routes.ts` carrying `@ts-nocheck` (server-side), 12 stub endpoints URL-accessible (but not nav-linked), two dead UI buttons (Export CSV, QR Code), and unconfirmed discount consumption by billing.

---

## 2. Verification of Baseline Issues

| Claim | Verdict | Evidence |
|---|---|---|
| `/payouts` auth fixed via `getActivePartnerOrgIdForUser` | **CONFIRMED** | `partners.routes.ts:996` calls `requirePartnerOrgId(req, res)`; helper at line 197–218 calls `getActivePartnerOrgIdForUser(userId)`; comment at line 993 documents the fix |
| `@ts-nocheck` removed from `PartnerPortalView.tsx` | **CONFIRMED** | `src/views/partner/PartnerPortalView.tsx` has no `@ts-nocheck`; 3213 lines of typed TSX |
| Legacy `src/views/PartnerPortalView.tsx` deleted | **CONFIRMED** | File does not exist; `AppRoutes.tsx:261–262` lazy-imports only `@/views/partner/PartnerPortalView` → `PartnerPortalViewNew` |
| `PerformanceSection` dead-code removed | **CONFIRMED** | No `PerformanceSection` anywhere in `src/views/partner/`; `MetricsSection` (live API at `/api/partners/metrics`) is the sole metrics view |
| Demo seed prod-guarded | **CONFIRMED** | `partnerDemoSeedService.ts:37–41` — `isPartnerDemoSeedAllowed()` returns false when `NODE_ENV=production && DEMO_WRITES_ENABLED≠true`; guard fires before any DB write |
| 12 stub endpoints not in UI nav | **CONFIRMED (stubs exist, hidden)** | `PartnerSidebar.tsx` nav groups contain no licenses, invoices, stats, access-links, tiers, or attribution-write entries; `ClientsSection` "Add Organization" button exists but calls `POST /clients` which is a 503 — minor UX bug, not a navigation path |

---

## 3. Functionality (ship / hidden)

**SHIPS — backend-wired, fully operational:**
- Registration/connect: `POST /api/partners/connect`, `GET /connection` — `partners.routes.ts:228–443`
- Referral code + link: `GET /api/partners/referral-tools` + V8 `/api/v8/partner/referral-tools`; self-heals via `ensurePartnerReferralIdentity`; `v8/partner.routes.ts:563–653`
- Campaign links CRUD: `POST/DELETE /api/v8/partner/campaign-links` — `v8/partner.routes.ts:940–1006`
- Click analytics: `GET /api/v8/partner/referral-analytics` — real DB aggregation via `PartnerReferralService`
- Referred customers: `GET /api/v8/partner/attributions` — normalized attribution list with commission detail
- Earnings / Statements / Payouts / Payout Settings: `EarningsSection.tsx` — V8 + legacy fallback; payout lifecycle guard enforces payout-settings completeness before request
- Dashboard + Metrics: real DB queries; V8 runtime summary strip (`PartnerRuntimeSummaryStrip`) overlay
- Client orgs / projects / users: V8 + legacy fallback `ClientsSection`; `v8/partner.routes.ts:226–325`
- Full certification matrix: `GET /api/partners/certifications`, exam start/submit, module drill-down — `partners.routes.ts:1439–1736`
- Resources, Profile, Directory sections: wired, no stubs hit

**HIDDEN / STUB (12 endpoints, 503, not in nav):**
- `POST /clients` (1284), `GET /clients/:id` (1297), `POST /employees` (1352), `GET /stats` (1370), `POST /access-links` (1387), `GET/POST /licenses` (1836/1849), `GET /invoices` (1908), `GET /invoices/download` (1925), `GET /tiers` (2128), `GET/DELETE legacy /attributions` (2446/2465)

---

## 4. Intra-module Flow & States

Flow is coherent end-to-end:
1. Unauthenticated → public application (`public-partner-applications.routes.ts`) + `BecomePartnerView`
2. Authenticated, no partner org → connect-guard at `PartnerPortalView.tsx:3151`; input locks navigation
3. Connected partner → `requirePartnerOrgId` resolves org from DB via `getActivePartnerOrgIdForUser`; triple self-heal (partner_users → partner_organizations.created_by → org-scoped member lookup) in `partnerOrgResolution.ts:11–98`
4. All 24 `PARTNER_SECTIONS` mapped; legacy URL paths redirected to `?tab=` via `getLegacyPartnerSection` at `PartnerPortalView.tsx:107`
5. `ReferralToolsSection` and `EarningsSection` lazy-loaded with `React.Suspense` fallback

V8 layer: all 15+ endpoints use `getActivePartnerOrgIdForUser` directly, not JWT org — scoping is correct.

---

## 5. UI/UX Adherence (crimson)

- `PartnerSidebar.tsx:7`: "Harvard Crimson accent + left stripe" — implemented via `border-l-2 border-crimson-500` active state
- `PartnerLayout` uses `bg-navy-950` dark sidebar, `border-t border-crimson-600/20` page accent — consistent with Admin module
- All sections have loading skeletons and error states with retry buttons
- `MetricsSection` — no hardcoded scores; all values from API with `normalizeMetricsPayload` guard

**Dead UI (cosmetic gaps, not regressions):**
- Export CSV button in `EarningsSection.tsx:745` — renders with no `onClick`
- QR Code + Preview buttons in `ReferralToolsSection.tsx:715–723` — render with no handlers

---

## 6. Cross-module Handoffs

**Attribution → Signup (REAL):** On registration with `partner_code`, `auth.routes.ts:1651–1722` validates referral code → inserts `partner_attributions` row → reads `partner_discount_config` → inserts `organization_discounts` → dispatches email via `partnerEmailService`. Full DB chain confirmed.

**Attribution → Billing (UNCONFIRMED):** `organization_discounts` row is written at signup; no billing reader verified in this audit. Discount may not be applied at charge time — medium risk for launch.

**V8 earnings handoff:** `earnings-summary` at `v8/partner.routes.ts:724–762` reads `PartnerCommissionService.getEarningsSummary` + `PartnerProgramLedgerService.getProgramStatusDetail` in parallel, merges into governed summary. P29 lifecycle guard enforces `earn → payout` transition before commission release.

---

## 7. Risks / Regressions / Runtime

| Risk | Severity | Evidence |
|---|---|---|
| `@ts-nocheck` on `partners.routes.ts:1` | Medium | 2500+ line server file; payout/auth logic unprotected by compiler |
| 12 stub endpoints URL-accessible | Low | Not in nav; return 503 with `type: 'not_configured'`; visible to QA / API clients |
| `organization_discounts` not confirmed consumed by billing | Medium | Written at `auth.routes.ts:1690–1703`; no billing consumer confirmed |
| Dead Export CSV + QR Code buttons | Low | `EarningsSection.tsx:745`, `ReferralToolsSection.tsx:715–723` — no handlers |
| `ClientsSection` "Add Organization" button → `POST /clients` → 503 | Low | `PartnerPortalView.tsx:1135`; user-visible failure but not in happy path |
| Demo seed adds DB round-trips on every `requirePartnerOrgId` call (non-prod) | Low | Idempotent; 3 call sites; dev/preview only |

---

## 8. Top Remaining Gaps

1. **Remove `@ts-nocheck` from `partners.routes.ts`** — highest-leverage type-safety task; prevents regressions in 2500-line auth/payout handler
2. **Confirm billing reads `organization_discounts`** — referral discount attribution is the core value prop; if discounts aren't applied at payment, the partner program is non-functional end-to-end
3. **Implement or hide "Add Organization" button** — `PartnerPortalView.tsx:1135` calls `POST /clients` which returns 503; either remove button or wire real endpoint
4. **Implement or remove Export CSV** — `EarningsSection.tsx:745`; dead button with no handler
5. **QR Code / Preview no-op buttons** — `ReferralToolsSection.tsx:715–723`; hide or implement
