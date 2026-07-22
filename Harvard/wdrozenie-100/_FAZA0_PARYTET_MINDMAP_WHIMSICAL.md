# FAZA 0 — Parytet lidera: MIND MAP vs Whimsical/MindMeister
**Data:** 2026-07-22 · **Kontekst:** `_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` (K1–K9) · **Nasz kod:** `src/components/MyWork/IdeaRecommendationMap.tsx` (+ `mindmap/*`) — TYLKO analiza, kod nienaruszony.

> Werdykt: Mind Mapa jest **najlepsza z 4 narzędzi Idee** — prawy-klik i mechanika bliżej lidera niż Whiteboard/Process/Table. Blokery to WYGLĄD (gimmick + brak powłoki), nie mechanika.

---

## 1. Lider — Whimsical / MindMeister (3 zdania)
Whimsical to szybka, klawiaturowa mapa myśli: **Tab dodaje dziecko, Enter dodaje rodzeństwo**, węzły to proste zaokrąglone prostokąty na krzywych łącznikach, bez ozdób — cała elegancja siedzi w spacingu, cieniu i palecie kolorów gałęzi. MindMeister dokłada auto-layout/re-balance drzewa, fold/unfold gałęzi jednym kliknięciem, drag-reparent (przeciągnij węzeł pod inny rodzic) i cross-linki (łączniki poprzeczne między odległymi węzłami) — to jest właśnie „dynamika" (K9), nie tylko wygląd. Oba narzędzia stawiają na **zero gimmicków**: brak jarzenia się, brak animowanych obwódek — czysty, profesjonalny rysunek, który da się pokazać klientowi na żywo.

---

## 2. K9 DYNAMIKA — prymitywy interakcji
| Prymityw | Whimsical/MindMeister (rynek) | U NAS DZIŚ (dowód w kodzie) | Status |
|---|---|---|---|
| Tab dodaje dziecko | ✓ | ✓ `IdeaRecommendationMap.tsx:878-879,1295-1296` „Add node (Tab)" | 🟢 |
| Enter dodaje rodzeństwo | ✓ (Enter) | 🟡 mamy, ale na **Shift+Enter** nie na samym Enter — `:1155-1163,1314-1315` „addSiblingShiftEnter" — rozjazd konwencji vs lider | 🟡 |
| Drag-reparent (przeciągnij pod innego rodzica) | ✓ z podświetleniem celu | ✓ `onNodeDrag`/`onNodeDragStop`/`reparentNode`/`isReparentable` `:2834-2912` — walidacja celu w locie | 🟢 |
| Auto-layout / re-balance | ✓ | ✓ `useAutoLayout` hook + `PaneContextMenu.tsx:115` „Auto layout" + `AIAutoClustering.tsx` (auto-cluster) | 🟢 |
| Fold/unfold gałęzi | ✓ jeden klik | ✓ `collapsedNodeIds`/`toggleCollapseNode` + poziomy Alt+0/1/2/3/9 (`:3376-3398`) + `PaneContextMenu` „Show level 1/2" | 🟢 |
| Zoom do kursora, płynny | ✓ | 🟡 domyślne zachowanie ReactFlow (brak override `minZoom/maxZoom/zoomOnScroll` w kodzie) + `CanvasZoomControls.tsx` (zoomIn/zoomOut/fitView, focus/restore) — **niezmierzone czy „płynne jak lider"** | 🟡\* |
| Pan (spacja+drag / scroll) | ✓ | 🟡 domyślne ReactFlow, brak własnej konfiguracji `panOnScroll`/`panOnDrag` — niezmierzone | 🟡\* |
| Multi-select | ✓ (marquee + shift-click) | 🟡 potwierdzony tryb „multi" (align/distribute, `SmartGuidesOverlay` peers, `:5080-5141`) — **marquee/box-select nie potwierdzony w kodzie** | 🟡 |
| Przeciąganie gałęzi (całej poddrzewa naraz) | ✓ | ✓ drag przenosi poddrzewo (reparent działa na węźle = przenosi dzieci), + `ctx_detach_branch`/`ctx_duplicate_branch` w menu | 🟢 |
| Edycja inline (dwuklik / F2) | ✓ | ✓ `onDoubleClick={handleDoubleClick}` (`:1241`) + klawisz **F2** (`:3467`) | 🟢 |
| Zmiana koloru gałęzi | ✓ paleta kolorów | ✓ `ColorPickerPopover` w `FloatingNodeToolbar.tsx:426` + paleta w `MindmapInspector.tsx:21` (`NODE_COLOR_PALETTE`) | 🟢 |
| Ikony/emoji na węźle | ✓ (picker emoji) | 🔴 **BRAK** — emoji istnieje tylko w `AISentimentOverlay.tsx` (wskaźnik sentymentu 😊/😐/😟), nie jako wybór ikony/emoji przez użytkownika na węźle | 🔴 |
| Obraz na węźle | ✓ | ✓ `ctx_add_image` (menu) + `ImageUrlModal.tsx` + render `data.imageUrl` (`:1382-1389`) | 🟢 |
| Łączniki poprzeczne (relacje, cross-link) | ✓ | ✓ `isRelationEdge` + tryb „connect" (`interactionMode==='connect'`, `:5418`) + `EdgeContextMenu.tsx` (insert node/reverse/edit relation/delete) | 🟢 |

\* Zoom/pan: mechanika PRZYPUSZALNIE jest (domyślne ReactFlow to zoom-do-kursora), ale **nie zmierzone harnessem** — zgodnie z Fazą 0 planu, to wymaga osobnego pomiaru interakcji (nie czytania kodu).

**Podsumowanie K9:** 9 🟢 / 3 🟡 / **1 🔴** (ikony/emoji na węźle). Dynamika jest DUŻO bliżej lidera niż sugerowała ogólna ocena 🟡 w macierzy analizy — kod jest bogatszy niż widać z samego renderu.

---

## 3. K8 ELEGANCJA — wygląd Whimsical
Standard Whimsical: **czyste węzły** (proste zaokrąglone kształty, brak dekoracji), **subtelne cienie** (miękkie, nisko-kontrastowe), **paleta kolorów per gałąź** (stonowana, spójna), **krzywe łączniki** (bezier, nie kanciaste), **czytelna typografia** (jeden krój, hierarchia rozmiarem/wagą, nie kolorem).

| Element | Whimsical (standard) | U NAS | Ocena |
|---|---|---|---|
| Kształt węzła | prosty zaokrąglony prostokąt | zaokrąglony prostokąt z ringiem/cieniem per branch (`:859-861`) — OK, zbliżone | 🟢 |
| Cień | miękki, subtelny | `shadow-md`/`shadow-2xl` — częściowo OK, ale **węzeł centralny ma `shadow-2xl shadow-amber-500/30`** — mocniejszy niż standard | 🟡 |
| Łączniki | krzywe (bezier) | ✓ `getBezierPath` w `GradientEdge.tsx:57` dla struktury, `getSmoothStepPath` w `LabeledEdge.tsx:19` dla relacji — zgodne z liderem | 🟢 |
| Paleta gałęzi | stonowana, spójna | `BRANCH_COLORS` (`:306-696`) — bogata paleta 20+ gałęzi, ale **surowe hex** (`#fb7185` itd.) nie tokeny `c-*` — techniczny dług wobec kanonu SPEC-A, nie wobec Whimsical per se | 🟡 |
| Typografia | jeden krój, hierarchia wagą | brak dowodu na niestandardowe fonty — OK domyślnie | 🟢 |
| **Centrum mapy** | **brak ozdoby — zwykły węzeł root, czasem tylko grubszy border** | 🔴 **GIMMICK**: `CenterNodeComponent` (`:790`) = `bg-gradient-to-br from-amber-400 via-amber-500 to-danger-500` + `center-node-glow` (pulsująca poświata `centerNodeGlow` 3s w dark mode, `mindmap-effects.css:212-224`) + `center-node-animated-border` (**obracający się conic-gradient co 4s**, `:226-253`) — to jest dokładnie ten „jarzący się pomarańczowy orb" z analizy właściciela. **Niezgodne z K8: żaden lider rynku (Whimsical/MindMeister/Miro) nie animuje centrum mapy w ten sposób.** | 🔴 |

**Wniosek K8:** poza centrum (orb) i surowymi hexami zamiast `c-*`, reszta jest blisko standardu Whimsical. Orb to jedyny prawdziwy „gimmick" do zdjęcia — nie architektura, punktowa poprawka (zamienić `CenterNodeComponent` na czysty węzeł, usunąć klasy `center-node-glow`/`center-node-animated-border` z `mindmap-effects.css:212-263`).

---

## 4. K1 Prawy-klik — potwierdzenie parytetu
Nasz `NodeContextMenu.tsx` ma **komplet operacji bazowych + dużo więcej niż Whimsical bazowo oferuje**:

**Bazowe (parytet z Whimsical):** Edit (`ctx_edit`) · Add child (`ctx_add_child`) · Add sibling (`ctx_add_sibling`) · Duplicate (`ctx_duplicate`) · Copy/Cut/Paste (`ctx_copy_nodes`/`ctx_cut_nodes`/`ctx_paste_nodes`) · Delete (`ctx_delete`).

**Strukturalne (MindMeister-poziom):** Fold/unfold (`ctx_toggle_collapse`) · Focus subtree (`ctx_focus_subtree`) · Drill down (`ctx_drill_down`) · Connect to selected — cross-link (`ctx_connect_to_selected`) · Detach branch (`ctx_detach_branch`) · Duplicate branch (`ctx_duplicate_branch`).

**PONAD parytet lidera (Consultify-specyficzne, zostają):** AI rewrite/expand/deepen/what-if/summarize (`ctx_ai_*`) · dependencies/priority/competitive check · convert-to-Initiative/Decision/Task/ProcessFlow (`ctx_convert_*`) · change shape (`ctx_change_shape`) · add image (`ctx_add_image`) · copy/paste style (`ctx_copy_style`/`ctx_paste_style`) · vote up/assign/comments/quick notes/tags · attach knowledge/artifact · share branch.

**Braki wobec Whimsical (drobne, [NICE]):**
- Brak jawnej pozycji „Change color" w menu (kolor zmienia się przez `ColorPickerPopover` w floating toolbarze przy zaznaczeniu, nie z prawego-kliku wprost) — funkcjonalnie jest, ergonomicznie inne miejsce niż lider.
- Brak „Insert image from file/clipboard" — jest tylko `ImageUrlModal` (URL), Whimsical/MindMeister wspierają wklejenie ze schowka.

**Werdykt K1: PARYTET POTWIERDZONY, lokalnie PRZEWYŻSZONY** (AI + convert + knowledge — Whimsical tego nie ma).

---

## 5. NASZ STAN PRZED vs LIDER — tabela zbiorcza
| Wymaganie | Whimsical/MindMeister | My dziś | Luka |
|---|---|---|---|
| Prawy-klik: komplet operacji | ✓ | ✓ (i więcej — AI/convert) | brak — [NICE] tylko color-w-menu, paste-image-ze-schowka |
| Tab = dziecko | ✓ | ✓ | brak |
| Enter = rodzeństwo | ✓ (Enter) | 🟡 Shift+Enter | [NICE] ujednolicić skrót |
| Drag-reparent | ✓ | ✓ | brak |
| Auto-layout | ✓ | ✓ | brak |
| Fold/unfold | ✓ | ✓ | brak |
| Zoom do kursora | ✓ zmierzone | 🟡 domyślne, niezmierzone | [MUST] harness pomiaru (Faza 0 planu) |
| Pan | ✓ zmierzone | 🟡 domyślne, niezmierzone | [MUST] harness pomiaru |
| Multi-select (marquee) | ✓ | 🟡 częściowe (multi-mode jest, marquee niepotwierdzony) | [MUST] potwierdzić/dobudować box-select |
| Edycja inline | ✓ | ✓ (dblclick+F2) | brak |
| Kolor gałęzi | ✓ | ✓ | brak |
| **Ikony/emoji na węźle** | ✓ | 🔴 **brak** | **[MUST]** dodać emoji/icon picker na węźle |
| Obraz na węźle | ✓ | ✓ | brak (nice: paste-from-clipboard) |
| Łączniki poprzeczne (relacje) | ✓ | ✓ | brak |
| **Grafika centrum (zero gimmick)** | ✓ czysty root | 🔴 **jarzący się orb + obracająca ramka** | **[MUST]** zdjąć `center-node-glow`/`center-node-animated-border`, uprościć `CenterNodeComponent` |
| Paleta = tokeny (nie hex) | n/d (nasz kanon SPEC-A) | 🟡 `BRANCH_COLORS` na surowych hex | [NICE] migracja do `c-tag-*` (osobny etap, decyzja Piotra 07-08 — sweep kolorystyki na końcu) |
| **Wspólna powłoka (Menu1/prawy-panel accordion)** | n/d (Whimsical ma własną, spójną) | 🔴 **brak** — Mapa nie ma Menu 1 ani `ArtifactRightPanel` | **[MUST]** wpiąć w powłokę SPEC-A (Faza 1 planu, WSPÓLNE dla 4 narzędzi) |

---

## 6. [MUST] / [NICE]

### [MUST] — blokują parytet lidera
1. **Zdjąć gimmick centrum** — `CenterNodeComponent` (`IdeaRecommendationMap.tsx:790`) i CSS `center-node-glow`/`center-node-animated-border`/`centerNodeGlow`/`centerBorderRotate` (`mindmap/mindmap-effects.css:212-253`) → czysty węzeł root bez animacji.
2. **Wpiąć wspólną powłokę SPEC-A** — Menu 1 (tożsamość/status/primary) + `ArtifactRightPanel` accordion. Dziś Mapa działa bez nich (zależność od Fazy 1 planu, WSPÓLNE dla 4 narzędzi — nie robić osobno dla Mapy).
3. **Dodać ikony/emoji na węzeł** — jedyny prawdziwy brak mechaniki wobec Whimsical/MindMeister (dziś emoji istnieje tylko jako AI-sentiment overlay, nie wybór usera).
4. **Zmierzyć zoom/pan/marquee harnessem interakcji** (Faza 0 planu) — kod sugeruje że działa (domyślne ReactFlow), ale właściciel zgłasza „przesuwanie trudne" — nie ufać czytaniu kodu, zmierzyć realnie w przeglądarce.
5. **Paleta `BRANCH_COLORS` → tokeny `c-*`** — dziś surowe hex (`#fb7185` itd.), niezgodne z kanonem SPEC-A (zero-hex poza brand crimson świadomym).

### [NICE] — poprawki drugiej kolejności
- Ujednolicić skrót rodzeństwa: Shift+Enter → rozważyć zwykły Enter (konwencja Whimsical), o ile nie koliduje z zatwierdzaniem edycji inline (dziś Enter = confirm edit, `:1155-1163` — stąd Shift+Enter jako obejście; do przemyślenia UX, nie trywialne).
- „Change color" jako jawna pozycja w prawym-kliku (dziś tylko przez floating toolbar).
- „Insert image" ze schowka/pliku, nie tylko URL (`ImageUrlModal`).
- Cień węzła centralnego złagodzić do poziomu pozostałych węzłów (`shadow-2xl` → `shadow-md`) po zdjęciu gradientu.

---

## Metoda / dowody
Analiza oparta na `grep`/czytaniu kodu (`IdeaRecommendationMap.tsx`, `mindmap/*.tsx`, `mindmap/mindmap-effects.css`) w gałęzi `.worktrees/audyt-idee` — kod NIE był zmieniany. Zoom/pan/marquee oznaczone 🟡\* bo obecność w kodzie ReactFlow (domyślne zachowanie) nie jest tym samym co zmierzona jakość „jak u lidera" — zgodnie ze złotą regułą „weryfikuj realny runtime, nie kod" (`CLAUDE.md`), to zostaje w kolejce do harnessu interakcji, nie deklarowane jako 🟢 na podstawie samego grep.
