/**
 * Organizations API Module
 * Enterprise SaaS Architecture - Organization Management
 */

import { API_URL, getHeaders, handleResponse } from './baseClient';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  ownerId: string;
  settings?: OrganizationSettings;
  branding?: OrganizationBranding;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  timezone: string;
  locale: string;
  dateFormat: string;
  currency: string;
}

export interface OrganizationBranding {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
}

export interface OrganizationMember {
  userId: string;
  email: string;
  name: string;
  role: string;
  status: 'active' | 'invited' | 'suspended';
  joinedAt: string;
}

export interface SwitchOrganizationResult {
  success: boolean;
  organization: { id: string; name: string; role: string; plan: string };
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export const OrganizationApi = {
  // ==========================================
  // ORGANIZATIONS
  // ==========================================

  getUserOrganizations: async (): Promise<Organization[]> => {
    const res = await fetch(`${API_URL}/organizations/current`, { headers: getHeaders() });
    const data = await handleResponse<{ organizations: Organization[] } | Organization[]>(
      res,
      'Failed to fetch organizations'
    );
    if (Array.isArray(data)) return data;
    return (data as { organizations: Organization[] })?.organizations || [];
  },

  switchOrganization: async (organizationId: string): Promise<SwitchOrganizationResult> => {
    const res = await fetch(`${API_URL}/auth/switch-organization`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ organizationId }),
    });
    return handleResponse<SwitchOrganizationResult>(res, 'Failed to switch organization');
  },

  getOrganization: async (orgId: string): Promise<Organization> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch organization details');
  },

  createOrganization: async (name: string): Promise<Organization> => {
    const res = await fetch(`${API_URL}/organizations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(res, 'Failed to create organization');
  },

  updateOrganization: async (orgId: string, updates: Partial<Organization>): Promise<void> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update organization');
  },

  // ==========================================
  // ORGANIZATION MEMBERS
  // ==========================================

  getOrganizationMembers: async (orgId: string): Promise<OrganizationMember[]> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/members`, { headers: getHeaders() });
    return handleResponse<OrganizationMember[]>(res, 'Failed to fetch organization members').then(
      (data) => data || []
    );
  },

  addOrganizationMember: async (
    orgId: string,
    email: string,
    role: string
  ): Promise<OrganizationMember> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/members`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ targetUserId: email, role }),
    });
    return handleResponse(res, 'Failed to add member');
  },

  removeOrganizationMember: async (orgId: string, userId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to remove member');
  },

  // ==========================================
  // ORGANIZATION BILLING
  // ==========================================

  activateBilling: async (orgId: string): Promise<unknown> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/billing/activate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to activate billing');
  },

  getOrgTokenBalance: async (orgId: string): Promise<{ available: number; used: number }> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/tokens/balance`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch token balance');
  },

  getOrgTokenLedger: async (orgId: string, limit = 50, offset = 0): Promise<unknown[]> => {
    const res = await fetch(
      `${API_URL}/organizations/${orgId}/tokens/ledger?limit=${limit}&offset=${offset}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse<{ ledger: unknown[] }>(res, 'Failed to fetch token ledger').then(
      (data) => data?.ledger || []
    );
  },

  // ==========================================
  // INVITATIONS
  // ==========================================

  createOrganizationInvitation: async (email: string, role: string): Promise<unknown> => {
    const res = await fetch(`${API_URL}/invitations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to send invitation');
    return json;
  },

  getInvitations: async (): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/invitations`, { headers: getHeaders() });
    const json = await handleResponse<{ invitations?: unknown[] }>(
      res,
      'Failed to fetch invitations'
    );
    return json?.invitations || (json as unknown[]) || [];
  },

};
