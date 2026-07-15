import { Check, Copy, Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

export type AICommandType = 'ask' | 'expand' | 'challenge' | 'action';

interface AIInlineResponseProps {
  pageId?: string | null;
  commandType: AICommandType;
  noteContent: string;
  noteTitle: string;
  /** For /ask — the user typed a question after the /ask trigger */
  userQuery?: string;
  onInsert: (text: string) => void;
  onDismiss: () => void;
}

export const AIInlineResponse: React.FC<AIInlineResponseProps> = ({
  pageId: _pageId,
  commandType,
  noteContent,
  noteTitle,
  userQuery,
  onInsert,
  onDismiss,
}) => {
  const { t, i18n } = useTranslation();
  const pl = i18n.language === 'pl';
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const responseRef = useRef('');

  const startStream = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setError(null);
    setResponse('');
    responseRef.current = '';

    const systemPrompt = t(`myWorkNotebook.aiInlineResponse.systemPrompt_${commandType}`);

    let message: string;
    switch (commandType) {
      case 'ask':
        message = userQuery
          ? `Question: ${userQuery}\n\nNote context:\nTitle: ${noteTitle}\n${noteContent}`
          : `Analyze this note and provide insights:\nTitle: ${noteTitle}\n${noteContent}`;
        break;
      case 'expand':
        message = `Expand this content:\n\nTitle: ${noteTitle}\n${noteContent}`;
        break;
      case 'challenge':
        message = `Challenge the thinking in this note:\n\nTitle: ${noteTitle}\n${noteContent}`;
        break;
      case 'action':
        message = `Propose next steps based on:\n\nTitle: ${noteTitle}\n${noteContent}`;
        break;
    }

    try {
      await Api.chatWithAIStream(
        message,
        [],
        (chunk) => {
          responseRef.current += chunk;
          setResponse(responseRef.current);
        },
        () => {
          setIsStreaming(false);
        },
        systemPrompt,
        undefined,
        undefined,
        pl ? 'pl' : 'en',
        undefined,
        { responseStyle: 'concise', selectedTier: 'STANDARD' },
        controller.signal
      );
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(t('myWorkNotebook.aiInlineResponse.failed'));
        setIsStreaming(false);
      }
    }

    trackFunnelEvent('notebook_ai_command_used', { command: commandType });
  }, [commandType, noteContent, noteTitle, userQuery, pl, t]);

  useEffect(() => {
    startStream();
    return () => {
      abortRef.current?.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    toast.success(t('myWorkNotebook.aiInlineResponse.copied'));
  };

  const label = t(`myWorkNotebook.aiInlineResponse.label_${commandType}`);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-3">
      <div className="rounded-xl border border-c-border-subtle bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950/30 dark:to-blue-950/20 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 border-b border-c-border-subtle">
          <div className="flex items-center gap-2 text-xs font-medium text-c-text-secondary">
            <Sparkles size={14} />
            <span>{label}</span>
            {isStreaming && <Loader2 size={12} className="animate-spin text-c-text-muted" />}
          </div>
          <button
            onClick={() => {
              abortRef.current?.abort();
              onDismiss();
            }}
            className="p-1 rounded-md text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised"
            aria-label={t('myWorkNotebook.aiInlineResponse.close')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-3 text-sm text-c-text whitespace-pre-wrap leading-relaxed min-h-[48px] max-h-[300px] overflow-y-auto">
          {error ? (
            <span className="text-c-danger">{error}</span>
          ) : response ? (
            response
          ) : (
            <span className="text-c-text-muted">
              {t('myWorkNotebook.aiInlineResponse.generating')}
            </span>
          )}
        </div>

        {!isStreaming && response && !error && (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-c-border-subtle">
            <button
              onClick={() => onInsert(response)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-c-text hover:brightness-110 text-c-surface text-xs font-medium transition-colors"
            >
              <Check size={12} />
              {t('myWorkNotebook.aiInlineResponse.proposeForNote')}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-c-surface hover:bg-c-surface-raised text-c-text border border-c-border-subtle text-xs font-medium transition-colors"
            >
              <Copy size={12} />
              {t('myWorkNotebook.aiInlineResponse.copy')}
            </button>
            <button
              onClick={() => {
                abortRef.current?.abort();
                onDismiss();
              }}
              className="px-3 py-1.5 rounded-lg text-c-text-muted hover:bg-c-surface-raised text-xs font-medium transition-colors"
            >
              {t('myWorkNotebook.aiInlineResponse.dismiss')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
