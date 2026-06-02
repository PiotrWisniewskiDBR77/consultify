# 02 Moja Praca - S1 Scope Map

Status: `in_progress`

Module: `02 Moja Praca`

Owner: CTO / Delivery Owner

---

## Goal

Domknac core runtime Moja Praca jako stabilny cockpit codziennej pracy.

## Non-goals

- Szerokie rozszerzenia funkcjonalne poza closeout.
- Re-architecture home shell.
- Niskopriorytetowe polish bez wpływu na gates.

---

## Scope in

### Functional scope

- Home/cockpit load and continuity.
- Core actionable paths (linked tasks/inbox/calendar navigation).
- Save/read-back for in-scope stateful actions.
- Honest error/degraded states.

### Files to update (logical groups)

- My Work surface components.
- My Work API integration/service layer.
- Persistence/readback paths for active flows.
- Tests for core smoke and refresh resistance.
- Module gate docs/evidence.

### Routes/APIs in scope

- My Work summary/read endpoints.
- Key linked flow endpoints used by active cockpit actions.
- Bounded write/readback paths required by acceptance.

### UI surfaces in scope

- My Work home shell.
- Core operational cards/sections in active lane.
- Feedback states for actions and data loading.

---

## Scope out

- Broad redesign of shell or navigation model.
- New cross-module feature expansion outside closeout.
- Non-critical experimental cards.

---

## Untouched

- Unrelated module domains not required by My Work closeout.
- Non-core modules outside queue and dependencies.

