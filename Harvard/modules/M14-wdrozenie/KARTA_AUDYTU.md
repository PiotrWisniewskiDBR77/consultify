# M14 — Wdrożenie (Execution) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `592fbb8211`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M14 · inwentarz `Harvard/podzial/inventory/INV_D_*.md` (sekcja WDROŻENIE, poz.1-13) · poprzednia karta `docs/audit/2026-06-02/MODULE_06_realizacja.md` (51/100) · reuse dokumentu inicjatywy z M13
**Evidence:** `Harvard/modules/M14-wdrozenie/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 51/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)
> **Re-audit 2026-06-11 po Sprintach 1–5:** F: 2→7 (W1 recalcInitiativeActualTotal org-scope, commit `b9f2dee9d2`; task_dependencies org-scope, commit `9974596da7`; hard cap zdjęty); E: 5→6 (W13 M14 Wave8 i18n, commit `84757dc672`). **Fala 2 (pominięte w re-audycie 2026-06-11):** A: 20→21 (budgetHealth real calculation, commit `84757dc672`); B: 9→10 (execution.routes.ts deleted, commit `2fe1c81be3`). **Fala 2d:** B: 10→11 (Manager lanes V8 degradation banner, commit `229cb35565`).

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 21 | 11/13 REALNE z żywymi tabelami+migracjami; Manager (poz.9) wymaga V8 — amber baner gdy niedostępne; budgetHealth real calculation (Sprint 5, `84757dc672`). |
| B. Wiring i dane | 15 | 11 | Rollout trwały (naprawione vs 06-02), CRUD/aggregate org-scoped; Manager V8 degradation baner (`229cb35565`); osierocony `execution.routes.ts` USUNIĘTY; cicha degradacja execution-health/action-queue pozostaje. |
| C. Testy automatyczne | 15 | 6 | 633 PASS/23 FAIL lokalnie; S2 (DnD) i S6 (raporty) zero działającego pokrycia, `rollout.routes` bez testów BE; nic nie biegnie w PR-gate na `feat/*`. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | Hub zgodny + Portfel głównie OK, ale 5 tabel Rollout poza §27 (surowy `<table>`); W13 i18n Wave8 naprawione (commit `84757dc672`). |
| F. Bezpieczeństwo/dostęp | 10 | 7 | recalcInitiativeActualTotal org-scope (`b9f2dee9d2`); task_dependencies 2-step verify (`9974596da7`); W7 beta-lock 3-warstwowy; pozostałe: pilot tylko klient (P2). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **NIE — cross-org P0 naprawiony (W1+W2), hard cap zdjęty.** Suma surowa 51 < 70 (Faza 4 niewykonana). |

**Werdykt jednym akapitem:** Rdzeń Wdrożenia jest najsolidniejszy z dotąd zaudytowanych modułów core — executive dashboard (Health Score liczony z realnych danych, nie fabrykowany), trzy widoki portfela z kanban DnD i inline-statusem, Action Queue/RAID/Decisions na org-scoped SQL, zakładka Rollout (Plan/KPI/Risks/Change/Closure) z **trwałymi danymi na `/api/rollout/*`** (potwierdzona naprawa vs 06-02, migracja `20260608_rollout_tables.sql`), raporty z generacją z live-data bez zmyślonych liczb, reuse dokumentu inicjatywy z M13, handoff czatu Teresy. Zaufanie i wartość łamią cztery rzeczy: **cross-org write budżetu** — legacy `/api/execution-control/budget/entries` (zawsze zamontowany, bez bramki V8) wywołuje `recalcInitiativeActualTotal` z `UPDATE initiatives SET actual_budget_total WHERE id=?` **bez `organization_id`**, więc admin org A nadpisuje cachowany budżet inicjatywy org B (piąty moduł z wzorcem cross-org, tym razem write-tamper na cudzej encji); **Manager (people_change) cicho martwy bez `ENABLE_V8_GLOBAL`** — `getManagerProblems` bije w `/api/v8/...`, dostaje 404, `catch` zwraca zera, legacy nie ma `/manager/lanes/*`, użytkownik widzi puste lanes zamiast banera (jak cicha degradacja V8 w M13); **osierocony `routes/execution.routes.ts`** (niezamontowany — Gateway montuje `routes/pmo/execution.routes.ts`), przez co `/api/execution/stats|escalations|calendar` zwracają 404 (3 czerwone E2E); **`budgetHealth=100` hardcode** (`ExecutionHub.tsx:2216`) maluje fałszywie-zielony kafelek. Dług kanonowy skupiony w 5 tabelach Rollout (poza §27) i ~141 brakujących kluczach PL.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_D sekcja WDROŻENIE, poz.1-13. **Nowe od 2026-06-08:** brak zmian funkcjonalnych w katalogach modułu (tylko eslint/prettier autofix + QA remediation `028a83896d`, `c2bf2394e7`, `429f0385ba`).
**Scenariusze krytyczne (7):**
1. **S1** — Executive dashboard: Health Score + snapshot (lokalny fallback).
2. **S2** — Widoki tabela/kanban/timeline + kanban DnD status → reload → trwałość.
3. **S3** — Action Queue: przeterminowane decyzje/ryzyka P×I/taski → akcja → trwałość.
4. **S4** — RAID log + Decisions: create/edit → liczniki pending/overdue.
5. **S5** — Rollout: Plan/KPI/Risks/Change/Closure → edycja → reload → trwałość (`/api/rollout/*`).
6. **S6** — Raporty: generacja realnej treści z live-data (RAG + wizard).
7. **S7** — Manager (people_change): action-queue/decisions/blockers/workload/risk + AI recommendation panel.
**Obowiązujące kanony:** §27 dla tabel **Portfel egzekucji**, **Raporty**, **5 tabel Rollout** (KPI/Risk/Change/Closure/Plan), **Manager lanes** · **CARD_CONTENT_FORMULA: n.d.** (dokument inicjatywy = reuse z M13) · wzorzec hubowy: `ExecutionHub` (ModuleHub) · beta-gating: NIE (core, otwarte).

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Zbiorczo: **REALNE 11 (+1 z hardcode) · ZEPSUTE-warunkowo 1 (Manager bez V8) · MARTWE 3+ (legacy views + osierocony router).**

### 1a. REALNE (zweryfikowane)
- Portfel/dashboard (Health Score z realnych danych, fallback liczy z DB — `ExecutionHub.tsx`), tabela/kanban/timeline (`ExecutionInitiativesKanbanView.tsx:268`, PATCH `/initiatives/:id/status`), Timeline z sygnałami opóźnień/ryzyk (`:1066-1091`), Action Queue (`ExecutionController.ts:744-900`, org-scoped), RAID+Decisions (`:1248-1264`), panel+dokument inicjatywy (reuse M13, `:4749-4758`), **Rollout 5 zakładek trwałe** (`rollout.routes.ts` + `20260608_rollout_tables.sql`), Raporty (`reportContentGenerator.ts` — brak fabrykowanych liczb), czat Teresy handoff (`:1665-1730`), V8 z fallbackiem (legacy router na te same tabele — NIE fabrykacja), blokada pilota (UI, `:573/1787/2659`).

### 1b. MOCK / STUB / fabrykowane klientem
- ~~**[P2] `budgetHealth=100` hardcode**~~ — **NAPRAWIONE** (Sprint 5, commit `84757dc672`) — `ExecutionHub.tsx:2221` teraz liczy `Math.max(0, Math.round(100 - (totalActual / totalBudget) * 100))`; ukrywa kafelek gdy brak danych.
- Poza tym: brak mocków danych; fallbacki czytają realne tabele.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P1] Manager (people_change) cicho martwy bez V8** — `getManagerProblems`→`v8Get /api/v8/...`→404 gdy `ENABLE_V8_GLOBAL≠true`→`catch` zwraca zera (`ExecutionHub.tsx:1142`). Legacy `/api/execution-control` NIE ma `/manager/lanes/*`. AI panel → error. Cała poz.9 zależy od ENV-flagi; user widzi puste lanes zamiast banera „V8 off".
- **[P2] ciche degradacje `catch→[]`** bez komunikatu: execution-health (`:1301`), action-queue (`:1317`) — sygnały lecą do `[]`, user nie wie, że control-tower/risk/budget niedostępne.

### 1d. UKRYTE / MARTWY KOD
- ~~**[MARTWY] `routes/execution.routes.ts`**~~ — **USUNIĘTY** (commit `2fe1c81be3`) — plik skasowany; Gateway montuje `routes/pmo/execution.routes.ts` @ `Gateway.ts:821`.
- **[MARTWY] `ImplementationView.tsx`** (importowany, nigdy renderowany), **`views/ExecutionView.tsx`** (hardcode `projectId="default"`), **`ExecutionDetailPanel.tsx`** → wytnij (potwierdzone z inwentarza poz.13).
- **[KANDYDACI]** `PeopleChangeWorkspace`/`RiskSignalsPanel`/`DelayDetectionPanel`/`ReportCompactPanel` — do weryfikacji konsumentów.

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Portfel/CRUD/status | `pmo/execution.routes.ts` + `ExecutionController` | initiatives, tasks | tak | DZIAŁA (org-scoped) |
| Action Queue | `ExecutionController.ts:744-900` | decisions, risks, tasks | tak | DZIAŁA (org-scoped) |
| RAID + Decisions | `/api/raid`, `/api/execution*` | raid_*, decisions | tak | DZIAŁA |
| Rollout (5 zakładek) | `rollout.routes.ts` (`/api/rollout/*`) | rollout_* | `20260608_rollout_tables.sql` | DZIAŁA (trwałe) |
| Raporty | `reportContentGenerator.ts` | live-data agregaty | n.d. | DZIAŁA (bez fabrykacji) |
| Budget entries | legacy `/api/execution-control/budget/entries` + `executionBudgetService` | budget_entries, **initiatives** | tak | **recalc bez org-scope (P0 write)** |
| Manager lanes | `v8Get /api/v8/...` (brak legacy) | — | — | ZEPSUTE bez `ENABLE_V8_GLOBAL` (cicho 0) |
| Sygnały/timeline/budget | v8→legacy fallback (te same tabele) | risk_signal_alerts, delay_signals | tak | DZIAŁA z **cichą** degradacją |
| Dependency interventions | `v8/execution-control.routes.ts:1117` | task_dependencies, initiative_dependencies | tak | **NAPRAWIONE** — task_dep: 2-step org verify (`9974596da7`); initiative_dep: zawsze org-scoped |

### 1f. Flagi
| Flaga | Default BE | Default FE | Kto włącza | Wpływ |
|---|---|---|---|---|
| `ENABLE_V8_GLOBAL` | **OFF** (`!== 'true'` → 404, `v8FeatureGate.middleware.ts:15`) | — | env (Railway) | brak V8 → Manager lanes martwe, sygnały na legacy-fallback; `deprecationHeader` sugeruje legacy „przestarzałe", a w runtime to **jedyna żywa ścieżka** dla większości sygnałów (odwrotność intencji) |
| `v8OrgGate` implicit-fallback | `NODE_ENV !== production` (`v8FeatureGate.middleware.ts:7,42`) | — | env | poza prodem org bez flag przepuszczana — uwaga w teście cross-org |
| pilot VTS | — | UI hub (`readOnly`) | rola | blokuje Rollout CRUD **tylko w UI**; serwer `requireOrgRole('user')` przepuszcza |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WEJŚCIE ← | M13 Inicjatywy | reuse dokumentu+panelu inicjatywy | `ExecutionHub.tsx:135-139,4749-4758` | DZIAŁA |
| WEJŚCIE ← | M03 My Work | decyzje/taski w Action Queue/RAID | `ExecutionController.ts:744-900` | DZIAŁA |
| przekrój | M01 Czat | handoff czatu Teresy (kontekst egzekucji) | `ExecutionHub.tsx:1665-1730` | DZIAŁA |
| WYJŚCIE → | M15/M16 | ROI tylko pośrednio przez `/executive/aggregate.roi` | — | DEGRADUJE (puste w fallbacku; brak deep-linku do Finance) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log` (7205 l.).
**Uruchomienie (lokalnie @ `592fbb8211`):** **633 PASS / 23 FAIL / 0 SKIP.**
| Grupa | PASS | FAIL | Czas |
|---|---|---|---|
| FE komponenty/unit (17 plików) | 113 | 5 | 6.6 s |
| BE server/ vitest (16 plików) | 286 | 1 | 2.3 s |
| BE unit root (10 plików) | 152 | 0 | 3.0 s |
| Integracyjne root (8 plików) | 55 | 7 | 17.3 s |
| E2E smoke deploy-gate | 21 | 0 | 7 s |
| E2E execution-center+decision-mgmt | 6 | 10 | 6.1 min |

**Root-cause 23 FAIL (5 klas):**
- **mock-drift react-i18next** (3) — PeopleChangeWorkspace, `t(key,{defaultValue})` vs mock pozycyjny (wzorzec M13).
- **UI-drift / martwe selektory** (8) — RolloutTab.smoke ×2 (CTA „Add KPI" przeniesione do `menuCta`), execution-center E2E ×6 (`status-filter-EXECUTING` nie istnieje; handoff `/benefits` blokowany beta-gatingiem M15).
- **REALNY FINDING — osierocony router** (3) — `/api/execution/stats|escalations|calendar` → 404 (martwy `routes/execution.routes.ts`, ↑1d).
- **env-drift** (5) — decision-management PG `role "iris" does not exist`; E2E hardcoded `localhost:3005`.
- **schema/mock-drift** (4) — `executionSpine.ts:231` org-id `.uuid()`→`.min(1)`, `getActiveRuns` 2. param, decisions.remind kontroler-drift.

**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | CI (PR-gate) | Luka |
|---|---|---|---|---|---|
| S1 Health+snapshot | smoke (24) | mocki | FAIL | ✗ | E2E martwy, BE bez danych |
| S2 widoki+DnD | ✗ | ✗ | FAIL | ✗ | **zero działającego pokrycia** |
| S3 Action Queue | ✗ | serwis (9) | ✗ | ✗ | endpoint nietestowany |
| S4 RAID+Decisions | render | ✓ (~120) | ✗ | ✗ | brak liczników+E2E |
| S5 Rollout | 2 FAIL | **✗** | smoke | ✗ | `rollout.routes` bez testów BE |
| S6 Raporty | ✗ | ✗ | ✗ | ✗ | **zero pokrycia** |
| S7 Manager+AI | 3 FAIL | ✓ (9) | ✗ | ✗ | FE czerwone |

**Pułapka CI:** `test-suite.yml` triggeruje tylko `main`/`develop` → **PR `feat/*` → `Londyn` (default) nie uruchamia żadnego testu M14**; nawet na PR do main/develop joby unit/component/Tier-0 „Deferred" (skip, gate zielony). Deploy-gate smoke biega nightly (21/21 PASS); execution-center+decision-mgmt weekly — czerwone co tydzień.

**Backlog testowy (14 poz.):**
1. [P0] test BE `rollout.routes` (S5 trwałość) — `server/src/routes/__tests__/rollout.routes.test.ts`.
2. [P0] rewrite execution-center E2E + decyzja: remount/wycięcie osieroconego `execution.routes.ts`.
3. [P0] fix env-drift decision-management (seed/role) + hardcoded `localhost:3005`.
4. [P1] testy `executionReports` (S6) + kanban-DnD (S2) + action-queue/health endpoint.
5. [P1] helper mocka i18n (defaultValue) — usuwa 3 FAIL PeopleChangeWorkspace.
6. [P2] dodać `Londyn` do triggers `test-suite.yml` (systemowe — wspólne z M13).

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: portfel/aggregate, Action Queue, RAID, Rollout CRUD (`/api/rollout/*`), raporty, budget entries, Manager lanes. **Kluczowe do sprawdzenia:** wartość `ENABLE_V8_GLOBAL` na staging/prod (decyduje czy Manager lanes działają i czy cross-org write `task_dependencies` jest osiągalny); migracja `20260608_rollout_tables.sql` zastosowana?; czy `budget_entries`/`initiatives.actual_budget_total` na prodzie. **Uwaga DB:** dev `.env` może wskazywać Railway PROD — ostrożność z zapisami podczas smoke.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 7 scenariuszy z reloadem; szczególnie: kanban DnD trwałość (S2), Rollout edycja→reload (S5), Manager lanes z/bez V8 (czy user widzi pustkę bez komunikatu — S7), `budgetHealth=100` na żywym dashboardzie (S1), rola pilot vs admin (Rollout readOnly).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S7 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 per powierzchnia:**
| Tabela/powierzchnia | Stan | Odstępstwa |
|---|---|---|
| Portfel egzekucji | `TableWithPreviewLayout`+`FilterableTable`, komplet A0 (preview/filter/sort/resize/sticky/kebab/stany) | **[P1] §27.D** bulk-bar = tylko „N selected · Clear" (`ExecutionHub.tsx:4855-4870`) — zero akcji |
| Raporty | maszyneria OK | **[P2]** presety Menu 3 z hardkodowanymi licznikami/labelami poza i18n (`:3338-3343`), brak bulk-bar |
| Rollout — 5 tabel (KPI/Risk/Change/Closure/Plan) | **całkowicie poza kanonem** | **[P1]** surowy `<table>` (`RegisterTable`, `RolloutTab:1130`) — zero preview/filtrów/sortu/resize/kebaba/bulk; największy dług |
| Manager — Problem lanes | CSS grid zamiast `FilterableTable` | **[P2] §27.F** brak filtrów/sortu, osobna kolumna „Overdue" |

**Wzorzec hubowy:** `ExecutionHub` ✅ zgodny z ModuleHub (Menu 1/2/3, taby, breadcrumbs).
**i18n PL/EN:** klucze symetryczne 399=399, ale **~141 kluczy `t()` brak w PL `translation.json`** (działa przez inline-fallback) + hardcoded stringi w presetach raportów. **[P2]**
**Stany:** portfel/rollout mają loading/error/empty, ale **cicha degradacja V8→legacy BEZ banera** (jak M13 — Finance/Results mają baner) — sygnały lecą do `[]` w catch, user nie wie o niedostępności control-tower/risk/budget. **[P1]**
**CARD_CONTENT_FORMULA:** ✅ N/D — dokument inicjatywy = reuse z M13 (formuła rozliczana tam).

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **Główne routery (PMO ExecutionController, executiveAggregate, v8 spine, rollout) org-scoped; dziury w budżecie i interwencjach dependency.**
| Warstwa | Nawigacja | Route | API | Dziura? |
|---|---|---|---|---|
| Execution core | sidebar otwarty | zalogowany | verifyToken + org-scope + role | — |
| Budget entries (legacy) | — | always-mounted | `requireOrgRole('admin')` + recalc `AND organization_id` (`b9f2dee9d2`) | **NAPRAWIONE (W1)** |
| Dependency interventions (v8) | — | za `ENABLE_V8_GLOBAL` | task_dep org-scope naprawiony (`9974596da7`) | **NAPRAWIONE** |
| Pilot VTS Rollout | UI `readOnly` | — | `requireOrgRole('user')` | **TAK (P2)** |

**Findingi:**
- ~~**[P0] cross-org write budżetu**~~ — **NAPRAWIONE** (Sprint 2, commit `b9f2dee9d2`) — `recalcInitiativeActualTotal` (`executionBudgetService.ts:413`) teraz wykonuje `UPDATE initiatives SET actual_budget_total = ? WHERE id = ? AND organization_id = ?` — cross-org tamper niemożliwy.
- ~~**[P1] cross-org write `task_dependencies`**~~ — **NAPRAWIONE** (Sprint 5, commit `9974596da7`) — dodano 2-step verify: `SELECT organization_id FROM tasks WHERE id=?` dla `fromEntityId` i `toEntityId`; 403 `EXECUTION_TASK_ORG_MISMATCH` gdy mismatch (`v8/execution-control.routes.ts:1138-1151`).
- **[P2] pilot VTS Rollout tylko klient** — `readOnly` w UI; serwer `requireOrgRole('user')` przepuszcza CRUD przez API (wzorzec M13).
- **[P3] `ON CONFLICT (id) DO UPDATE` bez org-guard** — `risk_signal_alerts` (`v8/execution-control.routes.ts:128-132`), `delay_signals` (`:410-418`) → cross-org tamper flagi dismiss.

**Org NIE spoofowalny z nagłówka** — `x-organization-id` honorowany tylko po potwierdzeniu ACTIVE membership (`auth.middleware.ts:619-640`). Share-tokeny/WS: N/D. Sekrety/PII w logach: czysto (manager-lane PII za capability po BUG-18).

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0)
1. ~~**Org-scope na `recalcInitiativeActualTotal`**~~ — **DONE** (`b9f2dee9d2`) — `AND organization_id = ?` dodany do `UPDATE initiatives` w `executionBudgetService.ts:413`.
2. ~~**Org-scope na `task_dependencies` interwencjach**~~ — **DONE** (`9974596da7`) — 2-step verify na `fromTaskId`/`toTaskId`.
3. ~~**Rozstrzygnij osierocony `routes/execution.routes.ts`**~~ — **DONE** (`2fe1c81be3`) — plik usunięty.
4. **Napraw env-drift testów decision-management** (seed/role „iris") + hardcoded `localhost:3005` — Weryfikacja: integracyjne+E2E zielone lokalnie.

### Fala 2 — Domknięcie wartości (P1)
1. ~~**Manager (people_change) bez V8**~~ — **DONE** (`229cb35565`) — amber Callout „Manager cockpit requires V8" gdy 404/501.
2. **Komunikat przy degradacji V8→legacy** (execution-health/action-queue/sygnały `catch→[]`) — baner jak Finance/Results — Weryfikacja: odcięcie V8 pokazuje baner, nie puste tabele.
3. ~~**Usuń `budgetHealth=100` hardcode**~~ — **DONE** (`84757dc672`) — real calculation.
4. **Gating pilota serwerowo** — Rollout CRUD odrzuca rolę pilota (`requireOrgRole` + capability) — Weryfikacja: pilot API → 403.
5. **Pokrycie testowe S2/S5/S6** — test BE `rollout.routes`, kanban-DnD, raporty z live-data; wprowadzić do PR-gate — Weryfikacja: zielone w CI.

6. **`[INTEGRACJA — INTEGRACJE.md §C poz.5 / Sprint 4–5 / W6]`** Eksport sygnałów ROI do `v8_roi_realization_entries` + deep-link Execution→Results. `ExecutionHub.tsx:945` — fallback puste; M15 czyta własne tabele niezależnie; brak feed-forward z Wdrożenia do Rezultatów. Realny export sygnałów (budget_health, roi_delta) przy każdej zmianie snapshotu `ExecutionHub` + link `?initiativeId=` do M15 — **To jest dziura w kręgosłupie produktu** — Weryfikacja: zmiana budżetu w M14 pojawia się jako sygnał w M15 Rezultaty.

### Fala 3 — Jakość i kanony (P2)
1. **§27 Rollout 5 tabel** — `FilterableTable`+preview+filtry+sort+resize+kebab+bulk zamiast surowego `<table>` (`RolloutTab:1130`) — Weryfikacja: §27 A-S czyste per tabela.
2. **§27.D bulk-bar Portfel** — akcje po zaznaczeniu (nie tylko „Clear") (`ExecutionHub.tsx:4855-4870`) — Weryfikacja: bulk action wykonuje operację.
3. **i18n** — dopisać ~141 brakujących kluczy PL + presety raportów do `t()` — Weryfikacja: 0 inline-fallbacków, 0 hardcoded.
4. **Wytnij martwy kod** — `ImplementationView`/`views/ExecutionView`/`ExecutionDetailPanel` (+ zweryfikuj `PeopleChangeWorkspace`/`RiskSignalsPanel`/`DelayDetectionPanel`/`ReportCompactPanel`) — Weryfikacja: 0 referencji.
5. **[P3] org-guard na `ON CONFLICT` dismiss** (`risk_signal_alerts`/`delay_signals`) — Weryfikacja: cross-org dismiss → odrzucony.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: checklisty Fazy 5 bez odstępstw P0/P1
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (Manager lanes, osierocony router, budgetHealth)
- [ ] 6. Zero cichych degradacji bez komunikatu (V8 fallback)

---
**Pozostałe do domknięcia audytu M14:** Faza 3 (Railway — zwłaszcza wartość `ENABLE_V8_GLOBAL` na środowiskach) + Faza 4 (żywe 7 scenariuszy). Ocena ≤50 dopóki P0 cross-org write budżetu nienaprawiony.
