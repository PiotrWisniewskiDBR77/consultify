---
module_id: MODULE_OUTPUTS
function_id: OUT_LEGACY_REPORT_REDIRECT
function_name: Outputs — Legacy Reports Redirect Bridge
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Legacy Reports Redirect Bridge

## 1. Function Identity
- Function ID: `OUT_LEGACY_REPORT_REDIRECT`
- Routes: `/reports`, `/reports/management`
- Runtime anchor: redirect to `/presentations?tab=documents`
- Feature state: `partial` (migration bridge)

## 2-12. Contract Summary
- Purpose: preserve legacy entry points while enforcing outputs lane ownership.
- Inputs: legacy route access.
- Outputs: deterministic redirect into canonical outputs tab.
- Evidence: `AppRoutes.tsx` redirect mappings.
- Risk: duplicate-lane confusion until migration bridge is removed.
