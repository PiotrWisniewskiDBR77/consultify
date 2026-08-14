# Fresh PostgreSQL 15 runtime evidence — 2026-08-14

Status: **PASS**

- Schema candidate SHA: `57ed459aeebd` (`954_core_task_membership_runtime_schema.sql`)
- Runtime test candidate SHA: `ceeb3a72176c37cb85ec198695ccf48f4708b83a`
- Difference between the two SHAs: fixture cleanup in one realDB test only; no
  production or migration source changed.
- PostgreSQL: `15.15 (Homebrew)`
- Cluster: newly initialized disposable cluster, locale `C`, encoding `UTF8`
- Target: loopback only, automatically selected port `64274`
- Runner: `npx tsx server/scripts/migrate.postgres.ts --safe`
- Environment: `DB_TYPE=postgres`, `NODE_ENV=test`, `RUN_DB_TESTS=1`,
  `MOCK_DB=false`, `DOTENV_IGNORE_LOCAL=1`
- Applied migration ledger rows: **705**
- Full migration replay: **PASS**
- Runtime schema readback: `task_history|3`
- RealDB gate: **20/20 files PASS, 142/142 tests PASS**
- Isolation: every realDB file received a separate database cloned from the
  freshly migrated template.
- Residual temporary test databases after the run: **0**
- PostgreSQL stopped cleanly after readback: **yes**

The My Work golden-flow file uses its dedicated Vitest configuration and the
required `ENABLE_V8_GLOBAL=true` contract. It passed **17/17** tests. Running
that file through the generic root configuration is not accepted as evidence,
because the root setup installs fast-suite database mocks.

## Evidence integrity

The disposable evidence directory is
`/tmp/consultify-cleanup-pg15-954.80XHiZ` for the duration of this workstation
session. It is not the authoritative artifact; the hashes below bind the
recorded outputs.

| Artifact | SHA-256 |
|---|---|
| `initdb.log` | `9568b24b9269f1b33616fd4855e311b5d0d50eaadd90295763d6601a75891f28` |
| `migrations.log` | `e66c529899bf6b76f446edc9a17150250a85cbc78ee530709afea60180cad781` |
| `migrations-replay.log` | `1b2e00e72b2b933853fc7157119684ca65e1a2cca6a4132c990c075613106994` |
| `schema-readback.txt` | `4da469ef67b060709c9018ee4b96c1e9bd258d187a700185dbec0d1aeb91a79e` |
| `summary.tsv` | `300ed0c120ffcf0e19dd6421c6e8b97d415415121341425a59f7cddf8bd41311` |

## Scope boundary

This proves fresh-schema construction, migration replay, the explicit realDB
matrix, and the repaired My Work runtime flow. It does **not** prove browser
acceptance, seeded demo quality, external-runtime tests, or deployment parity.
Those remain separate gates and must not be inferred from this PASS.
