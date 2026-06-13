# WP M26 — Portal Partnerski · dokończenie do 100%

**Pula:** internal · **Karta:** `Harvard/modules/M26-portal-partnerski/KARTA_AUDYTU.md` (ocena 53/100) · **Rozmiar:** S-M (do 2 dni) · **Żywy bloker:** brak P0
**Faza programu:** FAZA 3 (integracja/testy + schema verify) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Jedyny moduł z celowo luźnym route-level gate (tylko `requireAuth`, udokumentowane `AppRoutes.tsx:2231`) — model serwer-first egzekwowany konsekwentnie przez `requirePartnerOrgId` na każdym write-endpoincie (własny boundary `partner_org_id`, nie `organization_id`). Rdzeń wartości REALNY end-to-end przez dual-router (legacy `/api/partners` + v8 `/api/v8/partner`): connection/connect, referrals (tools/analytics/campaign-links), earnings/payouts/settings, onboarding, certifications, organization profile/listing, resources (tier-check), SuperAdmin settlements (dual-control), public validate-code/track-click. 23 pliki testów w CI. **Naprawione w audycie:** silent earnings fallback — `commissionRate:15` hardkod → `503 DB_ERROR` (commit `7cf315b4b9`). Zero P0 (zero cross-org WRITE, zero cichego overwrite). Pozostaje: 5+ świadomych stubów (clients/employees/stats/access-links/tiers/licenses), brak E2E happy-path, legacy API duplikat, prawdopodobna schema drift na prod, §27, Fazy 3+4.

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 3 + 4)
- **[honest stub] Client Management zapis** — `POST /clients` (`:1354`), `GET /clients/:id` (`:1367`), `POST /employees` (`:1420`), `GET /stats` (`:1437`), `POST /access-links` (`:1454`), `GET /licenses` (`:1903`), `GET /tiers` (`:2195`) zwracają `FEATURE_NOT_AVAILABLE` 503; FE chowa akcje przez `code === 'FEATURE_NOT_AVAILABLE'`. Decyzja produktowa: budować albo trzymać jako jawny stub. FAZA 3.
- §27: tabele listowe (Referred Customers/Attributions, Campaign Links, Payouts) w `PartnerPortalView.tsx` — sprawdzić A–S po Fazie 4 (sort/paginacja/empty/loading). FAZA 4.

### (b) BACKEND / API (FAZA 3)
- **[P2] duplikat API surface** — `/api/partners/earnings` (legacy, `commissionRate`) vs `/api/v8/partner/earnings-summary` (v8, `lifecyclePhase/balances`) — różne kształty; FE ma używać wyłącznie v8. Fix: po migracji FE na v8 usunąć/permanent-deprecate legacy (`grep` FE `api/partners/earnings` → 0).
- **[P2] resource download bez partner-org scope** — `GET /api/partners/resources/:resourceId/download` (`:2120-2126`) `WHERE id=? AND is_active=TRUE` bez `partner_org_id` (shared catalog, tier-check OK, ale enumerable UUID). Fix: udokumentować jako shared catalog + audit log `partner_org_id`.

### (c) INTEGRACJA / TESTY (FAZA 3 + 4)
- **[P1] brak E2E happy-path S1** connect→dashboard — dodać `tests/integration/partners/` `POST /connect → GET /connection = connected:true`.
- **[P1] brak testu payout lifecycle S3** earn→payout phase transition.
- **[P2]** brak `CertificationsSection.test.tsx` (S4 FE); test legacy earnings silent-fallback → klient dostaje error nie hardcoded.
- **Pułapka:** `v8-partner-read.test.ts` mockuje serwisy (testuje routing+auth, nie SQL).
- CI: testy w CI (`vitest.config.ts:200-208`), ale `test-suite.yml` na `[main,develop]` — dodać `Londyn` (FAZA 4).

### (d) ŚRODOWISKA (FAZA 3)
- **[P1] schema drift na prod** — prod = 2026-05-18, poprzedza migracje `726_partner_users_missing_columns`, `730_partner_users_uuid_columns`, `20260327_partner_owned_payout_settings`, `20260331_p28...p29_ledger`, `20260411_partner_certification_v2`. Przed otwarciem portalu na prod: `railway run npm run migrate` + verify (`psql \d partner_payout_settings`).
- **[decyzja] `PARTNER_SELF_CONNECT_ENABLED`** (default false) — jeśli portal otwarty na prod, włączyć jawnie lub inny proces onboardingu. Decyzja produktowa.

## 3. Kroki realizacji
1. **(FAZA 3)** E2E happy-path S1 (connect→connection) + payout lifecycle S3 w `tests/integration/partners/`.
2. **(FAZA 3)** Schema verify na staging+prod (migracje zastosowane); decyzja `PARTNER_SELF_CONNECT_ENABLED`.
3. **(FAZA 3)** Decyzja o 5+ stubach (budować/jawny stub); udokumentować resource shared-catalog + audit log.
4. **(FAZA 3/4)** Usunąć/deprecate legacy `/api/partners/earnings` po migracji FE na v8.
5. **(FAZA 4)** §27 dla tabel listowych; `CertificationsSection.test.tsx`; smoke 5 endpointów na staging; trigger CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** stuby rozstrzygnięte (budować lub jawny `FEATURE_NOT_AVAILABLE`); legacy earnings duplikat usunięty; zero martwych przycisków.
2. **Bezpieczeństwo:** `requirePartnerOrgId` konsekwentny (już OK); resource download udokumentowany/audytowany; zero cross-partner WRITE.
3. **i18n:** PL/EN (już kompletny — `partner.*` identyczne klucze).
4. **Tokeny:** Visual Standard.
5. **§27:** tabele listowe (Referred Customers/Campaign Links/Payouts) A–S.
6. **E2E w PR-gate:** S1 (connect→dashboard) + S3 (payout lifecycle) zielone na `Londyn`.

## 5. Weryfikacja
- S1: nowy partner connect → `GET /connection` connected:true → dashboard (test + żywo).
- earnings: DB fail → klient dostaje `503 DB_ERROR` (już — `7cf315b4b9`), nie hardcoded.
- schema: `psql -c "\d partner_payout_settings"` zwraca kolumny na prod.
- smoke 5 endpointów staging: connection/referral-tools/program-status/earnings-summary/certifications → 200.
- Uwaga DB: dev `.env` może wskazywać Railway PROD.

## 6. Zależności
- WEJŚCIE ← M27 SuperAdmin (settlements, partner-config); ← M25 Settings (auth); ← Public (signup validate-code).
- Niezależne od kręgosłupa (Faza 0).
- Ryzyko jednym zdaniem: prawdopodobna schema drift na prod (prod 2026-05-18 poprzedza 5 migracji partner) — otwarcie portalu dla partnerów bez wcześniejszego `migrate`+verify grozi błędami runtime na produkcji klienckiej.
