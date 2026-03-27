# V8.1 Evidence - Landing Anna reopen error reset Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna reopen error reset`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the open-telemetry integrity cut, the next smallest residual was stale transient request-error UI surviving a fresh reopen
of the public widget.

## Surface truth before promotion

Anna reopen state still diverged across the public widget:

1. a failed text request set the transient `error` banner on the live widget
2. closing the widget hid that banner but did not clear the underlying transient error state
3. reopening the widget showed the stale request-error banner again even though the visitor had started a fresh visible session

## Why this is a real split-brain

The widget looked like a fresh reopen but still carried transient failure state from the prior closed session.

## Bounded packet

This lane is narrowed to one packet:

1. clear stale transient request-error state on a real fresh open transition
2. preserve current message-history continuity
3. prove close/reopen after failure no longer shows the stale error banner
4. leave broader history reset, prompting, and voice work outside this packet
