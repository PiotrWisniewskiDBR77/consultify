import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * DemoUpgradePrompt — Subtle upgrade nudge for demo users
 *
 * Appears contextually when demo users explore premium features
 * Designed to be non-intrusive and professional (BCG/McKinsey style)
 */

interface DemoUpgradePromptProps {
  isVisible: boolean;
  onClose: () => void;
  feature?: string;
  variant?: 'inline' | 'modal' | 'toast';
}

export const DemoUpgradePrompt: React.FC<DemoUpgradePromptProps> = ({
  isVisible,
  onClose,
  feature = 'full access',
  variant = 'toast',
}) => {
  const { t } = useTranslation();

  const handleContactSales = () => {
    window.open(
      'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017',
      '_blank'
    );
  };

  // Toast variant - subtle bottom-right notification
  if (variant === 'toast') {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 right-6 z-overlay max-w-sm"
          >
            <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
              {/* Gradient accent */}
              <div className="h-1 bg-gradient-to-r from-primary-500 to-crimson-500" />

              <div className="p-4">
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles size={18} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-navy-900 dark:text-white text-sm">
                      {t('demo.upgrade.title', 'Unlock Full Potential')}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t(
                        'demo.upgrade.description',
                        'Get dedicated environment with your company data and full AI capabilities.'
                      )}
                    </p>
                    <button
                      onClick={handleContactSales}
                      className="mt-3 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 transition-colors"
                    >
                      {t('demo.upgrade.cta', 'Schedule a Demo')}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Inline variant - subtle banner within content
  if (variant === 'inline') {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="bg-gradient-to-r from-primary-50 to-crimson-50 dark:from-primary-900/20 dark:to-crimson-900/20 rounded-lg p-3 border border-primary-200 dark:border-primary-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary-500" />
                  <span className="text-sm text-primary-800 dark:text-primary-200">
                    {t('demo.upgrade.featureHint', 'This feature works best with your own data')}
                  </span>
                </div>
                <button
                  onClick={handleContactSales}
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1"
                >
                  {t('demo.upgrade.learnMore', 'Learn more')}
                  <ArrowRight size={10} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Modal variant - full-screen overlay for major upgrade prompts
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-toast bg-navy-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl max-w-md w-full p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary-500 to-crimson-600 rounded-xl flex items-center justify-center mb-6">
              <Sparkles size={32} className="text-white" />
            </div>

            <h3 className="text-2xl font-bold text-navy-900 dark:text-white mb-3">
              {t('demo.upgrade.modalTitle', 'Ready for the Full Experience?')}
            </h3>

            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {t(
                'demo.upgrade.modalDescription',
                "You've explored {feature}. Get a dedicated environment with your real company data and unlimited AI capabilities.",
                { feature }
              )}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleContactSales}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-primary-600 to-crimson-600 text-white font-semibold rounded-xl hover:from-primary-500 hover:to-crimson-500 transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2"
              >
                {t('demo.upgrade.contactSales', 'Talk to Sales')}
                <ArrowRight size={18} />
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-6 bg-slate-100 dark:bg-navy-800 text-navy-900 dark:text-white font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-navy-700 transition-all"
              >
                {t('demo.upgrade.continueBrowsing', 'Continue Exploring')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DemoUpgradePrompt;
