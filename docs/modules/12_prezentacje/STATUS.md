---
module_id: MODULE_PRESENTATIONS
doc_kind: STATUS
version: 1.1
owner: user
status: canonical
last_updated: 2026-06-03
---

# Status — Prezentacje / Generator Lane

## Shipping Status (As-Is)

- Runtime class: `mounted + self-serve + duplicate_boundary_resolved`
- `/prezentacje` mounts the real `PrezentacjeView` generator lane directly — the
  contact-required `KimiModuleGate` was removed (audit gap #1). No "coming soon"
  in the paid path; the sidebar badge `soon` was dropped.
- DeckBuilder defaults to the unified `ExecutiveModuleShell` (MELS) layout
  (audit gap #4); version history persists server-side (audit gap #3); the
  always-disconnected collaboration presence UI was stripped (audit gap #2,
  single-user-first — multiplayer is a fast-follow).
- Current ownership decision: Standalone generator lane is `/prezentacje`.
  Canonical `/presentations` ownership belongs to `09_outputs`.

## Current Risks

- Real-time multiplayer collaboration is intentionally not shipped (no
  `/ws/presentations` handler). Re-introducing presence requires a server WS
  handler before re-enabling any presence UI.
- Documentation must track mounted runtime, not planned/RAW target-state behavior.

## Next Contract Work (without changing scope)

- Keep CODEMAP/BEHAVIOR/UI_UX/TESTS aligned with mounted route/component truth.
- Fast-follow: real-time collaboration (WS handler + presence UI re-introduction).

## Function Coverage Status

- Required functions documented: `2/2`.
- Covered: `PR_GEN_RUNTIME_TARGET`, `PR_OUTPUTS_OWNERSHIP_BOUNDARY`.
- Retired: `PR_GEN_PLACEHOLDER` (the `V4ComingSoonView` placeholder is no longer
  mounted on `/prezentacje`).
