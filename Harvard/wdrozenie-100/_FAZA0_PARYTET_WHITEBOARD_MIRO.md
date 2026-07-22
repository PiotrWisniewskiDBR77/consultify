# FAZA 0 — Parytet lidera: WHITEBOARD (Miro / FigJam)
**Data:** 2026-07-22 · **Kontekst:** `_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` (K1–K9, macierz PRZED)
**Kod referencyjny (NIE zmieniany):** `src/components/MyWork/IdeaWhiteboardTool.tsx` (3466 linii) ·
`.../whiteboard/WhiteboardToolbar.tsx` · `.../whiteboard/nodes/*` · `.../IdeaCanvasContextMenu.tsx` ·
`.../canvas/useIdeasToolDefaults.ts`

To jest SPEC do budowania, nie ocena. Każda pozycja = odhaczalna, mierzalna. Status `[MUST]`/`[NICE]`
priorytetyzuje FAZĘ 3. Kolumna "U NAS DZIŚ" ustalona przez czytanie realnego kodu (nie dokumentacji).

---

## 1. Kim jest lider i dlaczego

**Miro** i **FigJam** to rynkowy standard whiteboardu do warsztatów/facylitacji — miliony zespołów,
codzienne narzędzie do brainstormu, retro, workshopów. Definiują oczekiwanie klienta: płótno ma być
**nieskończone, płynne, bez tarcia** — zoom/pan/drag działają jak w grze, nie jak w formularzu.
Ich przewaga nie jest w liczbie funkcji, lecz w **jakości ruchu**: każda interakcja (chwyć, upuść,
wyrównaj, powiększ) daje natychmiastowy, przewidywalny feedback wizualny (snapping, prowadnice,
płynna animacja). To jest poprzeczka K8+K9 dla naszego Whiteboardu.

---

## 2. K9 DYNAMIKA — prymitywy interakcji (mierzalne wymagania)

| # | Prymityw | Wymaganie mierzalne (parytet Miro/FigJam) | U nas dziś | MUST/NICE |
|---|----|----|----|:--:|
| 2.1 | **Zoom do kursora** | Scroll/pinch zoomuje z punktem pod kursorem jako centrum (nie środkiem ekranu); zakres min 10%–300%; brak skoków/migotania | ReactFlow `zoomOnScroll`/`zoomOnPinch` = true, `minZoom 0.1`/`maxZoom 3` — mechanika jest; zoom-do-kursora to natywne zachowanie ReactFlow (do zweryfikować harnessem, nie założyć) | [MUST] |
| 2.2 | **Zoom płynny** | Brak "przeskoku" — interpolacja/animacja przy fitView (≥200ms ease), scroll-zoom bez zacinania przy >100 elementach | `fitView({ duration: 300 })` na skrótach — jest; scroll-zoom bez animacji (natywne, OK); **niezmierzone przy dużym grafie** | [MUST] |
| 2.3 | **Fit-to-view** | Jeden klawisz/klik centruje i skaluje cały content z marginesem | Cmd/Ctrl+0 i Shift+1 → `fitView({ padding: 0.2 })` — JEST | [MUST] ✅ zaimplementowane |
| 2.4 | **Pan: spacja+drag** | Przytrzymanie spacji zamienia kursor na "łapkę", drag przesuwa widok, puszczenie wraca do trybu select | `panActivationKeyCode: 'Space'` (ReactFlow built-in) — JEST | [MUST] ✅ zaimplementowane |
| 2.5 | **Pan: scroll/trackpad** | Scroll pionowy/poziomy przesuwa widok gdy nie zoomuje (tryb bez modyfikatora) | `panOnScroll: false` — U NAS WYŁĄCZONE (scroll = zawsze zoom, zamiast trackpad-pan); pan jest tylko środkowym/prawym przyciskiem myszy (`panOnDrag: [1,2]`) — dla trackpada to tarcie | U NAS BRAK trackpad-pan | [MUST] |
| 2.6 | **Chwytanie/drag elementu** | Klik+drag na elemencie przesuwa go płynnie, bez opóźnienia, z widocznym "uniesieniem" (cień/z-index) | `nodesDraggable: !locked` — bazowy drag JEST (ReactFlow); wizualny lift przy drag NIEZWERYFIKOWANY | [MUST] |
| 2.7 | **Snapping do siatki** | Element podczas drag "wskakuje" na siatkę (np. co 8/10px) — brak w kodzie `snapGrid`/`snapToGrid` | **BRAK** — `grep snapGrid/snapToGrid` = 0 wyników w całym IdeaWhiteboardTool.tsx | [MUST] |
| 2.8 | **Snapping do innych obiektów + prowadnice wyrównania** | Podczas drag pojawiają się linie wyrównania (środek/krawędź) względem sąsiednich elementów, element "łapie się" na wyrównanie | **BRAK CAŁKOWITY** — brak jakiegokolwiek komponentu guide/alignment w repo | [MUST] |
| 2.9 | **Multi-select marquee** | Klik+drag na pustym płótnie rysuje prostokąt zaznaczenia, zaznacza wszystko w środku (częściowo lub w całości, do ustalenia) | `selectionOnDrag: true`, `selectionMode: 'partial'` — JEST | [MUST] ✅ zaimplementowane |
| 2.10 | **Drag wielu elementów naraz** | Po multi-select, drag dowolnego zaznaczonego elementu przesuwa CAŁĄ grupę razem | Natywne w ReactFlow przy multi-select — do potwierdzenia harnessem (brak custom logiki blokującej) | [MUST] |
| 2.11 | **Dodawanie: paleta kształtów** | Panel/rail z kształtami (prostokąt/koło/romb/sześciokąt) do wyboru jednym klikiem | WhiteboardToolbar ma Circle/Diamond/Hexagon/Square ikony → `onAddElement('shape_*')` — JEST | [MUST] ✅ zaimplementowane |
| 2.12 | **Dodawanie: przeciągnij-z-railu (drag from rail to canvas)** | Element z paska narzędzi/railu da się przeciągnąć i upuścić w konkretne miejsce płótna (nie tylko klik = wstaw-na-środku) | **BRAK** — toolbar buttony wołają `onAddElement` (wstawia w centrum widoku), brak drag-and-drop z toolbara na canvas | U NAS BRAK | [NICE] |
| 2.13 | **Dodawanie: dwuklik-płótno tworzy sticky** | Dwuklik na pustym płótnie od razu tworzy karteczkę w tym miejscu, gotową do wpisania | Trzeba zweryfikować w kodzie handlera `onPaneClick`/`onDoubleClick` na ReactFlow root (widoczny handler tylko na node, nie na pane) | DO WERYFIKACJI (prawdopodobnie BRAK) | [MUST] |
| 2.14 | **Dodawanie: wklej obraz (paste image)** | Ctrl/Cmd+V ze schowka (screenshot/obraz) tworzy ImageNode na płótnie | `ImageNode.tsx` istnieje jako typ węzła, ale brak potwierdzonego handlera `paste` obsługującego obraz ze schowka w IdeaWhiteboardTool.tsx | DO WERYFIKACJI (prawdopodobnie BRAK obsługi paste) | [MUST] |
| 2.15 | **Wpisywanie: dwuklik edytuje** | Dwuklik na sticky/kształt/tekst przełącza w tryb edycji tekstu inline | `StickyNoteNode.tsx` linia 56: `onDoubleClick` → tryb edycji — JEST | [MUST] ✅ zaimplementowane |
| 2.16 | **Rich-text w elemencie** | Bold/italic/listy/linki wewnątrz treści sticky/tekstu | StickyNoteNode edycja to zwykły `<textarea>` (plain text) — **BRAK formatowania** | U NAS BRAK | [NICE] |
| 2.17 | **Auto-resize elementu do treści** | Sticky/text rośnie wysokością gdy tekst nie mieści się, bez ręcznego przeciągania uchwytu | Do potwierdzenia w CSS/`resize-none` na textarea — obecnie textarea ma stały box, brak potwierdzonego auto-grow | DO WERYFIKACJI | [MUST] |
| 2.18 | **Czcionka: rozmiar** | Zaznaczony element/tekst ma kontrolkę rozmiaru czcionki (S/M/L lub numeryczna) | **BRAK** — brak jakiejkolwiek kontrolki font-size w toolbarze/menu/nodach | U NAS BRAK | [MUST] |
| 2.19 | **Czcionka: waga (bold)** | Przełącznik pogrubienia per element/zaznaczenie tekstu | **BRAK** | U NAS BRAK | [NICE] |
| 2.20 | **Czcionka: wyrównanie** | Left/center/right align tekstu w elemencie | **BRAK** | U NAS BRAK | [NICE] |
| 2.21 | **Kolor: paleta sticky** | Kliknięcie zmienia kolor karteczki z zestawu (6-8 kolorów), widoczne od razu | `STICKY_COLORS` istnieje jako paleta, ale kolor jest **losowany przy tworzeniu** (`Math.floor(Math.random() * STICKY_COLORS.length)`) — **brak UI do ręcznej zmiany koloru** po fakcie | U NAS BRAK (tylko losowy start) | [MUST] |
| 2.22 | **Kolor/styl: obramowanie kształtu** | Zmiana koloru wypełnienia/obrysu kształtu (ShapeNode) po zaznaczeniu | `ShapeNode.tsx` ma `bgColor` w danych (ustawiane raz przy tworzeniu frame), brak UI do zmiany po fakcie | U NAS BRAK | [MUST] |
| 2.23 | **Łączniki: magnetyczne (snap do krawędzi)** | Rysowanie linii między elementami "łapie się" na porty/krawędzie węzła | ReactFlow handles + `ConnectionMode.Loose` — bazowa mechanika połączeń jest (natywna), ale brak dedykowanych "portów" wizualnych na sticky/shape (typowe dla free-form whiteboardu, gdzie łączniki łapią się gdziekolwiek na obrys) | CZĘŚCIOWE | [NICE] |
| 2.24 | **Łączniki: etykiety** | Można dopisać tekst na linii-łączniku | `LabeledEdge.tsx` istnieje jako typ krawędzi — JEST komponent, do potwierdzenia czy dostępny z UI dla whiteboardu | PRAWDOPODOBNIE JEST (komponent istnieje) | [NICE] |
| 2.25 | **Ramki/sekcje (frames)** | Kontener grupujący elementy wizualnie, z tytułem, drag-reparent dzieci gdy ramka się przesuwa | `FrameNode.tsx` + logika `frameCollapseKey`/reparent (linie 870-907 w IdeaWhiteboardTool.tsx) — JEST | [MUST] ✅ zaimplementowane |
| 2.26 | **Warstwy: przód/tył (z-order)** | Right-click → "Przenieś na wierzch"/"Przenieś na spód" dla nachodzących elementów | **BRAK w menu kontekstowym** (`IdeaCanvasContextMenu.tsx` nie ma żadnej opcji warstw) | U NAS BRAK | [MUST] |
| 2.27 | **Lock elementu** | Można zablokować pojedynczy element przed przypadkowym przesunięciem (niezależnie od blokady całej tablicy) | Istnieje `data.locked` per-node (`isNodeDataLocked`) i globalny `locked` prop tablicy, ale **brak UI (menu/przycisk) do zablokowania POJEDYNCZEGO elementu** przez usera — mechanizm danych jest, akcja niedostępna | CZĘŚCIOWE (dane tak, UI nie) | [MUST] |
| 2.28 | **Komentarze na obiekcie** | Klik na element → dodaj komentarz przypięty do TEGO elementu, widoczny jako badge z licznikiem | `CommentPinBadge.tsx` — JEST, wpięty w StickyNote/Shape/Text/Link/Frame nody, otwiera `IdeaNodeDetailDrawer` | [MUST] ✅ zaimplementowane |
| 2.29 | **Kursory obecności real-time** | Widać kursor/awatar innych uczestników poruszający się po płótnie na żywo | `presenceUsers` state istnieje (lista userów), ale **brak renderowania live-kursorów na canvasie** — tylko lista obecności, nie kursory-widma | U NAS BRAK (tylko lista, nie kursory) | [NICE] |

**Podsumowanie 2:** z 29 prymitywów — **10 już zaimplementowanych** (fitView, spacja-pan, marquee-select,
paleta kształtów, dwuklik-edit, frames, komentarze-na-obiekcie i in.), **~6 do weryfikacji harnessem**
(zoom-do-kursora, drag-grupowy, dwuklik-tworzy-sticky, paste-image, auto-resize), **~13 całkowicie brak**
— z czego najdotkliwsze [MUST]: **snapping (siatka+obiekty+prowadnice), zmiana koloru/czcionki po fakcie,
z-order, lock pojedynczego elementu, trackpad-pan**.

---

## 3. K8 ELEGANCJA — cechy wizualne lidera do dorównania

| # | Cecha | Miro/FigJam robi tak | Wymaganie dla nas |
|---|----|----|----|
| 3.1 | **Typografia** | Jeden krój, 2-3 wagi max, hierarchia rozmiarem nie kolorem | Sticky/shape teksty na tokenach `c-text`; zero mieszanych fontów; wielkość czytelna z oddali (workshop-mode) |
| 3.2 | **Cienie (depth)** | Subtelny, spójny cień pod każdym elementem; drag = cień rośnie (uniesienie) | Jeden system cieni (`shadow-lg` sticky już ma bazę), drag-lift jako mikro-interakcja (2.6) |
| 3.3 | **Siatka/tło** | Kropkowana siatka subtelna, nie rozprasza; opcja czystego tła | `getCanvasBg('whiteboard', ...)` + `bgPattern` w toolbarze — mechanika JEST, sprawdzić dark+light osobno |
| 3.4 | **Palety kolorów** | Skończony, przemyślany zestaw (6-8 kolorów sticky, harmonijnych, nie krzykliwych) | `STICKY_COLORS` istnieje — audytować czy paleta harmonijna i **zero crimson-leak** (czerwień tylko semantyka krytyczna, zgodnie z regułą nadrzędną CLAUDE.md) |
| 3.5 | **Empty-state** | Puste płótno zaprasza do akcji (duszek/strzałka/"kliknij żeby dodać"), nie jest martwą szarością | Do zaprojektowania — dziś brak potwierdzonego empty-state dla pustej tablicy |
| 3.6 | **Mikro-interakcje** | Hover podświetla uchwyty, selekcja ma widoczny halo/ring, akcje mają subtelną animację (fade/scale) | Selekcja ma `ring-2` na sticky — baza jest; audytować spójność na WSZYSTKICH typach node (shape/text/frame/link/image) |
| 3.7 | **Overlay/panele bez błędów renderowania** | Żaden panel nie ma uciętego tekstu, wszystko czytelne | ZNANY DEFEKT z analizy: half-rendered overlay top-left z uciętym tekstem ("ION LAYER", "ator") — **naprawić w Fazie 4**, nie duplikować tu jako nowe wymaganie |
| 3.8 | **Dark + light parytet** | Oba motywy równie dopracowane, nie "dark jako afterthought" | Każdy punkt z sekcji 2 i 3 zweryfikować w OBU motywach (zgodnie z listą czekowania część B) |

---

## 4. K1 PRAWY-KLIK — komplet operacji (dziś: same akcje AI, brak basic)

Stan faktyczny z kodu (`IdeaCanvasContextMenu.tsx`): menu na node = 7 pozycji, WSZYSTKIE generatory AI
(Rozbuduj/Kwestionuj/Znajdź dowody/Sugeruj połączenia/Dołącz wiedzę/Znajdź tematy/Nazwij klastry/Wyodrębnij
akcje). Menu na pustym polu = 4 pozycje, WSZYSTKIE AI (Wypełnij luki/Brainstorm/Konwertuj-mapa/Konwertuj-tabela).
**Zero podstawowych operacji edycyjnych w menu kontekstowym.** To jest defekt K1 zgłoszony w analizie.

| # | Operacja bazowa (MUSI być w prawym-kliku) | U nas dziś | MUST/NICE |
|---|----|----|:--:|
| 4.1 | Edytuj (wejdź w tryb edycji tekstu) | Brak w menu (dostępne tylko przez dwuklik na obiekcie, nie przez prawy-klik) | [MUST] |
| 4.2 | Duplikuj | **Brak** w `IdeaCanvasContextMenu.tsx` | [MUST] |
| 4.3 | Kopiuj / Wklej | **Brak** w menu (do zweryfikowania czy istnieje jako skrót klawiszowy poza menu) | [MUST] |
| 4.4 | Usuń | **Brak w menu** (dostępne jako `deleteKeyCode` Backspace/Delete, ale nie jako opcja prawego-kliku) | [MUST] |
| 4.5 | Kolor/Styl (zmień kolor sticky/kształtu) | **Brak** — powiązane z lukami 2.21/2.22 | [MUST] |
| 4.6 | Warstwa (na wierzch/na spód) | **Brak** — powiązane z luką 2.26 | [MUST] |
| 4.7 | Komentarz (dodaj komentarz z menu) | Brak z menu (dostępny przez klik na badge, ale nie inicjuje się z prawego-kliku na obiekcie bez komentarza) | [NICE] |
| 4.8 | Lock/Unlock elementu | **Brak** — powiązane z luką 2.27 | [MUST] |
| 4.9 | Sekcja AI (Expand/Challenge/Find evidence/...) | JEST — cała obecna zawartość menu | ✅ zachować |
| 4.10 | Sekcja specyficzna whiteboard (Find themes/Name clusters/Extract actions/Convert to...) | JEST | ✅ zachować |

**Wniosek 4:** menu kontekstowe wymaga **dodania sekcji bazowej NAD sekcją AI** (nie zamiany) — struktura
docelowa: `[Bazowe: Edytuj/Duplikuj/Kopiuj/Wklej/Usuń/Kolor/Warstwa/Lock/Komentarz]` → separator →
`[AI: istniejące 7-11 pozycji]`. To dokładnie wzorzec z WSPÓLNEJ analizy (§4.4 dokumentu źródłowego).

---

## 5. NASZ STAN PRZED vs LIDER (tabela skrócona)

| Wymaganie | Miro/FigJam | My dziś | Luka |
|---|---|---|---|
| Prawy-klik ma operacje bazowe | Tak, pełny komplet | Tylko AI (0 operacji bazowych) | **KRYTYCZNA** |
| Snapping (siatka+obiekty+prowadnice) | Tak, natychmiastowe | Brak całkowity | **KRYTYCZNA** |
| Zmiana koloru/czcionki po utworzeniu elementu | Tak, panel stylu | Kolor losowany raz, brak UI zmiany; brak czcionki w ogóle | **KRYTYCZNA** |
| Trackpad/scroll-pan | Tak | Wyłączone (`panOnScroll: false`) | Wysoka |
| Warstwy (z-order) i lock pojedynczego elementu | Tak | Brak UI | Wysoka |
| Overlay bez błędów renderowania | Tak | Znany defekt (tekst ucięty) | Wysoka (do Fazy 4) |
| Fit-view, spacja-pan, marquee-select, frames, komentarze-na-obiekcie | Tak | **Już mamy** | Brak luki |
| Kursory obecności real-time | Tak | Tylko lista obecności, brak kursorów-widm | Średnia (nice-to-have) |
| Rich-text/bold/align w elemencie | Tak | Plain textarea | Średnia (nice-to-have) |
| Wspólna powłoka (Menu 1/toolbar/prawy panel) między narzędziami | Analogia Miro↔inne ich narzędzia | Whiteboard ma WŁASNY toolbar (Create/Draw/Undo), niespójny z resztą (K5, poza zakresem tego dokumentu — patrz analiza źródłowa §4) | Wysoka (rozwiązywane w Fazie 1, WSPÓLNIE) |

---

## 6. MUST vs NICE — lista priorytetowa do Fazy 2/3

### [MUST] — blokują parytet lidera, robimy w Fazie 2 (silnik) + Fazie 3 (whiteboard-specific)
1. Snapping do siatki (2.7)
2. Snapping do obiektów + prowadnice wyrównania (2.8)
3. Trackpad/scroll pan (2.5)
4. Zmiana koloru po utworzeniu — sticky i shape (2.21, 2.22)
5. Kontrolka rozmiaru czcionki (2.18)
6. Warstwy przód/tył w menu kontekstowym (2.26)
7. Lock pojedynczego elementu — UI (2.27)
8. Prawy-klik: pełna sekcja bazowa Edytuj/Duplikuj/Kopiuj/Wklej/Usuń/Kolor/Warstwa/Lock (sekcja 4, cała)
9. Weryfikacja harnessem: zoom-do-kursora (2.1), drag-grupowy (2.10), dwuklik-tworzy-sticky (2.13),
   paste-image (2.14), auto-resize (2.17) — potwierdzić czy naprawdę brakuje, zanim się buduje od zera

### [NICE] — po domknięciu MUST, jeśli czas pozwoli
1. Drag-from-rail na canvas (2.12)
2. Rich-text (bold/italic/listy) w elemencie (2.16)
3. Bold/align czcionki (2.19, 2.20)
4. Magnetyczne porty łączników (2.23)
5. Live-kursory obecności (2.29)
6. Komentarz inicjowany wprost z prawego-kliku (4.7)

---

## 7. Co NIE jest w zakresie tego dokumentu
- K5 (wspólna powłoka/toolbar/Menu 1) — rozwiązywane RAZEM dla 4 narzędzi w Fazie 1, opisane w
  dokumencie źródłowym `_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` §4.
- Naprawa half-rendered overlay — Faza 4 (Elegancja/Wykończenie), zanotowana tu tylko jako odniesienie (3.7).
- Harness pomiaru interakcji (czasy/płynność drag) — osobne zadanie Fazy 0 równoległe do tego dokumentu,
  nie jego treść.
