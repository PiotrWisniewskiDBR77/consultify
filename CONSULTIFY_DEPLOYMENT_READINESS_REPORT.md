# Consultify deployment readiness report — Complete MVP integration

Updated: 2026-08-06 00:25 Europe/Warsaw
Target: Railway environment `demo` only
Release repair branch: `codex/postdeploy-m09-m13-fix-20260805`
Current `origin/demo` and runtime SHA: `dcf1678bb1508d8c61ecdf2de891003007e420dc`
Railway deployment: `92d08799-bcfd-49dc-9f83-15f34afe8960` (`SUCCESS`)

## Decision

**DEPLOYED AND VERIFIED — CONTROLLED DEMO RELEASE COMPLETE FOR THE AUTHORIZED SHA.**

The release and the bounded post-deploy repair pass type checking, backend build, frontend production build and 42/42 targeted repair tests. Module-level evidence remains strong for M01-M03, M05-M10 and M12-M16, with explicit Complete MVP gaps for M04 Tools and M11 Audits. The previous migration NO-GO was removed without rewriting demo history or bypassing fail-closed:

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
| Exact deployed SHA | Runtime equals pushed SHA | `/api/health` reports `dcf1678bb1508d8c61ecdf2de891003007e420dc` | PASS |
| Single deployment | One Railway deployment for repair SHA | `92d08799-bcfd-49dc-9f83-15f34afe8960` `SUCCESS` | PASS |
| Runtime health | HTTP and dependencies healthy | `/ping` 200; health 200; DB and Redis connected | PASS |
| Migration startup | No pending or failed runtime migration | 402/402 applied; governed runner 410/410 up to date | PASS |
| M09 deployed delta | No false saving/count/metadata success | `Saved`, 10/10 canonical slides, no reload PUT, no fake word count | PASS |
| M13 deployed delta | Authenticated context works; anonymous denied | 3 organizations loaded; no 304; anonymous 401 | PASS |
| 390 px editor smoke | Usable canvas, no page overflow | Rails hidden; canvas 390 px; scroll width 390 px | PASS |

## Actions deliberately not taken while proving readiness

- No push to GitHub `demo` before all gates became green.
- No Railway deployment before all gates became green.
- No manual DDL/DML against demo.
- No checksum-history rewrite.
- No `DISABLE_TP_MIGRATIONS` bypass.
- No merge to `main` or production.

## Controlled release execution record

1. Exact green SHA committed and the repair branch pushed.
2. `demo` fast-forwarded from `9446a69724b7f8b058be1b12abc15f2982d4be2b` to `dcf1678bb1508d8c61ecdf2de891003007e420dc`; `main` and production were untouched.
3. Exactly one Railway deployment was observed through `SUCCESS`.
4. Live runtime SHA, health, dependencies and migration startup were confirmed.
5. Authenticated M09/M13 and 390 px Chrome deltas plus anonymous tenant-negative control passed without demo-data mutation.
6. M04/M11 remain `MVP_DEMO_FIX_REQUIRED`; deployment does not silently convert partial baseline evidence into acceptance.

Full module classifications and evidence are in `CONSULTIFY_COMPLETE_MVP_CHECKPOINT.md`. Round 2 records are in `CONSULTIFY_ROUND2_HARDENING_BACKLOG.csv`.
