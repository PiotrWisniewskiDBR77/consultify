# ASM-UI-CANON-001 — Browser harness: root cause + working command

Lane: `codex/closure-claude-a-method-evidence`, worktree
`/Users/piotrwisniewski/Developer/consultify-closure-claude-a`. Verified 2026-08-16.

## Root cause of the reported failure

The reported symptom was:

```
Error: test-support bootstrap failed after retries (runId=local-...): 503 Service Unavailable
{"error":"Server starting","code":"SERVER_STARTING","database":"initializing"}
```

**This is NOT a slowness/load problem.** It is a permanent block caused by a state
mismatch between two independent migration ledgers this repo keeps:

1. `tp_migration_history` — written by the Table Platform runner that the backend
   itself runs on every boot (`server/src/services/tablePlatform/migrationRunner.js`,
   invoked from `establishDatabaseReadiness()` in
   `server/src/startup/databaseReadiness.ts`).
2. `schema_migrations` — a **separate** ledger, only written by the standalone SQL
   migration script `server/scripts/migrate.postgres.ts` (`npm run db:migrate:postgres`).
   Readiness evaluates this ledger too, via the shared
   `server/src/services/releaseGate/sqlChainEvaluator.ts` (the same evaluator the
   release gate and `/api/health/migrations` use).

`GET /api/ready` (`server/src/startup/readinessRoutes.ts`) only returns 200, and the
`createReadinessGate` middleware only stops emitting `503 SERVER_STARTING`, once
**both** ledgers agree the schema is fully applied. On this lane's sandbox Postgres
(`consultify-closure-a-34914`, port 34914) three lane-authored migrations had been
applied by the boot-time TP runner (so `tp_migration_history` was fine) but had
**never been run through `migrate.postgres.ts`**, so `schema_migrations` had zero
rows for them:

```
20260910_claude_a_assessment_initiative_batch_uniqueness.sql
20260910_claude_a_audit_initiative_proposal_exactly_once.sql
20260910_claude_a_interview_candidate_exactly_once.sql
```

Readiness logged, on every boot, forever (not just slowly):

```
[Readiness] SQL migration chain not acceptable (pending): 3 pending migration(s): ...
[Server] Staying up in DEGRADED/NOT-READY state — /api/ready reports 503 and no business route is served.
```

The HTTP listener itself comes up in ~1s (`/api/health/ping` returns 200
immediately — that is why Playwright's `webServer` health-check line in
`global-setup.ts` passes), but `/api/ready` (and therefore
`/api/test-support/bootstrap`, gated by `createReadinessGate`) stays 503
**indefinitely** — there is no timeout after which it flips true on its own. The
Playwright global-setup's 10-minute bootstrap retry loop
(`tests/e2e/smoke/global-setup.ts:88-145`) was therefore never going to succeed no
matter how long it waited or how idle the machine was.

**Diagnosis method** (per the brief's instruction not to assume): started the
backend alone with `E2E_USE_WEB_SERVER=false`, same env as the Playwright
`webServer` block, watched `stdout` directly, and read
`server/src/startup/databaseReadiness.ts` /
`server/src/startup/readinessRoutes.ts` / `server/src/services/releaseGate/sqlChainEvaluator.ts`
to find what `dbReady` actually waits on. Confirmed the 3 missing rows directly:

```sql
select filename, status, applied_at from schema_migrations where filename like '%claude_a%';
-- 0 rows (before fix); schema_migrations had 703 rows total, none for these 3 files
```

## Fix applied (database-only, this lane's own sandbox Postgres — no git mutation)

```
DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34914/consultinity" \
DB_TYPE=postgres CI=true npx tsx server/scripts/migrate.postgres.ts
```

Output: `Applying migrations: 3` → all three applied → `✅ Postgres migrations complete`.
This is a **local database write on lane A's own dedicated sandbox container**
(`consultify-closure-a-34914`), not a code or git change — no rule in this brief
prohibits it, and it is exactly the tool this repo ships for exactly this ledger.
After this, `/api/ready` flips to `"status":"ready"` on the very next boot.

**Integrator note**: any other closure lane hitting the identical
`SERVER_STARTING` / bootstrap-timeout symptom against a `consultify-closure-*`
sandbox almost certainly has the same root cause — a migration applied by the
boot-time TP runner but never recorded in `schema_migrations` — and the same fix
(`npx tsx server/scripts/migrate.postgres.ts` against that lane's own
`DATABASE_URL`) should be tried before assuming load/timeout. This is worth
surfacing to the lead as a harness-wide finding, not an ASM-specific one.

## Measured startup time (post-fix, real Postgres, no mocks)

Standalone backend, `tsx src/index.ts`, cold process start to `/api/ready` = 200:

| Run | Process start → HTTP listener up | → `dbReady=true` (full ready) |
|---|---|---|
| 1 (post-fix) | ~18s | ~19s (`21:39:54` → `21:40:13`) |
| 2 (persistent harness) | ~15s | ~20s |

Full Playwright run (`E2E_USE_WEB_SERVER=true`, cold — includes `npm run build`
for the frontend `vite preview` webServer target, not just backend boot):
**4.8 minutes** end-to-end for a single smoke spec (`tests/e2e/smoke/login.spec.ts`,
1 test), machine under load from ~9 concurrent Postgres containers / other agent
sessions. Backend boot itself was not the bottleneck once the ledger was fixed —
the frontend production build inside the `webServer` command was.

## Working, reproducible command (own ports/DB, no collisions)

One-shot, fully automated (Playwright starts+stops both servers — matches the
lead's original invocation, just on lane-A-private ports and with the ledger
fixed first):

```bash
# One-time, only needed once per sandbox DB (idempotent — re-running is a no-op
# if already applied):
DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34914/consultinity" \
DB_TYPE=postgres CI=true npx tsx server/scripts/migrate.postgres.ts

E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_MOCK_DB=false E2E_MODE=true \
DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34914/consultinity" \
E2E_API_URL=http://127.0.0.1:3411 E2E_BASE_URL=http://127.0.0.1:3410 \
ENABLE_V8_GLOBAL=true VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true \
E2E_TMP_DIR=/tmp/e2easm CI=true \
npx playwright test <spec(s)> --project=chromium --workers=1 --retries=0
```

Result on `tests/e2e/smoke/login.spec.ts`: **1 passed (4.8m)**, real signed-in
session against real Postgres, no mocks, no route interception.

### Faster iteration variant (recommended for repeated runs in one session)

The one-shot command rebuilds the whole frontend (`npm run build`) on every
invocation because `playwright.config.ts`'s webServer target is
`vite preview` (production build), not `vite dev`. For iterating on specs in the
same session, start both servers once, by hand, and point Playwright at them with
`E2E_REUSE_SERVER=true` (Playwright's `reuseExistingServer` — independent of
`CI`/retries, it just skips (re)spawning if the URL already answers):

```bash
# Terminal / background process 1 — backend, tsx, same env family as the webServer block:
cd server && TMPDIR="/tmp/e2easm" \
NODE_ENV=test PORT=3411 \
DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34914/consultinity" \
DB_TYPE=postgres DB_MANAGED_SCHEMA=off MOCK_DB=false MOCK_REDIS=true \
DB_QUERY_TIMEOUT=15000 DB_STATEMENT_TIMEOUT=30000 \
ENABLE_TEST_GATEWAY=true ENABLE_TEST_SUPPORT=true POSTGRES_SKIP_INIT_IN_TEST=1 \
DISABLE_CONNECTION_POOL=true DISABLE_SCHEDULER=true DISABLE_AI_PROVIDER_SENTINEL=true \
DISABLE_AI_HEALTH_MONITOR=true DISABLE_STARTUP_HEALTH_MONITOR=true SKIP_STARTUP_VALIDATOR=true \
ENABLE_V8_GLOBAL=true TEST_SUPPORT_KEY=local-test-support-key-change-me \
E2E_MODE=true CI=true RUN_DB_TESTS=1 \
npx tsx src/index.ts

# Terminal / background process 2 — frontend, vite DEV server (fast, no build wait):
VITE_API_TARGET=http://127.0.0.1:3411 VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true \
npx vite --port 3410 --strictPort

# Then, repeatedly, for each spec run (seconds, not minutes — no rebuild):
E2E_USE_WEB_SERVER=true E2E_REUSE_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_MOCK_DB=false E2E_MODE=true \
DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34914/consultinity" \
E2E_API_URL=http://127.0.0.1:3411 E2E_BASE_URL=http://127.0.0.1:3410 \
ENABLE_V8_GLOBAL=true VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true \
E2E_TMP_DIR=/tmp/e2easm CI=true \
npx playwright test <spec(s)> --project=chromium --workers=1 --retries=0
```

Backend ready in ~20s, frontend dev server ready in ~5-10s (no production
build). Verified both patterns end-to-end in this session.

## Things ruled out

- **Not machine load.** Backend readiness measured at ~19-20s wall clock twice,
  on a machine running ~9 concurrent Postgres containers and multiple other agent
  sessions (confirmed via `ps`/`docker ps` at the time of measurement). Load
  affects the frontend *build* step's wall-clock time, not backend readiness,
  which was the actual reported blocker.
- **Not `CI=true` vs `NODE_ENV=test` for the DB-host guard** — both were already
  set correctly in the lead's original command
  (`server/src/config/databaseTargetResolver.ts:111`, `allowLocalDatabaseForTests`
  accepts either).
- **Not a wrong `DATABASE_URL`/port** — the DB container
  (`consultify-closure-a-34914`) was confirmed `pg_isready` and reachable
  throughout.
- **Not `MOCK_DB`** — `E2E_MOCK_DB=false` was already correct in the original
  command; this repo's `playwright.config.ts` defaults `MOCK_DB` to `true` if the
  env var is unset, so this flag matters and was already right.

## Flags used, explicitly, per capture (see UI_INVENTORY.md for detail)

- `assessmentFiveSurfacesV1` — default **TRUE**, not overridden, on for all captures.
- `drdMethodWorkspaceSliceV1` / `drdHttpSourceOfTruthV1` — default **FALSE**;
  turned **ON** only via `VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true` +
  in-page `localStorage` flag override for the specific captures that exercise
  the DRD method-core create/freeze/readback flow. Any capture of the Library
  tab's plain "Start" (legacy path) has both **OFF**.
