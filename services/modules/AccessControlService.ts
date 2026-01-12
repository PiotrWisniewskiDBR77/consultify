import { AccessControlSchemas } from '../../schemas/accessControl.schema';
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
        // Validate payload using Zod schema
        AccessControlSchemas.RequestAccessPayloadSchema.parse(data);
        const res = await fetch(`${API_URL}/access-control/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to submit access request');
        // Validate response
        AccessControlSchemas.RequestAccessResponseSchema.parse(json);
        return json;
    },

    // Verify access code (public)
    verifyAccessCode: async (
        code: string,
    ): Promise<{
        valid: boolean;
        organizationName?: string;
        role?: string;
        reason?: string;
    }> => {
        const res = await fetch(`${API_URL}/access-control/codes/${code}/info`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to verify code');
        // Validate response
        AccessControlSchemas.VerifyAccessCodeResponseSchema.parse(json);
        return json;
    },

    // Register with access code
    registerWithCode: async (data: {
        code: string;
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string;
    }): Promise<{ success: boolean; user: User; message: string }> => {
        // Validate payload
        AccessControlSchemas.RegisterWithCodePayloadSchema.parse(data);
        const res = await fetch(`${API_URL}/access-control/codes/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Registration failed');
        // Validate response (basic shape)
        AccessControlSchemas.RegisterWithCodeResponseSchema.parse(json);
        return json;
    },

    // --- ACCESS CONTROL (Super Admin) ---
    getAccessRequests: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/superadmin/access-requests`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch access requests');
        return res.json();
    },

    approveAccessRequest: async (id: string, password?: string, role?: string): Promise<void> => {
        const res = await fetch(`${API_URL}/superadmin/access-requests/${id}/approve`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ password, role }),
        });
        if (!res.ok) throw new Error('Failed to approve request');
    },

    rejectAccessRequest: async (id: string, reason: string): Promise<void> => {
        const res = await fetch(`${API_URL}/superadmin/access-requests/${id}/reject`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ reason }),
        });
        if (!res.ok) throw new Error('Failed to reject request');
    },

    getAccessCodes: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/superadmin/access-codes`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch access codes');
        return res.json();
    },

    createAccessCode: async (data: {
        code?: string;
        role?: string;
        maxUses?: number;
        expiresAt?: string;
    }): Promise<any> => {
        // Validate payload (using AccessCodeSchema, allowing optional fields)
        AccessControlSchemas.AccessCodeSchema.partial().parse(data);
        const res = await fetch(`${API_URL}/superadmin/access-codes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create access code');
        const json = await res.json();
        // Validate response
        AccessControlSchemas.AccessCodeSchema.parse(json);
        return json;
    },

    deactivateAccessCode: async (codeId: string): Promise<void> => {
        const res = await fetch(`${API_URL}/superadmin/access-codes/${codeId}/deactivate`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to deactivate access code');
    },

    // Usage Stats by Organization
    getUsageByOrganization: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/superadmin/usage-by-org`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch usage stats');
        return res.json();
    },
};
