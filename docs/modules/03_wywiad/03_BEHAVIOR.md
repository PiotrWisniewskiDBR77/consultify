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
- Session/template/insight/initiative lanes: `WY_SESSIONS`, `WY_TEMPLATES`, `WY_INSIGHTS`, `WY_INITIATIVES`.
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

## Interview Initiatives Behavior

- Interview-local `Inicjatywy` is governed by `WY_INITIATIVES` in this cycle.
- The behavior path is `interview session -> insight/finding -> initiative candidate -> explicit review/handoff -> 05_inicjatywy read-back`.
- `WY_INITIATIVES` owns interview-local candidate preparation, creator review and handoff/read-back state.
- `WY_INSIGHTS` and `WY_SESSIONS` provide source context only.
- `05_inicjatywy` owns canonical initiative lifecycle, status, approval, governance and execution handoff after accepted read-back.
- No interview action may claim canonical initiative creation when downstream handoff fails or is unavailable.
