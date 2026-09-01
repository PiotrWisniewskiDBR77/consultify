# Archived Migrations (pre-2026-04-13)

This directory contains **639+ legacy migration files** that were archived on 2026-04-13
as part of the migration system cleanup.

These files are **historical artifacts** and should never be run again.
They are preserved for git blame and audit purposes.

## Why archived?

- Multiple conflicting naming conventions (NNN_, YYYYMMDD_, add_*, fix_*)
- 101 duplicate version-number prefixes
- 61 double-extension `.sql.sql` files from the SQLite era
- iCloud duplicate files (with spaces in names) that leaked into production
- SQLite idioms mixed with Postgres syntax
- Dual schema definition (migrations + PostgresDatabase.ts initDb())

## Current migration system

All new migrations belong in `server/migrations/`, which is the directory read
by default by `server/scripts/migrate.postgres.ts`. Do not add migrations here
or to `server/migrations-v2/`: both directories are excluded from the Railway
deploy upload by `.railwayignore`.
