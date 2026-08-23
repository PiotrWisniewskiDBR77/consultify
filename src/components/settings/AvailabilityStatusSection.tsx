/**
 * AvailabilityStatusSection - User Availability & Status
 *
 * Features:
 * - Custom status message (with emoji support)
 * - Out of office dates (calendar picker, reason field)
 * - Working hours (per day of week, timezone-aware)
 * - Do not disturb hours (time range, days selection)
 */

import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Edit2,
  Loader2,
  MessageSquare,
  Moon,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { DoNotDisturbHours, OutOfOfficePeriod, User, WorkingHours } from '../../types';

interface AvailabilityStatusSectionProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

export const AvailabilityStatusSection: React.FC<AvailabilityStatusSectionProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State
  const [statusMessage, setStatusMessage] = useState('');
  const [workingHours, setWorkingHours] = useState<WorkingHours>({
    timezone: currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    days: {} as WorkingHours['days'],
  });
  const [doNotDisturbHours, setDoNotDisturbHours] = useState<DoNotDisturbHours>({
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  });
  const [outOfOfficePeriods, setOutOfOfficePeriods] = useState<OutOfOfficePeriod[]>([]);

  // Edit states
  const [editingOOO, setEditingOOO] = useState<string | null>(null);
  const [showOOOForm, setShowOOOForm] = useState(false);

  useEffect(() => {
    loadAvailability();
  }, [currentUser.id]);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      const data = await Api.get('/api/user/availability');
      if (data.success && data.data) {
        setStatusMessage(data.data.statusMessage || '');
        setWorkingHours(
          data.data.workingHours || {
            timezone: currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            days: {},
          }
        );
        setDoNotDisturbHours(
          data.data.doNotDisturbHours || {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            days: [],
          }
        );
        setOutOfOfficePeriods(data.data.outOfOfficePeriods || []);
      }
    } catch (error) {
      console.error('Failed to load availability:', error);
      toast.error(t('settings.availability.loadError', 'Failed to load availability settings'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.put('/api/user/availability', {
        statusMessage,
        workingHours,
        doNotDisturbHours,
      });
      toast.success(t('settings.availability.saved', 'Availability settings saved'));
    } catch (error) {
      toast.error(t('settings.availability.error', 'Failed to save availability settings'));
    } finally {
      setSaving(false);
    }
  };

  const addOutOfOffice = async () => {
    const newOOO: OutOfOfficePeriod = {
      id: Date.now().toString(),
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      reason: '',
      isAllDay: true,
    };
    setOutOfOfficePeriods([...outOfOfficePeriods, newOOO]);
    setEditingOOO(newOOO.id);
    setShowOOOForm(true);
  };

  const updateOutOfOffice = (id: string, updates: Partial<OutOfOfficePeriod>) => {
    setOutOfOfficePeriods((periods) =>
      periods.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const saveOutOfOffice = async (period: OutOfOfficePeriod) => {
    try {
      if (period.id && period.id.startsWith('temp-')) {
        // New period - create via API
        const result = await Api.post('/api/user/availability/out-of-office', {
          startDate: period.startDate,
          endDate: period.endDate,
          reason: period.reason,
          isAllDay: period.isAllDay,
        });
        if (result.success) {
          setOutOfOfficePeriods((periods) =>
            periods.map((p) => (p.id === period.id ? { ...p, id: result.data.id } : p))
          );
          setEditingOOO(null);
          setShowOOOForm(false);
          toast.success(t('settings.availability.oooSaved', 'Out of office period saved'));
        }
      } else {
        // Update existing - delete and recreate (could add PUT endpoint later)
        await Api.delete(`/api/user/availability/out-of-office/${period.id}`);
        const result = await Api.post('/api/user/availability/out-of-office', {
          startDate: period.startDate,
          endDate: period.endDate,
          reason: period.reason,
          isAllDay: period.isAllDay,
        });
        if (result.success) {
          setOutOfOfficePeriods((periods) =>
            periods.map((p) => (p.id === period.id ? { ...p, id: result.data.id } : p))
          );
          setEditingOOO(null);
          setShowOOOForm(false);
          toast.success(t('settings.availability.oooSaved', 'Out of office period saved'));
        }
      }
    } catch (error) {
      toast.error(t('settings.availability.oooError', 'Failed to save out of office period'));
    }
  };

  const removeOutOfOffice = async (id: string) => {
    try {
      await Api.delete(`/api/user/availability/out-of-office/${id}`);
      setOutOfOfficePeriods((periods) => periods.filter((p) => p.id !== id));
      toast.success(t('settings.availability.oooDeleted', 'Out of office period deleted'));
    } catch (error) {
      toast.error(
        t('settings.availability.oooDeleteError', 'Failed to delete out of office period')
      );
    }
  };

  const updateWorkingHoursDay = (day: string, updates: any) => {
    setWorkingHours((prev: any) => ({
      ...prev,
      days: {
        ...(prev.days || {}),
        [day]: {
          ...(prev.days?.[day] || {}),
          ...updates,
        },
      },
    }));
  };

  const toggleDNDDay = (day: DoNotDisturbHours['days'][number]) => {
    setDoNotDisturbHours((prev: any) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d: any) => d !== day) : [...prev.days, day],
    }));
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  const daysOfWeek = [
    { key: 'monday', label: t('settings.availability.days.monday', 'Monday') },
    { key: 'tuesday', label: t('settings.availability.days.tuesday', 'Tuesday') },
    { key: 'wednesday', label: t('settings.availability.days.wednesday', 'Wednesday') },
    { key: 'thursday', label: t('settings.availability.days.thursday', 'Thursday') },
    { key: 'friday', label: t('settings.availability.days.friday', 'Friday') },
    { key: 'saturday', label: t('settings.availability.days.saturday', 'Saturday') },
    { key: 'sunday', label: t('settings.availability.days.sunday', 'Sunday') },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Clock size={28} className="text-c-accent" />
            {t('settings.availability.title', 'Availability & Status')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.availability.description', 'Set your availability and status message')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
        </button>
      </div>

      {/* Status Message */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <MessageSquare size={20} className="text-blue-500" />
          {t('settings.availability.statusMessage', 'Status Message')}
        </h3>
        <input
          type="text"
          value={statusMessage}
          onChange={(e) => setStatusMessage(e.target.value)}
          placeholder={t(
            'settings.availability.statusPlaceholder',
            'e.g., 🎉 On vacation until Jan 15'
          )}
          maxLength={100}
          className="w-full px-4 py-3 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
        />
        <p className="text-xs text-c-text-muted mt-2">
          {statusMessage.length} / 100 {t('settings.availability.characters', 'characters')}
        </p>
      </div>

      {/* Working Hours */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Clock size={20} className="text-green-500" />
          {t('settings.availability.workingHours', 'Working Hours')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t(
            'settings.availability.workingHoursDesc',
            'Set your availability for each day of the week'
          )}
        </p>
        <div className="space-y-3">
          {daysOfWeek.map(({ key, label }) => {
            const dayHours = (workingHours.days as any)?.[key] || {
              enabled: false,
              startTime: '09:00',
              endTime: '17:00',
            };
            return (
              <div
                key={key}
                className="flex items-center gap-4 p-3 border border-c-border-subtle dark:border-navy-700 rounded-lg"
              >
                <div className="w-24">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dayHours.enabled}
                      onChange={(e) => updateWorkingHoursDay(key, { enabled: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                </div>
                {dayHours.enabled && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={dayHours.startTime}
                      onChange={(e) => updateWorkingHoursDay(key, { startTime: e.target.value })}
                      className="px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg"
                    />
                    <span className="text-c-text-muted">-</span>
                    <input
                      type="time"
                      value={dayHours.endTime}
                      onChange={(e) => updateWorkingHoursDay(key, { endTime: e.target.value })}
                      className="px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Do Not Disturb Hours */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Moon size={20} className="text-indigo-500" />
          {t('settings.availability.dndHours', 'Do Not Disturb Hours')}
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.availability.enableDND', 'Enable Do Not Disturb')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t('settings.availability.enableDNDDesc', 'Block notifications during these hours')}
              </p>
            </div>
            <button
              onClick={() =>
                setDoNotDisturbHours((prev: any) => ({ ...prev, enabled: !prev.enabled }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                doNotDisturbHours.enabled ? 'bg-indigo-600' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${doNotDisturbHours.enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {doNotDisturbHours.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    {t('settings.availability.startTime', 'Start Time')}
                  </label>
                  <input
                    type="time"
                    value={doNotDisturbHours.startTime}
                    onChange={(e) =>
                      setDoNotDisturbHours((prev: any) => ({ ...prev, startTime: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    {t('settings.availability.endTime', 'End Time')}
                  </label>
                  <input
                    type="time"
                    value={doNotDisturbHours.endTime}
                    onChange={(e) =>
                      setDoNotDisturbHours((prev: any) => ({ ...prev, endTime: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  {t('settings.availability.dndDays', 'Days')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleDNDDay(key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        doNotDisturbHours.days.includes(key)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Out of Office Periods */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Calendar size={20} className="text-amber-500" />
            {t('settings.availability.outOfOffice', 'Out of Office')}
          </h3>
          <button
            onClick={addOutOfOffice}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('settings.availability.addOOO', 'Add Period')}
          </button>
        </div>
        <div className="space-y-3">
          {outOfOfficePeriods.map((period) => (
            <OOOPeriodCard
              key={period.id}
              period={period}
              isEditing={editingOOO === period.id}
              onEdit={() => setEditingOOO(period.id)}
              onSave={() => saveOutOfOffice(period)}
              onCancel={() => {
                setEditingOOO(null);
                setShowOOOForm(false);
                if (period.id.startsWith('temp-')) {
                  removeOutOfOffice(period.id);
                }
              }}
              onUpdate={(updates) => updateOutOfOffice(period.id, updates)}
              onDelete={() => removeOutOfOffice(period.id)}
            />
          ))}
          {outOfOfficePeriods.length === 0 && (
            <p className="text-sm text-c-text-muted text-center py-4">
              {t('settings.availability.noOOO', 'No out of office periods added yet')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

interface OOOPeriodCardProps {
  period: OutOfOfficePeriod;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<OutOfOfficePeriod>) => void;
  onDelete: () => void;
}

const OOOPeriodCard: React.FC<OOOPeriodCardProps> = ({
  period,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  onDelete,
}) => {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="p-4 border border-c-accent dark:border-c-accent rounded-lg bg-c-accent-soft dark:bg-c-accent-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              {t('settings.availability.startDate', 'Start Date')}
            </label>
            <input
              type="date"
              value={period.startDate}
              onChange={(e) => onUpdate({ startDate: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              {t('settings.availability.endDate', 'End Date')}
            </label>
            <input
              type="date"
              value={period.endDate}
              onChange={(e) => onUpdate({ endDate: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              {t('settings.availability.reason', 'Reason (optional)')}
            </label>
            <input
              type="text"
              value={period.reason || ''}
              onChange={(e) => onUpdate({ reason: e.target.value })}
              placeholder={t(
                'settings.availability.reasonPlaceholder',
                'e.g., Vacation, Conference'
              )}
              className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={period.isAllDay}
              onChange={(e) => onUpdate({ isAllDay: e.target.checked })}
              className="rounded"
            />
            <label className="text-sm">{t('settings.availability.allDay', 'All Day')}</label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onSave}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            {t('common.save', 'Save')}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm ml-auto"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  const isPast = endDate < new Date();

  return (
    <div
      className={`p-4 border rounded-lg transition-colors ${
        isPast
          ? 'border-c-border-subtle dark:border-navy-700 opacity-60'
          : 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-amber-500" />
            <span className="font-medium text-c-text">
              {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </span>
            {isPast && (
              <span className="text-xs text-c-text-muted">
                {t('settings.availability.past', 'Past')}
              </span>
            )}
          </div>
          {period.reason && <p className="text-sm text-c-text-secondary mt-1">{period.reason}</p>}
          {period.isAllDay && (
            <span className="text-xs text-c-text-muted mt-1 block">
              {t('settings.availability.allDay', 'All Day')}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-danger-100 dark:hover:bg-danger-500/10 rounded-lg text-danger-600"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityStatusSection;
