---
module_id: MODULE_INTERVIEW
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Wywiad / Interview

## Status Tags (As-Is)

- `real`: `/interview` and `/discovery` routes mount `InterviewHub`.
- `real`: sidebar mapping to interview module exists via `AppView.DISCOVERY_CONSULTANT`.
- `duplicate`: interview surface is reachable via multiple aliases (`/interview`, `/discovery`, `/project-intelligence`) pointing to same hub runtime.
- `partial`: strong API contract coverage (`v8/interview.ts`) but no module-local frontend test suite in `src/components/Interview`.
- `code_gap`: missing dedicated component tests for `InterviewHub`.
- `doc_gap`: previous baseline did not enumerate route aliases and service evidence.
