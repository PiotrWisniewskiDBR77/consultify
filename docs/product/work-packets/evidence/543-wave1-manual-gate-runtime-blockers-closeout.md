# 543 - Wave 1 manual gate runtime blockers closeout

## Scope

This pass records two runtime blockers discovered during live manual gate work after the code/evidence closeout of Wave 1 must-have modules.

## Blocker 1 - unauthenticated `My Work` crash

### Symptom

Opening `http://localhost:3000/my-work` as an unauthenticated user crashed into the global error boundary instead of routing cleanly to auth.

### Root cause

`AppProviders` only mounted `AccessPolicyProvider` for authenticated users, while `MainLayout` still rendered `DemoModeBanner`, which calls `usePolicySnapshot()`.

### Fix

- `src/providers/AppProviders.tsx`
  - Always mount the shared provider chain so access-policy consumers never render outside context.
- `tests/components/AppProviders.help-context.test.tsx`
  - Added a regression asserting the access policy provider still mounts on unauthenticated routes.

### Verification

- `npx vitest run tests/components/AppProviders.help-context.test.tsx`
- Live browser smoke:
  - Before fix: `Something went wrong`
  - After fix: clean auth redirect to `/login`

## Blocker 2 - superadmin policy snapshot noise on app surfaces

### Symptom

Opening `https://consultify.ai/my-work` with the active superadmin session triggered `GET /api/organization/policy-snapshot -> 500`.

The UI still rendered, but trial/policy contexts were making an invalid request path for a superadmin surface that is not supposed to behave like a trial/billing-scoped organization session.

### Fix

- `src/contexts/AccessPolicyContext.tsx`
  - Bypass policy snapshot fetches for `SUPERADMIN` / `SUPER_ADMIN`.
- `src/contexts/TrialContext.tsx`
  - Bypass trial snapshot fetches for `SUPERADMIN` / `SUPER_ADMIN`.
- `tests/components/policy-context.superadmin-bypass.test.tsx`
  - Added focused regressions proving both contexts stay passive for superadmin users and do not call `fetch`.

### Verification

- `npx vitest run tests/components/AppProviders.help-context.test.tsx tests/components/policy-context.superadmin-bypass.test.tsx`
- Live browser observation on hosted app identified the bad request path and confirmed the fix target.

## Status

Wave 1 manual gate work surfaced real runtime issues, and both now have explicit code fixes plus regression coverage.

## Remaining truth

At the time this blocker closeout landed, the per-module manual gates were still open.

That is no longer the current state.

The later ratification in `548-v81-wave1-final-module-gate-ratification.md` closes the remaining Wave 1 module-gate debt and should be treated as the current authority for final module acceptance.
