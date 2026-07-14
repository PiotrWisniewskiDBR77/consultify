# TECZKA M24 — Panel Administratora (org admin) (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje `KARTA_AUDYTU.md` §1–§7 + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3 · enumeracja API · epiki→stories Gherkin→L-xx). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja głębi (PODŁOGA): [`M13-inicjatywy.md`](M13-inicjatywy.md).

## RE-AUDYT 2026-07-14

Karta poniżej (ostatnia weryfikacja 2026-06-19) jest **NIEAKTUALNA** w kilku punktach — świeży audyt kodu na `origin/demo` (grep realnych callerów + commit history, zgodnie z regułą „Weryfikuj REALNY runtime, nie docy/flagi" z `CLAUDE.md`), nie kasuje historii niżej, dopisuje korektę:

1. **Paneli: 6, nie 5.** Health panel doszedł commitem `fab72c4653` (2026-07-02) — `AdminHealthPanel.tsx` + probe registry (`server/src/services/health/healthProbeService.ts`, 6 round-trip probes), sekcja `'health'` w `AdminSettingsSidebar`/`AdminSettingsModule`. **Korekta liczby testów:** commit message deklarował „15", zweryfikowano grep-em `tests/unit/backend/healthProbeService.test.ts` = **32** przypadki (`it(`/`test(`) + `tests/components/Admin/AdminHealthPanel.test.tsx` = **5** — komunikat commitu był nieaktualny/mylący, realnie 37 testów łącznie.
2. **KOREKTA poprzedniej karty (sekcja EKRANY 2026-06-19):** `AdminScimLifecyclePanel` / `AdminIamPolicyPanel` / `AdminCollaborationControlsPanel` / `AdminSecurityPolicyPanel` / `AdminRiskSummaryPanel` **NIE są martwe** — zweryfikowano `src/components/Admin/AdminSecurityIdentityPanel.tsx`: renderowane jako pod-taby (`activeTab === 'policy'|'collaboration'|'iam'|'scim'|'risk'`), struktura z commitu `132b809d24` (P32 admin enterprise panels).
3. **Inwentarz realny** (zliczone `find`/`grep` na `src/`, 2026-07-14): **159 plików non-test** = 116 `src/components/Admin/` (122 pliki minus 6 w `__tests__`) + 43 `src/views/admin/` (44 minus 1 test) — oba zliczenia potwierdzone dokładnie. **Sierota** `views/admin/AdminAccessControlView.tsx` poza `src/` — potwierdzone, plik fizycznie leży w worktree-root `views/admin/`, nie w drzewie `src/`. Żywych (reachable z `AdminView.tsx`/`AdminSettingsModule`) = **33**. Martwych kandydatów **124** = **83 czyste sieroty** (m.in. `AdminLayout.tsx`, `AdminSidebar.tsx` — potwierdzone: pliki istnieją w `components/Admin/`, zero importów w `AdminView.tsx`; `AdminDashboard`, `OverviewModule`, `TeamModule`, `WorkspaceModule`, `AdminUserManagement`, całe `billing/compliance/organization/team/shared` z własnym `AdminTable`/`EnhancedDataTable`, `ChatV9Flags*`, `PromptManagementUI`, `PromptBlockBuilder`, `PromptTestBench`, `SLADashboard`, `LLMHealthPanel`, `InterviewAssignmentsPanel`, `RolesManagementPanel`) + **41 należących do M27 SuperAdmin w złej lokalizacji** — potwierdzone spot-checkiem dla 4/5: `ABTestingDashboard`, `AICostDashboard`, `AIPerformanceDashboard`, `AI/AICoreRuntimePanel`, `AI/ChatTracesViewer`, `AI/UsageAnalyticsDashboard`, `AI/PromptOsRuntimeSummaryPanel` mają realnych konsumentów w `src/views/superadmin/{AIDevelopmentModule,AIPlatformModule,AIOperationsModule}.tsx`. **Wyjątek znaleziony przy weryfikacji:** `AISLADashboard.tsx` ma ZERO konsumentów w całym `src/` (nie tylko poza M24 — nigdzie) → to czysta sierota, nie plik M27-w-złej-lokalizacji; do przeklasyfikowania przy pełnym audycie D-02. Decyzja D-02 nadal **OTWARTA**.
4. **Luki DoD** (zweryfikowane grep-em): i18n 20/30 żywych plików bez `t()` (~1040 hardkodów; sekcje AI+Security+AuditLog, zgodne z L-06 nadal otwartym). §27: **6 surowych `<table>` w AI Controls potwierdzone dokładnie po pliku** — `AI/AccessLimitsTab.tsx` (×2), `AI/AuditComplianceTab.tsx` (1), `AI/ModelsProvidersTab.tsx` (1), `views/admin/AdminLLMMultipliers.tsx` (1), `views/admin/AdminLLMView.tsx` (1) = 6. Brak testów IDOR dla iam/scim/collaboration/risk/health-panel (istniejące 15 z `tests/integration/admin/admin-cross-org-idor.test.ts` [L-03] pokrywają tylko admin-data+ai-settings). Custom tab-bar w `AdminSecurityIdentityPanel.tsx` (własny `tabs.map`/`handleTabChange`) zamiast współdzielonego `TabLayout`. Barrel `src/components/Admin/AI/index.ts` eksportuje 2 nieużywane, potwierdzone grep-em: `OrgProviderSettings` (zero konsumentów w `src/`) i `HealthMonitoringTab` (jedyny realnie używany `HealthMonitoringTab` w runtime to inny plik — `views/superadmin/AIPlatformModule/Operations/HealthMonitoringTab.tsx` — eksport z barrelu `Admin/AI` faktycznie martwy). Tokeny kolorów czyste (0 hex, niezmienione vs poprzednia karta).
5. **Ocena: ~70%** (front↔back 90 / security 75 / i18n 35 / tokeny 100 / §27 65 / E2E 70 / UI-UX 65). **W TOKU (07-14):** flota naprawcza `i18n-m24-admin` + `test-m24-idor-gap`.

---

## 00 · Nagłówek
- **Moduł:** M24 Panel Administratora (org admin) · **Pula:** internal (org ADMIN/OWNER)
- **Ocena audytu:** 58/100 · **Tier:** Alpha górny · **Status:** 🟦 NIEPEŁNY (Fazy 3+4) · **Rozmiar:** S-M (do 2 dni)
- **Żywy bloker:** brak P0 — **oba P0 cross-org NAPRAWIONE** (`1f9ed50f05`, `fd8707c5b2`), zweryfikowane w kodzie 2026-06-13. Pula nietestowana na żywo (internal).
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 + Fala 6 2026-06-12 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M24-admin/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md, f2_tests_report.md, f56_kanon_sec.md`
- **Kod:** `src/components/Admin/` (**31 plików ts/tsx**, zmierzone 2026-06-13; karta podawała 52 — korekta R3) · `AdminSettingsModule` (live shell, 5 paneli) · `server/src/routes/{adminP32,admin-data,ai-settings}.routes.ts` · `server/src/services/adminAuditService.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 + `[[project_admin_firmy_shell]]` | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 + i18n) | stany + delta §27 (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e + kod 3 routery | **enumeracja API + reguły org-boundary** (niżej) |
| D AI/Teresa | 🟡 | karta (AI Controls governance) | granice (niżej) |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | **epiki→stories Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby zmierzone** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1d/§6 | **Rejestr Wejść + Decyzji + korekta R3 (P0) + DP-11 billing** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + S1–S7 + 5 paneli: karta §0/§1. Shell: `[[project_admin_firmy_shell]]` (live = `AdminSettingsModule` 5 paneli).
- **Job-to-be-done:** dać administratorowi organizacji jedno miejsce do zarządzania zespołem/rolami, billingiem, governance AI, bezpieczeństwem (SCIM/IAM/API-keys) i audytem — bez wchodzenia na control-plane superadmina.
- **Persony/role:** ADMIN/OWNER danej org (rola z **członkostwa w tym orgId**, NIE z globalnego JWT — `adminP32` `requireAdminContext`). Eskalacja ADMIN→SUPERADMIN niemożliwa (`UpdateMemberRoleSchema` bez SUPERADMIN). Ochrona OWNER/last-owner/self serwerowa.
- **Zakres v1:** Team&Access (CRUD + zaproszenia cap 500) · **Billing (jedno miejsce dla M23/M24/M25, label „zarządzane przez DBR77", BEZ live-checkout — DP-11)** · AI Controls (9/9 pod-zakładek) · Security (6/6: SCIM/IAM/API-keys) · Audit Log + CSV. **POZA v1:** Stripe Elements (flag-gated OFF, karta-checkout fasada honest); martwy `AdminSidebar`/resztki `Admin/`.
- **Metryka:** admin zarządza org bez SQL; zero cross-org leak (naprawione + do utrzymania testem).

## B · UX DOCELOWE *(link + delta + stany)*
§27 + i18n: karta §5. `AdminSettingsModule` + sidebar spójny, `DesktopOnlyGuard`.
- **Stany ekranu:** pusty (org bez członków → CTA invite), ładowanie (skeleton tabel), **błąd inline** (dziś przez toast, brak inline = P3), pełny, brak-uprawnień (non-admin przez `ProtectedRoute`).
- **Delta:** żadna z **4 głównych tabel** (członkowie/audit/invoices/payment methods) nie używa `TABLE_AND_PREVIEW_CANON` (surowe `<table>`, **10** trafień) → §27 A-S (L-05). i18n: 0× `isPolish` (czysto) ale security/audit/scim/members hardkod EN → `t()` (wzór BillingFinOps 24×`t()`) (L-06). Billing UI = label managed (DP-11, D-01).

## C · DANE + API + REGUŁY *(enumeracja + org-boundary)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (`VITE_STRIPE_ENABLED` OFF).
- **Model danych:** `organization_members`, `billing/invoices`, `ai_settings`/`ai_usage_stats`, scim/iam tables, audit events. Pułapki bigint/jsonb → `pgFlags.ts`.
- **API per router (metoda · gate · zweryfikowane 2026-06-13):**
  - **`adminP32.routes.ts`** (**39 endpointów**: members CRUD, billing 7, AI controls, security/SCIM/IAM, audit+CSV `:2311`) — `requireAdminContext`→`ADMIN_BOUNDARY_VIOLATION` (`:300`), rola z członkostwa w orgId. **WZORCOWY.**
  - **`admin-data.routes.ts`** (`GET /user-tiers/:orgId`, `GET /cost-attribution/:orgId`, `PUT /user-tiers/:orgId/:userId`) — `router.use(verifyToken)` (`:44`) + `router.use(requireRole('super_admin','admin','owner'))` (`:45`) + per-endpoint `requireRole` (`:108,279,500,793,881`) + `:orgId` org-scope. **NAPRAWIONE P0 cross-org** (`1f9ed50f05`).
  - **`ai-settings.routes.ts`** (`GET/PUT /org/:orgId`) — admin/owner-only, `userOrgId===orgIdStr` guard na `:220,259,623,702,751`. **NAPRAWIONE P0 cross-org** (`fd8707c5b2`).
  - **`adminAuditService.ts:71`** — `SELECT * LIMIT 1000` bez `WHERE organization_id`, filtr in-memory (fail-closed, P2 perf — L-04).
- **Reguły biznesowe:** anty-eskalacja (`UpdateMemberRoleSchema` bez SUPERADMIN; `normalizeOrganizationRole('SUPERADMIN')`→org-ADMIN); ochrona last-owner/self serwerowa; zaproszenia cap 500. Brak maszyny stanów (panel zarządzania).

## D · AI / TERESA *(link)*
- **Co steruje:** AI Controls (governance/limits) per org → wpływa na runtime AI całej platformy. AI settings cross-org NAPRAWIONE (`fd8707c5b2`).
- **Granice:** 2 pod-zakładki AI mają mock fallback dla list wtórnych (nie placeholder-only); nie generuje kart (CARD_CONTENT_FORMULA N/D).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** cała platforma (AI settings governance), M23 Organizacja (members/ownership + drift redirect), Stripe (billing pm token, za flagą). **Przekrój:** M27 SuperAdmin (plane rozdzielone, P0 superadmin≥admin naprawiony). **Zależność blokująca:** drift redirect koordynować z M23 (M24-L01/M23-L04 to ta sama granica).

## F · EPIKI → STORIES → ZADANIA *(z karty §7, forma Gherkin)*
- **EPIK 1 — P0 zabezpieczone testem (FAZA 3):** oba P0 cross-org NAPRAWIONE → testy regresji IDOR + escalation.
  - **Story 1.1:** jako admin org A chcę 403 na danych org B. *Dane* admin A; *gdy* `GET /admin-data/user-tiers/<orgB>`; *wtedy* 403 (nie e-maile/tiery org B). → **Z→L-03**
  - **Story 1.2:** jako admin chcę nie móc eskalować do SUPERADMIN. *Dane* admin; *gdy* `updateMemberRole role=SUPERADMIN`; *wtedy* odrzucone/normalizacja do org-ADMIN. → **Z→L-03**
  - **Story 1.3:** jako owner org A chcę 403 na ai-settings org B. *Dane* owner A; *gdy* `PUT /ai-settings/org/<orgB>`; *wtedy* 403 (`userOrgId!==orgId`). → **Z→L-03**
- **EPIK 2 — Audit szczelny (FAZA 3):** audit-logs org-scoped SQL zamiast in-memory cap.
  - **Story 2.1:** jako tenant chcę pełne własne logi. *Dane* >1000 zdarzeń; *gdy* odczyt audit; *wtedy* `WHERE organization_id=?` (nie utrata przy capie 1000). → **Z→L-04**
- **EPIK 3 — Higiena BE (FAZA 3):** route-level role middleware members; usunąć `/debug-memberships`; PCI.
  - **Story 3.1:** members POST/PATCH/DELETE z route-level role middleware; martwy `GET /debug-memberships` usunięty; backend bez surowego PAN (Stripe token). → **Z→L-07**
- **EPIK 4 — Czystość kodu (FAZA 3/4):** wytnij martwy FE + inline error-state.
  - **Story 4.1:** wytnij `layout/AdminSidebar.tsx` (0 importerów) + rozstrzygnij resztki `Admin/` (per plik, D-02); dodaj inline error-state. → **Z→L-08**
- **EPIK 5 — Szlif (FAZA 4):** §27 + i18n + E2E RBAC.
  - **Story 5.1:** §27 dla 4 tabel (`TableWithPreviewLayout`, 10 `<table>`). → **Z→L-05**
  - **Story 5.2:** i18n `t()` w security/audit/scim/members (wzór BillingFinOps). → **Z→L-06**
  - **Story 5.3:** E2E RBAC-by-role na `Londyn` (zamiast smoke-fake goto+url-truthy). → **Z→L-09**
- **EPIK 6 — Billing honest (FAZA 3, DP-11):** karta-checkout = label managed lub Stripe Elements (D-01).
  - **Story 6.1:** *Dane* klik upgrade; *gdy* CTA; *wtedy* label „zarządzane przez DBR77" (DP-11, bez live-checkout v1). → **Z→D-01**

## G · JAKOŚĆ / DoD *(skwantyfikowane, zmierzone 2026-06-13)*
| # | Kryterium | Miara M24 (`src/components/Admin/` = **31** plików ts/tsx) |
|---|-----------|-----------|
| 1 | Front↔back | 0 martwych przycisków; karta-checkout label managed (DP-11) lub Stripe Elements; martwy kod usunięty |
| 2 | Bezpieczeństwo | oba P0 cross-org zamknięte ✅ (`1f9ed50f05` router-level `requireRole`+`:orgId` + `fd8707c5b2` `userOrgId===orgId`) + testy regresji IDOR/escalation; audit-logs org-scoped; PCI bez PAN |
| 3 | i18n | **0/31** plików z `isPolish` (czysto), ale security/audit/scim/members hardkod EN → `t()` |
| 4 | Tokeny | **0** hex w 31 plikach (czysto) |
| 5 | §27 | **10** surowych `<table>` → FilterableTable/TableWithPreviewLayout (4 główne tabele admina) |
| 6 | E2E w PR-gate | cross-org IDOR + escalation + RBAC-by-role zielone na `Londyn` (dziś E2E smoke-fake) |

Scenariusze S1–S7 + 44 PASS/0 FAIL: karta §0/§2. Bezpieczeństwo: karta §6.
- **Wydajność:** audit-logs cap 1000 in-memory (L-04). **Telemetria:** próby cross-org odrzucone w logach; pokrycie RBAC-by-role.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | 5/5 paneli realne; adminP32 wzorcowy; 2 boczne routery cross-org P0 (potem naprawione); §27/i18n dług | L-01,02,03,04,05,06 |
| W-02 | **Uwagi żywe** (`UWAGI_TESTY_2026-06-13.md`) | 2026-06-13 | **brak** — pula internal nietestowana na żywo; dziedziczę z karty | — |
| W-03 | Re-audit + Fala 6 | 2026-06-11/12 | P0 cross-org naprawione (`1f9ed50f05`/`fd8707c5b2`); drift testy (`8f3992ccf2`, 44 PASS) | L-01,02,03 (R3 koryguje) |
| W-04 | Kod (R3) | 2026-06-13 | grep: admin-data router-level `requireRole`(:45)+`:orgId`; ai-settings `userOrgId===orgId`(:220/259/623/702/751); 39 endp. adminP32; 31 plików (nie 52) | L-01,02 (potwierdza); korekta count |
| W-05 | `_DECYZJE.md` DP-11 | 2026-06-13 | billing = jedno miejsce Admin, label managed, bez live-checkout | D-01 |
| W-06 | Feedback prod | — | brak bezpośredni — admin org, nie kliencka pętla feedback | — |

### 02 · Stan obecny (prawda kodu) — karta §1
REALNE 5 paneli (Team&Access, Billing 7 endp., AI Controls 9/9, Security 6/6, Audit+CSV). **Naprawione (R3):** admin-data cross-org (`1f9ed50f05`), ai-settings cross-org (`fd8707c5b2`), drift testy (`8f3992ccf2`). MARTWE: `layout/AdminSidebar.tsx` (0 importerów), resztki `Admin/`, `GET /debug-memberships`. Honest fasada: karta-checkout (flag-gated OFF) → DP-11 = label managed.

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | cross-org leak+write `admin-data.routes.ts` | W-01,W-03,W-04 | router-level `requireRole`(:45)+`:orgId` org-scope | P0 sec | — | **NIEAKTUALNA** — naprawione `1f9ed50f05` (`:44/:45` mount-level guard). Zweryfikowane 2026-06-13 + 2026-06-17. |
| L-02 | cross-org R/W `ai-settings.routes.ts` | W-01,W-03,W-04 | admin/owner-only, `userOrgId===orgIdStr` (`:220,259,623,702,751`) | P0 sec | — | **NIEAKTUALNA** — naprawione `fd8707c5b2`. Zweryfikowane 2026-06-13 + 2026-06-17. |
| L-03 | brak testów cross-org IDOR + escalation (B1/B2) | W-01 | brak `tests/…cross-org` | P0-test | 3 | **ZAMKNIĘTA 2026-06-17 d5e46a5160** — 15/15 testów zielonych (`tests/integration/admin/admin-cross-org-idor.test.ts`): admin-data 403, escalation prevention, ai-settings 403 |
| L-04 | audit-logs globalny SELECT cap 1000 | W-01 | `adminAuditService.ts:71` | P2 | 3 | **ZAMKNIĘTA 2026-06-17 206a7f8324** — getLogs() teraz filtruje po orgId z metadata_json; wszystkie 5 callerów w adminP32 zaktualizowane |
| L-05 | §27 niezastosowany (10 `<table>`) | W-01 | 4 tabele admina | P2 | 4 | **✅ ZAMKNIĘTA `c432dab94c` (2026-06-17)** — `FilterableTable` + Menu 1/2/3 w `AdminMembersRolesPanel`, `AdminAuditLogPanel`, `AdminBillingFinOpsPanel` (invoices + payments tabs); `persistKey` per tabela; 0 nowych błędów tsc. |
| L-06 | i18n hardkod EN (security/audit/scim/members) | W-01 | wzór BillingFinOps (24×`t()`) | P2 | 4 | **CZĘŚCIOWO 2026-06-17 `d14351d555`** — `InterviewAssignmentsPanel.tsx` codemod (24 konwersje, **22 klucze → `scripts/i18n-sweep/keys_M24.json`** dla H2). **Reszta ODROCZONA→H2/Faza4**: ~62 pliki / ~1040 hardkodów EN (manual; tylko ten 1 plik miał `isPolish`) |
| L-07 | members bez route-level role middleware; PCI surowy `cardNumber`; martwy `/debug-memberships` | W-01 | `organizations.routes.ts:47-70` | P3 | 3 | **✅ ZAMKNIĘTA `1778e96eca` (2026-06-17)** — (a) `requireRole` już na WSZYSTKICH member routes (GET/POST/PATCH/DELETE — weryfikacja read-only); (b) surowy `cardNumber` usunięty z `adminP32.routes.ts:1042`+`billing.routes.ts:2781` → `last4` z `paymentMethodId.slice(-4)` (brak PAN w logach/requests); (c) `/debug-memberships` — grep server/src/ = 0 trafień, endpoint nigdy nie istniał w obecnym kodzie; (d) martwy `InviteMemberSchema` import usunięty z `organizations.routes.ts`. |
| L-08 | martwy kod FE (`AdminSidebar` + resztki `Admin/`) | W-01 | `layout/AdminSidebar.tsx` (0 importerów) | P3 | 3/4 | **✅ ZAMKNIĘTA `d073e66508` (2026-06-17)** — usunięto z gita `Admin/AdminLayout.tsx` (196 lin), `Admin/AdminSidebar.tsx` (614 lin), `layout/AdminSidebar.tsx` (364 lin); wyczyszczono `Admin/index.ts` (4 martwe eksporty); 0 nowych błędów tsc. **(skoryg. 2026-06-19:** `src/components/layout/AdminSidebar.tsx` — usunięty w gicie, sierota untracked na dysku (364 l, `git status ?? `, 0 importerów w całym repo) przez git-race; w śledzonym kodzie L-08 prawdziwie zamknięta.) |
| L-09 | CI nie obejmuje `Londyn`; E2E admin smoke-fake | W-01 | `test-suite.yml` | P2 | 4 | **✅ ZAMKNIĘTA `f3bbfffcb8` (2026-06-17)** — 13/13 RBAC testów (`tests/components/Admin/admin-rbac.test.tsx`): ProtectedRoute ADMIN/OWNER/USER/SUPERADMIN gating (5), Team panel widoczny dla ADMIN (2), OWNER zmiana roli (2), anty-eskalacja SUPERADMIN nieobecny w UI+Zod (4). Londyn JEST w triggerach CI (`test-suite.yml:5-7`). **Dla H1 (CI):** ścieżka `tests/components/Admin/admin-rbac.test.tsx` → wpiąć jawnie wg wzoru M08. |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | karta-checkout | Stripe Elements (live) / **trwały label „managed by DBR77"** | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-11: label managed, bez live-checkout** |
| D-02 | resztki `components/Admin/` (część żyje w superadminie) | per plik: wytnij / przenieś / zostaw | Piotr | TBD | otwarta (modułowa) |

### 05 · Flagi/rollout — `VITE_STRIPE_ENABLED` (OFF → karta-checkout fasada honest, DP-11 label managed); gating ADMIN (`ProtectedRoute`) + `DesktopOnlyGuard`; beta-lock 3-warstwowy (W7).
### 06 · Ryzyka — Oba P0 cross-org NAPRAWIONE, ale bez testów regresji (B1/B2 = L-03) naprawa niezabezpieczona. Metodologia: SEC orzekł błędnie „wzorcowy" patrząc tylko na adminP32 — KAŻDY boczny router wymaga testu IDOR (side-router-weak-gate, wzorzec systemowy M20/M24/M27). Dev `.env` → Railway PROD (testy cross-org read-only).
### 07 · Log — 2026-06-17 (Harvard 4 runda 4): L-07 ZAMKNIĘTA (`1778e96eca`): PCI cardNumber usunięty z mock billing (adminP32+billing routes); debug-memberships nie istniał; InviteMemberSchema martwy import usunięty; requireRole weryfikacja OK na wszystkich member routes. L-09 ZAMKNIĘTA (`f3bbfffcb8`): 13/13 admin-rbac.test.tsx (ProtectedRoute 5×, Team panel 2×, OWNER zmiana roli 2×, anty-eskalacja 4×). L-05 ZAMKNIĘTA (`c432dab94c`) — 4 admin tables → FilterableTable (Members/Audit/Invoices/Payments). L-08 ZAMKNIĘTA (`d073e66508`) — dead AdminSidebar/AdminLayout cluster (3 pliki, ~1174 linii). **Dla H1 CI:** `tests/components/Admin/admin-rbac.test.tsx` — wpiąć wg wzoru M08. — 2026-06-13 (teczka pogłębiona): R3 potwierdza oba P0 NAPRAWIONE (`1f9ed50f05`+`fd8707c5b2`); korekta count 52→31 plików; DP-11 wpisane; enumeracja API + epiki Gherkin dodane. Re-audit 2026-06-11: F 3→8; Fala 6: C 8→9 (44 PASS); ocena 58. Re-ocena po testach regresji + Fazach 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + re-audit + kod-R3 + DP-11; uwagi żywe = brak) · R2 zero sierot (wejście→luka→story→DoD) · R3 statusy z dowodem (L-01/02 NAPRAWIONE — zweryfikowane w kodzie 2026-06-13; count 52→31 skorygowany) · R4 DoD z liczbami (i18n 0/31, hex 0, table 10) · R5 decyzje przekrojowe ROZSTRZYGNIĘTE (D-01=DP-11; D-02 modułowa otwarta); pozostaje R6/żywa weryfikacja · A–E docelowy zlinkowany · F epiki→stories Gherkin↔luki · G DoD+S+sec+wydajność · R6 sesja żywa = Fazy 3+4. **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Oba P0 cross-org (admin-data `1f9ed50f05` + ai-settings `fd8707c5b2`) są naprawione, ale dopóki brak testów regresji IDOR/escalation (L-03), naprawa jest niezabezpieczona — a lekcja metodologiczna (SEC zaufał tylko głównemu routerowi adminP32, przeoczył boczne) nakazuje pokryć testem KAŻDY boczny router.

## EKRANY (inwentarz) — 2026-06-19

Audyt weryfikacyjny: teczka SOLID. Oba P0 cross-org zweryfikowane jako NAPRAWIONE: `admin-data.routes.ts:44-45` mount-level `verifyToken`+`requireRole('super_admin','admin','owner')`+`:orgId` scope; `ai-settings.routes.ts` `userOrgId===orgIdStr` guard (`:220,259,627,707,756`). Live shell = `src/views/admin/AdminSettingsModule.tsx` = DOKŁADNIE 5 paneli (`:145-153`), zweryfikowane. Pozostałe ~35 plików `components/Admin/` = martwy kod lub superadmin (zgodne z założeniem teczki). L-08 (dead AdminSidebar): commit `d073e66508` faktycznie usunął 3 pliki z gita — UWAGA: `src/components/layout/AdminSidebar.tsx` (364 lin) istnieje w working-tree jako **plik nieśledzony, 0 importerów** (artefakt git-race, nie regresja); w śledzonym kodzie L-08 prawdziwa.

### Żywy shell (5 paneli — `AdminSettingsModule.tsx`)
| # | Panel (zakładka) | Cel | Plik komponentu |
|---|---|---|---|
| 1 | Members & Roles (`members`) | CRUD członków/ról + zaproszenia (cap 500), anty-eskalacja; FilterableTable (L-05 `c432dab94c`) | `src/components/Admin/AdminMembersRolesPanel.tsx` |
| 2 | Billing & FinOps (`billing`) | Billing/invoices/payment-methods — label „managed by DBR77" (DP-11); FilterableTable | `src/components/Admin/AdminBillingFinOpsPanel.tsx` |
| 3 | AI Control Center (`ai`) | Governance AI per org (9/9 pod-zakładek), cross-org naprawione | `src/components/Admin/AdminAIControlCenterPanel.tsx` |
| 4 | Security & Identity (`security`) | Security/SCIM/IAM/API-keys (6/6) | `src/components/Admin/AdminSecurityIdentityPanel.tsx` |
| 5 | Audit Log (`audit`) | Audit events + CSV export; org-scoped getLogs (L-04 `206a7f8324`); FilterableTable | `src/components/Admin/AdminAuditLogPanel.tsx` |
| — | Admin Settings Sidebar | Nawigacja 5 zakładek shella | `src/components/Admin/AdminSettingsSidebar.tsx` |

**Liczba żywych ekranów: 5 paneli + sidebar.** Pozostałe pliki `components/Admin/` (AdminScimLifecyclePanel, AdminIamPolicyPanel, AICostDashboard, ComplianceDashboard, LLMHealthPanel, ChatV9Flags*, itd.) = NIE wpięte w live shell (martwy/superadmin kod, D-02 otwarta per plik). RBAC test 13/13 (`f3bbfffcb8`), cross-org IDOR test 15/15 (`d5e46a5160`).
