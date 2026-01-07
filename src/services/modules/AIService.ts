import { API_URL, getHeaders, handleResponse } from '../apiUtils';

export const AIService = {
    // Send chat message
    chat: async (data: {
        message: string;
        conversationId?: string;
        context?: any;
    }): Promise<any> => {
        const res = await fetch(`${API_URL}/ai/chat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res, 'Failed to send message');
    },

    // Get AI providers
    getProviders: async (): Promise<any[]> => {
        const res = await fetch(`${API_URL}/ai/providers`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch providers');
    },

    // Get AI usage
    getUsage: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/ai/usage`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch usage');
    },

    // Generate content
    generate: async (data: { type: string; input: any }): Promise<any> => {
        const res = await fetch(`${API_URL}/ai/generate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(res, 'Failed to generate content');
    },

    // Get AI settings
    getSettings: async (): Promise<any> => {
        const res = await fetch(`${API_URL}/ai/settings`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch settings');
    },

    // Update AI settings
    updateSettings: async (settings: any): Promise<any> => {
        const res = await fetch(`${API_URL}/ai/settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(settings),
        });
        return handleResponse(res, 'Failed to update settings');
    },
};
