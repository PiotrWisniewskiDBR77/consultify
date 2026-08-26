import type { SignalRule } from '../../../../types/workSignals.js';

interface TaskRow {
  id: string;
  project_id: string | null;
  assignee_id: string | null;
  updated_at: string;
}

export const taskBlockedStaleRule: SignalRule = {
  ruleId: 'exec.task.blocked_stale',
  ruleVersion: 1,
  domain: 'EXECUTION',
  signalType: 'task_blocked_stale',
  severity: 'critical',
  subjectType: 'task',
  titleKey: 'signals.exec.task.blocked_stale.title',
  bodyKey: 'signals.exec.task.blocked_stale.body',
  async evaluate(ctx) {
    const rows = await ctx.db.query<TaskRow>(
      `SELECT id, project_id, assignee_id, updated_at FROM tasks
        WHERE organization_id = ? AND lower(coalesce(status, '')) = 'blocked'
          AND updated_at < ?`,
      [ctx.organizationId, new Date(ctx.now.getTime() - 432_000_000).toISOString()]
    );
    return rows.map((row) => ({
      subjectId: row.id,
      projectId: row.project_id,
      observedValue: Math.floor(
        (ctx.now.getTime() - new Date(row.updated_at).getTime()) / 86_400_000
      ),
      observedAt: ctx.now.toISOString(),
      data: { assigneeId: row.assignee_id },
    }));
  },
  dedupeKey: (hit) => `exec.task.blocked_stale:${hit.subjectId}`,
  evidence: (hit) => [
    {
      ref: hit.subjectId,
      refType: 'task',
      version: null,
      observedValue: hit.observedValue,
      observedAt: hit.observedAt,
    },
  ],
  action: (hit) => ({
    kind: 'OPEN_TASK',
    route: `/tasks/${hit.subjectId}`,
    params: { taskId: hit.subjectId },
    permission: 'tasks.read',
  }),
  audience: (hit) => ({ userId: String(hit.data.assigneeId || '') || null, role: null }),
  maxPerRunPerOrg: 25,
  minSeverityToSurface: 'warning',
};
