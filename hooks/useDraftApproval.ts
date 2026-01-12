/**
 * useDraftApproval Hook
 *
 * Manages state and actions for the Draft-Review-Approve pattern.
 * Provides methods for fetching, approving, rejecting, and modifying AI drafts.
 */

import { useCallback, useEffect, useState } from 'react';

import api from '../services/api';

export interface AIDraft {
    id: string;
    draft_type: string;
    target_entity_type?: string;
    target_entity_id?: string;
    target_field?: string;
    original_content?: any;
    suggested_content: any;
    diff_data?: {
        hasChanges: boolean;
        originalLength: number;
        suggestedLength: number;
        changePercent: number;
    };
    confidence_score: number;
    reasoning?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'EXPIRED';
    model_used?: string;
    created_at: string;
    expires_at?: string;
    isExpired?: boolean;
}

export interface DraftStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    modified: number;
    avg_confidence: number;
    avg_review_time_minutes: number;
    acceptanceRate: number | null;
}

interface UseDraftApprovalOptions {
    autoRefresh?: boolean;
    refreshInterval?: number;
    projectId?: string;
    draftType?: string;
}

interface UseDraftApprovalReturn {
    drafts: AIDraft[];
    loading: boolean;
    error: string | null;
    stats: DraftStats | null;
    pendingCount: number;
    fetchDrafts: () => Promise<void>;
    fetchStats: () => Promise<void>;
    approveDraft: (draftId: string, notes?: string, modifications?: any) => Promise<boolean>;
    rejectDraft: (draftId: string, notes?: string) => Promise<boolean>;
    getDraftsForEntity: (entityType: string, entityId: string) => Promise<AIDraft[]>;
    createDraft: (draftData: Partial<AIDraft>) => Promise<AIDraft | null>;
}

export function useDraftApproval(options: UseDraftApprovalOptions = {}): UseDraftApprovalReturn {
    const { autoRefresh = false, refreshInterval = 30000, projectId, draftType } = options;

    const [drafts, setDrafts] = useState<AIDraft[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<DraftStats | null>(null);

    /**
     * Fetch pending drafts
     */
    const fetchDrafts = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (projectId) params.append('projectId', projectId);
            if (draftType) params.append('draftType', draftType);

            const response = await api.get(`/ai-drafts?${params.toString()}`);

            if (response.data.success) {
                setDrafts(response.data.drafts);
            } else {
                throw new Error(response.data.error || 'Failed to fetch drafts');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch drafts');
            console.error('[useDraftApproval] fetchDrafts error:', err);
        } finally {
            setLoading(false);
        }
    }, [projectId, draftType]);

    /**
     * Fetch draft statistics
     */
    const fetchStats = useCallback(async () => {
        try {
            const response = await api.get('/ai-drafts/user/stats');

            if (response.data.success) {
                setStats(response.data.stats);
            }
        } catch (err) {
            console.error('[useDraftApproval] fetchStats error:', err);
        }
    }, []);

    /**
     * Approve a draft (optionally with modifications)
     */
    const approveDraft = useCallback(async (draftId: string, notes?: string, modifications?: any): Promise<boolean> => {
        try {
            const response = await api.patch(`/ai-drafts/${draftId}/approve`, {
                notes,
                modifications,
            });

            if (response.data.success) {
                // Remove from local state
                setDrafts((prev) => prev.filter((d) => d.id !== draftId));
                return true;
            }
            return false;
        } catch (err: any) {
            console.error('[useDraftApproval] approveDraft error:', err);
            setError(err.message || 'Failed to approve draft');
            return false;
        }
    }, []);

    /**
     * Reject a draft
     */
    const rejectDraft = useCallback(async (draftId: string, notes?: string): Promise<boolean> => {
        try {
            const response = await api.patch(`/ai-drafts/${draftId}/reject`, { notes });

            if (response.data.success) {
                // Remove from local state
                setDrafts((prev) => prev.filter((d) => d.id !== draftId));
                return true;
            }
            return false;
        } catch (err: any) {
            console.error('[useDraftApproval] rejectDraft error:', err);
            setError(err.message || 'Failed to reject draft');
            return false;
        }
    }, []);

    /**
     * Get drafts for a specific entity
     */
    const getDraftsForEntity = useCallback(async (entityType: string, entityId: string): Promise<AIDraft[]> => {
        try {
            const response = await api.get(`/ai-drafts/entity/${entityType}/${entityId}`);

            if (response.data.success) {
                return response.data.drafts;
            }
            return [];
        } catch (err) {
            console.error('[useDraftApproval] getDraftsForEntity error:', err);
            return [];
        }
    }, []);

    /**
     * Create a new draft
     */
    const createDraft = useCallback(async (draftData: Partial<AIDraft>): Promise<AIDraft | null> => {
        try {
            const response = await api.post('/ai-drafts', draftData);

            if (response.data.success) {
                // Add to local state
                const newDraft = response.data.draft;
                setDrafts((prev) => [newDraft, ...prev]);
                return newDraft;
            }
            return null;
        } catch (err: any) {
            console.error('[useDraftApproval] createDraft error:', err);
            setError(err.message || 'Failed to create draft');
            return null;
        }
    }, []);

    // Auto-refresh effect
    useEffect(() => {
        void fetchDrafts();
        void fetchStats();

        if (autoRefresh && refreshInterval > 0) {
            const interval = setInterval(() => {
                void fetchDrafts();
            }, refreshInterval);

            return () => clearInterval(interval);
        }
        return undefined;
    }, [autoRefresh, refreshInterval, fetchDrafts, fetchStats]);

    return {
        drafts,
        loading,
        error,
        stats,
        pendingCount: drafts.filter((d) => d.status === 'PENDING').length,
        fetchDrafts,
        fetchStats,
        approveDraft,
        rejectDraft,
        getDraftsForEntity,
        createDraft,
    };
}

export default useDraftApproval;
