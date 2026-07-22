# FAZA 0 — Parytet lidera: PROCESS FLOW vs Lucidchart/Visio/Miro-flowchart
**Data:** 2026-07-22 · **Kontekst:** `_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` (kryteria K1–K9) · **Nasz kod:** `src/components/MyWork/IdeaProcessFlowTool.tsx` + `src/components/MyWork/processflow/*` (NIE ZMIENIANY w tym dokumencie — audyt czytany z realnego kodu, nie z docy)
**Werdykt jednym zdaniem:** zdolności są najbogatsze w całym Consultify (lanes, KPI, Automation, Value Stream, walidacja, AI Coach) — ale UI to pogrzebał: ściana 3-kolumnowego toolbara, ucięty tekst, connector nie jest magnetyczny. Problem = ODCHUDZENIE I DOPRACOWANIE, nie brak funkcji.

---

## 1. Lider (Lucidchart/Visio) — 3 zdania
Lucidchart (i podobnie Visio/Miro-flowchart) daje: bibliotekę kształtów w panelu bocznym do przeciągnięcia na płótno, łączniki które **same „przyklejają się"** do krawędzi kształtu i przerysowują trasę gdy przesuwasz kształt (auto-routing ortogonalny), oraz **cztery strzałki kierunkowe** pojawiające się przy najechaniu na kształt — kliknięcie/przeciągnięcie strzałki tworzy nowy połączony kształt w jednym ruchu. Pasek narzędzi jest **minimalistyczny** (ikony, nie ściana sekcji z podpisami), a zaawansowane tryby (dane, warstwy, rewizje) chowają się za zakładkami/menu — nie stoją na start. Efekt: pierwszy diagram można narysować bez czytania instrukcji, w kilkanaście sekund.

---

## 2. K9 DYNAMIKA — prymitywy interakcji

| # | Prymityw | Standard lidera | Nasz stan (kod) | Werdykt |
|---|----------|------------------|------------------|:--:|
| 1 | Biblioteka kształtów (drag-z-palety) | Panel boczny, przeciągnij na płótno w dowolne miejsce | **Brak drag** — paleta to rząd przycisków w toolbarze; klik dodaje kształt w domyślnej pozycji (`addNode(shape)` w `ProcessFlowToolbar.tsx` L330-346). Kształty: start/end/action/decision (classic) + BPMN/system/org/automation/VSM warianty wg trybu | 🔴 |
| 2 | Łączniki magnetyczne (drag z krawędzi kształtu, dowolna strona) | Najedź na kształt → 4 strzałki kierunkowe; przeciągnij z dowolnego punktu obwodu | **Tylko 2 stałe uchwyty**: `Handle type="target" position={Position.Left}` i `Handle type="source" position={Position.Right}` (`FlowNodeComponent.tsx` L229, L356) — connector zawsze lewo→prawo, nie da się połączyć góra/dół ani z dowolnego punktu | 🔴 |
| 3 | Auto-routing ortogonalny | Łącznik sam liczy trasę L/Z omijając kształty, aktualizuje się przy przesunięciu | **Jest** — `edgeRouting.ts` (`routeOrthogonal`, L/Z z odsunięciem od bbox), ale **opt-in** (`useOrthogonal = data?.orthogonal \|\| waypoints.length > 0`, `FlowEdgeComponent.tsx` L67) — domyślnie niewłączone, użytkownik nie wie że istnieje | 🟡 |
| 4 | Etykiety tak/nie na łącznikach decyzji | Klik na łącznik z węzła decyzyjnego → wpisz etykietę inline | Nie zweryfikowano w tym audycie na poziomie edge-label UI (do harnessu interakcji) | ⚪ do zmierzenia |
| 5 | Zoom do kursora, płynny | Scroll = zoom pod kursorem, bez skoku widoku | ReactFlow domyślne (biblioteka to zapewnia) + `fitView({padding:0.15, duration:300})` na żądanie (L1939, L2014) — brak potwierdzenia że zoom-to-cursor nie jest wyłączony configiem | 🟡 |
| 6 | Pan (spacja+drag / scroll) | Naturalny, bez konfliktu z zaznaczaniem | ReactFlow domyślne — niezweryfikowane w tym audycie na żywym renderze | ⚪ do zmierzenia |
| 7 | Drag kształtu ze snappingiem do siatki | Siatka + snap | **Jest**: `snapToGrid={snapToGridEnabled}` `snapGrid={[16,16]}` (L2674-2675), toggle w UI (L2580-2586), domyślnie WŁĄCZONE (`useState(true)` L378) | 🟢 |
| 8 | Prowadnice wyrównania (smart guides) do innych kształtów | Czerwone/niebieskie linie „wyrównano do środka/krawędzi sąsiada" podczas drag | **Brak** — zero wzmianek `AlignmentGuide`/`guide`/`align` w kodzie narzędzia. Tylko grid-snap, nie smart-guides | 🔴 |
| 9 | Multi-select + marquee (zaznacz obszarem) | Zaznacz kilka kształtów naciągnięciem ramki, operuj razem | ReactFlow marquee domyślne prawdopodobnie działa (biblioteka), bulk-delete jest (`confirmBulkDelete`) — ale brak potwierdzenia marquee na żywym renderze | 🟡 do zmierzenia |
| 10 | Edycja inline (dwuklik → wpisz tekst w kształt) | Dwuklik = kursor w kształcie, Enter zatwierdza | `onEditLabel` istnieje w prawym-kliku (`getNodeContextActions`), zakładam dwuklik też — niezweryfikowane na renderze | 🟡 do zmierzenia |
| 11 | Zmiana koloru/stylu kształtu | Pasek stylu (wypełnienie/obrys/font) przy zaznaczeniu, jak w Lucidchart | Brak widocznego per-shape color/style pickera w toolbarze/context-menu (poza kolorem LANE, nie kształtu) | 🔴 |
| 12 | Swimlanes — dodaj/przesuń tor | Dodaj lane, przeciągnij żeby zmienić kolejność, resize wysokości | **Jest częściowo**: `addLane()`, `onRename`/`onDelete`/`onColorChange`/`onMoveUp`/`onMoveDown` (przyciski, NIE drag-reorder), resize wysokości przez drag dolnej krawędzi (`LaneSystem.tsx` L101-117) | 🟡 |
| 13 | Auto-layout | Jeden klik → dagre/hierarchical re-layout całego grafu | **Jest, mocne** — dagre auto-layout (`handleAutoLayout`, dostępny w toolbarze, prawym-kliku węzła i overflow) | 🟢 |
| 14 | Wyrównanie/rozkład (align left/distribute) zaznaczonych | Zaznacz 3+ kształty → wyrównaj do lewej/rozłóż równomiernie | **Brak** — nie znaleziono w kodzie | 🔴 |

**Podsumowanie K9:** 3× 🟢/mocne (snap-to-grid, auto-layout dagre, orthogonal routing silnik), ale **żadnej** prawdziwej magnetyczności connectora (jeden stały handle L→R), **brak** smart-guides, **brak** drag-z-palety, **brak** color/style pickera per kształt, **brak** align/distribute. To jest rdzeń „przesuwanie trudne" zgłoszenia właściciela — nie subiektywne, potwierdzone w kodzie.

---

## 3. K8 ELEGANCJA — wygląd do dorównania Lucidchart

**Do czego dorównać (Lucidchart, opisowo):**
- Kształty: czysty, płaski styl — cienki obrys, jednolite wypełnienie, brak cieni-ozdób, spójna paleta 6-8 kolorów.
- Łączniki: cienka linia, strzałka zamknięta, magnetyczne punkty widoczne jako małe kółka na hover.
- Siatka: subtelna, jasnoszara, nie rozprasza.
- Pasek narzędzi: **jeden rząd ikon** (kształty najczęstsze + kilka akcji), reszta chowa się w panelu bocznym/menu — **progresywne ujawnianie**, nie wszystko naraz.

**Nasz stan (kod, `ProcessFlowToolbar.tsx`):** dokładne przeciwieństwo ostatniego punktu. Pasek to **3 kolumny obok siebie w jednym rzędzie**, każda z nagłówkiem sekcji:
1. „Budowanie procesu" (Build flow) — paleta kształtów wg trybu + Lane + Insert + Split
2. „Analiza i walidacja" (Analyze and validate) — KPI, Validate, AI Coach, Summary, Readback, AI Proposal
3. „Zarządzanie canvasem" (Manage canvas) — Save, Undo/Redo, Auto, overflow (Duplikuj/Usuń/Ask AI/Convert×4)

Do tego nad tym: segmented control trybu (Classic/Automation/VSM), chip kitu semantycznego, 3 badge'e (Steps/Lanes/Warnings), linijka guidance tekstowego. To jest **ściana**, nie pasek — potwierdza obserwację właściciela „tekst ucięty z lewej" (przy węższym viewport 3 kolumny + nagłówki nie mieszczą się, tekst łamie się/ucina).

**Rekomendacja progresywnego ujawnienia:**
- Zostaw na wierzchu TYLKO: paleta kształtów (ikony, bez podpisów tekstowych — tooltip na hover) + Save + Undo/Redo + Auto-layout + jeden kebab „…".
- **Automation i Value Stream tryby** → zamiast trzeciej kolumny stałej, chowaj sekcję „Analiza i walidacja" oraz „Zarządzanie" pod zakładką/panelem bocznym (accordion prawego panelu SPEC-A, zgodnie z kanonem `ArtifactRightPanel`), otwieranym na żądanie.
- KPI Dashboard / Coach / Summary / Readback / AI Proposal → to są **panele**, nie powinny być przyciskami w rzędzie tylko wejściami w prawym panelu (Akcje/Właściwości/Powiązania/Komentarze/Historia-AI accordion), tak jak przewiduje FAZA 1 wspólnej powłoki.
- Segmented tryb (Classic/Automation/VSM) zostaje na wierzchu — to jest identity narzędzia, nie zaśmieca.

---

## 4. K1 prawy-klik — nasz stan vs Lucid

**Nasz stan (kod, `ProcessFlowContextMenu.tsx`):**
- Węzeł: Otwórz właściwości → Edytuj etykietę, Duplikuj → (opcjonalnie) Auto-układ → (opcjonalnie) Konwertuj na inicjatywę → Usuń.
- Płótno (puste miejsce): Dodaj akcję, Dodaj decyzję, Wklej, Auto-układ.

| Operacja | Lucidchart | My dziś | Luka |
|---|:--:|:--:|---|
| Edit / rename | ✓ | ✓ (Edytuj etykietę) | — |
| Duplicate | ✓ | ✓ | — |
| Delete | ✓ | ✓ | — |
| **Copy** (nie tylko Paste) | ✓ | 🔴 brak `onCopy` w menu węzła | MUST |
| **Paste** | ✓ | 🟡 tylko z menu PŁÓTNA, nie z menu węzła (nie można wkleić „obok tego węzła") | NICE |
| **Connect** (przeciągnij z menu, „connect to…") | ✓ | 🔴 brak — jedyny sposób łączenia to drag z handle | MUST |
| **Change shape** (zamień action↔decision zachowując pozycję/połączenia) | ✓ | 🔴 brak — jest tylko „Convert to initiative" (eksport do innego modułu, nie zmiana typu kształtu) | MUST |
| **Add adjacent** (dodaj kolejny krok w prawo/prawym-klikiem z węzła) | ✓ | 🔴 brak — dodawanie tylko z toolbara lub menu pustego płótna | NICE |
| Color/Style shape | ✓ | 🔴 brak (patrz K9 pkt 11) | MUST |
| Layer (na wierzch/pod spód) | częściowe u liderów | 🔴 brak | NICE |
| Auto-layout z menu węzła | — (Lucid ma to na toolbarze) | ✓ (mamy, przewaga) | — |

**Ocena:** nasz prawy-klik węzła jest **umiarkowany** (K1 🟡 z analizy bazowej) — solidny rdzeń (edit/duplicate/delete/auto-layout/convert), ale brakuje 4 operacji które w Lucidchart są standardem dnia codziennego (copy, connect, change shape, color/style).

---

## 5. „NASZ STAN PRZED vs LIDER" — tabela zbiorcza

| Wymaganie | Lucidchart | My dziś | Luka |
|---|:--:|:--:|---|
| Biblioteka kształtów drag-z-palety | ✓ | 🔴 klik-dodaje, nie drag | MUST |
| Connector magnetyczny (4 strony, dowolny punkt) | ✓ | 🔴 1 handle L→R sztywny | MUST |
| Auto-routing ortogonalny | ✓ domyślnie | 🟡 silnik jest, ale opt-in/ukryty | MUST |
| Etykiety tak/nie na łącznikach decyzji | ✓ | ⚪ niezmierzone | do harnessu |
| Zoom do kursora | ✓ | 🟡 zależne od configu ReactFlow, niepotwierdzone | do harnessu |
| Pan | ✓ | ⚪ niezmierzone | do harnessu |
| Snap do siatki | ✓ | 🟢 mamy (16px, domyślnie ON) | — |
| Smart-guides wyrównania do sąsiadów | ✓ | 🔴 brak | MUST |
| Multi-select + marquee | ✓ | 🟡 prawdopodobnie z ReactFlow, niepotwierdzone | do harnessu |
| Edycja inline dwuklikiem | ✓ | 🟡 prawdopodobnie, niepotwierdzone | do harnessu |
| Kolor/styl kształtu (pasek stylu) | ✓ | 🔴 brak (mamy tylko kolor LANE) | MUST |
| Swimlanes dodaj/zmień kolejność | ✓ drag | 🟡 mamy add/rename/color/resize, reorder tylko przyciskami góra/dół | NICE |
| Auto-layout (1 klik, cały graf) | ✓ | 🟢 mamy (dagre), przewaga nad niektórymi konkurentami | — |
| Align/distribute zaznaczonych | ✓ | 🔴 brak | NICE |
| Prawy-klik: copy | ✓ | 🔴 brak | MUST |
| Prawy-klik: connect | ✓ | 🔴 brak | MUST |
| Prawy-klik: change shape | ✓ | 🔴 brak | MUST |
| Toolbar minimalistyczny + progresywne ujawnianie | ✓ | 🔴 ściana 3-kolumnowa, tekst ucięty | MUST |
| Zdolności specyficzne (lanes/KPI/Automation/VSM/walidacja/AI Coach) | częściowe/brak u Lucid | 🟢 **NAJBOGATSZE** — Lucid nie ma KPI Dashboard, Automation mode, Value Stream mode wbudowanych jak my | **PRZEWAGA** |

**Podkreślenie kluczowe:** zdolności (K6) są ✓ bogatsze niż lider (KPI, Value Stream, Automation, AI Coach, walidacja to rzeczy których Lucidchart NIE MA natywnie) — ale UI (K8/K9) jest ✗ poniżej lidera z dwóch niezależnych przyczyn: (a) toolbar przeładowany/nieczytelny, (b) prymitywy interakcji canvasu (connector, guides, style-picker) nie dociągnięte do poziomu ReactFlow-based konkurencji.

---

## 6. [MUST] / [NICE]

### MUST (blokują parytet lidera, boli klienta na co dzień)
1. **Connector magnetyczny 4-stronny** — zamienić sztywny `Handle Left/Right` na 4 handle (top/right/bottom/left) + hover-highlight, żeby dało się łączyć w dowolnym kierunku (dziś wymusza layout tylko poziomy).
2. **Smart-guides wyrównania** przy drag (do środka/krawędzi sąsiedniego kształtu) — dziś tylko grid-snap, brak wyrównania względem innych węzłów.
3. **Odchudzić toolbar do progresywnego ujawniania** — jeden pasek ikon na wierzchu (kształty + save/undo/redo/auto-layout), Analiza/Zarządzanie/AI-panele → do prawego panelu accordion (naprawia i K5 spójność powłoki, i ucięty tekst).
4. **Color/styl kształtu** — pasek stylu przy zaznaczeniu węzła (dziś zero, tylko lane ma kolor).
5. **Prawy-klik: copy + connect + change-shape** — dopełnić baseline operacji węzła do parytetu z Lucid (dziś brakuje wszystkich trzech).
6. **Odsłonić auto-routing ortogonalny domyślnie** (dziś opt-in i niewidoczny — użytkownik nie wie że może dostać ładne kąty proste zamiast prostej linii).

### NICE (poprawi, nie blokuje)
1. Align/distribute zaznaczonych kształtów (left/center/right, equal spacing).
2. Drag-reorder lane (dziś tylko przyciski góra/dół) — analogicznie do resize który już działa drag'iem.
3. Prawy-klik: „Add adjacent" (dodaj kolejny krok bezpośrednio z menu węzła).
4. Prawy-klik węzła: Paste (dziś Paste jest tylko w menu pustego płótna).
5. Etykiety tak/nie na łącznikach decyzyjnych — potwierdzić/dopracować UX wpisywania (wymaga harnessu interakcji, nie tylko czytania kodu).
6. Biblioteka kształtów jako prawdziwy drag-z-palety (dziś klik-dodaje w domyślną pozycję) — kosmetyczne, bo klik+auto-layout daje podobny efekt końcowy, ale Lucid-user oczekuje drag.

### Do zmierzenia harnessem interakcji (nie potwierdzone samym czytaniem kodu — Faza 0 z analizy bazowej też to zgłasza)
Zoom-to-cursor, pan, multi-select marquee, edycja inline dwuklikiem, płynność drag — wszystkie zależą od domyślnej konfiguracji biblioteki ReactFlow i nie były renderowane na żywo w tym audycie. Wymagają dev-render/harness z mock-danymi (zgodnie z regułą „Piotr nigdy nie jest pierwszym testerem wizualnym").

---

## Metoda tego audytu
Czytanie realnego kodu (`grep`/`Read`, nie dokumentacji): `IdeaProcessFlowTool.tsx` (3172 linii), `processflow/ProcessFlowToolbar.tsx`, `processflow/ProcessFlowContextMenu.tsx`, `processflow/FlowNodeComponent.tsx`, `processflow/FlowEdgeComponent.tsx`, `processflow/edgeRouting.ts`, `processflow/LaneSystem.tsx`. Kod NIE był zmieniany — to dokument specyfikacyjny (Faza 0), nie implementacja.
