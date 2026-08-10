# ROI-E003 — Decision & Approved — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
Third epic of the ROI domain, builds on ROI-E001 (Case & Baseline) and
ROI-E002 (Economic Model), both landed. Backend only — UI Registry is RN-G2.

Two cross-epic contracts already exist and are called for the first time here:
`freezeRoiBaseline` (`roiBaselineCommands.ts`) and `freezeRoiEconomicModel`
(`roiEconomicModelFreeze.ts`). Two platform event types already registered with
no caller (`atomicWrite.ts`): `roi.baseline_frozen`, `roi.economic_model_frozen`
— this epic gives them their first real callers.

---

## 0. Epic boundary (accepted as-is)

Per `EPIC_LEDGER_LIVE.md`'s prose (same thin-ledger limitation every ROI epic
so far has flagged):

> "ROI-E003 Decision & Approved (6 AC: guard przed Ready for Review, Decision
> request z pinned wersją, self-approval denial dla maker-checker, immutable
> ApprovalSnapshot z hash, rejection/changes-requested z audytem, reapproval =
> nowa wersja obok starej)"

Six ACs, accepted verbatim:

1. **AC-01** — Guard re-validated at the Ready-for-Review → Submitted boundary, not only relied on from when the case first reached `ready_for_review`.
2. **AC-02** — The decision request pins a specific economic-model version under review.
3. **AC-03** — Self-approval denial enforces maker-checker discipline.
4. **AC-04** — An immutable, content-hashed `ApprovalSnapshot` is the durable approval record.
5. **AC-05** — Rejection and Changes-Requested are both audited (actor/timestamp/reason).
6. **AC-06** — Reapproval produces a new version alongside the old one; nothing is overwritten.

---

## 1. Decisions

All 16 decision points from the design draft are ratified as specified, plus 5
new decisions resolving the draft's own open questions (D17-D21).

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Does submit need its own readiness guard, or is re-checking redundant? | **Re-run `isRoiCaseReadyForReviewEligibleWithEconomicModel` at submit time**, unchanged, imported verbatim. `fromStatuses: ['ready_for_review', 'changes_requested']`. | `'ready_for_review'` is not in `NON_EDITABLE_STATUSES` — a case can still be edited after reaching it, silently breaking the eligibility already checked. AC-01 names exactly this gap. |
| D2 | Does approval itself need its own re-check of the same guard? | **No** — D3 closes the edit window the instant the case is submitted, so nothing the guard checks can drift between submit and decide. | Re-running an identical check with nothing able to have changed is ceremony, not safety. |
| D3 | Does `NON_EDITABLE_STATUSES` need `'submitted_for_approval'` added? | **Yes.** One-line addition to the shared, already-exported constant in `roiCaseCommands.ts` — every E002 command file picks it up automatically. | Matches `submitDefinition`'s own stated principle: submitting freezes the contract for reviewer decision. Without it, cost/benefit lines could change under a pending approval. |
| D4 | `captureOrUpdateBaseline` has no case-status guard today (only `frozen_at`). Gap to close? | **Yes.** Add a plain `SELECT status` read + `NON_EDITABLE_STATUSES` check inside `applyMutation`, throwing `RoiCaseValidationError('NOT_EDITABLE', ...)`. | D3 alone doesn't cover the baseline table, which E001/E002 never wired to the shared constant — an inconsistency AC-01/AC-02's guarantee would otherwise miss. |
| D5 | What does "pinned version" (AC-02) concretely mean? | New nullable column `rvn_roi_cases.decision_calculation_run_id UUID REFERENCES rvn_roi_calculation_runs(run_id)`, set by `submitRoiCaseForApproval` to the run the readiness guard validated as fresh. | D3+D4 already make drift impossible once submitted, but an explicit, queryable, audit-visible pin beats an implicit "nothing else could have changed" proof — matches this program's honest-missing/no-unstated-invariant bias. |
| D6 | Is `'changes_requested'` distinct from `'rejected'`? | **Distinct transition, distinct audit columns.** New: `changes_requested_by`/`changes_requested_at`/`changes_requested_reason`. `'changes_requested'` stays editable (not added to `NON_EDITABLE_STATUSES`); `rejected_by`/`rejected_at`/`rejection_reason` (already reserved, ROI-E001 D6) are reserved for actual rejection only. | Reusing rejection columns for "not rejected, just needs work" would put a false claim in a column literally named `rejected_by`. |
| D7 | Does submit accept `'changes_requested'` as a direct `fromStatus`? | **Yes**, directly — no intermediate "resume modeling" command. | `'changes_requested'` behaves like an editable state in every respect except its status label; inventing an extra transition the ledger prose never names adds nothing. |
| D8 | Is `'rejected'` revivable? | **Yes, via an explicit `reopenRejectedRoiCase` command** (`'rejected' → 'modeling'`), audit columns left untouched (rejection stays in history). | An explicit, separately-auditable revival act keeps "changes requested" (soft) and "rejected" (deliberate) meaningfully distinct in the case's history. |
| D9 | Does E003 build the Approved→revision reopen path? | **Yes, as a generic command** `reopenApprovedRoiCaseForRevision`, `fromStatuses: ['approved']` only (not Tracking+ — that is a materially bigger, cross-epic operation, explicitly deferred, see D19). Mandatory `reason`. Unfreezes baseline + economic model via new symmetric functions. | AC-06 is one of this epic's own six ACs, not deferrable — it must be built and tested here, same pattern E001/E002 used for building a contract with zero caller at the time. |
| D10 | How do `original_approved_snapshot_id`/`latest_approved_snapshot_id` behave across reapproval? | Single `UPDATE` with `original_approved_snapshot_id = COALESCE(original_approved_snapshot_id, $new)`, `latest_approved_snapshot_id = $new`, every successful approval. | `COALESCE` only takes the new value while the column is still `NULL` — true exactly once per case's lifetime. Simplest correct two-pointer mechanism; no existing precedent in this codebase to reuse (KPI's `current_definition_version_id` has no "original" counterpart). |
| D11 | Does the snapshot need freeze-time KPI-visibility filtering (mirroring KPI-E004's two-layer defense), or only read-time? | **Read-time only.** `rvn_roi_benefit_evidence_links` never carries KPI content (ROI-E002 D14) — freezing the reference copies nothing sensitive. The read-time layer (§5) reuses the existing per-reader KPI-visibility filter from `roiEconomicModelRepository.ts`. | KPI-E004 needed two layers because its snapshot payload *does* bake in KPI content. ROI's evidence links were deliberately built one layer thinner by E002 — E003 inherits that simplification rather than re-adding a redundant layer. |
| D12 | Does approval widen the case's default visibility? | **No.** `rvn_roi_approval_snapshots` carries no visibility row of its own — inherits via `case_id`, same as every E002 table. | Nothing in the six ACs calls for widening; doing so would silently violate AC-06 (ROI-E001)'s RESTRICTED_ACL default. |
| D13 | Self-approval denial — check `submitted_by` only, or also `created_by`/`owner_user_id`? | **Check `submitted_by` and `created_by`**, both deny. `owner_user_id` deliberately **not** checked. | Mirrors `approveDefinitionVersion` exactly. A case owner may legitimately not be its author/submitter and should still be able to approve a delegate's work — checking `owner_user_id` would over-restrict. |
| D14 | Own error class or reuse KPI's `SelfApprovalDeniedError`? | **Own class**, `RoiSelfApprovalDeniedError`. | Direct precedent: the KPI Deviation domain hit this exact question and the correct fix was a separate class per aggregate (`DeviationSelfApprovalDeniedError`), not reuse across domains. |
| D15 | Fate of the pre-existing `roi_case.decided` placeholder? | **Removed**, replaced by the real events this epic builds. `roi.case_approved` fans to `['mywork_projection','finance_projection']` (preserving the placeholder's Finance-facing intent); every other new event fans to `['mywork_projection']` only. | Confirmed zero call sites anywhere in the shipped codebase — pure, now-superseded scaffolding under the wrong naming convention (`roi_case.X` vs. every real event's `roi.case_X`). Leaving a dead, wrongly-named placeholder after building its real replacement is the exact FANTOM pattern CLAUDE.md warns against. |
| D16 | Does submit create a MyWork obligation for an approver? | **Not built.** No source doc names an approver-assignment mechanism. Structured so adding it later is a one-line `createObligation` call in the existing transaction, not a redesign. | Inventing an assignee-resolution rule with no product spec would be fabricating behavior — flagged as backlog (§9), not guessed. |
| D17 (resolves OQ1) | Approver assignment/obligation — build now or defer? | **Defer**, per D16. File as an explicit backlog note in the ledger closure entry, not silently dropped. | Same reasoning as D16 — no spec exists to build against. |
| D18 (resolves OQ2) | Reopening from Tracking/Benefits-Realization/PIR (post-E004/E005/E006 states) — build now? | **Defer entirely.** `reopenApprovedRoiCaseForRevision` stays scoped to `fromStatuses: ['approved']` only, per D9. Whether a later epic reuses this command (widened `fromStatuses`) or builds its own (given Forecast/Actual reconciliation needs the reopen doesn't know how to handle) is that epic's decision to make with full context of what Tracking/Actual data exists by then. | Speculatively designing for data structures that don't exist yet (ROI-E004's Forecast/Actual) risks guessing wrong; flag forward rather than build blind. |
| D19 (resolves OQ3) | Should rejected ever become a true dead end (org policy variant)? | **No — keep the unconditional revival path** (D8) exactly as designed, no policy gate. | Nothing in the 6 ACs or any source doc calls for a configurable reject-is-terminal policy; adding one now would be speculative scope. If a real need surfaces later, it is a small, additive gate on `reopenRejectedRoiCase`, not a redesign. |
| D20 (resolves OQ4) | Should E003 add a dedicated "approver" ACL access level distinct from `'contribute'`? | **No — inherit the existing gap.** Maker-checker enforcement remains purely the self-approval identity check (D13); anyone with `'contribute'` ACL access who isn't the case's submitter/creator can approve. This matches KPI's own precedent exactly. | This is pre-existing platform scope (the ACL model itself, RN-G1), not something ROI-E003 introduces or should silently patch over. Flagged for awareness given ROI's higher financial stakes, but fixing the platform's ACL granularity is out of this epic's scope — file as a shared backlog note, not a per-domain workaround. |
| D21 (resolves OQ5) | Is `decision_calculation_run_id` (D5) worth its schema cost given it isn't strictly load-bearing? | **Keep it, built as designed.** | Explicit auditability for a financial-approval record is worth one nullable FK column; the alternative (relying on an unstated cross-command invariant to prove "which run backed this decision") is exactly the kind of implicit correctness this program has repeatedly moved away from. |

---

## 2. Legacy collision check (accepted from draft)

`rvn_roi_approval_snapshots`, `decision_calculation_run_id`, `changes_requested_*`
— confirmed greenfield, zero collisions. No changes to the legacy
`roi_assumptions`/`initiative_benefits`/`benefits_register` family already
declared out of scope by ROI-E001 §2.

---

## 3. Schema (full DDL)

Migration file: `server/migrations/20260817_rvn_roi_decision_approval.sql`.

```sql
-- ============================================================
-- rvn_roi_cases — ALTER: pin the decision under review (D5), the
-- changes-requested audit columns (D6).
-- ============================================================
ALTER TABLE rvn_roi_cases
  ADD COLUMN IF NOT EXISTS decision_calculation_run_id UUID NULL,
  ADD COLUMN IF NOT EXISTS changes_requested_by        TEXT NULL,
  ADD COLUMN IF NOT EXISTS changes_requested_at        TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS changes_requested_reason     TEXT NULL;

-- ============================================================
-- rvn_roi_approval_snapshots — immutable, one row per approval (D10)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_approval_snapshots (
  snapshot_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                        UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                TEXT NOT NULL,

  -- Monotonic per case: 1, 2, 3... Display label "v{sequence_number}.0".
  sequence_number                INT NOT NULL,

  decision_calculation_run_id    UUID NOT NULL REFERENCES rvn_roi_calculation_runs(run_id),

  approved_by                    TEXT NOT NULL,
  approved_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  content_hash                   TEXT NOT NULL,
  snapshot_payload               JSONB NOT NULL,

  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No row_version, no UPDATE path, no frozen_at, no trigger — immutable by
  -- construction, matching rvn_roi_calculation_runs' own pattern.
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_approval_snapshots_case_seq
  ON rvn_roi_approval_snapshots(case_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_approval_snapshots_case
  ON rvn_roi_approval_snapshots(organization_id, case_id, sequence_number DESC);

-- FKs on the two E001-reserved pointer columns, ALTERed here now that the
-- referenced table exists — the exact ALTER ROI-E001's own migration comment
-- forward-declared to "the epic that creates the referenced table."
ALTER TABLE rvn_roi_cases
  ADD CONSTRAINT fk_rvn_roi_cases_original_approved_snapshot
    FOREIGN KEY (original_approved_snapshot_id) REFERENCES rvn_roi_approval_snapshots(snapshot_id),
  ADD CONSTRAINT fk_rvn_roi_cases_latest_approved_snapshot
    FOREIGN KEY (latest_approved_snapshot_id) REFERENCES rvn_roi_approval_snapshots(snapshot_id),
  ADD CONSTRAINT fk_rvn_roi_cases_decision_calculation_run
    FOREIGN KEY (decision_calculation_run_id) REFERENCES rvn_roi_calculation_runs(run_id);
```

No changes to any E002 table's DDL. No new `resource_type` (D12).

---

## 4. Command layer

New file: `server/src/services/resultsVnext/roi/roiCaseApprovalCommands.ts`.
Hand-written `executeAtomicCommand` calls (not the generic transition helper)
for every command writing fields beyond `status` — matches
`kpiDefinitionCommands.ts`'s `submitDefinition`/`approveDefinitionVersion`/
`rejectDefinitionVersion`, none of which use a generic helper either.

Before implementing, read the CURRENT exact state of `roiCaseCommands.ts`,
`roiBaselineCommands.ts`, `roiEconomicModelFreeze.ts`, `roiTypes.ts`, and
`roi.routes.ts` — confirm the exact exported names (`loadRoiCaseForUpdate`,
`runRoiCaseLifecycleTransition`, `RunRoiCaseLifecycleTransitionInput`,
`isRoiCaseReadyForReviewEligibleWithEconomicModel`, `computeStateHash`,
`EVENT_INSERT_SQL`/`resolveConsumerGroups` from `atomicWrite.ts`,
`RoiCaseTransitionSchema`) before writing code against them — this design
describes their shape and intent, not a guarantee of their literal current
signature after two epics of edits.

### 4.1 `submitRoiCaseForApproval` (AC-01, AC-02)

```typescript
export interface SubmitRoiCaseForApprovalInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function submitRoiCaseForApproval(
  input: SubmitRoiCaseForApprovalInput
): Promise<AtomicCommandOutcome<RoiCase>>
```

`executeAtomicCommand`. `applyMutation`:
1. `fromStatuses` check: `'ready_for_review'` or `'changes_requested'` → else `RoiCaseValidationError('INVALID_ROI_CASE_STATUS_TRANSITION', ...)`.
2. Load the baseline row, call `isRoiCaseReadyForReviewEligibleWithEconomicModel(client, currentRow, baselineRow)` unchanged — re-run per D1. Ineligible → `RoiCaseNotReadyForReviewError` (reused unchanged).
3. Read the latest `status='completed'` calculation run for its `run_id` (D5).
4. `UPDATE rvn_roi_cases SET status='submitted_for_approval', submitted_by=$1, submitted_at=now(), decision_calculation_run_id=$2, row_version=$3, updated_by=$1, updated_at=now() WHERE case_id=$4 RETURNING *`.
5. `buildEvent`: `roi.case_submitted_for_approval`.

### 4.2 `approveRoiCase` (AC-03, AC-04, AC-06)

```typescript
export interface ApproveRoiCaseInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  approverId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface ApproveRoiCaseResult {
  case: RoiCase;
  snapshot: RoiApprovalSnapshotSummary;
}

export async function approveRoiCase(
  input: ApproveRoiCaseInput
): Promise<AtomicCommandOutcome<ApproveRoiCaseResult>>
```

`applyMutation`, in this exact order — self-approval denial FIRST, before any write:

1. `if (currentRow.submitted_by === approverId) throw new RoiSelfApprovalDeniedError(caseId, approverId, 'submitted_by')`; `if (currentRow.created_by === approverId) throw new RoiSelfApprovalDeniedError(caseId, approverId, 'created_by')` (D13).
2. `status !== 'submitted_for_approval'` → `RoiCaseValidationError('NOT_SUBMITTED_FOR_APPROVAL', ...)`.
3. `decision_calculation_run_id` must be non-null (should be unreachable given §4.1 — if null, throw a plain internal error, do not silently proceed).
4. Read, on the SAME pinned `client`, in the same transaction: baseline, calculation policy, active assumptions/cost lines/benefit lines/scenarios/scenario overrides, active benefit evidence links (link metadata only, no KPI hydration — D11), and the pinned calculation-run row.
5. Build `RoiApprovalSnapshotPayload` (§5), `contentHash = computeStateHash(payload)` (reused, fixed key order).
6. `sequenceNumber = (SELECT COALESCE(MAX(sequence_number),0)+1 FROM rvn_roi_approval_snapshots WHERE case_id=$1)` — safe without its own lock; the case row's `FOR UPDATE` already serializes concurrent approvals of the same case.
7. `INSERT INTO rvn_roi_approval_snapshots (...) VALUES (...) RETURNING *`.
8. `await freezeRoiBaseline(client, { caseId, organizationId, frozenBy: approverId })`; manually insert `roi.baseline_frozen` (reuse `EVENT_INSERT_SQL`/`resolveConsumerGroups` from `atomicWrite.ts`, same pattern `insertManualDeviationEvent` established).
9. `await freezeRoiEconomicModel(client, { caseId, organizationId, frozenBy: approverId })`; manually insert `roi.economic_model_frozen`, same shape.
10. `UPDATE rvn_roi_cases SET status='approved', approved_by=$1, approved_at=now(), latest_approved_snapshot_id=$2, original_approved_snapshot_id=COALESCE(original_approved_snapshot_id,$2), row_version=$3, updated_by=$1, updated_at=now() WHERE case_id=$4 RETURNING *` (D10).
11. Return `{ case: toRoiCase(updatedRow), snapshot: toRoiApprovalSnapshotSummary(insertedSnapshotRow) }`.
12. `buildEvent`: `roi.case_approved` — `afterState` includes the case DTO and the snapshot **summary** (not the full payload — matches `publishReviewSnapshot`'s own "summary in the event, full payload in its own table" convention).

### 4.3 `rejectRoiCase` (AC-05)

```typescript
export interface RejectRoiCaseInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  rejectedBy: string;
  rejectionReason: string;  // required
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

export async function rejectRoiCase(
  input: RejectRoiCaseInput
): Promise<AtomicCommandOutcome<RoiCase>>
```

No self-approval check (matches `rejectDefinitionVersion` — rejecting your own
submission isn't the conflict self-approval-denial exists to prevent). Status
must be `'submitted_for_approval'`. `UPDATE ... SET status='rejected',
rejected_by=$1, rejected_at=now(), rejection_reason=$2, row_version=$3, ...`.
No freeze/unfreeze call — nothing is frozen pre-approval. `buildEvent`:
`roi.case_rejected`.

### 4.4 `requestChangesOnRoiCase` (AC-05, D6)

Structurally identical to §4.3, writing `changes_requested_by`/
`changes_requested_at`/`changes_requested_reason` (required
`changeRequestNotes` field), `toStatus='changes_requested'`, event
`roi.case_changes_requested`.

### 4.5 `reopenApprovedRoiCaseForRevision` (AC-06, D9)

```typescript
export interface ReopenApprovedRoiCaseForRevisionInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  reason: string;  // required, unlike every other command's optional reason
  idempotencyKey: string;
  correlationId?: string;
}

export async function reopenApprovedRoiCaseForRevision(
  input: ReopenApprovedRoiCaseForRevisionInput
): Promise<AtomicCommandOutcome<RoiCase>>
```

`fromStatuses: ['approved']` only (D9/D18 — never Tracking+). `await
unfreezeRoiBaseline(client, {...})`, manually insert `roi.baseline_unfrozen`.
`await unfreezeRoiEconomicModel(client, {...})`, manually insert
`roi.economic_model_unfrozen`. `UPDATE rvn_roi_cases SET status='modeling',
row_version=$1, updated_by=$2, updated_at=now() WHERE case_id=$3` — does
**not** touch `approved_by`/`approved_at`/`original_approved_snapshot_id`/
`latest_approved_snapshot_id`/`decision_calculation_run_id` (history
preserved; those keep pointing at the prior approval until the next
`approveRoiCase` updates `latest_approved_snapshot_id`, per D10).
`buildEvent`: `roi.case_reopened_from_approved`.

### 4.6 `unfreezeRoiBaseline` / `unfreezeRoiEconomicModel`

**Changed** `roiBaselineCommands.ts`:
```typescript
export async function unfreezeRoiBaseline(
  client: PoolClient,
  params: { caseId: string; organizationId: string }
): Promise<void> {
  await client.query(
    `UPDATE rvn_roi_baselines
     SET frozen_at = NULL, frozen_by = NULL, row_version = row_version + 1, updated_at = now()
     WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NOT NULL`,
    [params.caseId, params.organizationId]
  );
}
```

**Changed** `roiEconomicModelFreeze.ts`: `unfreezeRoiEconomicModel(client,
params)`, symmetric five-table `UPDATE ... SET frozen_at=NULL,
frozen_by=NULL ... WHERE frozen_at IS NOT NULL` across policy/assumptions/
cost_lines/benefit_lines/scenarios — same five tables `freezeRoiEconomicModel`
already touches, same idempotent guard shape.

Both called only by `reopenApprovedRoiCaseForRevision` today — same
"contract with initially zero callers" shape `freezeRoiBaseline` had between
E001 and E003.

### 4.7 `reopenRejectedRoiCase` (D8)

**Changed** `roiCaseCommands.ts` — one more call to the existing private
`runRoiCaseLifecycleTransition` helper, alongside `startModeling`/
`markReadyForReview`:

```typescript
export function reopenRejectedRoiCase(
  input: RunRoiCaseLifecycleTransitionInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  return runRoiCaseLifecycleTransition(
    { eventType: 'roi.case_reopened_from_rejected', fromStatuses: ['rejected'], toStatus: 'modeling' },
    input
  );
}
```

No guard needed — reopening a rejected case for another modeling pass has no
readiness precondition.

---

## 5. `ROIApprovalSnapshot` — payload and the read-time defense (D11)

New types file: `server/src/services/resultsVnext/roi/roiApprovalSnapshotTypes.ts`.

```typescript
export interface RoiApprovalSnapshotPayload {
  case: RoiCase;
  baseline: RoiBaseline;
  calculationPolicy: RoiCalculationPolicy;
  assumptions: RoiAssumption[];
  costLines: RoiCostLine[];
  benefitLines: RoiBenefitLine[];
  /** Link metadata only (pinned kpi_id/version/purpose/dispute_status) —
   * never hydrated KPI content, per ROI-E002 D14. Hydration happens only at
   * read time, per current reader. */
  benefitEvidenceLinks: RoiBenefitEvidenceLink[];
  scenarios: RoiScenario[];
  scenarioOverrides: RoiScenarioOverride[];
  decisionCalculationRun: RoiCalculationRun;
}

export interface RoiApprovalSnapshot {
  snapshotId: string;
  caseId: string;
  sequenceNumber: number;
  decisionCalculationRunId: string;
  approvedBy: string;
  approvedAt: string;
  contentHash: string;
  payload: RoiApprovalSnapshotPayload;
  createdAt: string;
}

export interface RoiApprovalSnapshotSummary {
  snapshotId: string;
  caseId: string;
  sequenceNumber: number;
  approvedBy: string;
  approvedAt: string;
  contentHash: string;
}
```

New repository file: `server/src/services/resultsVnext/roi/roiApprovalSnapshotRepository.ts`.

- `listRoiApprovalSnapshots({ userId, organizationId, caseId })` →
  `RoiApprovalSnapshotSummary[]` — visibility-gated via the standard
  `resource_type='roi_case'` join (`::text` cast mandatory). Payload not
  included in the listing (matches `listReviewSnapshots`'s own convention).
- `getRoiApprovalSnapshot({ userId, organizationId, caseId, snapshotId })` →
  `RoiApprovalSnapshot | null`:
  1. Same visibility gate + `AND snapshot_id = $N`. No row → `null`
     (non-distinguishing between "doesn't exist" and "can't see it").
  2. **Read-time redaction (D11's one required layer)**: re-derive the
     CURRENT reader's visible `kpi_id` set via
     `buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' })`
     fresh on every read (never trust anything baked into the frozen JSONB),
     expose `kpiDetails: { kpiId, kpiCode, status } | null` per evidence
     link — response-only, never persisted, never affecting `content_hash`.
  3. Everything else in the payload returned as stored, no further
     redaction — case-level visibility already gated step 1, and no other
     sub-object carries a foreign visibility domain.

`content_hash` is computed once, at `INSERT` time, from the payload as
stored — `getRoiApprovalSnapshot` never recomputes or mutates it. Reading the
same snapshot twice, by any reader, returns the identical `contentHash` every
time; only the response-only `kpiDetails` redaction varies per reader.

---

## 6. Self-approval denial

Confirmed mechanics: server-side, inside `approveRoiCase`'s `applyMutation`,
before any write (`executeAtomicCommand`'s `loadForUpdate` has already run and
locked the row by the time `applyMutation` executes, but nothing is written
until the checks pass). Two checks — `submitted_by`, `created_by` — both deny
(D13). `owner_user_id` deliberately not checked. `rejectRoiCase`/
`requestChangesOnRoiCase` have no self-approval check (matches
`rejectDefinitionVersion`'s precedent).

---

## 7. API surface (Changed file: `server/src/routes/resultsVnext/roi.routes.ts`)

Extends the already-live router — no `Gateway.ts` change, no new
literal-vs-dynamic collision.

| Method | Path | Command/Repository |
|---|---|---|
| `POST` | `/cases/:caseId/transitions/submit-for-approval` | `submitRoiCaseForApproval` |
| `POST` | `/cases/:caseId/transitions/approve` | `approveRoiCase` |
| `POST` | `/cases/:caseId/transitions/reject` | `rejectRoiCase` |
| `POST` | `/cases/:caseId/transitions/request-changes` | `requestChangesOnRoiCase` |
| `POST` | `/cases/:caseId/transitions/reopen-for-revision` | `reopenApprovedRoiCaseForRevision` |
| `POST` | `/cases/:caseId/transitions/reopen-after-rejection` | `reopenRejectedRoiCase` |
| `GET` | `/cases/:caseId/approval-snapshots` | `listRoiApprovalSnapshots` |
| `GET` | `/cases/:caseId/approval-snapshots/:snapshotId` | `getRoiApprovalSnapshot` |

No dedicated "latest"/"original" convenience routes — `GET /cases/:caseId`
already returns both pointer ids; a caller follows up with the detail route.

Validators (add to `resultsVnextRoi.validators.ts`): `submit-for-approval`/
`reopen-after-rejection` reuse the existing case-transition schema shape
(`expectedVersion`/optional `reason`/`idempotencyKey`). `approve` needs the
same shape, no extra field (approver identity from `auth.userId`). New:
`RejectRoiCaseSchema` (`expectedVersion` + required `rejectionReason` +
`idempotencyKey`), `RequestChangesOnRoiCaseSchema` (required
`changeRequestNotes` instead), `ReopenApprovedRoiCaseForRevisionSchema`
(`expectedVersion` + **required** `reason` + `idempotencyKey`).

`handleRoiRouteError` (Changed): add `RoiSelfApprovalDeniedError → 403` as the
first check, ahead of the generic conflict/validation 409 branches.

---

## 8. File list (backend only)

**New:**
- `server/migrations/20260817_rvn_roi_decision_approval.sql`
- `server/src/services/resultsVnext/roi/roiCaseApprovalCommands.ts` (`submitRoiCaseForApproval`, `approveRoiCase`, `rejectRoiCase`, `requestChangesOnRoiCase`, `reopenApprovedRoiCaseForRevision`, `RoiSelfApprovalDeniedError`)
- `server/src/services/resultsVnext/roi/roiApprovalSnapshotTypes.ts`
- `server/src/services/resultsVnext/roi/roiApprovalSnapshotRepository.ts`
- `tests/resultsVnext/roi/roiCaseApproval.realdb.test.ts` (full approve happy path: snapshot inserted, both freeze contracts called, both pointer columns correct on first approval, both frozen events present)
- `tests/resultsVnext/roi/roiCaseApprovalSelfApproval.test.ts` (mocked — both self-approval sub-cases, 403 mapping)
- `tests/resultsVnext/roi/roiCaseReapproval.realdb.test.ts` (AC-06: reopen → edit → resubmit → approve again — `original_approved_snapshot_id` unchanged, `latest_approved_snapshot_id` moved, `sequence_number=2`, two rows, v1's `content_hash` provably unchanged across the whole cycle)
- `tests/resultsVnext/roi/roiCaseSubmitGuard.realdb.test.ts` (AC-01: reach ready_for_review, edit baseline back to ineligible, submit fails; edit-lock proof for both `NON_EDITABLE_STATUSES` paths and the new D4 baseline guard)
- `tests/resultsVnext/roi/roiApprovalSnapshotVisibilityJoin.realdb.test.ts` (`::text` cast; two different readers get different `kpiDetails` for the same evidence link, same `contentHash` both times)
- `tests/resultsVnext/roi/roiApprovalSnapshotFreeze.realdb.test.ts` (post-approval raw UPDATE on a frozen row still blocked; post-reopen editable again; reject/changes-requested leave everything editable)
- `server/src/routes/resultsVnext/__tests__/roiCaseApproval.routes.test.ts`

**Changed:**
- `server/src/services/resultsVnext/roi/roiCaseCommands.ts` — `NON_EDITABLE_STATUSES` gains `'submitted_for_approval'` (D3); `reopenRejectedRoiCase` added (D8).
- `server/src/services/resultsVnext/roi/roiBaselineCommands.ts` — `captureOrUpdateBaseline` gains a case-status guard (D4); `unfreezeRoiBaseline` added.
- `server/src/services/resultsVnext/roi/roiEconomicModelFreeze.ts` — `unfreezeRoiEconomicModel` added.
- `server/src/services/resultsVnext/roi/roiTypes.ts` — `RoiCaseRow`/`RoiCase` gain the four new columns; `toRoiCase` updated.
- `server/src/routes/resultsVnext/roi.routes.ts` — 8 new routes; `handleRoiRouteError` gains the 403 branch.
- `server/src/validators/resultsVnextRoi.validators.ts` — 3 new schemas + params schema.
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — remove `roi_case.decided` (D15); add the 8 new event types listed in §4.
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entries, plus explicit backlog notes for D17 (no approval obligation), D18 (no reopen-from-Tracking path), D20 (no dedicated approver ACL level).

**Read-only reference:** `kpiDefinitionCommands.ts` (`approveDefinitionVersion`/`rejectDefinitionVersion`), `kpiDeviationCommands.ts` (manual same-transaction event insert), `kpiScorecardCommands.ts`/`kpiScorecardRepository.ts` (snapshot pattern), `roiEconomicModelRepository.ts`, `roiEconomicModelReadiness.ts`, `roiCalculationRunCommands.ts`.

---

## 9. Definition of done

- [ ] All 6 new commands work against a real org/Initiative/prior E001/E002 data
- [ ] Self-approval denial proven for both `submitted_by` and `created_by`, 403 mapped
- [ ] AC-01 proven: readiness broken after reaching `ready_for_review` is caught at submit
- [ ] Edit-lock proven for both `NON_EDITABLE_STATUSES` (D3) and the new baseline guard (D4)
- [ ] `approveRoiCase` calls both freeze functions on the same pinned client/transaction — proven by a raw post-approval UPDATE still failing
- [ ] `roi.baseline_frozen`/`roi.economic_model_frozen` events present after approval
- [ ] AC-06 proven end-to-end: reopen → revise → resubmit → reapprove, both pointers correct, v1's hash unchanged
- [ ] Two-layer read redaction proven (different readers, different `kpiDetails`, same `contentHash`)
- [ ] `::text` cast verified on every new join
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Full existing KPI + ROI-E001 + ROI-E002 test suite still green — before/after `git worktree` evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` ROI-E003 rows updated + backlog notes for D17/D18/D20
