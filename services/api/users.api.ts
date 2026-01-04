/**
 * Users API Module
 * Enterprise SaaS Architecture - User Management
 */

import { User } from '../../types';
import { API_URL, fetchWithRetry, handleResponse, getHeaders, getAuthHeaders } from './baseClient';

export const UserApi = {
    // ==========================================
    // USER CRUD
    // ==========================================

    getUsers: async (): Promise<User[]> => {
        const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
        const data = await handleResponse(res, 'Failed to fetch users') as any;
        return (Array.isArray(data) ? data : ((data as any).users || [])) as User[];
    },

    getUser: async (id: string): Promise<User> => {
        const res = await fetch(`${API_URL}/users/${id}`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch user');
    },

    addUser: async (user: Partial<User>): Promise<User> => {
        const res = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(user)
        });
        return handleResponse(res, 'Failed to add user');
    },

    updateUser: async (id: string, updates: Partial<User>): Promise<void> => {
        const res = await fetch(`${API_URL}/users/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update user');
    },

    deleteUser: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete user');
    },

    // ==========================================
    // USER STATUS
    // ==========================================

    updateUserStatus: async (id: string, status: { availabilityStatus?: string; statusMessage?: string }): Promise<void> => {
        const res = await fetch(`${API_URL}/settings/profile/status`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ userId: id, ...status })
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to update user status');
        }
    },

    // ==========================================
    // AVATAR
    // ==========================================

    uploadAvatar: async (userId: string, file: File): Promise<{ avatarUrl: string }> => {
        const formData = new FormData();
        formData.append('avatar', file);

        const res = await fetch(`${API_URL}/users/${userId}/avatar`, {
            method: 'POST',
            headers: {
                'Authorization': getHeaders()['Authorization']
            },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload avatar');
        return data;
    },

    // ==========================================
    // REFERRALS
    // ==========================================

    getUserReferrals: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/referrals`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch referrals');
    },

    generateReferralCode: async (): Promise<{ code: string }> => {
        const res = await fetch(`${API_URL}/referrals/generate`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to generate referral code');
    },

    // ==========================================
    // ONBOARDING
    // ==========================================

    saveOnboardingContext: async (context: unknown): Promise<void> => {
        const res = await fetch(`${API_URL}/onboarding/context`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(context)
        });
        await handleResponse(res, 'Failed to save onboarding context');
    },

    generateFirstValuePlan: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/onboarding/generate-plan`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to generate plan');
    },

    // ==========================================
    // FEEDBACK
    // ==========================================

    sendFeedback: async (data: {
        user_id: string;
        type: string;
        message: string;
        screenshot?: string;
        url?: string
    }): Promise<void> => {
        const res = await fetch(`${API_URL}/feedback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to submit feedback');
    },

    getFeedback: async (): Promise<unknown[]> => {
        const res = await fetch(`${API_URL}/feedback`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch feedback');
        return res.json();
    },

    updateFeedbackStatus: async (id: string, status: string): Promise<void> => {
        const res = await fetch(`${API_URL}/feedback/${id}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Failed to update feedback status');
    },

    respondToFeedback: async (id: string, response: string): Promise<void> => {
        const res = await fetch(`${API_URL}/feedback/${id}/respond`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ response })
        });
        if (!res.ok) throw new Error('Failed to send response');
    },

    // ==========================================
    // CONTACT FORM
    // ==========================================

    submitContactForm: async (formData: {
        name: string;
        email: string;
        company?: string;
        subject: string;
        message: string
    }): Promise<void> => {
        const res = await fetch(`${API_URL}/legal/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Failed to submit contact form');
    }
};


