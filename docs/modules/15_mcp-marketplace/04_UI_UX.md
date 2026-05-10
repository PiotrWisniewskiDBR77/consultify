---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — MCP Marketplace

## 1. Main Screen

As-Is: `/mcp/marketplace` exists as a coming-soon placeholder catalog surface. Future runtime must preserve marketplace discovery, review, installation and security/tenant boundaries.

## 2. Runtime States

- Loading: placeholder does not load marketplace catalog; future runtime must show catalog/provider loading.
- Empty: placeholder must say the catalog is coming soon; future empty state must explain no matching tools/connectors and offer filter reset.
- Error: placeholder must avoid raw internals; future errors must translate provider/catalog/install failures.
- Degraded: current degraded state is coming-soon; future unavailable providers, policy blocks or partial catalog data must be visible.
- Success: no active marketplace success state exists as-is; future install/enable success must confirm what changed and where to configure/review it.

## 3. Menu 2 / Menu 3 Contract

As-Is: no active marketplace command system beyond the placeholder route. Future Menu 3 must be the catalog/tool command row/right-side contextual slot for selected listing, filters, review or install request.

## 4. AI Actions Placement

No active marketplace AI actions are implemented as-is. Future contextual AI recommendation/review actions must live in Menu 3/Dynamic Tabs/local command row right-side slot and must not be duplicated in listing canvas.

## 5. Next Action Guidance

The placeholder must tell the user that the marketplace is coming soon. Future runtime must guide search/filter, inspect listing, review permissions, request/approve install, configure connector or retry.

## 6. Source / Evidence / Provenance

As-Is: no marketplace claims are produced. Future listings and recommendations must show provider/source, permissions, data access scope, trust/review evidence and missing-data status.

## 7. Approval / Diff / Review

As-Is: no active install/enable mutation exists. Future installs, permission grants and high-impact marketplace changes require review/approval before execution and audit after execution.

## 8. Anti-Patterns

- Installing/enabling connectors silently.
- Hiding requested permissions or tenant/ACL scope.
- AI recommendation without provider/source evidence.
- AI actions duplicated in listing canvas and Menu 3.
- Fake success when install/configuration is only partial.

## 9. As-Is Gaps

- Main screen is coming-soon placeholder.
- No active catalog, permissions review, install approval, provenance display or audit result is validated as implemented.

## 10. Acceptance Criteria

- Sidebar/route lands on `/mcp/marketplace`.
- Current UI honestly renders coming-soon placeholder.
- Future runtime preserves Menu 3 AI placement, source/provenance visibility and approval/audit gates.
- Placeholder status remains documented as an As-Is gap until active runtime exists.
