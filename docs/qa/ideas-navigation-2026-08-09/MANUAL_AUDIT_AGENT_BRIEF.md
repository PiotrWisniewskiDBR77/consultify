# Manualny audyt czterech narzędzi Ideas — brief dla niezależnego agenta

Status: **EXECUTION BRIEF — audit only**  
Właściciel: Piotr Wiśniewski  
Data: 2026-08-09  
Badane narzędzia: Mind Map, Process Flow, Whiteboard, Table

## 0. Misja

Zachowuj się jak wymagający właściciel produktu, który po raz pierwszy wykonuje prawdziwą pracę w każdym narzędziu. Nie ograniczaj się do testu technicznego „klik działa”. Dla każdej funkcji odpowiedz:

1. Czy jest podłączona i daje widoczny rezultat?
2. Czy ma logiczny sens w tym miejscu i dla tego zakresu pracy?
3. Czy jest potrzebna, zdublowana, myląca albo zbędna?
4. Czy brakuje funkcji potrzebnej do naturalnego ukończenia pracy?
5. Czy rezultat utrzymuje się po zapisie, odświeżeniu i ponownym otwarciu?

Nie naprawiaj kodu w czasie audytu. Zbieraj dowody i rekomendacje. Brak dowodu oznacza `NOT VERIFIED`, nigdy PASS.

## 1. Bramka wersji i środowiska — obowiązkowa przed testem

1. Odczytaj aktualny `git rev-parse HEAD`, nazwę brancha i `git status --short`.
2. Ustal, czy testujesz:
   - lokalną bieżącą wersję roboczą, albo
   - `https://demo.consultify.ai` z potwierdzonym deployment ID i commit SHA.
3. Nie zakładaj, że demo jest aktualne. Porównaj deployment z pakietem zmian.
4. W tej chwili preferowane jest lokalne środowisko z bieżącym working tree. Demo wolno użyć wyłącznie po potwierdzeniu zgodności wersji.
5. Sprawdź w runtime trzy markery nowej wersji:
   - prawy rail ma uchwyt przeciągania;
   - dolny pasek canvasa pokazuje zoom oraz menu `…`, a rzadkie funkcje są schowane;
   - kliknięcie Menu 2 zmienia jednocześnie URL, Menu 3 i treść modułu.
6. Zapisz viewport, język, motyw, użytkownika/rolę, URL, SHA/deployment ID i czas rozpoczęcia.
7. Jeżeli markerów nie ma, zatrzymaj audyt jako `WRONG_VERSION`. Nie testuj starej aplikacji.

## 2. Materiał odniesienia

Przeczytaj przed klikaniem:

- `docs/standards/idea-workspace/14_MACIERZ_FUNKCJI_MENU_I_OCENA_2026-08-09.md`
- `docs/standards/idea-workspace/13_MIGRACJA_NAWIGACJI_2026-08-09.md`
- `docs/qa/ideas-navigation-2026-08-09/REPORT.md`

Dokumentacja jest hipotezą produktu, nie dowodem działania. Stan runtime ma pierwszeństwo.

## 3. Dane testowe i zasady bezpieczeństwa

- Pracuj na czterech osobnych testowych ideach lub ich kopiach. Nie niszcz istniejących danych właściciela.
- Nazwy: `AUDIT Mind Map <timestamp>`, `AUDIT Process Flow <timestamp>`, `AUDIT Whiteboard <timestamp>`, `AUDIT Table <timestamp>`.
- Działania destrukcyjne sprawdzaj do etapu potwierdzenia. Faktyczne usunięcie wykonuj tylko na własnych rekordach auditowych.
- AI może generować treść tylko w ideach auditowych. Zapisz czas, wynik, możliwość preview/undo i wpływ na dane.
- Dla każdej istotnej obserwacji wykonaj screenshot. Nazwa: `<tool>__<phase>__<surface>__<result>.png`.
- Prowadź dziennik chronologiczny: akcja → oczekiwany rezultat → rzeczywisty rezultat → ocena → dowód.

## 4. Skala ocen

### Działanie

- `PASS` — realny rezultat zgodny z nazwą, również po refresh/reopen.
- `PARTIAL` — działa tylko część, rezultat jest niejasny albo nietrwały.
- `FAIL` — martwy klik, błąd, niewłaściwy rezultat, utrata danych.
- `NOT VERIFIED` — brak warunków lub dowodu.

### Sens funkcji

- `CORE` — konieczna do ukończenia podstawowej pracy.
- `USEFUL` — pomaga, ale nie jest krytyczna.
- `EXPERT` — uzasadniona dla zaawansowanej pracy i może być ukryta głębiej.
- `DUPLICATE` — ten sam rezultat jest już w lepszym miejscu.
- `MISPLACED` — funkcja ma sens, lecz znajduje się w złym menu.
- `UNCLEAR` — nazwa lub rezultat nie pozwalają zrozumieć celu.
- `REMOVE` — brak wiarygodnego zastosowania.

### Jakość budowy sceny

Każdy krok oceń w trzech osiach 1–5:

- `MOŻLIWE` — czy da się osiągnąć cel bez obejścia?
- `NATURALNE` — czy następny krok jest oczywisty bez wcześniejszej wiedzy?
- `OPTYMALNE` — czy liczba kliknięć, przełączeń i podróży kursorem jest rozsądna?

## 5. Dwa przebiegi obowiązkowe dla każdego narzędzia

Każde narzędzie stanowi osobne badanie. Zakończ raport narzędzia przed przejściem dalej.

### Przebieg A — pełny audyt wszystkich przycisków

Zacznij od listy Ideas, otwórz właściwą ideę i przejdź systematycznie przez:

1. Menu 1: status, zapis, Teresa, kebab, Convert.
2. Menu 2: sprawdź zmianę modułu i bezpieczny powrót do tej samej idei.
3. Dynamiczne Menu 3 w stanie:
   - bez zaznaczenia,
   - jeden obiekt,
   - wiele obiektów,
   - krawędź/połączenie,
   - stan pusty i z danymi.
4. Lewy panel informacji: każda sekcja, zakres idea/selection, otwieranie, przełączanie, zamykanie i scroll.
5. Prawy rail:
   - każda ikona i każdy popover;
   - tooltip, aktywny stan i disabledReason;
   - przeciąganie uchwytem;
   - zapamiętanie położenia po zmianie narzędzia i refresh;
   - dwuklik resetujący położenie;
   - brak skracania obszaru roboczego.
6. Dolny pasek:
   - przełącznik czterech reprezentacji;
   - zoom −/%/+ dla canvasów;
   - wszystkie pozycje pod `…`;
   - działanie minimapy, fit, fullscreen, snap, focus/restore tam, gdzie występują.
7. Menu kontekstowe PPM oraz alternatywa klawiaturowa Shift+F10/ContextMenu dla:
   - tła;
   - pojedynczego obiektu;
   - wielu obiektów;
   - krawędzi/połączenia;
   - kontenera/lane/frame;
   - w Table dodatkowo: widoku, nagłówka kolumny, wiersza i komórki.
8. Kebab Menu 1: Organizacja, Udostępnianie, Wersje, Więcej, Strefa niebezpieczna.
9. Convert: każdy widoczny cel, bramki, potwierdzenia, komunikaty i rezultat.
10. Cofnij/ponów, zapis, refresh, zamknięcie i ponowne otwarcie.

Dla **każdego** przycisku zapisz osobny wiersz:

| ID | Narzędzie | Powierzchnia | Kontekst | Etykieta/ikona | Oczekiwany cel | Wynik | Trwałość | Sens | Duplikat/gdzie | Rekomendacja | Dowód |
|---|---|---|---|---|---|---|---|---|---|---|---|

### Przebieg B — zbudowanie realnej sceny biznesowej

Nie używaj gotowego finalnego szablonu jako substytutu budowy. Możesz użyć szablonu jako jednego testowanego wejścia, ale potem wykonaj pracę ręcznie i oceń dostępność funkcji.

Po każdym kroku zanotuj: `MOŻLIWE`, `NATURALNE`, `OPTYMALNE`, liczbę kliknięć, zgubienie kontekstu, brakujące funkcje i proponowane uproszczenie.

## 6. Badanie 1 — Mind Map

### Cel biznesowy

Zbuduj mapę decyzji: **„Jak zmniejszyć churn klientów B2B w ciągu 90 dni?”**

Minimalny rezultat:

- centrum problemu;
- gałęzie: Symptomy, Hipotezy, Dowody, Segmenty klientów, Eksperymenty, Ryzyka;
- minimum 3 poziomy hierarchii i 18 węzłów;
- co najmniej 2 połączenia poprzeczne;
- komentarz, link/wiedza i jeden element oznaczony jako priorytet;
- auto-layout, ręczna zmiana układu, kopiowanie/duplikowanie;
- jedna bezpiecznie zastosowana funkcja AI z oceną preview/undo;
- zapis, refresh, reopen.

Sprawdź, czy użytkownik rozumie różnicę między dodaniem dziecka, rodzeństwa, połączenia i ramki oraz czy menu PPM nie przytłacza akcjami AI.

## 7. Badanie 2 — Process Flow

### Cel biznesowy

Zbuduj proces: **„Obsługa reklamacji klienta B2B od zgłoszenia do zamknięcia”**.

Minimalny rezultat:

- Start i End;
- co najmniej 8 kroków;
- 2 decyzje i rozgałęzienia pozytywne/negatywne;
- minimum 2 lanes/role;
- etykiety połączeń;
- jedna pętla korekcyjna;
- zmiana właściwości kroku i połączenia;
- grid/snap on/off, auto-layout, undo/redo;
- zapis, refresh, reopen.

Sprawdź, czy semantyka Start/End/Action/Decision/Lane jest jasna, czy kierunek i etykiety połączeń są naturalne oraz czy właściwości nie są rozproszone między panelem, railem i PPM.

## 8. Badanie 3 — Whiteboard

### Cel biznesowy

Przeprowadź miniwarsztat: **„Priorytetyzacja inicjatyw AI na następny kwartał”**.

Minimalny rezultat:

- co najmniej 12 karteczek w 3 klastrach;
- nagłówki tekstowe;
- 3 kształty lub ramki;
- minimum 4 połączenia;
- użycie rysowania odręcznego;
- wyrównanie, rozłożenie, grupowanie/warstwy i blokada;
- komentarz oraz jedna akcja wiedzy/AI;
- przeniesienie raila w inne miejsce i reset;
- zapis, refresh, reopen.

Sprawdź, czy rail zawiera tylko narzędzia tworzenia, czy zaznaczenie daje podręczny pasek edycji i czy długa lista PPM jest profesjonalna, możliwa do przeskanowania oraz nie wychodzi poza canvas.

## 9. Badanie 4 — Table

### Cel biznesowy

Zbuduj tabelę: **„Portfel inicjatyw AI — priorytetyzacja”**.

Minimalny rezultat:

- minimum 10 wierszy;
- kolumny: Nazwa, Obszar, Koszt, Korzyść, Ryzyko, Właściciel, Status, Priorytet;
- właściwe typy danych;
- edycja komórki, kopiuj/wklej, clear i expand;
- sortowanie, filtrowanie, grupowanie;
- co najmniej 2 zapisane widoki;
- dodanie/usunięcie/zmiana kolumny i wiersza;
- bulk selection i jedna operacja masowa;
- jedna funkcja AI z preview;
- eksport i sprawdzenie rezultatu;
- zapis, refresh, reopen.

Sprawdź, czy Table nie używa pojęć canvasowych, czy menu komórki/wiersza/kolumny/widoku nie mieszają zakresów i czy użytkownik rozumie różnicę między zmianą danych a ustawieniem widoku.

## 10. Próby przekrojowe po czterech badaniach

1. Przełącz reprezentację tej samej idei Mind Map → Whiteboard → Process Flow → Table → Mind Map. Sprawdź, co jest wspólne, a co zostaje narzędziowe.
2. Menu 2: przejdź Ideas → Decisions → Tasks → Notebook → Ideas. URL, aktywny przycisk, Menu 3 i treść muszą zmieniać się razem.
3. Otwórz panel, rail popover, menu PPM i dolny overflow w rozsądnych kombinacjach. Sprawdź arbitraż i kolizje.
4. Resize: 1280×800, 1440×900 i 1920×1080.
5. Zoom interfejsu 100% i 200%.
6. Light/dark oraz PL/EN.
7. Klawiatura: Tab, Shift+Tab, Enter, Space, strzałki, Home/End, Escape, Shift+F10.
8. Offline/błąd zapisu/loading/disabled, jeśli można bezpiecznie wywołać.
9. Sprawdź tooltip każdego icon-only: nazwa, zakres, skrót i powód niedostępności.
10. Sprawdź, czy żadna kontrolka nie zasłania Menu 1, Menu 3, panelu, raila, PPM, dolnego paska, powiadomień ani Teresy.

## 11. Wymagane raporty

Zapisz w `docs/qa/ideas-manual-audit-2026-08-09/`:

1. `00_ENVIRONMENT_AND_VERSION.md`
2. `01_MIND_MAP_AUDIT.md`
3. `02_PROCESS_FLOW_AUDIT.md`
4. `03_WHITEBOARD_AUDIT.md`
5. `04_TABLE_AUDIT.md`
6. `05_ALL_BUTTONS_INVENTORY.csv`
7. `06_CROSS_TOOL_SUMMARY.md`
8. `07_RECOMMENDED_CHANGES.csv`
9. `screens/` — dowody wizualne

Każdy raport narzędzia ma mieć trzy oddzielne części:

### A. Podłączenie i kompletność

- co działa;
- co jest PARTIAL/FAIL/NOT VERIFIED;
- trwałość po refresh/reopen;
- brakujące handlery i martwe kliknięcia.

### B. Sens i architektura funkcji

- CORE/USEFUL/EXPERT/DUPLICATE/MISPLACED/UNCLEAR/REMOVE;
- dlaczego funkcja powinna zostać, zmienić nazwę, przenieść, scalić lub zniknąć;
- brakujące elementy menu.

### C. Budowa sceny

- czy cel był możliwy;
- czy przebieg był naturalny;
- czy przebieg był optymalny;
- mapa tarcia krok po kroku;
- konkretne rekomendacje skracające pracę.

## 12. Raport końcowy — obowiązkowe odpowiedzi

`06_CROSS_TOOL_SUMMARY.md` musi odpowiedzieć wprost:

1. Czy wszystkie konieczne elementy są podłączone?
2. Czy każda obecna funkcja ma logiczne uzasadnienie?
3. Jakich elementów menu brakuje?
4. Czy budowa w każdym narzędziu jest intuicyjna i naturalna?
5. Co należy usunąć, scalić, przenieść, przemianować albo dodać?
6. Które problemy są wspólne systemowo, a które specyficzne dla narzędzia?

Zakończ tabelą priorytetów:

| ID | Narzędzie/system | Problem | Dowód | Wpływ | Rekomendacja | Priorytet P0–P3 | Kryterium akceptacji |
|---|---|---|---|---|---|---|---|

Nie używaj ogólników typu „poprawić UX”. Każda rekomendacja musi wskazywać konkretną powierzchnię, stan, zmianę i mierzalny rezultat.

## 13. Warunek zakończenia

Audyt jest kompletny dopiero, gdy:

- wykonano oba przebiegi dla wszystkich czterech narzędzi;
- każdy widoczny przycisk ma wiersz w inventory albo jawne `NOT VERIFIED` z powodem;
- każda scena osiągnęła minimalny rezultat lub ma opisany blocker;
- istnieje dowód wersji środowiska;
- wszystkie raporty i screenshoty są zapisane;
- raport końcowy rozdziela fakty, obserwacje, wnioski i rekomendacje.

