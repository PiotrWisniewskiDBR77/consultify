# V8.1 Evidence - Landing homepage IA Topbar Authority Seam

Date: 2026-03-26
Lane: `Landing homepage IA`
Taxonomy: `T4`
Packet: `canonical topbar IA authority`

## Goal

Close the first bounded `Landing homepage IA` seam by aligning the canonical `/` topbar navigation with the authority in
`docs/product/LANDING_V8_SSOT.md`.

## What changed

1. `src/components/Landing/EntryTopBar.tsx`
   - canonicalizes shared landing nav links to `Product`, `Pricing`, `Partners`, `Help`
   - routes those links through shared route constants instead of mixed raw strings
   - aligns both desktop dropdown and mobile menu to the same IA contract
   - keeps existing CTA controls such as `Become Partner`, `Demo`, and `Trial`
2. `tests/components/Landing/EntryTopBar.mobile-nav.test.tsx`
   - proves the canonical IA links appear in the mobile menu
   - proves `Help` routes to canonical `/docs`
   - proves the same IA links appear in the desktop dropdown

## Why it matters

Before this packet, the canonical `/` page reused the shared topbar component but still exposed a legacy navigation model
that diverged from the landing SSOT.

After this packet, the shared topbar on the homepage once again represents the documented public IA authority.

## Verification

- `npx vitest run tests/components/Landing/EntryTopBar.mobile-nav.test.tsx --maxWorkers=1 --maxConcurrency=2`
