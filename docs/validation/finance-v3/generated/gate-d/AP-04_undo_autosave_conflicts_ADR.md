# ADR AP-04 — Undo/Redo, Autosave, and Conflict Resolution (Gate D / Fala 3)

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` section 5
(Analyst Productivity i UX), AP-04. Task brief:
`docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3 point 4
("Undo/redo i draft recovery: session-level stack, atomowe cofniecie bulk/paste, autosave,
Sync/Saved/Conflict oraz crash/refresh recovery").
**Work package:** AP-04 — builds on AP-00's shared contracts (`Operation`, `WorkspaceState`) and
Gate C's `finance_working_revisions` (already shipped, real schema).
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `Real application code + real PostgreSQL integration tests, on this work package's own
ephemeral cluster. One additive migration. No demo/staging/prod database touched.`

---

## 1. Inputs read, in this order

1. `docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md`, full text, and
   `server/src/types/finance/Operation.ts` / `WorkspaceState.ts` — the fundament this work package
   is explicitly told not to duplicate: `Operation` (the five-verb discriminated union),
   `ApplyOperationsBatchRequest`, and `FinanceWorkspaceState.unsavedOperationStack`.
2. `docs/validation/finance-v3/generated/gate-c/WP-C02_compatibility_services_report.md` and
   `server/src/services/finance/canonical/*.ts` (especially `artifactVersionService.ts`) —
   `finance_working_revisions` already exists with a real, migrated schema
   (`server/migrations/20260809_finance_v3_b01_core_artifacts.sql`); this ADR's job is to USE it,
   not build a parallel mechanism.
3. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3 point 4 —
   the literal task scope: undo/redo session-level stack, atomic bulk/paste undo, autosave,
   Sync/Saved/Conflict states, crash/refresh recovery.
4. Additionally (not listed in the task brief, but required for internal consistency, same
   discipline AP-00 section 1 point 5 applied): `server/migrations/20260809_finance_v3_b01_core_artifacts.sql`
   full text (`finance_working_revisions`'s real columns —
   `crash_recovery_checkpoint`/`content_semantic_hash`/`revision_seq`/`is_current`, and the partial
   unique index `uq_finance_wr_one_current`), `artifactVersionService.reopenVersion()` (the real,
   already-shipped demote-then-INSERT working-revision pattern this ADR reuses rather than
   reinvents), and `server/src/services/finance/canonical/computeJobService.ts` (WP-B04's
   `input_revision_hash` field — already exists, item 5 is an integration, not new mechanism).

---

## 2. Context

### 2.1 What AP-00/Gate C already give — not duplicated here

- `Operation` (set/clear/paste/bulk_set/reset), its target-cardinality-vs-value-cardinality shape,
  and `operationTargets()` (AP-00 section 6.1) — one `Operation` already bundles every cell a
  bulk/paste touches into ONE object. This work package's `OperationStack` treats one `Operation`
  as one undo unit for exactly this reason (section 4 below) — no separate "batch id" concept is
  invented on top.
- `FinanceWorkspaceState.unsavedOperationStack` (AP-00 section 8) — the wire shape
  (`{operation, appliedAt, committed}`) this work package serializes to/from
  `finance_working_revisions.checkpoint_payload` (new column, section 3.2).
- `finance_working_revisions` itself, `crash_recovery_checkpoint`, `content_semantic_hash`,
  `revision_seq`, `is_current`, `uq_finance_wr_one_current` (WP-B01, shipped) — this ADR's
  `autosaveService.checkpointOperationStack()` reuses the EXACT demote-then-INSERT ordering
  `reopenVersion()` already established (`artifactVersionService.ts` lines ~700-729), not a second
  mechanism for "how does a new working-revision checkpoint get created".
- `computeJobService.enqueue()`'s `inputRevisionHash` parameter and
  `compute_job_outputs`'s `UNIQUE (organization_id, output_artifact_id, content_semantic_hash)`
  (WP-B04, shipped) — the hash-pinning MECHANISM already exists; item 5 below is one integration
  call, not new compute-engine logic.

### 2.2 What AP-04 adds

Nothing in AP-00/Gate C defines: (a) an in-memory undo/redo stack with atomic bulk/paste undo, (b)
a debounced autosave scheduling policy, (c) the actual write path that turns an
`unsavedOperationStack` into a `finance_working_revisions` checkpoint row (AP-00 section 6.2
explicitly left this executor "out of scope for this ADR" for a future Gate D work package — this
IS that work package, scoped narrowly to the checkpoint/autosave layer, not the full
domain-table-apply executor — see section 3.3), (d) crash-recovery detection/reconstruction, or
(e) mine/theirs/base conflict detection across two users' concurrent edits. This ADR closes all
five with real TypeScript services, real unit tests, and real PostgreSQL integration tests.

### 2.3 Explicit non-goal: the domain-table (`finance_stmt_lines`) apply executor

AP-00 ADR section 6.2 describes a FUTURE executor that would UPSERT into `finance_stmt_lines` (or
whichever domain table) as part of applying an `ApplyOperationsBatchRequest`. That table's real
schema does not exist yet — `WP-D01_statements_schema_ADR.md` is explicitly `Status: ADR — DDL
sketch, ... NOT executed as a real migration` (checked directly, section 7 above). This work
package therefore CANNOT and DOES NOT build that executor — there is no real target table to write
to. What it DOES build is the layer one level up: capturing, checkpointing, undoing, and
conflict-detecting the `Operation` stream itself, against the one real, shipped table
(`finance_working_revisions`) that already exists for exactly this purpose. When a domain-table
executor lands in a future work package, it becomes the thing that actually applies operations
popped off this stack — this ADR's contract does not need to change for that to happen.

---

## 3. Decision — six files, `server/src/services/finance/collaboration/`

| File | Responsibility | DB access |
|---|---|---|
| `operationStack.ts` | In-memory undo/redo stack over `Operation` (AP-00), atomic bulk/paste undo, configurable min-50 depth | **None** — pure functions/class over plain data |
| `autosaveScheduler.ts` | Debounce-with-max-wait scheduling policy wrapping an injected flush callback | **None** — pure, timer-based |
| `autosaveService.ts` | `checkpointOperationStack()` — writes a checkpoint into `finance_working_revisions`; Sync/Saved/Conflict enum | `withPinnedPostgresTransaction` |
| `crashRecoveryService.ts` | Detect a dangling autosave checkpoint on re-open, reconstruct an `OperationStack` from it, accept/discard | `withPinnedPostgresTransaction` (detect/accept/discard) + pure (reconstruct) |
| `conflictResolver.ts` | mine/theirs/base 3-way detection across intervening checkpoints, propose (never auto-apply) a resolution | `withPinnedPostgresTransaction` (detect, read-only) + pure (`buildResolvedOperation`) |
| `computePinning.ts` | Integration: enqueue a compute job pinned to the CURRENT `content_semantic_hash` | `withPinnedPostgresTransaction` (one read) + delegates to `computeJobService.enqueue()` |

**Why `server/src/services/finance/collaboration/`, not `server/src/types/finance/`:** AP-00's five
files are pure TypeScript+Zod CONTRACTS with zero DB imports (its own convention, ADR section 3).
Four of this work package's six files DO touch Postgres (`autosaveService`, `crashRecoveryService`,
`conflictResolver`, `computePinning`) — they belong with the other DB-touching Finance services
(`server/src/services/finance/canonical/`), not the contract-only `types/` directory. The two
DB-free files (`operationStack.ts`, `autosaveScheduler.ts`) live alongside their DB-touching
callers in the same `collaboration/` directory rather than being split into `types/` purely for
their own DB-free-ness, because they are `Operation`-STACK MECHANICS (undo/redo semantics,
scheduling policy) specific to this work package's own runtime behavior, not reusable
cross-cutting type contracts other future work packages (AP-01, AP-05, ...) would import the way
they import `CellRef`/`Operation` — this mirrors how `lifecycleService.ts` (also DB-free) lives in
`canonical/` alongside its DB-touching sibling `artifactVersionService.ts`, not in `types/`.

All six files were type-checked with the project's own `server/tsconfig.json` (strict mode,
`noImplicitAny`, etc.) via a scoped, temporary `include` list (the six new files + the AP-00 files
and canonical services they import from) — **zero errors** — and separately bundle-checked
per-file with `esbuild --bundle` (external `pg`/`uuid`/`zod`) — see section 8.

---

## 4. OperationStack — atomic bulk/paste undo, by construction

`server/src/services/finance/collaboration/operationStack.ts`.

**Core design decision: one `Operation` is one undo unit.** AP-00's `Operation` discriminated
union already bundles every targeted `CellRef` of a `paste`/`bulk_set`/`clear`/`reset` into ONE
object (`operationTargets()` returns all of them). `OperationStack.push(operation, priorValues)`
stores exactly that one `Operation` plus the pre-edit value at each of its targets
(`priorValues: (FinanceValue | null)[]`, aligned by index). One stack entry, one undo step. This is
what makes the task brief's "atomowy undo bulk/paste (cofa CALY Operation.batch jednym ruchem, nie
komorka po komorce)" true by construction rather than by a special case: there is no
per-cell-granularity path to accidentally fall into — `undo()` always reverts the WHOLE entry's
targets in one inverse `Operation`.

**The inverse of any operation type is a single `paste`.** `clear`'s inverse restores whatever was
cleared; `reset`'s inverse restores whatever local edit the reset discarded; `set`/`bulk_set`'s
inverse restores the single/shared prior value; `paste`'s inverse restores each of its own N prior
values. All four collapse to the same code path (`buildInverseOperation`) because `priorValues` was
captured before the entry's `Operation` ran, so replaying it exactly undoes that `Operation`,
whatever it was — no per-type special-casing needed, and no case where a partial revert could leave
some targeted cells un-reverted.

**Depth: default 50, configurable, not hardcoded.** `DEFAULT_MAX_UNDO_DEPTH = 50` satisfies the task
brief's "min. 50 poziomow" floor; `new OperationStack({ maxDepth: N })` overrides it. Exceeding
`maxDepth` evicts the OLDEST entry (bounded, not unbounded) — this is the mitigation for AP-00 ADR
section 10 point 3's flagged open risk ("`unsavedOperationStack` has no max-length/eviction policy
... could accumulate an unbounded stack").

**Redo re-mints identity, never reuses it.** `redo()` replays the original `Operation`'s
target/value payload but with a FRESH `operationId`/`idempotencyKey`/`clientTimestamp`/
`sourceWorkingRevisionId` supplied by the caller at redo time — reusing the stale ones risks a
spurious idempotent-replay match against the wrong mutation, or a CAS rejection against a working
revision that has, correctly, since moved (documented in the function's own doc comment).

**A new push after an undo discards the redo branch** — standard editor semantics (Excel/Sheets):
verified in `operationStack.test.ts`.

**Zero DB imports** — unit-testable without Postgres, per the task's own split ("unit: OperationStack
logika bez DB"). 22 unit tests in `__tests__/operationStack.test.ts` cover: basic push/undo/redo,
atomic multi-cell undo for `paste`/`bulk_set`/`clear`/`reset` specifically, depth/eviction, and
serialization round-trip (`fromEntries`/`toArray`, the crash-recovery entry point).

`operationIntendedValues(operation)` — a shared per-target-value projection also exported from this
file and reused verbatim by `conflictResolver.ts` (section 6), so "what value does this `Operation`
intend to write, per target" has exactly one implementation, not two that could drift.

---

## 5. AutosaveService — checkpoint write path, Sync/Saved/Conflict

`server/src/services/finance/collaboration/autosaveService.ts` (DB-touching) +
`autosaveScheduler.ts` (pure debounce policy).

### 5.1 `checkpointOperationStack()` — the one write path

`SELECT ... FOR UPDATE` the artifact's current `is_current` working revision, CAS-check the
caller's `expectedWorkingRevisionId` against it (mirrors `Operation.sourceWorkingRevisionId` /
`ApplyOperationsBatchRequest.expectedWorkingRevisionId`, AP-00 section 6.2/6.3), then — on match —
demote it (`is_current = false`) and `INSERT` a new row (`revision_seq + 1`, `is_current = true`,
`checkpoint_payload = JSON.stringify({unsavedOperationStack})`, `checkpoint_source`,
`content_semantic_hash = sha256(checkpoint_payload)`), in one transaction on one pinned connection.
This is the SAME demote-then-INSERT ordering `reopenVersion()` already uses (the partial unique
index `uq_finance_wr_one_current` requires exactly this order within one transaction/connection —
verified against the real trigger by the integration test, not just asserted).

**On CAS mismatch: reject, do not overwrite.** If the current row's `working_revision_id` differs
from `expectedWorkingRevisionId`, `checkpointOperationStack` returns `{ok: false, state: 'CONFLICT',
code: 'WORKING_REVISION_CONFLICT', currentWorkingRevisionId, currentRevisionSeq}` and writes
NOTHING — verified by an integration test asserting the rejected write creates no stray row.

### 5.2 Sync/Saved/Conflict — explicit enum

`AutosaveStateValues = ['SYNCING', 'SAVED', 'CONFLICT'] as const` (task brief's own words, `SYNCING`
chosen over a bare `'SYNC'` as the more precise REST-enum-value name for "in flight"). Every
`checkpointOperationStack` result carries one of these; `peekAutosaveState()` offers a read-only,
non-writing poll of the same three states for a caller that wants to check status between debounced
flushes without forcing a write.

### 5.3 `checkpoint_source` — why a third column, not just `crash_recovery_checkpoint`

`crash_recovery_checkpoint` (already shipped, Gate C) answers "is this row a checkpoint, not an
explicit commit" — but `crashRecoveryService.ts` (section 6) additionally needs "what PRODUCED this
row" to find the most recent EXPLICIT_SAVE row to diff against, and `conflictResolver.ts` (section
7) needs to read back the actual `Operation`s a checkpoint captured. Neither is derivable from the
boolean alone. `checkpoint_source ∈ {AUTOSAVE, EXPLICIT_SAVE, CRASH_RECOVERY_RESTORE}` plus
`checkpoint_payload JSONB` (the serialized `unsavedOperationStack`) are the two additive columns
this work package's migration adds (section 3.2 below) — `crash_recovery_checkpoint` itself is set
mechanically from `checkpoint_source` (`true` for everything except `EXPLICIT_SAVE`), verified by
an integration test asserting an `EXPLICIT_SAVE` checkpoint is NOT flagged as a crash-recovery one.

### 5.4 `AutosaveScheduler` — debounce + hard max-wait cap

`notifyEdit()` resets a `debounceMs` timer (default 2000ms) on every local edit; a separate
`maxWaitMs` timer (default 15000ms) guarantees a flush even under continuous typing, so a debounce
window that keeps resetting can never postpone a save indefinitely — the SAME risk `OperationStack`'s
`maxDepth` bounds by entry count, this bounds by time, independently. `flushNow()` bypasses both for
an explicit save / navigation-away / `beforeunload` guard. Concurrent triggers (a `notifyEdit` firing
while a flush is already in-flight) coalesce into one re-run rather than two overlapping DB writes
racing. Pure — 7 unit tests in `__tests__/autosaveScheduler.test.ts` using `vi.useFakeTimers()`, no
Postgres.

---

## 6. CrashRecoveryService — detect, reconstruct, propose (never auto-restore)

`server/src/services/finance/collaboration/crashRecoveryService.ts`.

**Detection rule, traced against the real schema, not re-derived from prose:** because every
checkpoint write demotes the prior `is_current` row FIRST (section 5.1), the artifact's current
`is_current` row IS the newest working revision by construction. So "does a crash-recovery
checkpoint newer than the last explicit save exist" reduces to one question:
**is the CURRENT row itself a crash-recovery checkpoint** (`crash_recovery_checkpoint = true`)?
If yes, `detectRecoverableCheckpoint()` additionally reads back the most recent
`checkpoint_source = 'EXPLICIT_SAVE'` row (`ORDER BY revision_seq DESC LIMIT 1`) for context — the
"ostatni jawny save" the task brief compares against — and returns both to the caller. **This
function performs no write** — proposing recovery must never itself mutate state (task: "zaproponuj
odzyskanie, nie automatyczne nadpisanie"), verified by the fact its only DB statement is a `SELECT`.

**`reconstructOperationStack()` is pure** (no DB) — separate from detection so the "read from
Postgres" leg and the "rebuild an `OperationStack` from JSON" leg can each be measured
independently in the benchmark (section 6.1). One documented limitation: the recovered stack's
entries carry `priorValues: []` (empty), because `FinanceUnsavedOperationStackEntry` (the
`WorkspaceState` wire shape, AP-00 section 8) only ever serializes `{operation, appliedAt,
committed}` — `priorValues` is `OperationStack`'s own in-memory undo bookkeeping and was
deliberately never part of the wire contract AP-00 shipped. A crash-recovered stack can therefore
REPLAY forward (redo the pending edits against the reloaded grid) but cannot itself further undo
past the recovery point without the client re-deriving `priorValues` from the grid state it reloads
against. Documented in the function's own doc comment rather than silently fabricating empty
`FinanceValue`s that would produce a wrong undo if actually used.

**`acceptRecovery()`/`discardRecovery()`** — the two things a user can do with a recovery prompt,
both requiring an explicit caller invocation after the user's choice in the UI, neither automatic:
- `acceptRecovery` re-checkpoints the SAME payload under `checkpoint_source =
  'CRASH_RECOVERY_RESTORE'`. This advances `revision_seq` (so a second client racing to open the
  same artifact and also accept gets a normal `WORKING_REVISION_CONFLICT`, not a silent clobber)
  while correctly leaving `crash_recovery_checkpoint = true` — accepting a recovery resumes
  unsaved work, it does not itself constitute an explicit save.
- `discardRecovery` writes an `EXPLICIT_SAVE` checkpoint with an EMPTY operation stack — this is
  what actually clears `crash_recovery_checkpoint` back to `false`, verified by an integration test
  asserting `detectRecoverableCheckpoint` returns `recoverable: false` immediately after.

### 6.1 Benchmark — ≤5s, real ephemeral Postgres

Integration test `BENCHMARK: read + reconstruct a checkpoint with hundreds of operations completes
in <=5s` (`__tests__/collaboration.pg.test.ts`): writes a 500-`Operation` checkpoint via
`checkpointOperationStack`, then times `detectRecoverableCheckpoint()` (real `SELECT ... FOR UPDATE`
— actually a plain `SELECT`, read-only — against the ephemeral cluster) plus
`reconstructOperationStack()` (pure JS) together.

**Measured: 12ms** (against this work package's own ephemeral cluster, `initdb --locale=C`, own
port). 400x under the 5-second budget — expected, since the read is a single indexed row lookup
(`idx_finance_wr_artifact_checkpoint_source`, added by this work package's migration) plus one more
`SELECT` for the last-explicit-save row, and reconstruction is in-memory JSON→object mapping over
500 entries. No network/production-latency factor is modeled here (task instruction: measure on the
ephemeral Postgres, not staging/prod) — a production deployment would add real network RTT, but the
DB-side work itself has ~500x headroom against the 5s budget even before accounting for that.

---

## 7. ConflictResolver — mine/theirs/base, propose only

`server/src/services/finance/collaboration/conflictResolver.ts`.

**"base"** = `WorkspaceState.sourceWorkingRevisionId` (AP-00 section 8's own words: "the
workspace-level analogue of `Operation.sourceWorkingRevisionId`, used as the 'as of' pin for AP-04's
mine/theirs/base conflict resolution" — this ADR is that AP-04). **"theirs"** = every checkpoint
strictly between `base` and the artifact's CURRENT `is_current` working revision
(`revision_seq > baseSeq AND revision_seq <= currentSeq`), reconstructed from each intervening
row's `checkpoint_payload` — i.e. genuinely someone else's already-committed checkpoints, read back
from the DB, not guessed. **"mine"** = the calling user's own still-pending
`unsavedOperationStack`, supplied by the caller (never itself persisted server-side until it goes
through `checkpointOperationStack`).

**Detection**, `detectConflicts()`: builds a latest-write-per-`cellRefKey()` map for "theirs" (later
intervening checkpoints override earlier ones on the same cell — correct latest-write-wins
semantics) and the same projection for "mine" (`latestWritePerCell`, shared between both sides so
they are compared on equal footing), using `operationStack.ts`'s `operationIntendedValues()` for
both — one implementation, not two. A conflict exists for every `cellRefKey` present in BOTH maps.
`resultionOptions` is `['MINE', 'THEIRS', 'MERGE_PER_CELL']` only when BOTH sides resolved to a
concrete value; when either side is `null` (e.g. that side's pending op was a `reset`, whose
post-reset value is unknown without a further DB read — `operationIntendedValues`'s own documented
behavior), `MERGE_PER_CELL` is withheld — offering "merge" when one side is unresolvable would let
the UI construct a nonsensical merged value from a `null`.

**No auto-resolution, anywhere.** `detectConflicts()` only returns a structure
(`ConflictDetectionResult.conflicts: ConflictCandidate[]`) for the UI to render three choices per
conflicting cell. `buildResolvedOperation(conflicts, choices, mint)` is the ONLY thing that turns a
resolution into an `Operation`, and it REQUIRES the caller to have already collected the user's
explicit per-cell `choices` — it refuses (`MISSING_MERGED_VALUE`) rather than guessing when a
`MERGE_PER_CELL` choice lacks a supplied `mergedValue`, and refuses (`UNRESOLVABLE_CHOICE`) rather
than guessing when `MINE`/`THEIRS` points at a `null` candidate side. Both refusal paths are
covered by integration tests.

**If `baseWorkingRevisionId` is unknown to the artifact's history** (e.g. purged, or a client bug
supplying a foreign id), `detectConflicts` treats the WHOLE history as "theirs" (`baseSeq` defaults
to `0`) rather than failing closed — a documented judgment call, flagged in section 9 point 2, since
"treat everything as potentially conflicting" is the safer default for a concurrency guard than
silently skipping the scan.

---

## 8. ComputePinning — integration only, per task scope

`server/src/services/finance/collaboration/computePinning.ts`.

Per the task's own framing ("to juz czesciowo zaprojektowane w WP-B04, tutaj tylko integracja z
autosave/undo flow"): `computeJobService.enqueue()` already accepts `inputRevisionHash` and already
enforces `compute_job_outputs` uniqueness on `(organization_id, output_artifact_id,
content_semantic_hash)` (WP-B04, shipped, unmodified by this work package).
`enqueueComputeForCurrentRevision()` is the one integration call this ADR adds: read the artifact's
CURRENT `is_current` working revision's `content_semantic_hash` (which `checkpointOperationStack`,
section 5, is what actually keeps fresh as edits land) and pass exactly that into `enqueue()`.

**Verified by integration test, not just asserted:** a compute enqueued before any checkpoint exists
returns `NO_CONTENT_HASH` (nothing to pin to yet); after a checkpoint, the enqueued job's
`input_revision_hash` equals that checkpoint's `content_semantic_hash`; after a SECOND, later
checkpoint (simulating an edit landing after the first compute was requested), a second enqueue call
pins to a DIFFERENT hash, and the FIRST job's `input_revision_hash` is asserted unchanged — i.e. the
old, now-stale, hash-pinned result is never silently swapped for the new one, the task's own
"nie jest cicho podmieniany" requirement, machine-verified.

`computeJobService.ts` itself is not modified — zero lines changed in Gate C's canonical services.

---

## 9. Judgment calls / open questions flagged for the executive work package

None of these block accepting this ADR — all are `PROVISIONAL_PENDING_OWNER_DECISION`-class or
implementation-detail questions, same posture AP-00 section 10 and WP-D01 section 11 take for their
own open items:

1. **The domain-table apply executor (AP-00 ADR section 6.2) is still not implemented** — see
   section 2.3 above. `finance_stmt_lines` has no real migrated schema yet
   (`WP-D01_statements_schema_ADR.md` is DDL-sketch-only). Once a future work package ships that
   table for real, an executor needs to (a) actually UPSERT/DELETE domain rows when a batch is
   applied (today, `checkpointOperationStack` only persists the `Operation` STREAM, not its effect
   on domain data) and (b) decide how `OperationStack`'s undo/redo composes with that executor's own
   transaction boundary. This ADR's contract (one `Operation` = one checkpointed stack entry) does
   not need to change for that integration — the executor becomes an additional consumer that pops
   entries off the same stack — but the wiring itself is unbuilt.
2. **`conflictResolver.detectConflicts`'s "unknown base" fallback** (section 7, last paragraph) —
   treating the whole history as "theirs" when `baseWorkingRevisionId` is not found is a
   fail-safe-toward-more-conflicts choice, not verified against a specific product requirement for
   that edge case; flagged for confirmation.
3. **`checkpointOperationStack`'s `content_semantic_hash` is a hash of the checkpoint PAYLOAD**
   (the serialized `unsavedOperationStack`), not a hash of the domain-table VALUES those operations
   would eventually produce (which does not exist yet, per point 1). This is sufficient for this
   work package's own freshness/conflict/compute-pinning needs (detecting "did the working revision
   change" and "which compute ran against which snapshot"), but a future domain-value executor may
   need its OWN, semantically different `content_semantic_hash` derivation once `finance_stmt_lines`
   is real — whether these two hashes should be the same field or two different ones is an open
   question for that future work package, not resolved here.
4. **`OperationStack.redo()` does not re-validate `priorValues`** against the CURRENT state before
   replaying — if the cell being redone was ALSO touched by someone else's checkpoint in the
   meantime, a naive redo could silently overwrite their edit. In practice this is caught one layer
   up: any submitted redo `Operation` still goes through the normal executor's CAS check
   (`sourceWorkingRevisionId`, re-minted fresh by `redo()` itself, section 4) and, if the caller runs
   `conflictResolver.detectConflicts` first (recommended, not enforced by this contract), a genuine
   conflict on that cell would surface before the redo is submitted. This work package does not wire
   redo through `detectConflicts` automatically — flagged as a UX-flow decision for the frontend
   work package that actually wires the "Redo" button.

---

## 10. Verification performed

- **`tsc --noEmit`**, scoped `include` list (temporary tsconfig extending the real, unmodified
  `server/tsconfig.json`, six new files + AP-00 files + canonical services + `PostgresDatabase.ts`
  they import from): **zero errors**, exit code `0`.
- **`esbuild --bundle`, one file at a time** (`pg`/`uuid`/`zod` external): all six files bundle
  cleanly.
- **29 pure unit tests** (`operationStack.test.ts` 22, `autosaveScheduler.test.ts` 7) — run with
  `DATABASE_URL` UNSET entirely, confirming zero DB dependency, per the task's own "unit:
  OperationStack logika bez DB" split.
- **13 real-PostgreSQL integration tests** (`collaboration.pg.test.ts`) — against this work
  package's own ephemeral cluster (`initdb --locale=C`, data directory
  `/private/tmp/finance-v3-ap04-pgdata-<pid>-<random>`, port in the 55000-59999 range verified free
  with `lsof` before use, `listen_addresses=127.0.0.1` only), running the project's real migration
  runner (`server/scripts/migrate.postgres.ts`) — all 88 migrations applied, 0 skipped, 0 errors
  (no `--safe`). Cluster stopped (`pg_ctl stop -m fast`) and data directory removed at the end of
  this work package; `ps aux` re-checked immediately after — only the shared local Postgres (PID
  911, untouched throughout) remained.
- **Run twice consecutively** (all `collaboration/` tests together, `--no-file-parallelism`) to
  confirm idempotency of the suite itself: 42/42 both times.
- **The ≤5s crash-recovery benchmark measured 12ms** (section 6.1).
- **`computePinning`'s "old result never silently swapped" guarantee is asserted, not just
  described**: the integration test reads back the FIRST enqueued job's `input_revision_hash` AFTER
  a second, later checkpoint and asserts it is unchanged (section 8).
- No `npm run type-check` / full-project `tsc` was run — same reasoning as AP-00 ADR section 9 (pulls
  in pre-existing unrelated red elsewhere in the repo, out of scope to fix here).

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/finance_v3_ap04 \
npx vitest run --config vitest.config.ts src/services/finance/collaboration --no-file-parallelism

 Test Files  3 passed (3)
      Tests  42 passed (42)
```

---

## 11. Traceability

| Task scope item | Section of this ADR | File(s) |
|---|---|---|
| 1. OperationStack (append-only, undo/redo pointer, min-50 configurable depth, atomic bulk/paste undo) | §4 | `operationStack.ts` |
| 2. AutosaveService (debounced checkpoint to `finance_working_revisions`, `crash_recovery_checkpoint=true`, Sync/Saved/Conflict enum) | §5 | `autosaveService.ts`, `autosaveScheduler.ts` |
| 3. Crash recovery (detect newer-than-last-explicit-save, propose not auto-restore, ≤5s benchmark) | §6, §6.1 | `crashRecoveryService.ts` |
| 4. ConflictResolver (mine/theirs/base, base_revision_id vs current, propose structure with mine/theirs/merge-per-cell) | §7 | `conflictResolver.ts` |
| 5. Compute pinned to revision hash (integration with `computeJobService`, autosave/undo flow) | §8 | `computePinning.ts` |
| 6. Tests: unit (OperationStack, no DB) + integration (autosave/crash-recovery/conflict, ephemeral Postgres) | §10 | `__tests__/operationStack.test.ts`, `__tests__/autosaveScheduler.test.ts`, `__tests__/collaboration.pg.test.ts` |
| Hard rule: use `finance_working_revisions`, do not build a parallel mechanism | §2.1, §5.1 | — |

---

## Appendix — files delivered

```
server/migrations/20260809_finance_v3_d_ap04_autosave_checkpoints.sql   (additive: checkpoint_payload, checkpoint_source)
server/src/services/finance/collaboration/operationStack.ts
server/src/services/finance/collaboration/autosaveScheduler.ts
server/src/services/finance/collaboration/autosaveService.ts
server/src/services/finance/collaboration/crashRecoveryService.ts
server/src/services/finance/collaboration/conflictResolver.ts
server/src/services/finance/collaboration/computePinning.ts
server/src/services/finance/collaboration/__tests__/operationStack.test.ts
server/src/services/finance/collaboration/__tests__/autosaveScheduler.test.ts
server/src/services/finance/collaboration/__tests__/collaboration.pg.test.ts
docs/validation/finance-v3/generated/gate-d/AP-04_undo_autosave_conflicts_ADR.md   (this file)
```

No existing file was modified. `finance_working_revisions` gained two additive columns via one new
migration (`checkpoint_payload JSONB`, `checkpoint_source TEXT`) plus one new partial index — no
column was renamed, dropped, or had its type changed. No demo/staging/prod database, of any kind,
was connected to during this work package.
