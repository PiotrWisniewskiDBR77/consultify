# 05 Inicjatywy - S1 Scope Map

Status: `in_progress`

Module: `05 Inicjatywy`

Owner: CTO / Delivery Owner

---

## Goal

Domknac core runtime Inicjatyw jako stabilny silnik planowania i governance.

## Non-goals

- Rozszerzanie zakresu o nowe duze pakiety funkcji.
- Refaktoryzacja architektury poza closeout need.
- Szeroki redesign UI poza krytycznymi poprawkami.

---

## Scope in

### Functional scope

- Core initiative read/create/update flow.
- Core planning read flows required by operators.
- Governance/decision visibility and continuity.
- Honest failure/degraded behavior.

### Files to update (logical groups)

- Initiative surface components (core tabs and runtime strip).
- Planning API integration layer.
- Initiative read/write continuity services.
- Tests for core planning/governance smoke.
- Module gate docs/evidence.

### Routes/APIs in scope

- Initiative list/detail bounded read paths.
- Core initiative write path used in active workflow.
- Planning/governance read paths required by closeout.

### UI surfaces in scope

- Inicjatywy module primary surface.
- Core planning and governance sections in active lane.
- Feedback states and read-back visibility.

---

## Scope out

- New large feature families not needed for closeout.
- Broad workflow expansion beyond core accepted lane.
- Full redesign of planning UX.

---

## Untouched

- Unrelated modules outside dependency chain.
- Non-core initiative adjuncts outside current closeout lane.

