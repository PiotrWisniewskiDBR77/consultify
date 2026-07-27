# DOKTRYNA TREŚCI ARKUSZA EXCEL (SSOT) — co ma być W ŚRODKU liczb

> **Status:** v1.0 · **Data:** 2026-07-27 · **Właściciel:** CTO · **Zadanie:** Faza A / A3
> **Rodzeństwo:**
> `docs/standards/CONCLUSION_LAYER_STANDARD.md` (doktryna wniosku K1→K4 — ten dokument jest jej
> odpowiednikiem dla liczb, nie jej konkurentem) ·
> `docs/product/BUSINESS_PLAN_GENERATOR_SPEC.md` (progi finansowe, SPINE, CFO-review) ·
> `docs/qa/deliverables/DELIVERABLE_STANDARDS_AND_TOOLING.md` §A3 (IBCS/Tufte/Few — warstwa formy) ·
> `docs/product/DELIVERABLE_FORMATTING_SPEC.md` (typografia/numFmt — warstwa formatowania) ·
> `docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md` (rozgraniczenie bytów tabelarycznych).
>
> **Problem, który ten dokument zamyka.** Mamy szczegółowo opisane, JAK zbudować plik .xlsx
> (schema, builder, styler, formaty liczbowe, CF) i mamy 9 deterministycznych reguł, które łapią
> zepsute formuły. **Nie mamy nigdzie zapisanego, JAKIE liczby i JAKIE formuły mają się w arkuszu
> znaleźć i dlaczego.** Dla prezentacji i Worda ten „mózg" istnieje (`narrativeEngine` 5 warstw:
> `server/src/services/narrativeEngine/index.ts:4-9`, + formuła wniosku K1→K4). Dla Excela
> planowanie jest jednym generycznym promptem „You are an expert spreadsheet architect"
> (`server/src/services/workbook/WorkbookGeneratorService.ts:36`), który nie wie, czym różni się
> budżet od wyceny, i którego punkt 7 brzmi „REALISTIC DATA: use realistic numbers for the domain"
> (tamże:50) — czyli wprost zaprasza model do wymyślania liczb.
>
> **Wymaganie właściciela** (`_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md`): N3 — „Excel (tabela)
> — liczby ALE TAKŻE FORMUŁY, żeby można było symulować, przekładać, kombinować"; N8/N16 — brakuje
> „mózgu", który NAJPIERW zaplanuje, co ma być w treści. N17 — „nie wymyślamy koła: prześledzić,
> ukraść i ułożyć" → cała doktryna opiera się na standardach nazwanych z imienia (IBCS/ISO 24896,
> Tufte, Few, FAST, konwencja kolorów modelu finansowego), nie na naszych pomysłach.

---

# §0. ZAKRES — czego ten dokument dotyczy, a czego NIE

| Warstwa | Gdzie mieszka | Ten dokument |
|---|---|---|
| **Byt** — czy to lista, arkusz, czy platforma-tabel | `DOKTRYNA_TABELA_NIE_EXCEL.md` | NIE. Zakładamy, że rozpoznanie już padło: są KOMÓRKI + FORMUŁY → to Excel (tamże §2, reguła rozstrzygająca pkt 2) |
| **TREŚĆ** — jakie założenia, jaki łańcuch obliczeń, jakie wyniki, jaka wrażliwość | *nigdzie* | **TAK — to jest ten dokument** |
| **Forma** — numFmt, CF, wyrównania, fonty, zebra | `DELIVERABLE_FORMATTING_SPEC.md` §5, `DELIVERABLE_STANDARDS_AND_TOOLING.md` §A3 | Tylko tam, gdzie forma NIESIE ZNACZENIE (konwencja kolorów input/formuła/link — §3.4) |
| **Mechanika pliku** — schema→xlsx, sanityzacja formuł, granice ExcelJS | `WorkbookSchema.ts`, `WorkbookBuilder.ts` | NIE |

Doktryna dotyczy **każdego arkusza, który Consultify wypuszcza klientowi** — niezależnie od ścieżki:
Excel z czatu (`WorkbookGeneratorService`), Excel z szablonu (`workbook/templates/*`), Excel z wiązki
biznesplanu (`bundleOrchestrator` → `spineToTableIntent`), Excel z eksportu tabeli.

---

# §1. TEZA — czym jest dobry arkusz Consultify

**Dobry arkusz Consultify to działający MODEL DECYZJI, nie zapis liczb.** Klient nie płaci za to,
że liczby są w kratkach — to dostaje za darmo. Płaci za to, że może zmienić JEDNO założenie i
zobaczyć, jak przesuwa się wynik, na którym opiera decyzję. Dlatego każdy wynik w arkuszu jest
formułą, każde założenie jest wyodrębnione, podpisane i edytowalne, a między jednym a drugim biegnie
jawny, dający się prześledzić łańcuch obliczeń. Arkusz, w którym da się nadpisać wynik bez
przeliczenia modelu, jest zrzutem danych — i nie przechodzi tej doktryny.

Trzy testy rozstrzygające (jeśli którykolwiek FAIL → to nie jest arkusz Consultify):
1. **Test symulacji (N3 Piotra):** zmieniam jedną liczbę na arkuszu Założeń — czy przeliczy się
   CAŁY model, łącznie z arkuszem wyników i porównaniem scenariuszy?
2. **Test audytu (FAST/„Transparent"):** biorę dowolną liczbę wynikową i klikam „pokaż źródło" —
   czy dochodzę do założenia w ≤3 skokach, bez ani jednej stałej po drodze?
3. **Test decyzji (spójność z CONCLUSION_LAYER §1, kroki K3-K4):** czy z arkusza wynika, CO ZROBIĆ — a nie
   tylko, ile wynosi? Jeśli arkusz nie ma miary decyzji (progu, wrażliwości, werdyktu), jest
   kalkulatorem, nie doradztwem.

---

# §2. ★ ANATOMIA MODELU — kanoniczne warstwy arkusza

To jest odpowiednik „planu wywodu" z `narrativeEngine/discoursePlan.ts`, tylko dla liczb.
Warstwa = jeden arkusz (sheet) albo jasno wydzielony blok. Kolejność zakładek = kolejność warstw.

| # | Warstwa | Nazwa zakładki (PL) | Co zawiera | Status |
|---|---|---|---|---|
| **A0** | **Meta / Okładka** | `Info` | tytuł modelu, pytanie decyzyjne (§4 E1), waluta, jednostki, okres, data, autor, legenda kolorów, źródła założeń | **opcjonalna** (obowiązkowa gdy model idzie do klienta zewnętrznego) |
| **A1** | **ZAŁOŻENIA** | `Założenia` | WYŁĄCZNIE surowe wejścia: driver · wartość · jednostka · źródło/benchmark · zakres (min-max) · ranga wrażliwości. Data-validation na każdym wejściu. | **OBOWIĄZKOWA — bez wyjątku** |
| **A2** | **SILNIK** | `Model` / `P&L` / `Budżet` / `Harmonogram` | łańcuch obliczeń: każda komórka = formuła; okresy łańcuchowane (n = f(n−1)); zero stałych | **OBOWIĄZKOWA** |
| **A3** | **WYNIKI** | `Podsumowanie` / `Metryki` / `Wycena` | miary decyzji: 3-8 liczb, po które klient przyszedł (EBITDA, BEP, EV, LTV:CAC, runway), każda jako cross-sheet formuła z A2 | **OBOWIĄZKOWA** |
| **A4** | **WRAŻLIWOŚĆ / SCENARIUSZE** | `Analiza wrażliwości` / `Porównanie` | jak wynik z A3 reaguje na zmianę 1-2 driverów z A1 (tabela 1D/2D) albo Base/Bull/Bear | **OBOWIĄZKOWA dla modeli decyzyjnych** (§6 klasa D), opcjonalna dla ewidencyjnych (klasa E) |
| **A5** | **DASHBOARD** | `Dashboard` | ≤6 kafli KPI + ≤3 wykresy, każdy z jednostką i tytułem-wnioskiem | **opcjonalna** |
| **A6** | **WNIOSEK** | `Wnioski` | K1→K4 wg `CONCLUSION_LAYER_STANDARD` — patrz §8 | **OBOWIĄZKOWA gdy arkusz idzie do klienta samodzielnie** (bez towarzyszącego raportu/decku) |

**Reguły warstw:**
- **R-A1.** Nigdy nie ma dwóch arkuszy Założeń. Jeden model = jedno źródło wejść (FAST: *single
  source of truth*; `BUSINESS_PLAN_GENERATOR_SPEC.md` B1).
- **R-A2.** Warstwa A2 nie zawiera ANI JEDNEJ liczby wpisanej ręcznie. Wyjątek: stałe strukturalne
  (indeks miesiąca, numer okresu) — i te też lepiej jako łańcuch formuł (wzorzec:
  `loanAmortization.ts:27-31` — indeks „Miesiąc" celowo jest formułą `prev+1`, bo goła stała
  fałszywie odpalała regułę WQ-03).
- **R-A3.** Warstwa A3 nie liczy niczego od nowa — wyłącznie referuje do A2
  (wzorzec: `threeScenarioPnL.ts:566-577` — arkusz „Porównanie" to same cross-sheet refy do P&L).
- **R-A4.** Wrażliwość liczy się z ŻYWYCH formuł, nie z zapamiętanych wyników. Tabela wrażliwości,
  która nie przelicza się po zmianie założenia, jest obrazkiem.
- **R-A5.** Kolejność zakładek jest stała i semantyczna (IBCS: *to co znaczy to samo, wygląda tak
  samo*): Info → Założenia → Silnik → Wyniki → Wrażliwość → Dashboard → Wnioski. Kolor zakładki
  koduje warstwę — dziś już częściowo trzymany (`F59E0B` = Założenia, `0C447C` = Silnik,
  `1D9E75` = Wyniki; `threeScenarioPnL.ts:342, 531, 600`). **Ten kod kolorów podnosimy do rangi
  kanonu i rozszerzamy: `7C3AED` = Wrażliwość, `334155` = Info, `B45309` = Wnioski.**

**Minimum żywotne (MVP arkusza):** A1 + A2 + A3. Trzy zakładki. Arkusz z jedną zakładką „dane"
nie jest modelem — jest tabelą i podlega `DOKTRYNA_TABELA_NIE_EXCEL.md`, nie tej doktrynie.

---

# §3. ★ REGUŁA FORMUŁ — sedno wymagania „żeby symulować"

## 3.1. Zasada nadrzędna

> **Wynik nigdy nie jest wpisany. Założenie nigdy nie jest policzone.**

Z tego wynika wszystko inne. Klasyfikacja KAŻDEJ komórki liczbowej jest binarna i musi być jawna:

| Klasa | Definicja | Gdzie wolno | Jak wygląda |
|---|---|---|---|
| **WEJŚCIE (input)** | liczba, której nie da się wyprowadzić z innych liczb w tym modelu — decyzja, obserwacja, cena, stopa, benchmark | **wyłącznie** warstwa A1 | czcionka **niebieska** + tło wejściowe + border + data-validation |
| **FORMUŁA (calc)** | liczba wyprowadzona z komórek TEGO arkusza | A2, A3, A4, A5 | czcionka **czarna**, bez tła |
| **LINK (cross-sheet)** | liczba pobrana z innego arkusza tego samego skoroszytu | A2, A3, A4, A5 | czcionka **zielona** |
| **ZEWNĘTRZNE** | liczba z innego pliku/systemu | tylko A1, oznaczona | czcionka **czerwona** + źródło w kolumnie „Źródło" |

To nie jest nasz wynalazek — to standardowa konwencja modelowania finansowego
(blue-input / black-formula / green-link / red-external), cytowana już u nas w
`DELIVERABLE_STANDARDS_AND_TOOLING.md` §A3 i wymagana przez `BUSINESS_PLAN_GENERATOR_SPEC.md` B13.

## 3.2. Co MUSI być formułą (lista zamknięta)

1. Każda suma, podsuma i total.
2. Każdy wskaźnik i marża (`wynik/przychód`, `LTV/CAC`, `%` udziału).
3. Każdy okres n>1 w projekcji — liczony z okresu n−1, nigdy wpisany niezależnie.
   (Wzorzec: `threeScenarioPnL.ts:423-427` `Yn = Y(n-1)*(1+growth)`.)
4. Każda pozycja kosztowa wyprowadzona z drivera (`Revenue * cogsPct`), nawet gdy „i tak wyjdzie
   ta sama liczba".
5. Każde saldo narastające / roll-forward: `Begin = prior End + inflows − outflows`
   (`BUSINESS_PLAN_GENERATOR_SPEC.md` B4; wzorzec: `cashflow12m.ts:19-21`, `loanAmortization.ts:15-20`).
6. Każda komórka warstw A3/A4/A5 — bez wyjątku (te warstwy są z definicji pochodne).
7. Każda wartość w kolumnie/wierszu, w którym sąsiedzi są formułami (zasada spójności kolumny —
   dziś egzekwuje ją reguła WQ-09, `workbookQualityGate.ts:720-769`).

## 3.3. Co MOŻE być wartością (lista zamknięta)

1. Wejścia na arkuszu Założeń (A1) — i **tylko** tam.
2. Etykiety, nazwy okresów, jednostki (tekst).
3. Parametry KSZTAŁTU modelu, rozstrzygane przy budowie, nie w Excelu: liczba lat horyzontu,
   liczba rat, opóźnienie płatności. Są to wartości, bo zmieniają STRUKTURĘ (liczbę kolumn/wierszy),
   której Excel nie przebuduje sam. Ta granica jest już świadomie zaimplementowana i dobrze
   udokumentowana — `dcfValuation.ts:22-26`, `cashflow12m.ts:22-25`, `loanAmortization.ts:22-25`.
   **Każdy taki parametr MUSI być mimo to wypisany na arkuszu Założeń jako pozycja informacyjna**
   z adnotacją „zmiana wymaga regeneracji modelu" — inaczej klient nie wie, czego nie może ruszyć.

## 3.4. Reguła scenariusza (bezpośrednio z N3 „żeby symulować, przekładać, kombinować")

> **Scenariusz zmienia się przez zmianę ZAŁOŻENIA, nigdy przez przepisanie wyniku.**

Dwa dopuszczalne kształty, obydwa legalne, wybór jest świadomy:
- **Kolumny per scenariusz** (Base/Bull/Bear obok siebie) — gdy celem jest PORÓWNANIE i audyt.
  Wzorzec i uzasadnienie decyzji: `threeScenarioPnL.ts:12-19`.
- **Przełącznik scenariusza** (`scenarioSwitch`: dropdown + `CHOOSE/MATCH`) — gdy celem jest
  INTERAKTYWNA symulacja jednego aktywnego przypadku. Schema to wspiera, generator o tym wie
  (`WorkbookGeneratorService.ts:240`), **ale żaden z 7 szablonów tego nie używa — LUKA §7.**

Zabronione: trzy niemal identyczne arkusze z ręcznie przepisanymi liczbami dla trzech scenariuszy.

## 3.5. Reguła referencji

- Cross-sheet ref zawsze **absolutny** do arkusza Założeń: `'Założenia'!$B$3` (wzorzec:
  `threeScenarioPnL.ts:211-213`).
- **Zero odwołań cyklicznych.** Twardy zakaz (`BUSINESS_PLAN_GENERATOR_SPEC.md` B10). Klasyczna
  pułapka: odsetki ↔ saldo zadłużenia ↔ przepływ ↔ odsetki. Rozwiązanie doktrynalne: licz odsetki
  od salda OTWARCIA okresu, nie od średniego salda.
- Zero duplikatów wejścia: ta sama liczba nie może wystąpić jako stała na dwóch arkuszach
  (dziś łapie to WQ-03, `workbookQualityGate.ts:360-411`).
- Zakres `SUM` pokrywa DOKŁADNIE wiersze danych nad totalem — bez luk i bez nadmiaru
  (dziś WQ-02, `workbookQualityGate.ts:277-356`).

---

# §4. ★ SEKWENCJA E1→E5 — jak mózg ma planować arkusz

To jest brakujący element z N8/N16: **plan treści PRZED generowaniem**. Odpowiednik K1→K4 dla
liczb. Sekwencja jest nazwana, powtarzalna i prompt-ready — §4.7 zawiera gotowy kontrakt.

### E1. PYTANIE DECYZYJNE — „jaką decyzję ten arkusz ma rozstrzygnąć?"
Z zadania użytkownika („zrób budżet operacyjny dla firmy X") wyprowadź **jedno zdanie pytające
z rozstrzygnięciem binarnym lub progiem**. Nie „pokaż budżet", tylko: *„Czy przy planowanym wzroście
kosztów stałych firma X utrzyma dodatni wynik operacyjny przez wszystkie 12 miesięcy — a jeśli nie,
w którym miesiącu przestanie?"*

Test operacyjny (kalka z `CONCLUSION_LAYER_STANDARD` R3, falsyfikowalność):
**czy przy innych danych odpowiedź brzmiałaby inaczej?** Jeśli nie — to nie jest pytanie decyzyjne.
Drugi test: **czy to pytanie pasowałoby do dowolnej firmy na świecie?** Jeśli tak — jest ogólnikiem.

Wyjście E1: `decisionQuestion` (1 zdanie) + `decisionMetric` (nazwa miary, która na nie odpowiada)
+ `threshold` (próg, przy którym odpowiedź się zmienia).

### E2. ZMIENNE STERUJĄCE — „od czego ta odpowiedź zależy?"
Rozłóż `decisionMetric` na **MECE driver-tree** — każda liczba ma nazwanego rodzica, rodzic jest
arytmetyką dzieci (`BUSINESS_PLAN_GENERATOR_SPEC.md` A1). Zejdź do liści = wejść.

Dla każdego liścia obowiązkowo pięć pól:
`nazwa · wartość · jednostka · źródło (skąd, rok) · zakres min-max · ranga wrażliwości (1-3)`.

Twarde reguły E2:
- **Liść bez źródła to nie jest fakt — to założenie i MUSI być tak oznaczone** („(założenie)").
  Reguła istnieje już w prompcie planowania (`WorkbookGeneratorService.ts:51`), doktryna ją utrzymuje.
- **Zakres, nie fałszywa precyzja.** „22,7% marży" bez zakresu = pozorna pewność (anty-wzorzec A9).
- **3-8 wejść.** Poniżej 3 → to kalkulator, nie model. Powyżej 8 → nikt tego nie przesymuluje;
  scal do driverów wyższego rzędu.
- Jeśli liścia nie da się ugruntować ani w zadaniu, ani w kontekście organizacji — **zostaw
  domyślną wartość szablonu i oznacz ją**, nigdy nie wymyślaj liczby (reguła istnieje dla ścieżki
  szablonowej: `WorkbookGeneratorService.ts:201`; doktryna rozciąga ją na ścieżkę generyczną).

Wyjście E2: lista wejść = **kompletna zawartość warstwy A1**.

### E3. SILNIK — „jaki łańcuch przerabia wejścia na odpowiedź?"
Wypisz łańcuch obliczeń jako ciąg równań, ZANIM powstanie jakakolwiek komórka. Dokładnie tak, jak
robią to dziś nagłówki szablonów (wzorzec do naśladowania: `threeScenarioPnL.ts:27-39`,
`unitEconomics.ts:14-22`, `breakEven.ts:12-22` — każdy szablon otwiera się blokiem „The math").

Wymagania E3:
- Każde równanie w postaci `wynik = f(wejścia | wcześniejsze wyniki)`. Zero równań, w których po
  prawej stronie stoi liczba.
- Jawna **oś czasu i jednostka** (miesiąc/rok, PLN/EUR, netto/brutto) — jedna dla całego modelu.
- Jawny **kierunek zależności** (graf acykliczny). Cykl wykryty na tym etapie = przeprojektowanie
  łańcucha, nie obejście w Excelu.
- **Tożsamości kontrolne**: wskaż co najmniej jedną sumę, która MUSI się domykać (np. suma pozycji
  = total; przepływ narastający = saldo końcowe). To jest przyszła bramka §5.

Wyjście E3: lista równań = **specyfikacja warstwy A2**.

### E4. WYNIKI — „które 3-8 liczb odpowiada na pytanie z E1?"
Wybierz miary decyzji, nie „wszystko, co się policzyło". Każda pozycja warstwy A3 musi mieć:
`nazwa · formuła (ref do A2) · jednostka · próg/benchmark · kierunek dobry (↑/↓)`.

Bez progu liczba nie jest miarą decyzji, tylko liczbą. Progi bierzemy z nazwanych źródeł, nie
z sufitu — dla modeli SaaS/inwestycyjnych mamy je już zaimplementowane deterministycznie:
LTV:CAC ≥ 3 i sufit wiarygodności ≤ 8, CAC payback ≤ 24 mies. i podłoga realizmu ≥ 3 mies.,
Rule of 40 ≥ 40 (`server/src/services/deliverables/financialEngine.ts:359-377`).

Wyjście E4: lista miar = **specyfikacja warstwy A3** + wejście do bramki progów.

### E5. WRAŻLIWOŚĆ I WNIOSEK — „co musiałoby się zmienić, żeby odpowiedź była inna?"
Dwa produkty, oba obowiązkowe dla modeli decyzyjnych:
1. **Wrażliwość** na 1-2 driverach o najwyższej randze z E2 — tabela 1D lub 2D, żywe formuły
   (warstwa A4). Wskaż **punkt przełamania**: przy jakiej wartości drivera miara z E4 przecina próg.
2. **Wniosek** wg `CONCLUSION_LAYER_STANDARD` K1→K4 (warstwa A6, patrz §8).

Wyjście E5: specyfikacja A4 + A6.

### 4.6. Mapowanie E → A (kontrola kompletności planu)

| Krok | Produkuje warstwę | Bramka |
|---|---|---|
| E1 | A0 (nagłówek/pytanie) | pytanie falsyfikowalne, ma próg |
| E2 | **A1 Założenia** | 3-8 wejść, każde ze źródłem/zakresem/rangą |
| E3 | **A2 Silnik** | wszystkie równania, graf acykliczny, ≥1 tożsamość kontrolna |
| E4 | **A3 Wyniki** | 3-8 miar, każda z progiem i kierunkiem |
| E5 | A4 + A6 | ≥1 tabela wrażliwości z punktem przełamania + wniosek K1→K4 |

**Plan, w którym którykolwiek krok jest pusty, nie idzie do generacji.** To jest dokładnie ta
bramka, której dziś nie ma: dzisiejsza faza CONFIRM sprawdza plan pod kątem *kompletności wobec
prośby użytkownika* i wykonalności formuł (`WorkbookGeneratorService.ts:83-114`), ale nie ma
pojęcia o E1-E5 — plan bez założeń i bez wrażliwości przechodzi.

### 4.7. Kontrakt prompt-ready (do wstawienia jako faza PLAN)

```
Jesteś modelarzem finansowym firmy doradczej. Zanim powstanie jakakolwiek komórka,
planujesz MODEL wg sekwencji E1→E5 (docs/… _DOKTRYNA_TRESCI_EXCEL §4).

E1  Sformułuj JEDNO pytanie decyzyjne z progiem. Test: przy innych danych
    odpowiedź brzmiałaby inaczej; pytanie nie pasuje do dowolnej firmy.
E2  Rozłóż miarę z E1 na driver-tree MECE. Zwróć 3-8 LIŚCI = wejścia modelu.
    Każde: nazwa, wartość, jednostka, źródło (skąd/rok) LUB "(założenie)",
    zakres min-max, ranga wrażliwości 1-3.
    NIGDY nie wymyślaj wartości drivera bez podstawy — zostaw domyślną i oznacz.
E3  Wypisz ŁAŃCUCH RÓWNAŃ: wynik = f(wejścia | wcześniejsze wyniki). Zero liczb
    po prawej stronie. Podaj oś czasu, walutę i ≥1 tożsamość kontrolną
    (suma, która musi się domykać). Graf musi być ACYKLICZNY.
E4  Wybierz 3-8 MIAR DECYZJI odpowiadających na E1. Każda: formuła (ref do E3),
    jednostka, próg/benchmark ze źródłem, kierunek dobry.
E5  Wskaż 1-2 drivery o najwyższej randze → tabela wrażliwości (1D/2D)
    + PUNKT PRZEŁAMANIA (wartość drivera, przy której miara przecina próg).
    Dodaj szkic wniosku K1→K4 (co jest → co znaczy → co robić → jaki efekt).

Zwróć WYŁĄCZNIE JSON:
{ "decisionQuestion": "", "decisionMetric": "", "threshold": "",
  "inputs":[{"name","value","unit","source","rangeMin","rangeMax","sensitivityRank"}],
  "equations":[{"output","formula","period"}],
  "identities":["…"],
  "results":[{"name","formulaRef","unit","threshold","goodDirection"}],
  "sensitivity":{"drivers":[],"grid":"1D|2D","breakEven":""},
  "conclusionDraft":{"k1","k2","k3","k4"},
  "sheets":[{"layer":"A0|A1|A2|A3|A4|A5|A6","name","purpose"}] }
```

---

# §5. KRYTERIA JAKOŚCI — bramki mierzalne

Bramki dzielą się na **istniejące** (zaimplementowane, `critiqueWorkbook`) i **doktrynalne**
(wynikają z tego dokumentu, dziś nie mierzone — oznaczone **LUKA**).

## 5.1. Bramki istniejące (`server/src/services/workbook/workbookQualityGate.ts`)

| Kod | Co bada | Waga | Linia |
|---|---|---|---|
| WQ-01 | stała liczba w wierszu podsumowania / kolumnie obliczalnej | CRITICAL / MAJOR | :234-273 |
| WQ-02 | zakres `SUM` urwany lub za szeroki | CRITICAL / MAJOR | :277-356 |
| WQ-03 | wejście zduplikowane jako stała poza arkuszem Założeń | MAJOR | :360-411 |
| WQ-04 | mieszane formaty w kolumnie waluta/% ; goła liczba wśród sformatowanych | MAJOR / MINOR | :420-507 |
| WQ-05 | kolumna `percent` bez formatu % | MAJOR | :447-467 |
| WQ-06 | formuła referuje nieistniejący arkusz / poza granice | CRITICAL / MAJOR | :511-580 |
| WQ-07 | uszkodzony prefiks `=` (psuje plik) | CRITICAL | :600-644 |
| WQ-08 | cross-sheet ref poza zakresem istniejącego arkusza | MAJOR | :654-701 |
| WQ-09 | kolumna obliczeniowa z „zapomnianą" formułą | MAJOR | :720-769 |

Punktacja: CRITICAL −25, MAJOR −10, MINOR −3; `passed` = brak CRITICAL (:88-92, :802).
Pętla naprawcza: max 2 iteracje, potem buduje mimo wszystko (`WorkbookGeneratorService.ts:377`).

## 5.2. Bramki doktrynalne do dołożenia

| Kod | Reguła | Próg | Stan |
|---|---|---|---|
| **DX-01** | Arkusz Założeń istnieje i jest jedyny | 1 arkusz z `isAssumptions` | **LUKA** — WQ-03 działa tylko *jeśli* arkusz Założeń istnieje (`:362-363` — brak arkusza = reguła milczy). Model bez założeń przechodzi na 100 pkt. |
| **DX-02** | Zero odwołań cyklicznych | 0 cykli | **LUKA** — taksonomia ma klasę `formula_cycle_detected` (`server/src/services/v8/exceleCanon.ts:117-121`), ale **żadna z 9 reguł jej nie emituje**. Wymóg B10 z `BUSINESS_PLAN_GENERATOR_SPEC` jest niepilnowany. |
| **DX-03** | Udział formuł w warstwach A2-A4 | ≥95% komórek liczbowych | **LUKA** (WQ-01/09 łapią przypadki, nie mierzą pokrycia) |
| **DX-04** | Każde wejście ma jednostkę, źródło i zakres | 100% wierszy A1 | **LUKA** — dziś kolumny Założeń to `Driver | Wartość` (`unitEconomics.ts:153-156`), bez `Jednostka/Źródło/Zakres` |
| **DX-05** | Tożsamości kontrolne domykają się | odchylenie = 0 (do zaokrągleń) | **LUKA** |
| **DX-06** | Miary decyzji mają próg | 100% pozycji A3 | **LUKA** w ścieżce workbook (istnieje w `financialEngine.ts:359-377` dla ścieżki bizplanu) |
| **DX-07** | Model decyzyjny ma warstwę wrażliwości | ≥1 tabela / porównanie scenariuszy | **LUKA** — 1/7 szablonów ma (`breakEven.ts:285`) |
| **DX-08** | Sensowność biznesowa progów (marże, LTV:CAC, payback, Rule of 40) | wg `BUSINESS_PLAN_GENERATOR_SPEC` C2-C3 | **LUKA w ścieżce Excela** — `runCfoReview` istnieje (`financialEngine.ts:323`), workbook go NIE woła (grep `spine|factBook` w `server/src/services/workbook/` = 0 trafień) |
| **DX-09** | Konwencja kolorów input/formuła/link czytelna | 100% wejść oznaczonych | **CZĘŚCIOWO** — jest TŁO wejść (`FFF6DF`, `threeScenarioPnL.ts:235`), nie ma KOLORU CZCIONKI ani zieleni dla cross-sheet; prompt nazywa to „blue-input/black-formula convention" mimo że koloru czcionki nie ustawia (`WorkbookGeneratorService.ts:228`) |
| **DX-10** | Legenda kolorów obecna w arkuszu | 1 blok na A0 lub A1 | **LUKA** — bez legendy konwencja jest niewidoczna dla klienta |

## 5.3. Bramki formy (już opisane gdzie indziej — tu tylko wskazanie)
numFmt per typ, negatywy `[Red]`, liczby do prawej z wyrównaniem dziesiętnym, nagłówek bold +
zamrożony, minimalne linie siatki, ≤6-8 kolorów colorblind-safe, wykres ≤6 serii bez 3D —
`DELIVERABLE_STANDARDS_AND_TOOLING.md` §A3 „Liczby" + `DELIVERABLE_FORMATTING_SPEC.md` §5.

---

# §6. TYPOLOGIA ZADAŃ → ARCHETYP MODELU

Dwie klasy nadrzędne:
- **Klasa D (decyzyjne)** — odpowiadają na pytanie „czy / kiedy / ile trzeba, żeby". Warstwy
  A1-A4 obowiązkowe.
- **Klasa E (ewidencyjne)** — pokazują strukturę i harmonogram bez pytania decyzyjnego.
  Warstwa A4 opcjonalna.

| # | Prośba użytkownika (typowa) | Archetyp | Klasa | Pokrycie dziś |
|---|---|---|---|---|
| T1 | „budżet operacyjny / plan kosztów na rok" | budżet 12-mies. z RAZEM i podsumowaniem | E | ✅ `operatingBudget.ts` (Założenia · Budżet · Podsumowanie) |
| T2 | „prognoza wyników / P&L na 3 lata, scenariusze" | 3-scenariuszowy P&L | D | ✅ `threeScenarioPnL.ts` (Założenia · P&L · Porównanie) |
| T3 | „ile jest warta ta spółka / wycena" | DCF | D | ✅ `dcfValuation.ts` (Założenia · Projekcja FCF · Wycena) |
| T4 | „od ilu sztuk zaczynamy zarabiać" | próg rentowności | D | ✅ `breakEven.ts` (Założenia · Próg rentowności · **Analiza wrażliwości**) |
| T5 | „czy starczy nam gotówki / kiedy zabraknie" | cash-flow 12-mies. z saldem narastającym | D | ✅ `cashflow12m.ts` (Założenia · Przepływy · Podsumowanie) |
| T6 | „czy nasz model SaaS się spina" | ekonomia jednostkowa (LTV/CAC/payback/NRR) | D | ✅ `unitEconomics.ts` (Założenia · Metryki · Projekcja 12m) |
| T7 | „harmonogram spłaty kredytu / leasingu" | amortyzacja annuitetowa | E | ✅ `loanAmortization.ts` (Założenia · Harmonogram) |
| T8 | „porównaj warianty A/B/C — który wybrać" | **analiza scenariuszy / decyzja wielokryterialna** | D | ❌ **LUKA** — T2 porównuje 3 scenariusze JEDNEGO modelu, nie 3 różne opcje decyzyjne |
| T9 | „czy ta inwestycja się opłaca" (NPV/IRR/payback) | **cost-benefit / ocena projektu** | D | ❌ **LUKA** — DCF wycenia SPÓŁKĘ, nie PROJEKT; brak IRR, brak okresu zwrotu inwestycji |
| T10 | „plan vs wykonanie, gdzie odjechaliśmy" | **budget vs actual + analiza odchyleń** | D | ❌ **LUKA** — wprost wymieniona jako pożądane rozszerzenie w `templates/index.ts` („budget-vs-actual") |
| T11 | „dashboard KPI dla zarządu" | **dashboard wskaźnikowy** | E | ❌ **LUKA** — brak archetypu warstwy A5; wykresy tylko jako obrazki (`WorkbookSchema.ts:276-281, 338-341`), ExcelJS nie ma natywnych wykresów |
| T12 | „ile nas kosztuje / ile potrzeba ludzi" | **model zasobów / capacity** | D | ❌ **LUKA** |
| T13 | „macierz ryzyk z punktacją" | rejestr ryzyk | E | ⚠️ to zwykle **LISTA**, nie arkusz — patrz `DOKTRYNA_TABELA_NIE_EXCEL.md` §1 |

**Podsumowanie pokrycia: 7/12 realnych archetypów Excela.** Największe luki (w kolejności wartości
dla doradztwa): **T9 cost-benefit z NPV/IRR** → **T10 budget vs actual** → **T8 porównanie wariantów**
→ **T12 capacity** → **T11 dashboard**.

**Reguła routingu.** Gdy zadanie pasuje do zarejestrowanego archetypu — parametryzujemy szablon,
nie projektujemy modelu od zera (teza niezawodności biblioteki: `templates/index.ts:5-9`). Gdy
nie pasuje — ścieżka generyczna, ale plan MUSI przejść E1-E5 (§4.6). Dzisiejszy matcher ma dobrą
regułę „w razie wątpliwości nie dopasowuj" (`WorkbookGeneratorService.ts:196`) i to zostaje.

---

# §7. KSIĘGA FAKTÓW — jak arkusz ma się wiązać z resztą artefaktów

**Problem:** ten sam projekt opisany w decku, w raporcie i w arkuszu pokazuje trzy różne liczby,
bo każda ścieżka autoruje je od nowa.

**Mechanizm już istnieje po stronie wiązki deliverables:**
`server/src/services/deliverables/factBook.ts` — jeden rejestr faktów + tokeny `{{fact:key}}`,
renderer podstawia KANONICZNĄ sformatowaną wartość, plus audyt wykrywający liczby sprzeczne
z kanonem (tamże:1-11, `renderFactReferences` :47-58, `FactContradiction` :60-66). Zasada
nadrzędna: **tabela finansowa jest źródłem prawdy, raport i deck POBIERAJĄ liczby, nie re-autorują**
(`BUSINESS_PLAN_GENERATOR_SPEC.md` D2-D3).

**Stan faktyczny — dwie rozłączne ścieżki:**
- ✅ Ścieżka wiązki: `bundleOrchestrator` → `spineToTableIntent` (`bundleOrchestrator.ts:584`) →
  `tableSchemaGeneratorService` → `tableSchemaToWorkbook`; `factBook` konsumowany przez
  `bundleGenerationRuntime.ts` i `provenance.ts` (to jedyni konsumenci).
- ❌ Ścieżka Excela z czatu/szablonu: **`server/src/services/workbook/**` nie zawiera ani jednego
  odwołania do `factBook`, `spine` czy `financialEngine`** (grep: 0 trafień). Arkusz wygenerowany
  z czatu nie wie nic o liczbach organizacji ani o liczbach w decku obok. **To jest LUKA nr 1
  spójności produktu.**

**Doktryna (docelowo):**
1. Każda liczba w warstwie A1 (Założenia) ma pole `factRef` — klucz w księdze faktów organizacji,
   albo jawnie `null` + „(założenie)”. Trzeci stan nie istnieje.
2. Miary z warstwy A3 są **rejestrowane** w księdze faktów jako fakty kanoniczne — arkusz jest
   PRODUCENTEM faktów, nie tylko konsumentem. Deck i raport o tym samym projekcie podstawiają je
   przez `{{fact:key}}`, a nie przepisują.
3. Audyt sprzeczności (`factBook` `FactContradiction`) uruchamiany na parze arkusz↔deck↔raport
   przed publikacją; sprzeczna liczba blokuje publikację, nie ostrzega.
4. Zasada zgodna z `CONCLUSION_LAYER_STANDARD` R5: **LLM nigdy nie liczy i nigdy nie wymyśla
   liczb** — w Excelu ta reguła realizuje się przez to, że LLM emituje FORMUŁY i WEJŚCIA, a liczy
   Excel.

---

# §8. WARSTWA WNIOSKÓW W ARKUSZU (spójność z CONCLUSION_LAYER_STANDARD)

Ta doktryna nie tworzy drugiego standardu wniosku — przenosi istniejący na powierzchnię arkusza
jako **wariant W6** (rodzeństwo dla W1-W5 z `CONCLUSION_LAYER_STANDARD` §3).

Arkusz idący do klienta samodzielnie ma zakładkę `Wnioski` (warstwa A6) o strukturze:

| Blok | Krok formuły | Treść w arkuszu |
|---|---|---|
| **Odpowiedź** | answer-first | jedno zdanie odpowiadające na pytanie z E1 — teza, nie temat |
| **Co jest** | K1 | 3-8 miar z warstwy A3, **jako cross-sheet formuły** (nie przepisane liczby) + porównanie z progiem |
| **Co to znaczy** | K2 | interpretacja przy jawnym wskazaniu drivera z E2, który to napędza |
| **Co robić** | K3 | maks. 3 akcje, każda z rolą odpowiedzialną |
| **Jaki efekt** | K4 | efekt mierzalny + horyzont |
| **Czego nie wiemy** | uczciwość dowodowa | lista wejść oznaczonych „(założenie)" + ranga ich wrażliwości |

Dwie reguły specyficzne dla arkusza:
- **Wnioski przeliczają się razem z modelem.** Każda liczba w tekście wniosku jest referencją
  (`="…EBITDA wynosi "&TEKST(Podsumowanie!B5;"# ##0")&" zł…"`), nigdy wpisaną wartością. To jest
  excelowy odpowiednik `{{fact:key}}` i jedyny sposób, żeby wniosek nie skłamał po zmianie założenia.
- **Tytuł każdego wykresu i każdej zakładki wynikowej jest zdaniem-wnioskiem**, nie etykietą
  („Marża spada od Q3 mimo rosnących przychodów", nie „Wykres 3") — kalka z W5
  (`CONCLUSION_LAYER_STANDARD` §3 W5) i `DRD_REPORT_SPEC` §3.

---

# §9. ANTYWZORCE — czego dobry arkusz NIE robi

| # | Antywzorzec | Dlaczego zabójczy | Wykrywalne? |
|---|---|---|---|
| **AW-1** | **Wynik wpisany na sztywno** („EBITDA: 1 240 000") | zabija symulację — model kłamie po pierwszej zmianie założenia | ✅ WQ-01 |
| **AW-2** | **Brak arkusza Założeń** — drivery rozsiane po modelu | nie da się zasymulować ani zaudytować; klient nie wie, co wolno ruszyć | ❌ **LUKA DX-01** |
| **AW-3** | **Ten sam input wpisany na dwóch arkuszach** | rozjazd przy pierwszej korekcie | ✅ WQ-03 |
| **AW-4** | **Trzy niemal identyczne arkusze scenariuszy z ręcznie przepisanymi liczbami** | scenariusz przestaje być scenariuszem, staje się trzema zdjęciami | ❌ LUKA |
| **AW-5** | **Odwołanie cykliczne** (odsetki↔saldo) | Excel pokazuje 0 albo ostrzeżenie; model traci wiarygodność | ❌ **LUKA DX-02** |
| **AW-6** | **Liczby z LLM bez źródła podane jako fakty** | to jest ryzyko reputacyjne, nie estetyka | ⚠️ częściowo (oznaczanie „(założenie)": `WorkbookGeneratorService.ts:51`, `:201`) |
| **AW-7** | **40 kolumn bez hierarchii** — wszystko na jednym arkuszu | nieczytelne; łamie IBCS (stała kolejność, semantyczna notacja) i data-ink Tuftego | ❌ LUKA |
| **AW-8** | **Wykres bez jednostki / bez tytułu-wniosku / 3-D / >6 serii** | chartjunk; wykres przestaje być argumentem | ❌ LUKA (brak natywnych wykresów, `WorkbookSchema.ts:276-279`) |
| **AW-9** | **Fałszywa precyzja** („22,73% marży" z modelu, którego wejścia mają ±5 p.p.) | pozorna pewność; anty-wzorzec A9 z `BUSINESS_PLAN_GENERATOR_SPEC` | ❌ LUKA |
| **AW-10** | **„Kij hokejowy" bez drivera** — wzrost przyspiesza bez zmiany założenia | klasyczny wzorzec niewiarygodnej prognozy | ⚠️ istnieje detektor, ale tylko dla ścieżki bizplanu (`financialAntiPatterns.ts:29+`), nie dla Excela |
| **AW-11** | **Kolumna miesza formuły i stałe** | „zapomniana formuła" — najczęstszy błąd LLM | ✅ WQ-09 |
| **AW-12** | **Total, który nie sumuje swoich wierszy** | najbardziej wstydliwy błąd u klienta | ✅ WQ-02 |
| **AW-13** | **Arkusz bez pytania decyzyjnego** — „oto liczby" | klient dostaje kalkulator zamiast doradztwa; łamie tezę §1 i CONCLUSION_LAYER | ❌ **LUKA — domyka to sekwencja E1** |
| **AW-14** | **Legenda kolorów nieobecna** przy stosowanej konwencji input/formuła | konwencja niewidoczna = konwencji nie ma | ❌ LUKA DX-10 |

---

# §10. STAN DZISIEJSZY — dowód plik:linia

**Co JEST i jest dobre (do utrzymania, nie do przepisywania):**
- Warstwa Założeń jako osobny arkusz z data-validation, named ranges i tłem wejść — konsekwentnie
  we wszystkich 7 szablonach (`threeScenarioPnL.ts:331-343`, `unitEconomics.ts:216-226`).
- Łańcuchowanie okresów formułą (`threeScenarioPnL.ts:423-427`, `cashflow12m.ts:19-21`).
- Świadoma i udokumentowana granica „parametr kształtu vs wejście modelu"
  (`dcfValuation.ts:22-26`, `loanAmortization.ts:22-31`).
- 9 deterministycznych reguł jakości + pętla naprawcza z limitem 2 iteracji
  (`workbookQualityGate.ts`, `WorkbookGeneratorService.ts:377`).
- Rejestr szablonów samoopisujący się (parametry z labelami i defaultami) — `templates/index.ts:12-17`.
- Reguły anty-fabrykacyjne w promptach (`WorkbookGeneratorService.ts:51`, `:201`).

**Czego NIE MA (LUKI, zebrane):**

| # | Luka | Dowód |
|---|---|---|
| L1 | **Brak doktryny treści = brak planu E1-E5.** Faza PLAN to generyczny „spreadsheet architect"; nie pyta o pytanie decyzyjne, driver-tree, progi ani wrażliwość | `WorkbookGeneratorService.ts:36-77` |
| L2 | **Faza CONFIRM nie waliduje kompletności modelu** — sprawdza zgodność z prośbą i wykonalność formuł, nie obecność Założeń/Wyników/Wrażliwości | `WorkbookGeneratorService.ts:83-114` |
| L3 | **Brak detekcji cykli** mimo istniejącej klasy błędu w taksonomii | `exceleCanon.ts:117-121` vs 9 reguł w `workbookQualityGate.ts:50-59` |
| L4 | **Brak bramki „arkusz Założeń istnieje"** — WQ-03 milczy, gdy arkusza nie ma | `workbookQualityGate.ts:362-363` |
| L5 | **Konwencja kolorów tylko jako tło, bez kolorów czcionki i bez zieleni cross-sheet**; prompt nazywa ją „blue-input/black-formula" mimo że koloru nie ustawia | `WorkbookGeneratorService.ts:228` vs `threeScenarioPnL.ts:235` |
| L6 | **Arkusz Założeń bez kolumn Jednostka / Źródło / Zakres / Ranga wrażliwości** | `unitEconomics.ts:153-156`, `threeScenarioPnL.ts:226-231` |
| L7 | **Prymitywy interaktywne martwe**: `scenarioSwitch`, `sensitivityTables`, `chartImages` istnieją w schemacie i w prompcie, ale ŻADEN z 7 szablonów ich nie używa | grep w `templates/*.ts` = 0 trafień |
| L8 | **Excel odcięty od księgi faktów i od CFO-review** — `workbook/**` nie zna `factBook`, `spine` ani `financialEngine` | grep = 0 trafień |
| L9 | **Brak warstwy wniosku w arkuszu** — żaden szablon nie ma zakładki `Wnioski` | grep `conclusion|wniosek` w `workbook/**` = 0 |
| L10 | **5 z 12 archetypów niepokrytych** (T8-T12) | §6 |

---

# §11. DoD — checklista odbioru arkusza (do klikania przy każdym odbiorze)

**Treść (ta doktryna):**
1. Czy arkusz odpowiada na jedno, jawnie zapisane pytanie decyzyjne? (E1)
2. Czy istnieje JEDEN arkusz Założeń i czy każde wejście ma jednostkę, źródło albo „(założenie)",
   zakres i rangę wrażliwości? (E2 / A1)
3. Czy każda liczba poza Założeniami jest formułą? (§3.2) — próbka: 5 losowych komórek wynikowych.
4. Czy zmiana jednego założenia przelicza CAŁY model łącznie z Wynikami i Porównaniem? (test §1.1)
5. Czy każda miara w Wynikach ma próg i kierunek? (E4)
6. Czy jest warstwa wrażliwości z punktem przełamania (dla klasy D)? (E5)
7. Czy jest wniosek K1→K4 i czy jego liczby są referencjami, a nie wpisanymi wartościami? (§8)
8. Czy da się prześledzić dowolną liczbę wynikową do założenia w ≤3 skokach? (test §1.2)
9. Czy żaden z antywzorców AW-1…AW-14 nie występuje?
10. Czy liczby są zgodne z deckiem/raportem o tym samym projekcie? (§7)

**Forma (delegowane):** `DELIVERABLE_FORMATTING_SPEC.md` §5 + `DELIVERABLE_STANDARDS_AND_TOOLING.md` §A3.

**Bramka maszynowa:** `critiqueWorkbook` bez CRITICAL + (docelowo) DX-01…DX-10.

---

# §12. DECYZJE DO PODJĘCIA (dla właściciela / CTO)

| # | Decyzja | Rekomendacja |
|---|---|---|
| D-1 | Czy warstwa A6 „Wnioski" jest obowiązkowa w KAŻDYM arkuszu, czy tylko gdy arkusz idzie samodzielnie (bez raportu/decku)? | **tylko samodzielnie** — inaczej dublujemy wniosek z raportu |
| D-2 | Ile wejść to maksimum? Proponuję 3-8; powyżej wymuszamy agregację driverów | 8 |
| D-3 | Kolejność budowy brakujących archetypów (T8-T12) | T9 cost-benefit (NPV/IRR) → T10 budget vs actual → T8 porównanie wariantów |
| D-4 | Czy dokładamy kolory CZCIONKI (blue/black/green) czy zostajemy przy tłach? Zmiana widoczna dla klienta na wszystkich istniejących arkuszach | **dokładamy** — to standard rynkowy i jedyny czytelny sygnał „co wolno ruszyć" (+ legenda) |
| D-5 | Czy Excel z czatu ma konsumować księgę faktów organizacji (L8)? To wiąże generator z kontekstem org i wydłuża ścieżkę | **tak** — bez tego arkusz i deck o tym samym projekcie będą się rozjeżdżać |
| D-6 | Czy DX-01/DX-02 mają być CRITICAL (blokujące) czy MAJOR? | **CRITICAL** — model bez Założeń i model z cyklem to nie są modele |

---

## Changelog
- **v1.0 (2026-07-27):** pierwszy kanon treści arkusza — teza, anatomia warstw A0-A6, reguła
  formuł, sekwencja planowania E1→E5 z kontraktem prompt-ready, bramki jakości (istniejące
  WQ-01…09 + doktrynalne DX-01…10), typologia 13 zadań z pokryciem 7/12 archetypów, wiązanie
  z księgą faktów, wariant wniosku W6, 14 antywzorców, inwentarz 10 luk z dowodami plik:linia.
  Zadanie Faza A / A3. Do zatwierdzenia przez Piotra (§12).
