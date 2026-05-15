# Merge Readiness Review - 2026-05-15

## Verdict

`NO_GO / BLOCKED_P1` for merge to `main`.

The staging runtime is healthy, but the critical auth/access-policy automated gate is red. Do not merge until the role and trial access policy contract is decided and the critical gate passes.

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

- `npm run test:unit:critical` failed.
- Result: `3` files failed, `11` tests failed, `522/533` tests passed.

Blocking categories:

- Auth role mapping contract mismatch:
  - tests expect `superadmin -> owner`; current implementation preserves platform role as `superadmin`.
  - tests expect `manager -> project_manager`; current canonical app role model maps manager-like app roles to `team_member` / `USER`.
  - tests expect permission role `TEAM_MEMBER`; current permission normalization emits `USER` and bridges legacy candidates elsewhere.
- Access policy contract mismatch:
  - test expects trial AI calls to be blocked until onboarding is complete.
  - current implementation allows a three-call trial AI grace window before requiring setup completion.

## Required Fix Before Merge

1. Decide the canonical contract for auth/application/platform/permission roles.
2. Decide whether trial AI grace before onboarding is intended product behavior.
3. Update either tests or implementation to match those decisions.
4. Re-run:
   - `npm run test:unit:critical`
   - Wave 5 middleware regression gate
   - production build
   - Railway deploy/runtime health
   - authenticated tenant/ACL and save/read-back smoke
5. Re-issue merge verdict only after the gate is green.

## Recommendation

Freeze the branch and fix only these `BLOCKED_P1` gates. Do not add more product or middleware slices until merge readiness is restored.
