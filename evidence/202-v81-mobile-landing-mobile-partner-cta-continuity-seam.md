# V8.1 Evidence - Mobile / Landing Mobile Partner CTA Continuity Seam

Date: 2026-03-26
Lane: `Mobile / Landing`
Taxonomy: `T4`
Packet: `mobile partner CTA continuity`

## Goal

Close the next bounded `Mobile / Landing` seam by restoring `Become Partner` continuity inside the narrow-viewport
landing mobile menu.

## What changed

1. `src/components/Landing/EntryTopBar.tsx`
   - adds `Become Partner` to the mobile menu actions
   - routes that CTA to `/become-partner`
   - keeps the existing desktop CTA and public/mobile menu behavior aligned
2. `tests/components/Landing/EntryTopBar.mobile-nav.test.tsx`
   - extends the mobile-menu regression to assert `Become Partner` is present
   - adds regression proving partner CTA navigation closes the panel and routes correctly

## Why it matters

Before this packet, the desktop landing topbar exposed `Become Partner`, but the narrow-viewport mobile menu did not.
That left public CTA authority inconsistent across desktop and mobile on the same canonical landing surface.

After this packet, desktop and mobile now expose the same partner entry continuity from the landing topbar surface.

## Verification

- `npx vitest run tests/components/Landing/EntryTopBar.mobile-nav.test.tsx`
