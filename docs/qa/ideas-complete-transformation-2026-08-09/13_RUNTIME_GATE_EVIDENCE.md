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
