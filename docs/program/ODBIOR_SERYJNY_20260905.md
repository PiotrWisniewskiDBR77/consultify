---
doc_id: odbior-seryjny-20260905
status: ZYWY
---

# Odbiór seryjny — 05.09.2026

Zlecenie właściciela 05.09: „ekrany, których wcześniej nie akceptowaliśmy, przygotuj do
akceptacji seryjnej”. Poniżej cztery grupy ekranów, które NIE wymagają drobiazgowej dyskusji
punkt-po-punkcie — każda ma jedną wspólną przyczynę i jedno wspólne pytanie do właściciela.
Naprawy merytoryczne (gdy potrzebne) są w `PLAN_NAPRAW_MVP_20260905.md` — ten dokument służy
wyłącznie do samej AKCEPTACJI zestawu ekranów na żywo.

**Jak korzystać**: otwórz `http://127.0.0.1:3030/zywo`, ustaw filtr (wszystkie / tylko różnice
/ tylko nie dotarłem), znajdź ekran po ID z tabeli poniżej, porównaj dwa obrazy obok siebie i
kliknij **„OK na żywo”** albo **„Do poprawki”** (z opcjonalną uwagą). Decyzja zapisuje się od
razu do `docs/program/grafika/ODBIOR_ZYWO_DECYZJE.json`.

---

## (a) 9 ekranów, których „zatwierdzony obraz” nie przedstawiał ekranu

Dwie różne awarie przyrządu pomiarowego, nie produktu: **bitowe duplikaty** (ten sam plik PNG
podpisany jako referencja dla dwóch różnych ekranów) i **strony błędu harnessu dev-render**
(„Unknown ?screen=…, Available screens: …” zamiast realnego zrzutu). W obu przypadkach właściciel
NIGDY nie widział ekranu, który rzekomo zaakceptował. Sprawdzono `RAPORT.md` wszystkich 19
pakietów pod kątem innych przypadków tej klasy — doszedł jeden dziewiąty: `calendar-sync-settings`
(referencja „PRZED” to zrzut nieistniejącej listy tras deweloperskich, nie ekranu ustawień;
naprawiono się samo, bo w tym samym katalogu był poprawny obraz „PO”).

**Do zrobienia dla wszystkich 9**: zastąpić wskazaną, zepsutą referencję świeżym zrzutem z tego
odbioru (kolumna „Zrzut na żywo”) i poprosić właściciela o jedno kliknięcie na każdym — to
pierwszy raz, kiedy naprawdę widzi ten ekran, więc to nie „ponowna akceptacja”, tylko pierwsza.

| Id | Moduł | Trasa | Zrzut na żywo (jasny) | Rodzaj awarii przyrządu | Jedno zdanie co pokazać |
|---|---|---|---|---|---|
| `notatnik-centrum-mysli` | Moja praca | `/my-work?notebook=…` | `evidence/odbior-zywo-20260905/02-moja-praca/notatnik-centrum-mysli.png` | Bitowy duplikat obrazu `mywork-notebook-rail-speca` (md5 identyczny) | Realny notatnik — panel prawy z akordeonem, nie „centrum myśli” z zatwierdzonego opisu. |
| `mywork-idea-inspector-lekki` | Moja praca | `/my-work/ideas/…/workspace/mindmap` | `evidence/odbior-zywo-20260905/02-moja-praca/mywork-idea-inspector-lekki.png` | Bitowy duplikat obrazu `ideas-teresa-panel` (md5 identyczny) | Lekki inspektor węzła — klik w węzeł „Problem” otwiera panel z licznikami sekcji po prawej; treściowo zgodny z opisem, tylko obrazu referencyjnego nie było. |
| `ideas-teresa-panel` | Moja praca | `/my-work/ideas/…/workspace/mindmap` | `evidence/odbior-zywo-20260905/02-moja-praca/ideas-teresa-panel.png` | Ten sam duplikat co wyżej — obraz nie pokazywał ŻADNEJ sekcji Teresy | Sekcja AI/Teresa istnieje po LEWEJ stronie kanwy (CAŁA IDEA, ZDROWIE MAPY, dwa przyciski AI) — inny układ niż cokolwiek na duplikowanym obrazie. |
| `notebook-quick-capture` | Moja praca | `/my-work?notebook=…` | `evidence/odbior-zywo-20260905/02-moja-praca/notebook-quick-capture.png` | Strona błędu harnessu „Unknown ?screen=…” | Pasek „Wrzuć myśl lub link…” na górze listy notatek — dokładnie jedno pole, zgodnie z zamierzoną „pustką”. |
| `tools-swot-library-detail` | Narzędzia | `/discovery-tools?docId=known:dynamic-swot` | `evidence/odbior-zywo-20260905/04-narzedzia/tools-swot-library-detail.png` | Strona błędu harnessu (2880×11666 px) | Karta narzędzia „Dynamic SWOT” — nagłówek z akcjami, szyna Przegląd/Jak to działa/Przykład, 4 kafle, prawy panel Akcje+Właściwości. Wygląda dobrze. |
| `tools-swot-session-workspace` | Narzędzia | `/discovery-tools?tab=sessions&docId=…` | `evidence/odbior-zywo-20260905/04-narzedzia/tools-swot-session-workspace.png` | Strona błędu harnessu | Warsztat 5 kroków jako kafle z licznikami, prawy panel Akcje/Właściwości — sesja akurat pusta (0%), to dane, nie układ. |
| `tools-outputs-insights-tab` | Narzędzia | `/discovery-tools?tab=outputs` | `evidence/odbior-zywo-20260905/04-narzedzia/tools-outputs-insights-tab.png` | Strona błędu harnessu | Zakładka „Insighty” NIE jest pusta (7 wierszy) — ale 3 duplikaty i mieszany PL/EN (patrz plan napraw, moduł 04). |
| `tools-sesja-wyjscie` | Narzędzia | `/discovery-tools?tab=sessions&docId=…` | `evidence/odbior-zywo-20260905/04-narzedzia/tools-sesja-wyjscie.png` | Strona błędu harnessu | Wyjście z sesji jest, ale gdzie indziej niż zapowiadał opis (strzałka „<” / chip „Lista”, nie kebab). |
| `calendar-sync-settings` | Spotkania | `/settings/integrations` (Synchronizacja kalendarza) | `evidence/odbior-zywo-20260905/12-spotkania/calendar-sync-settings.png` | Referencja „PRZED” uszkodzona (2880×11474 px, zrzut listy tras deweloperskich) | 3 dostawcy (Google/Outlook/Apple Calendar) z przyciskami Połącz — Outlook, o który prosił właściciel, już jest. |

---

## (b) 11 skonsolidowanych ekranów redesignu Organizacji (zastępują 21 starych)

Od 03.09 (DEC-2026-08-26-78/A3) flaga `orgRedesignV1` jest domyślnie ON. Właściciel 05.09
potwierdził wprost (DEC-2026-09-05-395): **„Organizacja = redesign jako wzorzec”** — czyli nowa
powłoka `OrganizationScreenShell` to nie regresja do zatwierdzenia, tylko NOWY, obowiązujący
wzorzec. Wszystkie 21 starych zatwierdzonych obrazów (`org-identity-operating__PRZED` + 20
miniatur `mini-org-*__PO__light` z `evidence/grafika/216-poprawione-dzis/`) trzeba zastąpić
jedenastoma nowymi. Cztery konkretne błędy zgłoszone przy tej okazji są już naprawione dziś
(SHA w `PLAN_NAPRAW_MVP_20260905.md`, moduł 13) — zrzuty PO w `evidence/org-redesign-20260905/`.

Mapa konsolidacji (zweryfikowana klik po kliku na żywej aplikacji,
`evidence/odbior-zywo-20260905/14-organizacja/RAPORT.md`):

| # | Nowy ekran (adres) | Zakładka(-i) | Stare ekrany, które zastępuje | Zrzut do akceptacji |
|---|---|---|---|---|
| 1 | `/organization/profile/identity-scale` | Tożsamość · Model dostawy (dynamiczna) | `identity-scale`, `operating-model` | Naprawiony: `evidence/org-redesign-20260905/org-operating-model-PO.png` |
| 2 | `/organization/profile/position-direction` | Pozycja i priorytety · Technologia · Kultura i komunikacja · Ograniczenia i ryzyko | `position-direction`, `technology-culture-constraints` | `evidence/org-redesign-20260905/org-technology-culture-constraints-PO.png` |
| 3 | `/organization/goals/strategic-intent` | Intencja strategiczna · Mierniki sukcesu | `strategic-intent`, `success-metrics` | z odbioru na żywo 05.09 (ZGODNY z nową powłoką) |
| 4 | `/organization/goals/scope-boundaries` | Zakres · Tryb współpracy | `scope-boundaries`, `stakeholder-expectations` | Naprawiony: `evidence/org-redesign-20260905/org-stakeholder-expectations-PO.png` |
| 5 | `/organization/challenges/declared-challenges` | Zadeklarowane wyzwania · Dowody | `declared-challenges`, `evidence` | z odbioru na żywo 05.09 |
| 6 | `/organization/challenges/root-causes` | Przyczyny źródłowe · Blokery | `root-causes`, `goal-blockers` | z odbioru na żywo 05.09 |
| 7 | `/organization/strategy/risks-opportunities` | Ryzyka · Szanse | `risks-opportunities` | z odbioru na żywo 05.09 |
| 8 | `/organization/strategy/executive-brief` | Scenariusze transformacji (+ rekomendacja jako baner) · Executive brief | `scenarios`, `recommendation`, `executive-brief` | z odbioru na żywo 05.09 (uwaga: nazwy scenariuszy po angielsku — patrz plan napraw) |
| 9 | `/organization/sources/claims-sources` | jedna strona bez zakładek | `files`, `claims-sources`, `source-conflicts` | z odbioru na żywo 05.09 |
| 10 | `/organization/sources/knowledge-graph` | (własny ekran) | `knowledge-graph` | z odbioru na żywo 05.09 (uwaga: chip „risk” nieprzetłumaczony) |
| 11 | `/organization/readiness/summary` | (własny ekran) | `summary` | Naprawiony: `evidence/org-redesign-20260905/org-summary-PO.png` |

**Jedno pytanie do właściciela dla całej dwunastki**: „Ten nowy, skonsolidowany układ Organizacji
(breadcrumb → pigułki zakładek → chipy liczników → karty treści → prawy panel „STAN DANYCH” z
jednym „Zapisz zmiany”) zastępuje 21 starych ekranów jeden-do-jednego z menu. Akceptujesz go jako
nowy wzorzec dla całego modułu?” — jeśli tak, oznacza to jedną decyzję, nie 21 osobnych kliknięć.

---

## (c) Ekrany zbudowane dziś na nowo (05.09)

| Co | Zrzut PO | Stan zrzutu | Jedno zdanie |
|---|---|---|---|
| Powitanie Czatu (H1, 5 wariantów) + kafle narzędzi bez opisu + kebaby pionowe + zakładki Dok/MD | — | **NIEZMIERZONE — brak dedykowanego folderu zrzutów.** Właściciel już potwierdził słownie 05.09 (DEC-395: „dla czata nie mam żadnych uwag do grafik i układu”), ale zgodnie z zasadą #7 (Piotr nigdy pierwszym testerem — tu odwrotnie, już widział) warto i tak dorobić jeden czysty zrzut do archiwum referencyjnego, bo dziś go nie ma. | Nowe powitanie + kafle + kebaby — słowna akceptacja już jest, brakuje tylko zdjęcia do teczki. |
| Karta inicjatywy — realny rekord | `evidence/inicjatywy-karta-20260905/03-karta-realny-rekord.png` | Gotowy | Karta „Pełna identyfikowalność partii” ładuje się z realnych danych, status „W realizacji”, zero czerwonego błędu. |
| EV football-field — z realnej wyceny | `evidence/inicjatywy-karta-20260905/05-ev-football-field.png` | Gotowy | „Enterprise Value — przedział rekomendowany” na realnym rekordzie (3–7 mld zł), nie na pustej galerii deweloperskiej. |
| Macierz DRD w RAPORCIE oceny | `evidence/drd-raport-20260905/drd-raport-20260905/assessment-report-contract__PO__pl__1440__light.png` | Gotowy | Piąte zgłoszenie tej samej sprawy — macierz właściciela (`DRDMatrixGrid`, 9×7, treść komórek) rysuje się dziś we wszystkich powierzchniach raportowych, nie tylko w prezentacji/dokumencie jak wcześniej. |
| Organizacja po naprawie 4 defektów | `evidence/org-redesign-20260905/org-operating-model-PO.png`, `org-stakeholder-expectations-PO.png`, `org-technology-culture-constraints-PO.png`, `org-summary-PO.png` | Gotowe | Patrz kategoria (b) — 4 z 11 nowych ekranów mają już świeży zrzut PO. |

**EV football-field** świadomie NIE jest osobnym prototypem dev-render (patrz kategoria d w
poprzednich wersjach tego pakietu) — dziś jest osiągalny z realnego rekordu, więc trafia tutaj.

---

## (d) Prototypy istniejące tylko w przyrządzie (BRAK_W_APLIKACJI)

Zgodnie z zasadą #7 CLAUDE.md („Piotr nigdy nie jest pierwszym testerem wizualnym”) — te ekrany
istnieją WYŁĄCZNIE w harnessie dev-render, bez odpowiednika w produkcie. Nie są usterką: to
propozycje czekające na wstępny OK właściciela, zanim ktokolwiek zacznie je budować naprawdę.

| Id | Moduł | Co to jest | Rekomendacja |
|---|---|---|---|
| `cel-jedna-karta` | Wyniki | Prototyp jednej scalonej karty-narracji dla Celu (OKR), zamiast dzisiejszych osobnych zakładek | Pokazać do wstępnego OK — jeśli tak, budować po MVP (fala 2, temat „N-karta”, patrz `results-vnext-roi-*`) |
| `wskaznik-jedna-karta` | Wyniki | To samo dla wskaźnika/KPI | Pokazać do wstępnego OK — po MVP |
| `roi-jedna-karta` | Wyniki | To samo dla ROI | Pokazać do wstępnego OK — po MVP |
| `results-zestawienia` | Wyniki | Nowy POZIOM 1 — rejestr zestawień okresowych, którego dziś nie ma (jest tylko rejestr KPI/Search/Archiwum) | Pokazać do wstępnego OK — po MVP |
| `prawy-pas-jedna-formula-idea-teresa` | Kanon | Wspólny prawy pas z przełącznikiem Artefakt/Teresa dla Idei | Właściciel już wyraził wątpliwość koncepcyjną („nie rozumiem, dlaczego Teresa jest w oknie tego narzędzia, skoro jest osobna Teresa”) — **wyjaśnić koncepcję przed pokazaniem do akceptu**, nie budować |
| `prawy-pas-jedna-formula-idea-artefakt` | Kanon | Wariant artefaktu tej samej koncepcji | jak wyżej |
| `prawy-pas-jedna-formula-notatka-teresa` | Kanon | Wariant dla Notatnika | jak wyżej — ta sama wątpliwość zgłoszona 2× w korpusie |
| `prawy-pas-jedna-formula-notatka-artefakt` | Kanon | Wariant artefaktu dla Notatnika | jak wyżej |
| `standard-module-bar-children` | Kanon | Galeria 6 wariantów `StandardModuleBar` obok siebie — sam pakiet audytu rekomenduje zdjęcie z odbioru ekran-po-ekranie, bo to nie ekran produktu | **Zdjąć z listy odbioru** — nie ma czego akceptować, warianty A–E już widoczne rozproszone na realnych ekranach |
| `document-studio-blocks-i18n` | Materiały | Dev-render trzech komponentów (`DocTableBlock`/`DocKpiStrip`/`DocChartBlock`) w stanie pustym — w aplikacji taki ekran nie istnieje osobno | Pokazać do wstępnego OK tylko jeśli właściciel chce osobny podgląd tych trzech bloków — inaczej zdjąć z listy |

---

## Instrukcja dla właściciela

1. Otwórz **`http://127.0.0.1:3030/zywo`**.
2. Ustaw filtr u góry strony: „wszystkie” / „tylko różnice” / „tylko nie dotarłem” — dla
   ekranów z tego pakietu najwygodniej „wszystkie” i szukać po nazwie z tabel powyżej.
3. Dla każdego ekranu zobaczysz dwa obrazy obok siebie (zatwierdzony i na żywo) + opis różnicy.
4. Kliknij **„OK na żywo”** jeśli akceptujesz to, co widzisz dziś, albo **„Do poprawki”** z
   krótką uwagą, jeśli czegoś brakuje. Decyzja zapisuje się natychmiast.
5. Dla grupy (b) — Organizacja — wystarczy jedna decyzja dla całego nowego wzorca (pytanie
   w sekcji powyżej), nie 21 osobnych kliknięć.
6. Dla grupy (d) — prototypy — to nie jest odbiór „zgodny/różni się”, tylko pytanie „budować
   po MVP, tak czy nie” — odpowiedz w rozmowie, nie przez przycisk na `/zywo`.

## Podsumowanie liczbowe

- Kategoria (a): **9** ekranów z zepsutą referencją, zebranych z 3 pakietów (Moja praca,
  Narzędzia, Spotkania).
- Kategoria (b): **11** nowych ekranów Organizacji zastępujących **21** starych.
- Kategoria (c): **5** pozycji zbudowanych/naprawionych dziś (1 bez zrzutu — do uzupełnienia).
- Kategoria (d): **10** prototypów bez odpowiednika w aplikacji (4 Wyniki, 5 Kanon, 1 Materiały).
