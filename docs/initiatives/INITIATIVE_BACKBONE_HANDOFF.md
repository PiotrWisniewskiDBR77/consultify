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
- **2026-06-27 F0-ink-2 (ZROBIONE):** `enrichContext` populuje `orgContext` (organizations.name+industry).
- **2026-06-27 — 5 AGENTÓW RÓWNOLEGLE (ZROBIONE, ~110 testów, wszystko na GitHubie):**
  - **F0 reszta:** `financialsGrounding.ts` (org P&L→grunt, wpięty w enrichContext → 4/4 źródła) + `auditInitiativeService.ts` (`createInitiativeFromAudit`, source_type=audit, DRAFT). [16 testów]
  - **F2 kandydaci:** `initiativeCandidateService.ts` + `initiativeCandidates.routes.ts` + migracja `20260627_initiative_candidates.sql` + `CandidatesPanel.tsx`. Router ZAMONTOWANY (przed initiativesRoutes). [24 testy]
  - **F3 silnik bloków:** `cards/cardBlockSchema.ts` (validateCardSpec critic) + `cards/CardBlockRenderer.tsx`. [32 testy]
  - **F4 portfel:** `portfolioAnalysisService.ts` (Jaccard dedup + MECE + balans, czysty) + `PortfolioHealthView.tsx`. Endpoint `GET /portfolio-health` ZAMONTOWANY. [24 testy]
  - **F5 materiał:** `initiativeMaterializeService.ts` (inicjatywa/portfel→deck/raport/TABELA via M17) + `initiativeMaterialize.routes.ts` ZAMONTOWANY. [14 testów]
  - **Wiring backendu ZROBIONY:** financials w enrichContext; 4 routery zamontowane w Gateway (kandydaci+backbone PRZED initiativesRoutes — shadow `/:id`; materialize PO). `initiativeBackbone.routes.ts` = from-audit + portfolio-health. Regresja 347/347, tsc czysto. Commity `67e90e27e1`, `b9461d33a7`, `5efd2273af`.
- **CO ZOSTAŁO (dla następcy):**
  1. **F1 MÓZG GENERATORA** (NIE zbudowany — to orkiestracja spinająca moduły): tor szybki `generateFullInitiative(brief)` = grunt(F0) → dobór kart (6 rdzenia + propozycje via biblioteka) → fill wszystkich (`generateSectionContent`) → auto-heal (recenzent <próg → regen) → DRAFT. + endpoint `POST /propose-cards`. + Teresa pełny fill + lineage (`generateInitiative.ts`). To rdzeń — rób następne.
  2. **FE wiring (wymaga preview, kontendowane pliki):** taby „Kandydaci"+„Zdrowie portfela" w `InitiativesHub.tsx` (+ `ModuleTab` union w `src/components/shared/ModuleHub/types.ts`); przyciski „Zrób materiał" w `InitiativeDocumentView.tsx`+hub (POST /:id/materialize, blob); badge „AI sugeruje inicjatywę" przy insight/assessment/audyt. Szczegóły lokalizacji = w raportach agentów (zob. wiring notes powyżej / git log).
  3. **F3 migracja kart:** adopcja `CardBlockRenderer` przez 6 kart rdzenia (kontrakt AI→CardSpec gotowy; `validateCardSpec` jako critic gate auto-heal).
  4. **Tabela `audits`:** scan kandydatów z audytów = no-op aż tabela powstanie (F0 audit→initiative działa gdy audit istnieje).
  5. **F6/F7:** handoff rezultatów (w dużej części gotowy 92/92) + raport WYNIKI dla nowych zdolności (L3 E2E — komenda w §1).
- **2026-06-27 — BATCH 2 (5 agentów, +73 testy, pushed da5a2b48f8):**
  - **F1 MÓZG ZROBIONY:** `initiativeGeneratorBrain.ts` (`proposeCards` 6-rdzeń+opcjonalne; `generateFullInitiative` z auto-heal D12 — regen <próg raz, fail-soft) + `initiativeGeneratorBrain.routes.ts` (ZAMONTOWANY przed initiativesRoutes; nazwa *Brain by nie kolidować z istniejącym `initiative-generator.routes`). [20 testów]
  - **FE WIRING ZROBIONY (czeka na PREVIEW):** taby „Kandydaci"+„Zdrowie portfela" + portfolio „Zrób materiał" w `InitiativesHub` (+ `ModuleTab` union + locale); dropdown „Zrób materiał" (deck/raport/tabela→blob) w `InitiativeDocumentView`. tsc czysto, hub-smoke 3/3, i18n gate 0.
  - **AUDYTY:** `20260627_audits.sql` ALTER dodaje kolumny które serwisy pytają (project_id/title/summary/description) — parytet F0/F2. + `InitiativeSuggestionBadge.tsx` (reużywalny).
  - **TESTY:** `backboneEndpoints.test.ts` (34 L2) + `m13-backbone.spec.ts` (17 L3 ŻYWE) + `resultsHandoff.test.ts` (F6 — handoff POTWIERDZONY kompletny).
  - **DEFEKT NAPRAWIONY:** `POST /from-audit` 500→404 (audits bez project_id → PG throw przed gałęzią not-found); `auditInitiativeService` schema-safe (try full→fallback→null=404).
  - Regresja 519/519 (1 pre-existing infra fail: brak roli PG "iris"). Wszystkie zdolności osiągalne API + w UI.
- **CO ZOSTAŁO TERAZ:**
  1. **PREVIEW PASS FE** (jakość — wymaga dev-servera; :3000 bywa zajęty): wizualnie potwierdzić taby Kandydaci/Zdrowie-portfela + przyciski „Zrób materiał". jsdom+tsc zielone, ale piksele niezweryfikowane.
  2. **F3 migracja kart** na `CardBlockRenderer` (incremental; kontrakt AI→CardSpec gotowy).
  3. **Badge insertion** do widoków discovery (InsightDetailView/AssessmentSessionEditorView/DRDAuditReportView — lokalizacje w raporcie agenta 5).
  4. **Teresa upgrade:** `generateInitiative.ts` → wołaj `generateFullInitiative` + stampuj source_type/source_id (dziś szkic, gubi lineage).
  5. **Migracja audits na staging** (ALTER additive, staging-first), potem from-audit strict-4xx.
  6. F7 WYNIKI: `WYNIKI_M13_BACKBONE_RUN1.md` (draft jest) — uzupełnić L3 po pełnym przebiegu.
- **2026-06-27 — RUNDA 3 (5 agentów, +81 testów, pushed 55c53bb817):**
  - **Teresa pełny-fill + lineage:** `generateInitiative.ts` stampuje source_type/source_id (było gubione) + woła `generateFullInitiative` + persystuje karty do `ai_generated_sections` (fail-soft; mapowanie na kolumny typowane = udokumentowane). [14 t]
  - **Badge'y wpięte** w 3 widoki discovery (InsightDetailView, AssessmentSessionEditorView, DRDAuditReportView).
  - **F3 karty:** `cardSpecBuilders.ts` + `ProblemDefinitionSection` renderuje preview `CardBlockRenderer` (additive). [17 t]
  - **F2→F1 spięte:** `acceptCandidate` tworzy DRAFT + wypełnia przez brain + zwraca initiativeId. [33 t]
  - **Grounding L2:** `groundingEnrichment.test.ts` — enrichContext populuje 4 źródła przez prompt. [17 t]
  - **WYNIKI_M13_BACKBONE_RUN1 ukończony:** 502 testy backbone zielone (L3 19 URUCHOMIONE NA ŻYWO — backend znów zapisywalny: m13-backbone 17/17 + FE-smoke 2/2 → taby renderują się OK).
  - **ANTY-DUBLET (ja):** acceptCandidate-serwer vs hub-klient tworzyły 2 inicjatywy → hub nawiguje do initiativeId z serwera gdy obecny. Single-create. 81 zielonych, tsc czysto.

---
## STAN DEFINITYWNY (po 3 rundach, 2026-06-27)

**ZBUDOWANE + OSIĄGALNE (API + UI, L3 na żywo):** F0 grunt 4-źródła · F1 mózg (generate-full+auto-heal) · F2 kandydaci (skrzynka+badge+accept→fill) · F3 silnik bloków + 1 karta zmigrowana · F4 zdrowie portfela · F5 materiał (deck/raport/tabela) · F6 handoff rezultatów · Teresa pełny-fill+lineage · proces statusów (92/92). **~600 testów inicjatyw zielonych łącznie.**

**CO ZOSTAŁO (dla następcy — priorytet):**
1. **F3 reszta kart:** zmigruj 5 pozostałych kart rdzenia na `CardBlockRenderer` wzorem `ProblemDefinitionSection` (`cardSpecBuilders` ma już builder dla targetState+businessCase). Docelowo: generator emituje `CardSpec` bezpośrednio (kontrakt w raporcie agenta C).
2. **Teresa persystencja typowana:** dziś karty lądują w `ai_generated_sections` (JSON sink); dorób mapper componentKey→kolumny typowane (problem_statement/target_state/kpis/...) w `InitiativeController` FIELD_MAP — szczegóły w raporcie agenta A rundy 3.
3. **Migracja `audits` na staging** (ALTER additive 20260627_audits) → potem from-audit strict-4xx (test L3-BB-16 poluzowany).
4. **Preview wizualny pełny:** L3 smoke potwierdził render bez error-boundary; pełny przegląd UX (spacing/placement badge'y+przyciski) wart oka Piotra.
5. **Trigger auto-skanu kandydatów:** dziś ręczny `/candidates/scan`; dorób event/cron po nowym insight/assessment/audyt.
6. **propose-cards UI:** endpoint `POST /propose-cards` żyje; dorób UI w torze szybkim/kreatorze pokazujący proponowane karty.
7. **Deploy demo + odbiór Piotra** całości.
- *(kolejne wpisy dopisuje agent w trakcie)*
