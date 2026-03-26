## V8 Calendar create submit retest

- Date: `2026-03-26`
- Environment: staging (`https://stage.consultinity.ai`)
- Surface: `https://stage.consultinity.ai/my-work?tab=calendar`

## What was rechecked

This retest targeted the remaining bounded `Calendar` gap after `evidence/98-v8-calendar-bounded-runtime-proof.md`:

- confirm the live `Calendar` surface still opens the governed create flow,
- push the browser farther into the `Add to calendar` modal,
- determine whether the remaining blocker is product/runtime or only the final clean submit proof.

## Live browser observations

- The authenticated `My Work -> Calendar` surface loaded on staging.
- The left-nav `Calendar` lane could be selected on the live surface.
- The live `Add event` CTA became available and opened the real `Add to calendar` modal.
- The modal rendered:
  - title input,
  - description input,
  - date input,
  - `Cancel`,
  - `Add`.
- The live form was populated with:
  - title: `Prepare review deck`
  - description: `Bounded V8 continuity check`
  - date: `2026-03-26`

## Network observations

Observed governed runtime requests in the same browser window:

- `GET /api/v8/my-work/calendar/unified` -> `200`
- `GET /api/v8/my-work/calendar/unified?...` -> `200`
- `GET /api/v8/my-work/calendar/conflicts?date=2026-03-26` -> `503`

Still no same-window legacy fallback was observed for:

- `GET /api/my-work/calendar/unified`
- `GET /api/my-work/calendar/conflicts`

No `POST /api/v8/my-work/calendar/events` request was captured in this retest.

## Why the final POST was not captured

- The modal reached a real submit-ready state on the live staging surface.
- The final `Add` button remained just below the effective browser automation viewport during this run, so the MCP browser could not cleanly deliver the click despite the button being rendered and visible in the accessibility tree.
- This is an automation/viewport limitation in the proof run, not evidence of a missing route or missing create UI.

## Decision value

This retest narrows the remaining `Calendar` blocker further:

- the live governed calendar route bundle is present,
- the live create modal is present,
- the form reaches a real submit-ready state on staging,
- governed read loading is now clean on staging,
- governed conflict loading is still the active path and is now failing with `503` rather than reopening legacy,
- no legacy fallback was observed in the same runtime window.

The remaining open item is now even narrower:

- one clean live capture of `POST /api/v8/my-work/calendar/events`,
- or confirmation that the current residual blocker is the `conflicts` runtime failure rather than the create route itself.

This is no longer a question of whether the governed calendar read lane exists on staging; that is now positively proven in a clean runtime window.
