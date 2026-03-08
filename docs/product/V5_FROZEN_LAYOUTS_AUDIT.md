# V5 Ideas Workspace — FROZEN_LAYOUTS Compliance Audit

> **Task:** V5-IDEA-50  
> **Date:** 2026-03-08  
> **Status:** PASS — all 6 frozen layout rules respected

---

## Audit results

### 1. Sidebar menu order

**Status: COMPLIANT**

V5 Ideas Workspace does not modify the sidebar. It operates within the existing "My Work" module entry point. No new sidebar items were added.

- `IdeaMapWorkspace` is rendered inside the My Work module
- No changes to `menuConfig.ts`
- Sidebar order preserved: Chat → My Work → Interview → Tools → ...

### 2. Module topbar order

**Status: COMPLIANT**

V5 workspace uses `IdeaWorkspaceToolbar` which follows the frozen order:
- Area toggle (panel strip) — rightmost
- Add (not applicable in workspace mode)
- Tool (IdeaCanvasToolSelector) — tool switcher
- View (view modes within table tool follow frozen order)
- Filters (not applicable in workspace mode)

The toolbar does not add extra buttons between frozen positions.

### 3. View modes order

**Status: COMPLIANT**

Table tool (`IdeaTableTool`) view modes follow the frozen order:
- table → kanban → timeline → calendar → grid
- No reordering, no insertion of custom views between frozen positions
- V5-IDEA-24 added `calendar` and `grid` views in correct position

### 4. Command Row — single row

**Status: COMPLIANT**

V5 workspace does not use a traditional command row (it's a canvas workspace, not a table hub). The workspace toolbar is a single row containing:
- Tool selector
- Panel strip toggle
- Save indicator
- AI expand button

No extra filter/toolbar rows were added between the toolbar and the canvas.

### 5. App Table + Preview Pane

**Status: COMPLIANT**

V5 workspace is a canvas-based workspace, not a table module. However:
- The table tool within the workspace follows standard table patterns
- Node detail drawer follows the Preview Pane anatomy: Header (title + close) → Body (scroll) → Footer (actions)
- Single click = select, double click = open detail drawer

### 6. Workspace 3-tools strip

**Status: COMPLIANT**

V5 workspace uses the shared `WorkspacePanelStrip` with exactly 3 panels:
- **Tools** (`IdeaWorkspaceTools`) — tool-specific actions, generators, convert
- **Context** (`IdeaContextPanel`) — notes, evidence, linked artifacts, backlinks
- **AI Suggestions** (`IdeaAISuggestionsPanel`) — AI proposals, suggestions

No 4th button was added. The panel strip uses `WorkspacePanelKey` type (`'tools' | 'context' | 'ai_suggestions' | null`).

---

## Files audited

| File | Frozen rule | Status |
| --- | --- | --- |
| `IdeaMapWorkspace.tsx` | #6 panel strip | PASS |
| `IdeaWorkspaceToolbar.tsx` | #2 topbar order | PASS |
| `IdeaWorkspaceTools.tsx` | #6 tools panel | PASS |
| `IdeaContextPanel.tsx` | #6 context panel | PASS |
| `IdeaAISuggestionsPanel.tsx` | #6 AI panel | PASS |
| `IdeaCanvasToolSelector.tsx` | #2 tool position | PASS |
| `IdeaTableTool.tsx` | #3 view modes, #4 command row | PASS |
| `IdeaNodeDetailDrawer.tsx` | #5 preview anatomy | PASS |
| `IdeaRecommendationMap.tsx` | #4 no extra rows | PASS |
| `IdeaProcessFlowTool.tsx` | #4 no extra rows | PASS |
| `IdeaWhiteboardTool.tsx` | #4 no extra rows | PASS |
| `ConvertToOutputMenu.tsx` | #6 no 4th button | PASS |
| `IdeaExportMenu.tsx` | N/A (modal) | PASS |
| `table/IdeaStartupTemplates.tsx` | N/A (modal) | PASS |

---

## Conclusion

All V5 Ideas Workspace components respect the 6 FROZEN_LAYOUTS rules. No violations detected.
