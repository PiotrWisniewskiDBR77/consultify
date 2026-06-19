# TECZKA M27 — SuperAdmin (control plane) (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje `KARTA_AUDYTU.md` §1–§7 + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3 · enumeracja superadmin-gate per router · epiki→stories Gherkin→L-xx). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja głębi (PODŁOGA): [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M27 SuperAdmin (control plane) · **Pula:** internal (SUPERADMIN, cross-tenant)
- **Ocena audytu:** 58/100 · **Tier:** Alpha górny · **Status:** 🟦 NIEPEŁNY · 🟦 **WYMAGA KONTA SUPERADMIN** do pełnej weryfikacji (Fazy 3/4)
- **execution_readiness (skoryg. 2026-06-19): WYMAGA konta superadmin do live-verify — NIE traktować jako „gotowe".** Część STATYCZNA potwierdzona w kodzie (security-gate'y `verifySuperAdmin`/`requireRole`/middleware fail-closed 403 — zweryfikowane 2026-06-19). **NIE domknięte bez konta superadmin:** DoD #2/#6 (żywy dowód RBAC-reject na control-plane), L-11 (testy maskowane mock-gate/mock-DB — OTWARTA), §27 (~73–80 surowych `<table>`, 0 `FilterableTable`/`EntityStatusChip` — **NAJWIĘKSZY dług §27 programu**, odroczony do dedykowanego sprintu z preview), i18n DP-10 (~114 plików hardkod EN — świadomy dług internal, odroczony). D-02 otwarta.
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
| 5 | §27 | **~73–80** surowych `<table>` (zweryf. 2026-06-19: 80 tagów `<table>` w 60 plikach; 0 importów `FilterableTable` — adnotacje `§27-todo`/`→ FilterableTable` w kodzie to komentarze, nie użycia) → A-S (organizations/users/audit/invoices/flags) |
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
| L-01 | llm tiers/assign+priority bez gate (global AI hijack) | W-01,W-03,W-04 | `llm.routes.ts:793,799,805` → `verifySuperAdmin` | P0 sec | — | **ZAMKNIĘTA 2026-06-17 `91c8245559` — ZWERYFIKOWANE w kodzie 2026-06-17** |
| L-02 | virtual-workers przepuszcza org-admina (global persony) | W-01,W-03,W-04 | `virtual-workers.routes.ts:22` → `requireRole('super_admin')` only | P0 sec | — | **ZAMKNIĘTA 2026-06-17 `91c8245559` — ZWERYFIKOWANE w kodzie 2026-06-17** |
| L-03 | llm purposes global writes (verifyAdmin) | W-01 | `llm.routes.ts:1479` (`/purposes/:purpose/assignments`) + `:1704` (`/org/:id/policy`) | P1 sec | 3 | **ZAMKNIĘTA 2026-06-17 `698b004ff0` (verifyAdmin→verifySuperAdmin; POST /purposes już był OK)** |
| L-04 | llm market global writes (verifyToken/verifyAdmin) | W-01 | `llm.routes.ts:1970` (`/market/openrouter/sync`) + `:2012` (`/market/inbox/:id`) | P1 sec | 3 | **ZAMKNIĘTA 2026-06-17 `698b004ff0` (verifyAdmin→verifySuperAdmin)** |
| L-05 | martwy płaski `AIPlatformModule.tsx` + orphan `IAMModuleView` | W-01 | usunięte (0 importerów potw. grep); folder `AIPlatformModule/` żyje | P2 | 3 | **ZAMKNIĘTA 2026-06-17 (usunięte; deletion w historii via wip-snapshot `chore(wip)`)** |
| L-06 | i18n hardkod EN ~114/124 plików | W-01,W-05 | ~150/165 tsx bez `t()` (zmierzone 2026-06-13) | P2 | 4 | **ODROCZONA-Faza4 → Harvard 2 (DP-10 świadomy dług internal)** |
| L-07 | 70 hex literałów | W-01,W-05 | 70 w surface (zmierzone 2026-06-13) | P3 | 4 | **ODROCZONA-DP8 (palety/brand legalne — udokumentowane, nie blokuje v1)** |
| L-08 | brak E2E non-superadmin→403; asercje `[401,403,404]` maskują | W-01 | `tests/integration/llm-superadmin-gate.test.ts` 8/8 pass | P0-test | 3 | **ZAMKNIĘTA 2026-06-17 `698b004ff0` (8 testów: 4×org-admin→403, 4×superadmin→nie-403)** |
| L-09 | FeedbackBacklog secret-path leak + SSO crash | W-03 | `SuperAdminFeedbackBacklogView:50-54` (generic err); `SSOConfigurationView.tsx:484` (`?? ''` guard) | P0-bug | — | **ZAMKNIĘTA 2026-06-17 `69ffc1fd86` — ZWERYFIKOWANE w kodzie + test regresji `superadmin-l09-regression.test.tsx` 2/2 (`79bf75ce06`)** |
| L-10 | feedback 500 (pulse/feature) | W-06 | `feedback.routes.ts:158/177/466` | P1 | 3 | **ZAMKNIĘTA 2026-06-18 — kod naprawiony `36ceb52c60` (full alerting pipeline rebuild; pulse/feature 200 zamiast 500). Pozostaje wyłącznie live-verify po deploy (wymaga konta superadmin + deploy na środowisko) — to walidacja runtime, nie luka kodu. Decyzja: zamykamy luki kodu; live-verify oznaczony jako 🟦 post-deploy.** |
| L-11 | realna persyst. testy maskowane (mock-gate/mock-DB) + stale-import + brak `<Router>` | W-01 | `*.test.js`; `OverviewModule.root-closure`; Feedback/Analytics | P1-test | 3/4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | i18n control-plane (DBR77-only) | przetłumaczyć 114 plików / **świadomy dług internal udokumentowany** | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-10: świadomy dług internal control-plane, NIE tłumaczyć v1** |
| D-02 | live-verify P0/P1 (wymaga konta superadmin + control-plane) | kiedy/kto wykonuje 🟦 Fazę 3/4 | Piotr | TBD | otwarta — wymaga konta superadmin |

### 05 · Flagi/rollout — feature flags platformy (per-flag, zarządzane stąd); gating SUPERADMIN (DB-verified fail-closed). 🟦 pełna weryfikacja wymaga konta superadmin. DP-10: i18n internal = dług świadomy.
### 06 · Ryzyka — Pełna weryfikacja Fazy 3/4 (live P0/P1 proof na control-plane) **WYMAGA konta superadmin (🟦)** — bez niego DoD #2/#6 nie domknie się, deferred pozostaje. Dev `.env` → Railway PROD czyni testy zapisu na control-plane szczególnie ryzykownymi (NAJWYŻSZA ostrożność, read-only). Side-router-weak-gate to wzorzec systemowy (skan wszystkich mountów).

### 06b · §27 + tokeny (audyt 2026-06-17) — **§27: ~80 surowych `<table>` w 60 plikach** (`superadmin/` + `components/SuperAdmin/`), zero `FilterableTable` w module = **największy dług §27 programu**. Priorytet konwersji: OrganizationsView, InvoiceCenterView, BillingCenterView, ComplianceCenterView, PartnerSettlementsView, IAM audit/log. **ODROCZONE — wymaga konta superadmin do wizualnej weryfikacji każdej tabeli (🟦); wielosesyjny dedykowany sprint, NIE blind-convert bez preview.** **Tokeny: ZERO raw-hex leak** — `rose`/`red` = skonfigurowany token „HBS Red" (danger), `crimson` = brand (DP-8 legalne, `tailwind.config.js:543/556/71`); ~460 dekoracyjnych `rose-*` to dług SEMANTYCZNY (danger-token użyty ozdobnie), nie hex-leak — backlog polish, nie blocker v1.
### 08 · AUDYT WIZUALNY 2026-06-18 (z kodu — bez konta superadmin)

**Status:** 🟡 (audyt kodu, brak live-screenshots — wymaga konta superadmin do pełnego zamknięcia)

**SYS-1 — crimson w stanach zaznaczenia (naprawione w tym sesji):**
| Plik | Instancja | Fix |
|------|-----------|-----|
| `TenantCommandCenterView.tsx:379` | `border-primary-500 bg-primary-50` (org row selected) | → `border-[var(--c-info)] bg-slate-100` |
| `SecurityPoliciesView.tsx:600` | `bg-primary-50 border-primary-300` (org card selected) | → `bg-slate-100 border-[var(--c-info)]/40` |
| `SecurityPoliciesView.tsx:606` | `bg-gradient from-primary-500` (org avatar) | → `from-slate-600 to-slate-700` |
| `SecurityPoliciesView.tsx:617` | `bg-primary-500/10 text-primary-600` (Custom Policy badge) | → `bg-[var(--c-info)]/10 text-[var(--c-info)]` |
| `SecurityPoliciesView.tsx:1016` | `text-primary-600` (tab active) | → `text-[var(--c-info)]` |
| `CustomRolesBuilder.tsx:300` | `bg-primary-500/10 border-primary-500/50` (role selected) | → `bg-slate-100 border-[var(--c-info)]/50` |
| `CustomRolesBuilder.tsx:441` | `bg-primary-500/10 border-primary-500/30` (permission assigned) | → `bg-slate-100 border-[var(--c-info)]/30` |
| `SystemSettings.tsx:1022` | `bg-primary-600/10 text-primary-700` (table row selected) | → `bg-slate-100 text-[var(--c-info)]` |
| `PlaybookTemplatesListView.tsx:293` | `bg-primary-600/10 text-primary-700` (filter "All" active) | → `bg-slate-100 text-[var(--c-info)]` |
| `APIManagementView.tsx:1035` | `text-primary-600` (tab active) | → `text-[var(--c-info)]` |
| `InvoiceCenterView.tsx:1209` | `text-primary-600` (tab active) | → `text-[var(--c-info)]` |
| `FeatureUpdatesAdminView.tsx:709` | `border-primary-400 bg-primary-50/60` (item active) | → `border-[var(--c-info)]/50 bg-slate-50` |

**SYS-2 — CTA przyciski:** SuperAdminSidebar używa `danger-` (czerwień dla SuperAdmin console) — to deliberate design dla control-plane, NIE SYS-2 naruszenie.

**SYS-7 — surowe `{item.status}` bez EntityStatusChip:** ~73 surowych `<table>` potwierdzone (§27 dług). Triage: ODROCZONY — wymaga konta superadmin do wizualnej weryfikacji każdej tabeli (patrz §06b).

**Empty states:** Brak ilustrowanych stanów pustych we wszystkich views — wisząca obserwacja, NIE bloker v1.

**Spójność komponentów:** Brak `FilterableTable`, zero `EntityStatusChip` w module — największy dług §27 programu. Biblioteka komponentów z reszty systemu NIE używana (dedykowany shell). Dług odroczony (patrz §06b).

**Naprawione commitami:** patrz log commit `fix(M27+M13)` w tym PR.

### 07 · Log — 2026-06-13 (teczka pogłębiona): R3 potwierdza oba P0 boczne NAPRAWIONE (`91c8245559`, `:793/799/805` + `:22`), L-09 `69ffc1fd86`, L-10 `36ceb52c60` (live-verify pending); DP-10 (i18n internal) + DP-8 (palety) wpisane; tabela superadmin-gate per router zweryfikowana + epiki Gherkin dodane. Re-audit 2026-06-11: F 3→7; Fala 2: A 23→24; ocena 58. Re-ocena po Fazach 3/4 (🟦 konto superadmin).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + re-audit + kod-R3 + feedback-finding + DP-10/DP-8; uwagi żywe = brak, 🟦 wymaga konta superadmin) · R2 zero sierot (wejście→luka→story→DoD) · R3 statusy z dowodem (L-01/02 NAPRAWIONE — gate zweryfikowany w kodzie 2026-06-13; L-09/10 z commitami, live-verify pending) · R4 DoD z liczbami (i18n ~150/165, hex 70, table 73) · R5 decyzje przekrojowe ROZSTRZYGNIĘTE (D-01=DP-10; D-02 otwarta — wymaga konta superadmin); pozostaje R6/żywa weryfikacja (M27 wymaga konta superadmin) · A–E docelowy zlinkowany · F epiki→stories Gherkin↔luki · G DoD+S+sec+wydajność · R6 sesja żywa = Fazy 3+4 (🟦 konto superadmin). **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Domknięcie DoD #2/#6 (live proof P0/P1 na control-plane) WYMAGA konta superadmin, a ponieważ dev `.env` może wskazywać Railway PROD, testy zapisu na control-plane są szczególnie ryzykowne — stąd 🟦 deferred-status pozostaje do świadomej, read-only sesji właściciela.

---

## EKRANY (inwentarz) — 2026-06-19

**Werdykt weryfikacji:** teczka SOLID (static-verifiable część potwierdzona); pełna live-weryfikacja nadal 🟦 (wymaga konta superadmin — D-02 otwarta). Potwierdzone statycznie w kodzie 2026-06-19: L-01 tiers/assign+DELETE+priority `verifySuperAdmin` (`llm.routes.ts:793/799/805`) — PRAWDA; L-02 virtual-workers `requireRole('super_admin')` (`virtual-workers.routes.ts:22`) — PRAWDA; L-03/L-04 purposes+market writes `verifySuperAdmin` (`:1479/1704/1970/2012`) — PRAWDA; middleware fail-closed 403 z DB-role jako SoT (`superAdmin.middleware.ts:403-426`) — PRAWDA; L-05 flat `AIPlatformModule.tsx` + `IAMModuleView.tsx` usunięte, folder `AIPlatformModule/` żyje (598 l.) — PRAWDA; L-08 test asercja `toBe(403)` dla org-admin + `not.toBe(403)` dla superadmin (`tests/integration/llm-superadmin-gate.test.ts`, 8×403) — PRAWDA; L-09 regresja `tests/integration/superadmin-l09-regression.test.tsx` istnieje — PRAWDA. Otwarte: L-11 (mock-gate testy), §27 (~73-80 `<table>`, dług odroczony), i18n DP-10, live-verify (🟦).

**Layout:** dedykowany SuperAdmin shell + `SuperAdminSidebar`. Surface = 60 top-level views (`src/views/superadmin/`) + 35 paneli (`src/components/SuperAdmin/`) + folder `AIPlatformModule/` (32 sub-tabs).

### Główne ekrany (views — `src/views/superadmin/`)
| Ekran | Cel | Plik |
|---|---|---|
| SuperAdmin Dashboard / Root | strona główna control-plane | `SuperAdminDashboard.tsx`, `SuperAdminView.tsx`, `OverviewModule.tsx` |
| Tenant Command Center | cross-tenant ops na organizacjach (SYS-1 fix) | `TenantCommandCenterView.tsx` |
| Organizations | lista/zarządzanie organizacjami cross-tenant | `OrganizationsView.tsx`, `OrganizationResourceManager.tsx`, `SuperAdminOrgDetailsModal.tsx` |
| User Management | zarządzanie userami cross-tenant | `SuperAdminUserManagement.tsx`, `CustomersModule.tsx` |
| Security Policies | polityki bezpieczeństwa per-org (SYS-1 fix) | `SecurityPoliciesView.tsx`, `SecurityModule.tsx`, `GlobalSecurityPostureView.tsx` |
| Custom Roles Builder | builder ról/uprawnień (SYS-1 fix) | `CustomRolesBuilder.tsx` |
| SSO Configuration | konfiguracja SSO (L-09 crash-guard) | `SSOConfigurationView.tsx` |
| SCIM Provisioning | provisioning SCIM | `SCIMProvisioningView.tsx` |
| Module Access Control | dostęp do modułów per-org | `ModuleAccessControlView.tsx`, `ModuleWaitlistView.tsx` |
| API Management | zarządzanie API/kluczami (SYS-1 fix) | `APIManagementView.tsx` |
| Invoice Center | faktury (SYS-1 fix) | `InvoiceCenterView.tsx` |
| Billing Center | rozliczenia | `BillingCenterView.tsx` |
| Revenue | przychody/Stripe | `RevenueModule.tsx`, `SuperAdminRevenueView.tsx` |
| Plans / Subscriptions | plany i subskrypcje | `SuperAdminPlansView.tsx`, `SubscriptionPlansManager.tsx` |
| Compliance Center | zgodność/audyt | `ComplianceCenterView.tsx`, `GovernanceModule.tsx` |
| Legal | dokumenty prawne | `SuperAdminLegalView.tsx` |
| Feedback Backlog | backlog feedbacku (L-09 secret-leak fix) | `SuperAdminFeedbackBacklogView.tsx`, `SuperAdminFeedbackView.tsx`, `SuperAdminFeedbackAnalyticsView.tsx` |
| Signals / Access Requests | sygnały + prośby o dostęp | `SuperAdminSignalsView.tsx`, `SuperAdminAccessRequestsView.tsx` |
| Metrics / Storage | metryki platformy + storage | `SuperAdminMetricsView.tsx`, `SuperAdminStorageDetailModal.tsx` |
| AI Operations (hub) | operacje AI: providers/tiers/routing | `AIOperationsModule.tsx`, `AIConfigurationView.tsx`, `LLMManagementView.tsx` |
| AI Budgets / Intelligence / Observability | budżety, inteligencja, obserwowalność AI | `AIBudgetsView.tsx`, `AIIntelligenceView.tsx`, `AIObservabilityDashboard.tsx`, `SuperAdminAIAnalyticsView.tsx` |
| AI Development / Infrastructure | dev/infra AI | `AIDevelopmentModule.tsx`, `AIInfrastructureModule.tsx` |
| Presentation Governance (suite) | governance prezentacji: watchlist, telemetria, alerty, health, benchmark | `PresentationGovernanceWatchlistView.tsx`, `PresentationTelemetryView.tsx`, `PresentationGovernanceAlertSubscriptionsView.tsx`, `PresentationOperationsHealthView.tsx`, `PresentationBenchmarkTrendView.tsx`, `PresentationTemplateGovernanceView.tsx` |
| Playbook Templates | edytor + lista szablonów playbook (SYS-1 fix) | `PlaybookTemplatesListView.tsx`, `PlaybookEditorView.tsx` |
| Feature Updates Admin | komunikaty/aktualizacje (SYS-1 fix) | `FeatureUpdatesAdminView.tsx` |
| Email Templates | szablony email | `EmailTemplatesView.tsx` |
| Whitelabel Studio | whitelabel/branding | `WhitelabelStudioView.tsx` |
| System Settings / Modules | ustawienia systemu, feature flags | `SystemSettings.tsx`, `SystemModule.tsx`, `ConfigurationModule.tsx`, `ContentModule.tsx` |

### Panele (`src/components/SuperAdmin/`)
FeatureFlagsPanel, SecurityPanel, ApiManagementPanel, ConfigurationPanel, AnalyticsPanel, UsageStatsPanel, LegalPanel, IntegrationsPanel, EmailConfigurationPanel/TemplatesPanel/TemplateEditor, BackupPanel, BulkActions, ModelTierAssignments, SuperAdminAISettings, SuperAdminSignalCenter/SignalNode, SuperadminRootClosurePanel, PartnerOutreachPanel, ContentAnalyticsDashboard/CategoriesManager/TagsManager/Filters/Search, PlaybookTemplate{Analytics,Comments,Reviews,VersionHistory}, OperationsHealthDrilldownPanel, AlertPlaygroundTester, IncidentRunbooksCard, SubscriberTokenManagementPanel, ResourceLimitInput, SuperAdminStatusIndicators, TabLayout.

### AI Platform Module (folder `src/views/superadmin/AIPlatformModule/`)
Hub `AIPlatformModule.tsx` (598 l.) + 32 sub-taby w 9 grupach (Configuration/Security/Development/Operations/Knowledge/Policy/Analytics/Executive). Realne (>100 l.): OrgAIPolicyTab, RoutingRulesTab, PurposeAssignmentsTab, AIGovernanceTab, ComplianceTab, ModelRegistryTab, MarketInboxTab, DocumentsRAGTab, StrategicDirectionsTab, PolicyEnforcementTab, LLMObservatoryTab, PerformanceMetricsTab, PricingRegistryTab, AIUseCaseControlPlane. Pozostałe (~14 l.) = placeholder-taby (GlobalSettings/LLMProviders/ModelTiers/APIKeys/AccessControl/AuditLogs/Experiments/Prompts/Health/MissionControl/Usage/Cost/CustomReports/KnowledgeBase).

**Liczba ekranów: ~60 top-level views + 35 paneli + 32 sub-taby AI Platform (≈14 realnych, ~18 placeholder).** Największy moduł programu; brak `FilterableTable`/`EntityStatusChip` (dług §27, odroczony do dedykowanego sprintu z kontem superadmin).
