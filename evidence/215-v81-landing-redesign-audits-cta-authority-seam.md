# V8.1 Evidence - Landing page redesign Audits CTA Authority Seam

Date: 2026-03-26
Lane: `Landing page redesign`
Taxonomy: `T4`
Packet: `audits CTA authority`

## Goal

Close the next bounded `Landing page redesign` seam by aligning `/audits` topbar `Demo` and `Trial` actions with the
same shared modal CTA contract used by the canonical public landing surface.

## What changed

1. `src/views/AuditsShowcasePage.tsx`
   - routes topbar `Demo` and `Trial` through `DemoModeModal`
   - aligns modal success handling with the canonical marketing demo/trial flow
   - keeps the page-specific audit CTA buttons otherwise unchanged
2. `tests/components/AuditsShowcasePage.cta-authority.test.tsx`
   - proves topbar `Trial` opens the shared modal in `trial` mode
   - proves topbar `Demo` opens the shared modal in `demo` mode

## Why it matters

Before this packet, `/audits` reused the shared topbar visually but still sent `Demo` and `Trial` into a different route
flow than the rest of the public marketing surface.

After this packet, the route now shares both shell and topbar CTA authority with the canonical landing experience.

## Verification

- `npx vitest run tests/components/AuditsShowcasePage.cta-authority.test.tsx --maxWorkers=1 --maxConcurrency=2`
