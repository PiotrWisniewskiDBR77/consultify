---
brief: process-flow
module: Ideas → Process Flow
sources: [developer.lucid.co (scrape 2026-03, Extension SDK + Standard Import reference), Mermaid (mermaid.js.org, 2026-03, syntax pages), bpmn.io/Camunda (scrape 2026-03), draw.io/diagrams.net (blog/docs scrape 2026-03), Microsoft Visio (uwaga: zip mislabeled)]
grounding: scrape
status: done
updated: 2026-06-10
---

# Benchmark: Process Flow (Ideas)

> Po co: ustalić feature-surface i model danych naszego Process Flow wobec liderów
> diagramowania procesów (Lucid, draw.io, BPMN.io/Camunda) i standardów (BPMN 2.0 /
> Mermaid), żeby zbudować edytor flow/swimlane z auto-layoutem i AI-generacją — bez
> wynajdywania koła i spójny z modelem bindingów z `whiteboard.md` §3.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **Lucidchart** | Enterprise diagramming + data-backed shapes, Extension SDK | **Data-backed shapes** (kształt = widok na rekord) + **import z Mermaid** (`AddDiagramFromMermaidQuery`) + biblioteka BPMN 2.0 ze Standard Import + SwimLaneBlockProxy w SDK |
| **Mermaid** | Diagram-as-code, tekstowy DSL, open-source | „Diagram z tekstu" — `flowchart TD/LR`, node-shapes z semantyką (Terminal/Decision/Database…), subgraphs; deterministyczny, wersjonowalny, idealny do AI-generacji |
| **bpmn.io / Camunda** | Standard BPMN 2.0, edytor (bpmn-js) + silnik wykonawczy | Pełna zgodność z **BPMN 2.0 XML** + embeddable modeler (palette + context-pad + properties panel) + wykonywalne procesy (Zeebe) + heatmapy procesowe (Optimize) |
| **draw.io / diagrams.net** | Darmowy, uniwersalny edytor (mxGraph) | Bogate biblioteki kształtów + **connection points** + data-driven diagrams (CSV) + format **mxGraph XML**, zero-lock-in, embeddable |
| **Microsoft Visio** | Korporacyjny standard schematów, stencils | Stencils/master shapes + connection points + data-linked diagrams (Excel/Azure) — *w naszym zipie brak realnych źródeł, patrz Załączniki* |

Wniosek strategiczny: **Mermaid to nasz wzorzec warstwy AI/„diagram z tekstu"** (Teresa generuje DSL → render), **Lucid to wzorzec UX + modelu danych** (block/line + data-backed shapes + Extension SDK), **BPMN 2.0 to wzorzec semantyki procesu** (events/tasks/gateways/lanes), **draw.io to wzorzec biblioteki kształtów + connection points**.

## 2. Wzorce UX / IA (co działa) — z realnych zrzutów

Zrzuty z realnego scrape (zob. `assets/process-flow/`):
- **`mermaid-flowchart-render.png`** — render Mermaid `flowchart`: node-shapes (prostokąt, **hexagon = decyzja/prep**), strzałki z etykietami (Label1/2/3), różne typy krawędzi (solid/dashed/thick, grot kołowy/krzyżyk) i **subgraph** „Sit" jako kontener. Dowód: „diagram z tekstu" daje czysty, czytelny graf bez ręcznego layoutu.
- **`bpmnio-modeler-swimlanes.png`** — modeler bpmn.io: **lewy panel-paleta**, kanwa z **dwoma pulami/lane'ami** (Customer / Manager), task'i, **bramki (romby)**, start/end events, **prawy properties panel** (Assignee, form fields, process variables). To referencyjny layout edytora procesu.
- **`drawio-interface-annotated.png`** — opisany interfejs draw.io: **Shape libraries** (lewy panel), **Drawing canvas** (środek, flowchart z connectorem), **Format panel** (prawy), Toolbar, Diagram pages. Kanon trójpanelowego edytora diagramów.

Wzorce wyabstrahowane z powyższych + dokumentacji:

- **Diagram z tekstu (Mermaid):** użytkownik pisze `flowchart LR; A[Start]-->B{Decyzja}-->C[Koniec]` → natychmiastowy render → *dlaczego działa*: deterministyczne, wersjonowalne, generowalne przez LLM → *u nas*: Teresa zwraca Mermaid DSL, my renderujemy i pozwalamy „rozbić" na edytowalne node'y (jak Lucid `AddDiagramFromMermaidQuery`: pole `m` = string DSL, `t` = `MermaidDiagramType`, `o`/`e` = punkt umieszczenia).
- **Trójpanelowy edytor (paleta · kanwa · properties):** potwierdzone na bpmn.io i draw.io → *u nas*: kuratorowana paleta po lewej, kanwa w środku, panel właściwości po prawej (typ node'a, etykieta, dataRef).
- **Swimlanes / pools (BPMN, draw.io):** poziome/pionowe tory = kto wykonuje krok → potwierdzone (`bpmnio-modeler-swimlanes.png`, draw.io `bpmn-pools-swimlanes`) → *u nas*: lane jako kontener-node przypięty do roli/działu (mapuje na RBAC). Lucid SDK ma realny `SwimLaneBlockProxy` (`getPrimaryLanes()`, `getPrimaryLanesVertical()`, `setPrimaryLaneSizes()`).
- **Connection points / sticky edges (draw.io, Visio, Lucid):** strzałka „przykleja się" do portu kształtu i podąża za nim → *esencja diagramu procesu* → *u nas*: **binding edge↔node** (ten sam model co `whiteboard.md` §3).
- **Palette / shape library z kategoriami:** lewy panel z kształtami drag-na-kanwę → *u nas*: kuratorowany flowchart + BPMN-lite, nie 500 kształtów.
- **Quick-shape / context-pad (Lucid proximity-connect, bpmn-js context-pad):** najechanie na node pokazuje akcje/strzałki → 1 klik tworzy połączony następny node → najszybszy sposób budowy flow → mocny kandydat do skopiowania.
- **Inline edycja etykiety + autosize:** dwuklik = edycja tekstu, node rośnie do treści → standard, must-have.

## 3. Model danych / architektura — potwierdzony kodem SDK

Wspólny mianownik wszystkich narzędzi to **graf: node (kształt) + edge (połączenie)** — ale różnią się bogactwem semantyki:

- **Mermaid:** czysty tekstowy DSL → AST → SVG. Brak trwałego modelu obiektowego; źródłem prawdy jest *tekst*. Node-shapes mają jednak **semantykę procesu** (dokumentacja flowchart wprost mapuje: Stadium→Terminal Point, Cylinder→Database, Hexagon→Prepare Conditional, Double Circle→Stop). → Dla nas: trzymać DSL jako jedną z reprezentacji (AI in/out, eksport), **nie** jako SSOT edytora.
- **BPMN 2.0 (Lucid Standard Import):** każdy element ma **typ semantyczny**, nie tylko geometrię. Potwierdzone w realnej specyfikacji: blok `bpmnActivity` z polami `activityType` (`task`/`transaction`…), `taskType`, `activityMarker1/2`; **gateway z `gatewayType`**: `exclusive` / `parallel` / `inclusive` / `eventBased` / `complex` / `exclusiveEventBased` / `parallelEventBased`; event z `eventType`. → Dla nas: **typ semantyczny node'a** (krok / decyzja / start / koniec / podproces / brama) to wartość — pozwala Teresie rozumować o procesie i liczyć metryki (liczba bramek, ścieżki).
- **draw.io (mxGraph):** `mxCell` (vertex/edge) z `style` i `mxGeometry`; edge ma `source`/`target` po **id node'a** — twarde bindingi, nie po pozycji. Wspiera data-driven diagrams (CSV → kształty). → Dokładnie wzorzec, którego chcemy.
- **Lucid (Extension SDK, realne typy):** dokument = bloki i linie. **`BlockProxy`** (rozszerzany m.in. przez `SwimLaneBlockProxy`, `TableBlockProxy`, `ERDBlockProxy`) + **`LineProxy`** z `getEndpoint1/2()`, `getConnectedLines()`, `getDownstreamConnection()`. Kluczowy dowód na binding: **`BlockEndpointDefinition`** = endpoint linii podpięty do bloku, pola: `connection: BlockProxy`, `linkX`/`linkY` (0–1, względna pozycja w bounding-boxie celu), `autoLink` (endpoint może wędrować wokół celu, by uprościć linię), `inside`, `padding`. To jest *dokładnie* nasz model „strzałka przyklejona do node'a po id + względny port". **Data-backed shapes** (Standard Import): kształt generowany z datasetu (`type` + `collectionId` + `idField`/`foreignKeyField` — np. Org Chart z relacji rodzic-dziecko). → Dla nas: node Process Flow może być **podpięty pod encję Consultify** (initiative/insight/process) — diagram jako żywy widok danych.

**Rekomendowany schemat (rekordowy, spójny z `whiteboard.md` §3):**
```
ProcessFlowDoc = store rekordów:
  Node { id, type: step|decision|start|end|subprocess|lane,
         label, x, y, w, h, style, dataRef?: {entity, id} }
  Edge { id, source: nodeId, target: nodeId,
         sourcePort?: {linkX, linkY}, targetPort?: {linkX, linkY}, autoLink?,
         label, kind: sequence|message|default }   // BINDING po id (wzorzec BlockEndpointDefinition)
  Lane { id, label, roleRef?, orientation }          // wzorzec SwimLaneBlockProxy
```
→ Strzałki = bindingi po id z względnym portem `linkX/linkY` (jak Lucid `BlockEndpointDefinition` / draw.io `source`/`target`), **nie** luźne współrzędne — inaczej padnie undo granularny, realtime-diff i auto-layout. Cały Ideas (Whiteboard / Process Flow / Mind Map / Table) dzieli ten model bindingów.

## 4. API / integracje
- **Lucid Extension SDK** (potwierdzone nazwy): `AddDiagramFromMermaidQuery` (`m`/`t`/`o`/`e`), `AddDiagramFromLumaQuery`, `CreateLineQuery`/`CreateBlockQuery`, `additionalpaneltabscallback`, `addmenuitem`, `addquickaction`, `access-scopes`, `application-collaborator-roles`. → Wzorzec: edytor jako platforma z **panelami/menu/quick-action rozszerzanymi przez kod** — tu wchodzi Teresa jako „blok" na kanwie (jak `AI integrations` z `whiteboard.md`).
- **Mermaid:** brak API serwerowego — biblioteka `mermaid` w przeglądarce (`mermaid.render`). Trywialne do osadzenia; ścieżka MVP dla AI-generacji. Składnia potwierdzona: direction (TD/LR/TB/RL/BT), pełna paleta node-shapes (v11.3.0+ rozszerzone), multi-directional arrows, subgraphs z własnym `direction`.
- **BPMN:** `bpmn-js` (modeler/viewer) + import/eksport **BPMN 2.0 XML**; Camunda/Zeebe dla wykonania (poza naszym zakresem v1). Camunda Optimize pokazuje **heatmapy procesowe** (`heatmap.png`) — dane runtime nałożone na diagram = inspiracja dla „żywego" Process Flow z metrykami.
- **Eksport/import:** wszystkie liczą się z PNG/SVG + format natywny (Mermaid text, BPMN XML, mxGraph XML). → Dla nas: eksport SVG/PNG + Mermaid (round-trip z AI) na start; BPMN XML później.

## 5. Decyzje dla Consultify
- ✅ **Kradniemy:** **„diagram z tekstu" (Mermaid)** jako warstwa AI — Teresa generuje/edytuje DSL, my renderujemy i pozwalamy rozbić na edytowalne node'y (wzorzec Lucid `AddDiagramFromMermaidQuery`). Najszybsza droga do AI-flow.
- ✅ **Kradniemy:** model **graf z bindingami po id + względny port** (Lucid `BlockEndpointDefinition` `linkX/linkY/autoLink`, draw.io `source/target`) + **typ semantyczny node'a** (BPMN `gatewayType`/`activityType`/`eventType`) — spójny z `whiteboard.md` §3.
- ✅ **Kradniemy:** **trójpanelowy edytor** (paleta · kanwa · properties) + **auto-layout** (dagre/elkjs) + **proximity-connect / context-pad** — to 80% szybkości budowy.
- ⚠️ **Adaptujemy:** **swimlanes/lanes** jako kontener-node przypięty do roli/działu (wzorzec `SwimLaneBlockProxy`, RBAC) — BPMN-lite, bez pełnej zgodności 2.0 w v1.
- ⚠️ **Adaptujemy:** **data-backed shapes** Lucid → node podpięty pod encję Consultify (initiative/insight/process) jako żywy widok; włączyć po ustabilizowaniu modelu danych. Heatmapa Camunda = inspiracja dla nakładki metryk.
- ❌ **Unikamy:** monolitycznego JSON-a całej kanwy (zabija undo/realtime) — j.w. w `whiteboard.md`.
- ❌ **Unikamy:** pełnej biblioteki 500+ kształtów Visio/draw.io — kuratorować zestaw (flowchart standard + BPMN-lite).
- ❌ **Unikamy:** czynienia Mermaid-text jedynym SSOT edytora — DSL to reprezentacja AI/eksport, nie model edycji (tekst gubi pozycje/style przy ręcznej pracy).

## 6. Otwarte pytania / do walidacji
- Silnik renderu: wspólny silnik Ideas (jak Whiteboard/tldraw) czy osobny graf-renderer (reactflow/elkjs)? Rozstrzygnąć łącznie z `whiteboard.md` (jeden pakiet bindingów dla całego Ideas).
- Zakres BPMN: BPMN-lite (5–6 typów node'a + bramki) na v1, czy round-trip BPMN 2.0 XML dla enterprise?
- Auto-layout: dagre vs elkjs (elk lepszy dla swimlane/ortogonal, cięższy).
- Realtime: ten sam transport co reszta Ideas — patrz `realtime-collab.md`.
- Czy Mermaid round-trip (diagram → DSL → diagram) jest stabilny przy ręcznych edycjach pozycji, czy DSL tylko jako wejście?

## Załączniki
Surowe źródła (do usunięcia po akceptacji): `Softs/0 Diagramy/Lucid/developer.lucid.co` (Extension SDK + Standard Import — **odczytane**), `Softs/0 Miro/Mermaid.zip` (**odczytane** — syntax + landing images), `Softs/0 Miro/added/{BPMN,camunda.,Drawio}.zip` (**odczytane** — modeler/heatmap/interface screenshoty).
**Status groundingu:** brief oparty na realnej treści scrape (textutil z kluczowych stron SDK/syntax + zrzuty produktowe). **Zrzuty: 3** (`assets/process-flow/`): Mermaid render, bpmn.io modeler ze swimlane, draw.io interfejs.
**Uwaga — źródło mislabeled:** `Softs/0 Miro/added/Visio.zip` **nie zawiera dokumentacji Visio** — to generyczny scrape `learn.microsoft.com` (Copilot Studio, Azure AI, ASP.NET). Twierdzenia o Visio (stencils/connection points/data-linked) oparte na wiedzy ogólnej, nie na tym zipie. Lucid scrape to czysty HTML docs — **0 zrzutów produktu** (stąd zrzuty z Mermaid/bpmn.io/draw.io).
