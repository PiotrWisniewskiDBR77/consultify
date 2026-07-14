/**
 * NotificationDigestSettings - Email digest configuration
 *
 * Features:
 * - Digest frequency (instant, hourly, daily, weekly)
 * - Digest content (summary, full)
 * - Digest format (HTML, plain text)
 */

import { AlertCircle, CheckCircle, Loader2, Mail, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface NotificationDigestSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

type DigestFrequency = 'instant' | 'hourly' | 'daily' | 'weekly';
type DigestContent = 'summary' | 'full';
type DigestFormat = 'html' | 'plain';

interface DigestPreferences {
  frequency: DigestFrequency;
  content: DigestContent;
  format: DigestFormat;
}

const FREQUENCY_OPTIONS = [
  { value: 'instant', label: 'Instant', description: 'Receive notifications immediately' },
  { value: 'hourly', label: 'Hourly', description: 'Receive a summary every hour' },
  { value: 'daily', label: 'Daily', description: 'Receive a summary once per day' },
  { value: 'weekly', label: 'Weekly', description: 'Receive a summary once per week' },
] as const;

const CONTENT_OPTIONS = [
  { value: 'summary', label: 'Summary', description: 'Brief overview only' },
  { value: 'full', label: 'Full Details', description: 'Complete notification content' },
] as const;

const FORMAT_OPTIONS = [
  { value: 'html', label: 'HTML', description: 'Rich formatting' },
  { value: 'plain', label: 'Plain Text', description: 'Simple text format' },
] as const;

export const NotificationDigestSettings: React.FC<NotificationDigestSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [frequency, setFrequency] = useState<DigestFrequency>('instant');
  const [content, setContent] = useState<DigestContent>('summary');
  const [format, setFormat] = useState<DigestFormat>('html');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = (await Api.get('/settings/notifications/digest')) as
          | Partial<DigestPreferences>
          | undefined;
        if (prefs && typeof prefs === 'object') {
          setFrequency((prefs.frequency as DigestFrequency) || 'instant');
          setContent((prefs.content as DigestContent) || 'summary');
          setFormat((prefs.format as DigestFormat) || 'html');
        }
      } catch (err) {
        console.error('Failed to load digest preferences', err);
      }
    };
    loadPreferences();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await Api.put('/settings/notifications/digest', {
        frequency,
        content,
        format,
      } as DigestPreferences);
      const persisted = (await Api.get('/settings/notifications/digest').catch(
        () => null
      )) as Partial<DigestPreferences> | null;
      if (persisted && typeof persisted === 'object') {
        setFrequency((persisted.frequency as DigestFrequency) || frequency);
        setContent((persisted.content as DigestContent) || content);
        setFormat((persisted.format as DigestFormat) || format);
      }

      setSaveStatus('success');
      toast.success(t('settings.notifications.digest.saved', 'Digest preferences saved'));

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(
        error.message ||
          t('settings.notifications.digest.error', 'Failed to save digest preferences')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-2 flex items-center gap-2">
          <Mail size={20} />
          {t('settings.notifications.digest.title', 'Email Digest')}
        </h3>
        <p className="text-sm text-c-text-muted">
          {t(
            'settings.notifications.digest.subtitle',
            'Configure how often you receive email summaries'
          )}
        </p>
      </div>

      {/* Frequency */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.notifications.digest.frequency', 'Digest Frequency')}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FREQUENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFrequency(option.value)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                frequency === option.value
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent'
              }`}
            >
              <div
                className={`text-sm font-medium ${
                  frequency === option.value ? 'text-c-accent' : 'text-c-text-secondary'
                }`}
              >
                {t(`settings.notifications.digest.freq_${option.value}`, option.label)}
              </div>
              <div className="text-xs text-c-text-muted mt-1">
                {t(`settings.notifications.digest.freq_${option.value}_desc`, option.description)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.notifications.digest.content', 'Digest Content')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {CONTENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setContent(option.value)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                content === option.value
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent'
              }`}
            >
              <div
                className={`text-sm font-medium ${
                  content === option.value ? 'text-c-accent' : 'text-c-text-secondary'
                }`}
              >
                {t(`settings.notifications.digest.content_${option.value}`, option.label)}
              </div>
              <div className="text-xs text-c-text-muted mt-1">
                {t(
                  `settings.notifications.digest.content_${option.value}_desc`,
                  option.description
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.notifications.digest.format', 'Email Format')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFormat(option.value)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                format === option.value
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent'
              }`}
            >
              <div
                className={`text-sm font-medium ${
                  format === option.value ? 'text-c-accent' : 'text-c-text-secondary'
                }`}
              >
                {t(`settings.notifications.digest.format_${option.value}`, option.label)}
              </div>
              <div className="text-xs text-c-text-muted mt-1">
                {t(`settings.notifications.digest.format_${option.value}_desc`, option.description)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-c-text hover:bg-c-text text-c-surface rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('common.saving', 'Saving...')}
            </>
          ) : (
            <>
              <Save size={16} />
              {t('common.save', 'Save')}
            </>
          )}
        </button>
      </div>

      {/* Success/Error Messages */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
          <CheckCircle size={16} />
          {t('settings.notifications.digest.saved', 'Digest preferences saved')}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={16} />
          {t('settings.notifications.digest.error', 'Failed to save digest preferences')}
        </div>
      )}
    </div>
  );
};

export default NotificationDigestSettings;
