# V8.1 Evidence - Landing Anna reopen draft reset T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna reopen draft reset`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna reopen draft reset` packet is accepted.

## What is now true

1. the public widget no longer carries stale unsent draft input into a fresh reopen
2. close/reopen after typing but not sending now returns the visitor to a clean composer state
3. focused regression coverage protects this reopen-draft-reset seam

## Remaining backlog after acceptance

1. Anna prompt-quality and multilingual breadth remain deferred
2. broader voice UX or architecture work remains outside this accepted bounded cut
3. any separately promoted backend analytics or dashboard breadth remains out of scope
