# V8.1 Evidence - Broader Partner Payout Settings Ownership Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Packet: nineteenth broader packet

## Why this packet

After the dashboard runtime-summary and trust-progression placeholder cuts landed, the next honest active residual was returning to partner `payout-settings` ownership.

This was now bounded because:

- the active `EarningsSection` still showed fully placeholder `payout-settings` UI with hard-coded bank data and no save contract
- the runtime already used partner-owned `payout_threshold` and `payout_method` during payout requests
- the schema already had `partner_payout_accounts` for partner-scoped payout account details

That made the next honest cut a real partner-authenticated read/write seam for payout settings, not another dashboard placeholder migration.

## What changed

1. Added shared partner payout-settings runtime service in `server/src/services/partnerPayoutSettingsService.ts`:
   - reads partner-owned threshold, payout method, and auto-payout flag from `partner_organizations`
   - reads and decrypts the primary payout account from `partner_payout_accounts`
   - updates partner-owned settings and creates or updates the primary payout account

2. Added partner-authenticated payout-settings routes:
   - legacy fallback routes in `server/src/routes/partners.routes.ts` over `/api/partners/payout-settings`
   - V8-first routes in `server/src/routes/v8/partner.routes.ts` over `/api/v8/partner/payout-settings`

3. Added the missing partner-owned schema field in `server/migrations/20260327_partner_owned_payout_settings.sql`:
   - `partner_organizations.auto_payout_enabled`

4. Extended the frontend client in `src/services/api/v8/partner.ts`:
   - added typed V8 payout-settings read and update methods

5. Rewired the active payout-settings surface in `src/views/partner/sections/EarningsSection.tsx`:
   - removed hard-coded account and preference defaults as the only source of truth
   - loads payout settings V8-first with bounded fallback to legacy partner routes
   - saves payout settings through the new partner-authenticated seam

## Regression coverage

- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
  - partner-authenticated payout-settings read and update resolve `partnerOrgId`
- `tests/unit/services/v8-partner-api.test.ts`
  - V8 payout-settings client read and write contracts
- `tests/components/partner/EarningsSection.v8-payout-settings.test.tsx`
  - active payout-settings surface prefers governed V8 contract and falls back on bounded compatibility errors
- `tests/components/partner/EarningsSection.v8-payout-request.test.tsx`
  - existing payout request/read continuity still holds after the ownership seam lands

## Verification

Executed:

```bash
npx vitest run server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/unit/services/v8-partner-api.test.ts tests/components/partner/EarningsSection.v8-payout-settings.test.tsx tests/components/partner/EarningsSection.v8-payout-request.test.tsx
```

Result:

- 56 tests passed

## Remaining residuals after this packet

- `CommissionIntelligence` still depends on placeholder `deals` and has no governed partner-authenticated deal-pipeline runtime contract yet

## Outcome

The active partner payout-settings surface no longer depends on hard-coded account and preference placeholders.
It now reads and writes partner-owned payout settings through governed V8-first seams with bounded fallback, while `CommissionIntelligence` remains the only explicit heavier residual in the broader partner lane.
