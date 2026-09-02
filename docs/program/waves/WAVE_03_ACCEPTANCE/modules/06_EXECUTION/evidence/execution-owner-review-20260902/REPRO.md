# Execution owner-review fixture — reproduction record (2026-09-02)

Manifest in this directory: `manifest.json`
SHA-256: `cdca389dd57e5658d3c653d3d0ea87c6eb53fb802804ff0f74f9e4cd24d56b90`

Producing script: `server/scripts/seed-wave3-execution-owner-review.ts`
(committed to repo — this manifest is not the only copy; anyone with a
local PostgreSQL can regenerate an equivalent one from the same script.)

## Why this file is committed here, not left in `/tmp`

Gate `G01` failed for all sixteen Wave 3 modules on 2026-09-02 because every
prior owner-review manifest lived only in `/tmp` and evaporated before this
session started. This manifest is committed directly into the repo
(secret-free — `persistManifest()` in the script strips fixture passwords
and verifies none leaked before writing) specifically so that does not
happen again for `G03`/`G04` of this module.

## How this was produced (exact commands)

```bash
# Fresh disposable local PostgreSQL, port 6280 (session-local port block).
docker run -d --name cx-w3-seedy-pg -p 127.0.0.1:6280:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres pgvector/pgvector:pg16

export EXECUTION_OWNER_FIXTURE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:6280/consultify_w3_execution_owner_20260902"
export EXECUTION_OWNER_FIXTURE_CONFIRM=YES
export EXECUTION_OWNER_FIXTURE_MANIFEST="/absolute/path/execution-owner-review.json"

npx tsx server/scripts/seed-wave3-execution-owner-review.ts seed
# -> creates the database, runs `npm run db:migrate:strict` once, seeds five
#    named personas, runs the full BVP journey (handoff, legacy case, spine,
#    evidence, close, governed budget delete, hidden/unregistered action
#    denial, forged-JWT HTTP proof), then cold-SQL-readback-verifies every
#    counter and writes this manifest with mode 0600.

# Migration idempotency (second pass, applies 0 migrations):
DB_TYPE=postgres DATABASE_URL="$EXECUTION_OWNER_FIXTURE_DATABASE_URL" \
  NODE_ENV=test npx tsx server/scripts/migrate.postgres.ts

# Cold readback (separate process, no seeding):
npx tsx server/scripts/seed-wave3-execution-owner-review.ts readback

# Idempotent second `seed` invocation: refuses cleanly (manifest path
# already exists / database already exists), never duplicates data.
npx tsx server/scripts/seed-wave3-execution-owner-review.ts seed   # -> BLOCKED, no mutation

# Teardown (fixture is disposable by design):
npx tsx server/scripts/seed-wave3-execution-owner-review.ts reset
docker rm -f cx-w3-seedy-pg
```

## What was measured (summary; full detail in `manifest.json`)

- 5 named personas: owner (OWNER), admin (ADMIN, distinct evidence
  approver), member (MEMBER, denied), inactive (REVOKED, denied),
  foreignOwner (foreign-tenant OWNER, denied).
- Lineage A (RUNTIME_V1 handoff): one `initiative` + `execution_case`
  runtime-v1 aggregate snapshot, one `execution_case_links` row via
  `linkRuntimeInitiativeToExecutionCase`, replay converges, collision/stale
  CAS/foreign-tenant boundaries all denied with the expected error codes.
- Lineage B (legacy case, still-live writer): `case_core` row, spine
  refs recorded (with a stale-CAS boundary check), one EVIDENCE artifact
  link submitted by owner and approved by a **distinct** ADMIN, closed with
  an immutable `execution_results_signal_outbox` receipt (replay converges
  on the same signal id).
- Governed budget-delete action (`execution_action_registry`,
  `minimum_role=ADMIN`): MEMBER denied (`insufficient_org_role`), inactive
  denied (`not_org_member`), foreign denied (`not_org_member`), stale CAS
  denied (`budget_entry_version_conflict`), then a real ADMIN delete
  succeeds; the receipt table's append-only trigger was probed directly
  (`UPDATE ... execution_budget_delete_receipts`) and confirmed to reject
  the mutation.
- HIDDEN (`execution.initiative.archive`) and completely unregistered
  action ids both denied `execution_action_hidden_or_unregistered`.
- HTTP layer (`verifyToken -> validateOrgMembership -> attachV8Context ->
  executionBvp.routes.ts`, the exact chain `caseWorkspace/index.ts`
  requires): a real owner JWT reads the link (200); a JWT signed with the
  wrong secret is rejected (401) before any route logic runs; an anonymous
  request is rejected (401).
- 883 successful migrations recorded on this exact fresh database (two
  migration passes: the script's own + a manual re-run applying 0).
