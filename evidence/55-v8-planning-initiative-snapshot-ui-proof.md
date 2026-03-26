# V8 Planning Initiative Snapshot UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `89553981-ab90-41ae-aaa3-1313949862de`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Initiatives` via `/initiatives`

## What was verified

Runtime continuity proof:
- the latest staging deployment serves the updated `InitiativesHub` bundle from the live `Initiatives` surface
- selecting an initiative from the table-preview surface now triggers the governed V8 initiative snapshot read
- observed live network requests:
  - `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/snapshot` -> `200`
  - `GET /api/v8/planning/initiatives/7a06c7e4-17fc-4239-a670-dde84efe3e4e/snapshot` -> `200`

UI continuity proof:
- a clean staging browser tab with no persisted document session shows the canonical `Initiatives` command row on `/initiatives`
- the command row visibly renders the live PM counters/chips on staging:
  - `ALL 30`
  - `In Review 9`
  - `Promoted 4`
  - `Planning 6`
  - `Approved 6`
  - `Scheduled 5`
- the same clean surface also remains on the governed planning continuity path:
  - `GET /api/v8/planning/pending-decisions` -> `200`

Observed continuity note:
- a reused staging browser tab with persisted `openDocuments` state swaps the command row for `DynamicTabs`, which hides the V8 chips even though the initiative snapshot request still fires successfully from the table-preview selection flow
- this is a session-state/layout behavior note, not a regression of the governed snapshot bridge itself

## Scope note

This proves a broader live user-facing V8 Planning slice on staging, but not full PM migration:
- the governed V8 slice now covers both org-level pending decision chains and initiative-level planning snapshots from the live `Initiatives` hub
- decomposition editing, change management, lifecycle mutations, and broader PM workflows still use legacy endpoints
- this capture proves staging UI/runtime continuity for the bounded planning snapshot packet, not full PM workflow parity

Conclusion:
- the live `Initiatives` surface now has browser-proven V8 continuity for both command-row planning counters and initiative snapshot reads
- remaining PM gaps are broader list/detail/workflow/write migrations, not absence of a staged V8 planning snapshot UI path
