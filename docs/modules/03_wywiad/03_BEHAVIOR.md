---
module_id: MODULE_INTERVIEW
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Wywiad / Interview

## Runtime Behavior (As-Is)

- Interview routes (`/interview`, `/discovery`, `/project-intelligence`) all converge to `InterviewHub`.
- `InterviewHub` drives sessions/insights/templates workflows with assignment, review, and preview interactions in one module shell.
- Hub uses `Api` and `V8InterviewApi` for loading and mutating interview sessions, assignments, and insight artifacts.

### Function Runtime Breakdown (As-Is)

- Assignment lane: `WY_MY_ASSIGNMENTS` and `WY_MANAGED_ASSIGNMENTS`.
- Session/template/insight lanes: `WY_SESSIONS`, `WY_TEMPLATES`, `WY_INSIGHTS`.
- Review lane: `WY_PENDING_REVIEW` for permissioned review queues.

## State Handling (As-Is)

- Runtime maintains local state for filters, table/grid modes, hidden columns, open documents, and preview context.
- Assignment and review operations surface guarded errors through safe error copy helpers and toast feedback.
- Demo-data fallback logic is explicitly referenced in hub imports (`shouldAllowDemoData`, demo dataset helpers).

## Security / Tenant / Governance (As-Is)

- Session and assignment objects carry organization/user identifiers in typed API contracts (`v8/interview.ts`).
- Review/send-back actions are explicit UI operations; no hidden execution branch in route layer.
- Cross-module export/handoff is initiated by explicit user actions from interview hub elements.
- Permissioned tabs (`managed`, `pending_review`) are runtime-gated and must not silently expose unauthorized data.
