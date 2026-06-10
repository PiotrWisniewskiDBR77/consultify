---
brief: mind-map
module: Ideas → Mind Map
sources: [Miro (Miiro doc.zip, 2026-03), Mermaid mindmap (mermaid.js.org, 2026-03), Lucidspark (developer.lucid.co, 2026-03), draw.io tree shapes]
status: done
updated: 2026-06-09
---

# Benchmark: Mind Map (Ideas)

> Po co: zdefiniować model danych i UX naszej Mind Map wobec Miro (wzorzec interakcji
> i skali) oraz wzorców drzewa/node'ów z Mermaid/Lucidspark, żeby zbudować szybkie,
> klawiaturowe budowanie drzewa myśli + AI-rozbudowę (Teresa) — spójne z modelem
> bindingów z `whiteboard.md` §3 i Process Flow.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **Miro** | Enterprise collaborative canvas, multiplayer na skalę | Dedykowany **Mind Map mode**: `Tab` = dziecko, `Enter` = rodzeństwo, auto-układ gałęzi + multiplayer + szablony |
| **Mermaid (mindmap)** | Mind map jako kod (`mindmap` DSL) | Drzewo z wcięć tekstowych → render; deterministyczne, generowalne przez LLM |
| **Lucidspark** | „Wirtualny whiteboard" Lucid + mind-mapping | Mind map + sticky notes + **konwersja na diagram/Process Flow** + głosowanie/grupowanie |
| **draw.io / klasyczne MM (XMind-style)** | Drzewa, organigramy | Auto-layout drzewa (tree/radial) + collapse/expand gałęzi |

Wniosek strategiczny: **Miro to nasz wzorzec UX/interakcji** (klawiatura + auto-układ gałęzi + multiplayer), **Mermaid `mindmap` to warstwa AI** (Teresa zwraca drzewo z wcięć), **Lucidspark to wzorzec mostu** (mind map → Process Flow w tym samym Ideas). Mind Map to *specjalizacja* tego samego grafu co Process Flow — drzewo zamiast dowolnego grafu.

## 2. Wzorce UX / IA (co działa)
Zrzuty produktowe **niedostępne** — `Miiro doc.zip` i podkatalogi Lucid (`docs`/`reference`) zablokowane przez macOS TCC po wstępnej inwentaryzacji (patrz Załączniki). Wzorce z wiedzy o narzędziach + mapy nav.

- **Budowanie z klawiatury (Miro):** `Tab` = dodaj dziecko, `Enter` = dodaj rodzeństwo, `Esc`/strzałki = nawigacja → *dlaczego działa*: pełne drzewo bez dotykania myszy, „flow state" burzy mózgów → *u nas*: must-have, to definiuje Mind Map vs zwykły Whiteboard.
- **Auto-układ gałęzi (radial / tree):** dodanie node'a automatycznie repozycjonuje i nie pozwala na kolizje; gałęzie rozchodzą się symetrycznie → *działa*, bo użytkownik myśli o treści, nie o pozycjach → *u nas*: layout drzewa (d3-hierarchy / elkjs `mrtree`) re-flow po każdej zmianie.
- **Collapse / expand gałęzi:** klik na node zwija poddrzewo → *opanowanie dużych map* → *u nas*: flaga `collapsed` na node, dzieci ukryte rekurencyjnie.
- **Kolor gałęzi dziedziczony:** dziecko dziedziczy/wariuje kolor rodzica → czytelność wizualna → tani, wysoki zysk.
- **Inline edycja + autosize node'a:** dwuklik = edycja, node rośnie do tekstu → standard.
- **Sticky → grupowanie → mind map (Lucidspark/Miro):** zbieranie luźnych pomysłów, potem strukturyzacja w drzewo → *u nas*: import sticky z Whiteboard do Mind Map (wspólny model rekordów).
- **AI-rozbudowa gałęzi:** „rozwiń ten węzeł" → AI dodaje 3–5 dzieci → *killer dla nas*: Teresa generuje poddrzewo (Mermaid `mindmap` DSL) zaczepione w wybranym node.
- **Multiplayer + obecność kursorów (Miro):** kilka osób buduje mapę naraz → patrz `realtime-collab.md`.

## 3. Model danych / architektura
Mind Map = **drzewo** (szczególny przypadek grafu node/edge z `process-flow.md` §3): każdy node ma dokładnie jednego rodzica (poza korzeniem). To upraszcza model i włącza auto-layout drzewa.

- **Mermaid `mindmap`:** drzewo z wcięć tekstowych (indentacja = poziom). Brak trwałego modelu — źródłem prawdy jest tekst. → Dla nas: świetne wejście/wyjście AI, **nie** SSOT edytora.
- **Miro:** node + krawędź rodzic→dziecko jako osobne rekordy w store kanwy (ten sam model co reszta tablicy). → Potwierdza nasz wybór rekordowego store.
- **Lucidspark:** mind map dzieli store z resztą tablicy → łatwa konwersja na Process Flow. → Argument za **jednym wspólnym modelem Ideas**.

**Rekomendowany schemat (rekordowy, podzbiór modelu Process Flow):**
```
MindMapDoc = store rekordów (ten sam pakiet bindingów co Whiteboard/Process Flow):
  Node { id, parentId?: nodeId,   // null = korzeń → wymusza drzewo
         label, x, y, w, h,
         color?, collapsed?: bool,
         dataRef?: {entity, id} }  // node ↔ encja Consultify (insight/initiative)
  // Krawędzie SĄ POCHODNE z parentId (binding), nie osobne luźne edge.
```
→ `parentId` = binding po id (jak edge w Process Flow / strzałka w tldraw `whiteboard.md` §3). Pozycje `x/y` są **wynikiem auto-layoutu**, nie ręcznego ustawiania — co odróżnia Mind Map od dowolnej kanwy. Wspólny store z Whiteboard/Process Flow umożliwia konwersje (sticky→mapa, mapa→flow) w stylu Lucidspark.

## 4. API / integracje (jeśli istotne)
- **Mermaid `mindmap`:** biblioteka w przeglądarce, render z DSL. Trywialne do osadzenia → ścieżka MVP dla AI-generacji i eksportu tekstowego.
- **Lucid Extension SDK** (wspólne z `process-flow.md`): `editor-extension-blocks/panels`, `addmenuitem`, `addquickaction`, `lucidspark-library` — Teresa jako blok/quick-action „rozwiń węzeł".
- **Miro REST/SDK:** kształty + connectory + tags jako encje (`POST /boards/{id}/items`); webhooki na zmiany. → Wzorzec API, jeśli kiedyś otworzymy Ideas na zewnątrz; nie blokujące dla v1.
- **Eksport:** SVG/PNG + Mermaid `mindmap` text (round-trip z AI) + ewentualnie Markdown-outline (drzewo = lista zagnieżdżona) — naturalny most do Notes/Notebooks.

## 5. Decyzje dla Consultify
- ✅ **Kradniemy:** **interakcję klawiaturową Miro** (`Tab`=dziecko, `Enter`=rodzeństwo) + **auto-układ gałęzi** — to jest sedno Mind Map i odróżnia ją od Whiteboard.
- ✅ **Kradniemy:** model **drzewa przez `parentId`** (binding) jako podzbiór grafu Process Flow — jeden wspólny pakiet bindingów dla całego Ideas (`whiteboard.md` §3).
- ✅ **Kradniemy:** **AI-rozbudowę gałęzi** — Teresa generuje poddrzewo z Mermaid `mindmap` DSL zaczepione w wybranym node (analogicznie do AI-flow w `process-flow.md`).
- ⚠️ **Adaptujemy:** **most mapa↔flow↔sticky** (Lucidspark/Miro) — konwersje w obrębie wspólnego store; włączyć po ustabilizowaniu modelu.
- ⚠️ **Adaptujemy:** **collapse/expand + dziedziczenie koloru** gałęzi — tanie, wysoki zysk czytelności na dużych mapach.
- ⚠️ **Adaptujemy:** **node ↔ encja Consultify** (insight/initiative) — mapa jako żywy widok, nie tylko szkic (jak data-backed shapes Lucid w `process-flow.md`).
- ❌ **Unikamy:** traktowania Mind Map jako osobnego silnika — to specjalizacja grafu Ideas; osobny kod = rozjazd modeli (anty-wzorzec z `whiteboard.md` §5).
- ❌ **Unikamy:** ręcznego pozycjonowania jako trybu domyślnego — auto-layout jest domyślny; ręczne dostrajanie opcjonalne (inaczej gubimy „flow state").
- ❌ **Unikamy:** Mermaid-text jako SSOT edytora — DSL tylko jako wejście/wyjście AI i eksport (j.w. w `process-flow.md`).

## 6. Otwarte pytania / do walidacji
- Silnik layoutu drzewa: d3-hierarchy (lekki, tree/radial) vs elkjs `mrtree` (cięższy, spójny z Process Flow). Najlepiej jeden silnik dla obu.
- Czy Mind Map i Process Flow dzielą jeden komponent edytora (tryb „drzewo" vs „graf"), czy dwa cienkie widoki na wspólny store? Rozstrzygnąć łącznie z `whiteboard.md`.
- Round-trip Mermaid `mindmap` (mapa → DSL → mapa) — stabilny przy ręcznych edycjach, czy DSL tylko jako wejście AI?
- Realtime: ten sam transport co reszta Ideas — patrz `realtime-collab.md`.
- Eksport do Markdown-outline jako most do Notes/Notebooks — czy w zakresie v1?

## Załączniki
Surowe źródła (do usunięcia po akceptacji): `Softs/0 Miro/Miiro doc.zip` (Miro), `Softs/0 Miro/Mermaid.zip` (mindmap DSL), `Softs/0 Diagramy/Lucid/` (Lucidspark/SDK).
**Uwaga (ograniczenie środowiska):** `Miiro doc.zip` (~170 MB) oraz podkatalogi Lucid (`docs`/`reference`) zostały **zablokowane przez macOS TCC po wstępnej inwentaryzacji** — odczyt treści/zrzutów niemożliwy w tej sesji. Brief oparty na: zinwentaryzowanej strukturze źródeł + wiedzy o tych dobrze znanych narzędziach (Miro Mind Map mode, Mermaid `mindmap`, Lucidspark). **Zrzuty: brak (0)** — dociągnąć przy implementacji (miro.com mind map, mermaid.live mindmap, lucidspark.com).
