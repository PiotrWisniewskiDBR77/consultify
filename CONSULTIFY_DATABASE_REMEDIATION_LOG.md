# Consultify — Database Remediation Log

Companion to `CONSULTIFY_DATABASE_COMPLETENESS_AUDIT.md` (branch `claude/consultify-database-audit-98f255`, baseline `94264784f9`).

**This branch:** `fix/db-audit-p0-20260806`, based on **current `origin/demo` = `b21c9513a1`** — not on the audit baseline. Demo had advanced 63 commits while the audit ran.
**Not pushed.** Every change is local and committed per step.

---

## 0. Re-verification before touching anything

The audit baseline was 63 commits stale by the time remediation started, so each P0 was re-checked against the current tip before any edit. **All seven were still live.** Nothing had been fixed in the interim; the parallel work that did land addressed a neighbouring problem (see §1).

---

## 1. NEW — fresh-schema replay was broken at the current demo tip

This did not exist in the audit. It is a regression introduced between `94264784f9` and `b21c9513a1`, found by re-running the replay on the new tip.

| | Audit baseline `94264784f9` | Demo tip `b21c9513a1` (before fix) | After fix |
|---|---|---|---|
| Migrations applied | 534 / 534 | **356, then abort** | **550 / 550** |
| Failures | 0 | **1** | 0 |
| `public` tables built | 1290 | **707** | 1295 |
| `v8` tables built | 121 | — (never reached) | 121 |

**Failing migration:** `20260331_p28_workbench_p29_partner_program_ledger.sql`
**Error:** `foreign key constraint "partner_program_ledger_partner_org_id_fkey" cannot be implemented`

**Root cause — the idempotence-masking hazard the audit described, manifesting for real:**

- The migration declared `partner_org_id TEXT NOT NULL REFERENCES partner_organizations(id)`, on the stated assumption that "the canonical fresh schema exposes `partner_organizations.id` as TEXT".
- That assumption is false. The producer that actually runs in strict order, `215_partner_portal.sql`, declares `id UUID PRIMARY KEY`.
- `798_partner_certifications_00base.sql`, which *does* define the column as TEXT, is a **silent no-op** on a fresh build: `CREATE TABLE IF NOT EXISTS` finds the table already created by 215 and does nothing, while still being recorded `success`.
- Postgres cannot implement a `TEXT → UUID` foreign key, so the migration aborted — and, because this is the strict path, **194 subsequent migrations never ran**.

**Fix applied** (`fa0dd9fec6`): drop the unimplementable constraint, keep `TEXT`.

That direction was chosen deliberately over changing the column to `UUID`. `ensurePartnerProgramSchema()` in `server/src/services/partnerProgramLedgerService.ts` creates this table **at runtime** as `partner_org_id TEXT NOT NULL` with no foreign key, and a read-only probe confirmed live demo holds exactly that shape (`partner_program_ledger.partner_org_id = text`, and the migration is absent from demo's ledger entirely). Declaring `UUID` would have made freshly built environments diverge from every deployed one. The missing referential constraint is left as a registered integrity gap rather than silently changed inside an unrelated unblock.

**Verified by re-running the full strict replay on a virgin PostgreSQL 17.9 cluster**, not by inspection.

---

## 2. Fixed — cross-tenant reads on the LLM org routes (DB-P0-03, DB-P0-04)

Commit `d091f42266`.

| Route | Before | After |
|---|---|---|
| `GET /org/:organizationId/policy` | `verifyToken` only | `verifyToken` + `requireSameOrganization` |
| `GET /org/:organizationId/policy/history` | `verifyToken` only | `verifyToken` + `requireSameOrganization` |
| `GET /org/:organizationId/available-models` | **no middleware at all** | `verifyToken` + `requireSameOrganization` |

`requireSameOrganization` compares the path parameter against the organization on the verified session, exempting super admins — matching how the sibling write routes in the same file are already gated.

**Verification — and its negative control, which is the part that matters:**

- New test `tests/unit/backend/llmOrgScope.test.ts`: **9/9 pass** with the fix.
- Guard reverted → **exactly the 4 defect tests go red** (403→200 on three cross-org reads, 401→200 on the anonymous read), while the 5 permissive tests correctly stay green.

The test can fail, and it fails for the right reason. Green alone would have proved nothing.

---

## 3. Fixed — the migrate command stopped reporting success on failure (DB-P0-01)

Commit `3bf6a22e3b`. `db:migrate` now runs strict; the tolerant mode survives under the explicit name `db:migrate:unsafe-continue`.

**Correction to the audit.** The audit called this "the deploy command". That was too strong, and the scope is narrower than stated:

- CI uses `db:migrate:strict` in all four places that migrate.
- Railway's deploy configuration does not invoke it; boot-time migration goes through the table-platform runner, which is fail-closed.
- What *is* true: 14 places in `docs/` recommend the tolerant `npm run db:migrate`, including `docs/testing/V2_V3_RELEASE_READINESS_CHECKLIST.md`, which records it as evidence that migrations "pass on a clean database" — a check that passed unconditionally because `--safe` always exits 0.

So the mechanism and the experiment stand; the blast radius is the documented manual path, not the automated deploy.

Verified: default mode exits 1 on a deliberately broken migration directory, `--safe` exits 0.

---

## 4. Fixed — CI database jobs now actually touch the database (DB-P0-07)

Commit `f743371c1e`. `RUN_DB_TESTS: '1'` and `MOCK_DB: 'false'` added to the three jobs that provision and migrate a real Postgres and then never used it: `colocated-tests`, `integration-tests`, `coverage`. `performance-tests` already had both — the correct pattern was three jobs away.

Worth singling out: the `coverage` job carries **no branch gate**, so it is the one job that genuinely runs on `demo` and `Londyn` — and it was measuring the mock.

Workflow re-parsed after editing: valid YAML, 25 jobs, all four now carry the flags.

### What the change actually costs — measured, not estimated

`server/src` (554 test files) was run twice locally against a migrated PostgreSQL 17.9:

| | Mock (CI today) | Real database |
|---|---|---|
| Files failed | 27 | 33 |
| Files passed | 511 | 520 |
| **Files skipped** | **16** | **1** |

So the headline is not "6 new failures" — it is that **15 files that were being skipped now actually execute**, 9 of which pass.

The 6 files that differ were then re-run **in isolation against a genuinely fresh, migrated database** (550/550), because the full-suite run shares one database and several of these tests drop and recreate tables, contaminating each other. That correction matters: on a clean database the true result is **3 failed / 3 passed**, not 6 failed. The two `atelierFinance*.pg.test.ts` files fail only as collateral damage of the shared run.

| File | Verdict on a clean database |
|---|---|
| `ini005-portfolio-resources-roadmap.pg.test.ts` | **test-fixture bug** — its setup issues `DROP TABLE tasks`, which now fails (`2BP01`) because the complete schema gives `tasks` six dependent FKs, including `studio_documents_linked_task_id_fkey` from the team's recent Studio fix. The test was written against an incomplete schema. |
| `initiativeCapabilityMatrix.pg.test.ts` | **test-fixture bug** — inserts a user with an `organization_id` whose organization was never created, violating `users_organization_id_fkey`. It passed only where that FK did not exist. The failure is evidence the constraint is now real. |
| `documentSourcePackService.test.ts` | **candidate product defect — see below** |

### The one genuine defect the mock was hiding

`documentSourcePackService.test.ts` passes 13 of 14. The single failure is the test named *"write-through to DAO survives a registry-only reset and is restored by hydration"*:

```
expected 'draft' to be 'ready'
```

The in-memory registry holds `ready`; what comes back out of Postgres after rehydration is `draft`. **The promotion to `ready` is not persisted.** Against the mock the assertion passed, because the mock returned the in-memory value it had just been given.

This is precisely the class of defect the audit predicted and could not see: a state change that looks applied and is not. It is left open here rather than fixed in passing — it needs the DAO write path investigated properly, and it belongs with DB-P0-02 (unchecked writes) rather than in a CI commit.

**Conclusion: the CI change is safe to land.** It costs two test-fixture repairs and surfaces one real persistence bug — which is the entire point of it.

---

## 5. Found, not fixed — the test suite is deferred on the branches actually in use

Not a defect; a deliberate, announced design decision. Recording it because it changes what "CI is green" means here.

74 steps across 10 test jobs are gated on `github.ref_name == 'main' || 'develop'`, with an explicit `Deferred outside main/develop` step that writes the deferral into the job summary. The workflow triggers on `[main, develop, Londyn, demo]`.

The consequence is arithmetic, not opinion:

| Branch | Last commit | Behind `demo` |
|---|---|---|
| `demo` | 2026-08-06 | — |
| `main` | 2026-07-16 | **7646 commits** |
| `develop` | 2026-06-02 | **7746 commits** |

The branches that trigger the suite are thousands of commits behind the branch where work happens. Combined with §4, the practical reading is that the database-backed suite has not meaningfully run against current code for weeks.

**This is an owner decision, not a code fix** — opening the gate has real CI cost and would surface a large backlog at once. Flagged for a deliberate call.

---

## 6. Current state of this branch

| Commit | Change |
|---|---|
| `fa0dd9fec6` | migrations: unblock fresh schema (194 migrations restored) |
| `d091f42266` | llm: close cross-tenant reads, with negative-controlled test |
| `3bf6a22e3b` | db: `db:migrate` fails loudly again |
| `f743371c1e` | ci: three jobs stop measuring the mock |

Nothing pushed. Nothing deployed. No demo or production database was written to at any point.

---

## 7. Still open

| id | Why not fixed here |
|---|---|
| DB-P0-02 | Flipping `DbPromise.run()` to `fallback: false` has repository-wide blast radius. It needs the CI change (§4) to land first, so the resulting failures are visible rather than silent. Sequencing matters more than speed here. |
| DB-P0-05 | MFA has no table in any environment. Choosing between `user_mfa` and `user_mfa_methods` is a product/schema decision, and the write routes also need to check `.success` — which is DB-P0-02's fix. |
| DB-P0-06 | Demo schema reconciliation is an operational decision, not a code change. The gap against the corrected canon is now **171 tables** (canon grew to 1416 as the team's Studio fix added 5 tables demo does not yet have). |
| DB-P1-* | Registered with evidence and remedies in `CONSULTIFY_DATABASE_RISK_REGISTER.csv`. |
| **NEW — source pack `ready` not persisted** | Found by §4's measurement. `documentSourcePackService` promotes a pack to `ready` in memory; Postgres returns `draft` after rehydration. Needs the DAO write path traced. |
| **NEW — two test fixtures assume an incomplete schema** | `ini005-portfolio-resources-roadmap.pg.test.ts` (drops `tasks`, now has 6 dependent FKs) and `initiativeCapabilityMatrix.pg.test.ts` (inserts a user for a nonexistent organization). Both need fixture repair before the CI change lands cleanly. |
