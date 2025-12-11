
import React, { useState, useRef } from 'react';
import { ArrowRight, Lock, AlertCircle, X, ChevronLeft } from 'lucide-react';
import { AuthStep, SessionMode, Language, UserRole } from '../types';
import { translations } from '../translations';
import { Api } from '../services/api';

interface AuthViewProps {
  initialStep: AuthStep;
  targetMode: SessionMode;
  onAuthSuccess: (user: any) => void;
  onBack: () => void;
  language: Language;
}

export const AuthView: React.FC<AuthViewProps> = ({ initialStep, targetMode, onAuthSuccess, onBack, language }) => {
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const t = translations.auth;

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
    accessCode: ''
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
      const user = await Api.register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        companyName: formData.companyName,
        phone: formData.phone,
        password: formData.password,
        accessCode: formData.accessCode,
        role: UserRole.CEO,
        accessLevel: targetMode === SessionMode.FULL ? 'full' : 'free'
      });

      // Check if the user status or a specific message implies pending
      // The backend returns { status: 'pending', message: ... } if pending
      if ((user as any).status === 'pending') {
        setIsPending(true);
        return;
      }

      onAuthSuccess(user);
    } catch (err: any) {
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
      const user = await Api.register(demoUser);
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
      const user = await Api.login(formData.email, formData.password);
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
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">{t.unlockFull[language]}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">{t.enterCode[language]}</p>
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
        {t.verifyCode[language]}
      </button>
    </div>
  );

  const renderRegister = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          {targetMode === SessionMode.FREE ? t.startQuick[language] : t.setupFull[language]}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {t.personalize[language]}
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.firstName[language]} <span className="text-purple-500 dark:text-purple-400">*</span></label>
            <input
              required
              value={formData.firstName}
              onChange={e => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.lastName[language]} <span className="text-purple-500 dark:text-purple-400">*</span></label>
            <input
              required
              value={formData.lastName}
              onChange={e => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.email[language]} <span className="text-purple-500 dark:text-purple-400">*</span></label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.phone[language]}</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 focus:bg-white dark:focus:bg-navy-900 outline-none transition-all text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.company[language]} <span className="text-purple-500 dark:text-purple-400">*</span></label>
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
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.password[language]} <span className="text-purple-500 dark:text-purple-400">*</span></label>
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
          {t.createStart[language]}
          <ArrowRight size={16} className={`group-hover:translate-x-1 transition-transform ${language === 'AR' ? 'rotate-180' : ''}`} />
        </button>
      </form>

      <div className="text-center pt-2 space-y-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {t.haveAccount[language]}{' '}
          <button onClick={() => setStep(AuthStep.LOGIN)} className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium hover:underline">{t.logIn[language]}</button>
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
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">{t.welcomeBack[language]}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t.signInText[language]}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.email[language]}</label>
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
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.password[language]}</label>
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
          {t.logIn[language]}
        </button>
      </form>

      <div className="text-center pt-2 text-sm text-slate-500 dark:text-slate-400">
        {t.noAccount[language]}{' '}
        <button onClick={() => setStep(AuthStep.REGISTER)} className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium hover:underline">{t.createOne[language]}</button>
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
          className={`absolute top-4 ${language === 'AR' ? 'left-4' : 'right-4'} text-slate-400 hover:text-navy-900 dark:text-slate-500 dark:hover:text-white transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5`}
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
          <ChevronLeft size={16} className={`transition-transform ${language === 'AR' ? 'rotate-180' : 'group-hover:-translate-x-1'}`} />
          {t.backToStart[language]}
        </button>
      </div>
    </div>
  );
};
