# T4 Charter - Mobile / Landing

Date: 2026-03-26
Lane: `Mobile / Landing`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Mobile` and broad `Landing page` redesign were previously held in the deferred `T4` parking lot and required explicit
product unlock. That unlock is now granted. The smallest honest starting point is not a broad responsive redesign, but
one route-authority seam on the live public landing surface.

## Goal

Promote one bounded `Mobile / Landing` slice that reduces mixed truth across:

1. public landing route authority
2. marketing vs in-app pricing entry semantics
3. the canonical public entry surface before broader mobile breadth

## In scope

1. one bounded `Mobile / Landing` packet at a time
2. split-brain map for frontend surfaces, runtime contracts, and evidence
3. canonical route authority for the first visible public landing seam
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. broad landing redesign
2. whole-app mobile responsiveness pass
3. authenticated workspace mobile layout redesign
4. partner/mobile app shell expansion
5. demo/trial narrative rewrite beyond route authority needs

## Initial bounded packet

Packet 1:

- canonicalize `/pricing` as the public marketing pricing route
- move the in-app pricing surface to its own canonical route authority
- align route and `AppView` helpers so rendered landing truth and route/store truth no longer drift

Why this first:

- it is the smallest live split-brain cut on the unlocked landing surface
- the current router exposes two different meanings for `/pricing`
- it fixes route truth without reopening broad mobile or visual redesign scope

Recorded in:

- `evidence/199-v81-mobile-landing-split-brain-map.md`

## Packet 1

Completed:

- keep `/pricing` as the public marketing pricing authority
- move in-app pricing to `/app/pricing`
- align `APP_VIEW_TO_ROUTE`, `getAppViewFromRoute()`, and `getAppViewFromPath()` with the new split
- add bounded regression for pricing route authority

Recorded in:

- `evidence/200-v81-mobile-landing-pricing-route-authority-seam.md`

## Packet 2

Completed:

- restore public landing nav continuity inside the narrow-viewport mobile menu
- expose the same public marketing route links on mobile that already exist on desktop topbar nav
- add stable mobile-menu test hooks and bounded regression for mobile nav continuity

Recorded in:

- `evidence/201-v81-mobile-landing-mobile-nav-continuity-seam.md`

## Packet 3

Completed:

- restore `Become Partner` CTA continuity inside the narrow-viewport landing mobile menu
- keep desktop/mobile public CTA authority aligned for the topbar entry surface
- extend the bounded mobile-menu regression to cover partner CTA continuity

Recorded in:

- `evidence/202-v81-mobile-landing-mobile-partner-cta-continuity-seam.md`

## Acceptance position

This lane is ready for bounded `T4` acceptance because the canonical public landing now has:

1. coherent public vs in-app pricing route authority
2. coherent mobile-menu public route continuity
3. coherent mobile-menu partner CTA continuity
4. refreshed real Playwright proof for the current narrow-viewport public landing surface

Recorded in:

- `evidence/203-v81-mobile-landing-t4-acceptance.md`

## Next bounded candidate

1. none inside the currently accepted bounded lane
2. keep broad landing redesign and whole-app mobile reflow out of scope unless explicitly rechartered
