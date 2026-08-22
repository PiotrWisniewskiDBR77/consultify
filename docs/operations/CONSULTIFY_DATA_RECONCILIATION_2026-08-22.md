# Consultify data reconciliation — 2026-08-22

Status: `FORENSIC_RECONCILIATION COMPLETE / NO MERGE AUTHORIZED`

Source archives and restore evidence are recorded in
`docs/operations/CONSULTIFY_INCIDENT_FREEZE_AUDIT_2026-08-22.md`.
All comparisons below ran against five isolated PostgreSQL 18 + pgvector
restores. No Railway database was modified.

## Executive finding

The five databases are not replicas or successive clean versions of one
database. They are independent data and schema lineages with overlapping IDs,
unique records, and conflicting migration histories. A whole-database overwrite
or blind migration replay would lose data or misapply schema.

## Recommended authority classification

| Database | Recommended role | Reason | Prohibited action |
|---|---|---|---|
| production `Postgres` | `PRODUCTION_BUSINESS_TRUTH` | Live production data; 97 organizations, 1,294 users, 352 projects; conversations updated through 2026-08-21. | Never replace with demo/rehearsal or run unqualified late migrations. |
| demo `pgvector` | `DEMO_AND_RECOVERY_SOURCE` | Largest active dataset; 331 organizations, 1,434 users, 776 conversations; activity through 2026-08-22; broad schema. | Never promote wholesale to production; contains demo/fixture and divergent records. |
| staging `Postgres-Rehearsal-20260820-71316e` | `SCHEMA_REHEARSAL_AND_WIP_RECOVERY_SOURCE` | Most table/migration breadth; work created on 2026-08-20; staging app currently points here. | Never call it canonical staging data and never delete before record-level extraction. |
| staging ordinary `Postgres` | `EMPTY_BASELINE_QUARANTINE` | One organization/user and no projects, conversations or initiatives; older schema. | Do not treat its emptiness as proof that staging data was lost. |
| dev `Postgres` | `DEV_RECOVERY_SOURCE` | 16 organizations, 85 users, 22 projects and 51 initiatives; schema is a subset of demo but records are not. | Do not discard merely because dev app is crashed. |

This classification is operational, not deletion authority. Every source stays
preserved until tenant/data-family reconciliation and an independent encrypted
copy are complete.

## Core record overlaps

### Production vs demo

| Entity | Production | Demo | Same ID | Same natural identity |
|---|---:|---:|---:|---:|
| organizations | 97 | 331 | 4 | 5 names |
| users | 1,294 | 1,434 | 1 | 8 emails |
| projects | 352 | 30 | 4 | not evaluated |
| conversations | 149 | 776 | 0 | not evaluated |
| initiatives | 68 | 170 | 8 | not evaluated |

The natural-identity overlap exceeding ID overlap proves that some equivalent
business identities were recreated under different IDs. ID-only deduplication
is unsafe.

### Production vs rehearsal

- organizations: 1 shared ID out of 97 / 3;
- users: 1 shared ID out of 1,294 / 4;
- projects, conversations and initiatives: zero shared IDs;
- rehearsal therefore contains a separate WIP lineage, not a production clone.

### Demo vs dev

- organizations: 3 shared IDs and 3 shared names;
- users: 19 shared IDs and 24 shared emails;
- projects: 7 shared IDs;
- initiatives: 17 shared IDs;
- conversations: no shared IDs.

Dev is not a disposable subset of demo at the record level even though every
dev table exists in demo.

## Schema topology

| Pair | Tables A | Tables B | Shared | Only A | Only B |
|---|---:|---:|---:|---:|---:|
| production vs demo | 1,255 | 1,753 | 1,247 | 8 | 506 |
| production vs rehearsal | 1,255 | 1,766 | 1,233 | 22 | 533 |
| rehearsal vs demo | 1,766 | 1,753 | 1,727 | 39 | 26 |
| demo vs dev | 1,753 | 873 | 873 | 880 | 0 |
| staging ordinary vs rehearsal | 1,000 | 1,766 | 992 | 8 | 774 |

Across all five databases, only 789 base tables are shared universally.
Rehearsal contains 39 tables present nowhere else; demo contains 12 such tables;
production contains 6. These unique tables require ownership and usage review
before any convergence.

## Migration-lineage conflicts

`schema_migrations` contains repeated versions, so both total ledger rows and
unique version numbers matter.

| Database | Ledger rows | Unique versions | Latest recorded application |
|---|---:|---:|---|
| production | 499 | 313 | 2026-08-08 |
| staging ordinary | 478 | 308 | 2026-07-05 |
| rehearsal | 794 | 420 | 2026-08-20 |
| demo | 782 | 407 | 2026-08-13 |
| dev | 519 | 297 | 2026-08-03 |

Key conflicts:

- production vs demo: 311 shared version numbers, 72 filename/checksum conflicts;
- production vs rehearsal: 242 shared versions, 75 conflicts;
- rehearsal vs demo: 327 shared versions, 34 conflicts;
- staging ordinary vs rehearsal: 237 shared versions, 40 conflicts.

Therefore migration version alone is not a stable identity. Convergence needs a
new immutable migration authority keyed by content hash, postcondition and
accepted legacy variant, not blind replay of the existing ledgers.

## Current-tree release-gate evaluation

The repository's canonical `evaluateSqlChain` implementation was run read-only
against every restored snapshot using the current working tree's
`server/migrations` directory. This answers a different and stricter question
than each deployed app's `/api/ready`: whether the database is acceptable for
the current candidate source.

| Snapshot | State | Failed | Skipped | Pending | Unexplained drift | Approved variants | Attested legacy |
|---|---|---:|---:|---:|---:|---:|---:|
| production | `failed` | 1 | 1 | 418 | 78 | 29 | 0 |
| staging ordinary | `skipped` | 0 | 16 | 435 | 42 | 7 | 0 |
| rehearsal | `pending` | 0 | 0 | 23 | 0 | 0 | 0 |
| demo | `pending` | 0 | 0 | 129 | 0 | 32 | 1 |
| dev | `skipped` | 0 | 8 | 298 | 25 | 2 | 0 |

Consequences:

- none of the five databases is release-ready for the current tree;
- rehearsal is the closest schema candidate but remains 23 executable
  migrations behind and is not the production-data authority;
- demo is 129 migrations behind the current tree despite its deployed older
  app reporting its own chain as complete;
- production requires explicit historical-ledger reconciliation before any
  current-chain migration attempt: `215_partner_portal.sql` is recorded failed,
  one executable row is skipped and 78 entries have unexplained drift;
- deployed HTTP readiness was source-relative and therefore masked cross-SHA
  incompatibility. A green endpoint from an older deployment does not qualify a
  database for the new candidate.

No migration was applied during this evaluation.

## Safe convergence architecture

1. Keep production as the source for existing production tenants and records.
2. Build a new `staging-candidate` database from a fresh clone of production,
   never by repointing the current staging app at rehearsal.
3. Apply the exact candidate migration chain to the clone using preflight and
   postcondition checks; quarantine conflicting historical versions rather than
   rewriting their ledger rows.
4. Extract demo, rehearsal and dev records into typed import manifests by
   tenant and data family. Each row receives source DB, source ID, natural-key
   fingerprint, content hash and disposition.
5. Classify every row as `SAME`, `SOURCE_ONLY`, `TARGET_ONLY`, `CONFLICT`,
   `FIXTURE_ONLY` or `REJECTED_INVALID`.
6. Import only owner-approved `SOURCE_ONLY` records and explicitly resolved
   conflicts into the staging candidate with new idempotency receipts.
7. Verify referential closure, tenant isolation, counts, hashes and cold
   readback before any application deployment.
8. Bind one clean application SHA to this staging candidate and run the Wave 3
   owner flows there.
9. Preserve production unchanged until the later RC and separately authorized
   production release.

## Immediate next engineering packets

### DBR-01 — immutable database identity

Produce a non-secret fingerprint per database: Railway project/environment/
service IDs, server version, schema hash, migration-ledger hash, table-count
hash and snapshot timestamp.

Status: `PARTIAL / RESTORED-SNAPSHOT FINGERPRINTS CAPTURED`.

All snapshots were evaluated on the same PostgreSQL 18.6 + pgvector restore
engine. The hashes therefore identify restored logical content, not the source
Railway server binary or physical volume.

| Snapshot | Schema rows | Schema SHA-256 | Migration SHA-256 | Table-count SHA-256 |
|---|---:|---|---|---|
| production | 14,793 | `b04cd0c44df6d7d02fa6d2c7dadd7fb0be3ed87ac812b329e0f2d799fa4a39cf` | `7f10c6ec109edacedc4940c3cb0a676e437fb55eda54cd8d2116f2191755cb64` | `275a6ddeb5d7e1b6f2371ecd6400bb3b31875e5dfd2ff591200b3cb4227ec35c` |
| staging ordinary | 11,771 | `84606cb6b59fa214be697d01864ab493c9b7c4a9f390c3a11ce3febaa8142fee` | `d22ca9ff56b7c002ee1174fcfecd872fbcdf5fc1aa280d20c4aabfb0f54c11c2` | `4ff9edef918283b9557a527692dcfcfc1aa3cd8825b6fc75917e2e328ce6f336` |
| rehearsal | 22,533 | `ba4055b31af3aa469ed6e2aac4cf9a92b6f134ea58f1be37d328d02571d1b54a` | `6924f6c6d5dad9645279ce70b4d5ba0484bc8ea2a2d38a169d7e4dfc26449444` | `0a6549168721b716d5a599b207563dbebefc3384e763a465e28617e70f87fa84` |
| demo | 22,681 | `2987ae391e88911f4ed1815706ff809af3e521f966d531b8efee32ca0ae45d40` | `ac6ab91300ef5387753053390b2e93dd09654a84750e5ef97bf234b22fa2d9cf` | `5fa9106bc186cf15719d5b462ef3b130418cd01c31383d6ca1912a50c392f57f` |
| dev | 10,748 | `199696395f312acfdde954de615bf0fa25356b701910caf906167a75d97f63ba` | `a6b76ac08d434e6b9fd769ede17d3abe7ba3330925a75517cd1f5f1b158b5258` | `bd67129f704f9aabdaa96f5ce0a148a30bc7e63a681c87335b41660b0c8d1c83` |

The remaining DBR-01 item is the live Railway source/version fingerprint. It
must be captured without exposing connection secrets.

### DBR-02 — tenant/data-family manifests

Generate manifests for organizations, users/memberships, projects,
conversations, initiatives, assessments, tool outputs, results, finance and
materials. Do not export plaintext PII into repository evidence.

### DBR-03 — fresh staging candidate

Create only after DBR-01/02 are complete. Source must be a restored production
snapshot in a new isolated target. No existing Railway volume is reused.

### DBR-04 — migration authority reconciliation

Map every filename/checksum conflict to repository content, schema
postcondition, accepted variant or explicit quarantine. No existing ledger is
rewritten.

### DBR-05 — approved data import

Import manifests with deterministic dry-run, conflict report, idempotency key,
receipt and rollback. No whole-database merge.

## Current gate

`DATA SOURCES CLASSIFIED / RECORD-LEVEL MANIFESTS PENDING / STAGING-CANDIDATE NOT YET CREATED`
