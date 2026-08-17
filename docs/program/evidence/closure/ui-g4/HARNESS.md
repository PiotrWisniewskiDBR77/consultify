# UI-CANON G4 — browser harness (reproducible)

Lane: `codex/claude-next-ui-g4`, worktree `/Users/piotrwisniewski/.codex/worktrees/ui-g4`.
Baseline: `c4f84a2baa7f1ce9c7b03a68ebbd1783cdbc581b`.

G4 is the **browser** gate. G0/G1/G3 (lease, typecheck/build, migration chain) were
closed by earlier lanes; every prior `*-UI-CANON-001` record stopped at
`NOT_VERIFIED` / `PARTIAL` / `BLOCKED_HUMAN` precisely because no lane ever ran a
truly mounted application. This document is the harness that closes the
automatable half.

Non-negotiables honoured by this harness:

- a **truly mounted** application — real backend process, real Vite-served client;
- **real PostgreSQL**, built from the canonical migration chain, not a dump of
  someone else's drifted database;
- **real authentication** — a signed JWT issued by `/api/test-support/bootstrap`;
- **no request interception anywhere** — the sweep never calls `page.route()`,
  never fulfils a response, never mocks the database.

## 1. Sandbox database (own container, no shared state)

```bash
docker run -d --name consultify-uig4-pg -p 127.0.0.1:34940:5432 \
  -e POSTGRES_USER=consultinity -e POSTGRES_PASSWORD=consultinity \
  -e POSTGRES_DB=consultinity pgvector/pgvector:pg16
```

Build the schema **from zero through the canonical chain** — do not restore a dump
from another lane's container:

```bash
DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34940/consultinity" \
DB_TYPE=postgres CI=true npx tsx server/scripts/migrate.postgres.ts
```

Result at this baseline: **732 migrations applied, 1588 tables, 0 failures**; a
second run applies 0 (idempotent).

### Why not a dump from an existing container

The first attempt restored `consultify-codex-integration-pg` (1557 tables). The
chain then failed on `20260908_execution_bvp_spine.sql` with
`foreign key constraint "execution_case_links_project_id_fkey" cannot be implemented`.
Root cause: in that donor database `projects.id` is `uuid`, while the canonical
schema (`server/migrations/000_initdb_core_tables.sql:83` and
`000_z_core_baseline.sql:154`) declares `projects.id TEXT`. **The migration is
correct; the donor database had drifted.** Fixing the migration to match a drifted
database would have been a backend change made to satisfy a harness — exactly what
this lane must not do. Building from zero removed the problem entirely.

## 2. Backend (real Postgres, no mock)

```bash
cd server && TMPDIR=/tmp/e2euig4 NODE_ENV=test PORT=3941 \
DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34940/consultinity" \
DB_TYPE=postgres DB_MANAGED_SCHEMA=off MOCK_DB=false MOCK_REDIS=true \
DB_QUERY_TIMEOUT=15000 DB_STATEMENT_TIMEOUT=30000 \
ENABLE_TEST_GATEWAY=true ENABLE_TEST_SUPPORT=true POSTGRES_SKIP_INIT_IN_TEST=1 \
DISABLE_CONNECTION_POOL=true DISABLE_SCHEDULER=true DISABLE_AI_PROVIDER_SENTINEL=true \
DISABLE_AI_HEALTH_MONITOR=true DISABLE_STARTUP_HEALTH_MONITOR=true SKIP_STARTUP_VALIDATOR=true \
ENABLE_V8_GLOBAL=true TEST_SUPPORT_KEY=local-test-support-key-change-me \
E2E_MODE=true CI=true RUN_DB_TESTS=1 npx tsx src/index.ts
```

`GET /api/ready` must report `"status":"ready"` with `"detail":"chain complete"`.
A permanent `503 SERVER_STARTING` means the two migration ledgers disagree — see
`docs/program/evidence/closure/a/ASM-UI-CANON-001/BROWSER_HARNESS.md`.

## 3. Frontend (Vite dev — no production rebuild per run)

```bash
VITE_API_TARGET=http://127.0.0.1:3941 VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true \
npx vite --port 3940 --strictPort
```

## 4. Sweep

```bash
scripts/g4/run-sweep.sh all          # or: scripts/g4/run-sweep.sh CHAT MYW
```

Per surface this captures **12 cells** (3 viewports × PL/EN × light/dark) plus
secondary routes, deep-link/reload/cold-reopen, keyboard-only traversal, honest
state probes, and writes `G4_SWEEP_RESULT.json` next to its screenshots.

The Playwright test deliberately **does not assert a green canon**. It measures and
records. A verdict is written by hand into `TASK_EVIDENCE.json` from the measured
numbers, so a failing canon cannot hide behind a passing test.

## 5. First-run onboarding — why it matters

A brand-new tenant shows the first-run modal ("Poznaj Teresę / Let's start your
transformation") on top of **every** surface. The first sweep captured that modal
instead of Chat and still reported `surfaceRendered: true`, because the ready-signal
regex matched chrome behind the overlay. Two corrections were made:

1. onboarding is retired the way the product retires it — a real authenticated
   `PUT /api/preferences {onboarding_completed:true}`
   (`src/services/api.ts` `markFirstRunComplete`), not by hiding anything;
2. a surface now counts as rendered only when **no** `role=dialog` / `aria-modal`
   covers more than 15% of the viewport.

This is recorded because it is the exact false-green this gate exists to catch.
