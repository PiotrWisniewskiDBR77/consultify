import { AlertCircle, ArrowRight, ChevronLeft, Lock, Sparkles, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/routes/routeConfig';
import {
  clearAnnaLpCtaContext,
  readAnnaLpCtaContext,
  updateAnnaLpCtaContext,
} from '@/services/annaLpCtaContext';
import { Api } from '@/services/api';
import { adoptDemoSession } from '@/services/demoSessionAdoption';
import { postPublicAnnaFunnelEvent } from '@/services/publicAnnaAnalytics';

import { AuthStep, SessionMode, UserRole } from '../types';

// Helper to check if email is allowed for full access
// NOTE: Domain restriction removed on 2026-01-07 to allow all users to login
const isDBR77Domain = (_email: string): boolean => {
  return true; // All domains now allowed
};

interface AuthViewProps {
  initialStep: AuthStep;
  targetMode: SessionMode;
  onAuthSuccess: (user: { status?: string; message?: string }) => void;
  onBack: () => void;
}

type InviteCodeInfo = {
  code: string;
  organizationName?: string;
  role?: string;
} | null;

const AUTH_PUBLIC_ERROR_COPY = {
  quickAccessFailed: 'Quick access is temporarily unavailable. Please sign in with your account.',
  inviteVerifyFailed: 'Failed to verify access code. Please try again.',
  demoSignupFailed: 'Demo signup is temporarily unavailable. Please try again.',
  registrationFailed: 'Registration failed. Please try again.',
  loginFailed: 'Login failed. Please try again.',
  loginRetryFailed: 'Login failed. Please check your connection and try again.',
} as const;

type PublicAuthErrorContext =
  | 'quickAccess'
  | 'inviteVerify'
  | 'demoSignup'
  | 'registration'
  | 'login'
  | 'loginRetry';

function mapPublicAuthError(error: unknown, context: PublicAuthErrorContext): string {
  const raw = error as {
    code?: unknown;
    error?: { code?: unknown };
    data?: { code?: unknown };
  } | null;
  const code =
    typeof raw?.code === 'string'
      ? raw.code
      : typeof raw?.error?.code === 'string'
        ? raw.error.code
        : typeof raw?.data?.code === 'string'
          ? raw.data.code
          : null;

  if (code === 'AUTH_LOGIN_INVALID_CREDENTIALS' || code === 'AUTH_INVALID_CREDENTIALS') {
    return 'Invalid email or password.';
  }
  if (code === 'AUTH_PENDING_APPROVAL') {
    return 'Your account is pending approval.';
  }
  if (code === 'ORG_MEMBERSHIP_REVOKED') {
    return 'Your access to this organization has been revoked.';
  }

  switch (context) {
    case 'quickAccess':
      return AUTH_PUBLIC_ERROR_COPY.quickAccessFailed;
    case 'inviteVerify':
      return AUTH_PUBLIC_ERROR_COPY.inviteVerifyFailed;
    case 'demoSignup':
      return AUTH_PUBLIC_ERROR_COPY.demoSignupFailed;
    case 'registration':
      return AUTH_PUBLIC_ERROR_COPY.registrationFailed;
    case 'login':
      return AUTH_PUBLIC_ERROR_COPY.loginFailed;
    case 'loginRetry':
      return AUTH_PUBLIC_ERROR_COPY.loginRetryFailed;
    default:
      return AUTH_PUBLIC_ERROR_COPY.loginFailed;
  }
}

function getSafeAuthErrorLogMeta(error: unknown): {
  name?: string;
  code?: string;
  context: string;
} {
  const raw = error as { name?: unknown; code?: unknown; error?: { code?: unknown } } | null;
  const code =
    typeof raw?.code === 'string'
      ? raw.code
      : typeof raw?.error?.code === 'string'
        ? raw.error.code
        : undefined;
  return {
    name: typeof raw?.name === 'string' ? raw.name : undefined,
    code,
    context: 'login',
  };
}

/**
 * Hosts where the hidden quick-access PIN panel (Ctrl/Cmd+Shift+K) may appear.
 * Production is limited to the public marketing domain — PINs are filtered in
 * {@link resolveQuickAccessCredentials} so only the Anna demo shortcut works there.
 */
export function isQuickAccessShortcutHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('demo.') ||
    hostname.startsWith('stage.') ||
    hostname.startsWith('staging.') ||
    hostname === 'consultify.ai' ||
    hostname === 'www.consultify.ai' ||
    hostname === 'app.consultify.com' ||
    hostname.endsWith('.consultify.com') ||
    hostname.endsWith('.railway.app')
  );
}

export function isQuickAccessEnabledHost(hostname: string): boolean {
  return isQuickAccessShortcutHost(hostname);
}

type QuickAccessCredentials = { email: string; password: string } | { demo: true };

/**
 * Maps a 4-digit PIN to login credentials. On consultify.ai / www only `1111`
 * (Anna Zielińska → AtelierToys demo tenant) is allowed; dev/staging codes are blocked on prod.
 */
export function resolveQuickAccessCredentials(
  code: string,
  hostname: string
): QuickAccessCredentials | null {
  if (!isQuickAccessShortcutHost(hostname)) return null;

  const isProdPublic = hostname === 'consultify.ai' || hostname === 'www.consultify.ai';

  if (isProdPublic) {
    if (code === '1111') {
      return { email: 'anna.zielinska@ateliertoys-demo.com', password: '123456' };
    }
    return null;
  }

  const devStagingCodes: Record<string, QuickAccessCredentials> = {
    '7777': { email: 'piotr.wisniewski@dbr77.com', password: '123456' }, // Admin
    '7775': { email: 'pawel.mroczkowski@dbr77.com', password: '123456' }, // Paweł (DBR77)
    '1212': { email: 'pawel.mroczkowski@plastmetcentrum.pl', password: '123456' }, // Paweł (Plast-Met)
    '7776': { email: 'admin@dbr77.com', password: '123456' }, // SuperAdmin
    '7778': { demo: true },
    '1111': { email: 'anna.zielinska@ateliertoys-demo.com', password: '123456' },
  };

  return devStagingCodes[code] ?? null;
}

function formatInviteRoleLabel(role?: string): string {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();

  switch (normalized) {
    case 'OWNER':
      return 'Owner';
    case 'ADMIN':
      return 'Admin';
    case 'PROJECT_MANAGER':
    case 'MANAGER':
      return 'Manager';
    case 'GUEST':
      return 'Guest';
    case 'MEMBER':
    case 'USER':
      return 'Participant';
    default:
      return 'Participant';
  }
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
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const quickAccessEnabled = isQuickAccessShortcutHost(window.location.hostname);

  useEffect(() => {
    if (targetMode !== SessionMode.DEMO) return;
    const ctx = readAnnaLpCtaContext();
    if (!ctx || ctx.cta_type !== 'demo') return;
    if (ctx.start_recorded_at_ms) return;

    void postPublicAnnaFunnelEvent('anna_lp.cta.start', {
      session_id: ctx.session_id,
      cta_type: ctx.cta_type,
      language: ctx.language,
      channel: ctx.channel,
      turn_id: ctx.turn_id,
      source_intent: ctx.source_intent,
    });
    updateAnnaLpCtaContext({ start_recorded_at_ms: Date.now() });
  }, [targetMode]);

  // --- QUICK ACCESS (dev/staging + public prod domain; PINs restricted by host) ---
  const [showQuickAccess, setShowQuickAccess] = useState(false);
  const [quickCode, setQuickCode] = useState('');
  const quickAccessRef = useRef<HTMLInputElement>(null);

  // Reset transient auth UI state when route mode/step changes.
  // This prevents stale demo/quick-access loaders from leaking into normal login.
  useEffect(() => {
    setStep(initialStep);
    setError(null);
    setIsPending(false);
    setShowDemoRedirect(false);
    setIsDemoLoading(false);
    setFromDemoRedirect(false);
    setShowQuickAccess(false);
    setQuickCode('');
    setHasAcceptedLegal(false);
  }, [initialStep, targetMode]);

  // Quick access should never leak into normal auth flow.
  useEffect(() => {
    if (targetMode !== SessionMode.DEMO) {
      setIsDemoLoading(false);
      setFromDemoRedirect(false);
    }
  }, [targetMode]);

  // Keyboard: Ctrl/Cmd+Shift+K. Logo: double-click toggles PIN (single click stays inert to limit accidents).
  useEffect(() => {
    if (!quickAccessEnabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowQuickAccess((current) => !current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickAccessEnabled]);

  const toggleQuickAccessFromLogo = () => {
    if (!quickAccessEnabled) return;
    setShowQuickAccess((v) => !v);
    setQuickCode('');
  };

  // Quick access: dev/staging PINs; production consultify.ai / www → only 1111 (Anna demo).
  //
  // Deliberately NOT adopting a demo session here. Neither `Api.demoLogin()` nor
  // `Api.login()` returns a `demoSession` payload, so the only way to adopt would
  // be an extra round trip on a path whose whole point is an instant PIN entry.
  // The PIN accounts resolve against the shared curated org, which is what this
  // path has always shown. See `adoptDemoSession` for the entries that do adopt.
  const handleQuickAccess = async (code: string) => {
    if (!quickAccessEnabled) return;
    const credentials = resolveQuickAccessCredentials(code, window.location.hostname);
    if (credentials) {
      setIsDemoLoading(true);
      try {
        let user;
        if ('email' in credentials) {
          user = await Api.login(credentials.email, credentials.password);
        } else {
          user = await Api.demoLogin();
        }

        if (!('email' in credentials)) {
          const ctx = readAnnaLpCtaContext();
          if (ctx && ctx.cta_type === 'demo') {
            void postPublicAnnaFunnelEvent('anna_lp.cta.submit_success', {
              session_id: ctx.session_id,
              cta_type: ctx.cta_type,
              language: ctx.language,
              channel: ctx.channel,
              turn_id: ctx.turn_id,
              source_intent: ctx.source_intent,
            });
            updateAnnaLpCtaContext({ submit_success_at_ms: Date.now() });
            clearAnnaLpCtaContext();
          }
        }

        onAuthSuccess(user);
      } catch (err: any) {
        setError(mapPublicAuthError(err, 'quickAccess'));
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

  // --- CODE ENTRY STATE ---
  const storedInviteCode = sessionStorage.getItem('attribution_invite') || '';
  const [inviteCode, setInviteCode] = useState(storedInviteCode);
  const [inviteCodeInfo, setInviteCodeInfo] = useState<InviteCodeInfo>(
    storedInviteCode ? { code: storedInviteCode } : null
  );
  const [isVerifyingInviteCode, setIsVerifyingInviteCode] = useState(false);

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
  const [mfaChallenge, setMfaChallenge] = useState<{
    email: string;
    challenge: string;
    code: string;
    trustDevice: boolean;
    error: string | null;
    submitting: boolean;
  } | null>(null);

  const applyInviteCode = React.useCallback(
    (
      code: string,
      details?: {
        organizationName?: string;
        role?: string;
      }
    ) => {
      const normalizedCode = code.trim().toUpperCase();
      sessionStorage.setItem('attribution_invite', normalizedCode);
      setInviteCode(normalizedCode);
      setInviteCodeInfo({
        code: normalizedCode,
        organizationName: details?.organizationName,
        role: details?.role,
      });
      setFormData((current) => ({
        ...current,
        accessCode: normalizedCode,
        companyName: details?.organizationName || current.companyName,
      }));
    },
    []
  );

  const clearInviteCode = React.useCallback(() => {
    sessionStorage.removeItem('attribution_invite');
    setInviteCode('');
    setInviteCodeInfo(null);
    setFormData((current) => ({
      ...current,
      accessCode: '',
    }));
  }, []);

  const verifyInviteCode = async () => {
    const normalizedCode = inviteCode.trim().toUpperCase();
    if (!normalizedCode) {
      setError('Enter the access code you received from the administrator');
      return;
    }

    setError(null);
    setIsVerifyingInviteCode(true);

    try {
      const validation = await Api.verifyAccessCode(normalizedCode);
      if (!validation.valid) {
        setInviteCodeInfo(null);
        setError(validation.reason || 'Invalid or expired access code');
        return;
      }

      applyInviteCode(normalizedCode, {
        organizationName: validation.organizationName,
        role: validation.role,
      });
      setStep(AuthStep.REGISTER);
    } catch (err: any) {
      setInviteCodeInfo(null);
      setError(mapPublicAuthError(err, 'inviteVerify'));
    } finally {
      setIsVerifyingInviteCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasAcceptedLegal) {
      setError(
        t(
          'auth.legalConsentRequired',
          'Please confirm that you accept the Terms of Service and Privacy Policy to continue.'
        )
      );
      return;
    }

    // Demo mode or from demo redirect: use register-demo (minimal signup, demo org, track contact)
    if (targetMode === SessionMode.DEMO || fromDemoRedirect) {
      setIsDemoLoading(true);
      try {
        const ctx = readAnnaLpCtaContext();
        if (ctx && ctx.cta_type === 'demo') {
          const nextAttempts = (ctx.submit_attempts || 0) + 1;
          void postPublicAnnaFunnelEvent('anna_lp.cta.submit_attempt', {
            session_id: ctx.session_id,
            cta_type: ctx.cta_type,
            language: ctx.language,
            channel: ctx.channel,
            turn_id: ctx.turn_id,
            source_intent: ctx.source_intent,
          });
          updateAnnaLpCtaContext({ submit_attempts: nextAttempts });
        }

        const { user, demoSession } = await Api.registerDemo({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName || undefined,
          acceptedLegalDocs: ['TOS', 'PRIVACY'],
          legalConsentAt: new Date().toISOString(),
        });

        // Before `onAuthSuccess` — that callback navigates, and the first app
        // requests derive `X-Demo-Session-Org` from the store.
        adoptDemoSession(demoSession);

        if (ctx && ctx.cta_type === 'demo') {
          void postPublicAnnaFunnelEvent('anna_lp.cta.submit_success', {
            session_id: ctx.session_id,
            cta_type: ctx.cta_type,
            language: ctx.language,
            channel: ctx.channel,
            turn_id: ctx.turn_id,
            source_intent: ctx.source_intent,
          });
          updateAnnaLpCtaContext({ submit_success_at_ms: Date.now() });
          clearAnnaLpCtaContext();
        }
        // `isDemo: true` must survive to `handleAuthSuccess`: when the flag is
        // absent it calls `setDemoMode(false)` + `resetDemoState()` and wipes the
        // adoption above. `Api.registerDemo` already stamps it on the user, and
        // it is restated here so the guarantee does not depend on that.
        onAuthSuccess({ ...user, hasWorkspace: true, isDemo: true } as any);
      } catch (err: any) {
        setError(mapPublicAuthError(err, 'demoSignup'));

        const ctx = readAnnaLpCtaContext();
        if (ctx && ctx.cta_type === 'demo') {
          void postPublicAnnaFunnelEvent('anna_lp.cta.submit_error', {
            session_id: ctx.session_id,
            cta_type: ctx.cta_type,
            language: ctx.language,
            channel: ctx.channel,
            turn_id: ctx.turn_id,
            source_intent: ctx.source_intent,
          });
          const updated = updateAnnaLpCtaContext({ last_submit_error_at_ms: Date.now() });
          if ((updated?.submit_attempts || 0) >= 2) {
            void postPublicAnnaFunnelEvent('anna_lp.cta.fallback_used', {
              session_id: ctx.session_id,
              cta_type: ctx.cta_type,
              language: ctx.language,
              channel: ctx.channel,
              turn_id: ctx.turn_id,
              source_intent: ctx.source_intent,
            });
          }
        }
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
        acceptedLegalDocs: ['TOS', 'PRIVACY'],
        legalConsentAt: new Date().toISOString(),
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
      setError(mapPublicAuthError(err, 'registration'));
    }
  };

  const hasInviteCode = formData.accessCode.trim().length > 0;

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

    const form = e.currentTarget instanceof HTMLFormElement ? e.currentTarget : null;
    const emailInput = form?.elements.namedItem('email');
    const passwordInput = form?.elements.namedItem('password');
    const submittedEmail = (
      emailInput instanceof HTMLInputElement ? emailInput.value : formData.email
    ).trim();
    const submittedPassword =
      passwordInput instanceof HTMLInputElement ? passwordInput.value : formData.password;

    if (!submittedEmail || !submittedPassword) {
      setError('Email and password are required');
      return;
    }

    // Demo mode or from demo redirect: login then enter demo
    if (targetMode === SessionMode.DEMO || fromDemoRedirect) {
      setIsDemoLoading(true);
      try {
        const user = await Api.login(submittedEmail, submittedPassword, {
          deviceFingerprint: deviceFingerprint(),
        });
        const session =
          user.isDemo && user.demoSession ? user.demoSession : (await Api.enterDemo())?.demoSession;
        // Same ordering rule as the sign-up branch: adopt, then hand over to the
        // caller that navigates.
        adoptDemoSession(session);
        onAuthSuccess({ ...user, hasWorkspace: true, isDemo: true } as any);
      } catch (err: any) {
        setError(mapPublicAuthError(err, 'login'));
      } finally {
        setIsDemoLoading(false);
      }
      return;
    }

    // Check if email is from DBR77 domain
    if (!isDBR77Domain(submittedEmail)) {
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
        const user = await Api.login(submittedEmail, submittedPassword, {
          deviceFingerprint: deviceFingerprint(),
        });

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
        console.error('Login error:', getSafeAuthErrorLogMeta(err));

        if (err?.code === 'AUTH_MFA_REQUIRED') {
          setMfaChallenge({
            email: submittedEmail,
            challenge: String(err?.data?.mfaChallenge || ''),
            code: '',
            trustDevice: false,
            error: null,
            submitting: false,
          });
          return;
        }

        if (String(err?.data?.code || '').toUpperCase() === 'ORG_MEMBERSHIP_REVOKED') {
          setFormData((current) => ({ ...current, password: '' }));
          setError(mapPublicAuthError(err, 'login'));
          return;
        }

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
          setError(mapPublicAuthError(err, 'login'));
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
      setError(mapPublicAuthError(lastError, 'loginRetry'));
    } else {
      setError(mapPublicAuthError(null, 'login'));
    }
  };

  const deviceFingerprint = () => {
    const storageKey = 'consultify-trusted-device-id';
    const existing = localStorage.getItem(storageKey);
    if (existing && /^web-[a-f0-9]{64}$/.test(existing)) return existing;
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    const opaqueId = `web-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    localStorage.setItem(storageKey, opaqueId);
    return opaqueId;
  };

  const submitMfaChallenge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mfaChallenge || mfaChallenge.submitting) return;
    if (!/^\d{6}$/.test(mfaChallenge.code)) {
      setMfaChallenge((current) =>
        current ? { ...current, error: 'Enter the 6-digit authentication code.' } : current
      );
      return;
    }

    setMfaChallenge((current) =>
      current ? { ...current, submitting: true, error: null } : current
    );
    try {
      const user = await Api.login('', '', {
        mfaToken: mfaChallenge.code,
        mfaChallenge: mfaChallenge.challenge,
        deviceFingerprint: deviceFingerprint(),
        trustDevice: mfaChallenge.trustDevice,
      });
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Login succeeded but token was not stored');
      setMfaChallenge(null);
      setFormData((current) => ({ ...current, password: '' }));
      onAuthSuccess(user);
    } catch (err: any) {
      const code = String(err?.data?.code || err?.code || '').toUpperCase();
      if (code === 'ORG_MEMBERSHIP_REVOKED') {
        setMfaChallenge(null);
        setFormData((current) => ({ ...current, password: '' }));
        setError(mapPublicAuthError(err, 'login'));
        return;
      }
      const message =
        err?.data?.mfaRequired === true || err?.status === 401
          ? 'The authentication code is invalid or expired. Try a current code.'
          : 'Verification could not be completed. Your code was not accepted; retry.';
      setMfaChallenge((current) =>
        current ? { ...current, code: '', error: message, submitting: false } : current
      );
    }
  };

  const renderPending = () => (
    <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-16 h-16 bg-c-warning/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-c-warning/20">
        <Lock className="text-c-warning" size={32} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-c-text mb-2">Access Pending</h2>
        <p className="text-c-text-muted text-sm max-w-xs mx-auto leading-relaxed">
          Your organization is currently waiting for manual approval. You will receive an email once
          your access is granted.
        </p>
      </div>
      <button
        onClick={() => {
          setIsPending(false);
          setStep(AuthStep.LOGIN);
        }}
        className="text-c-accent hover:opacity-80 font-medium hover:underline text-sm transition-colors"
      >
        Back to Login
      </button>
    </div>
  );

  // Demo redirect for non-DBR77 users
  const renderDemoRedirect = () => (
    <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-16 h-16 bg-c-accent-soft rounded-full flex items-center justify-center mx-auto mb-4 border border-c-accent/20">
        <Sparkles className="text-c-accent" size={32} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-c-text mb-2">{t('auth.demoMode', 'Demo Mode')}</h2>
        <p className="text-c-text-muted text-sm max-w-xs mx-auto leading-relaxed">
          {t(
            'auth.demoModeDescriptionSigned',
            'Sign up or log in to try the demo. We will follow up with you.'
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleDemoRedirectToForm}
          className="w-full py-2.5 bg-c-accent hover:opacity-90 text-white font-semibold rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2"
        >
          {t('auth.signUpForDemo', 'Sign up for Demo')}
          <ArrowRight size={16} />
        </button>
        <button
          onClick={handleDemoRedirectToLogin}
          className="w-full py-2.5 bg-c-surface border border-c-border text-c-text font-semibold rounded-lg hover:border-c-accent/30 transition-colors"
        >
          {t('auth.logInForDemo', 'Log in for Demo')}
        </button>
        <a
          href="https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 bg-c-bg border border-c-border text-c-text-secondary font-medium rounded-lg hover:bg-c-surface-raised transition-colors text-center text-sm"
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
        className="text-c-accent hover:opacity-80 font-medium hover:underline text-sm transition-colors"
      >
        {t('auth.back', 'Back')}
      </button>
    </div>
  );

  const renderCodeEntry = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-12 h-12 bg-c-info/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-c-info/20">
          <Lock className="text-c-info" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-c-text mb-2">
          {t('auth.unlockFull', 'Join Workspace')}
        </h2>
        <p className="text-c-text-muted text-sm max-w-xs mx-auto">
          {t(
            'auth.enterCode',
            'Enter the organization access code to create your participant account.'
          )}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="WPISZ KOD (np. ABCD1234)"
          autoComplete="off"
          className="w-full px-4 py-3 bg-c-surface border border-c-border rounded-lg text-center text-sm font-semibold tracking-[0.18em] uppercase text-c-text focus:border-c-focus-solid focus:ring-1 focus:ring-c-focus focus:bg-c-surface-raised outline-none transition-colors shadow-sm"
        />
        {inviteCodeInfo?.code && (
          <div className="rounded-lg border border-c-success/20 bg-c-success/10 px-3 py-3 text-xs text-c-success">
            <div className="font-semibold">Code accepted</div>
            <div className="mt-1">
              {inviteCodeInfo.organizationName
                ? `Workspace: ${inviteCodeInfo.organizationName}`
                : 'Workspace will be selected automatically after registration.'}
            </div>
            <div className="mt-1">
              Role after registration: {formatInviteRoleLabel(inviteCodeInfo.role)}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className="flex items-center gap-2 text-danger-600 dark:text-danger-400 text-sm justify-center bg-danger-50 dark:bg-danger-500/10 p-3 rounded border border-danger-200 dark:border-danger-500/20"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <button
        onClick={() => void verifyInviteCode()}
        disabled={isVerifyingInviteCode}
        className="w-full py-2.5 bg-c-info hover:opacity-90 text-white font-semibold rounded-lg transition-colors shadow-lg text-sm"
      >
        {isVerifyingInviteCode
          ? t('auth.verifyingCode', 'Verifying code...')
          : t('auth.verifyCode', 'Continue')}
      </button>
    </div>
  );

  const renderRegister = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-c-text mb-2">
          {hasInviteCode
            ? t('auth.joinWorkspaceTitle', 'Create your participant account')
            : targetMode === SessionMode.FREE
              ? t('auth.startQuick')
              : t('auth.setupFull')}
        </h2>
        <p className="text-c-text-muted text-sm">
          {hasInviteCode
            ? t(
                'auth.joinWorkspaceDescription',
                'Complete your personal details and we will connect you to the invited workspace.'
              )
            : t('auth.personalize')}
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {hasInviteCode && (
          <div className="rounded-lg border border-c-info/20 bg-c-info/10 px-3 py-3 text-xs leading-5 text-c-info">
            <div className="font-semibold">
              {inviteCodeInfo?.organizationName
                ? `Joining ${inviteCodeInfo.organizationName}`
                : 'Joining invited workspace'}
            </div>
            <div className="mt-1">
              Access code: <span className="font-mono">{formData.accessCode}</span>
            </div>
            <div className="mt-1">Planned role: {formatInviteRoleLabel(inviteCodeInfo?.role)}</div>
            <button
              type="button"
              onClick={() => {
                clearInviteCode();
                setStep(AuthStep.CODE_ENTRY);
              }}
              className="mt-2 text-xs font-medium text-c-info hover:underline"
            >
              Change access code
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-c-text-secondary">
              {t('auth.firstName')} <span className="text-c-accent">*</span>
            </label>
            <input
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:bg-c-surface outline-none transition-colors text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-c-text-secondary">
              {t('auth.lastName')} <span className="text-c-accent">*</span>
            </label>
            <input
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:bg-c-surface outline-none transition-colors text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-c-text-secondary">
            {t('auth.email')} <span className="text-c-accent">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:bg-c-surface outline-none transition-colors text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-c-text-secondary">{t('auth.phone')}</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:bg-c-surface outline-none transition-colors text-xs"
          />
        </div>

        {!hasInviteCode && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-c-text-secondary">{t('auth.company')}</label>
            <input
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:bg-c-surface outline-none transition-colors text-xs"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-c-text-secondary">
            {t('auth.accessCode')}{' '}
            <span className="text-c-text-muted font-normal">({t('auth.optional')})</span>
          </label>
          <input
            value={formData.accessCode}
            onChange={(e) => {
              const nextCode = e.target.value.toUpperCase();
              setFormData({ ...formData, accessCode: nextCode });
              setInviteCode(nextCode);
              setInviteCodeInfo(null);
            }}
            placeholder={t('auth.accessCodePlaceholder')}
            className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:bg-c-surface outline-none transition-colors text-xs placeholder:text-c-text-muted"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-c-text-secondary">
            {t('auth.password')} <span className="text-c-accent">*</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:bg-c-surface outline-none transition-colors text-xs"
          />
        </div>

        {error && (
          <div
            className="flex items-center gap-2 text-danger-600 dark:text-danger-400 text-sm justify-center bg-danger-50 dark:bg-danger-500/10 p-3 rounded border border-danger-200 dark:border-danger-500/20 mt-4"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-3 text-xs leading-5 text-c-text-secondary">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={hasAcceptedLegal}
              onChange={(e) => setHasAcceptedLegal(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-c-border text-c-accent focus:ring-c-focus"
            />
            <span>
              {t('auth.legalConsentPrefix', 'I agree to the')}{' '}
              <a href={ROUTES.LEGAL.TERMS} className="font-medium text-c-accent hover:underline">
                {t('auth.termsLink', 'Terms of Service')}
              </a>{' '}
              {t('auth.legalConsentAnd', 'and')}{' '}
              <a href={ROUTES.LEGAL.PRIVACY} className="font-medium text-c-accent hover:underline">
                {t('auth.privacyLink', 'Privacy Policy')}
              </a>
              .
            </span>
          </label>
          <p className="mt-2 pl-7 text-[11px] text-c-text-muted">
            {t('auth.legalReviewNote', 'Review pricing and legal materials in')}{' '}
            <a
              href={ROUTES.LEGAL.SUBSCRIPTION}
              className="font-medium text-c-accent hover:underline"
            >
              {t('auth.subscriptionLink', 'Subscription Terms')}
            </a>{' '}
            {t('auth.legalReviewDivider', 'or visit the')}{' '}
            <a href={ROUTES.LEGAL.CENTER} className="font-medium text-c-accent hover:underline">
              {t('auth.legalCenterLink', 'Legal Center')}
            </a>
            .
          </p>
        </div>

        <button className="w-full py-2.5 bg-c-text hover:opacity-90 text-c-bg font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-4 shadow-lg group text-sm">
          {t('auth.createStart')}
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </form>

      <div className="text-center pt-3 space-y-2">
        <div className="text-sm text-c-text-muted">
          {t('auth.haveAccount')}{' '}
          <button
            onClick={() => setStep(AuthStep.LOGIN)}
            className="text-c-accent hover:opacity-80 font-medium hover:underline"
          >
            {t('auth.logIn')}
          </button>
        </div>

        {!hasInviteCode && (
          <div className="text-xs text-c-text-muted">
            {t('auth.haveAccessCodePrompt', 'Have an organization code?')}{' '}
            <button
              type="button"
              onClick={() => setStep(AuthStep.CODE_ENTRY)}
              className="inline-flex items-center gap-1 text-c-info hover:underline font-medium"
            >
              <Lock size={12} />
              {t('auth.enterAccessCodeCta', 'Enter access code')}
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-c-border">
          <button
            onClick={startDemoFlow}
            className="text-c-info hover:opacity-80 text-xs font-medium hover:underline flex items-center justify-center gap-1 mx-auto transition-colors"
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
        <h2 className="text-2xl font-bold text-c-text mb-2">{t('auth.welcomeBack')}</h2>
        <p className="text-c-text-muted text-sm">{t('auth.signInText')}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-c-text-secondary">{t('auth.email')}</label>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
            data-testid="email-input"
            className="w-full px-3 py-2.5 bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:bg-c-surface outline-none transition-colors text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-xs font-medium text-c-text-secondary">
              {t('auth.password')}
            </label>
            <button
              type="button"
              onClick={() => (window.location.href = '/forgot-password')}
              className="text-xs text-c-accent hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={(e) => setFormData((current) => ({ ...current, password: e.target.value }))}
            data-testid="password-input"
            className="w-full px-3 py-2.5 bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:bg-c-surface outline-none transition-colors text-sm"
          />
        </div>

        {error && (
          <div
            className="flex items-center gap-2 text-danger-600 dark:text-danger-400 text-sm justify-center bg-danger-50 dark:bg-danger-500/10 p-3 rounded border border-danger-200 dark:border-danger-500/20"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button
          type="submit"
          data-testid="login-button"
          className="w-full py-2.5 bg-c-text hover:opacity-90 text-c-bg font-semibold rounded-lg transition-colors shadow-lg mt-2 text-sm"
        >
          {t('auth.logIn')}
        </button>
      </form>

      <div className="text-center pt-4 text-sm text-c-text-muted">
        {t('auth.noAccount')}{' '}
        <button
          onClick={() => setStep(AuthStep.REGISTER)}
          className="text-c-accent hover:opacity-80 font-medium hover:underline"
        >
          {t('auth.createOne')}
        </button>
      </div>

      <div className="text-center -mt-4">
        <div className="text-xs text-c-text-muted">
          {t('auth.haveAccessCodePrompt', 'Have an organization code?')}
        </div>
        <button
          type="button"
          onClick={() => setStep(AuthStep.CODE_ENTRY)}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-c-info/20 bg-c-info/10 px-3 py-2 text-xs font-medium text-c-info transition-colors hover:bg-c-info/15"
        >
          <Lock size={13} />
          {t('auth.enterAccessCodeCta', 'Enter access code')}
        </button>
      </div>

      {/* Privacy Policy Link */}
      <div className="text-center pt-3 border-t border-c-border">
        <a
          href={ROUTES.LEGAL.PRIVACY}
          className="text-xs text-c-text-muted hover:text-c-accent transition-colors"
        >
          {t('auth.privacyLink', 'Polityka prywatności')}
        </a>
        <span className="text-c-text-muted mx-2">•</span>
        <a
          href={ROUTES.LEGAL.TERMS}
          className="text-xs text-c-text-muted hover:text-c-accent transition-colors"
        >
          {t('auth.termsLink', 'Regulamin')}
        </a>
        <span className="text-c-text-muted mx-2">•</span>
        <a
          href={ROUTES.LEGAL.CENTER}
          className="text-xs text-c-text-muted hover:text-c-accent transition-colors"
        >
          {t('auth.legalCenterLink', 'Legal Center')}
        </a>
      </div>
    </div>
  );

  const renderMfaChallenge = () => {
    if (!mfaChallenge) return null;
    return (
      <div className="space-y-6" data-testid="login-mfa-challenge">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-c-border bg-c-surface">
            <Lock className="text-c-text" size={24} aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-c-text">
            {t('mfa.challenge.title', 'Two-Factor Authentication')}
          </h2>
          <p className="text-sm text-c-text-muted">
            {t('mfa.challenge.enterTotp', 'Enter the code from your authenticator app')}
          </p>
        </div>

        <form onSubmit={submitMfaChallenge} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-c-text-secondary">Authentication code</span>
            <input
              autoFocus
              aria-label="Authentication code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={mfaChallenge.code}
              onChange={(event) => {
                const code = event.target.value.replace(/\D/g, '').slice(0, 6);
                setMfaChallenge((current) =>
                  current ? { ...current, code, error: null } : current
                );
              }}
              className="w-full rounded-lg border border-c-border bg-c-surface-raised px-3 py-3 text-center font-mono text-2xl tracking-[0.45em] text-c-text outline-none transition-colors focus:border-c-focus-solid"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-c-text-secondary">
            <input
              type="checkbox"
              checked={mfaChallenge.trustDevice}
              onChange={(event) =>
                setMfaChallenge((current) =>
                  current ? { ...current, trustDevice: event.target.checked } : current
                )
              }
              className="h-4 w-4 rounded border-c-border text-c-text focus:ring-c-focus"
            />
            {t('mfa.challenge.trustDevice', 'Trust this device for 30 days')}
          </label>

          {mfaChallenge.error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-center gap-2 rounded border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600 dark:border-danger-500/20 dark:bg-danger-500/10 dark:text-danger-400"
            >
              <AlertCircle size={16} />
              {mfaChallenge.error}
            </div>
          )}

          <button
            type="submit"
            disabled={mfaChallenge.submitting}
            className="w-full rounded-lg bg-c-text py-2.5 text-sm font-semibold text-c-bg shadow-lg transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {mfaChallenge.submitting
              ? t('common.verifying', 'Verifying…')
              : t('mfa.challenge.verify', 'Verify')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMfaChallenge(null);
              setFormData((current) => ({ ...current, password: '' }));
              setError(null);
            }}
            className="w-full text-sm font-medium text-c-text-muted hover:text-c-text"
          >
            Back to login
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-c-bg p-6 relative overflow-hidden transition-colors duration-200">
      {/* Decorative BG */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-c-accent-soft via-c-bg to-c-bg pointer-events-none transition-colors duration-200"></div>

      {/* Card Container */}
      <div className="relative w-full max-w-sm bg-c-surface/80 backdrop-blur-xl border border-c-border shadow-2xl rounded-xl p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-200 transition-colors">
        {/* Branding */}
        <div className="flex flex-col items-center mb-6">
          <div
            className={`select-none ${quickAccessEnabled ? 'cursor-pointer' : ''}`}
            onDoubleClick={(e) => {
              e.preventDefault();
              toggleQuickAccessFromLogo();
            }}
            role={quickAccessEnabled ? 'button' : undefined}
            tabIndex={quickAccessEnabled ? 0 : undefined}
            onKeyDown={(e) => {
              if (!quickAccessEnabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleQuickAccessFromLogo();
              }
            }}
            title={
              quickAccessEnabled
                ? t(
                    'auth.quickAccessLogoHint',
                    'Double-click the logo (or Ctrl+Shift+K / Cmd+Shift+K) to enter a 4-digit PIN.'
                  )
                : undefined
            }
            aria-label={
              quickAccessEnabled
                ? t('auth.quickAccessLogoAria', 'Open quick PIN sign-in (double-click)')
                : undefined
            }
          >
            <img
              src="/assets/logos/logo-dark.svg?v=20260319"
              className="h-16 md:h-20 w-auto object-contain hidden dark:block drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)] pointer-events-none"
              alt="Consultify"
            />
            <img
              src="/assets/logos/logo-light.svg?v=20260319"
              className="h-16 md:h-20 w-auto object-contain block dark:hidden drop-shadow-[0_18px_40px_rgba(0,0,0,0.18)] pointer-events-none"
              alt="Consultify"
            />
          </div>

          {/* Quick Access Code Input (hidden until shortcut or double-click on logo) */}
          {quickAccessEnabled && showQuickAccess && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col items-center gap-1">
              <input
                ref={quickAccessRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                value={quickCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setQuickCode(val);
                  if (val.length === 4) {
                    void handleQuickAccess(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
                  if (raw.length === 4) {
                    void handleQuickAccess(raw);
                  }
                }}
                placeholder="••••"
                aria-label={t('auth.quickAccessPinAria', 'Four-digit quick access PIN')}
                className="w-24 px-3 py-1.5 text-center text-lg tracking-widest font-mono bg-c-surface-raised border border-c-border rounded-lg text-c-text focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus outline-none transition-colors"
              />
              <span className="text-[10px] text-c-text-muted max-w-[14rem] text-center leading-tight">
                {t(
                  'auth.quickAccessFooter',
                  'Enter your PIN. To hide this field, double-click the logo or press Ctrl+Shift+K.'
                )}
              </span>
            </div>
          )}
        </div>

        {/* Close/Back Button */}
        <button
          onClick={onBack}
          className="absolute top-4 right-4 text-c-text-muted hover:text-c-text transition-colors p-2 rounded-full hover:bg-c-surface-raised"
        >
          <X size={20} />
        </button>

        {isDemoLoading && (
          <div className="text-center py-12 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 border-4 border-c-accent border-t-transparent rounded-full animate-spin mx-auto shadow-lg"></div>
            <p className="text-c-text-secondary font-medium animate-pulse">
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
          !mfaChallenge &&
          renderLogin()}
        {!isDemoLoading && !isPending && !showDemoRedirect && mfaChallenge && renderMfaChallenge()}
        {isPending && renderPending()}
        {showDemoRedirect && renderDemoRedirect()}
      </div>

      {/* Bottom Navigation Links */}
      <div className="mt-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 delay-100">
        <a
          href="/"
          className="flex items-center gap-2 px-4 py-2 bg-c-surface/50 border border-c-border rounded-lg text-c-text-secondary hover:text-c-accent hover:border-c-accent/30 text-sm transition-colors group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          {t('auth.backToStart')}
        </a>
      </div>
    </div>
  );
};
