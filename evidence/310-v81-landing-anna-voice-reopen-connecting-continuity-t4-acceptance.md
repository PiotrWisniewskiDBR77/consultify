# V8.1 Evidence - Landing Anna voice reopen connecting continuity T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna voice reopen connecting continuity`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna voice reopen connecting continuity` packet is accepted.

## What is now true

1. stale voice callbacks from a prior connecting attempt no longer surface live or error state after reopen
2. late `onopen` from a superseded attempt no longer revives live voice in the reopened widget
3. focused regression coverage protects this voice-reopen-connecting-continuity seam

## Remaining backlog after acceptance

1. Anna prompt-quality and multilingual breadth remain deferred
2. broader voice UX or architecture work remains outside this accepted bounded cut
3. any separately promoted backend analytics or dashboard breadth remains out of scope
