# V8.1 Evidence - Landing page redesign Tools Footer Shell Parity Seam

Date: 2026-03-26
Lane: `Landing page redesign`
Taxonomy: `T4`
Packet: `tools footer shell parity`

## Goal

Close the next bounded `Landing page redesign` seam by moving `/tools` off its bespoke footer and onto the same shared
landing footer contract used by the rest of the public marketing surface.

## What changed

1. `src/views/ToolsShowcasePage.tsx`
   - removes the bespoke page footer
   - reuses the shared `EntryFooter`
2. `tests/components/ToolsShowcasePage.footer-parity.test.tsx`
   - proves the shared landing footer CTA block is present
   - proves `/tools` now exposes the canonical shared `Become Partner` footer link

## Why it matters

Before this packet, `/tools` still ended in route-specific footer chrome even though it already used the shared landing
topbar. That left the route only half-inside the redesign system.

After this packet, `/tools` participates in the same shared topbar/footer shell contract as the other canonical public
landing routes.

## Verification

- `npx vitest run tests/components/ToolsShowcasePage.footer-parity.test.tsx --maxWorkers=1 --maxConcurrency=2`
