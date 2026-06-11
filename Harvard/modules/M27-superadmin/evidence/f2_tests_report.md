# M27 SuperAdmin (control plane) — FAZA 2: Testy

**Agent:** TESTY · **Data:** 2026-06-11 · **Branch:** `feat/deliverables-light`
**Zakres:** SuperAdminView; Customers/AIPlatform/System/Security modules; serwer superadmin/admin control-plane routes + RBAC gate.
**Evidence log:** `Harvard/modules/M27-superadmin/evidence/f2_tests.log`

---

## 1. WYNIKI URUCHOMIENIA — PASS / FAIL / SKIP

Uruchomiono w 9 partiach (A–I). Liczby per partia (zderowane do unikalnego zbioru M27):

| Batch | Co | Pliki | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|---|---|
| A | RBAC gate — `superAdmin.middleware` unit | 1 | 42 | 0 | 0 | 2.4s |
| B | FE: roleGuards, policy-context bypass, SSO view, nav/modules | 7 | 14 | **1** | 0 | 3.3s |
| C | integration/routes superadmin REST smoke | 12 | 89 | 0 | 0 | ~17s |
| D | BE: analytics-superadmin route, landingSuperadmin, operatorAdmin, featureFlag(v8) | 4 | 212 | 0 | 0 | ~5s |
| E | integration superadmin `*-api` (gate **zamockowany**) + routing/nav | 9 | 27 | 0 | 0 | ~3s |
| F | customers-api lifecycle + operator-plane | 2 | 8 | 0 | 0 | ~1s |
| G | gate-presence contract p31-33 + FeatureFlagsPanel | 2 | 80 | **1** | 0 | ~1s |
| H | core SuperAdmin module component tests | 12 | 51 | 0 | 0 | ~5s |
| I | cały katalog `tests/components/SuperAdmin/*.test.tsx` (zawiera H) | 42 | 103 | **7** | 0 | ~10s |

**Zagregowane unikalne (M27 in-scope), dedup H wewnątrz I:**
- **PASS ≈ 502** · **FAIL = 9** · **SKIP = 0** (twardych skipów brak; patrz pułapki — są *miękkie* skipy `if (!token) return;`)
- Dziewięć FAIL = 1 (B: SSO) + 1 (G: p31-33) + 7 (I: components).
- **0 hard-skip**, ale liczne testy są *no-op asercjami* (false-green, sekcja 4).

---

## 2. ROOT-CAUSE — 9 FAIL

| # | Plik | Test | Root-cause | Typ |
|---|---|---|---|---|
| 1 | `src/__tests__/superadmin/SSOConfigurationView.test.tsx` | renders overview stats and loads configs | Źródło `SSOConfigurationView.tsx:484` robi `config.providerType.replace('_',' ')` — mock zwraca pole `provider:'google'`, a komponent czyta `providerType`/`providerName` (undefined) → crash. **Mock-drift + brak null-guard w źródle.** | mock-drift / realny bug fragility |
| 2 | `tests/integration/routes/settings-admin-superadmin.p31-33.test.ts` | AdminSettingsModule redirects legacy admin branches… | Stary `fs.readFileSync`-grep oczekuje mapowań `SECTION_ALIASES` (`overview:'people'`…) w `src/views/admin/AdminSettingsModule.tsx`, źródło zmienione. **Stale source-grep** (org-admin IA, tylko muśnięcie M27). | stale assertion |
| 3 | `tests/components/SuperAdmin/OverviewModule.root-closure.test.tsx` | (load) | `Failed to resolve import ../../../src/views/superadmin/OverviewModule` — plik przeniesiony/zmieniony. | **stale import** |
| 4 | `tests/components/SuperAdmin/SuperadminRootClosurePanel.test.tsx` | (load) | `Failed to resolve import ../../../src/components/SuperAdmin/SuperadminRootClosurePanel`. | **stale import** |
| 5 | `tests/components/SuperAdmin/SuperAdminFeedbackView.deeplink-query.contract.test.tsx` | 4 testy | `useNavigate() may be used only in the context of a <Router>`. | **brak Router** |
| 6 | `tests/components/SuperAdmin/SuperAdminFeedbackAnalyticsView.error.contract.test.tsx` | 2 testy | `useNavigate()` poza `<Router>`. | **brak Router** |
| 7 | `tests/components/SuperAdmin/SuperAdminFeedbackBacklogView.error.contract.test.tsx` | non-leaking alert | **REALNY BUG:** widok renderuje surowy `internal: SQLSTATE[HY000] /var/app/secrets` zamiast copy „Feedback backlog is temporarily unavailable…". Wyciek komunikatu błędu w panelu superadmina. | **realny bug (leak)** |

Uwaga środowiskowa (NIE liczone jako FAIL): wszystkie testy integracyjne `*.test.js` ustawiają `SQLITE_PATH`, ale serwer i tak uderza w **realny Postgres** → logi `role "iris" does not exist`, padają health-checki i część zapytań. Testy „przechodzą" tylko dlatego, że akceptują 500 w `VALID_STATUSES` → **fałszywa zieleń + schema/role-drift PG** (patrz §4).

---

## 3. CZY SUPERADMIN-GATE RBAC JEST TESTOWANY? — TAK (rdzeń), ale obejścia w warstwie route

- **TAK, dobrze:** `tests/unit/backend/middleware/superAdmin.middleware.test.ts` — **42/42 PASS**. Pokrywa ścieżki odrzucenia (401/403), brak tokenu, sub≠id (tamper JWT), brak wiersza users mimo claim SUPERADMIN → **403**, fallback do DB gdy rola w tokenie ≠ SUPERADMIN, aliasy `SUPER_ADMIN`/`super_admin`, capability-gate (`requireSuperAdminCapability`) z fail-closed 500 dla nieznanej/pustej capability. To jest **realny test bramki**.
- **TAK, kontraktowo:** `settings-admin-superadmin.p31-33.test.ts` grepuje obecność `router.use(requireSuperAdmin)`, `requireSuperAdminCapability('billing_ops'|'ai_ops')` na routach v8 feature-flags/billing/ai oraz `buildDenialResponse` → 403.
- **TAK, jednostkowo dla derywacji uprawnień:** `tests/integration/routing/superadmin-routing.test.ts` (6, REAL_CODE) — kanoniczne capability dla SUPERADMIN.
- **CZĘŚCIOWO (route-level reject):** `superadmin-customers/iam/support.test.js` tworzą realnych userów SUPERADMIN+ADMIN, logują się i sprawdzają „403 for regular users". **ALE** asercja `expect([401,403,404]).toContain(status)` jest słaba — ADMIN dostający **404** (route-not-found) zaliczy tak samo jak prawdziwe 403; plus `if(!regularToken)return;` cicho pomija przy nieudanym loginie.
- **NIE (luka):** wszystkie `tests/integration/superadmin-*-api.test.ts` **mockują bramkę** (`requireSuperAdmin: (_q,_r,next)=>next()`, `requireSuperAdminCapability: ()=>()=>next()`) → testują payload handlerów, **nie** odrzucenie non-superadmina end-to-end.
- **NIE (E2E):** żaden spec w `tests/e2e/superadmin/*.spec.ts` nie testuje scenariusza non-superadmin → 403/redirect/access-denied; wszystkie zakładają dostęp (`page.goto('/superadmin/...')`).

**Werdykt:** rdzeniowa bramka RBAC jest solidnie pokryta na poziomie middleware (unit) i kontraktu obecności. Brakuje **route-/E2E-level dowodu odrzucenia** z prawdziwym tokenem non-superadmina i twardą asercją `=== 403`.

---

## 4. PUŁAPKI / FAŁSZYWA ZIELEŃ

1. **Permisywne `VALID_STATUSES`** (ai-platform/revenue/security/system/configuration/analytics/overview/orgs `*.test.js`): `[200,201,400,401,403,404,500,501]`. Test przechodzi niezależnie od wyniku — **nie weryfikuje nic** (200 i 500 i 403 są „OK"). Brak nagłówków auth → nie testuje nawet allow-path.
2. **Schema/role-drift PG (`role "iris" does not exist`)**: `SQLITE_PATH` ignorowany, serwer łączy się z realnym Postgresem, health-check pada — maskowane przez (1). To realny problem testowego DB cwd/env, dający fałszywą zieleń.
3. **Bramka zamockowana** w `superadmin-*-api.test.ts` (§3) — „REAL integration" w nazwie myli; DB też mockowane → **brak realnej persystencji** i brak reject-path.
4. **Miękkie skipy**: `if (!superadminToken) return;` / `if (!regularToken) return;` — gdy login padnie, asercje są pomijane bez SKIP-marka → wygląda na PASS.
5. **Feature-flags persystencja**: `superadmin-configuration` testuje tylko **GET** feature-flags z `VALID_STATUSES` (no-op). `FeatureFlagsPanel.test.tsx` (2) to render+toggle na zamockowanym API — **brak testu realnego zapisu/persystencji** superadmin feature-flag. `featureFlagService.test.ts` (36, PASS) dotyczy v8 org-level shadow-mode z mock-DB, **nie** superadmin System toggle.
6. **AI-config persystencja**: `PUT /ai/providers/:id` testowane wyłącznie przez `VALID_STATUSES` → **brak dowodu zapisu** konfiguracji providera/modelu/tieru.
7. **Orphan/dead E2E**: pliki `*.spec` (bez `.ts`) w `tests/e2e/superadmin/` (customers-module-support, iam-audit-logs, customers-module-security, iam-module) **nie pasują** do Playwright `**/*.spec.ts` — martwe.
8. **AdminBillingFinOpsPanel.test.tsx** to panel **org-admina**, nie superadmin RevenueModule — nie pokrywa commercial control-plane.

---

## 5. MAPA POKRYCIA S1–S7

PR-gate: `test-suite.yml` odpala unit/component/coverage **tylko na `main`/`develop`** (i `workflow_dispatch`). Domyślny branch = `Londyn`, branch roboczy = `feat/deliverables-light` → **bramki testowe zdeferowane**, M27 nie jest chroniony per-PR. E2E to `e2e-nightly/weekly`, nie PR-blokujące.

| Sekcja | FE | BE | E2E | PR-gate | Ocena |
|---|---|---|---|---|---|
| **S1 Tenant & User Ops** (org/user mgmt) | 🟡 component render (CustomersModule, OrganizationsView, SuperAdminUserManagement) | 🟡 `superadmin-customers/organizations/iam` smoke + customers-api lifecycle (gate mock, DB mock) | 🟡 `customers-module-complete.spec.ts` (28) + resource-allocation (29), zakładają dostęp | ❌ defer | Średnie; brak realnej mutacji+RBAC reject |
| **S2 AI Operations** (providers/tiers/routing) | 🟡 AIPlatformModule/AIModules render | 🟡 `superadmin-ai-platform` (no-op VALID_STATUSES) | 🟡 `ai-platform.spec.ts` (17) | ❌ defer | **Słabe**; brak testu persystencji konfiguracji AI |
| **S3 Feature Flags** (System) | 🟡 FeatureFlagsPanel render+toggle (mock) | 🟡 GET no-op + p31-33 grep `requireSuperAdmin` | 🟡 system-monitoring (17) | ❌ defer | **Słabe**; brak testu zapisu/persystencji flagi |
| **S4 Platform Security** (roles/perm/SSO/SCIM) | 🔴 SSOConfigurationView **FAIL** (crash); SecurityModule/SecurityPoliciesPanel render | 🟢 `superAdmin.middleware` 42/42 (role/JWT/capability) + `superadmin-security` smoke | 🟡 iam-module.spec (orphan `.spec`) | ❌ defer | Mieszane: gate mocny, SSO/SCIM słabe (1 FAIL, brak SCIM testu) |
| **S5 Governance / audit** | 🟡 SignalCenter, OverviewModule | 🟢 analytics-superadmin (4, hardening: blokuje operator-SQL), operator-plane (3), landingSuperadmin (77) | 🟡 iam-audit-logs (orphan) | ❌ defer | OK na BE governance |
| **S6 Commercial / Revenue** (billing) | 🟡 RevenueModule/Subscriptions/Invoices/BillingOverview/CreditNotes render | 🟡 revenue-api (5, mock DB+gate), `superadmin-revenue` no-op | 🟡 revenue-module-complete (44) + revenue-billing (22) | ❌ defer | Średnie; mock-only, brak realnej fakturacji E2E PR-gated |
| **S7 superadmin RBAC gate** (non-super → 403) | 🟢 policy-context.superadmin-bypass (2), roleGuards (3) | 🟢 **middleware 42/42** + routing REAL_CODE (6) + p31-33 grep | 🔴 **brak** E2E reject scenario | ❌ defer | Rdzeń mocny; **luka route-/E2E-level reject** |

Legenda: 🟢 realne · 🟡 smoke/render/mock · 🔴 brak/fail.

---

## 6. BACKLOG (typ · plik · scenariusz · priorytet)

**P0 — realne bugi/wycieki:**
- **BUG-fix** · `src/views/superadmin/SuperAdminFeedbackBacklogView.tsx` · wyciek surowego `internal: SQLSTATE[HY000] /var/app/secrets` zamiast non-leaking copy — naprawić źródło; test już to łapie. **P0** (wyciek sekretu/ścieżki w panelu superadmina).
- **BUG-fix** · `src/views/superadmin/SSOConfigurationView.tsx:484` · dodać guard `config.providerType?.replace(...)`/`providerName ?? providerType ?? '—'` — crash na braku pola. **P0**.

**P0 — superadmin-gate RBAC (główny brak):**
- **E2E** · `tests/e2e/superadmin/rbac-gate.spec.ts` (nowy) · zaloguj non-superadmin (ADMIN/USER), wejdź na `/superadmin/*` → oczekuj redirect/`access-denied`, **brak** danych control-plane. **P0**.
- **Integration** · `tests/integration/superadmin-gate-reject.test.ts` (nowy) · realny token ADMIN na reprezentatywnych routach każdej sekcji (customers, ai, revenue, security, system, configuration) → twarda asercja **`=== 403`** (nie `[401,403,404]`). **P0**.
- **Refactor** · `superadmin-customers/iam/support.test.js` · zacieśnić `expect([401,403,404])` → `toBe(403)` dla zalogowanego ADMINa; usunąć `if(!token)return;` (zamienić na `expect(token).toBeTruthy()`). **P1**.

**P1 — persystencja (S2/S3/S6):**
- **Integration** · S3 feature-flags · realny zapis: superadmin PUT flagi → GET potwierdza wartość w DB (bez mock-DB). **P1**.
- **Integration** · S2 AI config · `PUT /ai/providers/:id` / tier assignment → odczyt potwierdza zmianę; asercja na body, nie `VALID_STATUSES`. **P1**.
- **Integration** · S6 revenue · realna ścieżka plan/credit/limit zamiast `requireSuperAdmin:next()` mock. **P1**.

**P1 — naprawa testów (stale/router):**
- **Fix-test** · `OverviewModule.root-closure.test.tsx`, `SuperadminRootClosurePanel.test.tsx` · zaktualizować ścieżki importu do bieżącej lokalizacji źródła. **P1**.
- **Fix-test** · `SuperAdminFeedbackView.deeplink-query`, `SuperAdminFeedbackAnalyticsView.error.contract` · owinąć render w `<MemoryRouter>`. **P1**.
- **Fix-test** · `settings-admin-superadmin.p31-33.test.ts:486` · zaktualizować oczekiwane `SECTION_ALIASES` do bieżącego `AdminSettingsModule.tsx`. **P2** (poza M27).

**P2 — higiena/false-green:**
- **Infra** · testy `*.test.js` · wymusić SQLite (cwd=repo-root / poprawne env) by usunąć `role "iris"` PG-drift; zamienić permisywne `VALID_STATUSES` na konkretne kody. **P2**.
- **Cleanup** · orphan E2E `*.spec` (bez `.ts`) w `tests/e2e/superadmin/` · zmienić na `.spec.ts` lub usunąć. **P2**.
- **FE** · SCIM (`SCIMProvisioningView.tsx`) · brak jakiegokolwiek testu — dodać render+contract. **P2**.
