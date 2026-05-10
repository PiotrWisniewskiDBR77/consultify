---
module_id: MODULE_MCP_MARKETPLACE
function_id: MCPM_RUNTIME_TARGET
function_name: MCP Marketplace — Runtime Target
doc_kind: FUNCTION_CONTRACT
status: draft
owner: user
last_updated: 2026-05-10
---

# Function Contract — Marketplace Runtime Target

## 1. Function Identity
- Function ID: `MCPM_RUNTIME_TARGET`
- Intended runtime anchor: marketplace catalog/review/install panel
- Current mounted status: `partial` (planned, no dedicated mounted runtime component)

## 2-12. Contract Summary
- Purpose: preserve target contract for governed catalog discovery and install workflow.
- Inputs: provider catalog metadata, permission scopes, listing recommendations.
- Outputs: explicit reviewed installation/configuration actions with audit.
- Security: tenant/ACL + approval gates for high-impact install actions.
- Evidence: codemap confirms no dedicated mounted marketplace runtime.
- Risk: hidden mutation risk if future install actions bypass review/audit.
