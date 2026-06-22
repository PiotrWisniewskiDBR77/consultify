# HARVARD DOC — Raport przekazania: Generatory Deliverable (M17–M20)

> **Cel tego dokumentu:** kompletny handoff dla NASTĘPNEGO agenta. Po przeczytaniu masz mieć pełen kontekst: co to za program, co zrobiono, co NIE zrobiono (uczciwie), jak kontynuować, gdzie są pliki, jakie są pułapki.
>
> **Data:** 2026-06-22 · **Branch:** `feat/deliverables-w1` · **Autor sesji:** Claude (Opus 4.8/4.7)
> **Główny SSOT operacyjny:** `Harvard/wdrozenie-100/DELIVERABLES-STAN-PRACY-ODBIORY.md`
> **Pamięć projektu:** `~/.claude/projects/.../memory/project_deliverables_generators.md` + `MEMORY.md`

---

## 0. NAJWAŻNIEJSZE — przeczytaj zanim cokolwiek zrobisz

### 0.1 Uczciwy stan: KOD przetestowany, PRODUKT nie

To jest sedno, którego nie wolno przeoczyć (Piotr o to pytał wprost):

| Co | Stan | Dowód |
|---|---|---|
| **Testy KODU** (unit FT-1 + integration FT-2, mock-LLM) | ✅ ZROBIONE | 226 testów zielonych, 29 plików |
| **Testy PRODUKTU na żywym LLM** (FT-6 jakość) | ❌ NIE ZROBIONE | żaden generator nie był odpalony na prawdziwym Claude/LLM |
| **Testy manualne** (FT-7, człowiek w przeglądarce + screenshoty) | ❌ ZERO | Manual 0/N w całym dashboardzie |
| **E2E w prawdziwej przeglądarce** (FT-3 Playwright browser) | ❌ NIE dla deliverables | "e2e" w nazwach testów = vitest z mockowanym LLM, NIE browser |
| **Odbiór wizualny (→UI) + funkcjonalny (→F)** | ❌ czeka Piotra | wymaga deploya na staging |

**„GOTOWY code-side 🟢"** w trackerze znaczy DOKŁADNIE: *kod napisany + testy logiki (mock) przechodzą*. NIE znaczy: zweryfikowane na żywym LLM / zobaczone w przeglądarce / zaakceptowane przez człowieka. To ~⅔ bramek odbioru które NADAL są otwarte i **wszystkie wymagają albo decyzji Piotra (Q1–Q5), albo deploya na staging.**

Mock-mode testy sprawdzają: czy normalizery clampują, czy fallback działa, czy scoring wykrywa braki, czy walidacja odrzuca śmieci. **NIE sprawdzają czy prawdziwy LLM wyprodukuje dobry deck/raport/tabelę** — bo mock zwraca dane które agent sam podał.

### 0.2 Zasady bezpieczeństwa (z pamięci, OBOWIĄZUJĄ)

- **Klienci OFF first.** Wszystkie generatory premium są ZA FLAGĄ `ENABLE_DELIVERABLES_PREMIUM` (domyślnie OFF) i **NIEWPIĘTE w żywy pipeline**. Klienci dziś dostają dokładnie to co przed programem (deterministyczny fallback). Wpięcie w żywą ścieżkę = osobna, świadoma decyzja per moduł i per klient.
- **Prod = centerbeam.** NIGDY deploy na prod bez osobnej zgody Piotra. Staging najpierw (caboose). Patrz `[[finding_railway_db_topology]]`.
- **Verify before claiming.** Każda zmiana UI → otwórz w przeglądarce, udowodnij screenshotem. NIE raportuj „done" na samym tsc/eslint. Patrz `[[rule_verify_before_claiming]]`.
- **CI pomija `src/**/__tests__`** — kładź testy w `tests/{unit,integration,components}`, inaczej NIGDY nie polecą w CI. Patrz `[[finding_ci_skips_src_tests]]`.

### 0.3 Podział pracy

- **Piotr** = product + strategy (wymyśla i testuje featury), komunikacja po polsku, UX w stylu Miro/Gamma.
- **Claude (Ty)** = CTO, robisz CAŁĄ inżynierię + decyzje techniczne/infra/deploy.
- **Inny agent** owns M01–M04 (nie dotykaj bez koordynacji). Git races są realne — weryfikuj HEAD.

---

## 1. CZYM JEST TEN PROGRAM

**Cel produktowy:** M17 Outputs + M18 Doc + M19 Deck + M20 Table mają stać się **zunifikowanymi generatorami deliverable** o jakości **Gamma (deck) / Kimi-Claude (doc) / Airtable+Claude-Excel (table)**.

**Model produktu (zaakceptowany):** jedno wejście, trzy wyjścia. 3 ścieżki wejścia → jeden silnik Teresy:
1. ze źródeł (inicjatywa/notatnik/ideas/canvas — istniejące przyciski „zrób z tego"),
2. czat z Teresą („zrób raport na temat"),
3. przycisk „Nowy" w Outputs.

**Decyzje biznesowe (zablokowane):**
- **D1:** mózg generatywny = premium LLM (klasy Opus) jako GENERATIVE DESIGNER, nie template-filler. Koszt optymalizujemy później.
- **D2:** BUDUJEMY SAMI — żadnego third-party API generacji (Gamma/Canva) w produkcji. „Chcemy zabrać im klientów, nie im płacić."

**Stack 4-warstwowy:** L1 mózg (premium LLM) · L2 render (TipTap doc + recharts) · L3 export (Puppeteer/Playwright HTML→PDF/PNG + pptxgenjs + docx + exceljs) · L4 assety (AI images + stock fallback + charty).

**SSOT-y dokumentacyjne:**
- Spec produktowo-techniczny: `docs/product/DELIVERABLES_GENERATORS_SPEC.md`
- Tracker operacyjny (DASHBOARD): `Harvard/wdrozenie-100/DELIVERABLES-STAN-PRACY-ODBIORY.md`
- Rubryka jakości: `Harvard/wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md`
- Parametry graficzne: `Harvard/wdrozenie-100/DELIVERABLES_GRAPHIC_PARAMETERS.md`
- Runbook testów jakości: `docs/qa/deliverables/SELF_HEALING_RUNBOOK.md`

---

## 2. STRUKTURA FAL I CO ZBUDOWANO

Program podzielony na fale W1–W5, każda = seria sub-modułów. **24/24 sub-moduły GOTOWE code-side** (= kod + testy mock). Wszystko za flagą OFF.

| Fala | Seria | Sub-moduły | Co robi | Stan |
|---|---|---|---|---|
| **W1** Wspólne wejście | E | E1-E4 | unified launcher (typ→template→Teresa) | 🟢 code (FT 22/22) |
| **W2** Odchudzenie edytorów | R | R1-R5 | TipTap doc, inline-AI, recharts, deck Gamma-flow, table CF+AST | 🟢 code (FT 262/262) |
| **W3** Template engine | T | T1-T4 | unified template API + DBR77 seeds + CRUD + Teresa-suggests | 🟢 code (FT 80/80) |
| **W4** Mózg premium | B | B1-B5 | tier resolver + deck Layout Director + warianty + doc struktura + table schema | 🟢 code (FT 40/40) |
| **W5** Eksport + assety + spójność | X | X1-X6 | Playwright PNG + exceljs CF + chartjs + stock/ikony + entity-merge + transakcyjny registry | 🟢 code (FT 62/62) |

### Seria B (W4) — mózg generatywny — KLUCZOWA, bo to silnik jakości

| ID | Plik | Co | Commit |
|---|---|---|---|
| **B5** | `server/src/services/deliverableGenerationTier.ts` | `resolveDeliverableTier()` → PREMIUM gdy flaga ON, inaczej STANDARD (=dziś). Fail-open→STANDARD. Tag `DELIVERABLE_GENERATION_PURPOSE` dla telemetrii (cost-monitoring już płynie przez AIPipeline) | `ffdf2797c2` |
| **B1** | `server/src/services/presentationLayoutDirectorService.ts` | LLM wybiera layout z **17 SlideIntent** + paletę z **13 CURATED_COLOR_SETS** + image brief. Deterministyczny fallback. Quality-gate (layout∈catalog, paleta∈catalog). enforceSinglePalette + enforceNoTripleRun (≥8 distinct, no >2 consecutive identical) | `88c8eb9a54` |
| **B2** | `server/src/services/presentationLayoutVariantsService.ts` | `generateDeckVariants` (N=3 wariantów z DYSTYNKTNYMI paletami) + `remixDeckLayout` (regen wg instrukcji). Nadbudowane na B1 | `88f60fac85` |
| **B3** | `server/src/services/documentStudio/documentStructureGenerator.ts` | LLM dobiera TYPY bloków per sekcja (PLANNER struktury, NIE treść). 13 typów (`ALLOWED_BLOCK_TYPES`). Quality-gate: ≥1 blok bogaty poza heading/paragraph | `3712529838` + fix `9ee0cdce85` |
| **B4** | `server/src/services/tableSchemaGeneratorService.ts` | LLM → typowany schemat (singleSelect z hex, number/currency/date/...) + seed-rows ≥3 + **CF by-fieldKey** + **formuły** | `3ec8401a5e`+`5a71e473be`+`1faf2beaf4`+`349a9dd881` |

### Seria X (W5) — eksport/parytet/spójność

| ID | Plik | Co | Commit |
|---|---|---|---|
| **X1** | `server/src/services/playwrightPdfRenderer.ts` (`renderHtmlToPng`) | HTML→PNG przez Playwright (analog do renderHtmlToPdf, shared browser). viewport 1920×1080 | `6e68d9614f` |
| **X2** | `server/src/services/workbook/WorkbookBuilder.ts` + `WorkbookSchema.ts` | exceljs CF (dataBar/colorScale/iconSet/cellIs) → addConditionalFormatting. **FT-4 evidence-grade: parsuje .xlsx jako ZIP+XML, demaskuje fasadę SheetJS** | `ed7324f77c` |
| **X3** | `server/src/services/documentStudio/documentChartRasterizer.ts` | chartjs-node-canvas (BYŁ już zbudowany+wpięty w docx/pdf; dodano test w CI) | `a614ca7f55` |
| **X4** | `server/src/services/deliverables/stockImageProvider.ts` + `iconSuggestionService.ts` | Unsplash+Pexels+Null provider + chooser; ~40 reguł keyword→lucide | `1ec3b9713c` |
| **X5** | `server/src/services/deliverables/unifiedDocEntityService.ts` | most `work_canvas_drafts.artifact_id ↔ wave5_artifacts`; transakcyjny commit draft→artifact bez duplikatu | `14f29f8f1f` |
| **X6** | `server/src/services/v8/outputsTransactionalRegistry.ts` | transakcyjna rejestracja w M17 (BEGIN/COMMIT/ROLLBACK, idempotentna, race-safe). NIE modyfikuje żywej `registerArtifactOrigin` | `5825e2d7f6` |

### Content-gen layer (domknięcie warstwy treści doc) — 2026-06-22

| Plik | Co | Commit |
|---|---|---|
| `server/src/services/documentStudio/documentBlockContentGenerator.ts` | Wypełnia plan B3 TREŚCIĄ. Normalizery wymuszają parametry graficzne: KPI clamp 3-5, chart paleta≤7/serie≤6, callout tone∈{info,warning,danger,success}, table/list/quote. `generateDocumentContent()`: PREMIUM→LLM (1 call keyed-by-blockId)+normalize, STANDARD/fail→proza. Fail-open. **NIEWPIĘTE w `buildDocumentSchema`** (równolegle, opt-in) | `bbc1d3a08e` |

---

## 3. SYSTEM TESTÓW JAKOŚCI (90 scenariuszy) — to było główne zadanie sesji

Piotr poprosił o **30 wymagających testów × 3 moduły** (raporty/prezentacje/tabele) z precyzyjnymi kryteriami merytorycznymi i graficznymi + proces automatycznej pracy nad nimi.

### 3.1 90 scenariuszy — SSOT czytelny (markdown)
- `docs/qa/deliverables/scenarios/M19_DECKS.md` — 30 deck (Sml 5 / Med 10 / Lrg 10 / Xtr 5)
- `docs/qa/deliverables/scenarios/M18_REPORTS.md` — 30 doc
- `docs/qa/deliverables/scenarios/M20_TABLES.md` — 30 table

Każdy scenariusz = `intent` + kryteria **merytoryczne** (substantive) + **graficzne** (graphic), wszystkie autochecker-able. Tiery: Sml (proste) → Med → Lrg → Xtr (constraint/adversarial — np „0 użyć key_messages", „sprzeczne dane do pogodzenia").

### 3.2 Executable catalog (TS)
- `tests/integration/deliverables/catalog/{decks,reports,tables}.ts` — 30+30+30 wpisów `{meta, criteria, mockPass}`
- `catalog/builders.ts` — kompaktowe konstruktory mock-artifactów (bez 90× boilerplate)
- `catalog/catalogTypes.ts` — typy wpisów

**`mockPass`** = artefakt KNOWN-GOOD który MUSI scorować 100% dla swoich criteria.

### 3.3 Scoring engine (pure functions)
- `tests/integration/deliverables/scoring/scoringTypes.ts` — `ReportBuilder` DSL + `ScoreReport{passed, failures[], selfHealHints[], scorePct}`
- `scoring/deckScoring.ts` — paleta dyscyplina, no-triple-run, ≥8 distinct, imageBriefs, all-llm
- `scoring/docScoring.ts` — typy bloków, KPI 3-5 items, chart clamp ≤7, distinct types, styled cells
- `scoring/tableScoring.ts` — typed fields, select-colors, CF rules, formuły, traffic-light semantic

### 3.4 Runnery (vitest, mock-mode)
| Plik | Co testuje | Stan |
|---|---|---|
| `fullCatalog.test.ts` | 90 mock-pass scorują 100% + 3 sanity-degradacji (scoring WYKRYWA regresję) | ✅ |
| `scenarioRunner.test.ts` | 9 pilotów przez prawdziwe generatory (mock-LLM) | ✅ |
| `deckGeneratorE2E.test.ts` | 30 decków przez **prawdziwy** `planDeckLayout` — post-proc nie degraduje | ✅ 30/30 |
| `docGeneratorE2E.test.ts` | 30 doc przez prawdziwy `planDocumentStructure` — warstwa strukturalna | ✅ 30/30 |
| `docContentGenE2E.test.ts` | pełny łańcuch B3→content-gen→scoring PEŁNYCH kryteriów | ✅ 30/30 |
| `tableGeneratorE2E.test.ts` | przez prawdziwy `generateTableSchema` + mapa reachable/need-extension | ✅ 29/30 |

### 3.5 Auto-heal Workflow (proces automatycznej pracy)
- `scripts/deliverables/self-heal-workflow.js` — Workflow: per scenariusz Run→Score→ jeśli ❌ Heal (Agent fixuje kod)→re-run; MAX_ATTEMPTS=3; tryby mock/live; args `{module, tier}`
- `docs/qa/deliverables/SELF_HEALING_RUNBOOK.md` — pełna instrukcja + cost estimate ($0.10 dla 5 Sml → $30-100 full 90 z self-heal) + mapowanie na FT-6

### 3.6 Mapa zdolności generatorów (zmierzona przez harness, mock-mode)
| Generator | Reachable | Gap |
|---|---|---|
| **B1** deck | **30/30** | — |
| **B3+content-gen** doc | **30/30 end-to-end** (struktura+treść) | — |
| **B4** table | **29/30** | M20.S26 multi-sheet = osobna domena `WorkbookGeneratorService` (nie single-table B4) |

---

## 4. CO HARNESS WYKRYŁ I CO NAPRAWIONO (pętla test→gap→fix)

To była praca napędzana przez testy — harness znajdował luki, agent zamykał:

1. **B4 zwracał tylko {fields, seedRows}** — 13/30 table-scenariuszy (CF/formuły/multi-sheet) było poza zasięgiem.
   → **B4-ext CF** (`1faf2beaf4`): LLM podaje `{fieldKey, rule}`, B4 resolwuje fieldKey→litera kolumny→A1-ref. dataBar/colorScale/iconSet/cellIs, tylko CF-eligible pola. **reachable 17→24.**
   → **B4-ext formuły** (`349a9dd881`): prompt zachęca + `hasFormulas` flaga (seedRows „=..." przepuszczane). **reachable 24→29.**

2. **B3 quality-gate `distinctTypes > 1` fałszywie odrzucał dokumenty jednotypowe** (KPI-only one-pager, bullet-only streszczenie, single-table compliance) → spadały do prozy, typowany blok ginął. To **bug który dotknąłby realnych klientów.**
   → **B3 fix** (`9ee0cdce85`): gate = ≥1 blok bogaty (poza heading/paragraph). Doc struktura 30/30.

3. **B3 to PLANNER struktury, NIE treść** — 21/30 doc-scenariuszy content-level (KPI items, chart series, citations) było poza zasięgiem.
   → **content-gen layer** (`bbc1d3a08e`): `documentBlockContentGenerator` wypełnia plan B3 treścią z normalizerami. Doc 30/30 end-to-end.

4. **Self-bug w scoringu** (matching „To Do" vs „todo" przez whitespace) — wykryty przez pierwszy pilot, naprawiony (normalize: lowercase + strip whitespace/dash/underscore).

---

## 5. CZEGO NIE ZROBIONO (uczciwa lista — to jest „reszta wdrożenia")

### 5.1 Wymaga DECYZJI Piotra (bramki Q — bez nich FT-6/FT-5/FT-7 stoją)
- **Q1** — próg jakości FT-6: jak liczbowo mierzymy „poziom Gammy"? (propozycja w rubryce: pokrycie sekcji, dobór layoutu, czytelność, brand-zgodność)
- **Q2** — próg parytetu FT-5 (pixel-diff %): propozycja <2% na golden-set
- **Q3** — zestaw **golden-promptów** (3-5 REALNYCH tematów DBR77) — Piotr wskazuje tematy testowe. **To jest blocker FT-6** — bez realnych tematów nie ma head-to-head vs Gamma.
- **Q4** — demo-org do pilota flagi (telemetria kosztu premium) — KTÓRY org-id na staging (NIE prod centerbeam)
- **Q5** — stock images provider (Unsplash vs Pexels) — klucz API + licencja

### 5.2 Wymaga DEPLOYA na staging
- **FT-7 manual** (0/N wszędzie) — człowiek/agent przez przeglądarkę + screenshoty per sub-moduł
- **FT-6 live** — uruchomienie 90 scenariuszy w trybie LIVE (prawdziwy LLM) — DOPIERO to mierzy faktyczną jakość treści
- **→UI / →F** — odbiory wizualne i funkcjonalne Piotra

### 5.3 Pozostałe kawałki kodu
- **Wpięcie content-gen w żywy `buildDocumentSchema`** — kod GOTOWY i przetestowany (30/30 mock). Komentarz `// B3 ready` w `documentContentGenerator.ts:185`. Wystarczy przełączyć `buildSectionBlocks` → łańcuch premium. **ALE zmienia co dostają klienci → opt-in per-org, decyzja Piotra.**
- **Multi-sheet (M20.S26)** — domena `server/src/services/workbook/WorkbookGeneratorService.ts` (istnieje), nie single-table B4.
- **Wpięcie B1/B2/X1-X5 w żywe ścieżki** — osobny krok per moduł, flaga per-org, klienci OFF first.

---

## 6. JAK URUCHOMIĆ (dla następnego agenta)

```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify

# Cały pakiet deliverables (226 testów, ~2s)
npx vitest run tests/unit/deliverables/ tests/integration/deliverables/

# Tylko 90-scenariuszowy catalog
npx vitest run tests/integration/deliverables/fullCatalog.test.ts

# E2E przez prawdziwe generatory (mock-LLM)
npx vitest run tests/integration/deliverables/deckGeneratorE2E.test.ts
npx vitest run tests/integration/deliverables/docContentGenE2E.test.ts
npx vitest run tests/integration/deliverables/tableGeneratorE2E.test.ts

# tsc check pojedynczego serwisu (cały tsc projektu ma pre-existujące błędy nie z tego programu)
npx tsc --noEmit server/src/services/tableSchemaGeneratorService.ts 2>&1 | grep "tableSchemaGenerator"
```

**WAŻNE gotcha:** `tests/` jest w `.gitignore` (linia 209). Commitując NOWE testy używaj `git add -f tests/...`. Istniejące śledzone testy commitują się normalnie.

### Tryb LIVE (gdy Piotr odblokuje Q1/Q3/Q4)
```javascript
// Z Claude Code, narzędzie Workflow:
Workflow({
  scriptPath: 'scripts/deliverables/self-heal-workflow.js',
  args: { mode: 'live', module: 'decks', tier: 'Sml' }  // zacznij MAŁO: 5 testów, ~$0.5
})
```
Pre-req: `ENABLE_DELIVERABLES_PREMIUM=1` w env staging + `ANTHROPIC_API_KEY` + org-id z Q4.

---

## 7. MAPA KLUCZOWYCH PLIKÓW

```
KOD GENERATORÓW (wszystko za flagą OFF, niewpięte):
  server/src/services/deliverableGenerationTier.ts          # B5 tier resolver
  server/src/services/presentationLayoutDirectorService.ts  # B1 deck layout
  server/src/services/presentationLayoutVariantsService.ts  # B2 deck warianty/remix
  server/src/services/documentStudio/documentStructureGenerator.ts      # B3 struktura
  server/src/services/documentStudio/documentBlockContentGenerator.ts   # content-gen treść
  server/src/services/documentStudio/documentChartRasterizer.ts         # X3 chartjs
  server/src/services/tableSchemaGeneratorService.ts        # B4 table + CF + formuły
  server/src/services/workbook/WorkbookBuilder.ts + WorkbookSchema.ts   # X2 exceljs CF
  server/src/services/playwrightPdfRenderer.ts              # X1 HTML→PDF/PNG
  server/src/services/deliverables/stockImageProvider.ts    # X4 stock
  server/src/services/deliverables/iconSuggestionService.ts # X4 ikony
  server/src/services/deliverables/unifiedDocEntityService.ts  # X5 entity merge
  server/src/services/v8/outputsTransactionalRegistry.ts    # X6 registry

PUNKT WPIĘCIA (gdy aktywujesz premium doc):
  server/src/services/documentStudio/documentContentGenerator.ts:185  # // B3 ready

TESTY:
  tests/unit/deliverables/                  # 19 plików unit
  tests/integration/deliverables/           # runnery + e2e
  tests/integration/deliverables/scoring/   # scoring engine
  tests/integration/deliverables/catalog/   # 90 scenariuszy jako TS

SCENARIUSZE (czytelne):
  docs/qa/deliverables/scenarios/M{18,19,20}_*.md
  docs/qa/deliverables/SELF_HEALING_RUNBOOK.md
  scripts/deliverables/self-heal-workflow.js

DOKUMENTY STERUJĄCE:
  Harvard/wdrozenie-100/DELIVERABLES-STAN-PRACY-ODBIORY.md  # DASHBOARD (główny)
  Harvard/wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md
  Harvard/wdrozenie-100/DELIVERABLES_GRAPHIC_PARAMETERS.md
  docs/product/DELIVERABLES_GENERATORS_SPEC.md
```

### Katalogi (do czego LLM ma się ograniczać)
- **17 SlideIntent** (deck layouty): w `presentationLayoutDirectorService.ts:37` (`LAYOUT_INTENT_CATALOG`)
- **13 palet** (deck): `CURATED_COLOR_SETS` w `src/components/Presentations/wizard/types.ts:285` (FE-side)
- **13 typów bloków doc**: `ALLOWED_BLOCK_TYPES` w `documentStructureGenerator.ts:26`
- **13 typów pól table**: `GENERATABLE_FIELD_TYPES` w `tableSchemaGeneratorService.ts`

---

## 8. PUŁAPKI / LANDMINY dla następnego agenta

1. **`tests/` w .gitignore** → `git add -f` dla nowych testów.
2. **CI uruchamia tylko `tests/{unit,integration,components}`** — testy pod `server/src/**/__tests__` NIGDY nie polecą w CI (był tak „ukryty" test X3, dlatego dodano kopię w `tests/unit/`).
3. **Pełny `npx tsc --noEmit` ma pre-existujące błędy** spoza tego programu (ExcelJS default import TS1192, winston, Set iteration itd.). Sprawdzaj tsc per-plik i grepuj po nazwie swojego pliku.
4. **zod v4** — `z.record()` wymaga 2 argumentów: `z.record(z.string(), z.unknown())` (nie `z.record(z.unknown())`).
5. **Mock-mode ≠ jakość.** Wszystkie zielone testy używają mock-LLM zwracającego dane podane przez agenta. To NIE dowodzi jakości żywej generacji. Nie raportuj „jakość potwierdzona".
6. **B3 ≠ treść.** B3 to planner typów bloków. Treść robi `documentBlockContentGenerator`. Łańcuch: outline → B3 (struktura) → content-gen (treść) → DocumentArtifact.
7. **Git races realne** — inny agent pracuje na repo. Weryfikuj `git log` / HEAD przed założeniem stanu.
8. **Prod caution** — patrz §0.2.
9. **Dashboard może wyglądać „pusto"** (Manual 0/N, UI/→F ⬜) — to PRAWDA, nie błąd. Te bramki wymagają deploya + człowieka. NIE „dorysowuj" zieleni której nie ma.

---

## 9. REKOMENDOWANY NASTĘPNY KROK (od czego zacząć)

Sesja zakończyła się **pytaniem do Piotra** (AskUserQuestion — nie dokończone z powodu limitu tokenów). Pytanie brzmiało: co odblokowujemy, żeby ruszyć z realnym testowaniem PRODUKTU (nie kodu). Opcje:

1. **Live LLM — pilot 9 scenariuszy** (3 sml/med/lrg per moduł) — odpalić generatory na prawdziwym LLM i pokazać faktyczne wyniki + ocenę. Wymaga: klucz API na staging, zgoda na ~$0.5-2, potwierdzenie konfiguracji modelu. **← najszybciej weryfikuje czy jakość dorównuje Gammie.**
2. **Deploy na staging + manual** — wdrożenie za flagą na demo-org, manualny przegląd przez przeglądarkę + screenshoty (FT-7 + UI).
3. **Najpierw popraw dashboard** — żeby uczciwie pokazywał: kod ✅ vs live/manual/UI ❌.
4. **Wyjaśnij FT-6 i golden-prompty** — Piotr chce zrozumieć Q1/Q3 zanim coś odpali.

**Najsensowniej:** zacząć od (1) lub (4) — bo FT-6 (jakość na żywym LLM) jest najważniejszą niezweryfikowaną rzeczą w całym programie. Wszystko inne (deploy, manual, UI) ma sens dopiero gdy wiemy, że generacja jest dobra.

### Czego next agent NIE powinien robić autonomicznie
- Wpinać premium w żywy pipeline klientów (zmienia UX — decyzja Piotra per-org).
- Deployować na prod.
- Raportować „jakość potwierdzona" na podstawie mock-testów.

---

## 10. STAN GIT

- **Branch:** `feat/deliverables-w1` (ahead origin — niepushowane lokalne commity)
- **Ostatnie commity programu** (od najnowszego):
  - `69446ee62c` docs tracker — content-gen GOTOWY, doc 30/30
  - `bbc1d3a08e` content-gen layer
  - `9ee0cdce85` B3 fix + doc E2E
  - `349a9dd881` B4 formuły
  - `1faf2beaf4` B4 CF
  - `57ed51c942` E2E guardy B1+B4
  - `c3b90dbe71` executable catalog 90
  - `e220a10947` 90 scenariuszy + scoring + workflow
  - `cebb380607` W5 6/6 (program 24/24 code-side)
- **Uncommitted (NIE z tego programu, zostaw):** package-lock.json, scripts/deploy-demo.sh, kilka untracked .tsx/spec — to inny agent / inne wątki.
- **Pamięć projektu zaktualizowana:** `project_deliverables_generators.md` ma pełną historię W1-W5 + harness + B4-ext + B3-fix + content-gen.

---

## 11. TL;DR (jedno zdanie)

Zbudowano CAŁY kod 4 generatorów deliverable (24/24 sub-moduły, za flagą OFF) + kompletny system 90 testów jakości + rozszerzono B4 (CF+formuły) i B3 (jednotypowe doc) i dobudowano content-gen layer — **226 testów mock zielonych**; ale **żaden generator nie był odpalony na żywym LLM ani sprawdzony manualnie/wizualnie** — to czeka na decyzje Piotra (Q1/Q3/Q4: próg jakości + golden-prompty DBR77 + demo-org) i deploy na staging, bo dopiero LIVE mode mierzy faktyczną jakość vs Gamma/Kimi/Airtable.

---
*Koniec raportu. Plik: `Harvard/Harvard doc.md`. Powiązana pamięć: `project_deliverables_generators.md`.*
