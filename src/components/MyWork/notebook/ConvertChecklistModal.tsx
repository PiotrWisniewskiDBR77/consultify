import { CheckSquare, Loader2, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface TaskItemNode {
  text: string;
  checked: boolean;
}

interface ConvertChecklistModalProps {
  open: boolean;
  onClose: () => void;
  contentJson: any;
  noteId: string;
  noteTitle: string;
  onConverted?: (taskIds: string[]) => void;
}

function extractTaskItems(doc: any): TaskItemNode[] {
  const items: TaskItemNode[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (node.type === 'taskItem') {
      const text = extractTextFromNode(node);
      if (text.trim()) {
        items.push({ text: text.trim(), checked: Boolean(node.attrs?.checked) });
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return items;
}

function extractTextFromNode(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (Array.isArray(node.content)) return node.content.map(extractTextFromNode).join('');
  return '';
}

export const ConvertChecklistModal: React.FC<ConvertChecklistModalProps> = ({
  open,
  onClose,
  contentJson,
  noteId,
  noteTitle,
  onConverted,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const taskItems = useMemo(() => extractTaskItems(contentJson), [contentJson]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(taskItems.map((_, i) => i)));
  const [creating, setCreating] = useState(false);

  const toggleItem = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === taskItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(taskItems.map((_, i) => i)));
    }
  }, [selected.size, taskItems]);

  const handleCreate = useCallback(async () => {
    const toCreate = taskItems.filter((_, i) => selected.has(i));
    if (toCreate.length === 0) return;

    setCreating(true);
    const createdIds: string[] = [];

    try {
      for (const item of toCreate) {
        const result = await Api.createPersonalTask({
          title: item.text,
          description: `${t('myWorkNotebook.convertChecklistModal.fromNote')}: ${noteTitle}`,
          status: 'todo',
          priority: 'medium',
          tags: ['from-notebook'],
        });
        if (result?.id) createdIds.push(result.id);
      }

      trackFunnelEvent('notebook_checklist_bulk_convert', {
        noteId,
        count: createdIds.length,
      });

      toast.success(
        t('myWorkNotebook.convertChecklistModal.tasksCreated', {
          count: createdIds.length,
          noun:
            createdIds.length === 1
              ? t('myWorkNotebook.convertChecklistModal.taskSingular')
              : t('myWorkNotebook.convertChecklistModal.taskPlural'),
        })
      );
      onConverted?.(createdIds);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || t('myWorkNotebook.convertChecklistModal.createFailed'));
    } finally {
      setCreating(false);
    }
  }, [taskItems, selected, noteId, noteTitle, isPl, onConverted, onClose, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-c-surface rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200/60 dark:border-white/[0.03]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-c-border-subtle">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-c-success" />
            <h3 className="text-sm font-semibold text-c-text">
              {t('myWorkNotebook.convertChecklistModal.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-c-text-secondary hover:text-c-text-secondary transition-colors"
            aria-label={t('myWorkNotebook.convertChecklistModal.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-80 overflow-y-auto">
          {taskItems.length === 0 ? (
            <p className="text-sm text-c-text-muted text-center py-6">
              {t('myWorkNotebook.convertChecklistModal.noItems')}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-c-text-muted">
                  {selected.size} / {taskItems.length}{' '}
                  {t('myWorkNotebook.convertChecklistModal.selected')}
                </span>
                <button
                  onClick={toggleAll}
                  className="text-xs text-c-accent hover:brightness-110 font-medium"
                >
                  {selected.size === taskItems.length
                    ? t('myWorkNotebook.convertChecklistModal.deselectAll')
                    : t('myWorkNotebook.convertChecklistModal.selectAll')}
                </button>
              </div>
              <div className="space-y-1.5">
                {taskItems.map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-c-surface-raised cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      onChange={() => toggleItem(idx)}
                      className="mt-0.5 rounded border-c-border-subtle text-c-accent focus:ring-[var(--c-focus)]"
                    />
                    <span
                      className={`text-sm ${item.checked ? 'line-through text-c-text-muted' : 'text-c-text-secondary'}`}
                    >
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle bg-c-surface-raised">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-c-text-secondary hover:text-c-text transition-colors"
          >
            {t('myWorkNotebook.convertChecklistModal.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-c-success text-white text-xs font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {creating && <Loader2 size={12} className="animate-spin" />}
            {t('myWorkNotebook.convertChecklistModal.createButton', {
              count: selected.size,
              noun:
                selected.size === 1
                  ? t('myWorkNotebook.convertChecklistModal.taskSingular')
                  : t('myWorkNotebook.convertChecklistModal.taskPlural'),
            })}
          </button>
        </div>
      </div>
    </div>
  );
};
