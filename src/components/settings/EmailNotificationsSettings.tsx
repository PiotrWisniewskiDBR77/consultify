/**
 * EmailNotificationsSettings - Email notification preferences
 */

import { Check, Mail } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface EmailNotificationsSettingsProps {
  className?: string;
}

const EMAIL_CATEGORIES = [
  { key: 'taskUpdates', label: 'Task Updates', desc: 'Updates on tasks assigned to you' },
  { key: 'projectAlerts', label: 'Project Alerts', desc: 'Important project notifications' },
  { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Weekly summary of activity' },
  { key: 'marketing', label: 'Marketing', desc: 'Product updates and tips' },
] as const;

export const EmailNotificationsSettings: React.FC<EmailNotificationsSettingsProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Record<string, boolean>>({
    taskUpdates: true,
    projectAlerts: true,
    weeklyDigest: true,
    marketing: false,
  });

  const toggleSetting = (key: string) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
          <Mail size={20} />
          {t('settings.notifications.emailTitle', 'Email Notifications')}
        </h3>
        <p className="text-sm text-c-text-muted mt-1">
          {t('settings.notifications.emailDesc', 'Choose which emails you want to receive.')}
        </p>
      </div>

      <div className="space-y-3">
        {EMAIL_CATEGORIES.map(({ key, label, desc }) => (
          <div
            key={key}
            className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg"
          >
            <div>
              <p className="font-medium text-c-text">{t(`settings.notifications.${key}`, label)}</p>
              <p className="text-sm text-c-text-muted">
                {t(`settings.notifications.${key}Desc`, desc)}
              </p>
            </div>
            <button
              onClick={() => toggleSetting(key)}
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                settings[key]
                  ? 'bg-brand border-brand text-white'
                  : 'border-c-border-subtle dark:border-navy-600'
              }`}
            >
              {settings[key] && <Check size={14} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailNotificationsSettings;
