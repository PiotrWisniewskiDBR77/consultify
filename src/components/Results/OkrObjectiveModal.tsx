import { X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { createOkrObjective, type OkrCycle, updateOkrObjective } from '@/services/api/okrStrategic';

export interface OkrObjectiveModalObjective {
  id: string;
  label: string;
  parentId?: string | null;
  cycleId?: string | null;
  description?: string | null;
}

interface OkrObjectiveModalProps {
  projectId?: string;
  objective?: OkrObjectiveModalObjective | null;
  /** Candidate parents (existing top-level or any objective, excluding self). */
  objectiveOptions: Array<{ id: string; label: string }>;
  cycles: OkrCycle[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Create/edit an OKR Objective. Mirrors KPICreateModal's pattern: direct
 * fetch calls (okrStrategic.ts), toast success/error, `onSuccess()` triggers
 * the parent's refetch — no local cache.
 */
export const OkrObjectiveModal: React.FC<OkrObjectiveModalProps> = ({
  projectId,
  objective,
  objectiveOptions,
  cycles,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const isEdit = Boolean(objective?.id);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(objective?.label ?? '');
  const [description, setDescription] = useState(objective?.description ?? '');
  const [parentId, setParentId] = useState(objective?.parentId ?? '');
  const [cycleId, setCycleId] = useState(objective?.cycleId ?? '');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!label.trim()) return;
      setSaving(true);
      try {
        if (isEdit && objective) {
          await updateOkrObjective(projectId, objective.id, {
            label: label.trim(),
            description: description.trim() || null,
            parentId: parentId || null,
            cycleId: cycleId || null,
          });
          toast.success(t('results.okr.objectiveUpdated', 'Objective updated'));
        } else {
          await createOkrObjective(projectId, {
            label: label.trim(),
            description: description.trim() || null,
            parentId: parentId || null,
            cycleId: cycleId || null,
          });
          toast.success(t('results.okr.objectiveCreated', 'Objective created'));
        }
        onSuccess();
      } catch (error: any) {
        toast.error(
          error?.message || t('results.okr.objectiveSaveFailed', 'Failed to save the objective')
        );
      } finally {
        setSaving(false);
      }
    },
    [isEdit, objective, label, description, parentId, cycleId, projectId, onSuccess, t]
  );

  const inputCls =
    'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors';
  const selectCls = `${inputCls} appearance-none`;
  const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEdit
              ? t('results.okr.editObjective', 'Edit Objective')
              : t('results.okr.newObjective', 'New Objective')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>{t('results.okr.label', 'Objective')} *</label>
            <input
              className={inputCls}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('results.okr.labelPlaceholder', 'e.g. Become the market leader in X')}
              required
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>{t('results.okr.description', 'Description')}</label>
            <textarea
              className={`${inputCls} h-20 resize-none py-2`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('results.okr.descriptionPlaceholder', 'Why does this matter?')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('results.okr.cycle', 'Cycle')}</label>
              <select
                className={selectCls}
                value={cycleId}
                onChange={(e) => setCycleId(e.target.value)}
              >
                <option value="">{t('results.okr.noCycle', '— No cycle —')}</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('results.okr.parent', 'Parent objective')}</label>
              <select
                className={selectCls}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">{t('results.okr.noParent', '— Top-level —')}</option>
                {objectiveOptions
                  .filter((o) => o.id !== objective?.id)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
              </select>
            </div>
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
              disabled={!label.trim() || saving}
              className="h-9 px-5 text-sm font-medium rounded-full bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {saving
                ? t('common.saving', 'Saving...')
                : isEdit
                  ? t('common.save', 'Save')
                  : t('results.okr.createObjective', 'Create Objective')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OkrObjectiveModal;
