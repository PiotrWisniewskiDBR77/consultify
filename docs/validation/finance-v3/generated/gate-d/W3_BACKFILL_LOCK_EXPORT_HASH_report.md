# W3 — Backfill concurrency lock (F-2) + export manifest content hash (F-1)

**Program:** Finance v3, worktree `/Users/piotrwisniewski/consultify-wt/w3-backfilllock`, branch
`codex/finance-v3-w3-backfilllock`.
**Starting commit:** `6612f862ca` ("docs(gate-d): session handoff 2026-08-11 — candidate SHA
`8db62fa385`").
**Fix commits (this session):**
- `8072e11612` — F-2 application-level fix (`pg_try_advisory_lock` single-writer guard).
- `bc4ad0888d` — F-2 database-level fix (additive unique index).
- `9c3a775bc4` — F-1 fix (export manifest hash derived from real content).
**Date:** 2026-08-10/11.

**Environment:** own ephemeral Postgres 15 cluster, `PGDATA=/private/tmp/fv3-bfl-pgdata`, socket
`/tmp/fv3bflsock`, port `57761`. Seven databases were created on this single cluster over the
session (`fv3_bfl_a`, `_b`, `_c`, `_d`, `_e`, `_f`, `_g`, `_fresh` — eight, actually; listed in
full in §7) — still "one ephemeral cluster", never a second one, and never any shared/demo/staging/
production host. Cluster and all databases torn down at the end of this session (§9). No
`DATABASE_URL` used anywhere in this report resolves to anything other than `127.0.0.1:57761`.

**Scope note (higiena / collision check):** this task's territory was `server/scripts/`
(the backfill script), the new migration, and this report. A different, parallel worker in this
program is consolidating hash implementations across the four compute services
(`baselineComputeService.ts`/`kpiComputeService.ts`/`predictionComputeService.ts`/
`valuationComputeService.ts`) and `contentHash.ts` itself. This session **imports**
`canonicalPayloadHash` from `contentHash.ts` but does **not** modify that file, and touches no file
in `server/src/services/finance/canonical/` other than reading it. No collision detected — `git
status` at the end of this session shows exactly the three files this report's fixes touch (the
backfill script, the new migration, this report).

---

## 1. F-2 — backfill unsafe under concurrent runs

### 1.1 Confirming the missing uniqueness constraint (required first step)

Queried `pg_constraint`/`pg_indexes` directly against a freshly STRICT-migrated database (not
inferred from reading the migration SQL):

```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid = 'finance_artifacts'::regclass;
```

Result: `finance_artifacts_pkey` (PK on `artifact_id`), `uq_finance_artifacts_org` (UNIQUE on
`artifact_id, organization_id` — exists only so *other* tables can FK to the pair; it does not
constrain `natural_key` at all), two FKs, one CHECK. **No constraint or index of any kind involves
`natural_key`.** Same result from `pg_indexes`.

**Scope of the missing constraint: per-organization, not global.** `getOrCreateArtifact()`
(`server/scripts/finance-v3-backfill-dry-run.ts`, then line 235) does
`SELECT artifact_id FROM finance_artifacts WHERE organization_id = $1 AND natural_key = $2` — the
application's own lookup key is the **pair** `(organization_id, natural_key)`, confirming two
different organizations may legitimately reuse the same legacy-derived `natural_key` string (they
are different legacy databases in the real migration scenario this script models). The fix must
therefore be scoped to that pair, not to `natural_key` alone.

### 1.2 Reproduction attempt 1 — full-script concurrency (as in the W2 report)

Two `run` processes launched at the same instant against the same freshly seeded database, no
`--resume`:

```
P1: EXIT=0, all 6 phases, "Backfill run complete"
P2: EXIT=1, error 23505 on uq_finance_bv_artifact_version, "Key (artifact_id, version_no)=(...,1) already exists"
```

Identical failure mode to the W2 report's own §7 finding (F-2a). Repeated 3 more times (natural
timing, then with an artificial one-shot delay hook — see §1.3) — **every attempt** produced this
exact crash pattern, never a silent duplicate. `finance_artifacts` duplicate check after each
attempt (`GROUP BY organization_id, natural_key HAVING count(*) > 1`) returned **0 rows** every
time.

**Why the full script never produces the persisted duplicate (a new finding this session made,
not just "didn't get lucky"):** every single call site of `getOrCreateArtifact()` in this script is
followed, in the *same* transaction, by an immediate `createBusinessVersion(artifactId,
versionNo=1, ...)` call on the artifact it just resolved. So whenever the race causes process B to
reuse process A's already-committed `artifact_id` (because A committed between B's `SELECT` and
what would have been B's own `INSERT`), B's very next statement — inserting `version_no=1` for that
now-shared artifact — collides with the `uq_finance_bv_artifact_version` constraint A already
satisfied. That failure rolls back B's **entire** containing transaction, including any duplicate
`finance_artifacts` rows B had already inserted earlier in the same chunk for *other*, non-colliding
natural keys. The crash-and-rollback is real (F-2a, an operational cost — a wasted run, a
stack trace to investigate) but it is a **structural accident of this particular script's own
call sequencing**, not a property of the schema. Nothing about `finance_artifacts.natural_key`
itself prevents a silent duplicate for a caller that does not immediately pair artifact creation
with a version insert on the same id.

### 1.3 Reproduction attempt 2 — widening the race window did not change the outcome either

Added a test-only hook to `getOrCreateArtifact()` (`BACKFILL_RACE_TEST_DELAY_MS`, no-op unless set,
kept in the script permanently as a repeatable reproduction tool, not removed after use):

```ts
const raceTestDelayMs = Number(process.env.BACKFILL_RACE_TEST_DELAY_MS || 0);
if (raceTestDelayMs > 0 && !raceTestDelayFired) {
  raceTestDelayFired = true;
  await new Promise((resolve) => setTimeout(resolve, raceTestDelayMs));
}
```

Fires only once per process (on the first missing-artifact lookup), so two concurrently-launched
processes hit the delay at nearly the same wall-clock instant instead of drifting apart over many
delayed calls. Tried both unconditional-every-call delays (300ms) and one-shot delays (300ms,
1500ms) with `--chunk-size 1000` (collapsing an entire org's table into one transaction, maximizing
the open-transaction window). **Every attempt still produced the F-2a crash pattern, never a
persisted duplicate** — confirming §1.2's structural explanation: widening the window changes
*which* natural key the two processes collide on, not *whether* the paired version-insert catches
it first.

### 1.4 Reproduction attempt 3 — isolating the exact vulnerable statement shape at the SQL level (succeeded)

Since the full script's own call sequencing incidentally self-defends, the honest way to prove
F-2b (silent duplication, not just a crash) is to test the **exact** `getOrCreateArtifact()`
statement shape on its own, decoupled from the immediately-following version insert. Two
concurrent `psql` sessions, each running the identical SELECT → sleep → INSERT → COMMIT sequence
the function issues, with `pg_sleep(1)` forcing the SELECTs to overlap before either INSERT
commits:

```sql
-- both sessions, concurrently:
BEGIN;
SELECT artifact_id FROM finance_artifacts WHERE organization_id = 'org-fv3-alpha' AND natural_key = 'financial_statement_packs:pack-1';
SELECT pg_sleep(1);
INSERT INTO finance_artifacts (organization_id, artifact_type, natural_key, created_by)
  VALUES ('org-fv3-alpha', 'STATEMENT_PACK', 'financial_statement_packs:pack-1', '<session-label>')
  RETURNING artifact_id;
COMMIT;
```

**Result: both sessions committed successfully.**

```
             artifact_id              | organization_id |           natural_key            |  created_by
--------------------------------------+-----------------+----------------------------------+--------------
 917dfb52-c649-462c-b0c2-38706f324754 | org-fv3-alpha   | financial_statement_packs:pack-1 | race-test-p2
 bf208d6a-0ad3-4c52-87db-4e819a5c9b22 | org-fv3-alpha   | financial_statement_packs:pack-1 | race-test-p1
```

**Two rows, identical `(organization_id, natural_key)`, no error, no warning, nothing to flag it
downstream.** This is F-2b, reproduced directly and decisively — not inferred from reading the
code, not "different timing might do it": under genuinely overlapping transactions, it does it,
every time this exact sequence was run (repeated after the fix too — see §1.6 — where it stopped).

**Verdict — F-2b upgraded from "inferred, not reproduced" (W2 report) to REPRODUCED.**

### 1.5 Fix 1 — application-level: `pg_try_advisory_lock` single-writer guard

Commit `8072e11612`. A session-scoped Postgres advisory lock
(`pg_try_advisory_lock(hashtext('finance-v3-backfill-dry-run:single-writer')::bigint)`), acquired
on a **dedicated connection checked out from the pool** (advisory locks are session-scoped; using
`pool.query()` for both acquire and release would risk landing on two different physical
connections) and held for the entire `seed`/`run` invocation, released in `main()`'s `finally`.

**`pg_try_advisory_lock` (immediate refusal), not `pg_advisory_lock` (blocking wait) — deliberate
choice, justified:**

- This script's only real caller is a human operator running one shell command at a time (no cron,
  no orchestrator, no route mounts it — confirmed in the W2 report §1 and unchanged here). An
  operator who accidentally double-launches the job needs to find out **immediately and
  unambiguously**. A blocking wait would look exactly like a hang — there is no way from the
  terminal to distinguish "waiting for the lock" from "stuck for an unrelated reason" — and is
  strictly harder to diagnose.
- There is no queue of pending work for a blocked second invocation to usefully wait for; blocking
  buys nothing operationally here.
- It matches the script's own existing idiom: `process.exit(2)` for a missing `--database-url`, and
  an explicit thrown error ("Refusing to silently continue a prior run") instead of blocking when
  `--resume` is missing. Fail loud and immediate is already this script's house style.
- If this script is ever wired into a real orchestrator with a job queue, that is the moment to
  reconsider — a queued caller might legitimately prefer to block. That caller does not exist today
  (documented in the code comment at the point of decision, not left implicit).

The refusal is a typed error (`class BackfillLockHeldError extends Error`), caught in `main()` and
surfaced as a clear message + distinct exit code `3` (distinguishing "another instance is running"
from a data/logic failure, mirroring the script's existing `42` for "simulated crash requested").

**Proof — two concurrent `run` invocations, fixed code:**

```
P1: EXIT=0, all 6 phases, "Backfill run complete"
P2: 🔒 Another finance-v3-backfill-dry-run 'seed' or 'run' process already holds the advisory lock
    (key='finance-v3-backfill-dry-run:single-writer') on this database. Refusing to run
    concurrently — ... Wait for the other process to finish ... and retry.
    EXIT=3
```

`finance_artifacts` after: **105 rows, zero duplicates.** Repeated with the `BACKFILL_RACE_TEST_DELAY_MS=1500`
adversarial hook from §1.3 active (`--chunk-size 1000`, maximum window) — **identical result**: P1
completes, P2 is refused at the very top of `main()`, before it ever reaches `getOrCreateArtifact()`
at all, so the widened window inside that function is irrelevant once the lock guards entry. Lock
release confirmed: a third, sequential `run --resume` after both P1/P2 finished completed normally
(`EXIT=0`), proving the lock does not leak across invocations.

### 1.6 Fix 2 — database-level: additive unique index (belt-and-suspenders)

Commit `bc4ad0888d`, new file `server/migrations/20260827_finance_v3_w3_backfill_artifacts_unique.sql`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_artifacts_org_natural_key
  ON finance_artifacts (organization_id, natural_key)
  WHERE natural_key IS NOT NULL;
```

**Why a partial index, not a plain `UNIQUE (organization_id, natural_key)` constraint:**
`natural_key` is nullable **by design** —
`server/src/services/finance/canonical/artifactVersionService.ts`'s
`CreateArtifactParams.naturalKey?: string | null` — a caller with no legacy natural key (e.g. a
brand-new artifact created directly in the canonical system, no migration involved) is a
legitimate, existing case. A plain `UNIQUE` constraint happens to already treat every `NULL` as
distinct in Postgres, so it would *functionally* behave the same as the partial index here — but
relying on that as the mechanism for "not enforced when unset" would be leaning on an
implementation detail of NULL comparison semantics rather than stating the intent directly. The
`WHERE natural_key IS NOT NULL` partial index says exactly what is meant.

**Why this is needed in addition to §1.5's lock, not instead of it:** the lock only protects
callers of *this script*. The one production code path that also writes `finance_artifacts`
(`artifactVersionService.createArtifact()`) does **not** take this lock (confirmed by reading that
file — no lock acquisition anywhere in it) and has no other guard against the identical race shape.
The migration is the backstop for that caller and any future one, independent of whether they
remember to coordinate with this script's own lock.

**Additive only, no existing column/table/constraint modified.**

**Safety on existing/populated data — tested, not just asserted:**
- Applied on a fresh, empty database: **succeeds** (`EXIT=0`).
- Applied on a database with a deliberately injected duplicate
  (`INSERT ... SELECT organization_id, artifact_type, natural_key, 'injected-dup-test' FROM
  finance_artifacts WHERE natural_key IS NOT NULL LIMIT 1`): **fails loudly**, `SQLSTATE 23505`,
  real process `EXIT=1` (verified as the actual migration-runner exit code, not just the tail-piped
  `$?`) — the migration does **not** silently skip or half-apply. The migration file's own header
  comment carries the operator runbook (the exact `GROUP BY ... HAVING count(*) > 1` investigation
  query, and why an automatic dedup step is deliberately not included — deciding which duplicate
  "wins" is a data decision, not a schema one).
- Duplicate removed, migration re-applied on the same database: **succeeds**.

### 1.7 Which layer actually defends? Isolated and answered, not assumed

Per the task's own warning that this program has been fooled before by "both layers catch it, so
which one is actually load-bearing is unmeasured" — tested each layer **alone**:

- **DB constraint alone** (index applied, script's advisory lock temporarily not in the path — the
  exact SQL-level race from §1.4 re-run *after* the migration): session 1's `INSERT` succeeds and
  commits; session 2's `INSERT` fails with
  `ERROR: duplicate key value violates unique constraint "uq_finance_artifacts_org_natural_key"`
  and rolls back cleanly. **One row survives, zero duplicates. The DB constraint alone is
  sufficient.**
- **Application lock alone** (§1.5, before the migration existed in this session's own commit
  order — but also re-verified after, since the lock is checked *before* any DB write, its
  behavior does not depend on the migration's presence): process 2 is refused before touching the
  database at all. **The lock alone is sufficient.**
- **Both together** (final state, §1.5's adversarial retest + the full concurrent-run proof in
  §4 below): compose without conflict — the lock is checked first (cheaper, faster feedback, no
  wasted work), the constraint is dormant unless some other caller bypasses the lock.

**Answer: both layers independently defend; they are not redundant in the sense of "either one
would have been enough for the whole system" — the lock only covers this script, the constraint
covers everything.** Neither is masking a failure in the other; both were verified in isolation.

---

## 2. F-1 — export manifest hash was computed from a random id, not content

### 2.1 The bug, and why it defeats WP-B06's own stated purpose

`server/scripts/finance-v3-backfill-dry-run.ts`, `phaseExports()` (pre-fix):

```ts
const hash = sha256({ t: 'export', org, bv: approved.currentBusinessVersionId });
```

`approved.currentBusinessVersionId` is a `gen_random_uuid()::text` value — a different random string
on every run, regardless of content. `finance_export_manifests` (migration
`20260809_finance_v3_b06_reproducibility_retention_export.sql`) exists specifically for
reproducibility; a "content semantic hash" that is actually a hash of a random id proves the
opposite of what its name claims.

### 2.2 Reproducing the bug directly (not just quoting the earlier report)

Temporarily reverted the script to the pre-F-1-fix state — `git checkout HEAD -- <file>` (**not**
`git stash`, per the task's own instruction; `HEAD` at that point was `8072e11612`, i.e. after the
F-2 fixes but before F-1), leaving the F-2 lock/migration fixes in place so this test is isolated to
F-1 alone. Ran two independent `seed` + `run` cycles on two fresh databases (`fv3_bfl_f`,
`fv3_bfl_g`; deterministic seed, so legacy content is byte-identical between them, same guarantee
proven in the W2 report §2/§4):

```
=== F ===                                          === G ===
org-fv3-alpha   853d6d1326a76fc9...                 org-fv3-alpha   baef88640566feea...
org-fv3-beta    cb3a001a6ba651ae...                 org-fv3-beta    41534e9c10a26d54...
org-fv3-gamma   05c782ef0ccd9a54...                 org-fv3-gamma   29d86acecd75966c...
```

**Every org's hash differs between the two runs, despite identical underlying content.** Confirmed
the bug live, in this session, on this branch — not inherited from the earlier report's word alone.
File restored from a pre-edit backup (`cp` before the checkout, `cp` back after — not a second
`git checkout`, so the fix commit's own diff is untouched) immediately after this test.

### 2.3 The fix

Commit `9c3a775bc4`. Replaced the hash input with real content:

```ts
const sourceRes = await client.query(
  `SELECT fa.natural_key, fa.artifact_type, fbv.version_no, fbv.status, fbv.content_semantic_hash
     FROM finance_business_versions fbv
     JOIN finance_artifacts fa ON fa.artifact_id = fbv.artifact_id
    WHERE fbv.business_version_id = $1`,
  [approved.currentBusinessVersionId]
);
// ... (throws if content_semantic_hash is missing — never silently hashes a NULL)
const hash = canonicalPayloadHash({
  t: 'export', organizationId: org, artifactType: source.artifact_type,
  artifactNaturalKey: source.natural_key, versionNo: source.version_no, status: source.status,
  businessVersionContentHash: source.content_semantic_hash,
  format: 'PDF', locale: 'pl-PL', timezone: 'Europe/Warsaw', unit: 'PLN',
  roundingConvention: 'BANKERS_ROUNDING_2DP',
});
```

`source.content_semantic_hash` is the underlying business version's own hash — itself derived from
real legacy content (`phaseValuation`'s
`sha256({ t: 'valuations', id: val.id, version: v, snapshot: historyRow?.snapshot_data ?? null })`,
already proven deterministic across independent runs in the W2 report §4's 22-table comparison,
where `finance_business_versions.content_semantic_hash` was directly compared — not excluded — and
matched). No random id appears anywhere in the new payload.

**Used the existing primitive, per the task's explicit instruction:** imported
`canonicalPayloadHash` from `server/src/services/finance/canonical/contentHash.ts` rather than
writing a second `sha256(JSON.stringify(...))` expression — that file's own header comment
documents this codebase's history of exactly that mistake (seven independent re-implementations
found and fixed before this file existed). `contentHash.ts` itself was **not modified** (out of
scope per this task's brief — a different worker owns consolidating the four compute services'
hash call sites into it).

### 2.4 Proof — same content twice, then a real content change

**Same content, two independent runs (fixed code), read from two separate databases:**

```
=== C ===                                            === D ===
org-fv3-alpha   43d1e843b9507aebf888e9856736765a...   org-fv3-alpha   43d1e843b9507aebf888e9856736765a...
org-fv3-beta    c9e2fe4c4cd6229bc80a87a78b5823e2...   org-fv3-beta    c9e2fe4c4cd6229bc80a87a78b5823e2...
org-fv3-gamma   2d288d0c02e9ad57457f1e3f51adee87...   org-fv3-gamma   2d288d0c02e9ad57457f1e3f51adee87...
```

**Identical hashes for every org, byte-for-byte, both `content_semantic_hash` and
`file_hash_sha256`.** (Previously — §2.2 — every one of these six values differed.)

**Changed content, one value:** on a third fresh database (`fv3_bfl_e`), after `seed` and before
`run`, directly mutated one legacy value that feeds the exported valuation's content hash:

```sql
UPDATE valuation_snapshots SET snapshot_data = '{"sv": 999}'::jsonb WHERE id = 'valsnap-8r';
-- (was '{"sv": 2}', the version-2/current snapshot of val_case-8p, org-fv3-alpha's approved export source)
```

Ran the backfill. Result for `org-fv3-alpha`:

```
E (changed content):  82bb2a3990b1568c3137ce7b913a9e5d4a023dfa5ae2e28416f2318464ac00da
D (baseline, unchanged): 43d1e843b9507aebf888e9856736765a05be3a75b9209a37a8bb54a61aa6d864
```

**Different hash.** Both the "same" and "different" checks were read via independent `psql`
connections directly against the database — not from any in-process script variable that could be
lying about what actually landed.

**Verdict: F-1 FIXED, proven both directions (same → same, changed → different), with raw values
shown and independently re-read from the database.**

---

## 3. Negative control — which check can actually fail, and did it

Required by the brief and by this program's own history of measurements that quietly proved
nothing.

| Check | Without the fix | With the fix |
|---|---|---|
| F-2, full-script concurrency | Reproduced (§1.2): one process crashes on `uq_finance_bv_artifact_version`, `EXIT=1` | Clean: one process completes, the other gets a typed `BackfillLockHeldError`, `EXIT=3`, zero duplicates (§1.5) |
| F-2b, silent duplicate (exact SQL shape) | Reproduced (§1.4): both sessions commit, two rows for the identical `(organization_id, natural_key)`, no error | DB layer alone: second session gets `23505`, rolls back, one row survives (§1.7). App layer alone: second process refused before any DB write (§1.7). Both together: same outcome, lock checked first (§1.5, §4) |
| Migration on populated/duplicate data | (not applicable pre-fix — index does not exist yet) | Fresh DB: succeeds. DB with an injected duplicate: fails loudly with `23505`, real `EXIT=1`, not a silent skip (§1.6) |
| F-1, export hash | Reproduced live in this session (§2.2): two independent runs of identical content → six different hash values | Same content twice → identical hashes (all six match). One legacy value changed → different hash for that org, unchanged hashes for the other two orgs in the same run (§2.4) |

**Which layer defends, for F-2b specifically — resolved, not left ambiguous (§1.7):** both the
application-level lock and the database-level unique index independently block the exact same raw
SQL race when tested alone. They are not redundant in scope — the lock covers only this script's
own `seed`/`run`, the constraint covers every current and future writer of `finance_artifacts` —
but for the specific race reproduced here, either one alone is sufficient.

**DB test gate discipline** — this task's own harness is a CLI script + raw SQL, not new
`.pg.test.ts` vitest files (matching how this backfill script has been evidenced throughout the W2/W3
work packages; it has no existing vitest coverage of its own to extend). The general gate discipline
this program relies on was re-verified directly: running an existing `.pg.test.ts` file
(`exceptionInboxService.pg.test.ts`) with none of `RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL` set
produces `1 skipped (1)` / `5 skipped (5)`, never a false `passed`.

---

## 4. Acceptance thresholds (this session's own SHA, freshly measured)

| Check | Result |
|---|---|
| STRICT migrations, fresh DB (`fv3_bfl_fresh`, includes the new W3 migration) | **exit 0, 637 applied** (baseline was 635/636 before this session's one new file) |
| Migration on fresh DB alone | exit 0 |
| Migration on DB with injected duplicate | exit 1, `23505`, loud failure (not skipped) |
| `finance/canonical` vitest suite (against `fv3_bfl_fresh`) | **33/33 files, 444/444 tests, exit 0** — matches the orchestrator's baseline exactly, no regression |
| `finance` vitest suite (against `fv3_bfl_fresh`) | **43/43 files, 712/712 tests, exit 0** — matches baseline exactly, no regression |
| `tsc -p server` | **exit 0, zero output lines** |
| F-2 concurrent-run proof (fresh seed on `fv3_bfl_fresh`, both fixes live) | P1 exit 0 full completion, P2 exit 3 typed refusal, zero duplicates, `verify` equation holds, 0 duplicate aliases |
| F-1 export hash (same run) | `org-fv3-alpha`/`beta`/`gamma` hashes identical to the earlier independent-run baseline (`43d1e843...`, `c9e2fe4c...`, `2d288d0c...`) |

Cluster and all eight databases (`fv3_bfl_a` through `fv3_bfl_g`, `fv3_bfl_fresh`) torn down
(`pg_ctl stop -m fast` + `rm -rf "$PGDATA" "$PGSOCK"`) at the end of this session. No shared/demo/
staging/production database was touched at any point — every `DATABASE_URL` in every command above
points at `127.0.0.1:57761`.

---

## 5. Recommendation for FC-02.2

The W2 report recommended `PASS` with an explicit "single-writer execution" scope boundary,
because concurrent execution was proven unsafe (F-2a reproduced) and F-2b was inferred but not yet
reproduced.

**This session closes that gap on the application side (this script) and adds a database-level
backstop that is not scoped to this script at all.** Recommendation:

- **The "single-writer" scope note can be narrowed but not entirely removed**, and the reason is
  precise, not hand-wavy: `finance-v3-backfill-dry-run.ts` itself is now safe under concurrent
  invocation (proven, §1.5/§4) — two simultaneous `run`/`seed` calls against the same database no
  longer race, crash, or duplicate. **However**, the underlying vulnerability this gate condition
  is really about — `finance_artifacts` accepting a duplicate `(organization_id, natural_key)`
  under concurrent writers — is now closed at the schema level for **any** writer, including
  production code (`artifactVersionService.createArtifact()`) that was never in this script's
  scope to begin with and does not take this script's lock. That is a strictly larger claim than
  "this one script is safe," and it is now also true and proven (§1.6/§1.7).
- Recommend the gate's wording move from "deterministic and idempotent under single-writer
  execution" to **"deterministic and idempotent; safe under concurrent invocation of this script
  specifically (advisory-lock enforced), with a database-level uniqueness backstop covering all
  current and future writers of `finance_artifacts`."** This is more precise than simply deleting
  the scope note — it still correctly does NOT claim that every other Finance v3 write path has
  been audited for its own concurrency safety (only `finance_artifacts.natural_key`'s specific gap
  was in scope for F-2).
- F-1 (export manifest reproducibility) is fixed and proven; cross-reference for whoever owns
  Gate D / WP-B06 content-hash work can be closed for the backfill script's own export path
  specifically (the four compute services' own hash call sites are a separate, parallel work
  stream per the collision note in the preamble).

## EVIDENCE_MISSING

None for the four things this task was asked to prove or resolve — the missing constraint was
confirmed by direct query (§1.1), F-2b's silent duplicate was reproduced directly at the SQL level
(§1.4, upgraded from the W2 report's "inferred, not reproduced"), both fix layers were verified in
isolation and together (§1.5–§1.7), and F-1's before/after was reproduced and proven in both
directions with independently-read raw values (§2.2, §2.4).

One explicit, bounded gap, stated plainly rather than rounded up: this session did **not** audit
whether `artifactVersionService.createArtifact()` (the production `finance_artifacts` writer) or
any other current/future caller has its own equivalent of this script's advisory lock — only that
the new database constraint now protects it regardless. Whether that production path needs its own
application-level lock (for its own operational reasons, e.g. avoiding a wasted partial write before
hitting `23505`) is a separate, not-yet-scoped question, not part of F-2/F-1 as defined by this
task's brief.

---

## 6. Higiena / collision notes

- No file under `server/src/services/finance/canonical/` was modified — `contentHash.ts` is
  imported, not edited, honoring the note that a parallel worker owns consolidating hash call
  sites there.
- All new/changed files are within this task's stated territory: `server/scripts/finance-v3-backfill-dry-run.ts`,
  `server/migrations/20260827_finance_v3_w3_backfill_artifacts_unique.sql`, and this report.
- Three commits, one per logical stage, per the task's higiena instruction: `8072e11612` (F-2
  application fix), `bc4ad0888d` (F-2 database fix), `9c3a775bc4` (F-1 fix). This report is a
  fourth commit.
- No `git stash` used anywhere in this session. The one temporary file swap (§2.2's negative
  control) used `git checkout HEAD -- <file>` plus a manual `cp` backup/restore, exactly as
  instructed.
- No new files under `tests/` were added (the CLI-harness methodology matches how this script has
  been evidenced throughout Gate D so far), so no `git add -f` was needed.

## 7. Commands to reproduce (condensed)

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-bfl-pgdata ; PGSOCK=/tmp/fv3bflsock ; PORT=57761
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3bfl_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_bfl_fresh;"

RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/fv3_bfl_fresh" \
  npx tsx server/scripts/migrate.postgres.ts   # exit 0, 637

DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/fv3_bfl_fresh" \
  npx tsx server/scripts/finance-v3-backfill-dry-run.ts seed

# F-2: concurrent run — one succeeds, one gets a typed lock refusal (exit 3)
( DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/fv3_bfl_fresh" \
  npx tsx server/scripts/finance-v3-backfill-dry-run.ts run --chunk-size 20 --run-batch p1 ) &
( DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/fv3_bfl_fresh" \
  npx tsx server/scripts/finance-v3-backfill-dry-run.ts run --chunk-size 20 --run-batch p2 ) &
wait

# F-1: two independent fresh runs, compare finance_export_manifests.content_semantic_hash — identical
# (repeat on a third DB with one valuation_snapshots.snapshot_data value changed — hash differs)

$PGBIN/pg_ctl -D "$PGDATA" stop -m fast
rm -rf "$PGDATA" "$PGSOCK"
```
