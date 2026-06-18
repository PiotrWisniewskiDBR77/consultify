# TECZKA M26 — Portal Partnerski (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje `KARTA_AUDYTU.md` §1–§7 + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3 · enumeracja dual-router · epiki→stories Gherkin→L-xx). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja głębi (PODŁOGA): [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M26 Portal Partnerski · **Pula:** internal (partner; własny boundary `partner_org_id`, NIE `organization_id` tenanta)
- **Ocena audytu:** 53/100 · **Tier:** Alpha · **Status:** 🟦 NIEPEŁNY (Fazy 3+4) · **Rozmiar:** S-M (do 2 dni)
- **Żywy bloker:** brak P0 (zero cross-partner WRITE) — **silent earnings fallback NAPRAWIONY** (`7cf315b4b9`, zweryfikowane w kodzie 2026-06-13). Pula nietestowana na żywo (internal).
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 + Fala 2 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M26-portal-partnerski/KARTA_AUDYTU.md` · **Evidence:** brak screenshotów (Faza 4 deferred)
- **Kod:** `src/views/partner/` + `src/components/Partner*` (~15 plików, w tym `PartnerPortalView.tsx` 3310 l.) · `server/src/routes/partners.routes.ts` (**legacy, 43 endp.**) · `server/src/routes/v8/partner.routes.ts` (**v8, 25 endp.**)

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (10 funkcji + S1–S5) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟡 | karta §5 (§27 częściowe + stuby) | stany + delta stub-handling (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e (dual-router) + §1f (flagi) | **enumeracja dual-router + reguły partner-org-scope** (niżej) |
| D AI/Teresa | ⚪ N/D | — | moduł nie generuje kart AI |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | **epiki→stories Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby zmierzone** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1c/§6 | **Rejestr Wejść + Decyzji + korekta R3 + schema-drift prod** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + 10 funkcji + S1–S5: karta §0/§1.
- **Job-to-be-done:** dać partnerowi (reseller/affiliate org) portal do zarządzania połączeniem, poleceniami/kodami, prowizjami/wypłatami, certyfikacjami, profilem w katalogu i zasobami — z własnym boundary `partner_org_id`.
- **Persony/role:** zalogowany user z połączonym profilem partnera (`requireAuth` route + `requirePartnerOrgId` per write — model serwer-first, jedyny moduł z celowo luźnym route-gate, udokumentowane `AppRoutes.tsx:2231`). SuperAdmin: settlements (dual-control).
- **Zakres v1:** connection/connect · referrals (tools/analytics/campaign-links) · earnings/payouts/settings · onboarding · certifications · org profile/listing · resources (tier-check) · SuperAdmin settlements · public validate-code/track-click. **POZA v1 (świadome stuby 503):** Client Management write (clients/employees/stats/access-links), licenses, tiers — decyzja produktowa D-01 (budować/trzymać).
- **Metryka:** partner przechodzi connect→dashboard→earnings end-to-end; zero cross-partner WRITE (utrzymane).

## B · UX DOCELOWE *(link + delta + stany)*
§27 + stany: karta §5. Własny `PartnerLayout`+`PartnerSidebar` (nie ModuleHub). i18n PL/EN kompletny (`partner.*` identyczne klucze, 99 użyć `useTranslation`).
- **Stany ekranu:** pusty (disconnected → „Connect" screen), ładowanie, błąd (po `7cf315b4b9` legacy earnings = 503 DB_ERROR, nie cicha hardkodowana pustka), pełny, brak-uprawnień (brak `partner_org_id` → 403).
- **Stuby honest:** 5+ endpointów zwraca `FEATURE_NOT_AVAILABLE`/`featureUnavailable` 503, FE chowa akcje przez `code === 'FEATURE_NOT_AVAILABLE'` (uczciwa pustka, nie fałszywe KPI).
- **Delta:** §27 dla tabel listowych (Referred Customers/Campaign Links/Payouts) — sort/paginacja/empty/loading (L-05).

## C · DANE + API + REGUŁY *(enumeracja dual-router + partner-org-scope)*
- **Wiring FE↔BE↔DB:** karta §1e (migracje `215_partner_portal`, `216_partner_referral_system`, `20260327/0331/0411`, `555/556`). **Flagi:** karta §1f.
- **Model danych:** `partner_organizations`, `partner_users`, `partner_referral_tools/clicks`, `partner_campaign_links`, `partner_commission_transactions`, `partner_payouts`, `partner_program_ledger`, `partner_certifications`, `partner_resources`. Boundary = `partner_org_id` (własny, nie tenant `organization_id`).
- **API dual-router (FE ma używać wyłącznie v8 — L-07):**
  - **v8 (`v8/partner.routes.ts`, 25 endp., kanon):** referral-tools/analytics, campaign-links (CRUD scoped `partnerOrgId`), earnings-summary (`lifecyclePhase/balances`), payouts (request + P29 transition), payout-settings, onboarding (accept-terms/select-tier/complete), organization PUT (info/specializations/regions/listing), program ledger.
  - **legacy (`partners.routes.ts`, 43 endp.):** connection/connect (gated `PARTNER_SELF_CONNECT_ENABLED`), certifications, resources+download (tier-check), SuperAdmin settlements (dual-control), public validate-code/track-click. **Duplikat:** `/api/partners/earnings` (`commissionRate`) vs v8 `earnings-summary` — deprecate legacy (L-07).
  - **Stuby 503 (honest):** `POST /clients` `:1354`, `GET /clients/:id` `:1367`, `POST /employees` `:1420`, `GET /stats` `:1437`, `POST /access-links` `:1454`, `GET /licenses` `:1903`, `GET /tiers` `:2195`, +2 superadmin attributions.
- **Reguły partner-org-scope (kanon):** wszystkie write-endpointy `requirePartnerOrgId` → `getActivePartnerOrgIdForUser(userId)` → scoped `partner_org_id`. v8 partner celowo bypasses `v8OrgGate` (`v8/index.ts:51-53`, udokumentowane). Resource download `WHERE id=? AND is_active=TRUE` bez `partner_org_id` (shared catalog, tier-check OK, P2 — L-06).
- **Maszyna stanów (payout):** earn → payout-phase request → P29 lifecycle transition → ledger update (`v8/partner.routes.ts:804-935`).

## D · AI / TERESA
N/D — Portal Partnerski nie generuje insight/initiative cards ani nie używa Teresy.

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **←** M27 SuperAdmin (settlements `superAdminPartnerRouter` + partner-config), M25 Settings (auth/JWT), Public (signup validate-code/track-click), Legal (acceptDocuments onboarding). **→** M27 (partner-settlements), Sidebar FE (`connected=true` steruje widocznością). **Kręgosłup:** niezależny od Fazy 0. **Zależność blokująca:** schema na prod (5 migracji) musi być zaaplikowana przed otwarciem (L-08).

## F · EPIKI → STORIES → ZADANIA *(z karty §7, forma Gherkin)*
- **EPIK 1 — Honest degradacja (FAZA 3):** silent earnings fallback NAPRAWIONY → test regresji.
  - **Story 1.1:** jako partner chcę komunikatu przy awarii earnings. *Dane* DB fail; *gdy* `GET /api/partners/earnings`; *wtedy* 503 DB_ERROR (nie hardkodowany `commissionRate:15`). → **Z→L-01 (NAPRAWIONE `7cf315b4b9`, R3 zweryfikowane `:967`); test→L-04**
- **EPIK 2 — E2E happy-path (FAZA 3):** connect→dashboard + payout lifecycle.
  - **Story 2.1:** *Dane* user bez profilu; *gdy* `POST /connect` (flaga ON) → `GET /connection`; *wtedy* `connected:true` + dashboard. → **Z→L-02**
  - **Story 2.2:** *Dane* zarobione prowizje; *gdy* `POST /payouts/request`; *wtedy* faza earn→payout + ledger update. → **Z→L-03**
- **EPIK 3 — Schema na prod (FAZA 3):** verify 5 migracji + decyzja self-connect.
  - **Story 3.1:** *Dane* prod 2026-05-18; *gdy* `railway run npm run migrate` + `\d partner_payout_settings`; *wtedy* kolumny obecne (brak drift). → **Z→L-08**
  - **Story 3.2:** decyzja `PARTNER_SELF_CONNECT_ENABLED` na prod. → **Z→L-09 (D-02)**
- **EPIK 4 — Decyzja stuby (FAZA 3):**
  - **Story 4.1:** 5+ stubów Client Management — budować ALBO jawny `FEATURE_NOT_AVAILABLE` (DP-5: ukryj za flagą + label „wkrótce"). → **Z→L-10 (D-01)**
- **EPIK 5 — Szlif (FAZA 3/4):**
  - **Story 5.1:** deprecate legacy `/api/partners/earnings` po migracji FE na v8 (grep FE = 0). → **Z→L-07**
  - **Story 5.2:** resource download udokumentowany shared-catalog + audit log `partner_org_id`. → **Z→L-06 (D-03)**
  - **Story 5.3:** §27 dla 4 tabel + `CertificationsSection.test.tsx`. → **Z→L-05**

## G · JAKOŚĆ / DoD *(skwantyfikowane, zmierzone 2026-06-13)*
| # | Kryterium | Miara M26 (`src/components/Partner*` + `src/views/partner/`) |
|---|-----------|-----------|
| 1 | Front↔back | stuby rozstrzygnięte (budować lub jawny `FEATURE_NOT_AVAILABLE`, DP-5); legacy earnings duplikat usunięty; 0 martwych przycisków |
| 2 | Bezpieczeństwo | `requirePartnerOrgId` konsekwentny (już OK); resource download udokumentowany/audytowany; zero cross-partner WRITE |
| 3 | i18n | **0/15** plików z `isPolish` — PL/EN już kompletny (`partner.*` identyczne klucze, 99×`useTranslation`) ✅ |
| 4 | Tokeny | **2** hex w plikach partner — zweryfikować/zamienić na tokeny |
| 5 | §27 | **4** surowe `<table>` → A-S (Referred Customers/Campaign Links/Payouts) |
| 6 | E2E w PR-gate | S1 (connect→dashboard) + S3 (payout lifecycle) zielone na `Londyn` |

Scenariusze S1–S5 + ~23 pliki testów (w CI): karta §0/§2. Bezpieczeństwo: karta §6. Pułapka: `v8-partner-read.test.ts` mockuje serwisy (routing+auth, nie SQL).
- **Wydajność:** referral-analytics przy dużej liczbie kliknięć; paginacja payouts. **Telemetria:** % partnerów end-to-end connect→earnings; konwersja referral.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | rdzeń realny dual-router; 5+ stubów; brak E2E; silent earnings fallback; schema drift prod | L-02,03,08,10 |
| W-02 | **Uwagi żywe** (`UWAGI_TESTY_2026-06-13.md`) | 2026-06-13 | **brak** — pula internal nietestowana na żywo; dziedziczę z karty | — |
| W-03 | Fala 2 (korekta) | 2026-06-11 | silent earnings fallback NAPRAWIONE (`7cf315b4b9` — 503 DB_ERROR) | L-01 (R3 koryguje) |
| W-04 | Kod (R3) | 2026-06-13 | grep: `partners.routes.ts:967` = `res.status(503)...code:'DB_ERROR'`; legacy 43 endp., v8 25 endp. | L-01 (potwierdza naprawę) |
| W-05 | `_DECYZJE.md` DP-5 (stuby) | 2026-06-13 | stuby: ukryj za flagą + label „wkrótce", nie półbuduj | L-10 |
| W-06 | Feedback prod | — | portal partnerski, prod 2026-05-18 (schema drift ryzyko) | L-08 |

### 02 · Stan obecny (prawda kodu) — karta §1
REALNE: connection/connect, referrals (tools/analytics/campaign-links), earnings/payouts/settings (v8), onboarding, certifications, org profile/listing, resources (tier-check), SuperAdmin settlements, public routes. **Naprawione (R3):** silent earnings fallback → 503 DB_ERROR (`7cf315b4b9`, `:967`). STUB (honest 503): clients/employees/stats/access-links/licenses/tiers + 2 superadmin attributions. Brak martwego kodu FE.

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | silent earnings fallback (hardcoded commissionRate:15) | W-01,W-03,W-04 | `partners.routes.ts:966-977` → 503 DB_ERROR (`:967`) | P2 | — | **ZAMKNIĘTA 2026-06-17 `7cf315b4b9` — ZWERYFIKOWANE w kodzie 2026-06-17** |
| L-02 | brak E2E happy-path S1 connect→dashboard | W-01 | `tests/integration/partners/` | P1-test | 3 | **ZAMKNIĘTA 2026-06-17 `d574ccac14`** — `partners.happy-path-and-fallback.test.ts` S1 connect→dashboard (connected:true+org / false bez org). 6/6, w CI (glob `tests/integration`). |
| L-03 | brak testu payout lifecycle S3 | W-01 | `partners.routes.ts` /payouts/request | P1-test | 3 | **ZAMKNIĘTA 2026-06-17 `d574ccac14`** — POST /payouts/request → 201+payout (scope partnerOrgId) + 400 gdy brak payable. |
| L-04 | brak testu legacy earnings silent-fallback | W-01 | — | P2-test | 4 | **ZAMKNIĘTA 2026-06-17 `d574ccac14`** — GET /earnings → 503 DB_ERROR, ZERO `commissionRate:15`; + happy-path 200. |
| L-05 | §27 niezastosowany (4 `<table>`) | W-01 | `PartnerPortalView`,`EarningsSection`,`ReferralToolsSection`,`ClientAccessView` | P2 | 4 | **NAPRAWIONA 2026-06-17 `60ca5b0ce4`** — 4 tabele → `FilterableTable` (align §3.3, `EntityStatusChip`, filtry, `persistKey`, Copy/Delete→`RowActionsMenu` §9, empty/loading kanon). Zero `<table>`. Weryf.: tsc 0, Vite 200 ESM, 0 błędów konsoli. Render wizualny portalu pending (auth). i18n dla H2: `partner.clients.col.*`/`.status.*`, `partner.earnings.col.*`/`.status.*`, `partner.referrals.copyLink`, `partner.clientAccess.col.status`. |
| L-06 | resource download bez partner-org scope | W-01 | `partners.routes.ts` resource download | P2 | 3 | **ZAMKNIĘTA 2026-06-17 `d574ccac14`** (D-03) — shared-catalog by design; gate `requirePartnerOrgId`+`min_partner_tier`; audit z `partner_org_id`+`user_id` już obecny; udokumentowane komentarzem. |
| L-07 | duplikat API surface legacy vs v8 earnings | W-01 | `/api/partners/earnings` vs `/api/v8/partner/earnings-summary` | P2 | 3/4 | **NAPRAWIONA 2026-06-17 `d574ccac14`** — legacy `@deprecated` + nagłówki `Deprecation`/`Link`→v8 (RFC 8594). Usunięcie po migracji 2 callerów FE (`PartnerRuntimeSummaryStrip:86`,`EarningsSection:304`). |
| L-08 | schema drift na prod (5 migracji partner) | W-01,W-06 | prod 2026-05-18 < migracje partner | P1 env | 3 | **UDOKUMENTOWANE 2026-06-17** — runbook `M26_SCHEMA_DRIFT_RUNBOOK.md` (dry-run→verify→apply→verify). Migracja prod = Piotr (centerbeam, za zgodą), NIE agent. |
| L-09 | `PARTNER_SELF_CONNECT_ENABLED` default false | W-01 | flaga (default false) | decyzja | 3 | **ZAMKNIĘTA 2026-06-17 — DECYZJA PIOTRA: OFF w v1, self-connect → v1.1; flaga już default false (zgodna), brak zmiany kodu** |
| L-10 | 5+ stubów Client Management | W-01,W-05 | `partners.routes.ts:1354,1367,1420,1437,1454,1903,2195` | decyzja | 1/3 | **ZAMKNIĘTA 2026-06-17 `901f042212` — DP-5 wykonane**: serwer `featureNotAvailable` 503 (honest); FE `PartnerPortalView` „Add Organization"→disabled+„Wkrótce", martwy „Add New Client" quick action usunięty; `ClientAccessView` już pokazuje „Wkrótce dostępne". /stats,/licenses,/tiers,/access-links = brak callera FE. Klucz `partner.common.comingSoon`→H2. Wizual 🟦 (partner auth) |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | 5+ stubów Client Management | budować / **trzymać jako jawny `FEATURE_NOT_AVAILABLE` stub** | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-5: ukryj za flagą + label „wkrótce" (stuby Client Management)** |
| D-02 | `PARTNER_SELF_CONNECT_ENABLED` na prod | włączyć (self-connect) / inny proces onboardingu | Piotr | 2026-06-17 | **ROZSTRZYGNIĘTE → OFF w v1, self-connect → v1.1 (flaga zostaje false)** |
| D-03 | resource shared-catalog | zostaw shared + audit log / ogranicz per partner-tier | Piotr | TBD | otwarta (modułowa) |

### 05 · Flagi/rollout — `PARTNER_SELF_CONNECT_ENABLED` (false), `PARTNER_DEMO_SEED_ENABLED` (false, no-op prod), `DEMO_WRITES_ENABLED` (false), `APP_BASE_URL`. Moduł poza `betaAccess.ts` (route `requireAuth`, ochrona serwer-first celowa).
### 06 · Ryzyka — Prawdopodobna **schema drift na prod** (prod 2026-05-18 poprzedza 5 migracji partner) — otwarcie portalu bez `migrate`+verify grozi błędami runtime na produkcji klienckiej (L-08). v8 partner bypass `v8OrgGate` celowy (udokumentowany). Dev `.env` → Railway PROD.
### 07 · Log — 2026-06-13 (teczka pogłębiona): R3 potwierdza silent earnings fallback NAPRAWIONY (`7cf315b4b9`, `:967`); DP-5 (stuby) wpisane do L-10/D-01; enumeracja dual-router (43+25 endp.) + epiki Gherkin dodane. Fala 2: B 11→12; ocena 53. Re-ocena po E2E + Fazach 3/4 + schema verify.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + Fala 2 + kod-R3 + DP-5; uwagi żywe = brak) · R2 zero sierot (wejście→luka→story→DoD) · R3 status z dowodem (L-01 NAPRAWIONY — `:967` zweryfikowany w kodzie 2026-06-13) · R4 DoD z liczbami (i18n 0/15, hex 2, table 4, 43+25 endp.) · R5 decyzje przekrojowe ROZSTRZYGNIĘTE (D-01=DP-5; D-02/D-03 modułowe otwarte); pozostaje R6/żywa weryfikacja · A–E docelowy zlinkowany (D N/D) · F epiki→stories Gherkin↔luki · G DoD+S+sec+wydajność · R6 sesja żywa = Fazy 3+4 + schema verify prod. **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Prawdopodobna schema drift na prod (prod = 2026-05-18 poprzedza 5 migracji partner_users/payout/certification) oznacza, że otwarcie portalu dla partnerów na produkcji bez wcześniejszego `migrate`+verify (L-08) grozi błędami runtime u klienta.
