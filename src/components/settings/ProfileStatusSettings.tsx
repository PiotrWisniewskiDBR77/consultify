/**
 * ProfileStatusSettings - User availability status and status message
 *
 * Features:
 * - Set availability status (online, away, busy, dnd)
 * - Custom status message
 * - Real-time status updates
 */

import { AlertCircle, CheckCircle, Circle, Clock, Loader2, Moon, Save, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface ProfileStatusSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', icon: Circle, color: 'text-green-500' },
  { value: 'away', label: 'Away', icon: Clock, color: 'text-yellow-500' },
  { value: 'busy', label: 'Busy', icon: Zap, color: 'text-amber-500' },
  { value: 'dnd', label: 'Do Not Disturb', icon: Moon, color: 'text-danger-500' },
] as const;

type AvailabilityStatus = 'available' | 'away' | 'busy' | 'dnd' | 'offline';

export const ProfileStatusSettings: React.FC<ProfileStatusSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AvailabilityStatus>(
    (currentUser.availabilityStatus as AvailabilityStatus) || 'available'
  );
  const [statusMessage, setStatusMessage] = useState(currentUser.statusMessage || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setStatus((currentUser.availabilityStatus as AvailabilityStatus) || 'available');
    setStatusMessage(currentUser.statusMessage || '');
  }, [currentUser]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await Api.updateUserStatus(currentUser.id, {
        availabilityStatus: status,
        statusMessage: statusMessage.trim() || undefined,
      });

      onUpdateUser({
        availabilityStatus: status,
        statusMessage: statusMessage.trim() || undefined,
      });

      setSaveStatus('success');
      toast.success(t('settings.profile.status.saved', 'Status updated successfully'));

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(error.message || t('settings.profile.status.error', 'Failed to update status'));
    } finally {
      setIsSaving(false);
    }
  };

  const selectedStatus = STATUS_OPTIONS.find((opt) => opt.value === status);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-2">
          {t('settings.profile.status.title', 'Availability Status')}
        </h3>
        <p className="text-sm text-c-text-muted">
          {t('settings.profile.status.subtitle', 'Let others know your current availability')}
        </p>
      </div>

      {/* Status Selection */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.profile.status.currentStatus', 'Current Status')}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATUS_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = status === option.value;

            return (
              <button
                key={option.value}
                onClick={() => setStatus(option.value as AvailabilityStatus)}
                className={`
                                    flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                                    ${
                                      isSelected
                                        ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                                        : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent'
                                    }
                                `}
              >
                <Icon
                  size={24}
                  className={isSelected ? option.color : 'text-c-text-secondary'}
                />
                <span
                  className={`text-sm font-medium ${
                    isSelected
                      ? 'text-c-accent'
                      : 'text-c-text-secondary'
                  }`}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Message */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.profile.status.message', 'Status Message')}
          <span className="text-c-text-secondary text-xs ml-1">
            ({t('common.optional', 'Optional')})
          </span>
        </label>
        <input
          type="text"
          value={statusMessage}
          onChange={(e) => setStatusMessage(e.target.value)}
          placeholder={t(
            'settings.profile.status.messagePlaceholder',
            'e.g., In a meeting until 3 PM'
          )}
          maxLength={100}
          className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
        />
        <p className="text-xs text-c-text-secondary">
          {statusMessage.length}/100 {t('common.characters', 'characters')}
        </p>
      </div>

      {/* Preview */}
      <div className="p-4 bg-c-surface-raised rounded-lg border border-c-border-subtle dark:border-navy-700">
        <p className="text-xs text-c-text-muted mb-2">
          {t('settings.profile.status.preview', 'Preview')}:
        </p>
        <div className="flex items-center gap-2">
          {selectedStatus && (
            <>
              <selectedStatus.icon size={16} className={selectedStatus.color} />
              <span className="text-sm font-medium text-c-text">
                {selectedStatus.label}
              </span>
              {statusMessage && (
                <>
                  <span className="text-c-text-secondary">•</span>
                  <span className="text-sm text-c-text-secondary">
                    {statusMessage}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          {t('settings.profile.status.saved', 'Status updated successfully')}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-danger-600 dark:text-danger-400 text-sm">
          <AlertCircle size={16} />
          {t('settings.profile.status.error', 'Failed to update status')}
        </div>
      )}
    </div>
  );
};

export default ProfileStatusSettings;
