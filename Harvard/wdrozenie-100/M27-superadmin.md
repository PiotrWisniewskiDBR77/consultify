# TECZKA M27 — SuperAdmin (control plane) (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje `KARTA_AUDYTU.md` §1–§7 + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M27 SuperAdmin (control plane) · **Pula:** internal (SUPERADMIN, cross-tenant)
- **Ocena audytu:** 58/100 · **Tier:** Alpha górny · **Status:** 🟦 NIEPEŁNY · 🟦 **WYMAGA KONTA SUPERADMIN** do pełnej weryfikacji
- **Żywy bloker:** brak P0 — **oba P0 boczne NAPRAWIONE** (`91c8245559`); P1 llm purposes/market global writes pozostają. Pula nietestowana na żywo.
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 + Fala 2 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M27-superadmin/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md, f2_tests_report.md, f56_kanon_sec.md` · `[[finding_feedback_system_audit]]`
- **Kod:** `src/views/superadmin/` + `src/components/SuperAdmin/` (185 plików ts/tsx) · `server/src/routes/{superadmin,llm,virtual-workers,feedback}.routes.ts` · `server/src/middleware/superAdmin.middleware.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (S1–S7, 60+ zakł.) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟡 | karta §5 (shell + §27 + i18n 114/124) | stany + delta i18n/dead code |
| C Dane+API+reguły | 🟢 | karta §1e + §6 (gate per router) | reguły superadmin-gate (niżej) |
| D AI/Teresa | 🟢 | karta §1 (AI providers/tiers/personas) | granice (niżej) |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | przeformułowane na epiki↔luki |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1c/§6 | **Rejestr Wejść + Decyzji + korekta R3 (P0)** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + S1–S7 + 60+ zakładek: karta §0/§1.
- **Job-to-be-done:** dać platformie control-plane — zarządzanie tenantami/userami cross-tenant, AI Operations (providers/tiers/routing/personas), feature flags, Platform Security (roles/SSO/SCIM), governance/audit, revenue/Stripe — z fail-closed gatingiem SUPERADMIN.
- **Persony/role:** wyłącznie SUPERADMIN (rola ZAWSZE z DB, token-role ignorowany dla elewacji — `superAdmin.middleware.ts:403-426`, fail-closed 403). Org-admin NIE ma dostępu (P0 superadmin≥admin zamknięty dwukierunkowo).
- **Zakres v1:** Tenant&User Ops · AI Operations (27 pod-zakł.) · System (feature flags) · Platform Security · Governance/audit · Commercial/Revenue (Stripe). **POZA v1:** martwy płaski `AIPlatformModule.tsx` (152 l., żywy = folder); orphan `IAMModuleView.tsx`.
- **Metryka:** control-plane realny (~95%, nie fasada); non-superadmin odrzucony 403 na każdym endpoincie.

## B · UX DOCELOWE *(link + delta)*
Shell + §27 + i18n: karta §5. Dedykowany SuperAdmin shell + `SuperAdminSidebar` spójny. **Delta jakościowa (świadomy dług internal):** i18n 114/124 (~150/165 tsx) plików bez `t()` (hardkod EN) — L-06; 45–70 hex literałów — L-07; martwy płaski moduł + orphan — L-05.

## C · DANE + API + REGUŁY *(link + superadmin-gate)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (feature flags platformy zarządzane stąd).
- **Reguły superadmin-gate (kanon, tabela per router — karta §6):**
  - `superadmin.routes.ts` — `verifyToken→requireSuperAdmin→requireAudit` + capability sub-gates. **WZORCOWY.**
  - `llm.routes.ts` tiers/assign+priority — `verifySuperAdmin`. **NAPRAWIONE P0** (`91c8245559`).
  - `virtual-workers.routes.ts` — `requireRole('super_admin')` only. **NAPRAWIONE P0** (`91c8245559`).
  - `llm.routes.ts` purposes/market — `verifyAdmin`/`verifyToken` na globalnych `ai_purposes`/`ai_market_inbox` (**P1 SEC-03/04 OTWARTE** — L-03/L-04).
- **Obserwacja systemowa:** side-router-weak-gate to powtarzalny wzorzec (M20/M16/M24/M27) — Krok 6 ma przeskanować WSZYSTKIE mounty pod routery ze słabszym gate niż główny odpowiednik.

## D · AI / TERESA *(link)*
- **Co steruje:** AI providers/tiers/routing (globalna `llm_tier_assignments`), virtual workers (platformowe persony Teresa/Anna — global `virtual_workers`), AI purposes/market. P0 hijacku routingu/person NAPRAWIONE (`91c8245559`).
- **Granice:** api_key strippowany (`has_api_key`, `LLMController.ts:110/193` — brak wycieku sekretów providerów).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** wszystkie org (tenant ops/billing/module-access cross-tenant), cała platforma (feature flags + AI config/routing), M22 AI OS (providers/tiers/personas). **←** M26 Portal (settlements/partner-config). **Kręgosłup:** niezależny od Fazy 0.

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — P0 boczne zabezpieczone (FAZA 3):** llm tiers + virtual-workers NAPRAWIONE (L-01/02) → E2E RBAC-reject (L-08). [karta §7 Fala 1]
- **EPIK 2 — P1 domknięte (FAZA 3):** `verifySuperAdmin` na llm purposes/market (L-03/04) + skan side-router-weak-gate. [karta §7 Fala 2]
- **EPIK 3 — Live-verify bugów (FAZA 3, 🟦):** secret-leak FeedbackBacklog + SSO crash (`69ffc1fd86`) + feedback 500 (`36ceb52c60`) — żywo na koncie superadmin (L-09, L-10). [karta §7 Fala 1/2]
- **EPIK 4 — Czystość kodu (FAZA 3):** wytnij płaski `AIPlatformModule.tsx` + orphan `IAMModuleView` (L-05). [karta §7 Fala 3]
- **EPIK 5 — Szlif (FAZA 4):** i18n 114 plików (lub świadomy dług internal) + 45–70 hex + realna persyst. testy (zdjąć mock-gate/mock-DB) (L-06, L-07, L-11). [karta §7 Fala 2/3]

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M27 (zmierzone 2026-06-13, `src/views/superadmin/` + `src/components/SuperAdmin/` = 185 plików ts/tsx, 165 tsx) |
|---|-----------|-----------|
| 1 | Front↔back | secret-leak/SSO crash zweryfikowane (`69ffc1fd86`); feedback 500 wdrożony; martwy kod usunięty |
| 2 | Bezpieczeństwo | oba P0 boczne zamknięte ✅ (`91c8245559`) + testy; P1 llm purposes/market → `verifySuperAdmin` (admin→403) |
| 3 | i18n | **~150/165** tsx bez `t()` (tylko 15 ma `useTranslation`); +1 plik z `isPolish` (2 hits) — **hardkody EN ~114/124 plików** (świadomy dług internal lub przetłumaczyć) |
| 4 | Tokeny | **70** hex w surface superadmin (karta podaje 45 w wąskim zakresie) → tokeny |
| 5 | §27 | **73** surowych `<table>` → A-S (organizations/users/audit/invoices/flags) |
| 6 | E2E w PR-gate | RBAC-reject (non-superadmin→403, twarde `===`) na każdej sekcji + bocznych routerach llm/virtual-workers zielone na `Londyn`; zacieśnić `[401,403,404]`→`403` |

Scenariusze S1–S7 + ~502 PASS/9 FAIL: karta §0/§2. Bezpieczeństwo: karta §6. Pułapka: `*.test.js` uderzają w realny PG (`role "iris"`) maskowane permisywnym `VALID_STATUSES`; „REAL integration" mockuje gate.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | ~95% realny; główny gate wzorcowy; 2 boczne P0 (potem naprawione); 2×P1 llm; i18n 114/124 | L-01,02,03,04,06,07 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak** — pula nietestowana na żywo; 🟦 wymaga konta superadmin; dziedziczę z karty | — |
| W-03 | Re-audit + Fala 2 | 2026-06-11 | P0 boczne naprawione (`91c8245559`); FeedbackBacklog secret + SSO crash (`69ffc1fd86`); feedback 500 (`36ceb52c60`) | L-01,02,09,10 (R3 koryguje) |
| W-04 | Kod (R3) | 2026-06-13 | commit `91c8245559` istnieje (fix 9 auth gaps W1/W2/W3 M08/M15/M23/M24/M27/Results) | L-01,02 (potwierdza) |
| W-05 | `[[finding_feedback_system_audit]]` + feedback prod | — | pulse/feature 500 (brak tabel); fix `36ceb52c60` live-verify pending | L-10 |

### 02 · Stan obecny (prawda kodu) — karta §1
REALNE ~95% z 60+ zakładek (Tenant Ops, AI Operations 27 pod-zakł., System, Governance, Platform Security) z persystencją. **Naprawione (R3):** llm tiers/virtual-workers gate (`91c8245559`), FeedbackBacklog secret-leak + SSO crash (`69ffc1fd86`), feedback 500 w kodzie (`36ceb52c60`, live-verify pending). MARTWE: płaski `AIPlatformModule.tsx` (152 l.), orphan `IAMModuleView.tsx`. OTWARTE: 2×P1 llm purposes/market.

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | llm tiers/assign+priority bez gate (global AI hijack) | W-01,W-03 | `llm.routes.ts:793,799,805` → `verifySuperAdmin` | P0 sec | — | **STALE-zweryfikowane: NAPRAWIONE** `91c8245559` (commit istnieje; karta §6 potwierdza) |
| L-02 | virtual-workers przepuszcza org-admina (global persony) | W-01,W-03 | `virtual-workers.routes.ts` → `requireRole('super_admin')` only | P0 sec | — | **STALE-zweryfikowane: NAPRAWIONE** `91c8245559` (commit istnieje; karta §6 potwierdza) |
| L-03 | llm purposes global writes (verifyAdmin) | W-01 | `POST /llm/purposes`, `/purposes/:purpose/assignments`, `PUT /llm/org/:id/policy` | P1 sec | 3 | otwarta (→ `verifySuperAdmin`) |
| L-04 | llm market global writes (verifyToken) | W-01 | `POST /llm/market/openrouter/sync`, `PUT /llm/market/inbox/:id` | P1 sec | 3 | otwarta (→ `verifySuperAdmin`) |
| L-05 | martwy płaski `AIPlatformModule.tsx` + orphan `IAMModuleView` | W-01 | `views/superadmin/AIPlatformModule.tsx` (152 l., 0 importów); `iam/IAMModuleView.tsx` (70 l., 0 API) | P2 | 3 | otwarta |
| L-06 | i18n hardkod EN ~114/124 plików | W-01 | ~150/165 tsx bez `t()` (zmierzone 2026-06-13) | P2 | 4 | otwarta (lub świadomy dług internal) |
| L-07 | 45–70 hex literałów | W-01 | 70 w surface (zmierzone) | P3 | 4 | otwarta |
| L-08 | brak E2E non-superadmin→403; asercje `[401,403,404]` maskują | W-01 | route-testy; `superAdmin.middleware.test.ts` 42/42 | P0-test | 3 | otwarta (twarde `===403` + boczne routery) |
| L-09 | FeedbackBacklog secret-path leak + SSO crash | W-03 | `SuperAdminFeedbackBacklogView`; `SSOConfigurationView.tsx:484` | P0-bug | — | **NAPRAWIONE** `69ffc1fd86` (live-verify 🟦 pending) |
| L-10 | feedback 500 (pulse/feature) | W-05 | `feedback.routes.ts:158/177/466` | P1 | 3 | **NAPRAWIONE w kodzie** `36ceb52c60` (live-verify deploy pending) |
| L-11 | realna persyst. testy maskowane (mock-gate/mock-DB) + stale-import + brak `<Router>` | W-01 | `*.test.js`; `OverviewModule.root-closure`; Feedback/Analytics | P1-test | 3/4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | i18n control-plane (DBR77-only) | przetłumaczyć 114 plików / świadomy dług internal udokumentowany | Piotr | TBD | otwarta |
| D-02 | live-verify P0/P1 (wymaga konta superadmin + control-plane) | kiedy/kto wykonuje 🟦 Fazę 3/4 | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — feature flags platformy (per-flag, zarządzane stąd); gating SUPERADMIN (DB-verified fail-closed). 🟦 pełna weryfikacja wymaga konta superadmin.
### 06 · Ryzyka — Pełna weryfikacja Fazy 3/4 (live P0/P1 proof na control-plane) WYMAGA konta superadmin — bez niego DoD #2/#6 nie domknie się, 🟦 deferred pozostaje. Dev `.env` → Railway PROD czyni testy zapisu na control-plane szczególnie ryzykownymi (NAJWYŻSZA ostrożność, read-only). Side-router-weak-gate to wzorzec systemowy (skan wszystkich mountów).
### 07 · Log — 2026-06-13 (teczka): R3 potwierdza oba P0 boczne NAPRAWIONE (`91c8245559`), L-09 `69ffc1fd86`, L-10 `36ceb52c60` (live-verify pending). Re-audit 2026-06-11: F 3→7; Fala 2: A 23→24; ocena 58. Re-ocena po Fazach 3/4 (konto superadmin).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + re-audit + kod-R3 + feedback-finding; uwagi żywe = brak, 🟦 wymaga konta superadmin) · R2 zero sierot · R3 statusy z dowodem (L-01/02 NAPRAWIONE — commit zweryfikowany; L-09/10 z commitami, live-verify pending) · R4 DoD z liczbami (i18n ~150/165, hex 70, table 73) · R5 decyzje z właścicielem (terminy TBD) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Fazy 3+4 (🟦 konto superadmin). **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Domknięcie DoD #2/#6 (live proof P0/P1 na control-plane) WYMAGA konta superadmin, a ponieważ dev `.env` może wskazywać Railway PROD, testy zapisu na control-plane są szczególnie ryzykowne — stąd 🟦 deferred-status pozostaje do świadomej, read-only sesji właściciela.
