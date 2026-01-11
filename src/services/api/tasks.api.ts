/**
 * Tasks API Module
 * Enterprise SaaS Architecture - Task Management
 */

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';
import type { TaskFilters } from './types';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigneeId?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  checklist?: TaskChecklistItem[];
  tags?: string[];
  taskType?: string;
  initiativeId?: string;
  why?: string;
  stepPhase?: 'design' | 'pilot' | 'rollout';
  createdAt: string;
  updatedAt: string;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  dueDate?: string;
  estimatedHours?: number;
  checklist?: TaskChecklistItem[];
  tags?: string[];
  taskType?: string;
  initiativeId?: string;
  why?: string;
  stepPhase?: 'design' | 'pilot' | 'rollout';
}

export const TaskApi = {
  // ==========================================
  // TASKS CRUD
  // ==========================================

  getTasks: async (filters?: TaskFilters): Promise<Task[]> => {
    let url = `${API_URL}/tasks`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.status) params.append('status', filters.status);
      if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.initiativeId) params.append('initiativeId', filters.initiativeId);
      if (params.toString()) url += `?${params.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  getTask: async (id: string): Promise<Task> => {
    const res = await fetch(`${API_URL}/tasks/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch task');
    return res.json();
  },

  createTask: async (task: CreateTaskInput): Promise<Task> => {
    const res = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(task),
    });
    return handleResponse(res, 'Failed to create task');
  },

  updateTask: async (id: string, updates: Partial<Task>): Promise<void> => {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await handleResponse(res, 'Failed to update task');
  },

  deleteTask: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete task');
  },

  // ==========================================
  // TASK COMMENTS
  // ==========================================

  getTaskComments: async (taskId: string): Promise<TaskComment[]> => {
    const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch comments');
    return res.json();
  },

  addTaskComment: async (taskId: string, content: string): Promise<TaskComment> => {
    const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add comment');
    return data;
  },

  deleteTaskComment: async (taskId: string, commentId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete comment');
  },

  // ==========================================
  // TASK AI SUGGESTIONS
  // ==========================================

  suggestTasks: async (initiative: unknown): Promise<Task[]> => {
    const res = await fetch(`${API_URL}/ai/suggest-tasks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ initiative }),
    });
    if (!res.ok) throw new Error('Failed to suggest tasks');
    return res.json();
  },

  generateTaskInsight: async (task: unknown, initiative: unknown): Promise<unknown> => {
    const res = await fetch(`${API_URL}/ai/task-insight`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ task, initiative }),
    });
    if (!res.ok) throw new Error('Failed to generate task insight');
    return res.json();
  },
};
