/**
 * Report Schedule View
 * Manage recurring schedules for management reports
 */

import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { ManagementReportScope, ManagementReportType } from '../../../types';

interface ReportSchedule {
  id: string;
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  projectId?: string;
  projectName?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  timezone: string;
  isActive: boolean;
  nextScheduledAt?: string;
  recipients?: string[];
}

export const ReportScheduleView: React.FC = () => {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<ManagementReportType>('TEAM_MEETING');
  const [scope, setScope] = useState<ManagementReportScope>('PORTFOLIO');
  const [projectId, setProjectId] = useState<string>('');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('WEEKLY');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [timezone, setTimezone] = useState('Europe/Warsaw');
  const [recipients, setRecipients] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [scheduleResponse, projectsResponse] = await Promise.all([
          Api.get('/api/management-reports/schedules'),
          Api.get('/api/projects'),
        ]);
        setSchedules(scheduleResponse.data?.schedules || []);
        if (projectsResponse.data?.projects) {
          setProjects(projectsResponse.data.projects.map((p: any) => ({ id: p.id, name: p.name })));
        }
      } catch (error) {
        console.error('Failed to load schedules:', error);
        toast.error(t('reports.toast.loadSchedulesError', 'Nie udało się załadować harmonogramów'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCreateSchedule = async () => {
    if (scope === 'PROJECT' && !projectId) {
      toast.error(t('reports.toast.selectProjectForSchedule', 'Wybierz projekt dla harmonogramu'));
      return;
    }
    try {
      const response = await Api.post('/api/management-reports/schedules', {
        reportType,
        scope,
        projectId: scope === 'PROJECT' ? projectId : undefined,
        frequency,
        dayOfWeek: frequency !== 'MONTHLY' ? dayOfWeek : undefined,
        dayOfMonth: frequency === 'MONTHLY' ? dayOfMonth : undefined,
        timeOfDay,
        timezone,
        recipients: recipients
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      });
      if (response.data?.schedule) {
        setSchedules((prev) => [response.data.schedule, ...prev]);
        toast.success(t('reports.toast.scheduleCreated', 'Harmonogram utworzony'));
      }
    } catch (error) {
      console.error('Failed to create schedule:', error);
      toast.error(t('reports.toast.scheduleCreateError', 'Nie udało się utworzyć harmonogramu'));
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      await Api.delete(`/api/management-reports/schedules/${scheduleId}`);
      setSchedules((prev) => prev.filter((schedule) => schedule.id !== scheduleId));
      toast.success(t('reports.toast.scheduleRemoved', 'Harmonogram usunięty'));
    } catch (error) {
      console.error('Failed to remove schedule:', error);
      toast.error(t('reports.toast.scheduleRemoveError', 'Nie udało się usunąć harmonogramu'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock size={18} className="text-primary-500" />
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
            Schedule recurring reports
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              Report type
            </label>
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ManagementReportType)}
              className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
            >
              <option value="TEAM_MEETING">Team Meeting</option>
              <option value="TEAM_WEEKLY">Team Weekly</option>
              <option value="STEERING_COMMITTEE">Steering Committee</option>
              <option value="PORTFOLIO_HEALTH">Portfolio Health</option>
              <option value="RAID">Risk/Assumption/Issue/Dependency</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Scope</label>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as ManagementReportScope)}
              className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
            >
              <option value="PORTFOLIO">Portfolio</option>
              <option value="PROJECT">Single Project</option>
            </select>
          </div>

          {scope === 'PROJECT' && (
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Project
              </label>
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(event) =>
                setFrequency(event.target.value as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY')
              }
              className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          {frequency === 'MONTHLY' ? (
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Day of month
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={dayOfMonth}
                onChange={(event) => setDayOfMonth(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Day of week
              </label>
              <select
                value={dayOfWeek}
                onChange={(event) => setDayOfWeek(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
              >
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Time</label>
            <input
              type="time"
              value={timeOfDay}
              onChange={(event) => setTimeOfDay(event.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              Timezone
            </label>
            <input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            Recipients (emails or user IDs)
          </label>
          <input
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2 text-sm"
            placeholder="name@example.com, user-id-123"
          />
        </div>

        <div className="mt-6">
          <button
            onClick={handleCreateSchedule}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text hover:bg-c-text-secondary text-c-bg text-sm font-medium"
          >
            <Plus size={16} />
            Add schedule
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-700">
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white">Active schedules</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-navy-700">
          {loading ? (
            <div className="px-6 py-6 text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          ) : schedules.length === 0 ? (
            <div className="px-6 py-6 text-sm text-slate-500 dark:text-slate-400">
              No schedules created yet.
            </div>
          ) : (
            schedules.map((schedule) => (
              <div key={schedule.id} className="px-6 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-navy-900 dark:text-white">{schedule.reportType}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {schedule.scope === 'PROJECT'
                      ? `Project: ${schedule.projectName || schedule.projectId}`
                      : 'Portfolio scope'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {schedule.frequency} • {schedule.timeOfDay} {schedule.timezone}
                  </p>
                  {schedule.nextScheduledAt && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Next: {new Date(schedule.nextScheduledAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(schedule.id)}
                  className="text-slate-400 hover:text-danger-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportScheduleView;
