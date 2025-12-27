/**
 * useInbox Hook - Inbox triage state management
 * Part of My Work Module PMO Upgrade
 */

import { useState, useCallback, useEffect } from 'react';
import { Api } from '../services/api';
import type { 
    InboxItem, 
    InboxSummary, 
    TriageAction,
    TriageParams 
} from '../types/myWork';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface UseInboxOptions {
    autoLoad?: boolean;
    includeTriaged?: boolean;
    limit?: number;
}

interface UseInboxReturn {
    // State
    items: InboxItem[];
    summary: InboxSummary | null;
    loading: boolean;
    error: Error | null;
    selectedIds: Set<string>;
    
    // Computed
    totalCount: number;
    criticalCount: number;
    hasSelection: boolean;
    
    // Actions
    loadInbox: () => Promise<void>;
    triageItem: (itemId: string, action: TriageAction, params?: TriageParams[TriageAction]) => Promise<void>;
    bulkTriage: (action: TriageAction, params?: TriageParams[TriageAction]) => Promise<void>;
    selectItem: (itemId: string) => void;
    selectAll: () => void;
    clearSelection: () => void;
    toggleSelection: (itemId: string) => void;
}

/**
 * Hook for managing inbox items and triage
 */
export function useInbox(options: UseInboxOptions = {}): UseInboxReturn {
    const { autoLoad = true, includeTriaged = false, limit = 50 } = options;
    const { t } = useTranslation();
    
    const [items, setItems] = useState<InboxItem[]>([]);
    const [summary, setSummary] = useState<InboxSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // Load inbox items
    const loadInbox = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const params = new URLSearchParams();
            if (includeTriaged) params.append('includeTriaged', 'true');
            params.append('limit', limit.toString());
            
            const response = await Api.get(`/my-work/inbox?${params.toString()}`);
            
            if (response) {
                setItems(response.items || []);
                setSummary(response.summary || null);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load inbox');
            setError(error);
            console.error('useInbox load error:', error);
        } finally {
            setLoading(false);
        }
    }, [includeTriaged, limit]);
    
    // Auto-load on mount
    useEffect(() => {
        if (autoLoad) {
            loadInbox();
        }
    }, [loadInbox, autoLoad]);
    
    // Triage single item
    const triageItem = useCallback(async (
        itemId: string, 
        action: TriageAction, 
        params?: TriageParams[TriageAction]
    ) => {
        try {
            // Optimistic update
            setItems(prev => prev.filter(item => item.id !== itemId));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
            });
            
            await Api.post(`/my-work/inbox/${itemId}/triage`, { action, params });
            
            toast.success(t('myWork.inbox.triaged', 'Item processed'));
        } catch (err) {
            console.error('Triage error:', err);
            loadInbox(); // Revert
            toast.error(t('myWork.inbox.error', 'Failed to process'));
            throw err;
        }
    }, [loadInbox, t]);
    
    // Bulk triage
    const bulkTriage = useCallback(async (
        action: TriageAction, 
        params?: TriageParams[TriageAction]
    ) => {
        if (selectedIds.size === 0) return;
        
        const ids = Array.from(selectedIds);
        
        try {
            // Optimistic update
            setItems(prev => prev.filter(item => !selectedIds.has(item.id)));
            setSelectedIds(new Set());
            
            await Api.post('/my-work/inbox/bulk-triage', {
                itemIds: ids,
                action,
                params
            });
            
            toast.success(t('myWork.inbox.bulkTriaged', `${ids.length} items processed`));
        } catch (err) {
            console.error('Bulk triage error:', err);
            loadInbox(); // Revert
            toast.error(t('myWork.inbox.error', 'Failed to process'));
            throw err;
        }
    }, [selectedIds, loadInbox, t]);
    
    // Selection management
    const selectItem = useCallback((itemId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.add(itemId);
            return next;
        });
    }, []);
    
    const selectAll = useCallback(() => {
        setSelectedIds(new Set(items.map(i => i.id)));
    }, [items]);
    
    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);
    
    const toggleSelection = useCallback((itemId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    }, []);
    
    // Computed values
    const untriagedItems = items.filter(i => !i.triaged);
    const totalCount = untriagedItems.length;
    const criticalCount = untriagedItems.filter(i => i.urgency === 'critical').length;
    const hasSelection = selectedIds.size > 0;
    
    return {
        // State
        items: untriagedItems,
        summary,
        loading,
        error,
        selectedIds,
        
        // Computed
        totalCount,
        criticalCount,
        hasSelection,
        
        // Actions
        loadInbox,
        triageItem,
        bulkTriage,
        selectItem,
        selectAll,
        clearSelection,
        toggleSelection
    };
}

export default useInbox;



