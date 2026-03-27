# V8.1 Evidence - Landing Anna voice reopen error proof T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna voice reopen error proof`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna voice reopen error proof` packet is accepted.

## What is now true

1. stale `onerror` from a superseded voice attempt is explicitly covered by focused regression after close/reopen
2. the reopened widget is protected against both late voice `onopen` and late voice `onerror` regressions
3. this packet adds proof coverage without broadening the accepted voice runtime scope

## Remaining backlog after acceptance

1. Anna prompt-quality and multilingual breadth remain deferred
2. broader voice UX or architecture work remains outside this accepted bounded cut
3. any separately promoted backend analytics or dashboard breadth remains out of scope
