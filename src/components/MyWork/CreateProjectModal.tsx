import { Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (project: any) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [description, setDescription] = useState('');
  const [standard, setStandard] = useState<'pmbok' | 'prince2' | 'agile' | 'safe' | 'custom'>(
    'pmbok'
  );
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setGoal('');
    setDescription('');
    setStandard('pmbok');
    setStartDate('');
    setTargetEndDate('');
    setBudgetAmount('');
  }, [isOpen]);

  if (!isOpen) return null;

  const submitProject = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const project = await Api.createProject({
        name: name.trim(),
        goal: goal.trim() || undefined,
        description: description.trim() || undefined,
        status: 'active',
        pmo_standard: standard,
        start_date: startDate || undefined,
        target_end_date: targetEndDate || undefined,
        budget_amount: budgetAmount ? Number(budgetAmount) : undefined,
        budget_currency: 'EUR',
      });
      toast.success(t('myWork.createProjectModal.created', 'Project created'));
      onSaved(project);
      onClose();
    } catch (error: any) {
      toast.error(
        error?.message || t('myWork.createProjectModal.failed', 'Failed to create project')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-c-border bg-c-surface-raised px-3 py-2 text-sm text-c-text';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          className="w-full max-w-xl overflow-hidden rounded-xl border border-c-border bg-c-surface shadow-2xl"
          onSubmit={(event) => {
            event.preventDefault();
            void submitProject();
          }}
        >
          <div className="flex items-start justify-between border-b border-c-border px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-c-text">
                {t('myWork.createProjectModal.title', 'New project')}
              </h2>
              <p className="text-sm text-c-text-muted">
                {t(
                  'myWork.createProjectModal.help',
                  'Create the project artifact before or together with its initiative.'
                )}
              </p>
            </div>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={onClose}
              className="rounded-lg p-2 text-c-text-muted hover:bg-c-surface-raised"
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6">
            <label className="col-span-2 text-sm font-medium text-c-text">
              {t('myWork.createProjectModal.name', 'Name')} *
              <input
                autoFocus
                className={`${inputClass} mt-1.5`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="col-span-2 text-sm font-medium text-c-text">
              {t('myWork.createProjectModal.goal', 'Goal')}
              <input
                className={`${inputClass} mt-1.5`}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
            <label className="col-span-2 text-sm font-medium text-c-text">
              {t('myWork.createProjectModal.description', 'Description')}
              <textarea
                className={`${inputClass} mt-1.5 resize-none`}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-c-text">
              {t('myWork.createProjectModal.standard', 'Delivery standard')}
              <select
                className={`${inputClass} mt-1.5`}
                value={standard}
                onChange={(e) => setStandard(e.target.value as typeof standard)}
              >
                <option value="pmbok">PMBOK-lite</option>
                <option value="prince2">PRINCE2</option>
                <option value="agile">Agile</option>
                <option value="safe">SAFe</option>
                <option value="custom">{t('common.custom', 'Custom')}</option>
              </select>
            </label>
            <label className="text-sm font-medium text-c-text">
              {t('myWork.createProjectModal.budget', 'Budget (EUR)')}
              <input
                type="number"
                min="0"
                className={`${inputClass} mt-1.5`}
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-c-text">
              {t('myWork.createProjectModal.start', 'Start date')}
              <input
                type="date"
                className={`${inputClass} mt-1.5`}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-c-text">
              {t('myWork.createProjectModal.targetEnd', 'Target end date')}
              <input
                type="date"
                className={`${inputClass} mt-1.5`}
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-c-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-c-border px-4 py-2 text-sm text-c-text"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-bg disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {t('common.create', 'Create')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default CreateProjectModal;
