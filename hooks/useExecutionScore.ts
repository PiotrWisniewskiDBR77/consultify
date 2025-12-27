/**
 * useExecutionScore Hook - Personal execution metrics
 * Part of My Work Module PMO Upgrade
 */

import { useState, useCallback, useEffect } from 'react';
import { Api } from '../services/api';
import type { 
    ExecutionScore, 
    ExecutionScoreHistory, 
    Bottleneck,
    VelocityMetrics 
} from '../types/myWork';

interface UseExecutionScoreOptions {
    autoLoad?: boolean;
    historyDays?: number;
}

interface UseExecutionScoreReturn {
    // State
    score: ExecutionScore | null;
    history: ExecutionScoreHistory[];
    bottlenecks: Bottleneck[];
    velocity: VelocityMetrics | null;
    loading: boolean;
    error: Error | null;
    
    // Computed
    currentScore: number;
    trend: 'up' | 'down' | 'stable';
    streakDays: number;
    
    // Actions
    loadScore: () => Promise<void>;
    loadVelocity: (period?: 'week' | 'month') => Promise<void>;
    loadBottlenecks: () => Promise<void>;
    refresh: () => Promise<void>;
}

/**
 * Hook for managing execution score and metrics
 */
export function useExecutionScore(options: UseExecutionScoreOptions = {}): UseExecutionScoreReturn {
    const { autoLoad = true, historyDays = 30 } = options;
    
    const [score, setScore] = useState<ExecutionScore | null>(null);
    const [history, setHistory] = useState<ExecutionScoreHistory[]>([]);
    const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
    const [velocity, setVelocity] = useState<VelocityMetrics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    // Load execution score
    const loadScore = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await Api.get(`/my-work/execution-score?historyDays=${historyDays}`);
            
            if (response) {
                setScore(response.score || null);
                setHistory(response.history || []);
                setBottlenecks(response.bottlenecks || []);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load score');
            setError(error);
            console.error('useExecutionScore load error:', error);
        } finally {
            setLoading(false);
        }
    }, [historyDays]);
    
    // Load velocity metrics
    const loadVelocity = useCallback(async (period: 'week' | 'month' = 'week') => {
        try {
            const response = await Api.get(`/my-work/velocity?period=${period}`);
            
            if (response?.metrics) {
                setVelocity(response.metrics);
            }
        } catch (err) {
            console.error('Load velocity error:', err);
        }
    }, []);
    
    // Load bottlenecks
    const loadBottlenecks = useCallback(async () => {
        try {
            const response = await Api.get('/my-work/bottlenecks');
            
            if (response?.bottlenecks) {
                setBottlenecks(response.bottlenecks);
            }
        } catch (err) {
            console.error('Load bottlenecks error:', err);
        }
    }, []);
    
    // Refresh all data
    const refresh = useCallback(async () => {
        await Promise.all([
            loadScore(),
            loadVelocity(),
            loadBottlenecks()
        ]);
    }, [loadScore, loadVelocity, loadBottlenecks]);
    
    // Auto-load on mount
    useEffect(() => {
        if (autoLoad) {
            loadScore();
        }
    }, [loadScore, autoLoad]);
    
    // Computed values
    const currentScore = score?.current || 0;
    const trend = score?.trend || 'stable';
    const streakDays = score?.streak?.current || 0;
    
    return {
        // State
        score,
        history,
        bottlenecks,
        velocity,
        loading,
        error,
        
        // Computed
        currentScore,
        trend,
        streakDays,
        
        // Actions
        loadScore,
        loadVelocity,
        loadBottlenecks,
        refresh
    };
}

export default useExecutionScore;



