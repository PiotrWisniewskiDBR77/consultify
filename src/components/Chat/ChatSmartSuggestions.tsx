/**
 * ChatSmartSuggestions (V3-B01)
 * Component shown below the chat input that suggests next actions based on conversation context.
 * DBR77: pill (rounded-full) chips, text-xs, neutral c-* palette.
 * Max 3 suggestions, disappear after 1 is clicked.
 *
 * Palette (2026-07-28, D4): these chips used to carry the tailwind brand ramp,
 * which in this project resolves to crimson #85182F on EVERY step — a colour
 * reserved for critical semantics. A next-step suggestion is not critical, so
 * the chip now uses the same neutral c-* tokens as the sibling `contextActions`
 * pills in the composer (`UnifiedChatPanel`). Keep it neutral; focus ring stays
 * blue (c-focus). SSOT: docs/ui-standards/TRIADA_KANON.md, part C.
 */

import { ChevronRight, Lightbulb, Target, Wrench } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NavigateAction } from '@/services/chatNavigator';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

/**
 * Chat V8 — `{ type: 'chat'; prompt: string }` is a light-weight "inject this
 * into the chat input and send" action, used for smart suggestions that want
 * to prime the conversation instead of hard-navigating somewhere. The router
 * in `UnifiedChatPanel` is responsible for turning it into a real send.
 */
export interface ChatInjectAction {
  type: 'chat';
  prompt: string;
}

export type ChatSuggestionAction = NavigateAction | ChatInjectAction;

export interface ChatSuggestion {
  id: string;
  label: string;
  action: ChatSuggestionAction;
  type?:
    | 'initiative'
    | 'tool'
    | 'results'
    // NOTE: the 'outputs' family was dropped with the artifact chips (D4,
    // 2026-07-28) — nothing produces it any more.
    | 'generic'
    // Chat V8 — interview/insight smart-suggestion family.
    | 'interview';
}

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  initiative: Target,
  tool: Wrench,
  results: Target,
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
    // Chat V8 — telemetry shape is polymorphic now that suggestions can be
    // either NAVIGATE or `chat` (prompt-prime). Discriminate safely.
    if (suggestion.action.type === 'NAVIGATE') {
      trackFunnelEvent('chat_suggestion_clicked', {
        type: 'NAVIGATE',
        targetModule: suggestion.action.targetModule,
      });
    } else {
      trackFunnelEvent('chat_suggestion_clicked', {
        type: 'chat',
        promptPreview: suggestion.action.prompt.slice(0, 80),
      });
    }
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
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-c-border-strong bg-c-surface-raised px-3 text-xs font-medium text-c-text-secondary hover:bg-c-surface hover:text-c-text transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
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
