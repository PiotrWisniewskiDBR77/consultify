# Idea Workspace navigation — raport wykonania 2026-08-09

Status: **IMPLEMENTED / automated acceptance gates passed; human SR + realDB pending**  
Środowisko QA: izolowany frontend `localhost:4173`, istniejący backend lokalny  
Bez commit, push i deploy.

## Wykonane

- panel informacji przeniesiony semantycznie na lewo;
- canvas tool rail przeniesiony na prawą krawędź;
- gutter liczony dla prawej strony, łącznie z portaled toolbar;
- popovery raila otwierają się do środka canvasa;
- MELS nie montuje legacy drawerów Context i AI Suggestions;
- usunięto trzy abstrakcyjne wejścia Tools/Context/AI z górnego menu MELS;
- ObjectEditBar ma osobny warunkowy rząd i nie konkuruje z tożsamością;
- przełącznik czterech reprezentacji jest obowiązkowy w MELS;
- wspólny `CanvasContextMenu` zapewnia portal fullscreen, clamp do canvasa,
  semantykę menu, fokus, ArrowUp/Down, Home/End, Escape i cele 44 px;
- zmigrowano wszystkie warianty menu kontekstowego czterech narzędzi:
  Process Flow node/edge/pane, Mind Map node/edge/pane, Whiteboard node/edge/pane
  oraz Table view/column/row/cell;
- złożone podmenu Mind Map zastąpiono jedną przewijalną powierzchnią z grupami;
  wszystkie akcje pozostały dostępne, a obsługa fokusu jest identyczna jak w
  pozostałych narzędziach;
- `Shift+F10` i klawisz Menu są mapowane w shellu na menu kontekstowe aktualnie
  aktywnego elementu canvasa;
- usunięto nieużywany, mindmapowy `ContextMenuPortal` i stare lokalne tokeny
  powierzchni menu; portal, warstwy i pozycjonowanie mają jednego właściciela;
- usunięto runtime flagę `ff_melsCanvas`; parametr URL nie może już przywrócić
  starej geometrii ani nakładających się drawerów;
- cele raila informacji, raila narzędzi i przełącznika reprezentacji mają 44 px.

## Dowód runtime

Mind Map, 1280×720:

- lewy inspector: `x=64`, `right=120`, zwinięty `width=56`;
- otwarty panel: `x≈120`, `right=479`, `width≈359`;
- canvas: `x=120`, `right=1248`, `width=1128` przy panelu zamkniętym;
- prawy tool rail: `x=1190`, `right=1236`, `width=46` przed powiększeniem hit-area;
- DOM: `leftInspector=data-side:left`, `floatingRight=true`,
  `floatingLeft=false`, legacy Context/AI=false;
- menu tła: `role=menu`, 13 `menuitem`, pierwszy aktywny command
  `pane_add_node` otrzymuje fokus;
- wysokie menu jest ograniczone do canvasa: canvas `top=166/bottom=720`,
  menu `top=178/bottom=708`, własny scroll, brak wejścia na Menu 2/3.

Przełączenie reprezentacji na świeżym runtime, 1280×720:

- Whiteboard: aktywny przycisk i kanoniczny URL `/workspace/whiteboard`;
- Process Flow: aktywny przycisk i kanoniczny URL `/workspace/process-flow`;
- Table: aktywny przycisk i kanoniczny URL `/workspace/table`;
- Mind Map: aktywny przycisk i kanoniczny URL `/workspace/mindmap`;
- we wszystkich czterech stanach obecne były: lewy inspector oraz prawy rail;
- geometria po powrocie do Mind Map: canvas `x=120..1248`, inspector
  `x=64..120`, realna portalowana powierzchnia prawego raila
  `x=1182..1236`, szerokość `54 px`;
- `Shift+F10` na aktywnym węźle Mind Map otworzył jedno menu z 45 komendami;
  pierwsza komenda otrzymała fokus, a menu pozostało ograniczone do canvasa.
- bezpośrednie wejście z historycznym `?ff_melsCanvas=0` nadal renderuje
  kanoniczny inspector, przełącznik 4 narzędzi i prawy rail; furtka legacy nie
  zmienia już anatomii runtime.

## Testy wykonane

- 74/74: shell, rail, nawigacja Ideas, MyWorkHub, Table honesty, shared
  context menu, preferencja narzędzia i gating NodeContextMenu;
- 9/9: asynchroniczne akcje i konwersje Whiteboard context menu;
- 3/3: gating komend NodeContextMenu Mind Map;
- `npm run type-check`: PASS z repozytoryjnym limitem pamięci 8 GB;
- `npm run check:ssot`: PASS;
- `git diff --check -- <zakres Ideas>`: PASS; globalny check repo zatrzymuje
  wcześniejszy, niezwiązany trailing whitespace w dokumencie programu weekendowego.

### Playwright — dwie czyste rundy na finalnym kodzie

- runda 1: 3/3, `unexpected=0`, `flaky=0`;
- runda 2: 3/3, `unexpected=0`, `flaky=0`;
- 96 zrzutów: 4 narzędzia × 3 viewporty (1280×800, 1440×900,
  1920×1080) × PL/EN × light/dark × 100/200%;
- każda komórka macierzy zaczyna się od izolowanego transient workspace,
  następnie przełącza realnym kliknięciem Mind Map → Whiteboard → Process Flow
  → Table; brak przecieków lokalnej preferencji między przypadkami;
- kontrola geometryczna: inspector kończy się przed canvasem, prawy rail mieści
  się w canvasie, nie wychodzi poza jego wysokość i zachowuje co najmniej 44 px;
- 200% jest odtwarzane przez równoważny CSS viewport, w tym mobilny reflow;
- kontrakt klawiatury: `Shift+F10`, `role=menu/menuitem`, roving focus,
  ArrowDown, End, Escape i powrót fokusu;
- axe: 8 skanów (4 narzędzia × light/dark), **0 critical/serious** po
  naprawieniu kontrastu, nazwy przycisku i zagnieżdżonych kontrolek React Flow;
- artefakty: `playwright-results-round-1.json`,
  `playwright-results-round-2.json`, `axe-results.json` oraz katalog `screens/`.

Transient workspace celowo nie istnieje w bazie: zrzuty obejmują również realny
stan błędu/reconnect i toasty, dzięki czemu geometria została sprawdzona przy
aktywnych warstwach komunikatów, ale nie stanowi to dowodu trwałości realDB.

Ratchet dostępności dla całego brudnego worktree nie jest zielony. Po usunięciu
nowego naruszenia `autoFocus` w `MyWorkHub`, zakres Ideas nie dodaje nowego
długu, ale globalne skrypty nadal wskazują osiem innych plików spoza tego
programu oraz trzy nowe naruszenia fokusu w `EditableSpreadsheetGrid`. Nie są
one zaliczane ani ukrywane przez zmianę baseline.

Pierwszy ręczny `tsc` bez repozytoryjnego profilu zakończył się OOM przy 4 GB.
Powtórzenie przez `npm run type-check` przeszło; OOM nie jest zaliczony jako
dowód ani jako błąd produktu.

## Nadal niezamknięte

- ta sama macierz na realnej zapisanej idei i dowód save → refresh → zachowanie
  efektu wymagają kontrolowanego środowiska realDB;
- brak fizycznego nagrania VoiceOver/NVDA głównych ścieżek;
- część nieosiągalnego JSX starej powłoki pozostaje jeszcze w
  `IdeaMapWorkspace`; nie ma już wejścia runtime, ale fizyczne usunięcie wymaga
  osobnego mechanicznego wydzielenia hoistowanych rendererów.

## Werdykt

Nowa geometria, nawigacja i wspólna infrastruktura menu są **wdrożone i
automatycznie zweryfikowane dla wszystkich czterech narzędzi**. Kod jest
kandydatem do przeglądu właściciela, ale formalne GO produkcyjne pozostaje
wstrzymane do nagrania czytnika ekranu, dowodu realDB i akceptacji właściciela.
