---
module_id: MODULE_TOOLS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Narzędzia / Tools

## 1. Main Screen

As-Is: `/discovery-tools*` uses `DiscoveryToolsHub` with ModuleHub table/grid/preview workflow; `/assessment/*` uses `AssessmentHub` and nested session editor; `/discovery-tools/strategic/megatrends` renders `MegatrendsWorkspace`. The screen job is consulting-tool discovery, assessment execution and analysis handoff.

## 2. Runtime States

- Loading: hub-level loading flags, skeletons or spinners must be visible while tool/session data loads.
- Empty: empty and filtered-empty outcomes must explain whether no tools exist, no filter matches, or no session is selected.
- Error: tool/assessment failures must surface mapped errors or toasts without raw internals.
- Degraded: unavailable tool families, incomplete assessment data or fallback status labels must be visible and not treated as success.
- Success: completed assessment/tool actions must confirm the result and point to the next artifact, initiative or report step.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps module-level navigation. Menu 3 is the tool/assessment command row for the selected hub tab, table row, session or editor context. `AssessmentMenu3ActionBar` is the explicit command-row pattern for assessment contextual actions.

## 4. AI Actions Placement

AI analysis or tool-assist actions must use Menu 3/right-side command placement or row-scoped controls. No standalone duplicated AI toolbar may be added below the canvas or under metadata.

## 5. Next Action Guidance

Tools UX must tell the user whether to select a tool, start/continue an assessment, clear filters, retry loading, hand off to initiatives/reports or review generated analysis.

## 6. Source / Evidence / Provenance

Analysis results and handoffs must preserve source tool, assessment session and input context. Generated findings must show supporting evidence or explicitly mark missing/partial evidence.

## 7. Approval / Diff / Review

Handoffs to initiatives/reports and any high-impact generated recommendation must be explicit user actions with review before finalization. Assessment session changes must not be hidden writes.

## 8. Anti-Patterns

- Treating fallback/degraded tool status as successful analysis.
- AI actions duplicated in Menu 3 and canvas.
- Tool output without source tool/session context.
- Silent handoff into initiatives/reports.
- Empty filtered table without clear reset/next action.

## 9. As-Is Gaps

- Existing docs confirm command-row action bars, empty components and mapped errors, but not every tool family's degraded state copy.
- Runtime proof of source/provenance display for all report/initiative handoffs remains to be validated.

## 10. Acceptance Criteria

- Documented routes render the appropriate Tools, Assessment and Megatrends workspaces.
- Loading, empty, error, degraded and success states are visible and actionable.
- AI actions use Menu 3/right-side command placement without duplication.
- Tool outputs and handoffs show source/provenance.
- High-impact handoffs require review/approval.

## 11. Function Annex — Tools Functions

Function groups:

- **Discovery consulting tools lane**: `NZ_DISCOVERY_LIBRARY`, `NZ_DISCOVERY_SESSIONS`, `NZ_DISCOVERY_OUTPUTS`, `NZ_DISCOVERY_INITIATIVES`.
- **Assessment lane**: `NZ_ASSESSMENT_HUB`.
- **Strategic workspace lane**: `NZ_MEGATRENDS_WORKSPACE`.

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `NZ_DISCOVERY_LIBRARY` | Discovery Library | `/discovery-tools` -> tab `library` | real | `DiscoveryToolsHub` library table/grid + preview | `functions/NZ_DISCOVERY_LIBRARY.md` |
| `NZ_DISCOVERY_SESSIONS` | Discovery Sessions | `/discovery-tools` -> tab `sessions` | real | `DiscoveryToolsHub` sessions table/grid + filters | `functions/NZ_DISCOVERY_SESSIONS.md` |
| `NZ_DISCOVERY_OUTPUTS` | Reports & Presentations Outputs | `/discovery-tools` -> tab `outputs` | real | `DiscoveryToolsHub` outputs table + preview | `functions/NZ_DISCOVERY_OUTPUTS.md` |
| `NZ_DISCOVERY_INITIATIVES` | Initiatives Handoff | `/discovery-tools` -> tab `initiatives` | real | `DiscoveryToolsHub` initiatives table + handoff actions | `functions/NZ_DISCOVERY_INITIATIVES.md` |
| `NZ_ASSESSMENT_HUB` | Assessment Hub | `/assessment/*` | real | `AssessmentHub`, session editor, tabbed assessment/report/initiative controls | `functions/NZ_ASSESSMENT_HUB.md` |
| `NZ_MEGATRENDS_WORKSPACE` | Megatrends Workspace | `/discovery-tools/strategic/megatrends` | real | `MegatrendsWorkspace` | `functions/NZ_MEGATRENDS_WORKSPACE.md` |
