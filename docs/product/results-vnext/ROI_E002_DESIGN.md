# ROI-E002 — Economic Model — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
Second epic of the ROI domain, builds directly on ROI-E001 (Case & Baseline,
already landed). Backend only — UI Registry is RN-G2.

Fully self-contained: full DDL, full function signatures, full route table,
a Decisions table resolving every open question the design draft raised.
This is a **deterministic calculation engine** — a different kind of component
than anything built so far in this program (every prior epic was CRUD+lifecycle).
Financial correctness here is a real product risk, not a style preference —
every ambiguous point below was resolved explicitly, none guessed silently.

---

## 0. Epic boundary (accepted as-is)

Per `EPIC_LEDGER_LIVE.md`'s one prose sentence for ROI-E002 (same "thin ledger"
limitation ROI-E001's Decision D1 already flagged for the ROI domain generally):

> "ROI-E002 Economic Model (6 AC: pełny model Assumption, typed
> BenefitEvidenceLink zamiast luźnego kpi_id, double-counting group blokuje
> approval, scenario = input override nigdy wpisany ręcznie, known-answer #1 +
> mixed-currency hard-fail, CalculationRun pinned engine/policy/hash)"

Six ACs, accepted verbatim:

1. **AC-01** — Full Assumption model (typed value, unit, confidence, evidence, owner, downside/base/upside).
2. **AC-02** — Benefit's KPI relationship is a typed `BenefitEvidenceLink`, never a loose `kpi_id`.
3. **AC-03** — An unresolved `double_counting_group` blocks Ready-for-Review.
4. **AC-04** — A Scenario is a set of input overrides, never a manually-typed headline number.
5. **AC-05** — Known-answer test #1 passes; mixed-currency inputs hard-fail.
6. **AC-06** — `CalculationRun` is immutable and pins engine version + policy stamp + input hash.

**Confirmed NOT owned by E002** (re-verified against `ROI_E001_DESIGN.md` §3's
four reserved nullable columns on `rvn_roi_cases`):

| Column | Points at | Owning epic |
|---|---|---|
| `original_approved_snapshot_id` / `latest_approved_snapshot_id` | `ROIApprovalSnapshot` | ROI-E003 |
| `current_forecast_version_id` | `ROIForecastVersion` | ROI-E004 |
| `current_actual_snapshot_id` | Actual tracking rollup | ROI-E004 |

E002 requires **zero** `ALTER TABLE rvn_roi_cases` — every new table is a sibling
FK'd to `rvn_roi_cases(case_id)`. "Latest run" is always `ORDER BY created_at DESC
LIMIT 1`, index-backed, never a denormalized pointer column.

Also out of scope, per the source plan and the epic split: `ROIWorkingRevision`
(autosave/undo versioning), `ROIApprovalSnapshot`, `ROIForecastVersion`,
`ROIActualEntry`/`ROIVariance`, PIR, Finance seam, Teresa. A fully-governed,
versioned `ROIPolicyVersion` (org-wide, maker-checker) is also deliberately not
built — see Decision D9.

---

## 1. Decisions (resolving the draft's decision points and open questions)

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Reuse `investmentAppraisalService.ts`'s NPV/IRR/payback functions or build local copies? | **Reuse via direct import.** `import { npv, irr, payback, discountedPayback } from '../../../investmentAppraisalService.js'`. | Pure, zero I/O, already known-answer-tested, matches the plan's formulas. D06 ("ROI and Finance remain separate models") governs data/domain coupling — shared tables, silent sync of Approved/Forecast/Actual truth. It says nothing about reusing stateless arithmetic. Forking an identical bisection-IRR "for domain purity" is exactly the 5-systems fragmentation this program exists to undo. |
| D2 | Where does the engine live, can it touch DB/Express? | `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts` — **zero imports** from `pg`, `express`, or `services/resultsVnext/platform/*`. Synchronous, total, never throws (typed errors/warnings in its output). Command layer (`roiCalculationRunCommands.ts`) does DB reads, builds the input, calls the pure function, persists the output. | Matches the plan's explicit "pure domain package, no UI/DB/network" contract and this codebase's existing pure-evaluator precedent (`targetGeometryEvaluator.ts`). |
| D3 | Async job queue for compute? | **No.** `createRoiCalculationRun` runs synchronously inside one HTTP request via `executeAtomicCreate`. | Bounded, deterministic, in-memory computation over a realistic line-item count is not "long-running." Building job orchestration for it is scope creep beyond the 6 ACs. |
| D4 | One Assumption entity or two (scalar policy vs. freeform list)? | **Two tables**: `rvn_roi_calculation_policy` (1:1 shell, typed scalar engine parameters: discount rate, tax treatment, inflation, rounding) and `rvn_roi_assumptions` (N per case, freeform material-assumption list per AC-01's exact vocabulary: category/label/base/downside/upside/confidence/evidence/owner). | The engine's *required* scalar parameters cannot safely live as string-keyed rows in an untyped list (fragile lookup, no structural guarantee of existence) — they need real columns. `rvn_roi_assumptions` maps to AC-01's own "Assumption" vocabulary directly. |
| D5 | Pre-create the calculation-policy shell at Case creation, or lazily upsert? | **Pre-created.** `createRoiCase`'s `applyMutation` (already-shipped `roiCaseCommands.ts`) gains one more `INSERT` in the same transaction, mirroring the existing baseline-shell insert exactly. | Consistency with Baseline's "always update, never upsert" rule (ROI-E001 §4.4) — a 1:1 shell should always exist so the command layer never branches on "does this row exist yet." |
| D6 | Soft or hard delete for cost/benefit lines, assumptions, scenarios? | **Soft delete** (`deleted_at`/`deleted_by`). Reads exclude deleted rows unless `includeDeleted=true`. | Matches the Case's own `archived_at`/`includeArchived` convention (ROI-E001 D4) and this program's append-only-biased philosophy. A `CalculationRun`'s frozen `input_snapshot` already makes historical runs reproducible after a later deletion; soft-delete additionally preserves "who removed this and when" for audit. |
| D7 | Frozen at approval (foreshadowing E003) or stays live pre-approval only? | **Frozen at approval**, matching Baseline's exact pattern: `frozen_at`/`frozen_by` + `BEFORE UPDATE` trigger per table, plus a cross-epic contract function `freezeRoiEconomicModel(client, params)` that ROI-E003's future `approveRoiCase` calls on the same pinned client, same transaction, immediately after `freezeRoiBaseline`. `CalculationRun` rows need no freeze trigger — immutable by construction (never UPDATEd after INSERT). | Matches ROI-E001 D5's reasoning exactly: two different rows can't share one atomic lock across tables, so freeze must happen inside the approver's own transaction. |
| D8 | Double-counting resolution mechanism (no algorithm exists in any source doc)? | **Manual resolution, not auto-netting.** A `double_counting_group` with ≥2 active member lines is "unresolved" unless at least one member carries a non-null `double_counting_resolution_note`. Unresolved → blocks Ready-for-Review (AC-03), does not itself fail the CalculationRun (recorded as a finding, run still completes). | Never silently zero out or net a benefit line's dollar value with no specified algorithm to validate against — that is a financial-correctness risk with no spec. Require an accountable human explanation instead, matching the plan's literal "resolution" language. |
| D9 | Build the plan's fully-governed, versioned `ROIPolicyVersion` (org-wide, maker-checker) and `ROIWorkingRevision` (autosave/undo)? | **No, deferred.** `rvn_roi_calculation_policy` here is a simple per-case scalar shell, not an org-wide governed registry. Neither concept is named in the 6 ACs. File as backlog note in the ledger (same pattern as KPI-E007's scorecard-legacy deferral) — if a later epic needs "every new Case defaults to the org's current discount rate," that is a real, acknowledged gap, not a silently dropped one. | Scope discipline: build what the 6 ACs require, name what's deferred rather than quietly omitting it. |
| D10 | Scenario override mechanics — how do canonical vs. custom scenarios apply? | Canonical `downside`/`upside` scenarios need **no override rows**: the engine reads each assumption's own `downside_value`/`upside_value` column directly. There is no `base` scenario row — `scenarioId = NULL` on a run means "use each line's own base value/amount directly." Only `custom` scenarios use `rvn_roi_scenario_overrides` (polymorphic: `target_type IN ('assumption','cost_line','benefit_line')`, `target_id UUID`, no FK — matches `link_graph_edges`'s existing polymorphic-reference precedent). | Satisfies AC-04 ("never manually typed") for free on the two canonical scenarios, since downside/upside values are already required fields of the "full Assumption model" (AC-01). `custom` needs *some* override mechanism; a minimal polymorphic table is the smallest addition that covers it. |
| D11 | Rounding policy default? | `rvn_roi_calculation_policy.rounding_policy` **defaults to `'half_up_2dp'`** at row creation (DDL `DEFAULT`), not left NULL. | Unlike a baseline's *measured business fact* (where "honest missing" matters because a fabricated number would misrepresent reality), rounding policy is a computation configuration knob, the same category as `granularity` (which already defaults to `'monthly'` on `rvn_roi_cases`). Half-up-to-2-decimal-places is the standard convention for currency display and is a safe, overridable default, not a fabricated fact. |
| D12 | Decimal safety of the calculation itself — plain JS float or a decimal library? | **Introduce `decimal.js` as a new dependency, scoped to `engine/roiCalculationEngine.ts` only.** Convert every numeric input to `Decimal` at the engine boundary, perform all summation/discounting/NPV/IRR-input arithmetic in `Decimal`, round to the case's `rounding_policy` only at final output, convert back to plain `number` only when writing to `NUMERIC`/JSONB columns. `investmentAppraisalService.ts`'s own `npv`/`irr`/`payback` functions accept plain numbers — call them with `.toNumber()`-converted inputs and treat their return values as sufficient precision for those specific metrics (they are single-purpose calculations, not multi-period summations); the period-series summation (`totalCosts`/`totalFinancialBenefits`/per-period aggregation across up to 60+ periods) is where float drift actually accumulates, and that summation is entirely engine-owned code, done in `Decimal`. | The source plan explicitly requires "decimal-safe arithmetic" and "semantic decimal types, not floating-point storage for money" — the existing codebase-wide convention (plain `number` everywhere, including `investmentAppraisalService.ts`) does not satisfy this literally, and repeated summation of money across many periods is a textbook float-drift risk. `decimal.js` is a small, dependency-free, widely-used, pure library — a scoped addition with no transitive risk, not an infrastructure change. This is flagged as a hard-requirement risk in the draft; accepting the risk silently by doing nothing was rejected. |
| D13 | Discount rate period basis — is `discount_rate_pct` annual, and if so how does the engine convert to per-period? | **`discount_rate_pct` is always an annual rate.** The engine converts to the per-period rate matching the case's `granularity` using the effective-rate compounding conversion, not naive division: `periodRate = (1 + annualRate/100)^(1/periodsPerYear) - 1`, where `periodsPerYear = 12` for `monthly`, `1` for `annual`. | This is the financially correct way to convert an annual effective rate to a periodic effective rate (matches standard textbook NPV-with-monthly-cashflows-and-annual-discount-rate treatment). Naive division (`annualRate/12`) is a common shortcut but compounds incorrectly over many periods; stating the exact formula here removes the ambiguity the draft flagged and makes the known-answer test (§9) mechanically reproducible by the implementer. |
| D14 | KPI evidence link — does creating a `BenefitEvidenceLink` require the linker to have KPI-specific visibility into the referenced KPI? | **No visibility check at link-creation time** — only an organization-scoped existence check (the KPI and its pinned definition version must belong to the same `organization_id`). Referencing a KPI by id/pinned-version is not itself a content leak. **However**, any repository read that *hydrates* a benefit line's evidence links with actual KPI details (name, current value, status) for display **must** go through KPI's own `resource_type='kpi'` visibility-scoped query — a viewer without KPI access sees the link exists (pinned id/version/purpose) but not the KPI's content. | Mirrors how ID references work elsewhere in this codebase (referencing an entity by id is not equivalent to exposing all its fields) while still respecting KPI's independent visibility scope for the content itself — a link is metadata about a relationship, not a copy of the KPI's data. |
| D15 | Per-scenario/per-run row-level visibility (e.g. hiding an internal "worst case" scenario from some viewers)? | **Not built.** Every new E002 table inherits visibility via `case_id` only (same as `rvn_roi_baselines`) — no new `resource_type`. `RVN_RESOURCE_TYPES` stays unchanged. | None of the 6 ACs call for scenario-level visibility; building a new `resource_type` for it now would be speculative scope. File as a backlog note if a future epic needs it. |

---

## 2. Legacy collision check (accepted from draft)

`calculation_run`/scenario/cost-line/benefit-line concepts — **confirmed
greenfield**, zero hits in `server/src`/`server/migrations*` as domain concepts.

NPV/IRR/payback math — **not greenfield, and deliberately reused** (Decision D1):
`server/src/services/investmentAppraisalService.ts` (Finance/M16) already has
pure, dependency-free, known-answer-tested `npv()`/`irr()`/`payback()`/
`discountedPayback()`/`mirr()`/`profitabilityIndex()`. Reusing this is code
reuse of arithmetic, not domain coupling — no FK, no shared row, no sync risk.

`roi_assumptions`/`initiative_benefits`/`benefits_register` and the `/roi`
Initiatives-module route — already declared legacy/untouched by ROI-E001 §2,
unaffected by E002.

---

## 3. Schema (full DDL)

Migration file: `server/migrations/20260816_rvn_roi_economic_model.sql`.
Zero `ALTER TABLE` on `rvn_roi_cases`/`rvn_roi_baselines`.

```sql
-- ============================================================
-- rvn_roi_calculation_policy — 1:1 shell, engine's scalar parameters
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_calculation_policy (
  policy_row_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL UNIQUE REFERENCES rvn_roi_cases(case_id),
  organization_id       TEXT NOT NULL,

  discount_rate_pct     NUMERIC NULL,     -- annual rate, see Decision D13
  tax_treatment         TEXT NULL CHECK (tax_treatment IN ('pre_tax','post_tax','not_modeled')),
  inflation_rate_pct    NUMERIC NULL,

  -- Decision D11: safe default, not left null — a computation knob, not a
  -- business fact.
  rounding_policy       TEXT NOT NULL DEFAULT 'half_up_2dp'
                           CHECK (rounding_policy IN ('half_up_2dp','half_even_2dp','none')),

  -- Which headline metrics this Case's policy requires. NULL/empty array =
  -- engine computes all of roi/npv/payback/discounted_payback/bcr by
  -- default; IRR only computed if 'irr' is listed (plan: "IRR is optional
  -- and policy-controlled").
  required_metrics      TEXT[] NULL,

  notes                 TEXT NULL,
  confidence             TEXT NULL CHECK (confidence IN ('low','medium','high')),
  owner_user_id           TEXT NULL,

  frozen_at              TIMESTAMPTZ NULL,
  frozen_by              TEXT NULL,

  row_version             INT NOT NULL DEFAULT 1,
  created_by              TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_calc_policy_org ON rvn_roi_calculation_policy(organization_id, case_id);

CREATE OR REPLACE FUNCTION rvn_roi_calculation_policy_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.discount_rate_pct IS DISTINCT FROM OLD.discount_rate_pct
       OR NEW.tax_treatment IS DISTINCT FROM OLD.tax_treatment
       OR NEW.inflation_rate_pct IS DISTINCT FROM OLD.inflation_rate_pct
       OR NEW.rounding_policy IS DISTINCT FROM OLD.rounding_policy
       OR NEW.required_metrics IS DISTINCT FROM OLD.required_metrics
    THEN
      RAISE EXCEPTION 'rvn_roi_calculation_policy: policy % is frozen', OLD.policy_row_id USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_calc_policy_protect_frozen ON rvn_roi_calculation_policy;
CREATE TRIGGER trg_rvn_roi_calc_policy_protect_frozen
  BEFORE UPDATE ON rvn_roi_calculation_policy
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_calculation_policy_protect_frozen();

-- ============================================================
-- rvn_roi_assumptions — material assumption list (AC-01)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_assumptions (
  assumption_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id    TEXT NOT NULL,

  category           TEXT NOT NULL,
  label              TEXT NOT NULL,
  unit               TEXT NULL,

  base_value         NUMERIC NULL,
  downside_value     NUMERIC NULL,
  upside_value       NUMERIC NULL,

  confidence         TEXT NULL CHECK (confidence IN ('low','medium','high')),
  evidence_ref       TEXT NULL,
  source             TEXT NULL,
  owner_user_id      TEXT NULL,
  sensitivity_rank   INT NULL,
  notes              TEXT NULL,

  deleted_at         TIMESTAMPTZ NULL,
  deleted_by         TEXT NULL,
  frozen_at          TIMESTAMPTZ NULL,
  frozen_by          TEXT NULL,

  row_version        INT NOT NULL DEFAULT 1,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_assumptions_case ON rvn_roi_assumptions(organization_id, case_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION rvn_roi_assumptions_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.base_value IS DISTINCT FROM OLD.base_value
       OR NEW.downside_value IS DISTINCT FROM OLD.downside_value
       OR NEW.upside_value IS DISTINCT FROM OLD.upside_value
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.label IS DISTINCT FROM OLD.label
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION 'rvn_roi_assumptions: assumption % is frozen', OLD.assumption_id USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_assumptions_protect_frozen ON rvn_roi_assumptions;
CREATE TRIGGER trg_rvn_roi_assumptions_protect_frozen
  BEFORE UPDATE ON rvn_roi_assumptions
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_assumptions_protect_frozen();

-- ============================================================
-- rvn_roi_cost_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_cost_lines (
  cost_line_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                 UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id         TEXT NOT NULL,

  category                TEXT NOT NULL,
  label                   TEXT NOT NULL,
  description             TEXT NULL,

  amount                  NUMERIC NOT NULL,
  currency                TEXT NOT NULL,

  timing_type             TEXT NOT NULL CHECK (timing_type IN ('one_time','recurring')),
  one_time_period_date    DATE NULL,
  recurrence_start_date   DATE NULL,
  recurrence_end_date     DATE NULL,
  recurrence_cadence      TEXT NULL CHECK (recurrence_cadence IN ('monthly','quarterly','annual')),

  confidence              TEXT NULL CHECK (confidence IN ('low','medium','high')),
  source                  TEXT NULL,
  owner_user_id           TEXT NULL,

  deleted_at              TIMESTAMPTZ NULL,
  deleted_by              TEXT NULL,
  frozen_at               TIMESTAMPTZ NULL,
  frozen_by               TEXT NULL,

  row_version              INT NOT NULL DEFAULT 1,
  created_by               TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_cost_lines_case ON rvn_roi_cost_lines(organization_id, case_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION rvn_roi_cost_lines_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.timing_type IS DISTINCT FROM OLD.timing_type
       OR NEW.one_time_period_date IS DISTINCT FROM OLD.one_time_period_date
       OR NEW.recurrence_start_date IS DISTINCT FROM OLD.recurrence_start_date
       OR NEW.recurrence_end_date IS DISTINCT FROM OLD.recurrence_end_date
       OR NEW.recurrence_cadence IS DISTINCT FROM OLD.recurrence_cadence
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION 'rvn_roi_cost_lines: cost line % is frozen', OLD.cost_line_id USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_cost_lines_protect_frozen ON rvn_roi_cost_lines;
CREATE TRIGGER trg_rvn_roi_cost_lines_protect_frozen
  BEFORE UPDATE ON rvn_roi_cost_lines
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_cost_lines_protect_frozen();

-- ============================================================
-- rvn_roi_benefit_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_benefit_lines (
  benefit_line_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                            UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                    TEXT NOT NULL,

  category                           TEXT NOT NULL,
  label                              TEXT NOT NULL,
  description                        TEXT NULL,

  is_financial                       BOOLEAN NOT NULL DEFAULT true,
  amount                             NUMERIC NULL,
  currency                           TEXT NULL,

  timing_type                        TEXT NOT NULL CHECK (timing_type IN ('one_time','recurring')),
  one_time_period_date               DATE NULL,
  recurrence_start_date              DATE NULL,
  recurrence_end_date                DATE NULL,
  recurrence_cadence                 TEXT NULL CHECK (recurrence_cadence IN ('monthly','quarterly','annual')),
  ramp_periods                       INT NULL,

  double_counting_group              TEXT NULL,
  double_counting_resolution_note    TEXT NULL,

  confidence                         TEXT NULL CHECK (confidence IN ('low','medium','high')),
  source                             TEXT NULL,
  owner_user_id                      TEXT NULL,

  deleted_at                         TIMESTAMPTZ NULL,
  deleted_by                         TEXT NULL,
  frozen_at                          TIMESTAMPTZ NULL,
  frozen_by                          TEXT NULL,

  row_version                        INT NOT NULL DEFAULT 1,
  created_by                         TEXT NOT NULL,
  created_at                         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- is_financial=false rows must never carry an amount (honest N/A, not a
  -- fabricated $0) — DB-enforced, not just command-layer.
  CONSTRAINT chk_rvn_roi_benefit_lines_financial_amount
    CHECK (NOT (is_financial = false AND amount IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_benefit_lines_case ON rvn_roi_benefit_lines(organization_id, case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rvn_roi_benefit_lines_dcgroup ON rvn_roi_benefit_lines(case_id, double_counting_group) WHERE deleted_at IS NULL AND double_counting_group IS NOT NULL;

CREATE OR REPLACE FUNCTION rvn_roi_benefit_lines_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.is_financial IS DISTINCT FROM OLD.is_financial
       OR NEW.timing_type IS DISTINCT FROM OLD.timing_type
       OR NEW.one_time_period_date IS DISTINCT FROM OLD.one_time_period_date
       OR NEW.recurrence_start_date IS DISTINCT FROM OLD.recurrence_start_date
       OR NEW.recurrence_end_date IS DISTINCT FROM OLD.recurrence_end_date
       OR NEW.recurrence_cadence IS DISTINCT FROM OLD.recurrence_cadence
       OR NEW.ramp_periods IS DISTINCT FROM OLD.ramp_periods
       OR NEW.double_counting_group IS DISTINCT FROM OLD.double_counting_group
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION 'rvn_roi_benefit_lines: benefit line % is frozen', OLD.benefit_line_id USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_benefit_lines_protect_frozen ON rvn_roi_benefit_lines;
CREATE TRIGGER trg_rvn_roi_benefit_lines_protect_frozen
  BEFORE UPDATE ON rvn_roi_benefit_lines
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_benefit_lines_protect_frozen();

-- Note: double_counting_resolution_note is intentionally NOT in the frozen
-- guard's protected-field list — resolving a double-counting group after
-- freeze (during a later reapproval cycle) must remain possible; only the
-- financial facts (amount/currency/timing) are locked.

-- ============================================================
-- rvn_roi_benefit_evidence_links — typed, not a loose kpi_id (AC-02)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_benefit_evidence_links (
  link_id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benefit_line_id                     UUID NOT NULL REFERENCES rvn_roi_benefit_lines(benefit_line_id),
  case_id                             UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                     TEXT NOT NULL,

  kpi_id                              UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  pinned_kpi_definition_version_id    UUID NOT NULL REFERENCES rvn_kpi_definition_versions(definition_version_id),

  expected_unit                       TEXT NULL,
  purpose                             TEXT NOT NULL CHECK (purpose IN ('primary_evidence','supporting')),

  linked_by                           TEXT NOT NULL,
  linked_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),
  freshness_checked_at                TIMESTAMPTZ NULL,
  dispute_status                      TEXT NOT NULL DEFAULT 'none' CHECK (dispute_status IN ('none','stale','disputed')),
  notes                               TEXT NULL,

  row_version                         INT NOT NULL DEFAULT 1,
  created_by                          TEXT NOT NULL,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_bel_case ON rvn_roi_benefit_evidence_links(organization_id, case_id);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_bel_benefit_line ON rvn_roi_benefit_evidence_links(benefit_line_id);

-- ============================================================
-- rvn_roi_scenarios / rvn_roi_scenario_overrides (AC-04)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_scenarios (
  scenario_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id    TEXT NOT NULL,

  -- No 'base' row — base is implicit (scenario_id = NULL on a run means
  -- "use each line's own base value directly"). Decision D10.
  scenario_type      TEXT NOT NULL CHECK (scenario_type IN ('downside','upside','custom')),
  label              TEXT NOT NULL,
  description        TEXT NULL,

  deleted_at         TIMESTAMPTZ NULL,
  deleted_by         TEXT NULL,
  frozen_at          TIMESTAMPTZ NULL,
  frozen_by          TEXT NULL,

  row_version        INT NOT NULL DEFAULT 1,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_scenarios_case ON rvn_roi_scenarios(organization_id, case_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS rvn_roi_scenario_overrides (
  override_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id        UUID NOT NULL REFERENCES rvn_roi_scenarios(scenario_id),
  organization_id    TEXT NOT NULL,

  target_type        TEXT NOT NULL CHECK (target_type IN ('assumption','cost_line','benefit_line')),
  target_id          UUID NOT NULL,

  override_value     NUMERIC NULL,
  override_amount    NUMERIC NULL,
  note               TEXT NULL,

  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (scenario_id, target_type, target_id)
);

-- ============================================================
-- rvn_roi_calculation_runs — immutable (AC-06)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_calculation_runs (
  run_id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                           UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                   TEXT NOT NULL,

  engine_version                    TEXT NOT NULL,
  policy_version_stamp              TEXT NOT NULL,
  scenario_id                       UUID NULL REFERENCES rvn_roi_scenarios(scenario_id),

  status                            TEXT NOT NULL CHECK (status IN ('completed','failed')),

  input_snapshot                    JSONB NOT NULL,
  input_hash                        TEXT NOT NULL,

  total_costs                       NUMERIC NULL,
  total_financial_benefits          NUMERIC NULL,
  simple_roi                        NUMERIC NULL,
  npv                               NUMERIC NULL,
  irr_pct                           NUMERIC NULL,
  irr_status                        TEXT NOT NULL DEFAULT 'not_applicable'
                                       CHECK (irr_status IN ('computed','not_applicable','no_sign_change','not_required_by_policy')),
  payback_periods                   NUMERIC NULL,
  discounted_payback_periods        NUMERIC NULL,
  benefit_cost_ratio                NUMERIC NULL,

  period_series                     JSONB NOT NULL,

  has_unresolved_double_counting    BOOLEAN NOT NULL DEFAULT false,
  has_mixed_currency_failure        BOOLEAN NOT NULL DEFAULT false,
  validation_findings                JSONB NOT NULL DEFAULT '[]',
  warnings                          JSONB NOT NULL DEFAULT '[]',

  initiated_by                      TEXT NOT NULL,
  started_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No row_version, no UPDATE path, no frozen_at, no trigger — immutable by
  -- construction, never mutated after INSERT.
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_calc_runs_case ON rvn_roi_calculation_runs(organization_id, case_id, created_at DESC);
```

`policy_version_stamp` is deliberately not a FK to a governed policy table
(Decision D9 defers `ROIPolicyVersion`) — it is a content-hash/label string of
`rvn_roi_calculation_policy`'s row state at run time, computed the same way
`input_hash` is (see §5).

---

## 4. Command layer (`server/src/services/resultsVnext/roi/`)

New files, following ROI-E001's established conventions
(`executeAtomicCreate` for list-item adds guarded on parent case status,
`executeAtomicCommand` with `row_version` CAS for edits, matching
`kpiCorrectiveActionCommands.ts`'s `addCorrectiveAction`/`updateCorrectiveAction`
shape):

- `roiCalculationPolicyCommands.ts` — `captureOrUpdateCalculationPolicy` (always-update, mirrors `captureOrUpdateBaseline`: frozen-guard, no self-approval check).
- `roiAssumptionCommands.ts` — `addAssumption`, `updateAssumption`, `removeAssumption` (soft delete).
- `roiCostLineCommands.ts` / `roiBenefitLineCommands.ts` — same add/update/remove shape. `addBenefitLine`/`updateBenefitLine` enforce in `applyMutation` (cross-field rule, not a simple CHECK beyond the DB constraint already added): `isFinancial=true` requires `amount`/`currency`; `isFinancial=false` requires `amount IS NULL` (DB constraint `chk_rvn_roi_benefit_lines_financial_amount` is the backstop, command-layer check gives a clean typed error instead of a raw 23514).
- `roiBenefitEvidenceLinkCommands.ts` — `addBenefitEvidenceLink` (validates `kpi_id`/`definition_version_id` exist and share `organization_id` — no KPI-visibility check on the linker, per Decision D14), `removeBenefitEvidenceLink`, `flagBenefitEvidenceLinkDisputed`.
- `roiScenarioCommands.ts` — `addScenario`, `updateScenario`, `removeScenario`, `setScenarioOverride`/`removeScenarioOverride` (custom scenarios only — validate `scenario.scenario_type === 'custom'` before allowing an override write).

All of the above guard on the same `NON_EDITABLE_STATUSES` set already defined
in `roiCaseCommands.ts` — export it from that file (currently module-private;
add to its export list, a minimal additive change) rather than re-declaring it.

### 4.1 `createRoiCase` extension (Changed file: `roiCaseCommands.ts`)

Per Decision D5, add one `INSERT INTO rvn_roi_calculation_policy (case_id,
organization_id, created_by) VALUES (...)` inside `createRoiCase`'s existing
`applyMutation`, immediately after the baseline-shell insert. `rounding_policy`
takes its DDL default (`'half_up_2dp'`) — no value passed from the command.
`CreateRoiCaseResult` gains a `calculationPolicy: RoiCalculationPolicy` field;
the `roi.case_created` event's `afterState` gains a `calculationPolicy` key. No
other part of `createRoiCase` changes — ACL grants, obligation creation, and the
SAVEPOINT dedupe race are untouched.

### 4.2 `roiCalculationRunCommands.ts` — the compute command

```typescript
export interface CreateRoiCalculationRunInput {
  organizationId: string;
  caseId: string;
  scenarioId?: string | null;  // null = base
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
}

export async function createRoiCalculationRun(
  input: CreateRoiCalculationRunInput
): Promise<AtomicCommandOutcome<RoiCalculationRun>>
```

Shape: `executeAtomicCreate`. Inside `applyMutation`:
1. `SELECT ... FOR UPDATE` the case row — status must be `modeling` or
   `ready_for_review` (re-running from Ready-for-Review to fix a flagged
   finding is legitimate and does not itself change status).
2. Read `rvn_roi_calculation_policy`, active (`deleted_at IS NULL`)
   `rvn_roi_assumptions`, `rvn_roi_cost_lines`, `rvn_roi_benefit_lines`, and
   (if `scenarioId` given) its `rvn_roi_scenario_overrides` — all inside the
   same transaction for a consistent snapshot.
3. Build `RoiCalculationEngineInput` (typed, camelCase, all numeric fields as
   plain `number` at this boundary — the engine itself converts to `Decimal`
   internally per Decision D12), call the **pure**
   `runRoiCalculationEngine(input)`.
4. Persist the output as one `rvn_roi_calculation_runs` row (`INSERT`,
   immutable). `policy_version_stamp` and `input_hash` both computed via
   `computeStateHash` (reused from `kpi/kpiDefinitionCommands.ts`, already
   exported for exactly this kind of reuse) — `policy_version_stamp =
   computeStateHash(policyRow-with-fixed-key-order)`, `input_hash =
   computeStateHash(fullEngineInput-with-fixed-key-order)`.
5. `buildEvent`: `roi.calculation_run_completed` (status `'completed'`) or
   `roi.calculation_run_failed` (status `'failed'`, e.g. mixed-currency
   hard-fail) — the run row is always inserted either way, an honest record of
   the attempt, never silently discarded.

### 4.3 The pure engine (`server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts`)

New dependency: add `decimal.js` to `package.json` (Decision D12) — pure,
dependency-free, widely used, scoped to this one file's internal arithmetic.

```typescript
import Decimal from 'decimal.js';
import { npv, irr, payback, discountedPayback } from '../../../investmentAppraisalService.js';

export const ROI_CALCULATION_ENGINE_VERSION = '1.0.0';

export interface RoiCalculationEngineInput {
  currency: string;
  granularity: 'monthly' | 'annual';
  analysisStart: string;  // DATE
  analysisEnd: string;    // DATE
  discountRatePct: number | null;   // ANNUAL rate, see Decision D13
  roundingPolicy: 'half_up_2dp' | 'half_even_2dp' | 'none';
  requiredMetrics: string[] | null;
  assumptions: RoiEngineAssumption[];
  costLines: RoiEngineCostLine[];
  benefitLines: RoiEngineBenefitLine[];
  scenarioType: 'downside' | 'upside' | 'custom' | null;  // null = base
  scenarioOverrides: RoiEngineScenarioOverride[];  // 'custom' only
}

export interface RoiCalculationEngineOutput {
  status: 'completed' | 'failed';
  periodSeries: RoiEngineCashFlowPeriod[];
  totalCosts: number | null;
  totalFinancialBenefits: number | null;
  simpleRoi: number | null;
  npv: number | null;
  irrPct: number | null;
  irrStatus: 'computed' | 'not_applicable' | 'no_sign_change' | 'not_required_by_policy';
  paybackPeriods: number | null;
  discountedPaybackPeriods: number | null;
  benefitCostRatio: number | null;
  hasUnresolvedDoubleCounting: boolean;
  hasMixedCurrencyFailure: boolean;
  validationFindings: RoiCalculationValidationFinding[];
  warnings: string[];
}

export function runRoiCalculationEngine(
  input: RoiCalculationEngineInput
): RoiCalculationEngineOutput
```

Pipeline (validate/normalize → expand periods → apply scenario overrides →
compute metrics → validation findings), followed literally:

**1. Validation (before anything else runs).** Mixed-currency hard-fail: if any
cost/benefit line's `currency !== input.currency`, return immediately with
`status: 'failed'`, `hasMixedCurrencyFailure: true`, `periodSeries: []`, every
metric `null` — AC-05's "hard-fail" read as "does not compute a number," not
"computes a number and also warns." Double-counting scan runs regardless of
currency status (recorded as a finding, does not itself fail the run — that is
Ready-for-Review's gate, not the engine's).

**2. Rate conversion (Decision D13).** `periodsPerYear = granularity === 'monthly' ? 12 : 1`. If `discountRatePct` is set:
`periodRate = (1 + discountRatePct/100)^(1/periodsPerYear) - 1`, computed in
`Decimal` (`Decimal.pow`). If `discountRatePct` is null, treat as `0` (no
discounting — NPV degenerates to simple undiscounted sum, a legitimate,
documented fallback for an incomplete-policy case, matching the honest-missing
philosophy: still computes a number, just an undiscounted one, with a warning
`'discount_rate_missing_using_zero'` appended).

**3. Period expansion.** One entry per period between `analysisStart`/
`analysisEnd` at `granularity`. One-time lines hit their single period;
recurring lines spread across their date range at their own cadence
(independent of the case's overall `granularity` — a quarterly-cadence cost
inside a monthly-granularity case contributes to only every third period).
Benefit lines with `rampPeriods` set linearly ramp from `0` to their full
per-period amount over that many periods from their start. All summation
(`totalCosts`, `totalFinancialBenefits`, per-period net) done in `Decimal`,
converted to `number` only when building the final output object.

**4. Scenario overrides.** `scenarioType === 'downside'`: for every assumption,
substitute `downside_value` for `base_value` wherever the assumption feeds a
line's amount via a documented formula reference (if the source data has no
such linkage for a given line, the line's own `amount` is used unchanged — an
assumption's downside/upside only affects lines that explicitly reference that
assumption, which is out of this epic's line-item formula-linking scope; flag
this as a real simplification, not a hidden gap — see §10 note). `upside`:
mirror with `upside_value`. `custom`: apply each `rvn_roi_scenario_overrides`
row — `override_value` replaces an assumption's `base_value` for that
calculation only; `override_amount` replaces a cost/benefit line's `amount` for
that calculation only. `null` (base): no substitution, use every line's own
value as stored.

**5. Metrics**, computed via the **imported** `investmentAppraisalService.ts`
functions (Decision D1) — `initialInvestment` = period-0 costs if any,
`cashflows` = the expanded net series for periods 1..N, passed as plain
`number[]` (`.toNumber()` from the engine's internal `Decimal` period series).
`irrStatus`: `'not_applicable'` when `irr()` returns `null` (bisection found no
sign change); `'not_required_by_policy'` when `requiredMetrics` is set and
excludes `'irr'` (the engine skips the `irr()` call entirely in that case, not
just hides the result). Final rounding to `roundingPolicy`'s precision applied
only at this last step, to the output numbers only — internal period-series
`Decimal` values are never pre-rounded before summation.

**Determinism**: no `Date.now()`/`Math.random()` anywhere in this file. Every
object this module builds (for hashing or for output) uses a fixed, hardcoded
key literal order — never `Object.entries()`/spread from a DB row map — so
`computeStateHash` is byte-for-byte reproducible given the same logical input.

---

## 5. Wiring into `isRoiCaseReadyForReviewEligible` (Decision from ROI-E001 D2)

**New file** `server/src/services/resultsVnext/roi/roiEconomicModelReadiness.ts`:

```typescript
import type { PoolClient } from 'pg';
import { isRoiCaseReadyForReviewEligible, type RoiCaseReadyForReviewCheck } from './roiCaseCommands.js';
import type { RoiCaseRow, RoiBaselineRow } from './roiTypes.js';
import { computeCurrentEconomicModelHash } from './roiCalculationRunCommands.js';

/** ROI-E002's extension point on ROI-E001's guard (ROI-E001 Decision D2):
 * wraps isRoiCaseReadyForReviewEligible, never replaces its body. */
export async function isRoiCaseReadyForReviewEligibleWithEconomicModel(
  client: PoolClient,
  caseRow: RoiCaseRow,
  baselineRow: RoiBaselineRow
): Promise<RoiCaseReadyForReviewCheck> {
  const baselineCheck = isRoiCaseReadyForReviewEligible(caseRow, baselineRow);
  if (!baselineCheck.eligible) return baselineCheck;

  const { rows } = await client.query(
    `SELECT * FROM rvn_roi_calculation_runs
      WHERE case_id = $1 AND organization_id = $2
      ORDER BY created_at DESC LIMIT 1`,
    [caseRow.case_id, caseRow.organization_id]
  );
  const latestRun = rows[0];
  if (!latestRun || latestRun.status !== 'completed') {
    return { eligible: false, reason: 'no_successful_calculation_run' };
  }
  const currentHash = await computeCurrentEconomicModelHash(client, caseRow.case_id, caseRow.organization_id);
  if (latestRun.input_hash !== currentHash) {
    return { eligible: false, reason: 'calculation_run_stale' };
  }
  if (latestRun.has_unresolved_double_counting) {
    return { eligible: false, reason: 'unresolved_double_counting_group' };
  }
  return { eligible: true };
}
```

**Changed** `roiCaseCommands.ts`:
- `RoiCaseLifecycleTransitionSpec.guard` type widens from
  `(caseRow, baselineRow) => RoiCaseReadyForReviewCheck` to `(client:
  PoolClient, caseRow: RoiCaseRow, baselineRow: RoiBaselineRow) =>
  Promise<RoiCaseReadyForReviewCheck>`.
- `runRoiCaseLifecycleTransition`'s one call site becomes `const check = await
  spec.guard(client, currentRow, baselineRow);`.
- `markReadyForReview`'s spec: `guard: (client, caseRow, baselineRow) =>
  isRoiCaseReadyForReviewEligibleWithEconomicModel(client, caseRow,
  baselineRow)` — imported from the new file, not implemented inline (avoids a
  circular import, since the calc-run commands need types from
  `roiCaseCommands.ts`).
- `startModeling`'s spec has no `guard` today and needs none added.

This is a real, necessary edit to an already-shipped file — call it a "Changed"
file honestly rather than pretending the extension point alone was sufficient
without touching the guard's type signature.

---

## 6. Visibility

Every new table inherits visibility via `case_id` only (Decision D15) — no new
`resource_type`, `RVN_RESOURCE_TYPES` unchanged. Every repository read
(`getCalculationPolicy`, `listAssumptions`, `listCostLines`, `listBenefitLines`,
`listScenarios`, `listCalculationRuns`, `getCalculationRun`) uses the identical
join shape `getRoiBaseline` already uses in the shipped `roiRepository.ts`:
`INNER JOIN rvn_visible_resources ON resource_type='roi_case' AND resource_id =
<table>.case_id::text` — the `::text` cast applies to every one of these new
joins, no exceptions (ROI-E001 §5's exact lesson).

KPI evidence link hydration (Decision D14): a repository function that resolves
a benefit line's evidence links into display-ready KPI details (name, status,
current value) must additionally pass through KPI's own
`buildVisibilityScopedCte({ resourceType: 'kpi' })` — a caller without KPI
access gets the link's own fields (pinned id/version/purpose/dispute_status)
but a null/redacted KPI-detail payload, not the KPI's content.

---

## 7. API surface (Changed file: `server/src/routes/resultsVnext/roi.routes.ts`)

Extends the already-live router, mounted at the existing `/api/vnext/results/roi`
root — no `Gateway.ts` change needed.

| Method | Path | Command/Repository |
|---|---|---|
| `GET`/`PUT` | `/cases/:caseId/calculation-policy` | `getCalculationPolicy` / `captureOrUpdateCalculationPolicy` |
| `GET`/`POST`/`PATCH`/`DELETE` | `/cases/:caseId/assumptions[/:assumptionId]` | `roiAssumptionCommands.ts` + repository |
| `GET`/`POST`/`PATCH`/`DELETE` | `/cases/:caseId/cost-lines[/:costLineId]` | `roiCostLineCommands.ts` + repository |
| `GET`/`POST`/`PATCH`/`DELETE` | `/cases/:caseId/benefit-lines[/:benefitLineId]` | `roiBenefitLineCommands.ts` + repository |
| `GET`/`POST`/`DELETE` | `/cases/:caseId/benefit-lines/:benefitLineId/kpi-evidence-links[/:linkId]` | `roiBenefitEvidenceLinkCommands.ts` |
| `GET`/`POST`/`PATCH`/`DELETE` | `/cases/:caseId/scenarios[/:scenarioId]` | `roiScenarioCommands.ts` + repository |
| `POST` | `/cases/:caseId/scenarios/:scenarioId/overrides` | `setScenarioOverride` |
| `DELETE` | `/cases/:caseId/scenarios/:scenarioId/overrides/:overrideId` | `removeScenarioOverride` |
| `POST` | `/cases/:caseId/calculation-runs` | `createRoiCalculationRun` |
| `GET` | `/cases/:caseId/calculation-runs` | `listCalculationRuns` |
| `GET` | `/cases/:caseId/calculation-runs/:runId` | `getCalculationRun` |

Every write except `createRoiCalculationRun` (a pure create) and the two
overrides endpoints (CAS via the parent scenario's `expectedVersion`) requires
`expectedVersion`. Every write re-checks `NON_EDITABLE_STATUSES` the same way
`updateRoiCaseDetails` does today.

No literal-vs-dynamic path collision introduced within this router's own set —
no `Gateway.ts` mount-order change needed for this package.

Validators: `server/src/validators/resultsVnextRoiEconomicModel.validators.ts`,
redeclaring shared field helpers locally, matching every existing
`resultsVnextRoi*.validators.ts` convention.

---

## 8. File list (backend only)

**New:**
- `server/migrations/20260816_rvn_roi_economic_model.sql`
- `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts`
- `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.types.ts`
- `server/src/services/resultsVnext/roi/roiEconomicModelTypes.ts`
- `server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.ts`
- `server/src/services/resultsVnext/roi/roiAssumptionCommands.ts`
- `server/src/services/resultsVnext/roi/roiCostLineCommands.ts`
- `server/src/services/resultsVnext/roi/roiBenefitLineCommands.ts`
- `server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.ts`
- `server/src/services/resultsVnext/roi/roiScenarioCommands.ts`
- `server/src/services/resultsVnext/roi/roiCalculationRunCommands.ts`
- `server/src/services/resultsVnext/roi/roiEconomicModelReadiness.ts`
- `server/src/services/resultsVnext/roi/roiEconomicModelFreeze.ts` (`freezeRoiEconomicModel`, cross-epic contract for ROI-E003, mirrors `freezeRoiBaseline`)
- `server/src/services/resultsVnext/roi/roiEconomicModelRepository.ts`
- `server/src/validators/resultsVnextRoiEconomicModel.validators.ts`
- `tests/resultsVnext/roi/roiCalculationEngine.knownAnswer.test.ts` (§9, pure, no DB)
- `tests/resultsVnext/roi/roiCalculationRun.realdb.test.ts`
- `tests/resultsVnext/roi/roiEconomicModelVisibilityJoin.realdb.test.ts`
- `tests/resultsVnext/roi/roiEconomicModelFreeze.realdb.test.ts`
- `server/src/routes/resultsVnext/__tests__/roiEconomicModel.routes.test.ts`

**Changed:**
- `server/src/services/resultsVnext/roi/roiCaseCommands.ts` — calculation-policy shell insert (§4.1); `guard` type widens to async+client (§5); `NON_EDITABLE_STATUSES` exported.
- `server/src/routes/resultsVnext/roi.routes.ts` — new routes appended (§7).
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — new `EVENT_TYPE_CONSUMER_GROUPS` entries: `roi.calculation_policy_updated`, `roi.assumption_added/updated/removed`, `roi.cost_line_added/updated/removed`, `roi.benefit_line_added/updated/removed`, `roi.benefit_evidence_link_added/removed/disputed`, `roi.scenario_added/updated/removed`, `roi.calculation_run_completed`, `roi.calculation_run_failed`, `roi.economic_model_frozen` (reserved now for ROI-E003, same forward-declaration precedent `roi.baseline_frozen` already used).
- `package.json` — add `decimal.js` dependency (Decision D12).
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entries, plus a backlog note for the deferred `ROIPolicyVersion`/`ROIWorkingRevision` (Decision D9) and for assumption-to-line formula linking (§9 simplification note).

**Read-only reference:** `server/src/services/investmentAppraisalService.ts`,
`server/src/services/resultsVnext/kpi/kpiCorrectiveActionCommands.ts`,
`server/src/services/resultsVnext/kpi/targetGeometryEvaluator.ts`,
`server/src/services/resultsVnext/roi/roiCaseCommands.ts` / `roiBaselineCommands.ts` / `roiRepository.ts`.

---

## 9. Known-answer test plan (AC-05, hard requirement)

**`tests/resultsVnext/roi/roiCalculationEngine.knownAnswer.test.ts`** (pure, no DB):

1. **KA-1** (required by AC-05): $100,000 one-time cost at period 0, $8,000/month
   benefit for periods 1-24, `discountRatePct=12` (annual), `granularity=
   'monthly'`. Per Decision D13: `periodRate = (1.12)^(1/12) - 1 ≈
   0.0094888...` (≈0.94888% monthly). Hand-compute NPV as `-100000 +
   Σ_{t=1}^{24} 8000/(1.0094888)^t` in the test's own comment (do the full
   arithmetic explicitly in the test file so it's independently checkable, not
   just asserted against the engine's own output) and assert `toBeCloseTo`
   against that hand-computed figure — matching
   `investmentAppraisalService.test.ts`'s own established style. Also assert
   `paybackPeriods` against a hand-computed undiscounted breakeven period.
2. Recurring cost + ramped benefit — assert the ramp linearly scales from `0`
   to full amount over `rampPeriods`.
3. Downside/base/upside — same lines, three engine calls differing only in
   `scenarioType`; assert monotonic NPV ordering (downside < base < upside)
   and that no other output field differs except what the scenario touches.
4. Delayed start + fractional payback period (non-integer `paybackPeriods`).
5. Negative-ROI case: assert `paybackPeriods` stays `null` (JSON-safe — never
   `Infinity`), not a fabricated large number.
6. Non-financial-only benefit (`isFinancial=false`): `simpleRoi`/`npv` computed
   from costs only, benefit line excluded from the financial sum, no
   fabricated `$0` anywhere in the output for that line's own contribution.
7. Missing input vs. true zero: a line/assumption with `amount=null`/
   `baseValue=null` is never silently treated as `0` in aggregation — assert
   the specific case where this would otherwise produce a wrong number.
8. **Mixed-currency hard-fail** (AC-05's second half): one benefit line in a
   different currency than the case → `status='failed'`,
   `hasMixedCurrencyFailure=true`, `periodSeries=[]`, every metric `null`.
9. IRR `'not_applicable'`: all-positive or all-negative flows (no sign
   change) — assert `irrPct === null` and `irrStatus === 'not_applicable'`,
   not a thrown error.
10. Double-counting: two benefit lines share a `double_counting_group`,
    neither has a `double_counting_resolution_note` →
    `hasUnresolvedDoubleCounting=true`; adding a note to either → `false` on
    the next engine call with the same inputs plus that one note.
11. Determinism: same input object run twice → byte-identical `input_hash`
    (computed by the command layer, but assert the engine's own output object
    is deep-equal across two calls with the same input, which is the
    prerequisite for hash stability).
12. `requiredMetrics` excludes `'irr'`: assert `irrStatus ===
    'not_required_by_policy'` and that `irr()` is never invoked (mock/spy on
    the imported function, or assert via a coverage-style check that the
    bisection loop's characteristic iteration count doesn't appear — simplest
    is a spy on the imported `irr` function).

**`tests/resultsVnext/roi/roiCalculationRun.realdb.test.ts`**: DB-integration
side — assembling engine input from real `rvn_roi_*` rows inside a transaction,
persisting the immutable run row, and
`isRoiCaseReadyForReviewEligibleWithEconomicModel`'s three deny branches (no
run / stale run / unresolved double-counting) plus the eligible-after-fresh-run
happy path — same realDB discipline every prior epic in this program has
mandated for new repository functions.

**Documented simplification** (flag in the ledger, not silently shipped):
scenario override application (§4.3 step 4) assumes assumption-to-line linkage
is either absent (no substitution) or handled entirely via the explicit
`rvn_roi_scenario_overrides` table for `custom` scenarios — there is no
formula-language connecting "this cost line derives from this assumption" for
canonical downside/upside scenarios beyond the simple case where a line's own
value directly mirrors an assumption's value. A richer formula-linking system
(cost line = assumption × unit rate, etc.) is out of scope for this epic and
not blocked by any of the 6 ACs, but is a real product gap worth naming.

---

## 10. Definition of done

- [ ] All 12 known-answer engine tests pass, with hand-computed expected values shown in test comments, not just internal cross-checks
- [ ] Mixed-currency hard-fail proven (no metrics computed, `status='failed'`)
- [ ] `isRoiCaseReadyForReviewEligibleWithEconomicModel`'s three deny branches + happy path proven on realDB
- [ ] `roiEconomicModelVisibilityJoin.realdb.test.ts` passes for every new table's `::text` cast
- [ ] `roiEconomicModelFreeze.realdb.test.ts` passes (all freeze triggers block content mutation post-freeze, `double_counting_resolution_note` confirmed still editable post-freeze)
- [ ] `decimal.js` scoped correctly — no `Decimal` values leak outside `roiCalculationEngine.ts`'s own module boundary (command layer only ever sees plain `number`/`null`)
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Full existing KPI + ROI-E001 test suite still green — before/after evidence via `git worktree` on the pre-epic SHA, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry (design → build → verify, calibrated) + `EPIC_LEDGER_LIVE.md` ROI-E002 rows updated + backlog notes for Decision D9's deferral and the §9 formula-linking simplification
