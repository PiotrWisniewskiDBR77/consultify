# M23 — Organizacja (workspace organizacji) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `78b888c492`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M23 · inwentarz `Harvard/podzial/inventory/INV_F_*.md` (sekcja ORGANIZACJA, poz.1-14) · poprzednia karta `docs/audit/2026-06-02/MODULE_16` (52/100)
**Evidence:** `Harvard/modules/M23-organizacja/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 52/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)
> **Re-audit 2026-06-11 po Sprintach 1–5:** A: 17→20 i B: 9→11 (W11 org-context-store backend — Goals/Challenges/Strategy mają realną persystencję per-org + zasilają Teresę, commit `d013ab7c4c`); C: 7→8 (W15 CI gate, commit `99bda16792`); F: 5→7 (W2 `/api/competency` auth + org-data export role-gate, commit `e3945bc7fc`). Suma: 20+11+8+0+6+7+0=52.

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 20 | Profil/KnowledgeGraph/Members/Domains/Branding/OrgContext realne; W11 Goals/Challenges/Strategy mają backend persystencję per-org + zasilają Teresę (commit `d013ab7c4c`); Billing/Limits CTA martwe P2 |
| B. Wiring i dane | 15 | 11 | Profil realny SSOT; Goals/Challenges/Strategy teraz per-org backend (W11, `d013ab7c4c`); podwójna implementacja admin (drift) pozostaje P2 |
| C. Testy automatyczne | 15 | 8 | 185 PASS/3 FAIL(stale)/45 SKIP; W15 CI gate (`99bda16792`); test izolacji multi-tenant nadal SKIPPED (za `RUN_DB_TESTS`); nic w PR-gate |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | Stany OK, org-switch wzorcowy; ale podwójna implementacja admin (drift), i18n `isPolish`+nieprzetłumaczone opcje ról. |
| F. Bezpieczeństwo/dostęp | 10 | 7 | Profil firmy CHRONIONY + org-switch bezpieczny; W2 naprawił `/api/competency` auth + org-data export role-gate (commit `e3945bc7fc`); route bez role-gate (deep-link member) pozostaje P2 |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **Faza 4 niewykonana → max 70 + „NIEPEŁNY".** BRAK cap cross-org — `competency` kolapsuje do org `''` (brak wycieku realnych danych), org-data export to within-org over-privilege (nie cross-org). Oba P1. Suma 44 < 70. |

**Werdykt jednym akapitem:** Workspace organizacji ma **mocny rdzeń wrażliwych danych, ale dziurawe tory poboczne i fasadowy „kontekst organizacyjny"**. Pozytywy zweryfikowane: **profil firmy** (`/organization/profile`, strategia/cele biznesowe — najwrażliwsze dane) jest realnym backendowym SSOT z org-scope `userOrgId!==orgId→403` na KAŻDYM endpoincie (`organization-profiles.routes.ts:189,378,622`) + role-gate na PUT; **org-switch jest bezpieczny** (`POST /auth/switch-organization:707` weryfikuje ACTIVE membership w `organization_members` przed wydaniem tokenu → user nie przełączy się na nie-swoją org); Knowledge Graph, Members (zaproszenia realne, nie mountStub), Competencies (FE), Domains, Branding, baner kontekstu Teresy z Socket.IO — realne. **Ale trzy klasy długów obniżają zaufanie:** (1) **„dane organizacyjne" to w połowie fasada** — Goals/Challenges/Strategy persystują **wyłącznie w localStorage** (`useContextBuilderStore.ts:414`, zustand persist, name `consultify-context-builder`), NIE mają żadnego `Api.put/post`, **nie zasilają backendowego kontekstu Teresy** (kontrast z Profilem) i **nie są per-org** (brak orgId w kluczu → przy przełączeniu org te same dane wizualnie „wyciekają"); Goals dodatkowo MOCK-STUB (AI-sugestie hardcoded, `onRefine` no-op); to znaczy, że konsultant wpisuje cele/wyzwania/strategię firmy, a one znikają przy zmianie przeglądarki i AI ich nie widzi; (2) **dwa P1 bezpieczeństwa w torach pobocznych** (zweryfikowane osobiście): **`/api/competency/*` BEZ ŻADNEJ AUTORYZACJI** — mount `Gateway.ts:644` bez `gatewayVerifyToken`, router bez `verifyToken` → niezalogowany wykonuje `POST/PUT/DELETE categories`, `seed-defaults` (write/DoS; org-scope kolapsuje do `''`, więc bez wycieku realnych danych); **`/api/organization-data/export*` BEZ role-gate** (`:210,:348` — `verifyToken` jest, role-gate NIE) → dowolny **member** robi `POST /export/all` i eksfiltruje users/projects/tasks/documents/**audit_log/activity_log** własnej org (insider over-privilege); plus `/organization/*` ma `requireAuth` bez `requiredRole` (`AppRoutes.tsx:2180`) — member wchodzi deep-linkiem do sekcji admin (redirect `ADMIN_REDIRECTS` odpala się tylko przy kliku, nie przy URL); (3) **podwójna implementacja admin** (drift) — klik ADMINISTRATION → redirect do M24 `/admin/*`, ale deep-link `/organization/members` renderuje INNY lokalny `OrganizationAdminPanel` (932 l., bez role-gate); Billing/Limits CTA tylko `trackFunnelEvent` (martwe). Sufit oceny: dwa P1 + fasada localStorage + niewykonane Fazy 3+4.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_F sekcja ORGANIZACJA, poz.1-14.
**Scenariusze krytyczne (7):**
1. **S1** — Profil firmy (GET/PUT + ekstrakcja AI).
2. **S2** — Goals/Challenges/Strategy (persystencja).
3. **S3** — Knowledge Graph.
4. **S4** — Members + zaproszenia.
5. **S5** — Competencies CRUD.
6. **S6** — Domains/Branding.
7. **S7** — Org switch (wymiana tokenu).
**Obowiązujące kanony:** §27 — TAK (członkowie, competencies, domains) · CARD_CONTENT_FORMULA: N/D · wzorzec: `OrganizationView`+`OrganizationSidebar` · gating: **route `requireAuth` BEZ roli** (sidebar admin+; gating po API).

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty: **REALNE 8 · localStorage-only 3 · MOCK-STUB 1 (Goals) · NIEPEŁNE 2 (Billing/Limits) · ZEPSUTE-sec 1 (Competencies backend).**

### 1a. REALNE (zweryfikowane)
- Profil firmy (backend SSOT `/organization-profiles/:orgId`, ekstrakcja AI `/ai/extract-org-context`), Knowledge Graph (`/api/knowledge-graph`), baner Teresy (`/organization-context` + Socket.IO), Members (invite `/api/invitations`), Domains, Branding (Regional read-only), OrgContext switch (wymiana tokenu realna).

### 1b. MOCK / STUB / localStorage-only
- **[P1] Goals = MOCK-STUB** — AI-sugestie hardcoded, `onRefine` no-op.
- **[P1] Goals/Challenges/Strategy localStorage-only** — `useContextBuilderStore.ts:414` (zustand persist localStorage, NIE per-org, NIE backend, NIE zasila Teresy). Strategy używa realnego AI, ale wynik też tylko localStorage.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P1] Competencies backend bez auth** (sekcja 6).
- **[P2] Billing/Limits CTA martwe** — „Upgrade"/„View Plans" tylko `trackFunnelEvent` (`OrganizationAdminPanel.tsx:292,474`); dane live, akcja nie.
- **[P2] Podwójna implementacja admin (drift)** — redirect `/admin/*` (klik) vs lokalny `OrganizationAdminPanel` (deep-link).

### 1d. UKRYTE / MARTWY KOD
- **[P3]** martwy FE `POST /organization-profiles/:orgId/analyze` (brak trasy BE → 404); approved-domains bez konsumenta (auto-join nie działa — feature-gap).

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela/Store | Status |
|---|---|---|---|
| Profil firmy | `/organization-profiles/:orgId` | organization_profiles | DZIAŁA (org-scoped+role) |
| Goals/Challenges/Strategy | — | **localStorage (zustand)** | **localStorage-only (nie backend/Teresa)** |
| Knowledge Graph | `/api/knowledge-graph` | kg tables | DZIAŁA |
| Members | `/api/invitations`, organizations controller | organization_members | DZIAŁA (membership-scoped) |
| Competencies | `/api/competency` | competency tables | **bez auth (P1)** |
| Org switch | `/auth/switch-organization` | — | DZIAŁA (membership-verified) |
| Org-data export | `/api/organization-data/export*` | wiele tabel | **bez role-gate (P1)** |

### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| route `requireAuth` (bez roli) | — | member wchodzi deep-linkiem do sekcji admin (gating po API, miejscami słaby) |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WYJŚCIE → | kontekst Teresy | profil → backendowy kontekst | DZIAŁA (Profil); **Goals/Challenges/Strategy NIE** |
| WYJŚCIE → | M24 Admin | redirect sekcji ADMINISTRATION (klik) | DZIAŁA (ale deep-link omija → lokalny panel) |
| WYJŚCIE → | cała app | org switch (wymiana tokenu) | DZIAŁA (membership-verified) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `78b888c492`):** **185 PASS / 3 FAIL / 45 SKIP.**
**Root-cause:** 3 FAIL = stale `organizationData.no-stubs.test.ts` (oczekuje `503 FEATURE_UNAVAILABLE` z czasów stuba; route zaimplementowany → 200/400). **45 SKIP = cały `orgContext.middleware.test.ts` za `describeIfDb`/`RUN_DB_TESTS=1`** — **najważniejszy test izolacji multi-tenant nie wykonuje się bez PG (realna luka).**
**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | PR-gate | Luka |
|---|---|---|---|---|---|
| S1 profil+AI | ✓ | ✓✓ p30 (36) | smoke | ✗ | brak FE PUT |
| S2 Goals/Strategy | częśc. | częśc. | false-green | ✗ | **persystencja Zustand nietestowana** |
| S3 KG | ✓ | smoke | ✗ | ✗ | relacje/błędy |
| S4 Members | redirect | membership | ✗ | ✗ | flow zaproszenia |
| S5 Competencies | ✗ | taksonomia | ✗ | ✗ | brak FE+CRUD route test |
| S6 Domains/Branding | ✓ | auth | smoke | ✗ | happy-path |
| S7 Org switch | ✓✓ (15) | status | ✗ | ✗ | **realna wymiana JWT nietestowana** |
**CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0.
**Backlog testowy:** [P1] fix stale `organizationData.no-stubs`; [P1] unit persystencji `consultify-context-builder` (S2); [P1] odpalać `orgContext.middleware.test.ts` z PG (45 SKIP → multi-tenant isolation); [P1] **test braku auth competency + braku role-gate org-data export**.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** **Test bezpieczeństwa na żywo (KRYTYCZNY):** curl `/api/competency/categories` BEZ tokenu (P1 no-auth); `POST /api/organization-data/export/all` jako member (P1 export); deep-link `/organization/members` jako member. Smoke: profil GET/PUT, KG, org-switch. **Uwaga DB:** dev `.env` może wskazywać Railway PROD.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 7 scenariuszy; szczególnie: S2 Goals/Strategy (czy znikają po zmianie przeglądarki/org — fasada), **P1 competency no-auth + org-data export (curl proof)**, deep-link member do sekcji admin, Billing CTA (czy nic nie robi).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S7 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**Drift admina:** podwójna implementacja (lokalny panel przy URL vs redirect `/admin/*` przy kliku) — źródło dziury role-gate; rekomendacja: redirect także przy montowaniu z URL lub `requiredRole` na pod-ścieżkach.
**§27:** stany loading/empty/error obecne; pełna checklista A-S per tabela nie audytowana w SEC (do Fazy 5 dedykowanej).
**i18n:** `CompetencyCatalog.tsx:51` `isPl` (smell vs M15); nieprzetłumaczone `<option>` ról MEMBER/Admin (`OrganizationAdminPanel.tsx:179`). Hardkod `#6366f1` jako default brand (wartość-dana, OK).
**CARD_CONTENT_FORMULA:** N/D.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **Enumerowane routery:** organizations(+controller), ownership, approved-domains, organization-context, organization-profiles, organization-data, organization-limits, branding, competency, knowledge-graph.
| Warstwa | Stan | Dowód |
|---|---|---|
| Route `/organization/*` | bez role-gate | `AppRoutes.tsx:2180` `requireAuth` bez `requiredRole` |
| `/api/competency` | **BEZ AUTH** | `Gateway.ts:644` bez gatewayVerifyToken; router bez verifyToken |
| `/api/organization-data/export` | **bez role-gate** | `:210,:348` verifyToken, brak requireRole |
| organization-profiles (strategia) | CZYSTY | `userOrgId!==orgId→403` (`:189,378,622`)+admin PUT |
| org-switch | BEZPIECZNY | `auth.routes.ts:707-750` membership-verified |

**Findingi:**
- **[P1] `/api/competency/*` bez uwierzytelnienia** — mount `Gateway.ts:644` bez `gatewayVerifyToken`, router bez `verifyToken` → niezalogowany `POST/PUT/DELETE categories`, `seed-defaults` (`competency.routes.ts:22-160`). **Zweryfikowane osobiście.** Write/DoS; org-scope kolapsuje do `''` (bez wycieku realnych danych cross-org). Fix: dodać `gatewayVerifyToken` + role-gate.
- **[P1] `/api/organization-data/export*` bez role-gate** — `verifyToken` jest, ale `POST /export/:category` (`:210`) i `/export/all` (`:348`) bez `requireRole` → member eksfiltruje users/projects/tasks/documents/**audit_log/activity_log** własnej org. **Zweryfikowane osobiście.** Fix: `requireRole('admin','owner')`.
- **[P2] route bez role-gate + podwójna implementacja** — deep-link member → lokalny `OrganizationAdminPanel` bez redirectu/role-gate; obrona spada na API (słaba dla ↑).
- **[P2] knowledge-graph orgId fallback** z `x-organization-id`/`query` (`:20-32`) — niewykorzystywalne (token-org priorytet), ale usunąć fallbacki.
- **[P3]** SVG upload branding (stored-XSS); martwy `analyze` 404; approved-domains bez konsumenta.

**OK/czyste:** organization-profiles (strategia/cele) org+role scoped; org-switch membership-verified; organizations controller membership-IDOR-guard; branding requester==target+admin; logi czyste.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P1)
1. **Auth + role-gate na `/api/competency`** — `gatewayVerifyToken` w mount + `requireRole` na write — Weryfikacja: niezalogowany/member → 401/403; test.
2. **Role-gate na org-data export** — `requireRole('admin','owner')` na `/export/*` — Weryfikacja: member → 403; test.
3. **Role-gate na route `/organization/*` sekcji admin** lub redirect także przy montowaniu z URL (koniec podwójnej implementacji) — Weryfikacja: member deep-link → redirect/403.

### Fala 2 — Domknięcie wartości (P1/P2)
1. **`[INTEGRACJA — INTEGRACJE.md §C poz.8 / Sprint 7+ / W11]`** Backendowa persystencja Goals/Challenges/Strategy (per-org) + zasilanie kontekstu Teresy (jak Profil organizacji). `useContextBuilderStore.ts:414` = zustand persist (localStorage), nie per-org, nie zasila Teresy — dane giną przy zmianie przeglądarki/org. Wzorzec: Profil firmy → backendowy kontekst — replikować — Weryfikacja: dane przeżywają zmianę przeglądarki/org, AI je widzi.
2. **Goals AI realne** (nie hardcoded `onRefine` no-op) — Weryfikacja: sugestie z LLM.
3. **Billing/Limits CTA** — realny checkout/upgrade lub jawne „zarządzane przez…" — Weryfikacja: CTA coś robi.
4. **Włączyć `orgContext.middleware.test.ts` w CI z PG** — Weryfikacja: multi-tenant isolation testowana.

### Fala 3 — Jakość i kanony (P2/P3)
1. **§27** dla tabel (członkowie/competencies/domains) — Weryfikacja: A-S.
2. **i18n** — `t()` zamiast `isPl`, przetłumaczyć opcje ról — Weryfikacja: PL/EN.
3. **Sanityzacja SVG branding** + wytnij martwy `analyze` + usuń KG orgId-fallback — Weryfikacja: brak XSS/404/fallback.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. competency-auth, export-role, multi-tenant isolation) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: smoke 200 + P1 potwierdzone zamknięte + czyste logi
- [ ] 4. Kanony: §27, i18n, drift admina rozwiązany
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (Billing CTA, localStorage-fasada)
- [ ] 6. Goals/Challenges/Strategy persystowane backendowo i zasilają Teresę

---
**Pozostałe do domknięcia audytu M23:** Faza 3 (Railway — żywy proof P1) + Faza 4 (żywe 7 scenariuszy). **Dwa blockery P1: `/api/competency` bez auth + org-data export bez role-gate** (oba within-org/no-data-leak → nie hard cap, ale realne). Profil firmy (najwrażliwszy) + org-switch wzorcowe. Główny dług wartości: **„kontekst organizacyjny" (cele/wyzwania/strategia) to fasada localStorage** — nie zasila AI, nie przeżywa. Po naprawie P1 + backendzie kontekstu + Fazach 3/4 realnie Beta.
