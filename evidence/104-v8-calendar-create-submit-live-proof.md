# V8 Calendar Create Submit Live Proof

Date: 2026-03-26
Environment: `staging`
Surface: `My Work > Calendar`
User session: `piotr.wisniewski@dbr77.com`

## What was verified

1. Calendar create modal opens successfully on staging.
2. Conflict check executes for the selected day:
   - `GET /api/v8/my-work/calendar/conflicts?date=2026-03-26`
   - status `503`
3. The governed warning is shown in the UI:
   - `Day-load preview is temporarily unavailable, but you can still create the task.`
4. Create path still succeeds despite the conflict-check degradation:
   - `POST /api/v8/my-work/calendar/events`
   - status `201`
5. The newly created item appears back in the calendar surface:
   - `Calendar proof 1774531262`

## Operational conclusion

`Calendar` is now staging-proven end-to-end for the bounded V8 slice:

- degraded conflict-check state is visible and governed,
- create-submit still works,
- and the created calendar item rehydrates into the live calendar view.
