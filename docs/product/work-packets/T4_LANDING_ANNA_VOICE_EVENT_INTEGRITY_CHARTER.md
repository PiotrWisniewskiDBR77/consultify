# T4 Charter - Landing Anna voice event integrity

Date: 2026-03-26
Lane: `Landing Anna voice event integrity`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After the voice close-continuity cut landed, the next smallest residual was false `/voice-event` reporting when public voice
bootstrap failed before the session ever reached `live`.

## Goal

Promote one bounded `Landing Anna voice event integrity` slice that reduces mixed truth across:

1. the public widget voice bootstrap lifecycle
2. the existing `/api/public/anna/voice-event` seam
3. the real distinction between failed setup and a true live voice session

## In scope

1. one bounded voice-event integrity packet
2. split-brain map for false postback risk before live voice actually starts
3. ensure `/voice-event` is emitted only after the session reaches `live`
4. preserve current live-session stop reporting
5. focused regression proving failed voice bootstrap does not create a false voice-event
6. tracker/program/evidence updates

## Explicitly out of scope

1. broader voice UX, streaming, or architecture work
2. Anna prompt-quality or multilingual-behavior changes
3. analytics dashboards or broader landing redesign

## Packet 1

Completed:

- align voice lifecycle bookkeeping so reporting starts only after the public session truly reaches `live`
- prevent failed microphone/bootstrap attempts from generating a false `/voice-event` postback
- add focused regression coverage for failed voice setup followed by widget close

Recorded in:

- `evidence/288-v81-landing-anna-voice-event-integrity-split-brain-map.md`
- `evidence/289-v81-landing-anna-voice-event-integrity-seam.md`

## Acceptance

Accepted in:

- `evidence/290-v81-landing-anna-voice-event-integrity-t4-acceptance.md`

Residual visible backlog:

1. Anna prompt-quality and multilingual expansion
2. broader voice UX or architecture work beyond this bounded integrity seam
3. any separately promoted backend analytics or dashboarding breadth
