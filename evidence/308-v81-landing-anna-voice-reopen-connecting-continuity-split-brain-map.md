# V8.1 Evidence - Landing Anna voice reopen connecting continuity Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna voice reopen connecting continuity`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the text reopen-in-flight continuity cut, the next smallest residual was stale voice `connecting` callbacks from a prior
attempt surviving widget close/reopen on the public surface.

## Surface truth before promotion

Anna voice continuity still diverged across the public widget:

1. a visitor could start voice mode and close the widget while the voice attempt was still connecting
2. stale callback paths such as `onopen`, `onclose`, or `onerror` from that prior attempt could still resolve later
3. those late callbacks could still write voice state into the widget after close/reopen
4. reopening the widget could therefore inherit live or error truth from a previous connecting attempt

## Why this is a real split-brain

The widget looked like a fresh reopen but could still accept async voice lifecycle truth from a superseded attempt.

## Bounded packet

This lane is narrowed to one packet:

1. invalidate prior voice-attempt callbacks on close/stop
2. prevent stale callbacks from writing live, idle, or error state into the reopened widget
3. prove a late `onopen` from the prior attempt does not surface after reopen
4. leave broader voice UX, architecture, and prompt work outside this packet
