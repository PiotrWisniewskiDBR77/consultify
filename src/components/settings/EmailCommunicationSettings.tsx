import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  FileSignature,
  Info,
  Loader2,
  Mail,
  Plus,
  Save,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { EmailPreferences, OutOfOfficeSettings, User } from '../../types';

interface EmailCommunicationSettingsProps {
  currentUser: User;
  onUpdate?: () => void;
}

const DIGEST_OPTIONS = [
  { value: 'realtime', label: 'Real-time', description: 'Get notified immediately' },
  { value: 'daily', label: 'Daily Digest', description: 'Once a day summary' },
  { value: 'weekly', label: 'Weekly Digest', description: 'Weekly summary on Mondays' },
  { value: 'never', label: 'Never', description: 'No email notifications' },
];

export const EmailCommunicationSettings: React.FC<EmailCommunicationSettingsProps> = ({
  currentUser,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>({
    signature: '',
    signatureHtml: '',
    aliases: [],
    forwarding: [],
    outOfOffice: {
      enabled: false,
      message: '',
      start: '',
      end: '',
      autoReply: false,
    },
    digestFrequency: 'daily',
  });

  const [newAlias, setNewAlias] = useState('');

  // Load data on mount
  useEffect(() => {
    loadEmailPreferences();
  }, [currentUser.id]);

  const loadEmailPreferences = async () => {
    try {
      const response = await Api.get('/profile/email-preferences');
      if (response.emailPreferences) {
        setEmailPrefs({
          signature: response.emailPreferences.signature || '',
          signatureHtml: response.emailPreferences.signatureHtml || '',
          aliases: response.emailPreferences.aliases || [],
          forwarding: response.emailPreferences.forwarding || [],
          outOfOffice: response.emailPreferences.outOfOffice || {
            enabled: false,
            message: '',
            start: '',
            end: '',
            autoReply: false,
          },
          digestFrequency: response.emailPreferences.digestFrequency || 'daily',
        });
      }
    } catch (error) {
      console.error('Failed to load email preferences:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Api.put('/profile/email-preferences', emailPrefs);

      // Also update out of office if changed
      if (emailPrefs.outOfOffice) {
        await Api.put('/profile/out-of-office', emailPrefs.outOfOffice);
      }

      setSaveStatus('success');
      onUpdate?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save email preferences:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const addAlias = () => {
    if (newAlias && !emailPrefs.aliases?.includes(newAlias)) {
      setEmailPrefs((prev: any) => ({
        ...prev,
        aliases: [...(prev.aliases || []), newAlias],
      }));
      setNewAlias('');
    }
  };

  const removeAlias = (alias: string) => {
    setEmailPrefs((prev: any) => ({
      ...prev,
      aliases: prev.aliases?.filter((a: any) => a !== alias) || [],
    }));
  };

  // Styling classes
  const inputClass =
    'w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-md text-navy-900 focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none transition-all';
  const labelClass = 'text-xs font-medium text-c-text-muted';
  const cardClass =
    'bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg p-6';
  const sectionTitleClass =
    'text-sm font-bold text-navy-900 mb-4 uppercase tracking-wider flex items-center gap-2';
  const toggleClass = (enabled: boolean) =>
    `relative w-12 h-6 rounded-full transition-colors ${
      enabled ? 'bg-navy-900' : 'bg-c-surface-raised'
    }`;
  const toggleKnobClass = (enabled: boolean) =>
    `absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${enabled ? 'left-7' : 'left-1'}`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-navy-900">
            {t('settings.profile.email.title', 'Email & Communication')}
          </h3>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.profile.email.description',
              'Manage your email signature, aliases, and notification preferences'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-c-accent"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </button>
      </div>

      {/* Email Signature */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <FileSignature size={16} className="text-c-accent" />
          {t('settings.profile.email.signature', 'Email Signature')}
        </h4>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              {t('settings.profile.email.signatureText', 'Signature Text')}
            </label>
            <textarea
              value={emailPrefs.signature}
              onChange={(e) =>
                setEmailPrefs((prev: any) => ({ ...prev, signature: e.target.value }))
              }
              placeholder={t(
                'settings.profile.email.signaturePlaceholder',
                'Best regards,\nYour Name\nTitle | Company'
              )}
              rows={4}
              className={inputClass + ' resize-none mt-1.5'}
            />
            <p className="text-xs text-c-text-secondary mt-1">
              {t(
                'settings.profile.email.signatureHint',
                'This signature will be added to your outgoing emails'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Email Aliases */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Mail size={16} className="text-c-accent" />
          {t('settings.profile.email.aliases', 'Email Aliases')}
        </h4>

        {/* Primary email */}
        <div className="mb-4 p-3 bg-c-surface-raised rounded-lg">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-c-text-secondary" />
            <span className="text-sm text-navy-900">{currentUser.email}</span>
            <span className="ml-auto text-xs bg-c-accent-soft dark:bg-c-accent-soft text-c-accent px-2 py-0.5 rounded-full">
              Primary
            </span>
          </div>
        </div>

        {/* Alias list */}
        {emailPrefs.aliases && emailPrefs.aliases.length > 0 && (
          <div className="space-y-2 mb-4">
            {emailPrefs.aliases.map((alias: any) => (
              <div
                key={alias}
                className="flex items-center gap-2 p-3 bg-c-surface-raised rounded-lg"
              >
                <Mail size={14} className="text-c-text-secondary" />
                <span className="text-sm text-navy-900 flex-1">{alias}</span>
                <button
                  onClick={() => removeAlias(alias)}
                  className="text-c-text-secondary hover:text-danger-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add alias */}
        <div className="flex gap-2">
          <input
            type="email"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder={t('settings.profile.email.addAlias', 'Add email alias...')}
            className={inputClass}
          />
          <button
            onClick={addAlias}
            disabled={!newAlias}
            className="px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-800 text-c-text-secondary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Email Digest Frequency */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Clock size={16} className="text-c-accent" />
          {t('settings.profile.email.digest', 'Email Digest Frequency')}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DIGEST_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() =>
                setEmailPrefs((prev: any) => ({ ...prev, digestFrequency: option.value as any }))
              }
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                emailPrefs.digestFrequency === option.value
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-subtle dark:hover:border-white/20'
              }`}
            >
              <p
                className={`font-medium ${
                  emailPrefs.digestFrequency === option.value ? 'text-c-accent' : 'text-navy-900'
                }`}
              >
                {option.label}
              </p>
              <p className="text-xs text-c-text-muted mt-0.5">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Out of Office */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Calendar size={16} className="text-c-accent" />
          {t('settings.profile.email.outOfOffice', 'Out of Office')}
        </h4>

        {/* Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-navy-900">
              {t('settings.profile.email.enableOOO', 'Enable Out of Office')}
            </p>
            <p className="text-xs text-c-text-muted">
              {t('settings.profile.email.enableOOODesc', 'Automatically respond when you are away')}
            </p>
          </div>
          <button
            onClick={() =>
              setEmailPrefs((prev: any) => ({
                ...prev,
                outOfOffice: { ...prev.outOfOffice!, enabled: !prev.outOfOffice?.enabled },
              }))
            }
            className={toggleClass(emailPrefs.outOfOffice?.enabled || false)}
          >
            <span className={toggleKnobClass(emailPrefs.outOfOffice?.enabled || false)} />
          </button>
        </div>

        {emailPrefs.outOfOffice?.enabled && (
          <div className="space-y-4 pt-4 border-t border-c-border-subtle dark:border-navy-700">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  {t('settings.profile.email.startDate', 'Start Date')}
                </label>
                <input
                  type="date"
                  value={emailPrefs.outOfOffice?.start || ''}
                  onChange={(e) =>
                    setEmailPrefs((prev: any) => ({
                      ...prev,
                      outOfOffice: { ...prev.outOfOffice!, start: e.target.value },
                    }))
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className={inputClass + ' mt-1.5'}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {t('settings.profile.email.endDate', 'End Date')}
                </label>
                <input
                  type="date"
                  value={emailPrefs.outOfOffice?.end || ''}
                  onChange={(e) =>
                    setEmailPrefs((prev: any) => ({
                      ...prev,
                      outOfOffice: { ...prev.outOfOffice!, end: e.target.value },
                    }))
                  }
                  min={emailPrefs.outOfOffice?.start || new Date().toISOString().split('T')[0]}
                  className={inputClass + ' mt-1.5'}
                />
              </div>
            </div>

            {/* Auto-reply message */}
            <div>
              <label className={labelClass}>
                {t('settings.profile.email.oooMessage', 'Auto-reply Message')}
              </label>
              <textarea
                value={emailPrefs.outOfOffice?.message || ''}
                onChange={(e) =>
                  setEmailPrefs((prev: any) => ({
                    ...prev,
                    outOfOffice: { ...prev.outOfOffice!, message: e.target.value },
                  }))
                }
                placeholder={t(
                  'settings.profile.email.oooPlaceholder',
                  "I'm currently out of office and will respond when I return..."
                )}
                rows={4}
                className={inputClass + ' resize-none mt-1.5'}
              />
            </div>

            {/* Auto-reply toggle */}
            <div className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg">
              <div>
                <p className="text-sm font-medium text-navy-900">
                  {t('settings.profile.email.autoReply', 'Send auto-reply')}
                </p>
                <p className="text-xs text-c-text-muted">
                  {t(
                    'settings.profile.email.autoReplyDesc',
                    'Automatically send the message above to people who email you'
                  )}
                </p>
              </div>
              <button
                onClick={() =>
                  setEmailPrefs((prev: any) => ({
                    ...prev,
                    outOfOffice: { ...prev.outOfOffice!, autoReply: !prev.outOfOffice?.autoReply },
                  }))
                }
                className={toggleClass(emailPrefs.outOfOffice?.autoReply || false)}
              >
                <span className={toggleKnobClass(emailPrefs.outOfOffice?.autoReply || false)} />
              </button>
            </div>
          </div>
        )}

        {emailPrefs.outOfOffice?.enabled && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-500 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t(
                  'settings.profile.email.oooNote',
                  'Your status will be shown as "Out of Office" to other team members during this period.'
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Success Toast */}
      {saveStatus === 'success' && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
          <CheckCircle size={16} />
          {t('common.saved', 'Saved!')}
        </div>
      )}
    </div>
  );
};

export default EmailCommunicationSettings;
