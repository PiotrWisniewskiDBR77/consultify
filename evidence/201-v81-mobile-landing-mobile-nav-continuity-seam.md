# V8.1 Evidence - Mobile / Landing Mobile Nav Continuity Seam

Date: 2026-03-26
Lane: `Mobile / Landing`
Taxonomy: `T4`
Packet: `mobile nav continuity`

## Goal

Close the next bounded `Mobile / Landing` seam by restoring the public landing navigation links inside the
narrow-viewport mobile menu.

## What changed

1. `src/components/Landing/EntryTopBar.tsx`
   - adds stable test hooks for the mobile menu trigger and panel
   - restores the public `navLinks` set inside the mobile menu
   - keeps the existing demo/trial/login/sign-up actions intact
2. `tests/components/Landing/EntryTopBar.mobile-nav.test.tsx`
   - adds regression proving the mobile menu exposes the public landing nav links
   - adds regression proving mobile `Pricing` navigation closes the menu and routes to `/pricing`

## Why it matters

Before this packet, desktop topbar navigation exposed the public landing routes, but the narrow-viewport mobile menu
only exposed auth/demo actions. That meant mobile public users lost the same landing route authority that already
existed on desktop.

After this packet, mobile and desktop topbar navigation now share the same public landing route continuity.

## Verification

- `npx vitest run tests/components/Landing/EntryTopBar.mobile-nav.test.tsx tests/unit/routes/routeConfig.test.ts`
