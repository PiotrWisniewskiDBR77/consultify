# 01 Czat - S1 Scope Map

Status: `in_progress`

Module: `01 Czat`

Owner: CTO / Delivery Owner

---

## Goal

Domknac core runtime Czatu jako wiarygodny entrypoint pracy usera.

## Non-goals

- Rozszerzenia funkcji premium poza core closeout.
- Nowa architektura chat runtime.
- Nieskończone polish bez wpływu na acceptance gates.

---

## Scope in

### Functional scope

- Core send/response flow.
- Core conversation persistence and read-back.
- Basic handoff continuity (chat -> downstream action intent).
- Honest error/degraded states.

### Files to update (logical groups)

- Chat surface components (UI runtime, feedback states).
- Chat API integration layer.
- Chat persistence/readback service paths.
- Tests for chat core smoke and persistence.
- Module gate docs/evidence.

### Routes/APIs in scope

- Chat conversation list/detail read.
- Chat send action.
- Chat persistence read-back endpoints.
- Bounded handoff/proposal read/write path used by active flow.

### UI surfaces in scope

- Chat primary surface.
- Composer and message stream.
- Core feedback states (loading/success/error/degraded).

---

## Scope out

- Deep feature expansion unrelated to closeout.
- Experimental multimodal extensions not needed for core acceptance.
- New external integrations outside current active runtime.

---

## Untouched

- Unrelated module domains (`Finance`, `Partner`, `MCP` modules).
- Non-chat advanced experiments not required by closeout.

