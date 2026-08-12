# RN-G6 P0D — Results Next write-path fix (F1 correlation-id, F1B maker-checker read)

Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g6-p0d`, branch `rn-g6-p0d`.
Starting HEAD `84d843c59f`. Final HEAD `15de591c24`.

Commits (small, on-branch, in order):
1. `d086012a94` — client: mint a real UUID for `X-Correlation-ID` (F1, client)
2. `430a0dcd6a` — server: validate `X-Correlation-ID` shape (F1, server)
3. `15de591c24` — `GET /kpi/:kpiId/version` + client wiring (F1B)

`git status --short` at the end of this session: clean (nothing uncommitted).

---

## F1 — correlation id is not a UUID

### Client fix
`src/services/apiUtils.ts:10-46`. Old code:
```js
correlationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
```
New code generates via `crypto.randomUUID()` (the existing repo convention —
already used in `kpiApi.ts`, `roiApi.ts`, `okrAdminApi.ts`,
`createIdempotencyKey.ts`, etc. — no new generator invented), with a
same-shape manual fallback for the rare environment without
`crypto.randomUUID`.

**Existing invalid `sessionStorage` values**: the stored value is validated
against a UUID-shape regex on every module load, not just checked for
truthiness. `if (!correlationId || !RESULTS_UUID_RE.test(correlationId))` —
a pre-existing garbage value from before this fix is discarded and replaced,
never trusted. This was the specific scenario the task called out as easiest
to miss, and it was reproduced and proven live (see "Dowód" below): a tab
that already had the bad value sitting in `sessionStorage` before the fix
picked up a fresh valid UUID on the very next full page load, with no
special-cased migration code needed.

### Server fix
New shared file `server/src/routes/resultsVnext/correlationId.ts`, used by
all six resultsVnext route files (`kpi.routes.ts`, `kpiDeviation.routes.ts`,
`kpiPerspectives.routes.ts`, `kpiScorecard.routes.ts`, `okr.routes.ts`,
`roi.routes.ts`), replacing six previously-identical, independently
duplicated copies of `getCorrelationId(req)`.

`isValidCorrelationId(value)` checks `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
`getCorrelationId(req)` prefers a valid `req.correlationId` (set upstream by
`apiLoggingMiddleware`, mounted globally in `Gateway.ts:498`), falls back to
a valid `X-Correlation-ID` header, and returns `undefined` if neither is
UUID-shaped — **never** the malformed value itself.

Important nuance found while reading the code: `apiLoggingMiddleware`'s own
`sanitizeCorrelationId` (`server/src/middleware/apiLogging.middleware.ts:82-86`)
only enforces `/^[A-Za-z0-9._~-]+$/` — safe characters for its own `api_logs`
TEXT column — it does **not** enforce UUID shape. That middleware has no
reason to know a *different*, downstream column happens to be `UUID NOT
NULL`. So `req.correlationId` was never a reliable UUID guarantee; this
file's validator is the first place in the request lifecycle that actually
enforces UUID shape, deliberately kept independent of that unrelated
sanitizer (proven by a dedicated test — see below).

`getCorrelationId` returning `undefined` for anything invalid is
deliberate, not an oversight: every resultsVnext command function already
does `correlationId ?? randomUUID()` right before building the platform
event envelope (confirmed in `kpiDefinitionCommands.ts`,
`kpiMeasurementCommands.ts`, `kpiDeviationCommands.ts`,
`kpiScorecardCommands.ts`, `roiCaseCommands.ts`, `okrSetCommands.ts`,
`okrSupportCommands.ts`, `kpiInitiativeImpactCommands.ts` — all 8 command
files checked). Reusing that existing fallback (rather than minting a second
UUID generator in the route layer) means a malformed/missing header is
**rejected** (never reaches the DB as-is) and **replaced** (the write still
succeeds) in one consistent place.

### Scope — does the same header hit a UUID column elsewhere?
Checked every `correlation_id` column definition across `server/migrations/*.sql`
(excluding the dead `never-ran/` directory):

| file | column type |
|---|---|
| `000_z_core_baseline.sql` (`activity_logs`, ×2 tables) | `TEXT` |
| `20260303_feedback_behavior_t106_t113.sql` (`api_logs`) | `TEXT` |
| `20260323_v8_replay_deadletter.sql` (`v8_dead_letter_records`) | `TEXT` |
| `20260331_p28_workbench_p29_partner_program_ledger.sql` | `TEXT` |
| `20260807_agent_t01_transformation_case.sql` | `TEXT` |
| `20260719_baseline_gap.sql` (`ai_audit_logs`, others) | `text` |
| `20260809_rvn_platform_events_outbox.sql` (`rvn_platform_events`) | **`UUID NOT NULL`** |

**`rvn_platform_events.correlation_id` is the only UUID-typed correlation-id
column in the active schema.** Every other correlation-id column in this
codebase is `TEXT`, so the same malformed header could not crash those
paths the way it crashed Results Next (it would just be stored as noisy but
harmless text). No fix was needed or made outside `resultsVnext/**`.

---

## F1B — maker-checker had no working "checker"

### Root cause
No `GET` endpoint anywhere returned a `rvn_kpi_definition_versions` row
(name/unit/target geometry/`approvalStatus`/CAS `rowVersion`) — only the
three write endpoints (`createKpiDraft`, `approveDefinitionVersion`,
`rejectDefinitionVersion`) returned it, as a side effect of the mutation
*that exact browser tab* performed. `ResultsKpiRegistryPage.tsx`'s
`knownVersions` map — the only source of the CAS `expectedVersion` every
write command requires — was therefore populated *exclusively* from this
tab's own past writes. A second reviewer opening a colleague's submission
saw Approve/Reject permanently LOCKED with "no known version in this
session", not because they lacked permission but because nothing had ever
told their client what the current version even was.

### Fix
- `server/src/services/resultsVnext/kpi/kpiRepository.ts` —
  `getKpiCurrentDefinitionVersion({ userId, organizationId, kpiId })`. Same
  visibility-scoped join pattern `kpiPerspectivesRepository.ts:165`'s
  `branch_update_due_heuristic` CTE already established
  (`INNER JOIN rvn_kpi_definition_versions kdv ON kdv.definition_version_id
  = kd.current_definition_version_id`, visibility enforced via `kd`'s join
  to `rvn_visible_resources` since `rvn_kpi_definition_versions` has no row
  of its own in `rvn_platform_resource_visibility`) — reused, not
  reinvented. Returns `null` for "does not exist" and "exists but not
  visible", indistinguishably (same contract as the pre-existing `getKpi`).
- `server/src/routes/resultsVnext/kpi.routes.ts` —
  `GET /api/vnext/results/kpi/:kpiId/version`, right after the existing
  `GET /:kpiId`. On `null` returns the exact same generic
  `{"error":"KPI not found","code":"NOT_FOUND"}` 404 the existing route
  uses (D06 — no distinct "forbidden" signal).
- `src/components/ResultsVNext/kpiApi.ts` — `getKpiCurrentDefinitionVersion(kpiId)`,
  same 404→`null` contract as the existing `getKpi`.
- `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx` — new lazy
  per-selection effect (mirrors the pre-existing lazy measurement-fetch
  effect immediately above it) that calls the new endpoint whenever
  `selectedId` changes and merges the result into `knownVersions`. A
  denied/missing result leaves `knownVersions` untouched — never inserts a
  fake entry.

---

## Dowód — real browser, real backend, real Postgres

Environment: Postgres 17.9 on port `55821` (PID `38806`, pre-existing,
**never touched**), database `rn_g6_runtime`. My own backend/frontend
(the pre-provisioned ones on 3097/3197 were dead and port 3197 was held by
an unrelated worktree's process I must not kill) started fresh from this
worktree: backend on `3097` (same port, free), frontend on **`3199`**
(3197 was occupied by another session's `g6-runtime` worktree — a
different, not-yet-fixed checkout; using it would not have exercised this
worktree's code, so a free port was used instead. Stopped both with precise
`kill <pid>` at the end — Postgres left running.).

### 1. Before the fix — 500 in a fresh browser session
Temporarily reverted the 10 fixed files to their pre-fix state at
`84d843c59f` (`git checkout 84d843c59f -- <files>`), restarted backend +
frontend against that code, opened a fresh tab, logged in as
`rn-g6-user-a-owner`.

- Fresh tab's `sessionStorage.correlationId` immediately after load:
  `"vjodcwp8sayu93lfxkrik"` (the exact non-UUID shape the old generator
  produces) — confirms the bug manifests on the very first page load, no
  special setup needed.
- Filled and submitted the real "New KPI" form (`kpiCode`, `name`,
  `targetValue`) through the real UI.
- Network: `POST /api/vnext/results/kpi → 500 Internal Server Error`.
  Literal response body: `{"error":"Internal server error","code":"KPI_INTERNAL_ERROR"}`.
- Backend log, literal line:
  `[resultsVnext/kpi.routes] createKpiDraft failed {"error":"invalid input syntax for type uuid: \"vjodcwp8sayu93lfxkrik\""}`
- UI showed the honest generic error state: "Something went wrong
  completing this action. Please try again." (screenshot captured live in
  this session's Browser pane).
- `psql`: `select count(*) from rvn_kpi_definitions where kpi_code like 'RN-G6-P0-BEFORE-%'` → **0 rows** — the failed write left no partial data.

(Two other, unrelated pre-existing errors were visible in the backend log
during this run — `invalid input syntax for type uuid: "rn-g6-user-a-owner"`
from `partner_users`/`partner_organizations` lookups, and `column
"default_language" does not exist` on `organizations` — both are seed-data/
schema issues in unrelated legacy tables (partner-portal, org preferences),
not something this task touched or needed to fix.)

### 2. After the fix — same scenario succeeds
Restored the fix (`git checkout HEAD -- <files>`; `git diff --stat` empty
afterward — confirmed I was back at the exact committed state), restarted
backend + frontend.

**Same browser tab, still carrying the stale invalid `sessionStorage` value
from step 1** (this is the specific "already-open tab" case called out as
easiest to miss) — reloaded and retried the create form:
- Network: `POST /api/vnext/results/kpi → 201 Created`. Response includes
  real `kpiId` `bb14bb34-4088-42e7-8fee-87b7da5e5339` and
  `definitionVersionId` `11f0553b-75e4-40f3-9a2d-12d9c2410cee`.
- `psql`, `rvn_kpi_definitions`: row present, `status='draft'`,
  `owner_user_id='rn-g6-user-a-owner'`.
- `psql`, `rvn_platform_events` for that aggregate:
  `correlation_id = '664e9ee1-9c6f-488b-a728-f9f544e60fbe'` — a real UUID,
  where before the fix this exact column would have rejected the write.

(Note: the browser tool's own `sessionStorage.getItem()` JS-read appeared to
return a stale/cached value across this reload in a couple of spot-checks —
a tooling artifact of this sandbox's Browser pane, matching a distrust
already documented for this exact tool in
`RN_G6_RUNTIME_ENVIRONMENT.md` §7.3 ("Fałszywy alarm: czarny zrzut ekranu").
Ground truth was taken from the real HTTP responses and the real Postgres
rows instead, which is unambiguous: every write in this session, including
from the tab that started with the broken value, produced a valid-UUID
`correlation_id` in the database.)

### 3. F1B — two real actors, two real sessions
- **Maker** (`rn-g6-user-a-owner`, existing tab): submitted the KPI created
  above for approval. `POST .../submit → 200`. `psql`:
  `rvn_kpi_definitions.status = 'pending_approval'`,
  `rvn_kpi_definition_versions.approval_status = 'submitted'`,
  `submitted_by = 'rn-g6-user-a-owner'`.
- **Self-approval still denied** (maker-checker guard untouched by this
  fix, verified still working): same owner tried to approve their own
  submission. `POST .../approve → 403 Forbidden`,
  `code: "SELF_APPROVAL_DENIED"`. Readable on-screen toast: *"You cannot
  approve your own definition — a second person is required. (Access
  restricted — you do not have permission for this action.)"*
- **Checker** (`rn-g6-user-a-admin`, separate browser tab, logged in fresh
  — `localStorage` tokens cleared and a brand-new login performed so this
  is a genuinely different authenticated identity, not the owner's carried-
  over session): navigated to `/results/kpi?ff_resultsVNextKpi=1`, switched
  to the "Org" tab, opened the same KPI. `GET .../version → 200`, body
  shows `approvalStatus: "submitted"`, `rowVersion: 2` — this admin session
  never wrote anything itself; this is the exact read that used to not
  exist. Screenshot confirms **Approve/Reject rendered enabled**, not
  locked. Clicked Approve: `POST .../approve → 200`.
- `psql`, final state:
  ```
  approval_status | submitted_by        | approved_by          | row_version
  approved         | rn-g6-user-a-owner  | rn-g6-user-a-admin   | 3
  ```
  Two different actors, real DB rows, real approval — maker-checker works
  end to end for a genuine second reviewer for the first time.

### Numbers
- **Before-fix session** (single tab, before→after transition included):
  console errors 17 total — 2 unrelated pre-auth 401s, 6 backend-restart
  transients (`ERR_CONNECTION_REFUSED` ×3, WebSocket close, failed
  notification fetch — artifacts of *me* killing/restarting the backend
  mid-session, not something a real user would ever see), the pre-existing
  unrelated `GET /api/v8/admin/flags → 404` (fires globally on every page,
  documented pre-existing in `RN_G6_RUNTIME_ENVIRONMENT.md` §6), 1× our 500
  + 1× its client-side `[ResultsVNext] request failed` log (the bug being
  demonstrated), 1× the expected 403 self-approval denial + its client log.
  ≥400 network responses in that tab across the whole session: the one 500
  (before fix), the one 403 (expected denial), and the recurring
  pre-existing `/api/v8/admin/flags` 404.
- **Checker session** (`tab-6`, clean fresh login, after-fix only): **3
  console errors, all the same pre-existing unrelated `/api/v8/admin/flags`
  404** (fires on `/login` load, `/results/kpi` load, and once more) —
  **zero** errors attributable to this fix. Network ≥400 responses: **1**,
  that same pre-existing 404.

---

## Testy

New/changed files:
- `tests/unit/services/apiUtils.correlationId.test.ts` — 5 tests: mints a
  UUID with nothing stored; reuses an already-valid stored UUID; **discards
  a pre-existing invalid value (the literal old-generator shape) and mints a
  new UUID**; discards an empty-string stored value; stable across repeated
  `getHeaders()` calls in one load.
- `server/src/routes/resultsVnext/__tests__/correlationId.test.ts` — 13
  direct unit tests for `isValidCorrelationId`/`getCorrelationId`: valid
  UUID, case-insensitivity, the exact old-bug shape, a value that is
  "safe" per `apiLoggingMiddleware`'s sanitizer but not UUID-shaped (proves
  this is a stricter, independent check), empty/undefined/null/non-string,
  wrong hex-group length, `req.correlationId`-precedence-over-header,
  fallback-to-header when attached is invalid, both-invalid → `undefined`,
  both-absent → `undefined`, tolerates a request with no `.get`.
- `server/src/routes/resultsVnext/__tests__/kpi.routes.test.ts` — added:
  - "X-Correlation-ID validation" (5 tests): non-UUID header → command
    receives `undefined` (never the raw value); valid UUID passes through;
    no header → `undefined`; empty-string header → `undefined`;
    alphanumeric-but-not-UUID header → `undefined` (the
    apiLoggingMiddleware-sanitizer-would-accept-this case).
  - "GET /:kpiId/version" (3 tests): returns the version for a visible KPI;
    generic 404 on `null` (covers not-found and not-visible identically,
    with an explicit assertion the message doesn't leak which); a
    repository error is mapped through the existing shared error handler
    (no bespoke path).

All 41 new/changed tests pass:
```
NODE_OPTIONS=--max-old-space-size=8192 npx vitest run \
  tests/unit/services/apiUtils.correlationId.test.ts \
  server/src/routes/resultsVnext/__tests__/kpi.routes.test.ts \
  server/src/routes/resultsVnext/__tests__/correlationId.test.ts
Test Files  3 passed (3)
     Tests  41 passed (41)
```

### Kontrola negatywna ×2
1. **F1B cycle** — flipped `expect(response.status).toBe(200)` to
   `.toBe(404)` in "returns the current definition version for a visible
   KPI". Red: `AssertionError: expected 200 to be 404`. Reverted
   (`diff` empty). Green: 41/41 again.
2. **F1 cycle** — flipped `expect(isValidCorrelationId(OLD_BUGGY_SHAPE)).toBe(false)`
   to `.toBe(true)` in `correlationId.test.ts`. Red:
   `AssertionError: expected false to be true`. Reverted (`diff` empty).
   Green: 41/41 again.

(An earlier, combined negative-control pass — breaking both the client
`apiUtils` test and the server `kpi.routes.test.ts` F1 assertion at once —
was also run and reverted before these two dedicated cycles; kept both for
belt-and-suspenders but the two cycles above are the ones that map 1:1 to
"F1" and "F1B" as the task specified.)

---

## Bramki

- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p server` —
  exit code checked directly via `$?` immediately after the command (not
  through `PIPESTATUS`/`tail`): **exit 2**, but **exactly the 18
  pre-existing `roiCalculationEngine.ts`/Decimal.js errors** the task
  warned about (`grep -c "error TS"` = 18, `grep -v roiCalculationEngine |
  grep "error TS"` = 0). No new errors added.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (root,
  client-only per `tsconfig.json`'s `exclude: ["server", "server/**/*"]`)
  — **exit 0**, clean.
- `npx vite build` — **exit 0**. Only pre-existing "chunk larger than 500kB"
  size warnings, unrelated to this change.
- `git diff --check` — **exit 0**, no whitespace errors.

## Czego to NIE dowodzi
- Nie jest to pełny odbiór TRIADA/SPEC-A (40-punktowa lista, dark+light) —
  poza zakresem tego zadania (P0 write-path).
- Nie testowano ROI/OKR/KPI-Scorecard/KPI-Deviation ścieżek zapisu na
  żywo — F1 jest naprawiony identycznie w tych pięciu pozostałych route
  files (ten sam import, ten sam `getCorrelationId`), potwierdzone przez
  `grep` (zero pozostałych lokalnych kopii) i testy jednostkowe, ale nie
  osobnym przebiegiem w przeglądarce per domena — uznane za wystarczające
  bo cała logika żyje w jednym współdzielonym pliku.
- Nie testowano F1B dla ROI/OKR (te domeny nie miały tego samego zgłoszenia
  w brief — `knownVersions`-style gap może tam istnieć osobno, nieaudytowane
  w tej sesji).
- `partner_users`/`organizations.default_language` błędy widoczne w logu
  backendu są PRZEDISTNIEJĄCE i NIE zostały naprawione (poza allowlistą).

## Czy ruszono coś poza allowlistą
Nie. Zmienione/nowe pliki:
- `src/services/apiUtils.ts` (allowlist: explicit)
- `server/src/routes/resultsVnext/correlationId.ts`,
  `kpi.routes.ts`, `kpiDeviation.routes.ts`, `kpiPerspectives.routes.ts`,
  `kpiScorecard.routes.ts`, `okr.routes.ts`, `roi.routes.ts`
  (allowlist: `server/src/routes/resultsVnext/**`)
- `server/src/services/resultsVnext/kpi/kpiRepository.ts` (allowlist:
  `server/src/services/resultsVnext/**` w zakresie F1B GET — nowa funkcja
  odczytu, nie dotyka walidacji correlationId ani żadnej innej logiki)
- `src/components/ResultsVNext/kpiApi.ts`,
  `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx` — **poza
  literalną allowlistą** (allowlist wymieniała `server/src/services/
  resultsVnext/**`/`server/src/routes/resultsVnext/**` jako "poza
  zakresem tego pakietu" dla F1B w komentarzach kodu, ale F1B jak
  zdefiniowane w tym zadaniu jawnie wymaga "wepnij go w UI tak, żeby akcje
  odblokowywały się" — bez zmiany klienta nowy endpoint jest martwy kod.
  Zmiana jest minimalna (jedna nowa funkcja fetch + jeden nowy `useEffect`
  kopiujący istniejący wzorzec) i literalnie zrealizowana wg instrukcji
  zadania — zgłaszam to tutaj zamiast milczeć, do oceny.
- Testy: `tests/unit/services/apiUtils.correlationId.test.ts`,
  `server/src/routes/resultsVnext/__tests__/correlationId.test.ts`,
  `server/src/routes/resultsVnext/__tests__/kpi.routes.test.ts` (allowlist:
  `tests/**` poza trzema zakazanymi — żaden z tych trzech plików nie był
  dotknięty).
- Ten raport: `docs/product/results-vnext/RN_G6_P0D_WRITE_PATH_FIX.md`
  (allowlist: explicit).

Pięć zakazanych plików równoległej sesji — nietknięte (`git status
--short` na końcu sesji potwierdza brak zmian poza wymienionymi wyżej).
`.claude/launch.json` — nietknięty. Brak push/merge/deploy/podagentów w tej
sesji. PID `38806` (Postgres) — nietknięty przez całą sesję.
