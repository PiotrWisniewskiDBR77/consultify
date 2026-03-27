# V8.1 Evidence - Landing page redesign Become Partner Shell Parity Seam

Date: 2026-03-26
Lane: `Landing page redesign`
Taxonomy: `T4`
Packet: `become-partner marketing shell parity`

## Goal

Close the first bounded `Landing page redesign` seam by moving `/become-partner` onto the same shared marketing shell
contract used by the rest of the public landing funnel.

## What changed

1. `src/views/BecomePartnerView.tsx`
   - wraps the page in `MarketingLayout`
   - removes the bespoke fixed header/footer chrome
   - keeps partner-portal access as an explicit in-page CTA
   - aligns landing and register navigation with canonical route constants
2. `tests/components/BecomePartnerView.marketing-shell.test.tsx`
   - proves the shared landing topbar chrome is present
   - proves shared footer/legal chrome is present
   - proves partner-portal navigation is preserved after the shell change

## Why it matters

Before this packet, `/become-partner` looked and behaved like a separate marketing micro-site rather than part of the
same public landing system.

After this packet, the route participates in the same topbar/footer/mobile-shell contract as the rest of the public
marketing surface, while preserving the key partner portal entry action.

## Verification

- `npx vitest run tests/components/BecomePartnerView.marketing-shell.test.tsx --maxWorkers=1 --maxConcurrency=2`
