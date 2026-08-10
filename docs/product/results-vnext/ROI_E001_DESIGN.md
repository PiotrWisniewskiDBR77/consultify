# ROI-E001 — Case & Baseline — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
First epic of the ROI domain. Backend only — UI Registry is RN-G2.

This document is fully self-contained: full DDL, full function signatures, full
route table. Do not reference "conversation" or an inaccessible transcript for any
part of the spec below — the KPI-E001/E002 incident (EXECUTION_LEDGER §16-18)
established that a fresh implementer has zero access to prior conversation, and an
incomplete design doc caused two real functional gaps that were only caught by
direct code review after the fact. This doc exists so that mistake is not repeated.

---

## 0. Epic boundary (accepted as-is, see Decision D1)

`EPIC_LEDGER_LIVE.md`'s ROI section has no per-AC table for ROI (unlike KPI/OKR) —
only one prose sentence, and a reference to an agent transcript
(`a2714d65fd9b0df12`) that does not exist anywhere in this worktree. The draft
design agent independently re-confirmed this transcript is unreachable. Working
from the one sentence that does exist:

> "ROI-E001 Case & Baseline (6 AC: create z Initiative + duplicate prevention,
> honest missing/N/A na rejestrze, server-side lifecycle guard, period-aware
> baseline bez nadpisania po approval, restricted_acl default)"

Six ACs, accepted verbatim as the scope of this epic:

1. **AC-01** — Create a Case from an Initiative.
2. **AC-02** — Duplicate prevention (one active Case per Initiative).
3. **AC-03** — Registry/list reads show honest missing/N/A, never a fabricated `0`.
4. **AC-04** — Server-side lifecycle guard (transitions are authoritative commands).
5. **AC-05** — Baseline is period-aware and never overwritten once approved.
6. **AC-06** — Default visibility mode for a new Case is `RESTRICTED_ACL`.

**Explicitly out of scope for E001** (owned by later ROI epics per the ledger's
epic split): Submit/Approve/Reject/Changes-Requested (ROI-E003), economic model —
Assumptions/Costs/Benefits/Scenarios/CalculationRun (ROI-E002), Tracking/Benefits
Realization (ROI-E005), PIR (ROI-E006), Finance seam (ROI-E007), Teresa/legacy
(ROI-E008).

---

## 1. Decisions (resolving the draft's 7 open questions)

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Per-AC table for ROI is missing (unlike KPI/OKR); source transcript unreachable. | **Accept the 6-AC prose breakdown verbatim (§0) as the epic's scope.** Do not fabricate a Decision-ID/Aggregate/Command/Schema/Roles table to backfill the missing format — that would manufacture false precision from a sentence that doesn't support it. If ROI-E002/E003 later need finer AC granularity, they derive it from their own ledger prose the same way. | Inventing structure that looks authoritative but isn't sourced from anything real is worse than admitting the source doc is thin here. The 6 ACs are concrete enough to build against. |
| D2 | Does `markReadyForReview`'s completeness guard belong in E001 or wait for E002? | **Implement now, checking only what E001 owns**: baseline must be non-empty (`current_measured_value IS NOT NULL` and at least one of `baseline_period_start`/`baseline_period_end` set). Structure the guard as a single named predicate function `isRoiCaseReadyForReviewEligible(caseRow, baselineRow)` that ROI-E002 is expected to import and extend (add its own compute-freshness check) rather than replace. | Matches the KPI precedent of forward-declaring a narrow, real check now instead of blocking the whole transition on a domain that doesn't exist yet. A named, exported predicate gives E002 an explicit extension point instead of an implicit one it has to discover by reading E001's source. |
| D3 | ACL semantics at case creation under default `RESTRICTED_ACL`. | Creator (`createdBy`) gets an ACL row with `access_level='contribute'`. If `ownerUserId` differs from `createdBy`, `ownerUserId` gets a second `access_level='contribute'` row (both are accountable for the case, not just viewing it). No automatic grant to the Initiative owner or anyone else — that is a cross-domain concern for a later epic to add explicitly if needed, not a default to guess at now. | Minimal, unambiguous, and matches `RESTRICTED_ACL`'s fail-closed design intent: visibility is opt-in, not inferred from Initiative relationships that RN-G1 deliberately keeps out of the visibility resolver. |
| D4 | Does "archive" need a 15th `status` value or a separate flag? | **Separate flag**: `archived_at TIMESTAMPTZ NULL`, `archived_by TEXT NULL` on `rvn_roi_cases`, orthogonal to `status`. `archiveRoiCase` sets these two columns via CAS; it does not change `status`. List/registry reads default to excluding `archived_at IS NOT NULL` rows unless a caller explicitly asks to include archived cases. | Archiving is registry housekeeping ("stop showing me this"), not lifecycle progression — conflating it into the `status` CHECK would let an archived case simultaneously look "closed" or "cancelled" when it might really still be `draft`. Keeping it a flag avoids that ambiguity and avoids growing the CHECK constraint for a non-lifecycle concept. |
| D5 | Should the `freezeRoiBaseline` cross-epic contract be documented once here or duplicated in ROI-E003's doc? | **Once, here** (§4.5). ROI-E003's design doc must reference this document by name and function signature, not restate the contract. | E001 owns the table and the trigger; the single source of truth for "how do you freeze this row" belongs with the owner. |
| D6 | Reserve `submitted_by`/`approved_by`/`rejected_by`/`rejected_at`/`rejection_reason` on `rvn_roi_cases` now, ahead of ROI-E003? | **Yes, reserve now** (nullable, unused by any E001 command). | Matches the `response_policy_id`-ahead-of-KPI-E003 precedent: avoids an `ALTER TABLE` on a live table in a later epic, at zero behavioral cost today (columns are nullable and untouched by any E001 code path). |
| D7 | The pre-existing `roi_case.decided` placeholder in `EVENT_TYPE_CONSUMER_GROUPS` doesn't match this epic's `roi.case_*` naming. | **Leave `roi_case.decided` untouched.** It is scaffolding reserved for ROI-E003 ("decided" = approved/rejected outcome), already fanning to `finance_projection` which is directionally correct for that future event. E001 adds only its own new `roi.case_*`/`roi.baseline_*` keys, in the naming convention established by `kpi.*` event types. ROI-E003's design doc must reconcile whether `roi_case.decided` gets renamed to fit the `roi.case_*` family or stays as-is; not this epic's decision to make. | Renaming a placeholder reserved for a future epic without that epic's context risks guessing its intended payload shape wrong. Leave it alone, flag it forward. |

---

## 2. Legacy collision check (accepted from draft, verified independently reasonable)

`roi_case` / `rvn_roi_*` — **confirmed greenfield**, no naming collision. `roi_case`
only appears today as the RN-G1 platform reservation
(`CanonicalObjectTypeValues`, `RVN_RESOURCE_TYPES`, the CHECK-constraint ALTER
migration) — never as a real table.

Live legacy tables that stay untouched by E001 (archived read-only under
`/legacy/*` is ROI-E008's job, matching KPI-E007's pattern, not this epic's):
`roi_assumptions`, `roi_realized_values`, `analysis_financials`/
`digitization_analyses` (backs the pre-existing `/roi` Initiatives-module route,
`FullROIView.tsx` — a different UI, not touched), `initiative_benefits`,
`benefits_register`, `v8_roi_realization_entries`, `financial_roi_links` (Finance/
M16 — live, integration only via ROI-E007's pinned seam, never direct coupling).

`initiatives.id` is `TEXT`, not `UUID` — confirmed by `roi_assumptions
.initiative_id TEXT` and `rvn_kpi_initiative_impacts`'s own comment
(`migrations-v2/001_baseline_20260413.sql:15856`). `rvn_roi_cases.initiative_id`
must be `TEXT REFERENCES initiatives(id)`.

---

## 3. Schema (full DDL)

Migration file: `server/migrations/20260815_rvn_roi_core.sql`.

Visibility is **platform-owned**, not domain-owned (RN-G1 §C.3's explicit warning
against a fourth parallel resource-naming taxonomy) — `rvn_roi_cases` carries no
`visibility_mode`/`visibility_policy_id` columns. Visibility lives exclusively in
`rvn_platform_resource_visibility` (`resource_type='roi_case'`) and
`rvn_platform_resource_acl`, exactly like `rvn_kpi_definitions`.

```sql
-- ============================================================
-- rvn_roi_cases — root aggregate
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_cases (
  case_id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                TEXT NOT NULL,
  initiative_id                  TEXT NOT NULL REFERENCES initiatives(id),
  title                          TEXT NOT NULL,
  owner_user_id                  TEXT NOT NULL,

  -- Full lifecycle forward-declared now so ROI-E003/E005/E006 never ALTER
  -- this CHECK — same trick rvn_kpi_definitions.response_policy_id used
  -- ahead of KPI-E003.
  status                         TEXT NOT NULL DEFAULT 'draft'
                                    CHECK (status IN (
                                      'not_started','draft','modeling','ready_for_review',
                                      'submitted_for_approval','changes_requested','approved',
                                      'rejected','tracking','benefits_realization',
                                      'post_investment_review_due','post_investment_review',
                                      'closed','cancelled'
                                    )),

  currency                       TEXT NOT NULL,
  granularity                    TEXT NOT NULL DEFAULT 'monthly'
                                    CHECK (granularity IN ('monthly','annual')),
  analysis_start                 DATE NULL,
  analysis_end                   DATE NULL,

  -- FKs to E002/E003 tables intentionally omitted (those tables don't exist
  -- yet) — plain nullable UUID columns now, FK ALTERed by the epic that
  -- creates the referenced table, same resolution rvn_kpi_definitions.
  -- current_definition_version_id used ahead of its own FK.
  original_approved_snapshot_id  UUID NULL,
  latest_approved_snapshot_id    UUID NULL,
  current_forecast_version_id    UUID NULL,
  current_actual_snapshot_id     UUID NULL,

  next_action_type               TEXT NULL,
  next_action_due_at             TIMESTAMPTZ NULL,
  next_review_at                 TIMESTAMPTZ NULL,

  -- Reserved ahead of ROI-E003 (Decision D6) — nullable, untouched by any
  -- E001 command.
  submitted_by                   TEXT NULL,
  submitted_at                   TIMESTAMPTZ NULL,
  approved_by                    TEXT NULL,
  approved_at                    TIMESTAMPTZ NULL,
  rejected_by                    TEXT NULL,
  rejected_at                    TIMESTAMPTZ NULL,
  rejection_reason               TEXT NULL,

  -- Archive flag, orthogonal to status (Decision D4).
  archived_at                    TIMESTAMPTZ NULL,
  archived_by                    TEXT NULL,

  row_version                    INT NOT NULL DEFAULT 1,
  created_by                     TEXT NOT NULL,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                     TEXT NULL,
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_roi_cases_org_status
  ON rvn_roi_cases(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_cases_initiative
  ON rvn_roi_cases(organization_id, initiative_id);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_cases_org_archived
  ON rvn_roi_cases(organization_id, archived_at);

-- AC-02: one active Case per Initiative. Cancelled/closed cases don't
-- block a new one — same shape as
-- ux_rvn_kpi_initiative_impacts_one_active.
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_cases_one_active_per_initiative
  ON rvn_roi_cases(organization_id, initiative_id)
  WHERE status NOT IN ('cancelled','closed');

-- ============================================================
-- rvn_roi_baselines — 1:1 child, period-aware, freezable
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_baselines (
  baseline_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                        UUID NOT NULL UNIQUE REFERENCES rvn_roi_cases(case_id),
  organization_id                TEXT NOT NULL,

  -- AC-05 "period-aware": nullable — an empty shell row is created
  -- alongside the Case and stays incomplete until filled in; incomplete
  -- is a legitimate 'modeling'-state row, not an error (honest-missing
  -- philosophy, AC-03).
  baseline_period_start          DATE NULL,
  baseline_period_end            DATE NULL,
  current_measured_value         NUMERIC NULL,
  current_measured_unit          TEXT NULL,
  current_measured_as_of         DATE NULL,
  bau_projection_method          TEXT NOT NULL DEFAULT 'flat'
                                    CHECK (bau_projection_method IN ('flat','growth_rate','custom')),
  bau_growth_rate_pct            NUMERIC NULL,
  bau_reference_value            NUMERIC NULL,
  intervention_comparison_notes  TEXT NULL,
  source                         TEXT NULL,
  confidence                     TEXT NULL CHECK (confidence IN ('low','medium','high')),
  owner_user_id                  TEXT NULL,

  -- Local freeze flag — NOT a read of rvn_roi_cases.status (see §4.5 for
  -- why this must be self-contained rather than cross-table).
  frozen_at                      TIMESTAMPTZ NULL,
  frozen_by                      TEXT NULL,

  row_version                    INT NOT NULL DEFAULT 1,
  created_by                     TEXT NOT NULL,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_roi_baselines_org
  ON rvn_roi_baselines(organization_id, case_id);

CREATE OR REPLACE FUNCTION rvn_roi_baselines_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.baseline_period_start IS DISTINCT FROM OLD.baseline_period_start
       OR NEW.baseline_period_end IS DISTINCT FROM OLD.baseline_period_end
       OR NEW.current_measured_value IS DISTINCT FROM OLD.current_measured_value
       OR NEW.current_measured_unit IS DISTINCT FROM OLD.current_measured_unit
       OR NEW.current_measured_as_of IS DISTINCT FROM OLD.current_measured_as_of
       OR NEW.bau_projection_method IS DISTINCT FROM OLD.bau_projection_method
       OR NEW.bau_growth_rate_pct IS DISTINCT FROM OLD.bau_growth_rate_pct
       OR NEW.bau_reference_value IS DISTINCT FROM OLD.bau_reference_value
       OR NEW.intervention_comparison_notes IS DISTINCT FROM OLD.intervention_comparison_notes
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.confidence IS DISTINCT FROM OLD.confidence
    THEN
      RAISE EXCEPTION
        'rvn_roi_baselines: baseline % is frozen — only row_version/updated_at bookkeeping may change',
        OLD.baseline_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_roi_baselines_protect_frozen ON rvn_roi_baselines;
CREATE TRIGGER trg_rvn_roi_baselines_protect_frozen
  BEFORE UPDATE ON rvn_roi_baselines
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_baselines_protect_frozen();
```

---

## 4. Command layer (`server/src/services/resultsVnext/roi/`)

### 4.1 `createRoiCase` — `executeAtomicCreate`

Mirrors `createKpiDraft`: fail-closed on no active `domain='roi'` visibility
policy (`RoiCaseNoActiveVisibilityPolicyError`), one INSERT into
`rvn_roi_cases`, one INSERT into `rvn_roi_baselines` (empty shell), one
`rvn_platform_resource_visibility` row, plus:

1. **ACL grants** (Decision D3): `INSERT INTO rvn_platform_resource_acl
   (resource_type='roi_case', resource_id=caseId::text, grantee_type='user',
   grantee_id=createdBy, access_level='contribute', granted_by=createdBy)`, and
   a second identical row for `ownerUserId` if `ownerUserId !== createdBy`.
2. **Obligation**: reuse `createObligation` from
   `platform/obligations.ts` (already generic), `reference_type='roi_case'`,
   `obligation_type='start_roi_study'`,
   `deduplication_key = ${organizationId}:roi_case:${caseId}:start_roi_study`,
   on the same pinned client inside `applyMutation`.

```typescript
export interface CreateRoiCaseInput {
  organizationId: string;
  initiativeId: string;
  title: string;
  ownerUserId: string;
  currency: string;
  granularity?: 'monthly' | 'annual';
  analysisStart?: string | null;
  analysisEnd?: string | null;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface CreateRoiCaseResult {
  case: RoiCase;
  baseline: RoiBaseline;
  /** false when a pre-existing active Case for this Initiative was found
   * and returned instead of creating a new one — AC-02's idempotent-
   * duplicate behavior, distinct from the idempotencyKey retry mechanism
   * executeAtomicCreate already provides. */
  created: boolean;
}

export async function createRoiCase(
  input: CreateRoiCaseInput
): Promise<AtomicCommandOutcome<CreateRoiCaseResult>>
```

**Concurrency for AC-02**: pre-check with a plain `SELECT case_id FROM
rvn_roi_cases WHERE organization_id=$1 AND initiative_id=$2 AND status NOT IN
('cancelled','closed')` first (cheap path, no race). For the racing case, wrap the
candidate INSERT in `SAVEPOINT roi_case_create`, catch Postgres `23505` on
`ux_rvn_roi_cases_one_active_per_initiative`, `ROLLBACK TO SAVEPOINT
roi_case_create`, re-`SELECT` the winning row, return it with `created: false`
instead of throwing. This is the exact fix already discovered and applied in
`openOrEscalateDeviationCase` (EXECUTION_LEDGER §20) — a naive catch-then-retry-
SELECT without the SAVEPOINT fails with Postgres `25P02` (transaction aborted),
because a failed statement aborts the whole transaction, not just itself. Build
this in from the start; do not rediscover it.

### 4.2 `updateRoiCaseDetails`, `archiveRoiCase` — `executeAtomicCommand`

`updateRoiCaseDetails`: `row_version`-CAS update of `title`/`ownerUserId`/
`currency`/`granularity`/`analysisStart`/`analysisEnd`. Guard: `status NOT IN
('approved','rejected','tracking','benefits_realization',
'post_investment_review_due','post_investment_review','closed','cancelled')` —
these fields are pre-approval, author-editable only.

`archiveRoiCase`: `row_version`-CAS setting `archived_at = now()`,
`archived_by = actorId`. Does not touch `status` (Decision D4). No status
restriction — a case in any status may be archived (it's a registry-visibility
action, not a lifecycle one). Idempotent: calling it again on an already-archived
case is a no-op success, not an error.

### 4.3 `startModeling`, `markReadyForReview` — generic guarded transition

Same `runKpiLifecycleTransition`-shaped helper (`fromStatuses`/`toStatus`/guard),
renamed `runRoiCaseLifecycleTransition`:

```typescript
runRoiCaseLifecycleTransition({
  eventType: 'roi.case_modeling_started',
  fromStatuses: ['draft'],
  toStatus: 'modeling',
}, input);

runRoiCaseLifecycleTransition({
  eventType: 'roi.case_ready_for_review',
  fromStatuses: ['modeling'],
  toStatus: 'ready_for_review',
  guard: (caseRow, baselineRow) => isRoiCaseReadyForReviewEligible(caseRow, baselineRow),
}, input);
```

`isRoiCaseReadyForReviewEligible` (Decision D2), exported from
`roiCaseCommands.ts` so ROI-E002 can import and extend it rather than replace it:

```typescript
/** E001's own check: baseline has at minimum a measured value and a
 * reference period. ROI-E002 is expected to layer its own compute-
 * freshness/required-sections check on top of this, e.g.:
 *   isRoiCaseReadyForReviewEligible(c, b) && hasSuccessfulFreshCalculationRun(c)
 * — do not replace this function's body when E002 lands; wrap it.
 */
export function isRoiCaseReadyForReviewEligible(
  caseRow: RoiCaseRow,
  baselineRow: RoiBaselineRow
): { eligible: boolean; reason?: string } {
  if (baselineRow.current_measured_value === null) {
    return { eligible: false, reason: 'baseline_measured_value_missing' };
  }
  if (baselineRow.baseline_period_start === null && baselineRow.baseline_period_end === null) {
    return { eligible: false, reason: 'baseline_period_missing' };
  }
  return { eligible: true };
}
```

On guard failure, throw a typed `RoiCaseNotReadyForReviewError` (409) carrying the
`reason` string — matches the pattern of every other typed lifecycle-guard error
in the KPI domain (`SelfApprovalDeniedError`, `DeviationSelfApprovalDeniedError`,
etc.), never a bare 400/500.

### 4.4 `captureOrUpdateBaseline` — `executeAtomicCommand`

Baseline row always exists from creation (§4.1) — always an update on
`rvn_roi_baselines.row_version`, never a create/upsert branch. Guard:
`currentRow.frozen_at !== null` → `RoiBaselineFrozenError` (typed, 409). No
self-approval check — capturing/editing your own baseline pre-freeze is a normal
author action (matches KPI: `editDraft` has no self-approval check either).

```typescript
export interface CaptureOrUpdateBaselineInput {
  organizationId: string;
  caseId: string;
  expectedVersion: number;
  baselinePeriodStart?: string | null;
  baselinePeriodEnd?: string | null;
  currentMeasuredValue?: number | null;
  currentMeasuredUnit?: string | null;
  currentMeasuredAsOf?: string | null;
  bauProjectionMethod?: 'flat' | 'growth_rate' | 'custom';
  bauGrowthRatePct?: number | null;
  bauReferenceValue?: number | null;
  interventionComparisonNotes?: string | null;
  source?: string | null;
  confidence?: 'low' | 'medium' | 'high' | null;
  ownerUserId?: string | null;
  actorId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
}

export async function captureOrUpdateBaseline(
  input: CaptureOrUpdateBaselineInput
): Promise<AtomicCommandOutcome<RoiBaseline>>
```

### 4.5 `freezeRoiBaseline` — cross-epic contract owned by E001 (Decision D5)

```typescript
/** Called by ROI-E003's future approveRoiCase, on the SAME pinned client,
 * inside the SAME transaction as the case-approval CAS — the pattern
 * recordMeasurement -> openOrEscalateDeviationCase established
 * (KPI_E003_DESIGN.md decision #3). This function does NOT open its own
 * transaction and does NOT check case status itself — the caller
 * (ROI-E003) is responsible for calling this only when the case
 * transition it is CASing actually reaches 'approved'.
 *
 * ROI-E003's design doc must reference this function by name rather than
 * restate the contract (Decision D5).
 */
export async function freezeRoiBaseline(
  client: PoolClient,
  params: { caseId: string; organizationId: string; frozenBy: string }
): Promise<void> {
  await client.query(
    `UPDATE rvn_roi_baselines
     SET frozen_at = now(), frozen_by = $3, row_version = row_version + 1, updated_at = now()
     WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NULL`,
    [params.caseId, params.organizationId, params.frozenBy]
  );
}
```

Rationale for a **local** `frozen_at` column instead of a cross-table trigger
read on `rvn_roi_cases.status`: a baseline UPDATE and a case-approval UPDATE
take `SELECT...FOR UPDATE` locks on two different rows, so "check case status
inside the baseline trigger" cannot be made atomic with the approval CAS itself.
"E003's approval transaction calls `freezeRoiBaseline` on the same client before
COMMIT" makes freeze-and-approve atomic by construction, and the trigger only
needs to check a column on the row it already holds a lock on.

---

## 5. Visibility wiring

- `RVN_RESOURCE_TYPES` already contains `'roi_case'`
  (`resourceTypes.ts:21`) — no change needed. `CanonicalObjectTypeValues`
  (`myWorkRoofPackage.ts:43`) already has `'roi_case'` too. No changes to either
  SSOT required by this epic.
- `getActiveVisibilityPolicy(client, { organizationId, domain: 'roi' })` — same
  function KPI uses, `domain: 'roi'`. **No policy row is seeded by this epic's
  migration** — policy seeding is a rollout script per-org (RN-G1 decision,
  EXECUTION_LEDGER §7), never a data migration. Every org must have its
  `domain='roi'` policy authored (mode = `RESTRICTED_ACL` per AC-06) before
  `createRoiCase` can succeed there; until then `createRoiCase` throws
  `RoiCaseNoActiveVisibilityPolicyError` — same fail-closed shape as
  `KpiNoActiveVisibilityPolicyError`.
- `listRoiCases`/`getRoiCase`/`getRoiBaseline` go through
  `buildVisibilityScopedCte`/`wrapWithVisibilityScope({ resourceType: 'roi_case' })`
  exclusively — never a raw `WHERE organization_id=?`. `list`/`get` both filter
  out `archived_at IS NOT NULL` rows by default (Decision D4); an explicit
  `includeArchived=true` query param is required to see them.
- `rvn_platform_resource_visibility.resource_id` is `TEXT`;
  `rvn_roi_cases.case_id` is `UUID` — **every join must cast `::text`** on the
  UUID side (`vr.resource_id = rc.case_id::text`). This exact cast was missed in
  7 places across 3 files in the KPI domain and only caught by a dedicated
  realDB join-regression test after the fact (EXECUTION_LEDGER §24) — write
  `roiVisibilityJoin.realdb.test.ts` (§8) before, not after, shipping this.
- `rvn_roi_baselines` carries no visibility row of its own — inherits via
  `case_id`, same `::text` cast requirement applies to that join too.

---

## 6. Self-approval denial

E001 has no maker-checker action of its own — `createRoiCase`,
`updateRoiCaseDetails`, `archiveRoiCase`, `startModeling`, `markReadyForReview`,
`captureOrUpdateBaseline` are all single-actor, self-serve commands. Self-approval
denial belongs to ROI-E003's `approveRoiCase`, which must check
`submitted_by === approverId` first, inside `applyMutation`, before any write
(`SelfApprovalDeniedError`, 403) — same pattern as `approveDefinitionVersion`.
The `submitted_by`/`approved_by`/`rejected_by` columns this depends on are
already reserved on `rvn_roi_cases` per Decision D6.

---

## 7. API surface (`server/src/routes/resultsVnext/roi.routes.ts`)

Mounted at `/api/vnext/results/roi` in `Gateway.ts`. Read `kpi.routes.ts` first
and copy its exact import names/paths for `apiAuthRateLimiter`, `verifyToken`,
`requireOrgAccess`, `demoContextMiddleware`, `resolveIdempotencyKey`,
`getCorrelationId`, and its error-mapper shape — do not guess these, they are one
`Read` away.

| Method | Path | Command/Repository |
|---|---|---|
| `POST` | `/cases` | `createRoiCase` |
| `GET` | `/cases` | `listRoiCases` |
| `GET` | `/cases/:caseId` | `getRoiCase` |
| `PATCH` | `/cases/:caseId` | `updateRoiCaseDetails` |
| `POST` | `/cases/:caseId/archive` | `archiveRoiCase` |
| `POST` | `/cases/:caseId/transitions/start-modeling` | `startModeling` |
| `POST` | `/cases/:caseId/transitions/ready-for-review` | `markReadyForReview` |
| `GET` | `/cases/:caseId/baseline` | `getRoiBaseline` |
| `PUT` | `/cases/:caseId/baseline` | `captureOrUpdateBaseline` |

`GET /cases` query params: `ListRoiCasesQuerySchema` — `{ status:
RoiCaseStatusEnum.optional(), includeArchived: z.coerce.boolean().optional(),
limit: z.coerce.number().int().positive().max(500).optional(), offset:
z.coerce.number().int().nonnegative().optional() }` — matches
`ListKpisQuerySchema`'s shape plus the one ROI-specific `includeArchived` flag.

Explicitly **not** in this package: `/cases/:caseId/history`, all
assumption/cost/benefit-line/scenario/calculation-run endpoints (ROI-E002),
`/transitions/submit|approve|reject|...`/`/reapprove` (ROI-E003), `/actuals`/
`/variances`/`/post-investment-review` (ROI-E004/E006), `/finance-links` (ROI-E007),
`/legacy/*` (ROI-E008).

**Mount-order note**: `GET /cases/:caseId` is a single dynamic segment. Any
future sub-router mounted under `/api/vnext/results/roi/cases` with a literal
path segment (e.g. a future `/cases/legacy`) must be registered in `Gateway.ts`
before this router — same class of bug fixed twice already in the KPI domain
(`kpiDeviation.routes.ts`, `kpiScorecard.routes.ts`). Not an active collision
within this epic's own endpoint set, but state it in the route file's header
comment for whoever adds the next ROI router.

Validators: `server/src/validators/resultsVnextRoi.validators.ts`, redeclaring
shared field helpers locally (`idempotencyKeyField`/`expectedVersionField`/
`isoDateTimeString`) rather than importing them, matching every existing
`resultsVnextKpi*.validators.ts` file's stated convention.

---

## 8. File list (backend only)

**New:**
- `server/migrations/20260815_rvn_roi_core.sql`
- `server/src/services/resultsVnext/roi/roiTypes.ts` (Row/DTO types, `toRoiCase`/`toRoiBaseline`; reuse `toNullableNumber` from `kpi/kpiTypes.ts` rather than restating it)
- `server/src/services/resultsVnext/roi/roiCaseCommands.ts` (`createRoiCase`, `updateRoiCaseDetails`, `archiveRoiCase`, `startModeling`, `markReadyForReview`, `isRoiCaseReadyForReviewEligible`, `RoiCaseValidationError`, `RoiCaseNoActiveVisibilityPolicyError`, `RoiCaseNotReadyForReviewError`)
- `server/src/services/resultsVnext/roi/roiBaselineCommands.ts` (`captureOrUpdateBaseline`, `freezeRoiBaseline`, `RoiBaselineFrozenError`)
- `server/src/services/resultsVnext/roi/roiRepository.ts` (`listRoiCases`, `getRoiCase`, `getRoiBaseline` — all via `buildVisibilityScopedCte`/`wrapWithVisibilityScope`)
- `server/src/services/resultsVnext/roi/README.md` (status note, matching `platform/README.md`/`kpi/README.md` convention)
- `server/src/routes/resultsVnext/roi.routes.ts`
- `server/src/validators/resultsVnextRoi.validators.ts`
- `tests/resultsVnext/roi/roiCaseCreate.test.ts` (unit — SAVEPOINT dedupe race, no-active-policy fail-closed)
- `tests/resultsVnext/roi/roiBaselineFreeze.realdb.test.ts` (realDB — trigger blocks mutation once `frozen_at` set)
- `tests/resultsVnext/roi/roiVisibilityJoin.realdb.test.ts` (realDB — RESTRICTED_ACL owner-sees/outsider-doesn't, `::text` cast correctness)
- `tests/resultsVnext/roi/roiCaseLifecycle.realdb.test.ts` (realDB — startModeling/markReadyForReview guard behavior, archive flag independence from status)
- `server/src/routes/resultsVnext/__tests__/roi.routes.test.ts`

**Changed:**
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — add to `EVENT_TYPE_CONSUMER_GROUPS`: `roi.case_created`, `roi.case_details_updated`, `roi.case_archived`, `roi.case_modeling_started`, `roi.case_ready_for_review`, `roi.baseline_captured`, `roi.baseline_updated`, `roi.baseline_frozen`. Do **not** touch the pre-existing `roi_case.decided` entry (Decision D7).
- `server/src/Gateway.ts` (mount `roi.routes.ts`)
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` (ROI-E001 rows → implemented)
- `docs/product/results-vnext/EXECUTION_LEDGER.md` (closure entry)

**Read-only reference (do not modify):**
- `server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts`, `kpiRepository.ts`, `kpi.routes.ts` — structural template
- `server/src/services/resultsVnext/kpi/kpiDeviationCommands.ts` (`openOrEscalateDeviationCase`) — SAVEPOINT pattern source
- `server/src/services/resultsVnext/platform/atomicWrite.ts`, `visibilityResolver.ts`, `visibilityScopedQuery.ts`, `obligations.ts`, `resourceTypes.ts` — platform primitives

---

## 9. Mandatory testing discipline (standing rule, repeated per package)

Every new repository function in `roiRepository.ts` and every new command in
`roiCaseCommands.ts`/`roiBaselineCommands.ts` needs a direct real-Postgres test,
not only a mocked route test. This has caught a real bug in every KPI epic where
it was applied and would have caught the TEXT/UUID cast bug (§24) months earlier
had it been standing practice from KPI-E001. Do not skip it here just because the
pattern is now familiar — familiarity is exactly when shortcuts get taken.

## 10. Definition of done

- [ ] All 9 endpoints work against a real org with a real Initiative row
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] SAVEPOINT dedupe race test passes (two concurrent `createRoiCase` calls for the same Initiative, one wins, one gets `created: false` with the winning row, neither throws an unhandled error)
- [ ] `roiVisibilityJoin.realdb.test.ts` passes (RESTRICTED_ACL owner-sees/outsider-doesn't, `::text` cast verified against real Postgres, not assumed)
- [ ] `roiBaselineFreeze.realdb.test.ts` passes (trigger blocks post-freeze mutation)
- [ ] Full existing KPI test suite still green — before/after evidence, not just a claimed number (per the KPI-E007 lesson: the "215/215" figure could not be reproduced on a fresh build and had to be re-baselined honestly)
- [ ] EXECUTION_LEDGER.md closure entry written (design → build → verify, calibrated, no unverified "zero regressions" claims)
- [ ] EPIC_LEDGER_LIVE.md ROI-E001 rows updated
