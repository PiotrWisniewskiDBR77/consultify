# DEC-583 — member directory inside the active organization

**Verdict: READY FOR CTO REVIEW.** An active MEMBER can resolve participant names inside the authenticated current organization, while cross-organization reads remain denied and the MEMBER response contains only `id`, `displayName`, and `avatar`.

## Scope

- Base: `bd7ff4943118fdcf3442cffb4532a89cce00860b`
- Branch: `codex/dec583-member-directory-20260917`
- Decision: DEC-583, W184
- No migration, feature flag, deployment, staging write, Railway change, protected-ref push, or screenshot.
- Screenshots were intentionally not created because the binding channel header says: “Nikt nie robi zrzutów ekranu.”

## Behaviour

- The frontend directory hook requests members for every authenticated user with a current organization; it does not use localStorage and keeps its cache scoped by organization, user, and role.
- MEMBER receives only `id`, `displayName`, and `avatar`. Email, role, phone, membership id, status, and timestamps are absent.
- `OrganizationApi` normalizes that private wire payload to the established frontend aliases (`userId`, `name`) without inventing or exposing email. The active-only endpoint contract supplies the safe `active` status used by existing consumers.
- The controller checks the requested organization against the organization resolved by authentication before querying the directory. A foreign organization returns `403 ORG_MEMBERSHIP_REQUIRED`.
- Only an ACTIVE membership row authorizes a non-superadmin read.
- Full versus minimal disclosure is selected from the current ACTIVE membership row, not from a possibly stale JWT role. A demoted OWNER receives the minimal response immediately; a promoted OWNER receives the full response.
- OWNER/ADMIN/SUPERADMIN retain the full management response byte shape; the service-only `avatar_url` column is removed before that response. SUPERADMIN cross-organization behaviour is unchanged.
- Execution tests previously using OWNER as a directory workaround now use MEMBER; no `role:'OWNER'` remains in the four W175 test files.

## Verification

- Fresh install: `npm ci --ignore-scripts` — PASS, 2,075 packages.
- Exact lock: `npm ls @types/node --depth=0` — root and workspaces use `22.19.3`.
- Focused frontend/controller/Execution family: **6 files, 34/34 PASS**, `--retry=0`.
- Final hook + controller + real API autocomplete rerun: **3 files, 16/16 PASS**.
- Real PostgreSQL mounted router on fresh schema: **1 file, 4/4 PASS**. It proves MEMBER name readback with the exact minimal keys, revoked denial, and cross-tenant denial.
- Server TypeScript from the exact lock: **0 diagnostics**, RC=0.
- Full frontend TypeScript from the exact lock: candidate **152 diagnostics**, reference line reported by CTO **169**; **0 diagnostics in changed files**.
- Esbuild: all five changed production files PASS.
- `check:jezyk:ci` PASS (`K8sen -2`); Docker flag guard PASS (0 missing); list-canon PASS (346/346); `git diff --check` PASS.

## Mutation evidence

- Restoring the old frontend role gate makes **3/4 hook tests RED**, including MEMBER own-organization lookup.
- Removing the server current-organization comparison makes **1/10 controller tests RED**: the foreign MEMBER read is no longer denied.
- Bypassing the API normalization makes the real autocomplete test **1/1 RED** with `id/name: undefined`.
- Replacing the ACTIVE membership role with the stale request role makes **2/11 controller tests RED** (demotion leaks full data; promotion loses management fields).
- All mutations were restored before final verification.

## Review

The first independent review found one P1 (minimal wire payload broke legacy aliases) and one P2 (the internal avatar column leaked into the admin response). The second found one P1 (stale JWT role selected the disclosure level). All were fixed and covered by behaviour tests before the final re-review.

Final independent re-review: **PASS — 0×P0 / 0×P1 / 0×P2**. The reviewer reran the controller, hook, and real-client autocomplete set (**16/16 PASS**) and confirmed tenant isolation, stale-role protection, admin payload parity, consumer compatibility, and clean diff hygiene.
