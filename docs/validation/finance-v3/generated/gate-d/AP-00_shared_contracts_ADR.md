# ADR AP-00 — Shared Analyst Productivity Contracts (Gate D / Fala 3)

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`, section 5 (Analyst
Productivity i UX), AP-00. Also `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
section 10 (Stanowisko analityka).
**Work package:** AP-00 — first Analyst Productivity package, a prerequisite for AP-01 (Finance Data Grid) and
every future module adapter (AP-10) that will read/write Finance domain tables through it.
**Data:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `ADR — TypeScript contract, syntax- and type-checked with `tsc`/`esbuild` against the real repo
tsconfig and the real, already-shipped `lifecycleService.ts`. No database connection was made. No executor,
no HTTP route, no migration is implemented — this is the contract WP-D01 was for Statements' schema, one layer
up the stack.`

---

## 1. Inputs read, in this order

1. `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` section 5 (AP-00 through
   AP-11) and section 2.4 (Wartości finansowe — `PRESENT_ZERO/PRESENT_NONZERO/MISSING/NA/NOT_APPLICABLE`).
2. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 10 (Stanowisko
   analityka — Finance Data Grid target 10k×120, ≥45 FPS, input p95<100 ms, 1000-cell paste atomic; Excel
   round-trip; keyboard; undo/drafts/conflicts; compare; review; saved views/exception inbox; "Why this
   number?").
3. `docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md`, full text — `finance_stmt_lines`
   is the first real consumer this contract must address without change, especially section 4.5 (`finance_stmt_lines`
   columns and `uq_finance_stmt_lines_cell`) and section 2.1/2.3/3 (what Gate B/C already ships, so this ADR does
   not re-derive it).
4. `docs/validation/finance-v3/generated/gate-c/WP-C02_compatibility_services_report.md`, full text — the five
   already-shipped canonical services (`artifactVersionService.ts`, `lifecycleService.ts`, `lineageService.ts`,
   `computeJobService.ts`, `exceptionLedgerService.ts`) and their `{ ok: true/false }` result convention, CAS
   (`expectedVersion`/`If-Match`) pattern, and idempotency-key handling — AP-00 reuses these conventions rather
   than inventing new ones.
5. Additionally (not listed in the task brief, but required for internal consistency, per the same discipline
   WP-D01 section 1 point 5 applied): `server/migrations/20260809_finance_v3_b01_core_artifacts.sql` (real,
   tested DDL — `finance_artifacts.artifact_type` CHECK, `finance_working_revisions` shape),
   `server/src/services/finance/canonical/artifactVersionService.ts` and `lifecycleService.ts` (real code, not
   just their ADRs), `server/src/routes/v8/finance-v2/models.routes.ts` (the one existing `/api/v8/finance-v2/*`
   router, for HTTP contract conventions), and three existing repo patterns for "how does this codebase already
   do typed-contract + Zod": `server/src/types/contextSnapshot.ts`, `server/src/types/operationContract.ts`, and
   `server/src/services/tablePlatform/TableAiEditorLevels/operations.ts` (the closest existing prior art to an
   "Operation" discriminated union in this codebase).

---

## 2. Context

### 2.1 What Gate B/C/D01 already give — not duplicated here

- `finance_artifacts` / `finance_business_versions` / `finance_working_revisions` (WP-B01, shipped) — AP-00's
  `ArtifactRef` addresses these by `artifactId`/`businessVersionId`; it does not re-model lifecycle, which
  already lives in `lifecycleService.ts` (`BusinessVersionStatus`, `FinanceRole`, `TRANSITIONS`).
- `finance_value_status` ENUM and the mandatory value-cell column bundle (WP-B01 section 2.7, adopted verbatim
  by `finance_stmt_lines`, WP-D01 section 4.5) — AP-00's `financeValueSemantics.ts` is a TypeScript mirror of
  this exact bundle, not a new value model.
- `finance_stmt_lines` and its stable canonical cell key `uq_finance_stmt_lines_cell` (WP-D01 section 4.5) —
  AP-00's `CellRef` is designed to map onto this constraint exactly (section 5 below), not to invent a
  different addressing scheme the executor would then have to reconcile.
- `artifactVersionService.approveVersion`/`reopenVersion`, `lifecycleService.resolveExpectedVersion` (WP-B02,
  shipped) — AP-00's `Operation`/batch contract reuses the same CAS (`expectedVersion`/`If-Match` →
  `sourceWorkingRevisionId`/`expectedWorkingRevisionId`) and idempotency-key conventions rather than inventing
  a second concurrency model for content mutations.

### 2.2 What AP-00 adds

Nothing in Gate B/C/D01 defines: (a) a portable way to name an artifact across the five (soon six) Gate D
domain packages, (b) a portable way to address one cell inside a domain table's grid, (c) a portable mutation
envelope the Finance Data Grid (AP-01) can emit regardless of which domain table it is currently rendering, (d)
what the frontend persists per open artifact for crash recovery, or (e) a machine-readable way to ask "what am
I allowed to do to this artifact right now". These five gaps are exactly AP-00's task-brief scope items 1-6,
plus batch/idempotency (item 7). This ADR closes them with TypeScript interfaces + Zod runtime validators, not
a database migration — there is no new table in this work package.

---

## 3. Decision — five files, `server/src/types/finance/`

| File | Exports | Task scope item |
|---|---|---|
| `financeValueSemantics.ts` | `FinanceValueStatus`, `FinanceUnit`, `FinanceArtifactFreshness`, `FinanceValue`, `FinanceValueObjectSchema`/`FinanceValueSchema`, `toArithmeticOperand()` | 5 |
| `ArtifactRef.ts` | `FinanceArtifactType`, `ArtifactRef` (discriminated union), `parseArtifactRef()`, `artifactRefKey()` | 1 |
| `CellRef.ts` | `FinanceTableName`, `CellRowKey`/`CellColumnKey` (discriminated unions), `CellRef`, `cellRefKey()`, `financeStmtLinesCellRef()` | 2 |
| `Operation.ts` | `Operation` (discriminated union: `set`/`clear`/`paste`/`bulk_set`/`reset`), `ApplyOperationsBatchRequest`/`Result`, `FinanceCapabilitiesResponse`, `isContentMutableStatus()` | 3, 6, 7 |
| `WorkspaceState.ts` | `FinanceWorkspaceState`, `createEmptyWorkspaceState()`, `parseWorkspaceState()` | 4 |

**Location decision (task asked to check repo convention first):** `grep` across `src/` and `server/src/` found
**zero** cross-project type imports — `tsconfig.json` (frontend) and `server/tsconfig.json` (backend) are two
fully separate TypeScript projects, each with its own `@/*` alias resolving to its own `src/`, and no shared
`packages/`-style types module exists anywhere in the repo. Every prior Finance v3 type contract (Gate B/C/D01)
lives exclusively in `server/src/types/` or `server/src/services/finance/canonical/`. AP-00 follows that
existing, exclusive convention: all five files live in `server/src/types/finance/` (backend-only). **This is a
documented consequence, not a decision this ADR is free to reverse silently:** AP-01 (Finance Data Grid,
frontend) will need its own mirrored copy of these types when it lands, the same way every other
frontend/backend pair in this repo is already duplicated rather than shared. AP-00's actual cross-boundary
contract is the HTTP capability/batch-mutation JSON shape (section 7 below), not a shared `.ts` import — that
is the correct boundary in a repo with this convention, not a gap.

All five files were type-checked with the project's own `server/tsconfig.json` (strict mode, `noImplicitAny`,
etc.) via a scoped include list (5 new files + the one existing file they import from,
`lifecycleService.ts`) — **zero errors**, and separately bundle-checked per-file with `esbuild` — see section 9.

---

## 4. ArtifactRef — typed reference to any Finance artifact

`server/src/types/finance/ArtifactRef.ts`. Discriminated union on `artifactType`, base fields
`organizationId`/`artifactId`/`businessVersionId`/`naturalKey`.

**Judgment call — six canonical values, not the task brief's five lowercase names.** The task brief lists
`statement_pack/analysis/baseline_model/scenario/valuation`. Cross-checked against the real, already-shipped
`finance_artifacts.artifact_type` CHECK constraint
(`server/migrations/20260809_finance_v3_b01_core_artifacts.sql` lines 46-49) and
`lifecycleService.ts`'s `FinanceArtifactType`: the real enum has **six** values —
`STATEMENT_PACK`/`HISTORICAL_ANALYSIS`/`BASELINE_MODEL`/`PREDICTION_SCENARIO`/`VALUATION_CASE`/`REPORT_EXPORT`
— and none of them is spelled the way the task brief spells it. `ArtifactRef.artifactType` uses the real,
shipped six-value enum, because a five-value contract using invented spellings would be unable to address
(a) any already-existing `REPORT_EXPORT` artifact, and (b) any row already written by Gate C, without a
translation layer this ADR would then have had to invent and maintain. `ArtifactRef.ts` includes a
compile-time assertion (`_artifactTypeSyncCheckA`/`B`) that its locally-declared literal union stays
structurally identical to `lifecycleService.ts`'s independently-declared one — this passed `tsc`, confirming
the two are in sync today; if a future edit to either drifts, one of the two assignments stops compiling
instead of failing silently at runtime.

**Why every branch is currently identical in shape:** only WP-D01 (Statements) has a shipped domain schema.
WP-D02 (Analysis), WP-D03 (Baseline Models), WP-D04 (Prediction), WP-D05 (Valuation) have not been designed
yet. Pre-inventing type-specific `ArtifactRef` fields for them (e.g. a `PredictionScenarioArtifactRef`
carrying `scenarioKind: 'BASE'|'UPSIDE'|'DOWNSIDE'`) would be exactly the "przedwcześnie rozszerzyłoby zakres"
mistake WP-D01 section 10.4 documents rejecting for its own roll-forward generalization. The discriminated
union exists so each branch **can** grow independently later without a breaking change to any exhaustive
`switch (ref.artifactType)` written against today's contract — not to pre-design fields those future ADRs
haven't committed to.

---

## 5. CellRef — addressing one cell in any domain table

`server/src/types/finance/CellRef.ts`. Fields: `organizationId`, `businessVersionId`, `tableName` (enum),
`rowKey`, `columnKey` (both discriminated unions on `tableName`), `period` (nullable, denormalized convenience
projection).

**Exact mapping onto `finance_stmt_lines`'s real constraint** (WP-D01 section 4.5):

```
UNIQUE (business_version_id, entity_id, canonical_line_id, period_id, accumulation_basis, consolidation_scope)
        ^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        CellRef.businessVersionId    rowKey {entityId, canonicalLineId, consolidationScope}   columnKey {periodId, accumulationBasis}
```

This is a deliberate departure from a literal `{row_key: string, column_key: string}` pair: `finance_stmt_lines`'
real uniqueness needs **four** dimensions beyond `business_version_id` (entity, line, period, basis, scope — five,
actually), not two. Folding all of them into two opaque strings would force every caller to invent and parse an
ad-hoc composite-string format (`"entityId::lineId::scope"`), which is exactly the kind of stringly-typed
addressing this whole contract exists to avoid. `rowKey`/`columnKey` are therefore small, table-specific,
strongly-typed objects — still exactly two dimensions from the *grid's* point of view (one row axis, one column
axis), just each axis is itself composite for this table.

**`period` is a separate, denormalized field, not derived from `columnKey` by callers.** AP-05 (Compare) and
AP-01's freeze/find-by-period features need "what period is this cell in" without knowing every table's
`columnKey` shape — `period` (`{periodId, accumulationBasis}` today) is the table-agnostic answer to that one
question. It is `null`-typed at the `CellRef` level (task: "period jeśli dotyczy") for a future table whose grid
has no period axis at all (none exists yet — `finance_stmt_lines` always populates it).

**Extensibility proof (task requirement: works for `finance_analysis_kpi_values` "bez zmiany kontraktu"):**
adding a table is: (1) append one literal to `FinanceTableNameValues`, (2) add one new
`z.object({tableName: z.literal('finance_analysis_kpi_values'), ...})` branch to each of `CellRowKeySchema`
and `CellColumnKeySchema`. `CellRef`'s own five fields, and every consumer that only reads `businessVersionId`/
`tableName`/`period` (e.g. AP-05's Compare, AP-08's exception deep links), do not change. A consumer that reads
`rowKey`/`columnKey` contents (i.e. the executor, or a table-specific cell renderer) uses a `switch
(ref.tableName)` the TypeScript compiler will flag as non-exhaustive the moment a new branch is added elsewhere
without a matching case — the discriminated union buys real safety here, not just documentation value.

**Canonical string key** (`cellRefKey()`) exists because AP-01's target (10k×120 = up to 1.2M logical cells)
needs an O(1) map key for its virtualized grid and for batch-level duplicate-target detection
(`findDuplicateTargetsInBatch` in `Operation.ts`) — this directly implements the phrase WP-D01 section 4.5 uses
about its own DB constraint: "stabilny kanoniczny klucz komórki wymagany przez Finance Data Grid".

---

## 6. Operation — typed mutation, and its mapping onto `finance_working_revisions`

`server/src/types/finance/Operation.ts`. Discriminated union on `type`, five verbs per the task brief.

### 6.1 Why five verbs are not four with parameters

| `type` | targets | values | effect |
|---|---|---|---|
| `set` | 1 `CellRef` | 1 inline | write one value to one cell |
| `bulk_set` | N `CellRef[]` | 1 inline, shared | write the **same** value to every targeted cell |
| `paste` | N `CellRef[]` | N, aligned by index | write a **different** value per cell (rectangular paste) |
| `clear` | N `CellRef[]` | none | force `value_status` → `MISSING` (delete the value) |
| `reset` | N `CellRef[]` | none (`strategy` enum) | discard local Draft edits, restore the **parent business_version's** value |

`clear` and `reset` are not sugar for each other, despite both taking no inline value. `clear` always produces
`MISSING` — the analyst is asserting "I don't have this fact". `reset` restores whatever the **parent**
`business_version` already had for that cell before this Draft's local edits — the analyst is asserting "undo
my edit, not the underlying fact". This is the per-cell counterpart of the whole-version copy-on-write reopen
already performs (WP-D01 section 6: content is version-scoped by `business_version_id` specifically so a
reopen "może skopiować treść z vN do vN+1... a nie wymuszała przebudowy"). `reset.strategy` is a one-element
enum (`'TO_PARENT_VERSION_VALUE'`) today rather than a bare boolean, deliberately: it is the extension point
for a future second baseline (e.g. "reset to the pre-restatement original" once WP-D01's `RESTATEMENT_CARRY`
mechanics are exposed to the grid) without breaking this contract's shape.

### 6.2 Mapping onto `finance_working_revisions` — one batch, one checkpoint

Traced against the real, shipped code (`artifactVersionService.reopenVersion`, section 6.2 steps in that
function's own doc comment) rather than re-deriving from prose: applying one `ApplyOperationsBatchRequest` is
intended to execute as **one Postgres transaction** that:

1. `SELECT ... FOR UPDATE` the target `business_version_id`, reject unless `status IN ('DRAFT',
   'NEEDS_CHANGES')` — content tables are physically immutable once `APPROVED`
   (`finance_stmt_lines_enforce_parent_immutability`, WP-D01 section 4.5) — this is `isContentMutableStatus()`
   in `Operation.ts`, the one rule this contract hardcodes because it is a DB trigger invariant, not a policy
   choice (see section 7).
2. Apply every `Operation` in the batch as an UPSERT (or, for `clear`, an UPDATE setting `value_status =
   'MISSING'`) against whichever table each `CellRef.tableName` names, keyed by that table's own stable
   canonical key (`uq_finance_stmt_lines_cell` for `finance_stmt_lines`).
3. Demote the current `finance_working_revisions.is_current = true` row and `INSERT` a new one
   (`revision_seq + 1`, `crash_recovery_checkpoint = true`, freshly-computed `content_semantic_hash`) — the
   exact demote-then-`INSERT` pattern `reopenVersion()` (lines 700-729 of `artifactVersionService.ts`) already
   uses for working revisions, reused rather than re-invented.
4. Roll back the **entire transaction** on any single operation's failure — "atomowe zastosowanie (wszystko
   albo nic)" (task brief) becomes literal Postgres transaction atomicity, the same guarantee `approveVersion()`
   already gives its four ordered steps (WP-C02 report section 2.1).

**This ADR does not implement that executor.** Per the task's hard prohibition on touching a database, and
per WP-D01's own precedent of leaving its backfill executor to a future WP-C03-like package (WP-D01 section
11 point 3), the above is the traced, documented CONTRACT the executor must satisfy — a future Gate D
executive work package implements it against real Postgres.

### 6.3 Two idempotency keys, not one

`Operation.idempotencyKey` identifies **one** operation (audit/replay grain, mirrors
`artifact_lifecycle_events.idempotency_key`, WP-B02). `ApplyOperationsBatchRequest.batchIdempotencyKey`
identifies the **whole HTTP request** — a retried POST of an identical batch must be a no-op replay even if a
client bug regenerated fresh per-operation `operationId`/`idempotencyKey` values on the retry. This two-key
design is a judgment call the master plan does not resolve explicitly (it says "idempotency_key na poziomie
batcha" — singular, batch-level — but AP-04's own per-operation audit trail needs a stable per-operation
identity too); flagged in section 10 as something the executive work package should confirm rather than this
ADR unilaterally deciding is final.

### 6.4 `1000`-cell hard cap

`ApplyOperationsBatchRequestSchema.operations` is `z.array(...).min(1).max(1000)` — a literal encoding of the
master plan's "1000-cell paste jako jedna transakcja" benchmark, not a soft guideline. A caller (AP-01) needing
to paste more than 1000 cells must chunk into multiple batches; this contract does not attempt cross-batch
atomicity for that case (out of scope — the master plan's own benchmark is stated at exactly 1000 cells).

---

## 7. Capability endpoint

`GET /api/v8/finance-v2/capabilities/:artifactType?businessVersionId=...` (task brief's literal path).
Response shape: `FinanceCapabilitiesResponse` in `Operation.ts`.

**Why `businessVersionId` is an optional query parameter, not baked into the path:** capability truthfully
depends on live state (`business_version.status`) and the calling actor's role, neither of which the path
segment `:artifactType` alone carries — but the task brief specifies the path literally as
`/capabilities/:artifactType`. Reconciling both: `:artifactType` selects **which capability rule-set/schema**
applies (different artifact types may eventually have different maker-checker rules once WP-D02..D05 exist);
`businessVersionId` is optional and switches the response between two modes:

- **omitted** → "type-level schema" response (`businessVersionId`/`businessVersionStatus`/`actorRole` all
  `null`): which of the five `Operation` types this artifact type supports **at all**, ignoring live state.
  Lets the UI decide which toolbar buttons to even render before any specific version is loaded.
- **supplied** → "live" response: the actual allow/deny per operation for **this** `businessVersionId`'s
  current status and the calling actor's role.

`FinanceCapabilitiesResponse.capabilities` is **always** all five `OperationTypeValues`, each with an explicit
`allowed: true|false` — never a sparse list — so the frontend never needs a client-side default-deny fallback
for an operation the response happened to omit. This is a defensive design choice: a sparse "only list what's
allowed" response is the kind of contract where a backend bug (silently omitting a should-be-denied operation)
fails open instead of closed; an always-complete list makes "missing from the response" a schema violation the
Zod parse itself catches, not a silent security gap.

**One hardcoded rule, deliberately, not a full rule engine:** `isContentMutableStatus()` — `DRAFT`/
`NEEDS_CHANGES` mutable, everything else not — because that is a physical DB trigger invariant already shipped
(`finance_stmt_lines_enforce_parent_immutability`), not a policy this ADR would be inventing. The task brief's
own example ("Approved statement_pack nie pozwala na 'set', tylko na 'read'") is exactly this rule. Every other
allow/deny nuance (role matrix per artifact type, `NEEDS_CHANGES` vs `DRAFT` differences, archived-artifact
handling) is left to the future capability service implementation, per the task's own scope instruction
("kontrakt response, nie pełna implementacja wszystkich reguł").

---

## 8. WorkspaceState — frontend crash-recovery serialization contract

`server/src/types/finance/WorkspaceState.ts`. Per task instruction, this ADR references AP-04 (Undo, autosave
i conflicts) rather than designing its undo-stack/conflict-resolution algorithm — `FinanceWorkspaceState` only
guarantees everything AP-04 will need to reconstruct a workspace after a crash is representable and
round-trips through JSON-serializable storage.

Two size-control decisions, both driven by AP-01's 10k×120 (up to 1.2M logical cells) target making "serialize
everything" a correctness-AND-performance bug against the master plan's own "≤5 s crash recovery" budget:

1. **Selection stores range corners only** (`FinanceGridRangeSelection { topLeft, bottomRight }`), never every
   selected `CellRef` — the Excel-selection-is-two-corners pattern. `CellRef` has no universal "next cell"
   ordering this contract can define generically (each table's `rowKey`/`columnKey` is table-specific), so the
   corners are an opaque pair whose interpretation belongs to AP-01's own grid layout; `WorkspaceState` only
   needs to round-trip the pair, not understand it.
2. **Filters are opaque JSON** (`{ raw: Record<string, unknown> }`) — AP-07 (Filters/saved views, P1) has not
   been designed yet and owns the real filter model; this file only guarantees whatever AP-07 eventually
   produces survives a crash-recovery round trip, rather than this ADR pre-inventing AP-07's contract (same
   "don't design what a future work package owns" discipline as ArtifactRef's identical branches, section 4).

`schemaVersion` (currently `1`, a literal) is `FinanceWorkspaceState`'s **own** version, independent of
`engine_manifest_id`/`business_version_id` — `parseWorkspaceState()` checks it first and returns a distinct
`UNSUPPORTED_SCHEMA_VERSION` code before attempting a full Zod parse, so a stale persisted blob from a previous
deploy is detected and can be discarded-and-recreated rather than crashing the crash-recovery path itself.

`unsavedOperationStack` reuses `Operation` from section 6 directly (not a parallel "pending edit" type) — a
locally-applied-but-not-yet-committed edit and a to-be-submitted batch operation are the same shape, by design;
`committed: boolean` is the only field distinguishing "applied locally, awaiting server confirmation" from
"already round-tripped".

---

## 9. Verification performed

Per the task's hard prohibition on connecting to any database, and its instruction to verify compilation with
`esbuild`/`tsc` on a single file rather than the full project:

- **`esbuild --bundle`, one file at a time**, `zod` marked external (only real runtime dependency): all five
  files bundle cleanly (`financeValueSemantics.ts` 3.5kb, `ArtifactRef.ts` 2.3kb, `CellRef.ts` 3.0kb,
  `Operation.ts` 11.7kb, `WorkspaceState.ts` 15.8kb) — proves syntax correctness and that every relative import
  resolves.
- **`tsc --noEmit`, scoped `include` list** (a temporary tsconfig extending the real, unmodified
  `server/tsconfig.json` — same `strict`, `noImplicitAny`, `strictNullChecks`, etc. — with `include` limited to
  the five new files plus the one existing file they import from, `lifecycleService.ts`, so the real
  already-shipped type this contract depends on is checked against, not a hand-copied stub): **zero errors**,
  exit code `0`. This is stronger evidence than `esbuild` alone (which does not type-check) — it proves the
  `FinanceArtifactType` sync-check assertion in `ArtifactRef.ts` (section 4) actually holds against the real
  `lifecycleService.ts` today, not against an assumption about it.
- No `npm run type-check` / full-project `tsc` was run (would pull in the rest of the repo, including files
  unrelated to this work package, some of which the project's own memory notes are pre-existing red — out of
  scope to fix here and would not have added information about these five new files).

---

## 10. Judgment calls / open questions flagged for the executive work package

None of these block accepting this ADR as a contract — all are `PROVISIONAL_PENDING_OWNER_DECISION`-class or
implementation-detail questions this ADR does not resolve unilaterally, per `DEC-FIN-012`, the same posture
WP-D01 section 11 takes for its own open items:

1. **`ArtifactRef.artifactType`'s six real values vs. the task brief's five invented names** (section 4) — this
   ADR resolved it by using the real, shipped DB enum; flagged here in case the five-name list was actually
   signaling an intent to retire `REPORT_EXPORT` from Finance v3's addressable surface, which would be a
   product decision this ADR does not have standing to make.
2. **Two idempotency keys (operation-level + batch-level)** (section 6.3) — confirm with the executive work
   package whether both are needed or the master plan's "idempotency_key na poziomie batcha" (singular) means
   only the batch-level key should exist, with `Operation.idempotencyKey` demoted to a plain `operationId`.
3. **`unsavedOperationStack` has no max-length/eviction policy** — an analyst who leaves a Draft open with
   network connectivity issues for an extended session could accumulate an unbounded stack, which risks
   breaching the "≤5 s crash recovery" budget this contract exists to protect. This ADR does not set a bound
   because the master plan does not specify one; the executive AP-04 work package should decide (e.g. force a
   checkpoint/flush after N uncommitted operations).
4. **`FinanceValueInput`'s currency/unit/multiplier inheritance rule when omitted** (section 6.1's `set`/
   `bulk_set`/`paste` payload) — this contract defines the input as optional-with-fallback but does not specify
   *what* the executor inherits from (the existing cell on UPDATE vs. entity/version defaults on INSERT);
   flagged for the executor work package, not resolved here.
5. **Capability rule matrix beyond the one hardcoded DB-trigger rule** (section 7) — role-per-artifact-type,
   `NEEDS_CHANGES` nuances, archived-artifact handling are unimplemented by design (task scope: contract only).

---

## 11. Alternatives considered (rejected)

### 11.1 `CellRef.rowKey`/`columnKey` as flat strings instead of typed objects

Considered: `rowKey: string` / `columnKey: string`, with each domain table defining its own string-composition
format (e.g. `"entityId::lineId::scope"`).

**Rejected:** `finance_stmt_lines`' real key has five dimensions beyond `business_version_id`; a flat-string
format pushes parsing/composition logic into every single caller (executor, grid renderer, AP-05 Compare) and
reintroduces exactly the "stringly-typed addressing" failure class this whole contract exists to eliminate —
a malformed separator or wrong field order would fail silently at the string level instead of at `tsc`'s
level. The chosen discriminated-object design keeps the same two-axis (row/column) shape the Grid needs while
preserving per-field type safety.

### 11.2 A single `idempotencyKey`, not two

Considered: one key on `ApplyOperationsBatchRequest` only, with each `Operation.operationId` doing double duty
as its own dedup key.

**Rejected (with the caveat in section 10.2 that this remains open):** collapsing the two removes the
audit-grain distinction WP-B02's own `artifact_lifecycle_events.idempotency_key` establishes at the
single-event level — an `Operation` inside a batch is conceptually one event, and losing its own stable
identity would make later per-cell "why did this change" queries (task brief's own "Why this number?"
requirement, master plan section 10) harder to trace back to a specific mutation attempt versus a specific
delivery attempt.

### 11.3 `ArtifactRef` importing `FinanceArtifactType` at runtime from `lifecycleService.ts` instead of re-declaring it

Considered: `import { FinanceArtifactTypeValues } from '../../services/finance/canonical/lifecycleService.js'`
directly, eliminating any duplication risk.

**Rejected:** `lifecycleService.ts` exports `FinanceArtifactType` as a plain TypeScript union type, not a
`readonly [...] as const` array — there is no runtime array to import and derive a `z.enum(...)` from without
first modifying that already-shipped Gate C file, which is out of this ADR's allowlist (Gate C files are
frozen candidate-SHA artifacts per the program's own "clean candidate SHA" discipline, `CLAUDE.md` "HIGIENA
WYKONANIA"). The chosen alternative — re-declare the same six literals locally, with a compile-time structural
assertion tying the two together (section 4) — gets the drift protection without touching a frozen file. A
follow-up work package could refactor `lifecycleService.ts` to export a const array and let `ArtifactRef.ts`
import it, eliminating the duplication entirely; not done here.

---

## 12. Traceability

| Task scope item | Section of this ADR | File |
|---|---|---|
| 1. ArtifactRef (typed ref, discriminated union by artifact_type) | §4 | `ArtifactRef.ts` |
| 2. CellRef (addresses `finance_stmt_lines`, extensible without contract change) | §5 | `CellRef.ts` |
| 3. Operation (set/clear/paste/bulk_set/reset, payload/actor/idempotency_key/target CellRef[], mapping to `finance_working_revisions` checkpoint) | §6 | `Operation.ts` |
| 4. WorkspaceState (selection/filters/scroll/unsaved op stack, crash-recovery serialization, AP-04 referenced not designed) | §8 | `WorkspaceState.ts` |
| 5. Common missing/value/freshness semantics module, consistent with WP-D01 | §2.1, §6.1 (via `financeValueSemantics.ts`) | `financeValueSemantics.ts` |
| 6. Capability endpoint contract (`GET .../capabilities/:artifactType`) | §7 | `Operation.ts` |
| 7. Batch mutations + idempotency, atomic all-or-nothing, maps to one Postgres transaction | §6.2, §6.3, §6.4 | `Operation.ts` |
| Hard prohibition: no DB connection; esbuild/tsc single-file verification only | §9 | — |

---

## Appendix — files delivered

```
server/src/types/finance/financeValueSemantics.ts
server/src/types/finance/ArtifactRef.ts
server/src/types/finance/CellRef.ts
server/src/types/finance/Operation.ts
server/src/types/finance/WorkspaceState.ts
docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md   (this file)
```

No existing file was modified. No migration file was created or altered. No database, of any kind
(production, demo, dev, or ephemeral), was connected to during this work package.
