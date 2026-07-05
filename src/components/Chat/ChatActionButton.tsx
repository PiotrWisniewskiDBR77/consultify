/**
 * ChatActionButton (V3-B01)
 * UI component for navigate actions in AI chat responses.
 * Rendered inline in AI responses. DBR77: rounded-lg, h-9, subtle primary border, icon + text.
 */

import { ExternalLink, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  executeChatNavigate,
  type NavigateAction,
  type TargetModule,
} from '@/services/chatNavigator';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

// Module icons for action buttons
const MODULE_ICONS: Record<TargetModule, React.ElementType> = {
  tools: ExternalLink,
  initiatives: ExternalLink,
  reports: ExternalLink,
  presentations: ExternalLink,
  results: ExternalLink,
  assessment: ExternalLink,
  interview: ExternalLink,
  mywork: ExternalLink,
  economics: ExternalLink,
  excele: ExternalLink,
  process_flow: ExternalLink,
};

export interface ChatActionButtonProps {
  action: NavigateAction;
  label: string;
  onNavigate: (action: NavigateAction) => Promise<void>;
  /** Optional custom icon override */
  icon?: React.ElementType;
}

export const ChatActionButton: React.FC<ChatActionButtonProps> = ({
  action,
  label,
  onNavigate,
  icon: IconOverride,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = IconOverride ?? MODULE_ICONS[action.targetModule] ?? ExternalLink;

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    trackFunnelEvent('chat_action_clicked', {
      type: 'NAVIGATE',
      targetModule: action.targetModule,
      entityId: action.entityId ?? undefined,
    });

    try {
      await onNavigate(action);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      trackFunnelEvent('chat_action_failed', {
        type: 'NAVIGATE',
        targetModule: action.targetModule,
        error: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="inline-flex flex-col gap-1">
        <span className="text-xs text-c-danger">{error}</span>
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-c-danger/40 bg-c-danger/10 px-3 text-xs font-medium text-c-danger hover:bg-c-danger/15 transition-colors"
        >
          {t('chat.navigate.retry', 'Try again')}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/20 px-3 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      <span>{label}</span>
    </button>
  );
};

export default ChatActionButton;
