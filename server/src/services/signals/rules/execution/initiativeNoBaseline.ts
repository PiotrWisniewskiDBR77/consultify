import type { SignalRule } from '../../../../types/workSignals.js';

interface InitiativeRow {
  id: string;
  project_id: string | null;
  owner_execution_id: string | null;
}

export const initiativeNoBaselineRule: SignalRule = {
  ruleId: 'exec.initiative.no_baseline',
  ruleVersion: 1,
  domain: 'EXECUTION',
  signalType: 'initiative_no_baseline',
  severity: 'critical',
  subjectType: 'initiative',
  titleKey: 'signals.exec.initiative.no_baseline.title',
  bodyKey: 'signals.exec.initiative.no_baseline.body',
  async evaluate(ctx) {
    const rows = await ctx.db.query<InitiativeRow>(
      `SELECT i.id, i.project_id, i.owner_execution_id
         FROM initiatives i
         LEFT JOIN initiative_schedule_baselines b
           ON b.organization_id = i.organization_id AND b.initiative_id = i.id
        WHERE i.organization_id = ?
          AND lower(coalesce(i.status, '')) NOT IN ('done', 'completed', 'cancelled', 'archived')
          AND b.id IS NULL`,
      [ctx.organizationId]
    );
    return rows.map((row) => ({
      subjectId: row.id,
      projectId: row.project_id,
      observedValue: 0,
      observedAt: ctx.now.toISOString(),
      data: { ownerId: row.owner_execution_id },
    }));
  },
  dedupeKey: (hit) => `exec.initiative.no_baseline:${hit.subjectId}`,
  evidence: (hit) => [
    {
      ref: hit.subjectId,
      refType: 'initiative',
      version: null,
      observedValue: 0,
      observedAt: hit.observedAt,
    },
  ],
  action: (hit) => ({
    kind: 'OPEN_INITIATIVE',
    route: `/initiatives/${hit.subjectId}`,
    params: { initiativeId: hit.subjectId },
    permission: 'initiatives.read',
  }),
  audience: (hit) => ({ userId: String(hit.data.ownerId || '') || null, role: 'PROJECT_MANAGER' }),
  maxPerRunPerOrg: 25,
  minSeverityToSurface: 'warning',
};
