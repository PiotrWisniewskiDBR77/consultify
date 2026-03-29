# Wave 1A Execution Brief - Kalendarz

Date: 2026-03-29
Packet: `Calendar external parity and workload depth`
Scope owner: Wave 1A

## Goal

Move `Kalendarz` from an honest internal-first surface to a believable connected planning surface with enough external depth and workload intelligence to stop breaking PMO-grade credibility.

## Scope

In scope:

- external source availability and connected depth
- workload and adjustment planning depth
- stronger event/action continuity on the active calendar lane

Out of scope:

- full Google/Outlook product parity
- broad meeting-management suite
- non-Wave 1 provider expansion

## Code/test surface map

Core code surfaces:

- `src/components/MyWork/Calendar/CalendarView.tsx`
- `src/components/MyWork/Calendar/CalendarSidebar.tsx`
- `src/components/MyWork/Calendar/CalendarCreateEventModal.tsx`

Core test surfaces:

- `tests/components/MyWork/CalendarView.error-state.test.tsx`
- `tests/components/MyWork/CalendarSidebar.availability.test.tsx`
- `tests/components/MyWork/CalendarCreateEventModal.test.tsx`
- `tests/unit/services/api-my-work-calendar-fallback.test.ts`

Runtime/evidence anchors:

- `docs/product/work-packets/evidence/534-v81-calendar-must-have-module-closeout-pass.md`
- `docs/product/MYWORK_CALENDAR_V8_READINESS_AUDIT.md`
- `docs/product/MYWORK_CALENDAR_V8_SSOT.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md` row `Calendar`

## What we deliver

- a more believable connected calendar lane, not just an honest shell
- stronger workload and adjustment semantics in the planning surface
- clearer action continuity between calendar state and downstream work objects
- no false implication of full parity where external depth is still absent

## What we consciously do not touch

- full external authoring parity across all provider behaviors
- broad meeting or communication product scope
- non-Wave 1 planning products outside the calendar lane

## Acceptance proof plan

1. prove real external-availability behavior against governed integration truth
2. prove workload/adjustment behaviors exist as first-class planning depth, not only as future-doc doctrine
3. prove event/action continuity beyond basic internal task-backed create semantics
4. verify degraded-state honesty still holds after increasing connected depth

## Risks

- dependency on `Integracja` reaching a believable lifecycle lane first
- risk of overpromising parity from partial external depth
- risk of UI polish masking missing planning semantics
