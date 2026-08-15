# Consultify acceptance checkpoint — 2026-08-15

## Purpose

This checkpoint is the controlled hand-off from repository cleanup to systematic
module acceptance. It records evidence and open gates; it is not a blanket
release-readiness declaration.

## Canonical tree

- Checkout: `/Users/piotrwisniewski/Developer/consultify-canonical-full-20260814`
- Branch: `codex/consultify-canonical-cleanup-20260814`
- Checkpoint HEAD at creation: `2cc7b6bdd804e7d9eb55fe00045fa538fe0f7b45`
- Product-code parent used by generated inventories:
  `7bf4d27cd751afb2d6c24d195891be5aa54c433b`
- The checkpoint commit after that parent changes generated cleanup evidence
  only. It does not change application runtime code.
- Working tree at checkpoint creation: clean.

No module may be accepted from another checkout without first recording its
unique commits in the recovery inventory and integrating the selected commit
into this tree.

## Verified build gates

The following commands completed with exit code `0` from the canonical tree:

| Gate | Command | Result |
|---|---|---|
| Frontend typecheck | `npm run type-check` | PASS |
| Frontend production build | `npm run build` | PASS |
| Backend TypeScript build | `npm run build:backend` | PASS |
| Cleanup matrix integrity | `npm run test:cleanup-matrix:validate` | PASS |

The frontend build reports large-chunk warnings. These are a performance and
maintainability risk, not a compilation failure.

## Source inventory evidence

The generated inventories under `docs/cleanup/generated/` are pinned to
`7bf4d27cd751afb2d6c24d195891be5aa54c433b` and report:

- 5,045 runtime-reachable production files;
- 526 support-only files;
- 12 build-support files;
- 1,246 orphan candidates requiring manual review;
- 0 unresolved local imports from runtime-reachable files.

`ORPHAN_CANDIDATE` never authorizes deletion. Current triage identifies 66
unmounted-route candidates, 135 unwired-runtime-logic candidates and 608
unmounted-UI candidates. Each requires semantic and history review.

## Test execution status

The executable classification source is
`scripts/testing/cleanup-test-matrix.json`.

At this checkpoint 137 files are explicitly outside the standard wave:

- 66 isolated-process tests;
- 35 fresh-PostgreSQL tests;
- 25 legacy PostgreSQL-porting harnesses;
- 2 dedicated external-runtime tests;
- 3 flaky harnesses requiring repair;
- 6 stale harnesses requiring repair.

Fresh discovery with the same exclusions found 4,053 standard-scope test files.
The previous monolithic diagnostics reached only a prefix of that manifest
before their fail limit: the furthest reached 21,453 passing test cases and
then stopped on five failures. Therefore those runs were diagnostic evidence,
never a complete standard-gate PASS. The failures were subsequently classified
as fresh-realDB requirements or repaired in the initiative notification
harness. A later monolithic run was intentionally stopped because accumulated
HTTP servers, ports and process-global state made it an inefficient method.

The replacement standard gate must run the same complete scope in deterministic
fresh-process shards and report every failing shard. Until that and the isolated,
realDB and external-runtime gates pass, repository-wide tests remain `PARTIAL`.

## Rules for module acceptance

For every module, acceptance must follow this chain:

`route → production UI → API mount → service → database/migration → test → demo`

Allowed states are:

- `LIVE_CONNECTED` — the complete chain is evidenced;
- `IMPLEMENTED_UNMOUNTED` — valuable implementation exists but production UI
  or route does not expose it;
- `PARTIAL` — at least one required layer or evidence gate is missing;
- `DUPLICATE` — another implementation is the selected canonical owner;
- `DEAD_CANDIDATE` — no known production/support reachability, still awaiting
  deletion authorization;
- `UNKNOWN` — evidence is insufficient.

Local tests, a visible button, a route flag, a build, a mock response or an
agent statement cannot independently upgrade a module to `LIVE_CONNECTED`.

## Current checkpoint verdict

- Canonical tree: `PASS`
- Frontend/backend compilation: `PASS`
- Structural source inventory: `PASS`, with manual review outstanding
- Semantic module inventory: `IN_PROGRESS`
- Git/worktree recovery inventory: `IN_PROGRESS`
- Deterministic standard test gate: `IN_PROGRESS`
- Isolated/realDB/external-runtime gates: `PENDING`
- Demo parity with the checkpoint SHA: `NOT_VERIFIED`
- Repository cleanup completion: `PARTIAL`

This state is sufficient to continue controlled module-by-module investigation
from one tree. It is not sufficient to declare the application release-ready.
