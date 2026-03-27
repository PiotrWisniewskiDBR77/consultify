# T4 Charter - Landing Anna security placement

Date: 2026-03-26
Lane: `Landing Anna security placement`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After `AboutView` placement landed, the next smallest bespoke-shell residual was `SecurityView`, which already exposed public
topbar `demo` and `trial` authority but still omitted Anna.

## Goal

Promote one bounded `Landing Anna security placement` slice that reduces mixed truth across:

1. Anna's public placement breadth
2. the bespoke `SecurityView` shell
3. shared demo/trial/contact handoff continuity on that page

## In scope

1. one bounded `SecurityView` placement packet
2. split-brain map for Anna placement on `SecurityView`
3. mount `AnnaAssistantWidget` on `SecurityView`
4. wire shared demo/trial/contact authority into the page-level shell
5. focused regression proving `SecurityView` now exposes Anna
6. tracker/program/evidence updates

## Explicitly out of scope

1. pricing-page Anna placement work
2. Anna analytics, prompt-quality, multilingual expansion, or deeper voice implementation work
3. broader landing IA / copy / visual-system redesign

## Packet 1

Completed:

- place `AnnaAssistantWidget` on `SecurityView`
- route Anna handoffs through the page's existing demo/trial/contact authority
- add focused regression proving `SecurityView` now exposes Anna

Recorded in:

- `evidence/272-v81-landing-anna-security-placement-split-brain-map.md`
- `evidence/273-v81-landing-anna-security-placement-seam.md`

## Acceptance

Accepted in:

- `evidence/274-v81-landing-anna-security-placement-t4-acceptance.md`

Residual visible backlog:

1. pricing-page Anna placement work
2. Anna analytics, prompt-quality, multilingual expansion, or deeper voice implementation work
