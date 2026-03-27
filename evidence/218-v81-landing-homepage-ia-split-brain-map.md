# V8.1 Evidence - Landing homepage IA Split-Brain Map

Date: 2026-03-26
Lane: `Landing homepage IA`
Taxonomy: `T4`
Status: `active`

## Why this lane is promoted now

`Landing page redesign` is already accepted for bounded live-route shell and CTA parity, but the canonical `/` homepage still
contains a separate information-architecture mismatch against `docs/product/LANDING_V8_SSOT.md`.

That residual homepage IA gap remains visible backlog and should be handled as its own bounded lane, not folded back into the
closed redesign slice.

## Canonical product scope

The current docs constrain this lane:

- `docs/product/LANDING_V8_SSOT.md` defines the canonical landing IA and explicitly requires topbar navigation links
  `Product`, `Pricing`, `Partners`, and `Help`
- `src/views/ProductEntryPage.tsx` is the canonical `/` public landing entry surface
- `src/components/Landing/EntryTopBar.tsx` is the shared topbar authority used on that surface

## Surface truth before promotion

The canonical homepage still mixed IA truth:

1. the SSOT topbar calls for four canonical public nav categories: `Product`, `Pricing`, `Partners`, `Help`
2. `EntryTopBar` shipped a different menu model: `Home`, `How it works`, `For whom`, `Our story`, `Resources`, `Pricing`,
   `Enterprise`
3. that meant the live canonical `/` surface advertised a navigation structure that no longer matched the landing SSOT

## Bounded first packet

Packet 1 is narrowed to:

1. canonicalize the shared landing topbar IA on `/` to `Product`, `Pricing`, `Partners`, `Help`
2. align both desktop dropdown and mobile menu to the same public IA authority
3. add focused regression coverage for the canonical nav structure and help/docs route continuity

## Explicitly not this lane

- broad homepage visual redesign
- full section-order rewrite across the entire landing page
- landing copy-system overhaul
- Anna assistant restoration
- demo/trial funnel redesign

## Why this is the right first slice

This is the smallest real canonical `/` IA cut because it restores the top-level public navigation contract on the live
homepage without reopening the already accepted route-shell parity lane.
