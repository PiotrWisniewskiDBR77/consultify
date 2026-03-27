# V8.1 broader Partner referred-customer lifecycle readback seam

Date: 2026-03-27
Lane: broader `Partner Program` parity
Taxonomy: `T4`
Packet: fifth bounded packet after broader-lane promotion

## Why this packet

After payout-history, statement-history, referred-customer list continuity, and referral-tools body reads
moved onto governed seams, the next smallest customer-facing residual inside the active partner portal was
the referred-customer surface still rendering only a thin list despite the governed attribution seam already
carrying richer lifecycle fields.

That residual was real and active:

- the active `referred-organizations` subsection already consumed governed attribution records
- those records already included lifecycle depth such as signup completion, first payment, commission rate, duration, and lifetime value
- the portal still reduced that governed seam to name, status, attribution date, and commission-earned summary only
- this was smaller and more honest than jumping into onboarding/client-access breadth or inventing new referral mutations

This made referred-customer lifecycle readback the next honest broader-partner packet.

## What changed

### Governed seam usage

- reused the existing governed attribution seam already exposed through `V8PartnerApi.getAttributions()`
- reused bounded compatibility fallback to legacy `GET /api/partners/attributions` only for compatibility statuses
- no new runtime mutation or onboarding contract was introduced in this packet

### Active surface continuity

- updated `src/views/partner/sections/ReferralToolsSection.tsx`
- the referred-customer normalization boundary now preserves lifecycle fields from governed attribution records
- each referred-customer card now renders lifecycle readback for signup completion, first payment, commission rate, commission duration, and lifetime value when present
- the active partner portal now exposes governed lifecycle depth instead of only a thin customer list
- onboarding breadth, client-access breadth, and placeholder-only `payout-settings` save remain outside this packet

## Regression coverage

Passed:

- `tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`

Verification command:

`npx vitest run tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`

Result: `8` tests passing.

## Residual after this packet

Broader `Partner Program` parity is still not done.

Remaining honest residuals include:

- onboarding breadth outside the governed referral summary and referred-customer readback surfaces
- client-access onboarding/link generation breadth, which is still feature-unavailable rather than a thin missing seam
- placeholder-only `payout-settings` save behavior, which still lacks a real backend contract
