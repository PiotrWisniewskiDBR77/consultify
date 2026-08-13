# Case Workspace real-DB harness — evidence log (2026-08-10)

Repo worktree: `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`,
branch `claude/case-workspace-v1-20260809` (shared integration worktree, not
isolated — used directly per task instructions).

**Databases used, exactly:**
- `postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test`
  — the pre-existing, shared, disposable container database. **Never
  written to by anything in this harness.** Only ever touched read-only
  (none of the commands below reference it at all, in fact — every command
  targets the throwaway DB below).
- `postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c`
  — a NEW throwaway database created by this harness inside the SAME
  Postgres instance/container (`case-workspace-test-pg`, colima profile
  `pgtest`), via `CREATE DATABASE case_workspace_realdb_c;` run against the
  `postgres` maintenance DB on that instance. All 11 tasks below ran against
  this database only. It has been left in place for coordinator review; drop
  it with `DROP DATABASE case_workspace_realdb_c;` when no longer needed.

All raw command output is also preserved under the harness-runner's
scratchpad (`task1_fresh_migration_replay.log`, `task1b_ordered_case_workspace_apply.log`,
`task2_second_idempotent_replay.log`, `task2_second_idempotent_replay_truezero.log`,
`task3_schema_verification.log`, `task4_insert.log`, `task4_readback.log`,
`task5a_claim_timer_wait_race.log`, `task5b_create_action_proposal_race.log`,
`task5c_capability_and_history_dedupe_race.log`) — this file is the
self-contained summary requested for the repo.

---

## Task 1 — Fresh migration replay: **BLOCKED as literally specified, unblocked via a documented workaround**

Command run exactly as specified:

```
DB_TYPE=postgres LC_ALL=C NODE_ENV=test \
DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c \
npm run db:migrate:strict
```

Result: **FAILED**, exit code 1. Tail of captured output:

```
→ 20260808_v8_agent_canonical_projection_bindings.sql
→ 20260808_v8_agent_resource_governance.sql
→ 20260809_artifact_studio_audit_and_presentation_cards.sql
→ 20260809_case_workspace_artifact_links.sql
✗ 20260809_case_workspace_artifact_links.sql: relation "case_core" does not exist
❌ Postgres migrate failed: relation "case_core" does not exist
```

**Root cause found (a real bug, not a harness artifact):**
`server/scripts/migrate.postgres.ts`'s deterministic ordering sorts same-day
DATED migrations by filename as a tiebreaker (see the file's own
`phaseAndKeyFor()`/`compareMigrationOrder()`, and its documented
`LATE_PHASE_MANIFEST` escape hatch for exactly this class of same-day
producer/consumer inversion). All 11 `20260809_case_workspace_*.sql` files
share the same `20260809` date, so they sort alphabetically by filename:

```
case_workspace_artifact_links.sql        <- runs FIRST (alphabetical: "a")
case_workspace_capability_registry.sql
case_workspace_case_core.sql             <- the producer, runs THIRD
case_workspace_case_plan_version.sql
case_workspace_execution_graph.sql
case_workspace_history_value.sql
case_workspace_migration_readiness.sql
case_workspace_plays.sql
case_workspace_proposals_approvals.sql
case_workspace_run_binding.sql
case_workspace_wait_subscription.sql
```

`case_workspace_artifact_links.sql` has `FOREIGN KEY ... REFERENCES
case_core(case_id)` (confirmed via `grep -n REFERENCES` on the file, line
151) but alphabetically precedes `case_workspace_case_core.sql`, the sole
producer of `case_core`. This is not specific to `artifact_links` — the same
grep across all 11 files shows `case_plan_version` needs `case_core`,
`run_binding` needs `case_plan_version`+`case_core`,
`proposals_approvals` needs `case_core`+`case_plan_version`+
`capability_registry`, `wait_subscription` needs `case_core`+`run_binding`+
`proposals_approvals`, `execution_graph` needs `case_core`+`run_binding` —
none of these 11 files are listed in `migrate.postgres.ts`'s
`LATE_PHASE_MANIFEST`, so none get the reordering the runner's own
documented mechanism exists to provide.

**This is flagged for the coordinator, not fixed here** — `migrate.postgres.ts`
is out of this harness's allowlisted scope (create-only under
`server/scripts/case-workspace-realdb-harness/`; no edits to existing
scripts/migrations/services). The fix, when someone in scope makes it, is
almost certainly: add the 10 dependent files (everything except
`case_core.sql`) to `LATE_PHASE_MANIFEST`, or give `case_core.sql` (and
`capability_registry.sql`, `plays.sql`, which are the self-contained/root
producers) an `EARLY_VERSION_OVERRIDES` entry.

**Unblocking workaround used for Tasks 2–6** (documented, not silent):
ran `db:migrate:strict --only <single-file>` once per case_workspace file, in
the dependency order derived from each file's own `REFERENCES` clauses —
`case_core → capability_registry → case_plan_version → run_binding →
proposals_approvals → wait_subscription → history_value → plays →
artifact_links → execution_graph → migration_readiness`. `--only` still runs
`sortMigrationsDeterministically()` on the filtered set, so passing all 11 at
once reproduces the identical failure — each had to be its own invocation.
All 11 succeeded (`✅ Postgres migrations complete`, `Applying migrations: 1`
each time); full output for all 11 in `task1b_ordered_case_workspace_apply.log`.

**Task 1 verdict: BLOCKED** on the literal command as specified (real bug in
shared infra, out of this harness's edit scope) — **worked around** so
Tasks 2–6 could proceed on a fully-migrated database.

---

## Task 2 — Second idempotent replay: **PASS**

Immediately after the Task 1 workaround, ran the identical literal command
again (no `--only`):

```
DB_TYPE=postgres LC_ALL=C NODE_ENV=test \
DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c \
npm run db:migrate:strict
```

First rerun picked up 6 unrelated pending migrations (dated `20260809`/
`20260810` files not part of the case_workspace set, plus `init-pgvector.sql`)
that Task 1's run never reached because it aborted before them — expected,
not a case_workspace issue:

```
Applying migrations: 6
→ 20260809_t01_u03_owner_backed_execution.sql
→ 20260809_v8_wave8_agent_runtime_forward.sql
→ 20260810_t01_initiative_lifecycle_gate_decisions.sql
→ 20260810_t01_u02_native_final_outputs.sql
→ 20260802c_mat010_operation_claims_table.sql
→ init-pgvector.sql
✅ Postgres migrations complete
```

A second immediate rerun of the exact same command then showed genuinely
**0 pending**:

```
Applying migrations: 0
✅ Postgres migrations complete
```

**Task 2 verdict: PASS** — 0 pending confirmed, exit code 0.

---

## Task 3 — Schema verification: **PASS**

New script: `verify_schema_vs_migrations.ts`. Parses the 11
`20260809_case_workspace_*.sql` files with a narrow regex-based
`CREATE TABLE IF NOT EXISTS ... ( ... )` block extractor (columns, PRIMARY
KEY, FOREIGN KEY/REFERENCES, UNIQUE — handling both table-level and
column-level forms, and stripping `--` comments across the WHOLE block
before splitting on commas, since an early version of this parser
mis-split on commas embedded in unstripped comment prose and had to be
fixed mid-run — see the file's own header comment on
`extractCreateTableBlocks()`), then cross-checks every declared
table/column/PK/FK/UNIQUE against `information_schema.tables/columns/
table_constraints/key_column_usage` queried directly.

```
DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c \
  npx tsx server/scripts/case-workspace-realdb-harness/verify_schema_vs_migrations.ts
```

Output (abridged — full transcript in `task3_schema_verification.log`):

```
Parsed 19 CREATE TABLE declarations from 11 migration files:
  - case_core  (27 columns, 20260809_case_workspace_case_core.sql)
  - case_plan_versions  (22 columns, ...)
  - case_plan_view_state  (5 columns, ...)
  - case_workspace_capabilities  (32 columns, ...)
  - case_workspace_capability_idempotency_keys  (6 columns, ...)
  - case_workspace_run_bindings  (7 columns, ...)
  - case_workspace_action_proposals  (23 columns, ...)
  - case_workspace_action_proposal_decisions  (19 columns, ...)
  - case_workspace_waits  (23 columns, ...)
  - case_workspace_history_events  (15 columns, ...)
  - case_workspace_value_measurements  (25 columns, ...)
  - process_definitions  (13 columns, ...)
  - process_versions  (27 columns, ...)
  - case_workspace_artifact_links  (26 columns, ...)
  - case_workspace_gateway_evaluations  (18 columns, ...)
  - case_workspace_node_result_acceptances  (16 columns, ...)
  - case_workspace_feature_flag_definitions  (6 columns, ...)
  - case_workspace_feature_flags  (9 columns, ...)
  - case_workspace_legacy_quarantine  (14 columns, ...)

[... per-table: table present: yes, all declared columns present: yes,
    primary key match=yes, every FK present, every UNIQUE present ...]

RESULT: PASS — every declared table/column/constraint checked was found live.
```

All 19 tables (across the 11 files) matched exactly: every declared column,
every primary key, every FK, every UNIQUE constraint (whether expressed as
`col TYPE ... UNIQUE`, `UNIQUE (a, b)`, or `CONSTRAINT name UNIQUE (a, b)`)
was found live via `information_schema`/`pg_constraint`. Exit code 0.

**Task 3 verdict: PASS.**

---

## Task 4 — Persistence/readback: **PASS**

Two new scripts, run as two genuinely separate `tsx` process invocations
(not two calls inside one process — a fresh `pg.Pool` in a fresh PID each
time):

1. `task4_insert_markers.ts` — seeds `organizations`/`projects`/`users`/
   `organization_members` fixture rows with FIXED ids, then inserts one
   `case_core` row and one `case_plan_versions` row with fixed ids, prints
   them, explicitly closes its own `pg.Pool`, exits.
2. `task4_readback_markers.ts` — a completely separate process/pool, reads
   the same fixed ids back, asserts every field field-by-field, then tears
   the fixture down.

```
DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c \
  npx tsx server/scripts/case-workspace-realdb-harness/task4_insert_markers.ts
```
```
Inserted case_core row: {"case_id":"case-workspace-harness-marker-case-1","case_status":"ACTIVE","governance_tier":"STANDARD","version":1}
Inserted case_plan_versions row: {"case_plan_version_id":"case-workspace-harness-marker-plan-1","case_id":"case-workspace-harness-marker-case-1","plan_number":1,"status":"DRAFT"}
Task 4 (insert half): PASS — marker rows inserted.
Pool explicitly closed.
```

```
DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c \
  npx tsx server/scripts/case-workspace-realdb-harness/task4_readback_markers.ts
```
```
This process PID: 17554 (independent of the insert process)
Read back case_core row: {"case_id":"case-workspace-harness-marker-case-1", ... "version":1}
  case_core.case_id: match
  case_core.project_id: match
  case_core.organization_id: match
  case_core.contracted_closure_type: match
  case_core.created_by_actor_id: match
  case_core.case_status: match
  case_core.governance_tier: match
  case_core.version: match
Read back case_plan_versions row: {"case_plan_version_id":"case-workspace-harness-marker-plan-1", ...}
  case_plan_versions.case_plan_version_id: match
  case_plan_versions.case_id: match
  case_plan_versions.plan_number: match
  case_plan_versions.status: match
  case_plan_versions.graph_digest: match
Task 4 (readback half): PASS — rows present and correct after independent process/pool.
Marker fixture rows torn down.
```

Note on method: the task offered a choice between restarting the Postgres
container or using an independent process/pool, "if too disruptive to
concurrent work". Chosen: independent process/pool — the container is
explicitly shared with other concurrent verification work per the task
brief, and a restart would affect `case_workspace_test` (the OTHER database
on the same instance) too, which the brief says must not be touched.

**Task 4 verdict: PASS.**

---

## Task 5 — Concurrency proofs against real Postgres

Shared fixture helper: `harnessFixtures.ts` (seedOrgAndProject/seedUser/
seedMember/seedMemberedUser/seedCaseCore/seedExecutionRun/seedCapability/
teardownAll), mirroring the `seedOrg/seedUser/seedMember` convention
documented in
`server/src/services/caseWorkspace/__tests__/caseCoreService.pg.test.ts`
(read per the task brief's pointer). Every script gates on
`RUN_DB_TESTS=1 && MOCK_DB==='false'` before importing any service module,
matching that same file's own gate.

### 5(a) — `waitSubscriptionService.claimTimerWait` — **PASS**

`task5a_claim_timer_wait_race.ts`: seeds org/project/member/case, inserts one
`case_workspace_waits` row directly (TIMER, ACTIVE, unclaimed — this is
fixture-only; `claimTimerWait` itself is the code under test, not
`createWait`), then fires two `claimTimerWait(waitId)` calls via
`Promise.all`.

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false LC_ALL=C \
DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c \
  npx tsx server/scripts/case-workspace-realdb-harness/task5a_claim_timer_wait_race.ts
```
```
Result A: {"outcome":"claimed", ... "ownerToken":"fddcba96-...","fencingToken":1}
Result B: {"outcome":"active_elsewhere"}
Live row after race: {"claim_owner_token":"fddcba96-...","claim_fencing_token":1,"status":"ACTIVE"}
exactlyOneClaimed=true otherIsActiveElsewhere=true fencingIncrementedExactlyOnce=true
Task 5(a): PASS — exactly one claimTimerWait() call succeeded under real Postgres concurrency.
```

Verified independently against the live row (not just the function's return
value): `claim_fencing_token` incremented 0→1 exactly once, not 0→2, which
would indicate both concurrent UPDATEs matched the WHERE guard.

### 5(b) — `proposalApprovalService.createActionProposal` — **PASS**

`task5b_create_action_proposal_race.ts`: seeds org/project/member/case/
`v8_execution_runs` row, then fires two `createActionProposal(input)` calls
via `Promise.all` with an IDENTICAL `idempotencyKey` + `payloadDigest`.

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false LC_ALL=C \
DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c \
  npx tsx server/scripts/case-workspace-realdb-harness/task5b_create_action_proposal_race.ts
```
```
Result A actionProposalId: cwprop-e1265dd4-c088-4f0f-9548-761bcca5119c
Result B actionProposalId: cwprop-e1265dd4-c088-4f0f-9548-761bcca5119c
Live rows for (case_id, idempotency_key): [{"action_proposal_id":"cwprop-e1265dd4-...", "payload_digest":"sha256:task5b-digest-..."}]
sameResult=true exactlyOneRow=true rowMatchesReturnedId=true
Task 5(b): PASS — exactly one case_workspace_action_proposals row landed, both concurrent calls returned the same result.
```

### 5(c) — `capabilityRegistryService.recordIdempotencyKeyCheck` + `caseHistoryService.appendCaseHistoryEvent` dedupe — **PASS (both sub-parts)**

`task5c_capability_and_history_dedupe_race.ts`, two sub-races in one run:

- (c1) seeds a `case_workspace_capabilities` row directly, fires two
  `recordIdempotencyKeyCheck()` calls via `Promise.all` with identical
  `(capabilityRegistryId, idempotencyKey, requestPayload)`.
- (c2) fires two `appendCaseHistoryEvent()` calls via `Promise.all` with an
  identical `dedupeKey` against the same seeded case.

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false LC_ALL=C \
DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c \
  npx tsx server/scripts/case-workspace-realdb-harness/task5c_capability_and_history_dedupe_race.ts
```
```
(c1) Result A: {"isDuplicate":false,"recordedAt":"2026-08-10T05:06:33.350Z"}
(c1) Result B: {"isDuplicate":true,"recordedAt":"2026-08-10T05:06:33.350Z"}
(c1) Live rows: [{"idempotency_record_id":"cwcapidem-0c020554-...", "request_digest":"sha256:5485cd01..."}]
(c1) exactlyOneWinner=true exactlyOneRow=true bothRecordedAtMatch=true
(c1) PASS

(c2) Result A eventId: cwhist-666c928c-3ced-4113-89e5-7626c0fe2d3c
(c2) Result B eventId: cwhist-666c928c-3ced-4113-89e5-7626c0fe2d3c
(c2) Live rows: [{"event_id":"cwhist-666c928c-..."}]
(c2) sameEventId=true exactlyOneRow=true rowMatches=true
(c2) PASS

Task 5(c): PASS — (c1 recordIdempotencyKeyCheck)=PASS, (c2 appendCaseHistoryEvent dedupe_key)=PASS
```

**Task 5 verdict: PASS** — all three sub-parts (a, b, c1, c2) confirmed
exactly-once-wins under genuine `Promise.all` concurrency against real
Postgres, verified against the live table state, not just return values.

---

## Task 6 — Grep own files for real client data / DEMO / PROD connection strings: **PASS**

```
cd server/scripts/case-workspace-realdb-harness
grep -rniE "railway|trolley|thomas|centerbeam|\.railway\.internal|proxy\.rlwy|demo\.consultify|@[a-z0-9.-]+\.(app|com|io|net):[0-9]{3,5}" .
grep -rniE "dbr77|elkomtech|apator|piotr|wisniewski|@gmail|@outlook|consultify\.ai|demo\.consultify" .
```

Both return no matches (exit 1). The only `postgres(ql)://` literals present
in the 7 files are documentation placeholders (`postgresql://user:pass@host:port/db`
or `postgresql://...`) in header comments — no real host, no real
credentials. All fixture identifiers are synthetic
(`cwharness-*`/`case-workspace-harness-marker-*`) and all fixture emails use
`@example.test`.

**Task 6 verdict: PASS.**

---

## Coordinator addendum (2026-08-10) — Task 1 blocker fixed and re-verified

The real bug found above (11 same-day `20260809_case_workspace_*.sql` files
sorting alphabetically instead of by dependency) is fixed in
`server/scripts/migrate.postgres.ts` (commit `35afcbe28c`): a new
`DATED_SAME_DAY_ORDER` map gives these 11 files an explicit
dependency-respecting intra-day tiebreaker
(`case_core → capability_registry → case_plan_version → run_binding →
proposals_approvals → wait_subscription → history_value → plays →
artifact_links → execution_graph → migration_readiness`), consulted only
for entries present in it — every other same-date migration's relative
order is unchanged.

Re-ran Task 1 literally as originally specified, no `--only` workaround,
against a second fresh throwaway database
(`case_workspace_realdb_c2`, since dropped):

```
DB_TYPE=postgres LC_ALL=C NODE_ENV=test \
DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_realdb_c2 \
npm run db:migrate:strict   # (root package.json script — server/ has no own db:migrate:strict)
```

All 11 `case_workspace_*` files applied, in the correct order, in the same
pass as the ~275 other pending migrations, exit 0, `✅ Postgres migrations
complete`. Immediate rerun of the identical command: `Applying migrations: 0`
— idempotent replay confirmed.

**Literal container restart + readback** (upgrading Task 4's
independent-process proxy to an actual restart, now that no other
concurrent verification work was in flight on this container): inserted
the same marker `case_core`/`case_plan_versions` rows into
`case_workspace_realdb_c2`, ran `docker restart case-workspace-test-pg`,
waited for `pg_isready`, then read the marker rows back from a fresh `tsx`
process/pool (PID 44798, independent of the insert process) — all fields
matched. The shared `case_workspace_test` database was also confirmed
intact post-restart (`caseWorkspaceAuthContext.pg.test.ts`: 6/6 passed).
Both throwaway databases (`case_workspace_realdb_c`, `case_workspace_realdb_c2`)
dropped after; only `case_workspace_test` remains.

**Task 1 verdict, updated: PASS** (was BLOCKED-then-worked-around; the
underlying bug is now fixed and the literal command passes unaided).
