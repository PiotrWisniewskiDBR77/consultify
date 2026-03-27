# V8.1 Evidence - Landing Anna reopen in-flight continuity Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna reopen in-flight continuity`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the reopen-draft-reset cut, the next smallest residual was stale text loading and late Anna replies from a prior visible
session surviving a close/reopen cycle on the public widget.

## Surface truth before promotion

Anna reopen state still diverged across the public widget:

1. a visitor could send a text request and then close the widget while the request was still in flight
2. the hidden widget could still carry `isLoading` state until that request settled
3. when the request eventually resolved, the old visible session could still append a reply or fallback into the widget state
4. reopening the widget could therefore inherit loading or late reply truth from a prior closed session

## Why this is a real split-brain

The widget looked like a fresh reopen but still accepted async text outcomes from a different, already closed visible session.

## Bounded packet

This lane is narrowed to one packet:

1. invalidate prior visible-session text requests on close
2. clear stale text loading on close
3. prove a late reply from the prior visible session does not surface after reopen
4. leave broader history reset, prompting, and voice work outside this packet
