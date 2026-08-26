import type { SignalRule } from '../../../../types/workSignals.js';

interface KpiSignalRow {
  signal_id: string;
  kpi_id: string;
  signal_type: string;
  severity: string;
  created_at: string;
  initiative_id: string;
  current_value: number | null;
  target_value: number | null;
}

export const kpiThresholdBreachedRule: SignalRule = {
  ruleId: 'res.kpi_threshold_breached',
  ruleVersion: 1,
  domain: 'RESULTS',
  signalType: 'kpi_threshold_breached',
  severity: (hit) =>
    String(hit.data.sourceSeverity).toLowerCase() === 'critical' ? 'critical' : 'warning',
  subjectType: 'initiative',
  titleKey: 'signals.res.kpi_threshold_breached.title',
  bodyKey: 'signals.res.kpi_threshold_breached.body',
  async evaluate(ctx) {
    const rows = await ctx.db.query<KpiSignalRow>(
      `SELECT s.signal_id, s.kpi_id, s.signal_type, s.severity, s.created_at,
              d.initiative_id, d.current_value, d.target_value
         FROM v8_kpi_signals s JOIN v8_kpi_definitions d
           ON d.organization_id = s.organization_id AND d.kpi_id = s.kpi_id
        WHERE s.organization_id = ? AND d.initiative_id IS NOT NULL
          AND lower(coalesce(s.next_action_status, 'pending')) IN ('pending', 'open')`,
      [ctx.organizationId]
    );
    return rows.map((row) => ({
      subjectId: row.initiative_id,
      observedValue: { current: row.current_value, target: row.target_value, kpiId: row.kpi_id },
      observedAt: new Date(row.created_at).toISOString(),
      data: { kpiId: row.kpi_id, sourceSignalId: row.signal_id, sourceSeverity: row.severity },
    }));
  },
  dedupeKey: (hit) => `res.kpi_threshold_breached:${String(hit.data.sourceSignalId)}`,
  evidence: (hit) => [
    {
      ref: hit.subjectId,
      refType: 'initiative',
      version: null,
      observedValue: hit.observedValue,
      observedAt: hit.observedAt,
    },
  ],
  action: (hit) => ({
    kind: 'OPEN_KPI',
    route: `/results/kpis/${String(hit.data.kpiId)}`,
    params: { kpiId: hit.data.kpiId },
    permission: 'results.read',
  }),
  audience: () => ({ userId: null, role: 'PROJECT_MANAGER' }),
  maxPerRunPerOrg: 25,
  minSeverityToSurface: 'warning',
};
