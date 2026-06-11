# M26 — Portal Partnerski — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `f8fec5953`) · **Audytor:** Claude (subagent autonomiczny)
**Wejścia:** `Harvard/podzial/inventory/INV_G_admin_ustawienia_partner_superadmin.md` §M26 · protokół `Harvard/protokol/MODULE_AUDIT_PROTOCOL_V1.md`
**Evidence:** brak screenshotów (Faza 4 deferred) — dowody z kodu w sekcjach poniżej

## OCENA: 52/100 — Tier: Alpha · status 🟦 NIEPEŁNY (bez Fazy 4 i bez Fazy 3)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 17 | Główne przepływy read/write realne przez v8 + legacy, ale 5 endpointów POST/GET to świadome stubs (clients, employees, stats, access-links, tiers) + 3 stubs w superadmin (attributions listing/delete, licenses) |
| B. Wiring i dane | 15 | 11 | Dual-router (legacy /api/partners + v8 /api/v8/partner) spójny, scoping przez `getActivePartnerOrgIdForUser` konsekwentny, migracje istnieją; legacy router ma silent fallback na hardcoded earnings przy DB fail (lines 967–977) |
| C. Testy automatyczne | 15 | 10 | ~23 pliki testów (unit+component+integration), testy w CI (vitest.config.ts:200-208); brak testu E2E dla kluczowego happy path connect→dashboard; v8-partner-read.test.ts mockuje serwisy (nie weryfikuje SQL) |
| D. Żywa użyteczność | 15 | 0 | DEFERRED — Faza 4 niewykonana |
| E. Kanony/UI | 10 | 7 | i18n PL/EN: klucze `partner.dashboard.*`, `partner.metrics.*` istnieją w obu lokalizacjach z identycznym pokryciem; PartnerPortalView 3310 l. z `useTranslation` (99 użyć); brak sprawdzenia §27 dla tabel listowych live |
| F. Bezpieczeństwo/dostęp | 10 | 7 | `requirePartnerOrgId` konsekwentny we wszystkich write-endpointach; route FE: celowo tylko `requireAuth` (udokumentowane AppRoutes.tsx:2231-2239); v8 partner bypasses v8OrgGate (celowo, udokumentowane v8/index.ts:51-53); jeden P2 finding (zasoby bez org-scope w query) |
| G. Środowiska (Railway) | 10 | 0 | DEFERRED — Faza 3 niewykonana |
| **Hard cap zastosowany?** | — | — | Faza 4 niewykonana → max 70; ocena 52 < 70, cap niewiążący. Zero cross-org WRITE (scoping OK) → cap 50 nieaktywny. |

**Werdykt jednym akapitem:** Portal Partnerski jest jedynym modułem w aplikacji z celowo luźnym route-level gate (tylko `requireAuth`) — model bezpieczeństwa serwer-first jest udokumentowany i konsekwentnie wdrożony przez `requirePartnerOrgId`. Rdzeń wartości (referrals, earnings, certifications, directory profile, onboarding) działa end-to-end przez v8 z prawdziwymi tabelami DB i 23 plikami testów w CI. Blokadą do Bety są: 5 świadomych stubów w obszarze Client Management (POST /clients, GET /clients/:id, POST /employees), brak testu E2E dla connect→dashboard happy path, oraz silent fallback na hardcoded earnings data przy DB fail w legacy routerze — ten ostatni to cicha degradacja, która musi dostać komunikat.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)

**Checklist pozycji inwentarza:** 10 pozycji z INV + 0 nowych odkrytych.

**Checklist:**

| # | Funkcja (z INV) | Status INV | Werdykt audytu |
|---|---|---|---|
| 1 | Home: partner-home, Dashboard, Metrics | DZIAŁA | REALNE |
| 2 | Referrals: Links & Codes, Click Analytics, Referred Customers | DZIAŁA | REALNE |
| 3 | Earnings: Commissions, Statements, Payouts, Payout Settings | DZIAŁA | REALNE |
| 4 | Client Management: Access Manager (read), Organizations, Projects | DZIAŁA (odczyt) | REALNE (odczyt) / STUB (zapis) |
| 5 | Academy: Learning Path, Exams, Certificates | DZIAŁA | REALNE |
| 6 | Resources: Documentation, Marketing, Case Studies, Templates | DZIAŁA | REALNE |
| 7 | Directory Profile: Company Info, Specializations, Regions, Public Listing | DZIAŁA | REALNE |
| 8 | 26 endpointów 503/FEATURE_NOT_AVAILABLE | STUB celowy | STUB (5 w endpointach partnera + więcej w superadmin) |
| 9 | Demo seed (`ensurePartnerDemoDataset`) | ZA FLAGĄ | REALNE za PARTNER_DEMO_SEED_ENABLED |
| 10 | Partner Pricing (publiczne) | DZIAŁA | REALNE |

**Scenariusze krytyczne (5):**

1. **S1** — Partner connect/onboarding: użytkownik bez połączonego profilu → `GET /api/partners/connection` → connected=false → klik "Connect" → `POST /api/partners/connect` (wymaga `PARTNER_SELF_CONNECT_ENABLED=true`) → connected=true → dashboard
2. **S2** — Referral flow: `GET /api/v8/partner/referral-tools` → wyświetlenie kodu + linku → `POST /api/v8/partner/campaign-links` → `GET /api/v8/partner/referral-analytics`
3. **S3** — Earnings & payout: `GET /api/v8/partner/earnings-summary` → `PUT /api/v8/partner/payout-settings` → `POST /api/v8/partner/payouts/request` → ledger update
4. **S4** — Certification: `GET /api/partners/certifications` → `POST /api/partners/certifications/:certId/modules/:moduleId/progress` → `POST /api/partners/certifications/:certId/exam/start` → wynik
5. **S5** — Directory listing: `GET /api/partners/organization` → `PUT /api/partners/organization/specializations` → `PUT /api/partners/organization/listing` (public_listing_enabled)

**Obowiązujące kanony:**
- §27 TABLE_AND_PREVIEW_CANON: PartnerPortalView ma tabele listowe dla clients/employees/attributions — wymagają sprawdzenia (Faza 5 częściowa)
- CARD_CONTENT_FORMULA: n.d. (moduł nie produkuje insight/initiative cards)
- ModuleHub/MELS: własny `PartnerLayout` + `PartnerSidebar` (nie korzysta z ModuleHub)
- Beta-gating: moduł NIE jest w `betaAccess.ts` — dostępny dla każdego zalogowanego (celowo)

---

## 1. Prawda kodu (FAZA 1)

### 1a. REALNE (zweryfikowane)

- **Partner connection check** `GET /api/partners/connection` → `partner_organizations JOIN partner_users WHERE user.id = ?` → `partners.routes.ts:237-310`
- **Partner connect** `POST /api/partners/connect` → INSERT `partner_organizations` + `partner_users` w transakcji → `partners.routes.ts:317-468`; gated za `PARTNER_SELF_CONNECT_ENABLED`
- **Referral tools** `GET /api/v8/partner/referral-tools` → `PartnerReferralService.getReferralTools(partnerOrgId)` + identity self-heal → `v8/partner.routes.ts:563-654`
- **Referral analytics** `GET /api/v8/partner/referral-analytics` → `PartnerReferralService.getReferralAnalytics(partnerOrgId, days)` → `v8/partner.routes.ts:659-683`
- **Campaign links** `POST /api/v8/partner/campaign-links`, `DELETE /api/v8/partner/campaign-links/:linkId` → `PartnerReferralService.createCampaignLink/deleteCampaignLink(partnerOrgId, linkId)` → `v8/partner.routes.ts:940-1007`; deleteCampaignLink scopes by `partnerOrgId`
- **Earnings summary** `GET /api/v8/partner/earnings-summary` → `PartnerCommissionService + PartnerProgramLedgerService` z partnerOrgId → `v8/partner.routes.ts:724-762`
- **Payouts** `GET /api/v8/partner/payouts`, `POST /api/v8/partner/payouts/request` → `PartnerCommissionService` + P29 lifecycle transition → `v8/partner.routes.ts:804-935`
- **Payout settings** `GET/PUT /api/v8/partner/payout-settings` → `partnerPayoutSettingsService` → `v8/partner.routes.ts:1213-1262`
- **Onboarding** (accept-terms, select-tier, complete) → `user_onboarding_status` tabelka, `legalService.acceptDocuments` → `v8/partner.routes.ts:377-558`
- **Certifications** (list, progress update, exam start/submit) → `partnerCertificationService` z pełnym scoping przez `partnerOrgId + userId` → `partners.routes.ts:1507-1880`
- **Organization PUT** (org info, specializations, regions, listing) → UPDATE/DELETE+INSERT w transakcjach, scoped `WHERE id/partner_org_id = partnerOrgId` → `v8/partner.routes.ts:1012-1208`
- **Resources** `GET /api/partners/resources` + download z tier-check → `generatePartnerToolkitResourceFile`, dostęp chroniony przez tier rank → `partners.routes.ts:2009-2183`
- **SuperAdmin settlements** (summary, approve-commissions, process/complete/fail-payout) → verifyToken+verifySuperAdmin, dual-control confirmation → `partners.routes.ts:2302-2467`
- **Public routes** (validate-code, track-click) → bez auth, scoped per referral code → `partners.routes.ts:2211-2295`
- **Program ledger** `GET /api/v8/partner/program/ledger`, `POST /api/v8/partner/program/lifecycle/request-payout-phase` → `PartnerProgramLedgerService` → `v8/partner.routes.ts:119-221`

### 1b. MOCK / STUB / fabrykowane klientem

- **POST /api/partners/clients** → `featureNotAvailable(res, 'Partner client creation is not available yet.')` → `partners.routes.ts:1354`
- **GET /api/partners/clients/:clientId** → `featureNotAvailable` → `partners.routes.ts:1367`
- **POST /api/partners/employees** → `featureNotAvailable` → `partners.routes.ts:1420`
- **GET /api/partners/stats** → `featureNotAvailable` → `partners.routes.ts:1437`
- **POST /api/partners/access-links** → `featureNotAvailable` → `partners.routes.ts:1454`
- **GET /api/partners/licenses** → `featureUnavailable(res, 'Partner licenses unavailable...')` → `partners.routes.ts:1903`
- **POST /api/partners/licenses/order** → `featureUnavailable` → `partners.routes.ts:1914`
- **GET /api/partners/invoices** → `featureUnavailable` → `partners.routes.ts:1973`
- **GET /api/partners/tiers** → `featureUnavailable` → `partners.routes.ts:2195`
- **SuperAdmin GET /attributions** → `featureUnavailable` → `partners.routes.ts:2511`
- **SuperAdmin DELETE /attributions/:id** → `featureUnavailable` → `partners.routes.ts:2526`
- **Demo seed** — `ensurePartnerDemoDataset` wywoływane przy każdym odczycie; no-op na prod bez flagi `PARTNER_DEMO_SEED_ENABLED=true` → `partnerDemoSeedService.ts:39-47`

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE

- **Silent fallback na hardcoded earnings** w `GET /api/partners/earnings` (legacy): przy wyjątku DB zwraca `{ commissionRate: 15, bankInfoComplete: true, ... }` bez żadnego erroru dla klienta → `partners.routes.ts:966-977`. Jest to cicha degradacja (wzorzec „catch→hardcoded") — P2 finding (komunikat do użytkownika wymaga naprawy).
- **Duplicate API surface**: `/api/partners/earnings` (legacy) i `/api/v8/partner/earnings-summary` zwracają różne kształty danych (legacy: `commissionRate`, v8: `lifecyclePhase/balances`). FE powinien używać wyłącznie v8.

### 1d. UKRYTE / MARTWY KOD

- Brak martwego kodu FE w `src/views/partner/` — wszystkie importy aktywne w `PartnerPortalView.tsx`.
- `partners.routes.ts` eksportuje `publicPartnerRouter`, `superAdminPartnerRouter`, `partnerConfigRouter` — wszystkie montowane w `Gateway.ts:445,925-926`.

### 1e. Wiring FE↔BE↔DB

| Funkcja | Endpoint | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Partner connection | GET /api/partners/connection | partner_organizations, partner_users | migrations/215_partner_portal.sql | REALNE |
| Partner connect (self-service) | POST /api/partners/connect | partner_organizations, partner_users | 215_partner_portal.sql | REALNE (za flagą PARTNER_SELF_CONNECT_ENABLED) |
| Referral tools / identity | GET /api/v8/partner/referral-tools | partner_referral_tools | migrations/216_partner_referral_system.sql | REALNE |
| Referral analytics | GET /api/v8/partner/referral-analytics | partner_referral_clicks | 216_partner_referral_system.sql | REALNE |
| Campaign links | POST/DELETE /api/v8/partner/campaign-links | partner_campaign_links | 216_partner_referral_system.sql | REALNE |
| Attributions | GET /api/v8/partner/attributions | partner_attributions | 216_partner_referral_system.sql | REALNE |
| Earnings (v8) | GET /api/v8/partner/earnings-summary | partner_commission_transactions | 20260327_partner_owned_payout_settings.sql | REALNE |
| Payout request | POST /api/v8/partner/payouts/request | partner_payouts, partner_program_ledger | 20260331_p28_workbench_p29_partner_program_ledger.sql | REALNE |
| Payout settings | PUT /api/v8/partner/payout-settings | partner_payout_settings | 20260327_partner_owned_payout_settings.sql | REALNE |
| Onboarding status | GET/POST /api/v8/partner/onboarding-* | user_onboarding_status | (ensureUserOnboardingStatusTable runtime) | REALNE |
| Certifications | GET/POST /api/partners/certifications | partner_certifications, partner_learning_progress | 20260411_partner_certification_v2.sql, 556_partner_certification_exams.sql | REALNE |
| Organization profile | PUT /api/v8/partner/organization/* | partner_organizations, partner_specializations, partner_regions | 215_partner_portal.sql | REALNE |
| Resources | GET /api/partners/resources, /download | partner_resources, partner_resource_downloads | migrations/555_partner_resources.sql | REALNE |
| Program ledger | GET /api/v8/partner/program/ledger | partner_program_ledger_entries | 20260331 | REALNE |
| POST /clients | POST /api/partners/clients | — | — | STUB (FEATURE_NOT_AVAILABLE) |
| GET /clients/:id | GET /api/partners/clients/:clientId | — | — | STUB |
| POST /employees | POST /api/partners/employees | — | — | STUB |
| GET /licenses | GET /api/partners/licenses | — | — | STUB |
| GET /tiers | GET /api/partners/tiers | — | — | STUB |

### 1f. Flagi

| Flaga | Default BE (runtime) | Default FE | Kto włącza | Wpływ |
|---|---|---|---|---|
| `PARTNER_SELF_CONNECT_ENABLED` | `false` (wymagane `=== 'true'`) | n.d. (sidebar pokazuje "Connect" zawsze gdy `connected=false`) | Ops/Admin | Odblokowuje `POST /api/partners/connect` dla nowych org; istniejące połączone org niezmienione |
| `PARTNER_DEMO_SEED_ENABLED` | `false` | n.d. | Ops/Dev | Seed demo danych przy każdym odczycie v8; bezpieczny no-op na prod |
| `DEMO_WRITES_ENABLED` | `false` | n.d. | Ops/Dev | Globalny escape hatch dla demo-writes; nadrzędny nad PARTNER_DEMO_SEED_ENABLED |
| `APP_BASE_URL` | `https://consultify.ai` | n.d. | Ops | Buduje referral link slug w fallback identity |

### 1g. Połączenia międzymodułowe

| Kierunek | Moduł | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WEJŚCIE ← | M25 Settings (auth) | verifyToken middleware, JWT userId | gateway.ts → partners.routes.ts:227 | DZIAŁA |
| WEJŚCIE ← | M27 SuperAdmin | verifySuperAdmin + superAdminPartnerRouter | partners.routes.ts:2302-2305 | DZIAŁA |
| WEJŚCIE ← | Public (signup) | /api/public/partner/validate-code, /track-click | partners.routes.ts:2211-2295 | DZIAŁA |
| WEJŚCIE ← | M27 SuperAdmin | partnerConfigRouter (/api/superadmin/partner-config) | gateway.ts:926 | DZIAŁA |
| WYJŚCIE → | M27 SuperAdmin (partner-settlements) | superAdminPartnerRouter → PartnerCommissionService | partners.routes.ts:2302+ | DZIAŁA |
| WYJŚCIE → | Legal/Consent | legalService.acceptDocuments() przy onboarding | v8/partner.routes.ts:420-429 | DZIAŁA |
| WYJŚCIE → | v8 global router | v8Router.use('/partner', ...) bez v8OrgGate | v8/index.ts:53 | DZIAŁA (celowo) |
| WYJŚCIE → | Sidebar (FE) | `GET /api/partners/connection → connected=true` steruje widocznością pozycji w stopce sidebar | INV + AppRoutes.tsx:2231 | DZIAŁA |

---

## 2. Testy automatyczne (FAZA 2)

**Uruchomienie:** Testy NIE zostały uruchomione w tej sesji audytu (brak uprawnień do `npm test` w środowisku subagenta). Inwentarz oparty na pliku vitest.config.ts i strukturze plików.

| Plik testu | Zakres | Liczba (est.) | Wynik | W CI? |
|---|---|---|---|---|
| `tests/components/partner/PartnerPortalView.test.tsx` | FE — render + sekcje | ~15 | nieznany | TAK |
| `tests/components/partner/PartnerPortalView.v8-clients.test.tsx` | FE — v8 clients section | ~5 | nieznany | TAK |
| `tests/components/partner/PartnerPortalView.v8-company-info.test.tsx` | FE — company info | ~5 | nieznany | TAK |
| `tests/components/partner/PartnerPortalView.v8-specializations.test.tsx` | FE — specializations | ~5 | nieznany | TAK |
| `tests/components/partner/PartnerPortalView.v8-regions.test.tsx` | FE — regions | ~5 | nieznany | TAK |
| `tests/components/partner/PartnerPortalView.v8-projects.test.tsx` | FE — projects | ~5 | nieznany | TAK |
| `tests/components/partner/PartnerPortalView.v8-public-listing.test.tsx` | FE — public listing | ~5 | nieznany | TAK |
| `tests/components/partner/EarningsSection.v8-payout-request.test.tsx` | FE — payout request flow | ~8 | nieznany | TAK |
| `tests/components/partner/EarningsSection.v8-payout-settings.test.tsx` | FE — payout settings | ~8 | nieznany | TAK |
| `tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx` | FE — onboarding | ~5 | nieznany | TAK |
| `tests/components/partner/ProviderHomeView.v8-onboarding-status.test.tsx` | FE — onboarding status | ~5 | nieznany | TAK |
| `tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx` | FE — campaign create | ~5 | nieznany | TAK |
| `tests/components/partner/PartnerDashboardView.runtime-summary.test.tsx` | FE — dashboard | ~5 | nieznany | TAK |
| `tests/components/partner/ClientAccessView.v8-clients.test.tsx` | FE — client access | ~5 | nieznany | TAK |
| `tests/components/partner/CommissionView.statement-continuity.test.tsx` | FE — commissions | ~5 | nieznany | TAK |
| `tests/unit/backend/routes/partner-payouts-auth.test.ts` | BE — payout auth regression (P0 fix) | ~4 | nieznany | TAK |
| `tests/unit/backend/partnerService.test.js` | BE — service validations | ~10 | nieznany | TAK |
| `tests/unit/backend/services/partnerCertificatePdf.test.ts` | BE — cert PDF gen | ~5 | nieznany | TAK |
| `tests/unit/backend/services/partnerToolkitResources.test.ts` | BE — toolkit resources | ~5 | nieznany | TAK |
| `tests/unit/services/v8-partner-api.test.ts` | FE API service — v8 calls | ~10 | nieznany | TAK |
| `tests/unit/services/partner-runtime-summary.test.ts` | FE — runtime summary strip | ~5 | nieznany | TAK |
| `tests/unit/services/partner-trust-runtime.test.ts` | FE — trust runtime | ~5 | nieznany | TAK |
| `tests/integration/partner-portal.test.ts` | BE integration — PartnerService (in-memory DB) | ~8 | nieznany | TAK |
| `tests/integration/partners/partners.no-demo-organization-referral-dashboard.test.ts` | BE integration — brak demo-seed w org bez partnera | ~5 | nieznany | TAK |
| `server/src/routes/v8/__tests__/v8-partner-read.test.ts` | BE — v8 partner read routes (mocked services) | ~15 | nieznany | TAK |
| `tests/e2e/partner-program-flow.spec.ts` | E2E — landing page + "Become Partner" CTA | ~3 | nieznany | TAK (e2e-nightly) |

**Pułapka:** `v8-partner-read.test.ts` mockuje wszystkie serwisy (partnerOrgResolution, PartnerReferralService etc.) — testuje routing + auth, nie rzeczywiste zachowanie SQL. Wzorzec „test serwisu fasadą mocków".

**Pokrycie scenariuszy krytycznych:**

| Scenariusz | FE | BE | E2E | CI | Luka |
|---|---|---|---|---|---|
| S1 — connect/onboarding | tak (wizard test) | częściowy (integration, nie full flow) | NIE | TAK | Brak BE integration test: POST /connect → GET /connection = connected:true |
| S2 — referral flow | tak (ReferralToolsSection) | tak (v8 read test + unit) | NIE | TAK | Brak test: campaign create → analytics reflect click |
| S3 — earnings & payout | tak (EarningsSection) | tak (payouts-auth regression) | NIE | TAK | Brak: full payout lifecycle (earn→payout phase transition) |
| S4 — certifications | NIE (brak komponentu test) | tak (partnerService.test) | NIE | TAK | Brak FE test dla certifications progress flow |
| S5 — directory listing | tak (v8-public-listing) | tak (v8 read test) | NIE | TAK | Brak: toggle listing + reflection w GET /connection |

**Backlog testowy:**
1. [P1] integration — `tests/integration/partners/` — S1 connect→dashboard E2E flow (POST /connect + GET /connection)
2. [P1] integration — `tests/integration/partners/` — S3 payout lifecycle (earn→payout phase)
3. [P2] component — `tests/components/partner/CertificationsSection.test.tsx` — S4 certification progress
4. [P2] integration — `tests/integration/partners/` — legacy earnings silent-fallback → sprawdź czy klient otrzymuje error vs hardcoded data

---

## 3. Środowiska / Railway (FAZA 3)

| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit | PENDING | PENDING (prod = 2026-05-18) | PENDING — Faza 3 niewykonana |
| Migracje modułu zastosowane | PENDING | PENDING | PENDING |
| Flagi/env wymagane | PARTNER_SELF_CONNECT_ENABLED (domyślnie false) | PARTNER_SELF_CONNECT_ENABLED (domyślnie false) | PENDING |
| Smoke endpointów | PENDING | PENDING | PENDING |
| Błędy w logach (24–48 h) | PENDING | PENDING | PENDING |

**Uwaga:** prod (2026-05-18) poprzedza kilka migracji: `726_partner_users_missing_columns.sql`, `730_partner_users_uuid_columns.sql` — prawdopodobna schema drift na prod. Migracje `20260327_partner_owned_payout_settings`, `20260331_p28_workbench_p29_partner_program_ledger`, `20260411_partner_certification_v2` też mogą być niezastosowane na prod.

---

## 4. Żywa weryfikacja frontu (FAZA 4)

**Status:** PENDING — Faza 4 niewykonana (brak przeglądarki w środowisku subagenta).

| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1 | Partner connect/onboarding | BLOCKED | — |
| S2 | Referral flow | BLOCKED | — |
| S3 | Earnings & payout | BLOCKED | — |
| S4 | Certification progress | BLOCKED | — |
| S5 | Directory listing | BLOCKED | — |

---

## 5. Kanony i standardy (FAZA 5)

**§27 TABLE_AND_PREVIEW_CANON:**
Moduł ma tabele listowe (clients, employees, attributions w sekcji referral clicks) w `PartnerPortalView.tsx`. Pełna checklista §27 A–S wymaga weryfikacji live (Faza 4 blocked). Statyczna ocena:

| Tabela/powierzchnia | Uwagi |
|---|---|
| Referred Customers / Attributions | GET /api/v8/partner/attributions — lista istnieje; layout 2-kolumnowy portalu, nie standardowe ModuleHub tabele |
| Campaign Links | rendering w ReferralToolsSection — z akcją DELETE; format unclear bez live screenshotu |
| Payouts | lista payouts w EarningsSection — brak zaznaczenia, sortowania, paginacji (est.) |

**CARD_CONTENT_FORMULA (próbka):** n.d. — Portal Partnerski nie generuje insight/initiative cards.

**Wzorzec hubowy:** `PartnerLayout` + `PartnerSidebar` (własny, niezależny od ModuleHub) — brak dynamicznych tabów dokumentów, brak MELS. Niestandardowy wzorzec ale spójny wewnętrznie.

**i18n PL/EN:** Kompletny — PL i EN mają identyczne klucze `partner.dashboard.*`, `partner.metrics.*`, `partner.certification.*`, `partner.clients.*`, `partner.resources.*` (weryfikacja python3 na plikach lokalizacyjnych). Używa fallback string jako default argument w `t()`.

**Beta-gating:** Moduł celowo poza SSOT `betaAccess.ts` — route tylko `requireAuth`, ochrona serwer-first. Zgodne z decyzją produktową.

**Stany standardowe:** ProviderHomeView, PartnerDashboardView — empty-states istnieją (uczciwe, nie hardcoded). Sekcje stub zwracają FEATURE_NOT_AVAILABLE 503 — FE chowa akcje przez `code === 'FEATURE_NOT_AVAILABLE'`.

---

## 6. Bezpieczeństwo i dostęp (FAZA 6)

**Trzy warstwy gatingu:**

| Warstwa | Nawigacja | Route (FE) | API (BE) | Dziura? |
|---|---|---|---|---|
| Dostęp do portalu | Sidebar: pozycja stopki tylko gdy `connected=true` | `ProtectedRoute requireAuth=true` (celowo, bez roli) | `router.use(verifyToken)` → `requirePartnerOrgId` per endpoint | NIE — intentional, udokumentowane AppRoutes.tsx:2231 |
| Partner data (read) | Sidebar steruje widokami | PartnerPortalViewNew renderuje "Connect" screen gdy disconnected | `getActivePartnerOrgIdForUser(userId)` → 403 gdy brak | NIE |
| Partner data (write) | akcje chowane przez FE gdy 503 | — | `requirePartnerOrgId` → scoped przez `partnerOrgId` w każdym WHERE | NIE |
| SuperAdmin settlements | /superadmin sidebar | `ProtectedRoute requiredRole=SUPERADMIN` | `verifyToken + verifySuperAdmin` | NIE |
| V8 partner bypass | — | — | `v8Router.use('/partner', attachV8Context, ...)` przed `v8OrgGate` | NIE — celowe (documented v8/index.ts:50-53) |

**Org-scope:** Wszystkie write-endpointy używają `partnerOrgId` z `getActivePartnerOrgIdForUser(userId)` — dane są scopowane do partnera, nie do organizacji tenanta. Brak tradycyjnego `organization_id` IDOR (portal partnerski ma własny boundary: `partner_org_id`). Scoping konsekwentny.

**P2 finding — zasoby bez partner-org scope w zapytaniu:**
`GET /api/partners/resources/:resourceId/download` — `SELECT FROM partner_resources WHERE id = ? AND is_active = TRUE` (`partners.routes.ts:2120-2126`) nie filtruje przez `partner_org_id`. Zasoby są globalnie dostępne (shared catalog), ale tier-check (`getEffectivePartnerTier`) jest prawidłowy. Każdy zalogowany partner może pobrać zasób z ID dowolnego innego partnera jeśli zna UUID. Severity P2 (brak eksfiltracji per-org secrets, ale enumerable UUID = brak least-privilege).

**Zasoby publiczne:** `/api/public/partner/validate-code` i `/track-click` — bez auth, brak danych wrażliwych (tylko kod + UTM). OK.

**WS/realtime:** n.d. — portal partnerski nie ma WebSocket.

**Capabilities serwerowo:** tak — stub 503 FEATURE_NOT_AVAILABLE zwracany serwerowo, FE tylko chowa UI. Tier-check dla zasobów egzekwowany serwerowo.

**Findingi:**
- [P2] `/api/partners/resources/:resourceId/download` — `WHERE id = ?` bez `partner_org_id` — każdy partner może pobierać zasoby innych partnerów przez ID. `partners.routes.ts:2120-2126`. Fix: `AND (min_partner_tier IS NULL OR TRUE)` już jest (catalog globalny) — ale rozważyć audit log z `partnerOrgId` i czy chcemy ograniczyć dostęp do zasobów per partner-tier per organizacja. Na dziś: akceptowalne (shared catalog) ale P2 do udokumentowania.
- [P2] Legacy `/api/partners/earnings` — silent fallback na hardcoded data (`commissionRate: 15`) przy DB fail — `partners.routes.ts:966-977`. Użytkownik nie wie o awarii. Fix: loguj + zwróć 503 z informacją.

---

## 7. PLAN DOKOŃCZENIA (FAZA 8)

### Fala 1 — Integralność (P0)

Brak P0 (zero cross-org WRITE, zero cichych overwrite danych produkcyjnych).

### Fala 2 — Domknięcie wartości (P1)

1. **Silent earnings fallback** — `partners.routes.ts:966-977`: `catch` z hardcoded `commissionRate: 15` wraca do klienta bez erroru; zamienić na `res.status(503).json({ success: false, error: 'Earnings temporarily unavailable', code: 'DB_ERROR' })` i zalogować. Weryfikacja: test BE sprawdzający 503 przy mock DB fail.

2. **Testy integracyjne happy path S1** — brak testu `POST /connect → GET /connection = connected:true`; dodać w `tests/integration/partners/`. Weryfikacja: nowy test zielony w CI.

3. **Testy integracyjne payout lifecycle S3** — brak testu fazy earn→payout; dodać coverage. Weryfikacja: test BE zielony.

4. **Schema drift na prod** — 4 migracje z 2026-03/04 prawdopodobnie niezastosowane na prod (2026-05-18); przed próbą otwarcia portalu dla partnerów na prod: uruchomić `railway run npm run migrate` i zweryfikować schemat. Weryfikacja: `psql -c "\d partner_payout_settings"` zwraca kolumny.

5. **PARTNER_SELF_CONNECT_ENABLED** — jeśli portal ma być otwarty na prod, flaga musi być włączona jawnie lub proces onboardingu partnera musi być inny. Decyzja produktowa wymagana.

### Fala 3 — Jakość i kanony (P2)

1. **Resource download scope** — `partners.routes.ts:2120-2126`: dodać dokumentację/komentarz że `partner_resources` to shared catalog (intentional); ewentualnie dodać audit log `partner_org_id` do tabeli `partner_resource_downloads` jeśli nie istnieje. Weryfikacja: code comment + test coverage.

2. **§27 TABLE_AND_PREVIEW_CANON dla tabel listowych** — po Fazie 4: sprawdzić Referred Customers, Campaign Links, Payouts contra checklista A–S. Priorytet: punkty F (bulk select), G (action menu), I (empty state), J (loading) dla każdej tabeli.

3. **Test certifications progress FE** — brak `tests/components/partner/CertificationsSection.test.tsx`; dodać test S4. Weryfikacja: test komponentu zielony.

4. **Dual API surface** — `/api/partners/earnings` (legacy) i `/api/v8/partner/earnings-summary` zwracają różne dane; po migracji FE całkowicie na v8 — usunąć lub permanent-deprecate legacy endpoint. Weryfikacja: grep FE za `api/partners/earnings` → 0 wywołań.

5. **Smoke endpointów na staging** (Faza 3 do wykonania) — 5 kluczowych curl: GET /api/partners/connection, GET /api/v8/partner/referral-tools, GET /api/v8/partner/program/status, GET /api/v8/partner/earnings-summary, GET /api/partners/certifications.

### Definition of Done (odhaczane przy realizacji)

- [ ] 1. Testy auto FE+BE scenariuszy krytycznych zielone w CI (P1: S1+S3 integration)
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami (screenshoty wszystkich 5 scenariuszy)
- [ ] 3. Railway: migracje zastosowane na staging+prod, flagi udokumentowane, smoke 200, czyste logi
- [ ] 4. Kanony: §27 A–S bez odstępstw P0/P1 dla tabel listowych
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (legacy earnings fallback naprawione)
- [ ] 6. Zero cichych degradacji bez komunikatu dla użytkownika
