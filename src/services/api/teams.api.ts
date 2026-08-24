/**
 * Teams API Module
 * Enterprise SaaS Architecture - Team Management
 */

import { API_URL, getHeaders } from './baseClient';

export interface Team {
  id: string;
  name: string;
  description?: string;
  leadId?: string;
  lead?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
  organizationId: string;
  members: TeamMember[];
  memberCount?: number;
  color?: string;
  defaultProjectRole?: string;
  teamType?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TeamMember {
  userId: string;
  role: string;
  joinedAt?: string;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
}

export const TeamApi = {
  // ==========================================
  // TEAMS CRUD
  // ==========================================

  getTeams: async (): Promise<Team[]> => {
    const res = await fetch(`${API_URL}/teams`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch teams');
    return res.json();
  },

  getTeam: async (id: string): Promise<Team> => {
    const res = await fetch(`${API_URL}/teams/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch team');
    return res.json();
  },

  createTeam: async (team: {
    name: string;
    description?: string;
    leadId?: string;
    color?: string;
    defaultProjectRole?: string;
    teamType?: string;
  }): Promise<Team> => {
    const res = await fetch(`${API_URL}/teams`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(team),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create team');
    return data;
  },

  updateTeam: async (id: string, updates: Partial<Team>): Promise<void> => {
    const res = await fetch(`${API_URL}/teams/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update team');
  },

  deleteTeam: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/teams/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete team');
  },

  // ==========================================
  // TEAM MEMBERS
  // ==========================================

  addTeamMember: async (teamId: string, userId: string, role = 'member'): Promise<void> => {
    const res = await fetch(`${API_URL}/teams/${teamId}/members`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) throw new Error('Failed to add team member');
  },

  removeTeamMember: async (teamId: string, userId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to remove team member');
  },
};
