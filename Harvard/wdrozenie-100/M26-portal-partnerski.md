# TECZKA M26 — Portal Partnerski (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje `KARTA_AUDYTU.md` §1–§7 + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M26 Portal Partnerski · **Pula:** internal (partner; własny boundary `partner_org_id`)
- **Ocena audytu:** 53/100 · **Tier:** Alpha · **Status:** 🟦 NIEPEŁNY · **Rozmiar:** S-M (do 2 dni)
- **Żywy bloker:** brak P0 (zero cross-partner WRITE) — **silent earnings fallback NAPRAWIONY** (`7cf315b4b9`). Pula nietestowana na żywo.
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 + Fala 2 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M26-portal-partnerski/KARTA_AUDYTU.md` · **Evidence:** brak screenshotów (Faza 4 deferred)
- **Kod:** `src/views/partner/` + `src/components/Partner*` (15 plików) · `server/src/routes/partners.routes.ts` (legacy) · `server/src/routes/v8/partner.routes.ts` (v8) · `PartnerPortalView.tsx`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (10 funkcji + S1–S5) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟡 | karta §5 (§27 częściowe + stuby) | stany + delta stub-handling |
| C Dane+API+reguły | 🟢 | karta §1e (dual-router) + §1f (flagi) | reguły partner-org-scope (niżej) |
| D AI/Teresa | ⚪ N/D | — | moduł nie generuje kart AI |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | przeformułowane na epiki↔luki |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1c/§6 | **Rejestr Wejść + Decyzji + korekta R3** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + 10 funkcji + S1–S5: karta §0/§1.
- **Job-to-be-done:** dać partnerowi (reseller/affiliate org) portal do zarządzania połączeniem, poleceniami/kodami, prowizjami/wypłatami, certyfikacjami, profilem w katalogu i zasobami — z własnym boundary `partner_org_id` (nie `organization_id` tenanta).
- **Persony/role:** zalogowany user z połączonym profilem partnera (`requireAuth` route + `requirePartnerOrgId` per write — model serwer-first, jedyny moduł z celowo luźnym route-gate, udokumentowane `AppRoutes.tsx:2231`). SuperAdmin: settlements (dual-control).
- **Zakres v1:** connection/connect · referrals (tools/analytics/campaign-links) · earnings/payouts/settings · onboarding · certifications · org profile/listing · resources (tier-check) · SuperAdmin settlements · public validate-code/track-click. **POZA v1 (świadome stuby 503):** Client Management write (clients/employees/stats/access-links), licenses, tiers — decyzja produktowa (budować/trzymać).
- **Metryka:** partner przechodzi connect→dashboard→earnings end-to-end; zero cross-partner WRITE (utrzymane).

## B · UX DOCELOWE *(link + delta)*
§27 + stany: karta §5. Własny `PartnerLayout`+`PartnerSidebar` (nie ModuleHub). i18n PL/EN kompletny (`partner.*` identyczne klucze, 99 użyć `useTranslation`). **Stuby honest:** 5+ endpointów zwraca `FEATURE_NOT_AVAILABLE` 503, FE chowa akcje przez `code === 'FEATURE_NOT_AVAILABLE'` (uczciwa pustka, nie fałszywe KPI). **Delta:** §27 dla tabel listowych (Referred Customers/Campaign Links/Payouts) — sort/paginacja/empty/loading (L-05).

## C · DANE + API + REGUŁY *(link + partner-org-scope)*
- **Wiring FE↔BE↔DB:** karta §1e (dual-router; migracje `215/216_partner_*`, `20260327/0331/0411`). **Flagi:** karta §1f.
- **Reguły partner-org-scope (kanon):** wszystkie write-endpointy `requirePartnerOrgId` → `getActivePartnerOrgIdForUser(userId)` → scoped `partner_org_id`. v8 partner celowo bypasses `v8OrgGate` (`v8/index.ts:51-53`, udokumentowane). Resource download: `WHERE id=? AND is_active=TRUE` bez `partner_org_id` (shared catalog, tier-check OK, P2 — L-06).
- **Duplikat surface:** `/api/partners/earnings` (legacy, `commissionRate`) vs `/api/v8/partner/earnings-summary` (v8, `lifecyclePhase/balances`) — FE ma używać wyłącznie v8 (L-07).

## D · AI / TERESA
N/D — Portal Partnerski nie generuje insight/initiative cards ani nie używa Teresy.

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **←** M27 SuperAdmin (settlements + partner-config), M25 Settings (auth/JWT), Public (signup validate-code/track-click), Legal (acceptDocuments onboarding). **→** M27 (partner-settlements via `superAdminPartnerRouter`), Sidebar FE (`connected=true` steruje widocznością). **Kręgosłup:** niezależny od Fazy 0.

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Honest degradacja (FAZA 3):** silent earnings fallback NAPRAWIONY (L-01) → test regresji (L-04). [karta §7 Fala 2]
- **EPIK 2 — E2E happy-path (FAZA 3):** connect→dashboard S1 + payout lifecycle S3 w `tests/integration/partners/` (L-02, L-03). [karta §7 Fala 2]
- **EPIK 3 — Schema na prod (FAZA 3):** verify 5 migracji partner na prod (2026-05-18 poprzedza je) + decyzja `PARTNER_SELF_CONNECT_ENABLED` (L-08, L-09). [karta §7 Fala 2]
- **EPIK 4 — Decyzja stuby (FAZA 3):** 5+ stubów Client Management — budować lub jawny stub (L-10, decyzja D-01). [karta §7 Fala 1]
- **EPIK 5 — Szlif (FAZA 3/4):** legacy earnings deprecate + resource download udokumentowany/audytowany + §27 + `CertificationsSection.test.tsx` (L-05, L-06, L-07). [karta §7 Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M26 (zmierzone 2026-06-13, `src/components/Partner*` + `src/views/partner/` = 15 plików ts/tsx) |
|---|-----------|-----------|
| 1 | Front↔back | stuby rozstrzygnięte (budować lub jawny `FEATURE_NOT_AVAILABLE`); legacy earnings duplikat usunięty; 0 martwych przycisków |
| 2 | Bezpieczeństwo | `requirePartnerOrgId` konsekwentny (już OK); resource download udokumentowany/audytowany; zero cross-partner WRITE |
| 3 | i18n | **0/15** plików z `isPolish` — PL/EN już kompletny (`partner.*` identyczne klucze, 99×`useTranslation`) ✅ |
| 4 | Tokeny | **2** hex w 15 plikach — zweryfikować/zamienić na tokeny |
| 5 | §27 | **4** surowe `<table>` → A-S (Referred Customers/Campaign Links/Payouts) |
| 6 | E2E w PR-gate | S1 (connect→dashboard) + S3 (payout lifecycle) zielone na `Londyn` |

Scenariusze S1–S5 + ~23 pliki testów: karta §0/§2. Bezpieczeństwo: karta §6. Pułapka: `v8-partner-read.test.ts` mockuje serwisy (routing+auth, nie SQL).

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | rdzeń realny dual-router; 5+ stubów; brak E2E; silent earnings fallback; schema drift prod | L-02,03,08,10 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak** — pula nietestowana na żywo; dziedziczę z karty | — |
| W-03 | Fala 2 (korekta) | 2026-06-11 | silent earnings fallback NAPRAWIONE (`7cf315b4b9` — 503 DB_ERROR) | L-01 (R3 koryguje) |
| W-04 | Kod (R3) | 2026-06-13 | commit `7cf315b4b9` istnieje (M21+M26+M24 color/earnings 503/dead sidebar) | L-01 (potwierdza) |
| W-05 | Feedback prod | — | brak bezpośredni — portal partnerski, prod 2026-05-18 (schema drift ryzyko) | L-08 |

### 02 · Stan obecny (prawda kodu) — karta §1
REALNE: connection/connect, referrals (tools/analytics/campaign-links), earnings/payouts/settings (v8), onboarding, certifications, org profile/listing, resources (tier-check), SuperAdmin settlements, public routes. **Naprawione (R3):** silent earnings fallback → 503 DB_ERROR (`7cf315b4b9`). STUB (honest 503): clients/employees/stats/access-links/licenses/tiers + 2 superadmin attributions. Brak martwego kodu FE.

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | silent earnings fallback (hardcoded commissionRate:15) | W-01,W-03 | `partners.routes.ts:966-977` → 503 DB_ERROR | P2 | — | **STALE-zweryfikowane: NAPRAWIONE** `7cf315b4b9` (commit istnieje; karta §1c/§7 potwierdza) |
| L-02 | brak E2E happy-path S1 connect→dashboard | W-01 | `tests/integration/partners/` brak | P1-test | 3 | otwarta |
| L-03 | brak testu payout lifecycle S3 | W-01 | brak earn→payout transition | P1-test | 3 | otwarta |
| L-04 | brak testu legacy earnings silent-fallback | W-01 | — | P2-test | 4 | otwarta |
| L-05 | §27 niezastosowany (4 `<table>`) | W-01 | tabele listowe `PartnerPortalView.tsx` | P2 | 4 | otwarta |
| L-06 | resource download bez partner-org scope | W-01 | `partners.routes.ts:2120-2126` (shared catalog, tier-check OK) | P2 | 3 | otwarta (udokumentować+audit log) |
| L-07 | duplikat API surface legacy vs v8 earnings | W-01 | `/api/partners/earnings` vs `/api/v8/partner/earnings-summary` | P2 | 3/4 | otwarta (deprecate legacy po migracji FE) |
| L-08 | schema drift na prod (5 migracji partner) | W-01,W-05 | prod 2026-05-18 < `726/730_partner_users`, `20260327/0331/0411` | P1 env | 3 | otwarta (migrate+verify przed otwarciem) |
| L-09 | `PARTNER_SELF_CONNECT_ENABLED` default false | W-01 | flaga | decyzja | 3 | **D-02** |
| L-10 | 5+ stubów Client Management | W-01 | `partners.routes.ts:1354,1367,1420,1437,1454,1903,2195` | decyzja | 1/3 | **D-01** |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | 5+ stubów Client Management | budować / trzymać jako jawny `FEATURE_NOT_AVAILABLE` stub | Piotr | TBD | otwarta |
| D-02 | `PARTNER_SELF_CONNECT_ENABLED` na prod | włączyć (self-connect) / inny proces onboardingu | Piotr | TBD | otwarta |
| D-03 | resource shared-catalog | zostaw shared + audit log / ogranicz per partner-tier | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — `PARTNER_SELF_CONNECT_ENABLED` (false), `PARTNER_DEMO_SEED_ENABLED` (false, no-op prod), `DEMO_WRITES_ENABLED` (false), `APP_BASE_URL`. Moduł poza `betaAccess.ts` (route `requireAuth`, ochrona serwer-first celowa).
### 06 · Ryzyka — Prawdopodobna schema drift na prod (prod 2026-05-18 poprzedza 5 migracji partner) — otwarcie portalu bez `migrate`+verify grozi błędami runtime na produkcji klienckiej. v8 partner bypass `v8OrgGate` celowy (udokumentowany). Dev `.env` → Railway PROD.
### 07 · Log — 2026-06-13 (teczka): R3 potwierdza silent earnings fallback NAPRAWIONY (`7cf315b4b9`). Fala 2: B 11→12; ocena 53. Re-ocena po E2E + Fazach 3/4 + schema verify.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + Fala 2 + kod-R3; uwagi żywe = brak) · R2 zero sierot · R3 status z dowodem (L-01 NAPRAWIONY — commit zweryfikowany, karta potwierdza) · R4 DoD z liczbami (i18n 0/15, hex 2, table 4) · R5 decyzje z właścicielem (terminy TBD) · A–E docelowy zlinkowany (D N/D) · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Fazy 3+4 + schema verify prod. **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Prawdopodobna schema drift na prod (prod = 2026-05-18 poprzedza 5 migracji partner_users/payout/certification) oznacza, że otwarcie portalu dla partnerów na produkcji bez wcześniejszego `migrate`+verify grozi błędami runtime u klienta.
