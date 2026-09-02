# My Work owner-review fixture — reproduction record (2026-09-02)

Manifest in this directory: `manifest.json`
SHA-256: `ea0e8526b0cb9ea4658eaae1ead8e72875153778588a240f7fd2154c6465c6d4`

Producing script: `server/scripts/seed-wave3-my-work-owner-review.ts`
(committed to repo — this manifest is not the only copy; anyone with a
local PostgreSQL can regenerate an equivalent one from the same script.)

## Why this file is committed here, not left in `/tmp`

Gate `G01` failed for all sixteen Wave 3 modules on 2026-09-02 because every
prior owner-review manifest lived only in `/tmp` and evaporated before this
session started. This manifest is committed directly into the repo
(secret-free — `persistManifest()` in the script strips fixture passwords
and verifies none leaked before writing) specifically so that does not
happen again for `G03`/`G04` of this module.

## ★ Legacy `/api/tasks` is not used

My Work shares its write engine with Execution (Runtime-v1); legacy
`POST /api/tasks` is deliberately retired (returns 409, not a failure).
This fixture never calls it — the only writers exercised are
`agentApprovedMaterializationService.ts`'s own canonical calls into
`TaskService.createTask` / `decisionService.createDecision`, the same
writers the real product uses.

## How this was produced (exact commands)

```bash
docker run -d --name cx-w3-seedy-pg -p 127.0.0.1:6280:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres pgvector/pgvector:pg16

export MYWORK_OWNER_FIXTURE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:6280/consultify_w3_my_work_owner_20260902"
export MYWORK_OWNER_FIXTURE_CONFIRM=YES
export MYWORK_OWNER_FIXTURE_MANIFEST="/absolute/path/my-work-owner-review.json"

npx tsx server/scripts/seed-wave3-my-work-owner-review.ts seed
# -> creates the database, migrates once, seeds five named personas plus one
#    deterministic Agent plan, runs three materialization proposals
#    (task/decision/notebook) through the full propose -> decide ->
#    materialize lifecycle with every named boundary probed, cold-SQL
#    readback-verifies every counter, writes this manifest at mode 0600.

DB_TYPE=postgres DATABASE_URL="$MYWORK_OWNER_FIXTURE_DATABASE_URL" \
  NODE_ENV=test npx tsx server/scripts/migrate.postgres.ts   # idempotency: 0 applied

npx tsx server/scripts/seed-wave3-my-work-owner-review.ts readback   # cold, separate process

npx tsx server/scripts/seed-wave3-my-work-owner-review.ts seed   # -> BLOCKED, no duplication

npx tsx server/scripts/seed-wave3-my-work-owner-review.ts reset
docker rm -f cx-w3-seedy-pg
```

## What was measured (summary; full detail in `manifest.json`)

- 5 named personas: owner (OWNER, inbox owner + distinct approver),
  requester (ADMIN — deliberately privileged so the self-approval boundary
  is reachable; see the in-file comment on why a MEMBER requester would hit
  `MYW_AGENT_REVIEWER_FORBIDDEN` before ever reaching self-approval),
  colleague (MEMBER, spoof attempt), inactive (REVOKED), foreignOwner
  (foreign tenant).
- One deterministic `ai_agent_plans` row owned by requester.
- Three proposals created (task/decision/notebook targets); idempotent
  replay converges; idempotency-key payload collision denied; source-drift
  denied.
- Body-identity spoof: colleague (active, real member) cannot claim
  requester's plan — `MYW_AGENT_SOURCE_NOT_FOUND`.
- Inactive/revoked and foreign-tenant requesters both denied at proposal
  creation.
- Stale/colliding decide caller denied (`MYW_AGENT_PROPOSAL_STALE`);
  requester self-approval denied (`MYW_AGENT_SELF_APPROVAL_FORBIDDEN`).
- Owner (distinct from requester) approves task+decision, rejects notebook.
- Materialize: task -> real `TaskService.createTask` row; decision -> real
  `decisionService.createDecision` row; replay converges on the same
  receipt; tenant-invalid worker job denied
  (`MYW_AGENT_PROPOSAL_NOT_FOUND` when materializing under the wrong org);
  reviewer-forbidden denied when a non-approver actor tries to materialize.
- Cross-tenant plan invisibility verified directly by SQL count
  (`foreign_plans_visible_cross_tenant = 0`).
- 883 successful migrations recorded on this exact fresh database.
