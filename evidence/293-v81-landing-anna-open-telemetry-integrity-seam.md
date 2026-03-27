# V8.1 Evidence - Landing Anna open telemetry integrity Seam

Date: 2026-03-26
Lane: `Landing Anna open telemetry integrity`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/components/Landing/AnnaAssistantWidget.tsx` now ignores repeated `openWidget()` calls while the public widget is already
visible, so `landing_anna_widget_opened` is recorded only for a real open transition instead of for repeated `anna:open`
signals.

## Regression

Focused regression:

1. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

Verified with:

1. `npx vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The public Anna widget now keeps its open-state telemetry aligned with the visible UI state by recording one open event per
actual open transition.
