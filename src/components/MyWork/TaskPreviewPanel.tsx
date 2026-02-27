import { ExternalLink, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { PreviewPaneShell } from '@/components/ui/ResizableTable';
import { Api } from '@/services/api';

export interface TaskPreviewPanelProps {
  taskId: string | null;
  onClose: () => void;
  onOpenFullDetail: (taskId: string, taskData?: any) => void;
  onDidMutate?: () => void;
}

const formatShortDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const TaskPreviewPanel: React.FC<TaskPreviewPanelProps> = ({
  taskId,
  onClose,
  onOpenFullDetail,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<any | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const res = await Api.get(`/tasks/${taskId}`);
      setTask(res);
    } catch (e) {
      setTask(null);
      toast.error(isPolish ? 'Nie udało się wczytać zadania' : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [taskId, isPolish]);

  useEffect(() => {
    setTask(null);
    if (taskId) fetchDetails();
  }, [taskId, fetchDetails]);

  const title = String(task?.title || task?.name || (isPolish ? 'Zadanie' : 'Task'));
  const status = String(task?.status || '—').replace(/_/g, ' ');
  const priority = task?.priority ? String(task.priority) : '—';
  const dueDate = formatShortDate(task?.dueDate || task?.due_date || null) || '—';
  const assigneeName = task?.assignee?.firstName
    ? `${task.assignee.firstName} ${task.assignee.lastName || ''}`.trim()
    : task?.assignee_name || task?.assigneeName || '—';
  const description = task?.description ? String(task.description) : '';

  return (
    <aside className="w-[420px] flex-shrink-0 bg-slate-50 dark:bg-navy-950 h-full p-3 overflow-hidden border-l border-slate-200 dark:border-navy-700">
      <PreviewPaneShell
        kicker={isPolish ? 'Podgląd' : t('common.preview', 'Preview')}
        title={title}
        onClose={onClose}
        actions={
          taskId ? (
            <button
              onClick={() => onOpenFullDetail(taskId, task)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
              title={isPolish ? 'Otwórz pełny widok' : 'Open full detail'}
            >
              <ExternalLink size={13} />
              {isPolish ? 'Otwórz' : 'Open'}
            </button>
          ) : null
        }
      >
        {!taskId ? (
          <div className="h-full flex items-center justify-center p-6 text-center">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Wybierz zadanie z listy, aby zobaczyć podgląd.'
                : 'Select a task to preview.'}
            </div>
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center p-6">
            <Loader2 className="animate-spin text-primary-500" size={22} />
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="text-slate-500 dark:text-slate-400">
                {isPolish ? 'Status' : 'Status'}
              </span>
              <span className="text-slate-900 dark:text-slate-100">{status}</span>

              <span className="text-slate-500 dark:text-slate-400">
                {isPolish ? 'Priorytet' : 'Priority'}
              </span>
              <span className="text-slate-900 dark:text-slate-100">{priority}</span>

              <span className="text-slate-500 dark:text-slate-400">
                {isPolish ? 'Termin' : 'Due'}
              </span>
              <span className="text-slate-900 dark:text-slate-100">{dueDate}</span>

              <span className="text-slate-500 dark:text-slate-400">
                {isPolish ? 'Przypisane' : 'Assignee'}
              </span>
              <span className="text-slate-900 dark:text-slate-100">{assigneeName}</span>
            </div>

            {description && (
              <div className="pt-2 border-t border-slate-200 dark:border-navy-700">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  {isPolish ? 'Opis' : 'Description'}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap line-clamp-6">
                  {description}
                </div>
              </div>
            )}
          </div>
        )}
      </PreviewPaneShell>
    </aside>
  );
};

export default TaskPreviewPanel;
