# Content Gap Register — `vsm-builder` (VSM Builder / Kreator VSM)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`. Zero domysłów — każdy fakt ma ścieżkę+linię.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/559_tools_known_tools_library.sql:424-466` (migracja **aktywna**, nie `never-ran/`) — pełny 9‑polowy JSON `library_content_translations` EN+PL: `shortDescription, whenToUse, whatYouGet[3], inputs[4], steps[5], outputs[3], commonMistakes[3], example, nextSteps[2]`. Cytat `example` (PL): *"Redukcja handoffów przez łączenie kroków + limity WIP + standard work."* — to jest **wymyślona ilustracja**, nie dane klienta. [REPO_CANON]
- Ten sam plik, `server/migrations/559_tools_known_tools_library.sql:582,1109-1167` — artykuł KB `kb-art-tools-vsm-builder` (slug `tools-vsm-builder-how-to`), status literału `published`, EN+PL, sekcje `Purpose/when to use → Inputs → Steps(4) → Common mistakes(2) → Next steps` (~90 słów/język). To jest ogólny przepis, nie metodyka VSM (brak notacji ikon VSM, brak wzoru na lead time, brak definicji VA/NVA poza nazwą). [REPO_CANON]
- **KRYTYCZNE — ten content jest martwy z perspektywy API**, niezależnie od tego czy fizycznie trafił do bazy:
  - `server/src/services/KnownToolsService.ts:205-228` — `ACTIVE_KNOWN_TOOL_TYPES` (hardcoded allowlist 19 toolType) **nie zawiera** `vsm-builder`.
  - `server/src/services/KnownToolsService.ts:770-776` — `isKnownToolActive()` = `rowIsActive && ACTIVE_KNOWN_TOOL_TYPES.has(toolType)` → zawsze `false` dla `vsm-builder`.
  - `server/src/services/KnownToolsService.ts:900-902` — `getKnownTool()` (endpoint szczegółu narzędzia) zwraca `null`, gdy `!isActive`. Endpoint detail **nigdy nie odda** `whenToUse/steps/outputs/example` niezależnie od stanu kolumny.
  - `server/src/services/KnownToolsService.ts:424-437` (`SQLITE_KNOWN_TOOLS_SEED`) — wpis dla `vsm-builder` z `isComingSoon: true` (linia 436) i **skróconym** `whatYouGetEn: ['Current-state map', 'Waste hotspots', 'Future-state actions']`.
  - `server/src/services/KnownToolsService.ts:707-768` (`ensureToolsSeedOnce`) — przy **każdym starcie procesu** wykonuje `INSERT ... ON CONFLICT (name) DO UPDATE SET library_content_translations = EXCLUDED.library_content_translations, is_coming_soon = EXCLUDED.is_coming_soon` z powyższego seeda, komentarz w kodzie (linie 713-717) mówi wprost, że to celowe nadpisanie "to propagate corrections... to existing production DBs". Efekt: kolumna `library_content_translations` w bazie jest sprowadzana z powrotem do `{"whatYouGet":[3 punkty]}` — bogatsze pola z migracji 559 są kasowane niezależnie od tego, czy migracja 559 kiedykolwiek się wykonała.
  - Niezależne potwierdzenie: `tests/components/Discovery/DiscoveryToolsHub.inactiveTools.test.tsx` (test RV‑028, importuje `ACTIVE_KNOWN_TOOL_TYPES` z żywego kodu, nie mock) asercja: brak działającego Open/Start, brak zamontowanego workflow dla `vsm-builder` i pozostałych 11 toolType z tej listy.
- **Wniosek**: to, co realnie widzi użytkownik w Library, to najwyżej karta „Coming soon" z 3‑punktowym `whatYouGet` z `KnownToolsService.ts:431-432`. Bogatszy opis w migracji 559 istnieje jako plik w repo (REPO_CANON), ale nie jest osiągalny przez żaden endpoint — traktuj go jako martwy content, nie jako „gotowy opis do rozbudowy o metodykę".

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:437-451` (§3.11) — **cienki** wizard plan: `Goal/Inputs/Preview graphic/Micro-video/KB: TBD` + 2‑liniowy „Wizard plan" (`Work surface: workspace-first (VSM canvas) + table for steps/data box`, `Outputs: initiative package + report`). Brak Define/Inputs & assumptions/Review/Finalize — sekcji, które MA 6 innych narzędzi Wave 3 (zob. `logistics-automation` itd.). [REPO_CANON]
- `docs/product/CONSULTING_TOOLS_STANDARD_ROLLOUT_V1.md:76-99` — `vsm-builder` w Wave 3, wymóg migracji: "adapt standard flow to table/hybrid/automation surfaces... preserve canonical output and KB linkage model" — nieukończone (brak `src/config/vsmbuilder`).

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:127,281-287` — `vsm-builder` w `PLANNED_TOOL_IDS`; `buildPlannedToolManifest()` (`discoveryToolManifestMapper.ts:47-58`) ustawia `status:'planned', configDir:null, steps:[], sources:[], outputs:[]` — brak zgadywania w samym kodzie (komentarz w pliku to potwierdza).
- `src/store/useToolStore.ts:2737,2034-2107` — krok flow = `TOOLSET_OPERATIONAL_STEPS` (8 generycznych kroków: `context/fill/impact-hypothesis/results/reasoning/prepare/report/initiatives`), identyczne dla wszystkich narzędzi operacyjnych Wave 3 — **żadnego** kroku specyficznego dla VSM (np. „zmapuj current state", „policz lead time", „zaprojektuj future state").
- `src/hooks/discovery/toolAi/systemPrompts.ts:157-163,194` — AI system prompt = generyczny `OPERATIONAL_SYSTEM_PROMPT` (dzielony też przez `sop-builder`, `a3-problem-solving` — narzędzia JUŻ zbudowane), bez wzmianki o VA/NVA, lead time, ikonografii VSM, current/future state.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:13` — `vsm-builder` JEST w `DEDICATED_TOOL_TYPES` → dostaje realny `ToolDocumentView/ToolCanvas` (nie pusty ekran), ale to tylko powłoka renderująca generyczne kroki z 1.3 wyżej, nie logikę metody.
- Brak katalogu `src/config/vsmbuilder/` (nie istnieje — potwierdzone przez komentarz w `discoveryToolsRegistry.ts:11-13` i przez `find`).

### 1.4 Knowledge base (RAG-owalna)

- `knowledge/tool-kb/` — **zero** katalogu `vsm-builder` (istnieją tylko `drd`, `siri`, `adma`, `dynamic-swot`, `kpi`). Brak `methodology/qbank/initiatives/benchmarks/help/assets` packs wg standardu z `knowledge/tool-kb/README.md`. [EVIDENCE_MISSING]

### 1.5 Znaleziony, ale mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` (status: Draft), §3.2 — klasyfikuje `vsm-builder` jako brakujące WYŁĄCZNIE `GFX, VID` (grafika + wideo), twierdząc że Library+KB są "kompletne tekstowo" (§2.1-2.2: "0 narzędzi brakujących w Known Tools registry"). **To twierdzenie nie bierze pod uwagę mechanizmu z §1.1** (`ACTIVE_KNOWN_TOOL_TYPES` gate + `ensureToolsSeedOnce` nadpisanie) — dokument jest nieaktualny/mylący, nie dowód gotowości. [EVIDENCE_MISSING] co do stanu faktycznego bazy live.

---

## 2. Czego brakuje

- **Silnik/logika metody**: brak jakiegokolwiek pytania, reguły klasyfikacji czy struktury danych specyficznej dla VSM (brak: lista symboli/ikon VSM, wzór lead time = suma czasów VA+NVA+kolejek, reguła rozróżnienia VA/NVA, logika current-state → future-state, reguła priorytetyzacji kaizen burst).
- **Bank pytań (qbank)**: zero. Narzędzia zbudowane (np. `smed-planner`) mają `SMED_DEEPENING_LADDER` w `src/config/smedplanner/deepeningLadder.ts` — `vsm-builder` nie ma odpowiednika.
- **Geometria/notacja diagramu**: brak jakiejkolwiek definicji układu boxów procesu, trójkątów zapasów, strzałek push/pull, linii czasu (typowa notacja VSM z Rother & Shook) — `ToolCanvas.tsx` renderuje generyczny układ, nie VSM-specific canvas.
- **Reguły oceny/scoringu**: brak progów ("wysoki lead time" = ile dni?), brak wzorca danych wejściowych (format czasu cyklu, format wolumenu).
- **Asset**: brak preview graphic i micro-wideo (potwierdzone też przez `KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md`).

---

## 3. Czy istnieje wiarygodne źródło

**Tak — dobrze udokumentowany, publiczny framework.** Value Stream Mapping pochodzi z Lean Manufacturing / Toyota Production System, skodyfikowany kanonicznie w Mike Rother & John Shook, *"Learning to See"* (Lean Enterprise Institute, 1998/1999) — ustandaryzowana notacja ikon, metoda liczenia lead time, sekwencja current‑state → future‑state → plan wdrożenia. To metoda ucząca się od dekad w programach Lean Six Sigma na całym świecie. [AUTHORITATIVE_EXTERNAL_SOURCE — istnieje w zasadzie, ale **nic z tego źródła nie jest dziś w repo**: żaden plik nie cytuje Rother & Shook, żadna notacja ikon nie jest zaimplementowana.]

---

## 4. Czego NIE WOLNO wygenerować

- Konkretnych progów liczbowych „co to jest wysoki lead time" bez danych klienta (np. „>5 dni = problem") — to zależy od branży.
- Gotowych wag/formuł scoringu waste bez wskazania źródła.
- Fabrykowanych case studies z liczbami (istniejący `example` w Library copy — *"Redukcja handoffów przez łączenie kroków + limity WIP + standard work"* — jest już ilustracyjny/wymyślony; nie wolno traktować go jako benchmark ani go rozszerzać o wymyślone %/dni).
- Twierdzeń, że Consultify ma licencję/partnerstwo z Lean Enterprise Institute lub innym wydawcą metody VSM — nie ma na to dowodu w repo.
- Diagramu VSM z konkretnymi ikonami skopiowanymi 1:1 z podręcznika bez potwierdzenia praw (notacja jako koncept jest powszechna, ale konkretne grafiki/szablony bywają objęte prawami wydawcy).

---

## 5. Minimalny Pack do authoringu

Wg `knowledge/tool-kb/README.md` (minimum recommended baseline = `methodology` lub `qbank` + `help`):

1. **`methodology/v1`**: definicja VSM (cel/kiedy używać/kiedy NIE używać), cytowanie Rother & Shook jako źródła, definicja VA/NVA, wzór lead time, sekwencja current→future→plan, 3-5 anti-patterns.
2. **`qbank/v1`**: pytania per etap (mapowanie kroków, zbieranie czasów, identyfikacja waste, projektowanie future state) — z przykładami mocnej/słabej odpowiedzi.
3. **`help/v1`**: rozbudowanie istniejącego stubu KB (`559:1109-1167`) do kanonicznych 4 bloków (Cel/Proces/Rezultat/Przykład) wg `knowledge/tool-kb/README.md` — z jednym realnym, zatwierdzonym przez Piotra przykładem (nie wymyślonym przez AI).
4. **Jawna adnotacja braku benchmarków**: żadnych liczb bez źródła.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Nawet mając solidne źródło zewnętrzne (Rother & Shook), operacjonalizacja VSM w narzędzie krok-po-kroku (jakie pytania, jaka notacja canvas, jakie progi klasyfikacji waste) wymaga osoby znającej Lean/Operational Excellence w praktyce — błędna interpretacja VA/NVA albo lead time jest częstym błędem u niepraktyków. [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**Częściowo TAK.** Sama koncepcja VSM (idea current-state/future-state mapowania) nie jest chroniona, ale konkretne diagramy/szablony/ikony z podręczników LEI bywają. Jeśli authoring będzie kopiował konkretne grafiki/przykłady z zewnętrznych źródeł (nie tylko ideę), wymagany check prawny pod kątem cytowania/licencji. [LEGAL_REVIEW_REQUIRED — warunkowo, zależnie od tego, czy authoring sięgnie po konkretne materiały zewnętrzne 1:1]

---

## 8. Provenance tags — legenda zastosowana wyżej

`REPO_CANON` (plik/linia istnieje w repo) · `ENGINE_DERIVED` (nie dotyczy — brak silnika) · `AUTHORITATIVE_EXTERNAL_SOURCE` (VSM/Rother&Shook — istnieje w zasadzie, nic w repo) · `EDITORIAL_DRAFT` (Library copy + KB stub — pisane bez cytowania źródła) · `LEGAL_REVIEW_REQUIRED` · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (dokładny stan bazy live nie zweryfikowany zapytaniem SQL w tej sesji).
