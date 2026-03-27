# V8.1 Evidence - Broader Partner Client Access Projects Read V8 Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After client-organizations list continuity moved onto the governed partner seam, the next honest split inside broader `client-access` was the active projects read shown on the partner portal.

`employees` still lacked a clean runtime truth for employee-to-client access mapping, and `access-links` was still only a placeholder button with no existing partner-scoped generation contract.
By contrast, the `projects` subsection was a pure read surface backed by existing `projects` rows linked to already-attributed customer organizations.

That made this the next smallest honest packet:

- it closes another visible `client-access` read without pretending employee or invite breadth is solved
- it reuses existing partner-attribution truth plus existing project rows
- it stays bounded to one active frontend consumer and one read contract

## What changed

1. Added a shared partner project read model in `server/src/services/partnerReferralService.ts`:
   - derives partner-visible projects by joining partner-attributed organizations to `projects`
   - keeps the result bounded to active/non-deleted project rows

2. Restored legacy read continuity in `server/src/routes/partners.routes.ts`:
   - `GET /api/partners/projects` now returns a real partner-scoped project list

3. Added a governed V8 read route in `server/src/routes/v8/partner.routes.ts`:
   - `GET /api/v8/partner/projects`
   - returns the same project list with governed partner meta

4. Extended `src/services/api/v8/partner.ts`:
   - added `V8PartnerApi.getProjects()`

5. Rewired the active frontend consumer in `src/views/partner/PartnerPortalView.tsx`:
   - the `projects` subsection inside `ClientsSection` now prefers the V8 project seam
   - bounded compatibility failures still fall back to legacy `/api/partners/projects`

6. Added bounded regressions:
   - V8 route/client coverage
   - partner portal project subsection coverage
   - legacy integration coverage for `/api/partners/projects`

## Regression coverage

Passed targeted regressions:

- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/components/partner/PartnerPortalView.v8-projects.test.tsx`
- `tests/integration/clients/client-endpoints.test.ts`

Run:

```bash
npx vitest run tests/unit/services/v8-partner-api.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/components/partner/PartnerPortalView.v8-projects.test.tsx tests/integration/clients/client-endpoints.test.ts
```

Result: `48` tests passed.

## Remaining residuals

This packet does not close:

- broader `client-access` employee-list continuity
- broader `client-access` access-link generation continuity
- broader client detail/write breadth
- broader statement-source migration
- placeholder-only partner `payout-settings` save continuity

## Outcome

The active partner `projects` subsection no longer depends on a placeholder-only legacy route during normal operation.
Visible client-access projects now follow a governed partner V8-first read seam with bounded compatibility fallback, while the remaining employee/access-link parts of `client-access` stay explicitly outside this packet.
