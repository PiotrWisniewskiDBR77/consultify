# V8.1 Evidence - Landing Anna about placement Seam

Date: 2026-03-26
Lane: `Landing Anna about placement`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/views/legal/AboutView.tsx` now mounts `AnnaAssistantWidget` and routes Anna's demo/trial/contact actions through shared
page-level handlers.

## Regression

Focused regression:

1. `tests/components/AboutView.cta-authority.test.tsx`

Verified with:

1. `npm exec vitest run tests/components/AboutView.cta-authority.test.tsx tests/components/ContactView.cta-authority.test.tsx tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The about surface now preserves the same public Anna availability pattern already established on other accepted landing and legal
surfaces.
