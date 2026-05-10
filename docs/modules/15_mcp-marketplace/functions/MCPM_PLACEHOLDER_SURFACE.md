---
module_id: MODULE_MCP_MARKETPLACE
function_id: MCPM_PLACEHOLDER_SURFACE
function_name: MCP Marketplace — Placeholder Surface
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Marketplace Placeholder Surface

## 1. Function Identity
- Function ID: `MCPM_PLACEHOLDER_SURFACE`
- Route: `/mcp/marketplace`
- Runtime anchor: `V4ComingSoonView`
- Feature state: `stub`

## 2-12. Contract Summary
- Purpose: expose honest coming-soon state for marketplace catalog lane.
- Inputs: route entry context only.
- Outputs: explicit blocked messaging, no fake catalog/install actions.
- Evidence: `AppRoutes.tsx` -> `ROUTES.MCP_MARKETPLACE`.
- Risk: user expectation mismatch if placeholder implies active installs.
