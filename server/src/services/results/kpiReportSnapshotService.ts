import { v4 as uuidv4 } from 'uuid';

import { type PgTransactionClient, withPgTransaction } from '../../utils/queryHelpers.js';

type KpiListItem = {
  id: string;
  initiativeId: string | null;
  initiativeName: string | null;
  linkedInitiatives?: Array<{ id: string; name: string }>;
  linkedInitiativesCount?: number;
  name: string;
  description: string | null;
  unit: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  measurementFrequency: string;
  ownerUserId: string | null;
  ownerName: string | null;
  currentValue: number | null;
  latestValue: number | null;
  latestMeasurementDate: string | null;
  isOnTarget: boolean;
  openDeviationCase: { id: string; severity: 'AMBER' | 'RED'; status: string } | null;
};

export class ResultsKpiReportSnapshotError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ResultsKpiReportSnapshotError';
  }
}

type DeviationAction = {
  id: string;
  caseId: string;
  title: string;
  ownerUserId: string | null;
  dueDate: string | null;
  status: string;
};

type DeviationCase = {
  id: string;
  kpiId: string;
  kpiName?: string;
  periodStart: string | null;
  periodEnd: string | null;
  severity: 'AMBER' | 'RED';
  status: string;
  ownerUserId: string | null;
  deviationSummary: string | null;
  rcaText: string | null;
  detectedAt: string | null;
  actions: DeviationAction[];
};

export type ResultsKpiReportSnapshot = {
  id: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string | null;
  title: string;
  generatedAt: string;
  kpis: KpiListItem[];
  deviationCases: DeviationCase[];
  actionPlan: Array<
    DeviationAction & {
      kpiId: string;
      kpiName?: string;
      severity: 'AMBER' | 'RED';
      caseStatus: string;
    }
  >;
  stats: {
    kpisTotal: number;
    kpisOnTarget: number;
    kpisBelowTarget: number;
    kpisNoData: number;
    openDeviationCases: number;
    openRedCases: number;
    openAmberCases: number;
    openActions: number;
  };
};

function isoDate(input: unknown): string {
  const s = String(input || '').trim();
  if (!s) return '';
  // Accept YYYY-MM-DD or ISO timestamp; normalize to date.
  return s.slice(0, 10);
}

function escapePipe(s: string): string {
  return String(s || '').replaceAll('|', '\\|');
}

function formatValue(val: number | null, unit?: string | null): string {
  if (val == null || !Number.isFinite(Number(val))) return '—';
  const v = Number(val);
  const u = unit ? ` ${unit}` : '';
  return `${v}${u}`;
}

function formatInitiativeLabel(k: KpiListItem): string {
  const base = k.initiativeName ? String(k.initiativeName) : '';
  if (base) return base;
  const linked = (k.linkedInitiatives || []).filter(Boolean);
  if (!linked.length) return '—';
  if (linked.length === 1) return linked[0]?.name || '—';
  return `${linked[0]?.name || '—'} +${linked.length - 1}`;
}

function toDateOnly(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  const isoPrefix = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoPrefix) return isoPrefix;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

async function listKpisForOrg(
  tx: PgTransactionClient,
  orgId: string,
  periodStart: string,
  periodEnd: string | null
): Promise<KpiListItem[]> {
  const rows = (
    await tx.query<any>(
      `
    SELECT
      k.*,
      i.name AS initiative_name,
      u.first_name AS owner_first_name,
      u.last_name AS owner_last_name,
      ts.value AS latest_value,
      ts.period_start AS latest_period_start,
      c.id AS open_case_id,
      c.severity AS open_case_severity,
      c.status AS open_case_status
    FROM initiative_kpis k
    LEFT JOIN initiatives i ON i.id = k.initiative_id
    LEFT JOIN users u ON u.id = k.owner_user_id
    LEFT JOIN LATERAL (
      SELECT value, to_char(period_start, 'YYYY-MM-DD') AS period_start
      FROM kpi_time_series
      WHERE kpi_id = k.id AND organization_id = ?
        AND period_start >= ?
        AND (?::date IS NULL OR period_start <= ?::date)
      ORDER BY period_start DESC, created_at DESC
      LIMIT 1
    ) ts ON TRUE
    LEFT JOIN LATERAL (
      SELECT id, severity, status
      FROM kpi_deviation_cases
      WHERE organization_id = ? AND kpi_id = k.id AND status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','MITIGATING')
      ORDER BY CASE WHEN severity = 'RED' THEN 0 ELSE 1 END, detected_at DESC
      LIMIT 1
    ) c ON TRUE
    WHERE COALESCE(k.organization_id, i.organization_id) = ?
    ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC
    `,
      [orgId, periodStart, periodEnd, periodEnd, orgId, orgId]
    )
  ).rows;

  const kpiIds = (rows || []).map((r: any) => String(r.id)).filter(Boolean);
  const mappings =
    kpiIds.length > 0
      ? (
          await tx.query<any>(
            `
          SELECT m.kpi_id, m.initiative_id, i.name AS initiative_name
          FROM initiative_kpi_mappings m
          LEFT JOIN initiatives i ON i.id = m.initiative_id
          WHERE m.organization_id = ?
            AND m.kpi_id IN (${kpiIds.map(() => '?').join(',')})
          `,
            [orgId, ...kpiIds]
          )
        ).rows
      : [];

  const linkedByKpi: Record<string, Array<{ id: string; name: string }>> = {};
  (mappings || []).forEach((m: any) => {
    const kpiId = String(m.kpi_id || '').trim();
    const initiativeId = String(m.initiative_id || '').trim();
    const initiativeName = String(m.initiative_name || '').trim();
    if (!kpiId || !initiativeId) return;
    if (!linkedByKpi[kpiId]) linkedByKpi[kpiId] = [];
    if (!linkedByKpi[kpiId].some((x) => x.id === initiativeId)) {
      linkedByKpi[kpiId].push({ id: initiativeId, name: initiativeName || initiativeId });
    }
  });

  return (rows || []).map((r: any) => {
    // A period report must never borrow the live current_value from outside its
    // requested window. No measurement in the window is honestly NO_DATA.
    const latestValue = r.latest_value ?? null;
    const targetValue = r.target_value ?? null;
    const direction = String(r.direction || 'HIGHER_IS_BETTER');
    const isOnTarget =
      latestValue == null || targetValue == null
        ? false
        : direction === 'LOWER_IS_BETTER'
          ? Number(latestValue) <= Number(targetValue)
          : Number(latestValue) >= Number(targetValue);

    const linked = linkedByKpi[String(r.id)] || [];
    const initiativeName =
      r.initiative_name || (linked.length === 1 ? linked[0]?.name : null) || null;

    return {
      id: r.id,
      initiativeId: r.initiative_id || null,
      initiativeName,
      linkedInitiatives: linked,
      linkedInitiativesCount: linked.length,
      name: r.name,
      description: r.description || null,
      unit: r.unit || null,
      baselineValue: r.baseline_value ?? null,
      targetValue,
      measurementFrequency: r.measurement_frequency || 'MONTHLY',
      ownerUserId: r.owner_user_id || null,
      ownerName:
        r.owner_first_name || r.owner_last_name
          ? `${r.owner_first_name || ''} ${r.owner_last_name || ''}`.trim()
          : null,
      currentValue: r.current_value ?? null,
      latestValue,
      latestMeasurementDate: toDateOnly(r.latest_period_start),
      isOnTarget,
      openDeviationCase: r.open_case_id
        ? {
            id: r.open_case_id,
            severity: r.open_case_severity,
            status: r.open_case_status,
          }
        : null,
    } as KpiListItem;
  });
}

async function listOpenDeviationCases(
  tx: PgTransactionClient,
  orgId: string,
  periodStart: string,
  periodEnd: string | null
): Promise<DeviationCase[]> {
  const cases = (
    await tx.query<any>(
      `
    SELECT
      c.*,
      k.name AS kpi_name
    FROM kpi_deviation_cases c
    LEFT JOIN initiative_kpis k ON k.id = c.kpi_id
    WHERE c.organization_id = ?
      AND c.status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','MITIGATING')
      AND COALESCE(c.period_end, c.period_start) >= ?
      AND (?::date IS NULL OR c.period_start <= ?::date)
    ORDER BY CASE WHEN c.severity = 'RED' THEN 0 ELSE 1 END, c.detected_at DESC
    `,
      [orgId, periodStart, periodEnd, periodEnd]
    )
  ).rows;

  const caseIds = (cases || []).map((c: any) => c.id);
  const actions =
    caseIds.length > 0
      ? (
          await tx.query<any>(
            `
          SELECT *
          FROM kpi_deviation_actions
          WHERE case_id IN (${caseIds.map(() => '?').join(',')})
          ORDER BY created_at ASC
          `,
            caseIds
          )
        ).rows
      : [];

  const actionsByCase: Record<string, DeviationAction[]> = {};
  (actions || []).forEach((a: any) => {
    const cid = String(a.case_id);
    if (!actionsByCase[cid]) actionsByCase[cid] = [];
    actionsByCase[cid].push({
      id: a.id,
      caseId: cid,
      title: a.title,
      ownerUserId: a.owner_user_id || null,
      dueDate: a.due_date ? String(a.due_date) : null,
      status: a.status,
    });
  });

  return (cases || []).map((c: any) => ({
    id: c.id,
    kpiId: c.kpi_id,
    kpiName: c.kpi_name || undefined,
    periodStart: c.period_start ? String(c.period_start) : null,
    periodEnd: c.period_end ? String(c.period_end) : null,
    severity: c.severity,
    status: c.status,
    ownerUserId: c.owner_user_id || null,
    deviationSummary: c.deviation_summary || null,
    rcaText: c.rca_text || null,
    detectedAt: c.detected_at || null,
    actions: actionsByCase[String(c.id)] || [],
  }));
}

export function renderSnapshotMarkdown(snapshot: ResultsKpiReportSnapshot): Record<string, string> {
  const exec = [
    `# ${snapshot.title}`,
    ``,
    `**Period:** ${snapshot.periodStart}${snapshot.periodEnd ? ` → ${snapshot.periodEnd}` : ''}`,
    ``,
    `## Summary`,
    `- KPIs total: **${snapshot.stats.kpisTotal}** (on target: **${snapshot.stats.kpisOnTarget}**, below: **${snapshot.stats.kpisBelowTarget}**, no data: **${snapshot.stats.kpisNoData}**)`,
    `- Open deviation cases: **${snapshot.stats.openDeviationCases}** (RED: **${snapshot.stats.openRedCases}**, AMBER: **${snapshot.stats.openAmberCases}**)`,
    `- Open actions: **${snapshot.stats.openActions}**`,
  ].join('\n');

  const kpiTableHeader =
    '| KPI | Initiative | Owner | Latest | Target | Status | Deviation |\n|---|---|---|---:|---:|---|---|';
  const kpiTableRows = snapshot.kpis
    .map((k) => {
      const status =
        k.latestValue == null ? 'NO_DATA' : k.isOnTarget ? 'ON_TARGET' : 'BELOW_TARGET';
      const dev = k.openDeviationCase
        ? `${k.openDeviationCase.severity} (${k.openDeviationCase.status})`
        : '—';
      return `| ${escapePipe(k.name)} | ${escapePipe(formatInitiativeLabel(k))} | ${escapePipe(
        k.ownerName || '—'
      )} | ${formatValue(k.latestValue, k.unit)} | ${formatValue(k.targetValue, k.unit)} | ${status} | ${escapePipe(dev)} |`;
    })
    .join('\n');
  const kpiOverview = [
    '## KPI Overview',
    '',
    kpiTableHeader,
    kpiTableRows || '| — | — | — | — | — | — | — |',
  ].join('\n');

  const cases = snapshot.deviationCases.length
    ? snapshot.deviationCases
        .map((c) => {
          const actions =
            c.actions?.length > 0
              ? c.actions
                  .map(
                    (a) =>
                      `- [${String(a.status || '').toUpperCase() === 'DONE' ? 'x' : ' '}] ${a.title}${
                        a.dueDate ? ` (due: ${a.dueDate})` : ''
                      }`
                  )
                  .join('\n')
              : '- (no actions yet)';
          return [
            `### ${c.severity} · ${c.kpiName || c.kpiId} (${c.status})`,
            `- Period: ${c.periodStart || '—'}${c.periodEnd ? ` → ${c.periodEnd}` : ''}`,
            c.deviationSummary ? `- Summary: ${c.deviationSummary}` : `- Summary: —`,
            c.rcaText ? `- RCA: ${c.rcaText}` : `- RCA: —`,
            ``,
            `**Actions:**`,
            actions,
          ].join('\n');
        })
        .join('\n\n')
    : '_No open deviation cases._';
  const deviationCases = ['## Deviation cases', '', cases].join('\n');

  const actionPlanItems = snapshot.actionPlan.length
    ? snapshot.actionPlan
        .map((a) => {
          const done = String(a.status || '').toUpperCase() === 'DONE';
          return `- [${done ? 'x' : ' '}] ${a.title} — ${a.kpiName || a.kpiId} (${a.severity})${
            a.dueDate ? ` · due: ${a.dueDate}` : ''
          }`;
        })
        .join('\n')
    : '_No actions in plan._';
  const actionPlan = ['## Action plan', '', actionPlanItems].join('\n');

  return {
    executive_summary: exec,
    kpi_overview: kpiOverview,
    deviation_cases: deviationCases,
    action_plan: actionPlan,
    appendix: `Generated at: ${snapshot.generatedAt}`,
  };
}

export async function createKpiReportSnapshot(params: {
  organizationId: string;
  periodStart: string;
  periodEnd?: string | null;
  title?: string | null;
  createdBy: string;
  filters?: Record<string, unknown> | null;
  kpiIds?: string[] | null;
}): Promise<{
  snapshotId: string;
  snapshot: ResultsKpiReportSnapshot;
  markdown: Record<string, string>;
}> {
  const periodStart = isoDate(params.periodStart);
  const periodEnd = params.periodEnd ? isoDate(params.periodEnd) : null;
  const now = new Date().toISOString();

  const requestedKpiIds = (params.kpiIds || []).map((x) => String(x || '').trim()).filter(Boolean);
  const selectedSet = requestedKpiIds.length ? new Set(requestedKpiIds) : null;

  return withPgTransaction(async (tx) => {
    const allKpis = await listKpisForOrg(tx, params.organizationId, periodStart, periodEnd);
    const allDeviationCases = await listOpenDeviationCases(
      tx,
      params.organizationId,
      periodStart,
      periodEnd
    );

    if (selectedSet) {
      const ownedIds = new Set(allKpis.map((kpi) => String(kpi.id)));
      const unavailable = requestedKpiIds.filter((id) => !ownedIds.has(id));
      if (unavailable.length) {
        throw new ResultsKpiReportSnapshotError(
          'RESULTS_KPI_REPORT_KPI_NOT_FOUND',
          404,
          'One or more KPIs were not found'
        );
      }
    }

    const kpis = selectedSet ? allKpis.filter((k) => selectedSet.has(String(k.id))) : allKpis;
    const deviationCases = selectedSet
      ? allDeviationCases.filter((c) => selectedSet.has(String(c.kpiId)))
      : allDeviationCases;

    const actionPlan = deviationCases.flatMap((c) =>
      (c.actions || []).map((a) => ({
        ...a,
        kpiId: c.kpiId,
        kpiName: c.kpiName,
        severity: c.severity,
        caseStatus: c.status,
      }))
    );

    const stats = {
      kpisTotal: kpis.length,
      kpisOnTarget: kpis.filter((k) => k.latestValue != null && k.isOnTarget).length,
      kpisBelowTarget: kpis.filter((k) => k.latestValue != null && !k.isOnTarget).length,
      kpisNoData: kpis.filter((k) => k.latestValue == null).length,
      openDeviationCases: deviationCases.length,
      openRedCases: deviationCases.filter((c) => c.severity === 'RED').length,
      openAmberCases: deviationCases.filter((c) => c.severity === 'AMBER').length,
      openActions: actionPlan.filter((a) => String(a.status || '').toUpperCase() !== 'DONE').length,
    };

    const title =
      (params.title && String(params.title).trim()) ||
      `KPI performance review (${periodStart}${periodEnd ? ` → ${periodEnd}` : ''})`;

    const snapshot: ResultsKpiReportSnapshot = {
      id: '',
      organizationId: params.organizationId,
      periodStart,
      periodEnd,
      title,
      generatedAt: now,
      kpis,
      deviationCases,
      actionPlan,
      stats,
    };

    const markdown = renderSnapshotMarkdown(snapshot);

    const snapshotId = uuidv4().replace(/-/g, '');
    snapshot.id = snapshotId;

    const filtersToStore: Record<string, unknown> = {
      ...(params.filters && typeof params.filters === 'object' ? params.filters : {}),
      ...(selectedSet ? { kpiIds: requestedKpiIds } : {}),
    };
    const filtersJson = Object.keys(filtersToStore).length ? JSON.stringify(filtersToStore) : null;

    await tx.query(
      `
    INSERT INTO results_kpi_report_snapshots (
      id, organization_id, period_start, period_end, title, filters_json, snapshot_json, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        snapshotId,
        params.organizationId,
        periodStart,
        periodEnd,
        title,
        filtersJson,
        JSON.stringify(snapshot),
        params.createdBy,
      ]
    );

    return { snapshotId, snapshot, markdown };
  });
}

export async function getKpiReportSnapshot(params: {
  organizationId: string;
  snapshotId: string;
}): Promise<any | null> {
  const row = await withPgTransaction(async (tx) => {
    const result = await tx.query<any>(
      `SELECT * FROM results_kpi_report_snapshots WHERE id = ? AND organization_id = ?`,
      [params.snapshotId, params.organizationId]
    );
    return result.rows[0] ?? null;
  });
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    title: row.title,
    filters:
      typeof row.filters_json === 'string'
        ? JSON.parse(row.filters_json)
        : row.filters_json || null,
    snapshot:
      typeof row.snapshot_json === 'string'
        ? JSON.parse(row.snapshot_json)
        : row.snapshot_json || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
