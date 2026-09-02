/**
 * useChatActions (V3-B01)
 * Hook integrating chat with navigation, generation, and mechanical transfers.
 * Dispatches NAVIGATE via chatNavigator; all other action types via chatActionHandler.
 */

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type ActionHandlerDeps, handleChatAction } from '@/services/chatActionHandler';
import { executeChatNavigate, type NavigateAction } from '@/services/chatNavigator';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { type ChatActionPayload } from '@/types/domain/chatActions';

export type ChatAction = NavigateAction | ChatActionPayload;

export function useChatActions(options: {
  projectId?: string;
  initiativeId?: string;
} = {}) {
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
      setLastError(null);

      if (action.type === 'NAVIGATE') {
        await handleNavigate(action as NavigateAction);
        return;
      }

      const payload = action as ChatActionPayload;

      const deps: ActionHandlerDeps = {
        navigate,
        context: {
          projectId: options.projectId,
          initiativeId: options.initiativeId,
        },
        onOpenReportBuilder: () => navigate('/document-studio'),
        onOpenPresentationWizard: (params) => {
          const template = String(params?.templateId || '').trim();
          navigate(template ? `/prezentacje?templateArtifactId=${encodeURIComponent(template)}` : '/prezentacje');
        },
        onOpenKpiDrawer: (kpiId) => navigate(`/results/kpi/${encodeURIComponent(kpiId)}`),
      };
      const result = await handleChatAction(payload, deps);

      if (result.success) {
        toast.success(t('chat.action.success', 'Done'), { duration: 1500 });
      } else {
        setLastError(result.error ?? 'Unknown error');
        toast.error(result.error ?? t('chat.action.failed', 'Action failed'), { duration: 3000 });
      }
    },
    [handleNavigate, navigate, options.initiativeId, options.projectId, t]
  );

  return {
    handleNavigate,
    handleAction,
    lastError,
  };
}

export default useChatActions;
