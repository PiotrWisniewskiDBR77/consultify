# V8.1 Evidence - Landing Anna open telemetry integrity Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna open telemetry integrity`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the voice-event integrity cut, the next smallest residual was duplicate open telemetry on the public Anna widget.

## Surface truth before promotion

Anna open-state telemetry still diverged across the public widget:

1. the widget exposed a normal closed-to-open transition through the floating launcher
2. the widget also listened for external `anna:open` events and routed them through the same `openWidget()` helper
3. `openWidget()` always emitted `landing_anna_widget_opened`, even when the widget was already open

## Why this is a real split-brain

Repeated open signals could create multiple open telemetry entries without any real new open transition on screen.

## Bounded packet

This lane is narrowed to one packet:

1. emit open telemetry only on a real closed-to-open transition
2. preserve current widget visibility behavior
3. prove repeated `anna:open` while visible does not create duplicate telemetry
4. leave broader analytics, prompting, and voice work outside this packet
