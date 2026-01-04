/**
 * Task Controller Tests
 * Tests task management endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import TaskController from '../../../../server/src/controllers/TaskController.ts';

// Mock services
const mockTaskService = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  assignTask: vi.fn(),
  completeTask: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../../server/src/services/TaskService.ts', () => ({
  default: mockTaskService,
}));

vi.mock('../../../../server/src/utils/Logger.ts', () => ({
  default: mockLogger,
}));

describe('TaskController', () => {
  let controller: TaskController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: vi.SpyInstance;
  let statusSpy: vi.SpyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new TaskController();

    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });

    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
    };
  });

  describe('getTasks', () => {
    it('should get all tasks for project', async () => {
      const projectId = 'proj-123';
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', status: 'todo' },
        { id: 'task-2', title: 'Task 2', status: 'in-progress' },
      ];

      mockRequest = { params: { projectId } };
      mockTaskService.getTasks.mockResolvedValue(mockTasks);

      await controller.getTasks(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockTasks);
      expect(mockTaskService.getTasks).toHaveBeenCalledWith(projectId, {});
    });

    it('should handle service errors', async () => {
      mockRequest = { params: { projectId: 'proj-123' } };
      const error = new Error('Database error');

      mockTaskService.getTasks.mockRejectedValue(error);

      await controller.getTasks(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Database error' });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate projectId parameter', async () => {
      mockRequest = { params: {} };

      await controller.getTasks(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Project ID is required' });
    });
  });

  describe('getTask', () => {
    it('should get single task by id', async () => {
      const taskId = 'task-123';
      const mockTask = {
        id: taskId,
        title: 'Test Task',
        description: 'Test description',
        status: 'todo',
        assigneeId: 'user-456',
        projectId: 'proj-789',
      };

      mockRequest = { params: { id: taskId } };
      mockTaskService.getTask.mockResolvedValue(mockTask);

      await controller.getTask(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockTask);
      expect(mockTaskService.getTask).toHaveBeenCalledWith(taskId);
    });

    it('should return 404 for non-existent task', async () => {
      mockRequest = { params: { id: 'non-existent' } };
      const error = new Error('Task not found');

      mockTaskService.getTask.mockRejectedValue(error);

      await controller.getTask(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Task not found' });
    });
  });

  describe('createTask', () => {
    it('should create new task', async () => {
      const taskData = {
        title: 'New Task',
        description: 'Task description',
        projectId: 'proj-123',
        assigneeId: 'user-456',
      };

      const mockCreatedTask = {
        id: 'task-new',
        ...taskData,
        status: 'todo',
        createdAt: new Date(),
      };

      mockRequest = {
        body: taskData,
        params: { projectId: 'proj-123' },
      };
      mockTaskService.createTask.mockResolvedValue(mockCreatedTask);

      await controller.createTask(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith(mockCreatedTask);
      expect(mockTaskService.createTask).toHaveBeenCalledWith(taskData);
    });

    it('should validate required fields', async () => {
      mockRequest = {
        body: { description: 'No title' },
        params: { projectId: 'proj-123' },
      };

      await controller.createTask(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Title is required' });
    });
  });

  describe('updateTask', () => {
    it('should update existing task', async () => {
      const taskId = 'task-123';
      const updateData = {
        title: 'Updated Title',
        status: 'in-progress',
      };

      const mockUpdatedTask = {
        id: taskId,
        title: 'Updated Title',
        status: 'in-progress',
        updatedAt: new Date(),
      };

      mockRequest = {
        params: { id: taskId },
        body: updateData,
      };
      mockTaskService.updateTask.mockResolvedValue(mockUpdatedTask);

      await controller.updateTask(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockUpdatedTask);
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(taskId, updateData);
    });
  });

  describe('deleteTask', () => {
    it('should delete task', async () => {
      const taskId = 'task-123';

      mockRequest = { params: { id: taskId } };
      mockTaskService.deleteTask.mockResolvedValue({ success: true });

      await controller.deleteTask(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ success: true });
      expect(mockTaskService.deleteTask).toHaveBeenCalledWith(taskId);
    });
  });

  describe('assignTask', () => {
    it('should assign task to user', async () => {
      const taskId = 'task-123';
      const userId = 'user-456';

      const mockAssignedTask = {
        id: taskId,
        assigneeId: userId,
        updatedAt: new Date(),
      };

      mockRequest = {
        params: { id: taskId },
        body: { userId },
      };
      mockTaskService.assignTask.mockResolvedValue(mockAssignedTask);

      await controller.assignTask(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockAssignedTask);
      expect(mockTaskService.assignTask).toHaveBeenCalledWith(taskId, userId);
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', async () => {
      const taskId = 'task-123';

      const mockCompletedTask = {
        id: taskId,
        status: 'completed',
        completedAt: new Date(),
      };

      mockRequest = { params: { id: taskId } };
      mockTaskService.completeTask.mockResolvedValue(mockCompletedTask);

      await controller.completeTask(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockCompletedTask);
      expect(mockTaskService.completeTask).toHaveBeenCalledWith(taskId);
    });
  });
});
