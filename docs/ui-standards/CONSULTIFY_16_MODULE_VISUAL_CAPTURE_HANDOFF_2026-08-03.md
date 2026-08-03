# Consultify — handoff programu zbierania screenów 16 modułów

Status: `READY_TO_LAUNCH`

Baseline aplikacji: `ad41701753206b1da50266522c248dcba6b119ac`

Środowisko: `https://demo.consultify.ai`
Zakres: kompletna ewidencja wizualna aktywnego desktopowego runtime

## 1. Cel

Program ma dostarczyć materiał pozwalający porównać wszystkie aktywne powierzchnie aplikacji
ze standardem UI/UX. Nie jest to sesja poprawiania kodu. Operator fotografuje, klasyfikuje i
raportuje. Każda wykryta wada trafia do ledgeru, ale nie jest naprawiana w trakcie capture.

Program jest podzielony na 16 osobnych rund. Jedna runda obejmuje dokładnie jeden moduł
głównego sidebara i kończy się checkpointem `AWAITING_VISUAL_REVIEW`. Przejście do kolejnej
rundy wymaga decyzji COO/CTO.

## 2. Twarde warunki startowe

Przed każdą rundą operator musi potwierdzić:

1. URL zaczyna się od `https://demo.consultify.ai` — bez `localhost`, dev-render i Storybooka;
2. `/api/health` zwraca `gitSha=ad41701753206b1da50266522c248dcba6b119ac`;
3. sesja jest uwierzytelniona i widoczny jest prawdziwy `MainLayout` z topbarem i sidebarem;
4. browser zoom wynosi 100%, viewport desktop ma dokładnie `1440x1000` CSS px;
5. wyłączone są DevTools, debug overlay i przypadkowe systemowe okna;
6. onboarding/tour/cookie banner są zamknięte, chyba że to właśnie fotografowany stan;
7. dane są załadowane, fonty gotowe, animacje zakończone;
8. aktywna trasa została potwierdzona w `AppRoutes.tsx`, a nie odgadnięta po nazwie komponentu.

Jeżeli SHA, logowanie albo aktywny runtime nie są zgodne, runda kończy się statusem
`BLOCKED_BASELINE` — nie wolno zastępować demo lokalnym harness’em.

## 3. Rundy

| Runda | Moduł sidebara | Slug katalogu |
| --- | --- | --- |
| 01 | Chat | `01-chat` |
| 02 | My Work | `02-my-work` |
| 03 | Interview | `03-interview` |
| 04 | Tools | `04-tools` |
| 05 | Assessment | `05-assessment` |
| 06 | Initiatives | `06-initiatives` |
| 07 | Execution | `07-execution` |
| 08 | Results | `08-results` |
| 09 | Finance | `09-finance` |
| 10 | Materials | `10-materials` |
| 11 | Audits | `11-audits` |
| 12 | Meetings | `12-meetings` |
| 13 | Organization | `13-organization` |
| 14 | Admin | `14-admin` |
| 15 | Internal Tools | `15-internal-tools` |
| 16 | Settings | `16-settings` |

Jeżeli moduł jest świadomie oznaczony `soon`, zwraca 501 albo nie ma danych, operator nadal
fotografuje prawdziwy stan i oznacza go `UNAVAILABLE_RUNTIME`. Nie tworzy fikcyjnego ekranu.

## 4. Zakres obowiązkowy każdej rundy

### 4.1 Powłoka i nawigacja

- overview modułu z pełnym topbarem, sidebarem, breadcrumbem i menu modułu;
- każda wewnętrzna zakładka, podmoduł i tryb widoku;
- stan aktywny, hover/focus tylko tam, gdzie ujawnia istotny komponent;
- wszystkie unikalne przełączniki widoku: list/table/kanban/calendar/timeline/grid/canvas.

### 4.2 Tabele i listy danych

Dla **każdej tabeli lub listy obiektów** wymagane są:

1. pełny widok tabeli z nagłówkiem i widoczną powłoką aplikacji;
2. rozwinięty preview/drawer/sheet reprezentatywnego wiersza;
3. rozwinięte menu kebab wiersza — menu oraz element źródłowy muszą mieścić się w kadrze;
4. rozwinięte menu kebab nagłówka lub całej tabeli, jeśli istnieje;
5. menu prawego przycisku myszy dla każdej powierzchni, która je obsługuje;
6. filtry, sortowanie, wybór kolumn, grupowanie i bulk actions — każdy unikalny panel;
7. stan zaznaczenia jednego i wielu wierszy, jeśli zmienia dostępne akcje;
8. każda odmienna rodzina wiersza/karty, jeśli ma inny zestaw akcji lub inny preview.

Nie wystarczy jeden screen tabeli, jeśli różne typy obiektów otwierają różne panele.

### 4.3 Obiekty, dokumenty i artefakty

Dla każdego typu obiektu dostępnego z modułu:

- ekran otwarcia i pełny editor/workspace;
- preview, properties/metadata oraz activity/history;
- wersje, komentarze, udostępnianie, eksport i AI panel, jeśli istnieją;
- każdy unikalny toolbar, rail, side panel, inspector i context menu;
- tryb pusty oraz populated tylko wtedy, gdy reprezentują różne komponenty;
- dialog potwierdzenia operacji ryzykownej, bez wykonywania destrukcyjnej akcji.

W Materials oznacza to osobno dokument, prezentację, tabelę/arkusz, raport, template i każdy
aktywny typ artefaktu. W Tools — każdy aktywny typ narzędzia i sesji, nie tylko katalog.

### 4.4 Wizardy, kreatory i formularze

- launcher „New/Create”;
- każdy krok wizarda;
- rozwinięte selecty, date pickery, pickery osób i obiektów;
- stan walidacji wymaganych pól;
- ekran review/summary;
- success/receipt po zapisie tylko jeżeli zapis można bezpiecznie wykonać;
- error/conflict tylko jeśli pojawia się naturalnie albo istnieje bezpieczny testowy scenariusz.

Operator nie sabotażuje demo i nie wywołuje błędów przez ingerencję w bazę lub requesty.

### 4.5 Motywy

- komplet zakresu interakcyjnego wykonywany jest w trybie ciemnym;
- w trybie jasnym wymagany jest co najmniej jeden reprezentatywny overview całego modułu;
- dodatkowy light screenshot jest wymagany, gdy komponent ma osobną implementację kolorów,
  wykres, modal, tabelę o niestandardowym tle albo wykryty problem kontrastu;
- przełączenie motywu nie może zmieniać danych ani trasy.

## 5. Standard kadru

- PNG, bez stratnej kompresji;
- viewport `1440x1000`, DPR zapisany w manifeście;
- pełna powłoka aplikacji, chyba że osobny close-up jest dodatkowym dowodem;
- tooltip/menu/popover nie może być ucięty przez krawędź obrazu;
- cursor poza ważnym tekstem; bez zaznaczonego tekstu i focus ringów przypadkowych;
- jedna intencja na screen — nazwa pliku musi odpowiadać temu, co widać;
- dane wrażliwe, tokeny, e-maile prywatne i sekrety nie mogą znaleźć się na obrazie;
- nie retuszujemy screenshotów. Problem graficzny ma pozostać widoczny.

## 6. Struktura katalogów

```text
artifacts/visual-acceptance/2026-08-03/sha-ad41701753/
  01-chat/
    manifest.jsonl
    inventory.md
    issues.md
    dark/desktop/
      00-overview/
      10-navigation/
      20-tables-lists/
      30-previews-details/
      40-menus-context/
      50-wizards-forms/
      60-editors-artifacts/
      70-states/
    light/desktop/
      00-overview/
  ...
  16-settings/
```

Nie wrzucamy plików luzem do `screens/`. Każdy obraz musi występować w manifeście.

## 7. Nazewnictwo plików

Format:

```text
r{round}__{module}__{theme}__desktop-1440x1000__{surface}__{state}__{seq}.png
```

Przykłady:

```text
r06__initiatives__dark__desktop-1440x1000__portfolio-table__default__001.png
r06__initiatives__dark__desktop-1440x1000__portfolio-table__row-preview-open__002.png
r06__initiatives__dark__desktop-1440x1000__portfolio-table__row-kebab-open__003.png
r06__initiatives__dark__desktop-1440x1000__roadmap__context-menu-open__004.png
r06__initiatives__light__desktop-1440x1000__module-overview__default__001.png
```

Zasady: małe litery ASCII, `kebab-case`, bez spacji, polskich znaków, losowych nazw i
timestampów. `seq` jest trzycyfrowe i rośnie osobno w każdym katalogu stanu.

## 8. Manifest

Każda linia `manifest.jsonl` opisuje jeden plik:

```json
{"round":"06","module":"initiatives","sha":"ad41701753","url":"https://demo.consultify.ai/initiatives","theme":"dark","viewport":"1440x1000","dpr":1,"surface":"portfolio-table","state":"row-kebab-open","objectType":"initiative","trigger":"row-kebab","filename":"dark/desktop/40-menus-context/r06__initiatives__dark__desktop-1440x1000__portfolio-table__row-kebab-open__003.png","standardChecks":["shell","spacing","typography","color","focus","overflow"],"issueIds":[]}
```

Pola obowiązkowe: `round`, `module`, `sha`, `url`, `theme`, `viewport`, `dpr`, `surface`,
`state`, `objectType`, `trigger`, `filename`, `standardChecks`, `issueIds`.

## 9. Ledger problemów

`issues.md` zawiera tabelę:

| ID | Severity | Standard | Screen | Opis | Aktywna trasa | Rekomendacja |
| --- | --- | --- | --- | --- | --- | --- |

Kategorie standardu: `SHELL`, `NAV`, `COLOR`, `TYPOGRAPHY`, `SPACING`, `DENSITY`, `TABLE`,
`PREVIEW`, `MENU`, `FORM`, `MODAL`, `EDITOR`, `RESPONSIVE`, `A11Y`, `EMPTY_ERROR`,
`INCONSISTENCY`.

Severity:

- `BLOCKER` — nie da się użyć lub zobaczyć funkcji;
- `MAJOR` — istotna niezgodność, overflow, brak akcji, zły kontrast lub inny komponent;
- `MINOR` — kosmetyka niespełniająca standardu;
- `OBSERVATION` — informacja bez decyzji naprawczej.

## 10. Checkpointy jednej rundy

### Checkpoint A — discovery

Bez robienia screenów operator raportuje:

- aktywną trasę i potwierdzony SHA;
- podmoduły/zakładki;
- tabele/listy i typy obiektów;
- preview/drawery;
- kebaby/context menus;
- wizardy/editory;
- szacowaną liczbę screenów;
- blokery danych lub uprawnień.

Status: `ROUND_XX_INVENTORY_AWAITING_APPROVAL`.

### Checkpoint B — capture dark

Operator wykonuje kompletny dark capture i aktualizuje manifest na bieżąco. Raportuje liczby
per kategoria oraz brakujące powierzchnie. Status: `ROUND_XX_DARK_CAPTURE_COMPLETE`.

### Checkpoint C — light i kontrola kompletności

Operator wykonuje light overview/dodatkowe kontrasty, porównuje inventory z manifestem,
sprawdza istnienie wszystkich plików i brak duplikatów. Status:
`ROUND_XX_CAPTURE_AWAITING_REVIEW`.

### Checkpoint D — controlled handoff

Raport końcowy zawiera:

- katalog rundy;
- branch/HEAD operatora;
- SHA aplikacji i środowisko;
- liczbę screenów dark/light oraz per kategoria;
- listę świadomie niewykonanych stanów;
- listę blockerów i issue IDs;
- potwierdzenie: demo only, no production-code edits, no merge/push/deploy;
- wynik walidatora manifestu i `git status --short`.

Status: `ROUND_XX_VISUAL_EVIDENCE_READY_FOR_CODEX_REVIEW`.

## 11. Reguły bezpieczeństwa i zakresu

- Bez zmian w kodzie produkcyjnym podczas capture.
- Bez merge, rebase, push do `demo` i deploy.
- Bez fotografowania martwych komponentów, chyba że są oznaczone jako dowód dead code.
- Bez tworzenia fałszywego sukcesu dla 501, brakujących danych lub nieaktywnej funkcji.
- Bez kasowania cudzych danych. Własne rekordy testowe mają prefiks
  `VISQA_20260803_RXX_` i są raportowane w handoffie.
- Bez przechodzenia do kolejnej rundy przed odbiorem bieżącej.
- Gdy liczba obrazów rośnie powyżej kontekstu, operator kończy bieżący checkpoint, zapisuje
  manifest i rozpoczyna kolejny turn w tej samej rundzie — nie kompresuje zakresu.

## 12. Kryterium ukończenia całego programu

Program jest kompletny, gdy wszystkie 16 rund ma zaakceptowany manifest, każdy wpis inventory
ma co najmniej jeden screen albo jawny kod blokady, a ledger problemów pozwala przejść od
modułu i powierzchni do dokładnego pliku dowodowego. Dopiero wtedy materiał może zasilić
finalny audyt i plan napraw UI/UX.
