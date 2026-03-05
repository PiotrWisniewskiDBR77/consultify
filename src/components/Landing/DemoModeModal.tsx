import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Loader2, LogIn, Shield, Sparkles, UserPlus, Users, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'demo') {
        if (tab === 'signup') {
          const { user } = await Api.registerDemo({
            email: form.email,
            password: form.password,
            firstName: form.firstName || undefined,
          });
          onSuccess({ ...user, hasWorkspace: true }, 'demo');
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
      setError(err?.message || (mode === 'demo' ? 'Failed to start demo' : 'Failed to start trial'));
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
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-navy-950/90 backdrop-blur-md" />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-md bg-navy-900 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4">
              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="w-12 h-12 rounded-xl bg-primary-500/15 flex items-center justify-center mb-4">
                <Sparkles size={22} className="text-primary-400" />
              </div>

              <h2 className="text-xl font-semibold text-slate-100 mb-1">
                {mode === 'demo'
                  ? t('demo.modal.title', 'Experience Consultify Demo')
                  : t('trial.modal.title', 'Start Your 7-Day Trial')}
              </h2>
              <p className="text-slate-500 text-sm">
                {mode === 'demo'
                  ? t('demo.modal.subtitle', 'Explore Atelier ToolToys sample data')
                  : t('trial.modal.subtitle', 'Your own workspace, 7 days free')}
              </p>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-navy-800/60 mb-5">
                <button
                  type="button"
                  onClick={() => { setTab('signup'); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    tab === 'signup'
                      ? 'bg-white/10 text-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <UserPlus size={15} />
                  {t('demo.modal.signUp', 'Sign up')}
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    tab === 'login'
                      ? 'bg-white/10 text-slate-100 shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <LogIn size={15} />
                  {t('demo.modal.logIn', 'Log in')}
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 mb-5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    {t('auth.email', 'Email')}
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-navy-800/80 border border-white/5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-colors"
                    placeholder="you@company.com"
                  />
                </div>
                {tab === 'signup' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                        {t('auth.firstName', 'First name')}
                        {mode === 'demo' && <span className="normal-case text-slate-600"> ({t('common.optional', 'optional')})</span>}
                      </label>
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-navy-800/80 border border-white/5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-colors"
                        placeholder="Jan"
                        required={mode === 'trial'}
                      />
                    </div>
                    {mode === 'trial' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                            {t('auth.lastName', 'Last name')}
                          </label>
                          <input
                            type="text"
                            value={form.lastName}
                            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl bg-navy-800/80 border border-white/5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-colors"
                            placeholder="Kowalski"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                            {t('auth.companyName', 'Company name')}
                          </label>
                          <input
                            type="text"
                            value={form.companyName}
                            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                            className="w-full px-4 py-3 rounded-xl bg-navy-800/80 border border-white/5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-colors"
                            placeholder="My Company"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    {t('auth.password', 'Password')}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-navy-800/80 border border-white/5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-colors"
                    placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••'}
                  />
                </div>
                {error && (
                  <p className="text-sm text-danger-400 py-2">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {t('demo.modal.loading', 'Starting...')}
                    </>
                  ) : (
                    <>
                      {mode === 'demo'
                        ? (tab === 'signup'
                          ? t('demo.modal.startDemo', 'Sign up & Enter Demo')
                          : t('demo.modal.logInAndDemo', 'Log in & Enter Demo'))
                        : (tab === 'signup'
                          ? t('trial.modal.startTrial', 'Sign up & Start Trial')
                          : t('trial.modal.logInAndTrial', 'Log in & Continue'))}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              {/* Info section — minimal, depth through background */}
              <div className="rounded-xl bg-navy-800/40 p-5 mb-5">
                {mode === 'demo' ? (
                  <div className="flex gap-4">
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Users size={18} className="text-slate-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-200 mb-0.5">
                        {t('demo.modal.demoMode', 'Demo Environment')}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {t(
                          'demo.modal.demoDescriptionSigned',
                          "Sign up or log in to explore Atelier ToolToys sample data. We'll follow up with you."
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Shield size={18} className="text-slate-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-200 mb-0.5">
                        {t('trial.modal.ownWorkspace', 'Your Own Workspace')}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {t(
                          'trial.modal.ownWorkspaceDesc',
                          '7 days with your own organization, projects, and data. Full access to all features.'
                        )}
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-4 pt-4 flex items-start gap-2">
                  <Shield size={14} className="flex-shrink-0 mt-0.5" />
                  {t('demo.modal.commercialDescription', 'For production use with your own data and team, contact our sales team.')}
                </p>
              </div>

              {/* Contact Sales — secondary, monochrome */}
              <a
                href="https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2.5 px-4 text-slate-400 hover:text-slate-200 text-sm font-medium rounded-lg hover:bg-white/5 transition-colors text-center"
              >
                {t('demo.modal.contactSales', 'Contact Sales')}
              </a>

              {/* Footer Note */}
              <p className="text-xs text-center text-slate-600 mt-4">
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
