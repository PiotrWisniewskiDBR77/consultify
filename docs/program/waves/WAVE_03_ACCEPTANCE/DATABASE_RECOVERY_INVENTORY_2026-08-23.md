# Database recovery inventory — 2026-08-23

Status: `SOURCE_DUMPS_PRESERVED / PROD_AND_DEMO_RESTORE_PASS / FIXTURE_CATALOG_DRIFT`

## Safety boundary

All checks were local. Railway databases and services were not queried or
mutated during this pass. Dump files were mounted read-only. Restore targets
were disposable PostgreSQL 18 databases in an isolated container; the
container and its anonymous volume were removed afterward.

## Incident dump inventory

| Archive | Bytes | Modified (Europe/Warsaw) | SHA-256 | PG18 TOC entries |
|---|---:|---|---|---:|
| `demo-pgvector.dump` | 245395290 | `2026-08-22T21:45:20+0200` | `0cab9124715f1065968d9a4100ec253467348f9ad2fd39f355f88226511595cf` | 11280 |
| `dev-postgres.dump` | 4370793 | `2026-08-22T21:46:03+0200` | `22882dfeabe8daa6924c1305093cf5755198cd5293b57babe12c742143e34d60` | 5484 |
| `production-postgres.dump` | 38417169 | `2026-08-22T21:40:32+0200` | `8b25f3405e7cb3cb3bb048fc1dcee1d7f2339302c348620774b51bab4e0d2901` | 7492 |
| `staging-postgres.dump` | 4656230 | `2026-08-22T21:41:27+0200` | `3dbcf1bc9b7875a811e5b769ad4ecf055b66a05b74d98d5ab77e052fee1514af` | 6045 |
| `staging-rehearsal.dump` | 7959017 | `2026-08-22T21:43:10+0200` | `ad7ccd9caf1d888225ec048c9903daa44e4f5f2d65ca7dccf6f65ed86858d476` | 11444 |

PostgreSQL 16 reported archive-header version `1.16` as unsupported. PostgreSQL
18 listed all five archives successfully; that compatibility error is not
evidence of corruption.

## Qualified restore evidence

`production-postgres.dump` restored with `--exit-on-error --no-owner --no-acl`:

- database size: `255121087` bytes;
- public base tables: `1131`;
- organizations/users/projects: `97 / 1294 / 352`;
- schema migration rows: `499`, including two historical `skipped` and one
  historical `failed` row;
- orphan users/projects relative to organizations: `0 / 0`.

`demo-pgvector.dump` restored with the same fail-closed command:

- database size: `794416831` bytes;
- public base tables: `1623`;
- organizations/users/projects: `331 / 1434 / 30`;
- schema migration rows: `782`, including seven historical `skipped` and one
  historical `failed` row;
- orphan users/projects relative to organizations: `0 / 0`.

The historical non-success ledger rows mean these snapshots are recoverable
data sources, not automatically release-ready schemas.

## Unqualified restore attempts

The dev and staging restore commands returned success before the Docker VM
exhausted its internal disk during the subsequent staging-rehearsal restore.
PostgreSQL then could not write even a query init file, so dev/staging readback
was not obtainable and is not counted. `staging-rehearsal` failed under
`--exit-on-error` with `No space left on device`. The entire disposable
container/volume was removed immediately. Source dumps remain unchanged and
hash-addressed above.

## Retained Wave 3 fixture discrepancy

The 2026-08-22 fixture inventory says 16 selected databases existed on
`127.0.0.1:34940`. The only stopped container exposing that port was
`consultify-uig4-pg`. After starting that exact container, its catalog contained
only `consultinity` and `postgres`; none of the 16 named owner databases was
present. The container was returned to its stopped state without writes.

The FINAL `0600` fixture manifests, marker tuples, seed scripts, runtime logs
and browser evidence remain on disk, but they do not substitute for the absent
database catalogs. Therefore the previous `16/16 storage readiness` claim is
currently stale and must be downgraded to
`DATABASE_ABSENT_AT_REVALIDATION / RECONSTRUCTION_FROM_GUARDED_SEEDS_REQUIRED`.
No fixture was silently recreated during this audit.

## Next recovery gates

1. preserve a second copy of the five dump archives and checksum manifest on a
   separate volume/object store;
2. free or enlarge Docker VM storage, then complete isolated dev, staging and
   staging-rehearsal restores;
3. reconstruct each missing owner fixture only through its guarded seed and
   FINAL marker contract, then cold-read back before browser replay;
4. do not use any restored snapshot as a deployment source until its migration
   ledger is reconciled against the frozen candidate.
