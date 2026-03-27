# V8.1 Evidence - Landing Anna contact placement Seam

Date: 2026-03-26
Lane: `Landing Anna contact placement`
Taxonomy: `T4`
Status: `done`

## Seam closed

`src/views/legal/ContactView.tsx` now mounts `AnnaAssistantWidget` and routes Anna's demo/trial/contact actions through shared
page-level handlers.

## Regression

Focused regression:

1. `tests/components/ContactView.cta-authority.test.tsx`

Verified with:

1. `npm exec vitest run tests/components/ContactView.cta-authority.test.tsx tests/components/AuditsShowcasePage.cta-authority.test.tsx tests/components/ToolsShowcasePage.cta-authority.test.tsx tests/components/ResourcesPage.cta-authority.test.tsx tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

## Result

The contact surface now preserves the same public Anna availability pattern already established on `/`, shared-shell pages, and
the bespoke showcase pages.
