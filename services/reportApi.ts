import { Report, ReportBlock, BlockType } from '../types';
const API_URL = 'http://127.0.0.1:3005/api';
const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};
export const reportApi = {
    // Get Report by Project ID
    getReport: async (projectId: string): Promise<Report | null> => {
        try {
            const res = await fetch(`${API_URL}/reports/project/${projectId}`, { headers: getHeaders() });
            if (!res.ok) return null;
            return res.json();
        } catch (error) {
            console.error('Failed to get report', error);
            return null;
        }
    },
    // Create Draft Report
    createDraft: async (projectId: string, title: string, sources: unknown[] = []): Promise<Report> => {
        const res = await fetch(`${API_URL}/reports/draft`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ projectId, title, sources })
        });
        if (!res.ok) throw new Error('Failed to create draft');
        return res.json();
    },
    // Add Block
    addBlock: async (reportId: string, block: { type: BlockType; title?: string; module?: string; content?: unknown; position: number; meta?: unknown }): Promise<{ id: string }> => {
        const res = await fetch(`${API_URL}/reports/${reportId}/blocks`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(block)
        });
        if (!res.ok) throw new Error('Failed to add block');
        return res.json();
    },
    // Update Block
    updateBlock: async (reportId: string, blockId: string, updates: Partial<ReportBlock>): Promise<void> => {
        const res = await fetch(`${API_URL}/reports/${reportId}/blocks/${blockId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update block');
    },
    // Reorder Blocks
    reorderBlocks: async (reportId: string, blockOrder: string[]): Promise<void> => {
        const res = await fetch(`${API_URL}/reports/${reportId}/reorder`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ blockOrder })
        });
        if (!res.ok) throw new Error('Failed to reorder blocks');
    },
    // Regenerate Block (AI)
    regenerateBlock: async (reportId: string, blockId: string, instructions?: string): Promise<ReportBlock> => {
        const res = await fetch(`${API_URL}/reports/${reportId}/blocks/${blockId}/regenerate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ instructions })
        });
        if (!res.ok) throw new Error('Failed to regenerate block');
        return res.json();
    },
    // Generate Report (AI) - Placeholder for now
    generateReport: async (reportId: string, instructions?: string): Promise<void> => {
        // Implement AI generation endpoint
        const res = await fetch(`${API_URL}/reports/${reportId}/generate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ instructions })
        });
        if (!res.ok) throw new Error('Failed to generate report');
    }
};