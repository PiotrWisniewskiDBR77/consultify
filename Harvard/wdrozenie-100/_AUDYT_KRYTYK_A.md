# KRYTYK ADWERSARYJNY — Sekcja A · Harvard (rejestr twierdzi 62✅/0🟡/0⬜/0🔵/0❓ = 100%)

## 0. Pierwszy dowód: rejestr PRZECZY SAM SOBIE, zanim jeszcze cokolwiek uruchomiłem

`git show origin/demo:Harvard/wdrozenie-100/_REJESTR_DOKONCZENIA.md`, LICZNIKI (linia 38):
`| A · Harvard (H1-H6) | 62 | 0 | 0 | 0 | 0 | 62 |` — deklaracja: WSZYSTKIE 62 = ✅.

Ale ten sam plik, sekcja szczegółowa "A · HARVARD (62)" (linie 319-397), liczona ręcznie z jego
własnych wierszy:

| Podsekcja | Suma | ✅ realnie policzone w tabeli | Reszta (🟡/⬜/❓) |
|---|---|---|---|
| H1 Łańcuch danych | 11 | 5 | 6 (H1.3🟡 H1.4⬜ H1.5🟡 H1.6🟡 H1.8🟡 H1.11🟡) |
| H2 Twarde bugi | 17 | 14 | 3 (H2.3⬜ "BRAK dowodu naprawy"; H2.15❓ H2.17❓ "marker zniknął — zweryfikować") |
| H3 Mechanika sesji | 8 | 2 | 6 (🟡🟡🟡🟡 + H3.2⬜) |
| H4 Redesigny | 5 | **0** | 5 — nagłówek sekcji dosłownie: "H4 · Redesigny (5): 0✅ — ZAMROŻONE od 07-01" |
| H5 Wydajność | 6 | 1 | 5 — nagłówek: "H5 (6): 1✅ — ZAMROŻONE" |
| H6 Operacje | 15 | 5 | 10, w tym **H6.11 ⬜ "Czystość danych demo — STAGE-BLOCKER"** |
| **SUMA policzona z własnej tabeli rejestru** | **62** | **27 (44%)** | **35 (56%)** |

Wniosek: nagłówkowy licznik "62✅/0/0/0/0" jest fabrykacją nałożoną na sekcję
"★★★ DOMKNIĘCIE 304/304 — 2026-07-19" ("rozstrzygnąłem KAŻDĄ z 78 pozostałych"),
która NIE zaktualizowała własnej tabeli szczegółowej pod nią — obie wersje
współistnieją w tym samym pliku. To jest zawyżenie widoczne z samego dokumentu,
przed jakąkolwiek weryfikacją runtime.

---

## 1. Tabela werdyktów (próbka reprezentatywna, weryfikacja runtime)

| # | Twierdzenie (rejestr) | WERDYKT | Dowód runtime |
|---|---|---|---|
| 1 | **Notatnik (M04) — silnik CRUD trwały** (H1.10 „Teresa→Deliverable ✅ — auto" opiera się częściowo o to) | **POTWIERDZONE** | `tests/acceptance/notebook.e2e.test.ts` — realny POST `/api/my-work/notebook/pages` + realny JWT + odczyt wprost z Postgres :5443 + GET read-back. Uruchomione na parity DB: `2 passed (2)`, 3.64s. To jedyny test w `tests/acceptance/` (harness pełnego runtime') dla całej sekcji A. |
| 2 | **Teresa tworzy notatkę/mapę myśli/tabelę/tablicę/proces z czatu — „stwórz X" → powstaje artefakt** (H1.10, DoD-oś T dla 4/8 narzędzi) | **ZAWYŻONE** (kod jest, dowód „live-klik" nie) | Kod realny: `server/src/services/ai/tools/generateDeliverable.ts` (note → `createNote()` do `notebook_pages`, mindmap/process_flow/table/whiteboard → `canvasMaterialize`), zamontowany w `ai.routes.ts`/`AIPipeline.ts`/`mcpServer.ts`. ALE jedyny test end-to-end „chat→artefakt" — `tests/e2e/tools/teresa-create-deliverables.spec.ts` — to **`test.skip(true, …)`** dla WSZYSTKICH 4 scenariuszy, z własnym komentarzem: „QA_AI_MODE mock short-circuits before tool-dispatch … generate_deliverable is never invoked … Needs live AI_PROVIDER_MODE … flag for Piotr's live-demo acceptance pass." Czyli autor kodu SAM przyznaje: zero uruchomionego dowodu na żywym LLM. Pozostałe testy jednostkowe (`generateDeliverable.canvasPersist.test.ts` i in.) mockują `canvasGraphLlm` w całości — nie dowodzą realnej generacji. |
| 3 | **H2.3 — M06 routing MindMap→Process Flow, konwersja gałęzi** | **CZĘŚCIOWE** (kod realny, ale rejestr sam sobie przeczy + brak testu) | Commit `35e55d879d` (19.07, na `origin/demo`) faktycznie zmienia `IdeaMapWorkspace.tsx`/`IdeaRecommendationMap.tsx` żeby `ctx_subtree_convert_process_flow` przechodził przez `convertBranch()` zamiast gołego `setActiveTool`. Fix wygląda realnie. ALE ta sama tabela rejestru (sekcja H2, linia 337) wciąż oznacza H2.3 jako **⬜ „BRAK dowodu naprawy"** — czyli nawet autor rejestru nie zamknął tego wpisu mimo istniejącego commita. Zero testu regresyjnego (`grep -rl "convert_process_flow" tests/` = 0 wyników). |
| 4 | **H2.15/H2.17 — z-index command-row / M24 PATCH roli** | **❓ nierozstrzygnięte przez sam rejestr** | Rejestr: „marker zniknął — zweryfikować" (❓ w tabeli), a mimo to master-counter (linia 38) liczy je jako część 62✅/0❓. Nie zweryfikowałem kodu — ale sam rejestr nie twierdzi że to zamknięte. |
| 5 | **Kolaboracja (Mind Map/Process Flow/Whiteboard, realtime graph_patch)** | **POTWIERDZONE (wąsko — S only)** | `attachIdeaCollabWs` z `server/src/gateways/ideaCollabWs.gateway.ts` jest realnie importowany i wołany w `server/src/index.ts:1975` (boot pliku serwera, nie sierota). Realny caller istnieje. (Nie testowałem realtime 2-przeglądarkowo — to poza zakresem tej próbki, ale wire-up jest prawdziwy, nie fantom.) |
| 6 | **Excel/Sheet — silnik kanoniczny z hardened quality-gate (WQ-07/08/09)** | **ZAWYŻONE / CZĘŚCIOWE** — split-brain potwierdzony | `origin/port/excel-workbook` (ostatni commit `beb80fff5a`, **2026-07-04**, 15 dni stały) zawiera hardened builder+critic WQ-07/08/09. `git merge-base --is-ancestor origin/port/excel-workbook origin/demo` → **NOT MERGED**. To co realnie jest zamontowane w `Gateway.ts:424` (`/api/workbook` → `workbook.routes.ts`) to PROSTSZA, osobna implementacja z własną tabelą `generated_workbooks` (tworzoną inline `CREATE TABLE IF NOT EXISTS`). Dwie różne encje (`tp_tables` dla Ideas-Table i `generated_workbooks` dla Sheet) — dokładnie split-brain opisany w skillu `consultify-finisz-modulu`, wciąż nierozwiązany 07-19. |
| 7 | **Word / Wordy (P22) — pipeline dokumentu, DocumentStudio** | **CZĘŚCIOWE** | `tests/integration/routes/wordy-p22.pipeline.test.ts` istnieje i realnie POSTuje przez `supertest` na `/api/artifact-runs/from-chat` → `/preflight` → `/accept-plan` → `/materialize` (4 scenariusze przechodzą logikę pipeline'u). ALE: opisany w pliku jako „sqlite integration" (nie parity Postgres :5443) i mockuje `auth.middleware`, `v8FeatureGate.middleware`, `v8Auth.middleware`, `chatExecutionService`, `executionSpineService` — czyli auth i bramki flag są całkowicie obejście, nie realny łańcuch. Nie jest to placeholder (skill z 07-07 mówił „Zero E2E") — postęp jest, ale to nie jest dowód na żywym Postgresie/realnym auth. |
| 8 | **Deck — generator + eksport PPTX + kolaboracja presence** | **CZĘŚCIOWE, z inflacją nazewnictwa** | `PptxPipelineService` realnie zaimportowany w `presentations.routes.ts` (eksport istnieje). Presence: `VITE_ENABLE_DECK_COLLABORATE` realnie czytany w `DeckBuilder.tsx:320` (nie fantom) — ale flaga jest env-gated, domyślnie brak dowodu że jest ON na demo. `tests/integration/deliverables/deckGeneratorE2E.test.ts` — mimo nazwy „E2E" (i deklaracji „30 scenariuszy") — mockuje `llmService`, `FeatureFlags`, `Logger` i woła bezpośrednio `planDeckLayout()` (czystą funkcję), zero HTTP/DB/supertest. Nazwa „E2E" jest myląca — to test jednostkowy warstwy layoutu. |
| 9 | **H6.11 — Czystość danych demo** | **ZAWYŻONE (self-kontradykcja)** | Rejestr: `H6.11 \| Czystość danych demo \| ⬜ \| DEC K7 + JA \| STAGE-BLOCKER`. Ten wiersz jest jawnie otwarty i oznaczony jako blokujący staging, a mimo to wliczony w licznik "0⬜" sekcji A. |
| 10 | **H4 — Redesigny (Shell Flow/Tabela/Whiteboard, 3 edytory dok., M13, M17)** | **ZAWYŻONE (self-kontradykcja)** | Nagłówek własnej sekcji rejestru: „H4 · Redesigny (5): **0✅** — ZAMROŻONE od 07-01" — czyli autor rejestru sam deklaruje zero ukończonych w tej podsekcji, jednocześnie licząc wszystkie 5 do „62✅" na górze pliku. |
| 11 | **Assessment SIRI/ADMA e2e (H3.4/H3.5)** | **CZĘŚCIOWE** | Rejestr sam oznacza H3.4/H3.5 jako 🟡 „dedykowany dowód [brak]" — nie ✅. Istnieją testy jednostkowe (`tests/unit/backend/assessment/assessmentInitiativeService.test.ts`, `tests/unit/services/admaTransformations.test.ts`) ale są to testy logiki transformacji, nie E2E sesji assessmentu na żywej bazie. Rejestr sam się tu NIE zawyża (poprawnie oznaczone 🟡) — kontrast z resztą, gdzie inne 🟡/⬜ zostały podniesione do ✅ w liczniku zbiorczym. |
| 12 | **H1.4 — Tools→Inicjatywy (callback bez handlera)** | **Zgodne z rejestrem = otwarte, ale sprzeczne z licznikiem** | Rejestr: `⬜ \| JA \| brak dowodu naprawy` — jawnie otwarte, jednak zliczone w "0⬜" na górze. |

---

## 2. Szacunek: ile z 62✅ jest realnie POTWIERDZONYCH

- **Z samej tabeli rejestru** (licząc tylko jego własne ✅ znaczniki w wierszach, ignorując nagłówek): **27/62 (44%)** są w ogóle oznaczone ✅ przez sam dokument.
- **Po weryfikacji runtime próbki (10-12 twierdzeń powyżej):** z tych 27 „wewnętrznie ✅", część ma REALNY dowód (Notatnik-silnik, kolaboracja-wiring, część H2 bugfixów), ale przynajmniej dwa flagowe „✅" z narracji (H2.3, H1.10-Teresa-T-oś) mają albo brak testu regresyjnego, albo jawnie udokumentowany brak dowodu żywego (`test.skip`).
- **Realistyczny szacunek całościowy dla sekcji A (62 pozycji):**
  - **POTWIERDZONE z dowodem runtime:** ~15-20 (24-32%)
  - **CZĘŚCIOWE** (kod istnieje, ale wąski/mockowany/bez auth-parity/bez live-LLM): ~20-25 (35%)
  - **ZAWYŻONE / otwarte wbrew licznikowi** (0⬜ deklaracja przy jawnie wpisanych ⬜/🟡/❓ w tym samym pliku, w tym STAGE-BLOCKER H6.11 i całe zamrożone H4): ~20-25 (35%)
  - **"100%" deklarowane w liczniku = NIEPRAWDA**, potwierdzone przez sam plik źródłowy zanim jeszcze cokolwiek uruchomiono.

---

## 3. Największe zawyżenia (ranking)

1. **Licznik nagłówkowy 62✅/0🟡/0⬜/0🔵/0❓** wprost przeczy własnej tabeli szczegółowej tego samego pliku (H4=0✅ jawnie, H6.11=⬜ STAGE-BLOCKER jawnie, H1/H2/H3/H5 mają dziesiątki 🟡/⬜/❓ wypisanych wierszami). To nie jest kwestia interpretacji — to literalna sprzeczność w jednym dokumencie.
2. **Teresa „tworzy X z czatu"** dla 4 z 8 narzędzi (mindmap/table/whiteboard/process_flow/note) — jedyny test E2E jest `test.skip(true, …)` z komentarzem autora wprost mówiącym że dowodu nie ma i jest potrzebny live LLM na demo. DoD wymaga „live-klik" — nie istnieje.
3. **Excel/Sheet split-brain** — kanoniczny hardened silnik leży 15 dni na niezmergowanej gałęzi `origin/port/excel-workbook`, produkcja (demo) używa innej, prostszej implementacji.
4. **Testy nazwane „E2E"** (`deckGeneratorE2E.test.ts`) które w rzeczywistości są testami jednostkowymi czystej funkcji, bez HTTP/DB — nazewnictwo zawyża postrzeganą siłę dowodu.
5. **H2.3** — realny commit fix istnieje (35e55d879d, na demo), ale sam rejestr wciąż go liczy jako ⬜ nawet PO scaleniu — sugeruje że proces aktualizacji licznika jest oderwany od rzeczywistego stanu commitów.

---

## RAPORT

Plik: `/private/tmp/claude-501/-Users-piotrwisniewski-Documents-Antygracity-DRD-consultify/d18014f2-960d-4b30-991d-be71cdd43b66/scratchpad/KRYTYK_A.md`

**A = 100% to nieprawda — i to widać już z samego rejestru, zanim dotknąłem kodu.** Ten sam plik
`_REJESTR_DOKONCZENIA.md` w jednym miejscu deklaruje sekcję A jako 62✅/0🟡/0⬜/0🔵/0❓ (100%), a
kilkadziesiąt linii niżej, we własnej tabeli szczegółowej, wypisuje dziesiątki 🟡/⬜/❓ oraz jawnie
mówi „H4 (5): 0✅ — ZAMROŻONE" i „H6.11: ⬜ STAGE-BLOCKER" — czyli sam autor rejestru nie
zaktualizował licznika zbiorczego po napisaniu szczegółów. Licząc ręcznie z własnej tabeli
rejestru wychodzi **27/62 (44%)** oznaczonych ✅, a po mojej weryfikacji runtime nawet część
z tych 27 jest miękka (kod istnieje, ale bez testu regresyjnego lub bez dowodu żywego). Najbardziej
bolesne zawyżenie: **„Teresa tworzy notatkę/mapę myśli/tabelę/tablicę/proces z rozmowy"** — kod
jest realny (`generateDeliverable.ts`, zamontowany, `createNote` realnie pisze do `notebook_pages`),
ale jedyny test end-to-end tego zachowania to `test.skip(true, …)` z komentarzem samego programisty:
„generate_deliverable is never invoked … needs live AI_PROVIDER_MODE … flag for Piotr's live-demo
acceptance pass" — czyli zero potwierdzonego dowodu na żywym LLM, mimo że H1.10 liczy to jako ✅.
Drugie poważne zawyżenie: **Excel/Sheet** — kanoniczny, hardened silnik (WQ-07/08/09) siedzi
15 dni niezmergowany na `origin/port/excel-workbook`, a to co faktycznie działa na `demo`
to inna, prostsza implementacja (`workbook.routes.ts`/`generated_workbooks`) — dokładnie split-brain
opisany w skillu `consultify-finisz-modulu`, nadal nierozwiązany. Realny szacunek: **~15-20 z 62
(24-32%) POTWIERDZONYCH dowodem runtime**, reszta to kod-bez-dowodu (🟡, realnie), otwarte pozycje
ukryte pod fałszywym licznikiem (⬜/❓), lub testy nazwane „E2E" które w rzeczywistości mockują
całe środowisko. Notatnik (M04) jest jednym z niewielu twardych POTWIERDZONYCH — jego test
`tests/acceptance/notebook.e2e.test.ts` realnie przeszedł na parity :5443 (2/2, JWT, realny SQL
odczyt).
