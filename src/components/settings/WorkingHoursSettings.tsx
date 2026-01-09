// @ts-nocheck
/**
 * WorkingHoursSettings - Manage weekly working schedule
 *
 * Features:
 * - Set hours for each day of the week
 * - Same hours every day option
 * - Timezone-aware
 * - Integration with calendar
 */

import { AlertCircle, Calendar, CheckCircle, Clock, Globe, Loader2, RefreshCw, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { DaySchedule, User, WorkingHours } from '../../types';

interface WorkingHoursSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' },
] as const;

type DayKey = (typeof DAYS_OF_WEEK)[number]['key'];

const DEFAULT_SCHEDULE: DaySchedule = {
    enabled: true,
    startTime: '09:00',
    endTime: '17:00',
};

const WEEKEND_SCHEDULE: DaySchedule = {
    enabled: false,
    startTime: '09:00',
    endTime: '17:00',
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2);
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
});

export const WorkingHoursSettings: React.FC<WorkingHoursSettingsProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sameEveryDay, setSameEveryDay] = useState(true);
    const [timezone, setTimezone] = useState(currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

    const [schedule, setSchedule] = useState<Record<DayKey, DaySchedule>>({
        monday: { ...DEFAULT_SCHEDULE },
        tuesday: { ...DEFAULT_SCHEDULE },
        wednesday: { ...DEFAULT_SCHEDULE },
        thursday: { ...DEFAULT_SCHEDULE },
        friday: { ...DEFAULT_SCHEDULE },
        saturday: { ...WEEKEND_SCHEDULE },
        sunday: { ...WEEKEND_SCHEDULE },
    });

    useEffect(() => {
        loadWorkingHours();
    }, []);

    const loadWorkingHours = async () => {
        setLoading(true);
        try {
            const response = await Api.get('/api/settings/working-hours');
            if (response?.schedule) {
                setSchedule(response.schedule);
                setTimezone(response.timezone || timezone);
                // Check if all weekday times are the same
                const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
                const firstEnabled = response.schedule.monday;
                const allSame = weekdays.every((day) => {
                    const s = response.schedule[day];
                    return s.startTime === firstEnabled.startTime && s.endTime === firstEnabled.endTime;
                });
                setSameEveryDay(allSame);
            }
        } catch (error) {
            console.error('Failed to load working hours:', error);
            // Use defaults
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Api.put('/api/settings/working-hours', {
                timezone,
                schedule,
            });

            // Update user's workingHours
            const workingHours: WorkingHours = {
                timezone,
                days: schedule,
            };
            onUpdateUser({ workingHours });
            toast.success(t('settings.workingHours.saved', 'Working hours saved'));
        } catch (error) {
            toast.error(t('settings.workingHours.error', 'Failed to save working hours'));
        } finally {
            setSaving(false);
        }
    };

    const handleDayToggle = (day: DayKey) => {
        setSchedule((prev) => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day].enabled },
        }));
    };

    const handleTimeChange = (day: DayKey, field: 'startTime' | 'endTime', value: string) => {
        if (sameEveryDay) {
            // Update all weekdays
            const newSchedule = { ...schedule };
            DAYS_OF_WEEK.forEach((d) => {
                if (d.key !== 'saturday' && d.key !== 'sunday') {
                    newSchedule[d.key] = { ...newSchedule[d.key], [field]: value };
                }
            });
            setSchedule(newSchedule);
        } else {
            setSchedule((prev) => ({
                ...prev,
                [day]: { ...prev[day], [field]: value },
            }));
        }
    };

    const handleSameEveryDayToggle = () => {
        if (!sameEveryDay) {
            // Apply Monday's schedule to all weekdays
            const mondaySchedule = schedule.monday;
            const newSchedule = { ...schedule };
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach((day) => {
                newSchedule[day as DayKey] = { ...mondaySchedule };
            });
            setSchedule(newSchedule);
        }
        setSameEveryDay(!sameEveryDay);
    };

    // Calculate total weekly hours
    const totalHours = DAYS_OF_WEEK.reduce((total, day) => {
        const s = schedule[day.key];
        if (!s.enabled) return total;
        const start = parseInt(s.startTime.split(':')[0]) * 60 + parseInt(s.startTime.split(':')[1]);
        const end = parseInt(s.endTime.split(':')[0]) * 60 + parseInt(s.endTime.split(':')[1]);
        return total + (end - start) / 60;
    }, 0);

    // Styles
    const inputClass =
        'px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all appearance-none cursor-pointer';
    const cardClass = 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {t('settings.workingHours.title', 'Working Hours')}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {t('settings.workingHours.description', 'Set your availability for meetings and work')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>

            {/* Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={cardClass}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Working Days</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {DAYS_OF_WEEK.filter((d) => schedule[d.key].enabled).length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className={cardClass}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                            <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Weekly Hours</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{totalHours.toFixed(1)}h</p>
                        </div>
                    </div>
                </div>
                <div className={cardClass}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                            <Globe className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Timezone</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
                                {timezone.replace('_', ' ')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Options */}
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                            {t('settings.workingHours.scheduleType', 'Schedule Type')}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Choose how you want to set your working hours</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setSameEveryDay(true)}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                            sameEveryDay
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                                : 'border-slate-200 dark:border-white/10 hover:border-purple-300'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-4 h-4 rounded-full border-2 ${
                                    sameEveryDay
                                        ? 'border-purple-500 bg-purple-500'
                                        : 'border-slate-300 dark:border-slate-600'
                                }`}
                            >
                                {sameEveryDay && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">Same every day</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1 text-left">Use the same hours for all weekdays</p>
                    </button>
                    <button
                        onClick={() => setSameEveryDay(false)}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                            !sameEveryDay
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                                : 'border-slate-200 dark:border-white/10 hover:border-purple-300'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-4 h-4 rounded-full border-2 ${
                                    !sameEveryDay
                                        ? 'border-purple-500 bg-purple-500'
                                        : 'border-slate-300 dark:border-slate-600'
                                }`}
                            >
                                {!sameEveryDay && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">Custom per day</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1 text-left">Set different hours for each day</p>
                    </button>
                </div>
            </div>

            {/* Schedule */}
            <div className={cardClass}>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-6">
                    {t('settings.workingHours.weeklySchedule', 'Weekly Schedule')}
                </h3>

                <div className="space-y-3">
                    {DAYS_OF_WEEK.map((day) => {
                        const daySchedule = schedule[day.key];
                        const isWeekend = day.key === 'saturday' || day.key === 'sunday';
                        const isDisabled = sameEveryDay && !isWeekend && day.key !== 'monday';

                        return (
                            <div
                                key={day.key}
                                className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                                    daySchedule.enabled
                                        ? 'bg-slate-50 dark:bg-navy-950/50'
                                        : 'bg-slate-100 dark:bg-white/5 opacity-60'
                                }`}
                            >
                                {/* Day Toggle */}
                                <button
                                    onClick={() => handleDayToggle(day.key)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${
                                        daySchedule.enabled ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                            daySchedule.enabled ? 'left-7' : 'left-1'
                                        }`}
                                    />
                                </button>

                                {/* Day Label */}
                                <div className="w-28">
                                    <span
                                        className={`font-medium ${
                                            daySchedule.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                                        }`}
                                    >
                                        {day.label}
                                    </span>
                                </div>

                                {/* Time Inputs */}
                                {daySchedule.enabled ? (
                                    <div className="flex items-center gap-3 flex-1">
                                        <select
                                            value={daySchedule.startTime}
                                            onChange={(e) => handleTimeChange(day.key, 'startTime', e.target.value)}
                                            disabled={isDisabled}
                                            className={inputClass + (isDisabled ? ' opacity-50' : '')}
                                        >
                                            {TIME_OPTIONS.map((time) => (
                                                <option key={time} value={time}>
                                                    {time}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="text-slate-500">to</span>
                                        <select
                                            value={daySchedule.endTime}
                                            onChange={(e) => handleTimeChange(day.key, 'endTime', e.target.value)}
                                            disabled={isDisabled}
                                            className={inputClass + (isDisabled ? ' opacity-50' : '')}
                                        >
                                            {TIME_OPTIONS.map((time) => (
                                                <option key={time} value={time}>
                                                    {time}
                                                </option>
                                            ))}
                                        </select>

                                        {/* Hours display */}
                                        <span className="text-sm text-slate-500 ml-2">
                                            {(() => {
                                                const start =
                                                    parseInt(daySchedule.startTime.split(':')[0]) * 60 +
                                                    parseInt(daySchedule.startTime.split(':')[1]);
                                                const end =
                                                    parseInt(daySchedule.endTime.split(':')[0]) * 60 +
                                                    parseInt(daySchedule.endTime.split(':')[1]);
                                                return ((end - start) / 60).toFixed(1) + 'h';
                                            })()}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex-1 text-slate-400 text-sm">Not working</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30">
                <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            <strong>Note:</strong> Your working hours are used for scheduling features like meeting
                            availability, out-of-office notifications, and focus time suggestions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkingHoursSettings;

