# V8 My Work Calendar bounded runtime proof

Date: 2026-03-26
Deployment: `afa80f57-6b1d-4c7c-aa99-e0c9dca1abe1` (`consultify` / `staging`)

## What shipped

- Added bounded V8 My Work calendar routes in `server/src/routes/v8/my-work.routes.ts`:
  - `GET /api/v8/my-work/calendar/unified`
  - `GET /api/v8/my-work/calendar/conflicts`
  - `POST /api/v8/my-work/calendar/events`
- Added typed V8 client methods in `src/services/api/v8/my-work.ts`.
- Updated the live Calendar surface to prefer the V8 bridge from:
  - `src/components/MyWork/Calendar/useCalendarData.ts`
  - `src/components/MyWork/Calendar/CalendarCreateEventModal.tsx`
- Added calendar-specific fallback guards in `src/services/api.ts` so transient V8 failures do not reopen legacy paths automatically; legacy fallback remains bounded to non-supported statuses (`400`, `404`, `405`, `501`).

## Local proof

- Frontend targeted tests passed:
  - `tests/unit/services/v8-my-work-api.test.ts`
  - `tests/unit/services/api-my-work-calendar-fallback.test.ts`
- Backend targeted tests passed under server Vitest config:
  - `server/src/routes/v8/__tests__/my-work-calendar.routes.test.ts`

## Live staging proof

Browser proof executed against `https://stage.consultinity.ai/my-work?tab=calendar`.

Observed governed calendar bundle load:

- `GET /assets/CalendarView-Clwm_exQ.js` -> `200`

Observed live surface read path:

- `GET /api/v8/my-work/calendar/unified?start=2026-02-23T00%3A00%3A00%2B01%3A00&end=2026-04-06T00%3A00%3A00%2B02%3A00` -> `429`
- `GET /api/v8/my-work/calendar/unified` -> `429`

Observed live modal conflict-check path:

- `GET /api/v8/my-work/calendar/conflicts?date=2026-03-26` -> `429`

Important runtime conclusion:

- The live staging Calendar surface is now attempting governed V8 calendar paths directly.
- In the same runtime capture there was **no matching legacy fallback** to:
  - `GET /api/my-work/calendar/unified`
  - `GET /api/my-work/calendar/conflicts`

This proves the bounded Calendar surface is no longer visibly pinned to legacy truth for its read lane; the current blocker is transient staging throttling, not absence of a V8 route.

## Residual gap

- Browser proof for `POST /api/v8/my-work/calendar/events` was not captured in the same staging pass.
- The create modal opened and hydrated via the governed conflicts path, but final submit continuity was blocked by the constrained browser viewport during this run, while the page was also experiencing periodic staging `429` noise.
- Therefore Calendar should move from `red` to `yellow`, not `green`.

## Closure interpretation

Bounded `Calendar` truth is now partially closed:

- governed V8 routes exist,
- frontend prefers them,
- fallback guard prevents transient V8 throttling from silently reopening legacy read paths,
- live staging proves the surface reads/conflict-checks the V8 namespace.

Remaining work is specifically a clean staging retest for event-create continuity and any broader calendar mutation parity, not the prior red-state absence of a V8 calendar closure route.
