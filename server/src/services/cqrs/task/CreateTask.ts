import { getDatabase } from '../../../database/Database.js';
import { TaskService } from '../../TaskService.js';
import { CommandHandler } from '../CommandBus.js';

export class CreateTaskCommand {
  constructor(
    public readonly projectId: string,
    public readonly title: string,
    public readonly userId: string,
    public readonly description?: string,
    public readonly status?: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked',
    public readonly priority?: 'low' | 'medium' | 'high' | 'critical',
    public readonly assigneeId?: string,
    public readonly dueDate?: string,
    public readonly estimatedHours?: number,
    public readonly tags?: string[],
    public readonly initiativeId?: string
  ) {}
}

export class CreateTaskHandler implements CommandHandler<CreateTaskCommand> {
  async execute(command: CreateTaskCommand): Promise<void> {
    const db = getDatabase();
    const taskService = new TaskService(db);

    await taskService.createTask(
      {
        projectId: command.projectId,
        title: command.title,
        description: command.description,
        status: command.status || 'todo',
        priority: command.priority || 'medium',
        assigneeId: command.assigneeId,
        dueDate: command.dueDate,
        estimatedHours: command.estimatedHours,
        tags: command.tags,
        initiativeId: command.initiativeId,
      },
      command.userId
    );
  }
}
