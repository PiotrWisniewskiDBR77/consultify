# E2E-1 service accounts + N-1 canonical route (W161/W163)

**Result: READY FOR CTO REVIEW.** The scheduled staging matrix now uses only the two dedicated service principals from DEC-579 and records the canonical route reached by Menu 1.

## Contract

- `E2E_ADMIN_NW_{EMAIL,PASSWORD}`: ADMIN in Northwind.
- `E2E_OWNER_DBR77_{EMAIL,PASSWORD}`: OWNER in DBR77.
- 2 principals × EN/PL × light/dark = **8 variants**.
- 8 variants × 16 modules = **128 module runs**.
- 128 runs × 7 required surfaces = **896 minimum cells**.
- Human-account secret names (`IRINA`, `KASIA`, `TOMEK`) are absent from the workflow.
- A missing service-account secret remains a hard error in `run.mjs`; the workflow cannot silently skip or turn green.

## N-1

`/admin/people` legitimately canonicalizes to `/admin/team/members`. The Admin module declares that canonical route explicitly. Menu 1 now:

1. captures `routeAfter`;
2. accepts only the requested route or a declared canonical route;
3. rejects unrelated Admin routes.

The contract test covers direct, canonical, canonical-with-query, and unrelated paths.

## Evidence

- Node contract tests: **7/7 PASS**.
- Synthetic full aggregate: **8/8 variants, 128/128 runs, 896/896 cells, PASS**.
- Workflow YAML parses with exactly 8 variants and exactly four service-account secrets.
- Prettier and `git diff --check`: **PASS**.
- No staging run was triggered; this package changes mechanics and secret references only. CTO remains the owner of GitHub Secret values and service-account provisioning.

Evidence files:

- `evidence/plan.json`
- `evidence/synthetic-aggregate.json`
