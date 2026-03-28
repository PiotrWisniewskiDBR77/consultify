# Production Credential Hygiene Closeout Checklist

> Date: 2026-03-28
> Purpose: close the remaining wider-production blocker without interfering with the active broader `Notes` lane
> Scope: production account / credential operations only
> Status: ready to execute

---

## 1. Why this exists

`evidence/490-production-auth-guard-deploy-and-readiness-residual.md` and `evidence/491-v8-production-pilot-shadow-readiness-green.md` now agree on the remaining wider-production blocker:

- rollout telemetry is green,
- broader `Notes` remains the only active product lane,
- wider production promotion is still blocked by credential hygiene on affected production accounts.

This checklist creates a safe parallel workstream that does not require touching the active notebook / notes implementation path.

---

## 2. No-touch boundaries

Do not do any of the following as part of this checklist:

- edit notebook / notes runtime code
- change active broader `Notes` lane scope
- redeploy application code unless an emergency rollback is required
- widen V8 rollout scope before credential cleanup is verified

This is an ops / access-hygiene closeout only.

---

## 3. Required inputs

- list of affected production accounts
- approved operator with access to the production auth / identity surface
- approved rotation path for passwords or equivalent login secrets
- approved path to revoke or expire existing sessions if supported

---

## 4. Execution sequence

### Step 1 - Inventory the affected accounts

Record for each affected account:

- account identifier
- role / scope (`superadmin`, operator, other privileged account)
- why it is in scope for rotation
- who approved the change

### Step 2 - Rotate credentials

For each affected account:

- rotate the password or equivalent login secret
- avoid reusing any previously known weak value
- store the fresh credential only in the approved secret system

### Step 3 - Revoke stale access if supported

If the auth system supports it:

- revoke active sessions
- revoke refresh tokens
- invalidate remembered-device or long-lived login artifacts

### Step 4 - Negative verification

For each rotated account, verify that the old credential is rejected.

Minimum expected result:

- old credential no longer authenticates
- no hidden quick-access path restores access with the old credential

### Step 5 - Positive verification

For each rotated account, verify that the new credential works through the intended production auth path.

Minimum expected result:

- new credential authenticates successfully
- account role and scope are unchanged
- auth works through the normal production path only

### Step 6 - Capture evidence

Capture bounded evidence for:

- who rotated what and when
- proof that the old credential fails
- proof that the new credential succeeds
- proof that no emergency rollback was needed

Use `docs/product/work-packets/PRODUCTION_CREDENTIAL_HYGIENE_EVIDENCE_TEMPLATE_2026-03-28.md` as the ready-to-fill evidence skeleton.

### Step 7 - Update rollout truth

After successful verification:

- update `docs/product/work-packets/CP-10-ROLLOUT-SAFETY-CHECKLIST.md`
- add a new evidence note for the credential-hygiene closure
- update any remaining doc that still treats credential hygiene as unresolved

---

## 5. Stop conditions

Stop and escalate if any of the following happens:

- the old credential still authenticates after claimed rotation
- the rotation path breaks legitimate operator access with no safe recovery path
- production behavior changes in a way that suggests this is more than an account-hygiene issue
- the change would require unrelated code or rollout-scope edits

---

## 6. Done definition

This checklist is complete only when all of the following are true:

1. every affected production account has been rotated
2. every old credential has been verified as rejected
3. every required new credential has been verified as working
4. evidence is written
5. `CP-10` can treat credential hygiene as closed, leaving approval as the only remaining managerial step
