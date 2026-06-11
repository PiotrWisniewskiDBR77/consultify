# M27 — SuperAdmin (control plane) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `bd93df622b`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M27 · inwentarz `Harvard/podzial/inventory/INV_G_*.md` (sekcja SUPERADMIN, poz.1-7) · `[[finding_feedback_system_audit]]`
**Evidence:** `Harvard/modules/M27-superadmin/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 50/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 23 | ~95% z 60+ zakładek REALNE (cienkie wrappery → realne widoki, nie placeholdery); feature flags/AI providers/Stripe/module-access realne; martwy płaski AIPlatformModule. |
| B. Wiring i dane | 15 | 13 | Feature flags persystują+wersjonują, AI config persyst., Stripe realny, bootstrap DBR77 realny. |
| C. Testy automatyczne | 15 | 8 | ~502 PASS/9 FAIL; superadmin middleware-gate 42/42, ale brak E2E non-superadmin→403, słabe asercje `[401,403,404]`, 2 realne P0 bugi wykryte; nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | Dedykowany shell spójny, stany OK, ale i18n 114/124 plików bez `t()` (hardkod), 45 hex, martwy płaski moduł. |
| F. Bezpieczeństwo/dostęp | 10 | 3 | Główny `/superadmin` WZORCOWY (DB-verified fail-closed), ale **2× P0 boczne routery** (llm tiers any-user global write, virtual-workers org-admin global persony). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **TAK — brak auth na zapisie globalnym `POST /api/llm/tiers/assign` (tylko `verifyToken`, zapis do globalnej `llm_tier_assignments`) → max 50 + P0.** Zweryfikowane osobiście. Suma surowa 53 > 50 → cap wiąże na 50. Dodatkowo Faza 4 → max 70 + „NIEPEŁNY". |

**Werdykt jednym akapitem:** Control plane jest **w ~95% realny** (nie fasada) i **główna bramka jest wzorcowa** — ale dwa boczne routery przebijają ją katastrofalnie. Pozytywy: `superadmin.routes.ts` ma router-level `verifyToken→requireSuperAdmin→requireAudit` + capability sub-gates, a `verifySuperAdmin` (`superAdmin.middleware.ts:403-426`) ZAWSZE odpytuje DB o rolę (DB = źródło prawdy, token-role ignorowany dla elewacji, fail-closed 403 przy błędzie); P0 „superadmin dziedziczy admin" zamknięty dwukierunkowo (`ProtectedRoute.tsx:72-73` + level 2<3 redirect); ~60+ zakładek to realne backendy (Tenant Ops 20 zakł., AI Operations 27 pod-zakł. jako cienkie wrappery do realnych widoków 1000-2000 l., System 14, Platform Security 15, Governance) z persystencją (feature flags + `feature_flag_history`, AI providers/tiers, Stripe `webhooks/stripe.routes.ts` 786 l., module-access granty + bootstrap DBR77); known feedback 500 NAPRAWIONE w kodzie (`feedback.routes.ts:158/177` CREATE TABLE IF NOT EXISTS + `:466` CAST is_active, commit `36ceb52c60` — wymaga live-weryfikacji deploy). **Ale dwa P0 w bocznych routerach (zweryfikowane osobiście) — powtórka wzorca M24/M20 „boczny router słabszy gate niż główny", tym razem na PLATFORMOWEJ konfiguracji:** (1) **`POST/DELETE /api/llm/tiers/assign` + `PUT /tiers/priority`** (`llm.routes.ts:793,799,805`) chronione **TYLKO `verifyToken`** (gdy sąsiedni `/providers/:id/tier:779` ma poprawnie `verifySuperAdmin`) → DOWOLNY zalogowany user dowolnego tenanta przepina globalny routing AI (zapis do globalnej `llm_tier_assignments`, `LLMController.ts:2042`) — platform-wide AI hijack; (2) **`virtual-workers.routes.ts`** `router.use(requireRole('super_admin','admin'))` — komentarz „admin role", ale przepuszcza zwykłego **org-admina**; create/update/delete worker bez `organizationId` na globalnej tabeli `virtual_workers` → org-admin edytuje/usuwa platformowe persony Teresa/Anna (voice/slug/surface) dla WSZYSTKICH tenantów. Plus 2× P1 (llm purposes/market global writes przez verifyAdmin/verifyToken) i 2 realne bugi wykryte testami: `SuperAdminFeedbackBacklogView` wycieka surowy `internal: SQLSTATE[HY000] /var/app/secrets` (P0 info-disclosure ścieżki sekretów), `SSOConfigurationView.tsx:484` crash na `providerType.replace()`. Hard cap (brak-auth-na-zapisie globalnym → 50) + niewykonane Fazy 3+4.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_G sekcja SUPERADMIN, poz.1-7 (~60+ zakładek — audyt grupowy per sekcja).
**Scenariusze krytyczne (7):**
1. **S1** — Tenant & User Ops (org/user management cross-tenant).
2. **S2** — AI Operations (providers/tiers/routing).
3. **S3** — Feature Flags (System).
4. **S4** — Platform Security (roles/permissions/SSO/SCIM).
5. **S5** — Governance/audit.
6. **S6** — Commercial/Revenue (billing cross-tenant + Stripe).
7. **S7** — SUPERADMIN gate (non-superadmin odrzucony na każdym control-plane endpoincie).
**Obowiązujące kanony:** §27 — TAK (organizations/users/audit/invoices/flags) · CARD_CONTENT_FORMULA: N/D · wzorzec: dedykowany SuperAdmin shell + sidebar · gating: **SUPERADMIN** (intencjonalnie cross-org).

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. **~95% z 60+ zakładek REALNE; brak placeholder-zakładek udających DZIAŁA.**

### 1a. REALNE (zweryfikowane, grupowo)
- **Tenant&User Ops** ~95% (Lifecycle/Playbooks/Contracts/Automation z `Api.*`+CRUD); **AI Operations** ~95% (27 pod-zakł. = cienkie wrappery do realnych widoków, np. LLMManagementView 1489 l.); **System** ~100% (9 paneli Enterprise* z API); **Governance** ~100% (ComplianceCenterView 2057 l.); **Platform Security** ~95%; **Configuration** realne; **Virtual Workers** realne ale UKRYTE (URL-only). Feature flags persyst.+wersja, AI providers/tiers persyst., Stripe realny, Module Access + bootstrap DBR77 realne.

### 1b. MOCK / STUB
- Brak placeholder-zakładek. `iam/IAMModuleView.tsx` (70 l., 0 API) — prawdopodobny orphan.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P0] `SuperAdminFeedbackBacklogView`** wycieka surowy `internal: SQLSTATE[HY000] .../secrets` (info-disclosure).
- **[P0] `SSOConfigurationView.tsx:484`** crash `providerType.replace()` (brak guarda + mock-drift `provider`/`providerType`).
- Known feedback 500 — NAPRAWIONE w kodzie (`feedback.routes.ts:158/177/466`, commit `36ceb52c60`); live-weryfikacja deploy PENDING.

### 1d. UKRYTE / MARTWY KOD
- **[P2] płaski `views/superadmin/AIPlatformModule.tsx`** (152 l., 0 importów) — żywy to folder `AIPlatformModule/` → wytnij.

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Status |
|---|---|---|---|
| Feature flags | feature-flags routes | feature_flags + _history | DZIAŁA (CRUD+audyt) |
| AI providers/tiers | llm routes + LLMController | llm_providers, llm_tier_assignments | DZIAŁA; **tiers/assign bez gate (P0)** |
| Virtual workers | virtual-workers routes | virtual_workers (global) | DZIAŁA; **gate przepuszcza admin (P0)** |
| Billing cross-tenant | billingAdmin/revenue + Stripe | billing/invoices | DZIAŁA (gated) |
| Module access | module-access/admin | grants | DZIAŁA (verifySuperAdmin) |

### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| feature flags platformy | per-flag | sterują całą platformą (zarządzane stąd) |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WYJŚCIE → | wszystkie org | tenant ops / billing / module-access (cross-tenant) | DZIAŁA (gated) |
| WYJŚCIE → | cała platforma | feature flags + AI config/routing | DZIAŁA; **llm tiers/virtual-workers dziurawe** |
| WYJŚCIE → | M22 AI OS / runtime | AI providers/tiers/personas | DZIAŁA (P0 boczne) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `bd93df622b`):** **~502 PASS / 9 FAIL / 0 SKIP.**
**Root-cause 9 FAIL:** 2 realne bugi (FeedbackBacklog secret-leak, SSO crash); 4 brak `<Router>` (Feedback/Analytics); 2 stale-import (`OverviewModule.root-closure`); 1 stale source-grep (p31-33). **Pułapka:** `*.test.js` ignorują `SQLITE_PATH` → uderzają w realny PG (`role "iris"`), maskowane permisywnym `VALID_STATUSES` (no-op asercje); „REAL integration" mockuje gate (`next()`).
**Superadmin-gate RBAC:** `superAdmin.middleware.test.ts` **42/42 PASS** (odrzucenia 401/403, tamper JWT, brak wiersza users mimo claim→403, fail-closed). **Luka:** brak E2E non-superadmin→403; route-testy `expect([401,403,404])` (404 zalicza jak 403 — maskuje brak gate).
**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | PR-gate |
|---|---|---|---|---|
| S1-S6 (sekcje) | render | smoke (gate+DB mock) | specs/orphan | ✗ defer |
| S4 Platform Sec | SSO FAIL | middleware 42/42 | orphan | ✗ |
| S7 RBAC gate | policy/roleGuards | **middleware 42/42** | **brak reject** | ✗ |
**CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → M27 niechroniony per-PR.
**Backlog testowy:** [P0] fix FeedbackBacklog secret-leak + SSO crash; [P0] E2E `rbac-gate.spec` (non-superadmin→denied) + integration `superadmin-gate-reject` z `=== 403` na reprezentatywnym roucie KAŻDEJ sekcji + **bocznych routerach llm/virtual-workers**; [P1] realna persyst. feature-flags/AI-config/revenue (zdjąć mock-gate+mock-DB), fix stale-import/Router; [P2] wymusić SQLite, zacieśnić `[401,403,404]`→`403`, test SCIM.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** **Test bezpieczeństwa na żywo (KRYTYCZNY):** curl `POST /api/llm/tiers/assign` na koncie zwykłego usera (P0 global write); `POST /api/virtual-workers` na koncie org-admina (P0 persony); non-superadmin na reprezentatywnym `/superadmin` endpoincie. Czy feedback 500 fix wdrożony na prod/staging. **Uwaga DB:** dev `.env` może wskazywać Railway PROD — NAJWYŻSZA ostrożność (control plane!).
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 7 scenariuszy; szczególnie: **P0 llm tiers + virtual-workers (read-only/ostrożny proof)**, S7 gate (non-superadmin → access-denied), feedback (czy 500 znikł), SSO view (czy crashuje), feature flag toggle trwałość.
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S7 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**Wzorzec:** dedykowany SuperAdmin shell + `SuperAdminSidebar` spójny.
**§27:** stany loading/empty/error w głównych tabelach obecne; pełny per-tabela A-S odroczony do Fazy 4 live.
**i18n:** **[P2]** 114/124 plików superadmin bez `useTranslation`/`t()` (hardkod EN).
**UI:** **[P3]** 45 literałów hex.
**Martwy kod:** płaski `AIPlatformModule.tsx` (KANON-01, P2).
**CARD_CONTENT_FORMULA:** N/D.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **TABELA superadmin-gate per router:**
| Router | Bramka | Werdykt |
|---|---|---|
| superadmin.routes | verifyToken→requireSuperAdmin→requireAudit + capability | **OK (wzorcowy)** |
| analytics-superadmin / billingAdmin / revenue | +verifySuperAdmin | OK |
| feature-flags | `router.use(requireSuperAdmin)` na mutacjach | OK |
| module-access / partner-* / scim / sso | verifySuperAdmin na mutacjach | OK |
| ai-settings (/superadmin) | inline `requirePlatformSuperAdmin` (rola z tokenu) | OK (słabszy) |
| **llm.routes (tiers/assign, priority)** | **tylko verifyToken** | **DZIURA P0** |
| **virtual-workers.routes** | `requireRole('super_admin','admin')` | **DZIURA P0** |

**Findingi:**
- **[P0] SEC-01 brak gate na llm tiers** — `POST/DELETE /api/llm/tiers/assign` (`llm.routes.ts:793,799`), `PUT /tiers/priority` (`:805`) tylko `verifyToken`; controller pisze do globalnej `llm_tier_assignments` bez org (`LLMController.ts:2042/2085/2112`). Dowolny zalogowany user przepina globalny routing AI. **Zweryfikowane osobiście.** Fix: `verifySuperAdmin`.
- **[P0] SEC-02 virtual-workers przepuszcza admina** — `virtual-workers.routes.ts` `requireRole('super_admin','admin')` → org-admin create/update/delete platformowych person Teresa/Anna (global `virtual_workers`, service `:587/632`). **Zweryfikowane osobiście.** Fix: `requireSuperAdmin`.
- **[P1] SEC-03** `POST /llm/purposes` + `/purposes/:purpose/assignments` (verifyAdmin) piszą globalne `ai_purposes`/`ai_purpose_assignments` (org_id NULL); `PUT /llm/org/:id/policy` (verifyAdmin) cudze `:id`.
- **[P1] SEC-04** `POST /llm/market/openrouter/sync` + `PUT /llm/market/inbox/:id` tylko verifyToken (global `ai_market_inbox`).
- **[P0-bug] FeedbackBacklog secret-path leak** + **SSO crash** (z testów).

**OK/WZORCOWE:** główny `/superadmin` DB-verified fail-closed; P0 superadmin≥admin dwukierunkowo zamknięty; api_key strippowany (`has_api_key`, `LLMController.ts:110/193` — brak wycieku sekretów providerów); bootstrap DBR77 + module-access verifySuperAdmin.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0)
1. **`verifySuperAdmin` na llm tiers/assign+priority+purposes+market** (`llm.routes.ts:793-805` i pokrewne) + org-scope/global-guard w `LLMController` — Weryfikacja: zwykły user na tiers/assign → 403; test.
2. **`requireSuperAdmin` na virtual-workers** (zamiast `('super_admin','admin')`) — Weryfikacja: org-admin → 403 na worker CRUD.
3. **Fix secret-leak FeedbackBacklog** (non-leaking copy) + **SSO crash guard** (`providerType` optional) — Weryfikacja: brak SQLSTATE/ścieżki w odpowiedzi; SSO renderuje.
4. **E2E + integration RBAC-reject** (non-superadmin → 403 na każdej sekcji + bocznych routerach) — Weryfikacja: twarde `=== 403`.

### Fala 2 — Domknięcie wartości (P1/P2)
1. **Gate na llm purposes/market** (verifySuperAdmin) — Weryfikacja: admin → 403.
2. **Realna persyst. testy** feature-flags/AI-config/revenue (zdjąć mock-gate+mock-DB) — Weryfikacja: roundtrip DB.
3. **Live-weryfikacja feedback 500 fix** na staging/prod — Weryfikacja: pulse/feature 200.

### Fala 3 — Jakość i kanony (P2/P3)
1. **Wytnij płaski `AIPlatformModule.tsx`** + orphan `IAMModuleView` — Weryfikacja: 0 referencji.
2. **i18n** — `useTranslation` w 114 plikach (lub świadomy dług internal) — Weryfikacja: spadek hardkodów.
3. **Tokeny kolorów** (45 hex) + **CI** `Londyn`/PR-gate — Weryfikacja: lint czysty, gate biegnie.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. RBAC-reject wszystkich routerów + bocznych) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: P0 boczne zamknięte (proof) + feedback 500 fix wdrożony + czyste logi
- [ ] 4. Kanony: martwy kod, i18n, tokeny
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (secret-leak, SSO crash)
- [ ] 6. Boczne routery (llm/virtual-workers) z gate SUPERADMIN

---
**Pozostałe do domknięcia audytu M27:** Faza 3 (Railway — żywy proof P0 + feedback fix) + Faza 4 (żywe 7 scenariuszy). **Dwa blockery P0 w bocznych routerach: `llm/tiers` (any-user global AI-routing write) + `virtual-workers` (org-admin global persony)** — główny `/superadmin` WZORCOWY, dziury w torach „dosadzonych" (wzorzec M20/M24, teraz na control plane). Po naprawie 2× P0 + 2 bugów + Fazach 3/4 realnie Beta. **Wniosek systemowy: side-router-weak-gate to powtarzalny wzorzec (M20/M16/M24/M27) — Krok 6 powinien przeskanować WSZYSTKIE mounty pod kątem routerów ze słabszym gate niż ich „główny" odpowiednik.**
