# Merge Readiness Review - 2026-05-15

## Verdict

`GO_WITH_P2_UI_SMOKE_FOLLOWUP`; staging is healthy and authenticated API tenant/save/read-back smoke passed, with a remaining UI automation stabilization follow-up.

The staging runtime is healthy and the critical auth/access-policy automated gate is green after aligning tests to the current canonical role and trial AI access contracts. Authenticated owner/member/superadmin API smoke passed on staging, including save/read-back, artifact promotion read-back, member capability denial, and private draft isolation. UI automation still needs stabilization because Work Canvas deeplink rendering is sensitive to demo-session state; this is tracked as P2 follow-up rather than a tenant/security blocker.

## Assessed Baseline

- Branch: `cto/demo-integration-2026-05-15`
- Remote staging: `origin/staging`
- Runtime SHA: `012ed86d45a7082b93271fc1ddc945e65b88c00d`
- Railway deployment: `8c5242b5-ed3e-4f67-943c-3521786e9ee2`, `SUCCESS`
- Runtime checks: `/api/health` healthy, `/ping = pong`, homepage `HTTP 200`
- Remediation SHA: `77f727197b57c2dd4d91c8f287752b44f1cbb720`
- Remediation deployment: `d9264f24-4e2d-4b84-8e54-9f5587c035c0`, `SUCCESS`
- Current runtime SHA during final-smoke attempt: `5890455bf822b752a5a091dfd5d4df381682a557`

## Scope Size

- Commits ahead of `origin/main`: `291`
- Diff summary: `4149 files changed`, `478185 insertions`, `118786 deletions`
- Largest changed areas:
  - `src`: `2225` files
  - `docs`: `755` files
  - `server`: `713` files
  - `tests`: `410` files

## Passing Gates

- Production build: passing with larger Node heap.
- Wave 5 middleware regression gate: `73/73` passing.
- Railway deployment status: `SUCCESS`.
- Live runtime probes: `/api/health`, `/ping`, homepage all healthy.
- Unauthenticated API probes returned controlled `401` responses.
- Live headers did not expose `X-Powered-By`; security headers were present.
- Static Organization Context Engine smoke passed with `41/41` checks.
- Cross-application Organization Context Engine audit passed with `6/6` checks and no forbidden frontend ingestion imports.
- Read-only tenant split audit passed for real staging tenants `vts,dbr77`; required orgs present, forbidden org `org-dbr77-system` absent.
- Authenticated browser auth smoke passed with `3/3` checks.
- Authenticated API smoke passed for owner, member, and superadmin test accounts.
- API smoke covered owner create/read/update/read-back, artifact promotion read-back, member proposal approval denial with `403 CANVAS_PROPOSAL_CAPABILITY_REQUIRED`, member isolation from owner private draft with `404`, and superadmin create/read-back.
- Work Canvas UI deeplink loaded when seeded with the full demo session state used by the smoke helpers.

## Blocking Gates

- Previous blocker: `npm run test:unit:critical` failed with `3` files failed, `11` tests failed, `522/533` tests passed.
- Remediation result: `npm run test:unit:critical` now passes with `534/534` tests passing.
- Targeted blocker files pass with `203/203` tests passing.
- Resolved: Playwright Chromium was installed locally and the basic authenticated browser smoke passed.
- Resolved: controlled staging owner/member/superadmin test accounts were provided for the final smoke.
- P2 follow-up: Work Canvas UI save/read-back automation is not fully deterministic without the expected demo-session localStorage state, even though the authenticated API save/read-back gate passed.

Resolved categories:

- Auth role mapping contract mismatch:
  - tests now expect platform `superadmin` to remain `superadmin`.
  - tests now expect manager-like application roles to map to `team_member` / `USER`.
  - tests now expect permission role fallback `USER`.
- Access policy contract mismatch:
  - tests now assert that initial trial AI grace calls are allowed before onboarding is complete.
  - tests now assert that trial AI calls are blocked once the grace usage threshold is reached.

## Required Fix Before Merge

1. Keep branch frozen for merge.
2. Stabilize the Work Canvas Playwright smoke helper so deeplink tests always seed the required demo-session state before asserting UI save/read-back.
3. Re-run UI smoke after merge as a P2 release-candidate follow-up.

## Recommendation

Proceed as `GO_WITH_P2_UI_SMOKE_FOLLOWUP` if the team accepts API-level tenant/save/read-back evidence as the merge gate. Do not add more product or middleware slices before merge; handle UI smoke stabilization as a focused follow-up.
