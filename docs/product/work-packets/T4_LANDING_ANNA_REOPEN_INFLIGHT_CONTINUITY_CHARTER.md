# T4 Charter - Landing Anna reopen in-flight continuity

Date: 2026-03-26
Lane: `Landing Anna reopen in-flight continuity`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After the reopen-draft-reset cut landed, the next smallest residual was stale text loading and late Anna replies from a prior
visible session surviving a close/reopen cycle on the public widget.

## Goal

Promote one bounded `Landing Anna reopen in-flight continuity` slice that reduces mixed truth across:

1. the public widget close/reopen cycle
2. in-flight text request state
3. the expectation that a fresh reopen should not inherit late async outcomes from the previous visible session

## In scope

1. one bounded reopen-in-flight-continuity packet
2. split-brain map for stale loading and late reply state across close/reopen
3. invalidate prior visible-session text requests on close
4. clear visible text loading on close so reopen returns cleanly
5. preserve current message history and other accepted widget behavior
6. focused regression proving a late prior-session reply does not surface after reopen
7. tracker/program/evidence updates

## Explicitly out of scope

1. broader message-history reset behavior
2. voice UX or voice architecture changes
3. Anna prompt-quality, multilingual behavior, or dashboarding work

## Packet 1

Completed:

- introduce a visible-session token for text request continuity
- ignore stale text replies and fallback writes that resolve after the widget session is closed
- clear text loading when the widget closes
- add focused regression coverage for a late reply after close/reopen

Recorded in:

- `evidence/304-v81-landing-anna-reopen-inflight-continuity-split-brain-map.md`
- `evidence/305-v81-landing-anna-reopen-inflight-continuity-seam.md`

## Acceptance

Accepted in:

- `evidence/306-v81-landing-anna-reopen-inflight-continuity-t4-acceptance.md`

Residual visible backlog:

1. Anna prompt-quality and multilingual expansion
2. broader voice UX or architecture work
3. any separately promoted backend analytics or dashboarding breadth
