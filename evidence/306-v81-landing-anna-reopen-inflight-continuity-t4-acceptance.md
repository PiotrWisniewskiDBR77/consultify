# V8.1 Evidence - Landing Anna reopen in-flight continuity T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna reopen in-flight continuity`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna reopen in-flight continuity` packet is accepted.

## What is now true

1. the public widget no longer carries stale text loading into a fresh reopen after close
2. late text replies and fallback writes from a prior visible session no longer surface after reopen
3. focused regression coverage protects this reopen-in-flight-continuity seam

## Remaining backlog after acceptance

1. Anna prompt-quality and multilingual breadth remain deferred
2. broader voice UX or architecture work remains outside this accepted bounded cut
3. any separately promoted backend analytics or dashboard breadth remains out of scope
