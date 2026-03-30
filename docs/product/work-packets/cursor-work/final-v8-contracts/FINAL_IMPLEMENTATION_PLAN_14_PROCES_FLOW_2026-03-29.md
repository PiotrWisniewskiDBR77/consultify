# Final Implementation Contract — Proces flow (Position 14/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: approved(scope) (P14-A canon frozen; docs-only)

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

### 2.3 P14-A canon (semantics + interoperability posture) (DOCS ONLY)

This section is the **scope-approval canon** for Process Flow as a process-aware diagram (not a generic canvas). It freezes the minimum semantic model, interoperability posture, validation layering, toolbelt boundaries, AI proposal governance, and degraded/error behavior required before any “enterprise process” claims.

#### 2.3.1 Semantic object types (bounded BPMN-adjacent)
We support a **bounded semantic subset** that is BPMN-adjacent but explicitly **not** BPMN 2.0 completeness.

**Node types (P0 semantic base)**:
- **Start event**: explicit process entrypoint.
- **End event**: explicit process termination.
- **Activity**: “a step that does work” (human/system); activity subtype taxonomy is optional and must not block P0.
- **Gateway**: routing decision/parallelization node (see 2.3.2).
- **Data object**: an informational artifact used/produced by steps (bounded; not a full data model).
- **Lane** (swimlane): organizational partition for readability (bounded; does not change execution semantics unless later declared).

**Edge types (P0 semantic base)**:
- **Sequence flow**: directed connector defining the control-flow order.

Explicit non-goals for P14-A:
- Message flows, event choreography, compensation/transactions, full BPMN markers library.
- Executable workflow semantics (engine-ready execution), unless separately contracted.

#### 2.3.2 Meaning rules (what each object means)
We freeze meaning so the diagram is readable and auditable.

- **Start event**:
  - communicates “this is where the process begins” for the bounded lane.
  - minimum cardinality: at least 1 per diagram (see validation layering).
- **End event**:
  - communicates “this is a terminal outcome”.
  - minimum cardinality: at least 1 per diagram.
- **Activity**:
  - represents one named step with a single clear verb phrase.
  - activity label is required for readback (empty/placeholder labels are invalid in bounded rules).
- **Gateway**:
  - represents a routing construct, not a “pretty diamond”.
  - we freeze **gateway kinds** as a bounded set:
    - **Exclusive (XOR)**: choose one path (default kind if unspecified).
    - **Parallel (AND)**: take all paths concurrently (bounded semantics: fan-out/fan-in).
  - inclusive/event-based gateways are explicit non-goals until separately approved.
- **Data object**:
  - communicates a named artifact relevant to a step (input/output).
  - bounded rule: a data object must attach to at least one activity (directly or via a bounded association if/when introduced); standalone data objects are treated as “incomplete”.
- **Lane**:
  - lane label communicates ownership/responsibility (e.g. “Client”, “Ops”, “System”).
  - lanes must not be used as a substitute for semantics (moving a node between lanes does not change its type).

#### 2.3.3 Readback rules (semantic-first readback)
Readback exists to prevent “diagram as drawing”. Minimum readback must be possible from the canonical model:

- **Deterministic readback**:
  - Start from each Start event.
  - Traverse Sequence flows forward.
  - At each Activity: emit `Step {id}: {label}`.
  - At XOR gateway: emit `Decision {id}: {label?}` and list labeled outgoing conditions (edge labels).
  - At AND gateway: emit `Parallel split {id}` and list branches; on join, emit `Parallel join {id}` (bounded; see validation).
  - End events terminate readback paths.
- **Label requirements**:
  - Activities require labels.
  - Gateways should have labels when they encode a decision intent (optional for P0 but recommended).
  - For XOR branches: outgoing edges should have condition labels; if missing, readback must flag “unlabeled branch”.
- **Readback must surface problems** (without guessing):
  - missing start/end, dangling nodes, unlabeled activities, illegal connector types.
  - readback cannot “invent” missing semantics; it can only flag and guide recovery.

#### 2.3.4 BPMN / interoperability posture (what we support vs non-goal)
We freeze an honest interoperability stance:

- **Supported posture (P0)**:
  - We are **BPMN-adjacent**: we intentionally map our bounded semantic types to recognisable BPMN concepts for **communication**, not full interchange parity.
  - We support **export/readback** from the canonical model (see 2.3.5) in a way that preserves semantic types + labels.
- **Non-goals (P14-A)**:
  - claiming “full BPMN 2.0 support”
  - lossless BPMN XML round-trip import/export
  - vendor-specific shape libraries parity

Export/import assumptions (freeze):
- **Export (must)**:
  - **Machine export**: a typed graph (nodes+edges) including: stable IDs, node type, lane (if any), labels, gateway kind, edge source/target, edge labels, and ordering hints (bounded).
  - **Human readback**: a readable textual representation derived from the same canonical model (no second truth).
- **Import (bounded / explicit)**:
  - Import is allowed only if it targets the same bounded semantic model; anything outside must degrade to “unsupported” with explicit loss reporting.
  - If BPMN XML import is later implemented, it must be declared as a separate scope packet and must document lossiness rules explicitly.

#### 2.3.5 Validation layering (freeze)
Validation must be layered to avoid “checkbox governance on random shapes”.

1) **Semantic validity (first)**:
   - every node has a semantic type from 2.3.1
   - activity label present (non-empty)
   - gateway kind is known (XOR/AND) or defaults explicitly to XOR

2) **Bounded structural rules (second; minimal P0 rules only)**:
   - at least 1 Start event and at least 1 End event exist
   - Sequence flows connect only valid endpoints (no edge to nowhere)
   - no completely disconnected nodes (orphans must be flagged)
   - gateway arity rules (bounded):
     - XOR split: 1 incoming, 2+ outgoing
     - XOR join: 2+ incoming, 1 outgoing
     - AND split: 1 incoming, 2+ outgoing
     - AND join: 2+ incoming, 1 outgoing
   - loops/cycles are not forbidden by default, but must be flagged if they break readback determinism (bounded warning, not hard error).

Rule: structural validation must never re-type nodes or “auto-fix” semantics silently. Any fixes are proposals (manual or AI) with preview.

#### 2.3.6 Minimal builder toolbelt assumptions (contract boundaries)
Process Flow must provide, at minimum:
- **Select**: single + multi-select with clear bounds (shift / marquee).
- **Pan / zoom / fit**: pan, zoom in/out, fit-to-content/selection.
- **Create semantic nodes**: start/end/activity/gateway/data object; lane create/rename (if lanes are in the current runtime).
- **Connectors**: create/edit Sequence flows between nodes; reconnect endpoints.
- **Labels**: edit node labels; edit edge labels (conditions for XOR).
- **Move / resize**: move nodes; bounded resize where applicable; keep connectors attached.
- **Layout ops (bounded)**: at least one of:
  - auto-layout action (recompute layout), and/or
  - bounded align/distribute within selection,
  - plus basic edge routing that preserves attachment points.
- **Undo / redo**: undo/redo must cover node/edge create, delete, move, reconnect, and label edits; “Apply AI proposal” is one atomic step.

Explicit constraint: toolbelt operations must operate on the **single canonical process model** (no parallel preview-only truth persisted).

#### 2.3.7 AI proposal contract (text/DSL → preview → apply/reject) (NO silent changes)
AI can help build/edit flows, but only as governed proposals.

- **Workflow (mandatory)**: text/DSL prompt → AI proposal payload → non-destructive preview → explicit apply/reject.
- **No silent apply**: AI cannot mutate the canonical model without an explicit user apply action.
- **Proposal payload must include (minimum)**:
  - **Summary**: 1–3 sentences (“what will change”).
  - **Structured ops**: typed operations list (`create_node`, `update_label`, `connect`, `reconnect`, `delete_node`, `delete_edge`, `move_node`, `set_gateway_kind`, `set_lane`, `auto_layout`), each with stable IDs and parameters.
  - **Before/after readback**: textual readback snapshots for affected paths (bounded).
  - **Validation report**: what becomes valid/invalid after apply (bounded structural rules).
  - **Risk flags**: destructive operations count (deletes), branch changes, and any semantic loss (if imported).
- **Apply semantics**:
  - apply is atomic; on failure, the model returns to the pre-apply state and the failure is recorded (no partial silent corruption).

#### 2.3.8 Anti-duplicate gate (one diagram canon)
There must be **one** canonical Process Flow truth:

- No parallel “flow_v2”, “bpmnGraph”, “AI flow state”, or “export-only renderer state” persisted as a second truth.
- Previews are ephemeral and derived from canonical state + proposed diff.
- Any new representation requires an explicit packet and approval (do not “sneak in” a second model).

#### 2.3.9 Degraded / error posture (minimum scenarios)
The product must fail safely and guide recovery (10+):

1. **Invalid structure: missing Start**: diagram flagged; user sees “Add Start event” action; export/readback includes explicit error.
2. **Invalid structure: missing End**: flagged; user sees “Add End event” guidance.
3. **Unlabeled activity**: flagged; readback shows placeholder and requires label before claiming validity.
4. **Dangling connector** (source/target missing): connector removed or flagged; no crash; user can reconnect.
5. **Illegal gateway arity**: flagged with specific rule (“XOR split needs 2+ outgoing”); provide “add branch” or “convert gateway” actions (manual/AI proposal).
6. **Orphan node** (disconnected): flagged; guide user to connect or delete.
7. **Apply AI proposal fails**: atomic rollback; proposal stays visible for retry/edit; audit event recorded as failed.
8. **Locked/read-only artifact**: editing disabled; readback/export still available; AI apply disabled.
9. **Export fails**: actionable error + retry; never export an empty/incorrect artifact silently.
10. **Import unsupported semantics**: show loss report; unsupported elements are either rejected or degraded to “unsupported node” with explicit label (no silent remapping).
11. **Large diagram performance**: degrade gracefully (reduce animations/guides first); keep semantic readback available.
12. **Network loss / persistence failure**: clear offline/degraded state; prevent destructive actions if not safely persisted.

#### 2.3.10 Acceptance checklist (P14-A scope approval)
- [ ] Contract header status is `approved(scope)` for P14-A (docs-only).
- [ ] §2.3 exists and freezes **semantic object types** + meaning + semantic-first readback rules (bounded BPMN-adjacent).
- [ ] BPMN/interoperability posture is explicit: **what we support vs non-goal**, and export/import assumptions are frozen (bounded; no overclaim).
- [ ] Validation layering is frozen (semantic-first, then bounded structural rules).
- [ ] Minimal toolbelt assumptions are frozen (connectors, labels, layout ops, undo/redo) as contract boundaries.
- [ ] AI proposal contract is frozen: text/DSL → preview → apply/reject; **no silent changes**; payload contents specified.
- [ ] Anti-duplicate gate is explicit (one canonical model; no `flow_v2` or parallel truths).
- [ ] Degraded/error posture includes **10+** concrete scenarios with clear recovery guidance.
- [ ] Evidence ledger row `P14-A` is filled at least with status + notes (commit link added on closeout).
- [ ] `EXECUTION_INDEX.md` row #14 is updated to `approved(scope)`.

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
- **Staging proof script (click-by-click)**:
  1. Create a process with start → activity → gateway → branch → end (bounded object types).
  2. Connect nodes, label edges, adjust layout; use undo/redo; verify semantic readback stays intact.
  3. Export/readback (bounded) and verify types/labels are preserved.
  4. Trigger an invalid structure (bounded rule) and verify a clear error + recovery guidance.
  5. Use AI: “zrób flow” → preview → apply; then manually edit without losing semantics.
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
| P14-A | approved(scope) | 6f39e6de91 | N/A (docs-only scope approval) | N/A | §2.3 canon frozen: semantic object types + readback, BPMN/interoperability posture, validation layering, toolbelt boundaries, AI proposal contract (no silent apply), anti-duplicate gate, degraded posture + acceptance checklist |
| P14-B |  |  |  |  |  |
| P14-C |  |  |  |  |  |

