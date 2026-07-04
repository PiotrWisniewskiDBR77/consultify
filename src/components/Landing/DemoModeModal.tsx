import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Loader2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '../../services/api';

interface DemoModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, mode: 'demo' | 'trial') => void | Promise<void>;
  mode: 'demo' | 'trial';
}

export const DemoModeModal: React.FC<DemoModeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'signup' | 'login'>('signup');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    companyName: '',
  });

  const openAnna = () => {
    window.dispatchEvent(new CustomEvent('anna:open', { detail: { source: 'demo_modal' } }));
    onClose();
  };

  const openContactForm = () => {
    navigate('/contact?topic=demo');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'demo') {
        if (tab === 'signup') {
          try {
            const { user } = await Api.registerDemo({
              email: form.email,
              password: form.password,
              firstName: form.firstName || undefined,
              acceptedLegalDocs: ['TOS', 'PRIVACY'],
              legalConsentAt: new Date().toISOString(),
            });
            onSuccess({ ...user, hasWorkspace: true }, 'demo');
          } catch (signupErr: any) {
            const message = String(signupErr?.message || '');
            const emailAlreadyExists =
              signupErr?.code === 'EMAIL_IN_USE' ||
              message.toLowerCase().includes('already in use');

            if (!emailAlreadyExists) {
              throw signupErr;
            }

            const user = await Api.login(form.email, form.password);
            await Api.enterDemo();
            onSuccess({ ...user, hasWorkspace: true, isDemo: true }, 'demo');
          }
        } else {
          const user = await Api.login(form.email, form.password);
          await Api.enterDemo();
          onSuccess({ ...user, hasWorkspace: true, isDemo: true }, 'demo');
        }
      } else {
        if (tab === 'signup') {
          const user = await Api.register({
            email: form.email,
            password: form.password,
            firstName: form.firstName?.trim() || 'User',
            lastName: form.lastName?.trim() || 'Trial',
            companyName: form.companyName?.trim() || 'My Company',
            utm_medium: 'trial_modal',
          });
          onSuccess({ ...user, hasWorkspace: true }, 'trial');
        } else {
          const user = await Api.login(form.email, form.password);
          onSuccess({ ...user, hasWorkspace: true }, 'trial');
        }
      }
    } catch (err: any) {
      setError(
        err?.message || (mode === 'demo' ? 'Failed to start demo' : 'Failed to start trial')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-toast flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-c-bg/90 backdrop-blur-md" />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-sm bg-c-surface rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-5 pt-5 pb-3">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 rounded-lg text-c-text-muted hover:text-c-text hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>

              <h2 className="text-lg font-semibold text-c-text mb-0.5">
                {mode === 'demo'
                  ? t('demo.modal.title', 'Experience Consultify Demo')
                  : t('trial.modal.title', 'Start Your 7-Day Trial')}
              </h2>
              <p className="text-c-text-muted text-xs">
                {mode === 'demo'
                  ? t('demo.modal.subtitle', 'Explore the Atelier Toys guided workspace')
                  : t('trial.modal.subtitle', 'Your own workspace, 7 days free')}
              </p>
            </div>

            {/* Content */}
            <div className="px-5 pb-5">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-lg bg-c-surface-raised mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setTab('signup');
                    setError(null);
                  }}
                  className={`flex-1 flex items-center justify-center py-2 rounded-md text-xs font-medium transition-all duration-200 ${
                    tab === 'signup'
                      ? 'bg-white/10 text-c-text shadow-sm'
                      : 'text-c-text-muted hover:text-c-text-secondary'
                  }`}
                >
                  {t('demo.modal.signUp', 'Sign up')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError(null);
                  }}
                  className={`flex-1 flex items-center justify-center py-2 rounded-md text-xs font-medium transition-all duration-200 ${
                    tab === 'login'
                      ? 'bg-white/10 text-c-text shadow-sm'
                      : 'text-c-text-muted hover:text-c-text-secondary'
                  }`}
                >
                  {t('demo.modal.logIn', 'Log in')}
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-c-text-muted uppercase tracking-wider mb-1">
                    {t('auth.email', 'Email')}
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-c-surface-raised border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:border-c-accent focus:ring-1 focus:ring-c-accent/30 transition-colors"
                    placeholder="you@company.com"
                  />
                </div>
                {tab === 'signup' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-c-text-muted uppercase tracking-wider mb-1">
                        {t('auth.firstName', 'First name')}
                        {mode === 'demo' && (
                          <span className="normal-case text-c-text-muted">
                            {' '}
                            ({t('common.optional', 'optional')})
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-c-surface-raised border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:border-c-accent focus:ring-1 focus:ring-c-accent/30 transition-colors"
                        placeholder="Jan"
                        required={mode === 'trial'}
                      />
                    </div>
                    {mode === 'trial' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-c-text-muted uppercase tracking-wider mb-1">
                            {t('auth.lastName', 'Last name')}
                          </label>
                          <input
                            type="text"
                            value={form.lastName}
                            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-c-surface-raised border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:border-c-accent focus:ring-1 focus:ring-c-accent/30 transition-colors"
                            placeholder="Kowalski"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-c-text-muted uppercase tracking-wider mb-1">
                            {t('auth.companyName', 'Company name')}
                          </label>
                          <input
                            type="text"
                            value={form.companyName}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, companyName: e.target.value }))
                            }
                            className="w-full px-3 py-2 text-sm rounded-lg bg-c-surface-raised border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:border-c-accent focus:ring-1 focus:ring-c-accent/30 transition-colors"
                            placeholder="My Company"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-c-text-muted uppercase tracking-wider mb-1">
                    {t('auth.password', 'Password')}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={tab === 'signup' ? 8 : undefined}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-c-surface-raised border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:border-c-accent focus:ring-1 focus:ring-c-accent/30 transition-colors"
                    placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••'}
                  />
                </div>
                {error && <p className="text-xs text-c-danger py-1">{error}</p>}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 text-sm bg-c-surface-raised border-2 border-c-accent text-c-accent hover:bg-c-accent-soft font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('demo.modal.loading', 'Starting...')}
                    </>
                  ) : (
                    <>
                      {mode === 'demo'
                        ? tab === 'signup'
                          ? t('demo.modal.startDemo', 'Sign up & Enter Demo')
                          : t('demo.modal.logInAndDemo', 'Log in & Enter Demo')
                        : tab === 'signup'
                          ? t('trial.modal.startTrial', 'Sign up & Start Trial')
                          : t('trial.modal.logInAndTrial', 'Log in & Continue')}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {/* Info section — minimal, no icons */}
              <div className="rounded-lg bg-c-surface-raised p-4 mb-4">
                {mode === 'demo' ? (
                  <div>
                    <h3 className="text-sm font-medium text-c-text mb-0.5">
                      {t('demo.modal.demoMode', 'Demo Environment')}
                    </h3>
                    <p className="text-xs text-c-text-muted leading-relaxed">
                      {t(
                        'demo.modal.demoDescriptionSigned',
                        'Create an account or log in to enter the Atelier Toys demo automatically.'
                      )}
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-medium text-c-text mb-0.5">
                      {t('trial.modal.ownWorkspace', 'Your Own Workspace')}
                    </h3>
                    <p className="text-xs text-c-text-muted leading-relaxed">
                      {t(
                        'trial.modal.ownWorkspaceDesc',
                        '7 days with your own organization, projects, and data. Full access to all features.'
                      )}
                    </p>
                  </div>
                )}
                <p className="text-xs text-c-text-muted mt-3 pt-3 border-t border-c-border-subtle">
                  {t(
                    'demo.modal.commercialDescription',
                    'This demo is based on the Atelier Toys story. If you have questions, talk to Anna or contact us directly.'
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={openAnna}
                  className="block w-full py-2.5 px-4 text-sm bg-c-accent hover:bg-c-accent text-white font-medium rounded-lg transition-colors text-center"
                >
                  {t('demo.modal.askAnna', 'Talk to Anna')}
                </button>

                <button
                  type="button"
                  onClick={openContactForm}
                  className="block w-full py-2.5 px-4 text-sm bg-c-surface-raised border border-c-border-subtle hover:bg-c-surface-raised text-c-text font-medium rounded-lg transition-colors text-center"
                >
                  {t('demo.modal.contactUs', 'Contact Us')}
                </button>

                <a
                  href="https://ateliertoys.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2.5 px-4 text-sm bg-transparent border border-c-accent hover:bg-c-accent-soft text-c-accent font-medium rounded-lg transition-colors text-center"
                >
                  {t('demo.modal.atelierLink', 'See the Atelier Toys brand this demo is based on')}
                </a>
              </div>

              {/* Footer Note */}
              <p className="text-[11px] text-center text-c-text-muted mt-3 leading-relaxed">
                {t(
                  'demo.modal.footerNote',
                  'By entering the demo, you agree to our Terms of Service and Privacy Policy.'
                )}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
