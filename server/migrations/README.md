# Migrations — `server/migrations/` is the live directory

Add new migrations here, in `server/migrations/`, following the naming patterns
used by the most recent files. This is the directory read by default by
`server/scripts/migrate.postgres.ts` (`args.dir || 'server/migrations'`).

Do not add new migrations to `server/migrations-v2/` or
`server/migrations-archive/`: both directories are excluded from the Railway
deploy upload by `.railwayignore`. The archive contains historical files kept
for audit and git history; `migrations-v2` is a stalled alternative whose final
disposition requires a separate product decision.

See `docs/program/funkcje/ZNALEZISKO_MARTWY_KATALOG_MIGRACJI.md` for the
measured discrepancy and its operational impact.
