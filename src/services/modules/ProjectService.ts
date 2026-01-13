import { API_URL, getHeaders, handleResponse } from '../apiUtils';

export const ProjectService = {
  // Get all projects
  getProjects: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/projects`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch projects');
  },

  // Get single project
  getProject: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/projects/${id}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch project');
  },

  // Create project
  createProject: async (data: { name: string; description?: string }): Promise<any> => {
    const res = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create project');
  },

  // Update project
  updateProject: async (id: string, data: any): Promise<any> => {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update project');
  },

  // Delete project
  deleteProject: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  // Get project members
  getMembers: async (projectId: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/projects/${projectId}/members`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch members');
  },

  // Add project member
  addMember: async (projectId: string, data: { userId: string; role: string }): Promise<any> => {
    const res = await fetch(`${API_URL}/projects/${projectId}/members`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to add member');
  },

  // Remove project member
  removeMember: async (projectId: string, userId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to remove member');
  },
};
