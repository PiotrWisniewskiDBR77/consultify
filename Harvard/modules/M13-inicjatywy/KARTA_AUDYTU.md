# M13 — Inicjatywy — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `bfdb999147`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M13 · inwentarz `Harvard/podzial/inventory/INV_D_*.md` (sekcja INICJATYWY, poz.1-19) · poprzednia karta `docs/audit/2026-06-02/MODULE_05` (55/100) · SSOT `docs/initiatives/INITIATIVE_FORMULA.md`
**Evidence:** `Harvard/modules/M13-inicjatywy/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 54/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)
> **Re-audit 2026-06-11 po Sprintach 1–5:** A: 19→20 (W6 AI Wizard CTA aktywowany, commit `3aec45a21d`); F: 2→7 (W1 governance org-scope naprawiony, commit `b9f2dee9d2`, hard cap zdjęty); C: 8→9 (kontraktowe testy cross-org, commit `7ab1b8aace`). **Fala 2 (pominięte):** A: 20→21 (ROI navigation button `dc1dd6154d` — TrendingUp w `InitiativesHub` rightControls; `InitiativeConflictsPanel` deleted `2dbebfdd74`). Suma: 53.
> **Fala 3 (2026-06-12):** C: 9→10 — ~~stale import P0 / 0 testów CRUD~~ — pełny rewrite `initiatives-crud.test.ts` (`ea77dc678c`), queryHelpers mock pattern, 5/5 PASS. Suma: 54.

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 21 | 13 REALNE + 2 z degradacją; rdzeń realny; AI Wizard CTA aktywowany (W6, `3aec45a21d`); ROI nav button NAPRAWIONE (`dc1dd6154d`); `InitiativeConflictsPanel` USUNIĘTY (`2dbebfdd74`). |
| B. Wiring i dane | 15 | 10 | Główny router scoped, dokument/archive/status realne, ale cicha degradacja V8 bez komunikatu. |
| C. Testy automatyczne | 15 | 10 | ~520 zielonych; ~~stale import P0 / 0 testów CRUD~~ — CRUD 5/5 PASS po rewrite (`ea77dc678c`); +1 kontraktowe testy cross-org (W1, commit `7ab1b8aace`). |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | §27 Portfolio bez resize, pusta strefa kebaba (§9), status `<select>`; korupcja „rose" poza tabelą; CARD formula 0/15 (treść). |
| F. Bezpieczeństwo/dostęp | 10 | 7 | W1 governance org-scope naprawiony (commit `b9f2dee9d2`); W7 beta-lock 3-warstwowy; pozostałe: pilot gating tylko klient (P2). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **NIE — cross-org P0 naprawiony (W1, commit `b9f2dee9d2`), hard cap zdjęty.** Suma surowa 54 < 70 (Faza 4 niewykonana). |

**Werdykt jednym akapitem:** Rdzeń Inicjatyw jest mocny — portfolio (4 widoki), dokument inicjatywy (~30 sekcji w rejestrze), zakładka Analysis (graf zależności + feasibility/completeness), generator z insightów wywiadu, archive/status z preflightem `initiativeWriteTruth`, ROI realny. Zaufanie i wartość łamią cztery rzeczy: **cross-org IDOR w `initiativeGovernanceService`** (powiązania cel↔inicjatywa i decyzja↔inicjatywa bez org — czwarty moduł z tym wzorcem), **całe tworzenie z huba martwe w UI** (Charter/AI Wizard/New disabled „w przygotowaniu", żywe tylko deep-link `?new=1` i ścieżka z Wywiadu), **cicha degradacja V8 bez komunikatu** (inaczej niż Finance/Results, które mają baner), oraz **gating pilota VTS tylko po stronie klienta** (serwer nie blokuje create/bulk). ROI realny i osiągalny (nav button naprawiony, `dc1dd6154d`).

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_D sekcja INICJATYWY, poz.1-19.
**Scenariusze krytyczne (6):**
1. **S1** — Portfolio (tabela) → preview (`InitiativePreviewV3`) → dokument inicjatywy.
2. **S2** — Create przez deep-link `/initiatives?new=1` → trwałość (hub CTA disabled).
3. **S3** — Dokument ~30 sekcji: edycja sekcji (RAID/KPI) → reload → trwałość.
4. **S4** — Analysis (V3-F02): graf zależności + feasibility/completeness → realne dane.
5. **S5** — Charter wizard z insightu wywiadu (M10) → generacja inicjatywy.
6. **S6** — Kanban status DnD + archive/status (`initiativeWriteTruth` preflight).
**Obowiązujące kanony:** §27 dla tabeli **Portfolio** · **CARD_CONTENT_FORMULA: TAK** (inicjatywy) · wzorzec hubowy: `InitiativesHub` · beta-gating: NIE (core, w public prod).

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Zbiorczo: **REALNE 12 (+2 z degradacją) · ZEPSUTE-disabled 2 · UKRYTE 1 · ZA FLAGĄ 1 · MARTWE 1.**

### 1a. REALNE
- Portfolio (tabela+preview), Kanban, Timeline, Grid; dokument ~30 sekcji (`sections/registry.ts`); Analysis (5 podwidoków + graf + auto-fix); generator propozycji z insightów (poz.9); bulk edit/eksport CSV; archive+status (`initiativeWriteTruth`); filtry/dup detection; czat Teresy; blokada pilota (UI). ROI `/roi` (`FullROIView`→`/api/economics/analyses`, route `AppRoutes.tsx:1735`) — realny.

### 1b. MOCK / STUB
- Brak mocków danych. (Demo Atelier Toys za jawną flagą demo — poprawne.)

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P1] Tworzenie z huba całkowicie martwe w UI** — 3 CTA disabled na sztywno, bez ścieżki włączenia: „Nowa inicjatywa" (`InitiativesHub.tsx:1985-1997`), AI Wizard (`:1943-1952`, `setShowInitiativeWizard(true)` nieobecny), Charter (`:1953-1962`, `setShowCharter(true)` nieobecny). Komponenty gotowe. Żywe: deep-link `?new=1` (`:843-863`→modal `:2167-2249`) + z M10 (`InterviewHub.tsx:12955`).
- **[P3] bulk Tag/Due/Delete** — przyciski-zawsze-disabled (brak BE).

### 1d. UKRYTE / MARTWY KOD
- **[UKRYTE]** poz.8 AI Wizard — modal zmontowany, nieosiągalny z huba (żywy tylko z M10).
- **[MARTWY]** poz.19 `InitiativeConflictsPanel.tsx` — 0 konsumentów; docstring fałszywie twierdzi użycie w `InitiativesTimelineView` → wytnij.

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Lista/CRUD inicjatyw | `pmo/initiatives.routes.ts` (verifyToken+requireOrgAccess) | initiatives | tak | DZIAŁA (scoped) |
| Dokument ~30 sekcji save | InitiativeController + sections | initiative_* | tak | DZIAŁA |
| Archive/status | `initiativeWriteTruth` preflight | initiatives | tak | DZIAŁA |
| Analysis/graf | additive/analysis | initiative deps | tak | DZIAŁA |
| ROI | `/api/economics/analyses` | economics_analyses | tak | DZIAŁA + nav button (`dc1dd6154d`) |
| V8 Planning chip | v8 planning | — | — | DZIAŁA z **cichą** degradacją (bez komunikatu) |
| Powiązania cel/decyzja | `initiativeGovernanceService` (link/get/unlink) | goal_initiative_links, decision links | tak | NAPRAWIONE (`b9f2dee9d2`) |

### 1f. Flagi
| Flaga | Default BE | Default FE | Kto włącza | Wpływ |
|---|---|---|---|---|
| V8 Planning | OFF | — | env | chip pending chains; **cichy** fallback bez banera (inaczej niż Finance/Results) |
| demo Atelier Toys | `shouldAllowDemoData()` | — | toggle/demo | podstawia dane pokazowe |
| pilot VTS | — | UI hub | rola | blokuje create/bulk **tylko w UI** |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WEJŚCIE ← | M10 Wywiad | Charter/generate_from_evidence | `InterviewHub.tsx:12955` | DZIAŁA |
| WYJŚCIE → | M14 Wdrożenie | reuse dokumentu inicjatywy | INV_D Wdrożenie poz.6 | DZIAŁA |
| WYJŚCIE → | M15/M16 | ROI/economics (`/api/economics/analyses`) | poz.16 | DZIAŁA |
| WEJŚCIE ← | M23 Organizacja | powiązania cel↔inicjatywa (governance) | `initiativeGovernanceService` | NAPRAWIONE (`b9f2dee9d2`) |
| WEJŚCIE ← | M03 My Work | powiązania decyzja↔inicjatywa | `initiativeGovernanceService` | NAPRAWIONE (`b9f2dee9d2`) |
| przekrój | M01 Czat | czat Teresy z kontekstem inicjatywy | poz.15 | DZIAŁA |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (vitest, 4 grupy, @ `bfdb999147`):** **~520 stabilnie zielonych**; grupy: unit 188 PASS; BE 156 PASS/4 FAIL; component 178 PASS/9 FAIL/2 SKIP; integracja na efemerycznym PG (część PASS, route'y inicjatyw FAIL na schema-drift).
**Awarie — root-cause:**
- **[P0] stale import** `initiatives-crud.test.ts → ../initiatives.routes.js` (plik przeniesiony do `pmo/initiatives.routes.ts` w `ecee8c2dc5`) → 0 testów CRUD.
- **[P0] mock-drift `react-i18next`** (brak `initReactI18next`) → 4 pliki Initiatives.
- [P1] mock-drift `notificationService.send` (resultsROIService), `getTableColumns` + rozjazd kontraktu błędu (`{code}` vs `{error}`).
- [P1] integ schema-drift: `llm_providers.priority`, `roadmap_waves`, `user_sessions` brak; `--strict` migrate pada na `20260508_block_c_ai_operator.sql` (IMMUTABLE index na pg15).
- [P2] assertion-drift kolorów PhaseIndicator.

**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | CI (PR-gate) | Luka |
|---|---|---|---|---|---|
| S1 portfolio→dokument | smoke | ✓ | — | ✗ | brak e2e click-through |
| S2 `?new=1`→trwałość | ✗ | crud-test martwy | — | ✗ | brak zielonego deep-link |
| S3 ~30 sekcji edit→reload | ✗ | integ blok. | — | ✗ | schema-drift |
| S4 Analysis/completeness | częśc. | ✓ | — | ✗ | readiness integ blok. |
| S5 Charter z insightu | ✓ | ✓ | wizard (nightly) | ✗ | najlepiej pokryty |
| S6 Kanban+writeTruth | ✓ | ✓ (forbidden 22, lifecycle 11, writeTruth 3) | DnD nightly | ✗ | DnD-drop tylko nightly |

**Pułapka CI:** `test-suite.yml` tylko push/PR → main/develop + dispatch; joby „Deferred outside main/develop" → na `feat/*` **żaden initiative-test nie biegnie**. Jedyny initiative-E2E w „PR-gate" (`tier0-initiative-create.spec.ts`, 1) też deferred. Reszta nightly/weekly.

**Backlog testowy:**
1. [P0] napraw stale import `initiatives-crud.test.ts` (→ `pmo/initiatives.routes.ts`).
2. [P0] fix mock `react-i18next` w 4 plikach Initiatives.
3. [P1] napraw notificationService/getTableColumns mocki + ujednolić kontrakt błędu.
4. [P1] E2E S2/S3 (deep-link create + edycja sekcji→reload) i wprowadzić do PR-gate.
5. [P2] posprzątać ~180 leftoverów `*.test.db`.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: list/create inicjatywy, save sekcji, archive/status, Analysis, ROI `/api/economics/analyses`, governance link. Migracje (initiatives/governance/goal_initiative_links). Uwaga schema-drift z testów (roadmap_waves, user_sessions, llm_providers.priority) — sprawdzić na staging/prod.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 6 scenariuszy z reloadem; weryfikacja disabled CTA + ścieżki `?new=1`; cicha degradacja V8 (czy user widzi pustkę bez komunikatu); rola pilot vs admin. **Uwaga DB:** `.env`→Railway zdalna.
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S6 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 (Portfolio, `PortfolioListView.tsx`):** ręczna `<table>` (świadoma, `:398`); preview/filtry/sort/sticky/persistKey/DueChip/PriorityChip PASS. **Odstępstwa:**
- **[P1]** brak resize kolumn (`resizable:false`) + brak portalowego popover „widoczne kolumny" (zero `TableSettingsPopover`).
- **[P1] §9** strefa kontekstowa kebaba pusta/statyczna we wszystkich statusach (`:604-608 actions:[]`) — góra ma się różnić per status.
- **[P2]** status jako `<select>` (kolor `c.*` OK, ale nie `EntityStatusChip`); empty-state 1-wariantowy.
- **Korupcja „rose":** Portfolio i GridView CZYSTE; hardkody `rose`/`blue` w `InitiativeFullView`/`InitiativeDrawer`/`InitiativeConflictsPanel` (martwy) — P2.
**CARD_CONTENT_FORMULA:** walidator `vts-card-audit-validator.cjs` na 15 inicjatywach VTS (prod) → **0/15 PASS** §B3 (dominują `raid_mix` 11/15, `depends_on` 13/15 — graf zależności pusty, `html_entities` 3/15 = realny defekt escapingu IN1-IN3). **Dług treści/danych, nie kodu** (pokrywa się z `project_vts_card_audit`).
**Wzorzec hubowy:** `InitiativesHub` zgodny.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **Główny router scoped (~30 by-id endpointów org-scoped); governance to dziura.**
| Warstwa | Nawigacja | Route | API | Dziura? |
|---|---|---|---|---|
| Inicjatywy (core) | sidebar otwarty | zalogowany | verifyToken + requireOrgAccess + rate-limit | — |
| Governance (-v4) | — | — | org-scope naprawiony (`b9f2dee9d2`) | **NIE** |
| Pilot VTS | UI hub | — | brak gatingu serwerowego | **TAK (P1)** |

**Findingi:**
- ~~**[P0] cross-org IDOR governance**~~ **NAPRAWIONY** (`b9f2dee9d2`) — `initiativeGovernanceService` refaktoryzowany: wszystkie 5 funkcji z org-scope (link/get/unlink/linkDecision/getDecisions).
- **[P1] router governance org-spoofable** — mount `/api/initiatives-v4` (`Gateway.ts:906`); agent zgłasza brak `requireOrgAccess` i org z `x-organization-id`/`?organizationId` — do potwierdzenia, ale serwis i tak ignoruje org.
- **[P1] gating pilota VTS tylko klient** — `isPilotParticipantRole` w hubie; serwer `createInitiative`/bulk/generator bez gatingu → obejście bezpośrednim API.
- **[P2]** `createGovernanceGate` nie weryfikuje przynależności `initiativeId` do org; brak osobnych capability serwerowych dla approve/transition.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0)
1. **Org-scope na `initiativeGovernanceService`** — dodać `orgId` + filtr `organization_id`/ownership do link/get/unlink (cel+decyzja) wg wzorca `getGoalRollup` — Weryfikacja: test cross-org (org-A nie linkuje/nie czyta powiązań org-B → 403/404).
2. **`requireOrgAccess` na routerze governance** (`/api/initiatives-v4`) + org wyłącznie z tokena — Weryfikacja: spoof `x-organization-id` ignorowany.
3. **Napraw stale import + i18n mock** (testy CRUD/Initiatives) — Weryfikacja: testy CRUD aktywne i zielone.

### Fala 2 — Domknięcie wartości (P1)
1. **Włączyć tworzenie z huba** — odblokować New/Charter/AI Wizard (komponenty gotowe) lub świadomie usunąć CTA — Weryfikacja: CTA tworzy inicjatywę albo znika.
2. **Gating pilota serwerowo** — `createInitiative`/bulk/generator odrzucają rolę pilota — Weryfikacja: pilot API → 403.
3. **Komunikat przy degradacji V8** (zamiast cichej pustki) — Weryfikacja: baner/log widoczny jak w Finance/Results.
4. ~~**Wejście do ROI z nawigacji**~~ — **DONE** (`dc1dd6154d`) — TrendingUp nav button w `InitiativesHub` rightControls.

### Fala 3 — Jakość i kanony (P2)
1. **§27 Portfolio** — resize kolumn + popover „widoczne kolumny" + strefa kebaba per status (§9) — Weryfikacja: §27 A-S czyste.
2. **Korupcja „rose"** w `InitiativeFullView`/`InitiativeDrawer` → `EntityStatusChip`/`c.*` — Weryfikacja: 0× hardkod.
3. ~~**Wytnij `InitiativeConflictsPanel`**~~ — **DONE** (`2dbebfdd74`) — 154 linie usunięte, 0 referencji.
4. **bulk Tag/Due/Delete** — wpiąć BE lub ukryć przyciski — Weryfikacja: brak przycisków-zawsze-disabled.
5. (Treść kart VTS — `project_vts_card_audit`, nie M13.)

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: checklisty Fazy 5 bez odstępstw P0/P1
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE
- [ ] 6. Zero cichych degradacji bez komunikatu

---
**Pozostałe do domknięcia audytu M13:** Faza 3 (Railway) + Faza 4 (żywe 6 scenariuszy). ~~P0 cross-org governance~~ NAPRAWIONE (`b9f2dee9d2`). ~~P0 CRUD 0 testów~~ NAPRAWIONE (`ea77dc678c`). Brak otwartych P0.
