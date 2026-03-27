# V8.1 Evidence - Landing Anna reopen draft reset Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna reopen draft reset`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the reopen-error-reset cut, the next smallest residual was stale unsent draft input surviving a fresh reopen of the
public widget.

## Surface truth before promotion

Anna reopen state still diverged across the public widget:

1. a visitor could type a draft into the widget composer without sending it
2. closing the widget hid the composer but did not clear the underlying unsent draft state
3. reopening the widget showed the stale draft again even though the visitor had started a fresh visible session

## Why this is a real split-brain

The widget looked like a fresh reopen but still carried unsent composer state from the prior closed session.

## Bounded packet

This lane is narrowed to one packet:

1. clear stale unsent draft input on a real fresh open transition
2. preserve current message-history continuity
3. prove close/reopen after drafting no longer shows the stale draft
4. leave broader history reset, prompting, and voice work outside this packet
