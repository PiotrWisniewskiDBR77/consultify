# T4 Charter - Landing Anna voice degraded fallback

Date: 2026-03-26
Lane: `Landing Anna voice degraded fallback`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Landing Anna degraded fallback` closed the main chat-path unavailable message, but one bounded residual still remained: the
voice surface continued to expose technical setup details and a separate voice-start failure copy instead of the same
visitor-safe degraded-state guidance.

## Goal

Promote one bounded `Landing Anna voice degraded fallback` slice that reduces mixed truth across:

1. Anna's no-technical-details degraded-state contract
2. the live voice-unavailable hint on the widget
3. the live voice-start failure fallback on the widget

## In scope

1. one bounded voice degraded-state packet
2. split-brain map for contract-vs-widget voice degraded behavior
3. align visitor-facing voice unavailable/error copy to the static degraded-state message
4. focused regression proving no technical setup details leak on the voice surface
5. tracker/program/evidence updates

## Explicitly out of scope

1. Anna voice architecture redesign
2. realtime voice transport or microphone permission handling changes
3. Anna analytics, prompt-quality, or placement breadth
4. broader landing IA / copy / visual-system work

## Packet 1

Completed:

- align voice-unavailable and voice-start-failure copy to the same contract-safe degraded-state message
- remove visitor-facing references to browser setup / API key configuration from the live widget
- add focused widget regression proving the public surface no longer exposes technical setup details

Recorded in:

- `evidence/244-v81-landing-anna-voice-degraded-fallback-split-brain-map.md`
- `evidence/245-v81-landing-anna-voice-degraded-fallback-seam.md`

## Acceptance

Accepted in:

- `evidence/246-v81-landing-anna-voice-degraded-fallback-t4-acceptance.md`

Residual visible backlog:

1. broader Anna analytics, prompt-quality, multilingual expansion, or placement breadth
2. any deeper Anna voice architecture or permission-handling work
