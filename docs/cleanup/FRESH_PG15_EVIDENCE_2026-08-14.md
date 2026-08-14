# Fresh PostgreSQL 15 migration evidence — 2026-08-14

Status: **PASS**

- Canonical SHA: `c234d415a0a664e6aac9175819cc6008d17cd5b4`
- PostgreSQL: `15.15 (Homebrew)`
- Cluster: newly initialized disposable cluster, locale `C`, encoding `UTF8`
- Database: newly created `consultify_cleanup`
- Target: loopback only, automatically selected free port `63463`
- Runner: `npx tsx server/scripts/migrate.postgres.ts --safe`
- Environment: `DB_TYPE=postgres`, `NODE_ENV=test`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DOTENV_IGNORE_LOCAL=1`
- Applied migration ledger rows: **704**
- Final runner result: `Postgres migrations complete`
- PostgreSQL stopped cleanly after readback: **yes**

## Evidence integrity

The disposable evidence directory is `/tmp/consultify-cleanup-pg15.9zMZKQ` for
the duration of this workstation session. It is not the authoritative artifact;
the hashes and exact command contract below are.

| Artifact | SHA-256 |
|---|---|
| `migrations.log` (736 lines) | `fdc9c332180e29027e5eb765289e8be406f6d2f481d2f69022ee2ec9d1826dd0` |
| `initdb.log` | `28252c89155f3d1e4733e5fe9165a91a44cd90679f663ef202f729262c0a1468` |
| `postgres.log` | `7ab7d32fe2aa7796b6c3fd1a52f142a4fb0734de7f6a5cabd8954c421f82eceb` |

## Scope boundary

This proves that the sanctioned migration runner can construct the complete
schema from an empty PostgreSQL 15 cluster at the stated SHA. It does **not**
prove module golden flows, seeded demo quality, production deployment parity,
or browser acceptance. Those remain separate gates.
