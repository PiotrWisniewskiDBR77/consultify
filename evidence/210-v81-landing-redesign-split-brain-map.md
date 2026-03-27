# V8.1 Evidence - Landing page redesign Split-Brain Map

Date: 2026-03-26
Lane: `Landing page redesign`
Taxonomy: `T4`
Status: `active`

## Why this lane is promoted now

The bounded `Mobile / Landing` lane is already accepted, but broad landing redesign remained visible deferred backlog.
That redesign is now explicitly unlocked. The first slice still needs to stay honest: one live public-shell seam, not a
full marketing rebuild.

## Canonical product scope

The current docs constrain this lane:

- `docs/product/LANDING_V8_SSOT.md` defines the canonical landing narrative and topbar/CTA architecture
- `docs/plans/DBR77_PRODUCT_WWW_PAGES_LAYOUT_GUIDE.md` treats `EntryTopBar` and shared landing components as the canonical
  public shell pattern
- `docs/product/work-packets/T4_MOBILE_LANDING_CHARTER.md` explicitly left broad landing redesign outside the accepted
  mobile-continuity lane

So the first packet should tighten one live public redesign seam, not open a full copy/asset/IA program.

## Surface truth before promotion

The public landing/marketing surface currently mixes shell authority:

1. `ProductEntryPage` and several public views use the shared landing shell contract through `EntryTopBar` and
   `MarketingLayout`
2. `/become-partner` is a live marketing route but `src/views/BecomePartnerView.tsx` ships its own bespoke header/footer
3. that bespoke shell bypasses the shared mobile menu, shared footer/legal block, and the canonical topbar CTA contract

That means the public redesign surface does not currently behave like one coherent marketing system.

## Bounded first packet

Packet 1 is narrowed to:

1. move `/become-partner` onto the shared marketing shell
2. preserve direct partner-portal access so the redesign does not regress existing entry behavior
3. add focused regression proving the route now uses shared landing chrome

## Explicitly not this packet

- homepage hero redesign
- full landing IA rewrite
- broad copy refresh
- demo/trial CTA normalization across every public route
- deprecating legacy non-routed landing files

## Why this is the right first slice

This is the smallest real `Landing page redesign` cut because it upgrades one live route from bespoke marketing chrome to
the canonical shared shell with minimal runtime risk and clear visual continuity payoff.
