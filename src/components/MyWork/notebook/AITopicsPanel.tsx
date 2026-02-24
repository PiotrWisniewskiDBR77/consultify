/**
 * AITopicsPanel — AI-suggested topics worth analyzing for the note.
 * Remove: dismiss topic and fetch replacement. Add: insert into note as AI callout.
 */
import type { Editor } from '@tiptap/react';
import { Loader2, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface AITopicsPanelProps {
  open: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle: string;
  noteTags: string[];
  contentText: string;
  editor: Editor | null;
}

export const AITopicsPanel: React.FC<AITopicsPanelProps> = ({
  open,
  onClose,
  noteId,
  noteTitle,
  noteTags,
  contentText,
  editor,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [replacingFor, setReplacingFor] = useState<string | null>(null);

  const fetchTopics = useCallback(
    async (excluded: string[] = []) => {
      setLoading(true);
      setError(null);
      try {
        const { topics: next } = await Api.suggestNotebookTopics(noteId, {
          excludedTopics: excluded,
          language: isPl ? 'pl' : 'en',
        });
        setTopics(next || []);
        trackFunnelEvent('notebook_ai_topics_fetched', { noteId, count: (next || []).length });
      } catch (err: any) {
        const msg = err?.message || (isPl ? 'Błąd pobierania' : 'Fetch failed');
        setError(msg);
        setTopics([]);
        toast.error(msg);
      } finally {
        setLoading(false);
        setReplacingFor(null);
      }
    },
    [noteId, isPl]
  );

  useEffect(() => {
    if (open && noteId) {
      setDismissed(new Set());
      fetchTopics();
    }
  }, [open, noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemove = useCallback(
    async (topic: string) => {
      setDismissed((prev) => new Set(prev).add(topic));
      const remaining = topics.filter((t) => t !== topic);
      setTopics(remaining);
      setReplacingFor(topic);
      try {
        const excluded = [...remaining, topic, ...dismissed];
        const { topics: next } = await Api.suggestNotebookTopics(noteId, {
          excludedTopics: excluded,
          language: isPl ? 'pl' : 'en',
        });
        const newOne = (next || []).find((t) => !excluded.includes(t));
        if (newOne) setTopics((prev) => [...prev, newOne]);
      } catch {
        /* keep remaining list */
      } finally {
        setReplacingFor(null);
      }
    },
    [topics, dismissed, noteId, isPl]
  );

  const handleAdd = useCallback(
    (topic: string) => {
      if (!editor) return;
      const aiLabel = isPl ? 'Sugestia AI' : 'AI suggestion';
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'callout',
          attrs: { variant: 'purple' },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `✨ ${aiLabel}: ${topic}` }],
            },
          ],
        })
        .run();
      setTopics((prev) => prev.filter((t) => t !== topic));
      trackFunnelEvent('notebook_ai_topic_added', { noteId });
      toast.success(isPl ? 'Dodano do notatki' : 'Added to note');
    },
    [editor, isPl, noteId]
  );

  if (!open) return null;

  return (
    <div className="w-72 shrink-0 border-l border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 flex flex-col">
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-navy-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-300">
          <Sparkles size={16} />
          <span>{isPl ? 'Tematy do analizy' : 'Topics to analyze'}</span>
        </div>
        <div className="flex items-center gap-1">
          {(topics.length === 0 || error) && (
            <button
              onClick={() => fetchTopics()}
              disabled={loading}
              className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 disabled:opacity-50"
              title={isPl ? 'Generuj sugestie' : 'Generate suggestions'}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading && topics.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Loader2 size={20} className="animate-spin text-purple-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isPl ? 'AI analizuje notatkę...' : 'AI analyzing note...'}
            </span>
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center px-3">
            <Sparkles size={24} className="text-slate-300 dark:text-slate-600" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {error
                ? (isPl ? 'Nie udało się pobrać. Kliknij odśwież w nagłówku.' : 'Failed to fetch. Click refresh in header.')
                : (isPl ? 'Brak sugestii. Dodaj treść lub tagi.' : 'No suggestions. Add content or tags.')}
            </span>
            <button
              onClick={() => fetchTopics()}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isPl ? 'Generuj' : 'Generate'}
            </button>
          </div>
        ) : (
          topics.map((topic) => (
            <div
              key={topic}
              className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-900/60 px-3 py-2.5"
            >
              <p className="text-sm text-slate-800 dark:text-slate-200">{topic}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => handleAdd(topic)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-1 text-[11px] font-medium transition-colors"
                >
                  <Plus size={12} />
                  {isPl ? 'Dodaj' : 'Add'}
                </button>
                <button
                  onClick={() => handleRemove(topic)}
                  disabled={replacingFor === topic}
                  className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-500 hover:text-red-600 hover:bg-red-500/10 dark:hover:bg-red-500/10 px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
                  title={isPl ? 'Usuń i pobierz kolejną' : 'Remove and fetch next'}
                >
                  {replacingFor === topic ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-800">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {isPl
            ? 'AI sugeruje tematy na podstawie notatki i tagów. Dodaj do notatki lub usuń, by zobaczyć kolejne.'
            : 'AI suggests topics from note and tags. Add to note or remove to see more.'}
        </p>
      </div>
    </div>
  );
};
