/**
 * PasswordSettings - Password change functionality
 */

import { Check, Eye, EyeOff, Key, X } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface PasswordSettingsProps {
  className?: string;
}

export const PasswordSettings: React.FC<PasswordSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);

  const requirements = [
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
  ];

  const allRequirementsMet = requirements.every((r) => r.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequirementsMet || !passwordsMatch) return;

    setLoading(true);
    try {
      await Api.changePassword(currentPassword, newPassword);
      toast.success(t('settings.password.success', 'Password changed successfully'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (_error) {
      toast.error(t('settings.password.error', 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
          <Key size={20} />
          {t('settings.password.title', 'Change Password')}
        </h3>
        <p className="text-sm text-c-text-muted mt-1">
          {t('settings.password.description', 'Update your password to keep your account secure')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label
            htmlFor="current-password"
            className="block text-sm font-medium text-c-text-secondary mb-1"
          >
            {t('settings.password.current', 'Current Password')}
          </label>
          <div className="relative">
            <input
              id="current-password"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-600 rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="new-password"
            className="block text-sm font-medium text-c-text-secondary mb-1"
          >
            {t('settings.password.new', 'New Password')}
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-600 rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-c-text-secondary hover:text-c-text-secondary"
            >
              {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {newPassword && (
          <div className="space-y-1">
            {requirements.map((req, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm ${req.met ? 'text-green-600' : 'text-c-text-secondary'}`}
              >
                {req.met ? <Check size={14} /> : <X size={14} />}
                {req.text}
              </div>
            ))}
          </div>
        )}

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-c-text-secondary mb-1"
          >
            {t('settings.password.confirm', 'Confirm New Password')}
          </label>
          <input
            id="confirm-password"
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-600 rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent"
          />
          {confirmPassword && !passwordsMatch && (
            <p className="text-sm text-rose-500 mt-1">
              {t('settings.password.mismatch', 'Passwords do not match')}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!allRequirementsMet || !passwordsMatch || loading}
          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? t('common.saving', 'Saving...')
            : t('settings.password.update', 'Update Password')}
        </button>
      </form>
    </div>
  );
};

export default PasswordSettings;
