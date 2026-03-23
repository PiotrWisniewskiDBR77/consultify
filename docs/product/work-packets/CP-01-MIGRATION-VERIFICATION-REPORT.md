# CP-01 Migration Verification Report

## Run summary

| Field                  | Value                          |
|------------------------|--------------------------------|
| Date                   | _(pending execution)_          |
| Target                 | staging Railway Postgres       |
| Schema                 | `v8`                           |
| Runner                 | `server/scripts/v8-migrate.ts` |
| Manifest               | `server/migrations/v8-manifest.json` |
| Migrations attempted   | 45                             |
| Migrations succeeded   | _(pending)_                    |
| Migrations failed      | _(pending)_                    |
| Tables created         | _(pending)_                    |
| Indexes created        | _(pending)_                    |

## Execution log

```
(paste output of `npx tsx scripts/v8-migrate.ts --apply` here)
```

## Idempotency check

Second run of `--apply` after initial application:

| Metric             | Value       |
|--------------------|-------------|
| Second run errors  | _(pending)_ |
| Tables re-created  | 0 (expected — IF NOT EXISTS) |
| ALTER duplicates    | 0 (expected — IF NOT EXISTS) |

```
(paste output of second --apply run here)
```

## Verification

Output of `npx tsx scripts/v8-migrate.ts --verify`:

```
(paste --verify output here)
```

| Metric           | Value       |
|------------------|-------------|
| Expected tables  | _(pending)_ |
| Actual tables    | _(pending)_ |
| Missing tables   | _(pending)_ |
| Expected indexes | _(pending)_ |
| Actual indexes   | _(pending)_ |
| Missing indexes  | _(pending)_ |

## SQLite → Postgres transformations applied

| Transformation                              | Count       |
|---------------------------------------------|-------------|
| `datetime('now')` → `CURRENT_TIMESTAMP`     | _(pending)_ |
| `ADD COLUMN` → `ADD COLUMN IF NOT EXISTS`   | _(pending)_ |

## Issues found

_(pending — list any errors, warnings, or unexpected behavior)_

## Sign-off

| Role              | Name | Date |
|-------------------|------|------|
| Migration author  |      |      |
| Schema reviewer   |      |      |
| DBA / infra       |      |      |
