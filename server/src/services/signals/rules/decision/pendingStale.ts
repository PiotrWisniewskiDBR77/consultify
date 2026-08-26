import type { SignalRule } from '../../../../types/workSignals.js';

interface DecisionRow {
  id: string;
  project_id: string | null;
  created_at: string;
}

export const decisionPendingStaleRule: SignalRule = {
  ruleId: 'dec.pending_stale',
  ruleVersion: 1,
  domain: 'DECISION',
  signalType: 'decision_pending_stale',
  severity: (hit) => (Number(hit.observedValue) >= 10 ? 'critical' : 'warning'),
  subjectType: 'decision',
  titleKey: 'signals.dec.pending_stale.title',
  bodyKey: 'signals.dec.pending_stale.body',
  async evaluate(ctx) {
    const rows = await ctx.db.query<DecisionRow>(
      `SELECT id, project_id, created_at FROM decisions
        WHERE organization_id = ? AND lower(coalesce(status, '')) = 'pending'
          AND created_at < ?`,
      [ctx.organizationId, new Date(ctx.now.getTime() - 432_000_000).toISOString()]
    );
    return rows.map((row) => ({
      subjectId: row.id,
      projectId: row.project_id,
      observedValue: Math.floor(
        (ctx.now.getTime() - new Date(row.created_at).getTime()) / 86_400_000
      ),
      observedAt: ctx.now.toISOString(),
      data: {},
    }));
  },
  dedupeKey: (hit) => `dec.pending_stale:${hit.subjectId}`,
  evidence: (hit) => [
    {
      ref: hit.subjectId,
      refType: 'decision',
      version: null,
      observedValue: hit.observedValue,
      observedAt: hit.observedAt,
    },
  ],
  action: (hit) => ({
    kind: 'OPEN_DECISION',
    route: `/decisions/${hit.subjectId}`,
    params: { decisionId: hit.subjectId },
    permission: 'decisions.read',
  }),
  audience: () => ({ userId: null, role: 'PROJECT_MANAGER' }),
  maxPerRunPerOrg: 25,
  minSeverityToSurface: 'warning',
};
