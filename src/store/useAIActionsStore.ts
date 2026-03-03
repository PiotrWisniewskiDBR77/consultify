/**
 * AI Actions Store
 *
 * Zustand store for managing AI-proposed actions.
 * Handles the approval workflow for actions AI wants to perform.
 *
 * @version 1.0.0
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Api } from '../services/api';
import {
  AIAction,
  AIActionPayload,
  AIActionResult,
  AIActionStatus,
  AIActionType,
  getActionTypeConfig,
  isActionExpired,
} from '../types/aiActions';

// ============================================================================
// Store Interface
// ============================================================================

interface AIActionsState {
  // Data
  actions: AIAction[];
  pendingCount: number;

  // UI State
  isLoading: boolean;
  error: string | null;
  selectedActionId: string | null;
  isEditModalOpen: boolean;

  // Actions - Fetch
  fetchPendingActions: (projectId?: string) => Promise<void>;
  fetchActionHistory: (conversationId: string) => Promise<AIAction[]>;

  // Actions - Workflow
  proposeAction: (action: Omit<AIAction, 'id' | 'status' | 'proposedAt'>) => void;
  approveAction: (actionId: string) => Promise<AIActionResult>;
  editAction: (actionId: string, editedPayload: AIActionPayload) => Promise<void>;
  dismissAction: (actionId: string, reason?: string) => Promise<void>;
  dismissAllPending: () => Promise<void>;

  // Actions - Execution
  executeAction: (actionId: string) => Promise<AIActionResult>;
  retryAction: (actionId: string) => Promise<AIActionResult>;

  // Actions - UI
  selectAction: (actionId: string | null) => void;
  openEditModal: (actionId: string) => void;
  closeEditModal: () => void;
  clearError: () => void;

  // Helpers
  getPendingActions: () => AIAction[];
  getActionsByConversation: (conversationId: string) => AIAction[];
  getActionById: (actionId: string) => AIAction | undefined;

  // Cleanup
  cleanupExpiredActions: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAIActionsStore = create<AIActionsState>()(
  persist(
    (set, get) => ({
      // Initial state
      actions: [],
      pendingCount: 0,
      isLoading: false,
      error: null,
      selectedActionId: null,
      isEditModalOpen: false,

      // ================================================================
      // Fetch Actions
      // ================================================================

      fetchPendingActions: async (projectId?: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await Api.getPendingAIActions(projectId);
          const actions = result.actions?.map(mapApiAction) || [];
          const pendingCount = actions.filter((a: any) => a.status === 'proposed').length;

          set({
            actions: mergeActions(get().actions, actions),
            pendingCount,
            isLoading: false,
          });
        } catch (err: any) {
          console.error('[AIActionsStore] Fetch pending error:', err);
          set({ error: err.message, isLoading: false });
        }
      },

      fetchActionHistory: async (conversationId: string) => {
        try {
          const result = await Api.getAIActionHistory(conversationId);
          const actions = result.actions?.map(mapApiAction) || [];

          set((state) => ({
            actions: mergeActions(state.actions, actions),
          }));

          return actions;
        } catch (err: any) {
          console.error('[AIActionsStore] Fetch history error:', err);
          return [];
        }
      },

      // ================================================================
      // Workflow Actions
      // ================================================================

      proposeAction: (actionData) => {
        const config = getActionTypeConfig(actionData.type);

        const action: AIAction = {
          ...actionData,
          id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'proposed',
          proposedAt: new Date(),
          risk: actionData.risk || config.defaultRisk,
          requiresConfirmation: actionData.requiresConfirmation ?? config.requiresConfirmation,
          expiresAt: config.expiresInMinutes
            ? new Date(Date.now() + config.expiresInMinutes * 60 * 1000)
            : undefined,
        };

        set((state) => ({
          actions: [action, ...state.actions],
          pendingCount: state.pendingCount + 1,
        }));

        // If no confirmation required, auto-execute
        if (!action.requiresConfirmation) {
          get().executeAction(action.id);
        }
      },

      approveAction: async (actionId: string) => {
        const action = get().getActionById(actionId);
        if (!action) {
          return { success: false, error: 'Action not found' };
        }

        set((state) => ({
          actions: state.actions.map((a) =>
            a.id === actionId
              ? { ...a, status: 'approved' as AIActionStatus, decidedAt: new Date() }
              : a
          ),
        }));

        return get().executeAction(actionId);
      },

      editAction: async (actionId: string, editedPayload: AIActionPayload) => {
        const action = get().getActionById(actionId);
        if (!action) return;

        set((state) => ({
          actions: state.actions.map((a) =>
            a.id === actionId
              ? {
                  ...a,
                  status: 'edited' as AIActionStatus,
                  originalPayload: a.payload,
                  editedPayload,
                  payload: editedPayload,
                  decidedAt: new Date(),
                }
              : a
          ),
          isEditModalOpen: false,
          selectedActionId: null,
        }));

        // Execute with edited payload
        await get().executeAction(actionId);
      },

      dismissAction: async (actionId: string, reason?: string) => {
        try {
          await Api.dismissAIAction(actionId, reason);

          set((state) => ({
            actions: state.actions.map((a) =>
              a.id === actionId
                ? { ...a, status: 'dismissed' as AIActionStatus, decidedAt: new Date() }
                : a
            ),
            pendingCount: Math.max(0, state.pendingCount - 1),
          }));
        } catch (err: any) {
          console.error('[AIActionsStore] Dismiss error:', err);
          // Still update local state
          set((state) => ({
            actions: state.actions.map((a) =>
              a.id === actionId
                ? { ...a, status: 'dismissed' as AIActionStatus, decidedAt: new Date() }
                : a
            ),
            pendingCount: Math.max(0, state.pendingCount - 1),
          }));
        }
      },

      dismissAllPending: async () => {
        const pending = get().getPendingActions();

        for (const action of pending) {
          await get().dismissAction(action.id, 'bulk_dismiss');
        }
      },

      // ================================================================
      // Execution
      // ================================================================

      executeAction: async (actionId: string) => {
        const action = get().getActionById(actionId);
        if (!action) {
          return { success: false, error: 'Action not found' };
        }

        try {
          const result = await Api.executeAIAction(actionId, action.payload);

          set((state) => ({
            actions: state.actions.map((a) =>
              a.id === actionId
                ? {
                    ...a,
                    status: result.success ? 'executed' : 'failed',
                    executedAt: new Date(),
                    result,
                  }
                : a
            ),
            pendingCount: Math.max(0, state.pendingCount - 1),
          }));

          return result;
        } catch (err: any) {
          console.error('[AIActionsStore] Execute error:', err);

          const result: AIActionResult = {
            success: false,
            error: err.message || 'Execution failed',
          };

          set((state) => ({
            actions: state.actions.map((a) =>
              a.id === actionId ? { ...a, status: 'failed' as AIActionStatus, result } : a
            ),
            pendingCount: Math.max(0, state.pendingCount - 1),
          }));

          return result;
        }
      },

      retryAction: async (actionId: string) => {
        const action = get().getActionById(actionId);
        if (!action || action.status !== 'failed') {
          return { success: false, error: 'Cannot retry this action' };
        }

        set((state) => ({
          actions: state.actions.map((a) =>
            a.id === actionId ? { ...a, status: 'approved' as AIActionStatus } : a
          ),
        }));

        return get().executeAction(actionId);
      },

      // ================================================================
      // UI Actions
      // ================================================================

      selectAction: (actionId: string | null) => {
        set({ selectedActionId: actionId });
      },

      openEditModal: (actionId: string) => {
        set({ selectedActionId: actionId, isEditModalOpen: true });
      },

      closeEditModal: () => {
        set({ isEditModalOpen: false, selectedActionId: null });
      },

      clearError: () => {
        set({ error: null });
      },

      // ================================================================
      // Helpers
      // ================================================================

      getPendingActions: () => {
        return get().actions.filter((a) => a.status === 'proposed' && !isActionExpired(a));
      },

      getActionsByConversation: (conversationId: string) => {
        return get().actions.filter((a) => a.conversationId === conversationId);
      },

      getActionById: (actionId: string) => {
        return get().actions.find((a) => a.id === actionId);
      },

      // ================================================================
      // Cleanup
      // ================================================================

      cleanupExpiredActions: () => {
        set((state) => {
          const now = new Date();
          const updated = state.actions.map((a) => {
            if (a.status === 'proposed' && a.expiresAt && new Date(a.expiresAt) < now) {
              return { ...a, status: 'expired' as AIActionStatus };
            }
            return a;
          });

          const pendingCount = updated.filter((a) => a.status === 'proposed').length;

          return { actions: updated, pendingCount };
        });
      },
    }),
    {
      name: 'consultify-ai-actions',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist pending actions (not full history)
        actions: state.actions.filter((a) => a.status === 'proposed'),
      }),
    }
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

function mapApiAction(api: any): AIAction {
  return {
    id: api.id,
    type: api.type as AIActionType,
    status: api.status as AIActionStatus,
    title: api.title,
    description: api.description,
    icon: api.icon,
    payload: api.payload,
    conversationId: api.conversation_id || api.conversationId,
    messageId: api.message_id || api.messageId,
    projectId: api.project_id || api.projectId,
    risk: api.risk || 'medium',
    requiresConfirmation: api.requires_confirmation ?? true,
    proposedAt: new Date(api.proposed_at || api.proposedAt || api.created_at),
    decidedAt: api.decided_at ? new Date(api.decided_at) : undefined,
    executedAt: api.executed_at ? new Date(api.executed_at) : undefined,
    expiresAt: api.expires_at ? new Date(api.expires_at) : undefined,
    decidedBy: api.decided_by,
    originalPayload: api.original_payload,
    editedPayload: api.edited_payload,
    result: api.result,
  };
}

function mergeActions(existing: AIAction[], incoming: AIAction[]): AIAction[] {
  const map = new Map<string, AIAction>();

  // Add existing
  existing.forEach((a) => map.set(a.id, a));

  // Override with incoming (newer data)
  incoming.forEach((a) => map.set(a.id, a));

  // Sort by proposed date (newest first)
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.proposedAt).getTime() - new Date(a.proposedAt).getTime()
  );
}

export default useAIActionsStore;
