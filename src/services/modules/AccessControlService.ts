import { User } from '../../types';
import { API_URL, getHeaders, handleResponse } from '../apiUtils';

export const AccessControlService = {
  // Submit access request
  requestAccess: async (data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    organizationName: string;
    requestType?: string;
  }): Promise<{ success: boolean; requestId: string; message: string }> => {
    const res = await fetch(`${API_URL}/access-control/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to submit access request');
    return json;
  },

  // Verify access code (public)
  verifyAccessCode: async (
    code: string
  ): Promise<{
    valid: boolean;
    organizationName?: string;
    role?: string;
    reason?: string;
  }> => {
    const res = await fetch(`${API_URL}/access-control/codes/${code}/info`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to verify code');
    return json;
  },

  // Accept access code (auth required after registration)
  acceptAccessCode: async (
    code: string
  ): Promise<{ success: boolean; organization: { id: string; name: string } }> => {
    const res = await fetch(`${API_URL}/access-control/codes/${code}/accept`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to accept code');
    return json;
  },

  // Get current user's organizations
  getUserOrganizations: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/organizations/current`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch organizations');
  },

  // Admin: List access requests
  getAccessRequests: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/access-control/admin/requests`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch access requests');
  },

  // Admin: Approve access request
  approveAccessRequest: async (
    requestId: string,
    approvalData: { role?: string; message?: string }
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/access-control/admin/requests/${requestId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(approvalData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to approve request');
    return json;
  },

  // Admin: Reject access request
  rejectAccessRequest: async (requestId: string, reason: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/access-control/admin/requests/${requestId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to reject request');
    return json;
  },

  // Admin: Generate access codes
  generateAccessCode: async (codeData: {
    type: string;
    maxUses?: number;
    expiresAt?: string;
    targetEmail?: string;
  }): Promise<{ code: string; id: string }> => {
    const res = await fetch(`${API_URL}/access-control/admin/codes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(codeData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to generate code');
    return json;
  },
};
