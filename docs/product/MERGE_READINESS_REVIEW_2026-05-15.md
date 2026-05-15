# Merge Readiness Review - 2026-05-15

## Verdict

`BLOCKED_ON_AUTHENTICATED_SMOKE`; staging is healthy, but final authenticated save/read-back smoke is not complete.

The staging runtime is healthy and the critical auth/access-policy automated gate is green after aligning tests to the current canonical role and trial AI access contracts. Safe final-smoke gates passed where credentials were not required, but the final merge verdict cannot move to `GO` until controlled staging owner/member credentials are available and the authenticated tenant/ACL save/read-back smoke passes.

## Assessed Baseline

- Branch: `cto/demo-integration-2026-05-15`
- Remote staging: `origin/staging`
- Runtime SHA: `012ed86d45a7082b93271fc1ddc945e65b88c00d`
- Railway deployment: `8c5242b5-ed3e-4f67-943c-3521786e9ee2`, `SUCCESS`
- Runtime checks: `/api/health` healthy, `/ping = pong`, homepage `HTTP 200`
- Remediation SHA: `77f727197b57c2dd4d91c8f287752b44f1cbb720`
- Remediation deployment: `d9264f24-4e2d-4b84-8e54-9f5587c035c0`, `SUCCESS`
- Current runtime SHA during final-smoke attempt: `d7be37e4ca275cdb1e03966a80ddb7c432391cca`

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

## Blocking Gates

- Previous blocker: `npm run test:unit:critical` failed with `3` files failed, `11` tests failed, `522/533` tests passed.
- Remediation result: `npm run test:unit:critical` now passes with `534/534` tests passing.
- Targeted blocker files pass with `203/203` tests passing.
- Authenticated browser smoke is blocked locally because Playwright Chromium is not installed.
- Authenticated tenant/ACL save/read-back smoke is blocked because `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`, `E2E_MEMBER_EMAIL`, and `E2E_MEMBER_PASSWORD` are not configured locally.

Resolved categories:

- Auth role mapping contract mismatch:
  - tests now expect platform `superadmin` to remain `superadmin`.
  - tests now expect manager-like application roles to map to `team_member` / `USER`.
  - tests now expect permission role fallback `USER`.
- Access policy contract mismatch:
  - tests now assert that initial trial AI grace calls are allowed before onboarding is complete.
  - tests now assert that trial AI calls are blocked once the grace usage threshold is reached.

## Required Fix Before Merge

1. Provide controlled staging owner/member test credentials through local env or CI secrets.
2. Install the Playwright browser runtime or run the smoke in CI where browsers are already provisioned.
3. Run authenticated tenant/ACL and save/read-back smoke with test accounts.
4. Re-issue final merge verdict after the authenticated smoke gate.

## Recommendation

Keep the branch frozen. Do not add more product or middleware slices before final authenticated staging smoke and merge verdict.
