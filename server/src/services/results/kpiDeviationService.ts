import type { IDatabase } from '../../database/IDatabase.js';
import notificationService from '../notificationService.js';
import { ensureRecoveryCardForCase } from './kpiRecoveryCardService.js';

export type KpiDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
export type KpiThresholdMode = 'ABSOLUTE' | 'PERCENT_FROM_TARGET';
export type KpiEvalStatus = 'GREEN' | 'AMBER' | 'RED' | 'NO_DATA';

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
    // Without target we cannot deterministically evaluate bands; treat as GREEN but with note.
    return { status: 'GREEN', severity: null, summary: 'No target configured' };
  }

  const direction: KpiDirection = (def.direction || 'HIGHER_IS_BETTER') as KpiDirection;
  const mode: KpiThresholdMode = (def.thresholdMode || 'PERCENT_FROM_TARGET') as KpiThresholdMode;

  const amberPct = def.amberThresholdPct ?? 0.1;
  const redPct = def.redThresholdPct ?? 0.2;

  const isLowerBetter = direction === 'LOWER_IS_BETTER';

  const classifyPercent = (): KpiEvalResult => {
    if (target === 0) {
      // Avoid division by zero; fall back to GREEN unless ABS thresholds exist.
      return { status: 'GREEN', severity: null, summary: 'Target=0; percent thresholds skipped' };
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
    const red = redAbs != null ? Number(redAbs) : Number.POSITIVE_INFINITY;
    const amber = amberAbs != null ? Number(amberAbs) : red;
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

export interface HandleTimeSeriesRecordedInput {
  db: IDatabase;
  orgId: string;
  kpiId: string;
  value: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd?: string | null;
  recordedByUserId?: string | null;
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
  const { db, orgId, kpiId, value, periodStart, periodEnd, recordedByUserId } = input;
  const def = await getKpiDefinition(db, orgId, kpiId);
  if (!def) {
    return { eval: { status: 'NO_DATA', severity: null, summary: 'KPI not found' } };
  }

  const evalRes = evaluateKpiPoint(def, value);
  if (evalRes.status !== 'AMBER' && evalRes.status !== 'RED') {
    return { eval: evalRes };
  }

  const existing = await db.get<{ id: string; status: string }>(
    `
    SELECT id, status
    FROM kpi_deviation_cases
    WHERE organization_id = ? AND kpi_id = ? AND period_start = ?
    LIMIT 1
    `,
    [orgId, kpiId, periodStart]
  );

  const ownerUserId = def.ownerUserId || recordedByUserId || null;
  const severity = evalRes.severity as 'AMBER' | 'RED';

  let caseId: string;
  if (existing?.id) {
    caseId = String(existing.id);
    const nextStatus =
      String(existing.status || '').toUpperCase() === 'CLOSED' ? 'OPEN' : existing.status;
    await db.run(
      `
      UPDATE kpi_deviation_cases
      SET severity = ?, status = ?, owner_user_id = COALESCE(owner_user_id, ?),
          deviation_summary = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
      `,
      [severity, nextStatus, ownerUserId, evalRes.summary, caseId, orgId]
    );
  } else {
    await db.run(
      `
      INSERT INTO kpi_deviation_cases (
        kpi_id, organization_id, period_start, period_end, severity, status,
        owner_user_id, deviation_summary, detected_by
      )
      VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, 'system')
      `,
      [kpiId, orgId, periodStart, periodEnd || null, severity, ownerUserId, evalRes.summary]
    );

    const created = await db.get<{ id: string }>(
      `
      SELECT id
      FROM kpi_deviation_cases
      WHERE organization_id = ? AND kpi_id = ? AND period_start = ?
      ORDER BY detected_at DESC, id DESC
      LIMIT 1
      `,
      [orgId, kpiId, periodStart]
    );
    caseId = created?.id ? String(created.id) : '';
  }

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
