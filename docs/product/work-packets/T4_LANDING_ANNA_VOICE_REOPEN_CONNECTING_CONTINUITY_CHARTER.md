# T4 Charter - Landing Anna voice reopen connecting continuity

Date: 2026-03-26
Lane: `Landing Anna voice reopen connecting continuity`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After the text reopen-in-flight continuity cut landed, the next smallest residual was stale voice `connecting` callbacks from a
prior attempt surviving a close/reopen cycle on the public widget.

## Goal

Promote one bounded `Landing Anna voice reopen connecting continuity` slice that reduces mixed truth across:

1. the public widget close/reopen cycle
2. in-flight voice-attempt callback state
3. the expectation that a fresh reopen should not inherit stale voice callbacks from the previous attempt

## In scope

1. one bounded voice-reopen-connecting-continuity packet
2. split-brain map for stale voice callbacks across close/reopen
3. invalidate prior voice-attempt callbacks on close/stop
4. ignore stale `onopen`, `onclose`, and `onerror` writes from superseded voice attempts
5. preserve current text continuity and other accepted widget behavior
6. focused regression proving a late `onopen` from the prior attempt does not surface after reopen
7. tracker/program/evidence updates

## Explicitly out of scope

1. broader voice UX or voice architecture changes
2. broader message-history reset behavior
3. Anna prompt-quality, multilingual behavior, or dashboarding work

## Packet 1

Completed:

- introduce a token for bounded voice-attempt continuity
- ignore stale `onopen`, `onclose`, and `onerror` callbacks from a prior attempt
- prevent a superseded voice session from taking over `sessionRef`
- add focused regression coverage for a late `onopen` after close/reopen

Recorded in:

- `evidence/308-v81-landing-anna-voice-reopen-connecting-continuity-split-brain-map.md`
- `evidence/309-v81-landing-anna-voice-reopen-connecting-continuity-seam.md`

## Acceptance

Accepted in:

- `evidence/310-v81-landing-anna-voice-reopen-connecting-continuity-t4-acceptance.md`

Residual visible backlog:

1. Anna prompt-quality and multilingual expansion
2. broader voice UX or architecture work
3. any separately promoted backend analytics or dashboarding breadth
