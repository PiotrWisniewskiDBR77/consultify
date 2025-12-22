
import React, { useState, useRef } from 'react';
import { ArrowRight, Lock, AlertCircle, X, ChevronLeft } from 'lucide-react';
import { AuthStep, SessionMode, UserRole } from '../types';
import { useTranslation } from 'react-i18next';
import { Api } from '../services/api';

// Google Icon Component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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

export const AuthView: React.FC<AuthViewProps> = ({ initialStep, targetMode, onAuthSuccess, onBack }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // OAuth Login Handlers
  const handleGoogleLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = '/api/auth/google';
  };

  const handleLinkedInLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = '/api/auth/linkedin';
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
    accessCode: sessionStorage.getItem('attribution_invite') || ''
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
        utm_medium: 'web_app_flow'
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

  const startDemo = async () => {
    try {
      const rand = Math.floor(Math.random() * 10000);
      const demoUser = {
        firstName: 'Demo',
        lastName: 'User',
        email: `demo${rand}@consultify.io`,
        password: 'demo123USER!',
        companyName: `Demo Corp ${rand}`,
        isDemo: true,
        role: UserRole.CEO,
        accessLevel: 'full'
      };
      const user: { status?: string; message?: string } = await Api.register(demoUser);
      onAuthSuccess(user);
    } catch (err: any) {
      setError('Failed to start demo: ' + err.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    console.log('handleLogin called with:', formData.email);
    try {
      console.log('Calling Api.login...');
      const user: { status?: string; message?: string } = await Api.login(formData.email, formData.password);
      console.log('Login successful:', user);
      onAuthSuccess(user);
    } catch (err: any) {
      console.error('Login error:', err);
      // Check for pending status in error or response
      if (err.message && (err.message.includes('approval') || err.message.toLowerCase().includes('pending'))) {
        setIsPending(true);
      } else {
        setError(err.message || 'Login failed');
      }
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
          Your organization is currently waiting for manual approval. You will receive an email once your access is granted.
        </p>
      </div>
      <button
        onClick={() => { setIsPending(false); setStep(AuthStep.LOGIN); }}
        className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium hover:underline text-sm transition-colors"
      >
        Back to Login
      </button>
    </div>
  );

  const renderCodeEntry = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-200 dark:border-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]">
          <Lock className="text-blue-600 dark:text-blue-400" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">{t('unlockFull')}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">{t('enterCode')}</p>
      </div>

      <div className="flex justify-center gap-3 mb-8" dir="ltr">
        {code.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => { codeRefs.current[idx] = el; }}
            type="text"
            maxLength={1}
            value={digit}
            onChange={(e) => handleCodeChange(idx, e.target.value)}
            onKeyDown={(e) => handleCodeKeyDown(idx, e)}
            className="w-12 h-16 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-center text-2xl font-bold text-navy-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:bg-slate-50 dark:focus:bg-navy-900 outline-none transition-all shadow-sm dark:shadow-inner"
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
        {t('verifyCode')}
      </button>
    </div>
  );

  const renderRegister = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {targetMode === SessionMode.FREE ? t('startQuick') : t('setupFull')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {t('personalize')}
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('firstName')} <span className="text-purple-500 dark:text-purple-400">*</span></label>
            <input
              required
              value={formData.firstName}
              onChange={e => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('lastName')} <span className="text-purple-500 dark:text-purple-400">*</span></label>
            <input
              required
              value={formData.lastName}
              onChange={e => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('email')} <span className="text-purple-500 dark:text-purple-400">*</span></label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('phone')}</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('company')} <span className="text-purple-500 dark:text-purple-400">*</span></label>
          <input
            required
            value={formData.companyName}
            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Access Code <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input
            value={formData.accessCode}
            onChange={e => setFormData({ ...formData, accessCode: e.target.value })}
            placeholder="Enter invitation code"
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('password')} <span className="text-purple-500 dark:text-purple-400">*</span></label>
          <input
            type="password"
            required
            minLength={8}
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm justify-center bg-red-50 dark:bg-red-500/10 p-3 rounded border border-red-200 dark:border-red-500/20 mt-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-purple-500/20 dark:shadow-purple-900/20 group text-sm">
          {t('createStart')}
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </form>

      {/* Social Login Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-white dark:bg-navy-900 text-slate-500 dark:text-slate-400 text-xs">
            lub zarejestruj przez
          </span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 transition-all text-xs font-medium text-navy-900 dark:text-white shadow-sm"
        >
          <GoogleIcon />
          Google
        </button>
        <button
          type="button"
          onClick={handleLinkedInLogin}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 transition-all text-xs font-medium text-navy-900 dark:text-white shadow-sm"
        >
          <LinkedInIcon />
          LinkedIn
        </button>
      </div>

      <div className="text-center pt-3 space-y-2">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {t('haveAccount')}{' '}
          <button onClick={() => setStep(AuthStep.LOGIN)} className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium hover:underline">{t('logIn')}</button>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-white/5">
          <button onClick={startDemo} className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium hover:underline flex items-center justify-center gap-1 mx-auto transition-colors">
            Try Demo Account
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">{t('welcomeBack')}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('signInText')}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('email')}</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('password')}</label>
          </div>
          <input
            type="password"
            required
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-sm"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm justify-center bg-red-50 dark:bg-red-500/10 p-3 rounded border border-red-200 dark:border-red-500/20">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button type="submit" className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/20 dark:shadow-purple-900/20 mt-2 text-sm">
          {t('logIn')}
        </button>
      </form>

      {/* Social Login Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-white dark:bg-navy-900 text-slate-500 dark:text-slate-400 text-xs">
            lub kontynuuj przez
          </span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 transition-all text-sm font-medium text-navy-900 dark:text-white shadow-sm"
        >
          <GoogleIcon />
          Google
        </button>
        <button
          type="button"
          onClick={handleLinkedInLogin}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 transition-all text-sm font-medium text-navy-900 dark:text-white shadow-sm"
        >
          <LinkedInIcon />
          LinkedIn
        </button>
      </div>

      <div className="text-center pt-4 text-sm text-slate-500 dark:text-slate-400">
        {t('noAccount')}{' '}
        <button onClick={() => setStep(AuthStep.REGISTER)} className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium hover:underline">{t('createOne')}</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-50 dark:bg-navy-950 p-6 relative overflow-hidden transition-colors duration-300">
      {/* Decorative BG */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-100/50 dark:from-purple-900/20 via-slate-50 dark:via-navy-950 to-slate-50 dark:to-navy-950 pointer-events-none transition-colors duration-300"></div>

      {/* Card Container */}
      <div className="relative w-full max-w-sm bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl rounded-2xl p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-300 transition-colors">

        {/* Branding */}
        <div className="flex justify-center mb-6">
          <img
            src="/assets/logos/logo-dark.png"
            className="h-10 w-auto object-contain hidden dark:block"
            alt="Consultify"
          />
          <img
            src="/assets/logos/logo-light.png"
            className="h-10 w-auto object-contain block dark:hidden"
            alt="Consultify"
          />
        </div>

        {/* Close/Back Button */}
        <button
          onClick={onBack}
          className="absolute top-4 right-4 text-slate-400 hover:text-navy-900 dark:text-slate-500 dark:hover:text-white transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
        >
          <X size={20} />
        </button>

        {!isPending && step === AuthStep.CODE_ENTRY && renderCodeEntry()}
        {!isPending && step === AuthStep.REGISTER && renderRegister()}
        {!isPending && step === AuthStep.LOGIN && renderLogin()}
        {isPending && renderPending()}

      </div>

      {/* Bottom Back Link */}
      <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-navy-900 dark:hover:text-slate-300 text-sm transition-colors group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          {t('backToStart')}
        </button>
      </div>
    </div>
  );
};
