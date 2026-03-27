# V8.1 Evidence - Mobile breadth T4 Acceptance

Date: 2026-03-26
Lane: `Mobile breadth`
Taxonomy: `T4`
Status: `accepted`

## Acceptance basis

This bounded `Mobile breadth` lane is ready for `T4` acceptance because the primary authenticated narrow-viewport shell now
has coherent navigation continuity across its first thumb-reachable controls:

1. bottom-nav `Initiatives` now follows canonical sidebar authority via `PORTFOLIO_ROADMAP`
2. bottom-nav `Licensed Tools` now follows canonical sidebar authority via `ASSESSMENT_OVERVIEW`
3. bottom-nav `AI` now follows the canonical mobile full-chat path instead of desktop split-panel behavior
4. the mobile sidebar overlay now closes both on background click and on `Escape`, with focused regression proof

## Why this is sufficient

The lane was chartered as a bounded authenticated mobile shell cut, not a whole-app responsive redesign. Within that
declared scope, the live mobile shell no longer mixes bottom-nav route authority, desktop-only `AI` behavior, and fragile
overlay dismissal semantics.

Broader module-level responsive work remains visible backlog, but it is outside this accepted bounded lane.

## Evidence chain

1. `evidence/205-v81-mobile-breadth-split-brain-map.md`
2. `evidence/206-v81-mobile-breadth-bottom-nav-authority-seam.md`
3. `evidence/207-v81-mobile-breadth-bottom-nav-ai-entry-seam.md`
4. `tests/components/navigation/BottomNavigation.test.tsx`
5. `tests/components/navigation/Sidebar.mobile-overlay.test.tsx`
