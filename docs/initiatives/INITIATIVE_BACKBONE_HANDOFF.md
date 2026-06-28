# Inicjatywy — KRĘGOSŁUP: handoff wykonawczy dla agenta-następcy

> **CZYTAJ TO NAJPIERW.** To jest precyzyjny plan wykonawczy budowy kręgosłupa aplikacji
> (system inicjatyw). Piotr przydzielił ten obszar JEDNEMU agentowi (Ty). Drugi agent
> równolegle domyka chat/canvas/ideas/notes — NIE wchodź w te pliki.
>
> **Mandat Piotra (2026-06-27):** pełna akceptacja planu; commituj + push na GitHub gdy
> warto; buduj warstwa-po-warstwie z testami (jak proces statusów: 92/92); dokumentuj
> KAŻDE działanie tu, bo nie zmieścimy się w jednym oknie kontekstowym.

## Kolejność czytania (5 min onboardingu)
1. **`INITIATIVE_SYSTEM_SSOT.md`** (obok) — wizja wrzeciona + 12 decyzji D1-D12 + plan faz F0-F7. To „dlaczego/co".
2. **TEN plik** — „jak": pliki, funkcje, endpointy, testy, DoD per faza + gdzie skończyłem.
3. `INITIATIVE_LIFECYCLE.md` — proces statusów (GOTOWY, nie ruszaj rdzenia).
4. `Harvard/Testy manualne/TESTY_M13_PROCES_STATUSOW.md` + `WYNIKI_M13_INICJATYWY_RUN1.md` — wzór systemu testów (L1/L2/L3) + dowód.

---

## 0. Stan na 2026-06-27 (co GOTOWE, co LUKA)

**GOTOWE i udowodnione (nie przebudowuj):**
- **Proces statusów (D6):** 13 statusów, bramki, RBAC, AI-readiness, timeline-gate. SSOT `server/src/constants/initiativeStatuses.ts`. Handler `server/src/controllers/InitiativeController.ts:1231` (`updateInitiativeStatus`). **92/92 testy** (L1 `tests/unit/backend/initiativeStatuses/stateMachineComplete.test.ts`, L2 `tests/integration/initiatives/statusLifecycle.test.ts`, L3 `tests/e2e/m13/m13-status-lifecycle.spec.ts`). DEF-1 (BLOCKED-reason) naprawiony.
- **Widoki:** InitiativesHub (lista/kanban/gantt/grid) + `InitiativeDocumentView.tsx` (karty). 
- **AI-fill karta+pole:** `generate-section` (`routes/pmo/initiatives.routes.ts:2049` → `initiativeGenerationService.ts:390`) + recenzent (`:2101`) + `AIFieldEnhancer` per-pole.
- **Korelacje-narzędzia:** Tasks (`tasks.initiative_id`), Decyzje (`decisions.initiative_id` + bramki), Notyfikacje (status-changed).
- **Korelacje-źródła ŻYWE:** Insights (`source_type='interview_insight'`), Tools (`ToolInitiativeService.ts:271`), Assessments (`assessmentInitiativeService.ts:689`).
- **Deck z inicjatyw:** intent `initiative_portfolio` (`presentationGeneratorService.ts:858`).

**LUKI (do zbudowania — to jest praca):** patrz §1 (G1-G11 z SSOT) + per-faza niżej.

---

## 1. Konwencje (TRZYMAJ SIĘ)
- **Branch:** `feat/deliverables-w1` (współdzielony — git races realne). Commituj NATYCHMIAST po zielonych testach. NIGDY `git add -A`/`git add .` — tylko swoje pliki. `tests/` jest gitignored → `git add -f tests/...`. Weryfikuj `git ls-files`.
- **Testy = `git add -f`** (bo `.gitignore:209 /tests/`). Guard: `node scripts/deliverables/check-test-tracking.cjs` (wzór).
- **System testów per zdolność:** L1 unit (czysta logika) + L2 integration (realny handler, mock-DB — wzór `tests/integration/initiatives/statusLifecycle.test.ts`) + L3 E2E Playwright (żywy backend). 30 scenariuszy/warstwa jak przy statusach.
- **E2E uruchamianie (DZIAŁA, sprawdzone):** backend musi żyć na `:3001` (dev), frontend `:3000`. Komenda: `E2E_REQUIRE_TEST_SUPPORT=true E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://127.0.0.1:3000 TEST_SUPPORT_KEY=local-test-support-key-change-me npx playwright test <spec> --project=chromium --workers=1`. Token z `readTestSupportState()` (global-setup). Helpery: `tests/e2e/m13/_m13.ts` (`seedInitiative`, `authHeaders`, `shot`, `gotoHub`, `openDoc`).
- **tsc:** `cd server && npx tsc --noEmit` (107 pre-existing błędów NIE-twoich — sprawdzaj tylko swoje pliki grep'em). FE: `npx tsc --noEmit` z roota.
- **PROD = centerbeam = NIGDY bez osobnej zgody.** Deploy demo: gałąź `demo`→Railway. Staging-first migracje.
- **Anchory file:line w tym dokumencie mogą się przesunąć** (inni agenci commitują) — ZAWSZE re-grep symbol przed edycją, nie ufaj numerowi linii na ślepo.
- **„audyty zawyżają ~1 na 7"** — weryfikuj runtime przed działaniem (lekcja DEF-1/F1: agent pomylił `tool_sessions` z `initiatives`).

---

## 2. PLAN WYKONAWCZY per faza (precyzyjnie)

### F0 — GRUNT (fundament, rób PIERWSZE) · D3
**Cel:** generacja inicjatywy czyta 4 źródła: org-context + artefakt(+audyt) + portfolio + Financials/KPI.

**Zadania:**
1. **Audyt → inicjatywa (source).** Dziś brak. Wzór: `assessmentInitiativeService.ts:646/689` (jak assessment tworzy inicjatywę). Dodaj analog dla audytów: znajdź serwis audytów (grep `audit` w `server/src/services/`), dodaj `createInitiativeFromAudit` ze `sourceType:'audit'`, `sourceId:auditId`. Rozszerz enum `validators/initiative.validators.ts:53-55` o `'audit'`.
2. **Financials/KPI jako grunt.** Enum `financial_analysis` jest martwy. W `initiativeGenerationService.ts` (okolice `:454` `getFormulaGuidance` + `:460` grounding block) dołącz realne dane: query org Financials (grep `financial` services) + KPI (`v8_kpi_definitions`/`initiative_kpis`) → wstrzyknij do promptu sekcji business_case/financial_impact/kpis.
3. **Org-context wzmocnienie.** W grounding block dołóż profil org (branża/cele/standardy) — sprawdź czy jest serwis org-context (grep `organizationContext`, `OrganizationContextService` — używany w M17 `briefEnrichment.ts`). Reużyj.
4. **Ideas/Notes → lineage.** Dziś tylko `link_graph_edges` (`notebookConversionService.ts:348`, `my-work.routes.ts:6303`). Dodaj `sourceType:'idea'`/`'notebook'` przy konwersji (uważaj: `notebookConversionService.ts:88` to status TOOL_SESSION nie inicjatywy — lekcja DEF-1).

**Testy:** L1 (funkcje budujące grounding z 4 źródeł — czyste), L2 (generate-section z mock org/portfolio/finance → prompt zawiera realne dane), L3 (audyt→inicjatywa E2E).
**DoD:** prompt generacji dowodliwie zawiera org+portfolio+finanse; audyt→inicjatywa działa E2E; enum rozszerzony.

### F1 — MÓZG GENERATORA (rdzeń) · D1/D2/D10/D12
**Cel:** tor szybki brief/Teresa → AI dobiera karty (6 rdzenia + propozycje) → wypełnia WSZYSTKIE → auto-heal → DRAFT.

**Zadania:**
1. **Pełny AI-fill całej inicjatywy.** Dziś `generate_initiative` tool (`server/src/services/ai/tools/generateInitiative.ts`) tworzy TYLKO szkic (tytuł+problem, `:39`). Zbuduj `generateFullInitiative(brief, opts)` w nowym/rozszerzonym serwisie: (a) buduje grounding (F0), (b) generuje 6 kart rdzenia (D10: Problem/Teza/KPI/Zakres/Właściciel/Business-case) iterując `initiativeGenerationService.generateSectionContent` (`:390`), (c) auto-heal (D12): po każdej karcie wywołaj recenzenta (`review-section` logika), jeśli <próg → regen raz.
2. **Rdzeń 6 kart (D10).** Zdefiniuj stałą `CORE_SECTIONS = ['overview/problem','hypothesis','kpis','scope','owner(control/team)','businessCase']` (zmapuj na realne `componentKey` z `src/components/Initiatives/sections/registry.ts` — zweryfikuj nazwy).
3. **AI proponuje dodatkowe karty (D2).** Nowy endpoint `POST /initiatives/propose-cards` (body: type/source/context) → AI zwraca listę opcjonalnych kart z biblioteki (26 systemowych - 6 rdzenia) wg typu. Biblioteka = `migrations/529_initiative_section_types.sql` (26 system types).
4. **Tor głęboki odchudzony.** Kreator istnieje (`InitiativeCharterWizard.tsx`, `useInitiativeGenerator.ts`). Zredukuj kroki; recenzent interaktywny zostaje.
5. **Teresa pełny fill + lineage.** `generateInitiative.ts` → wywołaj `generateFullInitiative` zamiast szkicu; stampnij `source_type/source_id` (dziś gubione — używa tylko `source:'teresa_chat'`).

**Testy:** L1 (dobór kart rdzeń+propozycje, auto-heal logika), L2 (generateFullInitiative na mock-DB → 6 kart wypełnionych), L3 (brief→pełna inicjatywa E2E, screenshot).
**DoD:** brief→kompletna inicjatywa (6 kart) <X s; auto-heal podnosi jakość mierzalnie; Teresa stampuje lineage.

### F2 — SKRZYNKA KANDYDATÓW (wejście wrzeciona) · D5/D8
**Cel:** AI proaktywnie sugeruje inicjatywy z rozpoznania; zakładka zbiorcza + badge kontekstowy.

**Zadania:**
1. **Serwis skanujący.** `initiativeCandidateService`: skanuje nowe insights/assessmenty/audyty (bez przypisanej inicjatywy) → AI generuje kandydatów (tytuł+uzasadnienie+dopasowanie do portfela via F4 dedup). Tabela `initiative_candidates` (migracja: id, org, source_type, source_id, title, rationale, fit_score, status[pending/accepted/dismissed]).
2. **Endpointy:** `GET /initiatives/candidates` (lista), `POST /initiatives/candidates/scan` (ręczny skan), `POST /initiatives/candidates/:id/accept` (→ generator F1), `POST /:id/dismiss`.
3. **FE zakładka „Kandydaci"** w `InitiativesHub.tsx` (obok kanban/lista). + **badge** komponent przy artefaktach rozpoznania (insight/assessment/audyt views) „AI sugeruje inicjatywę".
4. **Auto-skan trigger:** po utworzeniu insight/assessment/audyt (hook/event) — albo cron. Propozycja: event-driven + ręczny przycisk.

**Testy:** L1 (scoring/dopasowanie), L2 (scan endpoint + accept→generator), L3 (zakładka renderuje kandydatów, accept→DRAFT, badge widoczny).
**DoD:** skan generuje kandydatów z realnego rozpoznania; accept→inicjatywa z lineage; badge na 3 typach artefaktów.

### F3 — SILNIK BLOKÓW KART (fundament wizualny) · D11
**Cel:** karty renderowane z deklaratywnych bloków (jak M17), AI składa układ.
**KLUCZ:** reużyj kompozycję M17 — `server/src/services/deliverables/` (bundleGenerationRuntime, spineToUnifiedReport, deckDesignCritic, slideArchetypes, paletteLibrary). Block-types: kpi_strip/paragraph/table/chart/callout/bullet_list (z `COMPOSITION_BLOCK_TYPES` w `presentationLayoutDirectorService.ts:141`).

**Zadania:**
1. **Schema bloków karty** (typy bloków per karta). 
2. **Generyczny renderer** `CardBlockRenderer.tsx` (FE) — mapuje bloki→UI, wzór z M17 document renderer.
3. **Migracja 6 kart rdzenia** treściowych na bloki (problem/teza/business-case najpierw). Karty narzędziowe (Gantt/KPI/RAID `TimelinePlanner`/`KpisSection`/`RaidSection`) — hybryda: zostają bespoke lub interfejs do bloków.
4. **AI składa układ** karty (grammar jak deck composition M17 — `deckDesignCritic` waliduje).

**Testy:** L1 (block schema + krytyk DR-06 jak deckDesignCritic), L2 (renderer honoruje bloki), component-test (karta renderuje bloki).
**DoD:** 6 kart rdzenia z bloków; AI-skład; spójność wizualna; krytyk waliduje.
**UWAGA:** to DUŻY build + wizualny → wymaga weryfikacji w preview (zasada „verify before claiming”). Nie deklaruj „gotowe” na samym tsc.

### F4 — ZDROWIE PORTFELA · D9
**Cel:** dedup w generatorze + widok MECE/luki/balans.
**Zadania:**
1. **Dedup serwis** `portfolioAnalysisService`: przy tworzeniu inicjatywy → similarity vs istniejące (embedding lub keyword) → ostrzeżenie + sugestia luki. Wpięcie w generator F1 + skrzynkę F2.
2. **Widok „Zdrowie portfela”** (`PortfolioHealthView.tsx` w hubie): mapa MECE (pokrycie obszarów), luki, duplikaty, balans (effort/impact). Dane z portfela inicjatyw.
**Testy:** L1 (similarity/MECE-coverage logika), L2 (dedup endpoint), L3 (widok renderuje mapę).
**DoD:** dedup ostrzega realnie; widok pokazuje mapę MECE z portfela.

### F5 — PRZEDSTAWIANIE: M17 JEDEN KLIK · D4
**Cel:** „Zrób materiał” na inicjatywie/portfelu → deck/raport/tabela przez M17.
**Zadania:**
1. **Przycisk „Zrób materiał”** w InitiativeDocumentView + hub (portfel).
2. **Inicjatywa/portfel → SPINE/bundle** (most do M17 `bundleGenerationRuntime`/`generateBundle`). Deck (intent portfolio ✅ poleruj), Raport (domknij render — `report_initiatives` link istnieje), **Tabela (NOWE** — eksport status/KPI/ROI przez M17 table generator).
3. Endpoint `POST /initiatives/:id/materialize` (format: deck/report/table).
**Testy:** L2 (materialize → 3 formaty), L3 (1-klik → pobranie). Wzór: M17 `bundleExport.test.ts`.
**DoD:** 1-klik → deck+raport+tabela z realnych danych; tabela non-empty.

### F6 — WYJŚCIE: REZULTATY (interfejs) · J
**Cel:** weryfikacja handoff DONE→TRACKING→benefits/KPI/ROI (M15/M16). W dużej części GOTOWE (status process).
**Zadania:** testy interfejsu handoff (część w 92/92); domknięcie benefits register + KPI realization jeśli luki.
**DoD:** DONE→TRACKING tworzy benefits + KPI; testy handoff zielone.

### F7 — TESTY + RAPORT
- System L1/L2/L3 dla F0-F5 (nowe zdolności), wzór `TESTY_M13_PROCES_STATUSOW`.
- Raport `Harvard/Testy manualne/WYNIKI_M13_SYSTEM_RUN1.md`.
- **DoD:** wszystkie nowe zdolności zielone + sklasyfikowane (zero „nigdy nie wykonane”).

---

## 3. Kluczowe pliki (mapa — re-grep przed edycją!)
| Obszar | Plik |
|---|---|
| Statusy SSOT | `server/src/constants/initiativeStatuses.ts` |
| Handler statusu/create | `server/src/controllers/InitiativeController.ts` (`:1231`, `:572`) |
| Routes inicjatyw | `server/src/routes/pmo/initiatives.routes.ts` (generate-section `:2049`, review `:2101`, section-types `:1911`) |
| Generacja AI (karta) | `server/src/services/initiativeGenerationService.ts` (`:390`, `:454`) |
| Teresa tool (szkic) | `server/src/services/ai/tools/generateInitiative.ts` |
| Karty rejestr (FE) | `src/components/Initiatives/sections/registry.ts` |
| Dokument inicjatywy (FE) | `src/components/Initiatives/InitiativeDocumentView.tsx` |
| Hub (widoki) | `src/components/Initiatives/InitiativesHub.tsx` |
| Section types (DB) | `server/migrations/529_initiative_section_types.sql` (26 system) |
| Source enum | `server/src/validators/initiative.validators.ts:53` |
| Lineage | `server/src/services/initiative/initiativeLineageService.ts` |
| Spec treści kart | `docs/standards/CARD_CONTENT_FORMULA.md`, `docs/initiatives/INITIATIVE_FORMULA.md` |
| M17 (reuse F3/F5) | `server/src/services/deliverables/` (bundleGenerationRuntime, spineToUnifiedReport, deckDesignCritic, slideArchetypes, paletteLibrary) |
| E2E helpery | `tests/e2e/m13/_m13.ts`, `tests/e2e/_helpers/testSupportState.ts` |

---

## 4. GDZIE SKOŃCZYŁEM / NASTĘPNA AKCJA
> Aktualizuj tę sekcję po KAŻDYM kroku (Piotr: „cały czas dokumentuj działania”).

- **2026-06-27:** SSOT + ten handoff napisane, zacommitowane, **wypchnięte na GitHub** (`2fd964f6a9`). Proces statusów GOTOWY (92/92).
- **2026-06-27 F0-inkrement-1 (ZROBIONE):** grunt portfolio/org/financials w generacji.
  - `initiativeGenerationService.ts`: `GenerationContext` +3 pola (`portfolioSummary`/`orgContext`/`financialsSummary`); `buildGroundingBlock` EKSPORTOWANY + emituje je (org pierwszy, portfolio z instrukcją „NIE duplikuj"); `enrichContext` POPULUJE `portfolioSummary` (query ≤15 aktywnych inicjatyw org, best-effort).
  - `validators/initiative.validators.ts:54`: enum source +`'audit'`.
  - Test L1: `tests/unit/initiative/groundingBlock.test.ts` (5/5). Regresja 256/256, tsc czysto.
- **NASTĘPNA AKCJA (F0 reszta):** (a) POPULOWAĆ `orgContext` w enrichContext — znajdź serwis org-context (`grep OrganizationContextService`), wstrzyknij profil org; (b) POPULOWAĆ `financialsSummary` — z `finance*` services (np. `financeEnterpriseService`/`economicsFinancials`), realne liczby org; (c) **Audyt→inicjatywa** ścieżka konwersji (wzór `assessmentInitiativeService.ts:646/689`, serwis audytu = `auditService.ts`/`auditProgramService.ts`), stamp `source_type='audit'`. Potem L2 (enrichContext z mock-DB → portfolio w prompcie) + L3.
- *(kolejne wpisy dopisuje agent w trakcie)*
