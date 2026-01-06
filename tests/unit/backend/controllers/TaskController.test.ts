/**
 * Task Controller Tests
 * Tests task management endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskController from '../../../../server/src/controllers/TaskController.js';

// Mock services using vi.hoisted to ensure they are available to vi.mock
const { mockDbPromise, mockActivityService, mockNotificationService, mockTaskAssignmentService } = vi.hoisted(() => ({
  mockDbPromise: {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
    transaction: vi.fn(),
  },
  mockActivityService: {
    log: vi.fn().mockResolvedValue({}),
  },
  mockNotificationService: {
    create: vi.fn().mockResolvedValue({}),
  },
  mockTaskAssignmentService: {
    assignTask: vi.fn(),
    reassignTask: vi.fn(),
    unassignTask: vi.fn(),
    escalateTask: vi.fn(),
    resolveEscalation: vi.fn(),
    getTaskEscalationHistory: vi.fn(),
    getOverdueTasks: vi.fn(),
    getTasksApproachingSLA: vi.fn(),
    getUserWorkload: vi.fn(),
  }
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  default: mockDbPromise,
  all: (...args: any[]) => mockDbPromise.all(...args),
  get: (...args: any[]) => mockDbPromise.get(...args),
  run: (...args: any[]) => mockDbPromise.run(...args),
  transaction: (...args: any[]) => mockDbPromise.transaction(...args),
}));

vi.mock('../../../../server/src/services/ActivityService.js', () => ({
  default: mockActivityService,
}));

vi.mock('../../../../server/src/services/NotificationService.js', () => ({
  default: mockNotificationService,
}));

vi.mock('../../../../server/src/services/taskAssignmentService.js', () => ({
  default: mockTaskAssignmentService,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TaskController', () => {
  let mockRequest: any;
  let mockResponse: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRequest = {
      user: {
        id: 'user-123',
        organizationId: 'org-123',
        role: 'admin'
      },
      params: {},
      query: {},
      body: {}
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    next = vi.fn();
  });

  describe('getTasks', () => {
    it('should get all tasks for organization', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', status: 'todo', organization_id: 'org-123' },
        { id: 'task-2', title: 'Task 2', status: 'in_progress', organization_id: 'org-123' },
      ];

      mockDbPromise.all.mockResolvedValue(mockTasks);
      mockDbPromise.get.mockResolvedValue({ total: 2 });

      await (TaskController as any).getTasks(mockRequest, mockResponse, next);

      expect(mockResponse.json).toHaveBeenCalled();
      const responseData = mockResponse.json.mock.calls[0][0];
      expect(responseData).toHaveLength(2);
      expect(responseData[0].id).toBe('task-1');
      expect(mockDbPromise.all).toHaveBeenCalled();
    });

    it('should handle unauthorized access', async () => {
      mockRequest.user = null;

      await (TaskController as any).getTasks(mockRequest, mockResponse, next);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('getTaskById', () => {
    it('should get single task by id', async () => {
      const taskId = 'task-123';
      const mockTask = {
        id: taskId,
        title: 'Test Task',
        status: 'todo',
        organization_id: 'org-123'
      };

      mockRequest.params.id = taskId;
      mockDbPromise.get.mockResolvedValue(mockTask);

      await (TaskController as any).getTaskById(mockRequest, mockResponse, next);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        id: taskId,
        title: 'Test Task'
      }));
    });

    it('should return 404 for non-existent task', async () => {
      mockRequest.params.id = 'non-existent';
      mockDbPromise.get.mockResolvedValue(null);

      await (TaskController as any).getTaskById(mockRequest, mockResponse, next);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Task not found' });
    });
  });

  describe('createTask', () => {
    it('should create new task', async () => {
      mockRequest.body = {
        projectId: 'proj-123',
        title: 'New Task',
        priority: 'high'
      };

      mockDbPromise.run.mockResolvedValue({ success: true });
      mockDbPromise.get.mockResolvedValue({
        id: 'new-id',
        title: 'New Task',
        project_id: 'proj-123'
      });

      await (TaskController as any).createTask(mockRequest, mockResponse, next);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockDbPromise.run).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      mockRequest.body = { title: 'Missing Project ID' };

      await (TaskController as any).createTask(mockRequest, mockResponse, next);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'projectId is required' });
    });
  });

  describe('deleteTask', () => {
    it('should delete task', async () => {
      const taskId = 'task-123';
      mockRequest.params.id = taskId;
      
      mockDbPromise.get.mockResolvedValue({ id: taskId, reporter_id: 'user-123', title: 'Task' });
      mockDbPromise.run.mockResolvedValue({ success: true, changes: 1 });

      await (TaskController as any).deleteTask(mockRequest, mockResponse, next);

      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Task deleted' });
      expect(mockDbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tasks'),
        expect.arrayContaining([taskId, 'org-123'])
      );
    });
  });
});
