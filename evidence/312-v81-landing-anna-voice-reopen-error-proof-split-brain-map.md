# V8.1 Evidence - Landing Anna voice reopen error proof Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna voice reopen error proof`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the voice reopen connecting continuity cut, the remaining bounded residual was a proof gap rather than a new runtime bug:
stale `onerror` behavior after close/reopen was protected in code but not yet explicitly locked by regression.

## Surface truth before promotion

The public widget had accepted runtime protection for superseded voice attempts, but proof still lagged in one focused place:

1. stale `onerror` writes from a prior voice attempt were already gated by the current voice-attempt token
2. regression coverage existed for late `onopen` but not for late `onerror`
3. this left a narrow proof gap around the reopened widget's stale-error continuity

## Why this is still worth a bounded packet

The runtime seam was already closed, but the proof surface still had a small uncovered path where a future regression could
quietly reintroduce stale error state after reopen.

## Bounded packet

This lane is narrowed to one packet:

1. add focused regression for late `onerror` after close/reopen
2. prove the reopened widget keeps the clean current-session voice hint
3. leave broader voice UX, architecture, and prompt work outside this packet
