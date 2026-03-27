# T4 Charter - Landing homepage IA

Date: 2026-03-26
Lane: `Landing homepage IA`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Landing page redesign` already closed the bounded live-route shell and CTA authority seams, but the canonical `/` homepage
still exposes a separate IA mismatch against `docs/product/LANDING_V8_SSOT.md`. That homepage IA residue is visible backlog
and should be handled as its own bounded lane.

## Goal

Promote one bounded `Landing homepage IA` slice that reduces mixed truth across:

1. canonical `/` public navigation authority
2. homepage information architecture vs `LANDING_V8_SSOT.md`
3. shared topbar/menu continuity on the live homepage surface

## In scope

1. one bounded `Landing homepage IA` packet at a time
2. split-brain map for canonical `/` frontend/doc/proof surfaces
3. first visible IA mismatch on the homepage public shell
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. broad homepage visual redesign
2. full section-order rewrite across the whole landing page
3. broad landing copy refresh
4. Anna assistant contract restoration
5. demo/trial funnel redesign

## Initial bounded packet

Packet 1:

- canonicalize the shared topbar IA on `/` to `Product`, `Pricing`, `Partners`, `Help`
- align both desktop dropdown and mobile menu to the same nav authority
- keep existing public CTA controls intact
- add focused regression for canonical nav IA and help/docs continuity

Why this first:

- it is the smallest real canonical `/` IA cut on the live homepage
- the mismatch is explicit in the SSOT and localized to a shared seam
- it improves both desktop and mobile public navigation without broadening into a full homepage rewrite

Recorded in:

- `evidence/218-v81-landing-homepage-ia-split-brain-map.md`

## Packet 1

Completed:

- align shared landing nav links to `Product`, `Pricing`, `Partners`, `Help`
- route `Help` to the canonical docs entry
- keep existing CTA actions while removing homepage nav drift
- add focused regression for mobile and desktop topbar IA continuity

Recorded in:

- `evidence/219-v81-landing-homepage-ia-topbar-authority-seam.md`

## Packet 2

Completed:

- align `KnowledgePreviewSection` CTA authority on canonical `/` to the shared trial conversion contract
- preserve a safe `/trial` fallback for non-homepage surfaces still reusing the component
- add focused regression for shared callback authority and fallback continuity

Recorded in:

- `evidence/220-v81-landing-homepage-knowledge-preview-cta-authority-seam.md`

## Packet 3

Completed:

- align footer `Demo` and `Trial` CTA authority on canonical `/` to the shared conversion contract
- preserve safe href fallbacks for non-homepage surfaces still using the shared footer
- add focused regression for footer callback authority and fallback continuity

Recorded in:

- `evidence/221-v81-landing-homepage-footer-cta-authority-seam.md`

## Acceptance

Accepted in:

- `evidence/222-v81-landing-homepage-ia-t4-acceptance.md`

Residual visible backlog:

1. one separately promoted canonical `/` section-order, copy, or visual-system slice, if explicitly unlocked later
