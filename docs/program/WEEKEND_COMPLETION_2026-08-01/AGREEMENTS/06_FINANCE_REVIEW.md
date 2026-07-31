---
agreement_id: MOD-AGR-06
module: Finance
status: ACCEPTED_DIRECTION_OPEN_DETAILS
owner: piotr
prepared_by: codex
accepted_by: piotr
accepted_at: 2026-07-31
last_reviewed: 2026-07-31
---

# Karta uzgodnienia — Finance

## 1. Proponowana definicja

**Finance** to finansowy system analityczny Consultinity. Zamienia dane
źródłowe i jawne założenia w odtwarzalne modele, analizy, scenariusze,
prognozy, wyceny oraz decyzje inwestycyjne.

Finance nie jest systemem księgowym. Nie wystawia faktur i nie prowadzi księgi
głównej. Importuje albo otrzymuje dane finansowe, normalizuje je i wykorzystuje
do profesjonalnej analizy oraz podejmowania decyzji.

## 2. Obietnica użytkownikowi

Użytkownik powinien móc:

- wgrać sprawozdania albo wprowadzić dane ręcznie;
- zobaczyć, jak każda pozycja została rozpoznana i zmapowana;
- poprawić mapping bez utraty dokumentu źródłowego;
- potwierdzić gotowość pakietu P&L, Balance Sheet i Cash Flow;
- zbudować model finansowy z jawnymi driverami;
- porównać scenariusze i prognozy;
- wykonać analizę wskaźnikową, płynnościową, rentowności i zadłużenia;
- przeprowadzić wycenę;
- ocenić inwestycję albo inicjatywę przez NPV, IRR, ROI i payback;
- prześledzić każdą liczbę do źródła, formuły, okresu i założenia;
- zatwierdzić wersję i utworzyć raport lub prezentację w Materials;
- połączyć model z Initiative oraz rzeczywistymi KPI w Results.

## 3. Własność domeny

Finance jest właścicielem:

- sprawozdań po normalizacji;
- mapowania linii finansowych;
- pakietów sprawozdań;
- walut, jednostek i okresów finansowych;
- założeń, driverów i modeli;
- scenariuszy i prognoz;
- obliczonych wskaźników;
- wycen;
- analiz inwestycyjnych;
- wersji, zatwierdzeń i reconciliation finansowego.

Finance nie jest właścicielem:

- źródłowego systemu księgowego;
- operacyjnych KPI i pomiarów — Results;
- planu inicjatywy i jej wykonania — Initiatives/Execution;
- finalnej formy raportu/decku — Materials;
- dokumentów źródłowych jako plików — Materials;
- profilu organizacji — Organization.

## 4. Dwie ścieżki pracy

### A. Finanse przedsiębiorstwa

`Statements → Model → Analysis → Prediction → Valuation → Report`

Służy zrozumieniu kondycji, prognozie i wycenie całej organizacji albo
wydzielonej jednostki.

### B. Analiza inicjatywy lub inwestycji

`Initiative assumptions → cash flows/costs/benefits → scenarios → NPV/IRR/ROI
→ review → investment decision → realization linkage`

Nie każda analiza inwestycyjna wymaga pełnego modelu trzech sprawozdań.
Powinna jednak używać tego samego kanonu założeń, okresów, walut, wersji,
scenariuszy i provenance.

Business case może być samodzielnym dokumentem finansowym: użytkownik opisuje
inwestycję, koszty, korzyści, harmonogram, ryzyka i stopę dyskontową, a silnik
oblicza NPV, IRR, ROI oraz payback bez budowania modelu całej organizacji.

Historyczną powierzchnię analiz inwestycyjnych należy scalić jako ścieżkę B
wewnątrz Finance, a nie utrzymywać jako drugi produkt.

## 4.1. Kanon nazewnictwa

**Finance** jest jedyną nazwą produktu, modułu, pozycji menu i domeny.
Nie używamy określenia „Economics” ani „ekonomika” w UI, komunikacji z
użytkownikiem, nowych kontraktach API, nowych nazwach komponentów ani
dokumentacji docelowej.

Stare identyfikatory kodowe zawierające tę nazwę są wyłącznie długiem
migracyjnym. Zachowujemy je w inwentaryzacji technicznej do czasu przygotowania
mapy zależności, przekierowań i kompatybilnej migracji; nie tworzą drugiego
modułu ani alternatywnego języka produktu.

## 5. Kanoniczne obszary

1. **Statements** — import, ekstrakcja, mapping, walidacja i gotowość.
2. **Models** — modele finansowe, drivery, harmonogramy i wersje.
3. **Analysis** — diagnostyka, wskaźniki, wariancje i benchmarki.
4. **Prediction** — budżety, forecasty, scenariusze i sensitivity.
5. **Valuation** — DCF, porównawcza, sensitivity i wynik wyceny.
6. **Investment** — business case inicjatyw, NPV/IRR/ROI i decyzja.

Finance nie ma osobnej zakładki **Overview**. Przekrojowe informacje — zdrowie
danych, alerty, ostatnia wersja, decyzje i następny krok — są częścią preview,
Menu 3 oraz startowego stanu właściwej zakładki. Moduł otwiera ostatnio używany
obszar albo Statements dla nowej organizacji.

## 6. Statements jako brama zaufania

Pipeline:

`Upload → Detect → Extract → Map → Validate → Confirm → Ready`

Każda pozycja zachowuje:

- plik, stronę/arkusz i lokalizację źródłową;
- oryginalną etykietę i wartość;
- kanoniczną linię finansową;
- metodę mappingu i confidence;
- autora korekty;
- walutę, skalę i okres;
- historię zmian.

Pakiet jest `ready` dopiero po sprawdzeniu:

- obecności wymaganych statementów;
- zgodności okresów, walut i skali;
- duplikatów;
- unmapped lines;
- poprawności sum i relacji;
- cross-statement tie-outs;
- jawnych wyjątków zaakceptowanych przez człowieka.

Brak Cash Flow może zostać uzupełniony obliczeniem z P&L i zmian Balance Sheet
tylko wtedy, gdy wynik jest oznaczony `estimated/non-statutory` wraz z metodą
i ograniczeniami.

## 7. Model finansowy

Model składa się z:

- source statement snapshot;
- okresów i częstotliwości;
- driverów;
- harmonogramów pomocniczych;
- formuł;
- scenariuszy;
- manual overrides;
- validation checks;
- outputs;
- wersji i approval.

Każda wartość posiada origin:

- imported;
- computed;
- manual override;
- AI proposed;
- scenario delta.

W modelu trzech sprawozdań obowiązuje zamknięta pętla P&L → CF → BS oraz
kontrole Assets = Liabilities + Equity, cash tie-out i zależności debt/interest.

## 8. Założenia i drivery

Założenie musi zawierać:

- nazwę i znaczenie;
- jednostkę;
- okres obowiązywania;
- wartość bazową;
- źródło albo metodę;
- rationale;
- właściciela;
- confidence;
- scenariusz;
- datę ostatniego review;
- wpływ na outputs.

Teresa może zaproponować driver na podstawie historii, benchmarku lub rozmowy,
ale propozycja nie staje się aktywnym założeniem bez zatwierdzenia.

Zmiana drivera pokazuje impact analysis przed zapisem.

## 9. Analysis

Kanoniczny katalog obejmuje co najmniej:

- ratio analysis;
- vertical/common-size;
- horizontal/trend;
- cash flow;
- working capital;
- profitability;
- liquidity;
- leverage/credit;
- DuPont;
- quality of earnings;
- variance bridge;
- benchmark branżowy;
- anomaly detection.

Wynik analizy zawsze wskazuje:

- formułę;
- dane i okresy;
- model/snapshot;
- próg lub benchmark;
- status;
- interpretację;
- ograniczenia.

Narracja AI nie jest źródłem liczby.

Analiza nie jest celem samym w sobie. Każdy zatwierdzony wniosek powinien móc
zakończyć się jednym z jawnych rozstrzygnięć:

- brak działania — sytuacja jest akceptowalna;
- dalsze pytanie lub potrzeba danych;
- decyzja;
- korekta założenia/modelu;
- kandydat inicjatywy;
- działanie w istniejącej Initiative;
- monitoring przez KPI w Results.

## 10. Prediction i scenariusze

Prediction obsługuje:

- base, optimistic i conservative;
- scenariusze własne;
- rolling forecast;
- budżet;
- what-if;
- sensitivity;
- Monte Carlo tam, gdzie model i liczba iteracji są jawne.

Scenariusz jest zbiorem zmian driverów względem wersji bazowej. Nie jest kopią
całego modelu bez relacji do baseline.

Porównanie pokazuje wpływ na wynik, cash, balance sheet, covenanty, wycenę i
kluczowe KPI.

## 11. Valuation

Wycena powinna obsługiwać:

- DCF;
- trading/transaction comps, jeśli dostępne są legalne i aktualne dane;
- valuation bridge;
- terminal value;
- WACC i jego składniki;
- sensitivity table;
- football field;
- scenariusze;
- zakres wartości, a nie fałszywie precyzyjną pojedynczą liczbę.

Każda wycena wskazuje datę, walutę, model, wersję, metodę, źródła, założenia
i osobę zatwierdzającą.

## 12. Investment

Analiza inwestycyjna/inicjatywy obejmuje:

- koszty początkowe i cykliczne;
- korzyści twarde i — osobno — miękkie;
- harmonogram przepływów;
- stopę dyskontową;
- NPV, IRR, ROI, payback;
- scenariusze;
- sensitivity;
- ryzyka i confidence;
- zależności;
- finansowy recommendation draft;
- formalną decyzję go/no-go/defer poza automatyczną decyzją AI.

Po zatwierdzeniu Initiative zachowuje link do konkretnej wersji business case.
Późniejsze zmiany modelu nie zmieniają historycznej podstawy decyzji.

### Samodzielny Investment Case

Minimalny przypadek nie wymaga Statements ani Financial Model. Zawiera:

- opis inwestycji i pytanie decyzyjne;
- wariant „bez inwestycji” jako baseline;
- nakłady początkowe;
- koszty wdrożenia i koszty cykliczne;
- twarde korzyści finansowe;
- korzyści operacyjne mierzone przez KPI;
- okresy realizacji kosztów i korzyści;
- stopę dyskontową oraz horyzont;
- scenariusz base/downside/upside;
- ryzyka, zależności i confidence;
- NPV, IRR, ROI i payback wyliczone deterministycznie;
- źródła oraz właścicieli każdego założenia.

## 13. Post-investment review i rozliczenie korzyści

Finance nie kończy pracy na zatwierdzeniu inwestycji. Po uruchomieniu Initiative
tworzy się **Benefits Realization Ledger**, który porównuje zatwierdzoną
obietnicę inwestycyjną z rzeczywistym wykonaniem.

Lifecycle:

`Draft case → Approved baseline → Decision → Execution → Benefits measurement
→ Post-investment review → Reconciled/Closed`

### Zamrożony baseline

W momencie decyzji system zamraża:

- wersję business case;
- koszty i harmonogram;
- założone korzyści;
- NPV/IRR/ROI/payback;
- wybrane KPI, baseline i target;
- scenariusz użyty do decyzji;
- ryzyka i warunki powodzenia;
- decydenta oraz rationale.

Baseline pozostaje niezmienny. Reforecast może powstać później, ale nie
nadpisuje pierwotnej obietnicy.

### Dane rzeczywiste

- Execution dostarcza rzeczywisty postęp, terminy i koszty wdrożenia;
- Results dostarcza rzeczywiste KPI i efekty operacyjne;
- Finance potwierdza wartości finansowe i okres ich ujęcia;
- Initiative zachowuje powiązanie biznesowe i odpowiedzialność.

### Reconciliation

System cyklicznie porównuje:

- planned cost vs actual cost;
- planned schedule vs actual schedule;
- planned benefits vs realized benefits;
- target KPI vs actual KPI;
- approved cash flows vs actual/reforecast cash flows;
- forecast NPV/ROI/payback vs realized albo aktualnie prognozowane wartości.

Każde odchylenie ma kwotę, okres, przyczynę, właściciela, confidence oraz
komentarz. Teresa może proponować wyjaśnienie, ale właściciel je zatwierdza.

### Post-Investment Review

W ustalonych punktach, np. po 3, 6 i 12 miesiącach albo po milestone, system
przygotowuje przegląd:

- co zostało dostarczone;
- ile rzeczywiście wydano;
- które korzyści osiągnięto;
- które zostały przesunięte, utracone albo nie dają się jeszcze potwierdzić;
- aktualne NPV, ROI i payback;
- przyczyny różnic;
- ryzyka i działania korygujące;
- lessons learned;
- rekomendację: continue, correct, scale, stop albo close.

Raport przeglądu powstaje w Materials, ale źródłem wartości i reconciliation
pozostaje Finance.

## 14. Finance vs Results

| Finance | Results |
| --- | --- |
| modelowana prawda finansowa | zmierzona prawda operacyjna/KPI |
| założenia i scenariusze | baseline, target i actual |
| forecast i valuation | monitoring wykonania i odchyleń |
| ROI/NPV/IRR modelu i reconciliation finansowe | actual KPI i realizacja efektów |

Połączenie jest opcjonalne i kontrolowane:

- KPI może zasilać driver jako propozycja;
- output Finance może objaśnić KPI;
- Results może potwierdzić realizację korzyści;
- Finance ponownie oblicza opłacalność na actuals i zatwierdzonym baseline;
- rozbieżność wymaga reconciliation, nie cichego nadpisania.

## 15. Golden thread z Initiative

`Initiative objective → Finance business case/version → approved baseline →
decision → Execution actual cost/progress → Results actual KPI → Finance
realization reconciliation → post-investment review`

Initiative pokazuje linki i summary, ale szczegółowy model pozostaje w Finance.
Finance pokazuje status Initiative/Execution/Results przez read-back, nie kopie.

## 16. Finance → Initiative Generator

Generator inicjatyw jest kontrolowanym domknięciem pracy analitycznej. Może
zostać uruchomiony z:

- zatwierdzonego insightu lub conclusion analizy;
- wykrytego ryzyka płynności, rentowności, zadłużenia albo working capital;
- wariancji lub anomalii;
- scenariusza i sensitivity;
- rekomendacji z wyceny;
- odrzuconego albo warunkowo zaakceptowanego Investment Case;
- post-investment review wykazującego niezrealizowane korzyści;
- reconciliation Finance–Results.

Teresa przygotowuje **Initiative Candidate Pack**:

- problem lub szansę;
- finansowe uzasadnienie;
- źródłowy model/analysis/valuation i dokładną wersję;
- numerical anchors;
- proponowany cel;
- expected financial impact i sposób pomiaru;
- baseline i target;
- zakres oraz główne działania;
- ryzyka i zależności;
- właściciela do potwierdzenia;
- powiązane KPI;
- confidence i brakujące dane.

Użytkownik może:

- odrzucić kandydata;
- połączyć go z istniejącą Initiative;
- poprawić;
- zapisać do późniejszego review;
- przekazać do Initiatives jako `candidate/draft`.

Finance nie tworzy inicjatywy w statusie zaakceptowanym i nie utrzymuje jej
dalszego lifecycle. Po handoffie Initiatives jest właścicielem obiektu, a
Finance zachowuje source link i read-back.

Wiele podobnych wniosków powinno zostać zgrupowanych przed generacją, aby nie
tworzyć osobnej inicjatywy dla każdego wskaźnika lub alertu.

## 17. Rola Teresy

Teresa jest aktywnym analitykiem finansowym:

- prowadzi import i wyjaśnia mapping;
- wskazuje braki i niespójności;
- proponuje drivery z rationale;
- buduje draft modelu i scenariuszy;
- uruchamia deterministyczne obliczenia;
- interpretuje wskaźniki i wariancje;
- kwestionuje nierealistyczne założenia;
- pokazuje impact przed zmianą;
- przygotowuje draft wyceny, business case i narracji raportu;
- prowadzi reconciliation Finance–Results.
- przygotowuje post-investment review i wskazuje odchylenia od obietnicy;
- rozdziela efekt inwestycji od zmian zewnętrznych, jeśli dowody na to pozwalają.
- zamienia zatwierdzone wnioski w Initiative Candidate Pack;
- wykrywa duplikaty i proponuje połączenie z istniejącą Initiative.

Teresa nie może:

- wymyślać liczb;
- wykonywać obliczeń wyłącznie w modelu językowym;
- ukrywać formuły, źródła albo brak danych;
- aktywować drivera bez review;
- zatwierdzić modelu, wyceny ani decyzji inwestycyjnej;
- zmienić APPROVED/LOCKED snapshotu;
- wybrać „najlepszego” scenariusza wyłącznie na podstawie najwyższego NPV;
- przedstawić benchmarku bez źródła i daty.
- uznać korzyści za zrealizowane wyłącznie na podstawie deklaracji ownera;
- zmienić zatwierdzonego baseline, aby poprawić wynik projektu post factum.
- tworzyć wielu inicjatyw automatycznie z każdego alertu lub wskaźnika.

## 18. Faza myślenia

Przed utworzeniem modelu, forecastu, wyceny albo business case Teresa pokazuje
**Finance Analysis Brief**:

- cel i pytanie decyzyjne;
- zakres organizacji/inicjatywy;
- źródła i ich gotowość;
- okres, walutę i skalę;
- proponowaną metodę;
- drivery i założenia;
- scenariusze;
- wymagane outputs;
- validation checks;
- braki i ograniczenia.

Użytkownik poprawia lub zatwierdza brief przed obliczeniami.

## 19. Deterministyczny compute

LLM może planować, mapować, wyjaśniać i proponować. Wszystkie wartości
finansowe powstają w wersjonowanym silniku obliczeniowym.

Każdy wynik musi być możliwy do ponownego obliczenia na podstawie:

- source snapshot;
- model version;
- assumptions;
- formulas/engine version;
- scenario;
- currency, scale i period;
- manual overrides.

## 20. Lifecycle

Rekomendowany lifecycle modeli, analiz, forecastów i wycen:

`Draft → Review → Approved → Locked → Superseded/Archived`

- zmiana Approved tworzy nowy Draft;
- Locked zachowuje podstawę decyzji lub publikacji;
- superseded wskazuje wersję następczą;
- rollback tworzy nową wersję na bazie starej, nie usuwa historii.

## 21. Materiały i raportowanie

Finance tworzy wersjonowany pakiet danych i narracji, a Materials jest
właścicielem finalnego dokumentu, decku lub workbooka.

Raport finansowy zachowuje:

- finance artifact/version;
- data as of;
- source statements;
- assumptions;
- scenario;
- methodology;
- reviewer;
- reconciliation status;
- timestamp i hash eksportu.

Raport post-investment wskazuje zarówno pierwotny approved baseline, jak i
aktualne actuals/reforecast. Nie może prezentować wyłącznie ostatniej,
korzystniejszej prognozy.

## 22. Role i uprawnienia

Minimalne role:

- Data Provider;
- Analyst/Model Author;
- Reviewer;
- Approver/CFO;
- Investment Decision Owner;
- Viewer.

Osoba dostarczająca dane może poprawiać mapping, ale nie powinna automatycznie
zatwierdzać modelu. Krytyczne manual overrides, approval, unlock oraz publikacja
pozostawiają audit trail.

## 23. Kanon UI/UX

Finance używa istniejących standardów:

- StandardModuleBar, StandardTable i StandardPreview dla katalogów;
- Menu 3 dla filtrów, scenariuszy i działań;
- wspólne tables, charts, status chips i preview;
- Finance Visual Canon dla kolorów, wykresów i liczb;
- provenance na cell/line/metric;
- istniejące wizardy dla importu i tworzenia;
- diff/review/approval zgodny z resztą aplikacji;
- Materials dla finalnych raportów.

Nowe wykresy finansowe mogą powstać tylko jako wspólne komponenty zgodne
z tokenami i dostępnością, nie lokalne jednorazowe wizualizacje.

## 24. Stan obecny zweryfikowany

### Mamy

- kanoniczna trasa `/finance` oraz stara trasa i nazwa widoku wymagające
  bezpiecznej migracji;
- `FinanceHub` z kanonicznym shellem list/table/preview;
- Statements, Analysis, Models, Prediction/Budgets i Valuation;
- szczegółowe trasy statements/models/analyses;
- Statement pipeline detect/extract/map/validate/confirm;
- kanoniczny rejestr linii, mapping policy i statement packs;
- financial model workspace, outputs, versions, diff i compute;
- ratio/statement analytics;
- scenariusze, budgety i forecast panels;
- valuation services i wizualizacje;
- historyczna powierzchnia analysis/business case oraz link do Initiative;
- V8 Finance API, enterprise API i szerokie serwisy obliczeniowe;
- testy org scoping, auth, mapping, modeli, valuations i integracji Results.

### Fragmentaryczne lub ryzykowne

- V8 i legacy fallback utrzymują dwa modele prawdy;
- stara trasa i identyfikatory kodowe sugerują drugą nazwę produktu;
- kolejność zakładek w kodzie różni się od specyfikacji Finance V3;
- część Investment pozostaje w historycznej powierzchni;
- kilka modeli ROI/value/benefits istnieje w Finance, Results i Initiatives;
- nie ma jednego udowodnionego pionu Statement → Model → Analysis → Report;
- gotowość 3-statement loop i wszystkich golden calculations wymaga testów;
- część bardzo zaawansowanych paneli może być zbudowana bez pełnego read-backu;
- benchmarki i dane porównawcze wymagają jawnego źródła/licencji/aktualności;
- approval i version semantics nie są jednolite dla wszystkich artefaktów;
- część lokalnych fallbacków generuje rekomendacje bez pełnego backend context;
- szczegółowy kontrakt Forecast/Budget/Prediction nakłada się;
- FinanceHub deklaruje pięć głównych zakładek, spec V3 opisuje sześć.
- istnieje `benefit_tracking`, value/benefits services i linkage z Results, ale
  nie udowodniono jednego pełnego post-investment review porównującego approved
  baseline z actuals.
- istnieją historyczne ścieżki create/link Initiative z Finance oraz serwisy
  wniosków finansowych, lecz brak jednego generatora kandydatów ze wspólnym
  source envelope, deduplikacją i read-backiem.

## 25. Najważniejsze scalenia

1. Jedna nazwa Finance i kanoniczna trasa `/finance`; stara trasa wyłącznie
   jako tymczasowy redirect do czasu zakończenia migracji.
2. Jeden model `FinanceArtifact` z typami statement/model/analysis/forecast/
   valuation/investment-case.
3. Jeden assumptions/driver registry.
4. Jeden scenario contract.
5. Jeden lifecycle/version/approval envelope.
6. Jeden deterministic compute contract.
7. Jeden provenance i numerical anchor contract.
8. Jedna relacja Finance–Results z reconciliation.
9. Jedna relacja Finance–Initiative z version pinning.
10. Jawne wycofanie legacy fallback dopiero po migracji i porównaniu wyników.
11. Jeden Benefits Realization Ledger spinający Finance, Initiative, Execution
    i Results bez kopiowania ich prawdy.
12. Jeden Finance Initiative Candidate contract zamiast wielu lokalnych
    przycisków „Create Initiative”.

## 26. Golden flow MVP

### Finance przedsiębiorstwa

`import P&L/BS/CF → mapping review → ready pack → baseline model → driver change
→ scenario comparison → analysis → approved conclusion → Initiative Candidate
review/handoff → report in Materials`

### Inicjatywa

`Initiative albo samodzielny opis inwestycji → Finance Analysis Brief →
costs/benefits/timing → base/downside/upside → NPV/IRR/ROI → review → approved
baseline → decision → Execution/Results actuals → realization reconciliation →
post-investment review`

## 27. Kryteria ukończenia

1. Import zachowuje plik, wartości, mapping i korekty.
2. Ready gate blokuje niekompletne lub niespójne statement packs.
3. Model jest deterministyczny i odtwarzalny.
4. 3-statement model przechodzi balance i cash tie-out.
5. Każdy output wskazuje źródła, formułę, okres, walutę i wersję.
6. Manual override ma autora, rationale i audit trail.
7. Zmiana drivera pokazuje impact analysis.
8. Scenariusz jest deltą względem baseline i daje się porównać.
9. Analysis wykorzystuje zatwierdzony snapshot.
10. Wycena wskazuje metodę, zakres i sensitivity.
11. Business case inicjatywy jest przypięty do konkretnej wersji.
12. Finance i Results nie nadpisują wzajemnie wartości.
13. Rozbieżność KPI/Finance ma reconciliation.
14. Approved/Locked nie można niejawnie zmienić.
15. Raport w Materials zachowuje lineage do Finance.
16. Cross-org odczyt i zapis są blokowane.
17. Golden calculations mają fixture’y i oczekiwane wyniki.
18. Oba golden flows przechodzą E2E na stagingu.
19. UI spełnia Finance Visual Canon, dark/light, responsive i accessibility.
20. Legacy fallback nie maskuje błędu aktualnego runtime.
21. Investment Case działa bez pełnego Financial Model i Statements.
22. Decyzja zamraża approved baseline kosztów, korzyści i wskaźników.
23. Reforecast nie nadpisuje baseline użytego przy decyzji.
24. Actual costs pochodzą z Execution/Finance, a actual KPI z Results.
25. System przelicza realized/reforecast NPV, ROI i payback.
26. Post-investment review pokazuje plan, actual, variance i przyczyny.
27. Korzyść nie jest uznana na podstawie samej deklaracji.
28. Finance nie ma osobnej zakładki Overview.
29. Zatwierdzony wniosek może utworzyć Initiative Candidate Pack.
30. Kandydat wskazuje source version, numerical anchors, expected impact i KPI.
31. Generator wykrywa duplikaty i pozwala połączyć z istniejącą Initiative.
32. Handoff tworzy wyłącznie candidate/draft i ma read-back.

## 28. Rekomendowana kolejność realizacji

1. Zmapować wszystkie źródła prawdy V8 i legacy.
2. Zamrozić nowe modele ROI/benefits/value.
3. Ustalić zakładki i dwa główne flows.
4. Domknąć Statement Ready Contract.
5. Udowodnić baseline 3-statement model golden calculations.
6. Domknąć versions, assumptions, scenarios i approval.
7. Udowodnić Analysis oraz raport Materials.
8. Scalić historyczną powierzchnię analiz jako Investment lane Finance.
9. Domknąć Finance–Results reconciliation.
10. Wycofywać fallbacki dopiero po wynikowym parity check.
11. Domknąć Benefits Realization Ledger i pierwszy post-investment review.
12. Scalić wszystkie Finance → Initiative w jeden generator.

## 29. Decyzje już obowiązujące

1. Finance posiada modele, założenia i wartości finansowe.
2. Results posiada KPI, pomiary i efekty.
3. Initiative może linkować do Finance i Results.
4. AI nie tworzy liczb poza deterministycznym compute.
5. Każdy wynik zachowuje numerical anchor i provenance.
6. Publikacja materializuje się przez Materials.
7. NPV/ROI Investment Case może działać niezależnie od modelu przedsiębiorstwa.
8. Finance rozlicza po realizacji, czy zatwierdzone koszty i korzyści zostały
   osiągnięte.
9. Pierwotny baseline nie może zostać nadpisany przez reforecast.
10. Finance nie ma zakładki Overview.
11. Zatwierdzone wnioski Finance mogą tworzyć kandydatów inicjatyw.
12. Initiatives przejmuje lifecycle po kontrolowanym handoffie.

## 30. Decyzje właścicielskie

Do zatwierdzenia lub korekty:

1. Potwierdzone: dwie główne ścieżki to finanse przedsiębiorstwa oraz analiza
   inicjatywy/inwestycji, obie pod wspólną nazwą Finance.
2. Czy Investment ma być osobną zakładką najwyższego poziomu?
3. Potwierdzone: nie tworzymy zakładki Overview.
4. Czy kanoniczna kolejność to Statements → Models → Analysis → Prediction →
   Valuation → Investment?
5. Potwierdzone: trzy statementy są obowiązkowe tylko dla modelu
   przedsiębiorstwa; business case inwestycji może działać niezależnie.
6. Czy formalny approval modelu/wyceny wymaga wskazanej roli CFO/Finance
   Approver, czy może ją nadać Owner/Admin?
7. Który pion odbieramy jako pierwszy: Statement → Model czy Initiative →
   business case?

8. Jakie domyślne checkpointy post-investment review przyjmujemy: milestone,
   3/6/12 miesięcy czy harmonogram definiowany per business case?
9. Kto formalnie potwierdza realizację korzyści finansowej: Benefit Owner,
   Finance Reviewer czy obie role?

10. Czy generator ma proponować jeden skonsolidowany program zmiany dla grupy
    powiązanych wniosków, czy pokazywać oba warianty: osobne inicjatywy oraz
    program nadrzędny?

## 31. Źródła

- `docs/product/FINANCIAL_ANALYSIS_V3.md`;
- `docs/product/AI_FINANCE_ORCHESTRATION_SPEC.md`;
- `docs/product/STATEMENT_READY_CONTRACT.md`;
- `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`;
- `docs/modules/08_finanse/`;
- `docs/modules/ECONOMICS_MODULE.md`;
- `src/views/EconomicsView.tsx`;
- `src/components/Economics/`;
- `src/components/Finance/`;
- `src/services/api/v8/finance.ts`;
- finance/economics/valuation routes, services, migrations and tests.

Powyższe nazwy są cytowanymi identyfikatorami istniejącego kodu i plików,
nie nazwami produktowymi. Podlegają osobnej, bezpiecznej migracji technicznej.

## Granica przekazania do Initiatives

Zakładka `Initiatives` może tworzyć lokalne `Initiative Proposal Drafts` z
analiz, wariantów i odchyleń Finance. Draft zawiera link do wersji analizy, ale
nie staje się automatycznie Initiative. Source Validation poprzedza rejestrację;
Finance pozostaje właścicielem Investment Case. Pełny lifecycle opisuje
[`INITIATIVE_END_TO_END_LIFECYCLE.md`](INITIATIVE_END_TO_END_LIFECYCLE.md).
