---
brief: mind-map
module: Ideas → Mind Map
sources: [Miro Developer Platform (Miiro doc.zip, 2026-03, Web SDK + REST mind-map experimental), Mermaid mindmap (mermaid.js.org, 2026-03, syntax), draw.io tree/radial layout (scrape 2026-03), Lucidspark/Lucid SDK (developer.lucid.co, 2026-03)]
grounding: scrape
status: done
updated: 2026-06-10
---

# Benchmark: Mind Map (Ideas)

> Po co: zdefiniować model danych i UX naszej Mind Map wobec Miro (wzorzec interakcji
> i skali) oraz wzorców drzewa/node'ów z Mermaid/draw.io/Lucid, żeby zbudować szybkie,
> klawiaturowe budowanie drzewa myśli + AI-rozbudowę (Teresa) — spójne z modelem
> bindingów z `whiteboard.md` §3 i Process Flow.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **Miro** | Enterprise collaborative canvas, multiplayer na skalę | Dedykowany **Mind Map** z auto-arrange + Web SDK/REST (`createMindmapNode`, `root.add(child)`) + import z CSV → auto-tree + real-time collaboration |
| **Mermaid (mindmap)** | Mind map jako kod (`mindmap` DSL) | Drzewo z **wcięć tekstowych** → render; różne kształty node'a (square/rounded/circle/bang/cloud/hexagon), `::icon()`, markdown strings; deterministyczne, generowalne przez LLM |
| **draw.io** | Uniwersalny edytor (mxGraph) | **Radial/tree auto-layout** (Arrange → Layout) + mind-map shape library + import Mermaid mindmap + branch-color |
| **Lucidspark / Lucid** | „Wirtualny whiteboard" + mind-mapping | Mind map + sticky notes + konwersja na diagram/Process Flow (wspólny store) + Extension SDK |

Wniosek strategiczny: **Miro to nasz wzorzec UX/interakcji i modelu** (auto-arrange + `root.add(child)` + multiplayer), **Mermaid `mindmap` to warstwa AI** (Teresa zwraca drzewo z wcięć), **draw.io radial/tree to wzorzec auto-layoutu + branch-color**, **Lucidspark to wzorzec mostu** (mind map → Process Flow w tym samym Ideas). Mind Map to *specjalizacja* tego samego grafu co Process Flow — drzewo zamiast dowolnego grafu.

## 2. Wzorce UX / IA (co działa) — z realnych zrzutów

Zrzuty z realnego scrape (zob. `assets/mind-map/`):
- **`miro-mindmap-parent-child.png`** — z dokumentacji deweloperskiej Miro: **root node** „Miro Mind Map" → dzieci (parent node) „Robust collaborative features" / „Mind mapping features" → wnuki (child nodes). Pokazuje **radialny auto-układ gałęzi** na endless canvas i nazewnictwo root/parent/child = dokładnie nasz model `parentId`.
- **`miro-node-relativeto-parent.png`** — pozycjonowanie node'ów **relativeTo: parent_center**: dziecko zakotwiczone względem środka rodzica, nie po absolutnych współrzędnych. Dowód: w mind-mapie pozycja jest *pochodną* relacji, nie ręcznego ustawienia.
- **`drawio-radial-tree-layout.png`** — draw.io Arrange → **Radial Tree layout**: korzeń „Advertising" → 4 gałęzie (Organization/Communication/Embassy/Marketing), każda z dziećmi, **kolor dziedziczony per gałąź**. Wzorzec auto-layoutu + branch-color na dużej mapie.

Wzorce wyabstrahowane:

- **Budowanie z klawiatury (Miro):** `Tab` = dodaj dziecko, `Enter` = dodaj rodzeństwo, strzałki = nawigacja → *dlaczego działa*: pełne drzewo bez dotykania myszy, „flow state" burzy mózgów → *u nas*: must-have, to definiuje Mind Map vs zwykły Whiteboard.
- **Auto-układ gałęzi (radial / tree):** dodanie node'a automatycznie repozycjonuje i nie pozwala na kolizje; gałęzie rozchodzą się symetrycznie (potwierdzone na `drawio-radial-tree-layout.png` i pozycjonowaniu relativeTo Miro) → *u nas*: layout drzewa (d3-hierarchy / elkjs `mrtree`) re-flow po każdej zmianie.
- **Collapse / expand gałęzi:** klik na node zwija poddrzewo → *opanowanie dużych map* → *u nas*: flaga `collapsed` na node, dzieci ukryte rekurencyjnie.
- **Kolor gałęzi dziedziczony:** dziecko dziedziczy/wariuje kolor rodzica (widoczne na radial-tree draw.io) → czytelność wizualna → tani, wysoki zysk.
- **Inline edycja + autosize node'a:** dwuklik = edycja, node rośnie do tekstu. Miro node trzyma treść jako HTML (`nodeView.content: '<p>…</p>'`) → standard.
- **Sticky → grupowanie → mind map (Lucidspark/Miro):** zbieranie luźnych pomysłów, potem strukturyzacja w drzewo → *u nas*: import sticky z Whiteboard do Mind Map (wspólny model rekordów).
- **AI / import-rozbudowa gałęzi:** Miro ma realny przepływ **CSV → tree → mind map** (parsuj → zbuduj drzewo → `createMindmapNode`) → *killer dla nas*: Teresa generuje poddrzewo (Mermaid `mindmap` DSL) zaczepione w wybranym node, analogicznie jak CSV→tree.
- **Multiplayer + obecność kursorów (Miro):** kilka osób buduje mapę naraz → patrz `realtime-collab.md`.

## 3. Model danych / architektura — potwierdzony SDK

Mind Map = **drzewo** (szczególny przypadek grafu node/edge z `process-flow.md` §3): każdy node ma dokładnie jednego rodzica (poza korzeniem). To upraszcza model i włącza auto-layout drzewa.

- **Miro Web SDK (realny kod, experimental):** `miro.board.experimental.createMindmapNode({ nodeView: { content } })` tworzy node; relacja rodzic-dziecko przez **`await root.add(childA)`** — *nie* przez luźną krawędź, lecz przez **strukturalną przynależność dziecka do rodzica** (dokumentacja: „Children inside parent items"). Pozycje dzieci są względne (relativeTo parent center). REST API ma `create/get/delete-mindmap-node` (experimental). → To wprost potwierdza nasz wybór: **drzewo przez `parentId`**, krawędzie pochodne, pozycje z auto-layoutu.
- **Mermaid `mindmap`:** drzewo z **wcięć tekstowych** (indentacja = poziom hierarchii). Składnia potwierdzona: `root((tekst))`, dzieci przez głębsze wcięcie; kształty node'a (square/rounded/circle/bang/cloud/hexagon — „same shapes as flowcharts"), `::icon(fa fa-book)`, markdown strings. Brak trwałego modelu — źródłem prawdy jest tekst. → Dla nas: świetne wejście/wyjście AI, **nie** SSOT edytora.
- **draw.io:** mind map = drzewo węzłów z `source/target` po id; layout radial/tree liczony przez silnik (Arrange → Layout). → Potwierdza: pozycje są wynikiem layoutu, kolor dziedziczony per gałąź.
- **Lucid/Lucidspark:** mind map dzieli store z resztą tablicy (bloki + linie, `BlockProxy`/`LineProxy`) → łatwa konwersja na Process Flow. → Argument za **jednym wspólnym modelem Ideas**.

**Rekomendowany schemat (rekordowy, podzbiór modelu Process Flow):**
```
MindMapDoc = store rekordów (ten sam pakiet bindingów co Whiteboard/Process Flow):
  Node { id, parentId?: nodeId,   // null = korzeń → wymusza drzewo (wzorzec Miro root.add(child))
         content,                 // HTML/markdown (jak Miro nodeView.content)
         x, y, w, h,              // WYNIK auto-layoutu, relativeTo parent
         color?, collapsed?: bool, shape?,
         dataRef?: {entity, id} }  // node ↔ encja Consultify (insight/initiative)
  // Krawędzie SĄ POCHODNE z parentId (binding), nie osobne luźne edge.
```
→ `parentId` = binding po id; relacja rodzic-dziecko strukturalna (jak Miro `root.add(child)`, nie luźny connector). Pozycje `x/y` są **wynikiem auto-layoutu** (relativeTo parent), nie ręcznego ustawiania — co odróżnia Mind Map od dowolnej kanwy. Wspólny store z Whiteboard/Process Flow umożliwia konwersje (sticky→mapa, mapa→flow) w stylu Lucidspark.

## 4. API / integracje
- **Miro Web SDK / REST (experimental):** `createMindmapNode`, `root.add(child)`, `get/delete-mindmap-node`; przykładowa apka **CSV → mind map** (parsuj CSV → zbuduj tree → generuj node'y). → Wzorzec API + wzorzec importu drzewa z danych; nie blokujące dla v1, ale gotowy schemat dla „generuj mapę z danych".
- **Mermaid `mindmap`:** biblioteka w przeglądarce, render z DSL (wcięcia). Trywialne do osadzenia → ścieżka MVP dla AI-generacji i eksportu tekstowego. (Uwaga z docs: składnia stabilna poza eksperymentalną integracją ikon.)
- **Lucid Extension SDK** (wspólne z `process-flow.md`): `additionalpaneltabscallback`, `addmenuitem`, `addquickaction`, `BlockProxy`/`LineProxy` — Teresa jako blok/quick-action „rozwiń węzeł".
- **Eksport:** SVG/PNG + Mermaid `mindmap` text (round-trip z AI) + Markdown-outline (drzewo = lista zagnieżdżona) — naturalny most do Notes/Notebooks.

## 5. Decyzje dla Consultify
- ✅ **Kradniemy:** **interakcję klawiaturową Miro** (`Tab`=dziecko, `Enter`=rodzeństwo) + **auto-układ gałęzi** (radial/tree, relativeTo parent) — sedno Mind Map, odróżnia ją od Whiteboard.
- ✅ **Kradniemy:** model **drzewa przez `parentId` / `root.add(child)`** (Miro Web SDK) jako podzbiór grafu Process Flow — jeden wspólny pakiet bindingów dla całego Ideas (`whiteboard.md` §3).
- ✅ **Kradniemy:** **AI-rozbudowę gałęzi** — Teresa generuje poddrzewo z Mermaid `mindmap` DSL (wcięcia) zaczepione w wybranym node; wzorzec procesu = Miro CSV→tree→node'y.
- ⚠️ **Adaptujemy:** **most mapa↔flow↔sticky** (Lucidspark/Miro) — konwersje w obrębie wspólnego store; włączyć po ustabilizowaniu modelu.
- ⚠️ **Adaptujemy:** **collapse/expand + dziedziczenie koloru gałęzi** (draw.io radial-tree) — tanie, wysoki zysk czytelności na dużych mapach.
- ⚠️ **Adaptujemy:** **node ↔ encja Consultify** (insight/initiative) — mapa jako żywy widok, nie tylko szkic (jak data-backed shapes Lucid w `process-flow.md`).
- ❌ **Unikamy:** traktowania Mind Map jako osobnego silnika — to specjalizacja grafu Ideas; osobny kod = rozjazd modeli (anty-wzorzec z `whiteboard.md` §5).
- ❌ **Unikamy:** ręcznego pozycjonowania jako trybu domyślnego — auto-layout jest domyślny (Miro/draw.io); ręczne dostrajanie opcjonalne (inaczej gubimy „flow state").
- ❌ **Unikamy:** Mermaid-text jako SSOT edytora — DSL tylko jako wejście/wyjście AI i eksport (j.w. w `process-flow.md`).

## 6. Otwarte pytania / do walidacji
- Silnik layoutu drzewa: d3-hierarchy (lekki, tree/radial) vs elkjs `mrtree` (cięższy, spójny z Process Flow). Najlepiej jeden silnik dla obu.
- Czy Mind Map i Process Flow dzielą jeden komponent edytora (tryb „drzewo" vs „graf"), czy dwa cienkie widoki na wspólny store? Rozstrzygnąć łącznie z `whiteboard.md`.
- Round-trip Mermaid `mindmap` (mapa → DSL → mapa) — stabilny przy ręcznych edycjach, czy DSL tylko jako wejście AI?
- Realtime: ten sam transport co reszta Ideas — patrz `realtime-collab.md`.
- Eksport do Markdown-outline jako most do Notes/Notebooks — czy w zakresie v1?

## Załączniki
Surowe źródła (do usunięcia po akceptacji): `Softs/0 Miro/Miiro doc.zip` (**odczytane** — to **Miro Developer Platform docs**, nie aplikacja produktowa: Web SDK + REST mind-map experimental + zrzuty z dokumentacji), `Softs/0 Miro/Mermaid.zip` (**odczytane** — `mindmap` syntax), `Softs/0 Miro/added/Drawio.zip` (**odczytane** — radial-tree layout, mind-map shapes), `Softs/0 Diagramy/Lucid/developer.lucid.co` (**odczytane** — SDK).
**Status groundingu:** brief oparty na realnej treści scrape (textutil z mind-map SDK/syntax + zrzuty). **Zrzuty: 3** (`assets/mind-map/`): Miro parent/child, Miro node relativeTo-parent, draw.io radial-tree z branch-color.
**Uwaga — natura źródła:** `Miiro doc.zip` to **dokumentacja deweloperska** Miro (developers.miro.com), nie zrzuty samej aplikacji do mind-mappingu — stąd zrzuty pokazują przykłady z docs (root/parent/child, pozycjonowanie), nie pełny UI produktu. Pełny UX aplikacji Miro Mind Map dociągnąć przy implementacji (miro.com). Mind-map REST/SDK Miro oznaczone jako **experimental** — API może się zmienić.
