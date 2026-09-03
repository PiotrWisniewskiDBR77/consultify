/**
 * ReasoningTrace
 *
 * Per-message, collapsible "Tok rozumowania" (chain-of-thought) panel — the
 * Grok/OpenAI/Gemini-style reasoning disclosure shown above an AI answer.
 *
 * - Auto-EXPANDED while the message is streaming (you watch Teresa think).
 * - Auto-COLLAPSED once the answer is complete (clean, less-is-more), with a
 *   one-line header you can re-open at any time.
 * - The reasoning text is persisted in message metadata, so the trace survives
 *   a reload (the data flows: useAIStream.splitThinking → message.metadata.reasoning).
 */
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ReasoningTraceProps {
  reasoning: string;
  isStreaming?: boolean;
  isCompact?: boolean;
  isRtl?: boolean;
}

export const ReasoningTrace: React.FC<ReasoningTraceProps> = ({
  reasoning,
  isStreaming = false,
  isCompact = false,
  isRtl = false,
}) => {
  const { t } = useTranslation();
  // Expanded while streaming; collapses to a slim summary once complete.
  const [expanded, setExpanded] = useState(isStreaming);
  const [userToggled, setUserToggled] = useState(false);

  useEffect(() => {
    // Follow the streaming state unless the user has manually overridden it.
    if (!userToggled) setExpanded(isStreaming);
  }, [isStreaming, userToggled]);

  const text = (reasoning || '').trim();
  if (!text) return null;

  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={`mb-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/70 dark:bg-navy-900/40 ${
        isCompact ? 'text-[11px]' : 'text-xs'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
      data-testid="reasoning-trace"
    >
      <button
        type="button"
        onClick={() => {
          setUserToggled(true);
          setExpanded((v) => !v);
        }}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        aria-expanded={expanded}
      >
        <Chevron size={13} className="shrink-0" />
        <Brain size={13} className="shrink-0 text-c-text-secondary" />
        <span className="font-medium">{t('chat.reasoning.title', 'Tok rozumowania')}</span>
        {isStreaming && (
          <span className="ml-1 inline-flex items-center gap-0.5" aria-hidden>
            <span
              className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2 pt-0.5 border-t border-slate-200/70 dark:border-navy-700/70">
          <div className="max-h-72 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed tracking-tight text-slate-500 dark:text-slate-400">
            {text}
            {isStreaming && (
              <span className="inline-block w-1 h-3 ml-0.5 align-baseline bg-slate-400 dark:bg-slate-500 animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReasoningTrace;
