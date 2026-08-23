/**
 * SecurityOverviewSettings — Consolidated security dashboard
 *
 * Merges Password, 2FA, and Recovery into a single professional view
 * with a security score indicator and consistent SettingsSection styling.
 */

import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Key,
  LifeBuoy,
  Loader2,
  Lock,
  Mail,
  Phone,
  QrCode,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import {
  SettingsDivider,
  SettingsFormRow,
  SettingsInput,
  SettingsSection,
} from './shared/SettingsSection';

interface SecurityOverviewSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

type ActivePanel =
  | null
  | 'password'
  | 'mfa-setup'
  | 'recovery-email'
  | 'recovery-phone'
  | 'backup-codes';

// ---------------------------------------------------------------------------
// Security Score Ring
// ---------------------------------------------------------------------------
const SecurityScoreRing: React.FC<{ score: number; max: number }> = ({ score, max }) => {
  const { t } = useTranslation();
  const pct = Math.round((score / max) * 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color = pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-danger-400';
  const bgRing = 'text-white/[0.06]';
  const label =
    pct >= 80
      ? t('settings.security.scoreStrong', 'Strong')
      : pct >= 50
        ? t('settings.security.scoreGood', 'Good')
        : t('settings.security.scoreWeak', 'Weak');

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            strokeWidth="6"
            className={`stroke-current ${bgRing}`}
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className={`stroke-current ${color} transition-all duration-700`}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{score}</span>
          <span className="text-[10px] text-c-text-secondary">/ {max}</span>
        </div>
      </div>
      <span className={`text-xs font-semibold ${color}`}>{label}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Status Card (compact)
// ---------------------------------------------------------------------------
interface StatusCardProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  status: string;
  statusColor: string;
  action?: string;
  onAction?: () => void;
}

const StatusCard: React.FC<StatusCardProps> = ({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  status,
  statusColor,
  action,
  onAction,
}) => (
  <button
    type="button"
    onClick={onAction}
    className={cn(
      'flex items-center gap-3 w-full rounded-xl p-3.5',
      'bg-c-surface/[0.03] border border-white/[0.06]',
      'hover:bg-c-surface/[0.06] hover:border-white/[0.10] transition-all duration-200',
      'text-left group'
    )}
  >
    <div className={cn('p-2 rounded-lg flex-shrink-0', iconBg)}>
      <Icon size={18} className={iconColor} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-c-text-muted">{title}</p>
      <p className={cn('text-xs mt-0.5', statusColor)}>{status}</p>
    </div>
    {action && (
      <div className="flex items-center gap-1 text-xs text-c-text-muted group-hover:text-c-accent transition-colors flex-shrink-0">
        <span className="hidden sm:inline">{action}</span>
        <ChevronRight size={14} />
      </div>
    )}
  </button>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const SecurityOverviewSettings: React.FC<SecurityOverviewSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(currentUser?.mfaEnabled || false);
  const [mfaStep, setMfaStep] = useState<'idle' | 'scan' | 'verify' | 'backup'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [disableConfirm, setDisableConfirm] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState<number | null>(null);

  // Recovery state
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryBackupCount, setRecoveryBackupCount] = useState(0);
  const [recoveryLoading, setRecoveryLoading] = useState(true);

  // Panel state
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Fetch MFA status
  useEffect(() => {
    (async () => {
      try {
        const res = await Api.get('/api/mfa/status');
        if (res) {
          setMfaEnabled(res.isEnabled ?? currentUser?.mfaEnabled ?? false);
          setBackupCodesRemaining(res.backupCodesRemaining ?? null);
        }
      } catch {
        setMfaEnabled(currentUser?.mfaEnabled || false);
      }
    })();
  }, [currentUser?.mfaEnabled]);

  // Fetch recovery options
  useEffect(() => {
    (async () => {
      setRecoveryLoading(true);
      try {
        const data = await Api.get('/settings/recovery');
        if (data) {
          setRecoveryEmail(data.recoveryEmail || '');
          setRecoveryPhone(data.recoveryPhone || '');
          setRecoveryBackupCount(data.backupCodesCount || 0);
        } else {
          setRecoveryEmail(currentUser?.email || '');
        }
      } catch {
        setRecoveryEmail(currentUser?.email || '');
      } finally {
        setRecoveryLoading(false);
      }
    })();
  }, [currentUser?.email]);

  // ---------------------------------------------------------------------------
  // Security score calculation
  // ---------------------------------------------------------------------------
  const securityChecks = useMemo(() => {
    const checks = [
      {
        id: 'mfa',
        label: t('settings.security.check2fa', 'Two-factor authentication'),
        met: mfaEnabled,
      },
      {
        id: 'email',
        label: t('settings.security.checkEmail', 'Recovery email configured'),
        met: !!recoveryEmail,
      },
      {
        id: 'phone',
        label: t('settings.security.checkPhone', 'Recovery phone configured'),
        met: !!recoveryPhone,
      },
      {
        id: 'backup',
        label: t('settings.security.checkBackup', 'Backup codes generated'),
        met: recoveryBackupCount > 0,
      },
    ];
    return checks;
  }, [mfaEnabled, recoveryEmail, recoveryPhone, recoveryBackupCount, t]);

  const score = securityChecks.filter((c) => c.met).length;

  // ---------------------------------------------------------------------------
  // Password handlers
  // ---------------------------------------------------------------------------
  const passwordRequirements = useMemo(
    () => [
      {
        met: newPassword.length >= 8,
        text: t('settings.password.req.length', 'At least 8 characters'),
      },
      {
        met: /[A-Z]/.test(newPassword),
        text: t('settings.password.req.uppercase', 'One uppercase letter'),
      },
      {
        met: /[a-z]/.test(newPassword),
        text: t('settings.password.req.lowercase', 'One lowercase letter'),
      },
      { met: /[0-9]/.test(newPassword), text: t('settings.password.req.number', 'One number') },
      {
        met: /[^A-Za-z0-9]/.test(newPassword),
        text: t('settings.password.req.special', 'One special character'),
      },
    ],
    [newPassword, t]
  );

  const allReqsMet = passwordRequirements.every((r) => r.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!allReqsMet || !passwordsMatch) return;
      setPasswordLoading(true);
      try {
        await Api.changePassword(currentPassword, newPassword);
        toast.success(t('settings.password.success', 'Password changed successfully'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setActivePanel(null);
      } catch {
        toast.error(t('settings.password.error', 'Failed to change password'));
      } finally {
        setPasswordLoading(false);
      }
    },
    [allReqsMet, passwordsMatch, currentPassword, newPassword, t]
  );

  // ---------------------------------------------------------------------------
  // MFA handlers
  // ---------------------------------------------------------------------------
  const startMfaSetup = useCallback(async () => {
    setMfaLoading(true);
    setMfaError(null);
    try {
      const res = await Api.post('/api/mfa/setup', {});
      setQrCode(res.qrCode || res.data?.qrCode);
      setSecret(res.manualEntry || res.data?.manualEntry);
      setMfaStep('scan');
      setActivePanel('mfa-setup');
    } catch (err: any) {
      setMfaError(
        err.response?.data?.error ||
          err.message ||
          t('security.mfa.setupError', 'Failed to start MFA setup')
      );
    } finally {
      setMfaLoading(false);
    }
  }, [t]);

  const verifyMfa = useCallback(async () => {
    if (verificationCode.length !== 6) {
      setMfaError(t('security.mfa.codeLength', 'Please enter a 6-digit code'));
      return;
    }
    setMfaLoading(true);
    setMfaError(null);
    try {
      const res = await Api.post('/api/mfa/verify-setup', { token: verificationCode });
      if (res.success || res.data?.success) {
        setBackupCodes(res.backupCodes || res.data?.backupCodes || []);
        setMfaStep('backup');
        toast.success(t('security.mfa.enabled', '2FA enabled successfully!'));
      }
    } catch (err: any) {
      setMfaError(
        err.response?.data?.error ||
          err.message ||
          t('security.mfa.invalidCode', 'Invalid verification code')
      );
    } finally {
      setMfaLoading(false);
    }
  }, [verificationCode, t]);

  const disableMfa = useCallback(async () => {
    if (verificationCode.length !== 6) {
      setMfaError(t('security.mfa.codeRequired', 'Please enter your 2FA code'));
      return;
    }
    setMfaLoading(true);
    setMfaError(null);
    try {
      const res = await Api.post('/api/mfa/disable', { token: verificationCode });
      if (res.success || res.data?.success) {
        setMfaEnabled(false);
        setDisableConfirm(false);
        setVerificationCode('');
        setActivePanel(null);
        toast.success(t('security.mfa.disabled', '2FA has been disabled'));
        onUpdateUser({});
      }
    } catch (err: any) {
      setMfaError(err.response?.data?.error || t('security.mfa.invalidCode', 'Invalid code'));
    } finally {
      setMfaLoading(false);
    }
  }, [verificationCode, t, onUpdateUser]);

  const completeMfaSetup = useCallback(() => {
    setMfaEnabled(true);
    setMfaStep('idle');
    setActivePanel(null);
    setVerificationCode('');
    setBackupCodes([]);
    onUpdateUser({});
  }, [onUpdateUser]);

  const copyCode = useCallback(
    (code: string, index: number) => {
      navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast.success(t('common.copied', 'Copied to clipboard'));
    },
    [t]
  );

  const copyAllCodes = useCallback(() => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success(t('security.mfa.allCodesCopied', 'All backup codes copied'));
  }, [backupCodes, t]);

  const downloadCodes = useCallback(() => {
    const content = `Consultify Backup Codes\nGenerated: ${new Date().toLocaleDateString()}\n\n${backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nKeep these codes safe. Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'consultify-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [backupCodes]);

  // ---------------------------------------------------------------------------
  // Recovery helpers
  // ---------------------------------------------------------------------------
  const maskEmail = (email: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.substring(0, 2)}***@${domain}`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ── Security Score + Status Cards ── */}
      <div className="bg-c-surface-raised rounded-xl border border-c-border-subtle overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-6">
            <SecurityScoreRing score={score} max={securityChecks.length} />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-c-text">
                {t('settings.security.overviewTitle', 'Security Overview')}
              </h3>
              <p className="text-sm text-c-text-secondary mt-1">
                {t('settings.security.overviewDesc', 'Review and strengthen your account security')}
              </p>
              <div className="mt-4 space-y-1.5">
                {securityChecks.map((check) => (
                  <div key={check.id} className="flex items-center gap-2 text-sm">
                    {check.met ? (
                      <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <X size={14} className="text-c-text-muted flex-shrink-0" />
                    )}
                    <span className={check.met ? 'text-c-text-secondary' : 'text-c-text-muted'}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Password Section ── */}
      <SettingsSection
        icon={Key}
        title={t('settings.password.title', 'Password')}
        description={t(
          'settings.password.description',
          'Update your password to keep your account secure'
        )}
        cardId="security-password"
      >
        {activePanel === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            <SettingsFormRow
              label={t('settings.password.current', 'Current Password')}
              htmlFor="sec-current-pw"
            >
              <div className="relative">
                <SettingsInput
                  id="sec-current-pw"
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
            </SettingsFormRow>

            <SettingsFormRow
              label={t('settings.password.new', 'New Password')}
              htmlFor="sec-new-pw"
            >
              <div className="relative">
                <SettingsInput
                  id="sec-new-pw"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-c-text-muted hover:text-c-text-muted transition-colors"
                >
                  {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </SettingsFormRow>

            {newPassword && (
              <div className="space-y-1 pl-1">
                {passwordRequirements.map((req, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 text-xs',
                      req.met ? 'text-emerald-400' : 'text-c-text-muted'
                    )}
                  >
                    {req.met ? <Check size={12} /> : <X size={12} />}
                    {req.text}
                  </div>
                ))}
              </div>
            )}

            <SettingsFormRow
              label={t('settings.password.confirm', 'Confirm New Password')}
              htmlFor="sec-confirm-pw"
            >
              <SettingsInput
                id="sec-confirm-pw"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={
                  confirmPassword && !passwordsMatch
                    ? t('settings.password.mismatch', 'Passwords do not match')
                    : undefined
                }
              />
            </SettingsFormRow>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={!allReqsMet || !passwordsMatch || passwordLoading}
                className="px-4 py-2 bg-c-text hover:bg-c-text text-c-surface text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {passwordLoading && <Loader2 size={14} className="animate-spin" />}
                {t('settings.password.update', 'Update Password')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePanel(null);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="px-4 py-2 text-sm text-c-text-secondary hover:text-c-text transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </form>
        ) : (
          <StatusCard
            icon={Key}
            iconColor="text-c-accent"
            iconBg="bg-c-accent-soft"
            title={t('settings.password.title', 'Password')}
            status={t('settings.security.passwordSet', 'Password is set')}
            statusColor="text-c-text-secondary"
            action={t('common.change', 'Change')}
            onAction={() => setActivePanel('password')}
          />
        )}
      </SettingsSection>

      {/* ── Two-Factor Authentication Section ── */}
      <SettingsSection
        icon={Shield}
        title={t('security.mfa.title', 'Two-Factor Authentication')}
        description={t(
          'security.mfa.description',
          'Add an extra layer of security to your account'
        )}
        cardId="security-mfa"
      >
        {/* MFA Enabled — management view */}
        {mfaEnabled && activePanel !== 'mfa-setup' && !disableConfirm && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20">
              <div className="p-2 rounded-lg bg-emerald-500/15">
                <ShieldCheck size={18} className="text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-300">
                  {t('security.mfa.activeTitle', 'Two-Factor Authentication Active')}
                </p>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  {t('security.mfa.authenticatorApp', 'Authenticator App')}
                  {backupCodesRemaining != null &&
                    ` · ${backupCodesRemaining} ${t('security.mfa.remaining', 'backup codes remaining')}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDisableConfirm(true)}
              className="text-xs text-c-text-muted hover:text-danger-400 transition-colors"
            >
              {t('security.mfa.disable', 'Disable 2FA')}
            </button>
          </div>
        )}

        {/* MFA Disable confirmation */}
        {disableConfirm && (
          <div className="space-y-4 max-w-md">
            <div className="p-4 rounded-xl bg-danger-500/[0.08] border border-danger-500/20">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-danger-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-danger-300">
                    {t('security.mfa.disableTitle', 'Disable Two-Factor Authentication?')}
                  </p>
                  <p className="text-xs text-danger-400/70 mt-1">
                    {t(
                      'security.mfa.disableConfirmText',
                      'This will remove the extra security layer from your account.'
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                placeholder="000000"
                className="w-32 px-3 py-2 text-center text-lg font-mono tracking-widest bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-danger-500 focus:border-transparent"
              />
              <button
                onClick={disableMfa}
                disabled={mfaLoading || verificationCode.length !== 6}
                className="px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {mfaLoading && <Loader2 size={14} className="animate-spin" />}
                {t('security.mfa.confirmDisable', 'Disable')}
              </button>
              <button
                onClick={() => {
                  setDisableConfirm(false);
                  setVerificationCode('');
                  setMfaError(null);
                }}
                className="px-4 py-2 text-sm text-c-text-secondary hover:text-c-text transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
            {mfaError && <p className="text-xs text-danger-400">{mfaError}</p>}
          </div>
        )}

        {/* MFA Not enabled — enable CTA */}
        {!mfaEnabled && mfaStep === 'idle' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: Shield,
                  title: t('security.mfa.benefit1Title', 'Prevent Unauthorized Access'),
                  desc: t('security.mfa.benefit1Desc', 'Even if someone knows your password'),
                },
                {
                  icon: Smartphone,
                  title: t('security.mfa.benefit2Title', 'Works Offline'),
                  desc: t('security.mfa.benefit2Desc', 'No internet needed for codes'),
                },
                {
                  icon: Key,
                  title: t('security.mfa.benefit3Title', 'Backup Codes'),
                  desc: t(
                    'security.mfa.benefit3Desc',
                    'Access your account if you lose your phone'
                  ),
                },
              ].map((b) => (
                <div
                  key={b.title}
                  className="p-3 rounded-xl bg-c-surface/[0.03] border border-white/[0.06]"
                >
                  <div className="p-1.5 rounded-lg bg-c-accent-soft w-fit mb-2">
                    <b.icon size={16} className="text-c-accent" />
                  </div>
                  <p className="text-sm font-medium text-c-text-muted">{b.title}</p>
                  <p className="text-xs text-c-text-muted mt-0.5">{b.desc}</p>
                </div>
              ))}
            </div>
            <button
              onClick={startMfaSetup}
              disabled={mfaLoading}
              className="w-full py-3 bg-c-text hover:bg-c-text text-c-surface text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mfaLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              {t('security.mfa.enable', 'Enable Two-Factor Authentication')}
            </button>
            {mfaError && <p className="text-xs text-danger-400 text-center mt-2">{mfaError}</p>}
          </div>
        )}

        {/* MFA Setup — Scan QR */}
        {mfaStep === 'scan' && (
          <div className="space-y-5 max-w-lg">
            <StepProgress current={1} />
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-shrink-0 bg-c-surface rounded-xl p-3 w-fit self-center sm:self-start">
                {qrCode ? (
                  <img src={qrCode} alt="MFA QR Code" className="w-40 h-40" />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center">
                    <QrCode className="w-10 h-10 text-c-text-secondary" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs font-medium text-c-text-secondary mb-1.5">
                    {t('security.mfa.cantScan', "Can't scan? Enter this code manually:")}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-c-surface-raised px-3 py-2 rounded-lg text-xs font-mono text-c-text-secondary select-all overflow-x-auto border border-c-border-subtle">
                      {showSecret ? secret : '•'.repeat(32)}
                    </code>
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="p-1.5 text-c-text-muted hover:text-c-text-muted"
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(secret);
                        toast.success(t('common.copied', 'Copied!'));
                      }}
                      className="p-1.5 text-c-text-muted hover:text-c-text-muted"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <SettingsDivider />
                <div>
                  <p className="text-xs font-medium text-c-text-secondary mb-2">
                    {t('security.mfa.verifyTitle', 'Enter Verification Code')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                      maxLength={6}
                      placeholder="000000"
                      className="w-32 px-3 py-2 text-center text-lg font-mono tracking-widest bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent"
                      onKeyDown={(e) => e.key === 'Enter' && verifyMfa()}
                    />
                    <button
                      onClick={verifyMfa}
                      disabled={mfaLoading || verificationCode.length !== 6}
                      className="px-4 py-2 bg-c-text hover:bg-c-text text-c-surface text-sm font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {mfaLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                      {t('security.mfa.verify', 'Verify')}
                    </button>
                  </div>
                  {mfaError && <p className="text-xs text-danger-400 mt-2">{mfaError}</p>}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setMfaStep('idle');
                setActivePanel(null);
                setVerificationCode('');
                setMfaError(null);
              }}
              className="text-xs text-c-text-muted hover:text-c-text-muted transition-colors"
            >
              {t('common.cancel', 'Cancel Setup')}
            </button>
          </div>
        )}

        {/* MFA Setup — Backup Codes */}
        {mfaStep === 'backup' && (
          <div className="space-y-4 max-w-lg">
            <StepProgress current={3} />
            <div className="p-3.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 flex items-center gap-3">
              <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-300">
                {t('security.mfa.enabledSuccess', '2FA Enabled Successfully!')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">
                  {t('security.mfa.backupWarningTitle', 'Save your backup codes')}
                </p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  {t(
                    'security.mfa.backupWarningDesc',
                    'If you lose access to your authenticator app, these codes are the ONLY way to access your account.'
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-c-surface-raised p-3 rounded-xl border border-c-border-subtle">
              {backupCodes.map((code, i) => (
                <button
                  key={i}
                  onClick={() => copyCode(code, i)}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-c-surface-raised rounded-lg hover:bg-c-surface transition-colors group text-left"
                >
                  <code className="font-mono text-xs text-c-text-secondary">{code}</code>
                  {copiedIndex === i ? (
                    <CheckCircle size={12} className="text-emerald-400" />
                  ) : (
                    <Copy
                      size={12}
                      className="text-c-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyAllCodes}
                className="flex-1 py-2 text-xs font-medium text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Copy size={12} /> {t('security.mfa.copyAll', 'Copy All')}
              </button>
              <button
                onClick={downloadCodes}
                className="flex-1 py-2 text-xs font-medium text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Download size={12} /> {t('security.mfa.download', 'Download')}
              </button>
            </div>

            <button
              onClick={completeMfaSetup}
              className="w-full py-3 bg-c-surface-raised hover:bg-c-surface text-c-text text-sm font-semibold rounded-xl transition-colors border border-c-border-subtle"
            >
              {t('security.mfa.savedCodes', 'I have saved my backup codes')}
            </button>
          </div>
        )}
      </SettingsSection>

      {/* ── Recovery Options Section ── */}
      <SettingsSection
        icon={LifeBuoy}
        title={t('settings.recovery.title', 'Recovery Options')}
        description={t(
          'settings.recovery.description',
          'Set up account recovery methods in case you lose access'
        )}
        cardId="security-recovery"
      >
        <div className="space-y-3">
          {/* Recovery Email */}
          <StatusCard
            icon={Mail}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
            title={t('settings.recovery.email', 'Recovery Email')}
            status={
              recoveryEmail
                ? maskEmail(recoveryEmail)
                : t('settings.recovery.notSet', 'Not configured')
            }
            statusColor={recoveryEmail ? 'text-c-text-secondary' : 'text-amber-400'}
            action={recoveryEmail ? t('common.change', 'Change') : t('common.add', 'Add')}
            onAction={() => setActivePanel('recovery-email')}
          />

          {/* Recovery Phone */}
          <StatusCard
            icon={Phone}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
            title={t('settings.recovery.phone', 'Recovery Phone')}
            status={recoveryPhone || t('settings.recovery.notSet', 'Not configured')}
            statusColor={recoveryPhone ? 'text-c-text-secondary' : 'text-amber-400'}
            action={recoveryPhone ? t('common.change', 'Change') : t('common.add', 'Add')}
            onAction={() => setActivePanel('recovery-phone')}
          />

          {/* Backup Codes */}
          <StatusCard
            icon={Key}
            iconColor="text-c-accent"
            iconBg="bg-c-accent-soft"
            title={t('settings.recovery.backupCodes', 'Backup Codes')}
            status={
              recoveryBackupCount > 0
                ? t('settings.recovery.codesRemaining', '{{count}} codes remaining', {
                    count: recoveryBackupCount,
                  })
                : t('settings.recovery.noCodes', 'No backup codes generated')
            }
            statusColor={recoveryBackupCount > 0 ? 'text-c-text-secondary' : 'text-amber-400'}
            action={
              recoveryBackupCount > 0
                ? t('settings.recovery.regenerate', 'Regenerate')
                : t('settings.recovery.generate', 'Generate')
            }
            onAction={() => setActivePanel('backup-codes')}
          />
        </div>
      </SettingsSection>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step Progress (MFA setup)
// ---------------------------------------------------------------------------
const StepProgress: React.FC<{ current: 1 | 2 | 3 }> = ({ current }) => {
  const { t } = useTranslation();
  const steps = [
    t('security.mfa.step1', 'Scan'),
    t('security.mfa.step2', 'Verify'),
    t('security.mfa.step3', 'Backup'),
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const num = i + 1;
        const isCompleted = num < current;
        const isActive = num === current;
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <div
                className={cn(
                  'w-8 h-0.5 rounded-full',
                  isCompleted ? 'bg-emerald-500' : 'bg-c-surface/[0.06]'
                )}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-c-text text-c-surface'
                      : 'bg-c-surface/[0.06] text-c-text-muted'
                )}
              >
                {isCompleted ? <Check size={10} /> : num}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-1',
                  isActive || isCompleted ? 'text-c-text-secondary' : 'text-c-text-muted'
                )}
              >
                {label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SecurityOverviewSettings;
