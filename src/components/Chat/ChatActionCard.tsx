/**
 * ChatActionCard (V3-B02)
 * Unified UI component for rendering chat actions in AI responses.
 * SPEC-K tool-call card: rounded-lg, h-auto, tokenized (c.*) surfaces.
 * Primary: bg-c-accent-soft, border-c-accent/30 (Harvard Crimson brand accent).
 * Secondary: bg-c-surface-raised, border-c-border.
 * Disabled: opacity-50, cursor-not-allowed, tooltip with reason.
 * Error: c-danger border + inline error message.
 */

import {
  CheckSquare,
  ClipboardList,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Presentation,
  Scale,
  Target,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getActionDefinition } from '@/services/chatActionRegistry';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { ChatActionPayload } from '@/types/domain/chatActions';

const ACTION_ICONS: Record<string, React.ElementType> = {
  ExternalLink,
  CheckSquare,
  Scale,
  Target,
  FileText,
  Presentation,
  Wrench,
  Eye,
  ClipboardList,
  TrendingUp,
};

export interface ChatActionCardProps {
  action: ChatActionPayload;
  onExecute: (action: ChatActionPayload) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}

export const ChatActionCard: React.FC<ChatActionCardProps> = ({
  action,
  onExecute,
  disabled = false,
  disabledReason,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = getActionDefinition(action.type);
  const IconComponent = def ? (ACTION_ICONS[def.icon] ?? ExternalLink) : ExternalLink;
  const label = def ? t(def.label, def.label) : action.type;
  const description = def ? t(def.description, def.description) : '';
  const isPrimary = def?.styling === 'primary';
  const isDisabled = disabled || loading;

  // Analytics: chat_action_rendered
  useEffect(() => {
    trackFunnelEvent('chat_action_rendered', { type: action.type });
  }, [action.type]);

  const handleClick = async () => {
    if (isDisabled) return;

    setLoading(true);
    setError(null);
    trackFunnelEvent('chat_action_clicked', { type: action.type });

    try {
      await onExecute(action);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      trackFunnelEvent('chat_action_failed', { type: action.type, reason: msg });
    } finally {
      setLoading(false);
    }
  };

  const baseClasses =
    'flex items-center gap-2 rounded-lg border h-auto min-h-[36px] px-3 py-2 text-left text-sm font-medium transition-all duration-200';
  const primaryClasses =
    'bg-c-accent-soft border-c-accent/30 text-c-accent hover:bg-c-accent-soft hover:border-c-accent/50';
  const secondaryClasses =
    'bg-c-surface-raised border-c-border text-c-text-secondary hover:bg-c-border-subtle hover:text-c-text';
  const disabledClasses = 'opacity-50 cursor-not-allowed';
  const errorClasses = 'border-c-danger/50 bg-c-danger/5';

  const cardClasses = [
    baseClasses,
    error ? errorClasses : isPrimary ? primaryClasses : secondaryClasses,
    isDisabled && !error ? disabledClasses : 'cursor-pointer',
  ]
    .filter(Boolean)
    .join(' ');

  const tooltipTitle = isDisabled && disabledReason ? disabledReason : description;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        title={tooltipTitle}
        className={cardClasses}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin shrink-0" />
        ) : (
          <IconComponent size={16} className="shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </button>
      {error && (
        <span className="text-xs text-c-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export default ChatActionCard;
