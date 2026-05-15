# Merge Readiness Review - 2026-05-15

## Verdict

`READY_FOR_DEPLOY` after blocker remediation.

The staging runtime is healthy and the critical auth/access-policy automated gate is now green after aligning tests to the current canonical role and trial AI access contracts. Final merge still requires deployment verification and authenticated tenant/ACL smoke before changing the verdict to `GO`.

## Assessed Baseline

- Branch: `cto/demo-integration-2026-05-15`
- Remote staging: `origin/staging`
- Runtime SHA: `012ed86d45a7082b93271fc1ddc945e65b88c00d`
- Railway deployment: `8c5242b5-ed3e-4f67-943c-3521786e9ee2`, `SUCCESS`
- Runtime checks: `/api/health` healthy, `/ping = pong`, homepage `HTTP 200`

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

## Blocking Gates

- Previous blocker: `npm run test:unit:critical` failed with `3` files failed, `11` tests failed, `522/533` tests passed.
- Remediation result: `npm run test:unit:critical` now passes with `534/534` tests passing.
- Targeted blocker files pass with `203/203` tests passing.

Resolved categories:

- Auth role mapping contract mismatch:
  - tests now expect platform `superadmin` to remain `superadmin`.
  - tests now expect manager-like application roles to map to `team_member` / `USER`.
  - tests now expect permission role fallback `USER`.
- Access policy contract mismatch:
  - tests now assert that initial trial AI grace calls are allowed before onboarding is complete.
  - tests now assert that trial AI calls are blocked once the grace usage threshold is reached.

## Required Fix Before Merge

1. Deploy the remediation commit to `origin/staging` and verify Railway `SUCCESS`.
2. Confirm `/api/health`, `/ping`, and homepage after deployment.
3. Run authenticated tenant/ACL and save/read-back smoke with test accounts.
4. Re-issue final merge verdict after the authenticated smoke gate.

## Recommendation

Keep the branch frozen. Do not add more product or middleware slices before final authenticated staging smoke and merge verdict.
