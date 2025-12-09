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
    getSession: async (userId: string, type: SessionMode): Promise<any> => {
        const res = await fetch(`${API_URL}/sessions/${userId}?type=${type}`, { headers: getHeaders() });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data;
    },

    saveSession: async (userId: string, type: SessionMode, data: any): Promise<void> => {
        if (!userId) return;
        await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId, type, data })
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
    }
};
