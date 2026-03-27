# V8.1 Evidence - Broader Partner Dashboard Runtime Summary V8 Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Packet: seventeenth broader packet

## Why this packet

After the post-`CommissionView` assessment, the next honest heavier residual was broader commission/dashboard truth migration away from placeholder `usePartnerEcosystem` reads.

The smallest visible cut inside that breadth was the active analytics block on `PartnerDashboardView`:

- the screen still rendered placeholder ecosystem analytics from `src/hooks/usePartnerEcosystem.ts`
- the repo already had a governed runtime summary pattern built from live partner seams in `PartnerPortalView`
- those seams already existed over partner-authenticated `referral-analytics` and `earnings-summary` reads

This made the dashboard runtime-summary cutover smaller and more honest than reworking placeholder `payout-settings` ownership.

## What changed

1. Added shared runtime summary seam in `src/components/Partner/PartnerRuntimeSummaryStrip.tsx`:
   - extracts a reusable `PartnerRuntimeSummaryStrip`
   - adds `loadPartnerRuntimeSummary()` helper
   - uses V8-first reads for `referral-analytics` and `earnings-summary`
   - falls back in a bounded way to legacy `/api/partners/referral-analytics` and `/api/partners/earnings`
   - normalizes legacy payload shapes into one governed summary contract

2. Rewired `src/views/partner/PartnerDashboardView.tsx`:
   - removed the active placeholder `EcosystemAnalytics` block
   - kept trust progression explicitly separate and unchanged
   - now renders the shared governed runtime summary strip on the active dashboard surface

3. Reused the same shared seam in `src/views/partner/PartnerPortalView.tsx`:
   - removed duplicate local runtime-summary helper/component definitions
   - points both dashboard/metrics surfaces at the same shared partner runtime-summary contract

## Regression coverage

- `tests/unit/services/partner-runtime-summary.test.ts`
  - V8-first runtime summary reads
  - bounded fallback to legacy partner seams on compatibility errors
- `tests/components/partner/PartnerDashboardView.runtime-summary.test.tsx`
  - active partner dashboard now renders the governed runtime summary strip
- `tests/components/partner/PartnerPortalView.test.tsx`
  - existing partner portal dashboard still renders the shared runtime summary strip after extraction

## Verification

Executed:

```bash
npx vitest run tests/unit/services/partner-runtime-summary.test.ts tests/components/partner/PartnerDashboardView.runtime-summary.test.tsx tests/components/partner/PartnerPortalView.test.tsx
```

Result:

- 28 tests passed

## Remaining residuals after this packet

- deeper `CommissionIntelligence` / deal-pipeline truth is still placeholder-backed through `usePartnerEcosystem`
- trust progression on `PartnerDashboardView` is still placeholder/read-model breadth, not yet a governed runtime contract
- partner `payout-settings` save ownership remains unresolved and still requires an explicit partner-scoped write contract

## Outcome

The active partner dashboard no longer depends on placeholder ecosystem analytics for its primary runtime summary block.
The visible runtime summary now comes from shared partner-authenticated governed seams with bounded compatibility fallback, while deeper commission intelligence, trust progression, and payout-settings ownership remain explicit residuals.
