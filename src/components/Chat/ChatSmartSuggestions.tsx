/**
 * ChatSmartSuggestions (V3-B01)
 * Component shown below the chat input that suggests next actions based on conversation context.
 * DBR77: pill (rounded-full) chips, text-xs, bg-primary-500/10.
 * Max 3 suggestions, disappear after 1 is clicked.
 */

import { ChevronRight, FileOutput, Lightbulb, Target, Wrench } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NavigateAction } from '@/services/chatNavigator';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

export interface ChatSuggestion {
  id: string;
  label: string;
  action: NavigateAction;
  type?: 'initiative' | 'tool' | 'results' | 'outputs' | 'generic';
}

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  initiative: Target,
  tool: Wrench,
  results: Target,
  outputs: FileOutput,
  generic: Lightbulb,
};

export interface ChatSmartSuggestionsProps {
  suggestions: ChatSuggestion[];
  onSuggestionClick: (suggestion: ChatSuggestion) => Promise<void>;
  className?: string;
  maxVisible?: number;
}

export const ChatSmartSuggestions: React.FC<ChatSmartSuggestionsProps> = ({
  suggestions,
  onSuggestionClick,
  className = '',
  maxVisible = 3,
}) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (suggestions.length === 0 || dismissed) return null;

  const visible = suggestions.slice(0, maxVisible);

  const handleClick = async (suggestion: ChatSuggestion) => {
    setLoadingId(suggestion.id);
    trackFunnelEvent('chat_suggestion_clicked', {
      type: 'NAVIGATE',
      targetModule: suggestion.action.targetModule,
    });
    try {
      await onSuggestionClick(suggestion);
      setDismissed(true);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {visible.map((suggestion) => {
        const Icon = SUGGESTION_ICONS[suggestion.type || 'generic'] ?? Lightbulb;
        const isLoading = loadingId === suggestion.id;

        return (
          <button
            key={suggestion.id}
            type="button"
            onClick={() => handleClick(suggestion)}
            disabled={isLoading}
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-500/10 px-3 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-500/20 dark:hover:bg-primary-500/20 transition-colors disabled:opacity-60"
          >
            <Icon size={12} className="shrink-0" />
            <span className="truncate max-w-[140px]">{suggestion.label}</span>
            {!isLoading && <ChevronRight size={12} className="shrink-0 opacity-70" />}
            {isLoading && (
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ChatSmartSuggestions;
