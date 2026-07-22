# FRAMEWORK 6 NARZĘDZI — grupa DOKUMENTY (Prezentacja · Word · Excel + ich generatory template'ów)
**Data:** 2026-07-22 · **Baza:** origin/demo (gitSha 533d353896) · **Metoda:** ocena runtime + żywe demo, każda ocena z dowodem.

> **Zlecenie Piotra:** opisać 6 narzędzi (3 generatory template'ów + 3 narzędzia), dla każdego ustalić kryteria satysfakcji na 5 osiach, ocenić PRZED (0–10) i ustalić próg PO — dopiero potem produkcja w pętli.

---

## 0. KONCEPCJA (SSOT: `_DOKTRYNA_POWSTAWANIA_ARTEFAKTOW.md` wymiar 4)
Każde wejście do narzędzia ma **3 TRYBY**: **① CZYSTO** (praca ręczna, pełna edytowalność) · **② z AI** (dialog z Teresą buduje artefakt) · **③ z TEMPLATE** (użyj wielorazowego szablonu). Stąd potrzeba **generatorów template'ów** = *AI tworzy szablon z rozmowy* **ORAZ** *ręczny edytor szablonów* (decyzja Piotra 07-22).
Reguła nadrzędna doktryny §6.2: **pierwsza wersja MUSI być akceptowalna** (pełny pipeline z fazą REVIEW zanim user zobaczy). To jest miara „nie-kaszanka".

## 1. PROGI PO = BENCHMARKI RYNKOWE (doktryna §2)
- **Prezentacja → Gamma, albo lepiej** (jakość pierwszego strzału, kompozycja, brand).
- **Word/Raport → „wyznacznik sam w sobie"** (dokument konsultingowy klasy partnerskiej z AI w pętli — nie ma dziś takiego na rynku).
- **Excel → analityk PE** (żywe formuły, model przeliczalny, rygor 5-fazowy).

## 2. 5 OSI OCENY (per narzędzie, 0–10)
① **MENU** — kompletne, standardowe; czy 3 tryby (czysto/AI/template) są dostępne w menu.
② **NAWIGACJA** — wejście/wyjście, przełączanie trybów, otwieranie artefaktu/szablonu, powrót.
③ **FUNKCJA** — czy silnik realnie działa (generuje/zapisuje/eksportuje); dla generatora: czy tworzy wielorazowy szablon (AI + edytor).
④ **MERYTORYKA** — jakość treści (answer-first, MECE, no-fabrication/grounding).
⑤ **GRAFIKA** — jakość wizualna outputu + tokeny `c-*`, dark/light, zero crimson-jako-dane.

---

## 3. KARTA WYNIKÓW — 6 narzędzi × 5 osi (PRZED → PO)

| Narzędzie | ① Menu | ② Nawig. | ③ Funkcja | ④ Meryt. | ⑤ Grafika | Śr. PRZED |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| **4. Prezentacja (Deck)** | 4→8 | 5→8 | 7→8.5 | **3→7** | 4→7 | **4.6** |
| **1. Generator tpl. Prezentacji** | 1→7 | 2→7 | **2→7** | –→7 | 3→7 | **~2.0** |
| **5. Word / Raport** | 6→8 | 6→8 | 7→8.5 | **6→8** | 6→8 | **6.2** |
| **2. Generator tpl. Word** | 4→8 | 4→8 | **5→8** | 5→8 | 4→8 | **~4.4** |
| **6. Excel / Arkusz** | 3→7 | 2→7 | 5→8 | **3→7** | 4→7 | **3.4** |
| **3. Generator tpl. Excel** | 2→7 | 2→7 | **1→7** | 1→7 | 4→7 | **2.0** |

**Średnia grupy PRZED ≈ 3.8/10.** Najsłabsze: generatory template'ów (2.0 / 2.0 / 4.4) i merytoryka Decka (3) + Excela (3). Najsilniejsze: silniki eksportu/generacji (funkcja 5–7) i Word (6.2).

---

## 4. PREZENTACJA (Deck) — narzędzie #4 · średnia PRZED 4.6/10
- **① Menu 4→8** — M1 bez ← powrotu (`DeckBuilder.tsx`, 0 wiring `onBack`), bez [indeksu], PRIMARY=„Prezentuj" zamiast „Eksportuj"; M2 nie istnieje konstrukcyjnie; panel prawy: klucz `media` deklarowany a nieobsłużony → pusty panel. **3 tryby zlewają się w jeden** — „Start new" i „szablon" i tak przechodzą przez pipeline AI (`PrezentacjeView.tsx:152-198`); brak realnego trybu „czysto ręcznie".
- **② Nawigacja 5→8** — wejście przez Materiały→Nowy→format; „Open in Deck Builder" w tej samej karcie. Boli: ← powrót fizycznie niepodłączony.
- **③ Funkcja 7→8.5** — eksport PPTX REALNY (`presentationGeneratorService.ts:1862+` → pptxgenjs → plik → `GET /decks/:id/download` z quality/approval-gate). Boli: storage na lokalnym dysku (`:1873`, ryzyko utraty po redeployu); martwy kod (tryb prezentera nigdy nie wywoływany).
- **④ MERYTORYKA 3→7 — NAJDROŻSZA.** `generateDefaultOutline` wpada w generyczny łuk gdy `hasRichSource===false` — **zero auto-groundingu w danych org, zero trybu jawnych założeń (§0.3)**. Dowód żywy: deck „dla zarządu o fakturach" = „brak danych"+placeholdery. Deck bez źródeł cicho degraduje się zamiast wciągnąć dane albo nazwać założenia.
- **⑤ Grafika 4→7** (nie w pełni zweryfikowane wzrokiem) — 4 z 5 bramek jakości (Styler/Critic/AudienceVariants/QA) mają ZERO wywołań na realnej ścieżce decka — żyją tylko w osobnym pipeline bundle.

**★ Największa luka:** brak groundingu/trybu założeń → deck bez podpiętych źródeł = szkielet-placeholder, a żadna bramka jakości tego nie łapie.

## 5. GENERATOR TEMPLATE'ÓW PREZENTACJI — narzędzie #1 · średnia PRZED ~2.0/10
- **ISTNIEJE:** tabela `presentation_templates` + governance (draft/approved/deprecated) + lineage/audit; **klonowanie** działa (`presentations.routes.ts:956+`); „zapisz jako szablon" gotowego decka (`SaveAsTemplateModal`).
- **BRAK (zero implementacji):** tworzenie NOWEGO szablonu od zera (brak `POST /templates`); **AI buduje szablon z rozmowy — nie istnieje**; **ręczny edytor struktury — fantom** (backend `PUT /templates/:id` przyjmuje `outlineJson`, ale ZERO callerów w `src/`). SSOT sam przyznaje: *„shared template generator runtime: MISSING"*.
- Grafika: galeria używa surowych `slate-*`/`navy-*`/gradientów zamiast `c-*` (złamanie kanonu).

**★ Największa luka:** oba filary (AI-z-rozmowy + ręczny edytor) mają zerową implementację FE — szablony istnieją tylko jako nieprzezroczyste migawki gotowych decków, nigdy jako obiekt autorski.

## 6. WORD / RAPORT — narzędzie #5 · średnia PRZED 6.2/10 (NAJBLIŻEJ)
- **① Menu 6→8 · ② Nawigacja 6→8** — DocumentStudio ma bogatą powłokę (13-tool rail), Mode 1 (bez szablonu) i Mode 3 (z szablonu) realne; intake zbiera typ/gęstość/cel/audience. Braki: dopięcie 3 trybów jako jawnego wyboru na wejściu.
- **③ Funkcja 7→8.5** — generacja realna (docGenerationRuntime), autosave optimistic-lock, komentarze (pełny cykl wątków/resolve/reopen), eksport DOCX/PDF. Braki: brak historii wersji z diffami; „presence" to statyczna etykieta, nie realtime.
- **④ MERYTORYKA 6→8 — DOWÓD ŻYWY: dobry.** Dokument „dla zarządu o fakturach" = answer-first, 3 opcje skalowania z harmonogramami, liczby (40%/50%) **jawnie oznaczone „Assumption:"** (§0.3 działa — nie zmyśla). Boli: „Assumption:" powtórzone za często (brzmi mechanicznie) — do wygładzenia formatowania założeń.
- **⑤ Grafika 6→8** — render + eksport klasy dokumentu; do domknięcia: tryb czytania klienta, śledzenie zmian UX.

**★ Największa luka:** treść jest DOBRA — dopięcie to polish (format założeń, historia wersji, tryb klienta). Word = WZORZEC do przeniesienia na Deck.

## 7. GENERATOR TEMPLATE'ÓW WORD — narzędzie #2 · średnia PRZED ~4.4/10
- **ISTNIEJE (więcej niż deck!):** `POST /templates/plan` → **`draftTemplateAsync({useLlm:true})` = AI SZKICUJE SZABLON** z `TemplateDraftInput` (purpose+…); wariant deterministyczny `draftTemplate`; governance (approve/deprecate/audit/usage/feedback); Mode 3 generacja z zaakceptowanego szablonu; `content-blocks/:id/instantiate`.
- **BRAK/SŁABE:** FE do tworzenia/edycji szablonu cienki (grep FE: tylko picker `approvedTemplates` w intake) — silnik AI-szkicu jest, ale **ręczny edytor szablonu + UI generatora** do zbudowania; `documentStudioTypes.ts:7` „MVP-1: Mode 1 only" sugeruje Mode 3/edytor częściowo.

**★ Największa luka:** backend generatora template'ów Word ISTNIEJE (AI-draft + governance) — brakuje FRONTENDU (kreator + ręczny edytor). To najkrótsza droga do pierwszego działającego generatora template'ów — i wzorzec dla prezentacji.

## 8. EXCEL / ARKUSZ — narzędzie #6 · średnia PRZED 3.4/10
- **① Menu 3→7** — pill-menu Nowe/Ostatnie/Zapisane + 8 szablonów działa; ale brak trybu „czysto/ręcznie" (tylko Start-new-AI + szablony-prompty), brak powłoki SPEC-A (zero `ArtifactRightPanel`/kebab w `KimiWorkspaceShell`).
- **② Nawigacja 2→7 (split-brain)** — `/excele` bez flagi = redirect na `/tabele`; z flagą osiągalny, ale **żaden sidebar nie linkuje**; router klasyfikuje `/excele` jako `AppView.TABELE` (`routeConfig.ts:770`). Jedyne wejście = ręczny URL `?ff_excele=1`.
- **③ Funkcja 5→8** — **silnik REALNY i podłączony** (nie fantom): `ExceleView`→`generateWorkbook`→`POST /api/workbook/generate`→`WorkbookGeneratorService` 5-fazowy (PLAN→CONFIRM→GENERATE→REVIEW→BUILD) + `workbookQualityGate` + ExcelJS. Boli: **split-brain z czatem trwa** — Teresa „stwórz arkusz" idzie markdown GFM 10×15 (`docGenerationRuntime.ts:887`), zero formuł; generyczny eksport .xlsx = płaski zrzut CSV.
- **④ MERYTORYKA 3→7** — grounding ROZŁĄCZONY: `researchContext:string` a `ArtifactActionPanel` wysyła OBIEKT → `"[object Object]"`; `workbook.routes.ts` NIE przekazuje `sourcePack`/`evidenceRefs` do promptu (tylko do DB); `ExceleView` w ogóle nie wysyła kontekstu. Efekt: **liczby są „realistycznym" wymysłem LLM**, mimo że rusztowanie groundingu istnieje.
- **⑤ Grafika 4→7** — podgląd arkusza pokazuje tylko metadane (nazwa/kolumny/wiersze), **brak cell-data/formuł** — trzeba pobrać plik, żeby cokolwiek zobaczyć; brak SPEC-A.

**★ Największa luka:** nie brak silnika (jest solidny) — **ODŁĄCZENIE**: brak wejścia z menu, grounding nigdy nie dociera do promptu, split-brain z czatem żywy.

## 9. GENERATOR TEMPLATE'ÓW EXCEL — narzędzie #3 · średnia PRZED 2.0/10
- **ISTNIEJE (zaskakujący fundament):** `server/src/services/workbook/templates/index.ts` + `threeScenarioPnL.ts` — realny, **parametryczny rejestr szablonów modelu** (`WORKBOOK_TEMPLATES`, `buildFromTemplate()`) z gotowym szablonem „RZiS — 3 scenariusze × 3 lata" (Base/Bull/Bear, formuły łańcuchowe, arkusz Założeń, zero magic-numbers). Komentarz: „LLM parametrizes a proven template instead of designing from scratch".
- **BRAK — FANTOM (złota reguła #1):** ten rejestr ma **ZERO callerów w produkcji** — `WorkbookGeneratorService` go nie importuje; istnieje tylko w testach. Gotowa architektura leżąca odłogiem.
- **BRAK — kanał „save as template" dla arkuszy:** twardo zablokowany API (`artifacts.routes.ts:1052`: 409 „Only report or presentation outputs"); `deliverableTemplateService` obsługuje tylko report/presentation, zero `sheet`. Brak ręcznego edytora.

**★ Największa luka:** brak na poziomie produktowym, ale **najkrótsza droga do PO to PODŁĄCZENIE, nie budowa od zera**: (a) wepnij `buildFromTemplate` do `WorkbookGeneratorService`, (b) zdejmij blokadę 409 dla `sheet`, (c) dodaj branch `outputType='sheet'` w `deliverableTemplateService`.

---

## 10. WNIOSKI PRZEKROJOWE (wszystkie 3 rodziny)
1. **Word > Deck > Excel w merytoryce z czatu** — Word ma tryb założeń (§0.3) + audience w prompcie i to widać (dobry output); Deck i Excel go NIE mają → „brak danych"/zmyślone liczby. **Kierunek: przenieść wzorzec §0.3+grounding z Worda na Deck i Excel.**
2. **Silniki w większości ISTNIEJĄ — problem to ODŁĄCZENIE, nie brak.** Deck PPTX realny, Excel 5-fazowy realny, Word generacja realna. Kaszanka bierze się z: (a) groundingu, który nie dochodzi do promptu (Deck: brak; Excel: `[object Object]`), (b) split-brainów (Excel czat→markdown; /excele↔/tabele), (c) frontendów generatorów template'ów.
3. **Generatory template'ów — wspólny wzorzec „backend jest, FE brak/fantom":**
   - Word: backend AI-draft REALNY (`/templates/plan`+`draftTemplateAsync`) → brakuje FE (kreator+edytor).
   - Deck: backend FANTOM (`PUT outlineJson` bez callerów) → brakuje wszystkiego.
   - Excel: fundament `WORKBOOK_TEMPLATES` FANTOM (bez callerów) + API blokuje 409 → podłączyć.
   **Najkrótsza droga: zbudować JEDEN wzorzec generatora template'ów (Word — bo ma backend), potem klonować na Deck i Excel.**
4. **Powłoka/menu:** Excel i Deck łamią kanon (brak SPEC-A/ArtifactRightPanel gdzie trzeba, surowe slate/navy w galeriach); 3 tryby (czysto/AI/template) nigdzie nie są jawnym wyborem na wejściu — wszędzie zlewają się w „AI generuje".

## 11. PLAN PRODUKCJI W PĘTLI (propozycja kolejności — do akceptu Piotra)
Metoda: jedno narzędzie/oś na raz, oczekiwanie-vs-wynik, PRZED→PO, zrzut do odbioru, commit-per-krok.

**FALA A — MERYTORYKA (najdroższa dla klienta, wspólny wzorzec §0.3):**
1. **Word→100%** jako WZORZEC — wygładzić format założeń („Assumption:” over-repeat), historia wersji, tryb czytania klienta. Najbliżej (6.2), najniższe ryzyko.
2. **Deck merytoryka** — przenieść §0.3 założenia + auto-grounding org (jak `autoScanOrgSources` w Word) do `generateDeck`; podłączyć bramki jakości (Styler/Critic/QA). Cel: koniec „brak danych".
3. **Excel merytoryka+spięcie** — naprawić grounding (`researchContext` obiekt→prompt), zunifikować wejścia na `WorkbookGeneratorService` (koniec split-brain czat→markdown).

**FALA B — GENERATORY TEMPLATE'ÓW (jeden wzorzec → 3×):**
4. **Generator tpl. Word (FE)** na istniejącym backendzie — kreator AI (`/templates/plan`) + ręczny edytor struktury. To WZORZEC.
5. **Klon wzorca → Deck** (dobudować backend, bo fantom) i **→ Excel** (podłączyć `WORKBOOK_TEMPLATES` + zdjąć 409).

**FALA C — MENU/NAWIGACJA/GRAFIKA (polish do progu):**
6. 3 tryby jako jawny wybór na wejściu; wpiąć /excele w sidebar (po akcepcie flaga ON); powłoka SPEC-A gdzie brak; ← powrót Deck; storage nietrwały (P0).

> **Status: KOMPLETNY (6/6 narzędzi ocenione).** Do decyzji Piotra: (1) akcept kryteriów+progów, (2) akcept kolejności fal A→B→C, (3) od którego kroku ruszamy produkcję.
