---
module_id: MODULE_TOOLS
function_id: NZ_ASSESSMENT_HUB
function_name: Tools — Assessment Hub
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Assessment Hub

## 1. Function Identity
- Function ID: `NZ_ASSESSMENT_HUB`
- Scope: `/assessment/*` routes, `AssessmentHub` tabs (`list`, `reports`, `initiatives`)
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: run and manage assessment flows plus reports/initiative outcomes.
- Outcome: structured assessment-to-delivery pipeline.

## 3. Trigger and Entry Points
- Entry: assessment routes and sidebar assessment sub-item.

## 4. UI Component Footprint
- `AssessmentHub`, `AssessmentSessionEditorView`, related module command controls.

## 5. Inputs, Data Contracts, and Dependencies
- Assessment entities, report entities, initiative entities, imported reports.
- APIs: assessment and initiatives/report endpoints via shared `Api`.

## 6. Outputs and Side Effects
- Assessment progress updates, report navigation, initiative handoff operations.

## 7. Ownership and Handoff Boundaries
- Assessment hub owns assessment runtime; reports/initiatives handoffs are explicit.
- Must not bypass governance for downstream mutations.

## 8. Runtime States and UX Behavior
- Loading/empty/error/degraded/success and explicit next actions per tab.

## 9. AI, Source, Evidence, Approval
- Source framework and assessment context required on outputs/handoffs.
- High-impact outcomes require review workflow.

## 10. Security, Roles, and Tenancy
- Tenant-based visibility and role constraints over assessment artifacts.

## 11. Acceptance Criteria and Test Evidence

- `/assessment/*` routes render assessment runtime and tab set.

- Route evidence: module route/view scope for `04_narzedzia` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `04_narzedzia` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `04_narzedzia` user flows.

## 12. Open Risks and Change Log
- Risk: mixed data families in one hub can blur status semantics.
- Change log: initial function contract created.
