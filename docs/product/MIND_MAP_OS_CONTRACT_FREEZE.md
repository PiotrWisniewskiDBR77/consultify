# Mind Map OS Contract Freeze

## Purpose

This document freezes the implementation contract for `Mind Map OS` inside `Idea Workspace`.
It translates the rollout plan into an executable product/runtime baseline without changing the plan file itself.

## Non-Negotiable Layout Rules

- Keep `Mind Map | Whiteboard | Process Flow | Table` as the only local work-system switcher.
- Keep `Tools | Context | AI Suggestions` as the only right-side workspace strip.
- Do not reintroduce secondary navigation into the shell topbar.
- Do not ship placeholder controls that look finished but do not complete a real workflow.

## Product Promise

`Mind Map OS` is not a generic infinite canvas clone.
It must beat `Miro` for structured reasoning by combining:

- node-native thinking workflows,
- artifact-linked evidence,
- trustworthy AI proposal review,
- subtree conversion with traceability,
- collaboration and audit visibility.

## Capability Classes

### Trusted

- Canvas system switching inside the workspace.
- Right-strip contract for `Tools | Context | AI Suggestions`.
- Save/reload of map graph.
- Basic node creation, selection, duplicate, delete, focus, promote/demote.
- AI expansion through `propose -> review -> apply`.
- Artifact link persistence on nodes.
- Conversion entry points for initiative/decision flows.

### Partial

- Node depth semantics beyond notes/status.
- Branch-native context actions and subtree workflows.
- Artifact preview/open flows from the node itself.
- Cross-tool transform traceability and mapping transparency.
- Collaboration overlays, comments, and history trust surface.

### Draft

- Advanced facilitator controls and enterprise collaboration polish.
- Rich export/import parity.
- Deeper multi-step AI governance with citations on every path.
- Full `Miro`-style breadth outside Consultify-native advantage areas.

## P0 Scope

- One clear branching workflow from root to meaningful subtree.
- Node detail model with `notes`, `context`, `goal`, `rationale`, `risk`, `semantic type`, `tags`, `evidence links`, `artifact links`, and AI history.
- Real node context menu for child/sibling/focus/fold/detach/connect/detail/comment/artifact/convert actions.
- Artifact attach/open/preview visibility from node and context panel.
- AI proposal review that records node-level history on apply.
- Cross-tool conversion metadata that preserves source traceability.
- Browser/runtime verification for the main map flow.

## P1 Scope

- Advanced layout/render modes.
- Richer presentation/export/import.
- Facilitator-grade collaboration polish.
- Additional analytics and benchmarking overlays.

## Runtime Status Labels

Use these labels consistently in code review and QA:

- `trusted`: user can complete the promised workflow end-to-end.
- `partial`: workflow exists, but an important step is still weak or indirect.
- `draft`: UI or code path exists, but should not be treated as production-ready.

## Phase Mapping

- Stage 0: this contract freeze and baseline.
- Stage 1: extract map runtime boundaries and reuse hooks/helpers.
- Stage 2: recover visible hierarchy and node-native interaction quality.
- Stage 3: finish node depth semantics and persistence.
- Stage 4: make artifact-linked workflows first-class.
- Stage 5: make AI trustworthy and reviewable.
- Stage 6: preserve meaning across subtree conversions.
- Stage 7: harden collaboration, auditability, and QA.

## Exit Condition

The implementation is only considered complete when the runtime behaves as if this document is true, not when the UI merely exposes matching labels or buttons.
