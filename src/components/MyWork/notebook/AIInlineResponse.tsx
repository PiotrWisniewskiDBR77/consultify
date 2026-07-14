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

const SYSTEM_PROMPTS: Record<AICommandType, { en: string; pl: string }> = {
  ask: {
    en: "You are a helpful assistant embedded in a notebook. Answer the user's question using the context of the note provided. Be concise and actionable. Respond in the same language as the note.",
    pl: 'Jesteś asystentem wbudowanym w notatnik. Odpowiedz na pytanie użytkownika, korzystając z kontekstu notatki. Bądź zwięzły i praktyczny. Odpowiadaj w tym samym języku co notatka.',
  },
  expand: {
    en: 'You are a writing assistant. Expand and elaborate on the paragraph provided. Keep the same style, tone and language. Add depth, examples, or supporting arguments. Do NOT repeat the original text, only provide the expansion.',
    pl: 'Jesteś asystentem pisania. Rozwiń podany akapit. Zachowaj ten sam styl, ton i język. Dodaj głębię, przykłady lub argumenty wspierające. NIE powtarzaj oryginalnego tekstu, podaj tylko rozszerzenie.',
  },
  challenge: {
    en: 'You are a critical thinking advisor. Read the note and ask 3-5 pointed, critical questions that challenge the assumptions, identify blind spots, and provoke deeper thinking. Be constructive but tough. Format as a numbered list.',
    pl: 'Jesteś doradcą krytycznego myślenia. Przeczytaj notatkę i zadaj 3-5 celnych, krytycznych pytań, które podważają założenia, identyfikują martwe pola i prowokują głębsze myślenie. Bądź konstruktywny ale wymagający. Sformatuj jako listę numerowaną.',
  },
  action: {
    en: 'You are a strategic action advisor. Based on the note content, propose 3-5 concrete, actionable next steps. Each should include: what to do, who should own it, and a suggested timeline. Format as a numbered list.',
    pl: 'Jesteś doradcą strategicznym. Na podstawie treści notatki zaproponuj 3-5 konkretnych, wykonalnych następnych kroków. Każdy powinien zawierać: co zrobić, kto powinien to prowadzić i sugerowany termin. Sformatuj jako listę numerowaną.',
  },
};

const COMMAND_LABELS: Record<AICommandType, { en: string; pl: string }> = {
  ask: { en: 'AI Answer', pl: 'Odpowiedź AI' },
  expand: { en: 'AI Expansion', pl: 'Rozwinięcie AI' },
  challenge: { en: 'AI Challenge', pl: 'Pytania krytyczne AI' },
  action: { en: 'AI Action Plan', pl: 'Plan działań AI' },
};

export const AIInlineResponse: React.FC<AIInlineResponseProps> = ({
  pageId: _pageId,
  commandType,
  noteContent,
  noteTitle,
  userQuery,
  onInsert,
  onDismiss,
}) => {
  const { i18n } = useTranslation();
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

    const systemPrompt = pl ? SYSTEM_PROMPTS[commandType].pl : SYSTEM_PROMPTS[commandType].en;

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
        setError(pl ? 'Nie udało się uzyskać odpowiedzi AI' : 'Failed to get AI response');
        setIsStreaming(false);
      }
    }

    trackFunnelEvent('notebook_ai_command_used', { command: commandType });
  }, [commandType, noteContent, noteTitle, userQuery, pl]);

  useEffect(() => {
    startStream();
    return () => {
      abortRef.current?.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    toast.success(pl ? 'Skopiowano' : 'Copied');
  };

  const label = pl ? COMMAND_LABELS[commandType].pl : COMMAND_LABELS[commandType].en;

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
            aria-label={pl ? 'Zamknij' : 'Close'}
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
              {pl ? 'Generowanie odpowiedzi…' : 'Generating response…'}
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
              {pl ? 'Zaproponuj do notatki' : 'Propose for note'}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-c-surface hover:bg-c-surface-raised text-c-text border border-c-border-subtle text-xs font-medium transition-colors"
            >
              <Copy size={12} />
              {pl ? 'Kopiuj' : 'Copy'}
            </button>
            <button
              onClick={() => {
                abortRef.current?.abort();
                onDismiss();
              }}
              className="px-3 py-1.5 rounded-lg text-c-text-muted hover:bg-c-surface-raised text-xs font-medium transition-colors"
            >
              {pl ? 'Odrzuć' : 'Dismiss'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
