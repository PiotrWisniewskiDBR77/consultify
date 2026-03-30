# Final Implementation Contract — Whiteboard (Position 13/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

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

#### P13-B — Core toolbelt + facilitation flow closure
- **Goal**: selection/navigation/undo/redo/export + warsztatowy flow P0.
- **Acceptance**: board jest operator-safe; scenariusz warsztatowy kończy się handoff (bounded).
- **Evidence**: integracyjne testy + staging demo (warsztat + AI co-building).

#### P13-C — Verification + rollout
- **Goal**: regresje, telemetry, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).

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
| P13-A |  |  |  |  |  |
| P13-B |  |  |  |  |  |
| P13-C |  |  |  |  |  |

