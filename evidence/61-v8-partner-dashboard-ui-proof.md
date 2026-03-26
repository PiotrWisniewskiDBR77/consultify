# V8 partner dashboard continuity proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Service: `consultify`
Deployment: `ea4d1646-d450-4f16-8dde-447e2b09152d`

## Scope

Extend partner continuity onto the default connected dashboard surface so the routed `/partner` home no longer relies only on legacy dashboard reads.

## Shipped path

- reused the existing governed partner V8 runtime summary strip already shown on `Metrics`
- mounted the same strip on `DashboardSection`
- kept the legacy `/api/partners/dashboard` payload for the broader dashboard body while surfacing governed partner KPI truth from:
  - `/api/v8/partner/referral-analytics`
  - `/api/v8/partner/earnings-summary`

## Local verification

- `npx vitest run tests/components/partner/PartnerPortalView.test.tsx tests/unit/services/v8-partner-api.test.ts --maxWorkers=1 --maxConcurrency=1`
- `ReadLints` returned no diagnostics for the edited partner view and test

## Live staging proof

1. Opened authenticated partner portal on staging.
2. The session initially landed on partner onboarding (`tab=partner-home`), so the partner profile was connected through the existing onboarding flow.
3. Navigated to `https://stage.consultinity.ai/partner?tab=dashboard&ts=1774469900`.

Observed UI continuity:

- the default connected dashboard rendered `V8 Runtime Summary`
- the dashboard still rendered the existing legacy overview cards and actions below it

Observed governed network requests from the live dashboard surface:

- `GET /api/v8/partner/referral-analytics?days=30` -> `200`
- `GET /api/v8/partner/earnings-summary` -> `200`
- legacy dashboard body still loaded through `GET /api/partners/dashboard` -> `200`

## Honest closure read

The partner portal now proves governed V8 continuity not only on secondary tabs (`metrics`, `earnings`, `payouts`, `referrals`) but also on the connected default dashboard route itself.

Remaining partner gap is still the deeper lifecycle/data-migration work already tracked in the ledger, not absence of a governed V8 surface on partner home/dashboard.
