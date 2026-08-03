import { X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { createOkrCheckIn } from '@/services/api/okrStrategic';

interface OkrCheckInModalProps {
  projectId?: string;
  keyResultId: string;
  keyResultLabel: string;
  /** Metric-KR (not milestone): check-in `value` becomes the new `current`
   *  reading server-side. D7 (manual-only): this applies regardless of
   *  whether the KR has an informational `kpiId` reference — there is no
   *  auto-score path. Hidden only for milestone-type KRs (graded via the
   *  check-in's explicit `score`, not a current/baseline/target reading). */
  isManualMetric: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CONFIDENCE_OPTIONS: Array<{
  value: 'green' | 'amber' | 'red';
  labelPl: string;
  labelEn: string;
  dot: string;
}> = [
  { value: 'green', labelPl: 'Na torze', labelEn: 'On track', dot: 'bg-emerald-500' },
  { value: 'amber', labelPl: 'Zagrożone', labelEn: 'At risk', dot: 'bg-amber-500' },
  { value: 'red', labelPl: 'Poza torem', labelEn: 'Off track', dot: 'bg-red-500' },
];

/**
 * Weekly check-in on a Key Result (Doerr/Google cadence): confidence RAG +
 * optional new value reading + note. `createOkrCheckIn` persists the row and
 * server-side recomputes+persists the KR's score.
 */
export const OkrCheckInModal: React.FC<OkrCheckInModalProps> = ({
  projectId,
  keyResultId,
  keyResultLabel,
  isManualMetric,
  onClose,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [saving, setSaving] = useState(false);
  const [confidence, setConfidence] = useState<'green' | 'amber' | 'red'>('amber');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        await createOkrCheckIn(projectId, keyResultId, {
          confidence,
          value: isManualMetric && value ? Number(value) : null,
          note: note.trim() || null,
        });
        toast.success(t('results.okr.checkInSaved', 'Check-in saved'));
        onSuccess();
      } catch (error: any) {
        toast.error(
          error?.message || t('results.okr.checkInFailed', 'Failed to save the check-in')
        );
      } finally {
        setSaving(false);
      }
    },
    [confidence, value, note, isManualMetric, projectId, keyResultId, onSuccess, t]
  );

  const inputCls =
    'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors';
  const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('results.okr.checkIn', 'Check-in')}
            </h2>
            <p
              className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400"
              title={keyResultLabel}
            >
              {keyResultLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>{t('results.okr.confidence', 'Confidence')}</label>
            <div className="flex gap-2">
              {CONFIDENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setConfidence(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                    confidence === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-slate-900 dark:text-white'
                      : 'border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
                  {isPolish ? opt.labelPl : opt.labelEn}
                </button>
              ))}
            </div>
          </div>

          {isManualMetric && (
            <div>
              <label className={labelCls}>
                {t('results.okr.newValue', 'New value (optional)')}
              </label>
              <input
                className={inputCls}
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t('results.okr.newValuePlaceholder', 'Latest reading')}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>{t('results.okr.note', 'Note (optional)')}</label>
            <textarea
              className={`${inputCls} h-16 resize-none py-2`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('results.okr.notePlaceholder', "What's driving this week's status?")}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-sm font-medium rounded-full border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 text-sm font-medium rounded-full bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {saving
                ? t('common.saving', 'Saving...')
                : t('results.okr.saveCheckIn', 'Save check-in')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OkrCheckInModal;
