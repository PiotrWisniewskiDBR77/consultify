## Workstation Canvas — analiza paczki BPMN (wnioski pod Process flow)

> **Data:** 2026-03-16  
> **Źródło:** `knowledge/Miro/added/BPMN.zip` (zrzut `bpmn.io` + materiały BPMN)  
> **Cel:** doprecyzować „must-have” ergonomii + walidacji + import/export, żeby `process_flow` było używalne na produkcji

---

## 1) Co BPMN.io pokazuje jako „prawdziwy standard” edytora BPMN

### 1.1 Import/Export jako fundament
`bpmn-js` traktuje import BPMN 2.0 XML jako asynchroniczny „core” (np. `importXML`) + eksport (XML/SVG). To nie jest tylko funkcja — to sposób działania całego edytora (round-trip).

**Implikacja dla Consultify**:
- `process_flow` musi mieć **BPMN import/export (round-trip)** jako P0 (już na liście), ale też:
  - **spójne „save pipeline”** (zachowuj metadane / IDs),
  - stabilny eksport SVG/PNG/PDF (konsumowany w deckach).

---

### 1.2 Manual routing połączeń (bendpoints) + snapping
BPMN.io mocno podkreśla:
- ręczne układanie połączeń (waypoints/bendpoints),
- przesuwanie start/end punktów i reconnect do innych źródeł/targetów,
- **snapping połączeń do pionu/poziomu** (dla czytelności).

**Implikacja dla Consultify**:
- Nasz „Routing i auto-layout flow aware” powinien jawnie zawierać:
  - **manual edge routing** (bendpoints) + orthogonal snapping,
  - łatwe reconnect source/target,
  - reroute po przesunięciu węzła bez niszczenia ręcznych bendpointów.

---

### 1.3 Lasso/marquee selection jako standard pracy
W paczce pojawia się „lasso selection tool” jako upgrade ergonomii.

**Implikacja dla Consultify**:
- Cross-canvas ergonomia powinna zawierać **marquee/lasso selection** (P0/P1 zależnie od stanu obecnego), bo bez tego:
  - align/distribute i batch actions są frustrujące,
  - większe diagramy są „klikalne” zamiast edytowalne.

---

### 1.4 Search, copy/paste, global connect (dla dużych diagramów)
Wzorce z bpmn-js:
- **CTRL/CMD+F**: wyszukiwanie elementów po label/ID i nawigacja wynikami,
- **CTRL/CMD+C / V**: kopiuj/wklej elementy (wskazanie, że clipboard może być użyte między diagramami),
- „global connect tool” i przewijanie podczas drag (ułatwia duże płótna).

**Implikacja dla Consultify**:
- Dla `process_flow` P0/P1: **Search** + **Copy/Paste** + „global connect”.

---

### 1.5 Properties Panel (edytuj „niewidzialne” właściwości)
Jest osobny moduł `bpmn-js-properties-panel`, który:
- integruje się z lifecycle modelera,
- ma provider dla „BPMN core properties” i provider dla rozszerzeń (np. Camunda).

**Implikacja dla Consultify**:
- `process_flow` bez **Properties Strip** nie będzie „enterprise-ready”.  
  Minimum P0: podstawowe właściwości BPMN + miejsce na rozszerzenia (w naszym języku: „attributes / metadata” + linki do artefaktów).

---

### 1.6 Element replacement „in place” (konwersja typów)
BPMN.io ma „replace menu” z context pad:
- zmiana typu event/gateway/activity bez kasowania,
- respektuje reguły połączeń, działa z undo/redo.

**Implikacja dla Consultify**:
- W `process_flow` warto dodać **convert/replace** jako P0/P1:
  - task ↔ sub-process, gateway exclusive ↔ parallel, event types,
  - bez utraty labeli/połączeń.

---

### 1.7 Linting/Validation jako system reguł (bpmnlint)
`bpmnlint` to:
- walidacja diagramu jako **rules engine** (błędy/ostrzeżenia),
- konfig `.bpmnlintrc` z:
  - `extends` (np. `bpmnlint:recommended`),
  - `rules` z poziomami: `off/warn/error`,
- wspiera custom rules / rule sets oraz integrację w edytorze (`bpmn-js-bpmnlint`).

**Implikacja dla Consultify**:
- Nasza „Walidacja diagramu” powinna być modelowana jako:
  - **rules engine** + severity (warn/error),
  - presety rule sets + „organizacyjne” nadpisania,
  - integracja w UI (panel błędów + podświetlenia na canvasie).

---

## 2) Delta do naszych rekomendacji (co dopisać/podbić priorytet)

### Dopisać / doprecyzować (Process flow)
- **P0**:
  - Manual edge routing (bendpoints) + orthogonal snapping + reconnect.
  - Properties strip (BPMN core + extensible).
  - Rule-engine linting (bpmnlint-style) jako „żywa walidacja”.
- **P1**:
  - Search (CTRL/CMD+F) po label/ID.
  - Copy/paste elementów (CTRL/CMD+C/V).
  - Replace/convert element types.

### Cross-canvas (jeśli nie ma)
- Marquee/lasso selection jako standard.

---

## 3) Najbardziej opłacalne „quick wins”
Jeśli chcemy szybko podnieść `process_flow` do „BPMN-class” bez gigantycznego refactoru:
- **Linting jako rules engine** (warn/error) + panel problemów.
- **Manual routing + snapping** dla krawędzi (czytelność diagramów).
- **Properties strip** (nawet minimalny) dla elementów BPMN.

