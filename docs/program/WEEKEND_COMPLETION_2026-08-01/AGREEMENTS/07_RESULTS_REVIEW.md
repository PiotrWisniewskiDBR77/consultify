---
agreement_id: MOD-AGR-07
module: Results
status: ACCEPTED_DIRECTION
owner: piotr
prepared_by: codex
accepted_by: piotr
accepted_at: 2026-07-31
last_reviewed: 2026-07-31
---

# Karta uzgodnienia — Results

## 1. Definicja

**Results** odpowiada na pytanie: „Czy wdrożona zmiana rzeczywiście przyniosła
oczekiwany rezultat?”. Jest zarządzaną warstwą pomiaru, dowodów, odchyleń i
reakcji, a nie pasywnym dashboardem ani biblioteką wykresów.

Ukończenie prac nie oznacza automatycznie osiągnięcia rezultatu. Initiative
może być zakończona, a zakładany KPI lub korzyść nieosiągnięte. Results ma tę
różnicę pokazywać bez upiększania danych.

## 2. Obietnica użytkownikowi

Użytkownik może:

- zdefiniować KPI albo OKR wraz z baseline, targetem, właścicielem i rytmem;
- przyjąć docelowy KPI zdefiniowany podczas tworzenia Initiative;
- połączyć miernik z celem, inicjatywą, procesem lub jednostką organizacyjną;
- rejestrować lub importować rzeczywiste pomiary z zachowaniem źródła;
- odróżnić brak danych od wartości zero;
- obserwować trend, aktualność, jakość i status realizacji;
- otworzyć przypadek odchylenia, wykonać RCA i zlecić działanie korygujące;
- automatycznie powiadomić właściciela i eskalować brak reakcji;
- potwierdzić, odrzucić albo zakwestionować deklarowaną korzyść;
- porównać obietnicę z rzeczywistym efektem;
- przygotować okresowy review i przekazać raport do Materials;
- przekazać rzeczywiste KPI do rozliczenia Investment Case w Finance.

## 3. Własność domeny

Results jest właścicielem:

- definicji KPI, metryk, objectives i key results;
- baseline, targetu, jednostki, kierunku oraz tolerancji miernika;
- punktów pomiarowych, trendów, wymiarów i aktualności danych;
- jakości, lineage, confidence i zatwierdzenia pomiaru;
- statusu rezultatu i odchylenia;
- przypadków odchyleń, RCA, reakcji i weryfikacji skuteczności;
- operacyjnego potwierdzenia korzyści;
- scorecards, review cycles i snapshotów raportowych;
- narracji value realization opartej na dowodach.

Results nie jest właścicielem:

- harmonogramu i wykonania pracy — Execution;
- lifecycle inicjatywy i jej uzasadnienia — Initiatives;
- modeli, założeń, NPV, IRR, ROI i wartości finansowych — Finance;
- plików, decków i finalnych publikacji — Materials;
- źródłowych systemów operacyjnych;
- deklaracji sukcesu bez pomiaru lub dowodu.

## 4. Granice integracyjne

| Domena | Przekazuje do Results | Otrzymuje z Results |
| --- | --- | --- |
| Initiatives | oczekiwany rezultat, proponowany KPI contract, target i kontekst | status efektu, odchylenie i dowód realizacji |
| Execution | milestone, postęp, actual wykonania i sygnał zakończenia | informację, czy praca przełożyła się na efekt |
| Finance | zatwierdzony Investment Case i financial anchors | rzeczywiste KPI i potwierdzone korzyści do reconciliation |
| Organization | cele, jednostki, procesy i właścicieli | przekrojowy obraz realizacji |
| Materials | szablon i kanał publikacji | zatwierdzony snapshot oraz narrative |
| Teresa | kontekst rozmowy i propozycje analiz | wiarygodne dane do wyjaśnienia i rekomendacji |

Żadna integracja nie kopiuje prawdy domenowej. Powiązanie zachowuje identyfikator,
wersję, właściciela i read-back.

Initiative może definiować docelowe KPI już podczas planowania. Po
zatwierdzeniu KPI trafia do kanonicznego rejestru Results i właściwych kart
wyników. Initiative zachowuje link i status, natomiast Results prowadzi dalszy
lifecycle definicji, pomiarów, odchyleń i review.

## 5. Kanoniczny przepływ

`define KPI/OKR → baseline → target → owner/cadence → measurement →
quality/review → trend/deviation → RCA → corrective action → effectiveness
check → confirmed result → report`

Stany KPI:

`Draft → Ready → Active → At risk/Off track → Under review → Achieved/Missed
→ Closed`

Status `No data` jest osobnym stanem jakości i nie może być przeliczany na zero.
Korekta punktu pomiarowego nie usuwa historii: wymaga autora, przyczyny,
poprzedniej wartości i czasu.

## 6. Kanoniczne obszary produktu

1. **Initiatives** — zakres obserwowanych inicjatyw i ich oczekiwanych efektów.
2. **KPI & OKR** — wspólna tabela KPI, definicje, wiele kart wyników, pomiary
   i check-ins.
3. **Reviews** — cykliczne przeglądy, snapshots i decyzje.
4. **Deviations** — odchylenia, RCA, działania i weryfikacja skuteczności.
5. **Reporting** — raporty, harmonogramy, wallboards i publikacja przez
   Materials.

ROI nie jest osobną prawdą Results. Results pokazuje realized value i dowody,
natomiast obliczenia finansowe oraz approved Investment Case należą do Finance.
Istniejące ekrany ROI wymagają przypisania: część pomiarowa pozostaje w Results,
a modelowanie i obliczenia przechodzą do Finance.

## 6.1. Tabela KPI i wiele kart wyników

Results posiada wspólną, skalowalną tabelę wszystkich KPI dostępnych w danym
zakresie uprawnień. Tabela nie może ograniczać organizacji do jednej karty.
Pozwala filtrować, grupować, sortować i zapisywać widoki według organizacji,
działu, zespołu, procesu, celu, programu, Initiative, właściciela, statusu,
freshness, jakości danych oraz karty wyników.

Organizacja może tworzyć wiele niezależnych kart wyników (`Scorecard`), między
innymi dla:

- całej organizacji lub zarządu;
- działu, zespołu albo jednostki biznesowej;
- procesu lub obszaru operacyjnego;
- Initiative albo programu;
- klienta, zakładu lub lokalizacji;
- wybranego tematu, np. jakości, sprzedaży lub transformacji.

Ten sam KPI może należeć do wielu kart bez kopiowania definicji i pomiarów.
Karta przechowuje członkostwo, układ, właściciela, odbiorców i reguły
agregacji, ale wskazuje kanoniczny KPI w Results.

Balanced Scorecard jest opcjonalnym szablonem karty, a nie jedynym modelem
organizacji KPI. System wspiera również własne karty operacyjne, procesowe,
inicjatywowe i strategiczne.

## 7. Kontrakt KPI

Każdy KPI zawiera co najmniej:

- nazwę, opis biznesowy i cel;
- typ, jednostkę, kierunek oraz formułę;
- baseline wraz z datą i źródłem;
- target, termin, tolerancje i regułę statusu;
- przedziały `On target`, `Warning` i `Critical` oraz reguły alertów;
- właściciela danych, właściciela wyniku i reviewera;
- wymagany czas potwierdzenia alertu, planu reakcji i eskalacji;
- częstotliwość pomiaru i maksymalny wiek danych;
- scope organizacyjny, procesowy lub inicjatywowy;
- źródło danych, metodę pozyskania i lineage;
- status jakości, confidence i kompletność;
- wersję definicji oraz historię zmian.

Zmiana definicji, targetu lub formuły tworzy nową wersję. Nie przepisuje
historycznych wyników bez jawnej, audytowalnej operacji.

## 7.1. Alerty, odpowiedzialność i eskalacja

KPI nie służy wyłącznie do pokazania wyniku. Dobrze zdefiniowany KPI uruchamia
obowiązki osoby odpowiedzialnej, gdy wynik wychodzi poza uzgodnione parametry.

Każdy aktywny KPI posiada jawne:

- progi ostrzegawczy i krytyczny, również zależne od kierunku KPI;
- reguły oceny pojedynczego pomiaru, trendu i czasu bez świeżych danych;
- właściciela wyniku, właściciela danych, zastępcę i ścieżkę eskalacji;
- kanały powiadomień oraz godziny/czas reakcji;
- termin potwierdzenia alertu i przygotowania planu naprawczego;
- regułę ponowienia, eskalacji i automatycznego utworzenia zadania;
- warunek powrotu do targetu oraz zamknięcia przypadku.

Po przekroczeniu progu system:

1. zapisuje zdarzenie z wartością, progiem, czasem i źródłem;
2. tworzy lub aktualizuje `Deviation Case`;
3. powiadamia właściciela KPI i pokazuje zadanie w My Work;
4. wymaga potwierdzenia alertu w określonym czasie;
5. wymaga przygotowania `KPI Recovery Card`;
6. monitoruje terminy i kolejne pomiary;
7. eskaluje brak reakcji, pogorszenie wyniku lub nieskuteczny plan;
8. zamyka alert dopiero po review i potwierdzeniu skuteczności.

`KPI Recovery Card` zawiera:

- opis odchylenia i jego wpływu;
- RCA z rozróżnieniem hipotezy i przyczyny potwierdzonej;
- działania doraźne i trwałe;
- właścicieli, terminy, priorytety i oczekiwany wpływ;
- zależności, ryzyka i potrzebne decyzje;
- powiązane zadania Execution/My Work;
- kolejne checkpointy i pomiary;
- ocenę skuteczności oraz decyzję `close`, `continue` albo `escalate`.

Eskalacja jest konfigurowalna przez organizację. Domyślnie przebiega:

`KPI owner → manager/process owner → initiative/program owner → executive
sponsor/governance`

Przejście na kolejny poziom może wynikać z severity, czasu bez reakcji,
powtarzalności odchylenia, trendu pogarszającego lub przekroczenia ustalonego
terminu naprawy. Każda eskalacja ma historię, adresata, przyczynę i status
doręczenia.

Powiadomienia są częścią wspólnego systemu komunikacyjnego Consultify:
in-app notification i My Work są obowiązkowe; e-mail, Teams lub inne kanały
mogą być włączane polityką organizacji. Powiadomienie prowadzi bezpośrednio do
KPI, Deviation Case lub wymaganej czynności i nie zastępuje rejestrowanego
workflow.

## 7.2. Kanon OKR i wsparcie Teresy

OKR nie jest alternatywną nazwą tabeli KPI. Metoda składa się z:

- **Objective** — krótkiego, jakościowego i angażującego opisu tego, co
  organizacja lub zespół chce osiągnąć w określonym cyklu;
- zwykle **2–5 Key Results** — konkretnych, mierzalnych rezultatów, których
  osiągnięcie stanowi dowód realizacji Objective;
- **Initiatives** — działań i projektów podejmowanych po to, by wpłynąć na KR;
  nie są one samymi Key Results.

Key Result opisuje wynik, nie wykonanie zadania. „Uruchomić pięć kampanii” jest
działaniem, natomiast „zwiększyć udział kwalifikowanych leadów z 20% do 32%”
jest mierzalnym rezultatem. Milestone może być KR tylko wtedy, gdy rzeczywiście
stanowi weryfikowalny rezultat, a nie ukrytą listę czynności.

Kanoniczny cykl:

`context and strategy → draft Objective → define KRs → metric quality review →
alignment and approval → activate cycle → regular check-ins → score/context/
next step → end-cycle review → learn and close/carry forward`

Teresa prowadzi użytkownika przez `OKR Definition Workshop`:

1. rozpoznaje strategię, problem, odbiorcę, oczekiwaną zmianę i horyzont;
2. proponuje maksymalnie kilka Objectives, pomaga wybrać priorytety;
3. sprawdza, czy Objective jest zrozumiałe, jakościowe i ograniczone czasowo;
4. pyta: „co musi być prawdą, aby uznać ten cel za osiągnięty?”;
5. proponuje KRs wraz z baseline, targetem, jednostką, źródłem i właścicielem;
6. odrzuca lub przepisuje KRs będące zadaniami, outputami albo vanity metrics;
7. sprawdza mierzalność, częstotliwość, możliwość wpływu i zabezpieczenia
   jakościowe przed szkodliwą optymalizacją;
8. wykrywa sprzeczności, duplikaty i zależności z innymi celami;
9. pokazuje użytkownikowi finalny `OKR Definition Brief` przed aktywacją.

Teresa nie zatwierdza OKR samodzielnie. Pokazuje niepewności, braki baseline,
brak źródła, ryzyko manipulacji metryką i różnicę między celem aspiracyjnym a
zobowiązaniem. Organizacja definiuje sposób scoringu, ale znaczenie skali musi
być jawne dla każdego cyklu i nie może zmieniać się po fakcie.

Check-in zawiera:

- bieżącą wartość lub score oraz status `On track`, `At risk`, `Off track`;
- confidence i aktualność danych;
- krótkie wyjaśnienie, co się zmieniło i dlaczego;
- ryzyka, zależności i potrzebne wsparcie;
- następny krok i właściciela;
- link do Deviation Case, gdy przekroczono ustalone progi.

## 7.3. Widoczność i uprawnienia OKR

Metoda OKR korzysta z przejrzystości, dlatego domyślnie cele organizacyjne i
zespołowe są widoczne szerzej niż edytowalne. Jednocześnie Consultify musi
chronić dane osobowe, poufne cele i wrażliwe wartości pomiarów.

Widoczność jest ustalana osobno dla Objective, KR, wartości pomiarowych i
komentarzy:

- `Organization` — widoczne dla wszystkich aktywnych członków organizacji;
- `Unit/Team` — widoczne dla wskazanej jednostki lub zespołu i przełożonych;
- `Participants` — widoczne tylko dla ownerów, współpracowników i reviewerów;
- `Restricted` — widoczne dla jawnej listy osób lub ról;
- `Executive` — widoczne dla governance i wskazanych ról zarządczych.

Domyślna polityka:

- cele organizacyjne: widoczne w całej organizacji;
- cele działu/zespołu: widoczne w organizacji, edytowane przez ownerów;
- cele Initiative: widoczne uczestnikom Initiative i w roll-upie odpowiednim
  odbiorcom;
- cele indywidualne: widoczne właścicielowi, managerowi i wskazanym reviewerom,
  chyba że użytkownik lub polityka organizacji świadomie rozszerzy widoczność;
- cele zawierające dane HR, prawne, transakcyjne lub inne dane wrażliwe:
  `Restricted` z agregowanym roll-upem dla szerszej grupy.

Role:

- `Viewer` odczytuje dozwolone cele i ich publiczne aktualizacje;
- `Contributor` dodaje check-in lub dane w przydzielonym zakresie;
- `KR Owner` odpowiada za pomiar, kontekst i reakcję;
- `Objective Owner` odpowiada za spójność całego OKR;
- `Reviewer` zatwierdza definicję, zmianę i zamknięcie;
- `OKR Admin` ustala cykle, słownik statusów i polityki, ale nie przejmuje
  merytorycznej odpowiedzialności ownera.

Roll-up nie może ujawnić wartości lub komentarza objętego ograniczeniem. W takim
przypadku pokazuje wyłącznie dozwoloną agregację albo status bez szczegółu.
Każda zmiana widoczności, ownera, targetu i wyniku jest audytowalna.

## 8. Korzyści i value realization

Korzyść przechodzi przez:

`Expected → Measuring → Evidenced → Reviewed → Confirmed/Rejected →
Sustained/Expired`

Sama deklaracja właściciela, ukończenie zadania ani zmiana statusu Initiative
nie potwierdzają korzyści. Potwierdzenie wymaga zdefiniowanego KPI, okresu,
źródła i dowodu. Korzyść finansowa jest następnie wyceniana i rozliczana przez
Finance w Benefits Realization Ledger.

## 9. Odchylenie jako proces działania

Odchylenie nie kończy się alertem. Tworzy zarządzany przypadek:

`Detect → Acknowledge → Diagnose → Decide → Act → Verify → Close/Reopen`

Przypadek wskazuje ownera, severity, przyczynę, dowody, decyzję, działanie,
termin i oczekiwany wpływ. Działanie wykonawcze powstaje w Execution lub My Work
i wraca z read-backiem. Zamknięcie wymaga sprawdzenia kolejnego pomiaru.

## 10. Teresa i AI

Teresa może:

- proponować KPI, targety, źródła i częstotliwość;
- wykrywać anomalie, braki i nieaktualne dane;
- wyjaśniać trend oraz proponować hipotezy przyczyn;
- przygotować strukturę RCA i warianty działań;
- tworzyć narrative review na podstawie zatwierdzonego snapshotu.

Teresa nie może:

- wytwarzać brakujących pomiarów;
- zmieniać baseline, targetu lub actual bez jawnej akceptacji;
- potwierdzać korzyści bez dowodu;
- przedstawiać hipotezy jako ustalonej przyczyny;
- omijać ownera i reviewera.

## 11. Kanon UI/UX

Results wykorzystuje StandardModuleBar, StandardTable, StandardPreview,
Menu 3, wspólne status chips, filtry, drawers, review i approval. KPI musi być
czytelne w formie tabeli, scorecard, trendu oraz szczegółowego preview.

W każdym widoku widoczne są:

- aktualna wartość, target, trend i status;
- data ostatniego pomiaru i freshness;
- owner oraz źródło;
- jakość/confidence;
- powiązana inicjatywa lub cel;
- następne wymagane działanie.

Kolor nie może być jedynym nośnikiem statusu. Brak danych, brak targetu,
nieaktualność i realne odchylenie mają różne stany.

## 12. Stan obecny

### Mamy

- `ResultsHub`, KPI/OKR, scorecards i time series;
- Initiatives view, KPI queue i signal sheets;
- reports, schedules, connectors i wallboards;
- deviation cases, RCA i next actions;
- Results V8 API, workflow contract i testy uprawnień;
- benefits inbox/register i realized-value services;
- reconciliation z Finance oraz bridge z Execution;
- rozbudowane serwisy insights, attribution, anomalies i forecasts.

### Fragmentaryczne lub ryzykowne

- kanoniczna nazwa Results nadal działa pod starą trasą `/benefits`;
- aktywny alias `/kpi-okr` oraz kilka historycznych powierzchni;
- ResultsHub, BenefitsHub i Benefits Register nakładają się;
- ROI i financial workspaces częściowo duplikują Finance;
- istnieje kilka modeli benefits, KPI i reconciliation;
- bardzo szeroki backend nie ma jednego udowodnionego golden flow w UI;
- mock/showcase i fallback mogą maskować brak prawdziwych danych;
- lifecycle KPI, benefit i deviation nie jest jednolity na wszystkich ekranach;
- kompletne provenance i approval wymagają odbioru end-to-end.

## 13. Najważniejsze scalenia

1. Kanoniczna nazwa i trasa `/results`; stare trasy jako czasowe redirecty.
2. Jeden KPI contract i version history.
3. Jeden pomiar/time-series z provenance i quality state.
4. Jeden Benefits Register dla potwierdzonych efektów.
5. Jeden deviation/corrective loop.
6. Jedna relacja KPI–Initiative–Execution.
7. Jedna relacja Results–Finance bez podwójnej prawdy ROI.
8. Jeden snapshot review/report.
9. Usunięcie mock/fallback po parity check, nie przed nim.

## 14. Golden flows staging

### KPI inicjatywy

`Initiative expected outcome → KPI contract → baseline/target → actual
measurements → deviation → RCA → Execution action → next measurement →
confirmed/missed result → Finance reconciliation → Materials report`

### Samodzielny KPI operacyjny

`create KPI → connect/import data → validate baseline → activate cadence →
measurement → review → corrective action → verify → scheduled report`

## 15. Kryteria ukończenia

1. KPI ma kompletny kontrakt, ownerów, źródło i wersję.
2. Brak danych nigdy nie staje się zerem.
3. Pomiar zachowuje lineage, czas, autora i jakość.
4. Korekta nie usuwa poprzedniej wartości.
5. Target i formuła nie zmieniają się niejawnie.
6. Status wynika z jawnej reguły i danych.
7. Deviation tworzy przypadek z ownerem i terminem.
8. RCA odróżnia hipotezę od przyczyny potwierdzonej.
9. Działanie ma handoff oraz read-back z Execution/My Work.
10. Zamknięcie odchylenia wymaga weryfikacji skuteczności.
11. Korzyść wymaga pomiaru i dowodu.
12. Results nie oblicza własnej alternatywnej prawdy finansowej.
13. Finance otrzymuje właściwą wersję actual KPI i evidence.
14. Initiative pokazuje rezultat bez kopiowania danych.
15. Raport jest snapshotem, nie zmiennym widokiem live.
16. Teresa nie fabrykuje danych ani nie zatwierdza efektu.
17. Cross-org odczyt i zapis są blokowane.
18. Oba golden flows przechodzą E2E na stagingu.
19. Dark/light, responsive i accessibility spełniają kanon UI.
20. Mock i fallback nie maskują błędów aktualnego runtime.
21. KPI zdefiniowany w Initiative trafia po zatwierdzeniu do rejestru Results.
22. Tabela KPI obsługuje wiele mierników, grupowanie i zapisane widoki.
23. Organizacja może posiadać wiele kart wyników dla różnych zakresów.
24. Ten sam KPI może należeć do wielu kart bez kopiowania pomiarów.
25. Balanced Scorecard jest opcjonalnym szablonem, nie jedyną kartą.
26. Przekroczenie progu automatycznie tworzy lub aktualizuje Deviation Case.
27. Właściciel otrzymuje powiadomienie i termin wymaganej reakcji.
28. Odchylenie wymaga kompletnej KPI Recovery Card.
29. Brak reakcji i nieskuteczność działania uruchamiają jawną eskalację.
30. Zamknięcie alertu wymaga kolejnego pomiaru i review skuteczności.
31. Objective jest jakościowym kierunkiem, a KR mierzalnym rezultatem.
32. Zadania i Initiatives nie są automatycznie Key Results.
33. Teresa przeprowadza metric quality review przed aktywacją OKR.
34. Każdy KR ma baseline, target, źródło, ownera i rytm check-in.
35. Widoczność Objective, KR, wartości i komentarzy może być różna.
36. Roll-up respektuje ograniczenia i nie ujawnia danych wrażliwych.

## 16. Decyzje obowiązujące

1. Results jest właścicielem KPI, pomiarów, efektów i odchyleń.
2. Finance jest właścicielem modeli i wartości finansowych.
3. Execution potwierdza wykonanie pracy, nie osiągnięcie rezultatu.
4. Initiative może zakończyć się bez osiągnięcia targetu.
5. Brak danych jest jawnym stanem.
6. Korzyść bez pomiaru i dowodu nie jest potwierdzona.
7. Odchylenie musi prowadzić do decyzji i działania.
8. Results jest modułem działania na wynikach, nie tylko dashboardem.
9. Kierunek funkcjonalny został zaakceptowany bez uwag.
10. KPI może powstać w Initiative, ale jego lifecycle i pomiary prowadzi Results.
11. Results ma wspólną tabelę wielu KPI i obsługuje wiele kart wyników.
12. Balanced Scorecard jest jednym z szablonów, nie jedynym modelem.
13. KPI poza progiem automatycznie uruchamia alert, obowiązek reakcji i
    eskalację.
14. Właściciel zarządza powrotem do targetu przez KPI Recovery Card.
15. Teresa pomaga budować poprawne Objectives i mierzalne KRs, ale ich nie
    zatwierdza.
16. Transparentność OKR jest domyślna dla celów organizacyjnych i zespołowych,
    z kontrolowanymi wyjątkami dla danych osobowych oraz poufnych.

## 17. Otwarte szczegóły do odbioru technicznego

- finalna nazwa zakładki `KPI & OKR` względem osobnych powierzchni;
- domyślny rytm review i eskalacji;
- minimalny zestaw zewnętrznych connectorów dla stagingu;
- zakres migracji historycznych ROI/Benefits do kanonicznych domen.

## 18. Granica z Initiatives i powrót po wdrożeniu

Odchylenie KPI może utworzyć lokalny `Initiative Proposal Draft`, lecz dopiero
Source Validation rejestruje Initiative. W drugą stronę, po Delivery Acceptance
Results przejmuje kanoniczny nadzór KPI i benefitów. `Delivered` nie oznacza
`Benefit Achieved`; formalny Effectiveness Review zamyka ścieżkę jako confirmed,
partial albo not achieved. Kontrakt opisuje
[`INITIATIVE_END_TO_END_LIFECYCLE.md`](INITIATIVE_END_TO_END_LIFECYCLE.md).
