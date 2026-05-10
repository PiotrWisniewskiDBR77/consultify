---
module_id: MODULE_INTERVIEW
function_id: WY_INSIGHTS
function_name: Interview — Insights
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Insights

## 1. Function Identity
- Function ID: `WY_INSIGHTS`
- UI labels: `Wnioski`, `Insights`
- Scope: Interview tab `insights`
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: review and operationalize interview insights.
- Outcome: evidence-backed conclusions for downstream decisions.

## 3. Trigger and Entry Points
- Entry: `insights` tab, deep links with `insightId`.

## 4. UI Component Footprint
- `InterviewHub` insight list/report modes and preview surfaces.
- Insight viewer/detail components and row actions.

## 5. Inputs, Data Contracts, and Dependencies
- Insight records with type/status and session linkage.
- APIs: `V8InterviewApi.listInsights()` and interview endpoints.

## 6. Outputs and Side Effects
- Insight review transitions, opened details, handoff actions.

## 7. Ownership and Handoff Boundaries
- Owner: interview insight records.
- Handoff to reports/initiatives must remain explicit and source-aware.

## 8. Runtime States and UX Behavior
- Loading and status filter changes are explicit.
- Empty/error/degraded states require clear guidance.

## 9. AI, Source, Evidence, Approval
- Insight claims must retain session/source provenance.
- Approval/review required for high-impact insight usage.

## 10. Security, Roles, and Tenancy
- Insight visibility and mutation follow tenant + role ACL.

## 11. Acceptance Criteria and Test Evidence
- Insight tab supports flat/report modes and deep-link open.
- Evidence: `InterviewHub.tsx`, insight API client integration.

## 12. Open Risks and Change Log
- Risk: evidence display inconsistency across insight subviews.
- Change log: initial function contract created.
