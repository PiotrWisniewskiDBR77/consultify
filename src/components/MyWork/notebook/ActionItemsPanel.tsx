import { CheckSquare, Loader2, Sparkles, X, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

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
      await Api.streamNotebookActionExtraction(noteId, {
        language: isPl ? 'pl' : 'en',
        onEvent: (data) => {
          if (data.type === 'stage') setStageLabel(String(data.label || ''));
          if (data.type === 'actions')
            setItems(Array.isArray(data.items) ? (data.items as ActionItem[]) : []);
          if (data.type === 'done') setLoading(false);
          if (data.type === 'error') {
            toast.error(String(data.message || 'Error'));
            setLoading(false);
          }
        },
      });
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
          sourceType: 'notebook_page',
          sourceId: noteId,
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
    high: 'text-c-danger bg-c-danger/10',
    medium: 'text-c-warning bg-c-warning/10',
    low: 'text-c-text-muted bg-c-surface-raised',
  };

  return (
    <div className="w-72 shrink-0 rounded-2xl border border-c-border-subtle overflow-hidden bg-c-surface-raised flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-c-border-subtle">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-c-warning" />
          <span className="text-xs font-semibold text-c-text">
            {isPl ? 'Akcje AI' : 'AI Actions'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-c-text-secondary hover:text-c-text transition-colors"
          aria-label={isPl ? 'Zamknij' : 'Close'}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Loader2 size={20} className="animate-spin text-c-accent" />
            <span className="text-xs text-c-text-muted">{stageLabel}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Zap size={20} className="text-c-text-secondary" />
            <span className="text-xs text-c-text-muted">
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
                    ? 'border-c-success/30 bg-c-success/8'
                    : 'border-c-border-subtle bg-c-surface'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium ${createdIds.has(idx) ? 'text-c-success line-through' : 'text-c-text'}`}
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
                        <span className="text-[9px] text-c-text-muted">{item.suggestedDue}</span>
                      )}
                    </div>
                  </div>
                  {!createdIds.has(idx) && (
                    <button
                      onClick={() => handleCreateTask(item, idx)}
                      disabled={creatingIdx !== null}
                      className="shrink-0 p-1 rounded-md bg-c-success/10 text-c-success hover:bg-c-success/20 disabled:opacity-50 transition-colors"
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
        <div className="px-3 py-2.5 border-t border-c-border-subtle">
          <button
            onClick={handleCreateAll}
            disabled={creatingIdx !== null}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-c-success text-white text-xs font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
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
