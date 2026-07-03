/**
 * ProfileWorkHoursSettings - Working hours and availability
 *
 * Features:
 * - Set working hours (start/end time)
 * - Select working days
 * - Vacation/Out of office periods
 */

import { AlertCircle, Calendar, CheckCircle, Clock, Loader2, Plane, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface ProfileWorkHoursSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
] as const;

export const ProfileWorkHoursSettings: React.FC<ProfileWorkHoursSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [workHoursStart, setWorkHoursStart] = useState(
    currentUser.workingHours?.days?.monday?.startTime || '09:00'
  );
  const [workHoursEnd, setWorkHoursEnd] = useState(
    currentUser.workingHours?.days?.monday?.endTime || '17:00'
  );
  const [workDays, setWorkDays] = useState<number[]>(
    currentUser.workingHours?.days
      ? Object.entries(currentUser.workingHours.days)
          .filter(([_, day]) => (day as any)?.enabled)
          .map(([day]) => {
            const dayMap: Record<string, number> = {
              monday: 1,
              tuesday: 2,
              wednesday: 3,
              thursday: 4,
              friday: 5,
              saturday: 6,
              sunday: 7,
            };
            return dayMap[day] || 0;
          })
          .filter((d) => d > 0)
      : [1, 2, 3, 4, 5]
  );
  const [vacationStart, setVacationStart] = useState(
    currentUser.outOfOfficeDates?.[0]?.startDate?.split('T')[0] || ''
  );
  const [vacationEnd, setVacationEnd] = useState(
    currentUser.outOfOfficeDates?.[0]?.endDate?.split('T')[0] || ''
  );
  const [outOfOffice, setOutOfOffice] = useState(currentUser.isOutOfOffice || false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const wh = currentUser.workingHours;
    if (wh?.days?.monday) {
      setWorkHoursStart(wh.days.monday.startTime || '09:00');
      setWorkHoursEnd(wh.days.monday.endTime || '17:00');
    }
    if (currentUser.outOfOfficeDates?.[0]) {
      setVacationStart(currentUser.outOfOfficeDates[0].startDate.split('T')[0]);
      setVacationEnd(currentUser.outOfOfficeDates[0].endDate.split('T')[0]);
    }
    setOutOfOffice(currentUser.isOutOfOffice || false);
  }, [currentUser]);

  const toggleWorkDay = (day: number) => {
    if (workDays.includes(day)) {
      setWorkDays(workDays.filter((d) => d !== day));
    } else {
      setWorkDays([...workDays, day].sort());
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const dayMap: Record<number, string> = {
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday',
        7: 'sunday',
      };

      const workingHours: any = {
        timezone: currentUser.timezone || 'Europe/Warsaw',
        days: {},
      };

      workDays.forEach((day) => {
        const dayName = dayMap[day];
        if (dayName) {
          workingHours.days[dayName] = {
            enabled: true,
            startTime: workHoursStart,
            endTime: workHoursEnd,
          };
        }
      });

      const outOfOfficeDates =
        vacationStart && vacationEnd
          ? [
              {
                id: 'current',
                startDate: vacationStart,
                endDate: vacationEnd,
                isAllDay: true,
              },
            ]
          : undefined;

      await Api.updateUser(currentUser.id, {
        workingHours,
        outOfOfficeDates,
        isOutOfOffice: outOfOffice,
      });

      onUpdateUser({
        workingHours,
        outOfOfficeDates,
        isOutOfOffice: outOfOffice,
      });

      setSaveStatus('success');
      toast.success(t('settings.profile.workHours.saved', 'Work hours updated successfully'));

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(
        error.message || t('settings.profile.workHours.error', 'Failed to update work hours')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-2">
          {t('settings.profile.workHours.title', 'Working Hours & Availability')}
        </h3>
        <p className="text-sm text-c-text-muted">
          {t('settings.profile.workHours.subtitle', 'Set your working hours and availability')}
        </p>
      </div>

      {/* Working Hours */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary flex items-center gap-2">
          <Clock size={16} />
          {t('settings.profile.workHours.workingHours', 'Working Hours')}
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-c-text-muted">
              {t('settings.profile.workHours.startTime', 'Start Time')}
            </label>
            <input
              type="time"
              value={workHoursStart}
              onChange={(e) => setWorkHoursStart(e.target.value)}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-c-text-muted">
              {t('settings.profile.workHours.endTime', 'End Time')}
            </label>
            <input
              type="time"
              value={workHoursEnd}
              onChange={(e) => setWorkHoursEnd(e.target.value)}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Working Days */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.profile.workHours.workingDays', 'Working Days')}
        </label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = workDays.includes(day.value);
            return (
              <button
                key={day.value}
                onClick={() => toggleWorkDay(day.value)}
                className={`
                                    px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium
                                    ${
                                      isSelected
                                        ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft text-c-accent'
                                        : 'border-c-border-subtle dark:border-navy-700 text-c-text-secondary hover:border-c-accent'
                                    }
                                `}
              >
                {day.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vacation/Out of Office */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary flex items-center gap-2">
          <Plane size={16} />
          {t('settings.profile.workHours.vacation', 'Vacation / Out of Office')}
        </label>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="outOfOffice"
            checked={outOfOffice}
            onChange={(e) => setOutOfOffice(e.target.checked)}
            className="w-4 h-4 text-c-accent rounded focus:ring-[color:var(--c-focus)]"
          />
          <label htmlFor="outOfOffice" className="text-sm text-c-text-secondary">
            {t('settings.profile.workHours.markAsOutOfOffice', 'Mark as out of office')}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-c-text-muted">
              {t('settings.profile.workHours.vacationStart', 'Start Date')}
            </label>
            <input
              type="date"
              value={vacationStart}
              onChange={(e) => setVacationStart(e.target.value)}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-c-text-muted">
              {t('settings.profile.workHours.vacationEnd', 'End Date')}
            </label>
            <input
              type="date"
              value={vacationEnd}
              onChange={(e) => setVacationEnd(e.target.value)}
              min={vacationStart}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
            />
          </div>
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
          {t('settings.profile.workHours.saved', 'Work hours updated successfully')}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-danger-600 dark:text-danger-400 text-sm">
          <AlertCircle size={16} />
          {t('settings.profile.workHours.error', 'Failed to update work hours')}
        </div>
      )}
    </div>
  );
};

export default ProfileWorkHoursSettings;
