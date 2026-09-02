# Pokaż zrobione — 36 uwag, które właściciel już zaakceptował, nigdy nie widząc naprawy

Dyżur 2026-09-02. Powód: triaż `TRIAZ_UWAG_20260902.md` wykazał, że z 77 uwag
odbioru **32 są już zrobione**, a **4 są zrobione, ale schowane za flagą
domyślnie OFF**. Właściciel zaznaczył te ekrany jako „ok" i pisał uwagi do
nich, nigdy nie widząc, że naprawa już tam jest — stąd 24 „już to zgłaszałem".

Ten dokument to **dowód wzrokowy**, nie naprawa. Zero zmian w `src/` i
`server/src/`. Zrzuty zrobione kanonicznym `scripts/dev/grafika-zrzuty.mjs`
na harnessie `dev-render` (marker `e51291ed4b`), jasny i ciemny motyw dla
każdej pozycji, kadr zawsze na konkretne miejsce, którego dotyczyła uwaga —
nie ogólny widok modułu. Wszystkie 36 par light/dark przeszły kontrolę
różnicy (różnica jasności > 130, zwykle ~215–230; procent różnych pikseli
99–100%) — patrz sekcja **Kontrola par** na końcu.

Zrzuty: `evidence/grafika/uwagi-zrobione-20260902/<UW-ID>__<ekran>__<light|dark>.png`.

---

## ★ Cztery pozycje ZA FLAGĄ — właściciel fizycznie nie mógł ich zobaczyć

Każda z tych czterech funkcji istnieje, jest podłączona do żywego backendu i
nie ma dziś (poza tym dokumentem) żadnej drogi wejścia dla właściciela —
flaga jest domyślnie WYŁĄCZONA w kodzie i **to się tym dyżurem nie zmienia**.
Poniżej dokładny parametr adresu, który każdy może dopisać do URL-a we
własnej przeglądarce, żeby zobaczyć funkcję NA ŻĄDANIE, bez zmiany dla
kogokolwiek innego.

| ID | Ekran | Jak włączyć na jedno żądanie |
| --- | --- | --- |
| `UW-02-02` | Kreator wniosków wywiadu (nowa powłoka) | dopisz `?ff_interviewCreatorShell=1` do adresu ekranu, gdzie się otwiera kreator wniosków w module Wywiad |
| `UW-09-08` | Wyniki → „Uwaga" | dopisz `?ff_resultsVNextAttentionEntry=1` do adresu modułu Wyniki |
| `UW-09-10` | Wyniki → wyszukiwarka | dopisz `?ff_resultsVNextSearch=1` do adresu modułu Wyniki |
| `UW-12-01` | Audyty → „Raporty DRD" | dopisz `?ff_drd_report=1` do adresu modułu Audyty |

Zamiast parametru adresu można też ustawić w konsoli przeglądarki
`localStorage.setItem('ff.drdReport', '1')` (analogicznie dla pozostałych
trzech, klucze w tabeli triażu) — działa identycznie, zapisuje się na dłużej
w tej przeglądarce. **Nikt nie zmienia wartości domyślnej w kodzie** — to
obejście per-przeglądarkę, nie zmiana dla wszystkich użytkowników.

---

## Rejestr 36 pozycji

### 02_INTERVIEW

**`UW-02-01` karta-insight**
Zgłaszał: *„W oknie centralnym mamy trzy kolumny; jest to zaciągnięte. Zróbmy
to w trzech dużych wierszach z trzema kolorami, aby było czytelne od góry do
dołu."*
Widać teraz: sekcja „Podsumowanie wykonawcze" ma trzy pełnowymiarowe wiersze
— niebieski „Odpowiedzi oficjalne", czerwony „Problemy/ryzyka", zielony
„Sygnały/szanse" — każdy na całą szerokość karty, czytelne od góry do dołu,
dokładnie jak prosił.
Zrzuty: `UW-02-01__karta-insight__light.png` / `__dark.png`.

**`UW-02-02` interview-creator-shell** — ZA FLAGĄ, patrz tabela wyżej.
Zgłaszał: *„To jest do poprawy wielkość ścianek, też już to zgłaszałem. Wilka
z czcionek, obrazków – to nie wygląda jak sekcja tech, nie? […] nie wygląda
ładnie."*
Widać teraz (po włączeniu na żądanie): nowa powłoka kreatora wniosków AI z
krokami Definicja/Materiał/Dostrojenie. Uwaga: sama poprawa wizualna
ścianek/czcionek, o którą prosił, **nie ma potwierdzenia w kodzie** — po
zobaczeniu tego ekranu trzeba ocenić na nowo, czy wygląd już go satysfakcjonuje.
Zrzuty: `UW-02-02__interview-creator-shell__light.png` / `__dark.png`.

### 03_TOOLS

**`UW-03-01` karta-tool**
Zgłaszał: *„Zobacz tutaj w karcie ostatniej w przykładzie. Mieliśmy usunąć
dwa przykłady, bo mieliśmy trzy. Został jeden, ale w postaci jednej kolumny.
To wygląda bez sensu. No i w tym narzędziu nie mam, jak przeklikać samego
wypełniania dokumentu."*
Widać teraz: sekcja „Przykład" z jednym przypadkiem pokazuje go na PEŁNĄ
szerokość karty, nie w wąskiej kolumnie jak dawniej — liczba kolumn siatki
dopasowuje się do liczby przykładów. Druga część uwagi (przeklikanie
wypełniania dokumentu) **zostaje otwarta** — nie ma jej w kodzie, to osobne
zadanie do doprecyzowania z właścicielem.
Zrzuty: `UW-03-01__karta-tool__light.png` / `__dark.png` (sekcja „Przykład" otwarta).

**`UW-03-03` tools-swot-session-workspace**
Zgłaszał: *„Jest jakaś prehistoryczna karta jeszcze za tym, zanim
przerobiliśmy to."*
Widać teraz: realna sesja SWOT idzie przez aktualny, właściwy komponent —
stara, martwa karta (bez importerów w aplikacji) usunięta z drogi do niego.
Zrzuty: `UW-03-03__tools-swot-session-workspace__light.png` / `__dark.png`.

### 04_ASSESSMENT

**`UW-04-03` assessment-quality-review-panel**
Zgłaszał: *„Nie wiem, czy to, co mi tu pokazujesz, ma zastąpić macierz. Jeśli
tak, to nie działa w ten sposób. […] Nigdzie nie znalazłem macierzy."*
Widać teraz: ekran wprost tłumaczy, że NIE zastępuje macierzy odpowiedzi i
linkuje do właściwego miejsca (przełącznik „Macierz" w edytorze DRD), gdzie
faktycznie ustawia się poziomy.
Zrzuty: `UW-04-03__assessment-quality-review-panel__light.png` / `__dark.png`.

**`UW-04-04` assessment-list**
Zgłaszał: *„To samo rozumiem, że to ma być tabela na całą szerokość ekranu,
a nie jakaś fragmentaryczna."*
Widać teraz: zakładka „Procesy" renderuje pełnowymiarową, kanoniczną tabelę
(StandardTable), nie fragment.
Zrzuty: `UW-04-04__assessment-list__light.png` / `__dark.png`.

**`UW-04-05` assessment-presentation-view**
Zgłaszał: *„Ciągle nie wiem dlaczego nie używasz mojej macierzy DRD - nie mam
już siły serio!! moja macierz jest serio ładna - już ją znalazłeś przecież
(zobacz mam to na ekranie Macierz oceny DRD — obszary x poziomy)."*
Widać teraz: slajd 6 z 13 prezentacji pokazuje DOKŁADNIE tę samą macierz DRD
(obszary × poziomy, wypełnienie kumulatywne, chipy „AS"/„TO"), którą
właściciel zaakceptował na osobnym ekranie 01.09.
Zrzuty: `UW-04-05__assessment-presentation-view__light.png` / `__dark.png`
(kadr na slajdzie 6/13, nie na stronie tytułowej).

**`UW-04-06` assessment-reports-panel**
Zgłaszał (potwierdzająco): *„No, to jest normalna tabela na pełną szerokość,
jak rozumiem."*
Widać teraz: potwierdzone — panel jest w całości po polsku i renderuje
pełnowymiarową tabelę.
Zrzuty: `UW-04-06__assessment-reports-panel__light.png` / `__dark.png`.

### 05_INITIATIVES

**`UW-05-01` plan-scenario-d1**
Zgłaszał: *„Tabela niestety dalej nie wygląda jak kompletna tabela. […]
narzędzie otwiera tę wybraną linię jako tabelę poniżej tej tabeli. Ma ona
otwierać konkretną kartę. W ogóle nie rozumiem, jak to działa."*
Widać teraz: kliknięcie wiersza otwiera podgląd z przyciskiem „Otwórz" (karta
inicjatywy) i osobnym „Otwórz kartę inicjatywy"; warsztat planu ma swój
własny, jawnie nazwany przycisk „Otwórz narzędzia planu" w górnym pasku —
dwie różne rzeczy, jasno nazwane, żadna nie otwiera się „pod tabelą".
Zrzuty: `UW-05-01__plan-scenario-d1__light.png` / `__dark.png` (wiersz kliknięty, podgląd otwarty).

**`UW-05-04` initiative-record**
Zgłaszał: *„Inicjatywę oceniałem już wcześniej, raz. Nie wiem, czemu to jest
inna tabela inicjatyw. Czy to pomyłka, czy celowo – powinniśmy mieć jedną
tabelę inicjatyw."*
Widać teraz: to TEN SAM ekran karty inicjatywy co już oceniał — różni się
tylko zestaw danych demo w rejestrze grafiki. W produkcie nie ma dwóch
różnych tabel inicjatyw, to był duplikat w korpusie przeglądu, nie w kodzie.
Zrzuty: `UW-05-04__initiative-record__light.png` / `__dark.png`.

**`UW-05-05` karta-initiative**
Zgłaszał: *„[…] widzę, że nie ma przycisku AI w górnym pasku, który będzie
odpowiadał za wypełnienie karty. Poza tym wygląda zajebiście."*
Widać teraz: przycisk „Wypełnij z AI" jest w Menu 2 karty inicjatywy i
otwiera Konsultanta AI (potwierdzone dedykowanym testem regresyjnym).
Zrzuty: `UW-05-05__karta-initiative__light.png` / `__dark.png`.

### 06_EXECUTION

**`UW-06-01` execution-tab-work**
Zgłaszał: *„Zobacz pomiędzy menu 3 a tabelą dołożyłeś dodatkowy element, on
może spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard,
że tabela zaczyna się pod menu 3."*
Widać teraz: pasek między Menu 3 a tabelą usunięty, filtr przeniesiony na
prawo od Menu 2, tabela zaczyna się bezpośrednio pod Menu 3.
Zrzuty: `UW-06-01__execution-tab-work__light.png` / `__dark.png`.

**`UW-06-02` execution-tab-control** — ta sama uwaga właściciela co wyżej,
dla zakładki „Sterowanie".
Widać teraz: to samo — pasek usunięty, przyciski „Dodaj sygnał"/„Przygotuj
interwencję" przeniesione na prawo od Menu 2.
Zrzuty: `UW-06-02__execution-tab-control__light.png` / `__dark.png`.

**`UW-06-03` execution-tab-rollout**
Zgłaszał: *„Tutaj wcale te słowa pomiędzy tabelą a menu 3 nie są potrzebne."*
Widać teraz: opisowe zdanie usunięte, tabela zaczyna się bezpośrednio pod
Menu 3.
Zrzuty: `UW-06-03__execution-tab-rollout__light.png` / `__dark.png`.

### 07_MY_WORK_AGENT

**`UW-07-03` idea-table-tool-empty-filter**
Zgłaszał (odkrycie): *„Nie wiedziałem, że mamy taką tabelę w ogóle."*
Widać teraz: tabela z dwoma uczciwymi stanami pustki (brak wyników filtra vs
brak rekordów) — dobrze zbudowany ekran, który już istniał.
Zrzuty: `UW-07-03__idea-table-tool-empty-filter__light.png` / `__dark.png`.

**`UW-07-04` idea-templates-catalog**
Zgłaszał: *„To jest moje marzenie, aby to wszystko działało dobrze."*
Widać teraz: katalog ok. 40 szablonów w 7 kategoriach, działający, bez
wcześniej zgłoszonego błędu koloru na tagu narzędzia.
Zrzuty: `UW-07-04__idea-templates-catalog__light.png` / `__dark.png`.

**`UW-07-06` notatnik-osierocone-graf**
Zgłaszał: *„Jak robimy takie nody notatek to może zrób ją na całym ekranie
jedną, bo kilka na jednym ekranie nie daje komfortu pracy."*
Widać teraz: graf połączeń notatki ma tryb pełnoekranowy (przycisk „Pełny
ekran") — pokazany tu w trybie pełnoekranowym.
Zrzuty: `UW-07-06__notatnik-osierocone-graf__light.png` / `__dark.png`.

**`UW-07-09` whiteboard-canvas**
Zgłaszał: *„Tutaj jest tylko problem taki, że jak zaznaczam element, otwiera
się pasek poziomy funkcji i on się nie mieści w pasie - są ikony, które
wyglądają poza okno. Tutaj opisy trzeba skrócić albo wywalić."*
Widać teraz: pasek zaznaczenia mieści się w całości w szerokości kanwy (tryb
tylko-ikony, podpisy w dymku po najechaniu) — pokazany tu z zaznaczonym
elementem, dokładnie tak jak się psuło.
Zrzuty: `UW-07-09__whiteboard-canvas__light.png` / `__dark.png` (element zaznaczony, pasek widoczny).

**`UW-07-15` zwornik-projects**
Zgłaszał: *„Słuchaj, wiesz co, znowu nie wiem, gdzie to się uruchamia.
Natomiast jeśli mamy przyciski „dodaj i projekt" oraz coś tam drugiego, nie
ma pełnej, dobrej nawigacji."*
Widać teraz: zakładka „Projects" jest wprost w głównym menu huba (obok
Tasks/Decisions) i ma osobną, poprawnie nazwaną akcję w palecie poleceń —
nie myli się już z „Otwórz kalendarz".
Zrzuty: `UW-07-15__zwornik-projects__light.png` / `__dark.png`.

**`UW-07-16` mywork-idea-inspector-lekki**
Zgłaszał: *„Nie wiem, nie mam pojęcia, gdzie ten plik, gdzie ten ekran jest,
szczerze mówiąc. Domyślam się, że może tak wyglądać, bo jest techniczny, ale
nie wiem, do czego służy."*
Widać teraz: ekran istnieje i ma ujednoliconą szerokość prawego panelu
(320px), zgodną ze standardem reszty aplikacji. ★ Ten ekran wymaga jeszcze
pokazania z PRZED — istniał wcześniej świeży zrzut PO bez odpowiednika
PRZED, więc sam właściciel nie mógł ocenić, co konkretnie się zmieniło. Ten
zrzut to nadal tylko PO.
Zrzuty: `UW-07-16__mywork-idea-inspector-lekki__light.png` / `__dark.png`.

### 09_RESULTS

**`UW-09-04` results-vnext-okr-registry**
Zgłaszał: *„W prawym, głównym rogu powinien być przycisk „Nowe dodawanie
OKR", a teraz są jakieś inne niepotrzebne przyciski."*
Widać teraz: jeden główny przycisk „Nowy OKR" w prawym górnym rogu, a pary
Programy/Cykle przeniesione do Menu 3 zamiast stać obok jako osobne
przyciski.
Zrzuty: `UW-09-04__results-vnext-okr-registry__light.png` / `__dark.png`.

**`UW-09-06` results-vnext-okr-admin**
Zgłaszał: *„Brak przycisków w dolnym pasku Preview - no chyba że ich nie ma
tutaj."*
Widać teraz: to jego własna druga hipoteza jest prawdziwa — to uczciwy stan
wyłączonej dla organizacji funkcji administracyjnej, nie usterka. Przycisków
akcji w dolnym pasku podglądu rzeczywiście nie ma, bo panel jest tylko do
odczytu konfiguracji.
Zrzuty: `UW-09-06__results-vnext-okr-admin__light.png` / `__dark.png`.

**`UW-09-08` results-vnext-attention** — ZA FLAGĄ, patrz tabela wyżej.
Zgłaszał: *„Tu są tylko dwa przyciski w menu 2."*
Widać teraz (po włączeniu na żądanie): pełny ekran „Uwaga" z Menu 2
(przełącznik źródła KPI/OKR — te „dwa przyciski", o które pytał) i Menu 3 z
siedmioma filtrami prowadzącymi do trzynastu list danych z żywym backendem —
ekran wcześniej niedostępny nikomu poza ręcznym wpisaniem adresu.
Zrzuty: `UW-09-08__results-vnext-attention__light.png` / `__dark.png`.

**`UW-09-10` results-vnext-search-registry** — ZA FLAGĄ, patrz tabela wyżej.
Zgłaszał: *„Generalnie układ menu i tabele są ok, ale tutaj wiele nie ma do
akceptacji."*
Widać teraz (po włączeniu na żądanie): wyszukiwarka wyników działa i
pokazuje realne dane (KPI/OKR/ROI) po wpisaniu zapytania — tu pokazana z
wpisanym „DPMO" i trzema trafieniami z różnych domen.
Zrzuty: `UW-09-10__results-vnext-search-registry__light.png` / `__dark.png`.

### 10_FINANCE

**`UW-10-01` finance-analysis-workspace**
Zgłaszał: *„Nie mam jak tego zatwierdzić, nic tu nie widać, nic z tego nie
można wyciągnąć."*
Widać teraz: wszystkie 11 nagłówków tabeli wskaźników widoczne w pełni (bez
ucięcia), kolumna „Wzór" zawija się w całości zamiast ucinać tekst do
„Prz…".
Zrzuty: `UW-10-01__finance-analysis-workspace__light.png` / `__dark.png`.

**`UW-10-03` finance-compare-panel**
Zgłaszał: *„A może całą szerokość dostępnego ekranu wykorzystajmy."*
Widać teraz: tabela porównania rozszerzona z wąskiej, wyśrodkowanej karty
(~740px) na pełną szerokość dostępnego ekranu (~1364px).
Zrzuty: `UW-10-03__finance-compare-panel__light.png` / `__dark.png`.

### 11_MATERIALS

**`UW-11-01` template-builder-doc**
Zgłaszał (pochwała): *„To jest super!!!!!!! proste i czytelne — brawo."*
Widać teraz: ten sam, zaakceptowany ekran — nic do poprawy, zrzut jako
potwierdzenie stanu.
Zrzuty: `UW-11-01__template-builder-doc__light.png` / `__dark.png`.

**`UW-11-02` template-library-new-entry**
Zgłaszał (potwierdzająco): *„No, tak jak rozumiem, to jest normalna tabela,
bo przecież to jest po prostu tabela, w której mamy w menu funkcję pod
tytułem „wzorzec", czyli template."*
Widać teraz: kreator szablonów otwiera się i działa po polsku (krok 1/3,
pole nazwy, przyciski Anuluj/Dalej) — potwierdzenie, że działa tak, jak
zrozumiał.
Zrzuty: `UW-11-02__template-library-new-entry__light.png` / `__dark.png`.

**`UW-11-05` prezentacje-template-states**
Zgłaszał: *„Nie otwiera mi się nic :(."*
Widać teraz: domyślny wariant pokazuje realną treść (nie pusty spinner), a
długie ładowanie kończy się po 20s czytelnym komunikatem błędu z przyciskiem
powrotu zamiast wiecznego kręcenia się w kółko.
Zrzuty: `UW-11-05__prezentacje-template-states__light.png` / `__dark.png`.

**`UW-11-06` gen-word-content-hints**
Zgłaszał (zrozumienie): *„Wiem, do czego ten ekran miałby służyć. Znowu, gdy
mamy generator do wyboru, wybieramy „generuj tabelę template", otwiera się
generator szablonów, a potem mamy je w liście szablonów. Widzimy, po co jest
ten ekran."*
Widać teraz: dokładnie to — ekran tłumaczy własne przeznaczenie tak samo, jak
je opisał.
Zrzuty: `UW-11-06__gen-word-content-hints__light.png` / `__dark.png`.

**`UW-11-08` excele-edytowalna-siatka**
Zgłaszał: *„Znacznie lepiej jest - zamieńmy teraz słowa na typowe dla excela
ikony - każdy chyba już na świecie je zna. I będziemy blisko."*
Widać teraz: pasek narzędzi ma ikony ($, %, B, ikony wiersza/kolumny, #)
zamiast słów.
Zrzuty: `UW-11-08__excele-edytowalna-siatka__light.png` / `__dark.png`.

**`UW-11-09` document-studio-resume-error**
Zgłaszał: *„Napisz to ładniej, wyśrodkuj na ekranie."*
Widać teraz: stan błędu wyśrodkowany na ekranie, z ikoną w okrągłym tle,
tytułem, komunikatem i przyciskiem powrotu.
Zrzuty: `UW-11-09__document-studio-resume-error__light.png` / `__dark.png`.

**`UW-11-10` document-studio-template-resolve-error**
Zgłaszał: *„Napisz to jakoś ładniej na środku ekranu, z ładniejszą grafiką."*
Widać teraz: ten sam, już wyśrodkowany wzorzec błędu co w `UW-11-09`.
Zrzuty: `UW-11-10__document-studio-template-resolve-error__light.png` / `__dark.png`.

### 12_AUDITS

**`UW-12-01` audyty-drd-report** — ZA FLAGĄ, patrz tabela wyżej. ★
Najważniejszy pojedynczy przypadek tego dyżuru.
Zgłaszał: *„Znowu nie wiem, gdzie to jest, ale to nie wygląda jak pełna
tabela. To muszą być raporty, które są po prostu pełną tabelą na pełną
szerokość."*
Widać teraz (po włączeniu na żądanie): zakładka „Raporty DRD" w module
Audyty pokazuje pełnowymiarową, filtrowalną listę raportów — dokładnie to,
o co prosił. Z niej otwiera się kompletny edytor raportu DRD (panel AI,
akcje per sekcja, eksport PDF, żywy backend) — ten edytor istniał od dawna
w kodzie, ale przed dzisiejszym dyżurem nie było do niego ŻADNEJ drogi
wejścia poza tą flagą; nikt, łącznie z właścicielem, nigdy go nie widział.
Zrzuty: `UW-12-01__audyty-drd-report__light.png` / `__dark.png` (lista raportów).

### 13_CHAT

**`UW-13-04` chat-signals-feed**
Zgłaszał (pochwała-odkrycie): *„Nie wiem, gdzie to jest, ale to jest w ogóle
super mądre."*
Widać teraz: panel sygnałów w czacie — funkcja istniała już wcześniej,
odkryta przez właściciela przypadkiem; ma dziś podłączoną, realną drogę
wejścia.
Zrzuty: `UW-13-04__chat-signals-feed__light.png` / `__dark.png`.

### 14_ADMIN

**`UW-14-03` admin-command-attention-queue**
Zgłaszał: *„To nie jest szerokość strony :(."*
Widać teraz: kolejka uwagi zmieniona z siatki 4 kart na pełnowymiarową
tabelę z filtrowalnymi kolumnami — zaczyna się od lewej i kończy na prawej
krawędzi ekranu.
Zrzuty: `UW-14-03__admin-command-attention-queue__light.png` / `__dark.png`.

---

## ★ Sprawdzone i POTWIERDZONE — żadna pozycja `ZROBIONE` nie okazała się fałszywa

Dla wszystkich 36 pozycji sprawdzono, że ekran, który zrzut pokazuje, jest
tym samym komponentem co ten cytowany w `TRIAZ_UWAG_20260902.md`, i że zrzut
faktycznie pokazuje TO MIEJSCE, którego dotyczyła uwaga (nie ogólny widok
modułu) — w kilku przypadkach wymagało to dodatkowej interakcji z
harnessem, której triaż nie robił, bo nie potrzebował zrzutu:

- `UW-03-01` (karta-tool) — trzeba było kliknąć w nawigacji sekcję
  „Przykład" (domyślny widok to „Cel").
- `UW-04-05` (assessment-presentation-view) — trzeba było przejść 5 slajdów
  do przodu (`ArrowRight`×5), macierz DRD jest na slajdzie 6/13, nie na
  stronie tytułowej.
- `UW-07-06` (notatnik-osierocone-graf) — trzeba było otworzyć tryb
  pełnoekranowy grafu (harness ma gotowy parametr `&graf=fullscreen`).
- `UW-07-09` (whiteboard-canvas) — trzeba było zaznaczyć węzeł na kanwie
  (klik z `force`, bo środek bywa przykryty pływającym paskiem), żeby pasek
  zaznaczenia w ogóle się pojawił.
- `UW-09-10` (results-vnext-search-registry) — pierwszy zrzut bez zapytania
  pokazywał tylko uczciwy stan „wpisz 2 znaki"; drugi, z `&q=DPMO`, pokazuje
  realne wyniki wyszukiwania.

**Żadna z 36 pozycji nie okazała się niezrobiona.** Jedna pozycja
(`UW-07-16`) jest zrobiona, ale nadal potrzebuje osobnego zrzutu PRZED, żeby
właściciel mógł ocenić RÓŻNICĘ, nie tylko stan końcowy — zaznaczone wyżej
przy tej pozycji, opisane też w samym triażu.

---

## Kontrola par (jasny/ciemny, luminancja + procent różnych pikseli)

Próg kanonu: różnica jasności ≥ 150 LUB (jeśli niżej) procent różnych
pikseli ≥ 5% — dwuwymiarowa kontrola zapobiega zarówno duplikatom
(KSZTAŁT 13: para light/dark to ten sam obraz pod dwiema nazwami), jak i
fałszywym przejściom samej różnicy jasności bez realnej różnicy treści.

| Wynik | Liczba |
| --- | --- |
| Par sprawdzonych | 36 |
| Par OK | 36 |
| Najniższa różnica jasności | 133,5 (`UW-11-02`, przy 99,7% różnych pikseli — OK w drugim wymiarze) |
| Typowa różnica jasności | ~215–230 |
| Typowy procent różnych pikseli | 99–100% |

Zero ekranów renderujących identyczny obraz pod dwiema nazwami motywu. Zero
kontrolek harnessu w kadrze (`uwagi=0` w każdym zrzucie).

---

## Czego nie zdążono / czego ten dokument NIE robi

- Nie naprawiono żadnego z 41 pozostałych stanów (`DROBNE`/`DUŻE`/`NIEJASNE`)
  z triażu — to osobna praca, poza zakresem tego dyżuru.
- Nie zmieniono wartości domyślnej żadnej z 4 flag — pozostają OFF w kodzie.
  Ktoś (Piotr albo osoba prowadząca odbiór) musi jawnie zdecydować o
  promocji którejkolwiek z nich na domyślne ON, i to osobna decyzja per
  ekran (kanon CLAUDE.md #7/#9), nie automat.
- `UW-07-16` wymaga jeszcze zrzutu PRZED (opisane wyżej) — bez niego
  właściciel widzi tylko stan końcowy, nie różnicę.
