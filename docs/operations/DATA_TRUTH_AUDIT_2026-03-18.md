# Data Truth Audit 2026-03-18

## Scope

Readonly audit executed against Railway public Postgres targets for:

- staging
- production

Artifacts generated in `server/exports/`:

- `inventory-postgres-20260318-170253.json`
- `inventory-postgres-20260318-170411.json`
- `data-truth-audit-staging-ro-20260318-170644.md`
- `data-truth-audit-production-ro-arg-20260318-170408.md`

## Verified Targets

- staging audit resolved to `trolley.proxy.rlwy.net`
- production audit resolved to `caboose.proxy.rlwy.net`

## High-Signal Findings

### 1. Staging and production have materially different task surfaces

Staging:

- `tasks`: 37
- `initiatives`: 11
- `users`: 77
- `organizations`: 12

Production:

- `tasks`: 757
- `initiatives`: 210
- `users`: 83
- `organizations`: 15

This confirms that "what I see in My Work" depends heavily on current target DB and cannot be inferred from UI alone.

### 2. `atelier` task scope is not equivalent between staging and production

Staging audit:

- `atelier` has 5 tasks total
- all 5 are `execution`
- statuses: `in_progress=2`, `todo=2`, `DONE=1`
- no `personal` tasks were found for `atelier`

Production audit:

- `atelier` has 48 tasks total
- `execution=30`
- `personal=10`
- `governance=8`

This is a direct explanation for why the personal tasks view can collapse from several items to near-empty depending on environment and org scope.

### 3. Finance data is attached to a different organization than the visible business orgs

Staging:

- `financial_statements=1`
- finance rows belong to organization `a3e05d4a-5397-419d-b486-8e44366c0063`

Production:

- `financial_statements=27`
- `financial_statement_packs=9`
- `financial_statement_values=1265`
- finance rows also belong to organization `a3e05d4a-5397-419d-b486-8e44366c0063`

This is currently the strongest data-truth mismatch in the system:

- finance data exists
- but it is not under `atelier`
- and it is not under `dbr77`

So finance modules may appear empty for the active org even when finance tables contain real rows.

### 4. Demo organizations still exist in both environments

Both audits show:

- `atelier`
- `demo-org`

Production additionally contains a large `demo-org` initiative surface in business data.

This does not automatically mean a bug, but it means org scoping and demo gating must remain explicit in UI and API diagnostics.

## Operational Conclusion

The current production risk is no longer "unknown DB target". That part is now instrumented.

The current production risk is:

1. user is in one organization
2. UI queries an org-scoped endpoint correctly
3. rows exist, but under a different organization than the one the user is scoped into

That pattern is confirmed for finance and partially confirmed for tasks between staging and production.

## Primary Org Decision

Current operational policy:

- `dbr77` and `atelier` are equal real tenants
- no script or import flow should assume a single primary build organization

This means:

- finance imports should target an explicitly chosen tenant
- DB-backed seeds should require an explicit tenant instead of silently defaulting to `dbr77`
- any finance data under a non-`dbr77` org is considered drift until explicitly justified

## Finance Reassign Dry-Run

Dry-run report:

- `server/exports/finance-org-reassign-dry-run-2026-03-18T16-21-09-859Z.md`

Production dry-run confirmed:

- source org `a3e05d4a-5397-419d-b486-8e44366c0063` is missing from `organizations`
- `financial_statement_packs`: `9` rows to move to `dbr77`
- `financial_statements`: `27` rows to move to `dbr77`
- `financial_models`, `financial_analyses`, `budgets`, `valuations`: `0` rows under the orphaned source org

## Required Follow-Up

- Reconcile finance records under `a3e05d4a-5397-419d-b486-8e44366c0063` with the intended visible org model.
- Decide whether `atelier` should have real `personal` tasks in staging. Today it does not.
- Keep using `GET /api/health/data-context` and the My Work scope pills as the first diagnostic layer before any release.
