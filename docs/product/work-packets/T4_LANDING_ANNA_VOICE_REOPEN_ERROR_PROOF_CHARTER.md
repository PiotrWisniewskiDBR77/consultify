# T4 Charter - Landing Anna voice reopen error proof

Date: 2026-03-26
Lane: `Landing Anna voice reopen error proof`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After the voice reopen connecting continuity cut landed, the next smallest residual was not a fresh runtime bug but a remaining
proof gap around stale `onerror` callbacks after widget close/reopen.

## Goal

Promote one bounded `Landing Anna voice reopen error proof` slice that reduces mixed truth across:

1. the public widget close/reopen cycle
2. stale voice `onerror` callback proof coverage
3. the expectation that a superseded voice attempt cannot surface stale error state after reopen

## In scope

1. one bounded voice-reopen-error-proof packet
2. proof-gap map for stale `onerror` behavior after close/reopen
3. focused regression proving a late `onerror` from a superseded attempt is ignored
4. preserve the current production voice-attempt token behavior
5. tracker/program/evidence updates

## Explicitly out of scope

1. broader voice UX or voice architecture changes
2. broader message-history reset behavior
3. Anna prompt-quality, multilingual behavior, or dashboarding work

## Packet 1

Completed:

- document the remaining proof gap around stale `onerror` callbacks
- add focused regression coverage for a late `onerror` after close/reopen
- leave the already accepted production token seam unchanged

Recorded in:

- `evidence/312-v81-landing-anna-voice-reopen-error-proof-split-brain-map.md`
- `evidence/313-v81-landing-anna-voice-reopen-error-proof-seam.md`

## Acceptance

Accepted in:

- `evidence/314-v81-landing-anna-voice-reopen-error-proof-t4-acceptance.md`

Residual visible backlog:

1. Anna prompt-quality and multilingual expansion
2. broader voice UX or architecture work
3. any separately promoted backend analytics or dashboarding breadth
