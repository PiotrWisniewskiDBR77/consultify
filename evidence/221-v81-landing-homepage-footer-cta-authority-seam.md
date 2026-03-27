# V8.1 Evidence - Landing homepage IA Footer CTA Authority Seam

Date: 2026-03-26
Lane: `Landing homepage IA`
Taxonomy: `T4`
Packet: `footer CTA authority`

## Goal

Close the next bounded `Landing homepage IA` seam by aligning footer `Demo` and `Trial` actions on the canonical `/`
surface with the same shared conversion contract used by the rest of the homepage.

## What changed

1. `src/components/Landing/EntryFooter.tsx`
   - adds optional shared `onDemoClick` and `onTrialClick` callbacks
   - routes footer `Demo` and `Trial` through those callbacks when provided
   - keeps safe href fallbacks for other public surfaces still reusing the footer
   - normalizes trial fallback to canonical `/trial`
2. `src/views/ProductEntryPage.tsx`
   - passes the homepage shared demo/trial handlers into `EntryFooter`
3. `tests/components/EntryFooter.cta-authority.test.tsx`
   - proves footer `Demo` and `Trial` use shared callbacks when present
   - proves href fallbacks remain intact when callbacks are absent

## Why it matters

Before this packet, the canonical `/` homepage used a shared modal-backed conversion contract in topbar, hero, and updated
knowledge preview, but footer product CTAs still diverged through raw links.

After this packet, the homepage now keeps one coherent conversion authority across its shared public shell.

## Verification

- `npx vitest run tests/components/EntryFooter.cta-authority.test.tsx --maxWorkers=1 --maxConcurrency=2`
