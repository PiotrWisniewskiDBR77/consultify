# V8.1 Evidence - Landing page redesign Resources CTA Authority Seam

Date: 2026-03-26
Lane: `Landing page redesign`
Taxonomy: `T4`
Packet: `resources CTA authority`

## Goal

Close the next bounded `Landing page redesign` seam by aligning `/resources` topbar `Demo` and `Trial` actions with the
same shared modal CTA contract used by the canonical public landing surface.

## What changed

1. `src/views/ResourcesPage.tsx`
   - routes topbar `Demo` and `Trial` through `DemoModeModal`
   - aligns modal success handling with the canonical marketing demo/trial flow
   - keeps the page-specific content CTA buttons otherwise unchanged
2. `tests/components/ResourcesPage.cta-authority.test.tsx`
   - proves topbar `Trial` opens the shared modal in `trial` mode
   - proves topbar `Demo` opens the shared modal in `demo` mode

## Why it matters

Before this packet, `/resources` reused the shared topbar visually but still sent `Demo` and `Trial` into a different
route flow than the rest of the public marketing surface.

After this packet, the route follows the same topbar CTA authority as the canonical landing experience without reopening
the page-specific content funnel.

## Verification

- `npx vitest run tests/components/ResourcesPage.cta-authority.test.tsx --maxWorkers=1 --maxConcurrency=2`
