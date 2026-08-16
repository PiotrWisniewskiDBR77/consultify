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

```bash
export ACCEPTANCE_PG_PORT=<UNIQUE_PORT>
export ACCEPTANCE_PG_NAME=consultify-closure-<l>-<SHORT_SHA>
node tests/acceptance/run.mjs
SKIP_DB_UP=1 node tests/acceptance/run.mjs
docker exec "$ACCEPTANCE_PG_NAME" pg_isready -U consultinity
```

The first run proves fresh schema/seed/acceptance. The second proves
idempotent/upgrade behavior on the same database. Task-specific realDB files
from the lane manifest are also executed with `RUN_DB_TESTS=1 MOCK_DB=false`
and the harness `DATABASE_URL`. Record migration ledger, information_schema
checks, tenant/org/actor/fixture IDs and both run denominators.

Cleanup after evidence capture:

```bash
docker stop "$ACCEPTANCE_PG_NAME"
docker rm "$ACCEPTANCE_PG_NAME"
```

PASS: fresh and repeat exit 0, zero lazy/runtime DDL, zero orphan rows, cleanup
confirmed. A migration change additionally requires migration structural,
functional, duplicates and completeness tests.

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
non-DONE verdict.
