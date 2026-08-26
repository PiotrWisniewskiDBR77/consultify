import type { SignalRule } from '../../../../types/workSignals.js';

interface BudgetRow {
  id: string;
  initiative_id: string;
  project_id: string | null;
  severity: string;
  planned_amount: number | null;
  actual_amount: number | null;
  created_at: string;
}

export const budgetOverspendRule: SignalRule = {
  ruleId: 'fin.budget_overspend',
  ruleVersion: 1,
  domain: 'FINANCE',
  signalType: 'budget_overspend',
  severity: (hit) =>
    String(hit.data.sourceSeverity).toUpperCase() === 'CRITICAL' ? 'critical' : 'warning',
  subjectType: 'initiative',
  titleKey: 'signals.fin.budget_overspend.title',
  bodyKey: 'signals.fin.budget_overspend.body',
  async evaluate(ctx) {
    const rows = await ctx.db.query<BudgetRow>(
      `SELECT id, initiative_id, project_id, severity, planned_amount, actual_amount, created_at
         FROM budget_overspend_signals
        WHERE organization_id = ? AND initiative_id IS NOT NULL AND coalesce(is_dismissed, FALSE) = FALSE
          AND coalesce(actual_amount, 0) > coalesce(planned_amount, 0)`,
      [ctx.organizationId]
    );
    return rows.map((row) => ({
      subjectId: row.initiative_id,
      projectId: row.project_id,
      observedValue: {
        budget: Number(row.planned_amount),
        actual: Number(row.actual_amount),
        overspend: Number(row.actual_amount) - Number(row.planned_amount),
      },
      observedAt: new Date(row.created_at).toISOString(),
      data: { sourceId: row.id, sourceSeverity: row.severity },
    }));
  },
  dedupeKey: (hit) => `fin.budget_overspend:${String(hit.data.sourceId)}`,
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
    kind: 'OPEN_BUDGET',
    route: `/initiatives/${hit.subjectId}/finance`,
    params: { initiativeId: hit.subjectId },
    permission: 'finance.read',
  }),
  audience: () => ({ userId: null, role: 'PROJECT_MANAGER' }),
  maxPerRunPerOrg: 25,
  minSeverityToSurface: 'warning',
};
