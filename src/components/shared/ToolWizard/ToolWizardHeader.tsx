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
    DRAFT: 'bg-slate-500/20 text-slate-600',
    IN_PROGRESS: 'bg-blue-500/20 text-blue-400',
    REVIEW: 'bg-amber-500/20 text-amber-400',
    FINALIZED: 'bg-emerald-500/20 text-emerald-400',
  };

  return (
    <div className="shrink-0 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
      <div className="flex items-center gap-3 px-4 h-12">
        {/* Back button */}
        <button
          onClick={onBack}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          title={t('common.back', 'Back')}
        >
          <ArrowLeft size={18} />
        </button>

        {/* Tool badge + name */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-primary-500/15 text-primary-500 uppercase tracking-wide shrink-0">
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

        {locked && <Lock size={14} className="text-slate-600 dark:text-slate-500" />}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {t('tools.wizard.step', 'Step')} {stepIdx + 1}/{totalSteps}
          </span>
          <div className="w-20 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Save button */}
        {onSave && !locked && (
          <button
            onClick={onSave}
            disabled={saving}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-sm font-medium bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
        )}
      </div>
    </div>
  );
};
