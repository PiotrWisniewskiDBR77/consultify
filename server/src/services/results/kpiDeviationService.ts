import { v4 as uuidv4 } from 'uuid';

import type { IDatabase } from '../../database/IDatabase.js';
import notificationService from '../notificationService.js';
import { getVersionById } from './kpiDefinitionService.js';
import { ensureRecoveryCardForCase } from './kpiRecoveryCardService.js';

export type KpiDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
export type KpiThresholdMode = 'ABSOLUTE' | 'PERCENT_FROM_TARGET';
/**
 * RES-004: UNCONFIGURED is a distinct, deliberately non-green status for
 * "cannot be deterministically evaluated" (no target set, target=0 with no
 * absolute fallback, or an inverted/negative threshold band). It used to be
 * silently folded into GREEN — a KPI with no target ever set, or with a
 * broken threshold config, read as "on track" forever. Callers that gate an
 * action on "is this KPI safe" (e.g. the recovery-card close gate) must
 * treat UNCONFIGURED the same as AMBER/RED: fail closed, not open.
 */
export type KpiEvalStatus = 'GREEN' | 'AMBER' | 'RED' | 'NO_DATA' | 'UNCONFIGURED';

export interface KpiDefinitionForEval {
  id: string;
  organizationId: string;
  ownerUserId?: string | null;
  name: string;
  targetValue?: number | null;
  direction?: KpiDirection | null;
  thresholdMode?: KpiThresholdMode | null;
  amberThresholdPct?: number | null; // e.g. 0.10
  redThresholdPct?: number | null; // e.g. 0.20
  amberThresholdAbs?: number | null;
  redThresholdAbs?: number | null;
}

export interface KpiEvalResult {
  status: KpiEvalStatus;
  severity: 'AMBER' | 'RED' | null;
  summary: string;
}

export function evaluateKpiPoint(def: KpiDefinitionForEval, value: number | null): KpiEvalResult {
  if (value == null || !Number.isFinite(value)) {
    return { status: 'NO_DATA', severity: null, summary: 'No data' };
  }

  const target = def.targetValue ?? null;
  if (target == null || !Number.isFinite(target)) {
    // RES-004: no target = cannot deterministically evaluate bands. This used
    // to return GREEN (a false "on track") — a KPI nobody ever set a target
    // on read as permanently healthy. Fail closed instead.
    return { status: 'UNCONFIGURED', severity: null, summary: 'No target configured' };
  }

  const direction: KpiDirection = (def.direction || 'HIGHER_IS_BETTER') as KpiDirection;
  const mode: KpiThresholdMode = (def.thresholdMode || 'PERCENT_FROM_TARGET') as KpiThresholdMode;

  const amberPct = def.amberThresholdPct ?? 0.1;
  const redPct = def.redThresholdPct ?? 0.2;

  const isLowerBetter = direction === 'LOWER_IS_BETTER';

  // RES-004: a red band tighter than (or equal to) the amber band, or a
  // negative/non-finite band, is not a configuration this engine can
  // evaluate deterministically — it would either never fire RED or invert
  // the green/red order. Checked lazily (only when the mode that actually
  // uses these fields runs) so a KPI in ABSOLUTE mode with untouched
  // (default-valid) percent columns is never wrongly flagged.
  const pctBandIsMisconfigured =
    !Number.isFinite(amberPct) ||
    !Number.isFinite(redPct) ||
    amberPct < 0 ||
    redPct < 0 ||
    redPct < amberPct;

  const classifyPercent = (): KpiEvalResult => {
    if (pctBandIsMisconfigured) {
      return {
        status: 'UNCONFIGURED',
        severity: null,
        summary: `Misconfigured percent thresholds (amber=${amberPct}, red=${redPct})`,
      };
    }
    if (target === 0) {
      // RES-004: division by target=0 is undefined for a percent band, and
      // there is no absolute fallback at this call site (classifyAbsolute
      // already tried its own thresholds before falling back here) — this
      // used to silently return GREEN. Fail closed instead.
      return {
        status: 'UNCONFIGURED',
        severity: null,
        summary: 'Target=0; percent thresholds cannot be evaluated without an absolute band',
      };
    }
    const delta = (value - target) / Math.abs(target);
    const badness = isLowerBetter ? delta : -delta; // positive badness = worse than target
    if (badness >= redPct) {
      return {
        status: 'RED',
        severity: 'RED',
        summary: `RED: value ${value} deviates from target ${target}`,
      };
    }
    if (badness >= amberPct) {
      return {
        status: 'AMBER',
        severity: 'AMBER',
        summary: `AMBER: value ${value} deviates from target ${target}`,
      };
    }
    return { status: 'GREEN', severity: null, summary: 'On track' };
  };

  const classifyAbsolute = (): KpiEvalResult => {
    const amberAbs = def.amberThresholdAbs;
    const redAbs = def.redThresholdAbs;
    if (amberAbs == null && redAbs == null) {
      return classifyPercent();
    }

    // For ABSOLUTE, thresholds are interpreted as allowed deviation magnitude from target.
    const gap = Math.abs(value - target);
    // `red` staying +Infinity when only amber is configured is intentional
    // (an explicit "no red bound"), not a misconfiguration — only reject
    // truly invalid values (NaN, negative, or red tighter than amber) below.
    const red = redAbs != null ? Number(redAbs) : Number.POSITIVE_INFINITY;
    const amber = amberAbs != null ? Number(amberAbs) : red;
    // RES-004: same fail-closed guard as the percent band — a negative or
    // NaN bound, or a red bound tighter than amber, cannot be evaluated
    // deterministically.
    if (Number.isNaN(amber) || Number.isNaN(red) || amber < 0 || red < 0 || red < amber) {
      return {
        status: 'UNCONFIGURED',
        severity: null,
        summary: `Misconfigured absolute thresholds (amber=${amber}, red=${red})`,
      };
    }
    if (gap >= red) {
      return { status: 'RED', severity: 'RED', summary: `RED: gap ${gap} vs target ${target}` };
    }
    if (gap >= amber) {
      return {
        status: 'AMBER',
        severity: 'AMBER',
        summary: `AMBER: gap ${gap} vs target ${target}`,
      };
    }
    return { status: 'GREEN', severity: null, summary: 'On track' };
  };

  return mode === 'ABSOLUTE' ? classifyAbsolute() : classifyPercent();
}

async function getKpiDefinition(
  db: IDatabase,
  orgId: string,
  kpiId: string
): Promise<KpiDefinitionForEval | null> {
  const row = await db.get<{
    id: string;
    organization_id: string;
    owner_user_id: string | null;
    name: string;
    target_value: number | null;
    direction: KpiDirection | null;
    threshold_mode: KpiThresholdMode | null;
    amber_threshold_pct: number | null;
    red_threshold_pct: number | null;
    amber_threshold_abs: number | null;
    red_threshold_abs: number | null;
  }>(
    `
    SELECT
      k.id,
      COALESCE(k.organization_id, i.organization_id) AS organization_id,
      k.owner_user_id,
      k.name,
      k.target_value,
      k.direction,
      k.threshold_mode,
      k.amber_threshold_pct,
      k.red_threshold_pct,
      k.amber_threshold_abs,
      k.red_threshold_abs
    FROM initiative_kpis k
    LEFT JOIN initiatives i ON i.id = k.initiative_id
    WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?
    `,
    [kpiId, orgId]
  );
  if (!row?.id) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    targetValue: row.target_value != null ? Number(row.target_value) : null,
    direction: row.direction,
    thresholdMode: row.threshold_mode,
    amberThresholdPct: row.amber_threshold_pct != null ? Number(row.amber_threshold_pct) : null,
    redThresholdPct: row.red_threshold_pct != null ? Number(row.red_threshold_pct) : null,
    amberThresholdAbs: row.amber_threshold_abs != null ? Number(row.amber_threshold_abs) : null,
    redThresholdAbs: row.red_threshold_abs != null ? Number(row.red_threshold_abs) : null,
  };
}

/**
 * RES-004: overlay a KPI's PINNED threshold/target fields — as they read in
 * the specific kpi_definition_versions row a measurement was recorded under
 * — onto its otherwise-live definition. Without this, evaluating an old
 * measurement (a Recovery Card close re-check, a historical report) always
 * used whatever thresholds are CURRENT today, silently reinterpreting a past
 * RED as GREEN (or vice versa) if the target was edited since. Falls back to
 * `live` unchanged when no pin is given or it fails to resolve (a KPI
 * created before RES-02's backfill, or a deleted version row) — evaluation
 * must degrade to current config, never throw, on a missing pin.
 */
export async function withPinnedThresholds(
  live: KpiDefinitionForEval,
  organizationId: string,
  definitionVersionId?: string | null
): Promise<KpiDefinitionForEval> {
  if (!definitionVersionId) return live;
  const pinned = await getVersionById(definitionVersionId, organizationId);
  if (!pinned) return live;
  const d = pinned.definition;
  return {
    ...live,
    targetValue: d.targetValue ?? null,
    direction: (d.direction as KpiDirection | null) ?? null,
    thresholdMode: (d.thresholdMode as KpiThresholdMode | null) ?? null,
    amberThresholdPct: d.amberThresholdPct ?? null,
    redThresholdPct: d.redThresholdPct ?? null,
    amberThresholdAbs: d.amberThresholdAbs ?? null,
    redThresholdAbs: d.redThresholdAbs ?? null,
  };
}

export interface HandleTimeSeriesRecordedInput {
  db: IDatabase;
  orgId: string;
  kpiId: string;
  value: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd?: string | null;
  recordedByUserId?: string | null;
  // RES-004: the kpi_definition_versions.id the measurement was pinned to by
  // the RES-003 writer (recordKpiMeasurement). Optional so pre-RES-04 callers
  // keep working (evaluation falls back to live thresholds).
  definitionVersionId?: string | null;
}

export async function handleTimeSeriesRecorded(input: HandleTimeSeriesRecordedInput): Promise<{
  createdOrUpdatedCaseId?: string;
  eval: KpiEvalResult;
  // RES-003A: optional so the 3 existing callers (benefits.routes.ts:540,
  // results.routes.ts:1695, resultsEnterpriseService.ts:220) that don't read
  // these fields keep working unchanged.
  recoveryCardId?: string;
  recoveryCardCreated?: boolean;
}> {
  const { db, orgId, kpiId, value, periodStart, periodEnd, recordedByUserId, definitionVersionId } =
    input;
  const live = await getKpiDefinition(db, orgId, kpiId);
  if (!live) {
    return { eval: { status: 'NO_DATA', severity: null, summary: 'KPI not found' } };
  }
  const def = await withPinnedThresholds(live, orgId, definitionVersionId);

  const evalRes = evaluateKpiPoint(def, value);
  if (evalRes.status !== 'AMBER' && evalRes.status !== 'RED') {
    return { eval: evalRes };
  }

  const ownerUserId = def.ownerUserId || recordedByUserId || null;
  const severity = evalRes.severity as 'AMBER' | 'RED';
  // Atomic under concurrent measurements. The previous SELECT→INSERT sequence let
  // two requests both observe "no case" and one fail on the unique constraint.
  // The canonical identity is (organization, KPI, period_start); a repeated RED/
  // AMBER measurement updates that same case and reopens a previously closed one.
  const upserted = await db.get<{ id: string }>(
    `
    INSERT INTO kpi_deviation_cases (
      kpi_id, organization_id, period_start, period_end, severity, status,
      owner_user_id, deviation_summary, detected_by
    )
    VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, 'system')
    ON CONFLICT (organization_id, kpi_id, period_start) DO UPDATE SET
      period_end = COALESCE(excluded.period_end, kpi_deviation_cases.period_end),
      severity = excluded.severity,
      status = CASE
        WHEN UPPER(COALESCE(kpi_deviation_cases.status, '')) = 'CLOSED' THEN 'OPEN'
        ELSE kpi_deviation_cases.status
      END,
      owner_user_id = COALESCE(kpi_deviation_cases.owner_user_id, excluded.owner_user_id),
      deviation_summary = excluded.deviation_summary,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
    `,
    [kpiId, orgId, periodStart, periodEnd || null, severity, ownerUserId, evalRes.summary]
  );
  const caseId = upserted?.id ? String(upserted.id) : '';

  // Durable detection receipt in the canonical KPI audit stream. Audit failure
  // is deliberately visible to the caller: a governed write must not silently
  // succeed without its receipt.
  await db.run(
    `INSERT INTO kpi_metric_audit_log
       (id, organization_id, kpi_id, section, event_type, source, actor_user_id,
        summary, before_json, after_json)
       VALUES (?, ?, ?, 'deviation_case', 'deviation_case_upserted', 'results_runtime', ?, ?, ?, ?)`,
    [
      uuidv4(),
      orgId,
      kpiId,
      recordedByUserId || null,
      `Deviation case ${caseId} upserted for ${periodStart}`,
      JSON.stringify({}),
      JSON.stringify({
        caseId,
        severity,
        status: 'OPEN',
        periodStart,
        periodEnd: periodEnd || null,
      }),
    ]
  );

  // RES-003A: auto-create/reopen the Recovery Card owner object for this
  // case. Non-fatal by design — the same style as the notificationService
  // call two lines below — because a Recovery Card side-effect must never
  // break deviation-case durability (the case row is already committed above).
  let recoveryCardId: string | undefined;
  let recoveryCardCreated: boolean | undefined;
  if (caseId) {
    try {
      const recovery = await ensureRecoveryCardForCase({
        db,
        orgId,
        kpiId,
        caseId,
        severity,
        actorUserId: recordedByUserId ?? null,
      });
      if (recovery?.cardId) {
        recoveryCardId = recovery.cardId;
        recoveryCardCreated = recovery.created;
      }
    } catch {
      // Recovery Card side-effect must never break deviation-case durability.
    }
  }

  if (ownerUserId) {
    await notificationService
      .send({
        userId: ownerUserId,
        organizationId: orgId,
        type: 'KPI_DEVIATION_DETECTED',
        title: `KPI deviation: ${def.name}`,
        body: evalRes.summary,
        severity: severity === 'RED' ? 'CRITICAL' : 'WARNING',
        entityType: 'kpi_deviation_case',
        entityId: caseId,
        relatedObjectType: 'kpi',
        relatedObjectId: def.id,
        isActionable: true,
        data: { kpiId: def.id, severity, periodStart, periodEnd: periodEnd || null },
      })
      .catch(() => null);
  }

  return { createdOrUpdatedCaseId: caseId, eval: evalRes, recoveryCardId, recoveryCardCreated };
}
