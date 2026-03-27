# T4 Charter - Landing Anna degraded fallback

Date: 2026-03-26
Lane: `Landing Anna degraded fallback`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Landing Anna language fallback` closed unsupported-language continuity, but one bounded contract gap still remained: the
Anna public contract requires a static "assistant unavailable" message when the AI backend is down, while the live runtime and
widget still used older "try again" fallback copy.

## Goal

Promote one bounded `Landing Anna degraded fallback` slice that reduces mixed truth across:

1. Anna's degraded-state contract for AI service unavailability
2. the live `/api/public/anna/chat` runtime fallback
3. the widget's local network-failure fallback copy

## In scope

1. one bounded degraded-state packet
2. split-brain map for contract-vs-runtime degraded fallback truth
3. static service-unavailable response from the public Anna route
4. matching widget fallback copy for request failures before backend response
5. tracker/program/evidence updates

## Explicitly out of scope

1. Anna voice-mode degraded behavior
2. prompt or retrieval redesign
3. Anna analytics or placement breadth
4. broader landing IA / copy / visual-system work

## Packet 1

Completed:

- align Anna route fallback to the contract-required static unavailable message
- align widget local request-failure copy to the same degraded-state message
- add focused route and widget regressions

Recorded in:

- `evidence/240-v81-landing-anna-degraded-fallback-split-brain-map.md`
- `evidence/241-v81-landing-anna-degraded-fallback-seam.md`

## Acceptance

Accepted in:

- `evidence/242-v81-landing-anna-degraded-fallback-t4-acceptance.md`

Residual visible backlog:

1. broader Anna analytics, prompt-quality, voice-mode degraded handling, or placement work
2. broader landing IA / copy / visual-system work outside Anna degraded fallback
