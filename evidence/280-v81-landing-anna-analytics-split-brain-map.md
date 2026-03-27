# V8.1 Evidence - Landing Anna analytics Split-Brain Map

Date: 2026-03-26
Lane: `Landing Anna analytics`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

After the public Anna placement breadth was closed, the next smallest residual was missing telemetry on the live public widget.

## Surface truth before promotion

Anna observability still diverged across the public assistant:

1. the widget already exposed handoff, fallback, and message flows on the live surface
2. the voice path had a dedicated `/api/public/anna/voice-event` seam
3. the text/widget surface had no matching frontend funnel telemetry for open, send, handoff, or fallback exposure

## Why this is a real split-brain

The public assistant had production-facing behavior but no equivalent lightweight funnel trail for its core text and CTA flows.

## Bounded packet

This lane is narrowed to one packet:

1. instrument the widget with bounded funnel events for open, send, handoff, and fallback exposure
2. keep current landing behavior unchanged
3. prove the telemetry with focused widget regressions
4. leave dashboards, reporting, and deeper voice/prompt work outside this packet
