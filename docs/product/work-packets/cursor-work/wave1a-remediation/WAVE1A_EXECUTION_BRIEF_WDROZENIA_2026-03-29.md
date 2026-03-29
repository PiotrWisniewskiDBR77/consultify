# Wave 1A Execution Brief - Wdrożenia

Date: 2026-03-29
Packet: `Execution write continuity and runtime unification`
Scope owner: Wave 1A

## Goal

Make `Wdrożenia` credible not only as a read/control surface, but as an operator-facing execution system whose main writes and refreshes follow one believable runtime spine.

## Scope

In scope:

- broader write continuity on the active execution lane
- reduction of runtime fragmentation across execution-facing backend families
- stronger operator trust in read/write coherence

Out of scope:

- full PMO suite expansion
- broad executive or superadmin programs outside the active execution lane

## Code/test surface map

Core code surfaces:

- `src/components/Execution/ExecutionHub.tsx`
- `src/components/Execution/RiskSignalsPanel.tsx`
- `src/components/Execution/DelayDetectionPanel.tsx`
- `src/components/Execution/BudgetControlPanel.tsx`
- `src/components/Execution/ExecutionTimelineView.tsx`
- `src/components/Initiatives/InitiativeCompactPanel.tsx`

Core test surfaces:

- `tests/components/Execution/RiskSignalsPanel.controlled.test.tsx`
- `tests/components/Execution/DelayDetectionPanel.controlled.test.tsx`
- `tests/components/Execution/MitigationPanel.test.tsx`
- `tests/unit/services/initiativeWriteTruth.test.ts`
- `tests/unit/services/v8-planning-api.test.ts`

Runtime/evidence anchors:

- `docs/product/work-packets/evidence/528-v81-execution-must-have-module-closeout-pass.md`
- `docs/product/EXECUTION_READINESS_AUDIT_V8.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md` row `Execution / delivery control`

## What we deliver

- write-side continuity that matches the already stronger read-side control tower
- fewer user-visible contradictions between summary, panel, timeline, and budget/control surfaces
- one clearer execution runtime story across the active lane

## What we consciously do not touch

- full multi-project PMO redesign
- unrelated admin/operator products
- broad results or finance redesign outside direct execution continuity

## Acceptance proof plan

1. prove read/write coherence across execution summary, detailed panels, and side-panel actions
2. prove refreshed truth after write actions instead of local-only UI mutation
3. prove the active execution lane no longer depends on fragmented backend-family assumptions for the repaired flows
4. verify the main operator write scenario remains credible after route/tab/deep-link refresh

## Risks

- high risk of solving refresh behavior without solving deeper family fragmentation
- dependency on initiatives and consequence modules for the wider operating spine
- risk of opening a hidden control-tower rewrite program
