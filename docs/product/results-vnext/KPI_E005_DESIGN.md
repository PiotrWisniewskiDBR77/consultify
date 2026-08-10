# KPI-E005 Perspectives & Links — Approved Design

> Status: APPROVED FOR IMPLEMENTATION (Integration Owner review 2026-08-09).
> Draft: agent `a8d29666f58d13304` (single-pass, complete, no truncation —
> lesson from §16/§22 applied successfully). Full DDL/code below, verbatim
> from the draft except where a decision changes it.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | "5 surfaces" for identity test — not literally named anywhere in the plan | **Approved as drafted**: Portfolio list, KPI Tool detail, My KPIs, Organization/manager view, Scorecard Tool KPI list. Reasonable, consistent with plan §6's own surface taxonomy. |
| 2 | "Missing ownership" in §B under-reports for a manager without RBAC override (T3 non-leak hides unowned KPIs the manager can't see) | **Accept as designed.** T3 (never leak existence) outranks completeness of an attention metric — same priority order the whole program has used since RN-G1's threat model. Document as a known, intentional limitation in the DTO/UI layer, not a bug to "fix" by weakening visibility. |
| 3 | Three new permission verbs (`kpi.propose_initiative_impact`, `kpi.commit_initiative_impact`, `kpi.review_initiative_impact`) extend the frozen §5.2 verb list | **Approved by Integration Owner.** This is additive governance for a feature the original plan's own YAML (§3.1 `InitiativeKPIImpact`) already specified — not a competing model or an architecture change of the kind that needs Founder-level escalation. Same authority this session has used to approve KPI-E001–E004's design decisions. |
| 4 | `measurement_frequency_days` — new nullable column on the already-shipped, approved `rvn_kpi_definition_versions` table | **Approved, and ratified as the standing pattern** for any future cadence-related column ROI/OKR packages need on an already-shipped table: additive `ADD COLUMN ... NULL`, extend the relevant `protect_*` immutability trigger in the SAME migration, never a destructive/backfilling ALTER. |
| 5 | `update_due` heuristic has no grace period — flips to "due" the instant cadence elapses | **Add a 1-day grace period** (`... < $4 - interval '1 day'` becomes `... < $4` effectively meaning report by end of the day cadence elapses, i.e. compare against `$4 - interval '1 day'` is NOT what we want — precisely: due_at threshold stays `latest.period_end + cadence`, but the branch's inclusion predicate becomes `due_at < now() - interval '1 day'` is wrong too). **Concrete rule**: an item enters `update_due` only once `now() > due_at + interval '1 day'` (one full day of slack after the computed due instant) — simple, avoids same-day flapping, adjustable later via a real policy column if this proves too coarse. Apply this by changing branch 1b's final predicate from `(...) < $4` to `(...) < $4 - interval '1 day'`. |

## A) My KPIs read model

### A.1 Signature

```ts
// server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts (NEW)

export type MyKpiAttentionType =
  | 'update_due'
  | 'explanation_or_plan_obligation'
  | 'owned_corrective_action'
  | 'manager_decision_waiting'
  | 'upcoming_review'
  | 'other_obligation'; // catch-all for any obligation_type not yet in the known taxonomy

export type MyKpiAttentionSource = 'governed' | 'derived_heuristic';

export interface MyKpiAttentionItem {
  attentionType: MyKpiAttentionType;
  attentionSource: MyKpiAttentionSource;
  priorityRank: number; // 1 (most urgent) .. 6
  kpiId: string | null; // null only for branch 5 (scorecard-level, no single kpi_id)
  kpiCode: string | null;
  kpiStatus: string | null;
  dueAt: string | null;
  relatedType: 'obligation' | 'deviation_case' | 'corrective_action' | 'scorecard' | null;
  relatedId: string | null;
  detail: Record<string, unknown>;
}

export interface ListMyKpisParams {
  userId: string;
  organizationId: string;
  now?: string;
  limit?: number;
  offset?: number;
}

export async function listMyKpis(params: ListMyKpisParams): Promise<MyKpiAttentionItem[]>;
```

### A.2 Prioritization

Rank order per plan §6.5: `update_due(1) → explanation_or_plan_obligation(2) →
owned_corrective_action(3) → manager_decision_waiting(4) →
upcoming_review(5)`, `other_obligation(6)` as a safety net (a new
`obligation_type` this list doesn't yet know about still surfaces instead of
silently vanishing — same class of gap as the missing `binary`
geometry/`pending_approval` status from §16). Within a rank:
`ORDER BY due_at ASC NULLS LAST`.

### A.3 Schema prerequisite

```sql
-- server/migrations/20260813_rvn_kpi_measurement_cadence.sql
ALTER TABLE rvn_kpi_definition_versions
  ADD COLUMN IF NOT EXISTS measurement_frequency_days INT NULL
    CHECK (measurement_frequency_days IS NULL OR measurement_frequency_days > 0);

-- REQUIRED: extend rvn_kpi_definition_versions_protect_approved()
-- (20260810_rvn_kpi_core.sql) to also guard this column — CREATE OR REPLACE
-- FUNCTION is idempotent, add one more IS DISTINCT FROM clause to the
-- existing IF inside that function body:
--   OR NEW.measurement_frequency_days IS DISTINCT FROM OLD.measurement_frequency_days
```

### A.4 Full SQL

One query, `UNION ALL` of six branches, all filtered through the same
`rvn_visible_resources` CTE (`resourceType='kpi'`) built once via
`buildVisibilityScopedCte`. `$1`=organizationId `$2`='kpi' `$3`=userId (CTE
params, `VISIBILITY_CTE_PARAM_COUNT`=3) `$4`=now() `$5`=limit `$6`=offset.

```sql
WITH rvn_visible_resources(resource_type, resource_id) AS (
  -- << buildVisibilityScopedCte body, spliced in by wrapWithVisibilityScope >>
  ...
),

branch_update_due_governed AS (
  SELECT
    'update_due'::text AS attention_type, 'governed'::text AS attention_source, 1 AS priority_rank,
    kd.kpi_id, kd.kpi_code, kd.status AS kpi_status,
    o.due_at,
    'obligation'::text AS related_type, o.obligation_id::text AS related_id,
    jsonb_build_object('obligationType', o.obligation_type) AS detail
  FROM rvn_kpi_definitions kd
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
  INNER JOIN rvn_platform_obligations o
          ON o.organization_id = kd.organization_id
         AND o.reference_type = 'kpi'
         AND o.reference_id = kd.kpi_id
         AND o.obligation_type IN ('enter_kpi_value', 'perform_periodic_kpi_review', 'reassess_observation_baseline')
         AND o.status = 'open'
  WHERE kd.organization_id = $1
    AND o.assignee_user_id = $3
),
branch_update_due_heuristic AS (
  SELECT
    'update_due'::text, 'derived_heuristic'::text, 1,
    kd.kpi_id, kd.kpi_code, kd.status,
    (COALESCE(latest.period_end, kd.created_at) + make_interval(days => kdv.measurement_frequency_days))::timestamptz,
    'obligation'::text, NULL::text,
    jsonb_build_object('lastMeasurementId', latest.measurement_id, 'lastPeriodEnd', latest.period_end)
  FROM rvn_kpi_definitions kd
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
  INNER JOIN rvn_kpi_definition_versions kdv
          ON kdv.definition_version_id = kd.current_definition_version_id
  LEFT JOIN LATERAL (
    SELECT m.measurement_id, m.period_end
      FROM rvn_kpi_measurements m
     WHERE m.kpi_id = kd.kpi_id
       AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer WHERE newer.correction_of_measurement_id = m.measurement_id)
     ORDER BY m.period_end DESC LIMIT 1
  ) latest ON true
  WHERE kd.organization_id = $1
    AND kd.owner_user_id = $3
    AND kd.status = 'active'
    AND kdv.measurement_frequency_days IS NOT NULL
    -- Decision #5: 1-day grace period applied here.
    AND (COALESCE(latest.period_end, kd.created_at) + make_interval(days => kdv.measurement_frequency_days))
        < $4 - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM branch_update_due_governed g WHERE g.kpi_id = kd.kpi_id)
),

branch_explanation_plan AS (
  SELECT
    'explanation_or_plan_obligation'::text, 'governed'::text, 2,
    kd.kpi_id, kd.kpi_code, kd.status,
    o.due_at,
    'obligation'::text, o.obligation_id::text,
    jsonb_build_object('obligationType', o.obligation_type, 'referenceType', o.reference_type)
  FROM rvn_platform_obligations o
  LEFT JOIN rvn_kpi_deviation_cases dc ON o.reference_type = 'deviation_case' AND dc.case_id = o.reference_id
  INNER JOIN rvn_kpi_definitions kd
          ON kd.kpi_id = COALESCE(CASE WHEN o.reference_type = 'kpi' THEN o.reference_id END, dc.kpi_id)
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
  WHERE kd.organization_id = $1
    AND o.organization_id = $1
    AND o.assignee_user_id = $3
    AND o.status = 'open'
    AND o.obligation_type IN (
      'explain_warning_critical_deviation', 'prepare_submit_corrective_plan',
      'resolve_disputed_measurement', 'verify_imported_value', 'resolve_missing_data'
    )
),

branch_corrective_actions AS (
  SELECT
    'owned_corrective_action'::text, 'governed'::text, 3,
    dc.kpi_id, kd.kpi_code, kd.status,
    ca.due_date::timestamptz,
    'corrective_action'::text, ca.action_id::text,
    jsonb_build_object('caseId', dc.case_id, 'actionStatus', ca.status, 'caseSeverity', dc.severity)
  FROM rvn_kpi_corrective_actions ca
  INNER JOIN rvn_kpi_deviation_cases dc ON dc.case_id = ca.deviation_case_id
  INNER JOIN rvn_kpi_definitions kd ON kd.kpi_id = dc.kpi_id
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = dc.kpi_id::text
  WHERE ca.organization_id = $1
    AND ca.owner_user_id = $3
    AND ca.status IN ('planned', 'active', 'blocked')
),

branch_manager_decision_waiting AS (
  SELECT
    'manager_decision_waiting'::text, 'governed'::text, 4,
    dc.kpi_id, kd.kpi_code, kd.status,
    NULL::timestamptz,
    'deviation_case'::text, dc.case_id::text,
    jsonb_build_object('planSubmittedAt', dc.plan_submitted_at, 'planSubmittedBy', dc.plan_submitted_by)
  FROM rvn_kpi_deviation_cases dc
  INNER JOIN rvn_kpi_definitions kd ON kd.kpi_id = dc.kpi_id
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = dc.kpi_id::text
  WHERE dc.organization_id = $1
    AND dc.status = 'plan_submitted'
    AND (dc.owner_user_id = $3 OR dc.plan_submitted_by = $3)
),

branch_upcoming_review AS (
  SELECT DISTINCT ON (sc.scorecard_id)
    'upcoming_review'::text, 'derived_heuristic'::text, 5,
    NULL::uuid, NULL::text, NULL::text,
    (COALESCE(last_pub.published_at, sc.created_at)
      + make_interval(days => CASE sc.review_frequency
          WHEN 'weekly' THEN 7 WHEN 'monthly' THEN 30
          WHEN 'quarterly' THEN 91 WHEN 'annual' THEN 365 ELSE NULL END))::timestamptz,
    'scorecard'::text, sc.scorecard_id::text,
    jsonb_build_object('scorecardName', sc.name, 'reviewFrequency', sc.review_frequency)
  FROM rvn_kpi_scorecards sc
  LEFT JOIN LATERAL (
    SELECT rs.published_at FROM rvn_kpi_scorecard_review_snapshots rs
     WHERE rs.scorecard_id = sc.scorecard_id AND rs.status IN ('published','superseded')
     ORDER BY rs.published_at DESC NULLS LAST LIMIT 1
  ) last_pub ON true
  WHERE sc.organization_id = $1
    AND sc.lifecycle_status = 'active'
    AND sc.review_frequency != 'custom'
    AND (
      sc.owner_user_id = $3
      OR EXISTS (
        SELECT 1 FROM rvn_kpi_scorecard_items si
        INNER JOIN rvn_kpi_definitions kd2 ON kd2.kpi_id = si.kpi_id
        WHERE si.scorecard_id = sc.scorecard_id AND kd2.owner_user_id = $3
      )
    )
),

branch_other_obligation AS (
  SELECT
    'other_obligation'::text, 'governed'::text, 6,
    kd.kpi_id, kd.kpi_code, kd.status,
    o.due_at, 'obligation'::text, o.obligation_id::text,
    jsonb_build_object('obligationType', o.obligation_type)
  FROM rvn_platform_obligations o
  LEFT JOIN rvn_kpi_deviation_cases dc ON o.reference_type = 'deviation_case' AND dc.case_id = o.reference_id
  INNER JOIN rvn_kpi_definitions kd
          ON kd.kpi_id = COALESCE(CASE WHEN o.reference_type = 'kpi' THEN o.reference_id END, dc.kpi_id)
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
  WHERE kd.organization_id = $1 AND o.organization_id = $1
    AND o.assignee_user_id = $3 AND o.status = 'open'
    AND o.obligation_type NOT IN (
      'enter_kpi_value','perform_periodic_kpi_review','reassess_observation_baseline',
      'explain_warning_critical_deviation','prepare_submit_corrective_plan',
      'resolve_disputed_measurement','verify_imported_value','resolve_missing_data'
    )
)

SELECT * FROM (
  SELECT * FROM branch_update_due_governed
  UNION ALL SELECT * FROM branch_update_due_heuristic
  UNION ALL SELECT * FROM branch_explanation_plan
  UNION ALL SELECT * FROM branch_corrective_actions
  UNION ALL SELECT * FROM branch_manager_decision_waiting
  UNION ALL SELECT * FROM branch_upcoming_review
  UNION ALL SELECT * FROM branch_other_obligation
) all_items
ORDER BY priority_rank ASC, due_at ASC NULLS LAST
LIMIT $5 OFFSET $6;
```

**Implementation note**: build as ONE SQL string (same style as `kpiRepository.ts`), not separate TS-level queries — `branch_update_due_heuristic` legitimately references `branch_update_due_governed` within the same `WITH`.

**Remember the `::text` cast** on every `vr.resource_id = <uuid column>`
comparison above — this is exactly the bug class fixed in §24. Every join
shown already has it; do not drop it when adapting.

## B) Organization/manager view

### B.1 Signature and prerequisite

```ts
// platform/managementChainMaintenance.ts — ADD (not a new file):
export async function listManagementChainDescendants(
  client: PoolClient,
  params: { organizationId: string; managerId: string; includeSelf?: boolean }
): Promise<string[]>;
// SELECT descendant_user_id FROM rvn_platform_management_chain_closure
//  WHERE organization_id=$1 AND ancestor_user_id=$2 [AND depth > 0 if includeSelf=false]
```

```ts
// kpiPerspectivesRepository.ts
export interface OrganizationKpiAttention {
  processCoverage: Array<{ primaryProcessId: string | null; totalKpis: number; activeKpis: number }>;
  ownerLoad: Array<{ ownerUserId: string; activeKpiCount: number; openDeviationCaseCount: number }>;
  missingOwnership: Array<{ kpiId: string; kpiCode: string }>;
  performanceDistribution: { onTarget: number; warning: number; critical: number; neutralOrMissing: number };
  overdueObligations: Array<{ obligationId: string; kpiId: string; assigneeUserId: string; obligationType: string; dueAt: string }>;
  repeatedDeviations: Array<{ kpiId: string; kpiCode: string; caseCountLast180Days: number; anySelfReportedRecurrence: boolean }>;
  ineffectiveCorrectiveActions: Array<{ caseId: string; kpiId: string; verificationId: string; status: 'ineffective' | 'partially_effective' }>;
}

export interface ListOrganizationKpiAttentionParams {
  managerId: string; organizationId: string; includeSelf?: boolean; recurrenceWindowDays?: number;
}

export async function listOrganizationKpiAttention(
  params: ListOrganizationKpiAttentionParams
): Promise<OrganizationKpiAttention>;
```

Implement as an orchestrator calling several independent queries (same
style `getScorecardStatusDistribution` uses vs. `listScorecardItems`) —
**each query independently filters before aggregating** (T3); no single
"already filtered" intermediate view that the rest quietly trusts.

### B.2 Shared base

```sql
-- $1=organizationId $2='kpi' $3=managerId (visibility CTE params)
-- $4=managerId (chain params, deliberately separate placeholder)
WITH rvn_visible_resources(resource_type, resource_id) AS (
  -- << buildVisibilityScopedCte body >>
),
chain_members AS (
  SELECT descendant_user_id AS user_id
    FROM rvn_platform_management_chain_closure
   WHERE organization_id = $1 AND ancestor_user_id = $4
  UNION
  SELECT $4
),
scoped_kpis AS (
  SELECT kd.*
    FROM rvn_kpi_definitions kd
    INNER JOIN rvn_visible_resources vr
            ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
    INNER JOIN chain_members cm ON cm.user_id = kd.owner_user_id
   WHERE kd.organization_id = $1
)
```

### B.3 Per-metric SQL

```sql
-- process coverage (distribution over existing primary_process_id, NOT
-- true coverage against a process registry — there isn't one, per
-- decision #5 in KPI_E001_E002_DESIGN.md; NULL = "unassigned to a process",
-- shown honestly, never hidden)
SELECT primary_process_id,
       COUNT(*) AS total_kpis,
       COUNT(*) FILTER (WHERE status = 'active') AS active_kpis
  FROM scoped_kpis
 GROUP BY primary_process_id;

-- owner load
SELECT
    kd.owner_user_id,
    COUNT(DISTINCT kd.kpi_id) FILTER (WHERE kd.status = 'active') AS active_kpi_count,
    COUNT(DISTINCT dc.case_id) FILTER (WHERE dc.status NOT IN ('closed')) AS open_deviation_case_count
  FROM scoped_kpis kd
  LEFT JOIN rvn_kpi_deviation_cases dc ON dc.kpi_id = kd.kpi_id AND dc.organization_id = $1
 WHERE kd.owner_user_id IS NOT NULL
 GROUP BY kd.owner_user_id;

-- missing ownership — deliberately bypasses chain_members (NULL owner can
-- never match a chain), reads raw rvn_kpi_definitions + visibility CTE only
-- (decision #2: T3 non-leak still applies — only OPEN_ORG or RBAC-override
-- visible unowned KPIs surface here, an accepted, documented limitation).
SELECT kd.kpi_id, kd.kpi_code
  FROM rvn_kpi_definitions kd
  INNER JOIN rvn_visible_resources vr ON vr.resource_type='kpi' AND vr.resource_id = kd.kpi_id::text
 WHERE kd.organization_id = $1 AND kd.owner_user_id IS NULL;

-- performance distribution (latest non-superseded measurement per KPI)
SELECT
    COUNT(*) FILTER (WHERE latest.performance_status = 'on_target') AS on_target,
    COUNT(*) FILTER (WHERE latest.performance_status = 'warning')   AS warning,
    COUNT(*) FILTER (WHERE latest.performance_status = 'critical')  AS critical,
    COUNT(*) FILTER (WHERE latest.performance_status IS NULL OR latest.performance_status = 'neutral') AS neutral_or_missing
  FROM scoped_kpis kd
  LEFT JOIN LATERAL (
    SELECT m.performance_status FROM rvn_kpi_measurements m
     WHERE m.kpi_id = kd.kpi_id
       AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer WHERE newer.correction_of_measurement_id = m.measurement_id)
     ORDER BY m.period_end DESC, m.recorded_at DESC LIMIT 1
  ) latest ON true
 WHERE kd.status = 'active';

-- overdue obligations
SELECT o.obligation_id, kd.kpi_id, o.assignee_user_id, o.obligation_type, o.due_at
  FROM rvn_platform_obligations o
  INNER JOIN rvn_kpi_deviation_cases dc ON o.reference_type = 'deviation_case' AND dc.case_id = o.reference_id
  INNER JOIN scoped_kpis kd ON kd.kpi_id = dc.kpi_id
 WHERE o.organization_id = $1 AND o.status = 'open' AND o.due_at < now()
UNION ALL
SELECT o.obligation_id, kd.kpi_id, o.assignee_user_id, o.obligation_type, o.due_at
  FROM rvn_platform_obligations o
  INNER JOIN scoped_kpis kd ON kd.kpi_id = o.reference_id AND o.reference_type = 'kpi'
 WHERE o.organization_id = $1 AND o.status = 'open' AND o.due_at < now();

-- repeated deviations — objective signal (case count in window) shown
-- SEPARATELY from self-reported recurrence_flag (may never be set by a human).
SELECT
    kd.kpi_id, kd.kpi_code,
    COUNT(dc.case_id) FILTER (WHERE dc.detected_at > now() - make_interval(days => $5)) AS case_count_last_window,
    BOOL_OR(dc.recurrence_flag) AS any_self_reported_recurrence
  FROM scoped_kpis kd
  INNER JOIN rvn_kpi_deviation_cases dc ON dc.kpi_id = kd.kpi_id
 GROUP BY kd.kpi_id, kd.kpi_code
HAVING COUNT(dc.case_id) FILTER (WHERE dc.detected_at > now() - make_interval(days => $5)) > 1
    OR BOOL_OR(dc.recurrence_flag);

-- ineffective corrective actions — via effectiveness verification (invariant
-- #9: action.status='completed' alone never implies close-worthy).
SELECT ev.deviation_case_id AS case_id, dc.kpi_id, ev.verification_id, ev.status
  FROM rvn_kpi_effectiveness_verifications ev
  INNER JOIN rvn_kpi_deviation_cases dc ON dc.case_id = ev.deviation_case_id
  INNER JOIN scoped_kpis kd ON kd.kpi_id = dc.kpi_id
 WHERE ev.status IN ('ineffective', 'partially_effective');
```

## C) InitiativeKPIImpact

Legacy `initiative_kpis` (SQLite-flavored, different engine entirely) is
**not reused** — confirmed not-applicable, only `initiatives.id`
(`migrations-v2/001_baseline_20260413.sql:15856`, `TEXT`) is a valid FK
target.

```sql
-- server/migrations/20260813_rvn_kpi_initiative_impacts.sql

CREATE TABLE IF NOT EXISTS rvn_kpi_initiative_impacts (
  impact_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            TEXT NOT NULL,
  kpi_id                   UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  initiative_id              TEXT NOT NULL REFERENCES initiatives(id),
  definition_version_id_at_commitment UUID NULL REFERENCES rvn_kpi_definition_versions(definition_version_id),

  status                  TEXT NOT NULL DEFAULT 'proposed'
                          CHECK (status IN ('proposed','committed','superseded','realized_reviewed','cancelled')),

  expected_contribution_value      NUMERIC NULL,
  expected_contribution_direction    TEXT NULL CHECK (expected_contribution_direction IN ('increase','decrease')),
  target_completion_date         DATE NULL,
  proposed_by               TEXT NOT NULL,
  proposed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Frozen at commitment (immutability enforced below).
  baseline_measurement_id        UUID NULL REFERENCES rvn_kpi_measurements(measurement_id),
  baseline_value_at_commitment      NUMERIC NULL,
  baseline_period_end          TIMESTAMPTZ NULL,
  committed_by               TEXT NULL,
  committed_at               TIMESTAMPTZ NULL,

  -- Reviewed attribution — decoupled from "expected" (invariant #10).
  reviewed_attribution_value       NUMERIC NULL,
  reviewed_attribution_measurement_id  UUID NULL REFERENCES rvn_kpi_measurements(measurement_id),
  review_rationale             TEXT NULL,
  reviewed_by                TEXT NULL,
  reviewed_at                TIMESTAMPTZ NULL,

  superseded_by_impact_id        UUID NULL REFERENCES rvn_kpi_initiative_impacts(impact_id),
  superseded_at              TIMESTAMPTZ NULL,

  row_version                INT NOT NULL DEFAULT 1,
  created_by                TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_initiative_impacts_kpi
  ON rvn_kpi_initiative_impacts(kpi_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_initiative_impacts_initiative
  ON rvn_kpi_initiative_impacts(organization_id, initiative_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_kpi_initiative_impacts_one_active
  ON rvn_kpi_initiative_impacts(kpi_id, initiative_id)
  WHERE status IN ('proposed','committed');

CREATE OR REPLACE FUNCTION rvn_kpi_initiative_impacts_protect_baseline()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('committed','superseded','realized_reviewed') THEN
    IF NEW.baseline_measurement_id IS DISTINCT FROM OLD.baseline_measurement_id
       OR NEW.baseline_value_at_commitment IS DISTINCT FROM OLD.baseline_value_at_commitment
       OR NEW.baseline_period_end IS DISTINCT FROM OLD.baseline_period_end
       OR NEW.definition_version_id_at_commitment IS DISTINCT FROM OLD.definition_version_id_at_commitment
       OR NEW.committed_by IS DISTINCT FROM OLD.committed_by
       OR NEW.committed_at IS DISTINCT FROM OLD.committed_at
    THEN
      RAISE EXCEPTION 'rvn_kpi_initiative_impacts: baseline is frozen after commitment (impact %)', OLD.impact_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_kpi_initiative_impacts_protect_baseline ON rvn_kpi_initiative_impacts;
CREATE TRIGGER trg_rvn_kpi_initiative_impacts_protect_baseline
  BEFORE UPDATE ON rvn_kpi_initiative_impacts
  FOR EACH ROW EXECUTE FUNCTION rvn_kpi_initiative_impacts_protect_baseline();
```

### C.3 Commands (signatures — implement via `executeAtomicCreate`/`executeAtomicCommand`, same pattern as every prior KPI package)

```ts
// kpiInitiativeImpactCommands.ts (NEW)

export async function proposeInitiativeKpiImpact(input: {
  organizationId: string; kpiId: string; initiativeId: string;
  expectedContributionValue: number | null; expectedContributionDirection: 'increase' | 'decrease' | null;
  targetCompletionDate: string | null;
  proposedBy: string; actorEffectiveRole: string; idempotencyKey: string;
}): Promise<AtomicCommandOutcome<{ impact: InitiativeKpiImpact }>>;
// executeAtomicCreate. status='proposed', baseline_* stays NULL.

export async function commitInitiativeKpiImpact(input: {
  organizationId: string; impactId: string; expectedVersion: number;
  committedBy: string; actorEffectiveRole: string; idempotencyKey: string;
}): Promise<AtomicCommandOutcome<{ impact: InitiativeKpiImpact }>>;
// executeAtomicCommand (CAS). Reads the CURRENT latest non-superseded
// rvn_kpi_measurements row for kpi_id INSIDE the same transaction and pins
// it as baseline. No measurement yet -> baseline_* stays NULL (honest,
// never fabricated per invariant #6).

export async function recordReviewedAttribution(input: {
  organizationId: string; impactId: string; expectedVersion: number;
  reviewedAttributionValue: number; reviewedAttributionMeasurementId: string | null;
  reviewRationale: string; reviewedBy: string; actorEffectiveRole: string; idempotencyKey: string;
}): Promise<AtomicCommandOutcome<{ impact: InitiativeKpiImpact }>>;
// executeAtomicCommand (CAS). reviewedBy MUST differ from committedBy for a
// material review — server-side enforced (mirrors SelfApprovalDeniedError/
// DeviationSelfApprovalDeniedError), not UI-only.

export async function supersedeInitiativeKpiImpact(input: {
  organizationId: string; impactId: string; expectedVersion: number;
  replacementInput: Omit<Parameters<typeof proposeInitiativeKpiImpact>[0], 'organizationId' | 'kpiId' | 'initiativeId'>;
  actorUserId: string; actorEffectiveRole: string; idempotencyKey: string;
}): Promise<AtomicCommandOutcome<{ superseded: InitiativeKpiImpact; replacement: InitiativeKpiImpact }>>;
// executeAtomicCommand (CAS). status -> 'superseded', superseded_by_impact_id
// points at a fresh 'proposed' row created in the SAME transaction — never
// edits history.
```

`commitInitiativeKpiImpact` must ALSO, same transaction, write a
`link_graph_edges` row (`source_type='initiative', source_id=initiativeId,
target_type='kpi', target_id=kpiId, relation='kpi_impact'`) through the
SAME code path the existing `POST /api/my-work/link-graph/edges` handler
uses internally — architectural rule #6, do not hand-roll a second INSERT.

Reads (`listInitiativeImpactsForKpi`/`listKpiImpactsForInitiative`) —
standard pattern: `buildVisibilityScopedCte({resourceType:'kpi'})`, join on
`kpi_id::text` (cast required, same bug class as §24).

Visibility: inherits from KPI (`resourceType:'kpi'`), same as deviation
case/corrective action — Initiative (legacy module) does not participate in
RVN ABAC; `initiative_id` is exposed without joining to Initiative content
(the Initiatives module guards its own content on its own read path).

## D) Identity across surfaces

5 surfaces (decision #1): Portfolio list (`listKpis`), KPI Tool (`getKpi`),
My KPIs (`listMyKpis`), Organization view (`listOrganizationKpiAttention`),
Scorecard Tool (`listScorecardItems`/`getPublishedSnapshot`). `kpi_id` has
exactly one source (`rvn_kpi_definitions.kpi_id`) — no surface generates or
re-encodes its own identifier. The one accepted archival exception: a
published Scorecard snapshot's frozen `kpiId` values remain valid
historically even if that were ever deleted (no DELETE path exists on
`rvn_kpi_definitions` today, verified) — not a bug, an accepted immutable-
archive property.

Contract test (verifies the existing mechanism, does not introduce a new
one): `tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts` —
one KPI, one deviation case, one scorecard containing it, one
InitiativeKPIImpact, all real rows on ephemeral Postgres, read back through
all 5 repositories for the same (OPEN_ORG-visibility) user, asserting
string-equal `kpiId` everywhere and that every surface returns a `string`
(not a raw row, not a number) — catches "someone returned a raw column
instead of the DTO" before it reaches UI integration.

## E) Files to create

| File | Notes |
|---|---|
| `server/migrations/20260813_rvn_kpi_measurement_cadence.sql` | §A.3 |
| `server/migrations/20260813_rvn_kpi_initiative_impacts.sql` | §C |
| `server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts` | §A, §B |
| `server/src/services/resultsVnext/kpi/kpiInitiativeImpactTypes.ts` | Row/DTO |
| `server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.ts` | §C.3 |
| `server/src/services/resultsVnext/kpi/kpiInitiativeImpactRepository.ts` | Reads |
| Edit `platform/managementChainMaintenance.ts` | Add `listManagementChainDescendants` (§B.1) — not a new file |
| Tests | Unit (`myKpis.test.ts`), realDB (`organizationKpiAttention.realdb.test.ts` — chain-scoping non-leak, `initiativeKpiImpactBaselineFreeze.realdb.test.ts`, `kpiIdentityAcrossSurfaces.realdb.test.ts`) — **every new repository function needs a direct realDB test, not only a mocked route test, per the §24 lesson** |

Not in this package: `/api/vnext/results/kpi/my`, `/attention`,
`/initiative-impacts/*` HTTP routes (next package).
