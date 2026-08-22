# Consultify incident freeze and preservation audit — 2026-08-22

Status: `FROZEN / DATA PRESERVED / DEMO CREDENTIAL ROTATION PARTIAL / RESTART PROHIBITED`

## Non-destructive boundary

- No repository reset, clean, stash, checkout, merge, push, deploy, migration,
  service stop, volume detach, or deletion was performed.
- The 27 pre-existing working-tree entries were preserved byte-for-byte in place.
- Public services remain running; "freeze" means no further change, not customer-facing shutdown.
- The incorrect local Railway context was captured before correction.

## Railway context correction

Before correction:

- workspace: `DBR77` (`bbccc37f-206e-4aab-94b3-53cfc0702ece`)
- project: `Pitchdeck` (`7632d2da-3f45-4ed1-b123-625ea8dbb2e4`)
- environment: `production`

After correction and read-back:

- workspace: `Piotr Wisniewski's Projects` (`fc2c101c-01cb-4eea-927a-e74cdbfa179d`)
- project: `consultify` (`a6d59e88-263d-45f3-96bc-861f66bf467b`)
- environment: `production`
- service: `consultify` (`8f65b820-3d55-4dd9-8076-929d01cc4157`)

Pitchdeck resources were not changed. Only the local CLI association for this checkout was corrected.

## Demo credential containment checkpoint

At the end of the evidence pass, the demo `pgvector` password was selected for
rotation because an earlier local diagnostic had exposed the old value in
process output. This containment operation reached a partial state:

- `pgvector` and demo `consultify` Railway variables now contain the same new
  password and internally consistent database URLs;
- the SQL password change returned PostgreSQL error `42601`, so the database
  role still uses its prior credential;
- authentication through the newly stored public URL fails, which independently
  confirms the role/variable mismatch;
- the currently running demo app still reports HTTP 200 on `/api/health` and
  `/api/ready`, with database and Redis connected, because that container has
  not restarted and retains its previous environment snapshot;
- Railway CLI SSH is unavailable to the current integration, and both inspected
  browser surfaces require a fresh Railway login.

Hard control: **do not restart or redeploy demo `consultify` or demo `pgvector`**
until the PostgreSQL role is brought into agreement with the already stored
variables and a direct connection test passes. Production variables, services,
database, and deployment were not changed.

## Repository preservation point

- checkout: `/Users/piotrwisniewski/Developer/Consultify`
- branch: `codex/wave3-16-module-acceptance-20260821`
- HEAD: `09950def997295b8472737af817d5a36b6174e6c`
- pre-existing working-tree entries: 27
- modified tracked files: 15
- pre-existing untracked paths: 12
- tracked diff at freeze: 1,047 insertions and 496 deletions

The incident backup directory is under `.tmp/` and does not alter tracked application source.

## Environment and database matrix

| Environment | App state | App DB target | Tables | Organizations | Users | Projects | Conversations | Initiatives | Migration rows |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| production | running; health degraded because Redis is disconnected | `Postgres` | 1,132 | 97 | 1,294 | 352 | 149 | 68 | 499 |
| staging app | running | `Postgres-Rehearsal-20260820-71316e` | 1,654 | 3 | 4 | 1 | 13 | 9 | 794 |
| staging ordinary DB | not used by staging app | `Postgres` | 1,000 | 1 | 1 | 0 | 0 | 0 | 478 |
| demo | running | `pgvector` | 1,632 | 331 | 1,434 | 30 | 776 | 170 | 782 |
| dev | app crashed | `Postgres` | 873 | 16 | 85 | 22 | 0 | 51 | 519 |

Counts are read-only snapshots. They prove that the databases contain materially different data and must not be merged, replaced, or deleted without record-level reconciliation.

## Confirmed incident findings

1. The local Consultify checkout was incorrectly associated with the Pitchdeck Railway project.
2. The staging application is explicitly configured to use the newly created rehearsal database rather than the ordinary staging Postgres service.
3. Demo uses the service named `pgvector` as its primary PostgreSQL database.
4. Railway-generated names are inverted relative to user-facing names: `consultify-demo.up.railway.app` serves staging, while `consultify-staging.up.railway.app` serves demo.
5. Staging reports five missing non-critical schema tables every five minutes while its readiness endpoint still returns HTTP 200.
6. Dev is `CRASHED`.
7. Production Redis is disconnected.
8. AI circuit breakers are open across multiple providers; demo recorded more than 900 failures for several providers.
9. Staging is 255 commits behind the current checkout. Demo is on an older/divergent release lineage.
10. Production does not expose a trustworthy build SHA.

## Logical backups

Location: `/Users/piotrwisniewski/Developer/Consultify/.tmp/incident-20260822/db-backups`

Directory mode: `700`. Dump mode: `600`. Format: PostgreSQL custom archive. Every archive passed `pg_restore --list` parsing.

| Archive | Size | SHA-256 |
|---|---:|---|
| `production-postgres.dump` | 37 MB | `8b25f3405e7cb3cb3bb048fc1dcee1d7f2339302c348620774b51bab4e0d2901` |
| `staging-postgres.dump` | 4.4 MB | `3dbcf1bc9b7875a811e5b769ad4ecf055b66a05b74d98d5ab77e052fee1514af` |
| `staging-rehearsal.dump` | 7.6 MB | `ad7ccd9caf1d888225ec048c9903daa44e4f5f2d65ca7dccf6f65ed86858d476` |
| `demo-pgvector.dump` | 234 MB | `0cab9124715f1065968d9a4100ec253467348f9ad2fd39f355f88226511595cf` |
| `dev-postgres.dump` | 4.2 MB | `22882dfeabe8daa6924c1305093cf5755198cd5293b57babe12c742143e34d60` |

These are additional local logical copies. Railway volumes remain attached and `READY`; none is pending deletion.

## Isolated restore verification

All five archives were restored with `pg_restore --exit-on-error` into an
isolated local PostgreSQL 18 instance with pgvector. Post-restore table and
business-row counts matched the source snapshots:

| Restore database | Verdict | Tables | Organizations | Users | Projects | Conversations | Initiatives |
|---|---|---:|---:|---:|---:|---:|---:|
| `production_restore` | `PASS` | 1,132 | 97 | 1,294 | 352 | 149 | 68 |
| `staging_restore` | `PASS` | 1,000 | 1 | 1 | 0 | 0 | 0 |
| `rehearsal_restore` | `PASS` | 1,654 | 3 | 4 | 1 | 13 | 9 |
| `demo_restore` | `PASS` | 1,632 | 331 | 1,434 | 30 | 776 | 170 |
| `dev_restore` | `PASS` | 873 | 16 | 85 | 22 | 0 | 51 |

The first attempt against plain PostgreSQL 18 stopped fail-closed because the
required `vector` extension was unavailable. It was discarded and repeated on
the correct pgvector-enabled image. The temporary restore container was removed
after verification; no source database was modified.

## Repository and working-tree preservation archives

Location: `/Users/piotrwisniewski/Developer/Consultify/.tmp/incident-20260822/workspace-preservation`

| Artifact | Size | SHA-256 | Verification |
|---|---:|---|---|
| `all-refs.bundle` | 2.2 GB | `dce699b827f04e3857ab1346d53ac354260c18832fef0231dca368b89910bd70` | `git bundle verify` PASS; complete history and worktree refs recorded |
| `working-tree-changes.tar.gz` | 14 MB | `95c871efff7a80e9380dd128611ea71c84837a03166b2c287c3f64116884bdb2` | archive listing PASS; 78 expanded paths |
| `status-porcelain-v2.zlist` | 3.7 KB | `27495f893dc58c49ccc01e4b4500c326fe108caf9f09361af538fa53a1462575` | exact NUL-delimited freeze inventory |

No commit or stash was created, and the working tree was not rewritten. The
incident report itself increased the post-freeze visible status count from 27
to 28; the original 27 entries remain present.

## Fail-closed decisions

- Authoritative business database: `NOT YET SELECTED`.
- Database merge: `NOT AUTHORIZED`.
- Migration or schema repair: `NOT AUTHORIZED`.
- Deployment candidate: `NOT YET FROZEN`.
- Production release: `NOT AUTHORIZED`.
- Removal of rehearsal, ordinary staging, demo, dev, or any volume: `PROHIBITED` until reconciliation and restore test.
- Credential rotation: `REQUIRED BEFORE UNFREEZE`, coordinated with variable references and restart verification.

## Required closure sequence

1. Copy the five logical archives to an independent encrypted location and perform at least one isolated restore test.
2. Compare tenant and business-record identities across production, demo, staging rehearsal, staging ordinary, and dev.
3. Identify the authoritative source per tenant/data family; do not assume one whole database wins.
4. Freeze one exact application SHA and build it from a clean dedicated checkout.
5. Correct environment names and domain ownership without changing database targets in the same operation.
6. Rebuild staging against a restored clone of the selected data, apply migrations there, and verify route-to-database readback.
7. Repair readiness so missing required schema, Redis dependency failures, and build-SHA absence cannot report false green.
8. Repair AI provider credentials/routing and verify each provider independently.
9. Run authenticated browser acceptance and persistence/restart checks.
10. Only after owner acceptance, prepare a separately authorized production cutover and rollback plan.
