# V8.1 Evidence - Landing Anna voice event integrity T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna voice event integrity`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna voice event integrity` packet is accepted.

## What is now true

1. the public widget posts `/voice-event` only for sessions that truly reached `live`
2. failed voice bootstrap paths no longer create false duration telemetry on later close or handoff actions
3. focused regression coverage protects this voice-event integrity seam

## Remaining backlog after acceptance

1. Anna prompt-quality and multilingual breadth remain deferred
2. broader voice UX or architecture work remains outside this accepted bounded cut
3. any separately promoted backend analytics or dashboard breadth remains out of scope
