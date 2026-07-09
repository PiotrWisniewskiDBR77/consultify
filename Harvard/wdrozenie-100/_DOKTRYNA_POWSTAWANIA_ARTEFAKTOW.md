# DOKTRYNA POWSTAWANIA ARTEFAKTÓW — 5 wymiarów + benchmarki rynkowe (SSOT)

> **Po co:** żeby każdy silnik, ekran i agent budował narzędzie we WŁAŚCIWYM trybie pracy — i żeby nigdy więcej nie powstał „markdownowy Excel" (dokument potraktowany jak szkic) ani „ciężki pipeline dla notatki" (szkic potraktowany jak dokument).
> Ustalone z Piotrem 2026-07-09. Nadrzędne dla decyzji silnikowych; rodzeństwo `ARTIFACT_ANATOMY_STANDARD.md` (tam JAK wygląda; tu JAK POWSTAJE).

---

## 1. PIĘĆ WYMIARÓW (każde narzędzie = wektor 5 wartości)

| # | Wymiar | Wartości | Co przesądza w kodzie |
|---|--------|----------|----------------------|
| 1 | **TRYB** | EWOLUCJA (struktura emerguje z pracy) ↔ KRYSTALIZACJA (struktura przed treścią: plan→wypełnienie) | lekkie operacje przyrostowe na grafie/tekście ↔ pipeline plan→confirm→generate→review→build |
| 2 | **TEMPORALNOŚĆ** | ŻYWY (aktualizuje się, ma cykl życia) ↔ SNAPSHOT (dostarczony i zamrożony; nowa wersja = nowy snapshot) | żywe formuły/tracking/statusy ↔ eksport, wersje, „approved" |
| 3 | **POCHODZENIE** | WOLNY (od zera/przechwyt) ↔ DERYWOWANY (wyciągnięty z rodzica: idea→inicjatywa, inicjatywa→KPI, założenia→model) | entry point „Stwórz" ↔ „Konwertuj/Wyciągnij z…" + link do rodzica first-class |
| 4 | **INTERAKCJA** | SOLO+AI-COPILOT (człowiek edytuje sam; AI na żądanie „popraw/uzupełnij/dokończ") ↔ DIALOG (rozmowa z Teresą — głosem lub tekstem — buduje artefakt) | **każde narzędzie MUSI mieć OBA wejścia**: pełna edytowalność ręczna + slot AI w M3/PPM ORAZ ścieżkę `generate_deliverable` z czatu |
| 5 | **KOLABORACJA** | MULTIPLAYER (realtime, presence, jak Miro) ↔ OSOBISTY→UDOSTĘPNIANY (sharing/komentarze wystarczą) | WebSocket graph-patch + presence + non-owner read ↔ share-link + komentarze/wątki |

**Reguła nadrzędna interakcji (wymiar 4):** AI nigdy nie zastępuje ręcznej pracy — ją PRZYSPIESZA. Użytkownik zawsze może wszystko zrobić sam (przesunąć gałąź, przepisać komórkę, zmienić slajd); AI jest dostępne w dwóch stałych miejscach (dialog Teresy = tworzenie/duże ruchy; copilot w narzędziu = punktowe „popraw to"). Narzędzie, w którym da się TYLKO generować albo TYLKO klikać, łamie doktrynę.

---

## 2. BENCHMARKI RYNKOWE (miara „dobre" per kategoria — słowa Piotra)

| Kategoria | Benchmark | Poprzeczka |
|-----------|-----------|------------|
| Idee/canvas (Mind Map · Process Flow · Whiteboard) | **Miro** | płynność multiplayer, zero ceremonii, praca ewolucyjna |
| Notatki | **Notion** | lekkość pisania, bloki, organizacja, „drugi mózg" |
| Tabele | **Airtable** | typy pól, widoki, filtrowanie, komentarze rekordów |
| Prezentacje | **Gamma — albo lepsze** | jakość pierwszego strzału, kompozycja, brand |
| Word/Dokumenty | **WYZNACZNIK SAM W SOBIE** — nie ma dziś takiego narzędzia na rynku | dokument konsultingowy klasy partnerskiej z AI w pętli (proposals/review/eksport) |
| Excel/Analiza finansowa | analityk PE (własna poprzeczka) | żywe formuły, model przeliczalny przez człowieka, rygor 5-fazowy |

---

## 3. MAPA 12 NARZĘDZI × 5 WYMIARÓW

| Narzędzie | Tryb | Temporalność | Pochodzenie | Interakcja | Kolaboracja | Benchmark |
|-----------|------|--------------|-------------|-----------|-------------|-----------|
| Mind Map | EWOLUCJA | ŻYWY | wolny | oba | **MULTIPLAYER** | Miro |
| Process Flow | EWOLUCJA | ŻYWY | wolny | oba | **MULTIPLAYER** | Miro |
| Whiteboard | EWOLUCJA | ŻYWY | wolny | oba | **MULTIPLAYER** | Miro |
| Idea Table | EWOLUCJA | ŻYWY | wolny | oba | **MULTIPLAYER** | Airtable |
| Notatka | EWOLUCJA | ŻYWY | wolny/przechwyt z czatu | oba | osobista→udostępniana (v1) | Notion |
| Insight | KRYSTALIZACJA | SNAPSHOT | derywowany (rozmowa/wywiad) | oba | udostępniany | — (karta N) |
| Initiative | KRYSTALIZACJA | **ŻYWY** | derywowany (idea/tool/assessment) | oba | komentarze+współpraca | — (kręgosłup) |
| Task | KRYSTALIZACJA | ŻYWY | derywowany (inicjatywa) | oba | przypisania+komentarze | — |
| Decision | KRYSTALIZACJA | SNAPSHOT (po zatwierdzeniu) | derywowany | oba | udostępniany | — |
| Word/Dokument | KRYSTALIZACJA | SNAPSHOT | wolny/derywowany | oba | komentarze/wątki (v1, bez realtime) | **wyznacznik** |
| Excel/Analiza | KRYSTALIZACJA | **ŻYWY** (formuły!) | derywowany (założenia) | oba | share+komentarze (v1) | analityk PE |
| Deck | KRYSTALIZACJA | SNAPSHOT | derywowany (artefakty źródłowe) | oba | presence (v1) | Gamma+ |

**Przypadki, które binarny podział mylił (uzasadnienie 2. osi):**
- **Notatka** = tekst, ale pracuje jak IDEA (ewolucja, nigdy „done", przechwyt myśli) → silnik lekki, nie pipeline.
- **Excel** = dokument, ale ŻYWY: struktura krystalizuje raz (architektura modelu), potem wartości/scenariusze ewoluują na żywych formułach — „analityk-prototyper".
- **Inicjatywa** = duży tekst, ale ŻYWY rekord: sekcje first-shot (pętla karty N: draft→edytuj→zaakceptuj), całość żyje przez cykl projektu.
- **KPI** = mała krystalizacja DERYWOWANA: definicja first-shot (nazwa/formuła/cel/kierunek/właściciel) wyciągana z rodzica (benefit inicjatywy / linia modelu), pomiar akretuje w czasie. Entry point = „wyciągnij z…", nie „napisz".
- **Analiza finansowa** (jako czynność, nie plik): krystalizacja szkieletu 5-fazowo → ewolucja wewnątrz (scenariusze, założenia). Wynik w Excelu (żywy) + omówienie w Word/Deck (snapshot).

---

## 4. IMPLIKACJE KODOWE (który silnik za który wektor)

| Wektor | Silnik/wzorzec | Stan |
|--------|----------------|------|
| EWOLUCJA+ŻYWY (canvas) | operacje na grafie `my_idea_maps` + autosave + `ideaCollabWs` (graph-patch, presence) | ✅ istnieje (PRO ≥90) |
| EWOLUCJA+ŻYWY (tekst) | Notebook: strona+bloki, przechwyt z czatu (`createNote`), edycja swobodna | ✅ istnieje; poziom Notion = gap (§5) |
| KRYSTALIZACJA+SNAPSHOT (doc/deck) | plan→sekcje/outline→wypełnienie→eksport; lifecycle draft→approved | ✅ istnieje (docGenerationRuntime / deck) |
| KRYSTALIZACJA+ŻYWY (model finansowy) | **pipeline 5-fazowy** `WorkbookGeneratorService` (PLAN→CONFIRM→GENERATE→REVIEW→BUILD) + **żywe formuły** (`cell.value={formula}`) | ✅ istnieje; NIEPODPIĘTY do czatu = **B2** |
| KRYSTALIZACJA+ŻYWY (rekordy) | karty N: `NModeCardState` per sekcja (draft→edit→accept) + lifecycle | ✅ istnieje (za flagą) |
| DERYWOWANIE | konwersje first-class: idea→inicjatywa, inicjatywa→KPI/Task, artefakty→deck; link do rodzica w Powiązaniach | 🟡 częściowe — primary CTA „Konwertuj" w Formule; KPI „wyciągnij z…" do domknięcia |
| DIALOG (Teresa) | `generate_deliverable` 12 typów + głos | ✅ istnieje (sheet przez zły silnik → B2) |
| COPILOT w narzędziu | slot AI w M3 (prawa) + sekcja AI panelu + PPM „AI: popraw/uzupełnij" | 🟡 nierówny między narzędziami — audyt w fali (Formuła, kolumna Stan) |
| MULTIPLAYER (Idee) | `ideaCollabWs` org-scope + presence + non-owner read (`resolveMapReadRow`) | 🟡 kod ON; live-verify 2 przeglądarki = B4/B6; non-owner read gap Whiteboard |

## 5. NIEZBĘDNE ZMIANY vs BENCHMARKI (gap-lista → pigułki dla wykonawcy)

| # | Narzędzie vs benchmark | Luka | Rozmiar |
|---|------------------------|------|---------|
| G1 | Excel vs analityk PE | czat→silnik 5-fazowy (B2 wiring, izolacja doc/deck) + montaż grida na FE (KimiWorkspaceShell) zamiast markdownu | M-L (Opus) |
| G2 | Idee vs Miro | live-verify multiplayer (2 przeglądarki) + non-owner read Whiteboard + obrazy na storage R2 (czeka sekret) + edge-UX | S-M |
| G3 | Notatka vs Notion | struktura notebooks (lista→osobiste/zespołowe), lekkość bloków, backlinks/slash later; ukryć fasadę org_context; „przechwyt z czatu" ✅ (B1) | M (etapami) |
| G4 | Idea Table vs Airtable | decyzja tablePlatform (parytet ~85% za flagą OFF — świadomie?); załączniki na R2; komentarze rekordów ✅ | decyzja+S |
| G5 | Deck vs Gamma | świeży dowód head-to-head (stary z 06-22) + PPTX geometria; kompozycja=silnik ✅ | M |
| G6 | Word = wyznacznik | jest najbliżej (proposals/komentarze/eksport/E2E) — dopięcie: tryb czytania klienta, śledź-zmiany UX, decyzja flagi premium | S-M |
| G7 | Copilot wszędzie | wyrównać slot „AI: popraw" per narzędzie wg Formuły (kolumna Stan wykaże braki) | fala artefaktów |
| G8 | KPI derywowane | entry „wyciągnij KPI z inicjatywy/modelu" jako pierwszoklasowa akcja (nie ręczne przepisywanie) | S-M |

## 6. REGUŁY DLA AGENTÓW (nienaruszalne)
1. **Nie przenoś wzorców między trybami**: żadnego „generuj całość" w narzędziach EWOLUCJI; żadnego „domaluj sobie od zera" jako głównego przepływu w KRYSTALIZACJI.
2. **Dokument-krystalizacja: pierwsza wersja MUSI być akceptowalna** → zawsze pełny pipeline z fazą REVIEW zanim user zobaczy. Czas generacji NIE jest argumentem przeciw (klient akceptuje minuty za tydzień pracy analityka).
3. **Żywe ≠ martwe:** w Excelu każda wyliczana wartość = formuła (nigdy zaszyty wynik); w rekordach lifecycle jest osobny od stanu zapisu.
4. **Każde narzędzie ma OBA wejścia AI** (dialog Teresy + copilot w M3/PPM) i PEŁNĄ edytowalność ręczną.
5. **Derywowane rodzi się z rodzica** — konwersja/ekstrakcja z linkiem, nie kopiuj-wklej.
6. Multiplayer TYLKO tam, gdzie doktryna mówi MULTIPLAYER (Idee); dokumenty v1 = sharing+komentarze (decyzja P-1).
