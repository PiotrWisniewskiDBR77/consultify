/**
 * AICommandPrompt — pole do wpisania dowolnego polecenia AI (np. "dopisz plan w 5 krokach...").
 * Wynik wstawiany jako callout primary z oznaczeniem AI.
 */
import type { Editor } from '@tiptap/react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface AICommandPromptProps {
  editor: Editor | null;
  pageId?: string | null;
  noteTitle: string;
  noteContent: string;
  noteTags: string[];
  onProposalCreated?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

const PLACEHOLDER_PL = 'np. dopisz plan w 5 krokach jak wdrożyć…';
const PLACEHOLDER_EN = 'e.g. write a 5-step plan to implement…';

export const AICommandPrompt: React.FC<AICommandPromptProps> = ({
  editor,
  pageId,
  noteTitle,
  noteContent,
  noteTags,
  onProposalCreated,
  onFocus,
  onBlur,
  inputRef: inputRefProp,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const [command, setCommand] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = (inputRefProp ?? internalRef) as React.RefObject<HTMLInputElement>;
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    const cmd = command.trim();
    if (!cmd || !editor) return;

    setIsGenerating(true);
    abortRef.current = new AbortController();
    let result = '';

    const systemPrompt = isPl
      ? 'Jesteś asystentem w notatniku. Użytkownik podaje polecenie dotyczące notatki. Wykonaj polecenie i zwróć TYLKO wygenerowany tekst — bez komentarzy, bez "Oto wynik:", bez markdown. Odpowiadaj w tym samym języku co polecenie.'
      : 'You are a notebook assistant. The user gives a command about their note. Execute the command and return ONLY the generated text — no commentary, no "Here is the result:", no markdown. Respond in the same language as the command.';

    const userMessage = `Command: ${cmd}\n\nNote context:\nTitle: ${noteTitle}\nTags: ${noteTags.join(', ') || 'none'}\nContent:\n${noteContent.slice(0, 2000)}`;

    try {
      await Api.chatWithAIStream(
        userMessage,
        [],
        (chunk) => {
          result += chunk;
        },
        () => {
          const text = result.trim();
          if (text && editor && pageId) {
            const aiLabel = isPl ? 'Komentarz AI' : 'AI comment';
            const paragraphs = text.split(/\n\n+/).filter(Boolean);
            const blockContent = {
              type: 'callout',
              attrs: { variant: 'primary' },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: `✨ ${aiLabel}` }],
                },
                ...paragraphs.map((p) => ({
                  type: 'paragraph',
                  content: [{ type: 'text', text: p.trim() }],
                })),
              ],
            };
            void Api.notebookCreateAIProposal(pageId, {
              proposalType: 'append',
              blockContent,
              rationale: cmd.slice(0, 500),
            })
              .then(() => {
                trackFunnelEvent('notebook_ai_command_prompt_used', { commandLength: cmd.length });
                onProposalCreated?.();
                toast.success(
                  isPl ? 'Propozycja AI gotowa do review' : 'AI proposal ready for review'
                );
              })
              .catch(() => {
                toast.error(
                  isPl ? 'Nie udało się utworzyć propozycji AI' : 'Failed to create AI proposal'
                );
              });
          }
          setCommand('');
          setIsGenerating(false);
        },
        systemPrompt,
        undefined,
        undefined,
        isPl ? 'pl' : 'en',
        undefined,
        { responseStyle: 'concise', selectedTier: 'STANDARD' },
        abortRef.current.signal
      );
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error(isPl ? 'Nie udało się wykonać polecenia' : 'Failed to execute command');
        setIsGenerating(false);
      }
    }
  }, [command, editor, noteTitle, noteContent, noteTags, isPl, pageId, onProposalCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      execute();
    }
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-c-border-subtle/60 dark:border-slate-800/40 bg-c-surface-raised px-3 py-1.5 ${className}`}
    >
      <Sparkles size={14} className="shrink-0 text-c-text-muted" />
      <input
        ref={inputRef}
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={isPl ? PLACEHOLDER_PL : PLACEHOLDER_EN}
        disabled={isGenerating}
        className="flex-1 min-w-0 bg-transparent text-sm text-c-text placeholder:text-c-text-muted outline-none"
      />
      <button
        onClick={execute}
        disabled={!command.trim() || isGenerating}
        className="p-1.5 rounded-md bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised0/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        title={isPl ? 'Wykonaj polecenie' : 'Execute command'}
      >
        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      </button>
    </div>
  );
};
