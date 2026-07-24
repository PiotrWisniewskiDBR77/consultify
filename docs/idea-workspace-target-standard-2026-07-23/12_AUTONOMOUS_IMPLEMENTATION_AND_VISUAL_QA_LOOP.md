# Idea Workspace — autonomiczna pętla implementacji i jakości wizualnej

Data: 2026-07-23  
Produkt: Consultify / Idea Workspace  
Zakres: Mind Map, Whiteboard, Process Flow, Table i wspólna powłoka Idea  
Odbiorca: Claude Code lub inny agent programistyczny pracujący w repozytorium Consultify

## 1. Cel

Ten dokument jest kontraktem wykonawczym. Agent ma:

1. przeczytać kompletny standard Idea Workspace,
2. zrozumieć aktywny kod i dane,
3. wdrażać standard etapami,
4. testować zachowanie w prawdziwej przeglądarce,
5. wykonywać kontrolowane screenshoty,
6. zlecać ocenę niezależnym agentom-sceptykom,
7. poprawiać kod po każdej wykrytej niezgodności,
8. powtarzać cykl do spełnienia wszystkich bramek,
9. zakończyć dopiero po przedstawieniu kompletu dowodów.

Agent nie może uznać zadania za ukończone na podstawie własnego przekonania. Wymagane są:

- testy funkcjonalne,
- testy struktury i stanów,
- testy dostępności,
- screenshoty obowiązkowych widoków,
- raporty niezależnych recenzentów,
- macierz wymagań z dowodami,
- dwie czyste rundy końcowej regresji.

## 2. Źródła prawdy

Agent czyta cały katalog:

`docs/idea-workspace-target-standard-2026-07-23/`

Kolejność ważności:

1. `00_MASTER_DEEP_STANDARD.md` — nadrzędna definicja produktu i UI.
2. Ten dokument — sposób realizacji i weryfikacji.
3. Dokumenty `01`–`10` — szczegóły komponentów i narzędzi.
4. `11_TECHNICAL_ACCEPTANCE_AND_BACKLOG.md` — kolejność napraw.
5. Kod produkcyjny — stan obecny, a nie wzorzec docelowy.

Jeśli dokumenty szczegółowe są sprzeczne z dokumentem głównym, obowiązuje dokument główny.

Jeśli standard nie odpowiada na istotne pytanie, agent:

- stosuje istniejący design system Consultify, o ile nie narusza standardu,
- zapisuje decyzję i jej uzasadnienie,
- przekazuje ją Architektowi-sceptykowi i Krytykowi wizualnemu,
- nie tworzy przypadkowego nowego wzorca.

Stan obecny nie jest wzorcem wizualnym. Nie wolno utworzyć golden snapshotów z obecnego wadliwego interfejsu, a następnie uznać zgodności z nim za sukces.

## 3. Operacyjna definicja „10/10”

Ocena 10/10 oznacza równoczesne spełnienie wszystkich warunków:

- 100% wymagań krytycznych ma status `verified`,
- 100% scenariuszy P0 i P1 przechodzi,
- 0 martwych kliknięć i cichych no-op,
- 0 błędów konsoli wynikających z badanych przepływów,
- 0 nieobsłużonych błędów sieciowych,
- 0 naruszeń dostępności `critical` lub `serious`,
- 0 nakładających się elementów, uciętych etykiet i kontrolek poza viewportem,
- komplet wymaganych screenshotów,
- każda kategoria wizualna ma co najmniej 9/10,
- średnia ocena wizualna wynosi co najmniej 9.5/10,
- żaden niezależny recenzent nie zgłasza veta,
- dwie kolejne pełne rundy nie wykrywają nowej regresji P0/P1,
- każde wymaganie ma przypisany dowód.

Poważny błąd nie może zostać skompensowany wysoką oceną innej części. Jeśli prawy panel nie przełącza treści, system nie jest gotowy niezależnie od jakości typografii.

## 4. Role agentów

Jedna instancja nie może projektować, implementować i samodzielnie zatwierdzać własnej pracy.

### 4.1. Orkiestrator

Odpowiada za plan, kolejność prac, macierz wymagań, delegowanie recenzji, bramki jakości i raport końcowy. Nie wystawia sam sobie końcowej oceny wizualnej.

### 4.2. Implementer

Odpowiada za analizę kodu, wdrożenie, testy, uruchomienie aplikacji i naprawę błędów. Nie może odrzucić uwagi recenzenta bez wskazania standardu, testu albo screenshotu, który ją obala.

### 4.3. Architekt-sceptyk

Sprawdza:

- czy Idea pozostaje jednym obiektem z czterema reprezentacjami,
- czy Menu 1, Menu 3, rail, prawy panel i context menus mają rozdzielone role,
- czy nie powstały duplikacje,
- czy scope każdej akcji jest poprawny,
- czy Table P15 jest kierunkiem docelowym,
- czy implementacja nie utrwala legacy tylko dlatego, że było łatwiej.

### 4.4. Sceptyk zachowania

Sprawdza:

- kliknięcia i skróty,
- tooltipy,
- disabled reasons,
- loading, error i empty state,
- selection i multi-selection,
- undo/redo,
- focus i Escape,
- zamykanie i przełączanie paneli,
- stan po odświeżeniu.

Podstawowym dowodem są scenariusze Playwrighta, trace i logi.

### 4.5. Krytyk wizualny

Ocenia realne screenshoty:

- hierarchię,
- kompozycję,
- spacing i wyrównanie,
- gęstość i czytelność,
- spójność ikon,
- kolory i kontrast,
- jakość prawego panelu,
- różne viewporty,
- brak ucinania i nakładania.

Nie może zaakceptować ekranu wyłącznie dlatego, że testy funkcjonalne przechodzą.

### 4.6. Sceptyk dostępności

Sprawdza nazwy kontrolek, kolejność i widoczność fokusu, klawiaturę, kontrast, role i stany ARIA, Escape, pułapki fokusu oraz komunikowanie błędów i postępu.

### 4.7. Sceptyk regresji i danych

Sprawdza:

- wpływ zmian wspólnych na wszystkie cztery narzędzia,
- Convert całej Idea i zaznaczenia,
- Import oraz możliwość przywrócenia danych,
- zapis i odświeżenie,
- konflikty i utratę pracy,
- lokalność wybranego widoku użytkownika,
- proposal review i undo dla AI.

## 5. Artefakty każdej iteracji

Każda iteracja tworzy osobny katalog:

```text
artifacts/idea-workspace-qa/<RUN_ID>/
  00-run-summary.md
  01-requirements-traceability.md
  02-functional-results.json
  03-console-and-network.md
  04-accessibility.md
  05-visual-scorecard.md
  06-review-architecture.md
  07-review-behavior.md
  08-review-visual.md
  09-review-regression.md
  screenshots/
    1280x800/
    1440x900/
    1600x1000/
    1920x1080/
  traces/
  videos/
  diffs/
```

`RUN_ID` zawiera datę, czas i skrócony hash commita. Nie wolno nadpisywać wcześniejszych iteracji.

## 6. Macierz śledzenia wymagań

Przed zmianą kodu Orkiestrator tworzy `01-requirements-traceability.md`.

Identyfikatory:

- `GLOBAL-*`
- `MENU1-*`
- `MENU3-*`
- `LEFT-*`
- `RIGHT-*`
- `CONTEXT-*`
- `AI-*`
- `CONVERT-*`
- `MINDMAP-*`
- `WHITEBOARD-*`
- `FLOW-*`
- `TABLE-*`
- `A11Y-*`
- `VISUAL-*`

Format:

| ID | Wymaganie | Priorytet | Test | Widoki/stany | Dowód | Status |
|---|---|---:|---|---|---|---|
| RIGHT-001 | Rail ma 5 zakładek w stałej kolejności | P0 | DOM + screenshot | 4 narzędzia | test + PNG | pending |
| RIGHT-002 | Ikony przełączają realną treść | P0 | Playwright | 5 zakładek | trace | pending |
| LEFT-001 | Rail nie przełącza reprezentacji | P1 | DOM + screenshot | 4 narzędzia | test + PNG | pending |
| FLOW-001 | Add element zawiera Start, End, Activity i Decision | P1 | Playwright | Flow | trace + PNG | pending |

Statusy:

- `pending`
- `implemented`
- `verified`
- `failed`
- `blocked`

`implemented` nie znaczy „gotowe”. Zakończenie wymaga `verified` i dowodu.

## 7. Kolejność wdrożenia

### Etap 0 — stan wyjściowy

Agent:

1. uruchamia istniejące testy,
2. uruchamia aplikację,
3. wykonuje screenshoty „przed”,
4. zapisuje istniejące błędy konsoli i sieci,
5. sprawdza feature flags,
6. identyfikuje aktywną implementację Table,
7. przygotowuje deterministyczne dane testowe,
8. tworzy macierz wymagań.

### Etap 1 — integralność danych i architektura

Najpierw poprawić:

- scope akcji,
- routingi i handlery,
- Convert,
- Import,
- zapis i konflikty,
- lokalność stanu widoku użytkownika.

Warstwa wizualna nie może maskować błędów danych.

### Etap 2 — wspólna powłoka

Wdrożyć:

- Menu 1,
- Menu 3 zależne od `activeTool`,
- przełącznik reprezentacji w prawym dolnym rogu,
- wspólne stany,
- usunięcie nakładających się toolbarów.

### Etap 3 — prawy panel

Zbudować pięć realnych modułów:

1. Przegląd,
2. Inspektor,
3. Powiązania,
4. Komentarze,
5. Historia.

Nie wolno pozostawić pięciu ikon renderujących tę samą treść.

### Etap 4 — lokalne narzędzia

Wdrożyć lewy rail, floating toolbar, menu kontekstowe, More, undo/redo, tooltipy i skróty.

### Etap 5 — narzędzia

Osobno doprowadzić do standardu Mind Map, Whiteboard, Process Flow i Table P15.

### Etap 6 — AI i rezultaty

Wdrożyć poziomy AI, proposal review, historię AI, Convert, Export, Import i Templates.

### Etap 7 — jakość wizualna i dostępność

Po poprawie zachowania dopracować spacing, rozmiary, alignment, hover/focus/active/disabled, kontrast, gęstość, animacje i viewporty.

## 8. Przebieg jednej iteracji

1. Orkiestrator wybiera jeden spójny zakres.
2. Implementer zapisuje spodziewany efekt i plan testów.
3. Implementer zmienia kod.
4. Uruchamia formatter, lint, typy i testy jednostkowe.
5. Uruchamia aplikację z deterministycznymi danymi.
6. Playwright wykonuje scenariusze funkcjonalne.
7. Playwright zapisuje trace, screenshoty i wideo błędów.
8. Uruchamiany jest skan dostępności.
9. Uruchamiane są testy geometrii i snapshoty.
10. Krytyk wizualny ocenia obrazy.
11. Pozostali sceptycy oceniają swój zakres.
12. Orkiestrator scala uwagi i klasyfikuje błędy.
13. Jeśli istnieje P0/P1, rozpoczyna następną iterację.
14. Jeśli scorecard nie spełnia progu, poprawia P2.
15. Po spełnieniu zakresu uruchamia regresję czterech narzędzi.

Każda poprawka wizualna wymaga ponownego przejścia scenariusza, którego dotyczy.

## 9. Priorytety

### P0 — blokada

Utrata danych, błędna konwersja, niedziałający podstawowy przepływ, martwa główna akcja, brak zapisu, prawy panel nieprzełączający treści, aplikacja nieuruchamiająca się lub współdzielony stan widoku użytkowników.

### P1 — poważny

Nieprawidłowy scope, duplikacja kluczowych akcji, brak wymaganego stanu, nakładanie elementów, ucięta ważna treść, menu poza viewportem, brak klawiatury, AI bez preview albo brak obsługi błędu.

### P2 — jakość

Spacing, hierarchia, niespójna ikona, zły empty state, zbędna pozycja w More lub odchylenie wizualne. P2 musi zostać naprawione, jeśli obniża kategorię poniżej 9/10.

### P3 — usprawnienie

Pomysł spoza zaakceptowanego standardu. Trafia do backlogu i nie rozszerza bieżącego zakresu.

## 10. Stabilne środowisko wizualne

Screenshoty muszą być porównywalne:

- Chromium przypięty przez Playwright,
- te same fonty lokalnie i w CI,
- `deviceScaleFactor: 1`,
- jasny motyw, jeśli dark mode nie jest w zakresie,
- stała data i czas,
- deterministyczne dane i użytkownik,
- wyłączone animacje,
- `prefers-reduced-motion: reduce`,
- ukryty caret i kursor,
- zakończone ładowanie fontów i danych,
- zoom aplikacji 100%,
- brak DevTools.

Wymagane viewporty:

| Viewport | Cel |
|---|---|
| 1920×1080 | szeroki desktop |
| 1600×1000 | podstawowy viewport projektowy |
| 1440×900 | główny viewport akceptacyjny |
| 1280×800 | minimalny desktop bez nakładania |

Nie należy udawać obsługi mobilnej, jeśli Idea Workspace jest produktem desktopowym i nie ma takiego wymagania.

## 11. Screenshoty

Każdy badany stan dostaje screenshot całego viewportu i kluczowego komponentu.

Nazwa:

```text
<tool>__<surface>__<state>__<viewport>.png
```

Przykłady:

```text
mindmap__right-panel__overview__1440x900.png
whiteboard__menu3__workshop-open__1440x900.png
process-flow__context-menu__edge__1600x1000.png
table__inspector__row-selected__1280x800.png
```

Screenshot trzeba powtórzyć, jeśli zawiera losowy toast, trwającą animację, błędne dane, kursor zasłaniający UI, niezaładowany font albo niezamierzony skeleton.

## 12. Playwright — warstwy weryfikacji

### 12.1. Zachowanie

Każda widoczna akcja wymaga scenariusza:

1. znalezienie po roli i nazwie,
2. sprawdzenie widoczności lub poprawnego disabled state,
3. wykonanie,
4. sprawdzenie efektu w UI,
5. sprawdzenie danych lub requestu,
6. sprawdzenie undo dla mutacji.

Preferowane są role, nazwy dostępności i stabilne `data-testid`. Nie budować zestawu na kruchych selektorach zależnych od układu CSS.

### 12.2. Geometria

Automatycznie sprawdzać:

- brak przecięcia Menu 1 z Menu 3,
- brak przecięcia raila z workspace,
- brak przecięcia prawego panelu z prawym railem,
- floating toolbar i context menu mieszczą się w viewportcie,
- minimalny obszar interakcji kontrolek,
- etykiety mieszczą się w kontenerach,
- widoczne elementy nie mają zerowego rozmiaru,
- workspace pozostaje używalny po otwarciu prawego panelu i Teresy.

Kolizje obliczać z `getBoundingClientRect()`. Raport ma podać nazwy elementów i wielkość przecięcia.

### 12.3. Regresja wizualna

Po zatwierdzeniu wzorcowej implementacji używać:

```ts
await expect(page).toHaveScreenshot('state.png', {
  animations: 'disabled',
});
```

Zasady:

- osobny baseline dla każdego viewportu i stanu,
- niska, jawna tolerancja,
- maskowanie tylko prawdziwie dynamicznych obszarów,
- aktualizacja baseline'u wymaga uzasadnienia,
- agent nie może aktualizować baseline'u tylko dlatego, że test nie przechodzi.

### 12.4. Struktura dostępności

Zapisać ARIA snapshots dla:

- Menu 1,
- Menu 3,
- lewego raila,
- prawego raila i modułów,
- floating toolbar,
- context menu,
- Convert,
- AI proposal review.

### 12.5. Dostępność

Skan `axe` obejmuje widok bazowy, otwarty panel, otwarte menu, dialog, zaznaczenie i error state.

Osobny test klawiaturowy sprawdza:

- Tab i Shift+Tab,
- Enter i Space,
- strzałki w menu i zakładkach,
- Escape,
- widoczny focus,
- powrót fokusu do kontrolki otwierającej.

### 12.6. Konsola i sieć

Każdy scenariusz P0/P1 zbiera:

- błędy konsoli,
- `pageerror`,
- odpowiedzi 4xx/5xx,
- unhandled rejection,
- trace,
- wideo dla niepowodzenia.

Allowlista znanego błędu musi mieć identyfikator, właściciela, uzasadnienie i datę wygaśnięcia.

## 13. Macierz stanów do sfotografowania

### 13.1. Wspólne dla każdego narzędzia

- stan domyślny,
- Menu 1 i Menu 3,
- tooltip,
- globalny kebab,
- prawy panel zamknięty,
- Przegląd,
- Inspektor bez zaznaczenia,
- Inspektor z zaznaczeniem,
- Powiązania: dane i empty,
- Komentarze: dane i empty,
- Historia: dane i empty,
- Teresa razem z prawym panelem,
- przełącznik reprezentacji,
- loading,
- error,
- disabled z powodem,
- pusty workspace,
- viewport 1280×800.

### 13.2. Mind Map

- rozbudowana mapa,
- węzeł, gałąź i multi-selection,
- floating toolbar,
- menu tła, węzła i krawędzi,
- Add node,
- Connect,
- auto-layout przed i po,
- AI proposal review,
- minimapa.

### 13.3. Whiteboard

- board z frame'ami, notes i relacjami,
- sticky, shape i multi-selection,
- floating toolbar,
- menu tła, obiektu i połączenia,
- Shape popover,
- Workshop otwarty i zamknięty,
- timer,
- voting,
- facilitator mode,
- AI proposal review.

### 13.4. Process Flow

- flow z lane'ami,
- krok, decyzja, edge, lane i multi-selection,
- floating toolbar,
- menu tła, kroku i edge,
- Add element: Start, End, Activity, Decision,
- walidacja poprawna i z ostrzeżeniami,
- KPI,
- AI Coach/proposal,
- auto-layout przed i po.

### 13.5. Table P15

- pusta i pełna tabela,
- Table, Kanban i Timeline,
- row, multi-row, cell i column selection,
- menu wiersza, komórki i kolumny,
- Inspektor rekordu i pola,
- Filter, Sort, Group, Columns, Views,
- Import preview,
- AI Fill proposal,
- AI Categorize proposal,
- Convert selected rows.

## 14. Wizualny scorecard

| Kategoria | Waga | Kryterium |
|---|---:|---|
| Hierarchia i orientacja | 25% | Wiadomo, gdzie jestem i co jest globalne, lokalne i najważniejsze |
| Kompozycja i spacing | 25% | Wyrównanie, odstępy, brak konkurencji i przypadkowych pustek |
| Czytelność i gęstość | 20% | Czytelność przy realnej ilości danych |
| Spójność systemowa | 20% | Cztery narzędzia wyglądają jak jeden produkt |
| Wykończenie stanów | 10% | Hover, focus, active, disabled, loading, error i empty |

Oceny:

- `10` — brak wykrywalnej niezgodności; wzorzec produkcyjny.
- `9` — bardzo dobry; tylko drobne odchylenie bez wpływu na orientację.
- `8` — dobry, ale wymaga kolejnej iteracji.
- `7` — funkcjonalny, lecz niespójny albo przeciążony.
- `5–6` — wyraźne problemy hierarchii, spacingu lub zachowania.
- `<5` — nie spełnia standardu.

### Automatyczne veto

Wynik jest odrzucony niezależnie od średniej, jeśli występuje:

- nakładanie elementów,
- ucięta ważna etykieta,
- menu poza viewportem,
- panel zasłaniający kluczową treść,
- dwa konkurujące toolbary,
- niezrozumiała ikona bez tooltipa,
- aktywna zakładka bez czytelnego stanu,
- CTA bez hierarchii,
- przypadkowy scrollbar,
- niespójny wzorzec tego samego komponentu,
- tekst niepasujący do kontenera.

## 15. Instrukcja dla Krytyka wizualnego

Krytyk otrzymuje standard, screenshot, viewport, nazwę stanu i poprzednią iterację. Nie otrzymuje argumentacji Implementera, aby nie zakotwiczać oceny.

Odpowiada:

1. Co użytkownik zauważa jako pierwsze?
2. Czy hierarchia zgadza się z rolą warstw?
3. Czy toolbary, panele lub CTA konkurują?
4. Czy wyrównania i odstępy są intencjonalne?
5. Czy coś jest ucięte, ściśnięte albo nadmiernie puste?
6. Czy prawy panel jest integralnym komponentem?
7. Czy stan i scope są czytelne?
8. Czy ekran działa przy realnych danych?
9. Co dokładnie zmienić?
10. Jaka jest ocena każdej kategorii?

Każde znalezisko podaje powierzchnię, problem, naruszoną regułę, wymaganą zmianę, dowód i priorytet.

## 16. Osobna bramka prawego panelu

Prawy panel ma najwyższe ryzyko i podlega osobnej akceptacji.

### 16.1. Struktura

W każdym narzędziu rail pokazuje w tej samej kolejności:

1. Przegląd,
2. Inspektor,
3. Powiązania,
4. Komentarze,
5. Historia.

### 16.2. Przełączanie

Dla każdej ikony:

- kliknięcie otwiera właściwy renderer,
- nagłówek i treść odpowiadają zakładce,
- poprzednia treść znika,
- aktywna ikona jest oznaczona,
- ponowne kliknięcie zamyka panel,
- inna ikona przełącza treść bez resetu workspace.

### 16.3. Scope

- Przegląd: cała Idea.
- Inspektor: zaznaczenie albo ustawienia widoku.
- Powiązania: relacje i źródła.
- Komentarze: `Cała Idea | Zaznaczenie`.
- Historia: logi i filtry.

Convert i AI nie są zakładkami.

### 16.4. Wygląd

Panel:

- ma stałą szerokość zgodną ze standardem,
- ma jasne tło, border i radius,
- ma margines od canvasu i prawej krawędzi,
- przewija własną treść,
- nie przesuwa górnych menu,
- nie nakłada się przy 1280×800,
- pozostawia używalny workspace,
- ma dopracowane empty/loading/error,
- używa stałej wewnętrznej siatki odstępów.

### 16.5. Teresa i prawy panel

Teresa nie zastępuje panelu. Test potwierdza:

- widoczność obu,
- brak wyjścia poza viewport,
- przewidziany tryb kompaktowy dla minimalnego desktopu,
- niezależny focus i Escape.

## 17. Bramki zakończenia

### Funkcjonalna

- wszystkie P0/P1 przechodzą,
- brak martwych kliknięć,
- poprawny handler i scope,
- undo/redo działa per narzędzie,
- zapis i odświeżenie zachowują dane.

### Wizualna

- komplet screenshotów,
- brak veta,
- każda kategoria minimum 9/10,
- średnia minimum 9.5/10,
- prawy panel zaakceptowany,
- 1280×800 bez nakładania.

### Dostępności

- 0 `critical`,
- 0 `serious`,
- główny przepływ klawiaturą,
- widoczny focus,
- nazwy dostępności i tooltipy.

### Regresji

- wszystkie cztery narzędzia przechodzą po zmianach wspólnej powłoki,
- dwie kolejne rundy bez nowego P0/P1.

### Dowodowa

- każdy wymóg ma status `verified`,
- każdy ma dowód,
- każde znalezisko sceptyków jest rozwiązane albo odrzucone z dowodem,
- raport końcowy wskazuje artefakty.

Brak dowodu oznacza brak ukończenia.

## 18. Ochrona przed pozorną pętlą

Po trzech iteracjach bez wzrostu scorecardu lub spadku liczby błędów agent:

1. zatrzymuje bieżący kierunek,
2. wykonuje root-cause analysis,
3. sprawdza architekturę, style, dane i stabilność testu,
4. zapisuje zmianę podejścia,
5. dopiero potem kontynuuje.

Nie wolno:

- podnosić wyniku bez nowych dowodów,
- usuwać trudnego testu,
- zwiększać tolerancji bez uzasadnienia,
- maskować dużych części screenshotu,
- aktualizować baseline'u po regresji,
- wyłączać accessibility rules bez ticketu i terminu,
- uznawać flaky testu za sukces po pojedynczym przejściu.

Osiągnięcie limitu iteracji oznacza raport blokady, nie akceptację.

## 19. Raport iteracji

```markdown
# Iteracja <RUN_ID>

## Zakres
## Zmienione wymagania
## Wyniki automatyczne
- lint:
- typecheck:
- unit:
- integration:
- Playwright:
- accessibility:
- visual:

## Scorecard wizualny
## Nowe błędy
## Zamknięte błędy
## Regresje
## Decyzja
- CONTINUE
- BLOCKED
- READY_FOR_FINAL_REGRESSION
- ACCEPTED
## Dowody
```

## 20. Raport końcowy

Raport zawiera:

1. zakres wdrożenia,
2. listę spełnionych wymagań,
3. macierz z dowodami,
4. wyniki testów,
5. scorecard wizualny,
6. galerię screenshotów,
7. osobne potwierdzenie prawego panelu,
8. potwierdzenie czterech narzędzi,
9. dostępność,
10. ograniczenia P3,
11. listę baseline'ów,
12. hash stanu objętego raportem.

„Wszystko działa” nie jest raportem.

## 21. Gotowy prompt startowy do Claude Code

```text
Pracujesz w repozytorium Consultify. Masz wdrożyć pełny docelowy standard Idea Workspace dla Mind Map, Whiteboard, Process Flow i Table.

To jest zadanie implementacyjne z autonomiczną pętlą jakości. Nie kończ po pierwszej działającej wersji.

NAJPIERW:

1. Przeczytaj w całości:
   - docs/idea-workspace-target-standard-2026-07-23/00_MASTER_DEEP_STANDARD.md
   - docs/idea-workspace-target-standard-2026-07-23/12_AUTONOMOUS_IMPLEMENTATION_AND_VISUAL_QA_LOOP.md
   - wszystkie dokumenty 01–11 z tego katalogu.
2. Przeanalizuj aktywny kod, feature flags, dane, testy i sposób uruchamiania.
3. Nie traktuj obecnego UI jako wzorca.
4. Utwórz macierz wymagań i dowodów.
5. Wykonaj screenshoty stanu obecnego wyłącznie jako materiał „przed”.

ARCHITEKTURA DOCELOWA:

- Jedna Idea, jeden model danych, cztery reprezentacje.
- Menu 1 zarządza całą Idea.
- Menu 3 zarządza aktualnym widokiem.
- Lewy rail służy do tworzenia i edycji.
- Prawy panel ma dokładnie: Przegląd, Inspektor, Powiązania, Komentarze, Historia.
- Floating toolbar i context menu działają na zaznaczeniu lub klikniętym kontekście.
- Prawy dolny róg zawiera zoom, fit, minimapę i przełącznik reprezentacji.
- Table P15 jest implementacją docelową.
- Convert, Export, Import, Templates i AI mają osobne znaczenia i scope.

SPOSÓB PRACY:

1. Realizuj etapy z dokumentu 12.
2. Po każdym logicznym zakresie uruchom formatter, lint, typecheck, testy, Playwright, axe i screenshoty.
3. Zapisuj artefakty w artifacts/idea-workspace-qa/<RUN_ID>/.
4. Nie aktualizuj golden screenshots bez jawnego uzasadnienia.
5. Nie maskuj problemów przez zwiększanie tolerancji.

AGENTY-SCEPTYCY:

Po każdej większej iteracji uruchom niezależnie:
1. Architekta-sceptyka.
2. Sceptyka zachowania.
3. Krytyka wizualnego analizującego prawdziwe screenshoty.
4. Sceptyka dostępności.
5. Sceptyka regresji i integralności danych.

Implementer nie może być jedynym recenzentem własnej pracy.

PĘTLA:

- P0/P1: popraw kod i powtórz walidację.
- Kategoria wizualna <9/10 lub średnia <9.5/10: popraw UI i powtórz screenshoty.
- Veto wizualne: popraw UI.
- Brak dowodu: wymaganie nie jest ukończone.
- Po spełnieniu zakresu uruchom pełną regresję czterech narzędzi.
- Wymagaj dwóch kolejnych czystych rund bez nowego P0/P1.

WARUNEK ZAKOŃCZENIA:

Nie kończ, dopóki:
- wszystkie krytyczne wymagania nie mają statusu verified,
- wszystkie scenariusze P0/P1 nie przechodzą,
- nie ma martwych kliknięć i cichych no-op,
- nie ma poważnych naruszeń dostępności,
- komplet screenshotów nie został oceniony,
- każda kategoria wizualna nie ma minimum 9/10,
- średnia nie wynosi minimum 9.5/10,
- prawy panel nie przechodzi osobnej bramki,
- nie ma dwóch kolejnych czystych rund regresji,
- raport końcowy nie ma kompletnej macierzy dowodów.

Przy blokadzie nie deklaruj sukcesu. Zapisz przyczynę, wykonane próby, dowody i decyzję człowieka potrzebną do odblokowania.

Zacznij od audytu i macierzy. Realizuj P0 → P1 → P2 w pętli:
implementacja → przeglądarka → screenshot → sceptycy → poprawka → regresja.
```

## 22. Utrzymywanie pętli w Claude Code

Jeżeli Claude Code obsługuje `/goal`, po promptcie startowym ustawić:

```text
/goal Zrealizuj standard Idea Workspace zgodnie z 00_MASTER_DEEP_STANDARD.md i 12_AUTONOMOUS_IMPLEMENTATION_AND_VISUAL_QA_LOOP.md. Kontynuuj implementację, testy Playwright, screenshoty, niezależne recenzje i poprawki, dopóki wszystkie bramki z dokumentu 12 nie zostaną spełnione i udowodnione. Brak dowodu albo otwarty P0/P1 oznacza, że cel nie został osiągnięty.
```

Jeśli `/goal` nie jest dostępne, można użyć Stop hooka. Hook ma sprawdzać manifest bramek, a nie bezwarunkowo tworzyć nieskończoną pętlę.

## 23. Subagenci Claude Code

Rekomendowane pliki:

```text
.claude/agents/
  idea-architecture-skeptic.md
  idea-behavior-skeptic.md
  idea-visual-critic.md
  idea-accessibility-skeptic.md
  idea-regression-skeptic.md
```

Recenzent:

- jest read-only,
- nie poprawia kodu podczas oceny,
- wymaga dowodów,
- ma prawo veta dla P0/P1,
- zwraca jeden format:

```markdown
# Review
## Verdict
PASS | FAIL | BLOCKED
## Findings
| ID | Priority | Surface | Evidence | Violated requirement | Required change |
## Missing evidence
## Score
## Veto
NONE | <reason>
```

## 24. Hooki

Hooki mogą:

- uruchamiać formatter i szybki lint po edycji,
- sprawdzać format raportu subagenta,
- przed zakończeniem sesji sprawdzać manifest bramek.

Hooki nie mogą:

- automatycznie akceptować screenshotów,
- automatycznie aktualizować baseline'ów,
- usuwać błędów z raportu,
- uruchamiać pełnej regresji po każdej zmianie pojedynczego pliku.

## 25. Maszynowy manifest bramek

Orkiestrator ma utrzymywać plik:

`artifacts/idea-workspace-qa/<RUN_ID>/quality-gates.json`

Minimalny format:

```json
{
  "runId": "2026-07-23T220000-abc1234",
  "commit": "abc1234",
  "status": "continue",
  "gates": {
    "functional": {
      "passed": false,
      "p0Open": 0,
      "p1Open": 2,
      "deadClicks": 0,
      "silentNoOps": 0,
      "testsPassed": 134,
      "testsFailed": 2
    },
    "visual": {
      "passed": false,
      "screenshotsExpected": 84,
      "screenshotsProduced": 84,
      "vetoes": 1,
      "minimumCategoryScore": 8.5,
      "weightedAverage": 9.1
    },
    "accessibility": {
      "passed": true,
      "critical": 0,
      "serious": 0,
      "keyboardFlowsPassed": true
    },
    "regression": {
      "passed": false,
      "cleanConsecutiveRuns": 0,
      "requiredCleanRuns": 2
    },
    "evidence": {
      "passed": false,
      "requirementsTotal": 163,
      "requirementsVerified": 151,
      "requirementsWithoutEvidence": 12
    }
  },
  "reviewers": {
    "architecture": "pass",
    "behavior": "fail",
    "visual": "fail",
    "accessibility": "pass",
    "regression": "pass"
  },
  "blockingFindingIds": [
    "RIGHT-002",
    "VISUAL-014"
  ]
}
```

Dozwolone wartości głównego `status`:

- `continue` — pętla ma trwać,
- `blocked` — potrzebna jest zewnętrzna decyzja lub zależność,
- `ready_for_final_regression` — wszystkie bramki lokalne przeszły,
- `accepted` — pełna regresja przeszła dwa razy i wszystkie dowody istnieją.

`accepted` jest dozwolone tylko wtedy, gdy:

- wszystkie `gates.*.passed` mają wartość `true`,
- `blockingFindingIds` jest puste,
- wszyscy recenzenci mają `pass`,
- `cleanConsecutiveRuns >= requiredCleanRuns`.

Stop hook lub `/goal` ma sprawdzać ten manifest. Tekstowa deklaracja agenta nie może zastąpić manifestu.

## 26. Gotowe instrukcje dla subagentów

Poniższe instrukcje można umieścić w odpowiednich plikach `.claude/agents/`. Agent główny powinien dopasować składnię frontmatter do aktualnej wersji Claude Code, ale zachować treść i tryb read-only.

### 26.1. Architekt-sceptyk

```text
Jesteś niezależnym architektem-sceptykiem Idea Workspace. Nie zmieniasz kodu.

Przeczytaj 00_MASTER_DEEP_STANDARD.md, dokumenty 01–12 oraz diff aktualnej iteracji. Sprawdź implementację i dowody.

Szukaj przede wszystkim:
- rozbicia jednej Idea na niesynchronizowane narzędzia,
- niepoprawnego scope akcji,
- użycia handlerów mm_* poza Mind Map,
- dublowania funkcji między Menu 1, Menu 3, railami, panelami i menu kontekstowymi,
- utrwalenia Table legacy zamiast P15,
- pomieszania Convert, Export, Import, Templates i AI,
- globalnego synchronizowania lokalnego stanu UI użytkownika,
- naruszenia integralności danych przez convert/import/save.

Nie akceptuj twierdzeń bez ścieżki kodu, testu albo trace. Każde znalezisko oznacz P0–P3 i przypisz do wymagania. Zwróć wyłącznie ustalony format Review. PASS jest możliwy tylko bez P0/P1 i bez brakujących dowodów architektonicznych.
```

### 26.2. Sceptyk zachowania

```text
Jesteś niezależnym sceptykiem zachowania Idea Workspace. Nie zmieniasz kodu.

Odtwórz badane przepływy w przeglądarce. Nie ograniczaj się do czytania implementacji.

Sprawdź:
- każdy widoczny przycisk i pozycję menu,
- właściwy efekt, scope i feedback,
- loading, disabled reason, error i empty state,
- single-select, multi-select i brak zaznaczenia,
- undo/redo,
- tooltipy,
- focus, Enter, Space, Escape i strzałki,
- stan po zapisaniu, odświeżeniu i ponownym wejściu,
- konsolę, pageerror i błędy sieciowe,
- czy nie ma cichych no-op.

Przy każdym błędzie wskaż dokładny scenariusz reprodukcji i trace/screenshot. PASS jest niemożliwy przy martwym kliknięciu, cichym no-op, błędnym scope lub braku scenariusza P0/P1.
```

### 26.3. Krytyk wizualny

```text
Jesteś niezależnym, rygorystycznym krytykiem wizualnym Idea Workspace. Nie zmieniasz kodu i nie oceniasz na podstawie opisu Implementera.

Otrzymujesz standard, listę viewportów i screenshoty. Oceniaj wyłącznie widoczny wynik.

Dla każdego screenshotu:
1. Opisz pierwszą zauważalną hierarchię.
2. Oceń orientację, kompozycję, spacing, gęstość, czytelność i spójność.
3. Sprawdź nakładanie, ucinanie, przypadkowe scrollbary, złe wyrównania i tekst niedopasowany do kontenera.
4. Sprawdź, czy Menu 1, Menu 3, lewy rail, workspace i prawy panel nie konkurują.
5. Sprawdź, czy prawy panel wygląda jak integralny systemowy komponent.
6. Porównaj te same komponenty między czterema narzędziami.
7. Oceń pięć kategorii 0–10 i uzasadnij każdy wynik.
8. Zgłoś veto przy wystąpieniu którejkolwiek reguły automatycznego veta.

Nie używaj ogólnych uwag typu „popraw wygląd”. Wskaż powierzchnię, problem, naruszoną regułę i konkretną zmianę. PASS wymaga minimum 9 w każdej kategorii, średniej 9.5 i braku veta.
```

### 26.4. Sceptyk dostępności

```text
Jesteś niezależnym sceptykiem dostępności Idea Workspace. Nie zmieniasz kodu.

Połącz wyniki axe, ARIA snapshots i ręczne scenariusze klawiaturowe.

Sprawdź:
- role i accessible names,
- aria-selected, aria-expanded, aria-disabled i stany dialogów,
- kolejność i widoczność fokusu,
- przywrócenie fokusu po zamknięciu,
- Escape,
- obsługę menu i tabs strzałkami,
- kontrast,
- rozpoznawalność ikon,
- komunikowanie zapisu, błędu, loadingu i wyniku AI,
- brak pułapek fokusu po otwarciu prawego panelu i Teresy.

PASS wymaga 0 critical, 0 serious i przejścia wszystkich głównych przepływów klawiaturą. Automatyczny skan bez testu klawiatury nie wystarcza.
```

### 26.5. Sceptyk regresji i danych

```text
Jesteś niezależnym sceptykiem regresji i integralności danych Idea Workspace. Nie zmieniasz kodu.

Sprawdź wszystkie cztery reprezentacje po zmianach wspólnych oraz operacje mutujące.

Wymagane kontrole:
- dane utworzone w jednej reprezentacji pozostają dostępne w pozostałych zgodnie z modelem,
- convert selection nie promuje całej Idea,
- każda konwersja zachowuje źródło i zakres,
- import ma preview/confirm/snapshot/restore,
- AI nie stosuje zmian bez proposal review,
- save i reload zachowują dane,
- konflikt nie nadpisuje cicho pracy,
- aktywny widok i zakładka panelu są lokalne dla użytkownika,
- regresja Mind Map, Whiteboard, Process Flow i Table P15 przechodzi.

PASS wymaga dowodu dla każdej kontroli i dwóch kolejnych czystych rund końcowych.
```

## 27. Oficjalne podstawy techniczne

- Playwright visual comparisons: `https://playwright.dev/docs/test-snapshots`
- Playwright screenshots: `https://playwright.dev/docs/screenshots`
- Playwright assertions: `https://playwright.dev/docs/test-assertions`
- Playwright ARIA snapshots: `https://playwright.dev/docs/aria-snapshots`
- Playwright accessibility: `https://playwright.dev/docs/accessibility-testing`
- Playwright trace viewer: `https://playwright.dev/docs/trace-viewer`
- Claude Code subagents: `https://docs.anthropic.com/en/docs/claude-code/sub-agents`
- Claude Code hooks: `https://docs.anthropic.com/en/docs/claude-code/hooks`
- Claude Code goals: `https://docs.anthropic.com/en/docs/claude-code/goal`

Automatyczna dostępność nie zastępuje oceny manualnej. Snapshot pikselowy nie zastępuje testu zachowania. Ocena screenshotu nie zastępuje kontroli danych. Dopiero połączenie wszystkich metod daje podstawę do rygorystycznej akceptacji.

## 28. Zasada końcowa

> Agent nie kończy, gdy ekran „wygląda dobrze”. Kończy, gdy zachowanie, dane, struktura, dostępność i wygląd spełniają standard, każdy warunek ma dowód, a niezależni sceptycy nie znajdują błędu blokującego.
