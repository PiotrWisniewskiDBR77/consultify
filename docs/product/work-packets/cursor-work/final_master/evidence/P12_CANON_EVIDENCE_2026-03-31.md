# P12 Mindmap — Canon Evidence (P12-B)

**Date:** 2026-03-31 (updated 2026-04-11)
**Status:** verified(evidence)
**Branch:** ws/c-artifact-evidence

## Summary

P12 Mindmap canon module created with full acceptance checklist coverage.
All 8 node operations, CALM loop rules, cycle detection, delete anchor resolution,
export formats (JSON + Markdown), AI co-building contract, undo/redo posture,
and 10 degraded scenarios (per §2.3.9 contract) implemented and tested.

## Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Canon module | `server/src/services/v8/mindmapCanon.ts` | Frozen canon: operations, rules, helpers |
| Canon helpers (frontend) | `src/components/MyWork/mindmap/mindmapCanonHelpers.ts` | Client-side mirror: wouldCreateCycle, resolveDeleteAnchor, exportToMarkdown |
| Test file | `server/src/routes/v8/__tests__/p12-mindmap-canon.test.ts` | 15+ tests covering all canon exports |
| AI diff modal | `src/components/MyWork/mindmap/AIProposalDiffModal.tsx` | Proposal preview with diff summary, per-add selection |

## Acceptance Checklist Coverage

| ID | Requirement | Covered |
|----|-------------|---------|
| P12-AC-01 | Create root + child + sibling | ✅ canon + test + frontend UI (FloatingNodeToolbar, AddNodePopover) |
| P12-AC-02 | New node selected and visible | ✅ CALM rules + frontend fitView + _isNew glow |
| P12-AC-03 | Move/reparent keeps selection | ✅ CALM rules + frontend _justMoved ring |
| P12-AC-04 | Collapse/expand subtree visible | ✅ CALM rules + chevron/child count on nodes |
| P12-AC-05 | Collapse doesn't delete data | ✅ CALM rules + test + collapsedNodeIds Set |
| P12-AC-06 | Delete subtree + anchor | ✅ resolveDeleteAnchor helper + tests + frontend cascade + confirmation |
| P12-AC-07 | Cycle detection blocks | ✅ wouldCreateCycle helper + 6 tests + frontend toast.error |
| P12-AC-08 | Undo/redo for all ops | ✅ P12_UNDO_REDO_RULES + frontend canUndo/canRedo + collapsedNodeIds in snapshots |
| P12-AC-09 | Export JSON/Markdown | ✅ exportToMarkdown + 5 tests + quick actions with error handling |
| P12-AC-10 | AI co-building contract | ✅ P12_AI_COBUILDING_RULES + tests + AIProposalDiffModal |

## Test Results

- **Total tests:** 15+ (see test file)
- **Pass rate:** 100%
- **Coverage areas:** node ops, CALM rules, cycle detection, delete anchor, export, AI rules, degraded scenarios, acceptance checklist

## UI/UX Design System Compliance (2026-04-11)

- Toolbar controls: `h-9` sizing per UI_UX_CANON §8.3
- Rounding tokens: `rounded-hig-*` per visual-language §4.3
- Shadow tokens: `shadow-hig-*` per visual-language §7
- Typography: `font-semibold` (never `font-bold`) per visual-language §5.2
- Hover pattern: background-only (no text color change) per visual-language §8.1
- Color tokens: `primary-*` (not `violet-*`) per color-system §1
- Accessibility: `prefers-reduced-motion` support in mindmap-effects.css

## Infrastructure Dependencies

- `toolCollaborationAdapter.ts` — ToolName = 'mind_map'
- `multiplayerHardening.ts` — Surface = 'mindmap'
- `ideaWorkspaceGraph.validators.ts` — NodeKindEnum mindmap kinds
- `ideaAIGeneratorService.ts` — AI proposals
