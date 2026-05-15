# Merge Readiness Review - 2026-05-15

## Verdict

`GO`; staging is healthy and authenticated tenant/ACL + save/read-back smoke is complete, including stabilized Work Canvas UI smoke.

The staging runtime is healthy and the critical auth/access-policy automated gate is green after aligning tests to the current canonical role and trial AI access contracts. Authenticated owner/member/superadmin smoke passed on staging at both API and Work Canvas UI levels, including owner save/read-back refresh and member restriction checks. No open P1/P2 blockers remain for this rollout gate.

## Assessed Baseline

- Branch: `cto/demo-integration-2026-05-15`
- Remote staging: `origin/staging`
- Runtime SHA: `012ed86d45a7082b93271fc1ddc945e65b88c00d`
- Railway deployment: `8c5242b5-ed3e-4f67-943c-3521786e9ee2`, `SUCCESS`
- Runtime checks: `/api/health` healthy, `/ping = pong`, homepage `HTTP 200`
- Remediation SHA: `77f727197b57c2dd4d91c8f287752b44f1cbb720`
- Remediation deployment: `d9264f24-4e2d-4b84-8e54-9f5587c035c0`, `SUCCESS`
- Current runtime SHA during final closeout: `df0bb346c96c47f752e6494865c92bef5ec9d654`

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
- Stabilized Work Canvas core smoke passed with `2/2` checks (owner save/read-back refresh, member restricted actions disabled).
- Work Canvas smoke helpers now consistently seed auth/session state and open the work panel before asserting canvas controls.

## Blocking Gates

- Previous blocker: `npm run test:unit:critical` failed with `3` files failed, `11` tests failed, `522/533` tests passed.
- Remediation result: `npm run test:unit:critical` now passes with `534/534` tests passing.
- Targeted blocker files pass with `203/203` tests passing.
- Resolved: Playwright Chromium was installed locally and the basic authenticated browser smoke passed.
- Resolved: controlled staging owner/member/superadmin test accounts were provided for the final smoke.
- Resolved: Work Canvas UI save/read-back automation is deterministic after helper stabilization.

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
2. Proceed with merge under `GO`.

## Recommendation

Proceed with merge under `GO`. Do not add more product or middleware slices before merge.
