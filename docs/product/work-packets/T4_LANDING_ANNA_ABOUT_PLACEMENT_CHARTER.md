# T4 Charter - Landing Anna about placement

Date: 2026-03-26
Lane: `Landing Anna about placement`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After `ContactView` placement landed, the next smallest bespoke-shell residual was `AboutView`, which already exposed explicit
public `demo` and `trial` authority but still omitted Anna.

## Goal

Promote one bounded `Landing Anna about placement` slice that reduces mixed truth across:

1. Anna's public placement breadth
2. the bespoke `AboutView` shell
3. shared demo/trial/contact handoff continuity on that page

## In scope

1. one bounded `AboutView` placement packet
2. split-brain map for Anna placement on `AboutView`
3. mount `AnnaAssistantWidget` on `AboutView`
4. wire shared demo/trial/contact authority into the page-level shell
5. focused regression proving `AboutView` now exposes Anna
6. tracker/program/evidence updates

## Explicitly out of scope

1. `Security` or `Pricing` bespoke-shell placement work
2. Anna analytics, prompt-quality, multilingual expansion, or deeper voice implementation work
3. broader landing IA / copy / visual-system redesign

## Packet 1

Completed:

- place `AnnaAssistantWidget` on `AboutView`
- route Anna handoffs through the page's existing demo/trial/contact authority
- add focused regression proving `AboutView` now exposes Anna

Recorded in:

- `evidence/268-v81-landing-anna-about-placement-split-brain-map.md`
- `evidence/269-v81-landing-anna-about-placement-seam.md`

## Acceptance

Accepted in:

- `evidence/270-v81-landing-anna-about-placement-t4-acceptance.md`

Residual visible backlog:

1. bespoke Anna placement on `Security` or pricing pages
2. Anna analytics, prompt-quality, multilingual expansion, or deeper voice implementation work
