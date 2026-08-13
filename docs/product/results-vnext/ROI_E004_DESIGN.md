# ROI-E004 — Forecast & Actual — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
Fourth epic of the ROI domain, builds on ROI-E001/E002/E003, all landed.
Backend only — UI Registry is RN-G2.

Closes both of ROI-E001's remaining reserved pointer columns:
`current_forecast_version_id`, `current_actual_snapshot_id`.

---

## 0. Epic boundary (accepted as-is)

Per `EPIC_LEDGER_LIVE.md`'s prose:

> "ROI-E004 Forecast & Actual (6 AC: forecast nigdy nie mutuje Approved,
> append-only Actual z correction-reference, Actual Verifier rola, compare
> view z osobnymi stanami missing, Variance ze strukturą cause+contribution,
> disputed evidence nigdy nie nadpisuje Actual)"

Six ACs, accepted verbatim:

1. **AC-01** — Forecast never mutates Approved.
2. **AC-02** — Actual is append-only, corrections reference the corrected entry.
3. **AC-03** — An "Actual Verifier" role/state exists.
4. **AC-04** — Compare view has separate, distinguishable missing states.
5. **AC-05** — Variance has a cause+contribution structure.
6. **AC-06** — Disputed evidence never overwrites Actual.

**Confirmed prerequisites** (re-verified in the design draft, not assumed): no
existing command transitions a case to `'tracking'`; `approveRoiCase` leaves
status at `'approved'` permanently; `NON_EDITABLE_STATUSES` already blocks
edits to Case/Baseline/EconomicModel fields in every post-approval status but
says nothing about the new tables this epic adds; `createRoiCalculationRun` is
gated to `modeling`/`ready_for_review` only and is not reusable unmodified for
Tracking-phase reforecasting.

---

## 1. Decisions

All 13 decision points from the design draft are ratified as specified
(D1-D13), with **one explicit override** (D10) and the draft's 7 open
questions resolved as D14-D20.

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Does E004 own the `'approved' → 'tracking'` transition? | **Yes.** New `startRoiCaseTracking`, `fromStatuses: ['approved']`, hand-written (not the generic transition helper, since it has a side effect). | Nothing else claims it. Source plan §4.1/§9.4 name the transition and route explicitly. |
| D2 | Does `startRoiCaseTracking` create a MyWork obligation? | **Yes**, `obligation_type='track_roi_forecast_actuals'`, assignee = case `owner_user_id`. | Mirrors `createRoiCase`'s own obligation. No source doc names the exact type string — this is a reasonable, explicitly flagged choice, not a guess presented as fact. |
| D3 | Do Forecast/Actual/Variance writes require `'tracking'` specifically, or is `'approved'` enough? | **Require `ROI_TRACKING_ACTIVE_STATUSES`** (`tracking, benefits_realization, post_investment_review_due, post_investment_review`), new exported constant. | Plan ties forecast/actual cadence specifically to Tracking's activation, not to the frozen Approved state itself. |
| D4 | Does ForecastVersion reuse `roiCalculationEngine.ts` directly? | **Yes, unmodified.** The engine already accepts `scenarioType:'custom'` + caller-supplied `scenarioOverrides`, with no DB dependency on `rvn_roi_scenario_overrides` rows existing. | Confirmed by reading `applyCustomScenario` — it only reads `input.scenarioOverrides`, never a table. Exactly the seam this need requires, already present. |
| D5 | How does the forecast command build engine input without re-deriving the DATE-deserialization fix or row-mapping logic? | **Export** (currently module-private) `toDateOnlyString`, `assumptionRowToEngine`, `costLineRowToEngine`, `benefitLineRowToEngine`, `policyStampObject` from `roiCalculationRunCommands.ts` — purely additive. | Matches the exact "export what was module-private" precedent ROI-E002 used for `NON_EDITABLE_STATUSES`. Re-deriving risks reintroducing the bug §32 already fixed once. |
| D6 | Does `current_forecast_version_id` track only "latest," or an original+latest pair like ApprovalSnapshot? | **Latest only.** Full history lives in `rvn_roi_forecast_versions`, queryable by sequence. | ROI-E001 reserved exactly one column for this, unlike the two separate columns reserved for approval snapshots — the schema itself signals intent. |
| D7 | Can a Forecast extend the analysis horizon beyond the approved window? | **No — locked to the approved window.** | Keeps Approved/Forecast/Actual comparisons well-defined over the same period grid. No AC calls for horizon extension; flagged as a named, real gap (§9) rather than silently built or silently dropped. |
| D8 | What fills `current_actual_snapshot_id`, given only append-only `ROIActualEntry` is named anywhere? | **Build `rvn_roi_actual_snapshots`** — an immutable, periodically-published rollup of current (non-superseded) entries. **Ratified as designed.** | Completes the Approved/Forecast/Actual three-way symmetry the plan repeatedly emphasizes, gives the reserved column an actual referent, avoids a portfolio-scale live rollup on every read. This is a genuine gap-fill, explicitly named as such rather than presented as a directly-sourced requirement. |
| D9 | Is Variance stored or computed live? | **Both, for different jobs.** `GET .../compare` is pure, computed live, never persisted (satisfies AC-04's freshness need). `rvn_roi_variances`/`rvn_roi_variance_causes` are stored, human-curated, fact-immutable-after-creation (satisfies AC-05's durable cause+contribution structure). **Ratified as designed.** | AC-04 and AC-05 have genuinely different needs (always-fresh vs. durably-explained) that no single mechanism satisfies simultaneously. |
| D10 | Should verifying an Actual entry check the verifier isn't its own recorder? | **OVERRIDE the draft's recommendation — add the check.** `verifyActualEntry` throws `RoiActualSelfVerificationDeniedError` (403) if `verifierId === recordedBy` of the entry (or entry chain's original recorder) being verified. | The draft recommended no check, matching KPI precedent (`verifyMeasurement` has none). Overridden here because AC-03 explicitly names an "Actual Verifier **role**" — language implying separation of duties was intended, unlike KPI's measurement verification which never used "role" language. ROI's financial stakes are also higher than KPI's. This is a deliberate strengthening beyond precedent, not a blind extension of it — cheap to add (one identity check, same shape as two prior self-approval checks in this program) and directly serves a named AC. |
| D11 | Does E004 build a `reopenFromTrackingRoiCase` command (ROI-E003's D18)? | **No — still deferred**, more specifically now (real Forecast/Actual/Variance data exists, so the decision of what happens to it on reopen is more consequential, not less). | None of E004's 6 ACs name it; genuinely ambiguous (invalidate vs. preserve existing tracking data), no source doc resolves it. |
| D12 | Does an Actual entry need a typed KPI-evidence link (mirroring `RoiBenefitEvidenceLink`)? | **No.** Free-text `evidence_refs JSONB`, same shape KPI measurements already use. | No AC names it; the benefit line's own evidence link already provides KPI backing for the *approved model*. Flagged as a real possible future need (§9), not built now. |
| D13 | New `resource_type` for visibility? | **No.** Every new table inherits visibility via `case_id` only. | Nothing in the 6 ACs calls for finer-than-case visibility. Matches every prior ROI epic's default. |
| D14 (resolves OQ1) | ROI-E004/E005 boundary — is the inference (E004=mechanics, E005=Benefits-Realization-transition + consumes E004's data) correct? | **Confirmed.** E004 owns Tracking/Forecast/Actual/Variance mechanics. E005 (Benefits Realization) owns the `'tracking'→'benefits_realization'` transition and computes "realization %" FROM this epic's stored data — it builds no new Forecast/Actual/Variance primitives of its own. | This inference is the only reading consistent with E005's own AC list (independent-of-Initiative-closure, obligations survive closure, realization % "from governed data") — E005's ACs presuppose E004's data already exists to compute from. |
| D15 (resolves OQ2) | Reopening from Tracking (D11) — any further resolution? | **Still deferred, unchanged from D11.** File explicitly in the ledger as a named, unresolved cross-epic gap — not implicitly assumed away. | No new information changes the calculus from D11's own reasoning. |
| D16 (resolves OQ3) | Confirm both-mechanisms approach for Variance (D9)? | **Confirmed, as stated in D9.** | No new consideration changes this. |
| D17 (resolves OQ4) | Confirm building `rvn_roi_actual_snapshots` (D8)? | **Confirmed, as stated in D8.** | No new consideration changes this. |
| D18 (resolves OQ5) | Self-verification check — resolved by D10's override. | **See D10.** | — |
| D19 (resolves OQ6) | Typed KPI-evidence link on Actual entries — build now? | **No**, confirmed per D12. File as backlog note (§9) for a future epic if a real need for pinned-KPI-backed actuals surfaces. | Consistent with D12's reasoning; no AC calls for it now. |
| D20 (resolves OQ7) | Forecast horizon extension — build now? | **No**, confirmed per D7. File as backlog note (§9). | Consistent with D7's reasoning. |

---

## 2. Legacy collision check (accepted from draft)

`rvn_roi_forecast_versions`, `rvn_roi_actual_entries`, `rvn_roi_actual_snapshots`,
`rvn_roi_variances`, `rvn_roi_variance_causes` — confirmed greenfield, zero
collisions. Table names taken from `03_ROI_IMPLEMENTATION_PLAN.md` §10 where
named; `rvn_roi_actual_snapshots` is this design's own addition (D8/D17).

---

## 3. Schema (full DDL)

Migration file: `server/migrations/20260818_rvn_roi_forecast_actual.sql`. Zero
new columns on `rvn_roi_cases` — only two `ALTER ... ADD CONSTRAINT`
statements closing ROI-E001's two reservations, at the end, same pattern
ROI-E003 already used for its own three FKs onto E001-reserved columns.

```sql
-- ============================================================
-- rvn_roi_forecast_versions — immutable, AC-01
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_forecast_versions (
  forecast_version_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                       UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id               TEXT NOT NULL,

  sequence_number                INT NOT NULL,
  reason                         TEXT NOT NULL,
  published_by                   TEXT NOT NULL,
  published_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- AC-01: explicit pin of what this forecast is measured against — never
  -- re-derived implicitly at read time.
  compared_against_snapshot_id   UUID NOT NULL REFERENCES rvn_roi_approval_snapshots(snapshot_id),

  engine_version                  TEXT NOT NULL,
  policy_version_stamp            TEXT NOT NULL,
  input_overrides                 JSONB NOT NULL DEFAULT '[]',
  input_snapshot                  JSONB NOT NULL,
  input_hash                      TEXT NOT NULL,

  status                          TEXT NOT NULL CHECK (status IN ('completed','failed')),
  total_costs                      NUMERIC NULL,
  total_financial_benefits         NUMERIC NULL,
  simple_roi                       NUMERIC NULL,
  npv                              NUMERIC NULL,
  irr_pct                          NUMERIC NULL,
  irr_status                       TEXT NOT NULL DEFAULT 'not_applicable'
                                      CHECK (irr_status IN ('computed','not_applicable','no_sign_change','not_required_by_policy')),
  payback_periods                   NUMERIC NULL,
  discounted_payback_periods        NUMERIC NULL,
  benefit_cost_ratio                NUMERIC NULL,
  period_series                     JSONB NOT NULL,
  has_unresolved_double_counting     BOOLEAN NOT NULL DEFAULT false,
  has_mixed_currency_failure         BOOLEAN NOT NULL DEFAULT false,
  validation_findings                JSONB NOT NULL DEFAULT '[]',
  warnings                           JSONB NOT NULL DEFAULT '[]',

  created_at                         TIMESTAMPTZ NOT NULL DEFAULT now()
  -- immutable by construction — same shape as rvn_roi_calculation_runs.
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_forecast_versions_case_seq
  ON rvn_roi_forecast_versions(case_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_forecast_versions_case
  ON rvn_roi_forecast_versions(organization_id, case_id, sequence_number DESC);

-- ============================================================
-- rvn_roi_actual_entries — append-only, AC-02/AC-06
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_actual_entries (
  actual_entry_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                       UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id               TEXT NOT NULL,

  entry_type                     TEXT NOT NULL CHECK (entry_type IN ('cost','benefit','observation')),
  cost_line_id                    UUID NULL REFERENCES rvn_roi_cost_lines(cost_line_id),
  benefit_line_id                  UUID NULL REFERENCES rvn_roi_benefit_lines(benefit_line_id),

  period_start                      DATE NOT NULL,
  period_end                        DATE NOT NULL,

  amount                             NUMERIC NULL,
  currency                           TEXT NULL,

  data_quality_status                 TEXT NOT NULL DEFAULT 'unverified'
                                         CHECK (data_quality_status IN ('unverified','verified','disputed','estimated')),

  correction_of_actual_entry_id         UUID NULL REFERENCES rvn_roi_actual_entries(actual_entry_id),
  correction_reason                      TEXT NULL,

  source                                  TEXT NOT NULL,
  evidence_refs                            JSONB NOT NULL DEFAULT '[]',
  notes                                    TEXT NULL,

  recorded_by                               TEXT NOT NULL,
  recorded_at                               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- D10: verification must not be by the entry's own original recorder.
  verified_by                                TEXT NULL,
  verified_at                                TIMESTAMPTZ NULL,

  CONSTRAINT chk_rvn_roi_actual_entries_line_ref CHECK (
    (entry_type = 'cost'        AND cost_line_id IS NOT NULL AND benefit_line_id IS NULL) OR
    (entry_type = 'benefit'     AND benefit_line_id IS NOT NULL AND cost_line_id IS NULL) OR
    (entry_type = 'observation' AND cost_line_id IS NULL AND benefit_line_id IS NULL)
  ),
  CONSTRAINT chk_rvn_roi_actual_entries_currency CHECK (amount IS NULL OR currency IS NOT NULL)
);

-- Postgres NULL <> NULL: a unique index directly on two nullable FK columns
-- would not catch duplicates where both are NULL — collapse to one
-- deterministic key first via a generated column.
ALTER TABLE rvn_roi_actual_entries
  ADD COLUMN IF NOT EXISTS line_key TEXT GENERATED ALWAYS AS (
    COALESCE(cost_line_id::text, benefit_line_id::text, 'case_level')
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_actual_entries_period
  ON rvn_roi_actual_entries(case_id, line_key, period_start, period_end)
  WHERE correction_of_actual_entry_id IS NULL AND entry_type IN ('cost','benefit');

CREATE INDEX IF NOT EXISTS idx_rvn_roi_actual_entries_case
  ON rvn_roi_actual_entries(organization_id, case_id, period_start);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_actual_entries_correction_of
  ON rvn_roi_actual_entries(correction_of_actual_entry_id) WHERE correction_of_actual_entry_id IS NOT NULL;

-- Same limitation documented elsewhere in this program (rvn_kpi_measurements,
-- rvn_platform_events): REVOKE from PUBLIC does not stop an owner/superuser
-- connection — no named least-privilege application role exists yet.
REVOKE UPDATE, DELETE ON rvn_roi_actual_entries FROM PUBLIC;

-- ============================================================
-- rvn_roi_actual_snapshots — immutable rollup, fills current_actual_snapshot_id (D8/D17)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_actual_snapshots (
  actual_snapshot_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                         UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                 TEXT NOT NULL,

  sequence_number                  INT NOT NULL,
  as_of_period_end                  DATE NOT NULL,
  published_by                      TEXT NOT NULL,
  published_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  total_actual_costs                  NUMERIC NULL,
  total_actual_financial_benefits      NUMERIC NULL,
  actual_simple_roi                     NUMERIC NULL,
  actual_npv                             NUMERIC NULL,
  periods_with_actual_count               INT NOT NULL,
  periods_expected_count                  INT NOT NULL,
  coverage_pct                             NUMERIC NULL,
  unverified_entry_count                    INT NOT NULL,
  disputed_entry_count                      INT NOT NULL,
  entry_ids_included                         JSONB NOT NULL,

  created_at                                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_actual_snapshots_case_seq
  ON rvn_roi_actual_snapshots(case_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_actual_snapshots_case
  ON rvn_roi_actual_snapshots(organization_id, case_id, sequence_number DESC);

-- ============================================================
-- rvn_roi_variances / rvn_roi_variance_causes — stored, AC-05
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_variances (
  variance_id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                          UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                  TEXT NOT NULL,

  comparison_type                    TEXT NOT NULL
                                        CHECK (comparison_type IN ('approved_vs_forecast','approved_vs_actual','forecast_vs_actual')),
  metric                              TEXT NOT NULL,
  reference_approval_snapshot_id        UUID NULL REFERENCES rvn_roi_approval_snapshots(snapshot_id),
  reference_forecast_version_id          UUID NULL REFERENCES rvn_roi_forecast_versions(forecast_version_id),
  reference_actual_snapshot_id            UUID NULL REFERENCES rvn_roi_actual_snapshots(actual_snapshot_id),

  baseline_value                           NUMERIC NULL,
  comparison_value                          NUMERIC NULL,
  variance_amount                            NUMERIC NULL,
  variance_pct                                NUMERIC NULL,

  status                                      TEXT NOT NULL DEFAULT 'open'
                                                 CHECK (status IN ('open','explained','action_planned','resolved')),
  owner_user_id                                TEXT NULL,

  row_version                                  INT NOT NULL DEFAULT 1,
  created_by                                    TEXT NOT NULL,
  created_at                                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                                    TEXT NULL,
  updated_at                                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_variances_case
  ON rvn_roi_variances(organization_id, case_id, created_at DESC);

-- Unconditional fact-protection: the comparison facts are permanent history
-- the instant the row is created — no "unfrozen" state to gate on. Only
-- status/owner_user_id/row_version/updated_at may ever change.
CREATE OR REPLACE FUNCTION rvn_roi_variances_protect_facts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.comparison_type IS DISTINCT FROM OLD.comparison_type
     OR NEW.metric IS DISTINCT FROM OLD.metric
     OR NEW.reference_approval_snapshot_id IS DISTINCT FROM OLD.reference_approval_snapshot_id
     OR NEW.reference_forecast_version_id IS DISTINCT FROM OLD.reference_forecast_version_id
     OR NEW.reference_actual_snapshot_id IS DISTINCT FROM OLD.reference_actual_snapshot_id
     OR NEW.baseline_value IS DISTINCT FROM OLD.baseline_value
     OR NEW.comparison_value IS DISTINCT FROM OLD.comparison_value
     OR NEW.variance_amount IS DISTINCT FROM OLD.variance_amount
     OR NEW.variance_pct IS DISTINCT FROM OLD.variance_pct
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'rvn_roi_variances: variance % facts are immutable', OLD.variance_id USING ERRCODE = '23001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_variances_protect_facts ON rvn_roi_variances;
CREATE TRIGGER trg_rvn_roi_variances_protect_facts
  BEFORE UPDATE ON rvn_roi_variances
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_variances_protect_facts();

CREATE TABLE IF NOT EXISTS rvn_roi_variance_causes (
  cause_id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variance_id                  UUID NOT NULL REFERENCES rvn_roi_variances(variance_id),
  organization_id               TEXT NOT NULL,

  cause_category                  TEXT NOT NULL,
  contribution_pct                 NUMERIC NULL,
  narrative                         TEXT NOT NULL,

  created_by                         TEXT NOT NULL,
  created_at                         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_variance_causes_variance ON rvn_roi_variance_causes(variance_id);

-- ============================================================
-- Close out ROI-E001's two reservations.
-- ============================================================
ALTER TABLE rvn_roi_cases
  ADD CONSTRAINT fk_rvn_roi_cases_current_forecast_version
    FOREIGN KEY (current_forecast_version_id) REFERENCES rvn_roi_forecast_versions(forecast_version_id),
  ADD CONSTRAINT fk_rvn_roi_cases_current_actual_snapshot
    FOREIGN KEY (current_actual_snapshot_id) REFERENCES rvn_roi_actual_snapshots(actual_snapshot_id);
```

---

## 4. Command layer (`server/src/services/resultsVnext/roi/`)

Before implementing, read the current exact state of `roiCaseCommands.ts`,
`roiCalculationRunCommands.ts`, `roiCaseApprovalCommands.ts`,
`roiApprovalSnapshotRepository.ts`, `roiEconomicModelRepository.ts`, and
`atomicWrite.ts` — this design describes their shape and intent, not a
guarantee of literal current signatures after three epics of edits.

**Changed** `roiCaseCommands.ts`: export `ROI_TRACKING_ACTIVE_STATUSES:
readonly RoiCaseStatus[] = ['tracking','benefits_realization',
'post_investment_review_due','post_investment_review']` — additive, same
placement pattern as `NON_EDITABLE_STATUSES`.

**Changed** `roiCalculationRunCommands.ts`: export `toDateOnlyString`,
`assumptionRowToEngine`, `costLineRowToEngine`, `benefitLineRowToEngine`,
`policyStampObject` (currently module-private) — zero behavior change (D5).

**New** `roiTrackingCommands.ts` — `startRoiCaseTracking`: hand-written
`executeAtomicCommand`, `aggregateId=caseId`. Guard `status === 'approved'`
else `RoiCaseValidationError('INVALID_ROI_CASE_STATUS_TRANSITION', ...)`.
`UPDATE rvn_roi_cases SET status='tracking', row_version=$next, updated_by,
updated_at=now()`. `createObligation(client, { obligationType:
'track_roi_forecast_actuals', assigneeUserId: caseRow.owner_user_id,
deduplicationKey: \`${organizationId}:roi_case:${caseId}:track_roi_forecast_actuals\`,
... })` (D2). `buildEvent`: `roi.tracking_started`.

**New** `roiForecastVersionCommands.ts` — `createRoiForecastVersion(input)`:
`executeAtomicCommand`, `aggregateId=caseId`, `expectedVersion` required
(writes `current_forecast_version_id`). `applyMutation`: lock case `FOR
UPDATE`; guard `ROI_TRACKING_ACTIVE_STATUSES.includes(status)` else
`RoiForecastVersionValidationError('CASE_NOT_TRACKABLE', ...)`; guard
`latest_approved_snapshot_id IS NOT NULL` (internal-invariant fail-loud, same
shape as `approveRoiCase`'s decision-run null check); read frozen
`rvn_roi_calculation_policy` + active `rvn_roi_assumptions`/`cost_lines`/
`benefit_lines`; validate every `input.overrides[].targetId` belongs to one of
those rows, else `RoiForecastVersionValidationError('OVERRIDE_TARGET_NOT_FOUND', ...)`;
build `RoiCalculationEngineInput` (`scenarioType: overrides.length ? 'custom'
: null`, `scenarioOverrides: overrides`, `analysisStart`/`analysisEnd`/
`currency`/`granularity` from the case row **unchanged**, D7); call
`runRoiCalculationEngine` (pure, D4); `inputHash`/`policyVersionStamp` via
`computeStateHash`; `sequenceNumber = COALESCE(MAX(sequence_number),0)+1
FROM rvn_roi_forecast_versions WHERE case_id=$1` (safe under the case row's
lock); `INSERT INTO rvn_roi_forecast_versions`; `UPDATE rvn_roi_cases SET
current_forecast_version_id=$new, row_version=$next, ...`. `buildEvent`:
`roi.forecast_published` → `['mywork_projection','finance_projection']`.

**New** `roiForecastVersionRepository.ts` — `listRoiForecastVersions`,
`getRoiForecastVersion` (visibility-scoped, `::text` cast).

**New** `roiActualEntryCommands.ts` — mirrors `kpiMeasurementCommands.ts`'s
`recordMeasurement`/`correctMeasurement`/`verifyMeasurement`/
`disputeMeasurement` exactly (all `executeAtomicCreate`, never CAS, each a new
row referencing the prior one via a self-FK, never an `UPDATE`):

- `recordActualEntry` — `executeAtomicCreate`. Guard: case status ∈
  `ROI_TRACKING_ACTIVE_STATUSES` (plain `SELECT status`, no lock needed, same
  as `recordMeasurement`). If `costLineId`/`benefitLineId` given, validate
  it belongs to this case. `INSERT ... data_quality_status='unverified'`.
  Event `roi.actual_recorded` → `['mywork_projection','finance_projection']`.
- `correctActualEntry` — shared `insertSupersedingActualEntry` helper: reads
  original by id, `INSERT` new row with `correction_of_actual_entry_id=originalId`,
  fields overridable. `RoiActualEntryNotFoundError` (404) if original missing.
  Event `roi.actual_corrected`.
- `verifyActualEntry` — same helper, `dataQualityStatus:'verified'` fixed,
  sets `verified_by`/`verified_at`. **Per Decision D10: throws
  `RoiActualSelfVerificationDeniedError` (403) if `verifierId` equals the
  original entry's `recorded_by`** — resolve "original recorder" by walking
  `correction_of_actual_entry_id` back to the row where it is `NULL`, not just
  checking the immediate prior row's `recorded_by` (a correction chain must
  not let the original recorder verify their own work by routing through an
  intermediate correction). Event `roi.actual_verified` (AC-03).
- `disputeActualEntry` — same helper, `dataQualityStatus:'disputed'` fixed,
  `disputeReason` required, value/fields otherwise **unchanged from the
  original** (AC-06 — a dispute never silently changes the recorded value; a
  separate `correctActualEntry` call is needed for that). No self-check (only
  verification carries the D10 restriction — disputing your own entry is
  flagging a problem, not attesting it's correct, so no conflict of interest
  exists there). Event `roi.actual_disputed`.

**New** `roiActualEntryRepository.ts` — `listActualEntries`/`getActualEntry`,
"current" view defaults to `includeSuperseded=false` using the exact `NOT
EXISTS (SELECT 1 FROM rvn_roi_actual_entries newer WHERE
newer.correction_of_actual_entry_id = e.actual_entry_id)` pattern already
established in `kpiRepository.ts`/`kpiPerspectivesRepository.ts`/
`kpiScorecardRepository.ts`.

**New** `roiActualSnapshotCommands.ts` — `publishRoiActualSnapshot`:
`executeAtomicCommand`, `aggregateId=caseId`, `expectedVersion` required.
Reads all current (non-superseded) `rvn_roi_actual_entries` for the case,
aggregates into the rollup fields (D8), `INSERT INTO
rvn_roi_actual_snapshots`, `UPDATE rvn_roi_cases SET
current_actual_snapshot_id=$new, row_version=$next`. Event
`roi.actual_snapshot_published` → `['mywork_projection','finance_projection']`.

**New** `roiActualSnapshotRepository.ts` — `listRoiActualSnapshots`/`getRoiActualSnapshot`.

**New** `roiCompareRepository.ts` — `getRoiCaseCompareView({ userId,
organizationId, caseId })`: pure read (D9), no persistence. Pulls latest
approval snapshot, latest forecast version, latest actual snapshot, returns
one object per headline metric (`npv`, `simpleRoi`, `totalCosts`,
`totalFinancialBenefits`, `paybackPeriods`) with **three typed slots**
(`approved`/`forecast`/`actual`), each `{ status: 'available', value: number
} | { status: 'not_yet_available', reason: 'not_yet_approved' |
'no_forecast_published' | 'no_actual_recorded' }` — the literal mechanism
satisfying AC-04, not a bare `number | null`.

**New** `roiVarianceCommands.ts` — `recordVariance` (`executeAtomicCreate`,
snapshots `baselineValue`/`comparisonValue` at creation from the referenced
Approved/Forecast/Actual rows, computes `varianceAmount`/`variancePct`);
`updateVarianceStatus` (`executeAtomicCommand`, CAS on the variance's own
`row_version`, only `status`/`ownerUserId` writable — the DB trigger backs
this up); `addVarianceCause`/`removeVarianceCause` (simple child
inserts/deletes, no CAS needed). Event `roi.material_variance_detected` for
`recordVariance`; `roi.variance_status_updated`/`roi.variance_cause_added` for
the rest.

**New** `roiVarianceRepository.ts` — `listVariances`/`getVariance`.

**New** `roiForecastActualTypes.ts` — Row/DTO types + `toX` mappers for all
five new tables, one file per epic's tables (matches `roiEconomicModelTypes.ts`'s
precedent).

---

## 5. Visibility

Confirmed (D13): every new table inherits visibility via `case_id` only,
`resource_type='roi_case'`, `::text` cast on every join. No new
`resource_type`, `RVN_RESOURCE_TYPES` unchanged.

---

## 6. API surface (Changed file: `server/src/routes/resultsVnext/roi.routes.ts`)

| Method | Path | Command/Repository |
|---|---|---|
| `POST` | `/cases/:caseId/transitions/start-tracking` | `startRoiCaseTracking` |
| `POST` | `/cases/:caseId/forecast-versions` | `createRoiForecastVersion` |
| `GET` | `/cases/:caseId/forecast-versions` | `listRoiForecastVersions` |
| `GET` | `/cases/:caseId/forecast-versions/:forecastVersionId` | `getRoiForecastVersion` |
| `GET` | `/cases/:caseId/compare` | `getRoiCaseCompareView` |
| `GET`/`POST` | `/cases/:caseId/actuals` | `listActualEntries` / `recordActualEntry` |
| `GET` | `/cases/:caseId/actuals/:entryId` | `getActualEntry` |
| `POST` | `/cases/:caseId/actuals/:entryId/corrections` | `correctActualEntry` |
| `POST` | `/cases/:caseId/actuals/:entryId/verify` | `verifyActualEntry` |
| `POST` | `/cases/:caseId/actuals/:entryId/dispute` | `disputeActualEntry` |
| `POST` | `/cases/:caseId/actual-snapshots` | `publishRoiActualSnapshot` |
| `GET` | `/cases/:caseId/actual-snapshots` | `listRoiActualSnapshots` |
| `GET` | `/cases/:caseId/actual-snapshots/:actualSnapshotId` | `getRoiActualSnapshot` |
| `GET`/`POST` | `/cases/:caseId/variances` | `listVariances` / `recordVariance` |
| `GET` | `/cases/:caseId/variances/:varianceId` | `getVariance` |
| `PATCH` | `/cases/:caseId/variances/:varianceId` | `updateVarianceStatus` |
| `POST` | `/cases/:caseId/variances/:varianceId/causes` | `addVarianceCause` |
| `DELETE` | `/cases/:caseId/variances/:varianceId/causes/:causeId` | `removeVarianceCause` |

No status restriction on `GET` routes. All writes except
`recordActualEntry`/`recordVariance`/`addVarianceCause`/the verify/dispute/
correction trio (pure `executeAtomicCreate`) require `expectedVersion` on the
parent aggregate (case or variance).

New error classes for `handleRoiRouteError`: `RoiForecastVersionValidationError`,
`RoiActualEntryValidationError`, `RoiActualEntryNotFoundError` (404),
`RoiActualSelfVerificationDeniedError` (403, D10), `RoiVarianceValidationError`,
`RoiVarianceNotFoundError`.

New validators file: `server/src/validators/resultsVnextRoiForecastActual.validators.ts`
(dedicated file, matching E002's precedent for substantial new domain
surface), redeclaring shared field helpers locally per convention.

**Changed** `atomicWrite.ts` — new `EVENT_TYPE_CONSUMER_GROUPS` entries:
`roi.tracking_started`, `roi.forecast_published` →
`['mywork_projection','finance_projection']`, `roi.actual_recorded`/
`roi.actual_corrected` → `['mywork_projection','finance_projection']`,
`roi.actual_verified`/`roi.actual_disputed` → `['mywork_projection']`,
`roi.actual_snapshot_published` → `['mywork_projection','finance_projection']`,
`roi.material_variance_detected`/`roi.variance_status_updated`/
`roi.variance_cause_added` → `['mywork_projection']`.

---

## 7. File list (backend only)

**New:**
- `server/migrations/20260818_rvn_roi_forecast_actual.sql`
- `server/src/services/resultsVnext/roi/roiForecastActualTypes.ts`
- `server/src/services/resultsVnext/roi/roiTrackingCommands.ts`
- `server/src/services/resultsVnext/roi/roiForecastVersionCommands.ts`
- `server/src/services/resultsVnext/roi/roiForecastVersionRepository.ts`
- `server/src/services/resultsVnext/roi/roiActualEntryCommands.ts`
- `server/src/services/resultsVnext/roi/roiActualEntryRepository.ts`
- `server/src/services/resultsVnext/roi/roiActualSnapshotCommands.ts`
- `server/src/services/resultsVnext/roi/roiActualSnapshotRepository.ts`
- `server/src/services/resultsVnext/roi/roiCompareRepository.ts`
- `server/src/services/resultsVnext/roi/roiVarianceCommands.ts`
- `server/src/services/resultsVnext/roi/roiVarianceRepository.ts`
- `server/src/validators/resultsVnextRoiForecastActual.validators.ts`
- `tests/resultsVnext/roi/roiTrackingTransition.realdb.test.ts`
- `tests/resultsVnext/roi/roiForecastVersion.realdb.test.ts` — must include: creating a forecast with overrides, then re-reading the original approval snapshot's `content_hash` and the frozen `rvn_roi_assumptions`/`cost_lines`/`benefit_lines` rows, asserting byte-identical/unchanged (the literal AC-01 proof, mirroring `roiCaseReapproval.realdb.test.ts`'s hash-stability style).
- `tests/resultsVnext/roi/roiActualEntryAppendOnly.realdb.test.ts` — record → correct → verify → dispute chain; raw `UPDATE`/`DELETE` proven blocked by `REVOKE`; **the D10 self-verification denial specifically, including the correction-chain case** (recorder creates entry, someone else corrects it, original recorder attempts to verify the correction → still denied, proving the check walks back to the original recorder, not just the immediate row).
- `tests/resultsVnext/roi/roiActualSnapshot.realdb.test.ts`
- `tests/resultsVnext/roi/roiCompareView.realdb.test.ts` — three distinct missing-reason states (AC-04).
- `tests/resultsVnext/roi/roiVariance.realdb.test.ts` — raw `UPDATE` on frozen facts blocked; status/owner still editable.
- `tests/resultsVnext/roi/roiForecastActualVisibilityJoin.realdb.test.ts` — `::text` cast on all 5 new tables.
- `server/src/routes/resultsVnext/__tests__/roiForecastActual.routes.test.ts`

**Changed:**
- `server/src/services/resultsVnext/roi/roiCaseCommands.ts` — `ROI_TRACKING_ACTIVE_STATUSES` exported.
- `server/src/services/resultsVnext/roi/roiCalculationRunCommands.ts` — 5 functions exported (D5), zero behavior change.
- `server/src/routes/resultsVnext/roi.routes.ts` — 17 new routes.
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — new event types.
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entries, plus explicit backlog notes for D11/D15 (reopen-from-Tracking still deferred), D19 (no typed KPI-evidence link on actuals), D20 (no forecast horizon extension), and a note confirming D14's E004/E005 boundary inference for whoever designs ROI-E005 next.

**Read-only reference:** `engine/roiCalculationEngine.ts`/`.types.ts`,
`roiEconomicModelFreeze.ts`, `roiEconomicModelRepository.ts`,
`roiEconomicModelTypes.ts`, `roiCaseApprovalCommands.ts`,
`roiApprovalSnapshotTypes.ts`/`Repository.ts`, `investmentAppraisalService.ts`,
`kpi/kpiMeasurementCommands.ts` (append-only template),
`kpi/kpiRepository.ts` (NOT EXISTS "current" resolution).

---

## 8. Definition of done

- [ ] `startRoiCaseTracking`/`createRoiForecastVersion`/`recordActualEntry`/`correctActualEntry`/`verifyActualEntry`/`disputeActualEntry`/`publishRoiActualSnapshot`/`recordVariance`/`updateVarianceStatus` all work against real prior E001/E002/E003 data
- [ ] AC-01 proven: forecast creation leaves the approval snapshot's `content_hash` and every frozen economic-model row byte-unchanged
- [ ] AC-02/AC-06 proven: append-only chain (record→correct→verify→dispute), raw UPDATE/DELETE blocked, dispute never changes the recorded value
- [ ] AC-03 proven: `verifyActualEntry` denies the original recorder, including through a correction chain (D10)
- [ ] AC-04 proven: compare view returns 3 distinct typed missing-reason states, never a bare null
- [ ] AC-05 proven: a raw UPDATE on a variance's comparison facts fails post-creation; status/owner remain editable
- [ ] `::text` cast verified on every new join
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Full existing KPI + ROI-E001/E002/E003 test suite still green — before/after evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` ROI-E004 rows updated + backlog notes per §7
