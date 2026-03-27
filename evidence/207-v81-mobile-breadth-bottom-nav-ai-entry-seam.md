# V8.1 Evidence - Mobile breadth Bottom-Nav AI Entry Seam

Date: 2026-03-26
Lane: `Mobile breadth`
Taxonomy: `T4`
Packet: `bottom-nav AI entry continuity`

## Goal

Close the next bounded `Mobile breadth` seam by making the bottom-nav `AI` action follow the canonical mobile full-chat
path instead of trying to open the desktop split panel.

## What changed

1. `src/components/navigation/BottomNavigation.tsx`
   - routes the mobile `AI` action through `AppView.AI_CHAT`
   - sets conversation display mode to `full` before navigation
   - aligns the visual pulse with the canonical `AI_CHAT` current-view state instead of split-panel collapse state
2. `tests/components/navigation/BottomNavigation.test.tsx`
   - proves the mobile `AI` entry now uses `setDisplayMode('full')`
   - proves the same tap navigates through `AppView.AI_CHAT`

## Why it matters

Before this packet, the mobile bottom bar tried to toggle the split chat panel even though the split panel is hidden below
`lg` in `MainLayout`. That left the primary mobile `AI` affordance tied to desktop-only behavior.

After this packet, the bottom-nav `AI` button follows the same full-chat path already used by the wider mobile chat flow.

## Verification

- `npx vitest run tests/components/navigation/BottomNavigation.test.tsx --maxWorkers=1 --maxConcurrency=2`
