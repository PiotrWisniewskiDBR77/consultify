import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Calendar, Check, MessageSquare, Sparkles, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * ExitIntentModal — Premium conversion prompt when user is leaving
 *
 * Shows a professional, non-aggressive offer when exit intent is detected
 * Follows BCG/McKinsey style - elegant and value-focused
 */

interface ExitIntentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExitIntentModal: React.FC<ExitIntentModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  const handleScheduleDemo = () => {
    window.open(
      'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017',
      '_blank'
    );
    onClose();
  };

  const handleContactUs = () => {
    window.location.href = '/contact';
    onClose();
  };

  const benefits = [
    t('demo.exit.benefit1', 'Your own dedicated environment'),
    t('demo.exit.benefit2', 'Unlimited AI consultations'),
    t('demo.exit.benefit3', 'Real-time team collaboration'),
    t('demo.exit.benefit4', 'Enterprise-grade security'),
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-context-menu bg-navy-950/95 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
          </div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative w-full max-w-lg bg-white/5 backdrop-blur-xl border border-c-border-subtle rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800/40 z-10"
            >
              <X size={20} />
            </button>

            {/* Content */}
            <div className="p-8 md:p-10">
              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-crimson-600 rounded-xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-primary-500/30">
                <Sparkles size={32} className="text-white" />
              </div>

              {/* Title */}
              <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-3">
                {t('demo.exit.title', 'Before You Go...')}
              </h2>

              <p className="text-white/70 text-center mb-8 max-w-md mx-auto">
                {t(
                  'demo.exit.subtitle',
                  "You've seen what AI-powered consulting can do. Ready to transform your organization?"
                )}
              </p>

              {/* Benefits List */}
              <div className="bg-white/5 rounded-xl p-4 mb-8">
                <h4 className="text-sm font-semibold text-white/80 mb-3 uppercase tracking-wider">
                  {t('demo.exit.whatYouGet', 'What You Get')}
                </h4>
                <ul className="space-y-2">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3 text-white/90">
                      <Check size={16} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleScheduleDemo}
                  className="w-full py-4 px-6 bg-gradient-to-r from-primary-600 to-crimson-600 hover:from-primary-500 hover:to-crimson-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 group"
                >
                  <Calendar size={18} />
                  {t('demo.exit.scheduleDemo', 'Schedule a Personal Demo')}
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>

                <button
                  onClick={handleContactUs}
                  className="w-full py-3 px-6 bg-slate-50/50 dark:bg-navy-950/30 hover:bg-white/20 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare size={16} />
                  {t('demo.exit.contactUs', 'Have Questions? Contact Us')}
                </button>
              </div>

              {/* Footer note */}
              <p className="text-xs text-white/40 text-center mt-6">
                {t('demo.exit.noCommitment', 'No commitment required. Just a conversation.')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExitIntentModal;
