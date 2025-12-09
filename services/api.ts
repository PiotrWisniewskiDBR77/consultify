import { User, SessionMode, FullSession } from '../types';

const API_URL = 'http://localhost:3001/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

export const Api = {
    // --- AUTH ---
    login: async (email: string, password: string): Promise<User> => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        localStorage.setItem('token', data.token);
        return data.user;
    },

    register: async (userData: any): Promise<User> => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        localStorage.setItem('token', data.token);
        return data.user;
    },

    logout: () => {
        localStorage.removeItem('token');
    },

    // --- USERS (Admin) ---
    getUsers: async (): Promise<User[]> => {
        const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },

    addUser: async (user: any): Promise<User> => {
        const res = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(user)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add user');
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

    deleteUser: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete user');
    },

    // --- SESSIONS ---
    getSession: async (userId: string, type: SessionMode, projectId?: string): Promise<any> => {
        let url = `${API_URL}/sessions/${userId}?type=${type}`;
        if (projectId) url += `&projectId=${projectId}`;

        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data;
    },

    saveSession: async (userId: string, type: SessionMode, data: any, projectId?: string): Promise<void> => {
        if (!userId) return;
        await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId, type, data, projectId })
        });
    },

    // --- AI ---
    chat: async (message: string, history: any[]): Promise<string> => {
        const res = await fetch(`${API_URL}/ai/chat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ message, history })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI Error');
        return data.text;
    },

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

    updateOrganization: async (id: string, updates: { plan?: string; status?: string }): Promise<void> => {
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

    // --- PROJECTS ---
    getProjects: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/projects`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch projects');
        return res.json();
    },

    createProject: async (data: { name: string; ownerId?: string }): Promise<any> => {
        const res = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create project');
        return json;
    },

    deleteProject: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/projects/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete project');
    },

    // --- LLM MANAGEMENT ---
    getLLMProviders: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/llm/providers`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch LLM providers');
        return res.json();
    },

    addLLMProvider: async (provider: any): Promise<void> => {
        const res = await fetch(`${API_URL}/llm/providers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(provider)
        });
        if (!res.ok) throw new Error('Failed to add provider');
    },

    updateLLMProvider: async (id: string, provider: any): Promise<void> => {
        const res = await fetch(`${API_URL}/llm/providers/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(provider)
        });
        if (!res.ok) throw new Error('Failed to update provider');
    },

    deleteLLMProvider: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/llm/providers/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete provider');
    },

    getPublicLLMProviders: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/llm/providers/public`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch public LLM providers');
        return res.json();
    },

    testOllamaConnection: async (endpoint: string): Promise<{ success: boolean; message?: string; models?: any[]; error?: string }> => {
        const res = await fetch(`${API_URL}/llm/test-ollama`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ endpoint })
        });
        return res.json();
    },

    getOllamaModels: async (endpoint: string): Promise<any[]> => {
        const res = await fetch(`${API_URL}/llm/ollama-models?endpoint=${encodeURIComponent(endpoint)}`, {
            headers: getHeaders()
        });
        if (!res.ok) return [];
        return res.json();
    },

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
    }
};
