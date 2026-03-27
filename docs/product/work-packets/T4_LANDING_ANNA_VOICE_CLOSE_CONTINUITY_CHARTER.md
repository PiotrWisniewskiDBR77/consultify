# T4 Charter - Landing Anna voice close continuity

Date: 2026-03-26
Lane: `Landing Anna voice close continuity`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After the public Anna analytics cut landed, the next smallest residual was inconsistent close behavior in the live voice flow.

## Goal

Promote one bounded `Landing Anna voice close continuity` slice that reduces mixed truth across:

1. the floating `Ask Anna` launcher close path
2. the in-panel `Close Anna` action
3. the existing `/api/public/anna/voice-event` continuity seam

## In scope

1. one bounded voice close-continuity packet
2. split-brain map for inconsistent launcher-close behavior during live voice
3. align the floating launcher close path with the in-panel close action
4. preserve the existing voice teardown and `/voice-event` continuity
5. focused regression proving live voice is stopped when the launcher closes the widget
6. tracker/program/evidence updates

## Explicitly out of scope

1. broader voice architecture or streaming changes
2. Anna prompt-quality or multilingual-behavior changes
3. analytics dashboards or broader landing redesign

## Packet 1

Completed:

- align the floating launcher close path so it stops an active voice session before dismissing the widget
- preserve the existing voice teardown and `/voice-event` postback seam
- add focused regression coverage for launcher-close continuity in live voice mode

Recorded in:

- `evidence/284-v81-landing-anna-voice-close-continuity-split-brain-map.md`
- `evidence/285-v81-landing-anna-voice-close-continuity-seam.md`

## Acceptance

Accepted in:

- `evidence/286-v81-landing-anna-voice-close-continuity-t4-acceptance.md`

Residual visible backlog:

1. Anna prompt-quality and multilingual expansion
2. broader voice UX or architecture work beyond this bounded close-continuity seam
3. any separately promoted backend analytics or dashboarding breadth
