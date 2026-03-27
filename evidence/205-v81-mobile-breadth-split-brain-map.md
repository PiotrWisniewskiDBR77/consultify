# V8.1 Evidence - Mobile breadth Split-Brain Map

Date: 2026-03-26
Lane: `Mobile breadth`
Taxonomy: `T4`
Status: `active`

## Why this lane is promoted now

`Mobile / Landing` already closed the public-entry mobile continuity slice. The remaining mobile backlog is broader, but it
still needs bounded cuts. The first authenticated seam sits on the live bottom navigation that every narrow-viewport
session can reach.

## Canonical product scope

The current docs constrain this lane:

- `docs/ui-standards/FROZEN_LAYOUTS.md` freezes sidebar order and prevents stealth IA rewrites
- `docs/product/work-packets/T4_MOBILE_LANDING_CHARTER.md` explicitly leaves authenticated shell/mobile breadth out of scope
- `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md` keeps broader `Mobile` work in `T4` unless it is
  explicitly promoted as one bounded slice

So the first packet should tighten one live authenticated mobile authority seam, not claim a full responsive pass.

## Surface truth before promotion

The current authenticated mobile shell mixes navigation authority:

1. `src/components/navigation/Sidebar/menuConfig.ts` defines canonical frozen entry points:
   - `Initiatives` -> `AppView.PORTFOLIO_ROADMAP`
   - `Tools` assessment entry -> `AppView.ASSESSMENT_OVERVIEW`
2. `src/components/navigation/BottomNavigation.tsx` still sends:
   - `Initiatives` -> `AppView.FULL_STEP2_INITIATIVES`
   - `Licensed Tools` -> `AppView.ASSESSMENT_DRD`
3. the bottom-nav active state only treats `FULL_STEP2_INITIATIVES` as active, so canonical/legacy initiative paths do not
   share one mobile truth

That means frozen sidebar truth and thumb-navigation truth are not coherent on authenticated mobile.

## Bounded first packet

Packet 1 is narrowed to:

1. align bottom-nav `Initiatives` with canonical `PORTFOLIO_ROADMAP`
2. align bottom-nav `Licensed Tools` with canonical `ASSESSMENT_OVERVIEW`
3. keep historical initiative aliases active until broader cleanup is explicitly promoted
4. add bounded regression

## Explicitly not this packet

- whole-app mobile redesign
- bottom-nav IA expansion
- sidebar/menu order changes
- module-level responsive rewrites
- mobile `AI` flow continuity beyond noting it as the next candidate

## Why this is the right first slice

This is the smallest real `Mobile breadth` cut because it removes mixed route authority from the primary authenticated
thumb-nav surface without changing frozen layouts, shell structure, or broad responsive behavior claims.
