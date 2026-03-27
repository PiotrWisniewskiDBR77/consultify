# V8.1 Evidence - Landing Anna open telemetry integrity T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna open telemetry integrity`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna open telemetry integrity` packet is accepted.

## What is now true

1. the public widget emits `landing_anna_widget_opened` only for a real open transition
2. repeated `anna:open` signals while the widget is already visible no longer create duplicate open telemetry
3. focused regression coverage protects this open-telemetry integrity seam

## Remaining backlog after acceptance

1. Anna prompt-quality and multilingual breadth remain deferred
2. broader voice UX or architecture work remains outside this accepted bounded cut
3. any separately promoted backend analytics or dashboard breadth remains out of scope
