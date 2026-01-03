/**
 * useNotificationNavigation - Hook do nawigacji z notyfikacji do powiązanych obiektów
 * 
 * Obsługuje smart navigation na podstawie relatedObjectType:
 * - TASK: otwiera TaskDetailModal
 * - INITIATIVE: nawiguje do widoku inicjatyw
 * - DECISION: nawiguje do widoku decyzji
 * - GATE: nawiguje do implementation z highlight na gate
 * - PROJECT: nawiguje do dashboard projektu
 */

import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

export interface NotificationNavigationTarget {
    relatedObjectType?: 'TASK' | 'INITIATIVE' | 'DECISION' | 'PROJECT' | 'GATE' | string;
    relatedObjectId?: string;
    projectId?: string;
    actionUrl?: string;
}

export interface UseNotificationNavigationReturn {
    navigateToObject: (target: NotificationNavigationTarget) => void;
    canNavigate: (target: NotificationNavigationTarget) => boolean;
    getNavigationLabel: (type?: string) => string;
}

export const useNotificationNavigation = (
    onOpenTaskModal?: (taskId: string) => void,
    onOpenDecisionPanel?: (decisionId: string) => void
): UseNotificationNavigationReturn => {
    const { setCurrentView, setCurrentProjectId } = useAppStore();

    const navigateToObject = useCallback((target: NotificationNavigationTarget) => {
        const { relatedObjectType, relatedObjectId, projectId, actionUrl } = target;

        // If we have actionUrl and no specific handler, use it
        if (actionUrl && !relatedObjectType) {
            window.location.href = actionUrl;
            return;
        }

        // Set project context if available
        if (projectId) {
            setCurrentProjectId(projectId);
        }

        switch (relatedObjectType) {
            case 'TASK':
                if (relatedObjectId && onOpenTaskModal) {
                    // Open task modal without changing view
                    onOpenTaskModal(relatedObjectId);
                } else {
                    // Fallback: navigate to My Work
                    setCurrentView(AppView.MY_WORK);
                }
                break;

            case 'INITIATIVE':
                // Navigate to initiatives view
                setCurrentView(AppView.PORTFOLIO_ROADMAP);
                // Store highlight ID for the view to pick up
                if (relatedObjectId) {
                    sessionStorage.setItem('highlightInitiativeId', relatedObjectId);
                }
                break;

            case 'DECISION':
                if (relatedObjectId && onOpenDecisionPanel) {
                    // Open decision panel
                    onOpenDecisionPanel(relatedObjectId);
                } else {
                    // Navigate to My Work with decisions tab
                    setCurrentView(AppView.MY_WORK);
                    sessionStorage.setItem('myWorkTab', 'decisions');
                }
                break;

            case 'GATE':
                // Navigate to implementation view with gate focus
                setCurrentView(AppView.PORTFOLIO_ROADMAP);
                if (relatedObjectId) {
                    sessionStorage.setItem('highlightGateId', relatedObjectId);
                }
                break;

            case 'PROJECT':
                // Navigate to project (unified My Work view)
                if (relatedObjectId) {
                    setCurrentProjectId(relatedObjectId);
                }
                setCurrentView(AppView.MY_WORK);
                break;

            default:
                // Use actionUrl if available, otherwise go to My Work
                if (actionUrl) {
                    window.location.href = actionUrl;
                } else {
                    setCurrentView(AppView.MY_WORK);
                }
        }
    }, [setCurrentView, setCurrentProjectId, onOpenTaskModal, onOpenDecisionPanel]);

    const canNavigate = useCallback((target: NotificationNavigationTarget): boolean => {
        const { relatedObjectType, relatedObjectId, actionUrl } = target;

        // Can navigate if we have a related object with ID
        if (relatedObjectType && relatedObjectId) {
            return true;
        }

        // Or if we have an action URL
        if (actionUrl) {
            return true;
        }

        return false;
    }, []);

    const getNavigationLabel = useCallback((type?: string): string => {
        switch (type) {
            case 'TASK':
                return 'Open Task';
            case 'INITIATIVE':
                return 'View Initiative';
            case 'DECISION':
                return 'Open Decision';
            case 'GATE':
                return 'View Gate';
            case 'PROJECT':
                return 'Go to Project';
            default:
                return 'View Details';
        }
    }, []);

    return {
        navigateToObject,
        canNavigate,
        getNavigationLabel
    };
};

export default useNotificationNavigation;

