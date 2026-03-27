# V8.1 Evidence - Landing Anna reopen error reset T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna reopen error reset`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna reopen error reset` packet is accepted.

## What is now true

1. the public widget no longer carries the stale transient request-error banner into a fresh reopen
2. close/reopen after a failed request now returns the visitor to a clean transient-error state
3. focused regression coverage protects this reopen-error-reset seam

## Remaining backlog after acceptance

1. Anna prompt-quality and multilingual breadth remain deferred
2. broader voice UX or architecture work remains outside this accepted bounded cut
3. any separately promoted backend analytics or dashboard breadth remains out of scope
