# T4 Charter - Landing Anna reopen draft reset

Date: 2026-03-26
Lane: `Landing Anna reopen draft reset`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After the reopen-error-reset cut landed, the next smallest residual was stale unsent draft input surviving a close/reopen cycle
on the public widget.

## Goal

Promote one bounded `Landing Anna reopen draft reset` slice that reduces mixed truth across:

1. the public widget close/reopen cycle
2. unsent draft input state
3. the expectation that a fresh open starts with a clean composer

## In scope

1. one bounded reopen-draft-reset packet
2. split-brain map for stale unsent draft state on reopen
3. clear stale draft input on a real fresh open transition
4. preserve current message history and other accepted widget behavior
5. focused regression proving a closed unsent draft does not survive reopen
6. tracker/program/evidence updates

## Explicitly out of scope

1. broader message-history reset behavior
2. voice UX or voice architecture changes
3. Anna prompt-quality, multilingual behavior, or dashboarding work

## Packet 1

Completed:

- clear stale unsent `input` state on a fresh widget open transition
- preserve current message history and the rest of the accepted widget continuity
- add focused regression coverage for close/reopen after drafting but not sending a message

Recorded in:

- `evidence/300-v81-landing-anna-reopen-draft-reset-split-brain-map.md`
- `evidence/301-v81-landing-anna-reopen-draft-reset-seam.md`

## Acceptance

Accepted in:

- `evidence/302-v81-landing-anna-reopen-draft-reset-t4-acceptance.md`

Residual visible backlog:

1. Anna prompt-quality and multilingual expansion
2. broader voice UX or architecture work
3. any separately promoted backend analytics or dashboarding breadth
