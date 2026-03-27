# T4 Charter - Landing Anna handoff

Date: 2026-03-26
Lane: `Landing Anna handoff`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Landing docs truth` closed the stale claim that Anna was missing from the landing experience, but the live widget still
left a bounded contract gap: the assistant contract requires visible `Demo`, `Trial`, and `Contact` handoff paths, while
the widget only exposed conversation starters and free-text chat.

## Goal

Promote one bounded `Landing Anna handoff` slice that reduces mixed truth across:

1. the live `AnnaAssistantWidget` surface on canonical `/`
2. the shared landing demo/trial conversion contract
3. Anna's degraded-state CTA continuity requirement in the public contract

## In scope

1. one bounded Anna handoff packet
2. split-brain map for contract-vs-surface handoff truth
3. widget-level `Demo`, `Trial`, and `Contact` handoff controls
4. canonical `/` wiring of Anna handoffs to the shared landing callbacks
5. tracker/program/evidence updates

## Explicitly out of scope

1. broader Anna prompt or knowledge-base redesign
2. Anna rate-limiting or unsupported-language work
3. landing copy, section-order, or visual-system redesign
4. Teresa/onboarding flow changes after authenticated entry

## Packet 1

Completed:

- add explicit `Demo`, `Trial`, and `Contact` CTA handoff controls to `AnnaAssistantWidget`
- route Anna handoffs on canonical `/` through the shared landing modal/contact contract
- add focused regressions for widget CTA authority and homepage wiring

Recorded in:

- `evidence/228-v81-landing-anna-handoff-split-brain-map.md`
- `evidence/229-v81-landing-anna-handoff-cta-authority-seam.md`

## Acceptance

Accepted in:

- `evidence/230-v81-landing-anna-handoff-t4-acceptance.md`

Residual visible backlog:

1. broader Anna LP conversation-quality, unsupported-language, or analytics work
2. broader landing IA / copy / visual-system work outside the bounded handoff slice
