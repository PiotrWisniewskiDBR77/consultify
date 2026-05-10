---
module_id: MODULE_MCP_IRIS
function_id: IRIS_RUNTIME_TARGET
function_name: MCP IRIS — Runtime Target
doc_kind: FUNCTION_CONTRACT
status: draft
owner: user
last_updated: 2026-05-10
---

# Function Contract — MCP IRIS Runtime Target

## 1. Function Identity
- Function ID: `IRIS_RUNTIME_TARGET`
- Intended runtime anchor: MCP IRIS execution/control panel
- Current mounted status: `partial` (planned, no dedicated route-mounted runtime component)

## 2-12. Contract Summary
- Purpose: preserve target contract for authenticated, audited MCP tool execution.
- Inputs: connector config, allowlisted tool selection, execution request payloads (target-state).
- Outputs: explicit reviewed executions with audit/provenance metadata (target-state).
- Security: admin/policy gating and deny-by-default enforcement required.
- Evidence: codemap notes no mounted dedicated IRIS runtime.
- Risk: any future runtime can drift into unsafe hidden execution patterns.
