# Consultify deployment readiness report — Complete MVP integration

Date: 2026-08-05
Target: Railway environment `demo` only
Candidate branch: `codex/consultify-mvp-integration-v2-20260805`
Candidate product SHA before reporting commit: `24ed0d81e7`
Current `origin/demo` and runtime SHA: `3f58e5ce7e809d5d5044d2b69d8f941aceec5bc7`

## Decision

**NO-GO — DEPLOYMENT BLOCKED.**

The code candidate passes type checking, backend build and frontend production build. Module-level targeted/realDB evidence is strong for M01-M03, M05-M10 and M12-M16, with explicit gaps for M04 and M11. The deployment itself is not safe because the integrated production startup now correctly gates readiness on Table Platform migration integrity, while demo currently reports:

- 70 checksum mismatches for already-recorded runtime migrations;
- 12 runtime migrations pending on next start;
- 170 legacy applied rows with NULL checksums;
- 21 orphan history entries;
- a second migration ledger/discovery path that reports 377 pending files.

With production flags currently unset (`DB_MANAGED_SCHEMA`, `DISABLE_TP_MIGRATIONS`, `DB_READONLY`), a normal deploy would execute the fail-closed migration check and should exit or remain not ready. Disabling migrations is not a valid bypass: the integrated readiness policy also refuses traffic when migrations are disabled.

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
| Strict fresh schema | Exit 0 | Stops at historical initiative title ordering gap | FAIL |
| Runtime migration checksum integrity | Zero mismatch | 70 mismatches | FAIL / P0 |
| Runtime pending migration proof | All pending proven safe | 12 pending and not executed | FAIL / P0 |
| M04 current Complete MVP evidence | Complete | Missing | FAIL |
| M11 current Complete MVP evidence | Complete | Missing | FAIL |
| Authorized target | Demo only | Confirmed | PASS |

## Actions deliberately not taken

- No push to GitHub `demo`.
- No Railway deployment.
- No manual DDL/DML against demo.
- No checksum-history rewrite.
- No `DISABLE_TP_MIGRATIONS` bypass.
- No merge to `main` or production.

## Green release protocol after remediation

1. Read-only preflight must report zero unexplained checksum mismatches.
2. The exact pending migration set must pass atomically on an isolated clone/staging schema.
3. Fresh strict migration must complete.
4. M04 and M11 must receive Complete MVP statuses based on evidence.
5. Rebuild and rerun targeted/realDB gates on the final SHA.
6. Fast-forward the exact candidate to `demo` and observe Railway until health and readiness are green.
7. Confirm live runtime SHA equals the pushed SHA.
8. Run the cross-module business scenario and log every failure to the central backlog.

Full module classifications and evidence are in `CONSULTIFY_COMPLETE_MVP_CHECKPOINT.md`. Round 2 records are in `CONSULTIFY_ROUND2_HARDENING_BACKLOG.csv`.
