/**
 * useActionHandler Hook
 *
 * Frontend hook for executing AI-initiated actions.
 * Handles navigation, entity creation, form filling, and UI interactions.
 *
 * Part of the Harvard-Level Co-Thinker AI System
 */

import { useCallback, useRef, useState } from 'react';

import { api } from '@/services/api';

import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

// Action types matching backend
export const ACTION_TYPES = {
  NAVIGATE: 'navigate',
  CREATE_PROJECT: 'create_project',
  CREATE_INITIATIVE: 'create_initiative',
  CREATE_TASK: 'create_task',
  UPDATE_ASSESSMENT: 'update_assessment',
  FILL_FORM: 'fill_form',
  GENERATE_CONTENT: 'generate_content',
  SHOW_DATA: 'show_data',
  HIGHLIGHT_ELEMENT: 'highlight',
  OPEN_MODAL: 'open_modal',
  TRIGGER_WORKFLOW: 'trigger_workflow',
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

export interface ActionPayload {
  type: ActionType;
  payload: Record<string, unknown>;
  requiresConfirmation?: boolean;
  confirmed?: boolean;
  message?: string;
}

export interface ActionResult {
  status: 'success' | 'error' | 'pending_confirmation' | 'cancelled';
  actionId?: string;
  type?: ActionType;
  result?: Record<string, unknown>;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PendingAction {
  actionId: string;
  action: ActionPayload;
  confirmationMessage: string;
  createdAt: string;
}

interface UseActionHandlerReturn {
  executeAction: (action: ActionPayload) => Promise<ActionResult>;
  confirmAction: (actionId: string, confirmed: boolean) => Promise<ActionResult>;
  pendingActions: PendingAction[];
  isExecuting: boolean;
  lastResult: ActionResult | null;
  clearPendingActions: () => void;
}

// View mapping for navigation
const VIEW_MAP: Record<string, AppView> = {
  USER_DASHBOARD: AppView.USER_DASHBOARD,
  ADMIN_DASHBOARD: AppView.ADMIN_DASHBOARD,
  ASSESSMENT_WIZARD: AppView.ASSESSMENT_DRD, // ASSESSMENT_WIZARD doesn't exist, using ASSESSMENT_DRD
  INITIATIVES: AppView.FULL_STEP2_INITIATIVES, // Using FULL_STEP2_INITIATIVES
  INITIATIVE_DETAIL: AppView.FULL_STEP2_INITIATIVES, // No INITIATIVE_DETAIL, using INITIATIVES
  ROADMAP: AppView.FULL_STEP3_ROADMAP, // Using FULL_STEP3_ROADMAP
  REPORTS: AppView.FULL_STEP6_REPORTS, // Using FULL_STEP6_REPORTS
  REPORT_BUILDER: AppView.DRD_AUDIT_REPORT, // Using DRD_AUDIT_REPORT
  SETTINGS: AppView.SETTINGS_PROFILE, // Using SETTINGS_PROFILE
  PROJECT_DETAIL: AppView.ADMIN_PROJECTS, // Using ADMIN_PROJECTS
  AI_CHAT: AppView.AI_CHAT,
};

export function useActionHandler(): UseActionHandlerReturn {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);

  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    setCurrentView,
    setCurrentProjectId,
    // setSelectedInitiativeId, // Not in store
    // setSelectedModalId // Not in store
  } = useAppStore();

  /**
   * Execute navigation action
   */
  const executeNavigate = useCallback(
    (payload: Record<string, unknown>): ActionResult => {
      const view = payload.view as string;
      const params = payload.params as Record<string, unknown> | undefined;

      const mappedView = VIEW_MAP[view];
      if (!mappedView) {
        return {
          status: 'error',
          error: `Unknown view: ${view}`,
        };
      }

      // Handle navigation parameters
      if (params?.projectId) {
        setCurrentProjectId(params.projectId as string);
      }
      // if (params?.initiativeId) {
      //     setSelectedInitiativeId(params.initiativeId as string); // Not in AppState
      // }

      setCurrentView(mappedView);

      return {
        status: 'success',
        type: ACTION_TYPES.NAVIGATE,
        result: { view: mappedView, params },
        message: `Navigated to ${view}`,
      };
    },
    [setCurrentView, setCurrentProjectId]
  );

  /**
   * Execute form fill action
   */
  const executeFillForm = useCallback((payload: Record<string, unknown>): ActionResult => {
    const { formId, fieldId, value, explanation } = payload;

    // Find the form element
    const formElement =
      document.getElementById(formId as string) ||
      document.querySelector(`[data-form-id="${formId}"]`);

    if (!formElement) {
      return {
        status: 'error',
        error: `Form not found: ${formId}`,
      };
    }

    // Find the field
    const fieldElement = formElement.querySelector(
      `[name="${fieldId}"], [data-field-id="${fieldId}"], #${fieldId}`
    ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;

    if (!fieldElement) {
      return {
        status: 'error',
        error: `Field not found: ${fieldId}`,
      };
    }

    // Set the value
    const previousValue = fieldElement.value;
    fieldElement.value = value as string;

    // Trigger change event
    fieldElement.dispatchEvent(new Event('input', { bubbles: true }));
    fieldElement.dispatchEvent(new Event('change', { bubbles: true }));

    // Add visual indicator
    fieldElement.classList.add('ai-filled');
    setTimeout(() => fieldElement.classList.remove('ai-filled'), 3000);

    return {
      status: 'success',
      type: ACTION_TYPES.FILL_FORM,
      result: {
        formId,
        fieldId,
        previousValue,
        newValue: value,
        explanation,
      },
      message: `Filled ${fieldId} with AI suggestion`,
    };
  }, []);

  /**
   * Execute highlight action
   */
  const executeHighlight = useCallback((payload: Record<string, unknown>): ActionResult => {
    const { elementId, duration = 3000 } = payload;

    // Clear any existing highlight timer
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    const element =
      document.getElementById(elementId as string) ||
      document.querySelector(`[data-element-id="${elementId}"]`);

    if (!element) {
      return {
        status: 'error',
        error: `Element not found: ${elementId}`,
      };
    }

    // Add highlight class
    element.classList.add('ai-highlight');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Remove after duration
    highlightTimerRef.current = setTimeout(() => {
      element.classList.remove('ai-highlight');
    }, duration as number);

    return {
      status: 'success',
      type: ACTION_TYPES.HIGHLIGHT_ELEMENT,
      result: { elementId, duration },
      message: `Highlighted ${elementId}`,
    };
  }, []);

  /**
   * Execute open modal action
   */
  const executeOpenModal = useCallback((payload: Record<string, unknown>): ActionResult => {
    const { modalId, data } = payload;

    // setSelectedModalId(modalId as string); // Method doesn't exist in store

    // Store modal data in localStorage for the modal to pick up
    if (data) {
      localStorage.setItem(`modal_data_${modalId}`, JSON.stringify(data));
    }

    return {
      status: 'success',
      type: ACTION_TYPES.OPEN_MODAL,
      result: { modalId, data },
      message: `Opened modal ${modalId}`,
    };
  }, []);

  /**
   * Execute show data action
   */
  const executeShowData = useCallback((payload: Record<string, unknown>): ActionResult => {
    const { dataType, data, filters } = payload;

    // Dispatch custom event for components to listen to
    window.dispatchEvent(
      new CustomEvent('ai:show-data', {
        detail: { dataType, data, filters },
      })
    );

    return {
      status: 'success',
      type: ACTION_TYPES.SHOW_DATA,
      result: { dataType, recordCount: Array.isArray(data) ? data.length : 1 },
      message: `Showing ${dataType} data`,
    };
  }, []);

  /**
   * Execute backend action (create entities, etc.)
   */
  const executeBackendAction = useCallback(async (action: ActionPayload): Promise<ActionResult> => {
    try {
      const response = await api.post('/api/ai/actions/execute', {
        type: action.type,
        payload: action.payload,
        confirmed: action.confirmed || false,
      });

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: 'error',
        error: errorMessage,
      };
    }
  }, []);

  /**
   * Main action execution function
   */
  const executeAction = useCallback(
    async (action: ActionPayload): Promise<ActionResult> => {
      setIsExecuting(true);

      try {
        let result: ActionResult;

        // Handle frontend-only actions
        switch (action.type) {
          case ACTION_TYPES.NAVIGATE:
            result = executeNavigate(action.payload);
            break;

          case ACTION_TYPES.FILL_FORM:
            result = executeFillForm(action.payload);
            break;

          case ACTION_TYPES.HIGHLIGHT_ELEMENT:
            result = executeHighlight(action.payload);
            break;

          case ACTION_TYPES.OPEN_MODAL:
            result = executeOpenModal(action.payload);
            break;

          case ACTION_TYPES.SHOW_DATA:
            result = executeShowData(action.payload);
            break;

          // Backend actions
          case ACTION_TYPES.CREATE_PROJECT:
          case ACTION_TYPES.CREATE_INITIATIVE:
          case ACTION_TYPES.CREATE_TASK:
          case ACTION_TYPES.UPDATE_ASSESSMENT:
          case ACTION_TYPES.GENERATE_CONTENT:
          case ACTION_TYPES.TRIGGER_WORKFLOW:
            result = await executeBackendAction(action);
            break;

          default:
            result = {
              status: 'error',
              error: `Unknown action type: ${action.type}`,
            };
        }

        // Handle pending confirmation
        if (result.status === 'pending_confirmation' && result.actionId) {
          setPendingActions((prev) => [
            ...prev,
            {
              actionId: result.actionId!,
              action,
              confirmationMessage: result.message || 'Confirm action?',
              createdAt: new Date().toISOString(),
            },
          ]);
        }

        // Handle follow-up actions
        if (result.status === 'success' && result.result?.nextAction) {
          const nextAction = result.result.nextAction as ActionPayload;
          // Execute next action after short delay
          setTimeout(() => executeAction(nextAction), 500);
        }

        setLastResult(result);
        return result;
      } finally {
        setIsExecuting(false);
      }
    },
    [
      executeNavigate,
      executeFillForm,
      executeHighlight,
      executeOpenModal,
      executeShowData,
      executeBackendAction,
    ]
  );

  /**
   * Confirm or reject a pending action
   */
  const confirmAction = useCallback(
    async (actionId: string, confirmed: boolean): Promise<ActionResult> => {
      const pendingAction = pendingActions.find((p) => p.actionId === actionId);

      if (!pendingAction) {
        return {
          status: 'error',
          error: 'Action not found or expired',
        };
      }

      // Remove from pending
      setPendingActions((prev) => prev.filter((p) => p.actionId !== actionId));

      if (!confirmed) {
        return {
          status: 'cancelled',
          actionId,
        };
      }

      // Execute with confirmation
      return executeAction({
        ...pendingAction.action,
        confirmed: true,
      });
    },
    [pendingActions, executeAction]
  );

  /**
   * Clear all pending actions
   */
  const clearPendingActions = useCallback(() => {
    setPendingActions([]);
  }, []);

  return {
    executeAction,
    confirmAction,
    pendingActions,
    isExecuting,
    lastResult,
    clearPendingActions,
  };
}

// CSS for AI action visual feedback
const styles = `
.ai-filled {
    animation: ai-fill-pulse 0.5s ease-out;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
}

.ai-highlight {
    animation: ai-highlight-pulse 1s ease-in-out infinite;
    outline: 3px solid rgba(59, 130, 246, 0.7) !important;
    outline-offset: 2px;
}

@keyframes ai-fill-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
}

@keyframes ai-highlight-pulse {
    0%, 100% { outline-color: rgba(59, 130, 246, 0.3); }
    50% { outline-color: rgba(59, 130, 246, 0.7); }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default useActionHandler;
