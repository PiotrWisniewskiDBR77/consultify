import { AlertCircle, ArrowRight, ChevronLeft, Lock, Sparkles, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api, API_URL } from '@/services/api';

import { AuthStep, SessionMode, UserRole } from '../types';

// Helper to check if email is allowed for full access
// NOTE: Domain restriction removed on 2026-01-07 to allow all users to login
const isDBR77Domain = (_email: string): boolean => {
  return true; // All domains now allowed
};

// Google Icon Component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// LinkedIn Icon Component
const LinkedInIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

interface AuthViewProps {
  initialStep: AuthStep;
  targetMode: SessionMode;
  onAuthSuccess: (user: { status?: string; message?: string }) => void;
  onBack: () => void;
}

export function isQuickAccessEnabledHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('stage.');
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialStep,
  targetMode,
  onAuthSuccess,
  onBack,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showDemoRedirect, setShowDemoRedirect] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [fromDemoRedirect, setFromDemoRedirect] = useState(false);
  const quickAccessEnabled = isQuickAccessEnabledHost(window.location.hostname);

  // --- QUICK ACCESS BACKDOOR (Dev only) ---
  const [showQuickAccess, setShowQuickAccess] = useState(false);
  const [quickCode, setQuickCode] = useState('');
  const quickAccessRef = useRef<HTMLInputElement>(null);

  // Quick access login handler (dev/staging: 4-digit codes 7777/7776/7778)
  const handleQuickAccess = async (code: string) => {
    if (!quickAccessEnabled) return;
    const quickAccessCodes: Record<string, { email: string; password: string } | { demo: true }> = {
      '7777': { email: 'piotr.wisniewski@dbr77.com', password: '123456' }, // Admin
      '7775': { email: 'pawel.mroczkowski@dbr77.com', password: '123456' }, // Paweł (DBR77)
      '1212': { email: 'pawel.mroczkowski@plastmetcentrum.pl', password: '123456' }, // Paweł (Plast-Met)
      '7776': { email: 'admin@dbr77.com', password: '123456' }, // SuperAdmin
      // Demo uses a dedicated endpoint (doesn't rely on seeded user credentials).
      '7778': { demo: true },
    };

    const credentials = quickAccessCodes[code];
    if (credentials) {
      setIsDemoLoading(true);
      try {
        let user;
        if ('email' in credentials) {
          user = await Api.login(credentials.email, credentials.password);
        } else {
          user = await Api.demoLogin();
        }
        onAuthSuccess(user);
      } catch (err: any) {
        setError('Quick access failed: ' + err.message);
      } finally {
        setIsDemoLoading(false);
      }
    }
  };

  // Focus quick access input when shown
  React.useEffect(() => {
    if (quickAccessEnabled && showQuickAccess && quickAccessRef.current) {
      quickAccessRef.current.focus();
    }
  }, [quickAccessEnabled, showQuickAccess]);

  // When targetMode === DEMO: show signup/login form (no anonymous demo)
  // User must sign up or log in to try demo — we track duration and contact for follow-up

  // OAuth Login Handlers
  const handleGoogleLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${API_URL}/auth/google`;
  };

  const handleLinkedInLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${API_URL}/auth/linkedin`;
  };

  // --- CODE ENTRY STATE ---
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    password: '',
    accessCode: sessionStorage.getItem('attribution_invite') || '',
  });

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = () => {
    const fullCode = code.join('');
    if (fullCode === '123456') {
      setStep(AuthStep.REGISTER);
      setError(null);
    } else {
      setError('Invalid code');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Demo mode or from demo redirect: use register-demo (minimal signup, demo org, track contact)
    if (targetMode === SessionMode.DEMO || fromDemoRedirect) {
      setIsDemoLoading(true);
      try {
        const { user } = await Api.registerDemo({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName || undefined,
        });
        onAuthSuccess({ ...user, hasWorkspace: true } as any);
      } catch (err: any) {
        setError(err?.message || 'Demo signup failed');
      } finally {
        setIsDemoLoading(false);
      }
      return;
    }

    // Check if email is from DBR77 domain
    if (!isDBR77Domain(formData.email)) {
      // Non-DBR77 users should use demo mode
      setShowDemoRedirect(true);
      return;
    }

    try {
      // The backend returns { status: 'pending', message: ... } if pending
      const user: { status?: string; message?: string } = await Api.register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        companyName: formData.companyName,
        phone: formData.phone,
        password: formData.password,
        accessCode: formData.accessCode,
        role: UserRole.CEO,
        accessLevel: targetMode === SessionMode.FULL ? 'full' : 'free',
        partner_code: sessionStorage.getItem('attribution_ref') || undefined,
        utm_medium: 'web_app_flow',
      });

      // Check if the user status or a specific message implies pending
      if (user.status === 'pending') {
        setIsPending(true);
        return;
      }

      onAuthSuccess(user);
    } catch (err: any) {
      if (err.status === 'pending') {
        setIsPending(true);
        return;
      }
      setError(err.message || 'Registration failed');
    }
  };

  const startDemoFlow = () => {
    setFromDemoRedirect(true);
    setError(null);
    if (step === AuthStep.REGISTER) {
      // Already on register — will use registerDemo on submit
      return;
    }
    setStep(AuthStep.REGISTER);
  };

  // Handle demo redirect for non-DBR77 users
  const handleDemoRedirectToForm = () => {
    setFromDemoRedirect(true);
    setShowDemoRedirect(false);
    setStep(AuthStep.REGISTER);
    setError(null);
  };

  const handleDemoRedirectToLogin = () => {
    setFromDemoRedirect(true);
    setShowDemoRedirect(false);
    setStep(AuthStep.LOGIN);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return;
    }

    // Demo mode or from demo redirect: login then enter demo
    if (targetMode === SessionMode.DEMO || fromDemoRedirect) {
      setIsDemoLoading(true);
      try {
        const user = await Api.login(formData.email, formData.password);
        await Api.enterDemo();
        onAuthSuccess({ ...user, hasWorkspace: true, isDemo: true } as any);
      } catch (err: any) {
        setError(err?.message || 'Login failed');
      } finally {
        setIsDemoLoading(false);
      }
      return;
    }

    // Check if email is from DBR77 domain
    if (!isDBR77Domain(formData.email)) {
      // Non-DBR77 users should use demo mode
      setShowDemoRedirect(true);
      return;
    }

    // Retry logic for network errors
    let retries = 3;
    let lastError: any = null;

    while (retries > 0) {
      try {
        console.log('Calling Api.login... (attempts remaining:', retries, ')');
        const user = await Api.login(formData.email, formData.password);

        // Verify token was stored
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Login succeeded but token was not stored');
        }

        console.log('Login successful, token stored:', !!token);
        onAuthSuccess(user);
        return; // Success - exit function
      } catch (err: any) {
        lastError = err;
        console.error('Login error:', err);

        // Don't retry on authentication errors (wrong password, etc.)
        if (
          err.message &&
          (err.message.includes('Invalid email or password') ||
            err.message.includes('Invalid login response') ||
            err.message.includes('approval') ||
            err.message.toLowerCase().includes('pending'))
        ) {
          // Check for pending status
          if (
            err.message &&
            (err.message.includes('approval') || err.message.toLowerCase().includes('pending'))
          ) {
            setIsPending(true);
            return;
          }
          setError(err.message || 'Login failed');
          return; // Don't retry auth errors
        }

        // Retry on network errors
        retries--;
        if (retries > 0) {
          console.log('Retrying login in 1 second...');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // All retries failed
    if (lastError) {
      setError(lastError.message || 'Login failed. Please check your connection and try again.');
    } else {
      setError('Login failed. Please try again.');
    }
  };

  const renderPending = () => (
    <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-200 dark:border-yellow-500/20 shadow-[0_0_15px_-3px_rgba(234,179,8,0.3)]">
        <Lock className="text-yellow-600 dark:text-yellow-400" size={32} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">Access Pending</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
          Your organization is currently waiting for manual approval. You will receive an email once
          your access is granted.
        </p>
      </div>
      <button
        onClick={() => {
          setIsPending(false);
          setStep(AuthStep.LOGIN);
        }}
        className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium hover:underline text-sm transition-colors"
      >
        Back to Login
      </button>
    </div>
  );

  // Demo redirect for non-DBR77 users
  const renderDemoRedirect = () => (
    <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-200 dark:border-purple-500/20 shadow-[0_0_15px_-3px_rgba(147,51,234,0.3)]">
        <Sparkles className="text-purple-600 dark:text-purple-400" size={32} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {t('auth.demoMode', 'Demo Mode')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
          {t(
            'auth.demoModeDescriptionSigned',
            'Sign up or log in to try the demo. We will follow up with you.'
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleDemoRedirectToForm}
          className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
        >
          {t('auth.signUpForDemo', 'Sign up for Demo')}
          <ArrowRight size={16} />
        </button>
        <button
          onClick={handleDemoRedirectToLogin}
          className="w-full py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-navy-900 dark:text-white font-semibold rounded-lg hover:border-purple-300 dark:hover:border-purple-500/30 transition-all"
        >
          {t('auth.logInForDemo', 'Log in for Demo')}
        </button>
        <a
          href="https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-all text-center text-sm"
        >
          {t('auth.contactSales', 'Contact Sales for Full Access')}
        </a>
      </div>

      <button
        onClick={() => {
          setShowDemoRedirect(false);
          setFromDemoRedirect(false);
          setError(null);
        }}
        className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium hover:underline text-sm transition-colors"
      >
        {t('auth.back', 'Back')}
      </button>
    </div>
  );

  const renderCodeEntry = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-200 dark:border-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]">
          <Lock className="text-blue-600 dark:text-blue-400" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {t('auth.unlockFull')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
          {t('auth.enterCode')}
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-8" dir="ltr">
        {code.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              codeRefs.current[idx] = el;
            }}
            type="text"
            maxLength={1}
            value={digit}
            onChange={(e) => handleCodeChange(idx, e.target.value)}
            onKeyDown={(e) => handleCodeKeyDown(idx, e)}
            className="w-12 h-16 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-center text-2xl font-bold text-navy-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:bg-slate-50 dark:focus:bg-navy-900 outline-none transition-all shadow-sm dark:shadow-inner"
          />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm justify-center bg-red-50 dark:bg-red-500/10 p-3 rounded border border-red-200 dark:border-red-500/20">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <button
        onClick={verifyCode}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20 text-sm"
      >
        {t('auth.verifyCode')}
      </button>
    </div>
  );

  const renderRegister = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {targetMode === SessionMode.FREE ? t('auth.startQuick') : t('auth.setupFull')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('auth.personalize')}</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('auth.firstName')} <span className="text-purple-500 dark:text-purple-400">*</span>
            </label>
            <input
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('auth.lastName')} <span className="text-purple-500 dark:text-purple-400">*</span>
            </label>
            <input
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('auth.email')} <span className="text-purple-500 dark:text-purple-400">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('auth.phone')}
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('auth.company')} <span className="text-purple-500 dark:text-purple-400">*</span>
          </label>
          <input
            required
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('auth.accessCode')}{' '}
            <span className="text-slate-400 dark:text-slate-500 font-normal">
              ({t('auth.optional')})
            </span>
          </label>
          <input
            value={formData.accessCode}
            onChange={(e) => setFormData({ ...formData, accessCode: e.target.value })}
            placeholder={t('auth.accessCodePlaceholder')}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('auth.password')} <span className="text-purple-500 dark:text-purple-400">*</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm justify-center bg-red-50 dark:bg-red-500/10 p-3 rounded border border-red-200 dark:border-red-500/20 mt-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-purple-500/20 dark:shadow-purple-900/20 group text-sm">
          {t('auth.createStart')}
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </form>

      {/* Social Login Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-navy-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-white dark:bg-navy-900 text-slate-500 dark:text-slate-400 text-xs">
            {t('auth.orRegisterWith')}
          </span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 transition-all text-xs font-medium text-navy-900 dark:text-white shadow-sm"
        >
          <GoogleIcon />
          Google
        </button>
        <button
          type="button"
          onClick={handleLinkedInLogin}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 transition-all text-xs font-medium text-navy-900 dark:text-white shadow-sm"
        >
          <LinkedInIcon />
          LinkedIn
        </button>
      </div>

      <div className="text-center pt-3 space-y-2">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {t('auth.haveAccount')}{' '}
          <button
            onClick={() => setStep(AuthStep.LOGIN)}
            className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium hover:underline"
          >
            {t('auth.logIn')}
          </button>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={startDemoFlow}
            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium hover:underline flex items-center justify-center gap-1 mx-auto transition-colors"
          >
            {t('auth.tryDemo')}
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {t('auth.welcomeBack')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('auth.signInText')}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('auth.email')}
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            data-testid="email-input"
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('auth.password')}
            </label>
            <button
              type="button"
              onClick={() => (window.location.href = '/forgot-password')}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
          <input
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            data-testid="password-input"
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-sm"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm justify-center bg-red-50 dark:bg-red-500/10 p-3 rounded border border-red-200 dark:border-red-500/20">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button
          type="submit"
          data-testid="login-button"
          className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/20 dark:shadow-purple-900/20 mt-2 text-sm"
        >
          {t('auth.logIn')}
        </button>
      </form>

      {/* Social Login Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-navy-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-white dark:bg-navy-900 text-slate-500 dark:text-slate-400 text-xs">
            {t('auth.orContinueWith')}
          </span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 transition-all text-sm font-medium text-navy-900 dark:text-white shadow-sm"
        >
          <GoogleIcon />
          Google
        </button>
        <button
          type="button"
          onClick={handleLinkedInLogin}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 transition-all text-sm font-medium text-navy-900 dark:text-white shadow-sm"
        >
          <LinkedInIcon />
          LinkedIn
        </button>
      </div>

      <div className="text-center pt-4 text-sm text-slate-500 dark:text-slate-400">
        {t('auth.noAccount')}{' '}
        <button
          onClick={() => setStep(AuthStep.REGISTER)}
          className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium hover:underline"
        >
          {t('auth.createOne')}
        </button>
      </div>

      {/* Privacy Policy Link */}
      <div className="text-center pt-3 border-t border-slate-200 dark:border-navy-700">
        <a
          href="/privacy"
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          {t('auth.privacyLink', 'Polityka prywatności')}
        </a>
        <span className="text-slate-300 dark:text-slate-600 mx-2">•</span>
        <a
          href="/terms"
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          {t('auth.termsLink', 'Regulamin')}
        </a>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-50 dark:bg-navy-950 p-6 relative overflow-hidden transition-colors duration-300">
      {/* Decorative BG */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-100/50 dark:from-purple-900/20 via-slate-50 dark:via-navy-950 to-slate-50 dark:to-navy-950 pointer-events-none transition-colors duration-300"></div>

      {/* Card Container */}
      <div className="relative w-full max-w-sm bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200 dark:border-navy-700 shadow-2xl rounded-xl p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-300 transition-colors">
        {/* Branding - Click logo 3x for quick access */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="cursor-pointer select-none"
            onClick={() => {
              if (quickAccessEnabled) {
                setShowQuickAccess(!showQuickAccess);
              }
            }}
            title={quickAccessEnabled ? 'DBR77' : undefined}
          >
            <img
              src="/assets/logos/logo-dark.svg?v=20260319"
              className="h-16 md:h-20 w-auto object-contain hidden dark:block drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
              alt="Consultify"
            />
            <img
              src="/assets/logos/logo-light.svg?v=20260319"
              className="h-16 md:h-20 w-auto object-contain block dark:hidden drop-shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
              alt="Consultify"
            />
          </div>

          {/* Quick Access Code Input (hidden by default) */}
          {quickAccessEnabled && showQuickAccess && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <input
                ref={quickAccessRef}
                type="password"
                maxLength={4}
                value={quickCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setQuickCode(val);
                  if (val.length === 4) {
                    handleQuickAccess(val);
                  }
                }}
                placeholder="••••"
                className="w-20 px-3 py-1.5 text-center text-lg tracking-widest font-mono bg-slate-100 dark:bg-navy-950 border border-slate-300 dark:border-white/20 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
              />
            </div>
          )}
        </div>

        {/* Close/Back Button */}
        <button
          onClick={onBack}
          className="absolute top-4 right-4 text-slate-400 hover:text-navy-900 dark:text-slate-500 dark:hover:text-white transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
        >
          <X size={20} />
        </button>

        {isDemoLoading && (
          <div className="text-center py-12 space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto shadow-lg shadow-purple-500/20"></div>
            <p className="text-slate-600 dark:text-slate-300 font-medium animate-pulse">
              {t('auth.loading', 'Initializing Demo Context...')}
            </p>
          </div>
        )}
        {!isDemoLoading &&
          !isPending &&
          !showDemoRedirect &&
          step === AuthStep.CODE_ENTRY &&
          renderCodeEntry()}
        {!isDemoLoading &&
          !isPending &&
          !showDemoRedirect &&
          step === AuthStep.REGISTER &&
          renderRegister()}
        {!isDemoLoading &&
          !isPending &&
          !showDemoRedirect &&
          step === AuthStep.LOGIN &&
          renderLogin()}
        {isPending && renderPending()}
        {showDemoRedirect && renderDemoRedirect()}
      </div>

      {/* Bottom Navigation Links */}
      <div className="mt-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        <a
          href="/"
          className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-500/30 text-sm transition-all group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          {t('auth.backToStart')}
        </a>
      </div>
    </div>
  );
};
