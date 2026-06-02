# Module 19 — Portal Partnerski — Readiness Scorecard

**Readiness: 48/100 — Tier: Alpha**
**Route(s):** `/partner/*` (protected, `PartnerPortalViewNew`), `/become-partner`, `/become-partner/apply`, `/partner/pricing`
**One-line verdict:** Core data plumbing is real but a substantial slice of write endpoints return 503 stubs, `PerformanceSection` is fully hardcoded, the dashboard fallback embeds static certification data, and both source files carry `@ts-nocheck`.

## What's REAL (verified + backend-wired)

- `GET /api/partners/connection` + `POST /api/partners/connect` — reads/writes `partner_organizations` + `partner_users` via live DB (`partners.routes.ts:228–443`)
- `GET /api/partners/organization` / `PUT` / `PUT /specializations` / `PUT /regions` / `PUT /listing` — real DB CRUD (`partners.routes.ts:454–677`)
- `GET /api/partners/referral-tools` — calls `PartnerReferralService.getReferralTools`, self-heals via `ensurePartnerReferralIdentity` (`partners.routes.ts:733–755`)
- `POST /api/partners/campaign-links` / `DELETE` — wired to `PartnerReferralService` (`partners.routes.ts:761–815`)
- `GET /api/partners/referral-analytics` — `PartnerReferralService.getReferralAnalytics` (`partners.routes.ts:821–847`)
- `GET /api/partners/attributions` — `PartnerReferralService.getPartnerAttributions` (`partners.routes.ts:853–878`)
- `GET /api/partners/earnings` / `GET /commission-transactions` / `POST /payouts/request` — wired to `PartnerCommissionService` (`partners.routes.ts:888–985`)
- `GET /api/partners/dashboard` — attempts real DB queries for clients, revenue, activity; falls back gracefully (`partners.routes.ts:1033–1173`)
- `GET /api/partners/metrics` — live `PartnerReferralService` + `PartnerCommissionService` combo (`partners.routes.ts:1208–1234`)
- `GET /api/partners/clients` / `projects` / `employees` (GET) — wired to `PartnerReferralService` (`partners.routes.ts:1245–1340`)
- `GET /api/partners/certifications` and module/progress sub-routes — full DB-backed certification matrix with progress recalc (`partners.routes.ts:1439–1736`)
- `generatePartnerToolkitResources` — generates real PDFs + PPTX + ZIP on demand via `unifiedExportService` (`server/src/services/partnerToolkitResources.ts:56–397`)
- V8 bridge (`/api/v8/partner/*`) — scoped by `partner_users.partner_org_id`, real DB reads (`server/src/routes/v8/partner.routes.ts`)
- 14 migration files define real schema: `partner_organizations`, `partner_users`, `partner_certifications`, `partner_commission_transactions`, `partner_referral_clicks`, etc.

## What's MOCK / hardcoded / stub

- `PerformanceSection` (UI) — entirely static: score hardcoded to `85`, breakdown `[90, 88, 92, 70]`, text "Top 15% of partners" (`src/views/partner/PartnerPortalView.tsx:987–999`) — no API call
- Dashboard fallback in server route has static certification progress `{ completed: 2, total: 4, courses: ["Consultify Foundations"…] }` baked in (`partners.routes.ts:1048–1056`) — shown to all new partners
- `partnerDemoSeedService` auto-seeds fake attributions and commissions for every new partner org (`server/src/services/partnerDemoSeedService.ts`) — production users see demo revenue data
- `228_partner_referral_mock_seed.sql` migration inserts `DEMO15` code, mock payout account, mock campaign link into the production schema

## What's BROKEN / NO_GO / missing

- **12 endpoints** return `featureUnavailable` (503) with "no real implementation": `POST /clients`, `GET /clients/:id`, `POST /employees`, `GET /stats`, `POST /access-links`, `GET/POST /licenses`, `GET/GET-download /invoices`, `GET /tiers`, `POST/DELETE /attributions` (`partners.routes.ts:1283–2464`)
- `GET /api/partners/payouts` reads `partnerOrgId` from `req.user?.partnerOrgId` (not from DB lookup), which is never set by the auth middleware — route is effectively broken for all callers (`partners.routes.ts:993`)
- Both `PartnerPortalView.tsx` and `partners.routes.ts` use `// @ts-nocheck` — type safety is disabled
- `PerformanceSection` is a duplicate of the already-wired `MetricsSection` with fake numbers; it is accessible from the sidebar

## Backend wiring

Real: organization CRUD, referral system, commission/payout reads, certification matrix, toolkit export. Missing/broken: client creation, access link generation, license management, invoice retrieval, payout GET route (broken auth field), tiers, attribution remove.

## UI/UX consistency

Shell uses `PartnerLayout` + `PartnerSidebar` from `src/components/Partner/` — consistent with project conventions. However two parallel `PartnerPortalView` files exist (`src/views/PartnerPortalView.tsx` legacy + `src/views/partner/PartnerPortalView.tsx` new), both still imported in `AppRoutes.tsx`, which is confusing and increases bundle weight.

## Tests

Strong test presence: 20+ spec files in `tests/components/partner/` covering V8 clients, referral campaign create, payout settings, public listing, company info, specializations, projects, earnings, lifecycle panel, runtime summary; plus `tests/integration/partner-portal.test.ts` and `tests/unit/backend/services/partnerToolkitResources.test.ts`. No test covers `PerformanceSection` hardcoded values. `v8-partner-read.test.ts` snapshot exists in `server/src/routes/v8/__tests__/`.

## Doc-vs-code drift

STATUS.md says `real + partial` — confirmed, accurate. CODEMAP.md references `PartnerPortalViewNew` on `/partner/*` — correct. CODEMAP does not mention `PerformanceSection` hardcoding or the 12 stub endpoints; it is silent on the legacy `src/views/PartnerPortalView.tsx` still being imported. Overall docs are optimistic — they capture the happy path but omit the stub surface.

## Top gaps to reach market-ready (prioritized)

1. **Fix broken `GET /payouts`** — change `req.user?.partnerOrgId` to `getActivePartnerOrgIdForUser(userId)` (same pattern used in every other route); one-line fix, high impact.
2. **Remove demo seed from production path** — `ensurePartnerDemoDataset` runs on every authenticated partner request; gate it behind `NODE_ENV !== 'production'` or a feature flag to prevent fake revenue data appearing in live accounts.
3. **Replace `PerformanceSection` with real API data** — it is wired in `MetricsSection`; reuse that component or delete `PerformanceSection`.
4. **Implement or gate `POST /clients`, `GET /licenses`, `POST /access-links`, `GET /invoices`** — these are advertised in the UI sidebar; returning 503 with "no real implementation" is user-visible.
5. **Remove `@ts-nocheck`** from both `PartnerPortalView.tsx` and `partners.routes.ts` and fix resulting type errors.
6. **Delete or redirect legacy `src/views/PartnerPortalView.tsx`** — duplicate file risks split-brain maintenance.
