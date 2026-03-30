# Final Implementation Contract — Proces flow (Position 14/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Jak Mindmap/Whiteboard: UX budowania + komplet narzędzi; AI współbuduje.
- **Primary users**: konsultanci/PMO (modelowanie procesu).
- **Success metric**: procesy da się budować i modyfikować bez „braków narzędzi”, a AI działa jako governed co-builder.

## 2. Scope
### 2.1 In-scope
- Toolset i UX budowania flow.
- AI propose→review dla zmian w diagramie.

### 2.2 Out-of-scope / non-goals
- Kopiowanie UI vendorów 1:1.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_PROCES_FLOW_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Diagramy` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_PROCES_FLOW_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Lucid (BPMN semantics + configurable shapes)**:
  - `Softs/0 Diagramy/Lucid/developer.lucid.co/docs/bpmn-20-library-si.html` (BPMN 2.0 Library: shape properties i semantyka).
  - `Softs/0 Diagramy/Lucid/developer.lucid.co/docs/bpmn-shapes-reference-si.html` (BPMN Shapes Reference: “highly configurable” shapes; visual reference zachowania właściwości).
  - `Softs/0 Diagramy/Lucid/developer.lucid.co/docs/custom-shape-libraries.html` (custom shape libraries: drag from libraries; extensibility posture).
- **Mermaid (text-to-diagram / structured flow authoring)**:
  - `Softs/0 Miro/Mermaid.zip` (diagram DSL: flowchart/state/sequences; wzorzec dla AI “generate flow from prompt”).
- **Canvas adjacency (for UX/toolbelt, not semantics)**:
  - `Softs/0 Whiteboard/Tldraw.zip` oraz `Softs/0 Miro/Miiro doc.zip` jako referencje narzędzi canvas (zoom/pan/selection/snapping), ale **nie** jako substytut BPMN semantyki.

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “process semantics > generic canvas”, nie “pełny BPM suite”.**

- **BPMN-adjacent semantic base (Lucid BPMN)**:
  - Proces nie składa się tylko z “shape’ów” — ma typy (activity/event/gateway/data object) i czytelne znaczenia.
  - Właściwości obiektów (np. typ aktywności, markery) są jawne i stabilne, a UI pokazuje znaczenie.
- **Configurable shapes + reference behavior (Lucid shapes reference)**:
  - System ma przewidywalne zachowanie właściwości kształtów; użytkownik rozumie “co oznacza ten symbol”.
- **Extensibility posture (Lucid custom shape libraries)**:
  - Jeśli rozszerzamy bibliotekę: robimy to w sposób kompatybilny z “shape library” mental model (biblioteki, drag-drop, definicje).
- **Text-to-flow generation (Mermaid adjacency)**:
  - AI potrafi wygenerować proces z promptu (DSL/structured representation) i zamienić go w diagram jako propozycję (preview → apply).
- **Governance after semantics (Wave1 doctrine)**:
  - Walidacja/governance ma sens dopiero, gdy semantyka jest wystarczająco mocna (nie “checkboxy na losowych shape’ach”).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_PROCES_FLOW_2026-03-29.md` + `PROCESS_FLOW_V8_READINESS_AUDIT.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Semantic depth | process mental model | “semantic depth still light” | Wzmocnić typy obiektów + znaczenia + readback semantyki | P0 |
| BPMN/interoperability | recognizable mapping | “BPMN/interoperability not mature enough” | Ustalić BPMN-adjacent mapping + export/import assumptions (bounded) | P0 |
| Toolset/UX completeness | build without missing tools | (contract intent) | Domknąć builder toolbelt: connectors, labels, layout ops, selection, undo/redo | P0 |
| Governance layering | validate after semantics | “governance later” | Dodać minimalną walidację dopiero po semantyce (bounded) | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- User może zbudować i edytować proces end-to-end; AI potrafi „zrób flow” jako propozycję.
- Diagram komunikuje semantykę (typy obiektów + znaczenie), nie jest “losowym rysunkiem”.
- BPMN/interoperability posture jest jawne (bounded): co wspieramy, jak eksportujemy/importujemy, gdzie są granice.

### 5.2 Tests
- Integracyjne: create activity/event/gateway → connect → label → re-layout/move → undo/redo → export/readback.
- Contract tests: AI proposal (DSL/structured) → preview → apply; semantyka zachowana.
- Regression: invalid structure (np. brak start/end tam gdzie wymagane w bounded rules) → czytelny błąd i “co dalej”.

### 5.3 Staging proof checklist
- Demo: “zbuduj proces” (manual) + modyfikacje + export/readback.
- Demo: AI “zrób flow” → preview → apply → ręczna korekta bez utraty semantyki.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (readiness/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P14-A — Semantics + interoperability posture (scope approval)
- **Goal**: proces jako semantyczny model (typy/znaczenia), nie rysunek.
- **Inputs required**: BPMN-adjacent mapping (bounded) + export/import assumptions.
- **Acceptance**: scope zatwierdzony; non-goals jawne; walidacja layered dopiero po semantyce (bounded).
- **Evidence**: scope approval + linkowane benchmarki.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze semantic object types + meaning + readback rules (bounded).
  - Freeze BPMN-adjacent mapping posture (what we support vs non-goal) + export/import assumptions.
  - Freeze validation layering (semantic-first; then bounded rules).
- **DoD**:
  - Approved(scope): semantics and interoperability claims are explicit and bounded (no overclaim).

#### P14-B — Builder toolbelt + semantic readback closure
- **Goal**: connectors/labels/layout/undo/redo + stabilna semantyka + export/readback.
- **Acceptance**: diagram komunikuje semantykę; invalid structure ma czytelny błąd i recovery.
- **Evidence**: integracyjne testy + staging demo (manual + AI).
- **Tasks**:
  - Implement builder toolbelt + semantic readback + export/readback (bounded).
  - Implement invalid structure handling with clear error + recovery path.
  - Add integration+contract tests and run staging demos (5.3).
- **DoD**:
  - Manual + AI flows preserve semantics; invalid cases are recoverable; tests pass.

#### P14-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P14-A/B/C.
  - Validate rollback: disable AI proposals; preserve manual read/edit.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw semantyka+toolbelt, potem governance/validation rozszerzenia (P1).

### 8.3 Rollback plan
- Wyłącz AI proposal; zachowaj read/edit manual; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: brak semantyki (użytkownik nie rozumie diagramu).
- Ryzyko: niejawna interoperacyjność (BPMN) → overclaim.
- Decyzje: minimalny zestaw typów obiektów i ich znaczeń.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P14-A |  |  |  |  |  |
| P14-B |  |  |  |  |  |
| P14-C |  |  |  |  |  |

