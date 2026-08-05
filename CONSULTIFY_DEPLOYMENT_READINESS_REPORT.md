# Consultify deployment readiness report — Complete MVP integration

Date: 2026-08-05
Target: Railway environment `demo` only
Candidate branch: `codex/consultify-mvp-integration-v2-20260805`
Candidate base SHA before the consolidated release-fix commit: `ffdf5631c9`
Current `origin/demo` and runtime SHA: `3f58e5ce7e809d5d5044d2b69d8f941aceec5bc7`

## Decision

**GO — CONTROLLED DEMO DEPLOYMENT AUTHORIZED AFTER THE GREEN GATES BELOW.**

The code candidate passes type checking, backend build and frontend production build. Module-level targeted/realDB evidence remains strong for M01-M03, M05-M10 and M12-M16, with explicit non-release-blocking Complete MVP evidence gaps for M04 and M11. The previous migration NO-GO has been removed without rewriting demo history or bypassing fail-closed:

- all 70 known historical checksum variants are reconciled by an immutable exact-pair manifest (filename + observed stored digest + reviewed current digest);
- a future file edit, a third stored digest or a different filename still fails closed;
- read-only demo preflight reports `CHECKSUM DRIFT: 0` and the expected 13 pending runtime migrations (the original 12 plus one additive fresh-schema prerequisite);
- a schema-only clone of current demo plus both migration ledgers applied all 13 atomically, then reported `CHECKSUM DRIFT: 0`, `PENDING: 0`;
- strict fresh PostgreSQL completed all 534 versioned migrations;
- no demo DDL/DML and no history rewrite was used to establish readiness.

The 170 legacy NULL checksums and 21 orphan history rows remain explicitly classified as inert/unverifiable Round 2 hygiene debt. The manual `schema_migrations` runner's broader 377-file inventory is a legacy discovery surface, not the production startup owner; production and release preflight share the same runtime predicate and checksum classifier in `migrationIdentity.ts`.

## Gate table

| Gate | Required | Observed | Decision |
|---|---|---|---|
| Exact base/runtime SHA known | Yes | Demo SHA confirmed by live `/api/health` | PASS |
| Clean integration tree | Yes | Clean before central reports; only intentional report edits pending | PASS |
| Root typecheck | Exit 0 | PASS | PASS |
| Backend production build | Exit 0 | PASS | PASS |
| Frontend production build | Exit 0 | PASS | PASS |
| Targeted M16 UI | Green | 18/18 | PASS |
| Targeted M16 real PostgreSQL | Green plus negative control | 13/13 | PASS |
| No new broad regression | Candidate not worse than base | Six partner failures reproduce identically on clean base | PASS WITH BACKLOG |
| Strict fresh schema | Exit 0 | 534/534 complete | PASS |
| Runtime migration checksum integrity | Zero unexplained mismatch | Demo read-only preflight: 70 exact approved variants, zero drift | PASS |
| Runtime pending migration proof | All pending proven safe | 13/13 applied atomically on current demo schema clone; post-preflight pending zero | PASS |
| Destructive migration scan | No data/schema loss operations | No `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` or `DELETE FROM` in pending set | PASS |
| M04 current Complete MVP evidence | Explicit honest status | `MVP_DEMO_FIX_REQUIRED`; not silently accepted | PASS WITH BACKLOG |
| M11 current Complete MVP evidence | Explicit honest status | `MVP_DEMO_FIX_REQUIRED`; not silently accepted | PASS WITH BACKLOG |
| Authorized target | Demo only | Confirmed | PASS |

## Actions deliberately not taken while proving readiness

- No push to GitHub `demo` before all gates became green.
- No Railway deployment before all gates became green.
- No manual DDL/DML against demo.
- No checksum-history rewrite.
- No `DISABLE_TP_MIGRATIONS` bypass.
- No merge to `main` or production.

## Controlled release protocol

1. Commit and push the exact green candidate branch.
2. Fast-forward the exact candidate to `demo`; do not merge to `main` or production.
3. Observe Railway until the deployment succeeds and both health and readiness are green.
4. Confirm live runtime SHA equals the pushed SHA and migration startup reports 13 applied without drift.
5. Run critical auth/tenant plus Documents/Presentations smoke.
6. Keep M04/M11 acceptance gaps and all P2/P3 findings in the central Round 2 backlog; deployment does not silently convert them to accepted.

Full module classifications and evidence are in `CONSULTIFY_COMPLETE_MVP_CHECKPOINT.md`. Round 2 records are in `CONSULTIFY_ROUND2_HARDENING_BACKLOG.csv`.
