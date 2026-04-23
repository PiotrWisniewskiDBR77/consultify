/**
 * ToolWizardHeader — Top header bar for the wizard
 * Follows app-table-standard h-9 controls, module-hub-standard topbar layout.
 */

import { ArrowLeft, Lock, Save } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { WizardSessionData, WizardStepId, WizardToolConfig } from './types';

interface ToolWizardHeaderProps {
  config: WizardToolConfig;
  sessionData: WizardSessionData;
  currentStep: WizardStepId;
  onBack: () => void;
  onSave?: () => void;
  saving?: boolean;
  locked?: boolean;
}

export const ToolWizardHeader: React.FC<ToolWizardHeaderProps> = ({
  config,
  sessionData,
  currentStep,
  onBack,
  onSave,
  saving,
  locked,
}) => {
  const { i18n, t } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  const STEP_ORDER: WizardStepId[] = ['define', 'inputs', 'work', 'review', 'finalize', 'outputs'];
  const stepIdx = STEP_ORDER.indexOf(currentStep);
  const totalSteps = STEP_ORDER.length;
  const progressPercent = Math.round(((stepIdx + 1) / totalSteps) * 100);

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-400 dark:border-transparent',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-transparent',
    REVIEW: 'bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-transparent',
    FINALIZED: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-transparent',
  };

  return (
    <div className="shrink-0 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
      <div className="flex items-center gap-3 px-4 h-12">
        {/* Back button */}
        <button
          onClick={onBack}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          title={t('common.back', 'Back')}
        >
          <ArrowLeft size={18} />
        </button>

        {/* Tool badge + name */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-primary-100 text-primary-800 border border-primary-200 dark:bg-primary-500/15 dark:text-primary-400 dark:border-transparent uppercase tracking-wide shrink-0">
            {config.category.slice(0, 3)}
          </span>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {config.toolName[lang]}
          </h1>
        </div>

        {/* Status badge */}
        <span
          className={`px-2 py-0.5 text-[11px] font-medium rounded ${statusColors[sessionData.status] || statusColors.DRAFT}`}
        >
          {sessionData.status}
        </span>

        {locked && <Lock size={14} className="text-slate-600 dark:text-slate-500" aria-label="Locked" />}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-400">
          <span>
            {t('tools.wizard.step', 'Step')} {stepIdx + 1}/{totalSteps}
          </span>
          <div
            className="w-20 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-primary-600 dark:bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Save button */}
        {onSave && !locked && (
          <button
            onClick={onSave}
            disabled={saving}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
          >
            <Save size={14} />
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
        )}
      </div>
    </div>
  );
};
