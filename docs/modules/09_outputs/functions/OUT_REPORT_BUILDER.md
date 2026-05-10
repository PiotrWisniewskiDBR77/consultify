---
module_id: MODULE_OUTPUTS
function_id: OUT_REPORT_BUILDER
function_name: Outputs — Report Builder Route
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Report Builder Route

## 1. Function Identity
- Function ID: `OUT_REPORT_BUILDER`
- Routes: `/reports/builder`, `/reports/builder/:reportId`
- Runtime anchor: `ReportBuilderView`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: create/edit report artifacts from outputs lane.
- Inputs: report builder payloads and artifact context.
- Outputs: explicit save/review/export actions with return to outputs library.
- Boundaries: builder is specialized editor route under outputs ownership.
- Evidence: `AppRoutes.tsx`, `ReportBuilderView.tsx`.
- Risk: builder/library handoff parity drift.
