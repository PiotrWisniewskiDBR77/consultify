# Consultify closure — executable gate catalog

Status: `ACTIVE / REQUIRED_BY_ALL_LANES`

All commands run from the lane worktree. `<L>` is `A`, `B` or `C`; `<l>` is
lowercase. `<BASELINE>` is the sealed branch baseline reported in the lane
packet. A task may add a narrower focused command, but may not omit the lane
and global impact gates required below.

## G0 — identity and lease

```bash
git branch --show-current
git rev-parse HEAD
git status --porcelain=v1
node scripts/cleanup/verify-closure-lane.mjs <l> <BASELINE>
git diff --check <BASELINE>...HEAD
```

PASS: expected branch, ancestry from baseline, zero lease violation and zero
whitespace error. Record branch, baseline, HEAD, lease SHA and changed paths.

## G1 — discovery and static

```bash
npm run test:inventory:generate
npm run test:discovery-gate
npm run type-check
npm run build:backend
NODE_OPTIONS=--max-old-space-size=8192 npm run build
```

PASS: every discovered test classified; zero unresolved/broken orphan; all
commands exit 0. Existing build warnings are recorded, not silently promoted to
failure or ignored as new debt.

## G2 — exact leased Vitest denominator

```bash
jq -r '.tests.vitest[]' docs/cleanup/agents/generated/CLAUDE_LANE_<L>_PATH_LEASE.json | xargs -n 80 npx vitest run --no-file-parallelism --maxWorkers=1 --maxConcurrency=2
```

The handoff sums all chunks: discovered, executed, pass, fail, skipped, todo and
unhandled. Expected file denominator is the manifest's `counts.vitest`. Any
skip/todo in an acceptance-relevant test requires task-level disposition; exit
0 alone is insufficient.

## G3 — fresh and upgrade PostgreSQL

Choose a unique lane port and container name; never reuse a developer/demo DB.
The authoritative schema proof is the fail-closed application migration runner,
not `tests/acceptance/schema.mjs`. The latter catches individual SQL failures
and applies compatibility workarounds, so it may be used for functional legacy
acceptance only and can never satisfy the migration gate.

```bash
export ACCEPTANCE_PG_PORT=<UNIQUE_PORT>
export ACCEPTANCE_PG_NAME=consultify-closure-<l>-<SHORT_SHA>
export DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:${ACCEPTANCE_PG_PORT}/consultinity"
docker run -d --name "$ACCEPTANCE_PG_NAME" \
  -e POSTGRES_USER=consultinity -e POSTGRES_PASSWORD=consultinity \
  -e POSTGRES_DB=consultinity -p "${ACCEPTANCE_PG_PORT}:5432" pgvector/pgvector:pg16
docker exec "$ACCEPTANCE_PG_NAME" pg_isready -U consultinity
DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts
DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts
DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts --dry-run
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "select status,count(*) from schema_migrations group by status order by status"
```

The first strict run proves a fresh schema; the second must apply zero files;
the dry run must report zero pending files. `schema_migrations` must contain no
failed/pending row and its stored checksums must agree with the files at the
exact product SHA. Never pass `--safe` for acceptance. Where runtime-managed
Table Platform migrations apply, verify `tp_migration_history` by the same
fail-closed rule.

Only after this strict gate passes may the functional harness and task realDB
tests run against a separately created database or a documented compatible
schema:

```bash
node tests/acceptance/run.mjs
```

Task-specific realDB files from the lane manifest are executed with
`RUN_DB_TESTS=1 MOCK_DB=false` and the exact `DATABASE_URL`. Record both
migration and functional denominators, information_schema checks,
tenant/org/actor/fixture IDs, and all failures. A harness PASS cannot override
a strict migration FAIL.

Cleanup after evidence capture:

```bash
docker stop "$ACCEPTANCE_PG_NAME"
docker rm "$ACCEPTANCE_PG_NAME"
```

PASS: strict fresh/repeat/dry-run exit 0; zero failed or pending ledger rows;
checksums match; functional acceptance exits 0; zero lazy/runtime DDL; zero
orphan rows; cleanup confirmed. A migration change additionally requires
migration structural, functional, duplicate and completeness tests.

## G4 — signed-in browser and visual

Start the real local app against the isolated PostgreSQL database. Do not use
route interception, localStorage feature injection or mock persistence.

```bash
jq -r '.tests.playwright[]' docs/cleanup/agents/generated/CLAUDE_LANE_<L>_PATH_LEASE.json | xargs -n 25 npx playwright test --project=chromium --workers=1
```

For every owned UI task capture 1440×900, 768×1024 and 390×844 in light/dark;
PL and EN; default/loading/empty/error/permission/conflict/success; keyboard
navigation and focus return. Axe critical/serious must equal zero. Record trace,
screenshot paths, server/client SHA, DB/flag/data readback and cold reopen.

Manual VoiceOver and human brand/UX approval remain external evidence. The
agent prepares the exact journey and evidence bundle; it reports
`BLOCKED_HUMAN` until the named human signs it.

## G5 — contracts, negative controls and rollback

Each writing task must prove:

- correct owner table/writer and stable source ID;
- tenant and role/capability denial;
- stale/CAS conflict;
- duplicate/retry/replay and two concurrent requests;
- provider/schema/network failure without false success;
- restart/cold readback;
- exactly one effect/receipt or the same idempotent result;
- zero orphan row/snapshot/outbox item after failure.

Rollback is non-destructive: revert code/flags to the previous verified SHA and
prove old readers still tolerate additive schema. Never roll back an applied
migration destructively. Record command, SHA/flag readback and result.

## G6 — task evidence location

Every task writes a machine-readable summary to:

`docs/program/evidence/closure/<lane>/<task-id>/TASK_EVIDENCE.json`

Required fields:

```json
{
  "taskId": "...",
  "baselineSha": "...",
  "productSha": "...",
  "leaseSha256": "...",
  "changedPaths": [],
  "changedPathRationale": {},
  "ownerTables": [],
  "commands": [],
  "denominators": {},
  "fixtures": {},
  "negativeControls": {},
  "browserArtifacts": [],
  "rollback": {},
  "verdict": "DONE_CURRENT_SHA|PARTIAL|FIX_REQUIRED|BLOCKED_OWNER|BLOCKED_HUMAN"
}
```

`DONE_CURRENT_SHA` requires G0–G6 as applicable. Missing evidence preserves a
non-DONE verdict. Every changed path must be named and justified against this
task; lane-level lease membership alone is insufficient.
