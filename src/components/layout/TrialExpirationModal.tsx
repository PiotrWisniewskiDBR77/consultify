import React from 'react';
import { useTranslation } from 'react-i18next';

interface TrialExpirationModalProps {
  isOpen: boolean;
  organizationName: string;
  onUpgradeClick: () => void;
  onContactSalesClick: () => void;
  onDismiss: () => void;
}

/**
 * TrialExpirationModal - Modal shown when trial expires
 * Explains read-only mode and provides upgrade/contact CTAs
 */
const TrialExpirationModal: React.FC<TrialExpirationModalProps> = ({
  isOpen,
  organizationName,
  onUpgradeClick,
  onContactSalesClick,
  onDismiss,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onDismiss} />

      {/* Modal — DBR77 tech-sexy */}
      <div className="relative bg-white dark:bg-navy-900 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-slate-200 dark:border-c-border-subtle">
        {/* Header — single accent */}
        <div className="bg-danger-500/10 dark:bg-danger-500/5 border-b border-danger-500/20 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-danger-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-danger-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {t('trialExpired.title', 'Trial Expired')}
              </h2>
              {organizationName && (
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  {organizationName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            {t(
              'trialExpired.message',
              'Your trial period has ended. Your data is safe, but your organization is now in read-only mode.'
            )}
          </p>

          <div className="bg-slate-50 dark:bg-navy-800/50 rounded-lg p-4 mb-6 border border-slate-200/50 dark:border-c-border-subtle">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
              {t('trialExpired.whatNext', 'What happens now?')}
            </h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-success-500">✓</span>
                {t('trialExpired.dataSafe', 'Your data is preserved and secure')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success-500">✓</span>
                {t('trialExpired.canView', 'You can still view all projects and tasks')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-500">✗</span>
                {t('trialExpired.noCreate', 'You cannot create or modify content')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger-500">✗</span>
                {t('trialExpired.noAI', 'AI features are disabled')}
              </li>
            </ul>
          </div>

          {/* Actions — DBR77 single CTA accent */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onUpgradeClick}
              className="w-full py-3 px-4 bg-c-text hover:bg-c-text-secondary text-c-bg font-semibold rounded-lg transition-colors"
            >
              {t('trialExpired.upgrade', 'Upgrade Now')}
            </button>
            <button
              onClick={onContactSalesClick}
              className="w-full py-3 px-4 bg-slate-50 dark:bg-navy-800/50 border border-slate-200 dark:border-c-border-subtle text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              {t('trialExpired.contactSales', 'Contact Sales')}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-navy-800/30 px-6 py-4 text-center border-t border-slate-200 dark:border-c-border-subtle">
          <button
            onClick={onDismiss}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            {t('trialExpired.dismiss', 'Dismiss for now')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialExpirationModal;
