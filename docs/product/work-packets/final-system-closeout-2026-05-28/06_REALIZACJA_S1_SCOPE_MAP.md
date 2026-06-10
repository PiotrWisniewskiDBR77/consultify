# 06 Realizacja - S1 Scope Map

Status: `in_progress`

Module: `06 Realizacja`

Owner: CTO / Delivery Owner

---

## Goal

Domknac core runtime Realizacji jako wiarygodny execution control surface.

## Non-goals

- Duze rozszerzenia execution package poza closeout.
- Re-architecture control tower poza krytyczna stabilizacja.
- Rozszerzenia UI niezwiązane z acceptance.

---

## Scope in

### Functional scope

- Core execution dashboard load.
- Core risk/delay/capacity read paths for operator.
- Core execution action continuity used in active workflow.
- Honest degraded/error behavior.

### Files to update (logical groups)

- Execution surface components in active lane.
- Execution control API integration layer.
- Core execution read/write continuity services.
- Tests for execution smoke and refresh continuity.
- Module gate docs/evidence.

### Routes/APIs in scope

- Execution control core read endpoints.
- Bounded execution action endpoint needed for active flow.
- Read-back endpoints required by acceptance.

### UI surfaces in scope

- Realizacja primary surface.
- Core control tower panels in active lane.
- Feedback and state banners for operator actions.

---

## Scope out

- Broad operator workflow expansion not required by closeout.
- Non-core execution package redesign.
- Advanced modules outside active lane.

---

## Untouched

- Unrelated domains outside execution dependency chain.
- Deferred package breadth beyond current closeout scope.

