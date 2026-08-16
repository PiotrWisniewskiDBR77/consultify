# EXE-FLOW-ADAPTER-001 — Execution↔Initiative↔Results flow contracts

Lane B (Sonnet executor), closure lane B. Worktree
`/Users/piotrwisniewski/Developer/consultify-closure-claude-b`, HEAD
`64f507859c717494ffa5e83fae550173c9382230`.

Scope discipline: this document makes **no source edits**. Every finding below
is either a direct file citation (`path:line`) from this worktree, or is
marked `NOT_VERIFIED` where I could not confirm it in the time available.
Where the task brief's background reported a gap or a fact, I re-derived it
independently against the live tree rather than trusting the brief — see the
per-claim verification notes.

---

## 0. Lease check (gate for everything below)

Command run verbatim, against this worktree:

```
for L in A B C; do jq -r '.files[]' docs/cleanup/agents/generated/CLAUDE_LANE_${L}_PATH_LEASE.json; done
jq -r '.files[]' docs/cleanup/agents/generated/CODEX_INTEGRATOR_PATH_LEASE.json
```

Result: **`server/src/services/closureDeliveryReceiptService.ts` appears in
NONE of the four lease files** (Lane A, B, C, or the Codex integrator). Same
result for `server/migrations/935_exe009_closure_delivery_receipt.sql` and for
`server/src/index.ts` and `server/src/services/demo/demoSeedService.ts`
(also unowned by any of the four leases).

Confirmed owned files relevant to this packet, for contrast:
- `server/src/services/executionResultsBridge.ts` and its test — **Lane B**.
- `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts`
  (the `ie_outbox_events` writer) — **Lane B**.
- `server/src/services/caseWorkspace/**` (incl. `outboxWorker.ts`,
  `eventOutboxService.ts` is not itself listed by that exact path in the B
  lease excerpt captured, but the whole `caseWorkspace/**` service tree is —
  see raw lease dump) — **Lane B**.

**Consequence, per the four-branch contract**: Lane B cannot touch
`closureDeliveryReceiptService.ts`, its migration, `server/src/index.ts`, or
`demoSeedService.ts`. Every fix identified against those files below is
filed as an `INTEGRATOR_CHANGE_REQUEST` in §4, not implemented.

---

## 1. Deliverable 1 — Initiative→Execution intake contract

### 1.1 Verification: does an Initiative→Execution intake adapter exist?

**No. Confirmed absent, not just "not found."**

- `server/src/routes/caseWorkspace/intake.routes.ts` and
  `server/src/services/caseWorkspace/caseIntakeService.ts` contain **zero**
  occurrences of `Initiative` (checked by grep for the literal token). Per
  `caseIntakeService.ts:1-9`, this file is explicitly scoped as *"the ONLY
  sanctioned path from a conversation to a Case"* (Chat/Teresa → Case,
  Stream B / E8) — it is not, and was never meant to be, an
  Initiative → Case path.
- The only Initiative-related file under `caseWorkspace/` is
  `server/src/services/caseWorkspace/adapters/initiativeAdapter.ts`, and it
  runs in the **opposite direction**: it is a Case-Workspace-internal
  capability (`case-workspace.initiative.create`,
  `initiativeAdapter.ts:36-37`) that lets a Case **create an Initiative as an
  OUTPUT artifact** (`initiativeAdapter.ts:94-101`, `relation: 'OUTPUT'`),
  wrapping `initiativeService.createInitiative`. It never reads an
  *approved* Initiative and never creates a Case from one.
- `server/src/services/caseWorkspace/artifactLinkService.ts:189` lists
  `'initiative'` as one of several linkable artifact types, but that link
  service (per its own header, `artifactLinkService.ts:8-20`) stores only a
  typed pointer/digest — no case-creation semantics, no intake.
- Grepping the whole `server/src` tree for
  `approve.*initiative.*execution|initiativeApproval|promoteToExecution|convertToExecution`
  returns no adapter/service hits (only doc-comment mentions of an unrelated
  "Initiative edit-permission matrix").

**Conclusion**: an approved Initiative today has no programmatic path into
Execution's Case Workspace. `initiativesExecutionRuntime.routes.ts` /
`initiativeClosure.routes.ts` (both Lane B-owned) operate on Initiatives that
already exist inside the `initiatives-execution` domain tables
(`ie_*`, `initiative_*`) — Execution-the-domain and Case Workspace are two
separate subsystems in this codebase, and nothing bridges "Initiative
approved" → "Case Workspace case opened." This matches the prior inventory
cited in the task brief; I independently reproduce the same conclusion via
direct grep, not by trusting the brief.

### 1.2 Versioned contract specification (design only — nothing below is implemented)

Modelled directly on the one intake path that already works correctly in
this codebase — `caseIntakeService.ts`'s propose/confirm digest pattern
(`caseIntakeService.ts:27-67` for the canon rules,
`caseIntakeService.ts:1336` for its schema-version refusal convention,
`caseIntakeService.ts:566-608` for its idempotency-key vs. digest split) —
because that is the only precedent in-repo for a durable, versioned,
externally-triggered Case creation, and Deliverable 1 should not invent a
different shape for the same underlying problem (two systems disagreeing
about whether a Case already exists for a given upstream thing).

**Payload schema `InitiativeExecutionIntakeV1`**

```
{
  "schemaVersion": 1,                    // REQUIRED. Unknown version -> refuse
                                          // with `initiative_intake_schema_version_unsupported`
                                          // (mirrors caseIntakeService.ts:1336),
                                          // never silently coerce.
  "sourceInitiativeId": "<uuid>",        // stable source ID — the Initiative's
                                          // own PK in `initiatives` (ie_* domain).
                                          // NOT a display code, NOT a title.
  "sourceOrganizationId": "<uuid>",      // tenant of the Initiative. MUST equal
                                          // the tenant of the actor calling intake
                                          // — see 1.3 cross-tenant-denied case.
  "sourceApprovalCorrelationId": "<uuid>", // the correlationId minted by
                                          // initiativeTransitionService.ts's
                                          // executeInitiativeTransition for the
                                          // APPROVED transition being handed off
                                          // (same minting pattern already proven
                                          // for EXE-09 — see §2).
  "idempotencyKey": "<string>",          // caller-supplied. Recommended:
                                          // `initiative-intake:{sourceInitiativeId}:{sourceApprovalCorrelationId}`
                                          // so a retried webhook/queue redelivery
                                          // of the SAME approval event can never
                                          // produce a second Case.
  "requestedByActorId": "<uuid|null>",
  "workOrder": {
    "title": "<string>",
    "summary": "<string|null>",
    "projectId": "<uuid|null>",
    "axis": "<string|null>",
    "area": "<string|null>"
  }
}
```

**Receipt / outbox semantics**

- New table, one row per real intake attempt-chain, primary-keyed by
  `idempotencyKey` (not a fresh UUID) — this is the load-bearing difference
  from EXE-09's receipt (§2), because here the *caller* needs to safely
  replay without knowing whether the first attempt landed, whereas EXE-09's
  correlationId is minted server-side exactly once and never replayed by a
  caller.
- `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`; a
  conflict means "replay" — re-read and return the existing row's
  `caseId`/status, never insert a second Case. This is the same
  `ON CONFLICT (project_id) DO NOTHING RETURNING *` shape
  `caseIntakeService.ts:29-31` already documents as the exactly-once
  mechanism for Chat→Case; Initiative→Case should reuse it, not invent a
  read-then-write race.
- Owner table: a new `initiative_execution_intake_receipts` table, single
  writer = the new intake service. Do not let both the future intake
  service and `caseIntakeService.ts` write competing rows for what is
  supposed to be the same Case — see open question in §1.4.
- Status column: `PENDING → CASE_CREATED | REFUSED | STALE`.

### 1.3 Worked examples

1. **Positive**: Initiative `INI-1` transitions to `APPROVED`
   (hypothetical — no such transition emits an event today, see §1.1).
   Caller submits `InitiativeExecutionIntakeV1` with a fresh
   `idempotencyKey`. No existing receipt row → insert succeeds → Case
   created, artifact-linked back to the Initiative (reusing
   `artifactLinkService.linkArtifactToCase`, `relation: 'SOURCE'` — the
   inverse of `initiativeAdapter.ts`'s existing `'OUTPUT'` relation) →
   receipt row `CASE_CREATED`.
2. **Retry/replay**: the same event is redelivered (queue at-least-once,
   or an operator manually re-triggers). Same `idempotencyKey` → `INSERT
   ... ON CONFLICT DO NOTHING` returns 0 rows → service re-reads the
   existing receipt → returns the SAME `caseId`, does not create a second
   Case, does not error.
3. **Stale**: the intake payload's `sourceApprovalCorrelationId` no longer
   matches the Initiative's *current* latest transition correlationId (the
   Initiative was reverted and re-approved, or moved on, after this event
   was queued). Refuse with a distinct code
   (`initiative_intake_stale_approval`), do not create a Case, and do not
   silently accept a payload describing a superseded approval — mirrors
   `caseIntakeService.ts`'s digest-mismatch refusal
   (`intake_work_order_digest_mismatch`) being a hard refusal, never a
   "close enough."
4. **Cross-tenant-denied**: `sourceOrganizationId` in the payload does not
   match the organization the calling actor/service credential is scoped
   to. Refuse before touching `case_core` at all — same posture
   `initiativeAdapter.ts:12-20` already uses for its own (reverse-direction)
   cross-tenant guard: never trust a payload's own claimed org id without an
   independent check.

### 1.4 Open question (flag, not a decision)

Whether the target Case should be created via `caseIntakeService.ts`'s
existing `confirmWorkOrder` path (reusing its digest/dedup machinery, at the
cost of coupling an Initiative-sourced event to a chat-shaped confirmation
model) or via a new, parallel, Initiative-specific creation path (as
sketched above) is a product/architecture decision, not something this
contract should resolve unilaterally — flagged for Piotr/Codex, not
implemented either way.

---

## 2. Deliverable 2 — Execution→Results signal contract (for Codex / Results)

This section documents the CURRENT VERIFIED design of `EXE-09`
(`closureDeliveryReceiptService.ts` + migration `935`), plus the two GAPS I
confirmed, plus what a versioned successor contract would need to add. Lane B
is not editing this file (§0) — the fixes in §2.3 are filed as change
requests in §4, and any Results-side work is Codex's, not Lane B's.

### 2.1 Confirmed current design (all claims re-verified against the live file, not assumed from the brief)

- **Correlation ID**: minted exactly once by
  `initiativeTransitionService.ts:1434` (`const correlationId = uuidv4();`),
  the SAME id used for `initiative_status_history` and
  `initiative_history` (`initiativeTransitionService.ts:1426` comment,
  `:1446`). The EXE-09 receipt's primary key IS this correlationId
  (`closureDeliveryReceiptService.ts:158-166`,
  migration `935:32-36`) — confirmed, not assumed.
- **Receipt written in the SAME transaction** as the DONE transition:
  `initiativeTransitionService.ts:1512-1519` calls `createReceiptOnClosure`
  inside the same `client`/transaction as the status-history writes, guarded
  by `currentStatus !== 'DONE' && nextStatus === 'DONE'`.
- **Two independent legs**: `results_status` / `finance_status` columns,
  each with its own status enum, attempts counter, last-error,
  delivered-at, and payload (migration `935:54-70`); the Finance leg's
  outcome never blocks or is blocked by the Results leg
  (`closureDeliveryReceiptService.ts:521-526` comment + code structure).
- **Atomic per-leg claim**: `claimLeg()` at
  `closureDeliveryReceiptService.ts:391-416`, a single
  `UPDATE ... WHERE status IN ('PENDING','FAILED') OR (status='DELIVERING'
  AND stale)` on a pinned (non-pool) connection, with a documented,
  empirically-verified reason for avoiding the shared pool
  (`:393-402`).
- **Exponential backoff, capped at 30 minutes**: `backoffMs()`,
  `closureDeliveryReceiptService.ts:352-355` —
  `30_000 * 2**(attempts-1)`, `Math.min(..., 30*60_000)`. Confirmed exactly
  as reported.
- **Reconciliation cron**: `runReconciliationSweep` /
  `startClosureReceiptReconciliationCron`, started at
  `server/src/index.ts:2044-2046` (`await import('./services/closureDeliveryReceiptService.js')`
  then `startClosureReceiptReconciliationCron()`), inside a `try/catch` that
  degrades to a warn log on failure (`index.ts:2043-2051`). This is close to
  but not exactly "~2043" as reported — the actual `startClosureReceiptReconciliationCron()`
  call is at `index.ts:2046`; confirmed as real and wired, not a phantom
  flag.
- **`FOR UPDATE SKIP LOCKED` batch claim**: `claimDueReceipts()`,
  `closureDeliveryReceiptService.ts:675-705`, batch size 25 by default,
  correctly scoped to avoid double-processing across concurrent server
  instances.
- **Explicit anti-false-positive check**: `initiativeHadResultsSignal()`
  (`closureDeliveryReceiptService.ts:232-251`) plus the zero-benefit-rows
  guard inside `attemptDeliveryInternal`
  (`closureDeliveryReceiptService.ts:482-493`) — a `handoffFromClosure` call
  that returns without throwing but produces zero `initiative_benefits`
  rows, despite the initiative having a planned KPI target or valid
  `expected_roi`, is treated as a FAILURE, not a false DELIVERED. Confirmed
  present and doing real work, not decorative.

All of the above holds up under direct inspection — the brief's positive
description of EXE-09 is accurate.

### 2.2 Confirmed gaps (both held)

1. **No `schemaVersion`/`payload_version` on `results_payload` /
   `finance_payload`.** Verified by:
   - grepping migration `935_exe009_closure_delivery_receipt.sql` for
     `schema_version|payload_version` — zero hits (compare: migration
     `20260810_case_workspace_event_outbox.sql:85` DOES have
     `schema_version INTEGER NOT NULL DEFAULT 1` for exactly this reason —
     `:82-84` comment: *"the version of the redacted_summary shape for this
     event_type. Consumers branch on (event_type, schema_version)"*).
   - reading every payload-construction site in
     `closureDeliveryReceiptService.ts`: `results_payload` is written as
     `JSON.stringify({ benefitIds: rows.map(...) })`
     (`:503`, inside `:494-504`); `finance_payload` is written as either
     `{ reason: 'MEASUREMENT_REQUIRES_APPROVAL', candidateMeasurementId, ... }`
     or `{ reason: 'NO_MONETARY_MEASUREMENT' }` (`:544-553`, written at
     `:571`). Neither object carries a version key anywhere.
   - **CONFIRMED, gap holds.** A future shape change to either payload has
     no way to signal itself to a consumer reading old rows.
2. **No max-attempts / dead-letter ceiling**, despite the migration
   comment's claim. Verified by:
   - migration `935_exe009_closure_delivery_receipt.sql:89` literally says
     *"FAILED is retried until max attempts, see service"* — but grepping
     `closureDeliveryReceiptService.ts` for `MAX_ATTEMPT|maxAttempts|dead.?letter|DEAD_LETTER`
     returns **zero hits**. `backoffMs()` only caps the *delay*, not the
     *count* — a receipt with a permanently-broken Results/Finance leg
     retries every 30 minutes **forever**, indistinguishable in the
     schedule from a leg that will recover in an hour.
   - Contrast with `eventOutboxService.ts`, which DOES implement exactly
     what the EXE-09 migration comment claims to have:
     `DEAD_LETTER_ATTEMPT_THRESHOLD = 10`
     (`server/src/services/caseWorkspace/eventOutboxService.ts:118`), used
     in the claim query at `:619` and documented at `:67-68, :113, :142`,
     plus a dedicated read surface (`listDeadLetterEvents` `:733`,
     `countDeadLetterEvents` `:757`). EXE-09 has none of this.
   - **CONFIRMED, gap holds.** This is a real operational risk: a
     persistently-broken downstream (e.g. a schema drift in
     `roi_realized_values`) produces an unbounded, silently-retrying
     backlog with no ceiling and no dead-letter visibility, only a
     `results_last_error`/`finance_last_error` string on the row itself
     (no aggregate "how many receipts are stuck" surface exists for
     EXE-09, unlike `eventOutboxService.ts`'s `getOutboxBacklog` at `:776`).

### 2.3 Versioned contract Codex should consume (specification, not implemented)

- **Add `schema_version INTEGER NOT NULL DEFAULT 1`** to both payload
  columns' semantics (either as two new columns, or as a `version` key
  inside each JSONB payload — the `case_workspace_event_outbox` precedent
  at `20260810_case_workspace_event_outbox.sql:85` uses a real column, which
  is more queryable and is the recommended shape). Codex's consumer should
  branch on `(status, schema_version)` and refuse/log on an unrecognized
  version rather than assume the current shape.
- **Stable source ID**: the Initiative's `id` (`initiative_id` column,
  already present, migration `935:39`) plus the `correlationId`
  (`id`/`transition_audit_ref`, `935:32-45`) together are the stable,
  compound source identity for one closure event. Codex's consumer keys
  off `(initiative_id, id)`, never off timing.
- **Idempotency**: already exactly-once at receipt-creation via the PK
  being a server-minted UUID (§2.1) — Codex does not need its own
  idempotency key for *receiving* the signal, but the Results-side write
  Codex performs in response should itself be idempotent keyed off the same
  `id`/correlationId, since `attemptDeliveryInternal` may call
  `handoffFromClosure` more than once across retries (by design — see
  `closureDeliveryReceiptService.ts:472-481`, which already relies on
  `handoffFromClosure` being idempotent via migration 783's partial unique
  index on `initiative_benefits`).
- **Retry/restart behaviour Codex must tolerate**: Results may see the same
  logical closure delivered more than once (claim-then-crash before the
  terminal UPDATE, reclaimed after `STALE_DELIVERING_LEASE_MINUTES = 5`,
  `closureDeliveryReceiptService.ts:389`); Codex's read side must not assume
  "one closure = exactly one Results-adapter invocation," only "one closure
  = eventually exactly one committed downstream effect."
- **Consumer-test packet Codex needs** (mapped to this file's actual
  mechanics, not generic advice):
  - *Positive*: DONE transition → receipt row created in the SAME
    transaction → `results_status` reaches `DELIVERED` with a
    `benefitIds` payload after the immediate best-effort attempt or, if
    that fails, after the reconciliation sweep.
  - *Retry/replay*: force `attemptDeliveryInternal` to run twice for the
    same receipt id (e.g. via `__testForceResultsError` on the first call)
    and assert the SECOND attempt reports the SAME `benefitIds`, not a
    duplicate set (`closureDeliveryReceiptService.ts:16-19` header claim —
    should be asserted, not just documented).
  - *Stale*: a leg stuck in `DELIVERING` past 5 minutes is reclaimed by
    `claimLeg`'s staleness branch (`:409-411`) and successfully completes
    on the next sweep tick — assert this, since nothing today exercises the
    stale-lease branch directly per a scan of
    `server/src/services/initiative/__tests__/initiativeTransitionService.closureGate.test.ts`
    (NOT_VERIFIED whether a dedicated stale-lease test exists elsewhere —
    I did not do a full test-suite inventory for this packet).
  - *Tenant-negative*: `retryDeliveryForOrg` with a receipt id belonging to
    a different `organizationId` must resolve to "not found," never a
    cross-tenant retry (`closureDeliveryReceiptService.ts:648-663`,
    the `getReceiptById` org-scoped lookup at `:652`).
  - *Provider-failure*: `finance_status` must ALWAYS land in
    `NEEDS_DECISION`, never an automatic `DELIVERED`, regardless of how
    fresh/currency-matched a candidate measurement is
    (`:527-563`) — Codex's consumer-test packet should assert the Finance
    leg specifically never auto-writes `roi_realized_values` from this
    path, since that was the exact defect fixed across EXE-09's review
    rounds 1-4 (file header, `:20-63`) and a regression here would be easy
    to miss from the Results side alone.

---

## 3. Deliverable 3 — three parallel outbox/receipt mechanisms

All three tables verified to exist and to be actively written in this tree.

| | **EXE-09 closure receipts** | **`case_workspace_event_outbox`** | **`ie_outbox_events`** |
|---|---|---|---|
| Table | `closure_delivery_receipts` (migration `935`) | `case_workspace_event_outbox` (migration `20260810_case_workspace_event_outbox.sql`, plus follow-ups `20260810c/e/f`, `20260812a`) | `ie_outbox_events` (migration `932_initiatives_execution_material_commands.sql:99-114`) |
| Writer | `createReceiptOnClosure`, called only from `initiativeTransitionService.ts:1513` | `publishEvent()`, `eventOutboxService.ts:453` — called from many `caseWorkspace/*Service.ts` mutating commands (per `artifactLinkService.ts:57-72` doc header, one `publishEvent` per mutating command) | `appendOutbox()`, `postgresMaterialCommandUnitOfWork.ts:568-586` — called from `initiatives-execution` domain write paths (Lane B-owned domain) |
| Worker/consumer | `runReconciliationSweep` / `attemptDeliveryInternal`, started via `startClosureReceiptReconciliationCron()` at `server/src/index.ts:2044-2046` | `dispatchPendingEvents()` (`eventOutboxService.ts:597`), driven by `outboxWorker.ts`'s `startCaseWorkspaceOutboxWorker()`, started at `server/src/index.ts:2013-2016` | **NONE FOUND.** Grepped all of `server/src` for `ie_outbox_events` outside the writer file — zero hits. Every other occurrence is in `tests/integration/initiatives-execution/*.realdb.test.ts`, which only assert a row was *appended*, never that anything drains/processes it. |
| Retry policy | Per-leg exponential backoff, 30s→30min cap (`backoffMs`, `:352-355`), **no attempt ceiling** (§2.2) | `computeRetryBackoffMs()` (`eventOutboxService.ts:155`) + hard **dead-letter at 10 attempts** (`DEAD_LETTER_ATTEMPT_THRESHOLD = 10`, `:118`, enforced in the claim query `:619`) | N/A — `attempt_count` column exists (migration `932:108`) but nothing increments or reads it outside the initial `DEFAULT 0` |
| Schema version | **Absent** (§2.2, confirmed) | **Present**: `schema_version INTEGER NOT NULL DEFAULT 1` (`20260810_case_workspace_event_outbox.sql:85`, documented purpose `:82-84`) | **Absent** — grepped migration `932` for `schema_version|payload_version`, zero hits |
| Observable backlog surface | None found beyond per-row `*_last_error` (no aggregate query) | `getOutboxBacklog` (`eventOutboxService.ts:776`), `listDeadLetterEvents`/`countDeadLetterEvents` (`:733`, `:757`) | None |
| Production-wired | Yes (`index.ts:2044-2046`) | Yes (`index.ts:2013-2016`) | **No worker to wire — write-only in production as of this commit** |

### 3.1 Assessment

- **`case_workspace_event_outbox` is the most mature of the three** — it has
  schema versioning, a hard dead-letter ceiling with a dedicated read
  surface, and a documented rationale for why the worker was needed at all
  (`outboxWorker.ts:4-16`: *"eventOutboxService.dispatchPendingEvents() is a
  correct, transactionally sound PRIMITIVE... Before this file, NOTHING
  called it outside a test"* — i.e. this exact "written but never drained"
  failure mode has ALREADY happened once in this codebase, for this exact
  table, before being fixed).
- **`ie_outbox_events` is in that same "written but never drained" state
  right now.** It is not a fallback or an intentionally-deferred design —
  nothing in `932_initiatives_execution_material_commands.sql` or
  `postgresMaterialCommandUnitOfWork.ts` documents it as deliberately
  consumer-less. This is either a live gap or dead infrastructure; I could
  not determine which without asking the Lane B domain owner what
  `ie_outbox_events` was meant to feed (`NOT_VERIFIED` — no consumer, no
  doc pointing at an intended one, no product-decision note found).
- **EXE-09 sits in between**: it has a real, wired worker (unlike
  `ie_outbox_events`) but is missing the dead-letter ceiling
  `case_workspace_event_outbox` already proved necessary for this exact
  problem shape in this exact codebase (§2.2).
- **Convergence risk**: three different retry/backoff implementations,
  three different claim strategies (`FOR UPDATE SKIP LOCKED` batch in two of
  three; EXE-09 uses a per-row atomic `UPDATE ... WHERE status IN (...)`
  claim instead — functionally similar, differently coded), and only one of
  three has schema versioning. A future engineer fixing a bug in one
  ("add a dead-letter threshold," "add schema versioning") has no single
  place to fix it, and will not automatically know the other two exist
  unless they read this document or do the same cross-grep. The
  `case_workspace_event_outbox` implementation is functionally the most
  complete and is the natural convergence target if/when this is revisited
  — but that is a recommendation, not a plan; **no convergence work is
  implemented here**, per the task's explicit instruction.

---

## 4. `INTEGRATOR_CHANGE_REQUEST`

Every item below targets a file outside the Lane B lease (§0). Lane B is not
touching any of these files. Ordering guidance is given because two of the
four touch the same file (`closureDeliveryReceiptService.ts`) and should
land together, not as separate uncoordinated patches.

### CR-1 — Add schema/payload versioning to EXE-09 receipts

- **Task ID**: EXE-FLOW-ADAPTER-001 (this packet), gap §2.2.1
- **File**: `server/migrations/935_exe009_closure_delivery_receipt.sql`
  (additive follow-up migration, e.g. `938_exe009_closure_receipt_payload_version.sql`
  — do not edit `935` in place per this repo's own additive-migration
  convention, see `935`'s own header `:26-30` citing why dated-prefix/
  in-place edits are unsafe)
- **Minimal proposed hunk** (new migration file, not an edit to 935):
  ```sql
  ALTER TABLE closure_delivery_receipts
    ADD COLUMN IF NOT EXISTS results_payload_schema_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS finance_payload_schema_version INTEGER NOT NULL DEFAULT 1;
  ```
  Plus, in `server/src/services/closureDeliveryReceiptService.ts`, set the
  version explicitly wherever `results_payload`/`finance_payload` are
  written (`:494-504`, `:564-571`) instead of relying on the column
  default, so a future shape change actually bumps something.
- **Reason**: §2.2.1 — payload consumers (Codex/Results, Finance) have no
  way to detect a shape change. Every sibling outbox in this codebase that
  matters (`case_workspace_event_outbox`) already has this.
- **Consumer tests required**: a test asserting an intentionally-old
  `results_payload_schema_version` is either handled or explicitly refused
  by any downstream reader Codex adds (Results is Codex's domain — Lane B
  does not know Results' reader code).
- **Ordering**: land before or together with CR-2 (same file); must land
  before Codex builds a durable Results-side consumer that depends on this
  contract (§2.3), otherwise Codex has nothing to version against.

### CR-2 — Add attempt ceiling / dead-letter to EXE-09 receipts

- **Task ID**: EXE-FLOW-ADAPTER-001, gap §2.2.2
- **File**: `server/src/services/closureDeliveryReceiptService.ts`
- **Minimal proposed hunk** (illustrative, not exhaustive — exact threshold
  is a product call, not Lane B's to make):
  ```ts
  const MAX_DELIVERY_ATTEMPTS = 10; // mirror eventOutboxService.ts's
                                     // DEAD_LETTER_ATTEMPT_THRESHOLD (=10)
                                     // for consistency across the three
                                     // outbox mechanisms — see Deliverable 3.

  // in claimDueReceipts()'s WHERE clause, exclude legs that have already
  // hit MAX_DELIVERY_ATTEMPTS from the pending-sweep selection (mirrors
  // eventOutboxService.ts:619's claim-query threshold check), and add a
  // listDeadLetterReceipts()-equivalent read surface (mirrors
  // eventOutboxService.ts:733).
  ```
- **Reason**: the migration's own comment (`935:89`) claims this already
  exists ("FAILED is retried until max attempts, see service") — it does
  not. This is a documentation/implementation mismatch, not a hypothetical
  risk: a permanently-broken leg retries every 30 minutes forever with no
  operator-visible "this is stuck" signal beyond reading
  `results_last_error`/`finance_last_error` on individual rows.
- **Consumer tests required**: a test that forces N consecutive failures
  (via the existing `__testForceResultsError`/`__testForceFinanceError`
  test hooks, `closureDeliveryReceiptService.ts:359-362`) and asserts the
  receipt stops being reclaimed by `claimDueReceipts` past the threshold,
  plus a dead-letter read surface test.
- **Ordering**: same file as CR-1 — land as one coordinated change, not two
  separate patches to avoid merge friction on the same ~50-line region.

### CR-3 — Route `demoSeedService.ts` through the durable receipt path

- **Task ID**: EXE-FLOW-ADAPTER-001, background claim re: `demoSeedService.ts:2318`
- **File**: `server/src/services/demo/demoSeedService.ts`
- **Confirmed**: `demoSeedService.ts:4` imports
  `fireClosureHandoff` from `'../executionResultsBridge.js'` directly, and
  `demoSeedService.ts:2318` calls
  `fireClosureHandoff(organizationId, initiativeId, null);` — this is the
  OLD fire-and-forget path EXE-09 was built to replace
  (`closureDeliveryReceiptService.ts:4-10` header: *"Replaces the
  fire-and-forget-only handoff in executionResultsBridge.ts... with a
  durable row"*). Demo-seeded closures bypass the durable receipt, the
  retry, and the dead-letter/backoff machinery entirely.
- **Minimal proposed hunk** (illustrative):
  ```ts
  // instead of: fireClosureHandoff(organizationId, initiativeId, null);
  // either (a) route demo-seeded closures through the same
  // initiativeTransitionService DONE-transition path real closures use
  // (creates the receipt automatically, same code path as production), or
  // (b) if demo seeding must bypass the full transition state machine for
  // performance, call createReceiptOnClosure + triggerImmediateDeliveryBestEffort
  // directly with a freshly minted correlationId, matching
  // initiativeTransitionService.ts:1434,1513,1600's own sequence.
  ```
- **Reason**: demo data is supposed to exercise the real system, not a
  parallel unmonitored path — per this repo's own working rule ("Dane demo
  = twarz produktu"), a demo-seeded closure silently skipping the receipt
  system means demo environments never exercise EXE-09's retry/backoff at
  all, and any demo-only smoke test of "does closure delivery work" would
  be testing dead code.
- **Consumer tests required**: a test asserting a demo-seeded closure
  produces a `closure_delivery_receipts` row, same as a production closure.
- **Ordering**: independent of CR-1/CR-2 (different call site, same target
  file family) — can land before, after, or alongside them. Must NOT land
  before confirming which of options (a)/(b) above is intended, since (a)
  changes demo-seeding's transactional shape and (b) duplicates
  transition-service sequencing logic; this is a design choice for whoever
  owns `demoSeedService.ts`/`initiativeTransitionService.ts`, not something
  Lane B should decide unilaterally from outside its lease.

### CR-4 — `ie_outbox_events` has no consumer (verify intent before treating as a bug)

- **Task ID**: EXE-FLOW-ADAPTER-001, Deliverable 3 finding
- **File**: N/A — this is a request to CONFIRM INTENT, not a code change.
  If confirmed unintentional, the fix would touch a new consumer file plus
  wiring in `server/src/index.ts` (outside every lane's lease as
  currently configured — see §0).
- **Reason**: `ie_outbox_events` (migration `932`, written by
  `postgresMaterialCommandUnitOfWork.ts:568-586`, Lane B-owned writer) has
  zero readers anywhere in `server/src`. This is the exact same failure
  shape `case_workspace_event_outbox` was ALREADY found to have and fixed
  (`outboxWorker.ts:4-16`, quoted in §3.1) — that fix's own header
  literally warns this failure mode is easy to reintroduce ("nothing…
  would simply never run in a real deployment"). Before proposing a
  specific hunk, this needs a decision on whether `ie_outbox_events` is
  (a) intentionally not yet wired (a future consumer is planned and simply
  hasn't landed), or (b) accidentally orphaned the same way
  `case_workspace_event_outbox` briefly was. I could not determine which
  from the repo alone (`NOT_VERIFIED`).
- **Consumer tests required**: none yet — this is a request for a decision,
  not a request for a patch.
- **Ordering**: no dependency on CR-1/2/3. Independent of Deliverable 1/2
  work. Should be resolved before any convergence work on the three-outbox
  situation (Deliverable 3) is scheduled, since converging a dead consumer
  into a live one is a different (larger) task than converging two live
  ones.

---

## Summary of what held vs. what was refuted

| Reported claim | Verdict |
|---|---|
| EXE-09 = `closureDeliveryReceiptService.ts` / migration 935, correlationId minted once in `initiativeTransitionService.ts`, separate legs, atomic claim, 30-min-capped backoff, cron at `index.ts` ~2043, `FOR UPDATE SKIP LOCKED`, anti-false-positive check | **HELD**, all sub-claims individually re-verified against source, §2.1. Cron start line is `index.ts:2046` precisely (call inside a block starting `:2043`). |
| No `schemaVersion`/`payload_version` on `results_payload`/`finance_payload` | **HELD**, §2.2.1 |
| No max-attempts/dead-letter ceiling despite migration comment claiming otherwise | **HELD**, §2.2.2 — migration `935:89` comment is factually wrong about the service |
| `demoSeedService.ts` ~2318 calls deprecated `fireClosureHandoff` directly | **HELD**, exact line confirmed, §4 CR-3 |
| `closureDeliveryReceiptService.ts` is not in any lane's or the integrator's lease | **HELD**, §0 — also confirmed its migration, `index.ts`, and `demoSeedService.ts` are all unowned |
| No Initiative→Execution intake adapter exists (`intake.routes.ts` is chat/Teresa→Case only) | **HELD**, §1.1 — independently re-derived by grep, not assumed from the brief |
| Three parallel outbox mechanisms: EXE-09, `case_workspace_event_outbox`, `ie_outbox_events` | **HELD they are three separate mechanisms**, but with a NEW finding beyond what was reported: `ie_outbox_events` currently has **no consumer at all** (write-only) — worse than "three implementations of the same concern," it is "two implementations plus one dead write path." See §3, §4 CR-4. |
