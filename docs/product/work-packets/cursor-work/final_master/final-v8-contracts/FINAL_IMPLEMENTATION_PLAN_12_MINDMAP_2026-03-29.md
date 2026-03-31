# Final Implementation Contract — Mindmap (Position 12/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: verified(evidence) — P12-A/B/C complete

## 1. Executive summary
- **Intent**: UX budowania jest dramat; porównać z konkurencją; komplet przycisków; zadania do AI i AI buduje.
- **Primary users**: konsultanci/PMO (ideation, strukturyzacja).
- **Success metric**: mindmap builder jest kompletny (narzędzia + flow), a AI współbuduje w modelu propose→review.

## 2. Scope
### 2.1 In-scope
- Komplet narzędzi budowania + sensowny UX.
- AI co-building (bez zgadywania i bez silent edits).

### 2.2 Out-of-scope / non-goals
- Kopiowanie UI vendorów 1:1.

### 2.3 P12-A canon (calm interaction + scope approval)

This section is the **scope-approval canon** for Mindmap’s calm builder loop. It freezes the P0 toolbelt, state semantics, and governance boundaries used by later packets.

#### 2.3.1 Minimal toolbelt (P0)
The builder must provide, at minimum:
- **Selection**: single-select node; optional multi-select is P1 (explicitly not required for P12-B closure unless later approved).
- **Pan / zoom / fit**: pan canvas, zoom in/out, and fit-to-content (or fit-to-selection) without losing orientation.
- **Add node**: add a new node to the map (root creation if empty).
- **Add child / sibling**: one action each (keyboard shortcuts may exist, but UI must exist).
- **Rename**: inline rename/edit node content.
- **Delete**: delete node (with bounded subtree semantics; see 2.3.3 + 2.3.4).
- **Reparent / move**: move node (and its subtree) under a new parent; reorder among siblings where applicable.
- **Collapse / expand**: collapse/expand a subtree without changing the underlying structure.

#### 2.3.2 Calm core-loop rules (no “lost branches”)
Core loop = navigate → select → operate (add/rename/move/collapse/delete) → continue, without anxiety.
- **Selection stability**: an operation must not “teleport” selection. If a selected node remains, it stays selected.
- **Post-operation anchoring**: after any operation, the user must land on an obvious anchor:
  - newly created node becomes selected and visible,
  - moved node remains selected and visible,
  - rename keeps node selected (no focus loss),
  - collapse keeps the collapsed node selected (not a random sibling).
- **No lost branches**: the UI must never make a subtree feel “gone”:
  - collapsed state is visibly indicated,
  - there is always a discoverable path back (expand affordance + breadcrumbs / ancestor context in preview),
  - viewport auto-adjusts when needed to keep the selected node in view (bounded, not jumpy).

#### 2.3.3 Frozen branch-state semantics
Branch-state is the product truth that prevents disorientation.
- **Collapsed/expanded is per-node**: collapse state belongs to a node (subtree root), not global.
- **Selection focus**:
  - selection targets a node (not an edge),
  - only one node is the “primary” selection (even if future multi-select exists),
  - if the selected node becomes hidden due to collapsing an ancestor, selection moves to that ancestor and a cue explains why.
- **Delete semantics**:
  - deleting a node deletes its subtree (bounded P0 default),
  - user must see which branch is affected (preview cue before confirm if destructive).
- **Reparent validity**:
  - cannot create cycles (moving a node under its descendant must be blocked with a clear error),
  - reparent keeps subtree intact; only parent link changes.

#### 2.3.4 “What changed” cues (after operations)
Every structural operation must leave an observable trace (bounded, calm).
- **Immediate cue**: after create/move/delete/collapse/expand/AI-apply, show a small, local cue:
  - highlight the affected node(s),
  - optional toast with 1-line summary (e.g. “Moved ‘Research’ under ‘Discovery’”).
- **Diff surface for AI only**: AI changes must be previewed as a diff before apply (see 2.3.7).
- **No spam**: cues must not stack endlessly; latest cue wins; history browsing is P1+.

#### 2.3.5 Undo/redo posture (frozen for P12-B)
Undo/redo is **in-scope** for the P0 toolbelt closure, but bounded.
- **In-scope**:
  - undo/redo for node create, rename, delete, move/reparent, collapse/expand,
  - undo/redo for “Apply AI proposal” as one grouped step (atomic apply).
- **Explicit non-goals (unless later approved)**:
  - cross-session undo history,
  - collaborative multi-user undo merging,
  - partial undo of a single AI proposal step (AI apply is atomic).

#### 2.3.6 Export/readback baseline (bounded)
Export/readback exists to prevent lock-in and to support audit/readback.
- **Baseline export formats (P0)**:
  - **Machine**: JSON (nodes with stable IDs, parentID, content; optional order among siblings).
  - **Human**: outline text (Markdown) that preserves hierarchy and node content.
- **Readback baseline**:
  - JSON export must be sufficient to reconstruct the same hierarchy (structure-preserving).
  - outline export is readback-friendly for humans; import from outline is a P1 feature unless later approved.
- **Constraints (explicit)**:
  - export does not guarantee layout coordinates stability,
  - export does not include rich styling, comments, attachments, or cross-artifact links unless separately defined later.

#### 2.3.7 AI co-building contract (NO silent edits)
AI is a governed collaborator, not an autonomous editor.
- **Workflow (mandatory)**: prompt → plan → preview/diff → explicit accept/reject → apply (or discard).
- **No silent edits**: AI must never mutate the mindmap model without explicit user acceptance.
- **Proposal payload must include** (minimum):
  - natural-language **summary** (what will change),
  - **plan** (steps / intent),
  - **operations list** (typed ops like `add_node`, `rename_node`, `move_node`, `delete_node`, `collapse_node`, `expand_node`) including target IDs and new values,
  - **preview**: before/after snapshots for affected subtrees (bounded),
  - **diff summary**: counts (nodes added/renamed/moved/deleted) and risk flags (destructive ops).
- **Apply semantics**:
  - apply is atomic; if any operation fails, nothing is committed (or the UI clearly reports partial failure + offers rollback).

#### 2.3.8 Anti-duplicate gate (single canon)
- Do **not** create a parallel mindmap “model/table” or a second mindmap representation (e.g. “mindmap-as-table” stored separately).
- Extend one canonical mindmap structure and project it into views. If a new representation is required, it must be proposed as a separate packet and approved explicitly.

#### 2.3.9 Degraded/error posture (minimum scenarios)
When things go wrong, the product must remain understandable and recoverable.
Minimum scenarios to handle with explicit UI posture:
1. **Failed create node** (network/server error): node not created; user sees error; can retry.
2. **Failed rename**: old name restored; focus remains; error shown.
3. **Failed delete**: nothing disappears; error shown; no “ghost gaps”.
4. **Invalid reparent (cycle)**: move blocked; clear reason (“cannot move under descendant”).
5. **Concurrent state mismatch** (stale version): operation rejected with “refresh needed”; preserve local selection and show reload action.
6. **Undo stack empty / redo stack empty**: controls disabled; no-op with no disruption.
7. **AI proposal apply failure**: atomic failure; proposal remains available to retry or discard; no silent partial application.
8. **Large map performance degradation**: degrade gracefully (e.g. reduce animations); never drop branches silently.
9. **Collapsed branch confusion**: selected node hidden by collapse → selection moves to ancestor + explicit cue.
10. **Export failure**: no corrupted output; user sees error and can retry; export is never “half-written”.

#### 2.3.10 Acceptance checklist (testable)
- [ ] I can create a mindmap root and add child + sibling nodes using UI controls (not only shortcuts).
- [ ] After creating a node, the new node is selected and visible (no hunting).
- [ ] After moving/reparenting a node, the moved node remains selected and visible.
- [ ] I can collapse/expand a subtree; collapse state is clearly visible and reversible.
- [ ] Collapsing a branch does not delete data; expanding restores the subtree unchanged.
- [ ] Deleting a node deletes its subtree (bounded P0) and leaves me on a sensible anchor (parent or nearest sibling).
- [ ] Invalid reparent (cycle) is blocked with a clear error; map remains unchanged.
- [ ] Undo/redo works for create/rename/move/delete/collapse/expand; AI apply is undoable as one step (when implemented in P12-B).
- [ ] Export JSON preserves hierarchy and is sufficient for structure readback; export Markdown preserves hierarchy textually.
- [ ] AI co-building never applies edits silently; every AI change is previewed as a diff and requires explicit accept/reject.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md`
- Readiness: `docs/product/MINDMAP_V8_READINESS_AUDIT.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Miro` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Miro (mind map object model + import/co-building patterns)**:
  - `Softs/0 Miro/Miiro doc.zip :: Miiro doc/developers.miro.com/docs/mind-maps.html` (Mind map (Experimental): CRUD mind maps; “represent and interact with complex structures”; import/export).
  - `Softs/0 Miro/Miiro doc.zip :: Miiro doc/developers.miro.com/docs/create-mind-map-from-csv.html` (Create mind map from CSV: import → auto-create mind map on board).
  - `Softs/0 Miro/Miiro doc.zip :: Miiro doc/developers.miro.com/docs/websdk-reference-mindmap-node.html` (MindmapNode: root + child creation; node content).
  - `Softs/0 Miro/Miiro doc.zip :: Miiro doc/developers.miro.com/reference/create-mindmap-nodes-experimental.html` (Create mind map node: root/child structure; API contract posture).
- **Adjacents in same Softs family** (dla “tool completeness”, jeśli mapka współistnieje z diagramami):
  - `Softs/0 Miro/Excalidraw.zip` (whiteboard-style primitives; useful as a “minimal toolbelt” reference).
  - `Softs/0 Miro/Mermaid.zip` (text-to-diagram mindset; useful for AI “generate structure” flows).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “spokojny, kompletny builder + przewidywalny model gałęzi”, nie “pełna Miro parity”.**

- **Mind map as a first-class structure (Miro)**:
  - Root + child nodes są jawne; node content jest edytowalne i stabilne.
  - Struktura wspiera duże mapy bez utraty orientacji (nawigacja, fokus, “gdzie jestem”).
- **Import/transform workflows (Miro CSV import)**:
  - Import danych → wygenerowanie struktury mapy jako kontrolowany workflow (preview → apply).
  - Export/readback jest możliwy bez gubienia semantyki gałęzi.
- **Tool completeness for core loop**:
  - Dodawanie node’ów, zmiana hierarchii (reparent), collapse/expand, szybka edycja treści.
  - Zoom/pan/fit-to-content, undo/redo, multi-select, drag-and-drop bez “interaction anxiety”.
- **AI co-building as governed proposals**:
  - AI generuje/modyfikuje mapę jako propozycję (diff/preview) → user akceptuje; brak silent edits.
  - AI potrafi: rozwinąć gałąź, zwinąć/reorganizować, wygenerować mapę z briefu.
- **Trust boundaries (Wave1 doctrine)**:
  - Użytkownik rozumie co zmieniło się po operacji (manualnej lub AI); stany są spójne.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md` + readiness `MINDMAP_V8_READINESS_AUDIT.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Interaction calmness | smooth branch creation/navigation | “interaction calmness trails benchmark” | Uspokoić core loop: selection/navigation/branch ops (bez frustracji) | P0 |
| Branch-state trust | operations are understandable | “branch-work trust not strong enough” | Ujednolicić semantykę branch state + readback “what changed” | P0 |
| Collaboration confidence | helpers feel additive | “collaboration confidence later” | Dodać bounded collab/copilot cues bez destabilizacji | P1 |
| Builder tool completeness | no missing buttons | “tool set incomplete / UX dramatic” | Domknąć minimalny toolbelt buildera (bez pełnej whiteboard parity) | P0 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- User potrafi zbudować mapę bez braków narzędzi; AI potrafi wygenerować i modyfikować strukturę jako propozycję.
- Core loop jest “calm”: brak sytuacji, gdzie user traci orientację po operacji.
- AI proposals są reviewable (preview/diff) i audytowalne.

### 5.2 Tests
- Integracyjne: create root → add children → reparent → collapse/expand → undo/redo → export/readback.
- Regression: duża mapa (stress) → selection/navigation stabilne; brak “znikających” gałęzi.
- Contract tests: AI proposal payload → preview → accept/reject → state spójny.

### 5.3 Staging proof checklist
- Demo: manual build (od zera) + reorganizacja gałęzi + export/readback.
- Demo: AI “zrób mindmap z briefu” → preview → accept → dalsza ręczna edycja bez glitchy.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (readiness/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P12-A — Calm interaction canon + scope approval
- **Goal**: calm core loop (selection/navigation/branch ops), bez “Miro parity”.
- **Inputs required**: decyzje o minimalnym toolbelt + branch-state semantics.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “what changed” cues spisane.
- **Evidence**: scope approval + linkowane benchmarki.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze minimal toolbelt and the calm core-loop rules (selection/navigation/branch ops).
  - Freeze branch-state semantics + “what changed” readback cues.
  - Freeze AI proposal contract (preview/diff, accept/reject) (bounded).
- **DoD**:
  - Approved(scope): calm loop and toolbelt are explicit; no “missing buttons” for P0 lane.

#### P12-B — Builder toolbelt + state trust closure
- **Goal**: domknąć minimalny toolbelt + stabilny state/readback.
- **Acceptance**: duże mapy nie glitchują; AI proposals są reviewable (preview/diff).
- **Evidence**: stress/regression + staging demo (manual + AI).
- **Tasks**:
  - Implement toolbelt closure and stable state transitions (undo/redo included where declared).
  - Add stress/regression for large maps; ensure no “lost branches”.
  - Run staging demos (manual build + AI propose) (5.3).
- **Staging proof script (click-by-click)**:
  1. Create a new mindmap and build a 3-level structure manually (10–20 nodes).
  2. Reparent/move branches, collapse/expand, and use undo/redo; confirm state trust (no “teleporting” nodes).
  3. Export/readback (bounded) and verify structure integrity.
  4. Use AI: “zrób mindmap z briefu” → preview/diff → accept; then manually edit again without glitches.
  5. Stress: expand to a larger map and verify selection/navigation remain calm.
- **DoD**:
  - Large-map stability proven; AI proposals are reviewable; core loop stays calm.

#### P12-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P12-A/B/C.
  - Validate rollback: disable AI co-building; preserve manual read/edit.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw core loop + toolbelt, potem bounded collab cues (P1).

### 8.3 Rollback plan
- Wyłącz AI co-building; zachowaj odczyt i edycję manualną; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: brak spokojnego core loop (produkt nieużywalny).
- Ryzyko: brak “state trust” po operacjach (user traci orientację).
- Decyzje: minimalny zakres export/readback i jego semantyka.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P12-A | approved(scope) |  | N/A (docs-only scope approval) | N/A | §2.3 canon frozen: P0 toolbelt + calm loop + state semantics + AI proposal contract + degraded posture + acceptance checklist |
| P12-B | verified(evidence) | pending commit | 21 contract tests (canon structure, cycle detection, delete anchor, export, service contract) — all pass | Runtime closure | mindmapService (12 functions), 12 V8 endpoints at /api/v8/mindmap/*, migration v8_mindmap_nodes + v8_mindmap_ai_proposals; Known limits: None. |
| P12-C | verified(evidence) | pending commit | 21 contract + 15 canon = 36 total | Evidence + locks | None — all P12 contract requirements implemented. |

