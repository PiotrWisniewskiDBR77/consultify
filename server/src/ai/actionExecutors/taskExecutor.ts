/**
 * Task Executor
 *
 * Teresa last-mile (backlog #5): turns an approved TASK_CREATE proposal into a REAL
 * row in `tasks`. Mirrors the live-proven, column-defensive INSERT used by the
 * `/api/my-work/chat-actions` slash path (the only task-create path known to work
 * against the production Postgres DB), rather than the dead-ended `datetime('now')`
 * INSERT in actionProposalEngine. Failures return {success:false} so the executor
 * adapter degrades gracefully instead of throwing.
 */

import { v4 as uuidv4 } from 'uuid';

import { getTableColumns } from '../../utils/dbSchema.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

export interface ExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface TaskPayload {
  task_id?: string;
  title?: string;
  description?: string;
  assignee_id?: string;
  due_date?: string;
  priority?: string;
  project_id?: string;
}

export const TaskExecutor = {
  async execute(
    payload: TaskPayload,
    metadata: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const userId = String((metadata as any)?.userId || '');
    const organizationId = String((metadata as any)?.organizationId || '');
    if (!organizationId) {
      return { success: false, error: 'organizationId is required to create a task' };
    }
    try {
      const id = uuidv4();
      const cols = await getTableColumns('tasks');
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [id];
      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };
      add('organization_id', organizationId);
      add('title', String(payload.title || 'New Task').slice(0, 500));
      add('description', payload.description || null);
      add('status', 'todo');
      add('priority', payload.priority || 'medium');
      add('assignee_id', payload.assignee_id || userId || null);
      add('reporter_id', userId || null);
      if (payload.due_date) add('due_date', payload.due_date);
      if (payload.project_id) add('project_id', payload.project_id);
      add('tags', JSON.stringify([]));
      add('task_type', 'personal');
      add('created_by', userId || null);
      add('updated_by', userId || null);
      add('source', 'ai');
      await queryHelpers.queryRun(
        `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
      return { success: true, result: { taskId: id, title: payload.title || 'New Task' } };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async dryRun(
    payload: TaskPayload,
    metadata: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    return {
      success: true,
      result: {
        action: 'create_task',
        payload,
        metadata,
        message: 'Dry run: would create task',
      },
    };
  },
};

export default TaskExecutor;
