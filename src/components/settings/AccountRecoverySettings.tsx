/**
 * AccountRecoverySettings - Account recovery options
 *
 * Features:
 * - Backup email
 * - Phone number verification
 * - Recovery codes
 * - Trusted devices
 */

import { Check, Copy, Key, Mail, Phone, Shield, Smartphone, Trash2 } from 'lucide-react';
import React from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { StatusChip } from '@/components/ui/primitives';

import { User } from '../../types';
import { ReadOnlyState } from '../Admin/AdminState';

const recoveryUnavailableReason =
  'Recovery email, phone, backup codes, and trusted device changes are read-only until the recovery backend is connected.';

const trustedDevices: TrustedDevice[] = [
  {
    id: '1',
    name: 'Chrome on MacOS',
    browser: 'Chrome 120',
    last_used: '2 hours ago',
    is_current: true,
  },
  {
    id: '2',
    name: 'Safari on iPhone',
    browser: 'Safari 17',
    last_used: '1 day ago',
    is_current: false,
  },
];

interface TrustedDevice {
  id: string;
  name: string;
  browser: string;
  last_used: string;
  is_current: boolean;
}

interface AccountRecoverySettingsProps {
  currentUser: User;
}

export const AccountRecoverySettings: React.FC<AccountRecoverySettingsProps> = ({
  currentUser: _currentUser,
}) => {
  const { t } = useTranslation();

  const showUnavailableNotice = () => {
    toast.error(t('settings.recovery.unavailable', recoveryUnavailableReason));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-500" />
          {t('settings.recovery.title', 'Account Recovery')}
        </h3>
        <p className="text-sm text-c-text-muted mt-1">
          {t(
            'settings.recovery.description',
            'Set up backup options to recover your account if you lose access'
          )}
        </p>
      </div>

      <ReadOnlyState
        title={t('settings.recovery.readOnlyTitle', 'Recovery options unavailable')}
        description={t('settings.recovery.readOnlyDescription', recoveryUnavailableReason)}
      />

      {/* Backup Email */}
      <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-c-text">
              {t('settings.recovery.backupEmail', 'Backup Email')}
            </h4>
            <p className="text-sm text-c-text-muted">
              {t(
                'settings.recovery.backupEmailDesc',
                'Use to recover your account if you lose access'
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="email"
            value=""
            disabled
            placeholder={t('settings.recovery.enterBackupEmail', 'Enter backup email address')}
            className="flex-1 px-4 py-2.5 rounded-lg border border-c-border-subtle dark:border-navy-700 bg-c-surface-raised text-c-text-muted placeholder-c-text-muted disabled:cursor-not-allowed"
          />
          <button
            onClick={showUnavailableNotice}
            disabled
            title={t('settings.recovery.unavailable', recoveryUnavailableReason)}
            className="px-4 py-2.5 bg-c-accent hover:bg-c-accent text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {t('common.verify', 'Verify')}
          </button>
        </div>
      </div>

      {/* Phone Number */}
      <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
            <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-c-text">
              {t('settings.recovery.phone', 'Phone Number')}
            </h4>
            <p className="text-sm text-c-text-muted">
              {t('settings.recovery.phoneDesc', 'Receive SMS codes for account recovery')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="tel"
            value=""
            disabled
            placeholder={t('settings.recovery.enterPhone', '+1 (555) 123-4567')}
            className="flex-1 px-4 py-2.5 rounded-lg border border-c-border-subtle dark:border-navy-700 bg-c-surface-raised text-c-text-muted placeholder-c-text-muted disabled:cursor-not-allowed"
          />
          <button
            onClick={showUnavailableNotice}
            disabled
            title={t('settings.recovery.unavailable', recoveryUnavailableReason)}
            className="px-4 py-2.5 bg-c-accent hover:bg-c-accent text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {t('common.verify', 'Verify')}
          </button>
        </div>
      </div>

      {/* Recovery Codes */}
      <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h4 className="font-medium text-c-text">
                {t('settings.recovery.recoveryCodes', 'Recovery Codes')}
              </h4>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.recovery.recoveryCodesDesc',
                  'One-time use codes for emergency access'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={showUnavailableNotice}
            disabled
            title={t('settings.recovery.unavailable', recoveryUnavailableReason)}
            className="px-4 py-2 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg font-medium hover:bg-amber-200 dark:hover:bg-amber-500/30 disabled:opacity-50 flex items-center gap-2"
          >
            <Key className="w-4 h-4" />
            {t('settings.recovery.generateCodes', 'Generate New Codes')}
          </button>
        </div>

        <div className="mt-4 p-4 bg-c-surface-raised rounded-lg">
          <div className="flex items-center gap-2 text-sm text-c-text-muted">
            <Copy className="w-4 h-4" />
            {t(
              'settings.recovery.codesUnavailable',
              'Recovery codes are not generated in the browser. Connect the recovery backend before enabling this action.'
            )}
          </div>
        </div>
      </div>

      {/* Trusted Devices */}
      <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-c-accent-soft dark:bg-c-accent-soft flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-c-accent" />
          </div>
          <div>
            <h4 className="font-medium text-c-text">
              {t('settings.recovery.trustedDevices', 'Trusted Devices')}
            </h4>
            <p className="text-sm text-c-text-muted">
              {t(
                'settings.recovery.trustedDevicesDesc',
                'Devices that can access your account without additional verification'
              )}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {trustedDevices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-c-text-secondary" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-c-text">{device.name}</p>
                    {device.is_current && (
                      <StatusChip
                        tone="success"
                        label={t('settings.recovery.current', 'This device')}
                      />
                    )}
                  </div>
                  <p className="text-sm text-c-text-muted">
                    {device.browser} • {device.last_used}
                  </p>
                </div>
              </div>
              {!device.is_current && (
                <button
                  disabled
                  title={t('settings.recovery.unavailable', recoveryUnavailableReason)}
                  className="p-2 text-c-text-secondary rounded-lg disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AccountRecoverySettings;
