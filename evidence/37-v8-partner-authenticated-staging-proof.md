# V8 Partner Authenticated Staging Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `373626c6-7845-4a0b-af97-192e2a7c7fa1`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- live portal surface: `/partner`

## What was verified

Partner-authenticated staging proof:
- opening `/partner` in the authenticated browser session loads the live partner portal
- the portal initially showed the partner-profile onboarding state with CTA `Utwórz i podłącz profil`
- triggering that CTA successfully created and attached a partner profile for the current session, after which the portal advanced into the partner profile area (`/partner?tab=company-info`)
- with that same now-partner-authenticated browser session, the governed V8 partner endpoints returned success:
  - `GET /api/v8/partner/referral-analytics` -> `200`
  - `GET /api/v8/partner/earnings-summary` -> `200`

## Scope note

This removes the prior staging auth blocker, but does not prove full partner portal continuity on V8:
- the crucial blocker was whether a real session could obtain a valid `partnerOrgId` and successfully read the governed V8 partner slice on staging
- that is now proven from the live portal flow itself
- the broader partner portal still predominantly reads legacy partner endpoints, so this is partner-authenticated staging proof, not full UI continuity proof for all partner surfaces

Conclusion:
- Partner no longer lacks a viable partner-authenticated staging session
- the previous `403` caused by missing `partnerOrgId` is no longer the blocker
- remaining gap is routing broader portal surfaces through V8 and proving that continuity in-browser
