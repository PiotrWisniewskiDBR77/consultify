/**
 * Admin API Module
 * Enterprise SaaS Architecture - SuperAdmin & Organization Admin
 */

import { User } from '../../types';
import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export interface SuperAdminDashboard {
  activity: { total: number; last_hour: number; last_24h: number; last_7d: number };
  ai: { total_ai_calls: number; total_tokens: number; active_users: number };
  counts: { total_users: number; total_orgs: number; active_users_7d: number };
  live?: { total_active_connections: number };
  activities: unknown[];
}

export interface AdminAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  createdAt: string;
  resolvedAt?: string;
}

export type FeatureUpdateStatus = 'draft' | 'review' | 'published' | 'archived';
export type FeatureUpdateImportance = 'low' | 'normal' | 'high';
export type FeatureUpdateAudience = 'all' | 'admins' | 'superadmins' | 'roles';
export type FeatureUpdateSurface = 'global' | 'module' | 'view';
export type FeatureUpdateChangeType =
  | 'new_feature'
  | 'improvement'
  | 'important_change'
  | 'risk_or_breaking';
export type FeatureUpdateScope = 'global' | 'organization';

export interface ManagedFeatureUpdate {
  id: string;
  organizationId: string | null;
  scope: FeatureUpdateScope;
  title: string;
  bodyMd: string;
  tags: string[];
  importance: FeatureUpdateImportance;
  status: FeatureUpdateStatus;
  actionPayload: Record<string, unknown>;
  audience: FeatureUpdateAudience;
  targetRoles: string[];
  surface: FeatureUpdateSurface;
  moduleId: string | null;
  targetView: string | null;
  changeType: FeatureUpdateChangeType;
  effectiveFrom: string | null;
  expiresAt: string | null;
  requiresAck: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  publishedBy: string | null;
  analytics: {
    opened: number;
    clicked: number;
    read: number;
  };
}

export interface FeatureUpdatesSummary {
  total: number;
  draft: number;
  review: number;
  published: number;
  archived: number;
  global: number;
  organization: number;
}

export interface FeatureUpdatesListResponse {
  summary: FeatureUpdatesSummary;
  items: ManagedFeatureUpdate[];
}

export interface ManagedFeatureUpdateInput {
  organizationId?: string | null;
  title: string;
  bodyMd: string;
  tags?: string[];
  importance?: FeatureUpdateImportance;
  status?: Exclude<FeatureUpdateStatus, 'published'>;
  actionPayload?: Record<string, unknown>;
  audience?: FeatureUpdateAudience;
  targetRoles?: string[];
  surface?: FeatureUpdateSurface;
  moduleId?: string | null;
  targetView?: string | null;
  changeType?: FeatureUpdateChangeType;
  effectiveFrom?: string | null;
  expiresAt?: string | null;
  requiresAck?: boolean;
}

export const AdminApi = {
  // ==========================================
  // SUPER ADMIN DASHBOARD
  // ==========================================

  getSuperAdminDashboard: async (): Promise<SuperAdminDashboard> => {
    const res = await fetch(`${API_URL}/superadmin/dashboard`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },

  getActivities: async (limit = 50): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/superadmin/activities?limit=${limit}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch activities');
    return res.json();
  },

  getOrganizationAISettings: async (organizationId: string): Promise<unknown> => {
    const res = await fetchWithRetry(`${API_URL}/ai-settings/org/${organizationId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch organization AI settings');
  },

  updateOrganizationAISettings: async (
    organizationId: string,
    settings: Record<string, unknown>
  ): Promise<unknown> => {
    const res = await fetchWithRetry(`${API_URL}/ai-settings/org/${organizationId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    return handleResponse(res, 'Failed to save organization AI settings');
  },

  getOrganizationOwnership: async (organizationId: string): Promise<unknown> => {
    const res = await fetchWithRetry(`${API_URL}/organizations/${organizationId}/ownership`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch organization ownership');
  },

  getOrganizationAdmins: async (organizationId: string): Promise<unknown[]> => {
    const res = await fetchWithRetry(`${API_URL}/organizations/${organizationId}/admins`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch organization admins');
  },

  getPendingOwnershipTransfer: async (organizationId: string): Promise<unknown> => {
    const res = await fetchWithRetry(
      `${API_URL}/organizations/${organizationId}/ownership/pending-transfer`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch pending ownership transfer');
  },

  transferOrganizationOwnership: async (
    organizationId: string,
    payload: { toUserId: string; reason?: string }
  ): Promise<unknown> => {
    const res = await fetchWithRetry(
      `${API_URL}/organizations/${organizationId}/ownership/transfer`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to initiate ownership transfer');
  },

  cancelOrganizationOwnershipTransfer: async (organizationId: string): Promise<unknown> => {
    const res = await fetchWithRetry(
      `${API_URL}/organizations/${organizationId}/ownership/cancel-transfer`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to cancel ownership transfer');
  },

  acceptOrganizationOwnershipTransfer: async (organizationId: string): Promise<unknown> => {
    const res = await fetchWithRetry(
      `${API_URL}/organizations/${organizationId}/ownership/accept-transfer`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to accept ownership transfer');
  },

  scheduleOrganizationDeletion: async (organizationId: string): Promise<unknown> => {
    const res = await fetchWithRetry(
      `${API_URL}/organizations/${organizationId}/schedule-deletion`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to schedule organization deletion');
  },

  // ==========================================
  // ORGANIZATION MANAGEMENT (SuperAdmin)
  // ==========================================

  getOrganizations: async (): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/superadmin/organizations`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch organizations');
    return res.json();
  },

  updateOrganization: async (
    id: string,
    updates: {
      plan?: string;
      status?: string;
      discount_percent?: number;
      confirmation?: boolean;
      reason?: string;
    }
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/organizations/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update organization');
  },

  deleteOrganization: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/organizations/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete organization');
  },

  getOrganizationBillingDetails: async (orgId: string): Promise<unknown> => {
    const res = await fetch(`${API_URL}/superadmin/organizations/${orgId}/billing`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch organization billing details');
    return res.json();
  },

  // ==========================================
  // USER MANAGEMENT (SuperAdmin)
  // ==========================================

  getSuperAdminUsers: async (filters?: {
    organizationId?: string;
    role?: string;
    status?: string;
  }): Promise<User[]> => {
    const params = new URLSearchParams();
    if (filters?.organizationId) params.set('organizationId', filters.organizationId);
    if (filters?.role) params.set('role', filters.role);
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    const res = await fetch(`${API_URL}/superadmin/users${query ? `?${query}` : ''}`, {
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error('Failed to fetch users');
    if (Array.isArray(data)) return data as User[];
    if (data && typeof data === 'object' && Array.isArray((data as { users?: unknown }).users)) {
      return (data as { users: User[] }).users;
    }
    return [];
  },

  updateSuperAdminUser: async (
    id: string,
    updates: { organizationId?: string; role?: string; status?: string }
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update user');
  },

  createSuperAdminUser: async (user: Partial<User>): Promise<User> => {
    const res = await fetch(`${API_URL}/superadmin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(user),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create super admin');
    return data;
  },

  inviteUser: async (email: string, role: string, organizationId: string): Promise<unknown> => {
    const res = await fetch(`${API_URL}/superadmin/users/invite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, role, organizationId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to invite user');
    return data;
  },

  adminResetPassword: async (userId: string): Promise<{ resetLink: string; token: string }> => {
    const res = await fetch(`${API_URL}/superadmin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate reset link');
    return data;
  },

  impersonateUser: async (userId: string): Promise<{ user: User; token: string }> => {
    const res = await fetch(`${API_URL}/superadmin/impersonate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to impersonate user');
    return data;
  },

  // ==========================================
  // DATABASE MANAGEMENT (SuperAdmin)
  // ==========================================

  adminGetDatabaseTables: async (): Promise<string[]> => {
    const res = await fetch(`${API_URL}/superadmin/database/tables`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tables');
    return data;
  },

  adminGetTableRows: async (tableName: string): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/superadmin/database/rows/${tableName}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch rows');
    return data;
  },

  // ==========================================
  // STORAGE MANAGEMENT (SuperAdmin)
  // ==========================================

  adminGetStorageStats: async (): Promise<unknown> => {
    const res = await fetch(`${API_URL}/superadmin/storage/usage`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch storage stats');
    return data;
  },

  adminGetOrgFiles: async (orgId: string): Promise<unknown[]> => {
    const res = await fetch(`${API_URL}/superadmin/storage/files/${orgId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch files');
    return data;
  },

  adminDeleteFile: async (orgId: string, path: string): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/storage/files`, {
      method: 'DELETE',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orgId, path }),
    });
    if (!res.ok) throw new Error('Failed to delete file');
  },

  // ==========================================
  // INVOICES (SuperAdmin)
  // ==========================================

  getSuperAdminInvoices: async (
    period = '30d'
  ): Promise<{ invoices: unknown[]; total: number }> => {
    const res = await fetch(`${API_URL}/superadmin/invoices?period=${period}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch invoices');
    return res.json();
  },

  getSuperAdminInvoiceStats: async (): Promise<unknown> => {
    const res = await fetch(`${API_URL}/superadmin/invoices/stats`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch invoice stats');
    return res.json();
  },

  // ==========================================
  // ADMIN ALERTS
  // ==========================================

  getAdminAlerts: async (limit = 50): Promise<AdminAlert[]> => {
    const res = await fetch(`${API_URL}/admin-alerts?limit=${limit}`, { headers: getHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch admin alerts');
    return json.alerts;
  },

  createAdminAlert: async (alertConfig: Partial<AdminAlert>): Promise<AdminAlert> => {
    const res = await fetch(`${API_URL}/admin-alerts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(alertConfig),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create admin alert');
    return json.alert;
  },

  getAdminAlertHistory: async (limit = 50): Promise<AdminAlert[]> => {
    const res = await fetch(`${API_URL}/admin-alerts/history?limit=${limit}`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch alert history');
    return json.alerts;
  },

  // ==========================================
  // FEATURE UPDATES MANAGEMENT
  // ==========================================

  listFeatureUpdates: async (params?: {
    scope?: 'relevant' | FeatureUpdateScope;
    status?: FeatureUpdateStatus | 'all';
    organizationId?: string;
  }): Promise<FeatureUpdatesListResponse> => {
    const query = new URLSearchParams();
    if (params?.scope) query.set('scope', params.scope);
    if (params?.status) query.set('status', params.status);
    if (params?.organizationId) query.set('organizationId', params.organizationId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_URL}/updates/admin/list${suffix}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch feature updates');
    return {
      summary: data.summary,
      items: data.items,
    };
  },

  createFeatureUpdate: async (payload: ManagedFeatureUpdateInput): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/updates/admin/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create feature update');
    return { id: data.id };
  },

  updateFeatureUpdate: async (id: string, payload: ManagedFeatureUpdateInput): Promise<void> => {
    const res = await fetch(`${API_URL}/updates/admin/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update feature update');
  },

  publishFeatureUpdate: async (id: string): Promise<{ emailed: boolean }> => {
    const res = await fetch(`${API_URL}/updates/admin/${id}/publish`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to publish feature update');
    return { emailed: Boolean(data.emailed) };
  },

  archiveFeatureUpdate: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/updates/admin/${id}/archive`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to archive feature update');
  },

  // ==========================================
  // SYSTEM HEALTH
  // ==========================================

  checkSystemHealth: async (): Promise<{ status: string; latency: number }> => {
    const res = await fetch(`${API_URL}/health`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Health check failed');
    return data;
  },

  getSystemHealth: async (): Promise<unknown> => {
    const res = await fetchWithRetry(`${API_URL}/system-health`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch system health');
  },
};
