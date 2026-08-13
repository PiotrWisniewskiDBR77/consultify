# INTEGRITY-01 — revert of two already-applied migration files (CO-8 fallout)

Branch: `codex/finance-v3-integrity-ic1-revert`
Worktree: `/Users/piotrwisniewski/consultify-wt/integrity-ic1-revert`
Date: 2026-08-10

## 1. Why

`f99016b632` (CLOSEOUT-08) fixed a real defect — the runtime bootstrap DDL created
`initiatives.status` with `DEFAULT 'step3'`, a value that is not one of the 13 canonical
statuses and that `initiatives_status_check` (migration `20260624_initiative_status_normalize.sql`)
rejects outright. The fix itself is correct and stays.

What was not acceptable is *where* part of it landed. CO-8 also edited two **historical,
already-applied** migration files. The Postgres runner records a `sha256` per migration in
`schema_migrations.checksum` but **never verifies it on subsequent runs**, so editing an applied
file produces silent migration drift: a database migrated before CO-8 carries one checksum for
`000_z_core_baseline.sql`, a database migrated after CO-8 carries a different one, and nothing
ever reports the divergence.

This packet reverts the content of those two files and proves the defect stays fixed anyway.

## 2. Revert — content restored bit for bit

Restored from `git show f99016b632^:<path>`:

| File | sha256 at `f99016b632^` | sha256 after CO-8 (`f99016b632`) | sha256 now |
|---|---|---|---|
| `server/migrations/000_initdb_core_tables.sql` | `bfdb3a471c27deae7bbbeef303c714c9da7fdb21a75c43cf68fbf5cea6809bee` | `990351e33b470001c62af24d68ac53fba93eb8ead1baa982fd67976f700a9c82` | `bfdb3a471c27deae7bbbeef303c714c9da7fdb21a75c43cf68fbf5cea6809bee` |
| `server/migrations/000_z_core_baseline.sql` | `48fcc5700598125b0623af9a544dca78743100d88d2e3f61bcac54ebfad62e72` | `9e0e18cb8e7cd74f1a9f97b935aea441b1a43e78eae4a48b30d5df7c90472d65` | `48fcc5700598125b0623af9a544dca78743100d88d2e3f61bcac54ebfad62e72` |

Post-revert checksums equal the pre-CO-8 checksums exactly. Confirmed structurally too:

```
$ git diff f99016b632^ -- server/migrations/000_initdb_core_tables.sql \
                           server/migrations/000_z_core_baseline.sql
(no output)
```

No commit between `f99016b632` and `HEAD` touched either file, so `f99016b632^` is the only
correct restore point — nothing later is being discarded.

Corroborating evidence that this is the checksum the runner actually stores: on the fresh database
built in §4.1, `schema_migrations` recorded
`000_z_core_baseline.sql | 48fcc5700598125b0623af9a544dca78743100d88d2e3f61bcac54ebfad62e72`,
i.e. the restored content. Under CO-8 the same row would have read `9e0e18cb…` — that delta,
against a database whose row already says `48fcc570…`, is the drift.

## 3. Deliberately NOT reverted

| File | Status | Reason |
|---|---|---|
| `server/src/database/PostgresDatabase.ts` | untouched, keeps `DEFAULT 'DRAFT'` | the actual source of the defect; the runtime DDL is a second, independent producer of `initiatives` |
| `server/migrations/20260821_initiatives_status_default_draft.sql` | untouched | additive migration from CLOSEOUT-2; new file, no drift |

`grep` confirms the split after the revert:

- `PostgresDatabase.ts:2533` → `status TEXT DEFAULT 'DRAFT',`
- `000_initdb_core_tables.sql:481` → `status TEXT DEFAULT 'step3',` (historical, restored)
- `000_z_core_baseline.sql:226, :264` → `'step3'` (historical, restored)

## 4. Proof the fix survives the revert

Environment: ephemeral PostgreSQL **15.15** (Homebrew `postgresql@15`), `initdb` and `pg_ctl start`
both under `LC_ALL=C`, TCP port **55100** (lsof-verified free, range 55000–59999), short socket dir.
Gates: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`.
`DB_MANAGED_SCHEMA=false` so `initDb()` runs exactly once (otherwise two concurrent
`CREATE TABLE IF NOT EXISTS` passes race on `pg_type_typname_nsp_index`).

### 4.1 Path A — full migrations on a fresh database — PASS

Fresh database `ic1_fullmig`, complete runner (`server/scripts/migrate.postgres.ts`, no `--safe`),
**exit 0**, `✅ Postgres migrations complete`. Both `000_z_core_baseline.sql` (reverted, carrying
`'step3'`) and `20260821_initiatives_status_default_draft.sql` executed, in that order.

| Assertion | Result |
|---|---|
| `information_schema.columns.column_default` for `initiatives.status` | `'DRAFT'::text` |
| `initiatives_status_check` installed, 13 canonical values, no `step3` | yes |
| `INSERT INTO initiatives (id, organization_id, name)` — no status | `INSERT 0 1`, row reads `DRAFT` |
| control: explicit `status='step3'` | rejected, `violates check constraint "initiatives_status_check"` |

The reverted file reintroduces `'step3'` at its point in the sequence; migration `20260821` heals it
afterwards. End state is correct.

### 4.2 Path B — runtime bootstrap — PASS

Run twice, independently.

**(a) The CO-8 suite** (`closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts`): all four
behavioural tests green. Only the static guard fails — see §6.

**(b) An independent script**, written specifically so the result does not depend on that suite's
skip logic. Fresh **empty** database, no migrations at all, then the real exported `initDb()`, then
the real `20260624_initiative_status_normalize.sql`:

```
[IC1] STEP 1 precondition: public tables before initDb = 0
[IC1] STEP 2 real initDb() finished in 395 ms
[IC1] STEP 2 public tables after initDb = 72
[IC1] STEP 2 initiatives.status default from runtime DDL = 'DRAFT'::text
[IC1] STEP 3 applied 20260624_initiative_status_normalize.sql
[IC1] STEP 3 initiatives_status_check present; mentions step3 = false
[IC1] STEP 4 status-less INSERT succeeded, status = DRAFT
[IC1] STEP 4 control: explicit 'step3' rejected by the CHECK = true
[IC1] RESULT: RUNTIME BOOTSTRAP PATH PASSES AFTER REVERT
```

This is the load-bearing result: **fixing the source (`PostgresDatabase.ts`) is sufficient. Editing
the historical SQL twins was never required to close the defect.**

### 4.3 Residual, reported not fixed

`server/scripts/run-initdb.js` executes `000_initdb_core_tables.sql` **and nothing else**
(`run-initdb.js:38`) — it never reaches `20260821`. After this revert that standalone bootstrap path
again produces `initiatives.status DEFAULT 'step3'`. It is out of this packet's allowlist and
must not be closed by editing the historical file again. The correct fix is to regenerate the file
as a *new* migration, or to have `run-initdb.js` chain the healing migration. Flagging, not fixing.

Note for whoever tries to reproduce: the `000_*` twins **cannot** be executed by raw `psql`. They
carry SQLite-isms (`DATETIME`, `BOOLEAN DEFAULT 0`) that only the runner translates; a direct
`psql -f` produces 314 errors and no `initiatives` table. An isolated probe built that way is
invalid — it looks like a failure that is really a harness artefact.

## 5. Migration drift audit — clean

`git diff --name-status eb0259a0e6..HEAD -- server/migrations/` over the whole wave:

| File | Class | Verdict |
|---|---|---|
| `000_initdb_core_tables.sql` | **modified existing** | reverted by this packet → now identical to pre-wave |
| `000_z_core_baseline.sql` | **modified existing** | reverted by this packet → now identical to pre-wave |
| `20260810_finance_v3_co9_statement_money_numeric.sql` | new | OK, additive |
| `20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql` | new | OK, additive |
| `20260821_initiatives_status_default_draft.sql` | new | OK, additive |
| `20260822_finance_v3_e007_05_benefit_tracking_protection_reattach.sql` | new | OK, additive |
| `946_benefit_tracking_fresh_install.sql` | new | OK, additive |

**No other historical migration was modified in this wave.** Zero drift remains after the revert.

## 6. Regression

`npx vitest run src/services/finance/canonical/__tests__/ src/database/__tests__/` from `server/`,
against the fully migrated `ic1_fullmig`:

```
Test Files  1 failed | 23 passed (24)
     Tests  1 failed | 336 passed (337)
```

The single failure is **expected and must not be silenced here**:

```
FAIL closeoutCo8RuntimeDdlInitiativesStatusDefault.pg.test.ts
  > no bootstrap SQL twin re-declares the broken default (static guard)
  AssertionError: 000_initdb_core_tables.sql still declares DEFAULT 'step3'
```

That guard is a *text* assertion added by CO-8 asserting the literal is absent from the two SQL
twins. Reverting the twins is precisely what reddens it. The four **behavioural** tests in the same
file — the ones that prove the defect is actually closed — all pass. Adjusting this suite belongs
to IC2; the test file was not touched here.

Anti-vacuity check: the run was grepped for skip markers. The only one emitted was the intentional
`[Postgres] DB_MANAGED_SCHEMA is disabled; skipping initDb()`. No suite reported an unreachable or
unconfigured Postgres, so the `.pg.test.ts` files genuinely exercised the database rather than
passing empty.

## 7. Bottom line

The historical migration files are byte-identical to their pre-CO-8 state, the drift is gone, and
both bootstrap paths still yield `initiatives.status = 'DRAFT'` on a real PostgreSQL 15. The defect
is closed at its source, which is where it always should have been closed.
