# HANDOFF MATERIAŁY — punkt wejścia po wyczerpaniu okna kontekstu · 2026-07-28

> **CZYTAJ TO PIERWSZE.** Jeden dokument, z którego da się wznowić pracę bez dostępu do
> poprzedniej rozmowy. Wszystko poniżej jest zweryfikowane w kodzie na tipie demo, nie z pamięci.
> Kontekst: tydzień 49. urodzin Piotra, cel „Consultify is ready". Do urodzin **jeden dzień**.

---

## 1. FUNKCJA CELU (miara wszystkiego)

> **Consultify zamienia wiedzę organizacji w materiały, które konsultant bez wstydu kładzie
> klientowi na stole — szybko, lekko, bez wyklikiwania, z liczbami, których nie trzeba sprawdzać.**

Przyjęta i zaakceptowana przez Piotra 27.07 („funkcję celu znasz, więc ty najlepiej wybierzesz").
Wszystko, co temu służy, ma pierwszeństwo. Co jest „ładne, ale nie zmienia doświadczenia klienta" — czeka.

## 2. ROLE
- **Piotr** — wizjoner + CEO. Decyduje: kierunek produktu, akcepty wizualne (reguła #7),
  ocena „czy gotowe", kontakt z klientem. Komunikacja PO POLSKU, krótko, obrazkami.
- **JA** — CTO **i PM** (wzmocnione 27.07). Rozstrzygam sam: technikę, kolejność prac, priorytety
  wykonawcze. Zapisuję decyzje z uzasadnieniem (`_DECYZJE_CTO_MATERIALY_2026-07-27.md`), żeby dały
  się odwrócić jednym zdaniem. **Nie odsyłam do Piotra decyzji, których z definicji nie ocenia.**

## 3. WIZJA PRODUKTU (nagranie Piotra 27.07, N1-N17)
Pełny zapis: `_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md`. Esencja:
- **Trzy typy dokumentów, trzy generatory dokumentów, trzy generatory szablonów.**
  Prezentacja (mało słów, wizualnie) · Word/raport (gęsty tekst, analityczny) · Excel (liczby
  **i formuły**, żeby symulować). **Raport = po prostu dokument Word.** Nie ma 4. formatu.
- **Przepływ:** `Dodaj → który format → Czysto/Z AI/Z szablonu → BANG`. Czyste = pusty dokument.
  Z AI = dokument + **Teresa z boku**. Z szablonu = lista → wybór → dokument. **ZERO formularzy**
  z gęstością/celem/odbiorcami („to jest zupełnie do niczego niepotrzebne").
- **Teresa = jedyne pole tworzenia z AI.** Nie budujemy nowych pól input.
- **Generator szablonów = 3 kolumny:** lewa kolejność treści · prawa klocki/narzędziówka ·
  środek budowanie. Zapisany szablon potem „po prostu wychodzi".
- **★ Największy brak: MÓZG POMIĘDZY** — plan treści („co ma być w tej tabeli, tym Wordzie, tych
  slajdach") **przed** pisaniem, potem egzekucja **na oczach użytkownika**.
- **Estetyka:** „lekkie, technologiczne, jak obecne aplikacje AI" — nie „tabele z lat 90".
  Benchmark: **Gamma** (tworzenie) + **Airtable** (biblioteka).
- Nazwa modułu „Materiały" — do zmiany kiedyś, zaparkowane.

## 4. ★ MAPA KOMPONENTÓW — GDZIE CO JEST (najważniejsza sekcja)

### 4.1 Silniki i edytory (KANON — na tym budujemy, NIE dublować)
| Format | Silnik generacji | Edytor | Generator szablonów |
|---|---|---|---|
| **PowerPoint** | `server/src/services/presentationGeneratorService.ts` (+ `slidePlanningEngineService.ts`) | `src/components/Presentations/DeckBuilder/` | ★ `src/components/Presentations/PresentationTemplateArchitectView.tsx` — **TEN, o który pytał Piotr** („zajebisty", budowany 22-23.07: statusy draft→approved→deprecated, briefing per slajd, sylwetki). Backend: `presentationTemplateArchitectService.ts`, `presentationTemplateDraftService.ts`, `presentationTemplateGovernanceService.ts`. Wejście: Materiały → Szablony → „New template" → Architekt |
| **Word** | Document Studio / wave5: `server/src/services/documentStudio/documentStudioService.ts` | `DocumentTipTapEditor` (prawdziwy WYSIWYG) w `src/components/DocumentStudio/` | `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` (flaga `ff_tpl_editor`) |
| **Excel** | `server/src/services/workbook/WorkbookGeneratorService.ts` (pipeline PLAN→CONFIRM→GENERATE→REVIEW→BUILD) + `WorkbookBuilder.ts` (ExcelJS) | podgląd siatki (edycji komórek BRAK — świadomy MVP) | **8 modeli** w `server/src/services/workbook/templates/` (rejestr `index.ts`) |

### 4.2 Mózg treści (ISTNIEJE — Piotr o nim nie wiedział, bo nazywa się inaczej)
- **`server/src/services/narrativeEngine/`** — 5 warstw: L1 fakty → L2 selekcja obserwacji →
  L3 plan wywodu → L4 realizacja językowa (LLM) → L5 post-checks anty-fabrykacja.
  Wpięty w **deck + Word**. **Excel NIE wpięty** (luka).
- Doktryna opisowa tego samego: `docs/standards/CONCLUSION_LAYER_STANDARD.md` (K1→K2→K3→K4) —
  dlatego grep „narrative engine" po dokumentacji = 0 trafień.
- **Pokrycie L4 dla slajdów: 9 z ~15 intencji** (4 pierwotnie + 5 dodanych 26.07). Reszta =
  deterministyczny szablon. To jest do rozszerzenia w Fazie C.

### 4.3 Doktryny (Faza A — napisane 27.07, na demo)
- `Harvard/wdrozenie-100/_KANON_MENU_3_NARZEDZIA_2026-07-27.md` — góra/lewy rail/prawy panel/PPM
  dla 3 narzędzi + **kolumna wspólne vs swoiste**, 22 punkty zweryfikowane w kodzie.
- `_BENCHMARK_UKLAD_DOKUMENTY_2026-07-27.md` — 34 prymitywy vs Gamma/Notion/Airtable + **TOP 10
  „do ukradzenia"**.
- `_DOKTRYNA_TRESCI_EXCEL_2026-07-27.md` — sekwencja **E1→E5**, anatomia 7 warstw
  (A0 Info→A1 Założenia→A2 Silnik→A3 Wyniki→A4 Wrażliwość→A5 Dashboard→A6 Wnioski;
  A1+A2+A3 = minimum), reguła: *„Wynik nigdy nie jest wpisany. Założenie nigdy nie jest policzone."*
- `_DOKTRYNA_STREAMING_2026-07-27.md` — co user widzi w sekundzie 0/2/10/30, jednostka postępu
  per format.
- Starsze, nadal żywe: `ARTIFACT_ANATOMY_STANDARD.md` (§5 menu per archetyp, §13 instancjacja),
  `docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md` (MELS — kanon 4 stref DLA tych 3 narzędzi,
  status LOCKED), `_FORMULA_MENU_NARZEDZI_12.md` (#10 Word/#11 Excel/#12 PPT),
  `docs/qa/deliverables/DELIVERABLE_STANDARDS_AND_TOOLING.md` (IBCS/Minto/Tufte/Few),
  `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md` (**60 metodyk** McKinsey/BCG/Porter),
  `docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md` (§3 nawigacja, §4 wejścia,
  §5 układ 3-kolumnowy generatora — spisany 3 dni przed nagraniem Piotra!).

### 4.4 Rzeczy, które istnieją a nie są podłączone (kopalnia wartości)
- **SPINE / `docs/product/BUSINESS_PLAN_GENERATOR_SPEC.md`** — jedyny **dowiedziony** przykład
  „jeden mózg → 3 formaty z identycznymi liczbami", testy zielone, **za flagą OFF i bez callera**.
- **Księga faktów** (`factRefs`) — mechanizm referencji do liczb, realnie w kodzie.
- **chartImages** w Excelu — mechanizm jest, **0/8 modeli go używa**.

### 4.5 Wygaszone / martwe (nie wskrzeszać)
`/presentation-studio` (porzucony sprint z maja, redirect), PresentationWizard (redirect do kanonów),
stary `Presentations/PresentationsHub.tsx` + `DeckTemplateGallery` (skasowane), `WordyView`
(skasowany, `/wordy`→`/document-studio`), ~8 osieroconych komponentów Report Buildera.
Spis z dowodami: `_SPIS_MARTWYCH_DO_KASACJI_2026-07-27.md`.

## 5. STAN NA DEMO (28.07 rano)
Ostatni tip mojej pracy: **`33260bf7db`**, tag **`demo-safe-2026-07-28-noc-materialy`**.
Wcześniejsze punkty: `demo-safe-2026-07-27-faza-b` · `-fala2-urodzinowa` · `-fala1-sprzatanie` ·
`-p0-hydraulika`. **UWAGA: demo rusza się pod równoległymi sesjami — zawsze `git fetch origin demo`
+ `git merge-base --is-ancestor` przed pushem.**

**Działa (wdrożone i zweryfikowane):** klik w dokument otwiera dokument · język konta steruje UI ·
dokumenty z Document Studio widoczne w bibliotece · jedno wejście per format (wizard/studio →
redirecty) · szablony do rejestru kanonicznego · retry rejestracji artefaktów · arkusze rozróżnione
(model vs eksport tabeli) · kickoff Teresy w 3 lane'ach · breadcrumb `Materiały › Dokumenty › …` ·
Excel nie zmyśla liczb + bramki DX-01/DX-02 · Excel zna organizację · model NPV/IRR · kolory modelu ·
uczciwy streaming (Stop, źródła, plan także dla szablonu) · **typy 27→0**.

**Za flagami — czeka na akcept Piotra:**
- `ff_zai_teresa` (OFF) — przepływ „Z AI" bez formularza, dokument + Teresa z boku.
- `ff_galeria_szablonow` (OFF) — galeria szablonów z miniaturami.
- `ff_workbook_templates` (OFF), `ff_drd_report` (OFF) — starsze, czekają od 23-27.07.

**Karty odbioru:** `rejestr/3-DO-ODBIORU/` → MAT-P0, MAT-FALA1, MAT-FALA2, MAT-FAZA-B, MAT-NOC.

## 6. CO ZOSTAŁO (ostatni dzień przed urodzinami)
1. **Faza C — mózg** (największa wartość): rozszerzyć pokrycie L4 z 9 na wszystkie sensowne
   intencje slajdów · **wpiąć Excel w narrativeEngine** (dziś odcięty) · streaming blok-po-bloku
   dla Deck i Excel (dziś tylko 8 generycznych etapów co 3s) · odblokować SPINE.
2. **Faza D — generatory szablonów**: Word i Excel do układu 3-kolumnowego (baza: Architekt
   prezentacji, który już jest dobry).
3. **Scena demo** — 6-10 dopracowanych materiałów na koncie Piotra, żeby demo wyglądało jak
   żywa firma. Weryfikacja eksportów (.docx/.pptx/.xlsx otwierają się w Office).
4. **Złote ścieżki reszty produktu** — przejść i naprawić tylko blokery.
5. Drobne otwarte: tęczowy filtr „Source" w Prezentacjach · 2 błędy typów z równoległej sesji ·
   G2 z suity E2E (dokument na liście — potwierdzić na realnej bazie).

## 7. ŻELAZNE REGUŁY PRACY (łamanie = katastrofa)
1. Gałąź ZAWSZE z `origin/demo`, worktree izolowany, commit bez push. Push tylko nadzorca.
2. **Bramka = test E2E ścieżką użytkownika**, nie test komponentu. Suita:
   `tests/e2e/golden/materialy.golden.spec.ts` (baseline 6 PASS/2 FAIL/1 DEGRADED, werdykt 5/10).
3. **Reguła #7: Piotr NIGDY nie jest pierwszym testerem wizualnym.** Nowa powierzchnia → prototyp
   dev-render → mój zrzut light+dark → akcept → rollout za flagą OFF → flip za zgodą.
4. **`esbuild` ≠ `tsc`.** Przed pushem: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`,
   porównanie do **ŚWIEŻEGO** baseline (demo się rusza!), normalizacja po `plik:kod` bo numery
   linii kłamią.
5. Zero cichych fallbacków — każdy błąd to jawny stan po polsku z drogą powrotu.
6. Każdy nowy eksport ma callera produkcyjnego; dowód = test z wejścia produkcyjnego.
7. Robotnicy: **zero sub-agentów**, model wg zadania (Sonnet mechanika, Opus smak/trudny kod,
   Haiku czyste przebiegi, Fable/nadzorca nie pisze kodu produkcyjnego).
8. Dane demo = twarz produktu. Żadnych rekordów testowych.

## 8. PUŁAPKI (kosztowały nas czas — nie powtarzać)
- **Audyty starzeją się w GODZINY** przy wielu sesjach. Każda pigułka naprawcza musi zaczynać się
  od „potwierdź, że bug wciąż istnieje na świeżym tipie".
- **Harness dev-render musi być opakowany w `AppProviders`** — inaczej pada na brakujących
  kontekstach (FeatureFlags, V8). Wzór: `dev-render/screens/navdeclutter-sidebar.tsx`.
- **Mock w harnessie musi być stanowy** — zamrożony daje fałszywe bugi.
- Asercje w testach mają pilnować NIEZMIENNIKA (minimum, unikalność), nie sztywnych liczb —
  inaczej dołożenie 8. modelu wywraca test 7 modeli.
- `git stash` jest wspólny dla całego repo — cudze sesje mogą podłożyć swój stash.

## 9. KOLEJNOŚĆ CZYTANIA PRZY WZNOWIENIU
1. **Ten plik.**
2. `_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md` — wizja właściciela (miara odbioru).
3. `_DECYZJE_CTO_MATERIALY_2026-07-27.md` — co już rozstrzygnięte (D1-D10).
4. `_MAPA_I_PLAN_MATERIALY_2026-07-27.md` — synteza 3 audytów + fazy A-D.
5. `_PLAN_100_MATERIALY_MODELE_2026-07-27.md` — dziennik wykonania (co zrobione, czym, kiedy).
6. `_INWENTARZ_GENERATORY_3_FORMATY_2026-07-27.md` — co realnie zbudowane.
7. Doktryny z §4.3 — dopiero gdy pracujesz nad danym obszarem.
Potem: `git fetch origin demo` i `railway deployment list --service consultify`.
