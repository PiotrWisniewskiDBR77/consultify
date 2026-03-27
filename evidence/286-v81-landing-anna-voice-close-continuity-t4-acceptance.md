# V8.1 Evidence - Landing Anna voice close continuity T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna voice close continuity`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna voice close continuity` packet is accepted.

## What is now true

1. both public widget close affordances now stop active Anna voice sessions through the same teardown path
2. the existing `/api/public/anna/voice-event` continuity seam is preserved when voice is stopped via the floating launcher
3. focused regression coverage protects the launcher-close voice continuity seam

## Remaining backlog after acceptance

1. Anna prompt-quality and multilingual breadth remain deferred
2. broader voice UX or architecture work remains outside this accepted bounded cut
3. any separately promoted backend analytics or dashboard breadth remains out of scope
