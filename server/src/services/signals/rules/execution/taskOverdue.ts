import type { SignalRule } from '../../../../types/workSignals.js';

interface TaskRow {
  id: string;
  project_id: string | null;
  assignee_id: string | null;
  due_date: string;
}

export const taskOverdueRule: SignalRule = {
  ruleId: 'exec.task.overdue',
  ruleVersion: 1,
  domain: 'EXECUTION',
  signalType: 'task_overdue',
  severity: (hit) => (Number(hit.observedValue) >= 7 ? 'critical' : 'warning'),
  subjectType: 'task',
  titleKey: 'signals.exec.task.overdue.title',
  bodyKey: 'signals.exec.task.overdue.body',
  async evaluate(ctx) {
    const rows = await ctx.db.query<TaskRow>(
      `SELECT id, project_id, assignee_id, due_date
         FROM tasks
        WHERE organization_id = ? AND due_date IS NOT NULL AND due_date < ?
          AND lower(coalesce(status, '')) NOT IN ('done', 'completed', 'cancelled')`,
      [ctx.organizationId, ctx.now.toISOString()]
    );
    return rows.map((row) => ({
      subjectId: row.id,
      projectId: row.project_id,
      observedValue: Math.max(
        1,
        Math.floor((ctx.now.getTime() - new Date(row.due_date).getTime()) / 86_400_000)
      ),
      observedAt: ctx.now.toISOString(),
      data: { assigneeId: row.assignee_id },
    }));
  },
  dedupeKey: (hit) => `exec.task.overdue:${hit.subjectId}`,
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
