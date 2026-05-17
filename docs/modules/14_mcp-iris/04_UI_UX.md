---
module_id: MODULE_MCP_IRIS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — MCP IRIS

## 1. Main Screen

As-Is: `/mcp/iris` exists as a coming-soon placeholder integration surface. Future runtime must preserve integration execution transparency, approval and tenant/ACL boundaries.

## 2. Runtime States

- Loading: placeholder does not load MCP connection state; future runtime must show connector/auth/tool loading.
- Empty: placeholder must say the module is coming soon; future empty state must guide connecting or selecting an integration.
- Error: placeholder must avoid raw internals; future errors must translate auth/provider/tool failures.
- Degraded: current degraded state is coming-soon; future partial provider availability or policy blocks must be visible.
- Success: no active MCP IRIS success state exists as-is; future tool execution/connect success must confirm result and next audit/review step.

## 3. Menu 2 / Menu 3 Contract

As-Is: no active MCP command system beyond the placeholder route. Future Menu 3 must be the integration command row/right-side contextual slot for selected connector, tool or execution request.

## 4. AI Actions Placement

No active MCP IRIS AI actions are implemented as-is. Future contextual AI/tool actions must live in Menu 3/Dynamic Tabs/local command row right-side slot and must not be duplicated in the canvas.

## 5. Next Action Guidance

The placeholder must tell the user that the integration surface is coming soon. Future runtime must guide authenticate, select tool, review requested action, approve execution, inspect result or retry.

## 6. Source / Evidence / Provenance

As-Is: no MCP execution evidence is produced. Future executions must show connector, tool, input, output summary, timestamps and provenance sufficient for audit without exposing secrets.

## 7. Approval / Diff / Review

As-Is: no active MCP execution exists. Future destructive/high-impact tool calls require approval/review before execution and audit after execution.

## 8. Anti-Patterns

- Silent MCP tool execution.
- Exposing secrets, tokens or raw provider internals.
- Hiding policy/ACL blocks.
- AI/tool actions duplicated in canvas and Menu 3.
- Fake success when only metadata was saved or connection failed.

## 9. As-Is Gaps

- Main screen is coming-soon placeholder.
- No active connector state, execution approval, provenance display or audit result is validated as implemented.

## 10. Acceptance Criteria

- Sidebar/route lands on `/mcp/iris`.
- Current UI honestly renders coming-soon placeholder.
- Future runtime preserves Menu 3 AI/tool placement, provenance visibility and approval/audit gates.
- Placeholder status remains documented as an As-Is gap until active runtime exists.

## 11. Function Annex — MCP IRIS Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `IRIS_PLACEHOLDER_SURFACE` | MCP IRIS Placeholder Surface | `/mcp/iris` | stub | `V4ComingSoonView` | `functions/IRIS_PLACEHOLDER_SURFACE.md` |
| `IRIS_RUNTIME_TARGET` | MCP IRIS Runtime Target | planned MCP IRIS runtime on `/mcp/iris` | partial | target MCP IRIS execution/control panel (not currently mounted) | `functions/IRIS_RUNTIME_TARGET.md` |
