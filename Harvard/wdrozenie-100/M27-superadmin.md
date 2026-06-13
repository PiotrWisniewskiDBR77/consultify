# WP M27 — SuperAdmin (control plane) · dokończenie do 100%

**Pula:** internal · **Karta:** `Harvard/modules/M27-superadmin/KARTA_AUDYTU.md` (ocena 58/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak P0 (NAPRAWIONE) · 🟦 **WYMAGA KONTA SUPERADMIN** do pełnej weryfikacji
**Faza programu:** FAZA 3 (P1 + live-verify + E2E) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Control plane w ~95% realny (nie fasada) z wzorcową główną bramką: `superadmin.routes.ts` ma router-level `verifyToken→requireSuperAdmin→requireAudit` + capability sub-gates; `verifySuperAdmin` (`superAdmin.middleware.ts:403-426`) ZAWSZE odpytuje DB (token-role ignorowany dla elewacji, fail-closed 403); P0 „superadmin dziedziczy admin" zamknięty dwukierunkowo (`ProtectedRoute.tsx:72-73`). ~60+ zakładek realnych (Tenant Ops, AI Operations 27 pod-zakł., System, Platform Security, Governance) z persystencją (feature flags + history, AI providers/tiers, Stripe, module-access + bootstrap DBR77). **Naprawione w audycie:** oba P0 boczne — `llm.routes.ts` tiers/assign+priority `verifySuperAdmin` i `virtual-workers.routes.ts` `requireRole('super_admin')` only (commit `91c8245559`); FeedbackBacklog secret-path leak + SSO crash guard (commit `69ffc1fd86`); feedback 500 fix w kodzie (`36ceb52c60`, live-verify pending). Pozostaje: 2×P1 (llm purposes/market global writes), live-verify feedback/SSO, brak E2E 403-reject, martwy kod, i18n 114/124. NIE planować od nowa P0 — zamknięte.

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 3 + 4)
- **[live-verify]** `SuperAdminFeedbackBacklogView` secret-leak + `SSOConfigurationView.tsx:484` crash — NAPRAWIONE (`69ffc1fd86`); zweryfikować żywo (brak SQLSTATE w odpowiedzi, SSO renderuje). 🟦 wymaga konta superadmin.
- **[P2] martwy płaski `views/superadmin/AIPlatformModule.tsx`** (152 l., 0 importów — żywy to folder `AIPlatformModule/`) + orphan `iam/IAMModuleView.tsx` (70 l., 0 API) → wytnij. FAZA 3.
- i18n: **[P2]** 114/124 plików superadmin bez `useTranslation`/`t()` (hardkod EN). **[P3]** 45 hex literałów. FAZA 4 (lub świadomy dług internal).

### (b) BACKEND / API — **P1 (FAZA 3)**
- **[P1 SEC-03]** `POST /llm/purposes` + `/purposes/:purpose/assignments` (verifyAdmin) piszą globalne `ai_purposes`/`ai_purpose_assignments` (org_id NULL); `PUT /llm/org/:id/policy` (verifyAdmin) cudze `:id`. Fix: `verifySuperAdmin`.
- **[P1 SEC-04]** `POST /llm/market/openrouter/sync` + `PUT /llm/market/inbox/:id` tylko `verifyToken` (global `ai_market_inbox`). Fix: `verifySuperAdmin`.
- **[obserwacja systemowa]** side-router-weak-gate to powtarzalny wzorzec (M20/M16/M24/M27) — przeskanować WSZYSTKIE mounty pod routery ze słabszym gate niż główny odpowiednik.

### (c) INTEGRACJA / TESTY (FAZA 3 + 4)
- **[P0 testowy] brak E2E non-superadmin→403** — `superAdmin.middleware.test.ts` 42/42 PASS, ale route-testy `expect([401,403,404])` (404 zalicza jak 403 — maskuje brak gate). FAZA 3: E2E `rbac-gate.spec` + integration `superadmin-gate-reject` z twardym `=== 403` na reprezentatywnym roucie KAŻDEJ sekcji + **bocznych routerach llm/virtual-workers**.
- **[P1]** realna persyst. testy feature-flags/AI-config/revenue (zdjąć mock-gate `next()` + mock-DB — `*.test.js` uderzają w realny PG `role "iris"` maskowane permisywnym `VALID_STATUSES`); fix stale-import (`OverviewModule.root-closure`), brak `<Router>` (Feedback/Analytics). FAZA 3/4.
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → M27 niechroniony per-PR. FAZA 4: trigger `Londyn`; zacieśnić `[401,403,404]`→`403`; test SCIM.

### (d) ŚRODOWISKA (FAZA 3) — 🟦 wymaga konta superadmin
- Live-verify: curl `POST /api/llm/tiers/assign` na zwykłym koncie → 403 (P0 fix `91c8245559`); `POST /api/virtual-workers` na org-adminie → 403; non-superadmin na reprezentatywnym `/superadmin` → access-denied; feedback 500 fix wdrożony (pulse/feature → 200). **Uwaga DB:** dev `.env` może wskazywać Railway PROD — NAJWYŻSZA ostrożność (control plane!).

## 3. Kroki realizacji
1. **(FAZA 3)** `verifySuperAdmin` na llm purposes/market (SEC-03/04); skan side-router-weak-gate na wszystkich mountach.
2. **(FAZA 3)** E2E + integration RBAC-reject (non-superadmin→403, twarde `===`) na sekcjach + bocznych routerach llm/virtual-workers.
3. **(FAZA 3, 🟦)** Live-verify P0 fix (`91c8245559`), feedback 500 (`36ceb52c60`), SSO/FeedbackBacklog (`69ffc1fd86`) na koncie superadmin.
4. **(FAZA 3)** Wytnij płaski `AIPlatformModule.tsx` + orphan `IAMModuleView`.
5. **(FAZA 3/4)** Realna persyst. testy (zdjąć mock-gate/mock-DB); fix stale-import/Router.
6. **(FAZA 4)** i18n 114 plików (lub świadomy dług internal); tokeny 45 hex; trigger CI `Londyn`; zacieśnić asercje `403`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** secret-leak/SSO crash zweryfikowane (`69ffc1fd86`); feedback 500 wdrożony; martwy kod usunięty.
2. **Bezpieczeństwo:** oba P0 boczne zamknięte (już — `91c8245559`) + testy; P1 llm purposes/market → `verifySuperAdmin` (admin→403).
3. **i18n:** `useTranslation` w plikach superadmin (lub świadomy dług internal udokumentowany).
4. **Tokeny:** 45 hex → tokeny.
5. **§27:** główne tabele (organizations/users/audit/invoices/flags) A–S.
6. **E2E w PR-gate:** RBAC-reject (non-superadmin→403) na każdej sekcji + bocznych routerach zielone na `Londyn`.

## 5. Weryfikacja
- 🟦 konto superadmin: `POST /api/llm/tiers/assign` na zwykłym koncie → 403; `POST /api/virtual-workers` na org-adminie → 403; non-superadmin `/superadmin` → access-denied.
- P1: admin → 403 na llm purposes/market po fixie.
- feedback: pulse/feature → 200 (nie 500); SSO view renderuje bez crash; brak SQLSTATE/ścieżki sekretów w odpowiedzi.
- Fazy 3/4 z dowodami w `Harvard/modules/M27-superadmin/evidence/`.
- Uwaga DB: dev `.env` może wskazywać Railway PROD — control plane, OSTROŻNIE (read-only).

## 6. Zależności
- WYJŚCIE → wszystkie org (tenant ops/billing/module-access), cała platforma (feature flags + AI config/routing), M22 AI OS (providers/tiers/personas).
- WEJŚCIE ← M26 Portal (settlements/partner-config — koordynować).
- Niezależne od kręgosłupa (Faza 0).
- Ryzyko jednym zdaniem: pełna weryfikacja Fazy 3/4 (live P0/P1 proof na control-plane) WYMAGA konta superadmin — bez niego nie da się domknąć DoD #2/#6, a 🟦 deferred-status karty pozostaje; dodatkowo dev `.env` na PROD czyni testy zapisu na control-plane szczególnie ryzykownymi.
