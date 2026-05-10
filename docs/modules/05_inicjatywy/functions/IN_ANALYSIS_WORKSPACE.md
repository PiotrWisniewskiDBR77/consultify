---
module_id: MODULE_INITIATIVES
function_id: IN_ANALYSIS_WORKSPACE
function_name: Initiatives — Analysis Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Analysis Workspace

## 1. Function Identity
- Function ID: `IN_ANALYSIS_WORKSPACE`
- Runtime anchor: `InitiativesHub` tab `analysis`
- Feature state: `real`

## 2. User Job and Business Outcome
- Analyze feasibility/resources/logic/timeline/completeness before execution.

## 3. Trigger and Entry Points
- Open via initiatives tab `analysis`.

## 4. UI Component Footprint
- Analysis command row subviews and action cluster in `InitiativesHub`.

## 5. Inputs, Data Contracts, and Dependencies
- V8 planning/decision chain snapshots and initiative metrics.

## 6. Outputs and Side Effects
- Analysis conclusions and explicit next-action routing to portfolio/execution.

## 7. Ownership and Handoff Boundaries
- Analysis supports decisions; does not silently mutate execution/output canon.

## 8. Runtime States and UX Behavior
- Explicit loading/degraded states for partial planning data.

## 9. AI, Source, Evidence, Approval
- AI analysis requires visible provenance and review for high-impact actions.

## 10. Security, Roles, and Tenancy
- Standard tenant ACL and deny-by-default behavior.

## 11. Acceptance Criteria and Test Evidence
- Analysis tab exposes all documented subviews.
- Evidence: `InitiativesHub.tsx` analysis command row logic.

## 12. Open Risks and Change Log
- Risk: analysis subview semantics can drift without test coverage.
- Change log: initial function contract created.
