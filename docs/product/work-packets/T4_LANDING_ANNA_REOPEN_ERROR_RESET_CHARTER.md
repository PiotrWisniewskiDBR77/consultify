# T4 Charter - Landing Anna reopen error reset

Date: 2026-03-26
Lane: `Landing Anna reopen error reset`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After the open-telemetry integrity cut landed, the next smallest residual was stale transient request-error state surviving a
close/reopen cycle on the public widget.

## Goal

Promote one bounded `Landing Anna reopen error reset` slice that reduces mixed truth across:

1. the public widget close/reopen cycle
2. transient request-error banner state
3. the expectation that a fresh open returns the visitor to a clean session shell

## In scope

1. one bounded reopen-error-reset packet
2. split-brain map for stale transient error state on reopen
3. clear stale request-error state on a real fresh open transition
4. preserve current chat history and other accepted widget behavior
5. focused regression proving the stale transient error banner does not survive close/reopen
6. tracker/program/evidence updates

## Explicitly out of scope

1. broader message-history reset behavior
2. voice UX or voice architecture changes
3. Anna prompt-quality, multilingual behavior, or dashboarding work

## Packet 1

Completed:

- clear stale transient `error` state on a fresh widget open transition
- preserve current message history and the rest of the accepted widget continuity
- add focused regression coverage for close/reopen after a failed request

Recorded in:

- `evidence/296-v81-landing-anna-reopen-error-reset-split-brain-map.md`
- `evidence/297-v81-landing-anna-reopen-error-reset-seam.md`

## Acceptance

Accepted in:

- `evidence/298-v81-landing-anna-reopen-error-reset-t4-acceptance.md`

Residual visible backlog:

1. Anna prompt-quality and multilingual expansion
2. broader voice UX or architecture work
3. any separately promoted backend analytics or dashboarding breadth
