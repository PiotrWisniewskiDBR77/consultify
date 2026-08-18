import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Key,
  Loader2,
  Lock,
  Mail,
  QrCode,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

/**
 * MFASetup Component - Enhanced
 *
 * Enterprise-grade MFA setup with:
 * - TOTP (Authenticator app)
 * - Recovery email verification
 * - Backup codes with better UX
 * - SMS fallback option (UI ready)
 * - Trust device option
 */

interface MFASetupProps {
  isEnabled: boolean;
  onUpdate: () => void;
}

type MFAStep =
  | 'initial'
  | 'method-select'
  | 'setup-app'
  | 'setup-sms'
  | 'verify'
  | 'backup'
  | 'recovery'
  | 'complete';

interface MFAMethod {
  id: 'app' | 'sms';
  name: string;
  description: string;
  icon: React.ReactNode;
  recommended: boolean;
  available: boolean;
  configured?: boolean;
}

interface MFAMethodsResponse {
  enabled: boolean;
  methods: MFAMethod[];
  primary: string;
  smsAvailable: boolean;
}

export const MFASetup: React.FC<MFASetupProps> = ({ isEnabled, onUpdate }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<MFAStep>('initial');
  const [selectedMethod, setSelectedMethod] = useState<'app' | 'sms'>('app');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [disableConfirm, setDisableConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<{
    enabled: boolean;
    enabledAt?: string;
    method?: string;
    backupCodesRemaining?: number;
  }>({ enabled: isEnabled });
  const [configuredMethods, setConfiguredMethods] = useState<MFAMethod[]>([]);

  const mfaMethods: MFAMethod[] = [
    {
      id: 'app',
      name: t('security.mfa.methodApp', 'Authenticator App'),
      description: t(
        'security.mfa.methodAppDesc',
        'Use Google Authenticator, Authy, or similar apps'
      ),
      icon: <Smartphone className="w-6 h-6" />,
      recommended: true,
      available: true,
    },
    {
      id: 'sms',
      name: t('security.mfa.methodSms', 'SMS Verification'),
      description: t('security.mfa.methodSmsDesc', 'Receive codes via text message'),
      icon: <Mail className="w-6 h-6" />,
      recommended: false,
      available: smsAvailable, // Dynamic based on backend support
    },
  ];

  useEffect(() => {
    fetchMFAMethods();
    // The parent user snapshot can be older than the tenant-authoritative MFA
    // row after enrolment or a cold reload. Always hydrate the real status.
    fetchMFAStatus();
  }, [isEnabled]);

  const fetchMFAMethods = async () => {
    try {
      const response = (await Api.get('/api/mfa/methods')) as MFAMethodsResponse;
      if (response) {
        setSmsAvailable(response.smsAvailable);
        setConfiguredMethods(response.methods || []);
        if (response.primary) {
          setSelectedMethod(response.primary === 'sms' ? 'sms' : 'app');
        }
      }
    } catch (error) {
      // SMS not available by default
      setSmsAvailable(false);
    }
  };

  const fetchMFAStatus = async () => {
    try {
      const response = await Api.get('/api/mfa/status');
      if (response) {
        setMfaStatus({
          enabled: response.enabled ?? response.isEnabled ?? false,
          enabledAt: response.enabledAt,
          method: response.method || 'totp',
          backupCodesRemaining: response.backupCodesRemaining,
        });
      }
    } catch (error) {
      // Use prop value
      setMfaStatus({ enabled: isEnabled });
    }
  };

  const startSetup = async () => {
    // If SMS is available, show method selection first
    if (smsAvailable) {
      setStep('method-select');
      return;
    }
    // Otherwise, directly start TOTP setup
    await startTOTPSetup();
  };

  const startTOTPSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await Api.post('/api/mfa/setup', {});
      setQrCode(res.qrCodeData || res.qrCode || res.data?.qrCodeData || res.data?.qrCode);
      setSecret(res.secret || res.manualEntry || res.data?.secret || res.data?.manualEntry);
      setStep('setup-app');
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          t('security.mfa.setupError', 'Failed to start MFA setup')
      );
    } finally {
      setLoading(false);
    }
  };

  const startSMSSetup = async () => {
    if (!phoneNumber) {
      setError(t('security.mfa.phoneRequired', 'Phone number is required'));
      return;
    }

    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      setError(
        t(
          'security.mfa.invalidPhone',
          'Invalid phone number. Use international format (e.g., +1234567890)'
        )
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await Api.post('/api/mfa/sms/setup', { phoneNumber });
      if (res.success) {
        setStep('verify');
        toast.success(t('security.mfa.smsSent', 'Verification code sent to your phone'));
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          t('security.mfa.smsSetupError', 'Failed to send verification code')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = (method: 'app' | 'sms') => {
    setSelectedMethod(method);
    setError(null);

    if (method === 'app') {
      startTOTPSetup();
    } else {
      setStep('setup-sms');
    }
  };

  const verifySMSAndEnable = async () => {
    if (verificationCode.length !== 6) {
      setError(t('security.mfa.codeLength', 'Please enter a 6-digit code'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await Api.post('/api/mfa/sms/verify-setup', {
        code: verificationCode,
      });
      if (res.success || res.data?.success) {
        setBackupCodes(res.backupCodes || res.data?.backupCodes || []);
        setMfaStatus((current) => ({ ...current, enabled: true, method: 'sms' }));
        setStep('backup');
        toast.success(t('security.mfa.smsEnabled', 'SMS MFA enabled successfully!'));
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          t('security.mfa.invalidCode', 'Invalid verification code')
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) {
      setError(t('security.mfa.codeLength', 'Please enter a 6-digit code'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await Api.post('/api/mfa/verify-setup', {
        token: verificationCode,
      });
      if (res.success || res.data?.success) {
        setBackupCodes(res.backupCodes || res.data?.backupCodes || []);
        setMfaStatus((current) => ({ ...current, enabled: true, method: 'totp' }));
        setStep('backup');
        toast.success(t('security.mfa.enabled', '2FA enabled successfully!'));
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          t('security.mfa.invalidCode', 'Invalid verification code')
      );
    } finally {
      setLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    if (loading) return;
    if (verificationCode.length !== 6) {
      setError(
        t('security.mfa.codeRequired', 'Enter your current 2FA code to regenerate backup codes')
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await Api.post('/api/mfa/regenerate-backup-codes', {
        token: verificationCode,
      });
      const regeneratedCodes = res.backupCodes || res.data?.backupCodes;
      if (res.success || res.data?.success || regeneratedCodes) {
        setBackupCodes(regeneratedCodes || []);
        setVerificationCode('');
        toast.success(t('security.mfa.codesRegenerated', 'Backup codes regenerated'));
      } else {
        throw new Error(t('security.mfa.regenerateError', 'Failed to regenerate codes'));
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error || t('security.mfa.regenerateError', 'Failed to regenerate codes')
      );
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    if (loading) return;
    if (verificationCode.length !== 6) {
      setError(t('security.mfa.codeRequired', 'Please enter your 2FA code'));
      return;
    }
    if (!currentPassword) {
      setError(t('security.mfa.passwordRequired', 'Enter your current password'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await Api.post('/api/mfa/disable', {
        token: verificationCode,
        password: currentPassword,
      });
      if (res.success || res.data?.success) {
        setDisableConfirm(false);
        setVerificationCode('');
        setCurrentPassword('');
        setMfaStatus((current) => ({ ...current, enabled: false }));
        toast.success(t('security.mfa.disabled', '2FA has been disabled'));
        onUpdate();
      } else {
        throw new Error(t('security.mfa.disableError', 'Failed to disable 2FA'));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('security.mfa.invalidCode', 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success(t('common.copied', 'Copied to clipboard'));
  };

  const copyAllCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success(t('security.mfa.allCodesCopied', 'All backup codes copied'));
  };

  const downloadCodes = () => {
    const content = `Consultify Backup Codes\nGenerated: ${new Date().toLocaleDateString()}\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nKeep these codes safe. Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'consultify-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleComplete = () => {
    setStep('initial');
    onUpdate();
  };

  // MFA Enabled State
  if (mfaStatus.enabled && !disableConfirm) {
    return (
      <div
        data-testid="mfa-setup"
        className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        {/* Status Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl p-6 text-white shadow-lg shadow-emerald-500/25">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {t('security.mfa.activeTitle', 'Two-Factor Authentication Active')}
              </h3>
              <p className="text-emerald-100">
                {t('security.mfa.activeDesc', 'Your account is protected with 2FA')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-emerald-100 text-xs mb-1">{t('security.mfa.method', 'Method')}</p>
              <p className="font-medium flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                {t('security.mfa.authenticatorApp', 'Authenticator App')}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-emerald-100 text-xs mb-1">
                {t('security.mfa.backupCodes', 'Backup Codes')}
              </p>
              <p className="font-medium">
                {mfaStatus.backupCodesRemaining ?? '10'} {t('security.mfa.remaining', 'remaining')}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-navy-700">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              {t('security.mfa.manage', 'Manage 2FA')}
            </h4>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-white/5">
            {/* Regenerate Backup Codes */}
            <button
              onClick={() => setStep('recovery')}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                  <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {t('security.mfa.regenerateCodes', 'Regenerate Backup Codes')}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                      'security.mfa.regenerateDesc',
                      'Get new backup codes (invalidates old ones)'
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-500" />
            </button>

            {/* Disable 2FA */}
            <button
              onClick={() => setDisableConfirm(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-danger-100 dark:bg-danger-500/20 rounded-lg">
                  <ShieldOff className="w-5 h-5 text-danger-600 dark:text-danger-400" />
                </div>
                <div>
                  <p className="font-medium text-danger-600 dark:text-danger-400">
                    {t('security.mfa.disable', 'Disable 2FA')}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('security.mfa.disableWarning', 'Not recommended - reduces account security')}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-500" />
            </button>
          </div>
        </div>

        {/* Regenerate Codes Modal */}
        {step === 'recovery' && (
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              {t('security.mfa.regenerateCodes', 'Regenerate Backup Codes')}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t(
                'security.mfa.regenerateInfo',
                'Enter your current 2FA code to generate new backup codes. Your old codes will be invalidated.'
              )}
            </p>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                aria-label={t('security.mfa.enterCode', 'Enter your 2FA code to confirm')}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                placeholder="000000"
                className="w-32 px-4 py-2 text-center text-lg font-mono tracking-widest border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-c-focus"
              />
              <button
                onClick={regenerateBackupCodes}
                disabled={loading || verificationCode.length !== 6}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {t('security.mfa.regenerate', 'Regenerate')}
              </button>
            </div>
            {error && (
              <p role="alert" aria-live="assertive" className="text-danger-500 text-sm mb-4">
                {error}
              </p>
            )}
            {backupCodes.length > 0 && (
              <div className="mt-6">
                <BackupCodesDisplay
                  codes={backupCodes}
                  onCopy={copyCode}
                  onCopyAll={copyAllCodes}
                  onDownload={downloadCodes}
                  copiedIndex={copiedIndex}
                />
              </div>
            )}
            <button
              onClick={() => {
                setStep('initial');
                setVerificationCode('');
                setError(null);
                setBackupCodes([]);
              }}
              className="mt-4 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300"
            >
              {t('common.back', 'Back')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Disable Confirmation
  if (disableConfirm) {
    return (
      <div
        data-testid="mfa-setup"
        className="max-w-md mx-auto bg-danger-50 dark:bg-danger-900/10 rounded-xl p-6 border border-danger-200 dark:border-danger-500/30 animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-danger-100 dark:bg-danger-500/20 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-danger-600 dark:text-danger-400" />
          </div>
          <h3 className="text-lg font-bold text-danger-700 dark:text-danger-400">
            {t('security.mfa.disableTitle', 'Disable Two-Factor Authentication?')}
          </h3>
        </div>
        <p className="text-sm text-danger-600/80 dark:text-danger-300 mb-6">
          {t(
            'security.mfa.disableConfirmText',
            'This will remove the extra security layer from your account. You will only need your password to sign in.'
          )}
        </p>
        <div className="mb-4">
          <label
            htmlFor="mfa-current-password"
            className="block text-sm font-medium text-danger-700 dark:text-danger-400 mb-2"
          >
            {t('security.mfa.currentPassword', 'Current password')}
          </label>
          <input
            id="mfa-current-password"
            type="password"
            autoComplete="current-password"
            className="w-full px-4 py-3 mb-4 border border-danger-200 dark:border-danger-500/30 rounded-lg bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-c-focus"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <label
            htmlFor="mfa-disable-token"
            className="block text-sm font-medium text-danger-700 dark:text-danger-400 mb-2"
          >
            {t('security.mfa.enterCode', 'Enter your 2FA code to confirm')}
          </label>
          <input
            id="mfa-disable-token"
            type="text"
            placeholder="000000"
            maxLength={6}
            className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest border border-danger-200 dark:border-danger-500/30 rounded-lg bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-c-focus"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
        {error && (
          <p role="alert" aria-live="assertive" className="text-danger-600 text-sm mb-4">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={disableMFA}
            disabled={loading || verificationCode.length !== 6 || !currentPassword}
            className="flex-1 py-3 bg-danger-600 hover:bg-danger-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldOff className="w-4 h-4" />
            )}
            {t('security.mfa.confirmDisable', 'Disable 2FA')}
          </button>
          <button
            onClick={() => {
              setDisableConfirm(false);
              setVerificationCode('');
              setCurrentPassword('');
              setError(null);
            }}
            className="px-6 py-3 bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    );
  }

  // Setup Flow
  return (
    <div
      data-testid="mfa-setup"
      className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      {/* Initial State - Enable 2FA */}
      {step === 'initial' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-crimson-500 to-primary-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Lock className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('security.mfa.title', 'Two-Factor Authentication (2FA)')}
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  {t('security.mfa.description', 'Add an extra layer of security to your account')}
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <BenefitCard
                icon={<Shield className="w-5 h-5" />}
                title={t('security.mfa.benefit1Title', 'Prevent Unauthorized Access')}
                description={t('security.mfa.benefit1Desc', 'Even if someone knows your password')}
              />
              <BenefitCard
                icon={<Smartphone className="w-5 h-5" />}
                title={t('security.mfa.benefit2Title', 'Works Offline')}
                description={t('security.mfa.benefit2Desc', 'No internet needed for codes')}
              />
              <BenefitCard
                icon={<Key className="w-5 h-5" />}
                title={t('security.mfa.benefit3Title', 'Backup Codes')}
                description={t(
                  'security.mfa.benefit3Desc',
                  'Access your account if you lose your phone'
                )}
              />
            </div>
            <button
              onClick={startSetup}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-crimson-600 to-primary-600 hover:from-crimson-500 hover:to-primary-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
              {t('security.mfa.enable', 'Enable Two-Factor Authentication')}
            </button>
            {error && <p className="text-danger-500 text-sm mt-4 text-center">{error}</p>}
          </div>
        </div>
      )}

      {/* Method Selection Step */}
      {step === 'method-select' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {t('security.mfa.chooseMethod', 'Choose Your MFA Method')}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {t(
              'security.mfa.chooseMethodDesc',
              'Select how you want to receive verification codes'
            )}
          </p>
          <div className="space-y-4">
            {mfaMethods
              .filter((m) => m.available)
              .map((method) => (
                <button
                  key={method.id}
                  onClick={() => handleMethodSelect(method.id)}
                  disabled={loading}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    selectedMethod === method.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                      : 'border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-500/50'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      method.recommended
                        ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
                        : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {method.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {method.name}
                      </span>
                      {method.recommended && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-full">
                          {t('security.mfa.recommended', 'Recommended')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {method.description}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-500" />
                </button>
              ))}
          </div>
          {error && <p className="text-danger-500 text-sm mt-4 text-center">{error}</p>}
          <button
            onClick={() => setStep('initial')}
            className="mt-6 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300"
          >
            {t('common.back', 'Back')}
          </button>
        </div>
      )}

      {/* SMS Setup Step */}
      {step === 'setup-sms' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <StepIndicator number={1} label={t('security.mfa.stepPhone', 'Phone')} active />
            <div className="w-12 h-0.5 bg-slate-200 dark:bg-white/10" />
            <StepIndicator number={2} label={t('security.mfa.step2', 'Verify')} />
            <div className="w-12 h-0.5 bg-slate-200 dark:bg-white/10" />
            <StepIndicator number={3} label={t('security.mfa.step3', 'Backup')} />
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('security.mfa.smsSetupTitle', 'Enter Your Phone Number')}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {t('security.mfa.smsSetupDesc', "We'll send a verification code to this number")}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('security.mfa.phoneNumber', 'Phone Number')}
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-4 py-3 border border-slate-200 dark:border-navy-700 rounded-xl bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-c-focus placeholder-slate-400"
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t(
                'security.mfa.phoneFormat',
                'Use international format (e.g., +1 for US, +44 for UK)'
              )}
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t(
                    'security.mfa.smsWarning',
                    'SMS is less secure than an authenticator app due to SIM swapping risks. We recommend using an authenticator app when possible.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={startSMSSetup}
            disabled={loading || !phoneNumber}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
            {t('security.mfa.sendCode', 'Send Verification Code')}
          </button>

          {error && <p className="text-danger-500 text-sm mt-4 text-center">{error}</p>}

          <button
            onClick={() => (smsAvailable ? setStep('method-select') : setStep('initial'))}
            className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300"
          >
            {t('common.back', 'Back')}
          </button>
        </div>
      )}

      {/* Verify SMS Code Step (for SMS method) */}
      {step === 'verify' && selectedMethod === 'sms' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <StepIndicator number={1} label={t('security.mfa.stepPhone', 'Phone')} completed />
            <div className="w-12 h-0.5 bg-emerald-500" />
            <StepIndicator number={2} label={t('security.mfa.step2', 'Verify')} active />
            <div className="w-12 h-0.5 bg-slate-200 dark:bg-white/10" />
            <StepIndicator number={3} label={t('security.mfa.step3', 'Backup')} />
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('security.mfa.enterSmsCode', 'Enter Verification Code')}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {t('security.mfa.smsCodeSent', 'We sent a 6-digit code to your phone')}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={6}
              placeholder="000000"
              className="w-40 px-4 py-3 text-center text-xl font-mono tracking-[0.5em] border border-slate-200 dark:border-navy-700 rounded-xl bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-c-focus"
              onKeyDown={(e) => e.key === 'Enter' && verifySMSAndEnable()}
            />
            <button
              onClick={verifySMSAndEnable}
              disabled={loading || verificationCode.length !== 6}
              className="px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {t('security.mfa.verify', 'Verify')}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={startSMSSetup}
              disabled={loading}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              {t('security.mfa.resendCode', 'Resend code')}
            </button>
          </div>

          {error && <p className="text-danger-500 text-sm mt-4">{error}</p>}

          <button
            onClick={() => setStep('setup-sms')}
            className="mt-6 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300"
          >
            {t('common.back', 'Back')}
          </button>
        </div>
      )}

      {/* Setup App Step */}
      {step === 'setup-app' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <StepIndicator number={1} label={t('security.mfa.step1', 'Scan')} active />
            <div className="w-12 h-0.5 bg-slate-200 dark:bg-white/10" />
            <StepIndicator number={2} label={t('security.mfa.step2', 'Verify')} />
            <div className="w-12 h-0.5 bg-slate-200 dark:bg-white/10" />
            <StepIndicator number={3} label={t('security.mfa.step3', 'Backup')} />
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {t('security.mfa.scanTitle', 'Scan QR Code')}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {t('security.mfa.scanDesc', 'Open your authenticator app and scan this QR code')}
          </p>

          <div className="flex flex-col md:flex-row gap-8">
            {/* QR Code */}
            <div className="flex-shrink-0">
              <div className="bg-white dark:bg-navy-900 p-4 rounded-xl border border-slate-200 dark:border-navy-700 inline-block">
                {qrCode ? (
                  <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <QrCode className="w-12 h-12 text-slate-600" />
                  </div>
                )}
              </div>
            </div>

            {/* Manual Entry & Verification */}
            <div className="flex-1 space-y-6">
              {/* Manual Entry */}
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('security.mfa.cantScan', "Can't scan? Enter this code manually:")}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-100 dark:bg-navy-950 px-4 py-2 rounded-lg text-sm font-mono select-all overflow-x-auto">
                    {showSecret ? secret : '•'.repeat(32)}
                  </code>
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-2 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(secret);
                      toast.success(t('common.copied', 'Copied!'));
                    }}
                    className="p-2 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Verification Code */}
              <div className="pt-4 border-t border-slate-200 dark:border-navy-700">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                  {t('security.mfa.verifyTitle', 'Enter Verification Code')}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  {t(
                    'security.mfa.verifyDesc',
                    'Enter the 6-digit code from your authenticator app'
                  )}
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="w-40 px-4 py-3 text-center text-xl font-mono tracking-[0.5em] border border-slate-200 dark:border-navy-700 rounded-xl bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-c-focus"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && verifyAndEnable()}
                  />
                  <button
                    onClick={verifyAndEnable}
                    disabled={loading || verificationCode.length !== 6}
                    className="px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {t('security.mfa.verify', 'Verify')}
                  </button>
                </div>
                {error && <p className="text-danger-500 text-sm mt-2">{error}</p>}
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep('initial')}
            className="mt-6 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300"
          >
            {t('common.cancel', 'Cancel Setup')}
          </button>
        </div>
      )}

      {/* Backup Codes Step */}
      {step === 'backup' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <StepIndicator number={1} label={t('security.mfa.step1', 'Scan')} completed />
            <div className="w-12 h-0.5 bg-emerald-500" />
            <StepIndicator number={2} label={t('security.mfa.step2', 'Verify')} completed />
            <div className="w-12 h-0.5 bg-emerald-500" />
            <StepIndicator number={3} label={t('security.mfa.step3', 'Backup')} active />
          </div>

          {/* Success Message */}
          <div className="flex items-center gap-3 mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="font-bold text-emerald-800 dark:text-emerald-400">
                {t('security.mfa.enabledSuccess', '2FA Enabled Successfully!')}
              </h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-300">
                {t('security.mfa.enabledSuccessDesc', 'Your account is now more secure')}
              </p>
            </div>
          </div>

          {/* Backup Codes Warning */}
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 mb-6">
            <div className="flex gap-3 mb-3">
              <AlertTriangle className="text-amber-500 shrink-0" />
              <div>
                <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">
                  {t('security.mfa.backupWarningTitle', 'Save your backup codes')}
                </h4>
                <p className="text-xs text-amber-700/80 dark:text-amber-300 mt-1">
                  {t(
                    'security.mfa.backupWarningDesc',
                    'If you lose access to your authenticator app, these codes are the ONLY way to access your account. Each code can be used only once.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <BackupCodesDisplay
            codes={backupCodes}
            onCopy={copyCode}
            onCopyAll={copyAllCodes}
            onDownload={downloadCodes}
            copiedIndex={copiedIndex}
          />

          <button
            onClick={handleComplete}
            className="w-full mt-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-navy-900 rounded-xl font-bold transition-colors hover:bg-slate-800 dark:hover:bg-slate-100 dark:hover:bg-navy-800/30"
          >
            {t('security.mfa.savedCodes', 'I have saved my backup codes')}
          </button>
        </div>
      )}
    </div>
  );
};

// Benefit Card Component
interface BenefitCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const BenefitCard: React.FC<BenefitCardProps> = ({ icon, title, description }) => (
  <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
      {icon}
    </div>
    <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-1">{title}</h4>
    <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
  </div>
);

// Step Indicator Component
interface StepIndicatorProps {
  number: number;
  label: string;
  active?: boolean;
  completed?: boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ number, label, active, completed }) => (
  <div className="flex flex-col items-center">
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        completed
          ? 'bg-emerald-500 text-white'
          : active
            ? 'bg-navy-900 text-white'
            : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'
      }`}
    >
      {completed ? <CheckCircle className="w-4 h-4" /> : number}
    </div>
    <span
      className={`text-xs mt-1 ${active || completed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-600'}`}
    >
      {label}
    </span>
  </div>
);

// Backup Codes Display Component
interface BackupCodesDisplayProps {
  codes: string[];
  onCopy: (code: string, index: number) => void;
  onCopyAll: () => void;
  onDownload: () => void;
  copiedIndex: number | null;
}

const BackupCodesDisplay: React.FC<BackupCodesDisplayProps> = ({
  codes,
  onCopy,
  onCopyAll,
  onDownload,
  copiedIndex,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-200 dark:border-navy-700 mb-4">
        {codes.map((code, i) => (
          <button
            key={i}
            onClick={() => onCopy(code, i)}
            className="flex items-center justify-between px-3 py-2 bg-white dark:bg-navy-900 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-white/5 transition-colors group"
          >
            <code className="font-mono text-slate-700 dark:text-slate-300 select-all">{code}</code>
            {copiedIndex === i ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <Copy className="w-4 h-4 text-slate-600 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCopyAll}
          className="flex-1 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {t('security.mfa.copyAll', 'Copy All')}
        </button>
        <button
          onClick={onDownload}
          className="flex-1 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          {t('security.mfa.download', 'Download')}
        </button>
      </div>
    </div>
  );
};

export default MFASetup;
