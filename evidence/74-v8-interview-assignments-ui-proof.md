# V8 Interview Assignments UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment carrying the V8 assignment read bridge: `87fde200-ead0-4e3d-9f5e-1f0469a087ac`
- follow-up deployment fixing the Postgres-specific `my assignments` query path: `ce09a267-f8c6-4661-ba91-27028b5ab592`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Interview` via `/interview`

## What was verified

Runtime continuity proof:
- a fresh live load of `/interview` on staging now hydrates the manager/operator assignment lane through the governed V8 interview namespace:
  - `GET /api/v8/interview/sessions/accepted` -> `200`
  - `GET /api/v8/interview/assignments/my` -> `200`
  - `GET /api/v8/interview/assignments/managed` -> `200`
  - `GET /api/v8/interview/assignments/overdue` -> `200`
- the successful post-fix runtime logs also show the same V8 assignment requests hitting the active staging runtime:
  - `GET /api/v8/interview/assignments/my`
  - `GET /api/v8/interview/assignments/managed`
  - `GET /api/v8/interview/assignments/overdue`
- earlier in the same packet, `GET /api/v8/interview/assignments/my` failed on Postgres with:
  - `for SELECT DISTINCT, ORDER BY expressions must appear in select list`
- that blocker was closed by replacing the `LEFT JOIN ... DISTINCT` membership pattern with an `EXISTS` predicate in `InterviewAssignmentService.getMyAssignments()`, preserving the same business semantics while removing the Postgres-specific failure mode

UI continuity proof:
- the live `Interview` hub still renders the canonical operator tabs on the same successful V8-backed load:
  - `Sessions`
  - `Assigned`
  - `Templates`
  - `Insights`
- the visible assignment counters remain present on the same surface while the reads now come from the governed V8 lane:
  - `ALL 3`
  - `My inbox 3`
  - `To approve 1`
  - `Overdue 7`
- the visible assignment rows remain populated from the same live surface after the V8 assignment cutover:
  - `Quick Assessment`
  - `Data & Metrics`
  - `Digital Maturity Discovery`

## Scope note

This materially broadens the live V8 Interview slice, but it does not fully close the Interview area:
- the governed V8 slice now covers accepted sessions plus the operator-facing assignment read lane (`my`, `managed`, `overdue`) from the live Interview workspace
- approvals, send-back flows, start flows, reminders, templates, insights, transcripts, and broader workflow writes still rely on legacy interview endpoints
- this proof closes the read-side assignment continuity gap, not full workflow parity

Conclusion:
- the live `Interview` surface now has browser-proven V8 continuity for accepted sessions and the core assignment read lane
- the remaining Interview gap is broader workflow/write continuity, not absence of a staged governed manager/operator assignment path
