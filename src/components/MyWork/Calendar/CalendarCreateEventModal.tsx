import { AlertTriangle, CalendarDays, CheckSquare, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/primitives/Button';
import { Modal } from '@/components/ui/primitives/Modal';
import Api from '@/services/api';

interface CalendarConflictItem {
  id: string;
  title: string;
  due_date?: string | null;
  deadline?: string | null;
}

interface CalendarConflictResponse {
  date: string;
  tasks: CalendarConflictItem[];
  decisions: CalendarConflictItem[];
  totalItems: number;
  hasConflicts: boolean;
  suggestion?: string | null;
}

interface CalendarCreateEventModalProps {
  open: boolean;
  defaultDate: Date;
  onClose: () => void;
  onCreated?: () => void;
}

type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'monthly';

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const CalendarCreateEventModal: React.FC<CalendarCreateEventModalProps> = ({
  open,
  defaultDate,
  onClose,
  onCreated,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toDateInputValue(defaultDate));
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>('none');
  const [saving, setSaving] = useState(false);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflicts, setConflicts] = useState<CalendarConflictResponse | null>(null);
  const [conflictsError, setConflictsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setDate(toDateInputValue(defaultDate));
    setRecurrencePreset('none');
    setConflicts(null);
    setConflictsError(null);
  }, [defaultDate, open]);

  useEffect(() => {
    if (!open || !date) return;

    let cancelled = false;
    const loadConflicts = async () => {
      try {
        setConflictsLoading(true);
        setConflictsError(null);
        const res = await Api.getMyWorkCalendarConflicts(date);
        if (!cancelled) setConflicts(res?.data ?? res ?? null);
      } catch (error: any) {
        if (!cancelled) {
          setConflicts(null);
          setConflictsError(
            error?.status === 503
              ? t('myWork.calendarCreateEvent.dayLoadPreviewIs', 'Day-load preview is temporarily unavailable, but you can still create the task.')
              : t('myWork.calendarCreateEvent.failedToCheckDay', 'Failed to check day load.')
          );
        }
      } finally {
        if (!cancelled) setConflictsLoading(false);
      }
    };

    loadConflicts();
    return () => {
      cancelled = true;
    };
  }, [date, isPolish, open]);

  const totalExistingItems = Number(conflicts?.totalItems ?? 0);
  const hasBusyDay = Boolean(conflicts?.hasConflicts);
  const hasCalendarWarning = hasBusyDay || Boolean(conflictsError);

  const helperText = useMemo(() => {
    if (conflictsLoading) {
      return t('myWork.calendarCreateEvent.checkingDayLoad', 'Checking day load...');
    }
    if (conflictsError) {
      return conflictsError;
    }
    if (!conflicts) return null;
    if (totalExistingItems === 0) {
      return t('myWork.calendarCreateEvent.thisDayLooksClear', 'This day looks clear.');
    }
    return isPolish
      ? `Na ten dzień masz już ${totalExistingItems} pozycji.`
      : `You already have ${totalExistingItems} items on this day.`;
  }, [conflicts, conflictsError, conflictsLoading, isPolish, totalExistingItems]);

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    if (!title.trim()) {
      toast.error(t('myWork.calendarCreateEvent.toastError', 'Title is required'));
      return;
    }

    try {
      setSaving(true);
      await Api.createMyWorkCalendarEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        start: date,
        allDay: true,
        source: 'task',
        recurrence: recurrencePreset === 'none' ? undefined : { preset: recurrencePreset },
      });
      toast.success(t('myWork.calendarCreateEvent.toastSuccess', 'Task added to calendar'));
      onCreated?.();
      onClose();
    } catch (error) {
      console.error('Failed to create calendar event', error);
      toast.error(t('myWork.calendarCreateEvent.toastError2', 'Failed to add to calendar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('myWork.calendarCreateEvent.title', 'Add to calendar')}
      description={
        t('myWork.calendarCreateEvent.inV1CalendarCreation', 'In V1, calendar creation produces a personal task with a due date, aligned with My Work logic.')
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('myWork.calendarCreateEvent.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="calendar-create-event-form"
            loading={saving}
          >
            {t('myWork.calendarCreateEvent.add', 'Add')}
          </Button>
        </>
      }
    >
      <form id="calendar-create-event-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-navy-950 dark:text-slate-300">
          <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
            <CheckSquare size={16} className="text-primary-500" />
            {t('myWork.calendarCreateEvent.artifactTypeTask', 'Artifact type: Task')}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('myWork.calendarCreateEvent.decisionsAndInitiativesFrom', 'Decisions and initiatives from calendar are prepared for a later phase.')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {t('myWork.calendarCreateEvent.title2', 'Title')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder={t('myWork.calendarCreateEvent.placeholder', 'e.g. Prepare review deck')}
            className="w-full rounded-lg border border-slate-300/60 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-navy-600/40 dark:bg-navy-950 dark:text-slate-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {t('myWork.calendarCreateEvent.recurrence', 'Recurrence')}
          </label>
          <select
            value={recurrencePreset}
            onChange={(event) => setRecurrencePreset(event.target.value as RecurrencePreset)}
            className="w-full rounded-lg border border-slate-300/60 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-navy-600/40 dark:bg-navy-950 dark:text-slate-100"
          >
            <option value="none">{t('myWork.calendarCreateEvent.none', 'None')}</option>
            <option value="daily">{t('myWork.calendarCreateEvent.daily', 'Daily')}</option>
            <option value="weekly">{t('myWork.calendarCreateEvent.weekly', 'Weekly')}</option>
            <option value="monthly">{t('myWork.calendarCreateEvent.monthly', 'Monthly')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {t('myWork.calendarCreateEvent.description', 'Description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={
              t('myWork.calendarCreateEvent.shortContextOrDefinition', 'Short context or definition of done...')
            }
            className="w-full rounded-lg border border-slate-300/60 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-navy-600/40 dark:bg-navy-950 dark:text-slate-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {t('myWork.calendarCreateEvent.date', 'Date')}
          </label>
          <div className="relative">
            <CalendarDays
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300/60 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-navy-600/40 dark:bg-navy-950 dark:text-slate-100"
            />
          </div>
          {helperText && <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}
        </div>

        <div
          className={`rounded-xl px-4 py-3 ${
            hasCalendarWarning
              ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100'
              : 'bg-slate-50 text-slate-700 dark:bg-navy-950 dark:text-slate-300'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={16}
              className={hasCalendarWarning ? 'text-amber-500' : 'text-slate-600'}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {hasCalendarWarning
                  ? isPolish
                    ? conflictsError
                      ? 'Podglad dnia jest ograniczony'
                      : 'Dzień jest już dość obciążony'
                    : conflictsError
                      ? 'Day preview is limited'
                      : 'This day is already fairly busy'
                  : t('myWork.calendarCreateEvent.dayLoadPreview', 'Day load preview')}
              </div>
              <div className="mt-1 text-xs opacity-80">
                {conflictsError ||
                  conflicts?.suggestion ||
                  (t('myWork.calendarCreateEvent.theFormChecksExisting', 'The form checks existing tasks and decisions for the selected day.'))}
              </div>

              {totalExistingItems > 0 && (
                <div className="mt-3 space-y-2">
                  {conflicts?.tasks?.slice(0, 3).map((item) => (
                    <div key={`task-${item.id}`} className="text-xs">
                      {t('myWork.calendarCreateEvent.task', 'Task')}: {item.title}
                    </div>
                  ))}
                  {conflicts?.decisions?.slice(0, 3).map((item) => (
                    <div key={`decision-${item.id}`} className="text-xs">
                      {t('myWork.calendarCreateEvent.decision', 'Decision')}: {item.title}
                    </div>
                  ))}
                </div>
              )}

              {conflictsLoading && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs opacity-80">
                  <Loader2 size={14} className="animate-spin" />
                  {t('myWork.calendarCreateEvent.loadingConflicts', 'Loading conflicts...')}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CalendarCreateEventModal;
