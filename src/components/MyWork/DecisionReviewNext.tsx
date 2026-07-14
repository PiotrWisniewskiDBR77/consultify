import { Loader2, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { DecisionPreviewPanel } from './DecisionPreviewPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';

type ReviewMode = 'my' | 'requests_pending';

export interface DecisionReviewNextProps {
  mode: ReviewMode;
  onOpenFullDetail: (decisionId: string, decisionData?: any) => void;
  onExit: () => void;
}

export const DecisionReviewNext: React.FC<DecisionReviewNextProps> = ({
  mode,
  onOpenFullDetail,
  onExit,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const selected = items[selectedIdx] || null;
  const selectedId = selected?.id ? String(selected.id) : null;

  const fetchPage = useCallback(
    async (nextCursor?: number | null) => {
      try {
        setLoading(true);
        const data = await Api.getMyWorkDecisionQueue({
          mode: mode === 'requests_pending' ? 'requests_pending' : 'my',
          limit: 50,
          cursor: nextCursor ?? null,
        });
        setItems(Array.isArray(data?.items) ? data.items : []);
        setCursor(data?.nextCursor ?? null);
        setSelectedIdx(0);
      } catch (e) {
        toast.error(t('myWork.decisionReviewNext.toastError', 'Failed to load queue'));
        setItems([]);
        setCursor(null);
      } finally {
        setLoading(false);
      }
    },
    [mode, isPolish]
  );

  useEffect(() => {
    fetchPage(null);
  }, [fetchPage]);

  const selectNext = useCallback(() => {
    setSelectedIdx((idx) => Math.min(items.length - 1, idx + 1));
  }, [items.length]);

  const selectPrev = useCallback(() => {
    setSelectedIdx((idx) => Math.max(0, idx - 1));
  }, []);

  const removeSelectedFromList = useCallback(() => {
    setItems((prev) => {
      if (!selectedId) return prev;
      const next = prev.filter((x) => String(x?.id) !== selectedId);
      return next;
    });
    setSelectedIdx((idx) => Math.max(0, Math.min(idx, items.length - 2)));
  }, [items.length, selectedId]);

  const actApprove = useCallback(async () => {
    if (!selectedId) return;
    try {
      await Api.decideDecision(selectedId, 'approved', 'Approved');
      toast.success(t('myWork.decisionReviewNext.toastSuccess', 'Approved'));
      removeSelectedFromList();
    } catch {
      toast.error(t('myWork.decisionReviewNext.toastError2', 'Approve failed'));
    }
  }, [selectedId, removeSelectedFromList, isPolish]);

  const actReject = useCallback(async () => {
    if (!selectedId) return;
    try {
      await Api.decideDecision(selectedId, 'rejected', 'Rejected');
      toast.success(t('myWork.decisionReviewNext.toastSuccess2', 'Rejected'));
      removeSelectedFromList();
    } catch {
      toast.error(t('myWork.decisionReviewNext.toastError3', 'Reject failed'));
    }
  }, [selectedId, removeSelectedFromList, isPolish]);

  const actSnoozeTomorrow = useCallback(async () => {
    if (!selectedId) return;
    try {
      await Api.snoozeDecision(selectedId, { preset: 'tomorrow' });
      toast.success(t('myWork.decisionReviewNext.toastSuccess3', 'Snoozed'));
      removeSelectedFromList();
    } catch {
      toast.error(t('myWork.decisionReviewNext.toastError4', 'Snooze failed'));
    }
  }, [selectedId, removeSelectedFromList, isPolish]);

  const shortcuts = useKeyboardShortcuts({
    enabled: true,
    onNavigateDown: selectNext,
    onNavigateUp: selectPrev,
    onCancel: onExit,
    onOpen: () => {
      if (selectedId) onOpenFullDetail(selectedId, selected);
    },
  });

  // Review-next specific keys (A/R/S, J/K, ? handled by hook help)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
      if (isInput || target?.isContentEditable) return;

      if (e.key === 'a' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        actApprove();
        return;
      }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        actReject();
        return;
      }
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        actSnoozeTomorrow();
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [actApprove, actReject, actSnoozeTomorrow]);

  const title = useMemo(() => {
    if (mode === 'requests_pending')
      return t('myWork.decisionReviewNext.reviewNextMyRequests', 'Review next: my requests');
    return t('myWork.decisionReviewNext.reviewNextMyDecisions', 'Review next: my decisions');
  }, [mode, isPolish]);

  return (
    <div className="flex h-full bg-white dark:bg-navy-950">
      <div className="flex-1 min-w-0 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <Sparkles size={16} className="text-primary-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'myWork.decisionReviewNext.jKNavigateA',
                  'J/K navigate, A approve, R reject, S snooze, ? help'
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onExit}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-900 text-slate-700 dark:text-slate-200"
          >
            {t('myWork.decisionReviewNext.exit', 'Exit')}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('myWork.decisionReviewNext.loading', 'Loading…')}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('myWork.decisionReviewNext.queueIsEmpty', 'Queue is empty.')}
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="w-[360px] flex-shrink-0 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-700 text-xs text-slate-500 dark:text-slate-400">
                {t('myWork.decisionReviewNext.queue', 'Queue')} ({items.length})
              </div>
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                {items.map((it, idx) => (
                  <button
                    key={String(it.id)}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-navy-800 hover:bg-slate-50 dark:hover:bg-navy-900 ${
                      idx === selectedIdx ? 'bg-primary-50 dark:bg-primary-500/10' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-900 dark:text-white line-clamp-1">
                      {String(it.title || 'Decision')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {String(it.projectName || '')}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <DecisionPreviewPanel
                decisionId={selectedId}
                mode={mode}
                onClose={() => {}}
                onDidMutate={() => fetchPage(null)}
                onOpenFullDetail={onOpenFullDetail}
              />
            </div>
          </div>
        )}

        <KeyboardShortcutsHelp
          isOpen={shortcuts.showHelp}
          onClose={() => shortcuts.setShowHelp(false)}
        />
      </div>
    </div>
  );
};

export default DecisionReviewNext;
