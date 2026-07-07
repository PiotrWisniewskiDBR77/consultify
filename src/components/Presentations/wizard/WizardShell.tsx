import { Check, Sparkles, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { WizardStep } from './types';

const STEPS: { key: WizardStep; labelKey: string }[] = [
  { key: 'sources', labelKey: 'presentations.steps.sources' },
  { key: 'setup', labelKey: 'presentations.steps.setup' },
  { key: 'outline', labelKey: 'presentations.steps.outline' },
  { key: 'result', labelKey: 'presentations.steps.result' },
];

const STEP_ORDER: WizardStep[] = ['sources', 'setup', 'outline', 'generating', 'result'];

interface WizardShellProps {
  step: WizardStep;
  onClose?: () => void;
  children: React.ReactNode;
}

export const WizardShell: React.FC<WizardShellProps> = ({ step, onClose, children }) => {
  const { t } = useTranslation();
  const currentIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950">
      <div className="border-b border-slate-200 dark:border-navy-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-c-info" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t('presentations.wizard.title', 'Presentation Generator')}
            </h1>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-600 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-4 max-w-5xl mx-auto">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && <div className="flex-1 h-px bg-slate-200 dark:bg-navy-700" />}
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  step === s.key || (step === 'generating' && s.key === 'result')
                    ? 'bg-navy-900 text-white'
                    : currentIndex > STEP_ORDER.indexOf(s.key)
                      ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-500'
                }`}
              >
                {currentIndex > STEP_ORDER.indexOf(s.key) ? (
                  <Check size={14} />
                ) : (
                  <span className="w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{t(s.labelKey, s.key)}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
};
