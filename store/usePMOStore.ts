import { create } from 'zustand';
import { Api } from '../services/api';

/**
 * PMO Context State - Global Phase Awareness
 * Provides phase, gate, and execution status for UI behavior
 */

export interface PMOSystemMessage {
    severity: 'info' | 'warning' | 'critical';
    code: string;
    message: string;
}

export interface PMOBlockingIssue {
    type: 'TASK' | 'DECISION' | 'INITIATIVE';
    id: string;
    title: string;
    reason: string;
    label: string;
    initiativeId?: string;
    dueDate?: string;
    createdAt?: string;
    lastUpdated?: string;
}

export interface PMOTaskLabel {
    code: string;
    text: string;
    severity: 'warning' | 'critical' | 'info';
}

export interface PMOContext {
    projectId: string | null;
    projectName: string | null;
    currentPhase: string | null;
    phaseNumber: number | null;
    totalPhases: number;
    nextGate: string | null;
    gateStatus: 'READY' | 'NOT_READY' | null;
    missingCriteria: string[];
    allowedActions: string[];
    systemMessages: PMOSystemMessage[];
    blockingIssues: PMOBlockingIssue[];
    issueCount: number;
    isLoading: boolean;
    lastFetched: string | null;
    error: string | null;
}

interface PMOTaskLabels {
    [taskId: string]: PMOTaskLabel[];
}

interface PMOStoreState extends PMOContext {
    taskLabels: PMOTaskLabels;

    // Actions
    fetchPMOContext: (projectId: string) => Promise<void>;
    fetchTaskLabels: (projectId: string) => Promise<void>;
    clearContext: () => void;

    // Helper methods
    isPhaseBlocked: () => boolean;
    isActionAllowed: (action: string) => boolean;
    getWarningMessages: () => PMOSystemMessage[];
    getCriticalMessages: () => PMOSystemMessage[];
    getTaskLabel: (taskId: string) => PMOTaskLabel[] | null;
}

const initialState: PMOContext = {
    projectId: null,
    projectName: null,
    currentPhase: null,
    phaseNumber: null,
    totalPhases: 6,
    nextGate: null,
    gateStatus: null,
    missingCriteria: [],
    allowedActions: [],
    systemMessages: [],
    blockingIssues: [],
    issueCount: 0,
    isLoading: false,
    lastFetched: null,
    error: null
};

export const usePMOStore = create<PMOStoreState>((set, get) => ({
    ...initialState,
    taskLabels: {},

    fetchPMOContext: async (projectId: string) => {
        if (!projectId) {
            set({ ...initialState, error: 'No project selected' });
            return;
        }

        set({ isLoading: true, error: null });

        try {
            const data = await Api.getPMOContext(projectId);
            set({
                projectId: data.projectId,
                projectName: data.projectName,
                currentPhase: data.currentPhase,
                phaseNumber: data.phaseNumber,
                totalPhases: data.totalPhases || 6,
                nextGate: data.nextGate,
                gateStatus: data.gateStatus,
                missingCriteria: data.missingCriteria || [],
                allowedActions: data.allowedActions || [],
                systemMessages: data.systemMessages || [],
                blockingIssues: data.blockingIssues || [],
                issueCount: data.issueCount || 0,
                isLoading: false,
                lastFetched: new Date().toISOString(),
                error: null
            });
        } catch (err: any) {
            console.error('Failed to fetch PMO context:', err);
            set({
                isLoading: false,
                error: err.message || 'Failed to fetch PMO context'
            });
        }
    },

    fetchTaskLabels: async (projectId: string) => {
        if (!projectId) return;

        try {
            const data = await Api.getPMOTaskLabels(projectId);
            set({ taskLabels: data.taskLabels || {} });
        } catch (err) {
            console.error('Failed to fetch task labels:', err);
        }
    },

    clearContext: () => {
        set({ ...initialState, taskLabels: {} });
    },

    isPhaseBlocked: () => {
        const state = get();
        return state.blockingIssues.length > 0;
    },

    isActionAllowed: (action: string) => {
        const state = get();
        return state.allowedActions.includes(action);
    },

    getWarningMessages: () => {
        const state = get();
        return state.systemMessages.filter(m => m.severity === 'warning');
    },

    getCriticalMessages: () => {
        const state = get();
        return state.systemMessages.filter(m => m.severity === 'critical');
    },

    getTaskLabel: (taskId: string) => {
        const state = get();
        return state.taskLabels[taskId] || null;
    }
}));

// Hook for auto-fetching PMO context when project changes
export const usePMOContextAutoFetch = (projectId: string | null) => {
    const fetchPMOContext = usePMOStore(state => state.fetchPMOContext);
    const fetchTaskLabels = usePMOStore(state => state.fetchTaskLabels);
    const lastFetched = usePMOStore(state => state.lastFetched);
    const storedProjectId = usePMOStore(state => state.projectId);

    // Re-fetch when project changes or on initial load
    if (projectId && (projectId !== storedProjectId || !lastFetched)) {
        fetchPMOContext(projectId);
        fetchTaskLabels(projectId);
    }
};
