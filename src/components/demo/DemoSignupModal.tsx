import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Loader2, Shield, Sparkles, X, Zap } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

interface DemoSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignupComplete: (email: string) => void;
}

type Step = 'form' | 'submitting' | 'success';

export const DemoSignupModal: React.FC<DemoSignupModalProps> = ({
  isOpen,
  onClose,
  onSignupComplete,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const resetForm = useCallback(() => {
    setStep('form');
    setName('');
    setEmail('');
    setPassword('');
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setStep('submitting');

      trackFunnelEvent('signup_started', { source: 'demo_conversion' });

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Registration failed');
        }

        trackFunnelEvent('signup_completed', { source: 'demo_conversion', email });
        setStep('success');

        setTimeout(() => {
          onSignupComplete(email);
        }, 2000);
      } catch (err: any) {
        setStep('form');
        setError(err.message || 'Something went wrong');
      }
    },
    [name, email, password, onSignupComplete]
  );

  const TRIAL_BENEFITS = [
    { icon: Zap, labelKey: 'demo.signup.benefit1', fallback: '7-day full access' },
    { icon: Shield, labelKey: 'demo.signup.benefit2', fallback: 'Your own secure workspace' },
    { icon: Sparkles, labelKey: 'demo.signup.benefit3', fallback: 'AI capabilities included' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-toast bg-navy-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gradient-to-r from-primary-500 to-crimson-500" />

            <div className="p-6 relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-slate-600 hover:text-slate-600 dark:hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>

              {step === 'form' && (
                <>
                  <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-1">
                    {t('demo.signup.title', 'Start Your Free Trial')}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                    {t(
                      'demo.signup.subtitle',
                      'Continue where you left off with your own workspace.'
                    )}
                  </p>

                  <div className="flex gap-3 mb-5">
                    {TRIAL_BENEFITS.map(({ icon: BenefitIcon, labelKey, fallback }) => (
                      <div
                        key={labelKey}
                        className="flex-1 flex flex-col items-center text-center p-2 rounded-lg bg-slate-50 dark:bg-navy-800"
                      >
                        <BenefitIcon
                          size={16}
                          className="text-primary-500 dark:text-primary-400 mb-1"
                        />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                          {t(labelKey, fallback)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('demo.signup.nameLabel', 'Full Name')}
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white focus-visible:ring-2 focus-visible:ring-c-focus focus:border-transparent outline-none"
                        placeholder="Jane Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('demo.signup.emailLabel', 'Work Email')}
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white focus-visible:ring-2 focus-visible:ring-c-focus focus:border-transparent outline-none"
                        placeholder="jane@company.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('demo.signup.passwordLabel', 'Password')}
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white focus-visible:ring-2 focus-visible:ring-c-focus focus:border-transparent outline-none"
                        placeholder="Min. 6 characters"
                      />
                    </div>

                    {error && (
                      <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-crimson-600 text-white font-semibold rounded-lg hover:from-primary-500 hover:to-crimson-500 transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 text-sm"
                    >
                      {t('demo.signup.submit', 'Create Account & Start Trial')}
                      <ArrowRight size={16} />
                    </button>
                  </form>
                </>
              )}

              {step === 'submitting' && (
                <div className="py-12 flex flex-col items-center">
                  <Loader2 size={40} className="text-primary-500 animate-spin mb-4" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('demo.signup.creating', 'Creating your workspace...')}
                  </p>
                </div>
              )}

              {step === 'success' && (
                <div className="py-12 flex flex-col items-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle size={48} className="text-emerald-500 mb-4" />
                  </motion.div>
                  <h4 className="text-lg font-bold text-navy-900 dark:text-white mb-1">
                    {t('demo.signup.successTitle', 'Welcome aboard!')}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('demo.signup.successMessage', 'Redirecting to your new workspace...')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DemoSignupModal;
