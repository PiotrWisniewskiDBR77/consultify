# 534 - V8.1 Calendar must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Kalendarz` must-have closure for the current wave

## Scope truth

- `Kalendarz` is an internal-first My Work surface, not a full Google/Outlook parity product.
- The runtime already had three real pillars:
  - unified calendar read
  - governed day-load / conflict preview
  - create flow that honestly writes a task-backed calendar item
- The main remaining risks were not missing "big features", but trust gaps:
  - external sources could appear as normal filters even when integrations were not actually active
  - unified-read failures could collapse into a silent empty-looking calendar without a clear error state

## Problem before closeout

- `src/components/MyWork/Calendar/CalendarSidebar.tsx` always rendered `Google Calendar` and `Outlook` as normal source filters.
- This could overpromise connected external calendar availability even when no active provider was configured in `Integracja`.
- `src/components/MyWork/Calendar/CalendarView.tsx` already received `error` from `useCalendarData()`, but did not render it, creating a silent-failure pattern.
- The create flow itself was already honest in `CalendarCreateEventModal.tsx`, but the outer shell still needed to align with that same honesty standard.

## What landed

### 1. External calendar sources are now governed by real integration truth

- `src/components/MyWork/Calendar/CalendarView.tsx`
  - now fetches integration inventory once and derives whether `google` / `outlook` are truly available
  - only integrations in a ready state (`active` / `connected`, with no pending onboarding state) are treated as available calendar sources

- `src/components/MyWork/Calendar/CalendarSidebar.tsx`
  - now receives `externalSourceAvailability`
  - disables `Google Calendar` and `Outlook` filters when they are not actually available
  - shows clear helper copy:
    - `Connect in Integrations`
    - plus an explanatory note that these sources appear only after an active connection exists in `Integrations`

Result:

- `Kalendarz` no longer visually implies external calendar parity by default
- it now inherits truth from the integration control plane instead of pretending those feeds are just another always-on local source

### 2. Unified-read failures now have an explicit, retryable error state

- `src/components/MyWork/Calendar/CalendarView.tsx`
  - now renders an inline error state when `useCalendarData()` fails
  - uses `EmptyStateInline` with:
    - a clear unavailable message
    - a hint that an empty-looking screen does not mean the day is truly empty
    - a `Retry` action wired to `refetch`

Result:

- the calendar no longer fails into silence
- users get a visible boundary between:
  - no events loaded yet
  - and the view being temporarily unavailable

### 3. Existing bounded runtime behavior remains honest

- `src/components/MyWork/Calendar/CalendarCreateEventModal.tsx`
  - still explicitly states that current create flow produces a personal task
  - still says decisions and initiatives from the calendar are a later phase
  - still keeps governed day-load preview as advisory, not blocking

This means the shell is now aligned with the already-honest create modal instead of weakening it.

## Automated verification

Passed:

- `npx vitest run tests/components/MyWork/CalendarView.error-state.test.tsx tests/components/MyWork/CalendarSidebar.availability.test.tsx tests/components/MyWork/CalendarCreateEventModal.test.tsx tests/unit/services/api-my-work-calendar-fallback.test.ts`

Coverage includes:

- external Google / Outlook sources stay disabled and explicitly point the user to `Integrations` until active
- an active external integration re-enables the source filter
- the calendar view now shows a visible retryable error state instead of silently looking empty
- the create modal still:
  - loads governed conflict preview
  - degrades honestly on preview unavailability
  - creates a task-backed calendar item
- API fallback tests still protect the V8/legacy boundary for unified read and conflicts

## Manual acceptance checklist

- Open `My Work > Calendar` with no active Google/Outlook connection and confirm those source filters are visibly unavailable and point to `Integrations`.
- Activate a real Google or Outlook calendar integration and confirm the corresponding source becomes available in the calendar sidebar.
- Temporarily simulate a calendar read failure and confirm the user sees a visible retryable error state, not a blank-looking calendar.
- Open the create modal and confirm it still clearly states that current create flow produces a task, not a generic external event.
- Confirm day-load preview remains advisory and that task creation still works when preview is temporarily unavailable.
- Confirm clicking task / decision / initiative events still routes into the corresponding My Work detail surface.

## Residual risk

- `Kalendarz` is still intentionally internal-first; this closeout does not claim:
  - full Google/Outlook authoring parity
  - broad external meeting management parity
  - full connected-runtime orchestration beyond what `Integracja` actually exposes
- External event click semantics remain limited compared with internal task / decision / initiative navigation.
- A future phase may still productize deeper connected-calendar workflows, but that is outside this must-have closeout.

## Status

- `Kalendarz` now behaves like an honest internal calendar surface:
  - real reads
  - honest create semantics
  - governed external-source availability
  - visible retryable failure state
- Current closure status at time of write: code landed, focused tests green, pre-ratification snapshot.
- Current authority: final Wave 1 module ratification is recorded in `548-v81-wave1-final-module-gate-ratification.md`.
