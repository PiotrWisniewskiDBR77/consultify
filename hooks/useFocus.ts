/**
 * useFocus Hook - Focus board state management
 * Part of My Work Module PMO Upgrade
 */

import { useState, useCallback, useEffect } from 'react';
import { Api } from '../services/api';
import type { 
    FocusTask, 
    TimeBlock, 
    FocusBoard,
    FocusSuggestion 
} from '../types/myWork';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface UseFocusOptions {
    date?: Date;
    autoLoad?: boolean;
}

interface UseFocusReturn {
    // State
    board: FocusBoard | null;
    tasks: FocusTask[];
    suggestions: FocusSuggestion | null;
    loading: boolean;
    error: Error | null;
    
    // Computed
    completedCount: number;
    totalCount: number;
    executionScore: number;
    canAddMore: boolean;
    
    // Actions
    loadFocus: () => Promise<void>;
    addToFocus: (taskId: string, timeBlock?: TimeBlock) => Promise<void>;
    removeFromFocus: (taskId: string) => Promise<void>;
    reorderTasks: (fromIndex: number, toIndex: number) => Promise<void>;
    completeTask: (taskId: string, completed?: boolean) => Promise<void>;
    requestAISuggestions: () => Promise<void>;
    setDate: (date: Date) => void;
}

const MAX_FOCUS_TASKS = 5;

/**
 * Hook for managing daily focus tasks
 */
export function useFocus(options: UseFocusOptions = {}): UseFocusReturn {
    const { date: initialDate, autoLoad = true } = options;
    const { t } = useTranslation();
    
    const [currentDate, setCurrentDate] = useState<Date>(initialDate || new Date());
    const [board, setBoard] = useState<FocusBoard | null>(null);
    const [suggestions, setSuggestions] = useState<FocusSuggestion | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    const dateString = currentDate.toISOString().split('T')[0];
    
    // Load focus data
    const loadFocus = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await Api.get(`/my-work/focus?date=${dateString}`);
            
            if (response?.board) {
                setBoard(response.board);
            }
            if (response?.suggestions) {
                setSuggestions(response.suggestions);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load focus');
            setError(error);
            console.error('useFocus load error:', error);
        } finally {
            setLoading(false);
        }
    }, [dateString]);
    
    // Auto-load on mount and date change
    useEffect(() => {
        if (autoLoad) {
            loadFocus();
        }
    }, [loadFocus, autoLoad]);
    
    // Add task to focus
    const addToFocus = useCallback(async (taskId: string, timeBlock: TimeBlock = 'morning') => {
        if (board && board.tasks.length >= MAX_FOCUS_TASKS) {
            toast.error(t('myWork.focus.maxTasksReached', 'Maximum 5 focus tasks'));
            return;
        }
        
        try {
            const response = await Api.post('/my-work/focus/add', {
                taskId,
                date: dateString,
                timeBlock
            });
            
            if (response?.board) {
                setBoard(response.board);
                toast.success(t('myWork.focus.taskAdded', 'Added to focus'));
            }
        } catch (err) {
            console.error('Add to focus error:', err);
            toast.error(t('myWork.focus.error', 'Failed to add task'));
            throw err;
        }
    }, [board, dateString, t]);
    
    // Remove task from focus
    const removeFromFocus = useCallback(async (taskId: string) => {
        try {
            // Optimistic update
            setBoard(prev => prev ? {
                ...prev,
                tasks: prev.tasks.filter(t => t.taskId !== taskId)
            } : null);
            
            const response = await Api.delete(`/my-work/focus/${taskId}?date=${dateString}`);
            
            if (response?.board) {
                setBoard(response.board);
            }
            
            toast.success(t('myWork.focus.taskRemoved', 'Removed from focus'));
        } catch (err) {
            console.error('Remove from focus error:', err);
            loadFocus(); // Revert
            toast.error(t('myWork.focus.error', 'Failed to remove task'));
            throw err;
        }
    }, [dateString, loadFocus, t]);
    
    // Reorder tasks
    const reorderTasks = useCallback(async (fromIndex: number, toIndex: number) => {
        if (!board) return;
        
        // Optimistic update
        const tasks = [...board.tasks];
        const [removed] = tasks.splice(fromIndex, 1);
        tasks.splice(toIndex, 0, removed);
        
        setBoard(prev => prev ? { ...prev, tasks } : null);
        
        try {
            await Api.post('/my-work/focus/reorder', {
                date: dateString,
                fromIndex,
                toIndex
            });
        } catch (err) {
            console.error('Reorder error:', err);
            loadFocus(); // Revert
            toast.error(t('myWork.focus.error', 'Failed to reorder'));
        }
    }, [board, dateString, loadFocus, t]);
    
    // Complete task
    const completeTask = useCallback(async (taskId: string, completed = true) => {
        // Optimistic update
        setBoard(prev => prev ? {
            ...prev,
            tasks: prev.tasks.map(t => 
                t.taskId === taskId 
                    ? { ...t, isCompleted: completed, completedAt: completed ? new Date().toISOString() : undefined }
                    : t
            )
        } : null);
        
        try {
            await Api.post('/my-work/focus/complete', {
                taskId,
                date: dateString,
                completed
            });
            
            // Also update the task status
            await Api.updateTask(taskId, { 
                status: completed ? 'completed' : 'todo' 
            });
            
            toast.success(completed 
                ? t('myWork.focus.taskCompleted', 'Task completed!') 
                : t('myWork.focus.taskReopened', 'Task reopened')
            );
        } catch (err) {
            console.error('Complete task error:', err);
            loadFocus(); // Revert
            toast.error(t('myWork.focus.error', 'Failed to update task'));
        }
    }, [dateString, loadFocus, t]);
    
    // Request AI suggestions
    const requestAISuggestions = useCallback(async () => {
        try {
            setLoading(true);
            const response = await Api.post('/my-work/focus/ai-suggest', {
                date: dateString
            });
            
            if (response?.suggestions) {
                setSuggestions(response.suggestions);
                toast.success(t('myWork.focus.aiSuggestionsReady', 'AI suggestions ready!'));
            }
        } catch (err) {
            console.error('AI suggestions error:', err);
            toast.error(t('myWork.focus.aiError', 'Failed to get suggestions'));
        } finally {
            setLoading(false);
        }
    }, [dateString, t]);
    
    // Set date
    const setDate = useCallback((date: Date) => {
        setCurrentDate(date);
    }, []);
    
    // Computed values
    const tasks = board?.tasks || [];
    const completedCount = tasks.filter(t => t.isCompleted).length;
    const totalCount = tasks.length;
    const executionScore = board?.executionScore || 0;
    const canAddMore = totalCount < MAX_FOCUS_TASKS;
    
    return {
        // State
        board,
        tasks,
        suggestions,
        loading,
        error,
        
        // Computed
        completedCount,
        totalCount,
        executionScore,
        canAddMore,
        
        // Actions
        loadFocus,
        addToFocus,
        removeFromFocus,
        reorderTasks,
        completeTask,
        requestAISuggestions,
        setDate
    };
}

export default useFocus;



