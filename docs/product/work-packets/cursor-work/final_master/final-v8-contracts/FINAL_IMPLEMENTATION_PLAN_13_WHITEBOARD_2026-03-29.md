# Final Implementation Contract — Whiteboard (Position 13/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: approved(scope) (P13-A canon frozen; docs-only)

## 1. Executive summary
- **Intent**: Jak Mindmap: przegląd narzędzi/przycisków + naprawa procesu budowania; AI współbuduje.
- **Primary users**: konsultanci/PMO (collaboration canvas).
- **Success metric**: komplet narzędzi + przewidywalny workflow budowania; AI wspiera realne operacje na boardzie.

## 2. Scope
### 2.1 In-scope
- Whiteboard toolset completeness + UX.
- AI co-building (proposal-based).

### 2.2 Out-of-scope / non-goals
- Realtime-collab parity z pełnymi canvas tools, jeśli nie jest zadeklarowane w planie.

### 2.3 P13-A canon (board canon + toolbelt baseline) (DOCS ONLY)

This section is the **scope-approval canon** for Whiteboard. It freezes the P0 toolbelt, facilitation baseline, export/readback assumptions, collaboration boundary, and AI co-building governance used by later packets.

#### 2.3.1 Minimal toolbelt (P0)
The board must provide, at minimum:
- **Select**: single-select + multi-select (shift / marquee) with clear selection bounds; selection must not “teleport” after operations.
- **Pan / zoom / fit**: pan canvas, zoom in/out, and fit-to-content (and/or fit-to-selection) without losing orientation.
- **Sticky**: create sticky notes, edit text, move, duplicate; stickies behave as first-class objects for grouping/alignment/export.
- **Shape**: create basic shapes (rectangle, ellipse, line/arrow) with resize/rotate bounded to predictable handles.
- **Text**: create standalone text objects; edit in place; text is selectable/movable like other objects.
- **Group / ungroup**: group selected objects; ungroup; group moves as a unit while preserving children positions.
- **Align / distribute (bounded)**: align (left/center/right/top/middle/bottom) and distribute (horizontal/vertical) **only within current selection**; no auto-layout or global rearrangement.
- **Undo / redo**: undo/redo all above actions (incl. group/ungroup + align/distribute + text edits) with stable history semantics.
- **Export**: export a readback artifact from the current canonical board state (see 2.3.3).

#### 2.3.2 Facilitation baseline cues (bounded)
Whiteboard is a facilitation surface, not just drawing. The product must expose a minimal, explicit workshop journey:

- **Start → Organize → Converge → Handoff**

Bounded scope for cues (P0):
- **Start**: prompt to capture raw inputs (stickies/shapes/text) and name the board/session.
- **Organize**: prompt/affordance to cluster/group and align/distribute without losing content; “clean up” actions are bounded to selection.
- **Converge**: prompt/affordance to mark a small set of outcomes (e.g. “top 3”) without introducing a full voting system.
- **Handoff**: prompt/affordance to export/readback and attach/share the result with a downstream artifact (bounded by declared integrations in later packets).

Non-goal (P13-A): building a full workshop engine (timers, voting, roles, templates marketplace).

#### 2.3.3 Export + readback assumptions (freeze)
Export is for **handoff** and **audit-friendly readback**. For P0 we freeze expectations explicitly:

- **Exported (must)**:
  - **Visual export** of the board (at least PNG). Scope may later include SVG/PDF, but P0 requires one predictable visual output.
  - **Metadata**: board title, export timestamp, and a stable identifier (board/artifact id) embedded in filename or export payload.
- **Preserved** (in the exported artifact):
  - relative layout/positions at the time of export
  - visible text content (with font fallback allowed)
  - grouping as it appears visually (even if not editable)
- **Lost** (if export is visual-only):
  - object editability (no re-select/move/resize semantics)
  - semantic object types (sticky vs shape vs text) beyond pixels
  - undo/redo history
- **Explicit constraint**:
  - Export must be derived from the **single canonical board truth** (see 2.3.6). No “export-only” parallel renderer state that becomes a second truth.

#### 2.3.4 Collaboration boundary (freeze)
P13-B is allowed to ship a high-quality **single-operator** whiteboard without real-time collaboration.

- **Explicit non-goal (P0 / P13-B baseline)**: real-time collaboration features are not required:
  - presence indicators
  - live cursors
  - comments/chat on-canvas
  - concurrent edit conflict resolution

If collaboration is later declared, it must be frozen in a separate scope packet (e.g. `P13-X`) with explicit presence/cursor/comment semantics and degraded modes.

#### 2.3.5 AI co-building contract (NO silent apply)
AI may help build the board, but only as **proposals**:

- **Generate layout**: AI proposes a set of board operations (create/move/group/align/distribute objects; add stickies/text/shapes) within the frozen toolbelt.
- **Preview**: user sees a non-destructive preview (overlay or staged diff) of the proposed changes.
- **Apply / reject**: user explicitly applies or rejects the proposal.
- **Audit event (required)**: every proposal must write an auditable event:
  - proposal created (with summarized intent + bounded diff)
  - proposal applied OR rejected

Rule: **NO silent apply** (AI cannot modify the canonical board state without an explicit user “Apply”).

#### 2.3.6 Anti-duplicate gate (one board canon)
There must be **one** canonical board truth/store:

- No parallel “AI board state”, “export board state”, or “preview board state” persisted as a second truth.
- Previews are ephemeral and must be derived from the canonical state + proposed diff.
- Any persistence must extend existing artifact governance (provenance/audit), not create a new standalone store.

#### 2.3.7 Degraded / error posture (P0)
The board must fail safely and predictably. Minimum scenarios to support (8+):

1. **Board load fails**: show error state + retry; do not create duplicate boards silently.
2. **Offline / network loss**: switch to read-only or local-only mode; clearly label state; prevent destructive actions if not safely persisted.
3. **Permission/locked state**: tools become read-only; export still allowed; AI apply disabled.
4. **Very large board**: degrade gracefully (e.g. disable snapping/alignment guides first) rather than freezing.
5. **Undo/redo unavailable or stack overflow**: communicate limits; keep manual edits possible; never corrupt visible state.
6. **Export fails**: show actionable error; allow retry; preserve user work; do not “export blank” silently.
7. **Font/asset missing**: fallback rendering; preserve text content; warn about visual differences in export.
8. **AI unavailable / timeout**: AI disabled with clear messaging; manual toolbelt remains fully usable.
9. **Apply proposal fails mid-flight**: roll back to pre-apply canonical state; record audit event as failed.
10. **Corrupted board document**: open in safe mode (readback/export only) and provide recovery path; never overwrite the last good state without explicit consent.

#### 2.3.8 Acceptance checklist (P13-A scope approval)
- [ ] §2.3 exists and freezes the **minimal toolbelt (P0)** exactly (select; pan/zoom/fit; sticky; shape; text; group/ungroup; align/distribute bounded; undo/redo; export).
- [ ] Facilitation cues are explicitly frozen as **Start → Organize → Converge → Handoff** (bounded; non-goals stated).
- [ ] Export/readback assumptions are frozen (what is exported, what is preserved, what is lost).
- [ ] Collaboration boundary is explicit (presence/cursors/comments are non-goals unless later packet freezes them).
- [ ] AI co-building contract is frozen (generate → preview → apply/reject + audit; **no silent apply**).
- [ ] Anti-duplicate gate is explicit (one canon; no parallel truth/store).
- [ ] Degraded/error posture includes **8+** concrete scenarios with expected behavior.
- [ ] Contract header status is `approved(scope)` for P13-A (docs-only).
- [ ] `EXECUTION_INDEX.md` row #13 is updated to `approved(scope)`.
- [ ] Evidence ledger row `P13-A` is filled at least with status + notes (commit link added on closeout).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WHITEBOARD_2026-03-29.md`
- Readiness: `docs/product/WHITEBOARD_V8_READINESS_AUDIT.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Whiteboard` + `Softs/0 Miro` jako benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_WHITEBOARD_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **tldraw (toolbelt + navigation/camera + collaboration-ready posture)**:
  - `Softs/0 Whiteboard/Tldraw.zip :: Tldraw/tldraw.dev/features/out-of-the-box-whiteboard.html` (whiteboard toolset: camera controls, zoom/fit, snapping/alignment, mini map, focus mode; shapes + sticky notes + freehand; “collaboration-ready”).
  - `Softs/0 Whiteboard/Tldraw.zip :: Tldraw/tldraw.dev/docs/collaboration.html` (real-time collaboration support; sync library; cursors/presence).
  - `Softs/0 Whiteboard/Tldraw.zip :: Tldraw/tldraw.dev/docs/shapes.html` (shape model: arrows/images/text; undo/redo/history; locked shapes; export; selection).
- **Excalidraw (export + collaboration trigger posture)**:
  - `Softs/0 Miro/Excalidraw.zip :: Excalidraw/docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export.html` (exportToBlob / exportToSvg; padding/format/quality).
  - `Softs/0 Miro/Excalidraw.zip :: Excalidraw/docs.excalidraw.com/docs/@excalidraw/excalidraw/api/children-components/live-collaboration-trigger.html` (LiveCollaborationTrigger: UI affordance dla live collab).
- **Miro family (adjacent workshop expectations)**:
  - `Softs/0 Miro/Miiro doc.zip` (Miro dev docs corpus; używać jako referencję narzędzi/canvas primitives, bez deklaracji pełnej parity).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “facilitation-ready workshop surface + kompletny core toolbelt”, nie “pełna Miro/tldraw platform parity”.**

- **Professional canvas toolbelt (tldraw)**:
  - Camera/navigation: zoom in/out + fit-to-screen, auto-focus on selection, mini map/overview dla dużych boardów.
  - Smart snapping/alignment guides, selection/multi-select, drag-and-drop bez “glitchy” stanów.
  - Shapes + sticky notes + freehand/highlighter jako minimalny zestaw warsztatowy.
- **Collaboration cues (tldraw + Excalidraw trigger posture)**:
  - Obecność/cursors + podstawowe zasady konfliktów (bounded) + jasne stany “collab on/off/degraded”.
- **Export/readback posture (Excalidraw export)**:
  - Przewidywalny eksport podstawowych widoków (SVG/PNG/PDF jeśli w deklarowanym zakresie) z kontrolą padding/quality.
- **Workshop facilitation grammar (plan Wave1)**:
  - “Workshop journey” ma być intencjonalny: user wie co robić dalej (cues, next action), a nie tylko rysuje.
- **AI co-building as proposals**:
  - AI wykonuje deklarowane operacje (np. dodaj sticky cluster, uporządkuj, narysuj prosty układ) jako propozycje → review → apply.
  - Brak silent edits; audyt działań AI.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_WHITEBOARD_2026-03-29.md` + readiness `WHITEBOARD_V8_READINESS_AUDIT.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Facilitation depth | workshop flow productized | “facilitation maturity below standards” | Wzmocnić facilitation cues + workshop flow bez rozbudowy platformy | P0 |
| Collaboration confidence | deliberate, predictable | “collaboration depth partial” | Domknąć bounded collab states + przewidywalność akcji na boardzie | P1 |
| Core toolbelt completeness | no missing essentials | (implikowane przez “toolset gaps”) | Domknąć core toolbelt: navigation, selection, shapes/stickies, undo/redo, export | P0 |
| Workspace cohesion | shared grammar | “continuity with related tools medium” | Ujednolicić gramatykę z `Mind map` i `Proces flow` w deklarowanym zakresie | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Brakujące narzędzia/akcje są domknięte; AI potrafi wykonać deklarowane operacje jako propozycje.
- Core toolbelt jest “operator-safe”: undo/redo, selection, navigation, export działają przewidywalnie.
- Workshop flow ma jawne cues (co dalej) i nie wymaga domysłów.

### 5.2 Tests
- Integracyjne: create shapes/stickies → group/align → move/zoom/fit → undo/redo → export.
- Regression: collaboration (jeśli w deklarowanym zakresie) → presence/cursors + brak rozjazdów stanu.
- Contract tests: AI proposal → preview → apply/reject → audit eventy.

### 5.3 Staging proof checklist
- Demo: 1 scenariusz warsztatowy (facilitation) od startu do “handoff” (np. do `Notatki` lub `Inicjatywy` jeśli zadeklarowane).
- Demo: AI co-building na boardzie: wygeneruj układ → review → apply.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (readiness/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P13-A — Board canon + toolbelt baseline (scope approval)
- **Goal**: core board z facilitation cues, bez “Miro/Figma whiteboard parity”.
- **Inputs required**: minimalny toolbelt + facilitation baseline + export/readback assumptions.
- **Acceptance**: scope zatwierdzony; non-goals jawne; bounded collab (jeśli w zakresie) spisany.
- **Evidence**: scope approval + linkowane benchmarki.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze minimal toolbelt (selection/navigation/undo/redo/export) and facilitation baseline cues.
  - Freeze export/readback assumptions and (if in scope) collab/presence boundaries.
  - Freeze AI co-building proposal contract (preview/apply/reject) (bounded).
- **DoD**:
  - Approved(scope): operator-safe toolbelt and facilitation flow are explicit; non-goals clear.

#### P13-B — Core toolbelt + facilitation flow closure
- **Goal**: selection/navigation/undo/redo/export + warsztatowy flow P0.
- **Acceptance**: board jest operator-safe; scenariusz warsztatowy kończy się handoff (bounded).
- **Evidence**: integracyjne testy + staging demo (warsztat + AI co-building).
- **Tasks**:
  - Implement operator-safe toolbelt and 1 workshop scenario end-to-end (bounded).
  - Implement AI co-building flow with preview and audit events (bounded).
  - Add integration tests and run staging demos (5.3).
- **Staging proof script (click-by-click)**:
  1. Create a new board; add shapes/stickies; group/align; zoom/fit; undo/redo to verify operator-safe toolbelt.
  2. Run the workshop scenario: facilitate from “start” to “handoff” (bounded target, e.g., Notes/Initiatives).
  3. Use AI co-building: generate a layout → preview → apply; verify audit event exists (bounded).
  4. Export/readback (bounded) and confirm output is usable for handoff.
- **DoD**:
  - Workshop scenario completes with bounded handoff; toolbelt is reliable; demos recorded.

#### P13-C — Verification + rollout
- **Goal**: regresje, telemetry, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P13-A/B/C.
  - Validate rollback: disable AI/collab; preserve manual board read/edit.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw toolbelt+export, potem collab hardening (P1).

### 8.3 Rollback plan
- Wyłącz AI co-building/collab; zachowaj read/edit manual; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: brak “operator-safe” toolbelt (undo/redo/export).
- Ryzyko: facilitation bez jasnego “co dalej” (brak wartości).
- Decyzje: minimalny zakres collab/presence (albo jawny non-goal).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P13-A | approved(scope) |  |  |  | §2.3 canon frozen (toolbelt, facilitation cues, export/readback, collab boundary, AI proposals + audit, anti-duplicate, degraded posture) |
| P13-B |  |  |  |  |  |
| P13-C |  |  |  |  |  |

