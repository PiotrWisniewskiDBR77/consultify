# T4 Charter - Landing page redesign

Date: 2026-03-26
Lane: `Landing page redesign`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Mobile / Landing` already closed narrow route/mobile continuity on the public surface, but it explicitly kept broad
landing redesign out of scope. That redesign is now explicitly unlocked. The honest starting point is still bounded: one
public shell-consistency cut on a live marketing route.

## Goal

Promote one bounded `Landing page redesign` slice that reduces mixed truth across:

1. public marketing shell consistency
2. canonical landing topbar/footer reuse across marketing routes
3. live redesign seams between bespoke public pages and the shared landing contract

## In scope

1. one bounded `Landing page redesign` packet at a time
2. split-brain map for public frontend/runtime/proof surfaces
3. first visible redesign seam on a canonical marketing route
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. full visual rebrand or asset-production pass
2. broad marketing copy rewrite
3. whole landing IA rewrite on `/`
4. demo/trial funnel redesign across every public page
5. authenticated shell or mobile breadth work already handled elsewhere

## Initial bounded packet

Packet 1:

- move `/become-partner` onto the shared marketing shell
- reuse `EntryTopBar` and `EntryFooter` instead of a bespoke page chrome
- preserve direct access to the partner portal inside the page body
- add focused regression for shell parity

Why this first:

- it is the smallest visible redesign cut on a live public route
- `/become-partner` currently diverges most sharply from the shared landing shell contract
- it improves desktop/mobile marketing continuity without pretending to redesign the whole homepage

Recorded in:

- `evidence/210-v81-landing-redesign-split-brain-map.md`

## Packet 1

Completed:

- wrap `BecomePartnerView` in the shared `MarketingLayout`
- remove bespoke header/footer chrome from `/become-partner`
- preserve partner-portal access with an explicit in-page CTA
- add focused regression proving shared landing shell chrome is present

Recorded in:

- `evidence/211-v81-landing-redesign-become-partner-shell-parity-seam.md`

## Packet 2

Completed:

- move `/tools` off its bespoke footer onto the shared `EntryFooter`
- extend shell parity from the shared public topbar to the shared public footer
- add focused regression for shared footer CTA presence on `/tools`

Recorded in:

- `evidence/212-v81-landing-redesign-tools-footer-shell-parity-seam.md`

## Packet 3

Completed:

- align `/resources` topbar `Demo` and `Trial` actions to the shared modal-backed CTA contract
- preserve page-specific resource/video content flows while removing topbar CTA drift
- add focused regression for `/resources` CTA authority

Recorded in:

- `evidence/213-v81-landing-redesign-resources-cta-authority-seam.md`

## Packet 4

Completed:

- align `/tools` topbar `Demo` and `Trial` actions to the shared modal-backed CTA contract
- preserve page-specific tool CTA buttons while removing topbar CTA drift
- add focused regression for `/tools` CTA authority

Recorded in:

- `evidence/214-v81-landing-redesign-tools-cta-authority-seam.md`

## Packet 5

Completed:

- align `/audits` topbar `Demo` and `Trial` actions to the shared modal-backed CTA contract
- preserve page-specific audit CTA buttons while removing topbar CTA drift
- add focused regression for `/audits` CTA authority

Recorded in:

- `evidence/215-v81-landing-redesign-audits-cta-authority-seam.md`

## Next bounded candidate

Accepted in:

- `evidence/216-v81-landing-page-redesign-t4-acceptance.md`

Residual visible backlog:

1. one separately promoted canonical `/` IA mismatch slice, if explicitly unlocked later
