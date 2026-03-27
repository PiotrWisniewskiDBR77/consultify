# T4 Charter - Mobile breadth

Date: 2026-03-26
Lane: `Mobile breadth`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Mobile / Landing` was accepted as a bounded public-entry lane, but it explicitly kept whole-app mobile responsiveness out
of scope. The next honest cut is not a redesign pass. It is one authenticated-shell continuity seam on the live mobile
navigation surface.

## Goal

Promote one bounded `Mobile breadth` slice that reduces mixed truth across:

1. authenticated mobile navigation authority
2. frozen sidebar/menu SSOT versus mobile bottom-nav entry points
3. route/store continuity for the first thumb-reachable mobile shell controls

## In scope

1. one bounded `Mobile breadth` packet at a time
2. split-brain map for authenticated frontend/runtime/proof surfaces
3. canonical mobile route authority for the first live bottom-nav seam
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. whole-app responsive redesign
2. frozen sidebar order or module-topbar changes
3. new mobile IA, extra toolbars, or alternate shell layouts
4. broad authenticated workspace reflow
5. landing-page redesign or PWA breadth

## Initial bounded packet

Packet 1:

- align the bottom-nav `Initiatives` entry with the canonical sidebar authority
- align the bottom-nav `Licensed Tools` entry with the canonical assessment entry
- keep legacy initiative aliases highlighted until broader cleanup is explicitly promoted
- add bounded regression for mobile bottom-nav authority

Why this first:

- it fixes a live authenticated mobile seam without reopening shell layout scope
- the current bottom bar points users at historical aliases that do not match sidebar SSOT
- it improves thumb navigation continuity while respecting `FROZEN_LAYOUTS.md`

Recorded in:

- `evidence/205-v81-mobile-breadth-split-brain-map.md`

## Packet 1

Completed:

- point bottom-nav `Initiatives` to `AppView.PORTFOLIO_ROADMAP`
- point bottom-nav `Licensed Tools` to `AppView.ASSESSMENT_OVERVIEW`
- keep `FULL_STEP2_INITIATIVES` and `INITIATIVE_MANAGEMENT` recognized as active-state aliases
- add focused regression for mobile bottom-nav authority

Recorded in:

- `evidence/206-v81-mobile-breadth-bottom-nav-authority-seam.md`

## Packet 2

Completed:

- route the bottom-nav mobile `AI` action through canonical full-chat navigation
- set mobile chat display mode to `full` instead of trying to open the hidden split panel
- align the `AI` active pulse with actual `AI_CHAT` route/store truth
- extend the focused bottom-nav regression to cover mobile `AI` continuity

Recorded in:

- `evidence/207-v81-mobile-breadth-bottom-nav-ai-entry-seam.md`

## Packet 3

Completed:

- add explicit `Escape` close continuity for the narrow-viewport sidebar overlay
- add a stable overlay test hook so the live authenticated shell can be regression-checked directly
- add focused proof for background-click and `Escape` dismissal on mobile

Recorded in:

- `tests/components/navigation/Sidebar.mobile-overlay.test.tsx`

## Acceptance position

This lane is ready for bounded `T4` acceptance because the authenticated mobile shell now has:

1. coherent bottom-nav canonical authority for `Initiatives` and `Licensed Tools`
2. coherent mobile `AI` entry continuity onto canonical full-chat behavior
3. coherent narrow-viewport sidebar overlay dismissal proof for click and `Escape`

Recorded in:

- `evidence/208-v81-mobile-breadth-t4-acceptance.md`

## Next bounded candidate

1. none inside the accepted bounded lane
2. keep broad module-level responsive reflow out of scope unless `Mobile` is explicitly rechartered again
