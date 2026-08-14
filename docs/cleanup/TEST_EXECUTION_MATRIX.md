# Cleanup Test Execution Matrix

This matrix prevents a monolithic green run from hiding tests that require a
separate process, a real database, or a dedicated HTTP runtime.

The executable source of truth is
`scripts/testing/cleanup-test-matrix.json`. Validate it with:

```bash
node scripts/testing/cleanup-test-matrix.mjs validate
```

## Gates

| Gate | Meaning | Release evidence |
| --- | --- | --- |
| `standard` | Normal Vitest wave after explicit exclusions | Required |
| `isolated` | One file per fresh Vitest process | Required |
| `realdb` | Fresh disposable PostgreSQL after all migrations | Required |
| `externalRuntime` | Dedicated application and database runtime | Required |
| `legacyPostgresPort` | SQLite-era or conditional harness requiring repair | Not evidence until repaired |
| `flakyHarness` | Nondeterministic test infrastructure | Not evidence until repaired |

Every file excluded from `standard` must appear in exactly one explicit gate,
and every explicitly classified file must be excluded from `standard`. The
validator fails on missing files, duplicates, silent exclusions, and
unexcluded classified files.

## Commands

```bash
# Validate the classification contract
node scripts/testing/cleanup-test-matrix.mjs validate

# Run the standard wave
node scripts/testing/cleanup-test-matrix.mjs run-standard

# Run collision-prone tests one file per process
node scripts/testing/cleanup-test-matrix.mjs run-isolated

# Inspect all reasons and files
node scripts/testing/cleanup-test-matrix.mjs list
```

The `realdb` and `externalRuntime` gates are intentionally not auto-started by
this script. Their runners must first create and attest a disposable database
or a dedicated HTTP runtime. Pointing them at an arbitrary existing developer
database is not accepted as proof.

`voice-stt-save.test.ts` and `api-keys.l3.test.ts` explicitly construct legacy
SQLite fixtures while the production database factory is PostgreSQL-only.
They therefore remain visible under `legacyPostgresPort`; silently running
them against an ambient developer PostgreSQL database is forbidden.
