# V8.1 Evidence - Mobile / Landing T4 Acceptance

Date: 2026-03-26
Lane: `Mobile / Landing`
Taxonomy: `T4`
Decision: `accepted bounded lane`

## Acceptance basis

`Mobile / Landing` is ready for bounded `T4` acceptance because the active public landing surface now has one coherent
entry chain for the bounded scope:

1. `/pricing` is the canonical public marketing pricing route
2. in-app pricing no longer competes for the same URL
3. narrow-viewport mobile menu exposes the same public landing nav authority as desktop
4. narrow-viewport mobile menu also preserves `Become Partner` CTA continuity
5. Playwright proof now targets the real current landing/mobile flow and passes locally

## Why this is enough

The bounded lane goal was not a broad landing redesign or a whole-app mobile responsiveness pass. The goal was to make
the canonical public landing route and topbar/mobile entry semantics honest on the live public surface.

That split is now closed without reopening:

- broad landing page redesign
- global mobile app-shell reflow
- deeper workspace/mobile authenticated UX changes

## Evidence chain

- `evidence/199-v81-mobile-landing-split-brain-map.md`
- `evidence/200-v81-mobile-landing-pricing-route-authority-seam.md`
- `evidence/201-v81-mobile-landing-mobile-nav-continuity-seam.md`
- `evidence/202-v81-mobile-landing-mobile-partner-cta-continuity-seam.md`

## Verification

- `npx vitest run tests/unit/routes/routeConfig.test.ts`
- `npx vitest run tests/components/Landing/EntryTopBar.mobile-nav.test.tsx`
- `E2E_MODE=true E2E_USE_WEB_SERVER=true npx playwright test tests/e2e/mobile-responsive.spec.ts --project=chromium`
