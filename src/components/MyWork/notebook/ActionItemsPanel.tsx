import { CheckSquare, Loader2, Sparkles, X, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api, API_URL } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { tokenService } from '@/services/tokenService';

interface ActionItem {
  title: string;
  suggestedOwner: string | null;
  suggestedDue: string | null;
  priority: 'high' | 'medium' | 'low';
}

interface ActionItemsPanelProps {
  open: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle: string;
}

export const ActionItemsPanel: React.FC<ActionItemsPanelProps> = ({
  open,
  onClose,
  noteId,
  noteTitle,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [stageLabel, setStageLabel] = useState('');
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);
  const [createdIds, setCreatedIds] = useState<Set<number>>(new Set());

  const extractActions = useCallback(async () => {
    setLoading(true);
    setItems([]);
    setStageLabel(isPl ? 'Analizuję...' : 'Analyzing...');
    setCreatedIds(new Set());

    try {
      const token = tokenService.getToken();
      const res = await fetch(
        `${API_URL}/my-work/notebook/pages/${encodeURIComponent(noteId)}/extract-actions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ language: isPl ? 'pl' : 'en' }),
        }
      );

      if (!res.ok) throw new Error('Failed to extract actions');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'stage') setStageLabel(data.label || '');
            if (data.type === 'actions') setItems(data.items || []);
            if (data.type === 'done') setLoading(false);
            if (data.type === 'error') {
              toast.error(data.message || 'Error');
              setLoading(false);
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Extraction failed');
    } finally {
      setLoading(false);
    }
  }, [noteId, isPl]);

  useEffect(() => {
    if (open && noteId) extractActions();
  }, [open, noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateTask = useCallback(
    async (item: ActionItem, idx: number) => {
      setCreatingIdx(idx);
      try {
        await Api.createPersonalTask({
          title: item.title,
          description: `${isPl ? 'Z notatki' : 'From note'}: ${noteTitle}`,
          status: 'todo',
          priority: item.priority || 'medium',
          tags: ['from-notebook', 'ai-extracted'],
          sourceType: 'notebook_page',
          sourceId: noteId,
        });
        setCreatedIds((prev) => new Set(prev).add(idx));
        trackFunnelEvent('notebook_action_item_created', { noteId, idx });
        toast.success(isPl ? 'Task utworzony' : 'Task created');
      } catch (err: any) {
        toast.error(err?.message || 'Failed');
      } finally {
        setCreatingIdx(null);
      }
    },
    [noteId, noteTitle, isPl]
  );

  const handleCreateAll = useCallback(async () => {
    const remaining = items.filter((_, i) => !createdIds.has(i));
    if (remaining.length === 0) return;
    setCreatingIdx(-1);
    let count = 0;
    try {
      for (let i = 0; i < items.length; i++) {
        if (createdIds.has(i)) continue;
        await Api.createPersonalTask({
          title: items[i].title,
          description: `${isPl ? 'Z notatki' : 'From note'}: ${noteTitle}`,
          status: 'todo',
          priority: items[i].priority || 'medium',
          tags: ['from-notebook', 'ai-extracted'],
        });
        setCreatedIds((prev) => new Set(prev).add(i));
        count++;
      }
      trackFunnelEvent('notebook_action_items_bulk_created', { noteId, count });
      toast.success(isPl ? `Utworzono ${count} tasków` : `Created ${count} tasks`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally {
      setCreatingIdx(null);
    }
  }, [items, createdIds, noteId, noteTitle, isPl]);

  if (!open) return null;

  const priorityColors: Record<string, string> = {
    high: 'text-red-500 bg-red-500/10',
    medium: 'text-amber-500 bg-amber-500/10',
    low: 'text-slate-500 bg-slate-500/10',
  };

  return (
    <div className="w-72 shrink-0 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] overflow-hidden bg-slate-50/80 dark:bg-navy-950/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/60 dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-500" />
          <span className="text-xs font-semibold text-slate-800 dark:text-white">
            {isPl ? 'Akcje AI' : 'AI Actions'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">{stageLabel}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Zap size={20} className="text-slate-300 dark:text-slate-600" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isPl ? 'Brak akcji do wyodrębnienia' : 'No action items found'}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-2.5 border transition-all ${
                  createdIds.has(idx)
                    ? 'border-emerald-200 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/10'
                    : 'border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-navy-900/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium ${createdIds.has(idx) ? 'text-emerald-600 dark:text-emerald-400 line-through' : 'text-slate-800 dark:text-white'}`}
                    >
                      {item.title}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${priorityColors[item.priority] || priorityColors.medium}`}
                      >
                        {item.priority}
                      </span>
                      {item.suggestedDue && (
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">
                          {item.suggestedDue}
                        </span>
                      )}
                    </div>
                  </div>
                  {!createdIds.has(idx) && (
                    <button
                      onClick={() => handleCreateTask(item, idx)}
                      disabled={creatingIdx !== null}
                      className="shrink-0 p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                      title={isPl ? 'Utwórz task' : 'Create task'}
                    >
                      {creatingIdx === idx ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckSquare size={12} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && createdIds.size < items.length && (
        <div className="px-3 py-2.5 border-t border-slate-200/60 dark:border-white/[0.06]">
          <button
            onClick={handleCreateAll}
            disabled={creatingIdx !== null}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-all"
          >
            {creatingIdx === -1 && <Loader2 size={12} className="animate-spin" />}
            {isPl
              ? `Utwórz wszystkie (${items.length - createdIds.size})`
              : `Create all (${items.length - createdIds.size})`}
          </button>
        </div>
      )}
    </div>
  );
};
