# Consultify — Docker storage safety audit

Date: 2026-08-23
Mode: `READ_ONLY_INVENTORY / NO_GLOBAL_PRUNE / DATA_PRESERVED`

## Incident observed

A fresh Finance acceptance database failed during migration
`20260719_baseline_gap.sql` with the literal PostgreSQL error
`could not extend file ...: No space left on device`. The host still reported
approximately `114 GiB` available, so the exhausted boundary is Docker
Desktop's internal storage, not the macOS filesystem.

The verification was recovered without deleting retained data: the disposable
Finance database was recreated on a container `tmpfs`, completed `831/831`
migrations and was removed with its ephemeral storage after the test.

## Current inventory

- Docker images: `10`, `4.043 GB`; `1.792 GB` reported reclaimable.
- Containers: `45`; `6` running at inventory time.
- Local volumes: `112`; `40` linked and `72` dangling.
- Local-volume footprint: `35.99 GB`; Docker reports `17.12 GB` reclaimable.
- Build cache: `0 B`.

## Protected running data

| Resource                                                                                  | State            |                                             Size | Classification                    |
| ----------------------------------------------------------------------------------------- | ---------------- | -----------------------------------------------: | --------------------------------- |
| `consultify-w3-recovered-fixtures-20260823` / `consultify_w3_recovered_fixtures_20260823` | running          |                                       `2.218 GB` | `PROTECTED_CURRENT_OWNER_FIXTURE` |
| `consultify-notetaker-qa-1ea152`                                                          | running          | volume not independently attributed in this pass | `PROTECTED_UNTIL_OWNER_CONFIRMED` |
| `consultify-fin-statement-78b5-acceptance-pg`                                             | running          |                         linked volume `869.4 MB` | `PROTECTED_RETAINED_ACCEPTANCE`   |
| `fizzup-db-1` / `fizzup_fizzup_pg`                                                        | running, healthy |                                       `156.1 MB` | `OUT_OF_SCOPE_OTHER_PRODUCT`      |

No resource in this table may be stopped or deleted as part of automatic
Consultify cleanup.

## Largest linked historical candidates

These are not approved for deletion. Their names and stopped state make them
cleanup candidates only after content classification or a verified disposable
manifest:

| Container                   | State                  | Volume size | Current decision                 |
| --------------------------- | ---------------------- | ----------: | -------------------------------- |
| `consultify-mounted-107e80` | exited `(255)`, 4 days |  `3.476 GB` | `HOLD / INSPECT_DB_CONTENT`      |
| `fm-evidence-pg`            | exited `(255)`, 4 days |  `1.555 GB` | `HOLD / INSPECT_DB_CONTENT`      |
| `case-workspace-test-pg`    | exited `(255)`, 2 days |  `859.9 MB` | `HOLD / INSPECT_DB_CONTENT`      |
| `consultify-fin-wave4-pg`   | exited `(0)`, 2 days   |  `754.8 MB` | `HOLD / CHECK_EVIDENCE_MANIFEST` |

## Safe cleanup contract

1. Never run unscoped `docker system prune`, `docker volume prune` or bulk
   removal while retained fixtures and other products share Docker Desktop.
2. Resolve every candidate to container, project/module, creation date,
   database list and evidence/handoff reference.
3. Export or explicitly waive recovery for any database that is not proven
   disposable.
4. Remove one exact stopped container and its exact volume at a time; verify the
   resource is absent and record reclaimed bytes.
5. Keep all new large PostgreSQL verification on named disposable `tmpfs`
   containers until the storage audit is closed.

## Current verdict

`CAPACITY_RISK_CONFIRMED / DATA_LOSS_AVOIDED / CLEANUP_NOT_AUTHORIZED`

The storage pressure can interrupt migrations and tests, but it does not prove
application-data corruption. No retained database was mutated or deleted by
this audit.
