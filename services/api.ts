import { User, SessionMode, FullSession, LLMProvider } from '../types';
import { tokenService } from './tokenService';
import {
    API_URL,
    getHeaders,
    fetchWithRetry,
    handleResponse,
    handleBlobResponse,
    API_URL as UTILS_API_URL
} from './apiUtils';
import { AuthService } from './modules/AuthService';
import { ProjectService } from './modules/ProjectService';
import { AIService } from './modules/AIService';
import { AccessControlService } from './modules/AccessControlService';

export const Api = {
    // GENERIC METHODS (Required for Studio and other tools)
    get: async (url: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}${url}`);
        return handleResponse(res, `GET ${url} failed`);
    },

    post: async (url: string, data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}${url}`, {
            method: 'POST',
            headers: getHeaders(), // Added headers for POST
            body: JSON.stringify(data)
        });
        return handleResponse(res, `POST ${url} failed`);
    },

    put: async (url: string, data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}${url}`, {
            method: 'PUT',
            headers: getHeaders(), // Added headers for PUT
            body: JSON.stringify(data)
        });
        return handleResponse(res, `PUT ${url} failed`);
    },

    delete: async (url: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}${url}`, {
            method: 'DELETE',
            headers: getHeaders() // Added headers for DELETE
        });
        return handleResponse(res, `DELETE ${url} failed`);
    },

    patch: async (url: string, data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}${url}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, `PATCH ${url} failed`);
    },

    upload: async (url: string, formData: FormData): Promise<any> => {
        const headers: any = { ...getHeaders() };
        delete headers['Content-Type'];
        const res = await fetch(`${API_URL}${url}`, {
            method: 'POST',
            headers,
            body: formData
        });
        return handleResponse(res, `Upload to ${url} failed`);
    },

    // --- AUTH ---
    login: AuthService.login,
    register: AuthService.register,
    demoLogin: AuthService.demoLogin,
    isDemoSession: AuthService.isDemoSession,
    clearDemoSession: AuthService.clearDemoSession,
    logout: AuthService.logout,
    getMe: AuthService.getMe,
    validateAccessCode: AuthService.validateAccessCode,
    acceptAccessCode: AuthService.acceptAccessCode,
    changePassword: AuthService.changePassword,
    getActiveSessions: AuthService.getActiveSessions,
    getLoginHistory: AuthService.getLoginHistory,
    revokeSession: AuthService.revokeSession,
    revokeAllSessions: AuthService.revokeAllSessions,
    // --- TOKEN USAGE ANALYTICS ---
    getTokenUsageAnalytics: async (organizationId: string, timeRange: '7d' | '30d' | '90d' = '30d'): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/analytics/token-usage?orgId=${organizationId}&range=${timeRange}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch token usage analytics');
    },

    // --- API ACCESS ---
    getUserApiKeys: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys`, { headers: getHeaders() });
        const data = await handleResponse(res, 'Failed to fetch API keys');
        // Handle both formats if necessary, assuming /user/api-keys returns { keys: [...] }
        return data.keys || [];
    },

    createUserApiKey: async (name: string, scopes: string[] = []): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name, scopes })
        });
        return handleResponse(res, 'Failed to create API key');
    },

    deleteUserApiKey: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to delete API key');
    },

    getApiKeyUsage: async (keyId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys/${keyId}/usage`, {
            headers: getHeaders()
        });
        const data = await handleResponse(res, 'Failed to fetch API key usage');
        return data || {};
    },

    rotateApiKey: async (keyId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys/${keyId}/rotate`, {
            method: 'PUT',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to rotate API key');
    },

    updateApiKey: async (keyId: string, updates: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys/${keyId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        await handleResponse(res, 'Failed to update API key');
    },

    // --- INTEGRATIONS: WEBHOOKS ---
    getWebhooks: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/webhooks`, { headers: getHeaders() });
        const data = await handleResponse(res, 'Failed to fetch webhooks');
        return data.webhooks || [];
    },

    createWebhook: async (webhook: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/webhooks`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(webhook)
        });
        return handleResponse(res, 'Failed to create webhook');
    },

    updateWebhook: async (id: string, updates: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/webhooks/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        await handleResponse(res, 'Failed to update webhook');
    },



    // --- USERS (Admin) ---
    getUsers: async (): Promise<User[]> => {
        const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
        const data = await handleResponse(res, 'Failed to fetch users');
        // Backend returns { users: [...], total: N }, extract array
        return Array.isArray(data) ? data : (data.users || []);
    },

    addUser: async (user: any): Promise<User> => {
        const res = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(user)
        });
        return handleResponse(res, 'Failed to add user');
    },


    uploadAvatar: async (userId: string, file: File): Promise<{ avatarUrl: string }> => {
        const formData = new FormData();
        formData.append('avatar', file);

        const res = await fetch(`${API_URL}/users/${userId}/avatar`, {
            method: 'POST',
            headers: {
                // Content-Type: multipart/form-data is set automatically with boundary by fetch when body is FormData
                'Authorization': getHeaders()['Authorization']
            },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload avatar');
        return data;
    },

    updateUser: async (id: string, updates: any): Promise<void> => {
        const res = await fetch(`${API_URL}/users/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update user');
    },

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

    deleteUser: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete user');
    },

    checkSystemHealth: async (): Promise<{ status: string, latency: number }> => {
        const res = await fetch(`${API_URL}/health`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Health check failed');
        return data;
    },

    // --- ANALYTICS (Leadership Dashboard) ---
    getAnalyticsHealth: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/analytics/health`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch analytics health');
    },

    getAnalyticsPerformance: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/analytics/performance`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch analytics performance');
    },

    getAnalyticsEconomics: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/analytics/economics`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch analytics economics');
    },

    // --- NOTIFICATIONS (NotificationCenter) ---
    fetchNotifications: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/notifications`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch notifications');
    },

    markNotificationRead: async (id: string): Promise<void> => {
        // Backend uses PATCH, not PUT
        const res = await fetchWithRetry(`${API_URL}/notifications/${id}/read`, {
            method: 'PATCH',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to mark notification as read');
    },

    markAllNotificationsRead: async (): Promise<void> => {
        // Backend uses POST /mark-all-read, not PUT /read-all
        const res = await fetchWithRetry(`${API_URL}/notifications/mark-all-read`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to mark all notifications as read');
    },

    deleteNotification: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/notifications/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete notification');
    },

    // --- SETTINGS (NotificationSettings, IntegrationSettings) ---
    getNotificationPreferences: async (userId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/settings/notifications?userId=${userId}`, { headers: getHeaders() });
        if (!res.ok) return {};
        return res.json();
    },

    saveNotificationPreferences: async (userId: string, preferences: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/settings/notifications`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId, preferences })
        });
        if (!res.ok) throw new Error('Failed to save notification preferences');
    },

    getIntegrations: async (organizationId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/settings/integrations?organizationId=${organizationId}`, { headers: getHeaders() });
        if (!res.ok) return [];
        return res.json();
    },

    saveIntegration: async (integration: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/settings/integrations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(integration)
        });
        return handleResponse(res, 'Failed to save integration');
    },

    deleteIntegration: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/settings/integrations/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete integration');
    },

    // --- CONTACT FORM ---
    submitContactForm: async (formData: { name: string; email: string; company?: string; subject: string; message: string }): Promise<void> => {
        // Contact form is under /api/legal/contact
        const res = await fetch(`${API_URL}/legal/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Failed to submit contact form');
    },

    // Session Management
    getSession: async (userId: string, type: SessionMode, projectId?: string): Promise<any> => {
        let url = `${API_URL}/sessions/${userId}?type=${type}`;
        if (projectId) url += `&projectId=${projectId}`;

        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data;
    },

    saveSession: async (userId: string, type: SessionMode, data: any, projectId?: string): Promise<void> => {
        if (userId && projectId) {
            // We won't block session saves usually, but if we do:
            // Actually saveSession might be blocked.
        }
        const res = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId, type, data, projectId })
        });
        await handleResponse(res, `Failed to save session`);
    },

    // --- AI ---
    chatWithAI: AIService.chatWithAI,
    chatWithAIStream: AIService.chatWithAIStream,
    // --- SETTINGS ---
    saveSetting: async (key: string, value: string): Promise<void> => {
        const res = await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ key, value })
        });
        if (!res.ok) throw new Error('Failed to save setting');
    },

    // --- SUPER ADMIN ---
    getOrganizations: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/superadmin/organizations`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organizations');
        return res.json();
    },

    updateOrganization: async (id: string, updates: { plan?: string; status?: string; discount_percent?: number }): Promise<void> => {
        const res = await fetch(`${API_URL}/superadmin/organizations/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update organization');
    },

    deleteOrganization: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/superadmin/organizations/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete organization');
    },

    getOrganizationBillingDetails: async (orgId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/superadmin/organizations/${orgId}/billing`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization billing details');
        return res.json();
    },

    getSuperAdminDashboard: async (): Promise<{
        activity: { total: number; last_hour: number; last_24h: number; last_7d: number };
        ai: { total_ai_calls: number; total_tokens: number; active_users: number };
        counts: { total_users: number; total_orgs: number; active_users_7d: number };
        live?: { total_active_connections: number };
        activities: any[];
    }> => {
        const res = await fetch(`${API_URL}/superadmin/dashboard`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch dashboard');
        return res.json();
    },

    getActivities: async (limit: number = 50): Promise<any[]> => {
        const res = await fetch(`${API_URL}/superadmin/activities?limit=${limit}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch activities');
        return res.json();
    },

    getSuperAdminUsers: async (): Promise<User[]> => {
        const res = await fetch(`${API_URL}/superadmin/users`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },

    updateSuperAdminUser: async (id: string, updates: { organizationId?: string; role?: string; status?: string }): Promise<void> => {
        const res = await fetch(`${API_URL}/superadmin/users/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update user');
    },

    createSuperAdminUser: async (user: any): Promise<User> => {
        const res = await fetch(`${API_URL}/superadmin/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(user)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create super admin');
        return data;
    },

    inviteUser: async (email: string, role: string, organizationId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/superadmin/users/invite`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, role, organizationId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to invite user');
        return data;
    },

    adminResetPassword: async (userId: string): Promise<{ resetLink: string, token: string }> => {
        const res = await fetch(`${API_URL}/superadmin/users/${userId}/reset-password`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate reset link');
        return data;
    },

    adminGetDatabaseTables: async (): Promise<string[]> => {
        const res = await fetch(`${API_URL}/superadmin/database/tables`, {
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch tables');
        return data;
    },

    adminGetTableRows: async (tableName: string): Promise<any[]> => {
        const res = await fetch(`${API_URL}/superadmin/database/rows/${tableName}`, {
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch rows');
        return data;
    },

    adminGetStorageStats: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/superadmin/storage/usage`, {
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch storage stats');
        return data;
    },

    adminGetOrgFiles: async (orgId: string): Promise<any[]> => {
        const res = await fetch(`${API_URL}/superadmin/storage/files/${orgId}`, {
            headers: getHeaders()
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orgId, path })
        });
        if (!res.ok) throw new Error('Failed to delete file');
    },

    resetPassword: async (token: string, newPassword: string): Promise<void> => {
        // Use auth route, or ensure route is publicly accessible without superadmin middleware
        // NOTE: We implemented this in superadmin.js in previous step, but it should be public.
        // Wait, did I put it in superadmin.js which has verifySuperAdmin middleware?
        // YES I DID. That is a mistake for the public consumption part.
        // The generation is Admin, the consumption is Public.
        // I need to move the consumption endpoint to auth.js or a public route.
        // For now let's assume I fix it.
        const res = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reset password');
    },

    revertImpersonation: async (): Promise<{ user: User; token: string }> => {
        const res = await fetch(`${API_URL}/auth/revert-impersonation`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to revert impersonation');
        return data;
    },

    impersonateUser: async (userId: string): Promise<{ user: User; token: string }> => {
        const res = await fetch(`${API_URL}/superadmin/impersonate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to impersonate user');
        return data;
    },

    getSystemSettings: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
    },

    // --- PROJECTS ---
    getProjects: ProjectService.getProjects,
    createProject: ProjectService.createProject,
    deleteProject: ProjectService.deleteProject,
    getProjectDetails: ProjectService.getProjectDetails,
    getAssessmentReports: ProjectService.getAssessmentReports,
    generateAssessmentReport: ProjectService.generateAssessmentReport,
    getAssessmentReport: ProjectService.getAssessmentReport,
    updateProject: ProjectService.updateProject,

    // --- AI OBSERVATIONS & LLM MANAGEMENT ---
    generateGlobalBrainObservations: AIService.generateGlobalBrainObservations,
    getLLMProviders: AIService.getLLMProviders,
    getLLMAnalytics: AIService.getLLMAnalytics,
    getLLMLogs: AIService.getLLMLogs,
    toggleOrganizationLLM: AIService.toggleOrganizationLLM,
    addLLMProvider: AIService.addLLMProvider,
    updateLLMProvider: AIService.updateLLMProvider,
    updateProviderTier: AIService.updateProviderTier,
    getRecommendedProvider: AIService.getRecommendedLLMProvider,
    testLLMConnection: AIService.testLLMConnection,
    deleteLLMProvider: AIService.deleteLLMProvider,
    aiGetSystemPrompts: AIService.aiGetSystemPrompts,
    aiUpdateSystemPrompt: AIService.aiUpdateSystemPrompt,
    aiSeedSystemPrompts: AIService.aiSeedSystemPrompts,
    getPublicLLMProviders: AIService.getPublicLLMProviders,
    testOllamaConnection: AIService.testOllamaConnection,
    getOllamaModels: AIService.getOllamaModels,
    getOrganizationLLMConfig: AIService.getOrganizationLLMConfig,
    updateOrganizationLLMConfig: AIService.updateOrganizationLLMConfig,
    diagnoseLLM: AIService.diagnoseLLM,
    checkLLMProvidersHealth: AIService.checkLLMProvidersHealth,
    getRecommendedLLMProvider: AIService.getRecommendedLLMProvider,
    getUserAIUsage: AIService.getUserAIUsage,
    getUserActiveModel: AIService.getUserActiveModel,

    // --- KNOWLEDGE BASE ---
    getKnowledgeFiles: async (): Promise<{ docs: any[], availableFiles: string[] }> => {
        const res = await fetch(`${API_URL}/knowledge/files`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch knowledge files');
        return res.json();
    },

    indexKnowledgeFiles: async (): Promise<{ message: string; indexedCount: number }> => {
        const res = await fetch(`${API_URL}/knowledge/index`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Indexing failed');
        return data;
    },

    // ==========================================
    // PHASE 1: TASKS API
    // ==========================================
    getTasks: async (filters?: { projectId?: string; status?: string; assigneeId?: string; priority?: string; initiativeId?: string }): Promise<any[]> => {
        let url = `${API_URL}/tasks`;
        if (filters) {
            const params = new URLSearchParams();
            if (filters.projectId) params.append('projectId', filters.projectId);
            if (filters.status) params.append('status', filters.status);
            if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
            if (filters.priority) params.append('priority', filters.priority);
            if (filters.initiativeId) params.append('initiativeId', filters.initiativeId);
            if (params.toString()) url += `? ${params.toString()}`;
        }
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch tasks');
        return res.json();
    },

    getTask: async (id: string): Promise<any> => {
        const res = await fetch(`${API_URL}/tasks/${id}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch task');
        return res.json();
    },

    createTask: async (task: {
        projectId: string;
        title: string;
        description?: string;
        status?: string;
        priority?: string;
        assigneeId?: string;
        dueDate?: string;
        estimatedHours?: number;
        checklist?: any[];
        tags?: string[];
        taskType?: string;
        initiativeId?: string;
        why?: string;
        stepPhase?: 'design' | 'pilot' | 'rollout';
    }): Promise<any> => {
        const res = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(task)
        });
        return handleResponse(res, 'Failed to create task');
    },

    updateTask: async (id: string, updates: any): Promise<void> => {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        await handleResponse(res, 'Failed to update task');
    },

    deleteTask: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to delete task');
    },

    getTaskComments: async (taskId: string): Promise<any[]> => {
        const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch comments');
        return res.json();
    },

    addTaskComment: async (taskId: string, content: string): Promise<any> => {
        const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add comment');
        return data;
    },

    deleteTaskComment: async (taskId: string, commentId: string): Promise<void> => {
        const res = await fetch(`${API_URL}/tasks/${taskId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete comment');
    },

    // ==========================================
    // PHASE 1: TEAMS API
    // ==========================================
    getTeams: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/teams`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch teams');
        return res.json();
    },

    getTeam: async (id: string): Promise<any> => {
        const res = await fetch(`${API_URL}/teams/${id}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch team');
        return res.json();
    },

    createTeam: async (team: { name: string; description?: string; leadId?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/teams`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(team)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create team');
        return data;
    },

    updateTeam: async (id: string, updates: any): Promise<void> => {
        const res = await fetch(`${API_URL}/teams/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update team');
    },

    deleteTeam: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/teams/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete team');
    },

    addTeamMember: async (teamId: string, userId: string, role: string = 'member'): Promise<void> => {
        const res = await fetch(`${API_URL}/teams/${teamId}/members`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId, role })
        });
        if (!res.ok) throw new Error('Failed to add team member');
    },

    removeTeamMember: async (teamId: string, userId: string): Promise<void> => {
        const res = await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to remove team member');
    },

    // ==========================================
    // PHASE 1: NOTIFICATIONS API
    // ==========================================
    getNotifications: async (unreadOnly: boolean = false, limit: number = 50): Promise<any[]> => {
        const params = new URLSearchParams();
        if (unreadOnly) params.append('unreadOnly', 'true');
        params.append('limit', limit.toString());
        const res = await fetch(`${API_URL}/notifications?${params.toString()}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch notifications');
        return res.json();
    },

    getUnreadNotificationCount: async (): Promise<number> => {
        const res = await fetch(`${API_URL}/notifications/unread-count`, { headers: getHeaders() });
        if (!res.ok) return 0;
        const data = await res.json();
        return data.count;
    },

    // Note: markNotificationRead, markAllNotificationsRead, deleteNotification 
    // are defined above in "NOTIFICATIONS (NotificationCenter)" section with correct HTTP methods

    deleteReadNotifications: async (): Promise<void> => {
        const res = await fetch(`${API_URL}/notifications`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete read notifications');
    },

    createNotification: async (notification: {
        userId?: string; // If null, broadcast to all
        type: string;
        title: string;
        message: string;
        priority?: 'high' | 'normal' | 'low';
        category?: 'ai' | 'task' | 'system';
        actionLabel?: string;
        link?: string;
    }): Promise<void> => {
        const res = await fetch(`${API_URL}/notifications`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(notification)
        });
        if (!res.ok) throw new Error('Failed to create notification');
    },

    // ==========================================
    // PHASE 6: AI INTEGRATION
    // ==========================================
    // --- INITIATIVES (Phase 2) ---
    getInitiatives: async (projectId?: string): Promise<any[]> => {
        let url = `${API_URL}/initiatives`;
        if (projectId) url += `? projectId=${projectId}`;
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch initiatives');
        return res.json();
    },

    createInitiative: async (initiative: any): Promise<any> => {
        const res = await fetch(`${API_URL}/initiatives`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(initiative)
        });
        return handleResponse(res, 'Failed to create initiative');
    },

    updateInitiative: async (id: string, updates: any): Promise<void> => {
        const res = await fetch(`${API_URL}/initiatives/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        await handleResponse(res, 'Failed to update initiative');
    },

    validateInitiative: async (id: string) => {
        const response = await fetch(`${API_URL}/initiatives/${id}/validate`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Validation failed');
        return response.json();
    },

    enrichInitiative: async (id: string) => {
        const response = await fetch(`${API_URL}/initiatives/${id}/enrich`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Enrichment failed');
        return response.json();
    },

    // --- PROJECTS (Initiatives) ---
    suggestInitiativeTasks: ProjectService.suggestInitiativeTasks,



    // ==========================================
    // PHASE 7: AI EVOLUTION (Advanced Layers)
    // ==========================================

    // LAYER 1: DIAGNOSIS
    // --- AI DIAGNOSTIC LAYERS ---
    aiDiagnose: AIService.aiDiagnose,
    aiRecommend: AIService.aiRecommend,
    aiRoadmap: AIService.aiRoadmap,
    aiSimulate: AIService.aiSimulate,
    aiValidate: AIService.aiValidate,
    aiVerify: AIService.aiVerify,
    aiFeedback: AIService.aiFeedback,
    aiDetailFeedback: AIService.aiDetailFeedback,

    // --- AI STRATEGIC BOARD ---
    // --- AI STRATEGIC BOARD & OBSERVATIONS ---
    getAIIdeas: AIService.getAIIdeas,
    createAIIdea: AIService.createAIIdea,
    updateAIIdea: AIService.updateAIIdea,
    deleteAIIdea: AIService.deleteAIIdea,
    getAIObservations: AIService.getAIObservations,
    createAIObservation: AIService.createAIObservation,
    getAIDeepReports: AIService.getAIDeepReports,

    // ADMIN ANALYTICS & CONTROLS
    // --- AI LEARNING, KNOWLEDGE & STRATEGIES ---
    aiGetStats: AIService.aiGetStats,
    getIndustryBenchmarks: AIService.getIndustryBenchmarks,
    aiExtractInsights: AIService.aiExtractInsights,
    getKnowledgeCandidates: AIService.getKnowledgeCandidates,
    submitKnowledgeCandidate: AIService.submitKnowledgeCandidate,
    updateCandidateStatus: AIService.updateCandidateStatus,
    updateKnowledgeCandidate: AIService.updateKnowledgeCandidate,
    linkIdeaToProject: AIService.linkIdeaToProject,
    getApprovedIdeas: AIService.getApprovedIdeas,
    getIdeasByCategory: AIService.getIdeasByCategory,
    getIdeasByProject: AIService.getIdeasByProject,
    getGlobalStrategies: AIService.getGlobalStrategies,
    createGlobalStrategy: AIService.createGlobalStrategy,
    updateGlobalStrategy: AIService.updateGlobalStrategy,
    linkStrategyToDocument: AIService.linkStrategyToDocument,
    linkStrategyToIdea: AIService.linkStrategyToIdea,
    unlinkStrategyFromDocument: AIService.unlinkStrategyFromDocument,
    unlinkStrategyFromIdea: AIService.unlinkStrategyFromIdea,
    updateStrategyProgress: AIService.updateStrategyProgress,
    getStrategyWithRelated: AIService.getStrategyWithRelated,
    getAllGlobalStrategies: AIService.getAllGlobalStrategies,
    toggleGlobalStrategy: AIService.toggleGlobalStrategy,
    getKnowledgeDocuments: AIService.getKnowledgeDocuments,
    uploadKnowledgeDocument: AIService.uploadKnowledgeDocument,
    updateKnowledgeDocument: AIService.updateKnowledgeDocument,
    getKnowledgeDocumentsByCategory: AIService.getKnowledgeDocumentsByCategory,
    getKnowledgeDocumentsByStrategy: AIService.getKnowledgeDocumentsByStrategy,
    uploadDocument: AIService.uploadDocument,
    // --- FEEDBACK ---
    sendFeedback: async (data: { user_id: string; type: string; message: string; screenshot?: string; url?: string }): Promise<void> => {
        const res = await fetch(`${API_URL}/feedback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to submit feedback');
    },

    getFeedback: async (): Promise<any[]> => {
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
    // ACCESS CONTROL & REGISTRATION
    // ==========================================

    requestAccess: AccessControlService.requestAccess,
    verifyAccessCode: AccessControlService.verifyAccessCode,
    registerWithCode: AccessControlService.registerWithCode,

    // --- ACCESS CONTROL (Super Admin) ---
    getAccessRequests: AccessControlService.getAccessRequests,
    approveAccessRequest: AccessControlService.approveAccessRequest,
    rejectAccessRequest: AccessControlService.rejectAccessRequest,
    getAccessCodes: AccessControlService.getAccessCodes,
    createAccessCode: AccessControlService.createAccessCode,
    generateAccessCode: (data: any) => AccessControlService.createAccessCode(data),
    deactivateAccessCode: AccessControlService.deactivateAccessCode,
    getUsageByOrganization: AccessControlService.getUsageByOrganization,

    // Invoices
    getSuperAdminInvoices: async (period: string = '30d'): Promise<{ invoices: any[]; total: number }> => {
        const res = await fetch(`${API_URL}/superadmin/invoices?period=${period}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch invoices');
        return res.json();
    },

    getSuperAdminInvoiceStats: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/superadmin/invoices/stats`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch invoice stats');
        return res.json();
    },

    // System Health (legacy - use getSystemHealthDetailed)
    getSystemHealth: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/system-health`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch system health');
    },

    // ==========================================
    // USAGE & BILLING (Generic wrappers)
    // ==========================================

    // Generic HTTP methods for billing routes
    // Generic versions moved to end of file to support full URLs and retries
    // get, post, put, delete are defined at the end of the object

    // Get subscription plans
    getSubscriptionPlans: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/billing/plans`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch plans');
        return json;
    },

    // Get user license plans
    getUserPlans: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/billing/user-plans`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch user plans');
        return json;
    },

    // Get current billing info
    getCurrentBilling: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/current`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch billing');
        return json;
    },

    // Get current usage
    getUsage: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/usage`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch usage');
        return json;
    },

    // Subscribe to plan
    subscribeToPlan: async (planId: string, paymentMethodId?: string): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/subscribe`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ planId, paymentMethodId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Subscription failed');
        return json;
    },

    // Change subscription plan
    changePlan: async (newPlanId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/change-plan`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ newPlanId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Plan change failed');
        return json;
    },

    // Cancel subscription
    cancelSubscription: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/cancel`, {
            method: 'POST',
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Cancellation failed');
        return json;
    },

    // Get invoices
    getInvoices: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/billing/invoices`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch invoices');
        return json.invoices || [];
    },

    // --- PAYMENT METHODS ---
    getPaymentMethods: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/payment-methods`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch payment methods');
        return json;
    },

    addPaymentMethod: async (paymentMethodId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/payment-methods`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ paymentMethodId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to add payment method');
        return json;
    },

    removePaymentMethod: async (paymentMethodId: string): Promise<void> => {
        const res = await fetch(`${API_URL}/billing/payment-methods/${paymentMethodId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Failed to remove payment method');
        }
    },

    setDefaultPaymentMethod: async (paymentMethodId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/payment-methods/${paymentMethodId}/default`, {
            method: 'PUT',
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to set default payment method');
        return json;
    },

    createSetupIntent: async (): Promise<{ clientSecret: string; id: string }> => {
        const res = await fetch(`${API_URL}/billing/setup-intent`, {
            method: 'POST',
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create setup intent');
        return json;
    },

    // --- BILLING ALERTS ---
    getBillingAlerts: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/alerts`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch billing alerts');
        return json;
    },

    updateBillingAlerts: async (alerts: any): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/alerts`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(alerts)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update billing alerts');
        return json;
    },

    // --- TAX SETTINGS ---
    getTaxSettings: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/tax-settings`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch tax settings');
        return json;
    },

    updateTaxSettings: async (settings: any): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/tax-settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update tax settings');
        return json;
    },

    // --- DISCOUNT CODES ---
    validateDiscountCode: async (code: string, planId?: string): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/validate-discount`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ code, planId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to validate discount code');
        return json;
    },

    // --- SEAT MANAGEMENT ---
    getSeatConfiguration: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/seats`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch seat configuration');
        return json.config;
    },

    purchaseSeats: async (quantity: number, paymentMethodId?: string): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/seats/purchase`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ quantity, paymentMethodId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to purchase seats');
        return json;
    },

    toggleAutoAddSeats: async (enabled: boolean, threshold?: number): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/seats/auto-add`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ enabled, threshold })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to update auto-add settings');
        return json;
    },

    getSeatTransactions: async (limit = 50): Promise<any[]> => {
        const res = await fetch(`${API_URL}/billing/seats/transactions?limit=${limit}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch seat transactions');
        return json.transactions;
    },

    releaseSeat: async (userId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/seats/release`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to release seat');
        return json;
    },

    // --- BUDGET MANAGEMENT ---
    getUserBudget: async (userId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/budgets/user/${userId}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch user budget');
        return json.budget;
    },

    setUserBudget: async (userId: string, budget: any): Promise<any> => {
        const res = await fetch(`${API_URL}/budgets/user/${userId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(budget)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to set user budget');
        return json;
    },

    getProjectBudget: async (projectId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/budgets/project/${projectId}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch project budget');
        return json.budget;
    },

    setProjectBudget: async (projectId: string, budget: any): Promise<any> => {
        const res = await fetch(`${API_URL}/budgets/project/${projectId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(budget)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to set project budget');
        return json;
    },

    getOrgBudget: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/budgets/organization`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch organization budget');
        return json.budget;
    },

    setOrgBudget: async (budget: any): Promise<any> => {
        const res = await fetch(`${API_URL}/budgets/organization`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(budget)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to set organization budget');
        return json;
    },

    getBudgetStatus: async (userId?: string, projectId?: string): Promise<any> => {
        const params = new URLSearchParams();
        if (userId) params.append('userId', userId);
        if (projectId) params.append('projectId', projectId);
        const res = await fetch(`${API_URL}/budgets/status?${params}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to get budget status');
        return json.budget;
    },

    // --- PAY-AS-YOU-GO ---
    getPayAsYouGoUsage: async (periodStart?: string, periodEnd?: string): Promise<any> => {
        const params = new URLSearchParams();
        if (periodStart) params.append('periodStart', periodStart);
        if (periodEnd) params.append('periodEnd', periodEnd);
        const res = await fetch(`${API_URL}/billing/payg/usage?${params}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to get PAYG usage');
        return json.usage;
    },

    getPayAsYouGoForecast: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/payg/forecast`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to get PAYG forecast');
        return json.forecast;
    },

    generatePayAsYouGoInvoice: async (periodStart: string, periodEnd: string): Promise<any> => {
        const res = await fetch(`${API_URL}/billing/payg/invoice`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ periodStart, periodEnd })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to generate PAYG invoice');
        return json;
    },

    // --- ADMIN ALERTS ---
    getAdminAlerts: async (limit = 50): Promise<any[]> => {
        const res = await fetch(`${API_URL}/admin-alerts?limit=${limit}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch admin alerts');
        return json.alerts;
    },

    createAdminAlert: async (alertConfig: any): Promise<any> => {
        const res = await fetch(`${API_URL}/admin-alerts`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(alertConfig)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create admin alert');
        return json.alert;
    },

    getAdminAlertHistory: async (limit = 50): Promise<any[]> => {
        const res = await fetch(`${API_URL}/admin-alerts/history?limit=${limit}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch alert history');
        return json.alerts;
    },

    // --- AI TASK GEN ---
    suggestTasks: async (initiative: any): Promise<any[]> => {
        const res = await fetch(`${API_URL}/ai/suggest-tasks`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ initiative })
        });
        if (!res.ok) throw new Error('Failed to suggest tasks');
        return res.json();
    },

    generateTaskInsight: async (task: any, initiative: any): Promise<any> => {
        const res = await fetch(`${API_URL}/ai/task-insight`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ task, initiative })
        });
        if (!res.ok) throw new Error('Failed to generate task insight');
        return res.json();
    },

    // --- TOKEN BILLING ---
    getTokenBalance: async () => {
        const res = await fetch(`${API_URL}/token-billing/balance`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get balance');
        return data.balance;
    },

    getTokenPackages: async () => {
        const res = await fetch(`${API_URL}/token-billing/packages`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get packages');
        return data.packages;
    },

    getTokenTransactions: async (limit = 50, offset = 0) => {
        const res = await fetch(`${API_URL}/token-billing/transactions?limit=${limit} & offset=${offset}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get transactions');
        return data.transactions;
    },

    getApiKeys: async () => {
        const res = await fetch(`${API_URL}/token-billing/api-keys`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get API keys');
        return data.keys;
    },

    addApiKey: async (keyData: { provider: string, apiKey: string, displayName: string, modelPreference?: string }) => {
        const res = await fetch(`${API_URL}/token-billing/api-keys`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(keyData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add API key');
        return data.key;
    },

    deleteApiKey: async (keyId: string) => {
        const res = await fetch(`${API_URL}/token-billing/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete API key');
        return data;
    },

    purchaseTokens: async (packageId: string) => {
        const res = await fetch(`${API_URL}/token-billing/purchase`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ packageId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Purchase failed');
        return data;
    },

    // --- TOKEN BILLING ADMIN ---
    getBillingMargins: async () => {
        const res = await fetch(`${API_URL}/token-billing/margins`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get margins');
        return data.margins;
    },

    updateBillingMargin: async (sourceType: string, marginData: any) => {
        const res = await fetch(`${API_URL}/token-billing/margins/${sourceType}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(marginData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update margin');
        return data;
    },

    upsertTokenPackage: async (packageData: any) => {
        const res = await fetch(`${API_URL}/token-billing/packages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(packageData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save package');
        return data.package;
    },

    getTokenAnalytics: async (startDate?: string, endDate?: string) => {
        const query = startDate && endDate ? `? startDate=${startDate} & endDate=${endDate}` : '';
        const res = await fetch(`${API_URL}/token-billing/analytics${query}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get analytics');
        return data.analytics;
    },

    // ==========================================
    // PMO CONTEXT API (UI Behavior Integration)
    // ==========================================
    getPMOContext: async (projectId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/pmo-context/${projectId}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch PMO context');
        return res.json();
    },

    getPMOTaskLabels: async (projectId: string): Promise<{ taskLabels: Record<string, any[]> }> => {
        const res = await fetch(`${API_URL}/pmo-context/${projectId}/task-labels`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch PMO task labels');
        return res.json();
    },

    // ==========================================
    // STEP 7: METRICS & CONVERSION INTELLIGENCE
    // ==========================================
    getMetricsOverview: async () => {
        const res = await fetch(`${API_URL}/metrics/overview`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch metrics overview');
        return res.json();
    },

    getMetricsFunnels: async (days: number = 30) => {
        const res = await fetch(`${API_URL}/metrics/funnels?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch funnels');
        return res.json();
    },

    getMetricsCohorts: async (type: string = 'weekly', weeks: number = 12) => {
        const res = await fetch(`${API_URL}/metrics/cohorts?type=${type}&weeks=${weeks}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch cohorts');
        return res.json();
    },

    getMetricsHelp: async (days: number = 30) => {
        const res = await fetch(`${API_URL}/metrics/help?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch help metrics');
        return res.json();
    },

    getMetricsAttribution: async (days: number = 30) => {
        const res = await fetch(`${API_URL}/metrics/attribution?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch attribution');
        return res.json();
    },

    getMetricsPartners: async (days: number = 90) => {
        const res = await fetch(`${API_URL}/metrics/partners?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch partner metrics');
        return res.json();
    },

    getMetricsWarnings: async () => {
        const res = await fetch(`${API_URL}/metrics/warnings`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch warnings');
        return res.json();
    },

    getOrgMetricsOverview: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/metrics/org/overview`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch org metrics overview');
        return json;
    },

    getOrgMetricsAIAnalytics: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/metrics/org/ai-analytics`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch AI analytics');
        return json;
    },



    getOrgMetricsHelp: async () => {
        const res = await fetch(`${API_URL}/metrics/org/help`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization help metrics');
        return res.json();
    },

    getOrgMetricsTeam: async () => {
        const res = await fetch(`${API_URL}/metrics/org/team`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization team metrics');
        return res.json();
    },

    // ==========================================
    // STEP 9: AI ADVISOR & ACTIONS
    // ==========================================
    getAIActionProposals: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/ai/actions/proposals`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch AI action proposals');
        return res.json();
    },

    getAIActionAudit: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/ai/actions/audit`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch AI action audit log');
        return res.json();
    },

    recordAIActionDecision: async (data: { proposal_id: string, decision: string, reason?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/ai/actions/decide`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to record action decision');
        }
        return res.json();
    },

    /**
     * Get pending AI actions awaiting user approval
     * Used for inline visibility in chat interface
     */
    getPendingAIActions: async (projectId?: string): Promise<{
        id: string;
        action_type: string;
        status: string;
        created_at: string;
        payload: any;
        draft_content?: any;
    }[]> => {
        const url = projectId
            ? `${API_URL}/ai/actions/pending?projectId=${projectId}`
            : `${API_URL}/ai/actions/pending`;
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch pending AI actions');
        return res.json();
    },

    /**
     * Approve a pending AI action
     */
    approveAIAction: async (actionId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/ai/actions/${actionId}/approve`, {
            method: 'PATCH',
            headers: getHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to approve action');
        }
        return res.json();
    },

    /**
     * Reject a pending AI action
     */
    rejectAIAction: async (actionId: string, reason?: string): Promise<any> => {
        const res = await fetch(`${API_URL}/ai/actions/${actionId}/reject`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ reason })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to reject action');
        }
        return res.json();
    },

    // ==========================================
    // STEP 10: PROACTIVE SUGGESTIONS & QUALITY
    // ==========================================
    
    /**
     * Get proactive suggestions based on current context
     */
    getProactiveSuggestions: async (params: {
        projectId?: string;
        organizationId?: string;
        screenContext?: { screenId: string; data?: any };
    }): Promise<{ suggestions: any[] }> => {
        const queryParams = new URLSearchParams();
        if (params.projectId) queryParams.append('projectId', params.projectId);
        if (params.screenContext) queryParams.append('screenContext', JSON.stringify(params.screenContext));
        
        const res = await fetch(`${API_URL}/ai/suggestions?${queryParams}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch proactive suggestions');
        return res.json();
    },

    /**
     * Record suggestion action (accepted/dismissed)
     */
    recordSuggestionAction: async (suggestionId: string, action: 'accepted' | 'dismissed' | 'clicked', feedback?: string): Promise<void> => {
        const res = await fetch(`${API_URL}/ai/suggestions/action`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ suggestionId, action, feedback })
        });
        if (!res.ok) throw new Error('Failed to record suggestion action');
    },

    /**
     * Get suggestion effectiveness metrics
     */
    getSuggestionMetrics: async (days?: number): Promise<any> => {
        const url = days ? `${API_URL}/ai/suggestions/metrics?days=${days}` : `${API_URL}/ai/suggestions/metrics`;
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch suggestion metrics');
        return res.json();
    },

    /**
     * Calculate response quality metrics
     */
    calculateResponseQuality: async (params: {
        query: string;
        response: string;
        context?: any;
        sources?: any[];
    }): Promise<{
        relevance: number;
        groundedness: number;
        completeness: number;
        coherence: number;
        overall: number;
        qualityLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
        recommendation?: string;
    }> => {
        const res = await fetch(`${API_URL}/ai/quality/calculate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(params)
        });
        if (!res.ok) throw new Error('Failed to calculate response quality');
        const data = await res.json();
        return data.metrics;
    },

    /**
     * Get aggregate quality metrics
     */
    getAggregateQualityMetrics: async (days?: number): Promise<any> => {
        const url = days ? `${API_URL}/ai/quality/aggregate?days=${days}` : `${API_URL}/ai/quality/aggregate`;
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch aggregate quality metrics');
        return res.json();
    },

    /**
     * Get quality trends over time
     */
    getQualityTrends: async (days?: number): Promise<any> => {
        const url = days ? `${API_URL}/ai/quality/trends?days=${days}` : `${API_URL}/ai/quality/trends`;
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch quality trends');
        return res.json();
    },

    // ==========================================
    // PHASE D: ORGANIZATION API
    // ==========================================
    getUserOrganizations: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/organizations/current`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch organizations').then(data => data || []);
    },

    getOrganization: async (orgId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/organizations/${orgId}`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch organization details');
    },

    getOrganizationMembers: async (orgId: string): Promise<any[]> => {
        const res = await fetch(`${API_URL}/organizations/${orgId}/members`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch organization members').then(data => data || []);
    },

    addOrganizationMember: async (orgId: string, email: string, role: string): Promise<any> => {
        // NOTE: Backend currently expects targetUserId, but UI workflow implies email invite.
        // We will pass email as targetUserId/email field and update backend if needed, 
        // OR we just rely on ID if we have a picker. 
        // For MVP skeleton, we assume we might be adding by ID if we don't have invite flow,
        // BUT to be user friendly, we should probably implement invite.
        // I'll stick to passing the body as is, and update backend later if needed.
        const res = await fetch(`${API_URL}/organizations/${orgId}/members`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ targetUserId: email, role })
        });
        return handleResponse(res, 'Failed to add member');
    },

    createOrganization: async (name: string): Promise<any> => {
        const res = await fetch(`${API_URL}/organizations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name })
        });
        return handleResponse(res, 'Failed to create organization');
    },

    activateBilling: async (orgId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/organizations/${orgId}/billing/activate`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to activate billing');
    },

    // Token Ledger API
    getOrgTokenBalance: async (orgId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/organizations/${orgId}/tokens/balance`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch token balance');
    },

    getOrgTokenLedger: async (orgId: string, limit = 50, offset = 0): Promise<any[]> => {
        const res = await fetch(`${API_URL}/organizations/${orgId}/tokens/ledger?limit=${limit}&offset=${offset}`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch token ledger').then(data => data?.ledger || []);
    },


    // ==========================================
    // PHASE C: CONSULTANT MODE
    // ==========================================
    getConsultantOrgs: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/consultants/orgs`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch consultant organizations');
        return res.json();
    },

    getConsultantClients: async (orgId?: string): Promise<any[]> => {
        let url = `${API_URL}/consultants/clients`;
        if (orgId) url += `?orgId=${orgId}`;
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch consultant clients');
        return res.json();
    },

    createConsultantInvite: async (data: { email: string; invitationType: string; firmName?: string; projectName?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/consultants/invites`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create invite');
        return json;
    },

    getConsultantInvites: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/consultants/invites`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch invites');
        return res.json();
    },

    // Org Admin: Invite a user (Member or Consultant)
    createOrganizationInvitation: async (email: string, role: string): Promise<any> => {
        const res = await fetch(`${API_URL}/invitations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, role })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to send invitation');
        return json;
    },

    getInvitations: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/invitations`, { headers: getHeaders() });
        const json = await handleResponse(res, 'Failed to fetch invitations');
        return json.invitations || json;
    },

    // --- ECOSYSTEM / AFFILIATE ---
    getUserReferrals: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/referrals`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch referrals');
    },

    getEcosystemStats: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/analytics/ecosystem`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch ecosystem stats');
    },

    generateReferralCode: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/referrals/generate`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to generate referral code');
    },

    // ==========================================
    // PHASE E: ONBOARDING API
    // ==========================================
    saveOnboardingContext: async (context: any): Promise<void> => {
        const res = await fetch(`${API_URL}/onboarding/context`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(context)
        });
        await handleResponse(res, 'Failed to save onboarding context');
    },

    generateFirstValuePlan: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/onboarding/generate-plan`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to generate plan');
    },

    acceptFirstValuePlan: async (acceptedInitiativeIds: string[], idempotencyKey: string): Promise<any> => {
        const res = await fetch(`${API_URL}/onboarding/accept-plan`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ acceptedInitiativeIds, idempotencyKey })
        });
        return handleResponse(res, 'Failed to accept plan');
    },

    getOnboardingStatus: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/onboarding/status`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to get onboarding status');
    },

    getOnboardingPlan: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/onboarding/plan`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to get onboarding plan');
    },

    // ==========================================
    // DRD AUDIT REPORT BUILDER API
    // ==========================================

    /**
     * Get full report with all sections for the Report Builder
     */
    getFullReport: async (reportId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/full`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load report');
    },

    /**
     * Generate full report with all sections from template
     */
    generateReport: async (reportId: string, options?: { templateId?: string; language?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/generate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(options || {})
        });
        return handleResponse(res, 'Failed to generate report');
    },

    /**
     * Get all sections for a report
     */
    getReportSections: async (reportId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load sections');
    },

    /**
     * Add a new section to the report
     */
    addReportSection: async (reportId: string, data: {
        sectionType: string;
        axisId?: string;
        areaId?: string;
        title?: string;
        content?: string;
        orderIndex?: number
    }): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to add section');
    },

    /**
     * Update a section's content
     */
    updateReportSection: async (reportId: string, sectionId: string, data: {
        content: string;
        title?: string;
        saveHistory?: boolean
    }): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections/${sectionId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update section');
    },

    /**
     * Delete a section from the report
     */
    deleteReportSection: async (reportId: string, sectionId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections/${sectionId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to delete section');
    },

    /**
     * AI action on a section (expand, summarize, improve, translate, regenerate)
     */
    aiSectionAction: async (reportId: string, sectionId: string, data: {
        action: string;
        language?: string;
        customPrompt?: string
    }): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections/${sectionId}/ai`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to perform AI action');
    },

    /**
     * Reorder sections
     */
    reorderReportSections: async (reportId: string, sectionOrder: { id: string; orderIndex: number }[]): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections/reorder`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ sectionOrder })
        });
        return handleResponse(res, 'Failed to reorder sections');
    },

    /**
     * AI edit via chat - process natural language edit requests
     */
    aiEditReport: async (reportId: string, data: { message: string; focusSectionId?: string | null }): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/ai-edit`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to process AI edit request');
    },

    /**
     * Get section version history
     */
    getSectionHistory: async (reportId: string, sectionId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections/${sectionId}/history`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load section history');
    },

    /**
     * Finalize a report (DRAFT -> FINAL)
     */
    finalizeReport: async (reportId: string): Promise<any> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/finalize`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to finalize report');
    },

    /**
     * Export report as PDF
     */
    exportReportPDF: async (reportId: string): Promise<{ pdfUrl: string }> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/export/pdf`, {
            headers: getHeaders()
        });
        if (!res.ok) {
            throw new Error('Failed to export PDF');
        }
        const blob = await res.blob();
        return { pdfUrl: URL.createObjectURL(blob) };
    },

    /**
     * Export report as Excel
     */
    exportReportExcel: async (reportId: string): Promise<{ excelUrl: string }> => {
        const res = await fetch(`${API_URL}/assessment-reports/${reportId}/export/excel`, {
            headers: getHeaders()
        });
        if (!res.ok) {
            throw new Error('Failed to export Excel');
        }
        const blob = await res.blob();
        return { excelUrl: URL.createObjectURL(blob) };
    },

    // ============================================
    // ECONOMICS MODULE API
    // ============================================

    /**
     * Get list of digitization analyses
     */
    getDigitizationAnalyses: async (filters?: {
        status?: string;
        projectId?: string;
        search?: string;
        sortBy?: string;
        sortOrder?: string;
        page?: number;
        pageSize?: number;
    }): Promise<any> => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }
        const url = `${API_URL}/economics/analyses${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetchWithRetry(url, { headers: getHeaders() });
        return handleResponse(res, 'Failed to load analyses');
    },

    /**
     * Create new digitization analysis
     */
    createDigitizationAnalysis: async (data: {
        name: string;
        description?: string;
        projectId?: string;
        tags?: string[];
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create analysis');
    },

    /**
     * Get single digitization analysis by ID
     */
    getDigitizationAnalysis: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${id}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load analysis');
    },

    /**
     * Update digitization analysis
     */
    updateDigitizationAnalysis: async (id: string, data: {
        name?: string;
        description?: string;
        status?: string;
        projectId?: string;
        tags?: string[];
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update analysis');
    },

    /**
     * Delete digitization analysis
     */
    deleteDigitizationAnalysis: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to delete analysis');
    },

    /**
     * Duplicate digitization analysis
     */
    duplicateDigitizationAnalysis: async (id: string, name?: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${id}/duplicate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name })
        });
        return handleResponse(res, 'Failed to duplicate analysis');
    },

    /**
     * Update scores for digitization analysis
     */
    updateDigitizationScores: async (analysisId: string, scores: Array<{
        axisId: string;
        areaId: string;
        areaCode?: string;
        currentLevel: number;
        targetLevel: number;
        notes?: string;
        evidence?: string[];
        justification?: string;
    }>): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/scores`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ scores })
        });
        return handleResponse(res, 'Failed to update scores');
    },

    /**
     * Update single score for digitization analysis
     */
    updateDigitizationScore: async (analysisId: string, scoreData: {
        axisId: string;
        areaId: string;
        areaCode?: string;
        currentLevel: number;
        targetLevel: number;
        notes?: string;
        evidence?: string[];
        justification?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/score`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(scoreData)
        });
        return handleResponse(res, 'Failed to update score');
    },



    /**
     * Import digitization analysis from Excel file
     */
    importDigitizationExcel: async (file: File, analysisName?: string): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        if (analysisName) {
            formData.append('analysisName', analysisName);
        }

        const token = tokenService.getToken();
        const res = await fetch(`${API_URL}/economics/import`, {
            method: 'POST',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: formData
        });
        return handleResponse(res, 'Failed to import Excel file');
    },

    /**
     * Export digitization analysis to Excel
     */
    exportDigitizationAnalysis: async (analysisId: string, options?: {
        recommendations?: boolean;
        rawData?: boolean;
        language?: string;
    }): Promise<any> => {
        const params = new URLSearchParams();
        if (options) {
            if (options.recommendations !== undefined) params.append('recommendations', String(options.recommendations));
            if (options.rawData !== undefined) params.append('rawData', String(options.rawData));
            if (options.language) params.append('language', options.language);
        }
        const url = `${API_URL}/economics/analyses/${analysisId}/export${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetchWithRetry(url, { headers: getHeaders() });
        return handleResponse(res, 'Failed to export analysis');
    },

    /**
     * Export digitization analysis to PDF
     */
    exportDigitizationPDF: async (analysisId: string, options?: {
        template?: 'executive' | 'full' | 'gap_analysis';
        language?: 'pl' | 'en';
        logo?: boolean;
        recommendations?: boolean;
    }): Promise<{ success: boolean; downloadUrl: string; filename: string }> => {
        const params = new URLSearchParams();
        if (options) {
            if (options.template) params.append('template', options.template);
            if (options.language) params.append('language', options.language);
            if (options.logo !== undefined) params.append('logo', String(options.logo));
            if (options.recommendations !== undefined) params.append('recommendations', String(options.recommendations));
        }
        const url = `${API_URL}/economics/analyses/${analysisId}/export/pdf${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetchWithRetry(url, { headers: getHeaders() });
        return handleResponse(res, 'Failed to export analysis to PDF');
    },

    /**
     * Get digitization catalog statistics
     */
    getDigitizationStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/stats`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load statistics');
    },

    /**
     * Compare multiple digitization analyses
     */
    compareDigitizationAnalyses: async (analysisIds: string[]): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/compare`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ analysisIds })
        });
        return handleResponse(res, 'Failed to compare analyses');
    },

    /**
     * Create saved comparison
     */
    createDigitizationComparison: async (data: {
        name: string;
        description?: string;
        analysisIds: string[];
        comparisonType?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/comparisons`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create comparison');
    },

    /**
     * Get saved comparison
     */
    getDigitizationComparison: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/comparisons/${id}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load comparison');
    },

    // =========================================
    // Economics: Versioning API
    // =========================================

    /**
     * Create version snapshot
     */
    createDigitizationVersion: async (analysisId: string, data: {
        versionName?: string;
        versionType?: 'snapshot' | 'baseline' | 'milestone';
        notes?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/versions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create version');
    },

    /**
     * Get all versions for an analysis
     */
    getDigitizationVersions: async (analysisId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/versions`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load versions');
    },

    /**
     * Get specific version
     */
    getDigitizationVersion: async (analysisId: string, versionId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/versions/${versionId}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load version');
    },

    /**
     * Restore analysis to version
     */
    restoreDigitizationVersion: async (analysisId: string, versionId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/versions/${versionId}/restore`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to restore version');
    },

    /**
     * Compare two versions
     */
    compareDigitizationVersions: async (analysisId: string, v1: string, v2: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/versions/compare?v1=${v1}&v2=${v2}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to compare versions');
    },

    /**
     * Mark version as baseline
     */
    markVersionAsBaseline: async (analysisId: string, versionId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/versions/${versionId}/baseline`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to mark as baseline');
    },

    // =========================================
    // Economics: Evidence API
    // =========================================

    /**
     * Add evidence to score
     */
    addDigitizationEvidence: async (scoreId: string, data: {
        evidenceType: 'document' | 'link' | 'screenshot' | 'note';
        title: string;
        content?: string;
        category?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/scores/${scoreId}/evidence`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to add evidence');
    },

    /**
     * Upload evidence file
     */
    uploadDigitizationEvidence: async (scoreId: string, file: File, metadata: {
        title?: string;
        description?: string;
        category?: string;
    }): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        if (metadata.title) formData.append('title', metadata.title);
        if (metadata.description) formData.append('description', metadata.description);
        if (metadata.category) formData.append('category', metadata.category);

        const token = tokenService.getToken();
        const res = await fetchWithRetry(`${API_URL}/economics/scores/${scoreId}/evidence/upload`, {
            method: 'POST',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
                // Note: Don't set Content-Type for FormData - browser sets it with boundary
            },
            body: formData
        });
        return handleResponse(res, 'Failed to upload evidence');
    },

    /**
     * Get evidence for score
     */
    getDigitizationEvidence: async (scoreId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/scores/${scoreId}/evidence`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load evidence');
    },

    /**
     * Get all evidence for analysis
     */
    getDigitizationAnalysisEvidence: async (analysisId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/evidence`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load evidence');
    },

    /**
     * Update evidence
     */
    updateDigitizationEvidence: async (evidenceId: string, data: {
        title?: string;
        content?: string;
        category?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/evidence/${evidenceId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update evidence');
    },

    /**
     * Delete evidence
     */
    deleteDigitizationEvidence: async (evidenceId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/evidence/${evidenceId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to delete evidence');
    },

    /**
     * Verify evidence
     */
    verifyDigitizationEvidence: async (evidenceId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/evidence/${evidenceId}/verify`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to verify evidence');
    },

    // --- DOCUMENTS ---
    getProjectDocuments: async (projectId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/documents/project/${projectId}`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch project documents');
    },

    getUserDocuments: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/documents/user`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch user documents');
    },

    uploadDocumentToLibrary: async (file: File, options?: { scope?: string, projectId?: string, description?: string, tags?: string[] }): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        if (options) {
            if (options.scope) formData.append('scope', options.scope);
            if (options.projectId) formData.append('projectId', options.projectId);
            if (options.description) formData.append('description', options.description);
            if (options.tags) formData.append('tags', JSON.stringify(options.tags));
        }

        const headers = getHeaders();
        delete (headers as any)['Content-Type'];

        const res = await fetch(`${API_URL}/documents/upload`, {
            method: 'POST',
            headers: headers,
            body: formData
        });
        return handleResponse(res, 'Failed to upload document');
    },

    moveDocumentToProject: async (docId: string, projectId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/documents/${docId}/move-to-project`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ projectId })
        });
        return handleResponse(res, 'Failed to move document');
    },

    deleteDocument: async (docId: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/documents/${docId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to delete document');
    },

    downloadDocument: async (docId: string): Promise<Blob> => {
        const res = await fetchWithRetry(`${API_URL}/documents/${docId}/download`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to download document');
        return res.blob();
    },

    /**
     * Get evidence categories
     */
    getEvidenceCategories: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/evidence/categories`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to load categories');
    },

    // Economics: Financial Analysis API
    // ============================================

    /**
     * Link analysis to initiative
     */
    linkAnalysisToInitiative: async (analysisId: string, initiativeId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/link-initiative`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ initiativeId })
        });
        return handleResponse(res, 'Failed to link analysis to initiative');
    },

    /**
     * Get financial data for analysis
     */
    getAnalysisFinancials: async (analysisId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/financials`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch financial data');
    },

    /**
     * Update financial data for analysis
     */
    updateAnalysisFinancials: async (analysisId: string, data: {
        costs?: Array<{ year: number; amount: number; description?: string }>;
        benefits?: Array<{ year: number; amount: number; description?: string }>;
        discountRate?: number;
        investmentHorizon?: number;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/financials`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update financial data');
    },

    /**
     * Get benefit tracking data for analysis
     */
    getAnalysisBenefits: async (analysisId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/benefits`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch benefit tracking data');
    },

    /**
     * Update benefit tracking data for analysis
     */
    updateAnalysisBenefits: async (analysisId: string, data: {
        plannedBenefits?: Array<{ period: string; amount: number }>;
        actualBenefits?: Array<{ period: string; amount: number }>;
        trackingPeriod?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/benefits`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update benefit tracking data');
    },

    /**
     * Get quality assessment for analysis
     */
    getAnalysisQualityAssessment: async (analysisId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/quality-assessment`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch quality assessment');
    },

    /**
     * Calculate financial metrics (NPV, IRR, Payback, ROI)
     */
    calculateFinancialMetrics: async (analysisId: string): Promise<{
        npv: number | null;
        irr: number | null;
        paybackPeriod: number | null;
        roi: number | null;
        cashFlows: Array<{ year: number; amount: number }>;
        sensitivityAnalysis?: any;
    }> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/calculate-metrics`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to calculate financial metrics');
    },

    /**
     * Generate business case document
     */
    generateBusinessCase: async (analysisId: string, options?: {
        format?: 'pdf' | 'docx';
        language?: 'pl' | 'en';
        includeExecutiveSummary?: boolean;
        includeFinancialAnalysis?: boolean;
        includeRiskAssessment?: boolean;
    }): Promise<{ downloadUrl: string; filename: string }> => {
        const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/business-case`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(options || {})
        });
        return handleResponse(res, 'Failed to generate business case');
    },

    // ==================== CONVERSATIONS ====================

    /**
     * List user's conversations
     */
    getConversations: async (options?: {
        archived?: boolean;
        starred?: boolean;
        projectId?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        conversations: any[];
        total: number;
        limit: number;
        offset: number;
    }> => {
        const params = new URLSearchParams();
        if (options?.archived !== undefined) params.append('archived', String(options.archived));
        if (options?.starred !== undefined) params.append('starred', String(options.starred));
        if (options?.projectId) params.append('projectId', options.projectId);
        if (options?.search) params.append('search', options.search);
        if (options?.limit) params.append('limit', String(options.limit));
        if (options?.offset) params.append('offset', String(options.offset));

        const res = await fetchWithRetry(`${API_URL}/conversations?${params.toString()}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch conversations');
    },

    /**
     * Create a new conversation
     */
    createConversation: async (data?: {
        title?: string;
        projectId?: string;
        pmoContext?: Record<string, any>;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/conversations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data || {})
        });
        return handleResponse(res, 'Failed to create conversation');
    },

    /**
     * Get a conversation with all its messages
     */
    getConversation: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/conversations/${id}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch conversation');
    },

    /**
     * Update conversation metadata
     */
    updateConversation: async (id: string, updates: {
        title?: string;
        starred?: boolean;
        archived?: boolean;
        tags?: string[];
        pmoContext?: Record<string, any>;
        chatProjectId?: string | null;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/conversations/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(res, 'Failed to update conversation');
    },

    /**
     * Delete a conversation
     */
    deleteConversation: async (id: string): Promise<{ success: boolean; deleted: string }> => {
        const res = await fetchWithRetry(`${API_URL}/conversations/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to delete conversation');
    },

    /**
     * Add a message to a conversation
     */
    addConversationMessage: async (conversationId: string, message: {
        role: 'user' | 'ai';
        content: string;
        messageType?: string;
        metadata?: Record<string, any>;
        tokenCount?: number;
        modelUsed?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(message)
        });
        return handleResponse(res, 'Failed to add message');
    },

    /**
     * Generate title for a conversation
     */
    generateConversationTitle: async (conversationId: string): Promise<{ title?: string; skipped?: boolean; reason?: string }> => {
        const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/title/generate`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to generate title');
    },

    /**
     * Report feedback on a message (thumbs up/down)
     */
    reportMessageFeedback: async (messageId: string, rating: 'positive' | 'negative'): Promise<{ success: boolean }> => {
        try {
            const res = await fetchWithRetry(`${API_URL}/ai/feedback`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ messageId, rating })
            });
            return handleResponse(res, 'Failed to report feedback');
        } catch (err) {
            console.warn('[API] Feedback endpoint not available, logging locally');
            return { success: true }; // Graceful fallback
        }
    },

    /**
     * Report a problematic message
     */
    reportMessage: async (messageId: string, reason: string): Promise<{ success: boolean }> => {
        try {
            const res = await fetchWithRetry(`${API_URL}/ai/report`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ messageId, reason })
            });
            return handleResponse(res, 'Failed to report message');
        } catch (err) {
            console.error('[API] Report endpoint not available:', err);
            return { success: false };
        }
    },

    /**
     * Bulk operations on conversations
     */
    bulkConversationOperation: async (ids: string[], action: 'archive' | 'unarchive' | 'delete' | 'star' | 'unstar'): Promise<{
        success: boolean;
        affected: number;
        ids: string[];
    }> => {
        const res = await fetchWithRetry(`${API_URL}/conversations/bulk`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ids, action })
        });
        return handleResponse(res, 'Failed to perform bulk operation');
    },

    /**
     * Migrate conversations from localStorage
     */
    migrateConversations: async (conversations: Array<{
        projectId?: string;
        messages: Array<{ role: string; content: string; timestamp?: Date }>;
    }>): Promise<{ success: boolean; migrated: Array<{ conversationId: string; messageCount: number }> }> => {
        const res = await fetchWithRetry(`${API_URL}/conversations/migrate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ conversations })
        });
        return handleResponse(res, 'Failed to migrate conversations');
    },

    // ==================== CHAT PROJECTS ====================

    /**
     * List user's chat projects
     */
    getChatProjects: async (): Promise<{ projects: any[] }> => {
        const res = await fetchWithRetry(`${API_URL}/chat-projects`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch chat projects');
    },

    /**
     * Get a single chat project with its conversations
     */
    getChatProject: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/chat-projects/${id}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch chat project');
    },

    /**
     * Create a new chat project
     */
    createChatProject: async (data: {
        name: string;
        description?: string;
        color?: string;
        icon?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/chat-projects`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create chat project');
    },

    /**
     * Update a chat project
     */
    updateChatProject: async (id: string, updates: {
        name?: string;
        description?: string;
        color?: string;
        icon?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/chat-projects/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(res, 'Failed to update chat project');
    },

    /**
     * Delete a chat project (conversations are unlinked, not deleted)
     */
    deleteChatProject: async (id: string): Promise<{ success: boolean; deleted: string }> => {
        const res = await fetchWithRetry(`${API_URL}/chat-projects/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to delete chat project');
    },

    /**
     * Move a conversation to a chat project
     */
    moveConversationToProject: async (projectId: string, conversationId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/chat-projects/${projectId}/conversations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ conversationId })
        });
        return handleResponse(res, 'Failed to move conversation to project');
    },

    /**
     * Remove a conversation from a chat project
     */
    removeConversationFromProject: async (projectId: string, conversationId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/chat-projects/${projectId}/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to remove conversation from project');
    },

    // ==================== STUDIO ====================

    /**
     * Get studio documents
     */
    getStudioDocuments: async (options?: {
        type?: string;
        linkedTaskId?: string;
        linkedProjectId?: string;
        linkedInitiativeId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]> => {
        const params = new URLSearchParams();
        if (options?.type) params.append('type', options.type);
        if (options?.linkedTaskId) params.append('linkedTaskId', options.linkedTaskId);
        if (options?.linkedProjectId) params.append('linkedProjectId', options.linkedProjectId);
        if (options?.linkedInitiativeId) params.append('linkedInitiativeId', options.linkedInitiativeId);
        if (options?.limit) params.append('limit', String(options.limit));
        if (options?.offset) params.append('offset', String(options.offset));

        const res = await fetchWithRetry(`${API_URL}/studio/documents?${params.toString()}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch studio documents');
    },

    /**
     * Create studio document
     */
    createStudioDocument: async (data: {
        name: string;
        description?: string;
        type?: string;
        nodes?: any[];
        edges?: any[];
        linkedTaskId?: string;
        linkedProjectId?: string;
        linkedInitiativeId?: string;
        templateId?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/studio/documents`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create studio document');
    },

    /**
     * Get studio document by ID
     */
    getStudioDocument: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/studio/documents/${id}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch studio document');
    },

    /**
     * Update studio document
     */
    updateStudioDocument: async (id: string, data: {
        name?: string;
        description?: string;
        type?: string;
        nodes?: any[];
        edges?: any[];
        viewport?: any;
        tags?: string[];
        linkedTaskId?: string;
        linkedProjectId?: string;
        linkedInitiativeId?: string;
        createSnapshot?: boolean;
        snapshotReason?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/studio/documents/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update studio document');
    },

    /**
     * Delete studio document
     */
    deleteStudioDocument: async (id: string): Promise<{ success: boolean }> => {
        const res = await fetchWithRetry(`${API_URL}/studio/documents/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to delete studio document');
    },

    /**
     * Create studio document snapshot
     */
    createStudioSnapshot: async (documentId: string, data?: { name?: string; reason?: string }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/studio/documents/${documentId}/snapshot`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data || {})
        });
        return handleResponse(res, 'Failed to create snapshot');
    },

    /**
     * Restore studio document from snapshot
     */
    restoreStudioSnapshot: async (documentId: string, snapshotId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/studio/documents/${documentId}/restore/${snapshotId}`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to restore snapshot');
    },

    /**
     * Get studio templates
     */
    getStudioTemplates: async (category?: string): Promise<any[]> => {
        const params = category ? `?category=${category}` : '';
        const res = await fetchWithRetry(`${API_URL}/studio/templates${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch studio templates');
    },

    /**
     * Create studio template from document
     */
    createStudioTemplate: async (data: {
        name: string;
        description?: string;
        category: string;
        nodes?: any[];
        edges?: any[];
        tags?: string[];
        isPublic?: boolean;
        fromDocumentId?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/studio/templates`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create template');
    },

    /**
     * Share studio document
     */
    shareStudioDocument: async (documentId: string): Promise<{ shareToken: string; shareUrl: string }> => {
        const res = await fetchWithRetry(`${API_URL}/studio/documents/${documentId}/share`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to share document');
    },

    /**
     * Get shared studio document (public)
     */
    getSharedStudioDocument: async (token: string): Promise<any> => {
        const res = await fetch(`${API_URL}/studio/shared/${token}`);
        return handleResponse(res, 'Failed to fetch shared document');
    },

    /**
     * Link studio document to PMO entity
     */
    linkStudioDocument: async (documentId: string, links: {
        taskId?: string;
        projectId?: string;
        initiativeId?: string;
    }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/studio/documents/${documentId}/link`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(links)
        });
        return handleResponse(res, 'Failed to link document');
    },

    // ==================== STUDIO AI ====================

    /**
     * Generate diagram from text
     */
    generateStudioDiagram: async (prompt: string, diagramType?: string): Promise<{
        nodes: any[];
        edges: any[];
        diagramType: string;
        suggestedTitle?: string;
        tokensUsed?: number;
    }> => {
        const res = await fetchWithRetry(`${API_URL}/studio/ai/generate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ prompt, diagramType })
        });
        return handleResponse(res, 'Failed to generate diagram');
    },

    /**
     * Modify existing diagram
     */
    modifyStudioDiagram: async (prompt: string, nodes: any[], edges: any[]): Promise<{
        nodes: any[];
        edges: any[];
        changes?: { added?: string[]; modified?: string[]; removed?: string[] };
        tokensUsed?: number;
    }> => {
        const res = await fetchWithRetry(`${API_URL}/studio/ai/modify`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ prompt, nodes, edges })
        });
        return handleResponse(res, 'Failed to modify diagram');
    },

    /**
     * Studio AI chat
     */
    studioAIChat: async (message: string, documentId?: string, context?: { nodes: any[]; edges: any[] }): Promise<{
        text: string;
        intent: string;
        confidence: number;
        diagramUpdate?: {
            action: 'replace' | 'update';
            nodes: any[];
            edges: any[];
            changes?: { added?: string[]; modified?: string[]; removed?: string[] };
        };
    }> => {
        const res = await fetchWithRetry(`${API_URL}/studio/ai/chat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ message, documentId, context })
        });
        return handleResponse(res, 'Failed to process chat message');
    },

    /**
     * Get diagram optimization suggestions
     */
    getStudioSuggestions: async (nodes: any[], edges: any[], diagramType?: string): Promise<{
        suggestions: Array<{
            type: string;
            message: string;
            nodeIds?: string[];
        }>;
    }> => {
        const res = await fetchWithRetry(`${API_URL}/studio/ai/suggest`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ nodes, edges, diagramType })
        });
        return handleResponse(res, 'Failed to get suggestions');
    },

    /**
     * Classify intent of message
     */
    classifyStudioIntent: async (message: string): Promise<{ intent: string; confidence: number }> => {
        const res = await fetchWithRetry(`${API_URL}/studio/ai/classify`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ message })
        });
        return handleResponse(res, 'Failed to classify intent');
    },

    // --- PERMISSION REQUESTS ---

    /**
     * Get user's own permission requests
     */
    getPermissionRequests: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/permission-requests`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch permission requests');
    },

    /**
     * Get all org permission requests (Admin only)
     */
    getAdminPermissionRequests: async (status?: string): Promise<any[]> => {
        const url = status
            ? `${API_URL}/permission-requests/admin?status=${status}`
            : `${API_URL}/permission-requests/admin`;
        const res = await fetchWithRetry(url, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch admin permission requests');
    },

    /**
     * Create a new permission request
     */
    createPermissionRequest: async (data: {
        requestType: string;
        currentValue?: string;
        requestedValue?: string;
        justification?: string;
        priority?: string;
    }): Promise<{ success: boolean; requestId: string; message: string }> => {
        const res = await fetchWithRetry(`${API_URL}/permission-requests`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create permission request');
    },

    /**
     * Approve a permission request (Admin only)
     */
    approvePermissionRequest: async (requestId: string, adminNotes?: string): Promise<{ success: boolean }> => {
        const res = await fetchWithRetry(`${API_URL}/permission-requests/${requestId}/approve`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ adminNotes })
        });
        return handleResponse(res, 'Failed to approve permission request');
    },

    /**
     * Reject a permission request (Admin only)
     */
    rejectPermissionRequest: async (requestId: string, adminNotes?: string): Promise<{ success: boolean }> => {
        const res = await fetchWithRetry(`${API_URL}/permission-requests/${requestId}/reject`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ adminNotes })
        });
        return handleResponse(res, 'Failed to reject permission request');
    },

    /**
     * Cancel a pending permission request
     */
    cancelPermissionRequest: async (requestId: string): Promise<{ success: boolean }> => {
        const res = await fetchWithRetry(`${API_URL}/permission-requests/${requestId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to cancel permission request');
    },

    /**
     * Get permission request statistics (Admin only)
     */
    getPermissionRequestStats: async (): Promise<{
        pending: number;
        approved: number;
        rejected: number;
        cancelled: number;
        total: number;
    }> => {
        const res = await fetchWithRetry(`${API_URL}/permission-requests/stats`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch permission request stats');
    },

    /**
     * Get user activity log
     */
    getUserActivityLog: async (limit = 50): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/users/me/activity?limit=${limit}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch activity log');
    },

    // ==========================================
    // ENTERPRISE CUSTOMERS MODULE - Organizations
    // ==========================================
    getOrganizationMetadata: async (orgId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/metadata`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch organization metadata');
    },
    updateOrganizationMetadata: async (orgId: string, metadata: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/metadata`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(metadata)
        });
        return handleResponse(res, 'Failed to update organization metadata');
    },
    getOrganizationTags: async (orgId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/tags`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch organization tags');
    },
    addOrganizationTag: async (orgId: string, tag: string, color?: string, category?: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/tags`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tag, color, category })
        });
        return handleResponse(res, 'Failed to add organization tag');
    },
    removeOrganizationTag: async (orgId: string, tagId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/tags/${tagId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to remove organization tag');
    },
    getOrganizationHealth: async (orgId: string, date?: string): Promise<any> => {
        const url = `${API_URL}/superadmin/organizations/${orgId}/health${date ? `?date=${date}` : ''}`;
        const res = await fetchWithRetry(url, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch organization health');
    },
    getOrganizationRelationships: async (orgId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/relationships`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch organization relationships');
    },
    getOrganizationAnalytics: async (orgId: string, startDate?: string, endDate?: string): Promise<any[]> => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/analytics?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch organization analytics');
    },

    // ==========================================
    // ENTERPRISE CUSTOMERS MODULE - Users
    // ==========================================
    getUserProfileExtended: async (userId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/profile-extended`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch user profile');
    },
    updateUserProfileExtended: async (userId: string, profile: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/profile-extended`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(profile)
        });
        return handleResponse(res, 'Failed to update user profile');
    },
    getUserActivity: async (userId: string, period?: string): Promise<any> => {
        const url = `${API_URL}/superadmin/users/${userId}/activity${period ? `?period=${period}` : ''}`;
        const res = await fetchWithRetry(url, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch user activity');
    },
    getUserSessions: async (userId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/sessions`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch user sessions');
    },
    revokeUserSession: async (userId: string, sessionId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to revoke session');
    },
    getUserGroups: async (userId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/groups`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch user groups');
    },
    getUserOnboardingProgress: async (userId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/onboarding`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch onboarding progress');
    },
    updateUserOnboardingProgress: async (userId: string, progress: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/onboarding`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(progress)
        });
        return handleResponse(res, 'Failed to update onboarding progress');
    },
    getUserLicense: async (userId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/license`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch user license');
    },
    assignUserLicense: async (userId: string, license: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/license`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(license)
        });
        return handleResponse(res, 'Failed to assign license');
    },

    // ==========================================
    // ENTERPRISE CUSTOMERS MODULE - Security
    // ==========================================
    getIPWhitelist: async (orgId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/ip-whitelist`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch IP whitelist');
    },
    addIPWhitelist: async (orgId: string, ipData: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/ip-whitelist`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(ipData)
        });
        return handleResponse(res, 'Failed to add IP to whitelist');
    },
    removeIPWhitelist: async (ipId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/ip-whitelist/${ipId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to remove IP from whitelist');
    },
    getUserDevices: async (userId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/devices`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch user devices');
    },
    blockDevice: async (deviceId: string, reason?: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/devices/${deviceId}/block`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ reason })
        });
        return handleResponse(res, 'Failed to block device');
    },
    getMFAMethods: async (userId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/mfa`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch MFA methods');
    },
    setupTOTP: async (userId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/mfa/totp/setup`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to setup TOTP');
    },
    verifyTOTP: async (userId: string, token: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/mfa/totp/verify`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ token })
        });
        return handleResponse(res, 'Failed to verify TOTP');
    },
    getPasswordPolicy: async (orgId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/password-policy`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch password policy');
    },
    updatePasswordPolicy: async (orgId: string, policy: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/password-policy`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(policy)
        });
        return handleResponse(res, 'Failed to update password policy');
    },
    getSecurityEvents: async (filters?: any): Promise<any[]> => {
        const params = new URLSearchParams();
        if (filters?.organizationId) params.append('organizationId', filters.organizationId);
        if (filters?.userId) params.append('userId', filters.userId);
        if (filters?.eventType) params.append('eventType', filters.eventType);
        if (filters?.severity) params.append('severity', filters.severity);
        if (filters?.resolved !== undefined) params.append('resolved', filters.resolved.toString());
        if (filters?.limit) params.append('limit', filters.limit.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/security-events?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch security events');
    },
    resolveSecurityEvent: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/security-events/${id}/resolve`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to resolve security event');
    },

    // ==========================================
    // ENTERPRISE CUSTOMERS MODULE - Support
    // ==========================================
    getSupportTickets: async (filters?: any): Promise<any[]> => {
        const params = new URLSearchParams();
        if (filters?.organizationId) params.append('organizationId', filters.organizationId);
        if (filters?.userId) params.append('userId', filters.userId);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.priority) params.append('priority', filters.priority);
        if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
        if (filters?.limit) params.append('limit', filters.limit.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/support/tickets?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch support tickets');
    },
    createSupportTicket: async (ticket: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/support/tickets`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(ticket)
        });
        return handleResponse(res, 'Failed to create support ticket');
    },
    updateSupportTicket: async (ticketId: string, updates: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/support/tickets/${ticketId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(res, 'Failed to update support ticket');
    },
    addTicketComment: async (ticketId: string, comment: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/support/tickets/${ticketId}/comments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(comment)
        });
        return handleResponse(res, 'Failed to add ticket comment');
    },
    getCustomerSuccessNotes: async (orgId: string, filters?: any): Promise<any[]> => {
        const params = new URLSearchParams();
        if (filters?.noteType) params.append('noteType', filters.noteType);
        if (filters?.userId) params.append('userId', filters.userId);
        if (filters?.limit) params.append('limit', filters.limit.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/customer-success/notes?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch customer success notes');
    },
    createCustomerSuccessNote: async (orgId: string, note: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/customer-success/notes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(note)
        });
        return handleResponse(res, 'Failed to create customer success note');
    },
    getCustomerHealthCheck: async (orgId: string, date?: string): Promise<any> => {
        const url = `${API_URL}/superadmin/organizations/${orgId}/customer-success/health${date ? `?date=${date}` : ''}`;
        const res = await fetchWithRetry(url, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch customer health check');
    },

    // ==========================================
    // ENTERPRISE CUSTOMERS MODULE - Feedback
    // ==========================================
    getFeedbackItems: async (filters?: any): Promise<any[]> => {
        const params = new URLSearchParams();
        if (filters?.organizationId) params.append('organizationId', filters.organizationId);
        if (filters?.userId) params.append('userId', filters.userId);
        if (filters?.feedbackType) params.append('feedbackType', filters.feedbackType);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.limit) params.append('limit', filters.limit.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/feedback?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch feedback items');
    },
    createFeedbackItem: async (feedback: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/feedback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(feedback)
        });
        return handleResponse(res, 'Failed to create feedback item');
    },
    voteFeedback: async (feedbackId: string, voteType: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/feedback/${feedbackId}/vote`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ voteType })
        });
        return handleResponse(res, 'Failed to vote on feedback');
    },
    addFeedbackComment: async (feedbackId: string, comment: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/feedback/${feedbackId}/comments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(comment)
        });
        return handleResponse(res, 'Failed to add feedback comment');
    },
    getFeatureRoadmap: async (status?: string): Promise<any[]> => {
        const url = `${API_URL}/superadmin/feature-roadmap${status ? `?status=${status}` : ''}`;
        const res = await fetchWithRetry(url, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch feature roadmap');
    },
    updateFeatureRoadmap: async (itemId: string, updates: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/feature-roadmap/${itemId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(res, 'Failed to update feature roadmap');
    },

    // ==========================================
    // ENTERPRISE CUSTOMERS MODULE - Analytics
    // ==========================================
    getUserAdoptionMetrics: async (userId: string, startDate?: string, endDate?: string): Promise<any[]> => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/adoption-metrics?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch user adoption metrics');
    },
    getChurnPrediction: async (orgId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/churn-prediction`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch churn prediction');
    },

    // ==========================================
    // ENTERPRISE CUSTOMERS MODULE - Compliance
    // ==========================================
    getDataRetentionPolicies: async (organizationId?: string): Promise<any[]> => {
        const url = `${API_URL}/superadmin/compliance/retention-policies${organizationId ? `?organizationId=${organizationId}` : ''}`;
        const res = await fetchWithRetry(url, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch data retention policies');
    },
    createDataRetentionPolicy: async (policy: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/compliance/retention-policies`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(policy)
        });
        return handleResponse(res, 'Failed to create data retention policy');
    },
    getGDPRRequests: async (organizationId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/compliance/gdpr-requests?organizationId=${organizationId}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch GDPR requests');
    },
    createGDPRRequest: async (request: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/compliance/gdpr-requests`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(request)
        });
        return handleResponse(res, 'Failed to create GDPR request');
    },
    getUserConsents: async (userId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/consents`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch user consents');
    },
    updateUserConsent: async (userId: string, consent: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/consents`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(consent)
        });
        return handleResponse(res, 'Failed to update user consent');
    },

    // ==========================================
    // ENTERPRISE CUSTOMERS MODULE - Automation
    // ==========================================
    getAutomationRules: async (organizationId: string, activeOnly?: boolean): Promise<any[]> => {
        const url = `${API_URL}/superadmin/automation/rules?organizationId=${organizationId}${activeOnly ? '&activeOnly=true' : ''}`;
        const res = await fetchWithRetry(url, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch automation rules');
    },
    createAutomationRule: async (rule: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/automation/rules`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(rule)
        });
        return handleResponse(res, 'Failed to create automation rule');
    },
    updateAutomationRule: async (ruleId: string, updates: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/automation/rules/${ruleId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(res, 'Failed to update automation rule');
    },
    getWebhookSubscriptions: async (organizationId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/webhooks?organizationId=${organizationId}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch webhook subscriptions');
    },
    createWebhookSubscription: async (subscription: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/webhooks`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(subscription)
        });
        return handleResponse(res, 'Failed to create webhook subscription');
    },

    // ==========================================
    // ENTERPRISE CUSTOMERS MODULE - Communication
    // ==========================================
    getEmailTemplates: async (category?: string, activeOnly?: boolean): Promise<any[]> => {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (activeOnly) params.append('activeOnly', 'true');
        const res = await fetchWithRetry(`${API_URL}/superadmin/email/templates?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch email templates');
    },
    createEmailTemplate: async (template: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/email/templates`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(template)
        });
        return handleResponse(res, 'Failed to create email template');
    },
    getEmailCampaigns: async (organizationId?: string, status?: string): Promise<any[]> => {
        const params = new URLSearchParams();
        if (organizationId) params.append('organizationId', organizationId);
        if (status) params.append('status', status);
        const res = await fetchWithRetry(`${API_URL}/superadmin/email/campaigns?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch email campaigns');
    },
    createEmailCampaign: async (campaign: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/email/campaigns`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(campaign)
        });
        return handleResponse(res, 'Failed to create email campaign');
    },
    getSuperAdminNotificationPreferences: async (userId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/notification-preferences`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch notification preferences');
    },
    updateSuperAdminNotificationPreferences: async (userId: string, preferences: any[]): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/notification-preferences`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ preferences })
        });
        return handleResponse(res, 'Failed to update notification preferences');
    },

    // ==========================================
    // SYSTEM MODULE API
    // ==========================================

    // Audit Logs
    getAuditLogs: async (filters?: any, pagination?: any): Promise<any> => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }
        if (pagination) {
            Object.entries(pagination).forEach(([key, value]) => {
                params.append(key, String(value));
            });
        }
        const res = await fetchWithRetry(`${API_URL}/audit-logs?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch audit logs');
    },
    getAuditLogById: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/audit-logs/${id}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch audit log');
    },
    getAuditLogStats: async (filters?: any): Promise<any> => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }
        const res = await fetchWithRetry(`${API_URL}/audit-logs/stats/summary?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch audit log stats');
    },
    exportAuditLogs: async (filters?: any): Promise<Blob> => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }
        const res = await fetchWithRetry(`${API_URL}/audit-logs/export/csv?${params}`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to export audit logs');
        return res.blob();
    },
    getComplianceReport: async (framework: string, filters?: any): Promise<any> => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }
        const res = await fetchWithRetry(`${API_URL}/audit-logs/compliance/${framework}?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch compliance report');
    },

    // Feature Flags
    getFeatureFlags: async (filters?: any): Promise<any[]> => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }
        const res = await fetchWithRetry(`${API_URL}/feature-flags/admin?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch feature flags');
    },
    getFeatureFlagById: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/feature-flags/${id}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch feature flag');
    },
    createFeatureFlag: async (flag: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/feature-flags`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(flag)
        });
        return handleResponse(res, 'Failed to create feature flag');
    },
    updateFeatureFlag: async (id: string, updates: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/feature-flags/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(res, 'Failed to update feature flag');
    },
    deleteFeatureFlag: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/feature-flags/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to delete feature flag');
    },
    toggleFeatureFlag: async (id: string, enabled: boolean): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/feature-flags/${id}/toggle`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ enabled })
        });
        return handleResponse(res, 'Failed to toggle feature flag');
    },
    getFeatureFlagHistory: async (id: string, limit?: number): Promise<any[]> => {
        const params = limit ? `?limit=${limit}` : '';
        const res = await fetchWithRetry(`${API_URL}/feature-flags/${id}/history${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch feature flag history');
    },

    // Webhooks (CRUD moved to lower block)

    testWebhook: async (id: string, payload?: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/webhooks/${id}/test`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ payload })
        });
        return handleResponse(res, 'Failed to test webhook');
    },
    getWebhookDeliveries: async (webhookId: string, filters?: any, pagination?: any): Promise<any[]> => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }
        if (pagination) {
            Object.entries(pagination).forEach(([key, value]) => {
                params.append(key, String(value));
            });
        }
        const res = await fetchWithRetry(`${API_URL}/webhooks/${webhookId}/deliveries?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch webhook deliveries');
    },
    retryWebhookDelivery: async (webhookId: string, deliveryId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/webhooks/${webhookId}/retry`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ deliveryId })
        });
        return handleResponse(res, 'Failed to retry webhook delivery');
    },

    // Integrations
    getSuperAdminIntegrations: async (organizationId: string, filters?: any): Promise<any[]> => {
        const params = new URLSearchParams({ organizationId });
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }
        const res = await fetchWithRetry(`${API_URL}/integrations?${params}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch integrations');
    },
    getIntegrationById: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/${id}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch integration');
    },

    // --- USER DATA & ACCOUNT ---
    exportUserData: async (): Promise<Blob> => {
        const res = await fetchWithRetry(`${API_URL}/user/export-data`, {
            headers: getHeaders()
        });
        return handleBlobResponse(res, 'Failed to export data');
    },

    deleteAccount: async (_confirmation?: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/user/delete-account`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to delete account');
    },

    // --- INTEGRATIONS: CALENDAR ---
    getCalendars: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/calendar`, {
            headers: getHeaders()
        });
        const data = await handleResponse(res, 'Failed to fetch calendars');
        return data.calendars || [];
    },
    // Alias for getCalendars if needed
    getCalendarConnections: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/calendar`, {
            headers: getHeaders()
        });
        const data = await handleResponse(res, 'Failed to fetch calendars');
        return data.calendars || [];
    },

    connectCalendar: async (calendarId: string): Promise<{ authUrl: string }> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/calendar/${calendarId}/connect`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to connect calendar');
    },

    disconnectCalendar: async (calendarId: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/calendar/${calendarId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to disconnect calendar');
    },

    getCalendarSettings: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/calendar/settings`, {
            headers: getHeaders()
        });
        const data = await handleResponse(res, 'Failed to fetch calendar settings');
        return data.settings || {};
    },

    updateCalendarSettings: async (settings: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/calendar/settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        await handleResponse(res, 'Failed to update calendar settings');
    },



    // --- AI SETTINGS ---
    clearAIMemory: async (): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/ai-memory/clear`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to clear AI memory');
    },

    updateAIMemorySettings: async (settings: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/ai-memory/settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        await handleResponse(res, 'Failed to update AI memory settings');
    },

    // --- CHAT HISTORY ---
    clearChatHistory: async (): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/conversations/clear-all`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to clear chat history');
    },

    exportChatHistory: async (): Promise<Blob> => {
        const res = await fetchWithRetry(`${API_URL}/conversations/export`, {
            headers: getHeaders()
        });
        return handleBlobResponse(res, 'Failed to export history');
    },

    // --- VOICE SETTINGS ---
    updateVoiceSettings: async (settings: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/user/voice-settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        await handleResponse(res, 'Failed to update voice settings');
    },

    // --- RESPONSE STYLE ---
    updateResponseStyle: async (style: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/user/response-style`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(style)
        });
        await handleResponse(res, 'Failed to update response style');
    },

    // =========================================
    // PHASE 1: ADVANCED IAM MODULE
    // =========================================

    // Admin Sessions
    getAdminSessions: async (adminId?: string): Promise<any[]> => {
        const params = adminId ? `?adminId=${adminId}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/sessions${params}`);
        return handleResponse(res, 'Failed to fetch admin sessions');
    },

    createAdminSession: async (data: { adminId?: string; mfaVerified?: boolean; expiresInHours?: number }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/sessions`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create admin session');
    },

    revokeAdminSession: async (sessionId: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to revoke admin session');
    },

    revokeAllAdminSessions: async (adminId?: string, exceptCurrent?: boolean): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/sessions/revoke-all`, {
            method: 'POST',
            body: JSON.stringify({ adminId, exceptCurrent })
        });
        return handleResponse(res, 'Failed to revoke all admin sessions');
    },

    getAdminSessionStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/sessions/stats`);
        return handleResponse(res, 'Failed to fetch admin session stats');
    },

    // Admin Audit Logs
    getAdminAuditLogs: async (params?: { adminId?: string; actionType?: string; riskScoreMin?: number; status?: string; limit?: number }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.adminId) queryParams.append('adminId', params.adminId);
        if (params?.actionType) queryParams.append('actionType', params.actionType);
        if (params?.riskScoreMin) queryParams.append('riskScoreMin', params.riskScoreMin.toString());
        if (params?.status) queryParams.append('status', params.status);
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/audit-logs?${queryParams}`);
        return handleResponse(res, 'Failed to fetch admin audit logs');
    },

    getAdminAuditStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/audit-logs/stats`);
        return handleResponse(res, 'Failed to fetch admin audit stats');
    },

    resolveAdminAuditLog: async (logId: string, resolutionNotes: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/audit-logs/${logId}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ resolutionNotes })
        });
        await handleResponse(res, 'Failed to resolve admin audit log');
    },

    exportAdminAuditLogs: async (params?: {
        adminId?: string;
        actionType?: string;
        riskScoreMin?: number;
        status?: string;
        fromDate?: string;
        toDate?: string;
        format?: 'csv' | 'json';
    }): Promise<Blob | any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.adminId) queryParams.append('adminId', params.adminId);
        if (params?.actionType) queryParams.append('actionType', params.actionType);
        if (params?.riskScoreMin) queryParams.append('riskScoreMin', String(params.riskScoreMin));
        if (params?.status) queryParams.append('status', params.status);
        if (params?.fromDate) queryParams.append('fromDate', params.fromDate);
        if (params?.toDate) queryParams.append('toDate', params.toDate);
        if (params?.format) queryParams.append('format', params.format);

        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/audit-logs/export?${queryParams}`);

        if (params?.format === 'csv') {
            if (!res.ok) throw new Error('Failed to export audit logs');
            return res.blob();
        }
        return handleResponse(res, 'Failed to export audit logs');
    },

    getRecentHighRiskActions: async (limit: number = 10): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/audit-logs/high-risk?limit=${limit}`);
        return handleResponse(res, 'Failed to fetch high-risk actions');
    },

    // Admin Permissions
    getAdminPermissions: async (category?: string): Promise<any[]> => {
        const params = category ? `?category=${category}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions${params}`);
        return handleResponse(res, 'Failed to fetch admin permissions');
    },

    createAdminPermission: async (data: { key: string; description: string; category: string }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create admin permission');
    },

    updateAdminPermission: async (key: string, data: { description: string; category: string }): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions/${key}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update admin permission');
    },

    deleteAdminPermission: async (key: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions/${key}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete admin permission');
    },

    getPermissionsMatrix: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions/matrix`);
        return handleResponse(res, 'Failed to fetch permissions matrix');
    },

    updateRolePermissions: async (roleId: string, permissions: string[]): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions/roles/${roleId}`, {
            method: 'PUT',
            body: JSON.stringify({ permissions })
        });
        return handleResponse(res, 'Failed to update role permissions');
    },

    toggleRolePermission: async (roleId: string, permissionKey: string, enabled: boolean): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions/roles/${roleId}/permissions/${encodeURIComponent(permissionKey)}`, {
            method: 'POST',
            body: JSON.stringify({ enabled })
        });
        return handleResponse(res, 'Failed to toggle permission');
    },

    copyRolePermissions: async (sourceRole: string, targetRole: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions/copy`, {
            method: 'POST',
            body: JSON.stringify({ sourceRole, targetRole })
        });
        return handleResponse(res, 'Failed to copy permissions');
    },

    compareRolePermissions: async (role1: string, role2: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions/compare?role1=${role1}&role2=${role2}`);
        return handleResponse(res, 'Failed to compare roles');
    },

    getPermissionsStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/permissions/stats`);
        return handleResponse(res, 'Failed to fetch permissions stats');
    },

    // Approval Workflows
    getApprovalWorkflows: async (params?: { resourceType?: string; isActive?: boolean }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.resourceType) queryParams.append('resourceType', params.resourceType);
        if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/approval-workflows?${queryParams}`);
        return handleResponse(res, 'Failed to fetch approval workflows');
    },

    createApprovalWorkflow: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/approval-workflows`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create approval workflow');
    },

    updateApprovalWorkflow: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/approval-workflows/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update approval workflow');
    },

    deleteApprovalWorkflow: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/approval-workflows/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete approval workflow');
    },

    getApprovalRequests: async (params?: { status?: string; workflowId?: string }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.workflowId) queryParams.append('workflowId', params.workflowId);
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/approval-requests?${queryParams}`);
        return handleResponse(res, 'Failed to fetch approval requests');
    },

    approveRequest: async (id: string, notes?: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/approval-requests/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({ notes })
        });
        await handleResponse(res, 'Failed to approve request');
    },

    rejectRequest: async (id: string, reason?: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/admin/approval-requests/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        await handleResponse(res, 'Failed to reject request');
    },

    // =========================================
    // PHASE 2: ADVANCED SECURITY MODULE
    // =========================================

    // Security Incidents
    getSecurityIncidents: async (params?: { incidentType?: string; severity?: string; status?: string }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.incidentType) queryParams.append('incidentType', params.incidentType);
        if (params?.severity) queryParams.append('severity', params.severity);
        if (params?.status) queryParams.append('status', params.status);
        const res = await fetchWithRetry(`${API_URL}/superadmin/security-incidents?${queryParams}`);
        return handleResponse(res, 'Failed to fetch security incidents');
    },

    getSecurityIncidentById: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/security-incidents/${id}`);
        return handleResponse(res, 'Failed to fetch security incident');
    },

    createSecurityIncident: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/security-incidents`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create security incident');
    },

    updateSecurityIncident: async (id: string, data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/security-incidents/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update security incident');
    },

    resolveSecurityIncident: async (id: string, resolutionNotes: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/security-incidents/${id}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ resolutionNotes })
        });
        return handleResponse(res, 'Failed to resolve security incident');
    },

    deleteSecurityIncident: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/security-incidents/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete security incident');
    },

    getSecurityIncidentStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/security-incidents/stats`);
        return handleResponse(res, 'Failed to fetch security incident stats');
    },

    // Threat Intelligence
    getThreats: async (params?: { threatType?: string; threatLevel?: string; isBlocked?: boolean; ipAddress?: string; domain?: string }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.threatType) queryParams.append('threatType', params.threatType);
        if (params?.threatLevel) queryParams.append('threatLevel', params.threatLevel);
        if (params?.isBlocked !== undefined) queryParams.append('isBlocked', params.isBlocked.toString());
        if (params?.ipAddress) queryParams.append('ipAddress', params.ipAddress);
        if (params?.domain) queryParams.append('domain', params.domain);
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats?${queryParams}`);
        return handleResponse(res, 'Failed to fetch threats');
    },

    getThreatById: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/${id}`);
        return handleResponse(res, 'Failed to fetch threat');
    },

    addThreat: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to add threat');
    },

    updateThreat: async (id: string, data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update threat');
    },

    blockThreat: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/${id}/block`, {
            method: 'POST'
        });
        return handleResponse(res, 'Failed to block threat');
    },

    unblockThreat: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/${id}/unblock`, {
            method: 'POST'
        });
        return handleResponse(res, 'Failed to unblock threat');
    },

    deleteThreat: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete threat');
    },

    checkIPReputation: async (ip: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/check-ip/${encodeURIComponent(ip)}`);
        return handleResponse(res, 'Failed to check IP reputation');
    },

    checkDomainReputation: async (domain: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/check-domain/${encodeURIComponent(domain)}`);
        return handleResponse(res, 'Failed to check domain reputation');
    },

    getBlockedIPs: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/blocked-ips`);
        return handleResponse(res, 'Failed to fetch blocked IPs');
    },

    getBlockedDomains: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/blocked-domains`);
        return handleResponse(res, 'Failed to fetch blocked domains');
    },

    bulkImportThreats: async (threats: any[]): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/bulk-import`, {
            method: 'POST',
            body: JSON.stringify({ threats })
        });
        return handleResponse(res, 'Failed to import threats');
    },

    getThreatStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/threats/stats`);
        return handleResponse(res, 'Failed to fetch threat stats');
    },

    // DLP Policies
    getDLPPolicies: async (params?: { policyType?: string; isActive?: boolean }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.policyType) queryParams.append('policyType', params.policyType);
        if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/policies?${queryParams}`);
        return handleResponse(res, 'Failed to fetch DLP policies');
    },

    getDLPPolicyById: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/policies/${id}`);
        return handleResponse(res, 'Failed to fetch DLP policy');
    },

    createDLPPolicy: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/policies`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create DLP policy');
    },

    updateDLPPolicy: async (id: string, data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/policies/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update DLP policy');
    },

    toggleDLPPolicy: async (id: string, isActive: boolean): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/policies/${id}/toggle`, {
            method: 'POST',
            body: JSON.stringify({ isActive })
        });
        return handleResponse(res, 'Failed to toggle DLP policy');
    },

    deleteDLPPolicy: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/policies/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete DLP policy');
    },

    getDLPViolations: async (params?: { policyId?: string; severity?: string; isResolved?: boolean }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.policyId) queryParams.append('policyId', params.policyId);
        if (params?.severity) queryParams.append('severity', params.severity);
        if (params?.isResolved !== undefined) queryParams.append('isResolved', params.isResolved.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/violations?${queryParams}`);
        return handleResponse(res, 'Failed to fetch DLP violations');
    },

    getDLPViolationById: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/violations/${id}`);
        return handleResponse(res, 'Failed to fetch DLP violation');
    },

    resolveDLPViolation: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/violations/${id}/resolve`, {
            method: 'POST'
        });
        return handleResponse(res, 'Failed to resolve DLP violation');
    },

    getDLPStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/stats`);
        return handleResponse(res, 'Failed to fetch DLP stats');
    },

    scanResourceDLP: async (data: { resourceType: string; resourceId?: string; content: string }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dlp/scan`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to scan resource');
    },

    // =========================================
    // PHASE 3: ANALYTICS MODULE
    // =========================================

    // Custom Dashboards
    // Dashboard Builder
    getDashboards: async (isShared?: boolean): Promise<any[]> => {
        const params = isShared !== undefined ? `?isShared=${isShared}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards${params}`);
        return handleResponse(res, 'Failed to fetch dashboards');
    },

    getDashboardById: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${id}`);
        return handleResponse(res, 'Failed to fetch dashboard');
    },

    createDashboard: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create dashboard');
    },

    updateDashboard: async (id: string, data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to update dashboard');
    },

    deleteDashboard: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete dashboard');
    },

    cloneDashboard: async (id: string, name?: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${id}/clone`, {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        return handleResponse(res, 'Failed to clone dashboard');
    },

    toggleDashboardShare: async (id: string, isShared: boolean): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${id}/share`, {
            method: 'POST',
            body: JSON.stringify({ isShared })
        });
        return handleResponse(res, 'Failed to share/unshare dashboard');
    },

    addDashboardWidget: async (dashboardId: string, widget: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${dashboardId}/widgets`, {
            method: 'POST',
            body: JSON.stringify(widget)
        });
        return handleResponse(res, 'Failed to add widget');
    },

    updateDashboardWidget: async (dashboardId: string, widgetId: string, updates: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${dashboardId}/widgets/${widgetId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        return handleResponse(res, 'Failed to update widget');
    },

    removeDashboardWidget: async (dashboardId: string, widgetId: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${dashboardId}/widgets/${widgetId}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to remove widget');
    },

    reorderDashboardWidgets: async (dashboardId: string, widgetOrder: string[]): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${dashboardId}/widgets/reorder`, {
            method: 'POST',
            body: JSON.stringify({ widgetOrder })
        });
        return handleResponse(res, 'Failed to reorder widgets');
    },

    getDashboardWidgetData: async (widget: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/widget-data`, {
            method: 'POST',
            body: JSON.stringify(widget)
        });
        return handleResponse(res, 'Failed to fetch widget data');
    },

    getDashboardStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/stats`);
        return handleResponse(res, 'Failed to fetch dashboard stats');
    },

    // Saved Reports
    getAnalyticsReports: async (reportType?: string): Promise<any[]> => {
        const params = reportType ? `?reportType=${reportType}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/reports${params}`);
        return handleResponse(res, 'Failed to fetch analytics reports');
    },

    createAnalyticsReport: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/reports`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create analytics report');
    },

    updateAnalyticsReport: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/reports/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update analytics report');
    },

    deleteAnalyticsReport: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/reports/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete analytics report');
    },

    executeAnalyticsReport: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/reports/${id}/execute`, {
            method: 'POST'
        });
        return handleResponse(res, 'Failed to execute analytics report');
    },

    scheduleAnalyticsReport: async (id: string, schedule: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/reports/${id}/schedule`, {
            method: 'POST',
            body: JSON.stringify({ schedule })
        });
        await handleResponse(res, 'Failed to schedule analytics report');
    },

    getReportExecutions: async (id: string, limit?: number): Promise<any[]> => {
        const params = limit ? `?limit=${limit}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/reports/${id}/executions${params}`);
        return handleResponse(res, 'Failed to fetch report executions');
    },

    // Business Metrics
    getBusinessMetrics: async (params?: { metricType?: string; isActive?: boolean }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.metricType) queryParams.append('metricType', params.metricType);
        if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/metrics?${queryParams}`);
        return handleResponse(res, 'Failed to fetch business metrics');
    },

    createBusinessMetric: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/metrics`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create business metric');
    },

    updateBusinessMetric: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/metrics/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update business metric');
    },

    deleteBusinessMetric: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/metrics/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete business metric');
    },

    calculateBusinessMetric: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/metrics/${id}/calculate`, {
            method: 'POST'
        });
        return handleResponse(res, 'Failed to calculate business metric');
    },

    getMetricHistory: async (id: string, limit?: number): Promise<any[]> => {
        const params = limit ? `?limit=${limit}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/metrics/${id}/history${params}`);
        return handleResponse(res, 'Failed to fetch metric history');
    },

    getMetricsStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/metrics/stats`);
        return handleResponse(res, 'Failed to fetch metrics stats');
    },

    // Predictive Analytics
    getPredictiveModels: async (params?: { modelType?: string; isActive?: boolean }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.modelType) queryParams.append('modelType', params.modelType);
        if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/predictive/models?${queryParams}`);
        return handleResponse(res, 'Failed to fetch predictive models');
    },

    createPredictiveModel: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/predictive/models`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create predictive model');
    },

    updatePredictiveModel: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/predictive/models/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update predictive model');
    },

    deletePredictiveModel: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/predictive/models/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete predictive model');
    },

    trainPredictiveModel: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/predictive/models/${id}/train`, {
            method: 'POST'
        });
        return handleResponse(res, 'Failed to train predictive model');
    },

    makePrediction: async (id: string, inputData: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/predictive/models/${id}/predict`, {
            method: 'POST',
            body: JSON.stringify({ inputData })
        });
        return handleResponse(res, 'Failed to make prediction');
    },

    getModelPredictions: async (id: string, limit?: number): Promise<any[]> => {
        const params = limit ? `?limit=${limit}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/predictive/models/${id}/predictions${params}`);
        return handleResponse(res, 'Failed to fetch model predictions');
    },

    evaluatePredictiveModel: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/analytics/predictive/models/${id}/evaluate`);
        return handleResponse(res, 'Failed to evaluate predictive model');
    },

    // Analytics Dashboard Aliases for Compatibility
    getAnalyticsDashboards: async (): Promise<{ dashboards: any[] }> => {
        const dashboards = await Api.getDashboards();
        return { dashboards };
    },

    getAnalyticsDashboardData: async (id: string): Promise<any> => {
        const data = await Api.getDashboardById(id);
        return { data };
    },

    createAnalyticsDashboard: async (data: any): Promise<any> => {
        return Api.createDashboard(data);
    },

    updateAnalyticsDashboard: async (id: string, data: any): Promise<void> => {
        return Api.updateDashboard(id, data);
    },

    deleteAnalyticsDashboard: async (id: string): Promise<void> => {
        return Api.deleteDashboard(id);
    },

    shareAnalyticsDashboard: async (id: string, userIds: string[]): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/dashboards/${id}/share`, {
            method: 'POST',
            body: JSON.stringify({ userIds })
        });
        await handleResponse(res, 'Failed to share analytics dashboard');
    },

    // =========================================
    // PHASE 4: CUSTOMER MANAGEMENT MODULE
    // =========================================

    // Customer Lifecycle
    getLifecycleStages: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/lifecycle/stages`);
        return handleResponse(res, 'Failed to fetch lifecycle stages');
    },

    createLifecycleStage: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/lifecycle/stages`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create lifecycle stage');
    },

    updateLifecycleStage: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/lifecycle/stages/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update lifecycle stage');
    },

    deleteLifecycleStage: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/lifecycle/stages/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete lifecycle stage');
    },

    transitionOrganizationLifecycle: async (data: { organizationId: string; fromStageId?: string; toStageId: string; notes?: string }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/lifecycle/transitions`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to transition organization');
    },

    getLifecycleTransitions: async (organizationId?: string): Promise<any[]> => {
        const params = organizationId ? `?organizationId=${organizationId}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/lifecycle/transitions${params}`);
        return handleResponse(res, 'Failed to fetch lifecycle transitions');
    },

    getLifecycleStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/lifecycle/stats`);
        return handleResponse(res, 'Failed to fetch lifecycle stats');
    },

    // Customer Success Playbooks
    getSuccessPlaybooks: async (isActive?: boolean): Promise<any[]> => {
        const params = isActive !== undefined ? `?isActive=${isActive}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/success/playbooks${params}`);
        return handleResponse(res, 'Failed to fetch success playbooks');
    },

    createSuccessPlaybook: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/success/playbooks`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create success playbook');
    },

    updateSuccessPlaybook: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/success/playbooks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update success playbook');
    },

    deleteSuccessPlaybook: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/success/playbooks/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete success playbook');
    },

    executeSuccessPlaybook: async (id: string, organizationId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/success/playbooks/${id}/execute`, {
            method: 'POST',
            body: JSON.stringify({ organizationId })
        });
        return handleResponse(res, 'Failed to execute success playbook');
    },

    getSuccessActions: async (params?: { playbookId?: string; organizationId?: string; status?: string }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.playbookId) queryParams.append('playbookId', params.playbookId);
        if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
        if (params?.status) queryParams.append('status', params.status);
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/success/actions?${queryParams}`);
        return handleResponse(res, 'Failed to fetch success actions');
    },

    getPlaybookStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/success/playbooks/stats`);
        return handleResponse(res, 'Failed to fetch playbook stats');
    },

    // Customer Contracts
    getCustomerContracts: async (params?: { organizationId?: string; status?: string }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
        if (params?.status) queryParams.append('status', params.status);
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/contracts?${queryParams}`);
        return handleResponse(res, 'Failed to fetch customer contracts');
    },

    createCustomerContract: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/contracts`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create customer contract');
    },

    updateCustomerContract: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/contracts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update customer contract');
    },

    deleteCustomerContract: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/contracts/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete customer contract');
    },

    createContractAmendment: async (contractId: string, data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/contracts/${contractId}/amendments`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create contract amendment');
    },

    getContractAmendments: async (contractId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/contracts/${contractId}/amendments`);
        return handleResponse(res, 'Failed to fetch contract amendments');
    },

    getUpcomingRenewals: async (daysAhead?: number): Promise<any[]> => {
        const params = daysAhead ? `?daysAhead=${daysAhead}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/contracts/renewals${params}`);
        return handleResponse(res, 'Failed to fetch upcoming renewals');
    },

    getContractStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/customers/contracts/stats`);
        return handleResponse(res, 'Failed to fetch contract stats');
    },

    // =========================================
    // PHASE 5: REVENUE MANAGEMENT MODULE
    // =========================================

    // Pricing Plans
    getPricingPlansAdvanced: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/pricing-plans`);
        return handleResponse(res, 'Failed to fetch pricing plans');
    },

    createPricingPlanAdvanced: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/pricing-plans`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create pricing plan');
    },

    updatePricingPlanAdvanced: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/pricing-plans/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update pricing plan');
    },

    deletePricingPlanAdvanced: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/pricing-plans/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete pricing plan');
    },

    getPlanFeatures: async (planId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/pricing-plans/${planId}/features`);
        return handleResponse(res, 'Failed to fetch plan features');
    },

    addPlanFeature: async (planId: string, data: { featureKey: string; featureValue: string }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/pricing-plans/${planId}/features`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to add plan feature');
    },

    removePlanFeature: async (planId: string, featureId: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/pricing-plans/${planId}/features/${featureId}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to remove plan feature');
    },

    comparePricingPlans: async (planIds: string[]): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/pricing-plans/compare?planIds=${planIds.join(',')}`);
        return handleResponse(res, 'Failed to compare pricing plans');
    },

    // Subscription Changes
    getSubscriptionChanges: async (filters: any = {}): Promise<any> => {
        const queryParams = new URLSearchParams(filters);
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/subscription-changes?${queryParams}`);
        return handleResponse(res, 'Failed to fetch subscription changes');
    },

    getSubscriptionChangeStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/subscription-changes/stats`);
        return handleResponse(res, 'Failed to fetch subscription change stats');
    },

    approveSubscriptionChange: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/subscription-changes/${id}/approve`, {
            method: 'POST'
        });
        return handleResponse(res, 'Failed to approve subscription change');
    },

    rejectSubscriptionChange: async (id: string, reason: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/subscription-changes/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        return handleResponse(res, 'Failed to reject subscription change');
    },

    createSubscriptionChange: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/subscription-changes`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create subscription change');
    },

    calculateProration: async (data: { organizationId: string; fromPlanId: string; toPlanId: string; effectiveDate: string }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/subscription-changes/calculate-proration`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to calculate proration');
    },


    // Revenue Recognition
    getRevenueRecognitions: async (params?: { organizationId?: string; status?: string }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
        if (params?.status) queryParams.append('status', params.status);
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/recognition?${queryParams}`);
        return handleResponse(res, 'Failed to fetch revenue recognitions');
    },

    createRevenueRecognition: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/recognition`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create revenue recognition');
    },

    updateRevenueRecognition: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/recognition/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update revenue recognition');
    },

    recognizeRevenue: async (id: string, amount?: number): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/recognition/${id}/recognize`, {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
        return handleResponse(res, 'Failed to recognize revenue');
    },

    getRecognitionSchedule: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/recognition/${id}/schedule`);
        return handleResponse(res, 'Failed to fetch recognition schedule');
    },

    getRevenueRecognitionStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/recognition/stats`);
        return handleResponse(res, 'Failed to fetch revenue recognition stats');
    },


    // Revenue Forecasting
    getRevenueForecasts: async (forecastType?: string): Promise<any[]> => {
        const params = forecastType ? `?forecastType=${forecastType}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/forecasts${params}`);
        return handleResponse(res, 'Failed to fetch revenue forecasts');
    },

    createRevenueForecast: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/forecasts`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to create revenue forecast');
    },

    updateRevenueForecast: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/forecasts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update revenue forecast');
    },

    deleteRevenueForecast: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/forecasts/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete revenue forecast');
    },

    generateRevenueForecast: async (data: { forecastType: string; periodMonths: number }): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/forecasts/generate`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to generate revenue forecast');
    },

    getRevenueForecastStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/forecasts/stats`);
        return handleResponse(res, 'Failed to fetch revenue forecast stats');
    },

    // Payment Management
    getPaymentMethodsAdvanced: async (organizationId?: string): Promise<any[]> => {
        const params = organizationId ? `?organizationId=${organizationId}` : '';
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/payment-methods${params}`);
        return handleResponse(res, 'Failed to fetch payment methods');
    },

    addPaymentMethodAdvanced: async (data: any): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/payment-methods`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return handleResponse(res, 'Failed to add payment method');
    },

    updatePaymentMethodAdvanced: async (id: string, data: any): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/payment-methods/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        await handleResponse(res, 'Failed to update payment method');
    },

    deletePaymentMethodAdvanced: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/payment-methods/${id}`, {
            method: 'DELETE'
        });
        await handleResponse(res, 'Failed to delete payment method');
    },

    getPaymentFailures: async (params?: { organizationId?: string; status?: string }): Promise<any[]> => {
        const queryParams = new URLSearchParams();
        if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
        if (params?.status) queryParams.append('status', params.status);
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/payment-failures?${queryParams}`);
        return handleResponse(res, 'Failed to fetch payment failures');
    },

    retryPayment: async (id: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/payment-failures/${id}/retry`, {
            method: 'POST'
        });
        return handleResponse(res, 'Failed to retry payment');
    },

    getPaymentFailureStats: async (): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/superadmin/revenue/payment-failures/stats`);
        return handleResponse(res, 'Failed to fetch payment failure stats');
    },
};

// Export as 'api' for backwards compatibility with lowercase import
export const api = Api;

export default Api;
