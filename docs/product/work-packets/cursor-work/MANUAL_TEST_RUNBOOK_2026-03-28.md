# Manual Test Runbook - 2026-03-28

> Purpose: short operator/tester checklist for manual verification during the open post-promotion observation window
> Status: current

---

## Scope

Use this runbook only for the currently promoted production orgs:

- `dbr77`
- `ateliertoys-demo`

Current machine-readable pre-manual checkpoint:

- `server/exports/v8-rollout-monitor-2026-03-28T09-14-27-513Z.json`

---

## Before starting

1. Reconfirm the latest automated checkpoint with `npm run rollout:v8:monitor -- --json`
2. Test each org separately; do not mix screenshots or notes between tenants
3. Keep `CP-10` rollback thresholds in mind while testing
4. Do not promote another org during this manual pass

### DBR77 test accounts (manual QA)

Use only these accounts for `dbr77` manual retests unless the test plan says otherwise.

| Konto | Rola usera | Primary org | DBR77 membership |
| --- | --- | --- | --- |
| `admin@dbr77.com` | `SUPERADMIN` | `dbr77` | `ADMIN` |
| `piotr.wisniewski@dbr77.com` | `OWNER` | `dbr77` | `OWNER` |
| `justyna.laskowska@dbr77.com` | `ADMIN` | `dbr77` | `ADMIN` |
| `jan.kowalski@dbr77.com` | `USER` | `dbr77` | `USER / MEMBER` |

---

## Core manual path per org

1. Log in and confirm the correct tenant/org context
2. Open a V8-backed surface and confirm the page loads without an auth or feature-gate error
3. Exercise one lightweight read action in each area that matters now:
   - planning / pending decisions
   - workspace / my work
   - outputs or results read surface
   - finance read surface if visible for the account
4. Exercise one lightweight non-V8 seam:
   - notifications list or unread count
   - provider health dependent UI if available
5. Confirm there is no obvious regression:
   - blank screen
   - repeated spinner
   - 401/403 mismatch
   - 404 on an expected promoted-org V8 route
   - visible tenant/context mix-up

---

## What to capture

For each org save:

- login timestamp
- 2-4 screenshots of successful key screens
- any failing screen plus the exact time
- the visible org/account identity on screen
- whether the issue is V8-only, non-V8, or unknown

If browser devtools are open, also capture:

- one successful `/api/v8/...` request
- one successful non-V8 seam request

---

## Stop conditions

Stop the manual pass and escalate immediately if any of the following appears:

- promoted org gets `404 V8_ORG_DISABLED`
- repeated `5xx` on V8 routes
- obvious cross-tenant data leakage
- broken login for a promoted-org test account
- non-V8 seam regression that was green in the automated checkpoint

---

## After manual testing

1. Save the findings beside the org name and timestamp
2. Re-run `npm run rollout:v8:monitor -- --json`
3. Compare the new checkpoint with the pre-manual artefact
4. If both manual and automated checks remain green, continue holding the `48h` observation window
