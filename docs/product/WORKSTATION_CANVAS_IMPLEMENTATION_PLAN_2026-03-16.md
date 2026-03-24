## Workstation Canvas — plan implementacji (po review: Miro + Excalidraw + Mermaid + BPMN + Obsidian)

> **Data:** 2026-03-16  
> **Zakres:** domknięcie 3 workstation canvases: `mindmap`, `whiteboard`, `process_flow` (tabela jest „w pracy”)  
> **Źródła inspiracji:** `knowledge/Miro/*` + `knowledge/Miro/added/*`

---

## 0) Kontekst techniczny (stan obecny)
- `mindmap`: ReactFlow + persystencja `POST /map/sync`, `workspaceGraphRuntime`, viewport persistence (naprawione).  
- `process_flow`: istnieje `IdeaProcessFlowTool.tsx` (ReactFlow, swimlanes, undo/redo, auto-layout dagre, walidacje podstawowe).  
- `whiteboard`: rekomendacje P0/P1 istnieją, ale plan poniżej zakłada budowę do „Miro-class” etapami.

---

## 1) Zasady (żeby nie złamać architektury i UI)
- **Nie ruszamy frozen layouts** (topbar, command row, tools strip).  
- **Properties**: używamy spójnego „properties strip” (po prawej) zamiast nowych paneli.  
- **Persystencja**: trzymamy się wspólnego modelu `IdeaWorkspaceGraph` (`nodes/edges/extensions`) + `useIdeaMapSync` / runtime, gdzie ma sens.  
- **I18n + locked**: wszystko z `useTranslation` i respektowaniem `locked`.

---

## 2) Plan zmian — `process_flow` (najwyższa wartość z BPMN.zip)

### Sprint PF-0 (stabilizacja + porządek danych)
- **SSOT dla danych flow**: doprecyzować strukturę `extensions.processFlow` (lanes, semanticKit, mode, node metadata).  
- **Rules engine dla walidacji**:
  - przenieść obecne walidacje do „reguł” z `id`, `severity` (`warn|error`), `targets` (node/edge), `message` (PL/EN),
  - dodać panel „Problems” (lista + jump-to) + highlight na canvasie.

### Sprint PF-1 (BPMN ergonomia: routing + selection)
- **Manual edge routing (bendpoints)**:
  - custom edge z zapisem waypointów w `edge.data.waypoints`,
  - orthogonal snapping (H/V) przy przesuwaniu segmentów,
  - reconnect source/target bez psucia bendpointów.
- **Marquee/lasso selection**:
  - upewnić się, że działa multi-select + batch actions (align/distribute już na liście cross-canvas).

### Sprint PF-2 (Properties strip: BPMN core + rozszerzenia)
- **Properties UI**:
  - po kliknięciu node/edge: formularz właściwości (label, type, lane, owner/system/tagi/linki, parametry decyzji),
  - miejsce na rozszerzenia (np. „execution metadata”, „automation candidate”).
- **Replace/convert**:
  - akcja kontekstowa „Convert to…” dla event/task/gateway (BPMN-like),
  - zachowuje label + połączenia, działa z undo/redo.

### Sprint PF-3 (Import/Export BPMN 2.0 round-trip)
- **Import**: BPMN XML → mapowanie na `nodes/edges` + lanes/pools (minimum) + metadata.  
- **Export**: `nodes/edges` → BPMN XML + stable IDs (żeby round-trip nie „mielił” modelu).  
- **Export SVG/PNG/PDF**: spójnie z resztą canvasów (pack).

### Sprint PF-4 (bpmnlint-style linting + org rules)
- **Rule sets**:
  - preset `recommended` (nasze),
  - możliwość „org overrides” (na poziomie workspace/org).
- **Integracja UX**:
  - warn/error badges na elementach,
  - quick-jump z listy,
  - opcjonalnie „ignore rule” dla wybranych elementów.

**Definicja „BPMN-ready P0”**:
- manual routing + snapping + reconnect,
- properties strip,
- rules engine (warn/error) + panel problemów,
- BPMN import/export round-trip (minimum set symboli + lanes/pools).

---

## 3) Plan zmian — `whiteboard` (największe braki z Miro/Excalidraw/Obsidian)

### Sprint WB-0 (Canvas primitives)
- shapes/sticky/text/image + warstwy + align/snap + lasso selection
- export: PNG/SVG + clipboard (jeśli jeszcze nie ma)

### Sprint WB-1 (Warsztat: frames + present mode + facilitation)
- frames/sections + prezentacja po frame’ach
- timer + voting
- dot-grid toggle + card palette (Obsidian-inspired)

---

## 4) Plan zmian — `mindmap` (domknięcie entry-points i integracji)

### Sprint MM-0 (Imports)
- import Mermaid Mindmap (paste DSL → mindmap)
- ujednolicenie eksportów (SVG/PNG/PDF/MD) i „clipboard export” wspólnie z whiteboard

### Sprint MM-1 (Knowledge workflow)
- backlinks/cross-link explorer (już rekomendowane) + przygotowanie pod „global graph”

---

## 5) P2 (po domknięciu P0/P1): „Global Graph” i traceability (Obsidian-inspired)
- globalny widok grafu linków między artefaktami (mindmap/whiteboard/process_flow/table records/attachments),
- unresolved links jako sygnał jakości,
- backlinks jako stały blok na artefaktach.

