# 12 — Backlog naprawczy i kryteria odbioru

Ten rozdział ustala kolejność doprowadzenia kodu do standardu i twarde bramki, po których uznajemy pracę za skończoną. Kolejność wynika z ryzyka, nie z łatwości: najpierw to, co niszczy dane, potem to, co widać.

## Priorytety

| Poziom | Znaczenie |
|---|---|
| **P0 — blokada** | utrata lub zepsucie danych, błędna konwersja, martwa główna akcja, brak zapisu, prawy panel nieprzełączający treści, współdzielony stan widoku między użytkownikami |
| **P1 — poważny** | zły zakres akcji, duplikacja kluczowych akcji, brak wymaganego stanu, nakładanie elementów, ucięta treść, brak obsługi klawiatury, AI bez podglądu |
| **P2 — jakość** | odstępy, hierarchia, niespójna ikona, zły pusty stan. Naprawiane, jeśli obniża kategorię poniżej 9/10 |
| **P3 — usprawnienie** | pomysł spoza standardu — trafia do backlogu, nie rozszerza bieżącego zakresu |

---

## P0 — integralność danych (najpilniejsze)

| ID | Problem | Dowód z audytu | Naprawa |
|---|---|---|---|
| `P0-1` | `promote()` nadpisuje `promoted_to`/`stage` **całej Idei** nawet przy konwersji fragmentu — gubi ślad poprzednich konwersji | `my-work.routes.ts:7070-7077` | model **wielu konwersji** (historia wyników) zamiast pojedynczego pola; konwersja zaznaczenia nie zmienia statusu całej Idei |
| `P0-2` | Import draw.io/BPMN **zastępuje cały graf bez potwierdzenia i bez możliwości cofnięcia** | audyt 05 | podgląd → potwierdzenie → snapshot **przed** zmianą → podsumowanie → cofnięcie |
| `P0-3` | **Przełączenie reprezentacji duplikuje treść** (9 kroków procesu → 18 wierszy tabeli) | repro w sesji; częściowo naprawione (wyścig tworzenia baz), migracja nadal dubluje | zdeduplikować migrację legacy→platforma; jedno wywołanie na Ideę |
| `P0-4` | Prawy panel: pięć ikon renderuje **tę samą treść** | `IdeaMapWorkspace.tsx` — `renderMelsCanvasRightRailPanel(_activeToolId)` ignoruje identyfikator | przekazać `activeRightToolId`/`onSelectRightTool`, przełączać treść po identyfikatorze |
| `P0-5` | Aktywna reprezentacja bywa **synchronizowana między użytkownikami** (realtime przełącza ekran innym) | audyt 03 | stan widoku = preferencja lokalna, nigdy globalny stan Idei |

## P1 — martwe kliknięcia i zakres (root-cause)

| ID | Problem | Naprawa |
|---|---|---|
| `P1-1` | Powłoka (Menu 3, popovery railа, prawy panel) używa akcji Mind Mapy (`mm_*`, `add_node`) we **wszystkich** reprezentacjach → martwe kliki w Whiteboard/Process/**Table** | wdrożyć **rejestr akcji** (rozdz. 02); rozgałęzienie per reprezentacja wynika z pola `tools` |
| `P1-2` | „Utwórz z mapy" — martwy klik pod domyślną flagą | usunąć etykietę (zakaz D6), zastąpić konkretnymi akcjami |
| `P1-3` | Martwe zdarzenia: `idea-workspace-add-edge`, `-link-artifact` (przyciski „Dodaj powiązanie" w tabeli) | dopiąć odbiorców albo usunąć przyciski (Z3) |
| `P1-4` | Process: „Wklej" duplikuje zamiast wklejać; „Wstaw między" wymaga krawędzi a wisi przy węźle; Delete na krawędzi nic nie robi | naprawić zgodnie z rozdz. 08 |
| `P1-5` | „AI Generators" Whiteboardu **nie wołają modelu** — wstawiają puste elementy | podpiąć realne generatory albo zdjąć etykietę „AI" (Z1 §3 zakaz 7) |
| `P1-6` | Table: autofill i odświeżanie **nadpisują dane bez podglądu** | model propozycji (rozdz. 09) |
| `P1-7` | Eksport zawiera „Raport" i „Prezentacja", które tworzą trwałe rekordy | przenieść do Konwersji (D6) |
| `P1-8` | Rail zasłania własne paski reprezentacji (Tabela: „Framework"→„mework") | rail nie może nachodzić na paski reprezentacji |

## P2 — powłoka i panel (wygląd + spójność)

| ID | Zakres |
|---|---|
| `P2-1` | Menu 1 wg rozdz. 04 (w tym stany zapisu i standard konfliktu) |
| `P2-2` | Menu 3 wg rozdz. 05 — układ per reprezentacja |
| `P2-3` | Przełącznik reprezentacji do prawego dolnego rogu (D2); minimapa jako ikona |
| `P2-4` | Prawy panel: pięć realnych zakładek wg rozdz. 07 + język wizualny z prototypu |
| `P2-5` | Lewy rail wg rozdz. 06; Table dostaje data-rail, nie canvasowy |
| `P2-6` | Menu kontekstowe wg rozdz. 08 — w tym **menu krawędzi wszędzie** i **menu komórki w Tabeli** |

## P3 — dług i sprzątanie

| ID | Zakres |
|---|---|
| `P3-1` | Martwy kod bez UI: `tbl_autofill/refresh/link`, `wb_group/distribute`, `IdeaCanvasDiscovery`, `handleGenerateCanvasAI`, typy `kpi_badge/score/progress/summary` — podłączyć albo usunąć |
| `P3-2` | Martwe endpointy: rodzina cluster/outcome, `v8/mindmap/*`, `develop` (SSE), `export-csv`, facylitacja `end`/`outcomes` |
| `P3-3` | `useIdeasToolContextMenu.ts` — martwy wspólny mechanizm menu; zastąpiony rejestrem |
| `P3-4` | Migracja Table legacy → P15 (D5) wraz z migracją danych |
| `P3-5` | Migracja 7 kart N na wspólny kanon panelu (D1) — **jedną partią, po zamknięciu Idei** |
| `P3-6` | Persystencja Whiteboardu na wspólny silnik; ujednolicenie trzech kanałów realtime |
| `P3-7` | Braki tłumaczeń: `collaboration.*`, „Lane N", diakrytyki w `whiteboardInteractionGrammar.ts` |
| `P3-8` | Polityka flag: jedna flaga = jeden efekt; usunięcie martwych ścieżek |

---

## Bramki odbioru

Praca jest skończona, gdy **wszystkie** bramki są spełnione i **każda ma dowód**. Deklaracja bez dowodu nie liczy się.

### Funkcjonalna
- [ ] Wszystkie scenariusze P0 i P1 przechodzą.
- [ ] Zero martwych kliknięć i cichych braków reakcji.
- [ ] Każda akcja ma właściwy handler i zakres.
- [ ] Cofnij/Ponów działa per reprezentacja.
- [ ] Zapis i odświeżenie zachowują dane.

### Wizualna
- [ ] Komplet wymaganych zrzutów (4 viewporty).
- [ ] Brak veta (nakładanie, ucięta etykieta, menu poza ekranem, konkurujące paski, aktywna zakładka bez stanu…).
- [ ] Każda kategoria ≥ 9/10, średnia ważona ≥ 9,5/10.
- [ ] Prawy panel przechodzi **osobną** bramkę.
- [ ] 1280×800 bez nakładania.

### Dostępność
- [ ] 0 naruszeń `critical`, 0 `serious`.
- [ ] Główne przepływy obsługiwane klawiaturą.
- [ ] Widoczny fokus, nazwy dostępności, tooltipy.

### Regresja
- [ ] Cztery reprezentacje przechodzą po zmianach wspólnej powłoki.
- [ ] **Dwie kolejne czyste rundy** bez nowego P0/P1.

### Dowodowa
- [ ] Każde wymaganie ma status `verified` i przypisany dowód.
- [ ] Każde znalezisko recenzenta rozwiązane albo odrzucone z dowodem.
- [ ] Raport końcowy wskazuje artefakty.

---

## Zasada końcowa

> Praca nie kończy się, gdy ekran wygląda dobrze. Kończy się, gdy zachowanie, dane, struktura, dostępność i wygląd spełniają standard, każdy warunek ma dowód, a niezależni recenzenci nie znajdują błędu blokującego.

Poważny błąd **nie jest kompensowany** wysoką oceną innej części. Jeśli prawy panel nie przełącza treści, system nie jest gotowy niezależnie od jakości typografii.

Przy blokadzie **nie deklarujemy sukcesu** — zapisujemy przyczynę, wykonane próby, dowody i decyzję człowieka potrzebną do odblokowania.
