# 13 — Migracja nawigacji Idea Workspace

Status: **implemented candidate — acceptance evidence pending**  
Decyzja właściciela: 2026-08-08  
Zakres: Mind Map · Process Flow · Whiteboard · Table

Ten rozdział zastępuje kierunek geometryczny z rozdziałów 03, 06 i 07 tam,
gdzie nakazywały lewy rail narzędzi i prawy panel informacji. Zachowuje ich
kontrakty funkcjonalne, ale porządkuje je według nowszego wzorca Artifact
Studio/Materials.

## 1. Docelowa anatomia

1. Menu 1: globalna nawigacja aplikacji.
2. Menu 2: tożsamość Idei, reprezentacja, zapis, status i Konwertuj.
3. Menu 3: dokładnie jeden kontekstowy rząd poleceń.
4. Lewa strona: dokładnie jeden przełączalny panel informacji.
5. Centrum: canvas albo tabela.
6. Prawa krawędź canvasa: wąski rail narzędzi tworzenia i manipulacji.
7. Najbardziej po prawej: wyłącznie globalna Teresa.
8. Dolny pasek: zoom, fit, minimapa i przełącznik reprezentacji.

Panel informacji zawiera: Przegląd, Właściwości, Powiązania i źródła,
Komentarze, Historia oraz Walidacja/QA tylko tam, gdzie istnieje realny model
walidacji. `Context` i `AI Suggestions` nie są niezależnymi drawerami.

## 2. Reguły niepodlegające negocjacji

- Nie wolno implementować zmiany przez sam `flex-direction`, `order` ani lustrzany CSS.
- Jeden stan kontrolowany wybiera sekcję panelu i zakres `idea | selection`.
- Zmiana panelu nie resetuje zaznaczenia, zoomu ani pozycji canvasa.
- Menu 2 nie zmienia wysokości po zaznaczeniu elementu.
- Pasek edycji zaznaczenia ma jednego hosta w Menu 3.
- Jedna funkcja ma jeden `commandId` i handler. Menu 3, rail, PPM, kebab,
  skrót i Teresa są wyłącznie powierzchniami wywołania.
- Nie renderujemy komendy bez handlera; `disabled` zawsze podaje powód.
- Table jest wariantem danych, nie mechaniczną kopią raila canvasowego.

## 3. Responsywność

| Szerokość | Zachowanie |
|---|---|
| `>=1600` | lewy panel i Teresa mogą być zadokowane, jeśli canvas zachowuje minimum |
| `1280–1599` | Teresa ma pierwszeństwo; jej otwarcie zwija lewy panel |
| `<1280` | tylko jedna powierzchnia boczna, jako overlay |

Prawy rail narzędzi nie jest panelem i nie bierze udziału w arbitrażu. Canvas
rezerwuje pod niego gutter po prawej; `fitView`, minimapa i współrzędne kliknięć
muszą uwzględniać tę stronę.

## 4. Program migracji

| Pakiet | Zakres | Bramka |
|---|---|---|
| N0 | kanon i macierz komend | każda widoczna akcja ma właściciela i handler |
| N1 | kontrakt shellu: panel lewy, tool rail prawy | test stron, resize, collapse i overlay |
| N2 | adapter i orkiestracja Ideas | jeden lokalny panel w DOM, brak legacy drawers |
| N3 | Menu 2/3 i ObjectEditBar | jeden host, brak zmiany wysokości Menu 2 i overlapu |
| N4 | wspólny primitive menu kontekstowego | role, focus, klawiatura, viewport clamp |
| N5 | Mind Map | tło, node, edge i multi-select przez registry |
| N6 | Process Flow | pełne edge/lane menu, realny clipboard, brak `mm_*` |
| N7 | Whiteboard | node/edge/frame, realny clipboard obiektów |
| N8 | Table P15 | menu wiersza, komórki i nagłówka |
| N9 | usunięcie legacy i flag | jedna architektura runtime |
| N10 | odbiór | dwie czyste rundy bez P0/P1 |

## 5. Dostępność i interakcja

- semantyczny cel każdej kontrolki co najmniej 44×44 CSS px;
- icon-only: dostępna nazwa i widoczny tooltip, nie samo `title`;
- menu: `role=menu/menuitem`, focus przy otwarciu, strzałki, Home/End,
  Enter/Space, Escape i zwrot focusu;
- `Shift+F10` otwiera to samo menu co PPM i `⋮`;
- Escape zamyka tylko najwyższą aktywną warstwę;
- menu jest clampowane do viewportu i zamyka się przy pan/scroll;
- jeden wspólny rejestr tokenów warstw zamiast lokalnych `z-20/z-50`.

## 6. Dowody wymagane do zamknięcia

- testy kontraktu DOM i handlerów;
- Playwright: klawiatura, focus return, 44 px i automatyczny overlap check;
- axe: zero `critical` i `serious`;
- screenshoty czterech narzędzi, light/dark, PL/EN, 1280×800,
  1440×900 i 1920×1080, także przy 200% zoom;
- PPM na każdej krawędzi viewportu;
- runtime: akcja → feedback → zapis → refresh → zachowany rezultat;
- dwie kolejne czyste rundy regresji bez nowego P0/P1.

Brak przypisanego dowodu oznacza `NOT_VERIFIED`, nawet jeśli test jednostkowy
przechodzi. Wdrożenie na demo pozostaje poza zakresem do czasu akceptacji
właściciela na czystych zrzutach.
