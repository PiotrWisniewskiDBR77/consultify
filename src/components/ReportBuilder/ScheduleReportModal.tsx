/**
 * ScheduleReportModal — Phase 10.2
 *
 * Modal for scheduling recurring report generation from a template.
 * Supports frequency selection, day/time configuration, and delivery methods.
 */

import { Bell, Calendar, Check, Clock, Loader2, Mail, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

interface ScheduleReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateName: string;
  isPl: boolean;
  onScheduleCreated?: (schedule: Record<string, unknown>) => void;
}

const DAYS_OF_WEEK = [
  { value: 1, labelEn: 'Monday', labelPl: 'Poniedziałek' },
  { value: 2, labelEn: 'Tuesday', labelPl: 'Wtorek' },
  { value: 3, labelEn: 'Wednesday', labelPl: 'Środa' },
  { value: 4, labelEn: 'Thursday', labelPl: 'Czwartek' },
  { value: 5, labelEn: 'Friday', labelPl: 'Piątek' },
  { value: 6, labelEn: 'Saturday', labelPl: 'Sobota' },
  { value: 0, labelEn: 'Sunday', labelPl: 'Niedziela' },
];

const FREQUENCY_OPTIONS: { value: Frequency; labelEn: string; labelPl: string }[] = [
  { value: 'weekly', labelEn: 'Weekly', labelPl: 'Co tydzień' },
  { value: 'biweekly', labelEn: 'Biweekly', labelPl: 'Co dwa tygodnie' },
  { value: 'monthly', labelEn: 'Monthly', labelPl: 'Co miesiąc' },
  { value: 'quarterly', labelEn: 'Quarterly', labelPl: 'Co kwartał' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ScheduleReportModal: React.FC<ScheduleReportModalProps> = ({
  isOpen,
  onClose,
  templateId,
  templateName,
  isPl,
  onScheduleCreated,
}) => {
  const { t } = useTranslation();

  // Form state
  const [scheduleName, setScheduleName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState('09:00');
  const [deliveryEmail, setDeliveryEmail] = useState(true);
  const [deliveryDashboard, setDeliveryDashboard] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsDayOfWeek = frequency === 'weekly' || frequency === 'biweekly';
  const needsDayOfMonth = frequency === 'monthly' || frequency === 'quarterly';

  const resetForm = useCallback(() => {
    setScheduleName('');
    setFrequency('weekly');
    setDayOfWeek(1);
    setDayOfMonth(1);
    setTime('09:00');
    setDeliveryEmail(true);
    setDeliveryDashboard(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!scheduleName.trim()) {
      toast.error(t('scheduleModal.nameRequired', 'Podaj nazwę harmonogramu'));
      return;
    }

    const deliveryMethods: string[] = [];
    if (deliveryEmail) deliveryMethods.push('email');
    if (deliveryDashboard) deliveryMethods.push('dashboard');

    if (deliveryMethods.length === 0) {
      toast.error(
        t('scheduleModal.deliveryRequired', 'Wybierz co najmniej jedną metodę dostarczania')
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        templateId,
        scheduleName: scheduleName.trim(),
        frequency,
        time,
        deliveryMethods,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      if (needsDayOfWeek) body.dayOfWeek = dayOfWeek;
      if (needsDayOfMonth) body.dayOfMonth = dayOfMonth;

      const res = await Api.post('/api/report-builder/schedule', body);

      toast.success(t('scheduleModal.created', 'Harmonogram utworzony'));
      onScheduleCreated?.(res.data?.data || res.data || {});
      resetForm();
      onClose();
    } catch (err) {
      console.error('[ScheduleReportModal] Error creating schedule:', err);
      toast.error(t('scheduleModal.createError', 'Nie udało się utworzyć harmonogramu'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    scheduleName,
    frequency,
    dayOfWeek,
    dayOfMonth,
    time,
    deliveryEmail,
    deliveryDashboard,
    templateId,
    needsDayOfWeek,
    needsDayOfMonth,
    onClose,
    onScheduleCreated,
    resetForm,
    t,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('scheduleModal.title', 'Zaplanuj raport')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('scheduleModal.fromTemplate', 'Na podstawie szablonu')}: {templateName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Schedule Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('scheduleModal.nameLabel', 'Nazwa harmonogramu')}
            </label>
            <input
              type="text"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              placeholder={isPl ? 'np. Tygodniowy raport statusu' : 'e.g. Weekly Status Report'}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-colors"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Calendar size={14} className="inline mr-1.5 -mt-0.5" />
              {t('scheduleModal.frequencyLabel', 'Częstotliwość')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    frequency === opt.value
                      ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium'
                      : 'border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {isPl ? opt.labelPl : opt.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Day of Week */}
          {needsDayOfWeek && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t('scheduleModal.dayOfWeekLabel', 'Dzień tygodnia')}
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-colors"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>
                    {isPl ? d.labelPl : d.labelEn}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Day of Month */}
          {needsDayOfMonth && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t('scheduleModal.dayOfMonthLabel', 'Dzień miesiąca')}
              </label>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-colors"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Clock size={14} className="inline mr-1.5 -mt-0.5" />
              {t('scheduleModal.timeLabel', 'Godzina')}
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-colors"
            />
          </div>

          {/* Delivery Methods */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('scheduleModal.deliveryLabel', 'Metoda dostarczania')}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={deliveryEmail}
                  onChange={(e) => setDeliveryEmail(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-primary-600 focus:ring-primary-500/50"
                />
                <Mail size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {t('scheduleModal.deliveryEmail', 'E-mail')}
                </span>
              </label>
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={deliveryDashboard}
                  onChange={(e) => setDeliveryDashboard(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-primary-600 focus:ring-primary-500/50"
                />
                <Bell size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {t('scheduleModal.deliveryDashboard', 'Powiadomienie w aplikacji')}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-navy-950/50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            {t('common.cancel', 'Anuluj')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t('common.creating', 'Tworzenie...')}
              </>
            ) : (
              <>
                <Check size={14} />
                {t('scheduleModal.createBtn', 'Utwórz harmonogram')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleReportModal;
