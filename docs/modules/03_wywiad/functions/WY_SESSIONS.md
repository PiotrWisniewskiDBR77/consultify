---
module_id: MODULE_INTERVIEW
function_id: WY_SESSIONS
function_name: Interview — Sessions
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Sessions

## 1. Function Identity
- Function ID: `WY_SESSIONS`
- UI labels: `Sesje`, `Sessions`
- Scope: Interview tab `sessions`
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: create/run/complete interview sessions.
- Outcome: structured evidence capture and traceable interview lifecycle.

## 3. Trigger and Entry Points
- Entry: `sessions` tab, deep links via `sessionId`.
- Preconditions: project context and interview permissions.

## 4. UI Component Footprint
- `InterviewHub` session table and dynamic document panels.
- Detail components from interview workspace/preview views.

## 5. Inputs, Data Contracts, and Dependencies
- Session objects with assignment workflow status and progress fields.
- APIs: `V8InterviewApi.getManagedSessions()` + session mutations via API.

## 6. Outputs and Side Effects
- New/updated sessions, review state transitions, session opens.

## 7. Ownership and Handoff Boundaries
- Owner: interview session domain.
- Handoff: insights/templates and later downstream modules via explicit actions.

## 8. Runtime States and UX Behavior
- Loading and filter states visible.
- Empty explains how to create/start session.
- Errors use safe toasts/copy.

## 9. AI, Source, Evidence, Approval
- AI support can suggest but not silently finalize conclusions.
- Session provenance required for all derived insights.

## 10. Security, Roles, and Tenancy
- Tenant/project scope enforced; no cross-tenant session leakage.

## 11. Acceptance Criteria and Test Evidence
- Session tab supports create/open/status filtering.
- Deep links with `sessionId` resolve correctly.
- Evidence: `InterviewHub.tsx`, interview API client.

## 12. Open Risks and Change Log
- Risk: alias routes can obscure canonical user path understanding.
- Change log: initial function contract created.
