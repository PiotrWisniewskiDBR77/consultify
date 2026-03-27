# V8.1 Evidence - Mobile breadth Bottom-Nav Authority Seam

Date: 2026-03-26
Lane: `Mobile breadth`
Taxonomy: `T4`
Packet: `bottom-nav authority`

## Goal

Close the first bounded `Mobile breadth` seam by making authenticated bottom-nav mobile entry points follow the same
canonical route authority as the frozen sidebar.

## What changed

1. `src/components/navigation/BottomNavigation.tsx`
   - points `Licensed Tools` to `AppView.ASSESSMENT_OVERVIEW`
   - points `Initiatives` to `AppView.PORTFOLIO_ROADMAP`
   - keeps `FULL_STEP2_INITIATIVES` and `INITIATIVE_MANAGEMENT` recognized as active initiative aliases
   - adds stable `data-testid` hooks for focused bottom-nav regression
2. `tests/components/navigation/BottomNavigation.test.tsx`
   - proves bottom-nav mobile taps now resolve to canonical `Assessment` and `Initiatives` entries
   - proves the initiatives tab still renders as active on the legacy `FULL_STEP2_INITIATIVES` alias

## Why it matters

Before this packet, authenticated mobile users were sent to historical bottom-nav targets that disagreed with
`src/components/navigation/Sidebar/menuConfig.ts`, which remains the frozen navigation authority for module entry.

After this packet, the mobile bottom bar no longer drifts from sidebar truth for the two visible module shortcuts that
were still using older aliases.

## Verification

- `npx vitest run tests/components/navigation/BottomNavigation.test.tsx --maxWorkers=1 --maxConcurrency=2`
