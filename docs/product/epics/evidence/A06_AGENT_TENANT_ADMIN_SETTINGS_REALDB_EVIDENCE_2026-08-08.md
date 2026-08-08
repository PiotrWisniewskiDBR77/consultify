# A06/A07/A11 — Agent tenant administration evidence

Date: 2026-08-08
Scope: local service/API/UI contracts and native PostgreSQL proof; no deployment claim.

## Implemented contract

- Tenant/project Agent settings are versioned and writable only by `ADMIN`, `OWNER` or `SUPERADMIN` from authenticated V8 context.
- Safe defaults are fail-closed: in-app delivery is enabled; email, calendar, automatic actions, export and purge are disabled; cadence is manual; legal hold is explicit.
- Cadence and timezone are tenant-admin parameters instead of hard-coded product policy.
- Activation is a separate idempotent admin action. It provisions the exact ratified set of 17 A06 tools and `force_policy_gate` policies; first use never silently grants execution authority.
- Retention defaults are visible (`30` detail days, `13` aggregate months), but destructive purge and export remain disabled until a later governed retention implementation enables them.

## Evidence

Focused service, authenticated route and Agent Operations UI suites: `13/13 PASS`.

Native PostgreSQL marker: `A06_TENANT_ADMIN_SETTINGS_REALDB_GREEN`.

The proof establishes:

- safe defaults;
- ordinary `MEMBER` denial;
- optimistic version-conflict denial;
- unapproved automatic action denial;
- two concurrent activation requests create `17` tools, `17` policies and one activation receipt;
- export and purge remain false;
- external side effects remain `0`.

The root TypeScript check and `git diff --check` pass on the integrated tree.

## Acceptance boundary

This closes the previously open product decision about recurring action/notification configuration and new-tenant A06 activation at the local contract level. A06/A07/A11 remain `PARTIAL` until the same release SHA is migrated and exercised through authenticated admin/operator browser flows, worker restart and production telemetry/retention operations. No external email or calendar invitation is claimed.
