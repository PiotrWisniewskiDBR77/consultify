import { BellRing, CalendarClock, Loader2, Mail, PlayCircle, RefreshCw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { useAgentSchedules, useAgentScheduleTimeline } from '@/hooks/v10';
import {
  type AgentScheduleDraftInput,
  buildDefaultAgentScheduleDraft,
  formatRunStatusLabel,
} from '@/models/agent/AgentScheduleSurfaceV1';
import { isAgentScheduleDefinitionEnabled } from '@/utils/v10/agentScheduleDefinitionFlag';
import { isAgentScheduleRegistryEnabled } from '@/utils/v10/agentScheduleRegistryFlag';

import { RunTimelineSummary } from './RunTimelineSummary';

interface AgentSchedulePanelProps {
  readonly tenantId?: string;
  readonly className?: string;
}

export function AgentSchedulePanel({ tenantId, className }: AgentSchedulePanelProps) {
  const {
    schedulesQuery,
    preferencesQuery,
    previewMutation,
    createMutation,
    updatePreferencesMutation,
    triggerMutation,
  } = useAgentSchedules(tenantId);
  const [draft, setDraft] = useState<AgentScheduleDraftInput>(() =>
    buildDefaultAgentScheduleDraft({ tenantId })
  );
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>();
  const timelineQuery = useAgentScheduleTimeline(selectedScheduleId, tenantId);

  const isFeatureEnabled = isAgentScheduleDefinitionEnabled() || isAgentScheduleRegistryEnabled();
  const schedules = useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data]);

  useEffect(() => {
    if (!preferencesQuery.data) return;
    setDraft((current) => ({
      ...current,
      notifications: {
        ...preferencesQuery.data.preferences,
        ...(current.notifications ?? {}),
      },
    }));
  }, [preferencesQuery.data]);

  useEffect(() => {
    if (!selectedScheduleId && schedules[0]?.id) {
      setSelectedScheduleId(schedules[0].id);
    }
  }, [selectedScheduleId, schedules]);

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId]
  );

  const currentNotifications = {
    ...(preferencesQuery.data?.preferences ?? draft.notifications ?? {}),
  };

  const isBusy =
    previewMutation.isPending || createMutation.isPending || updatePreferencesMutation.isPending;

  const canSubmit = Boolean(
    draft.displayName?.trim() && draft.agentDefinitionRef?.trim() && draft.cronOrInterval?.trim()
  );

  const handleDraftChange = <Key extends keyof AgentScheduleDraftInput>(
    key: Key,
    value: AgentScheduleDraftInput[Key]
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleNotificationChange = (
    key: keyof NonNullable<AgentScheduleDraftInput['notifications']>,
    value: boolean
  ) => {
    setDraft((current) => ({
      ...current,
      notifications: {
        ...currentNotifications,
        ...(current.notifications ?? {}),
        [key]: value,
      },
    }));
  };

  const handlePreview = async () => {
    try {
      await previewMutation.mutateAsync(draft);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to preview schedule');
    }
  };

  const handleCreate = async () => {
    try {
      const result = await createMutation.mutateAsync(draft);
      toast.success('Agent schedule created');
      setSelectedScheduleId(result.schedule.id);
      setDraft((current) =>
        buildDefaultAgentScheduleDraft({
          tenantId,
          notifications: current.notifications,
        })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create schedule');
    }
  };

  const handleSavePreferences = async () => {
    try {
      await updatePreferencesMutation.mutateAsync(currentNotifications);
      toast.success('Schedule notification defaults saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save notification defaults');
    }
  };

  const handleTrigger = async () => {
    if (!selectedScheduleId) return;
    try {
      const result = await triggerMutation.mutateAsync(selectedScheduleId);
      toast.success(
        `Run ${result.gateDecision === 'approved' ? 'started' : 'queued for approval'}`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to trigger schedule');
    }
  };

  if (!isFeatureEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
        Agent Runtime schedule registry flags are currently off for this workspace.
      </div>
    );
  }

  return (
    <div
      className={['grid gap-4 lg:grid-cols-[1.2fr_0.8fr]', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                <CalendarClock size={18} />
                Agent Schedule Panel
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Preview registry timing, save operator defaults, and create minimal Wave-B
                schedules.
              </p>
            </div>
            <button
              type="button"
              onClick={() => schedulesQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Schedule name
              </span>
              <input
                value={draft.displayName}
                onChange={(event) => handleDraftChange('displayName', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Weekly operator digest"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Agent definition ref
              </span>
              <input
                value={draft.agentDefinitionRef}
                onChange={(event) => handleDraftChange('agentDefinitionRef', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="agent/report-ops"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Cron or interval
              </span>
              <input
                value={draft.cronOrInterval}
                onChange={(event) => handleDraftChange('cronOrInterval', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="0 9 * * 1"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Overlap policy
              </span>
              <select
                value={draft.overlapPolicy}
                onChange={(event) =>
                  handleDraftChange(
                    'overlapPolicy',
                    event.target.value as AgentScheduleDraftInput['overlapPolicy']
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="skip">skip</option>
                <option value="queue">queue</option>
                <option value="parallel">parallel</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Retention days
              </span>
              <input
                type="number"
                min={1}
                max={365}
                value={draft.retentionDays}
                onChange={(event) =>
                  handleDraftChange('retentionDays', Number(event.target.value) || 1)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Approval mode
              </span>
              <select
                value={draft.approvalMode}
                onChange={(event) =>
                  handleDraftChange(
                    'approvalMode',
                    event.target.value as AgentScheduleDraftInput['approvalMode']
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="implicit">implicit</option>
                <option value="inline">inline</option>
                <option value="explicit_form">explicit_form</option>
                <option value="multi_reviewer">multi_reviewer</option>
                <option value="admin_only">admin_only</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!canSubmit || isBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {previewMutation.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <PlayCircle size={15} />
              )}
              Preview
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSubmit || isBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Create schedule
            </button>
          </div>

          {previewMutation.data && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/80 p-3 text-sm dark:border-sky-900/60 dark:bg-sky-950/20">
              <div className="font-medium text-sky-900 dark:text-sky-100">
                {previewMutation.data.description}
              </div>
              <div className="mt-1 text-sky-700 dark:text-sky-300">
                Next run: {new Date(previewMutation.data.nextRunAt).toLocaleString()}
              </div>
              <div className="mt-1 text-sky-700 dark:text-sky-300">
                Busy overlap outcome: {previewMutation.data.overlapDecisionIfRunning}
              </div>
              {previewMutation.data.projectedRunTimes.length > 0 && (
                <div className="mt-2 text-xs text-sky-800 dark:text-sky-200">
                  Upcoming:{' '}
                  {previewMutation.data.projectedRunTimes
                    .map((value) => new Date(value).toLocaleString())
                    .join(' | ')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <BellRing size={16} />
            Notification defaults
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Operator-facing defaults that new schedules can inherit.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ['inAppEnabled', 'In-app alerts', BellRing],
              ['emailEnabled', 'Email alerts', Mail],
              ['notifyOnFailure', 'Notify on failure', BellRing],
              ['notifyOnSuccess', 'Notify on success', BellRing],
              ['notifyOnQueued', 'Notify when queued', BellRing],
            ].map(([key, label, Icon]) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-800"
              >
                <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <Icon size={14} />
                  {label}
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(currentNotifications[key as keyof typeof currentNotifications])}
                  onChange={(event) =>
                    handleNotificationChange(
                      key as keyof NonNullable<AgentScheduleDraftInput['notifications']>,
                      event.target.checked
                    )
                  }
                />
              </label>
            ))}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleSavePreferences}
              disabled={updatePreferencesMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {updatePreferencesMutation.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Save defaults
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Registered schedules
          </div>
          <div className="mt-3 space-y-2">
            {schedulesQuery.isLoading && (
              <div className="text-sm text-slate-500 dark:text-slate-400">Loading schedules...</div>
            )}
            {!schedulesQuery.isLoading && schedules.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No schedules have been created in this slice yet.
              </div>
            )}
            {schedules.map((schedule) => (
              <button
                key={schedule.id}
                type="button"
                onClick={() => setSelectedScheduleId(schedule.id)}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                  selectedScheduleId === schedule.id
                    ? 'border-primary-300 bg-primary-50/70 dark:border-primary-700 dark:bg-primary-950/20'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {schedule.displayName}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {formatRunStatusLabel(schedule.timelineSummary.latestStatus)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {schedule.cronOrInterval} · {schedule.overlapPolicy} · next{' '}
                  {new Date(schedule.nextRunAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Run timeline
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {selectedSchedule
                  ? `${selectedSchedule.displayName} · ${formatRunStatusLabel(selectedSchedule.timelineSummary.latestStatus)}`
                  : 'Select a schedule to inspect its run state.'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleTrigger}
              disabled={!selectedScheduleId || triggerMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {triggerMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PlayCircle size={14} />
              )}
              Trigger run
            </button>
          </div>
          <div className="mt-4">
            <RunTimelineSummary
              timeline={timelineQuery.data ?? selectedSchedule?.timelineSummary}
              isLoading={timelineQuery.isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentSchedulePanel;
