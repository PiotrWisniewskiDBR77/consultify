# T4 Charter - Landing Anna contact placement

Date: 2026-03-26
Lane: `Landing Anna contact placement`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After closing the public showcase pages, the next smallest bespoke-shell residual was `ContactView`, which already acts as a
handoff destination for Anna but still did not expose Anna itself.

## Goal

Promote one bounded `Landing Anna contact placement` slice that reduces mixed truth across:

1. Anna's public handoff-to-contact contract
2. the bespoke `ContactView` shell
3. shared demo/trial/contact handoff continuity on that page

## In scope

1. one bounded `ContactView` placement packet
2. split-brain map for Anna placement on `ContactView`
3. mount `AnnaAssistantWidget` on `ContactView`
4. wire shared demo/trial/contact authority into the page-level shell
5. focused regression proving `ContactView` now exposes Anna
6. tracker/program/evidence updates

## Explicitly out of scope

1. `About`, `Security`, or `Pricing` bespoke-shell placement work
2. Anna analytics, prompt-quality, or deeper voice implementation work
3. broader landing IA / copy / visual-system redesign

## Packet 1

Completed:

- place `AnnaAssistantWidget` on `ContactView`
- route Anna handoffs through the page's existing demo/trial/contact authority
- add focused regression proving `ContactView` now exposes Anna

Recorded in:

- `evidence/264-v81-landing-anna-contact-placement-split-brain-map.md`
- `evidence/265-v81-landing-anna-contact-placement-seam.md`

## Acceptance

Accepted in:

- `evidence/266-v81-landing-anna-contact-placement-t4-acceptance.md`

Residual visible backlog:

1. bespoke Anna placement on `About`, `Security`, or `Pricing` pages
2. Anna analytics, prompt-quality, multilingual expansion, or deeper voice implementation work
