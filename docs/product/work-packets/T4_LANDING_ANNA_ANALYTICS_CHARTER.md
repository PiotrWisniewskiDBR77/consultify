# T4 Charter - Landing Anna analytics

Date: 2026-03-26
Lane: `Landing Anna analytics`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After the public Anna placement series landed, the next smallest residual was missing widget telemetry on the live public
assistant itself.

## Goal

Promote one bounded `Landing Anna analytics` slice that reduces mixed truth across:

1. the live `AnnaAssistantWidget` surface
2. existing landing funnel tracking seams
3. fallback and handoff observability for the public assistant

## In scope

1. one bounded widget telemetry packet
2. split-brain map for missing Anna widget telemetry
3. track widget open events on the public surface
4. track text-message send, handoff CTA, and fallback exposure events
5. focused regressions proving telemetry now fires without breaking placement continuity
6. tracker/program/evidence updates

## Explicitly out of scope

1. analytics dashboards or backend reporting surfaces
2. deeper voice architecture, prompting, or multilingual-behavior changes
3. broader landing or pricing UX redesign

## Packet 1

Completed:

- instrument `AnnaAssistantWidget` with bounded funnel telemetry for open, message send, handoff CTA, and fallback exposure
- keep the existing public widget behavior unchanged while adding observability
- add focused regression coverage for telemetry plus pricing-shell continuity

Recorded in:

- `evidence/280-v81-landing-anna-analytics-split-brain-map.md`
- `evidence/281-v81-landing-anna-analytics-seam.md`

## Acceptance

Accepted in:

- `evidence/282-v81-landing-anna-analytics-t4-acceptance.md`

Residual visible backlog:

1. Anna prompt-quality, multilingual expansion, and deeper voice implementation work
2. any separately promoted backend analytics or dashboarding breadth for Anna
