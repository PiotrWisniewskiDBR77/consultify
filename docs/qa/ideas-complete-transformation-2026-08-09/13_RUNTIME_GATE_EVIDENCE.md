# 13 — Runtime gate evidence (Gate 3)

Opened 2026-08-10. Candidate branch `codex/ideas-transformation-20260809`.
Every line here is something that was **observed**, with the command that produced
it. Anything not observed says NOT VERIFIED and stays that way.

## 0. Owner authorisation

The four `20260810_idea_*` migrations had been committed and never run, which made
Gate 3 unreachable. The owner authorised, on 2026-08-10, a controlled run against
an **isolated local ephemeral Postgres only** — never demo, never production —
after reviewing the SQL against four conditions (additive-only, idempotent, no
overwriting backfill, objects match what the code actually queries).

## 1. Migration review, done before anything was executed

| Condition | Result |
|---|---|
| Additive only | **Yes, all four.** No DROP of a table, column or row; no `ALTER COLUMN TYPE` (which in this repo does **not** fire the append-only triggers, so it is a real risk class — and it is absent); no RENAME. One literal `DROP` exists: `DROP CONSTRAINT IF EXISTS my_ideas_confidentiality_check` in the confidentiality migration, and it drops only the constraint that the very next statement re-creates — the standard idempotency idiom, not a data operation. |
| Idempotent | **Yes** — `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` before `ADD CONSTRAINT`. Note the syntax is **Postgres-only**; `ADD COLUMN IF NOT EXISTS` and `DROP CONSTRAINT` are not valid SQLite. Irrelevant here (target is Postgres), relevant to whoever runs these elsewhere. |
| No overwriting backfill | **Yes** — zero `UPDATE` and zero `INSERT` statements across all four files. `confidentiality` is `NOT NULL DEFAULT 'standard'`, which fills a **new** column; it cannot overwrite existing data. |
| Objects match what the code queries | **Yes, checked per object, not by table name.** `maturity_gates_json` ← `my-work.routes.ts:3013/3116/3121/3133` (feature-detected via `ideaColumns.has`). `mapping_version` ← `my-work.routes.ts:7004/7024/7736`. `confidentiality` ← `ideaConfidentiality.ts:45-51`, whose valid set `standard/confidential/restricted` matches the CHECK exactly. `idea_business_cases` ← `ideaBusinessCaseService.ts`: the nine columns it SELECTs/INSERTs/UPDATEs are the nine the migration creates, and its "one case per idea" rule is backed by the unique index. No collision with `report_builder_reports.confidentiality` (different table, default `'internal'`). |

## 2. Schema gate — PASS on isolated local Postgres

Cluster: ephemeral Postgres 16, `initdb` with `LC_ALL=C`, short socket dir,
`127.0.0.1:54329`, database `ideas_qg03`. Created for this run, contains four
tables and nothing else.

Applied with `psql -v ON_ERROR_STOP=1 -f`, **real exit codes captured**:

| Migration | run 1 | run 2 | run 3 (orchestrator, independent) |
|---|---|---|---|
| `20260810_idea_maturity_gates.sql` | 0 | 0 | 0 |
| `20260810_idea_business_case.sql` | 0 | 0 | 0 |
| `20260810_idea_conversion_mapping_version.sql` | 0 | 0 | 0 |
| `20260810_idea_confidentiality.sql` | 0 | 0 | 0 |

Schema proven with `information_schema` / `pg_constraint` / `pg_indexes` — **not**
with the migration runner's own report, because `migrate.postgres.ts --safe`
reports a failed migration as `skipped` and still exits 0.

```
 my_idea_conversions | mapping_version     | text | YES | 'v1'::text
 my_ideas            | confidentiality     | text | NO  | 'standard'::text
 my_ideas            | maturity_gates_json | text | YES | '{}'::text
 idea_business_cases | 9 columns
 ux_idea_business_cases_idea_id  UNIQUE (idea_id)
 idx_idea_business_cases_org_id  (organization_id)
 idx_my_ideas_confidentiality    (organization_id, confidentiality) WHERE confidentiality <> 'standard'
 my_ideas_confidentiality_check  CHECK (confidentiality = ANY (ARRAY['standard','confidential','restricted']))
 idea_business_cases_idea_id_fkey  FOREIGN KEY (idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
```

Idempotency: `\d my_ideas` byte-identical before and after a third full re-run.

Negative control on the CHECK constraint: `confidentiality='bogus'` rejected with
**SQLSTATE 23514**; `'restricted'` accepted. Both probe rows deleted — all three
tables confirmed back to 0 rows by the orchestrator's own query.

**Out of scope and still broken:** full-repo schema convergence. The runner
reports 583 pending migrations against a fresh database. Not this program's
defect, not fixed here, recorded so nobody reads the above as "the schema builds".

## 3. E12 runtime gate — PASS, and the green is proven meaningful

Second ephemeral cluster, `127.0.0.1:54331`, database `ideas_e12`, schema built by
`node tests/acceptance/schema.mjs` → **1011 tables** (that build does not fully
converge either: 172 of 787 migration files never applied; the tables this suite
needs all exist).

`tests/integration/e12-collab-security.realdb.test.ts`, run with
`NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false E2E_MODE=true` — both flags matter,
because `NODE_ENV=test` alone silently substitutes a database mock and a suite can
go green against nothing.

Orchestrator's own run:

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
VITEST_RC=0
```

Endpoints proven to return **403 `IDEA_CONFIDENTIALITY_BLOCKED`** for a
`restricted` Idea, through the real Express router and real Postgres:

| Endpoint | Was gated before? | Result |
|---|---|---|
| `POST …/my-ideas/:id/ai-generate` | no gate at all | 403 |
| `POST …/my-ideas/:id/ai-suggestions` | no gate at all | 403 |
| `POST …/my-ideas/:id/ai-table-action` | no gate at all | 403 |
| `POST …/my-ideas/:id/ai-fill` | no gate at all | 403 |
| `GET …/my-ideas/:id/export-csv` | no gate at all | 403 |
| `…/map/expand`, `…/map/ai-suggestions`, `…/map/gap-analysis` | already gated | 403 (regression check) |

A `standard` Idea in the same request set is **not** blocked, so a
false-positive block cannot pass itself off as a success.

**Negative control (orchestrator, mandatory before believing the green):** the
CSV-export gate — five lines — was deleted from `my-work.routes.ts` and the suite
re-run. It went red with the precise assertion:

```
AssertionError: expected 404 to be 403
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
VITEST_RC=1
```

Gate restored, call-site count back to 8, green returned. The suite can fail, so
its passing means something.

## 4. What Gate 3 still does NOT have

- **Per-tool, per-feature save → refresh → cold reopen → readback.** In flight in
  a separate stream at the time of writing; **EVIDENCE_MISSING** until it reports
  and is independently re-verified.
- **Any runtime evidence on a browser surface.** Everything above is server-side.
- The E12 gates are proven to intercept *before* an LLM call is attempted. Their
  behaviour with a real LLM provider configured is **NOT VERIFIED** (the test
  environment has no provider).

## 5. Teardown

Both clusters are ephemeral and deliberately left running for the follow-on
streams. Teardown commands are recorded in
`/tmp/claude-501/ideas-qg03-pg/CONNECTION.md` and
`/tmp/claude-501/ideas-e12-pg/CONNECTION.md`. Nothing outside `/tmp` was touched
and no non-local database was contacted at any point.

---

## UPDATE 2026-08-10 (later the same session) — the persistence matrix is 8/8

§4 above said the per-tool chain was EVIDENCE_MISSING and in flight. It has since
landed, and the eighth chain — the one that could not exist — landed with it.

### Chains

| Chain | save | refresh | cold reopen | direct-SQL readback | Verdict |
|---|---|---|---|---|---|
| Mind Map | ✓ | ✓ | ✓ | ✓ | PASS |
| Whiteboard | ✓ | ✓ | ✓ | ✓ | PASS |
| Process Flow | ✓ | ✓ | ✓ | ✓ | PASS |
| Table | ✓ | ✓ | ✓ | ✓ | PASS |
| Maturity gates | ✓ | ✓ | ✓ | ✓ | PASS |
| Business case | ✓ | ✓ | ✓ | ✓ | PASS |
| Conversion `mapping_version` | ✓ | ✓ | ✓ | ✓ | PASS |
| **Confidentiality** | ✓ | ✓ | ✓ | ✓ | **PASS** |

`Tests 8 passed (8)`, exit 0, re-run independently by the orchestrator.

### Why the cold reopen is genuine

Each step calls `resetConnection()` — a real `pool.end()` TCP teardown that nulls
the module-level pool — then builds a brand-new express app, so the next query
opens new sockets. `getTableColumns` caches column NAMES (static shape), not row
data, so it cannot mask a data bug.

### The eighth chain, and why it was blocked

Confidentiality had no HTTP chain to test because **no write route existed**
(RISK-22). The suite documented that absence rather than faking a save path. Once
`PUT /my-ideas/:id` gained the field, the chain became real: set `restricted`
over HTTP → warm refresh → cold reopen → direct SQL → round-trip to `standard` →
invalid value rejected 400 with the row unchanged.

### Negative controls — including one that had to be redesigned

Five sabotages across the suite, plus one by the orchestrator (neutering
`edges_json` → `warm refresh (process flow) missing mutateMark`, exit 1).

Two are worth recording because of what they nearly hid:

- **`mapping_version` — first attempt VACUOUS.** Omitting the write left the suite
  GREEN, because the column carries a Postgres `DEFAULT 'v1'`. The stream reported
  that instead of banking the pass, and the assertion was rewritten to sabotage
  the written constant. Recorded as RISK-23: the same trap applies to every column
  in this schema with a non-null default.
- **Confidentiality — designed around the same trap.** `my_ideas.confidentiality`
  is `NOT NULL DEFAULT 'standard'`, so a sabotage that merely omits the write
  could read back `'standard'` and pass. The sabotage therefore targeted the
  TRANSITION: set `restricted` first, then drop only the downgrade write. Failed
  precisely, at the round-trip step: `expected undefined to be 'standard'`.

### A defect this update itself caused, caught by an independent stream

Adding the write route made the old test — which asserted `GET` does NOT expose
`confidentiality` — contradict the code. The suite went 7 passed / 1 failed and
the failure was, briefly, mine. It was found by a stream re-running the suite
rather than reading the commit body, and is closed by the chain above. Worth
recording: a documentation-only stream caught an implementation defect that the
implementer's own commit message had asserted away.

### Still NOT VERIFIED at this gate

- Any browser-surface evidence. Everything here is server-side.
- Behaviour with a real LLM provider configured — proven only that the gate
  intercepts BEFORE any LLM call is attempted.
- Full-repo schema convergence, still broken (RISK-24).

## UPDATE 2026-08-12 (stream S6-E09) — chain 9: E09 financial case

New numbered chain, added to the 8/8 matrix above. Same isolated Postgres
(`127.0.0.1:54331/ideas_e12`), same genuine cold reopen (`resetConnection()` →
`pool.end()` + globals cleared + brand-new express app), same direct-SQL
readback discipline.

| Chain | save | refresh | cold reopen | direct-SQL readback | Verdict |
|---|---|---|---|---|---|
| **9. Financial case (E09)** | ✓ | ✓ | ✓ | ✓ | **PASS** |

### Migration applied at this gate

`server/migrations/20260812_idea_financial_case.sql` — `idea_financial_cases`.
Additive (one new table, one FK, two indexes; no ALTER/DROP on anything
existing). Applied with `psql -v ON_ERROR_STOP=1 -f`, **three runs, exit 0 /
0 / 0**, `\d idea_financial_cases` byte-identical across runs (idempotency
proven by diff, not by reading the `IF NOT EXISTS` clauses). Objects confirmed
from `information_schema.columns`, `pg_indexes` and `pg_constraint` — not from
the migration runner's own report, which reports a failed migration as
`skipped` and still exits 0. The database went 1011 → 1012 tables.

### Command and real exit code

```
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false E2E_MODE=true POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL=postgres://postgres@127.0.0.1:54331/ideas_e12 \
npx vitest run tests/integration/e09-financial-case-persistence.realdb.test.ts --retry=0
→ exit 0 · Test Files 1 passed (1) · Tests 6 passed (6)
```

Six sub-chains: (1) save → mutate → warm refresh → cold reopen → API readback →
direct-SQL readback; (2) optimistic concurrency, stale version → 409 with the
physical row proven UNCHANGED; (3) cross-org read and write both refused, with
the 404 body asserted not to leak org A content; (4) foreign-org case row →
403, owner column proven unchanged; (5) six invalid bodies → 400, zero rows
created; (6) audit before/after.

### Audit trail — verified by querying the table, not by reading the middleware

`requireAudit.middleware.ts`'s allow-list once dropped `before`/`after` for
every caller (0 of 8 `IDEA_UPDATE` rows carried a payload), so the middleware
was not trusted. A probe wrote through the real routers and deliberately did
not clean up, then plain `psql` read `audit_events`:

```
action      | IDEA_FINANCIAL_CASE_UPDATE
before_json | {"version":0,"driverCount":0,"currency":null,"horizonMonths":null,"discountRatePct":null,"lastComputedAt":null}
after_json  | {"version":1,"driverCount":1,"currency":"PLN","horizonMonths":12,"discountRatePct":10,"lastComputedAt":null}

action      | IDEA_FINANCIAL_CASE_UPDATE
before_json | {"version":1,"driverCount":1,"currency":"PLN","horizonMonths":12,"discountRatePct":10,"lastComputedAt":null}
after_json  | {"version":2,"driverCount":1,"currency":"EUR","horizonMonths":36,"discountRatePct":10,"lastComputedAt":"2026-05-05T05:05:05.000Z"}
```

Non-null on both sides and genuinely DIFFERENT on every tracked field — not the
"records who, never what" failure the middleware header describes. Precision
worth keeping: this proves the allow-list fix **works end to end in this tree**,
not that the bug never existed. `IDEA_CREATE` still shows `before_json` NULL,
which is correct — a create has no before-state. Probe rows deleted; residue
query returns 0/0/0.

One correction for the record: `AuditEventsService.log` writes to
**`audit_events`** (INSERTs at lines 58 and 84), not `role_change_audit_events`
— the latter has matching column names, is created only by
`DatabaseInitializer`/`effectiveAccessService`, exists in no migration, and is
absent from `ideas_e12`. It is irrelevant to the idea audit path. A column-name
grep is not a writer.

### Negative control

Sabotage target `lastComputedAt` **inside `case_json`**, specifically because
no column `DEFAULT` can reach a JSON sub-field — the vacuous-green mode that
burned this program earlier is structurally unavailable here. Dropping that one
line: **exit 1**, `AssertionError: expected null to be '2026-02-03T10:11:12.000Z'`
at the cold-reopen readback. Restored, re-run → exit 0, 6/6.

### RISK-24, second concrete instance

Creating an Idea against this database logs, every time:

```
[DB:Promise] Error: relation "organization_context_snapshots" does not exist
[Postgres] Failed SQL: INSERT INTO organization_context_snapshots
         (organization_id, schema_version, snapshot_json, rebuilt_at) VALUES ($1,$2,$3,$4)
```

Swallowed by the fire-and-forget `.catch(warn)` on
`organizationContextService.recordMyWorkIdea(...)` in the idea create/update
handlers (`server/src/routes/my-work.routes.ts`, the "Fire-and-forget
org-context capture" site next to `IDEA_UPDATE` at ~L3330), so it never fails
the request. Pre-existing and unrelated to E09, but it means the 1012-table
database behind every runtime claim in this program is a **partial** schema,
and any org-context behaviour measured on it is measuring a stub.

### Still NOT VERIFIED at this chain

- No owner browser click-through; the feature stays behind `ff_ideaFinancialCase`
  (default OFF).
- Concurrency proven sequentially (stale version → 409). Two genuinely
  simultaneous writers were not executed; the SQL compare-and-swap is what
  would hold under a real race.
- Never run against demo/prod/dev.

### UPDATE 2026-08-12 (stream S11-DOCS, integrator) — chain 9's OCC is two real layers, not one described twice

Ran chain 9's suite personally, exit 0, 6/6 (matches §6.3). Then went one step
further than §6.4's sabotage (which targets `lastComputedAt` inside `case_json`,
a different concern): disabled the fast-path JS version check in
`ideaFinancialCaseService.ts` ALONE — suite stayed **GREEN**, because the SQL
compare-and-swap (`WHERE id = ? AND organization_id = ? AND version = ?`) caught
the race on its own. Disabled the fast-path check AND the SQL CAS together —
**RED**, `expected 200 to be 409`, the losing writer's payload visibly landed at
`version: 3`. Both restored, diff clean, re-run exit 0. Conclusion: the OCC is
genuine defense-in-depth; either layer alone suffices; the first green above was
redundancy, not a vacuous assertion — the inverse of this program's RISK-23
(a column `DEFAULT` that made an *omitted* write look correct). Full write-up:
`10_FINANCIAL_CASE_ACCEPTANCE.md` §7.
