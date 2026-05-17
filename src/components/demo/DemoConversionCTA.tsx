import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BarChart3, FileText, Lightbulb, Rocket, X, Zap } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

export type ValueMomentType =
  | 'report_generated'
  | 'initiative_created'
  | 'tool_session_completed'
  | 'execution_signal_viewed'
  | 'deck_exported';

const VALUE_MOMENT_CONFIG: Record<
  ValueMomentType,
  { icon: React.ElementType; colorClass: string }
> = {
  report_generated: { icon: FileText, colorClass: 'from-emerald-500 to-blue-500' },
  initiative_created: { icon: Rocket, colorClass: 'from-primary-500 to-indigo-500' },
  tool_session_completed: { icon: Lightbulb, colorClass: 'from-amber-500 to-amber-500' },
  execution_signal_viewed: { icon: Zap, colorClass: 'from-blue-500 to-blue-500' },
  deck_exported: { icon: BarChart3, colorClass: 'from-rose-500 to-pink-500' },
};

interface DemoConversionCTAProps {
  isVisible: boolean;
  valueMoment: ValueMomentType;
  onStartTrial: () => void;
  onDismiss: () => void;
}

export const DemoConversionCTA: React.FC<DemoConversionCTAProps> = ({
  isVisible,
  valueMoment,
  onStartTrial,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const config = VALUE_MOMENT_CONFIG[valueMoment];
  const Icon = config.icon;

  const handleStartTrial = () => {
    trackFunnelEvent('demo_cta_clicked', { location: 'value_moment_cta', moment: valueMoment });
    onStartTrial();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
        >
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <div className={`h-1 bg-gradient-to-r ${config.colorClass}`} />

            <div className="p-4">
              <button
                onClick={onDismiss}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>

              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 bg-gradient-to-br ${config.colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}
                >
                  <Icon size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-navy-900 dark:text-white text-sm">
                    {t(`demo.conversion.${valueMoment}.title`, 'Great progress!')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t(
                      `demo.conversion.${valueMoment}.description`,
                      'Start a free trial to use this with your own data.'
                    )}
                  </p>
                  <button
                    onClick={handleStartTrial}
                    className="mt-3 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 transition-colors"
                  >
                    {t('demo.conversion.startTrial', 'Start Free Trial')}
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
};

export default DemoConversionCTA;
