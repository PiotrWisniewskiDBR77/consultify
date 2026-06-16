/**
 * WorkingHoursEditor - User working hours management component
 *
 * Features:
 * - Weekly schedule grid (Monday-Sunday)
 * - Toggle for each day
 * - Time pickers for start/end
 * - Timezone selector
 * - Exceptions calendar (holidays, overtime)
 *
 * Design: Calendar-style grid with time pickers, HubSpot-style
 */

import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Copy,
  Globe,
  HelpCircle,
  Moon,
  Plus,
  Save,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Day of week
interface DaySchedule {
  enabled: boolean;
  start: string; // HH:MM format
  end: string;
  breaks?: Array<{ start: string; end: string }>;
}

// Working hours configuration
export interface WorkingHoursConfig {
  timezone: string;
  schedule: {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
  };
  exceptions?: Array<{
    id: string;
    date: string;
    type: 'holiday' | 'vacation' | 'overtime' | 'custom';
    description?: string;
    schedule?: DaySchedule;
  }>;
}

// Default schedule
const DEFAULT_SCHEDULE: WorkingHoursConfig = {
  timezone: 'UTC',
  schedule: {
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '17:00' },
    sunday: { enabled: false, start: '09:00', end: '17:00' },
  },
  exceptions: [],
};

// Timezone options
const TIMEZONES = [
  { value: 'UTC', label: 'UTC', offset: '+00:00' },
  { value: 'America/New_York', label: 'Eastern Time', offset: '-05:00' },
  { value: 'America/Chicago', label: 'Central Time', offset: '-06:00' },
  { value: 'America/Denver', label: 'Mountain Time', offset: '-07:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time', offset: '-08:00' },
  { value: 'Europe/London', label: 'London', offset: '+00:00' },
  { value: 'Europe/Paris', label: 'Paris', offset: '+01:00' },
  { value: 'Europe/Berlin', label: 'Berlin', offset: '+01:00' },
  { value: 'Europe/Warsaw', label: 'Warsaw', offset: '+01:00' },
  { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00' },
  { value: 'Asia/Shanghai', label: 'Shanghai', offset: '+08:00' },
  { value: 'Asia/Dubai', label: 'Dubai', offset: '+04:00' },
  { value: 'Australia/Sydney', label: 'Sydney', offset: '+11:00' },
];

// Day names
type DayKey = keyof WorkingHoursConfig['schedule'];
const DAYS: Array<{ key: DayKey; label: string; short: string }> = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

// Time options (15-minute intervals)
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
}

interface WorkingHoursEditorProps {
  config?: WorkingHoursConfig;
  onChange: (config: WorkingHoursConfig) => void;
  onSave?: () => Promise<void>;
  userName?: string;
  className?: string;
}

export const WorkingHoursEditor: React.FC<WorkingHoursEditorProps> = ({
  config = DEFAULT_SCHEDULE,
  onChange,
  onSave,
  userName,
  className,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [showExceptionForm, setShowExceptionForm] = useState(false);

  // Update schedule for a specific day
  const updateDaySchedule = useCallback(
    (day: DayKey, updates: Partial<DaySchedule>) => {
      onChange({
        ...config,
        schedule: {
          ...config.schedule,
          [day]: { ...config.schedule[day], ...updates },
        },
      });
    },
    [config, onChange]
  );

  // Update timezone
  const updateTimezone = useCallback(
    (timezone: string) => {
      onChange({ ...config, timezone });
    },
    [config, onChange]
  );

  // Copy schedule from one day to all weekdays
  const copyToWeekdays = useCallback(
    (sourceDay: DayKey) => {
      const sourceSchedule = config.schedule[sourceDay];
      const weekdays: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const newSchedule = { ...config.schedule };

      weekdays.forEach((day) => {
        newSchedule[day] = { ...sourceSchedule };
      });

      onChange({ ...config, schedule: newSchedule });
    },
    [config, onChange]
  );

  // Calculate total working hours per week
  const totalWeeklyHours = useMemo(() => {
    let total = 0;
    Object.values(config.schedule).forEach((day) => {
      if (day.enabled) {
        const [startH, startM] = day.start.split(':').map(Number);
        const [endH, endM] = day.end.split(':').map(Number);
        const hours = endH - startH + (endM - startM) / 60;
        if (hours > 0) total += hours;
      }
    });
    return total;
  }, [config.schedule]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-primary-500" />
            <h3 className="text-lg font-medium text-navy-900 dark:text-white">
              {userName
                ? t('admin.team.workingHours.titleUser', "{{name}}'s Working Hours", {
                    name: userName,
                  })
                : t('admin.team.workingHours.title', 'Working Hours')}
            </h3>
            <Tooltip
              content={t(
                'admin.team.workingHours.tooltip',
                'Set availability for scheduling and workload management'
              )}
            >
              <button className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
                <HelpCircle size={16} />
              </button>
            </Tooltip>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {totalWeeklyHours.toFixed(1)}h
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('admin.team.workingHours.perWeek', 'per week')}
            </p>
          </div>
        </div>

        {/* Timezone Selector */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Globe size={14} className="inline mr-1" />
              {t('admin.team.workingHours.timezone', 'Timezone')}
            </label>
            <select
              value={config.timezone}
              onChange={(e) => updateTimezone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Weekly Schedule Grid */}
        <div className="space-y-3">
          {DAYS.map((day) => {
            const schedule = config.schedule[day.key];
            const isWeekend = day.key === 'saturday' || day.key === 'sunday';

            return (
              <div
                key={day.key}
                className={cn(
                  'flex items-center gap-4 p-3 rounded-lg transition-all',
                  schedule.enabled
                    ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                    : 'bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700'
                )}
              >
                {/* Day Toggle */}
                <div className="w-24 flex items-center gap-2">
                  <button
                    onClick={() => updateDaySchedule(day.key, { enabled: !schedule.enabled })}
                    className={cn(
                      'w-5 h-5 rounded flex items-center justify-center transition-all',
                      schedule.enabled
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-200 dark:bg-navy-700 text-slate-400 dark:text-slate-500'
                    )}
                  >
                    {schedule.enabled && <Check size={12} />}
                  </button>
                  <span
                    className={cn(
                      'font-medium',
                      schedule.enabled ? 'text-navy-900 dark:text-white' : 'text-slate-400'
                    )}
                  >
                    {day.short}
                  </span>
                  {isWeekend && <Moon size={12} className="text-slate-400 dark:text-slate-500" />}
                </div>

                {/* Time Range */}
                {schedule.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <select
                      value={schedule.start}
                      onChange={(e) => updateDaySchedule(day.key, { start: e.target.value })}
                      className="px-2 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded text-sm text-navy-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-400 dark:text-slate-500">-</span>
                    <select
                      value={schedule.end}
                      onChange={(e) => updateDaySchedule(day.key, { end: e.target.value })}
                      className="px-2 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded text-sm text-navy-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>

                    {/* Hours calculation */}
                    <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                      {(() => {
                        const [startH, startM] = schedule.start.split(':').map(Number);
                        const [endH, endM] = schedule.end.split(':').map(Number);
                        const hours = endH - startH + (endM - startM) / 60;
                        return hours > 0 ? `${hours}h` : '0h';
                      })()}
                    </span>

                    {/* Copy to weekdays */}
                    {!isWeekend && day.key === 'monday' && (
                      <Tooltip
                        content={t(
                          'admin.team.workingHours.copyToWeekdays',
                          'Apply to all weekdays'
                        )}
                      >
                        <button
                          onClick={() => copyToWeekdays(day.key)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded transition-colors"
                        >
                          <Copy size={14} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-slate-400 dark:text-slate-500 flex-1">
                    {t('admin.team.workingHours.dayOff', 'Day off')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
        <h4 className="text-sm font-medium text-navy-900 dark:text-white mb-3">
          {t('admin.team.workingHours.quickPresets', 'Quick Presets')}
        </h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const weekdaySchedule = { enabled: true, start: '09:00', end: '17:00' };
              const weekendSchedule = { enabled: false, start: '09:00', end: '17:00' };
              onChange({
                ...config,
                schedule: {
                  monday: weekdaySchedule,
                  tuesday: weekdaySchedule,
                  wednesday: weekdaySchedule,
                  thursday: weekdaySchedule,
                  friday: weekdaySchedule,
                  saturday: weekendSchedule,
                  sunday: weekendSchedule,
                },
              });
            }}
            className="px-3 py-1.5 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-700 text-navy-900 dark:text-white transition-colors"
          >
            <Sun size={12} className="inline mr-1" />
            9-5 Weekdays (40h)
          </button>
          <button
            onClick={() => {
              const weekdaySchedule = { enabled: true, start: '08:00', end: '16:00' };
              const weekendSchedule = { enabled: false, start: '09:00', end: '17:00' };
              onChange({
                ...config,
                schedule: {
                  monday: weekdaySchedule,
                  tuesday: weekdaySchedule,
                  wednesday: weekdaySchedule,
                  thursday: weekdaySchedule,
                  friday: weekdaySchedule,
                  saturday: weekendSchedule,
                  sunday: weekendSchedule,
                },
              });
            }}
            className="px-3 py-1.5 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-700 text-navy-900 dark:text-white transition-colors"
          >
            <Clock size={12} className="inline mr-1" />
            8-4 Weekdays (40h)
          </button>
          <button
            onClick={() => {
              const partTimeSchedule = { enabled: true, start: '09:00', end: '13:00' };
              const weekendSchedule = { enabled: false, start: '09:00', end: '17:00' };
              onChange({
                ...config,
                schedule: {
                  monday: partTimeSchedule,
                  tuesday: partTimeSchedule,
                  wednesday: partTimeSchedule,
                  thursday: partTimeSchedule,
                  friday: partTimeSchedule,
                  saturday: weekendSchedule,
                  sunday: weekendSchedule,
                },
              });
            }}
            className="px-3 py-1.5 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-700 text-navy-900 dark:text-white transition-colors"
          >
            <Moon size={12} className="inline mr-1" />
            Part-time (20h)
          </button>
        </div>
      </div>

      {/* Save Button */}
      {onSave && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            icon={saving ? undefined : <Save size={16} />}
          >
            {t('common.saveChanges', 'Save Changes')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default WorkingHoursEditor;
