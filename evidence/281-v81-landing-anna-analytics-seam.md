# V8.1 Evidence - Landing Anna analytics Seam

Date: 2026-03-26
Lane: `Landing Anna analytics`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/components/Landing/AnnaAssistantWidget.tsx` now emits bounded funnel telemetry when the public widget is opened, when a text
message is sent, when a demo/trial/contact handoff is triggered, and when a fallback state is surfaced.

## Regression

Focused regressions:

1. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`
2. `tests/components/PricingView.cta-authority.test.tsx`

Verified with:

1. `npm exec vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx tests/components/PricingView.cta-authority.test.tsx`

## Result

The public Anna widget now has a thin telemetry trail aligned with the already accepted landing CTA and placement seams.
