/**
 * useAssessmentAI Hook
 * Provides AI assistance functions for assessment forms
 * Integrates with backend AI services
 */

import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

// Types
export interface AISuggestion {
    suggestion?: string;
    evidence?: string[];
    suggestedTarget?: number;
    reasoning?: string;
    mode: 'AI_GENERATED' | 'FALLBACK' | 'UNCHANGED' | 'AI_CORRECTED' | 'AI_COMPLETED';
    error?: string;
}

export interface AIValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}

export interface AIInsight {
    type: 'STRENGTH' | 'PRIORITY_GAP' | 'RISK' | 'OPPORTUNITY' | 'SUMMARY';
    priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    title: string;
    description: string;
    axis?: string;
    axes?: string[];
}

export interface AIGapAnalysis {
    axisId: string;
    axisName: string;
    currentScore: number;
    targetScore: number;
    gap: number;
    gapSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
    pathway: Array<{
        level: number;
        description: string;
        estimatedMonths: number;
        keyActivities: string[];
    }>;
    estimatedTotalMonths: number;
    aiRecommendations: Array<{
        title: string;
        description: string;
        priority: string;
        timeframe: string;
    }>;
}

export interface AIExecutiveSummary {
    summary: string;
    metrics: {
        averageMaturity: string;
        averageTarget: string;
        overallGap: string;
        axesAssessed: number;
    };
    topStrengths: string[];
    priorityGaps: string[];
    mode: 'AI_GENERATED' | 'FALLBACK';
}

export interface AIInitiative {
    name: string;
    description: string;
    targetAxes: string[];
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    estimatedDuration: string;
    estimatedBudget: string;
    expectedImpact: string;
    dependencies?: string[];
}

export interface QuickAction {
    id: string;
    label: string;
    icon: string;
    action: string;
    primary?: boolean;
}

// Hook state
interface UseAssessmentAIState {
    isLoading: boolean;
    error: string | null;
    lastSuggestion: AISuggestion | null;
    lastValidation: AIValidation | null;
    insights: AIInsight[];
    gapAnalysis: AIGapAnalysis | null;
    executiveSummary: AIExecutiveSummary | null;
    initiatives: AIInitiative[];
    quickActions: QuickAction[];
}

// Hook return type
interface UseAssessmentAIReturn extends UseAssessmentAIState {
    // Suggestions
    suggestJustification: (axisId: string, score: number, existingText?: string) => Promise<AISuggestion>;
    suggestEvidence: (axisId: string, score: number) => Promise<AISuggestion>;
    suggestTarget: (axisId: string, currentScore: number, ambitionLevel?: string) => Promise<AISuggestion>;
    correctText: (text: string, language?: string) => Promise<AISuggestion>;
    autocomplete: (partialText: string, axisId: string, score: number) => Promise<AISuggestion>;

    // Validation
    validateField: (fieldType: string, value: unknown, context?: object) => Promise<AIValidation>;
    validateConsistency: () => Promise<AIValidation>;

    // Analysis
    getGuidance: (axisId: string, currentScore: number, targetScore?: number) => Promise<unknown>;
    generateGapAnalysis: (axisId: string, currentScore: number, targetScore: number) => Promise<AIGapAnalysis>;
    getInsights: () => Promise<AIInsight[]>;
    getClarifyingQuestion: (axisId: string, score: number) => Promise<{ question: string }>;

    // Reports
    generateExecutiveSummary: (options?: object) => Promise<AIExecutiveSummary>;
    generateStakeholderView: (stakeholderRole: string) => Promise<unknown>;

    // Initiatives
    generateInitiatives: (constraints?: object) => Promise<AIInitiative[]>;
    prioritizeInitiatives: (initiatives: AIInitiative[], criteria?: object) => Promise<unknown>;
    estimateROI: (initiative: AIInitiative) => Promise<unknown>;

    // Form helpers
    getQuickActions: (formState: object) => Promise<QuickAction[]>;
    getContextualHelp: (formState: object) => Promise<unknown>;
    fillMissingFields: (strategy?: string) => Promise<unknown>;
    reviewJustifications: () => Promise<unknown>;

    // Utilities
    clearError: () => void;
    clearSuggestion: () => void;
}

// API base URL
const API_BASE = '/api/assessment';

// Hook implementation
export function useAssessmentAI(projectId: string): UseAssessmentAIReturn {
    const [state, setState] = useState<UseAssessmentAIState>({
        isLoading: false,
        error: null,
        lastSuggestion: null,
        lastValidation: null,
        insights: [],
        gapAnalysis: null,
        executiveSummary: null,
        initiatives: [],
        quickActions: []
    });

    const abortControllerRef = useRef<AbortController | null>(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    // Helper to make API calls
    const apiCall = useCallback(async <T>(
        endpoint: string,
        method: 'GET' | 'POST' = 'POST',
        body?: object
    ): Promise<T> => {
        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const url = `${API_BASE}/${projectId}${endpoint}`;
            const options: RequestInit = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                signal: abortControllerRef.current.signal
            };

            if (body && method === 'POST') {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(url, options);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            setState(prev => ({ ...prev, isLoading: false }));
            return data as T;
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                throw err; // Re-throw abort errors
            }
            const errorMessage = (err as Error).message || 'Unknown error';
            setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
            throw err;
        }
    }, [projectId, token]);

    // =========================================================================
    // SUGGESTION METHODS
    // =========================================================================

    const suggestJustification = useCallback(async (
        axisId: string,
        score: number,
        existingText?: string
    ): Promise<AISuggestion> => {
        const result = await apiCall<AISuggestion>('/ai/suggest-justification', 'POST', {
            axisId,
            score,
            existingJustification: existingText,
            language: 'pl'
        });
        setState(prev => ({ ...prev, lastSuggestion: result }));
        return result;
    }, [apiCall]);

    const suggestEvidence = useCallback(async (
        axisId: string,
        score: number
    ): Promise<AISuggestion> => {
        const result = await apiCall<AISuggestion>('/ai/suggest-evidence', 'POST', {
            axisId,
            score,
            language: 'pl'
        });
        setState(prev => ({ ...prev, lastSuggestion: result }));
        return result;
    }, [apiCall]);

    const suggestTarget = useCallback(async (
        axisId: string,
        currentScore: number,
        ambitionLevel: string = 'balanced'
    ): Promise<AISuggestion> => {
        const result = await apiCall<AISuggestion>('/ai/suggest-target', 'POST', {
            axisId,
            currentScore,
            ambitionLevel
        });
        setState(prev => ({ ...prev, lastSuggestion: result }));
        return result;
    }, [apiCall]);

    const correctText = useCallback(async (
        text: string,
        language: string = 'pl'
    ): Promise<AISuggestion> => {
        const result = await apiCall<AISuggestion>('/ai/correct-text', 'POST', {
            text,
            targetLanguage: language
        });
        setState(prev => ({ ...prev, lastSuggestion: result }));
        return result;
    }, [apiCall]);

    const autocomplete = useCallback(async (
        partialText: string,
        axisId: string,
        score: number
    ): Promise<AISuggestion> => {
        const result = await apiCall<AISuggestion>('/ai/autocomplete', 'POST', {
            partialText,
            axisId,
            score,
            language: 'pl'
        });
        setState(prev => ({ ...prev, lastSuggestion: result }));
        return result;
    }, [apiCall]);

    // =========================================================================
    // VALIDATION METHODS
    // =========================================================================

    const validateField = useCallback(async (
        fieldType: string,
        value: unknown,
        context: object = {}
    ): Promise<AIValidation> => {
        const result = await apiCall<AIValidation>('/ai/validate-field', 'POST', {
            fieldType,
            value,
            ...context
        });
        setState(prev => ({ ...prev, lastValidation: result }));
        return result;
    }, [apiCall]);

    const validateConsistency = useCallback(async (): Promise<AIValidation> => {
        const result = await apiCall<{ hasInconsistencies: boolean; inconsistencies: Array<{ message: string }> }>(
            '/ai/validate',
            'POST'
        );
        const validation: AIValidation = {
            isValid: !result.hasInconsistencies,
            errors: [],
            warnings: result.inconsistencies?.map(i => i.message) || [],
            suggestions: []
        };
        setState(prev => ({ ...prev, lastValidation: validation }));
        return validation;
    }, [apiCall]);

    // =========================================================================
    // ANALYSIS METHODS
    // =========================================================================

    const getGuidance = useCallback(async (
        axisId: string,
        currentScore: number,
        targetScore?: number
    ) => {
        return apiCall('/ai/guidance', 'POST', {
            axisId,
            currentScore,
            targetScore: targetScore || currentScore + 1
        });
    }, [apiCall]);

    const generateGapAnalysis = useCallback(async (
        axisId: string,
        currentScore: number,
        targetScore: number
    ): Promise<AIGapAnalysis> => {
        const result = await apiCall<AIGapAnalysis>(`/ai/gap/${axisId}`, 'POST', {
            currentScore,
            targetScore
        });
        setState(prev => ({ ...prev, gapAnalysis: result }));
        return result;
    }, [apiCall]);

    const getInsights = useCallback(async (): Promise<AIInsight[]> => {
        const result = await apiCall<{ insights: AIInsight[] }>('/ai/insights', 'GET');
        setState(prev => ({ ...prev, insights: result.insights }));
        return result.insights;
    }, [apiCall]);

    const getClarifyingQuestion = useCallback(async (
        axisId: string,
        score: number
    ): Promise<{ question: string }> => {
        return apiCall('/ai/clarify', 'POST', { axisId, score });
    }, [apiCall]);

    // =========================================================================
    // REPORT METHODS
    // =========================================================================

    const generateExecutiveSummary = useCallback(async (
        options: object = {}
    ): Promise<AIExecutiveSummary> => {
        const result = await apiCall<AIExecutiveSummary>('/ai/executive-summary', 'POST', options);
        setState(prev => ({ ...prev, executiveSummary: result }));
        return result;
    }, [apiCall]);

    const generateStakeholderView = useCallback(async (
        stakeholderRole: string
    ) => {
        return apiCall('/ai/stakeholder-view', 'POST', {
            stakeholderRole,
            language: 'pl'
        });
    }, [apiCall]);

    // =========================================================================
    // INITIATIVE METHODS
    // =========================================================================

    const generateInitiatives = useCallback(async (
        constraints: object = {}
    ): Promise<AIInitiative[]> => {
        const result = await apiCall<{ initiatives: AIInitiative[] }>(
            '/ai/generate-initiatives',
            'POST',
            constraints
        );
        setState(prev => ({ ...prev, initiatives: result.initiatives }));
        return result.initiatives;
    }, [apiCall]);

    const prioritizeInitiatives = useCallback(async (
        initiatives: AIInitiative[],
        criteria: object = {}
    ) => {
        return apiCall('/ai/prioritize-initiatives', 'POST', {
            initiatives,
            criteria
        });
    }, [apiCall]);

    const estimateROI = useCallback(async (initiative: AIInitiative) => {
        return apiCall('/ai/estimate-roi', 'POST', { initiative });
    }, [apiCall]);

    // =========================================================================
    // FORM HELPER METHODS
    // =========================================================================

    const getQuickActions = useCallback(async (
        formState: object
    ): Promise<QuickAction[]> => {
        const result = await apiCall<{ actions: QuickAction[] }>(
            '/ai/quick-actions',
            'POST',
            formState
        );
        setState(prev => ({ ...prev, quickActions: result.actions }));
        return result.actions;
    }, [apiCall]);

    const getContextualHelp = useCallback(async (formState: object) => {
        return apiCall('/ai/contextual-help', 'POST', formState);
    }, [apiCall]);

    const fillMissingFields = useCallback(async (strategy: string = 'suggest-only') => {
        return apiCall('/ai/fill-missing', 'POST', { strategy });
    }, [apiCall]);

    const reviewJustifications = useCallback(async () => {
        return apiCall('/ai/review-justifications', 'POST', { language: 'pl' });
    }, [apiCall]);

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }));
    }, []);

    const clearSuggestion = useCallback(() => {
        setState(prev => ({ ...prev, lastSuggestion: null }));
    }, []);

    return {
        // State
        ...state,

        // Suggestions
        suggestJustification,
        suggestEvidence,
        suggestTarget,
        correctText,
        autocomplete,

        // Validation
        validateField,
        validateConsistency,

        // Analysis
        getGuidance,
        generateGapAnalysis,
        getInsights,
        getClarifyingQuestion,

        // Reports
        generateExecutiveSummary,
        generateStakeholderView,

        // Initiatives
        generateInitiatives,
        prioritizeInitiatives,
        estimateROI,

        // Form helpers
        getQuickActions,
        getContextualHelp,
        fillMissingFields,
        reviewJustifications,

        // Utilities
        clearError,
        clearSuggestion
    };
}

export default useAssessmentAI;

