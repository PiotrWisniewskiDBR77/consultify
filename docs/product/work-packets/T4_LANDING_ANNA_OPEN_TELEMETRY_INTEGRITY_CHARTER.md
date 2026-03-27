# T4 Charter - Landing Anna open telemetry integrity

Date: 2026-03-26
Lane: `Landing Anna open telemetry integrity`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

After the voice-event integrity cut landed, the next smallest residual was duplicate `widget_opened` telemetry when repeated
open signals arrived while the public widget was already visible.

## Goal

Promote one bounded `Landing Anna open telemetry integrity` slice that reduces mixed truth across:

1. the floating widget open transition
2. the `anna:open` external open signal
3. the existing `landing_anna_widget_opened` funnel telemetry seam

## In scope

1. one bounded open-telemetry integrity packet
2. split-brain map for duplicate open-event risk while already open
3. ensure open telemetry fires only on a real closed-to-open transition
4. preserve the current visible widget UX
5. focused regression proving repeated `anna:open` does not emit duplicate open telemetry while visible
6. tracker/program/evidence updates

## Explicitly out of scope

1. broader Anna analytics or dashboarding work
2. voice UX or voice architecture changes
3. Anna prompt-quality or multilingual-behavior changes

## Packet 1

Completed:

- guard `openWidget()` so repeated open requests are ignored while the widget is already open
- preserve the current widget visibility behavior for genuine open transitions
- add focused regression coverage for repeated `anna:open` while visible

Recorded in:

- `evidence/292-v81-landing-anna-open-telemetry-integrity-split-brain-map.md`
- `evidence/293-v81-landing-anna-open-telemetry-integrity-seam.md`

## Acceptance

Accepted in:

- `evidence/294-v81-landing-anna-open-telemetry-integrity-t4-acceptance.md`

Residual visible backlog:

1. Anna prompt-quality and multilingual expansion
2. broader voice UX or architecture work
3. any separately promoted backend analytics or dashboarding breadth
