# V8.1 Evidence - Landing Anna pricing placement Seam

Date: 2026-03-26
Lane: `Landing Anna pricing placement`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/views/PricingView.tsx` now mounts `AnnaAssistantWidget` and routes Anna's demo/trial/contact actions through shared
page-level handlers.

## Regression

Focused regression:

1. `tests/components/PricingView.cta-authority.test.tsx`

Verified with:

1. `npm exec vitest run tests/components/PricingView.cta-authority.test.tsx tests/components/SecurityView.cta-authority.test.tsx tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The pricing surface now preserves the same public Anna availability pattern already established on the other accepted public
landing shells.
