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

### Stan na 2026-07-23, noc — wykonanie

Wszystkie pięć pozycji P0 tknięte. Dowody to pomiary w działającej aplikacji, nie deklaracje.

| ID | Stan | Dowód |
|---|---|---|
| `P0-1` | **zamknięte, migracja na staging** | Sprawdzone realną konwersją przez API: fragment (`nodeIds`) → wpis historii `scope='selection'`, etap Idei **nietknięty** (`seed`, `promoted_to` NULL); całość → drugi wpis `scope='workspace'` + etap `promoted`. Dwa wpisy współistnieją — przed naprawą drugi kasował ślad pierwszego. Rekordy próbne posprzątane. Ograniczenie: frontend nie wysyła jawnego `scope`, backend wnioskuje z `nodeIds` |
| `P0-2` | **zamknięte, flaga ON** | podgląd z konkretnymi liczbami → potwierdzenie → snapshot przed zmianą → cofnięcie. Zweryfikowane renderem: komunikat mówi wprost, ile elementów usunie i ile wstawi. Flaga włączona domyślnie 2026-07-24 — OFF znaczyło, że jedno kliknięcie nadal kasuje cały graf bez ostrzeżenia |
| `P0-3` | **zamknięte** | repro na Idei bez bazy: dokładnie 1 `POST /table-platform/bases`, 1 tabela, 19 węzłów bez duplikatu (było 2 bazy → treść podwojona) |
| `P0-4` | **zamknięte** | 5 ikon = 5 różnych treści (odciski treści unikalne: mapa 5/5, tablica 4/4, proces 5/5, tabela 3/3). Zakładki bez treści wyłączone z podanym powodem |
| `P0-5` | naprawione | wektorem nie był WebSocket, tylko współdzielony wiersz `my_idea_maps` (`preferred_tool` + `surfaceState.activeTool`) czytany przez każdego członka organizacji. Stan widoku przeniesiony do `localStorage` per użytkownik |

**Znalezione przy okazji, spoza pierwotnej listy:**

| Co | Stan |
|---|---|
| Burza żądań `presence` — sprzężenie zwrotne render → POST → render; interwał 5 s nigdy nie wystrzeliwał | **zamknięte**: 880 → 8 żądań na ~16 s |
| Zapis mapy zwracał 404 przy statusie członkostwa `'active'` zamiast `'ACTIVE'` | **zamknięte** (kod + dane) |
| `flushGraph({createSnapshot:true})` robi snapshot ze stanu **po** zmianie, nie przed | otwarte — obejście tylko na ścieżce importu |
| `CollaborationPresence` montuje się dwa razy (podwaja ruch) | otwarte, drobne |

### Pozycje źródłowe

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
- [x] Komplet wymaganych zrzutów (4 viewporty).
  > 1280×800, 1440×900, 1600×1000, 1920×1080 × 4 reprezentacje.
  > Geometria **czysta na wszystkich**: zero nakładania na Menu 1/Menu 3, zero
  > poziomego scrolla strony, zero uciętej treści w prawym panelu. Bramka
  > „1280×800 bez nakładania" spełniona pomiarem, nie oceną oka.
- [ ] Brak veta (nakładanie, ucięta etykieta, menu poza ekranem, konkurujące paski, aktywna zakładka bez stanu…).
- [ ] Każda kategoria ≥ 9/10, średnia ważona ≥ 9,5/10.
- [ ] Prawy panel przechodzi **osobną** bramkę.
- [ ] 1280×800 bez nakładania.

### Dostępność
- [x] 0 naruszeń `critical`, 0 `serious`. → **BRAMKA PRZECHODZI**
  > Pomiar axe-core 4.12, cztery obiekty testowe, 1440×900.
  >
  > | | na starcie nocy | po naprawach |
  > |---|---|---|
  > | `critical` (mapa/tablica/przepływ/tabela) | 1 / 4 / 3 / 5 + `label` **49** w Tabeli | **0 / 0 / 0 / 0** |
  > | `serious` | 4 / 6 / 4 / 4 | **0 / 0 / 0 / 0** |
  >
  > Zamknięte kolejno: `label` (49 → 0 — nazwy konkretne, „{kolumna} — {wiersz}", nie
  > generyczne), `aria-allowed-attr`, `aria-required-attr`, `aria-prohibited-attr`,
  > `button-name` (wszystkie wystąpienia okazały się **jednym** komponentem: przyciskiem
  > zamykania karty w pasku Moja Praca), `color-contrast` (3 miejsca w powłoce globalnej),
  > `nested-interactive` (ramka Tablicy).
  >
  > **Dwa rozstrzygnięcia warte zapamiętania, bo oba wyglądały na kompromis, a nie były:**
  > 1. Logo „77" nie musiało przestać być crimsonowe. Problemem był **stały** `text-primary-500`
  >    z tailwinda, który nie podnosi się w trybie ciemnym. Token `--c-accent` podnosi się sam,
  >    a zmiana wagi 600 → 700 przenosi napis do kategorii tekstu dużego (próg 3.0 zamiast 4.5).
  >    Kanon dopuszcza crimson właśnie dla marki — wyjątek zapisany w `triada-allowlist.txt`.
  > 2. `nested-interactive` nie wymagało wyboru „dostępność albo klawiatura". Ramka jest
  >    kontenerem, a nie elementem operowanym; po zdjęciu z niej fokusowalności pozostałe
  >    węzły zachowują `role="button"` i `tabindex=0`, przycisk „Zwiń sekcję" nadal jest
  >    osiągalny z klawiatury, a zaznaczanie i przeciąganie ramki zachowuje się **identycznie**
  >    jak przed zmianą (zmierzone różnicowo, przed i po).
  >
  > Surowe wyniki: `artifacts/idea-workspace-qa/<RUN>/qa-geometria-a11y.json` (przed)
  > oraz `a11y-po-naprawach.json` (po).
- [ ] Główne przepływy obsługiwane klawiaturą.
- [ ] Widoczny fokus, nazwy dostępności, tooltipy.

### Regresja
- [x] Cztery reprezentacje przechodzą po zmianach wspólnej powłoki.
- [x] **Dwie kolejne czyste rundy** bez nowego P0/P1.
  > Obie rundy identyczne: zakładki panelu unikalne w każdej reprezentacji, rynna pod
  > lewym railem obecna, żądania `presence` w normie, zero poziomego przewijania,
  > zero błędów konsoli — **z jednym wyjątkiem, który nie jest defektem produktu**:
  > w Tablicy leci `400` z `/api/link-preview`. To węzeł-link w moich danych testowych
  > wskazujący na `example.com`, którego guard SSRF nie może zweryfikować, bo środowisko
  > dev nie ma sieci. Sprawdzone u źródła, nie założone.

### Dowodowa
- [ ] Każde wymaganie ma status `verified` i przypisany dowód.
- [ ] Każde znalezisko recenzenta rozwiązane albo odrzucone z dowodem.
- [ ] Raport końcowy wskazuje artefakty.

---

## Zasada końcowa

> Praca nie kończy się, gdy ekran wygląda dobrze. Kończy się, gdy zachowanie, dane, struktura, dostępność i wygląd spełniają standard, każdy warunek ma dowód, a niezależni recenzenci nie znajdują błędu blokującego.

Poważny błąd **nie jest kompensowany** wysoką oceną innej części. Jeśli prawy panel nie przełącza treści, system nie jest gotowy niezależnie od jakości typografii.

Przy blokadzie **nie deklarujemy sukcesu** — zapisujemy przyczynę, wykonane próby, dowody i decyzję człowieka potrzebną do odblokowania.
