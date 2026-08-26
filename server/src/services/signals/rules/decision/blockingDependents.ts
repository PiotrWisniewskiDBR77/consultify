import type { SourceObjectType } from '../../../../types/executionVisibility.js';
import type { SignalRule } from '../../../../types/workSignals.js';

interface BlockingRow {
  id: string;
  project_id: string | null;
  impacted_type: SourceObjectType;
  impacted_id: string;
}

export const decisionBlockingDependentsRule: SignalRule = {
  ruleId: 'dec.blocking_dependents',
  ruleVersion: 1,
  domain: 'DECISION',
  signalType: 'decision_blocking_dependents',
  severity: 'blocker',
  subjectType: 'decision',
  titleKey: 'signals.dec.blocking_dependents.title',
  bodyKey: 'signals.dec.blocking_dependents.body',
  async evaluate(ctx) {
    const rows = await ctx.db.query<BlockingRow>(
      `SELECT d.id, d.project_id, di.impacted_type, di.impacted_id
         FROM decisions d
         JOIN decision_impacts di ON di.decision_id = d.id AND di.is_blocker = TRUE
        WHERE d.organization_id = ? AND lower(coalesce(d.status, '')) = 'pending'`,
      [ctx.organizationId]
    );
    const grouped = new Map<string, BlockingRow[]>();
    for (const row of rows) grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]);
    return [...grouped.entries()].map(([subjectId, dependents]) => ({
      subjectId,
      projectId: dependents[0].project_id,
      observedValue: dependents.length,
      observedAt: ctx.now.toISOString(),
      data: {
        dependents: dependents.map((row) => ({ ref: row.impacted_id, refType: row.impacted_type })),
      },
    }));
  },
  dedupeKey: (hit) => `dec.blocking_dependents:${hit.subjectId}`,
  evidence: (hit) =>
    (hit.data.dependents as Array<{ ref: string; refType: SourceObjectType }>).map((item) => ({
      ...item,
      version: null,
      observedValue: 'BLOCKED',
      observedAt: hit.observedAt,
    })),
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
