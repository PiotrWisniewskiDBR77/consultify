# V8.1 Evidence - Mobile / Landing Pricing Route Authority Seam

Date: 2026-03-26
Lane: `Mobile / Landing`
Taxonomy: `T4`
Packet: `pricing route authority`

## Goal

Close the first bounded `Mobile / Landing` split-brain seam by giving public marketing pricing and in-app pricing
separate canonical routes.

## What changed

1. `src/routes/routeConfig.ts`
   - adds `ROUTES.APP_PRICING = '/app/pricing'`
   - maps `AppView.APP_PRICING` to `/app/pricing` instead of `/pricing`
2. `src/routes/AppRoutes.tsx`
   - keeps public `PricingLandingPage` mounted at `/pricing`
   - moves `AppPricingView` to `/app/pricing`
3. `tests/unit/routes/routeConfig.test.ts`
   - adds regression proving marketing `/pricing` and in-app `/app/pricing` no longer resolve as the same route

## Why it matters

Before this packet, `/pricing` had two different meanings:

- the public marketing pricing landing page
- the in-app pricing view via `AppView.APP_PRICING`

That left route helper truth and rendered route truth out of sync.

After this packet, the public landing surface keeps `/pricing`, while in-app pricing has a separate canonical route at
`/app/pricing`.

## Verification

- `npx vitest run tests/unit/routes/routeConfig.test.ts`
