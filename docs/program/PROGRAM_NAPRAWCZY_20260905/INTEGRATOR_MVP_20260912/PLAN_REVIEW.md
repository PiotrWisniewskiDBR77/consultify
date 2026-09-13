# Niezależny review planu — 2026-09-12

Werdykt: **HOLD do czterech konkretnych korekt zakresu/odbioru poniżej**, bez zatrzymywania niezależnej pracy nad MVP. To review planu, nie ponowny audyt produktu. Nie edytowano planu głównego ani repo; nie uruchomiono runtime/live/testów. Brak chwilowo tworzonej macierzy JSON nie jest findingiem.

Odczytano plan w całości, oba oryginały właściciela (pierwszy także w poprzednim wkładzie), OWNER_PMO_DISCUSSION oraz wszystkie trzy wkłady zespołów. Referencje do linii dotyczą snapshotu SHA256 c5ad6190f016ccfe6576cabc5a0e0e2915a2439352a4f4382ce0688101d68113. Source of Truth i trzy pojemniki odczytano podczas własnego wkładu diagnozy.

## 1. P1 — W17 ogranicza mianownik testów do trzech modułów zamiast narzędzi

**Miejsce:** W17:192 i końcowy scenariusz przekrojowy „każdego z Idei, Notatek i Dokumentów”. Właściciel wymaga literalnie każdego przycisku i co najmniej trzech trudnych zadań „dla każdego z narzędzi”. Idea zawiera odrębne narzędzia/reprezentacje: mapa, whiteboard, process flow, tabela. Zdanie „każdego z trzech narzędzi” pozwala zaliczyć jedną reprezentację Idei trzema zadaniami, choć reszta pozostaje nieodebrana. Wkład diagnozy M-02 wyraźnie zachował ten mianownik.

**Poprawka:** „Minimum trzy trudne zadania dla każdego narzędzia/reprezentacji objętej imiennym inventory (w Ideas osobno mapa, whiteboard, process i tabela), plus Notes i Documents. Nie trzy na cały moduł Ideas.” Dopuścić wspólny scenariusz obejmujący kilka narzędzi, pod warunkiem osobnego dowodu spełnienia każdej z trzech prób per narzędzie. Przenieść tę samą definicję do końcowej macierzy/scenariuszy.

## 2. P1 — W17 przenosi profesjonalne pliki do W2, kolidując z istniejącą bramką MVP

**Miejsce:** W17:194 „Fala2… generatory prezentacji/raportów i pliki profesjonalnej jakości”, wobec W21:228 zachowującego S1.4 oraz źródłowego pojemnika1.6/S1.4. MVP już wymaga jednego rzeczywistego dokumentu i prezentacji z szablonu na danych właściciela odebranych jako plik. Nie można profesjonalnej jakości całej klasy plików odroczyć i równocześnie wymagać jej na MVP; obecne brzmienie daje wykonawcy dwa przeciwne polecenia.

**Poprawka:** dopisać w części MVP W17/W00 jawny retest istniejącej bramki „jeden dokument i jedna prezentacja z szablonu, rzeczywiste pliki, kompletność+merytoryka+grafika i wcześniejszy/nowy odpowiedni odbiór”. W części W2 użyć „rozszerzenia generatorów, formatów i automatyzacji ponad odebrane minimum”; jakość każdego dostępnego pliku jest zawsze wymogiem, nie fazą. Nie żądać ponownej zgody dla niezmienionego, już odebranego wzorca.

## 3. P2 — W05 chowa baseline wartości i onboarding pod nagłówkiem W2

**Miejsce:** W05:88. W jednym akapicie „Fala2” są rozbudowa rozmowy, kontekstowe pytania, zaproszenie/onboarding oraz merytoryczne wnioski/inicjatywy. Pierwszy owner nie przypisał jednoznacznie wszystkich tych funkcji doW2; jawnie MVP wskazał zatwierdzanie, ale obecne pojemniki już wymagają drogi świeżej organizacji od wywiadu do pierwszej wartości i działających zaproszeń. W00/W19 częściowo chronią pocztę, lecz W05 można odczytać jako odroczenie całej integracji Interview i jakości pierwszego insightu doW2.

**Poprawka:** rozdzielić „MVP: działający istniejący przebieg pytań→odpowiedzi→wnioski→jawny handoff inicjatywy, jakość jego obecnych generatorów oraz obecne zaproszenia/onboarding i manager approval” od „W2: naturalna rozmowa, dodatkowe projektowe wiązanie onboarding i nowe warianty generatorów/oceny ponad aktualny kontrakt”. Bez rozszerzaniaMVP o całą rozmowę. Oznaczenie rozszerzeń jakoW2 jest etapowaniem integratora, nie nową rzekomą decyzją właściciela.

## 4. P1 — W10 chroni obsadę biegnącej pracy, ale nie jej czas na osi planu

**Miejsce:** W10:130–134. Zakaz dotyczy tylko zmiany obsady. Drugi oryginał właściciela w Planie wymaga, aby to co w realizacji było wyraźnie oznaczone jako niezmienialne. Samo częściowe/zbiorcze zaakceptowanie sugestii w planowaniu nie uprawnia do przesuwania rozpoczętych inicjatyw; zmiany biegnącej pracy mają osobny kanał Realizacji/ryzyka.

**Poprawka:** „Planowanie chroni zarówno obsadę, jak i zatwierdzony harmonogram już biegnącej pracy. Sugestia zależna od zmiany takiej inicjatywy wskazuje ograniczenie lub tworzy propozycję do osobnego procesu zmiany W11; nie stosuje jej zwykłym apply planu.” Odbiór: AI sugeruje przesunięcie rozpoczętej inicjatywy, user akceptuje batch przyszłych zmian, istniejący harmonogram+obsada pozostają bez zmian; wersjonowana zmiana możliwa wyłącznie przez uprawniony W11.

## Drobne uściślenia, nie blokery

- W16 scenariusz mówi „zatwierdzona notatka→projekt”; owner osobno wymienił potrzebne zatwierdzenie budowy projektu. Dodać jawny checkpoint projektu do opisu scenariusza zgodnie z governance; nie ustanawiać nowego quorum.
- W05 „OcenaAI i warianty odbioru korzystają ze wspólnego governance” może pozostać, jeżeli Q1 definiuje różnicę quality recommendation vs final acceptance. Nie nadawać modelowi prawa finalnego przyjęcia odpowiedzi przez samą zmianę promptu. Rozstrzygnięcie implementacyjne przygotować zgodnie z hierarchią, bez nowej listy pytań.
- W20 pętla była sugestią, więc jednorazowy pierwszy research bez automatyzacji jest prawidłowy. Warto zachować „ponowna ocena hipotez po nowych dowodach pilota” jako iterację planu, bez schedulera ani kontaktów.

## Co jest poprawne i nie wymaga cofania

- Projekt najpóźniej przy inicjatywie, diagnoza wcześniej i ochrona105legacy zgodne z rozmowąPMO; brak automatycznej migracji źródeł/uprawnień.
- Pełny lifecycle nie sprowadzony do dodania liczby statusów; stare7 nie udają pełnego cyklu. MOVE jawnie osobno.
- Menu4/4 i dwie funkcje pod Inicjatywy zachowane; heatmapa oparta na deklarowanej dostępności, nie domyślnych40h.
- W22 zachowuje pełną konsolidację i propozycję fazy3 bez cichego usunięcia z zobowiązań.
- W00 nie przedstawia lokalnych dostaw jako wdrożenia. E3PARTIAL, C6autorski i potrzeba niezależnego review są jawne.
- Dokument nie odtwarza wycofanej listy pytań. DEC474 jest istniejącą granicą ceremonii; praca nad konkretnym wynikiem poprzedza decyzję.
- Graf wykonywalny, nie sama wizualizacja; localmeeting odróżnione odTeams; realne źródła i doręczenie, retry/uprawnienia/snapshoty mają właściwe bramki.
- W21 zachowuje odziedziczony backlog zamiast anulować wymagania niepowtórzone przez właściciela. Nie stwierdzono fikcyjnegoDONE dla całego programu.

Po poprawkach1–4 można przyjąć plan jako mapę wykonawczą z nieoszacowaną datą końca. Nie stanowi to zatwierdzenia implementacji ani zakończeniaMVP/W2.

## Aktualizacja podczas review

Integrator zgłosił po zapisaniu badanego snapshotu: rozbicie reprezentacji Idei, obowiązkowy pełny lifecycle12 wFali2 oraz dopisanie rodzin integracji i Finance↔ROI. Finding1 wymaga już tylko readback poprawionego planu; pozostałe uwagi przekazano do korekty. Nie traktować wcześniejszych numerów linii jako aktualnych po edycji.

## Końcowy re-review — ACCEPT planu wykonawczego

Plan SHA256 `2d89f412fbf525d0201d05e960e65d2045e7ab49c5e412be1307619054634674`. Macierz SHA256 `07bb4142c350949ff829700ea4e4778cc7af8cda59e05df710c88fc6e3c42a84`. Readback po poprawkach: **ACCEPT**, cztery findingi zamknięte w zakresie planu.

- W17 rozbija narzędzia/reprezentacje Idei; minimum trzech trudnych zadań nie ogranicza się do całego modułu.
- W17 zachowuje MVP1.6/S1.4: profesjonalny dokument i prezentacja jako pliki, trzy osie jakości. Ogólne sformułowanie o plikachW2 odczytuje się teraz jako rozszerzenie ponad to minimum.
- W05 zachowuje baseline pytania→odpowiedzi→insight→handoff i onboarding/zaproszenia jako bramkęMVP; rozmowaW2 nie zatrzymuje tego odbioru.
- W10 chroni obsadę i zatwierdzony harmonogram rozpoczętej pracy; zmiana wymaga odrębnego uprawnionegoW11.
- W16 obejmuje zatwierdzenie utworzenia projektu.

Macierz parsuje się, ma111unikalnychID i każdy wiersz ma paczkę:90PLANNED_NOT_ACCEPTED oraz21RECONCILE_EXISTING_TASK. Nie ma fikcyjnegoDONE. Sprawdzono strukturę i zmienione obszary; nie jest to dowód implementacji111wymagań. Aktywny cel pełnegoMVP i pętla pracy zmieniają tryb wykonywania, nie anulują pełnegoW2 ani nie zmieniają tegoACCEPT w odbiór produktu. Nie potrzeba nowych pytań startowych. Repo i główny plan nietknięte.
