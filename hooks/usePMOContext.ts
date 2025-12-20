import { useEffect } from 'react';
import { usePMOStore } from '../store/usePMOStore';
import { useAppStore } from '../store/useAppStore';

/**
 * Hook for auto-fetching PMO context when project changes
 * Should be used at the app level or in components that need phase awareness
 */
export const usePMOContext = () => {
    const currentProjectId = useAppStore(state => state.currentProjectId);
    const {
        fetchPMOContext,
        fetchTaskLabels,
        currentPhase,
        phaseNumber,
        totalPhases,
        gateStatus,
        systemMessages,
        blockingIssues,
        isLoading,
        error,
        isPhaseBlocked,
        isActionAllowed,
        getWarningMessages,
        getCriticalMessages,
        getTaskLabel

    } = usePMOStore();

    // Re-fetch when project changes
    useEffect(() => {
        if (currentProjectId) {
            fetchPMOContext(currentProjectId);
            fetchTaskLabels(currentProjectId);
        }
    }, [currentProjectId, fetchPMOContext, fetchTaskLabels]);

    // Refresh PMO context periodically (every 5 minutes)
    useEffect(() => {
        if (!currentProjectId) return;

        const interval = setInterval(() => {
            fetchPMOContext(currentProjectId);
            fetchTaskLabels(currentProjectId);
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [currentProjectId, fetchPMOContext, fetchTaskLabels]);

    return {
        // State
        currentPhase,
        phaseNumber,
        totalPhases,
        gateStatus,
        systemMessages,
        blockingIssues,
        isLoading,
        error,

        // Helper methods
        isPhaseBlocked,
        isActionAllowed,
        getWarningMessages,
        getCriticalMessages,
        getTaskLabel,

        // Actions
        refresh: () => {
            if (currentProjectId) {
                fetchPMOContext(currentProjectId);
                fetchTaskLabels(currentProjectId);
            }
        }
    };
};

/**
 * Hook for getting PMO labels for a specific task
 */
export const useTaskPMOLabel = (taskId: string) => {
    const getTaskLabel = usePMOStore(state => state.getTaskLabel);
    return getTaskLabel(taskId);
};

/**
 * Hook for checking if current phase allows an action
 */
export const usePhaseAction = (action: string) => {
    const isActionAllowed = usePMOStore(state => state.isActionAllowed);
    return isActionAllowed(action);
};
