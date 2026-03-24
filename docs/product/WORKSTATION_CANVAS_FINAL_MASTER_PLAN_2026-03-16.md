## Workstation Canvas — FINAL MASTER PLAN (Mind map / Whiteboard / Process flow)

> **Data:** 2026-03-16  
> **Cel:** domknięcie 3 workstation canvases do poziomu „Miro‑class” (produkcyjnie, enterprise‑ready)  
> **Scope:** `mindmap`, `whiteboard`, `process_flow` (Table Platform poza scope)  
> **SSOT rekomendacji funkcji:** `docs/product/WORKSTATION_CANVAS_RECOMMENDED_FEATURES_2026-03-16.md`  
> **SSOT sprint plan (wstępny):** `docs/product/WORKSTATION_CANVAS_IMPLEMENTATION_PLAN_2026-03-16.md`

---

## 0) Executive summary (co robimy i dlaczego)
Chcemy mieć 3 canvasy, które dają kompletne „consulting workflow”:
- **Mind map**: szybkie mapowanie problemu/hipotez/opcji + importy (paste → mapa) + eksporty do decków.
- **Whiteboard**: warsztat, praca na sticky/shape/pen, frames do sekcji i prezentacji.
- **Process flow**: prawdziwa praca procesowa (BPMN‑ready): lanes/pools, walidacje, properties, import/export round‑trip.

Największa dźwignia (value) jest w `process_flow` przez BPMN‑class ergonomię + walidację + eksporty oraz w cross‑canvas prymitywach (frames, lasso, align/snap, komentarze, export/clipboard).

---

## 1) Stan obecny (fakty w kodzie)
### 1.1 Mindmap
- ReactFlow + persystencja `POST /map/sync` + `workspaceGraphRuntime`.
- Viewport persistence naprawione (brak resetów po refresh/nawigacji).

### 1.2 Process flow
- Jest `src/components/MyWork/IdeaProcessFlowTool.tsx`: swimlanes, undo/redo, auto‑layout (dagre), podstawowe walidacje, tryby (`classic|automation|vsm`) i semantic kits (w tym BPMN shapes).
- Dane są częścią wspólnego `IdeaWorkspaceGraph` (nodes/edges/extensions).

### 1.3 Whiteboard
- Funkcje P0/P1 zidentyfikowane w dokumencie rekomendacji, ale brakuje „whiteboard feel” jako spójnego produktu (tooling + export + facilitation).

---

## 2) Przegląd inspiracji (Twoja lista + paczki w repo) i wnioski „co nam daje”

### 2.1 Process flow (BPMN / enterprise)
- **bpmn.io / bpmn-js** — renderer+modeler BPMN 2.0, standard ergonomii:
  - manual connection layouting (bendpoints) + snapping,
  - lasso selection,
  - copy/paste + search,
  - properties panel (rozszerzalny),
  - linting jako rules engine (bpmnlint‑style),
  - import/export BPMN round‑trip.
  - Źródła: patrz „Download list” na końcu.
- **Camunda Modeler / Camunda platform docs** — praktyczny „enterprise BPMN”:
  - rozszerzenia execution (Camunda extensions), properties i deployment‑ready metadata,
  - walidacje i conventions (nazwa, id, best practices).
  - **Element Templates** (JSON + schema versioning) jako oficjalny mechanizm „domain steps” aplikowany z properties panel.
  - compliance: **retention/TTL** (History time to live) jako lint‑rule klasy enterprise.
- **VSDX (Visio file format)** — interoperacyjność enterprise:
  - eksport/import w firmach (szczególnie tam, gdzie procesy „żyją” w Visio).
  - `.vsdx` to w praktyce **OPC ZIP + XML** (package parts + relacje `*.rels`) — importer to ZIP+XML+rels parser.
  - rodzina formatów: `.vsdx/.vssx/.vstx` oraz macro-enabled `.vsdm/.vssm/.vstm` (VBA) → domyślnie **blokujemy macro-enabled** w importach (security).
  - model danych: ShapeSheet jako `Cell/Row/Section` → mapowanie do node geometry + style + connectors (na start uproszczone).

**Wniosek produktowy**: `process_flow` musi mieć P0: properties + rules engine + manual routing + BPMN round‑trip.

---

### 2.2 Whiteboard (wzorce edytora)
- **tldraw** — referencyjny UX whiteboardowy:
  - narzędzia (pen/eraser/hand), selection ergonomia, kamera/viewport, performance,
  - proste API/kontrakty editorowe (co jest akcją, co stanem).
  - bardzo ważne wzorce do skopiowania:
    - **tools jako state machine** (clean interakcje: idle/pointing/translating/resizing),
    - **camera jako 1st-class API** (pan/zoom, wheelBehavior, constraints/bounds, follow),
    - **snapping jako system** (bounds + handle snapping pod strzałki/konektory + gap),
    - **clipboard pipeline** (multi-format copy/paste + external content handlers + ID remap),
    - **performance**: viewport culling + spatial index + LOD.

**Wniosek produktowy**: Whiteboard P0 to nie „ładny canvas”, tylko: pen+eraser+sticky+frames+export + zero‑friction UX.

---

### 2.3 Realtime collaboration (presence/cursors)
- **Yjs awareness** — sprawdzony „awareness layer” (kto jest online, gdzie patrzy, co zaznacza).
- **Liveblocks presence/live cursors** — gotowy pattern dla cursor/presence UI + eventy obecności.

**Wniosek produktowy**: na P0 nie musimy mieć CRDT na cały graph, ale musimy mieć:
- solidny **presence + selections + viewport follow** (facilitation).

---

### 2.4 Import/Export (interoperacyjność)
- **draw.io (diagrams.net)** — XML export + biblioteki kształtów (custom shape library).
- **Lucid** — API do tworzenia/kopiowania/importu dokumentów (platforma integracji).

**Wniosek produktowy**:
- szybkie entry‑points P1: Mermaid flowchart import, BPMN import,
- P2: draw.io xml import (flowchart‑like), potem dopiero VSDX i Lucid integracje.

---

### 2.5 Paczki, które już mamy „offline” w repo (wykorzystane)
- **Mermaid.zip**: paste DSL → mindmap / flowchart / sequence / state + ELK hint.
- **Excalidraw.zip**: frames, export utilities (clipboard!), tool‑lock, mermaid import.
- **BPMN.zip**: bpmnlint, properties panel, manual edge routing, lasso, search/copy/paste.
- **Obsidian.zip**: backlinks, global graph, unresolved links, dot‑grid/palette, perf/viewport mindset.
- **camunda..zip**: Camunda 7 manual (7.24) z naciskiem na enterprise BPMN: element templates (JSON schema) + HTTL (retention) jako wymóg.
- **Visio.zip**: wprowadzenie do VSDX: OPC ZIP + XML, typy plików (.vsdx/.vssx/.vstx + macro-enabled), ShapeSheet jako `Cell/Row/Section` (high-level interop).
- **Tldraw.zip**: `tldraw.dev` — kompletne wzorce edytora whiteboard: camera/tools-state-machine/selection/snapping/clipboard/performance (viewport culling) + follow facilitator.

---

## 3) FINAL ROADMAP — prace podzielone na „workstreams”

### 3.1 Workstream A — Cross‑canvas platform primitives (P0 wspólne)
**Cel**: jedna spójna „platforma canvas” pod 3 narzędzia.

**P0 deliverables**:
- frames/sections + present mode
- lasso/marquee selection + multi‑select actions
- z‑order + align/distribute + snap‑to‑grid/guides
- anchored comments (pin + wątek)
- export/clipboard (PNG/SVG/JSON) + opcje background/dark
- hand tool + tool lock

**Definition of Done**:
- działa identycznie w `mindmap` / `whiteboard` / `process_flow` (tam gdzie ma sens),
- i18n PL/EN, respected `locked`,
- brak naruszeń frozen layouts.

---

### 3.2 Workstream B — Process flow: „BPMN‑ready” (P0/P1)
**Cel**: enterprise‑ready `process_flow`, które zniesie audyt i realne diagramy.

**P0**:
- BPMN core (start/end, task, gateway, sequence flow, lanes/pools)
- properties strip (BPMN core + extensible)
- **Step Templates (Camunda‑style element templates)**: JSON templates aplikowane w properties strip, schema versioning, odrzucanie niekompatybilnych template.
- rules engine walidacji (warn/error), panel „Problems”, highlight + jump‑to
- routing flow‑aware + manual bendpoints + orthogonal snapping + reconnect
- BPMN import/export round‑trip (minimum)

**P1**:
- search (CTRL/CMD+F) po label/ID
- copy/paste (CTRL/CMD+C/V)
- replace/convert typów elementów (in‑place, undoable)
- Mermaid flowchart import (paste DSL → diagram)
- enterprise rule pack (opcjonalny): **Retention/TTL required** dla flow oznaczonego jako „execution ready”.

**P2**:
- simulation/what‑if
- versioning + diff
- Mermaid sequence/state import (opcjonalny „diagram studio”)

---

### 3.3 Workstream C — Whiteboard (P0/P1)
**Cel**: warsztat (sticky/pen) + frames/present + facilitation.

**P0**:
- sticky notes (kolory/rozmiary) + hotkeys
- pen/highlighter + eraser
- image tool
- affinity clustering (manual + AI assisted)

**P1**:
- templates warsztatowe
- facilitation: timer + voting + lock/unlock
- dot‑grid toggle + paleta kart (spójna z theme)

---

### 3.4 Workstream D — Mindmap (P0/P1)
**Cel**: szybkie wejścia (paste/import) + nawigacja + eksporty.

**P0**:
- outline view + search/jump
- themes/presets (min. stylowanie)

**P1**:
- CSV import/export (Miro‑style)
- Mermaid mindmap import (paste DSL → map)
- backlinks/cross‑link explorer

---

### 3.5 Workstream E — Realtime collaboration (P1/P2, „włączane etapami”)
**P1**:
- presence + live cursors + selections + follow facilitator (session)
- konflikt‑safe eventy dla „lightweight collaboration” (bez CRDT na całość)

**P2**:
- CRDT dla graph (jeśli potrzebne) lub hybryda: CRDT dla tekstu/notesów, optimistic locks dla graph.

---

### 3.6 Workstream F — Interop import/export (P1/P2)
**P1**:
- Mermaid import (mindmap + flowchart) — już w planie
- BPMN round‑trip — P0 dla process_flow

**P2**:
- draw.io xml import (flowchart)
- VSDX import (Visio) — dopiero po stabilnym modelu i eksportach:
  - scope: `.vsdx` (opcjonalnie `.vssx/.vstx`), **reject** macro-enabled (`.vsdm/.vssm/.vstm`),
  - podejście: parser OPC ZIP + XML + `*.rels` → mapowanie shapes/connectors do `process_flow` / `whiteboard`.
- Lucid integracje (API) — jeśli klienci tego chcą (licencje/terms)

---

## 4) Sprint plan (konkretnie, w kolejności minimalizującej ryzyko)

### Sprint 0 — Cross‑canvas P0 skeleton
Najpierw budujemy fundamenty (frames/lasso/export/hand/tool‑lock), bo inaczej prace w 3 narzędziach będą się rozmijać UX‑owo.

### Sprint 1 — Process flow PF‑0: rules engine + Problems panel
To od razu poprawia „enterprise feel” i daje metryki jakości diagramu.

### Sprint 2 — Process flow PF‑1: manual routing + snapping + reconnect
Największy „czytelnościowy” upgrade (BPMN‑class).

### Sprint 3 — Process flow PF‑2: properties strip + convert
Domyka „niewidzialne” właściwości i workflow.

### Sprint 4 — BPMN round‑trip (import/export) + stable IDs
Bez tego enterprise nie wejdzie.

### Sprint 5 — Whiteboard P0 (sticky/pen/eraser/image) + frames/present

### Sprint 6 — Mindmap entry‑points (Mermaid mindmap, CSV) + outline polish

### Sprint 7 — Presence/live cursors + facilitation mode

---

## 5) Akceptacja i QA (żeby nie było „banalnych problemów”)
- **Smoke testy E2E (manual + automaty)**:
  - viewport persistence (mindmap/process_flow/whiteboard),
  - eksporty (clipboard + png/svg/pdf),
  - undo/redo,
  - walidacje (warn/error) i „jump‑to”,
  - importy (Mermaid/BPMN) na realnych plikach.
- **Perf baseline**:
  - 300+ nodes/edges: scroll/pan/zoom bez dropów,
  - throttling heavy ops.

---

## 6) Ryzyka i decyzje architektoniczne
- **BPMN rendering engine**:
  - utrzymujemy ReactFlow jako wspólną bazę canvas (spójność UI),
  - ale kopiujemy standardy BPMN.io: routing, properties, linting, round‑trip semantics.
- **Realtime**:
  - zaczynamy od presence/awareness (niski koszt, wysoka wartość),
  - CRDT dopiero, jeśli realnie potrzebne.
- **Interop**:
  - nie robimy VSDX/Lucid zanim nie ma stabilnego modelu i eksportów.

---

## 7) TOP VALUE — linki do stron, które warto pobrać jako kolejne inspiracje (Twoja lista + zalecenia jak „pakować”)

### 7.1 Process flow (BPMN / enterprise)
- [bpmn-js toolkit](https://bpmn.io/toolkit/bpmn-js/)
- [bpmn-js walkthrough](https://bpmn.io/toolkit/bpmn-js/walkthrough/)
- [Camunda Modeler docs](https://docs.camunda.org/manual/latest/modeler/)
- [Camunda docs (platform / modeler — future versions)](https://docs.camunda.io/)
- [Visio VSDX format intro](https://learn.microsoft.com/en-us/office/client-developer/visio/introduction-to-the-visio-file-formatvsdx)

**Co pobrać dodatkowo (jeśli robimy „pakiet BPMN 2”)**:
- `bpmn-io/bpmn-js` (GitHub) + `bpmn-io/bpmnlint` + `bpmn-io/bpmn-js-properties-panel` (żeby mieć referencję UX/API).

### 7.2 Whiteboard
- [tldraw editor docs](https://tldraw.dev/docs/editor)
- [tldraw installation](https://tldraw.dev/installation)

### 7.3 Realtime collaboration
- [Yjs awareness](https://docs.yjs.dev/api/about-awareness)
- [Liveblocks presence tutorial](https://liveblocks.io/docs/tutorial/react/getting-started/presence)
- [Liveblocks live cursors tutorial](https://liveblocks.io/docs/tutorial/react/getting-started/live-cursors)

### 7.4 Import/Export (interop)
- [draw.io export to XML](https://www.drawio.com/doc/faq/export-to-xml)
- [draw.io custom shape library format](https://www.drawio.com/doc/faq/format-custom-shape-library)
- [Lucid API: create/copy/import document](https://developer.lucid.co/reference/createorcopyorimportdocument)
- [Lucid overview](https://developer.lucid.co/docs/overview-si)

