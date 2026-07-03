/**
 * InitiativeEditor
 *
 * Modal/Panel component for editing an initiative before approval.
 */

import { AlertTriangle, Plus, Save, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DRDAxis, GeneratedInitiative, InitiativeRiskLevel } from '../../types';

interface InitiativeEditorProps {
  initiative: GeneratedInitiative;
  onSave: (updates: Partial<GeneratedInitiative>) => void;
  onCancel: () => void;
}

// B8.1: Use i18n keys instead of hardcoded English labels
const AXIS_OPTIONS: { value: DRDAxis; labelKey: string; fallback: string }[] = [
  { value: 'processes', labelKey: 'initiatives.axis.processes', fallback: 'Processes' },
  {
    value: 'digitalProducts',
    labelKey: 'initiatives.axis.digitalProducts',
    fallback: 'Digital Products',
  },
  {
    value: 'businessModels',
    labelKey: 'initiatives.axis.businessModels',
    fallback: 'Business Models',
  },
  {
    value: 'dataManagement',
    labelKey: 'initiatives.axis.dataManagement',
    fallback: 'Data Management',
  },
  { value: 'culture', labelKey: 'initiatives.axis.culture', fallback: 'Organizational Culture' },
  { value: 'cybersecurity', labelKey: 'initiatives.axis.cybersecurity', fallback: 'Cybersecurity' },
  { value: 'aiMaturity', labelKey: 'initiatives.axis.aiMaturity', fallback: 'AI Maturity' },
];

// RISK_OPTIONS will be translated in component using t()
const RISK_OPTIONS: { value: InitiativeRiskLevel; labelKey: string }[] = [
  { value: 'LOW', labelKey: 'initiatives.risk.low' },
  { value: 'MEDIUM', labelKey: 'initiatives.risk.medium' },
  { value: 'HIGH', labelKey: 'initiatives.risk.high' },
];

// B8.1: Use i18n keys for timeline options
const TIMELINE_OPTIONS: { value: string; labelKey: string; fallback: string }[] = [
  { value: '1-3 months', labelKey: 'initiatives.timeline.1_3', fallback: '1-3 months' },
  { value: '3-6 months', labelKey: 'initiatives.timeline.3_6', fallback: '3-6 months' },
  { value: '6-9 months', labelKey: 'initiatives.timeline.6_9', fallback: '6-9 months' },
  { value: '9-12 months', labelKey: 'initiatives.timeline.9_12', fallback: '9-12 months' },
  { value: '12-18 months', labelKey: 'initiatives.timeline.12_18', fallback: '12-18 months' },
  { value: '18-24 months', labelKey: 'initiatives.timeline.18_24', fallback: '18-24 months' },
];

export const InitiativeEditor: React.FC<InitiativeEditorProps> = ({
  initiative,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();

  // Form state
  const [name, setName] = useState(initiative.name);
  const [description, setDescription] = useState(initiative.description);
  const [sourceAxisId, setSourceAxisId] = useState(initiative.sourceAxisId);
  const [estimatedROI, setEstimatedROI] = useState(initiative.estimatedROI);
  const [estimatedBudget, setEstimatedBudget] = useState(initiative.estimatedBudget);
  const [timeline, setTimeline] = useState(initiative.timeline);
  const [riskLevel, setRiskLevel] = useState(initiative.riskLevel);
  const [objectives, setObjectives] = useState<string[]>(initiative.objectives || []);
  const [newObjective, setNewObjective] = useState('');

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate on change - use useMemo for computed errors
  const computedErrors = React.useMemo(() => {
    const newErrors: Record<string, string> = {};

    if (!name || name.length < 5) {
      newErrors.name = t('initiatives.form.nameMinLength');
    }

    if (!description || description.length < 20) {
      newErrors.description = t('initiatives.form.descriptionMinLength');
    }

    if (estimatedBudget <= 0) {
      newErrors.estimatedBudget = t('initiatives.form.budgetRequired');
    }

    if (estimatedROI <= 0) {
      newErrors.estimatedROI = t('initiatives.form.roiRequired');
    }

    return newErrors;
  }, [name, description, estimatedBudget, estimatedROI, t]);

  // Sync errors state with computed errors
  useEffect(() => {
    queueMicrotask(() => setErrors(computedErrors));
  }, [computedErrors]);

  const handleAddObjective = () => {
    if (newObjective.trim()) {
      setObjectives([...objectives, newObjective.trim()]);
      setNewObjective('');
    }
  };

  const handleRemoveObjective = (index: number) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (Object.keys(errors).length > 0) {
      return;
    }

    onSave({
      name,
      description,
      sourceAxisId,
      estimatedROI,
      estimatedBudget,
      timeline,
      riskLevel,
      objectives,
    });
  };

  const isValid = Object.keys(errors).length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-navy-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-900 dark:text-white">
            {t('initiatives.form.edit')}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('initiatives.form.nameRequired')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`
                                w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                ${
                                  errors.name
                                    ? 'border-danger-300 dark:border-danger-500/50 focus:ring-danger-500'
                                    : 'border-slate-200 dark:border-navy-700 focus:ring-[color:var(--c-focus)]'
                                }
                            `}
              placeholder={t('initiatives.form.namePlaceholder')}
            />
            {errors.name && <p className="text-xs text-danger-500">{errors.name}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('initiatives.form.description')} *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={`
                                w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-navy-950 text-navy-900 dark:text-white resize-none
                                ${
                                  errors.description
                                    ? 'border-danger-300 dark:border-danger-500/50 focus:ring-danger-500'
                                    : 'border-slate-200 dark:border-navy-700 focus:ring-[color:var(--c-focus)]'
                                }
                            `}
              placeholder={t('initiatives.form.descriptionPlaceholder')}
            />
            {errors.description && <p className="text-xs text-danger-500">{errors.description}</p>}
          </div>

          {/* Grid: Axis + Risk */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.form.sourceAxis')}
              </label>
              <select
                value={sourceAxisId}
                onChange={(e) => setSourceAxisId(e.target.value as DRDAxis)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
              >
                {AXIS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey, opt.fallback)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.form.riskLevel')}
              </label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as InitiativeRiskLevel)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
              >
                {RISK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid: Budget + ROI + Timeline */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.form.budget')} *
              </label>
              <input
                type="number"
                value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(parseInt(e.target.value) || 0)}
                className={`
                                    w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                    ${
                                      errors.estimatedBudget
                                        ? 'border-danger-300 dark:border-danger-500/50'
                                        : 'border-slate-200 dark:border-navy-700'
                                    }
                                `}
              />
              {errors.estimatedBudget && (
                <p className="text-xs text-danger-500">{errors.estimatedBudget}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.form.expectedROI')} *
              </label>
              <input
                type="number"
                step="0.1"
                value={estimatedROI}
                onChange={(e) => setEstimatedROI(parseFloat(e.target.value) || 0)}
                className={`
                                    w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-navy-950 text-navy-900 dark:text-white
                                    ${
                                      errors.estimatedROI
                                        ? 'border-danger-300 dark:border-danger-500/50'
                                        : 'border-slate-200 dark:border-navy-700'
                                    }
                                `}
              />
              {errors.estimatedROI && (
                <p className="text-xs text-danger-500">{errors.estimatedROI}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('initiatives.form.timeline')}
              </label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
              >
                {TIMELINE_OPTIONS.map((tl) => (
                  <option key={tl.value} value={tl.value}>
                    {t(tl.labelKey, tl.fallback)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Objectives */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('initiatives.form.objectives')}
            </label>

            {objectives.length > 0 && (
              <ul className="space-y-2 mb-3">
                {objectives.map((obj, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-navy-950 rounded-lg"
                  >
                    <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-medium text-primary-600 dark:text-primary-400 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{obj}</span>
                    <button
                      onClick={() => handleRemoveObjective(idx)}
                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-danger-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddObjective()}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white text-sm"
                placeholder={t('initiatives.form.addObjective')}
              />
              <button
                onClick={handleAddObjective}
                disabled={!newObjective.trim()}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Warning for high budget + high risk */}
          {riskLevel === 'HIGH' && estimatedBudget > 500000 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-500/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {t('initiatives.form.highRiskHighBudget')}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {t('initiatives.form.highRiskHighBudgetDesc')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-end gap-3 bg-slate-50 dark:bg-navy-950">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {t('initiatives.form.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="flex items-center gap-2 p-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors"
          >
            <Save size={18} />
            {t('initiatives.form.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
