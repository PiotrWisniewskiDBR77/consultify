# M23 — Organizacja — FAZA 2 (Testy automatyczne)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` · **SHA:** `78b888c49234c5d0c82fb055817d4c366c399a28`
**Agent:** TESTY · **Log:** `Harvard/modules/M23-organizacja/evidence/f2_tests.log`

## WYNIK ZBIORCZY

| Warstwa | Pliki | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|---|
| FE (vitest) | 12 | 59 | 0 | 0 | 3.37s |
| BE unit (vitest) | 11 | 49 | 0 | 45 | 1.65s |
| Integ + server/src (vitest) | 9 | 77 | 3 | 0 | 1.65s |
| E2E (playwright) | 2 | — | — | — | NIE URUCHOMIONO (wymaga serwera) |
| **RAZEM (statyczne)** | **32** | **185** | **3** | **45** | — |

---

## 1. INWENTARZ TESTÓW

### FE (komponenty/widoki) — `npx vitest run`
| Plik | Zakres | # | Wynik |
|---|---|---|---|
| `tests/components/organization/OrganizationView.test.tsx` | routing sekcji (goals/challenges/strategy → moduły, admin → panel), megatrends redirect, nawigacja+funnel, back, mobile menu | 8 | PASS |
| `tests/components/organization/OrganizationSidebar.test.tsx` | nawigacja, grupy collapse, auto-expand, brak back, nieznana sekcja | 5 | PASS |
| `tests/unit/components/Organization/OrganizationView.smoke.test.tsx` | smoke render | 3 | PASS |
| `tests/unit/components/Organization/KnowledgeGraphExplorer.smoke.test.tsx` | search input, dispatch `Api.kgSearchEntities`, empty state (0 encji) | 3 | PASS |
| `tests/unit/components/Organization/OrganizationAdminPanel.domains.honesty.test.tsx` | honest-UI: brak fałszywego sukcesu przy stale read-back domeny/email | 2 | PASS |
| `tests/unit/components/Organization/OrgContextSummaryBanner.smoke.test.tsx` | GET org-context, empty, fetch-error silent, POST rebuild (admin), brak przycisku dla non-admin | 6 | PASS |
| `tests/components/OrgSwitcher.test.tsx` | switcher: render, role, dropdown, **switchOrg przy wyborze**, checkmark, role badges, compact, a11y | 15 | PASS |
| `tests/components/settings/OrganizationContextOverview.test.tsx` | claims z Context OS, rebuild+reload | 2 | PASS |
| `tests/components/settings/OrganizationSettings.test.tsx` | ustawienia org | 2 | PASS |
| `tests/components/Admin/organization/CompanyAddressSettings.test.tsx` | adres firmy | 2 | PASS |
| `tests/components/Admin/organization/FiscalYearSettings.test.tsx` | rok fiskalny | 2 | PASS |
| `tests/components/Admin/organization/DataHostingSettings.test.tsx` | hosting danych | 2 | PASS |

### BE unit — `npx vitest run`
| Plik | Zakres | # | Wynik |
|---|---|---|---|
| `tests/unit/backend/controllers/OrganizationController.test.ts` | getCurrentOrganizations, create, getById (member/403/superadmin) | 7 | PASS |
| `tests/unit/backend/controllers/OrganizationController.audit.test.ts` | audyt akcji org | 3 | PASS |
| `tests/unit/backend/middleware/orgContext.middleware.test.ts` | org-scope middleware (L1) | 48 | **45 SKIP** / 3 PASS |
| `tests/unit/backend/middleware/orgContext.safety.test.ts` | bezpieczeństwo org-context | 3 | PASS |
| `tests/unit/backend/utils/requestOrganization.test.ts` | ekstrakcja org z requestu | 3 | PASS |
| `tests/unit/backend/services/organizationContextService.test.ts` | append-only items+claims, precedencja claim>legacy | 2 | PASS |
| `tests/unit/backend/services/organizationMetricsService.test.ts` | metryki org | 9 | PASS |
| `tests/unit/backend/services/competencyTaxonomy.test.ts` | taksonomia kompetencji | 8 | PASS |
| `tests/unit/backend/services/aiContextBuilder.organizationContext.test.ts` | wstrzyknięcie org-context do AI | (część) | PASS |
| `tests/unit/backend/routes/auth.routes.switch-organization-status.test.ts` | normalizacja statusu przy switch org | 2 | PASS |
| `tests/unit/backend/v4-smoke/r0-knowledge-graph.test.ts` | smoke knowledge-graph | 7 | PASS |

### Integracyjne + server/src — `npx vitest run`
| Plik | Zakres | # | Wynik |
|---|---|---|---|
| `tests/integration/routes/organization.p30.test.ts` | **S1 profil**: GET profile+resolved-context, trust (GET/PUT 403), conflicts, reuse-contract, audit (role-gate), snapshot rebuild po update, ekstrakcja dokumentu UI, downstream reuse (AI) | 36 | PASS |
| `tests/integration/routes/auditLog.organizationContext.test.ts` | audyt org-context (admin-scope, confirmation gates, requeue/recover) | 11 | PASS |
| `tests/integration/routes/branding.routes.auth.test.ts` | **S6 branding**: granice auth (superadmin może edytować cudzą org) | 3 | PASS |
| `tests/integration/routes/organization-context.routes.test.ts` | trasy org-context | 3 | PASS |
| `tests/integration/organizations/organization-endpoints.test.ts` | partner-code/attribution (400/null/invalid) | 3 | PASS |
| `tests/integration/p04-kpi-goals-enterprise.contract.test.ts` | kontrakt KPI/goals (macierz permisji viewer, workflow states) | 18 | PASS |
| `server/src/controllers/__tests__/OrganizationController.membership.test.ts` | członkostwo | 6 | PASS |
| `server/src/services/__tests__/organizationIdentityService.test.ts` | tożsamość org | 3 | PASS |
| `tests/integration/routes/organizationData.no-stubs.test.ts` | export danych org (stats/export) | 3 | **3 FAIL** |

### E2E (Playwright) — NIE URUCHOMIONO (wymaga żywego serwera)
| Plik | Zakres | # | Uwaga |
|---|---|---|---|
| `tests/e2e/goals/goal-management.spec.ts` | dostęp /goals, /goals/new, detail | 6 | **SŁABY / false-green** (asercja `url` truthy lub regex zawiera `login`) |
| `tests/e2e/smoke/deploy-gate-api-branding-org-profile.spec.ts` | deploy gate: branding+org-profile nie 5xx, role-gate 403 | 20 | smoke (`E2E_API_URL=127.0.0.1:3001`) |

---

## 2. ROOT-CAUSE FAILUR (3 FAIL)

**Plik:** `tests/integration/routes/organizationData.no-stubs.test.ts` (wszystkie 3 testy)

- **Objaw:** test oczekuje `503` + `code: FEATURE_UNAVAILABLE`, otrzymuje `200` (`/export/users`), `400` (`/export/all`, `/stats`).
- **Przyczyna:** **STALE TEST (martwa asercja na nieistniejący stub).** Route `server/src/routes/organization/organization-data.routes.ts` został **w pełni zaimplementowany** — handlery `/stats`, `/export/:category`, `/export/all` robią realny `safeSelectRows` i zwracają `200` (sukces) lub `400` (brak `organizationId`). Kod `FEATURE_UNAVAILABLE`/`503` **już nie występuje** w pliku route (grep: 0 trafień). Test pisany był, gdy feature był stubem zwracającym 503; nazwa pliku „no-stubs" jest teraz ironicznie sprzeczna z treścią.
- **Werdykt:** to **nie jest bug produktu** — to test do aktualizacji. Produkt działa (lepiej niż test zakłada).
- **Nie wystąpiły:** mock-drift i18next, stale import, brak Router, schema-drift PG, rola iris, fałszywa zieleń fetch-bez-serwera. Wszystkie pozostałe pliki czyste.

**45 SKIP:** `tests/unit/backend/middleware/orgContext.middleware.test.ts` — cały describe za `describeIfDb = RUN_DB_TESTS==='1' ? describe : describe.skip`. Bez `RUN_DB_TESTS=1` (brak żywej PG) 45/48 testów org-scope middleware **nie wykonuje się**. To realna luka pokrycia org-scope w domyślnym przebiegu.

---

## 3. MAPA POKRYCIA SCENARIUSZY (S1–S7)

| Scenariusz | FE | BE | E2E | PR-gate | Luka |
|---|---|---|---|---|---|
| **S1** Profil firmy (GET/PUT + ekstrakcja AI) | ✅ (OrganizationView routing do OrganizationProfileModule; OrgContextSummaryBanner) | ✅✅ `organization.p30.test.ts` (36, mocny: profile/trust/conflicts/reuse/audit/rebuild/ekstrakcja), `organizationContextService` | ⚠️ tylko deploy-gate smoke (nie uruch.) | ❌ (Londyn nie wyzwala) | brak FE testu samego formularza profilu (PUT z pola) |
| **S2** Goals/Challenges/Strategy (localStorage) | ⚠️ tylko routing do modułów w OrganizationView; **brak testu persystencji `consultify-context-builder`** | ⚠️ tylko kontrakt KPI/goals (`p04`, nie persystencja) | ⚠️ `goal-management.spec` false-green | ❌ | **DUŻA: persystencja localStorage Zustand niezatestowana** |
| **S3** Knowledge graph | ✅ `KnowledgeGraphExplorer.smoke` (search/empty/dispatch) | ✅ `r0-knowledge-graph` smoke (7) | ❌ | ❌ | brak testu krawędzi/relacji, błędów API |
| **S4** Members + zaproszenia | ⚠️ admin sekcja → redirect do ADMIN.PEOPLE (poza modułem) | ✅ `OrganizationController.membership` (6), `OrganizationController` getById member/403 | ❌ | ❌ | brak testu samego flow zaproszenia w widoku org |
| **S5** Competencies CRUD | ❌ brak FE testu (CompetencyCatalog.tsx) | ⚠️ `competencyTaxonomy` (8, taksonomia) — nie pełny CRUD route | ❌ | ❌ | **brak FE; brak testu route competency.routes (POST/PUT/DELETE)** |
| **S6** Domains / Branding | ✅ `OrganizationAdminPanel.domains.honesty` (honest-UI) | ✅ `branding.routes.auth` (granice ról) | ⚠️ deploy-gate smoke (nie uruch.) | ❌ | brak testu walidatorów branding/domain happy-path CRUD |
| **S7** Org switch (wymiana tokenu) | ✅✅ `OrgSwitcher` (15, switchOrg, role badges, a11y) | ✅ `auth.routes.switch-organization-status` (normalizacja statusu) | ❌ | ❌ | brak testu **realnej wymiany tokenu JWT** po switch (tylko status) |

**Legenda:** ✅✅ mocne · ✅ jest · ⚠️ częściowe/słabe · ❌ brak

### PR-gate (kontekst)
`test-suite.yml` wyzwala się **tylko na `main`/`develop`** (push + PR). Default branch repo = **`Londyn`**, bieżąca = `feat/deliverables-light`. **Żadna z tych gałęzi nie uruchamia bramki PR.** Faktycznie testy M23 **nie są bronione w CI** przy normalnym workflow (Londyn → praca). To systemowa luka gate dla całego modułu.

---

## 4. PUŁAPKI / FAŁSZYWA ZIELEŃ

1. **Persystencja localStorage Goals/Challenges/Strategy NIETESTOWANA (S2).** Dane idą do Zustand `persist` (`consultify-context-builder`, `createJSONStorage(localStorage)` w `src/store/useContextBuilderStore.ts:414`). Żaden test nie sprawdza zapisu/odczytu/migracji tego klucza ani round-tripu po reloadzie. To główny mechanizm trwałości S2 — całkowicie odsłonięty.
2. **org-scope/role-gate org-context: 45 SKIP.** Middleware org-scope (`orgContext.middleware.test.ts`) — najważniejszy test izolacji multi-tenant — nie wykonuje się bez `RUN_DB_TESTS=1`. W domyślnym przebiegu fałszywa zieleń „49 passed" maskuje 45 nieuruchomionych. (Role member-vs-admin są testowane w innym miejscu: `OrganizationController.getById` 403, `OrgContextSummaryBanner` brak przycisku non-admin, `branding.routes.auth`, `organization.p30` audit role-gate — więc role-gate per-se OK, ale org-isolation middleware nie.)
3. **E2E `goal-management.spec.ts` = false-green.** Asercje `expect(url).toMatch(/goals|okr|login|objectives/)` i `expect(url).toBeTruthy()` przejdą nawet przy redirect na login lub całkowitym braku feature. Zero wartości regresyjnej.
4. **Mockowanie serwisów:** FE testy szeroko mockują `Api.*`/fetch (KnowledgeGraph, OrgContextSummaryBanner) — poprawne dla unit, ale **brak realnego E2E** wpiętego w CI oznacza, że kontrakt FE↔BE nie jest weryfikowany end-to-end (poza nieuruchamianym deploy-gate).
5. **`organizationData.no-stubs.test.ts`** — odwrotność fałszywej zieleni: fałszywa czerwień (test stary, produkt zdrowy). Wymaga aktualizacji, nie blokuje.

---

## 5. BACKLOG TESTOWY

| # | Prio | Typ | Plik docelowy | Scenariusz |
|---|---|---|---|---|
| 1 | **P1** | fix (stale) | `tests/integration/routes/organizationData.no-stubs.test.ts` | Przepisać: route zwraca 200 (export) / 400 (brak orgId), nie 503. Asercje na realny kształt (`scoped`, `selectedColumns`, attachment headers) lub usunąć przestarzały plik. |
| 2 | **P1** | unit FE | `src/store/__tests__/useContextBuilderStore.persist.test.ts` (nowy) | S2: round-trip Goals/Challenges/Strategy przez localStorage `consultify-context-builder` — zapis, reload, hydratacja, migracja wersji. |
| 3 | **P1** | unit BE | uruchamiać `orgContext.middleware.test.ts` w CI z PG | S-multi-tenant: 45 SKIP → odpalać z `RUN_DB_TESTS=1` na bramce z bazą; org-isolation nie może być pomijana. |
| 4 | **P2** | integ BE | `tests/integration/routes/competency.routes.crud.test.ts` (nowy) | S5: pełny CRUD competency (POST/PUT/DELETE + role-gate admin vs member). |
| 5 | **P2** | integ BE | `tests/integration/routes/auth.switch-organization.token.test.ts` (nowy) | S7: realna wymiana tokenu JWT po switch org (nie tylko normalizacja statusu) — nowy claim org w tokenie, odrzucenie po opuszczeniu org. |
| 6 | **P2** | E2E | `tests/e2e/goals/goal-management.spec.ts` | Zaostrzyć: usunąć `login` z regexu, asertować realny element widoku Goals + persystencję wpisu po reloadzie (zamiast `url` truthy). |
| 7 | **P3** | FE | `src/components/Organization/__tests__/CompetencyCatalog.test.tsx` (nowy) | S5 FE: render katalogu, add/edit/usuń kategorię/poziom, walidacja. |
| 8 | **P3** | integ BE | `tests/integration/routes/branding.crud.test.ts` (nowy) | S6: happy-path branding/domain CRUD + walidatory (`branding.validators.ts`, `organization-profiles.validators.ts`), nie tylko granice ról. |
| 9 | **P3** | CI | `.github/workflows/test-suite.yml` | Rozważyć wyzwalanie gate na `Londyn` (default) — obecnie moduł M23 niebroniony w realnym workflow. |
