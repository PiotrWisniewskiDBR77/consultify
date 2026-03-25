# V8 Planning Command Row UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `932634d9-458a-4dec-a6b3-018157b5258a`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Initiatives` via `/initiatives`

## What was verified

UI continuity proof:
- the live `Initiatives` module loads on staging in the authenticated browser session after the new deployment
- opening `/initiatives` loads the active Portfolio surface used by the PM workspace
- the same live Initiatives surface now calls the governed V8 planning endpoint:
  - `GET /api/v8/planning/pending-decisions` -> `200`

Observed continuity note:
- the page still hydrates broader legacy PM reads in parallel, including:
  - `GET /api/initiatives/portfolio?projectId=project-dbr77-demo-all-modules&statuses=REVIEW,PROMOTED,PLANNING,APPROVED,SCHEDULED` -> `200`
  - `GET /api/initiatives/portfolio?projectId=project-dbr77-demo-all-modules` -> `200`
  - `GET /api/users` -> `200`

## Scope note

This proves a real user-facing V8 Planning read slice on staging, but not full PM migration:
- the governed V8 slice currently covers org-level pending decision chains consumed by the live Initiatives hub command row
- initiative detail snapshots, decomposition editing, change management, lifecycle mutations, and broader PM workflows still use legacy endpoints
- this capture proves planning continuity on the live Initiatives surface, not full PM workflow parity

Conclusion:
- Initiatives / PM no longer lacks dedicated staging UI proof entirely
- the live Initiatives surface now has browser-proven V8 continuity for the governed pending-decision planning read
- remaining gap is broader PM list/detail/workflow/write continuity, not absence of any live V8 Planning UI path
