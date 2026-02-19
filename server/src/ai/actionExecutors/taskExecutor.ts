/**
 * Task Executor
 *
 * This feature is not implemented in this codebase yet.
 * Do not return fake-success payloads; callers must handle unavailability explicitly.
 */

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
    throw new Error('Feature unavailable: TASK_CREATE execution is not implemented');
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
