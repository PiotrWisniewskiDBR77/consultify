/**
 * EmailDigestSettings - Consolidated Email Notifications + Digest
 *
 * Merges EmailNotificationsSettings + NotificationDigestSettings into one card.
 * Section 1: Email Categories (which email types to receive)
 * Section 2: Digest Settings — hidden per N3 (DEC-2026-08-25-21): the digest
 * cron is a no-op (server/src/cron/DailyDigestCron.js returns zeroed
 * counts unconditionally, notyfikacje-audyt.md §1F/§2.4/W1), so no control
 * here has ever changed what gets sent. Rather than ship a toggle that
 * does nothing, this section — and the "Weekly Digest" category, which is
 * the same feature under a different label — is replaced by a single
 * honest "planned" notice, following the ReadOnlyState pattern already
 * used by NotificationRulesBuilder.tsx for the same kind of gap. The
 * underlying state/round-trip-verification logic for weeklyDigest and
 * frequency/content/format is left untouched (still loaded, still
 * persisted, still part of the save's read-back check) — only the
 * interactive controls are removed, so re-enabling them later is a pure
 * UI change once the digest engine actually exists.
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
import { DegradedState, ReadOnlyState } from '../Admin/AdminState';
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

// N3: the digest is a no-op end to end, so its category is folded into
// the single "planned" notice below instead of rendering a toggle that
// cannot do anything.
const VISIBLE_EMAIL_CATEGORIES = EMAIL_CATEGORIES.filter((c) => c.key !== 'weeklyDigest');

type DigestFrequency = 'instant' | 'hourly' | 'daily' | 'weekly';
type DigestContent = 'summary' | 'full';
type DigestFormat = 'html' | 'plain';

// N3: FREQUENCY_OPTIONS/CONTENT_OPTIONS/FORMAT_OPTIONS previously rendered
// Section 2's picker buttons, removed above — the frequency/content/format
// state itself is kept (still loaded, still round-tripped on save; see
// file header comment) so re-adding the picker later is a pure UI change.

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
                {VISIBLE_EMAIL_CATEGORIES.map(({ key, label, desc }) => (
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
            {/* SECTION 2: Digest — N3 placebo hide                */}
            {/* Frequency/content/format controls removed: the      */}
            {/* digest cron is a no-op end to end (see file header  */}
            {/* comment). One honest notice replaces them.          */}
            {/* ═══════════════════════════════════════════════ */}
            <ReadOnlyState
              title={t('settings.emailDigest.plannedTitle', 'Planned — this channel will go live after rollout')}
              description={t(
                'settings.emailDigest.plannedDesc',
                'Digest emails are not sent yet. Individual notifications for the categories above still go out as configured.'
              )}
            />
          </>
        )}
      </div>
    </SettingsSection>
  );
};

export default EmailDigestSettings;
