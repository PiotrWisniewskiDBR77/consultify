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

import { Banner } from '@/components/shared/Banner';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
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

export const EmailDigestSettings: React.FC<EmailDigestSettingsProps> = ({ currentUser }) => {
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDirty =
    JSON.stringify(emailSettings) !== JSON.stringify(originalEmail) ||
    JSON.stringify({ frequency, content, format }) !== JSON.stringify(originalDigest);

  // Load
  useEffect(() => {
    const load = async () => {
      try {
        setLoadError(null);
        const [emailRes, digestRes] = await Promise.all([
          Api.get('/settings/notifications/email'),
          Api.get('/settings/notifications/digest'),
        ]);
        if (
          !emailRes ||
          typeof emailRes !== 'object' ||
          !digestRes ||
          typeof digestRes !== 'object'
        ) {
          throw new Error('Email digest response was missing email or digest settings');
        }
        const e = emailRes as Record<string, boolean>;
        const d = digestRes as {
          frequency?: DigestFrequency;
          content?: DigestContent;
          format?: DigestFormat;
        };
        const nextDigest = {
          frequency: d.frequency || 'instant',
          content: d.content || 'summary',
          format: d.format || 'html',
        };
        setEmailSettings(e);
        setOriginalEmail(e);
        setFrequency(nextDigest.frequency);
        setContent(nextDigest.content);
        setFormat(nextDigest.format);
        setOriginalDigest(nextDigest);
      } catch (err: unknown) {
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load email digest settings'));
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
      setActionError(null);
      await Promise.all([
        Api.put('/settings/notifications/email', emailSettings),
        Api.put('/settings/notifications/digest', { frequency, content, format }),
      ]);

      const [emailRes, digestRes] = await Promise.all([
        Api.get('/settings/notifications/email'),
        Api.get('/settings/notifications/digest'),
      ]);
      if (
        !emailRes ||
        typeof emailRes !== 'object' ||
        !digestRes ||
        typeof digestRes !== 'object'
      ) {
        throw new Error('Email digest settings save was not confirmed by the server');
      }
      const persistedEmail =
        emailRes && typeof emailRes === 'object'
          ? (emailRes as Record<string, boolean>)
          : { ...emailSettings };
      const persistedDigest =
        digestRes && typeof digestRes === 'object'
          ? (digestRes as {
              frequency?: DigestFrequency;
              content?: DigestContent;
              format?: DigestFormat;
            })
          : { frequency, content, format };
      const persistedSnapshot = {
        frequency: persistedDigest.frequency || frequency,
        content: persistedDigest.content || content,
        format: persistedDigest.format || format,
      };
      if (
        JSON.stringify(persistedEmail) !== JSON.stringify(emailSettings) ||
        JSON.stringify(persistedSnapshot) !== JSON.stringify({ frequency, content, format })
      ) {
        throw new Error('Email digest settings save was not confirmed by the server');
      }

      setEmailSettings(persistedEmail);
      setOriginalEmail(persistedEmail);
      setFrequency(persistedSnapshot.frequency);
      setContent(persistedSnapshot.content);
      setFormat(persistedSnapshot.format);
      setOriginalDigest(persistedSnapshot);
      toast.success(t('settings.emailDigest.saved', 'Email & digest settings saved'));
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.emailDigest.error', 'Failed to save email settings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [emailSettings, frequency, content, format, t]);

  const toggleEmail = (key: string) => {
    setEmailSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sectionLabel =
    'text-xs font-bold text-c-text-secondary uppercase tracking-wider flex items-center gap-2 mb-4';

  const optionCardCls = (active: boolean) =>
    cn(
      'p-3.5 rounded-lg border-2 transition-all text-left cursor-pointer',
      active
        ? 'border-c-accent bg-c-accent-soft'
        : 'border-c-border-subtle hover:border-c-accent bg-c-surface-raised'
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
        {loadError && <DegradedState title="Email digest unavailable" description={loadError} />}

        {actionError && <Banner variant="danger" title={actionError} />}

        {!loadError && (
          <>
            {/* ═══════════════════════════════════════════════ */}
            {/* SECTION 1: Email Categories                    */}
            {/* ═══════════════════════════════════════════════ */}
            <div>
              <h4 className={sectionLabel}>
                <Mail size={14} className="text-c-accent" />
                {t('settings.emailDigest.categories', 'Email Categories')}
              </h4>

              <div className="space-y-2">
                {EMAIL_CATEGORIES.map(({ key, label, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3.5 bg-c-surface-raised border border-c-border-subtle rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-c-text">
                        {t(`settings.emailDigest.cat_${key}`, label)}
                      </p>
                      <p className="text-xs text-c-text-muted mt-0.5">
                        {t(`settings.emailDigest.cat_${key}_desc`, desc)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleEmail(key)}
                      role="checkbox"
                      aria-checked={Boolean(emailSettings[key])}
                      aria-label={t(`settings.emailDigest.cat_${key}`, label)}
                      className={cn(
                        'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                        emailSettings[key]
                          ? 'bg-navy-900 border-navy-900 text-white dark:bg-c-surface dark:border-white dark:text-navy-950'
                          : 'border-c-border-subtle hover:border-c-border-strong'
                      )}
                    >
                      {emailSettings[key] && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2.5 6L5 8.5L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
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
                <Mail size={14} className="text-c-accent" />
                {t('settings.emailDigest.digestSettings', 'Digest Settings')}
              </h4>

              {/* Frequency */}
              <div className="mb-5">
                <label className="text-xs font-medium text-c-text-secondary mb-2 block">
                  {t('settings.emailDigest.frequency', 'Digest Frequency')}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFrequency(opt.value)}
                      className={optionCardCls(frequency === opt.value)}
                    >
                      <div
                        className={cn(
                          'text-sm font-medium',
                          frequency === opt.value ? 'text-c-accent' : 'text-c-text-secondary'
                        )}
                      >
                        {t(`settings.emailDigest.freq_${opt.value}`, opt.label)}
                      </div>
                      <div className="text-[11px] text-c-text-muted mt-0.5">
                        {t(`settings.emailDigest.freq_${opt.value}_desc`, opt.description)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="mb-5">
                <label className="text-xs font-medium text-c-text-secondary mb-2 block">
                  {t('settings.emailDigest.content', 'Digest Content')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CONTENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setContent(opt.value)}
                      className={optionCardCls(content === opt.value)}
                    >
                      <div
                        className={cn(
                          'text-sm font-medium',
                          content === opt.value ? 'text-c-accent' : 'text-c-text-secondary'
                        )}
                      >
                        {t(`settings.emailDigest.content_${opt.value}`, opt.label)}
                      </div>
                      <div className="text-[11px] text-c-text-muted mt-0.5">
                        {t(`settings.emailDigest.content_${opt.value}_desc`, opt.description)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="text-xs font-medium text-c-text-secondary mb-2 block">
                  {t('settings.emailDigest.format', 'Email Format')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFormat(opt.value)}
                      className={optionCardCls(format === opt.value)}
                    >
                      <div
                        className={cn(
                          'text-sm font-medium',
                          format === opt.value ? 'text-c-accent' : 'text-c-text-secondary'
                        )}
                      >
                        {t(`settings.emailDigest.format_${opt.value}`, opt.label)}
                      </div>
                      <div className="text-[11px] text-c-text-muted mt-0.5">
                        {t(`settings.emailDigest.format_${opt.value}_desc`, opt.description)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
};

export default EmailDigestSettings;
