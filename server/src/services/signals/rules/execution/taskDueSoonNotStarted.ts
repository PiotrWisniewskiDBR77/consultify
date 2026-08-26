import type { SignalRule } from '../../../../types/workSignals.js';

interface TaskRow {
  id: string;
  project_id: string | null;
  assignee_id: string | null;
  due_date: string;
}

export const taskDueSoonNotStartedRule: SignalRule = {
  ruleId: 'exec.task.due_soon_not_started',
  ruleVersion: 1,
  domain: 'EXECUTION',
  signalType: 'task_due_soon_not_started',
  severity: 'warning',
  subjectType: 'task',
  titleKey: 'signals.exec.task.due_soon_not_started.title',
  bodyKey: 'signals.exec.task.due_soon_not_started.body',
  async evaluate(ctx) {
    const rows = await ctx.db.query<TaskRow>(
      `SELECT id, project_id, assignee_id, due_date
         FROM tasks
        WHERE organization_id = ? AND due_date >= ? AND due_date <= ?
          AND lower(coalesce(status, '')) IN ('todo', 'blocked')`,
      [
        ctx.organizationId,
        ctx.now.toISOString(),
        new Date(ctx.now.getTime() + 259_200_000).toISOString(),
      ]
    );
    return rows.map((row) => ({
      subjectId: row.id,
      projectId: row.project_id,
      observedValue: Math.ceil((new Date(row.due_date).getTime() - ctx.now.getTime()) / 86_400_000),
      observedAt: ctx.now.toISOString(),
      data: { assigneeId: row.assignee_id },
    }));
  },
  dedupeKey: (hit) => `exec.task.due_soon_not_started:${hit.subjectId}`,
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
