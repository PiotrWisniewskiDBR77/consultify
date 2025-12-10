// Add to services/api.ts

// Webhooks
export const getWebhooks = async (): Promise<any[]> => {
    const response = await fetch(`${API_URL}/webhooks`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch webhooks');
    return response.json();
};

export const createWebhook = async (data: {
    name: string;
    url: string;
    events: string[];
    description?: string;
}): Promise<any> => {
    const response = await fetch(`${API_URL}/webhooks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create webhook');
    return response.json();
};

export const updateWebhook = async (id: string, data: Partial<{
    name: string;
    url: string;
    events: string[];
    description: string;
    isActive: boolean;
}>): Promise<any> => {
    const response = await fetch(`${API_URL}/webhooks/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update webhook');
    return response.json();
};

export const deleteWebhook = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/webhooks/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete webhook');
};

export const testWebhook = async (id: string): Promise<any> => {
    const response = await fetch(`${API_URL}/webhooks/${id}/test`, {
        method: 'POST',
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Failed to test webhook');
    return response.json();
};

// AI Training & Feedback
export const submitAIFeedback = async (data: {
    context: string;
    prompt: string;
    response: string;
    helpful: boolean;
    comment?: string;
}): Promise<any> => {
    const response = await fetch(`${API_URL}/ai-training`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to submit feedback');
    return response.json();
};

export const getAIFeedback = async (filters?: { helpful?: boolean; context?: string }): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.helpful !== undefined) params.append('helpful', String(filters.helpful));
    if (filters?.context) params.append('context', filters.context);

    const response = await fetch(`${API_URL}/ai-training?${params}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch AI feedback');
    return response.json();
};

export const getCustomPrompts = async (): Promise<any[]> => {
    const response = await fetch(`${API_URL}/ai-training/prompts`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch prompts');
    return response.json();
};

export const createCustomPrompt = async (data: {
    name: string;
    context: string;
    template: string;
    variables?: string[];
}): Promise<any> => {
    const response = await fetch(`${API_URL}/ai-training/prompts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create prompt');
    return response.json();
};

export const updateCustomPrompt = async (id: string, data: Partial<{
    name: string;
    template: string;
    variables: string[];
    isActive: boolean;
}>): Promise<any> => {
    const response = await fetch(`${API_URL}/ai-training/prompts/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update prompt');
    return response.json();
};

export const getAIFeedbackAnalytics = async (): Promise<any[]> => {
    const response = await fetch(`${API_URL}/ai-training/analytics`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return response.json();
};
