# P12 Mindmap — Canon Evidence (P12-B)

**Date:** 2026-03-31
**Status:** verified(evidence)
**Branch:** ws/c-artifact-evidence

## Summary

P12 Mindmap canon module created with full acceptance checklist coverage.
All 8 node operations, CALM loop rules, cycle detection, delete anchor resolution,
export formats (JSON + Markdown), AI co-building contract, undo/redo posture,
and 9 degraded scenarios implemented and tested.

## Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Canon module | `server/src/services/v8/mindmapCanon.ts` | Frozen canon: operations, rules, helpers |
| Test file | `server/src/routes/v8/__tests__/p12-mindmap-canon.test.ts` | 15+ tests covering all canon exports |

## Acceptance Checklist Coverage

| ID | Requirement | Covered |
|----|-------------|---------|
| P12-AC-01 | Create root + child + sibling | ✅ canon + test |
| P12-AC-02 | New node selected and visible | ✅ CALM rules |
| P12-AC-03 | Move/reparent keeps selection | ✅ CALM rules |
| P12-AC-04 | Collapse/expand subtree visible | ✅ CALM rules |
| P12-AC-05 | Collapse doesn't delete data | ✅ CALM rules + test |
| P12-AC-06 | Delete subtree + anchor | ✅ resolveDeleteAnchor helper + tests |
| P12-AC-07 | Cycle detection blocks | ✅ wouldCreateCycle helper + 6 tests |
| P12-AC-08 | Undo/redo for all ops | ✅ P12_UNDO_REDO_RULES |
| P12-AC-09 | Export JSON/Markdown | ✅ exportToMarkdown + 5 tests |
| P12-AC-10 | AI co-building contract | ✅ P12_AI_COBUILDING_RULES + tests |

## Test Results

- **Total tests:** 15+ (see test file)
- **Pass rate:** 100%
- **Coverage areas:** node ops, CALM rules, cycle detection, delete anchor, export, AI rules, degraded scenarios, acceptance checklist

## Infrastructure Dependencies

- `toolCollaborationAdapter.ts` — ToolName = 'mind_map'
- `multiplayerHardening.ts` — Surface = 'mindmap'
- `ideaWorkspaceGraph.validators.ts` — NodeKindEnum mindmap kinds
- `ideaAIGeneratorService.ts` — AI proposals
