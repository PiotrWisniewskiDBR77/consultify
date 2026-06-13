# TECZKA M27 — SuperAdmin (control plane) (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje `KARTA_AUDYTU.md` §1–§7 + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3 · enumeracja superadmin-gate per router · epiki→stories Gherkin→L-xx). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja głębi (PODŁOGA): [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M27 SuperAdmin (control plane) · **Pula:** internal (SUPERADMIN, cross-tenant)
- **Ocena audytu:** 58/100 · **Tier:** Alpha górny · **Status:** 🟦 NIEPEŁNY · 🟦 **WYMAGA KONTA SUPERADMIN** do pełnej weryfikacji (Fazy 3/4)
- **Żywy bloker:** brak P0 — **oba P0 boczne NAPRAWIONE** (`91c8245559`, zweryfikowane w kodzie 2026-06-13); P1 llm purposes/market global writes pozostają. Pula nietestowana na żywo (internal).
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 + Fala 2 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M27-superadmin/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md, f2_tests_report.md, f56_kanon_sec.md` · `[[finding_feedback_system_audit]]`
- **Kod:** `src/views/superadmin/` + `src/components/SuperAdmin/` (**185 plików ts/tsx, 165 tsx**, zmierzone 2026-06-13) · `server/src/routes/{superadmin,llm,virtual-workers,feedback}.routes.ts` · `server/src/middleware/superAdmin.middleware.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (S1–S7, 60+ zakł.) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟡 | karta §5 (shell + §27 + i18n 114/124) | stany + delta i18n/dead code (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e + §6 (gate per router) | **tabela superadmin-gate per router (zweryfikowana)** (niżej) |
| D AI/Teresa | 🟢 | karta §1 (AI providers/tiers/personas) | granice (niżej) |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | **epiki→stories Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby zmierzone** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1c/§6 | **Rejestr Wejść + Decyzji + korekta R3 (P0) + DP-10 i18n + 🟦 konto superadmin** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + S1–S7 + 60+ zakładek: karta §0/§1.
- **Job-to-be-done:** dać platformie control-plane — zarządzanie tenantami/userami cross-tenant, AI Operations (providers/tiers/routing/personas), feature flags, Platform Security (roles/SSO/SCIM), governance/audit, revenue/Stripe — z fail-closed gatingiem SUPERADMIN.
- **Persony/role:** wyłącznie SUPERADMIN (rola ZAWSZE z DB, token-role ignorowany dla elewacji — `superAdmin.middleware.ts:403-426`, fail-closed 403). Org-admin NIE ma dostępu (P0 superadmin≥admin zamknięty dwukierunkowo).
- **Zakres v1:** Tenant&User Ops · AI Operations (27 pod-zakł.) · System (feature flags) · Platform Security · Governance/audit · Commercial/Revenue (Stripe). **POZA v1:** martwy płaski `AIPlatformModule.tsx` (152 l., żywy = folder); orphan `IAMModuleView.tsx`. **i18n control-plane = świadomy dług internal (DP-10), NIE tłumaczyć w v1.**
- **Metryka:** control-plane realny (~95%, nie fasada); non-superadmin odrzucony 403 na każdym endpoincie (twarde `===`).

## B · UX DOCELOWE *(link + delta + stany)*
Shell + §27 + i18n: karta §5. Dedykowany SuperAdmin shell + `SuperAdminSidebar` spójny.
- **Stany ekranu:** pusty (brak tenantów), ładowanie, błąd (po `69ffc1fd86` FeedbackBacklog bez secret-leak; SSO bez crash), pełny, brak-uprawnień (non-superadmin → access-denied, twarde 403).
- **Delta jakościowa (świadomy dług internal DP-10):** i18n ~150/165 tsx plików bez `t()` (tylko 15 ma `useTranslation`) = hardkod EN ~114/124 plików — L-06 (DP-10 = NIE tłumaczyć v1, udokumentować); 70 hex literałów — L-07; martwy płaski moduł + orphan — L-05.

## C · DANE + API + REGUŁY *(tabela superadmin-gate per router — zweryfikowana 2026-06-13)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (feature flags platformy zarządzane stąd).
- **Model danych:** `llm_providers`, `llm_tier_assignments` (global), `virtual_workers` (global persony Teresa/Anna), `feature_flags`+`feature_flag_history`, `ai_purposes`/`ai_market_inbox` (global), billing/invoices, audit. Pułapki bigint/jsonb → `pgFlags.ts`.
- **Reguły superadmin-gate (kanon, tabela per router — zweryfikowane w kodzie):**

  | Router | Gate (zweryfikowany) | Werdykt |
  |---|---|---|
  | `superadmin.routes.ts` | `verifyToken→requireSuperAdmin→requireAudit` + capability sub-gates | **WZORCOWY** |
  | `superAdmin.middleware.ts:403-426` | rola ZAWSZE z DB, fail-closed 403 (`:407,:420`) | **WZORCOWY** |
  | `llm.routes.ts` `/providers/:id/tier` (`:779`) | `verifySuperAdmin` | OK |
  | `llm.routes.ts` `/tiers/assign` POST/DELETE (`:793,799`) + `/tiers/priority` PUT (`:805`) | `verifySuperAdmin` | **NAPRAWIONE P0** (`91c8245559`) |
  | `virtual-workers.routes.ts` (`:22`) | `router.use(requireRole('super_admin'))` only | **NAPRAWIONE P0** (`91c8245559`) |
  | `llm.routes.ts` purposes/market | `verifyAdmin`/`verifyToken` na globalnych `ai_purposes`/`ai_market_inbox` | **P1 SEC-03/04 OTWARTE** — L-03/L-04 |

- **Obserwacja systemowa:** side-router-weak-gate to powtarzalny wzorzec (M20/M16/M24/M27) — Krok 6 ma przeskanować WSZYSTKIE mounty pod routery ze słabszym gate niż główny odpowiednik.

## D · AI / TERESA *(link)*
- **Co steruje:** AI providers/tiers/routing (globalna `llm_tier_assignments`), virtual workers (platformowe persony Teresa/Anna — global `virtual_workers`), AI purposes/market. P0 hijacku routingu/person NAPRAWIONE (`91c8245559`).
- **Granice:** api_key strippowany (`has_api_key`, `LLMController.ts:110/193` — brak wycieku sekretów providerów); nie generuje kart (CARD_CONTENT_FORMULA N/D).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** wszystkie org (tenant ops/billing/module-access cross-tenant), cała platforma (feature flags + AI config/routing), M22 AI OS (providers/tiers/personas). **←** M26 Portal (settlements/partner-config). **Kręgosłup:** niezależny od Fazy 0. **Zależność blokująca (weryfikacja):** Fazy 3/4 wymagają konta SUPERADMIN (🟦, D-02).

## F · EPIKI → STORIES → ZADANIA *(z karty §7, forma Gherkin)*
- **EPIK 1 — P0 boczne zabezpieczone (FAZA 3):** llm tiers + virtual-workers NAPRAWIONE → E2E RBAC-reject.
  - **Story 1.1:** jako zwykły user chcę dostać 403 na globalnym routingu AI. *Dane* user dowolnego tenanta; *gdy* `POST /api/llm/tiers/assign`; *wtedy* 403 (nie hijack `llm_tier_assignments`). → **Z→L-08 (P0 NAPRAWIONE `91c8245559`; test)**
  - **Story 1.2:** jako org-admin chcę dostać 403 na platformowych personach. *Dane* org-admin; *gdy* `POST /api/virtual-workers`; *wtedy* 403 (`requireRole('super_admin')` only). → **Z→L-08**
- **EPIK 2 — P1 domknięte (FAZA 3):** `verifySuperAdmin` na llm purposes/market + skan side-router-weak-gate.
  - **Story 2.1:** *Dane* org-admin; *gdy* `POST /llm/purposes` / `/purposes/:p/assignments` / `PUT /llm/org/:id/policy`; *wtedy* 403. → **Z→L-03**
  - **Story 2.2:** *Dane* zalogowany non-superadmin; *gdy* `POST /llm/market/openrouter/sync` / `PUT /llm/market/inbox/:id`; *wtedy* 403. → **Z→L-04**
- **EPIK 3 — Live-verify bugów (FAZA 3, 🟦 konto superadmin):**
  - **Story 3.1:** *Dane* konto superadmin; *gdy* FeedbackBacklog + SSOConfiguration render; *wtedy* brak secret-path leak (SQLSTATE/`/secrets`), brak crash `providerType.replace()`. → **Z→L-09 (NAPRAWIONE `69ffc1fd86`, live-verify 🟦)**
  - **Story 3.2:** *Dane* deploy; *gdy* `GET /feedback/pulse|feature`; *wtedy* 200 (nie 500). → **Z→L-10 (NAPRAWIONE w kodzie `36ceb52c60`, deploy pending)**
- **EPIK 4 — Czystość kodu (FAZA 3):**
  - **Story 4.1:** wytnij płaski `AIPlatformModule.tsx` (152 l., 0 importów) + orphan `IAMModuleView` (70 l., 0 API). → **Z→L-05**
- **EPIK 5 — Szlif (FAZA 4):**
  - **Story 5.1:** i18n control-plane — DP-10 = świadomy dług internal udokumentowany (NIE tłumaczyć ~114 plików w v1) ALBO przetłumaczyć. → **Z→L-06 (D-01=DP-10)**
  - **Story 5.2:** 70 hex → tokeny (DP-8 palety legalne). → **Z→L-07**
  - **Story 5.3:** realna persyst. testy (zdjąć mock-gate/mock-DB) + stale-import + `<Router>`. → **Z→L-11**

## G · JAKOŚĆ / DoD *(skwantyfikowane, zmierzone 2026-06-13)*
| # | Kryterium | Miara M27 (`src/views/superadmin/` + `src/components/SuperAdmin/` = **185 plików ts/tsx, 165 tsx**) |
|---|-----------|-----------|
| 1 | Front↔back | secret-leak/SSO crash zweryfikowane (`69ffc1fd86`); feedback 500 wdrożony (`36ceb52c60`); martwy kod usunięty |
| 2 | Bezpieczeństwo | oba P0 boczne zamknięte ✅ (`91c8245559`: tiers/assign+priority `verifySuperAdmin` `:793/799/805`, virtual-workers `requireRole('super_admin')` `:22`) + testy; P1 llm purposes/market → `verifySuperAdmin` (admin→403) |
| 3 | i18n | **~150/165** tsx bez `t()` (tylko **15** ma `useTranslation`); hardkody EN ~114/124 plików — **DP-10 = świadomy dług internal** (udokumentować, NIE tłumaczyć v1) |
| 4 | Tokeny | **70** hex w surface superadmin → tokeny (DP-8: palety legalne) |
| 5 | §27 | **73** surowych `<table>` → A-S (organizations/users/audit/invoices/flags) |
| 6 | E2E w PR-gate | RBAC-reject (non-superadmin→403, twarde `===`) na każdej sekcji + bocznych routerach llm/virtual-workers zielone na `Londyn`; zacieśnić `[401,403,404]`→`403` |

Scenariusze S1–S7 + ~502 PASS/9 FAIL: karta §0/§2. Bezpieczeństwo: karta §6. Pułapka: `*.test.js` uderzają w realny PG (`role "iris"`) maskowane permisywnym `VALID_STATUSES`; „REAL integration" mockuje gate.
- **Wydajność:** cross-tenant listy (paginacja organizations/users). **Telemetria:** próby non-superadmin odrzucone; pokrycie RBAC-reject per sekcja.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | ~95% realny; główny gate wzorcowy; 2 boczne P0 (potem naprawione); 2×P1 llm; i18n 114/124 | L-01,02,03,04,06,07 |
| W-02 | **Uwagi żywe** (`UWAGI_TESTY_2026-06-13.md`) | 2026-06-13 | **brak** — pula internal nietestowana na żywo; 🟦 wymaga konta superadmin; dziedziczę z karty | — |
| W-03 | Re-audit + Fala 2 | 2026-06-11 | P0 boczne naprawione (`91c8245559`); FeedbackBacklog secret + SSO crash (`69ffc1fd86`); feedback 500 (`36ceb52c60`) | L-01,02,09,10 (R3 koryguje) |
| W-04 | Kod (R3) | 2026-06-13 | grep: tiers/assign+priority `verifySuperAdmin`(:793/799/805); virtual-workers `requireRole('super_admin')`(:22); middleware fail-closed 403(:407/:420); 185 plików/165 tsx/15 useTranslation/70 hex/73 table | L-01,02 (potwierdza) |
| W-05 | `_DECYZJE.md` DP-10 (i18n internal) + DP-8 (palety) | 2026-06-13 | i18n internal = świadomy dług, NIE tłumaczyć v1; palety legalne | L-06, L-07 |
| W-06 | `[[finding_feedback_system_audit]]` + feedback prod | — | pulse/feature 500 (brak tabel); fix `36ceb52c60` live-verify pending | L-10 |

### 02 · Stan obecny (prawda kodu) — karta §1
REALNE ~95% z 60+ zakładek (Tenant Ops, AI Operations 27 pod-zakł., System, Governance, Platform Security) z persystencją. **Naprawione (R3):** llm tiers/virtual-workers gate (`91c8245559`), FeedbackBacklog secret-leak + SSO crash (`69ffc1fd86`), feedback 500 w kodzie (`36ceb52c60`, live-verify pending). MARTWE: płaski `AIPlatformModule.tsx` (152 l.), orphan `IAMModuleView.tsx`. OTWARTE: 2×P1 llm purposes/market.

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | llm tiers/assign+priority bez gate (global AI hijack) | W-01,W-03,W-04 | `llm.routes.ts:793,799,805` → `verifySuperAdmin` | P0 sec | — | **STALE-zweryfikowane: NAPRAWIONE** `91c8245559` (kod 2026-06-13: `verifySuperAdmin` `:793/799/805`) |
| L-02 | virtual-workers przepuszcza org-admina (global persony) | W-01,W-03,W-04 | `virtual-workers.routes.ts:22` → `requireRole('super_admin')` only | P0 sec | — | **STALE-zweryfikowane: NAPRAWIONE** `91c8245559` (kod 2026-06-13: `:22`) |
| L-03 | llm purposes global writes (verifyAdmin) | W-01 | `POST /llm/purposes`, `/purposes/:purpose/assignments`, `PUT /llm/org/:id/policy` | P1 sec | 3 | otwarta (→ `verifySuperAdmin`) |
| L-04 | llm market global writes (verifyToken) | W-01 | `POST /llm/market/openrouter/sync`, `PUT /llm/market/inbox/:id` | P1 sec | 3 | otwarta (→ `verifySuperAdmin`) |
| L-05 | martwy płaski `AIPlatformModule.tsx` + orphan `IAMModuleView` | W-01 | `views/superadmin/AIPlatformModule.tsx` (152 l., 0 importów); `iam/IAMModuleView.tsx` (70 l., 0 API) | P2 | 3 | otwarta |
| L-06 | i18n hardkod EN ~114/124 plików | W-01,W-05 | ~150/165 tsx bez `t()` (zmierzone 2026-06-13) | P2 | 4 | otwarta → **DP-10 (świadomy dług internal, udokumentować)** |
| L-07 | 70 hex literałów | W-01,W-05 | 70 w surface (zmierzone 2026-06-13) | P3 | 4 | otwarta (DP-8 palety legalne) |
| L-08 | brak E2E non-superadmin→403; asercje `[401,403,404]` maskują | W-01 | route-testy; `superAdmin.middleware.test.ts` 42/42 | P0-test | 3 | otwarta (twarde `===403` + boczne routery) |
| L-09 | FeedbackBacklog secret-path leak + SSO crash | W-03 | `SuperAdminFeedbackBacklogView`; `SSOConfigurationView.tsx:484` | P0-bug | — | **NAPRAWIONE** `69ffc1fd86` (live-verify 🟦 pending) |
| L-10 | feedback 500 (pulse/feature) | W-06 | `feedback.routes.ts:158/177/466` | P1 | 3 | **NAPRAWIONE w kodzie** `36ceb52c60` (live-verify deploy pending) |
| L-11 | realna persyst. testy maskowane (mock-gate/mock-DB) + stale-import + brak `<Router>` | W-01 | `*.test.js`; `OverviewModule.root-closure`; Feedback/Analytics | P1-test | 3/4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | i18n control-plane (DBR77-only) | przetłumaczyć 114 plików / **świadomy dług internal udokumentowany** | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-10: świadomy dług internal control-plane, NIE tłumaczyć v1** |
| D-02 | live-verify P0/P1 (wymaga konta superadmin + control-plane) | kiedy/kto wykonuje 🟦 Fazę 3/4 | Piotr | TBD | otwarta — wymaga konta superadmin |

### 05 · Flagi/rollout — feature flags platformy (per-flag, zarządzane stąd); gating SUPERADMIN (DB-verified fail-closed). 🟦 pełna weryfikacja wymaga konta superadmin. DP-10: i18n internal = dług świadomy.
### 06 · Ryzyka — Pełna weryfikacja Fazy 3/4 (live P0/P1 proof na control-plane) **WYMAGA konta superadmin (🟦)** — bez niego DoD #2/#6 nie domknie się, deferred pozostaje. Dev `.env` → Railway PROD czyni testy zapisu na control-plane szczególnie ryzykownymi (NAJWYŻSZA ostrożność, read-only). Side-router-weak-gate to wzorzec systemowy (skan wszystkich mountów).
### 07 · Log — 2026-06-13 (teczka pogłębiona): R3 potwierdza oba P0 boczne NAPRAWIONE (`91c8245559`, `:793/799/805` + `:22`), L-09 `69ffc1fd86`, L-10 `36ceb52c60` (live-verify pending); DP-10 (i18n internal) + DP-8 (palety) wpisane; tabela superadmin-gate per router zweryfikowana + epiki Gherkin dodane. Re-audit 2026-06-11: F 3→7; Fala 2: A 23→24; ocena 58. Re-ocena po Fazach 3/4 (🟦 konto superadmin).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + re-audit + kod-R3 + feedback-finding + DP-10/DP-8; uwagi żywe = brak, 🟦 wymaga konta superadmin) · R2 zero sierot (wejście→luka→story→DoD) · R3 statusy z dowodem (L-01/02 NAPRAWIONE — gate zweryfikowany w kodzie 2026-06-13; L-09/10 z commitami, live-verify pending) · R4 DoD z liczbami (i18n ~150/165, hex 70, table 73) · R5 decyzje przekrojowe ROZSTRZYGNIĘTE (D-01=DP-10; D-02 otwarta — wymaga konta superadmin); pozostaje R6/żywa weryfikacja (M27 wymaga konta superadmin) · A–E docelowy zlinkowany · F epiki→stories Gherkin↔luki · G DoD+S+sec+wydajność · R6 sesja żywa = Fazy 3+4 (🟦 konto superadmin). **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Domknięcie DoD #2/#6 (live proof P0/P1 na control-plane) WYMAGA konta superadmin, a ponieważ dev `.env` może wskazywać Railway PROD, testy zapisu na control-plane są szczególnie ryzykowne — stąd 🟦 deferred-status pozostaje do świadomej, read-only sesji właściciela.
