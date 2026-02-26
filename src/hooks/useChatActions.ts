/**
 * useChatActions (V3-B01)
 * Hook integrating chat with navigation and mechanical transfers.
 * Uses executeChatNavigate, openDocumentsStore, toasts, and analytics.
 */

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { executeChatNavigate, type NavigateAction } from '@/services/chatNavigator';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

export type ChatAction = NavigateAction;

export function useChatActions() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [lastError, setLastError] = useState<string | null>(null);

  const handleNavigate = useCallback(
    async (action: NavigateAction): Promise<void> => {
      setLastError(null);

      const result = executeChatNavigate(action, navigate);

      if (result.success) {
        toast.success(t('chat.navigate.success', 'Navigating…'), {
          duration: 1500,
          icon: '🧭',
        });
      } else {
        setLastError(result.error ?? 'Unknown error');
        toast.error(t('chat.navigate.fallback', 'Opened fallback view'), {
          duration: 3000,
        });
        if (result.fallbackRoute) {
          trackFunnelEvent('chat_action_failed', {
            type: 'NAVIGATE',
            targetModule: action.targetModule,
            error: result.error ?? 'unknown',
          });
        }
      }
    },
    [navigate, t]
  );

  const handleAction = useCallback(
    async (action: ChatAction): Promise<void> => {
      if (action.type === 'NAVIGATE') {
        await handleNavigate(action);
        return;
      }
      // Future: extend for other action types (execute, copy, etc.)
      setLastError('Unsupported action type');
      toast.error(t('chat.action.unsupported', 'Action not supported'));
    },
    [handleNavigate, t]
  );

  return {
    handleNavigate,
    handleAction,
    lastError,
  };
}

export default useChatActions;
