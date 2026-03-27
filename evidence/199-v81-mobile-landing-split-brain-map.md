# V8.1 Evidence - Mobile / Landing Split-Brain Map

Date: 2026-03-26
Lane: `Mobile / Landing`
Taxonomy: `T4`
Status: `active`

## Why this lane is promoted now

`Mobile` and broad `Landing page` redesign were explicitly deferred inside the `T4` parking lot. After explicit
unlock, the lane needs a bounded starting point that does not pretend to complete either broad responsive redesign or
full marketing-site rework.

## Canonical product scope

The current docs constrain this lane:

- `docs/product/LANDING_V8_SSOT.md` defines landing IA and messaging authority, not a full redesign pass
- `docs/product/work-packets/POST_20_WAVE_CLOSURE_AUDIT.md` still treats broader mobile responsiveness as a carried gap
- `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md` keeps broad `Landing page` redesign and
  `Mobile` work in `T4` unless explicitly promoted in bounded slices

So the first packet should tighten one real public route seam, not open broad responsive or visual scope.

## Surface truth before promotion

The live public landing/public-entry surface currently mixes route authority:

1. `/` renders `ProductEntryPage`
2. `/pricing` renders `PricingLandingPage` as a public marketing surface
3. later in `AppRoutes`, `ROUTES.PRICING` also mounts `AppPricingView`
4. `APP_VIEW_TO_ROUTE` still maps `AppView.APP_PRICING` to the same `/pricing` URL

That means route/store truth and rendered route truth are not coherent for pricing entry authority.

## Bounded first packet

Packet 1 is narrowed to:

1. keep `/pricing` as the public marketing pricing route
2. move in-app pricing onto its own canonical route
3. align route/AppView helper truth with the rendered router truth
4. add bounded regression

## Explicitly not this packet

- broad landing redesign
- full mobile responsiveness pass
- authenticated app-shell mobile restructuring
- PWA/install surface breadth
- broad copy, asset, or narrative overhaul

## Why this is the right first slice

This is the smallest real `Mobile / Landing` cut because it fixes one live public route authority conflict at almost no
product-scope cost, while leaving broader mobile and landing redesign breadth honestly outside the packet.
