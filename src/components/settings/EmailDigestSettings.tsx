/**
 * EmailDigestSettings - Consolidated Email Notifications + Digest
 *
 * Merges EmailNotificationsSettings + NotificationDigestSettings into one card.
 * Section 1: Email Categories (which email types to receive)
 * Section 2: Digest Settings (frequency, content, format)
 */

import { Mail } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import { SettingsDivider, SettingsSection } from './shared';

interface EmailDigestSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

const EMAIL_CATEGORIES = [
  { key: 'taskUpdates', label: 'Task Updates', desc: 'Updates on tasks assigned to you' },
  { key: 'projectAlerts', label: 'Project Alerts', desc: 'Important project notifications' },
  { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Weekly summary of activity' },
  { key: 'marketing', label: 'Marketing', desc: 'Product updates and tips' },
] as const;

type DigestFrequency = 'instant' | 'hourly' | 'daily' | 'weekly';
type DigestContent = 'summary' | 'full';
type DigestFormat = 'html' | 'plain';

const FREQUENCY_OPTIONS = [
  { value: 'instant' as const, label: 'Instant', description: 'Receive notifications immediately' },
  { value: 'hourly' as const, label: 'Hourly', description: 'Receive a summary every hour' },
  { value: 'daily' as const, label: 'Daily', description: 'Receive a summary once per day' },
  { value: 'weekly' as const, label: 'Weekly', description: 'Receive a summary once per week' },
];

const CONTENT_OPTIONS = [
  { value: 'summary' as const, label: 'Summary', description: 'Brief overview only' },
  { value: 'full' as const, label: 'Full Details', description: 'Complete notification content' },
];

const FORMAT_OPTIONS = [
  { value: 'html' as const, label: 'HTML', description: 'Rich formatting' },
  { value: 'plain' as const, label: 'Plain Text', description: 'Simple text format' },
];

export const EmailDigestSettings: React.FC<EmailDigestSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();

  // Email categories
  const [emailSettings, setEmailSettings] = useState<Record<string, boolean>>({
    taskUpdates: true,
    projectAlerts: true,
    weeklyDigest: true,
    marketing: false,
  });

  // Digest settings
  const [frequency, setFrequency] = useState<DigestFrequency>('instant');
  const [content, setContent] = useState<DigestContent>('summary');
  const [format, setFormat] = useState<DigestFormat>('html');

  // Dirty tracking
  const [originalEmail, setOriginalEmail] = useState<Record<string, boolean>>({ ...emailSettings });
  const [originalDigest, setOriginalDigest] = useState({ frequency, content, format });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isDirty =
    JSON.stringify(emailSettings) !== JSON.stringify(originalEmail) ||
    JSON.stringify({ frequency, content, format }) !== JSON.stringify(originalDigest);

  // Load
  useEffect(() => {
    const load = async () => {
      try {
        const [emailRes, digestRes] = await Promise.all([
          Api.get('/settings/notifications/email').catch(() => null),
          Api.get('/settings/notifications/digest').catch(() => null),
        ]);
        if (emailRes && typeof emailRes === 'object') {
          const e = emailRes as Record<string, boolean>;
          setEmailSettings(e);
          setOriginalEmail(e);
        }
        if (digestRes && typeof digestRes === 'object') {
          const d = digestRes as { frequency?: string; content?: string; format?: string };
          if (d.frequency) setFrequency(d.frequency as DigestFrequency);
          if (d.content) setContent(d.content as DigestContent);
          if (d.format) setFormat(d.format as DigestFormat);
          setOriginalDigest({
            frequency: (d.frequency as DigestFrequency) || 'instant',
            content: (d.content as DigestContent) || 'summary',
            format: (d.format as DigestFormat) || 'html',
          });
        }
      } catch (err) {
        console.error('Failed to load email/digest settings', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser.id]);

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Promise.all([
        Api.put('/settings/notifications/email', emailSettings),
        Api.put('/settings/notifications/digest', { frequency, content, format }),
      ]);
      setOriginalEmail({ ...emailSettings });
      setOriginalDigest({ frequency, content, format });
      toast.success(t('settings.emailDigest.saved', 'Email & digest settings saved'));
    } catch (err) {
      toast.error(t('settings.emailDigest.error', 'Failed to save email settings'));
    } finally {
      setSaving(false);
    }
  }, [emailSettings, frequency, content, format, t]);

  const toggleEmail = (key: string) => {
    setEmailSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sectionLabel = 'text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4';

  const optionCardCls = (active: boolean) =>
    cn(
      'p-3.5 rounded-lg border-2 transition-all text-left cursor-pointer',
      active
        ? 'border-violet-500 bg-violet-600/10'
        : 'border-white/5 hover:border-violet-500/30 bg-navy-800/30'
    );

  return (
    <SettingsSection
      icon={Mail}
      title={t('settings.emailDigest.title', 'Email & Digest')}
      description={t(
        'settings.emailDigest.description',
        'Choose which emails you receive and how they are summarized'
      )}
      cardId="settings-email-digest"
      isDirty={isDirty}
      onSave={handleSave}
      saving={saving}
      loading={loading}
    >
      <div className="space-y-6">
        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION 1: Email Categories                    */}
        {/* ═══════════════════════════════════════════════ */}
        <div>
          <h4 className={sectionLabel}>
            <Mail size={14} className="text-violet-400" />
            {t('settings.emailDigest.categories', 'Email Categories')}
          </h4>

          <div className="space-y-2">
            {EMAIL_CATEGORIES.map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-center justify-between p-3.5 bg-navy-900/30 border border-white/5 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {t(`settings.emailDigest.cat_${key}`, label)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t(`settings.emailDigest.cat_${key}_desc`, desc)}
                  </p>
                </div>
                <button
                  onClick={() => toggleEmail(key)}
                  className={cn(
                    'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                    emailSettings[key]
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-white/20 hover:border-white/40'
                  )}
                >
                  {emailSettings[key] && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        <SettingsDivider />

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION 2: Digest Settings                     */}
        {/* ═══════════════════════════════════════════════ */}
        <div>
          <h4 className={sectionLabel}>
            <Mail size={14} className="text-violet-400" />
            {t('settings.emailDigest.digestSettings', 'Digest Settings')}
          </h4>

          {/* Frequency */}
          <div className="mb-5">
            <label className="text-xs font-medium text-slate-400 mb-2 block">
              {t('settings.emailDigest.frequency', 'Digest Frequency')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={optionCardCls(frequency === opt.value)}
                >
                  <div className={cn('text-sm font-medium', frequency === opt.value ? 'text-violet-300' : 'text-slate-400')}>
                    {t(`settings.emailDigest.freq_${opt.value}`, opt.label)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t(`settings.emailDigest.freq_${opt.value}_desc`, opt.description)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="mb-5">
            <label className="text-xs font-medium text-slate-400 mb-2 block">
              {t('settings.emailDigest.content', 'Digest Content')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setContent(opt.value)}
                  className={optionCardCls(content === opt.value)}
                >
                  <div className={cn('text-sm font-medium', content === opt.value ? 'text-violet-300' : 'text-slate-400')}>
                    {t(`settings.emailDigest.content_${opt.value}`, opt.label)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t(`settings.emailDigest.content_${opt.value}_desc`, opt.description)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">
              {t('settings.emailDigest.format', 'Email Format')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  className={optionCardCls(format === opt.value)}
                >
                  <div className={cn('text-sm font-medium', format === opt.value ? 'text-violet-300' : 'text-slate-400')}>
                    {t(`settings.emailDigest.format_${opt.value}`, opt.label)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t(`settings.emailDigest.format_${opt.value}_desc`, opt.description)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
};

export default EmailDigestSettings;
