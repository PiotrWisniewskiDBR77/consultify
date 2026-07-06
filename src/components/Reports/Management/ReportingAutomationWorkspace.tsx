/**
 * Reporting Automation Workspace (T062)
 *
 * Full UI for managing automated recurring and event-triggered report schedules.
 * Tabs: Schedules, Execution History.
 * Features: create/edit/pause/resume/delete schedules, trigger rules, run now, execution log.
 */

import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Pause,
  Play,
  Plus,
  Presentation,
  ScanSearch,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/shared/states';

import { Api } from '../../../services/api';
import { trackFunnelEvent } from '../../../services/funnelAnalytics';

// ============================================
// TYPES
// ============================================

interface Schedule {
  id: string;
  name: string;
  description?: string;
  scheduleType: 'time_based' | 'event_triggered' | 'hybrid';
  deliverableType: 'report' | 'presentation' | 'both';
  scopeType: string;
  scopeId?: string;
  reportType: string;
  frequency: string;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  runCount: number;
  deliveryMethods: string[];
  createdAt: string;
}

interface TriggerRule {
  id: string;
  scheduleId: string;
  triggerType: string;
  conditions: Record<string, unknown>;
  isActive: boolean;
  throttleHours: number;
  lastFiredAt: string | null;
  fireCount: number;
}

interface Execution {
  id: string;
  scheduleId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  generatedReportId?: string;
  generatedPresentationId?: string;
  triggerType?: string;
  triggerReason?: string;
  deliverableType?: string;
  error?: string;
  deliveryResults: { method: string; status: string; details?: string; timestamp: string }[];
}

// ============================================
// TRIGGER TYPE LABELS
// ============================================

const TRIGGER_TYPE_OPTIONS = [
  { value: 'delay_threshold', labelKey: 'triggerDelayThreshold', icon: Clock },
  { value: 'risk_high', labelKey: 'triggerRiskHigh', icon: AlertTriangle },
  { value: 'budget_threshold', labelKey: 'triggerBudgetThreshold', icon: FileText },
  { value: 'milestone_reached', labelKey: 'triggerMilestone', icon: Check },
  { value: 'artifact_approved', labelKey: 'triggerArtifactApproved', icon: Check },
];

const SCHEDULE_TYPE_OPTIONS = [
  { value: 'time_based', labelKey: 'timeBased' },
  { value: 'event_triggered', labelKey: 'eventTriggered' },
  { value: 'hybrid', labelKey: 'hybrid' },
];

const DELIVERABLE_OPTIONS = [
  { value: 'report', labelKey: 'report', icon: FileText },
  { value: 'presentation', labelKey: 'presentation', icon: Presentation },
  { value: 'both', labelKey: 'both', icon: FileText },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', labelKey: 'daily' },
  { value: 'weekly', labelKey: 'weekly' },
  { value: 'biweekly', labelKey: 'biweekly' },
  { value: 'monthly', labelKey: 'monthly' },
  { value: 'quarterly', labelKey: 'quarterly' },
  { value: 'custom', labelKey: 'custom' },
];

const SCOPE_OPTIONS = [
  { value: 'organization', labelKey: 'scopeOrganization' },
  { value: 'portfolio', labelKey: 'scopePortfolio' },
  { value: 'project', labelKey: 'scopeProject' },
  { value: 'initiative', labelKey: 'scopeInitiative' },
];

// ============================================
// COMPONENT
// ============================================

export const ReportingAutomationWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const tp = (key: string, fallback?: string) => t(`reports.automation.${key}`, fallback || key);

  // State
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [triggerRules, setTriggerRules] = useState<TriggerRule[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'schedules' | 'history'>('schedules');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScheduleType, setFormScheduleType] = useState<string>('time_based');
  const [formDeliverableType, setFormDeliverableType] = useState<string>('report');
  const [formFrequency, setFormFrequency] = useState('weekly');
  const [formCron, setFormCron] = useState('');
  const [formTimezone, setFormTimezone] = useState('Europe/Warsaw');
  const [formScopeType, setFormScopeType] = useState('organization');
  const [formRecipients, setFormRecipients] = useState('');
  const [formDeliveryMethods, setFormDeliveryMethods] = useState<string[]>(['dashboard']);

  // Trigger form
  const [showAddTrigger, setShowAddTrigger] = useState(false);
  const [triggerFormType, setTriggerFormType] = useState('delay_threshold');
  const [triggerFormDelayDays, setTriggerFormDelayDays] = useState(5);
  const [triggerFormSeverity, setTriggerFormSeverity] = useState('high');
  const [triggerFormBudgetPct, setTriggerFormBudgetPct] = useState(90);
  const [triggerFormThrottleHours, setTriggerFormThrottleHours] = useState(24);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadSchedules = useCallback(async () => {
    try {
      const res = await Api.get('/api/scheduled-reports');
      setSchedules(res.data?.data || []);
    } catch {
      toast.error(tp('loadError'));
    }
  }, []);

  const loadTriggerRules = useCallback(async (scheduleId: string) => {
    try {
      const res = await Api.get(`/api/scheduled-reports/${scheduleId}/triggers`);
      setTriggerRules(res.data?.data || []);
    } catch {
      setTriggerRules([]);
    }
  }, []);

  const loadExecutions = useCallback(async (scheduleId: string) => {
    try {
      const res = await Api.get(`/api/scheduled-reports/${scheduleId}/history?limit=20`);
      setExecutions(res.data?.data || []);
    } catch {
      setExecutions([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadSchedules().finally(() => setLoading(false));
  }, [loadSchedules]);

  useEffect(() => {
    if (selectedScheduleId) {
      loadTriggerRules(selectedScheduleId);
      loadExecutions(selectedScheduleId);
    }
  }, [selectedScheduleId, loadTriggerRules, loadExecutions]);

  const selectedSchedule = useMemo(
    () => schedules.find((s) => s.id === selectedScheduleId),
    [schedules, selectedScheduleId]
  );

  // ============================================
  // HANDLERS
  // ============================================

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setActionLoading('create');
    try {
      const res = await Api.post('/api/scheduled-reports', {
        name: formName,
        description: formDescription,
        scheduleType: formScheduleType,
        deliverableType: formDeliverableType,
        reportType: 'management',
        frequency: formFrequency,
        cronExpression: formCron || undefined,
        timezone: formTimezone,
        scopeType: formScopeType,
        deliveryMethods: formDeliveryMethods,
        deliveryConfig: {
          email: formDeliveryMethods.includes('email')
            ? {
                recipients: formRecipients
                  .split(',')
                  .map((r) => r.trim())
                  .filter(Boolean),
              }
            : undefined,
        },
      });
      if (res.data?.data) {
        setSchedules((prev) => [res.data.data, ...prev]);
        setSelectedScheduleId(res.data.data.id);
        trackFunnelEvent('report_schedule_created', {
          scheduleType: formScheduleType,
          deliverableType: formDeliverableType,
        });
        toast.success(tp('created'));
      }
      setShowCreateModal(false);
      resetForm();
    } catch {
      toast.error(tp('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoading(id);
    try {
      await Api.post(`/api/scheduled-reports/${id}/pause`, {});
      setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, isActive: false } : s)));
      trackFunnelEvent('report_schedule_paused', { scheduleId: id });
      toast.success(tp('pausing'));
    } catch {
      toast.error(tp('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading(id);
    try {
      await Api.post(`/api/scheduled-reports/${id}/resume`, {});
      await loadSchedules();
      toast.success(tp('resuming'));
    } catch {
      toast.error(tp('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tp('confirmDelete'))) return;
    setActionLoading(id);
    try {
      await Api.delete(`/api/scheduled-reports/${id}`);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      if (selectedScheduleId === id) setSelectedScheduleId(null);
      toast.success(tp('deleted'));
    } catch {
      toast.error(tp('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunNow = async (id: string) => {
    setActionLoading(`run-${id}`);
    try {
      const res = await Api.post(`/api/scheduled-reports/${id}/execute`, {});
      const resData = (res as any)?.data || res;
      trackFunnelEvent('report_schedule_run_completed', {
        scheduleId: id,
        status: resData?.status,
      });
      toast.success(tp('runStarted'));
      loadExecutions(id);
      loadSchedules();
    } catch {
      toast.error(tp('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddTrigger = async () => {
    if (!selectedScheduleId) return;
    setActionLoading('add-trigger');
    try {
      const conditions: Record<string, unknown> = {};
      if (triggerFormType === 'delay_threshold') conditions.delayDays = triggerFormDelayDays;
      if (triggerFormType === 'risk_high') conditions.severity = triggerFormSeverity;
      if (triggerFormType === 'budget_threshold') conditions.budgetPercent = triggerFormBudgetPct;

      await Api.post(`/api/scheduled-reports/${selectedScheduleId}/triggers`, {
        triggerType: triggerFormType,
        conditions,
        throttleHours: triggerFormThrottleHours,
      });

      await loadTriggerRules(selectedScheduleId);
      setShowAddTrigger(false);
      toast.success(tp('triggerAdded'));
    } catch {
      toast.error(tp('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTrigger = async (ruleId: string) => {
    if (!selectedScheduleId) return;
    try {
      await Api.delete(`/api/scheduled-reports/${selectedScheduleId}/triggers/${ruleId}`);
      setTriggerRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast.success(tp('triggerRemoved'));
    } catch {
      toast.error(tp('error'));
    }
  };

  const handleEvaluateTriggers = async () => {
    setActionLoading('evaluate');
    try {
      const res = await Api.post('/api/scheduled-reports/evaluate-triggers', {});
      const data = (res as any)?.data || res;
      trackFunnelEvent('report_schedule_trigger_fired', {
        evaluated: data?.evaluated,
        fired: data?.fired,
      });
      toast.success(`${tp('evaluated')}: ${data?.evaluated}, ${tp('fired')}: ${data?.fired}`);
      if (selectedScheduleId) {
        loadExecutions(selectedScheduleId);
        loadTriggerRules(selectedScheduleId);
      }
    } catch {
      toast.error(tp('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormScheduleType('time_based');
    setFormDeliverableType('report');
    setFormFrequency('weekly');
    setFormCron('');
    setFormTimezone('Europe/Warsaw');
    setFormScopeType('organization');
    setFormRecipients('');
    setFormDeliveryMethods(['dashboard']);
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const statusBadge = (status: string | null, isActive?: boolean) => {
    if (isActive === false) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-700 text-c-text-secondary">
          {tp('paused')}
        </span>
      );
    }
    const colors: Record<string, string> = {
      success: 'bg-emerald-600 text-c-text',
      failed: 'bg-danger-600 text-c-text',
      running: 'bg-blue-600 text-c-text',
      pending: 'bg-amber-600 text-c-text',
    };
    return (
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded ${colors[status || ''] || 'bg-slate-600 text-c-text-secondary'}`}
      >
        {status ? tp(`execution${status.charAt(0).toUpperCase() + status.slice(1)}`) : tp('active')}
      </span>
    );
  };

  const scheduleTypeIcon = (type: string) => {
    switch (type) {
      case 'time_based':
        return <CalendarClock size={14} className="text-blue-400" />;
      case 'event_triggered':
        return <Zap size={14} className="text-amber-400" />;
      case 'hybrid':
        return <ScanSearch size={14} className="text-primary-400" />;
      default:
        return <CalendarClock size={14} className="text-c-text-secondary" />;
    }
  };

  const deliverableIcon = (type: string) => {
    switch (type) {
      case 'presentation':
        return <Presentation size={14} className="text-amber-400" />;
      case 'both':
        return <FileText size={14} className="text-primary-400" />;
      default:
        return <FileText size={14} className="text-blue-400" />;
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="h-full p-6">
        <LoadingState template="list" rows={6} />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* LEFT SIDEBAR — Schedule list */}
      <div className="w-72 shrink-0 border-r border-c-border-subtle bg-c-surface-raised flex flex-col">
        <div className="p-4 border-b border-c-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-c-text flex items-center gap-2">
              <CalendarClock size={16} className="text-primary-400" />
              {tp('title')}
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1.5 rounded-lg bg-navy-900 hover:bg-c-surface text-c-text dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors"
              title={tp('newSchedule')}
            >
              <Plus size={14} />
            </button>
          </div>
          <p className="text-xs text-c-text-muted">{tp('subtitle')}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {schedules.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CalendarClock className="w-10 h-10 text-c-text-secondary mx-auto mb-3" />
              <p className="text-sm text-c-text-secondary">{tp('noSchedules')}</p>
              <p className="text-xs text-c-text-muted mt-1">{tp('noSchedulesHint')}</p>
            </div>
          ) : (
            schedules.map((schedule) => (
              <button
                key={schedule.id}
                onClick={() => setSelectedScheduleId(schedule.id)}
                className={`w-full text-left px-4 py-3 border-b border-c-border-subtle hover:bg-c-surface-raised transition-colors ${
                  selectedScheduleId === schedule.id ? 'bg-c-surface-raised' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {scheduleTypeIcon(schedule.scheduleType)}
                  {deliverableIcon(schedule.deliverableType)}
                  <span className="text-sm font-medium text-c-text truncate flex-1">
                    {schedule.name}
                  </span>
                  <ChevronRight size={12} className="text-c-text-muted" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {statusBadge(schedule.lastRunStatus, schedule.isActive)}
                  <span className="text-xs text-c-text-muted">
                    {schedule.frequency} · {tp('runCount')}: {schedule.runCount}
                  </span>
                </div>
                {schedule.nextRunAt && (
                  <p className="text-[10px] text-c-text-secondary mt-1">
                    {tp('nextRun')}: {new Date(schedule.nextRunAt).toLocaleDateString()}
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Evaluate triggers button */}
        <div className="p-3 border-t border-c-border-subtle">
          <button
            onClick={handleEvaluateTriggers}
            disabled={actionLoading === 'evaluate'}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'evaluate' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ScanSearch size={12} />
            )}
            {tp('evaluateTriggers')}
          </button>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedSchedule ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <CalendarClock className="w-16 h-16 text-c-text-secondary mb-4" />
            <h3 className="text-lg font-semibold text-c-text mb-2">{tp('title')}</h3>
            <p className="text-sm text-c-text-secondary mb-6 max-w-md">{tp('noSchedulesHint')}</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-navy-900 hover:bg-c-surface text-c-text dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl font-medium transition-colors"
            >
              <Plus size={18} />
              {tp('newSchedule')}
            </button>
          </div>
        ) : (
          <>
            {/* Schedule header */}
            <div className="px-6 py-4 border-b border-c-border-subtle bg-c-surface-raised">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {scheduleTypeIcon(selectedSchedule.scheduleType)}
                    {deliverableIcon(selectedSchedule.deliverableType)}
                    <h2 className="text-lg font-semibold text-c-text">{selectedSchedule.name}</h2>
                    {statusBadge(selectedSchedule.lastRunStatus, selectedSchedule.isActive)}
                  </div>
                  {selectedSchedule.description && (
                    <p className="text-sm text-c-text-secondary mt-1">{selectedSchedule.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-c-text-muted">
                    <span>
                      {tp('frequency')}: {tp(selectedSchedule.frequency)}
                    </span>
                    <span>{selectedSchedule.timezone}</span>
                    <span>
                      {tp('runCount')}: {selectedSchedule.runCount}
                    </span>
                    {selectedSchedule.lastRunAt && (
                      <span>
                        {tp('lastRun')}: {new Date(selectedSchedule.lastRunAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunNow(selectedSchedule.id)}
                    disabled={actionLoading === `run-${selectedSchedule.id}`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-c-text text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === `run-${selectedSchedule.id}` ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                    {tp('runNow')}
                  </button>
                  {selectedSchedule.isActive ? (
                    <button
                      onClick={() => handlePause(selectedSchedule.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-c-text text-sm font-medium rounded-lg transition-colors"
                    >
                      <Pause size={14} />
                      {tp('pause')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResume(selectedSchedule.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-c-text text-sm font-medium rounded-lg transition-colors"
                    >
                      <Play size={14} />
                      {tp('resume')}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(selectedSchedule.id)}
                    className="p-2 text-c-text-secondary hover:text-danger-400 rounded-lg hover:bg-danger-500/10 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-c-border-subtle">
              <button
                onClick={() => setActiveTab('schedules')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'schedules'
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-c-text-secondary hover:text-c-text'
                }`}
              >
                {tp('triggers')}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-c-text-secondary hover:text-c-text'
                }`}
              >
                {tp('history')}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'schedules' && renderTriggersTab()}
              {activeTab === 'history' && renderHistoryTab()}
            </div>
          </>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && renderCreateModal()}
    </div>
  );

  // ============================================
  // TAB RENDERERS
  // ============================================

  function renderTriggersTab() {
    return (
      <div className="space-y-6">
        {/* Trigger rules section */}
        <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-c-text flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              {tp('triggers')}
            </h3>
            <button
              onClick={() => setShowAddTrigger(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={12} />
              {tp('addTrigger')}
            </button>
          </div>

          {triggerRules.length === 0 ? (
            <p className="text-sm text-c-text-muted">
              No trigger rules configured. Add triggers for event-based automation.
            </p>
          ) : (
            <div className="space-y-3">
              {triggerRules.map((rule) => {
                const opt = TRIGGER_TYPE_OPTIONS.find((o) => o.value === rule.triggerType);
                const IconComp = opt?.icon || Zap;
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg border border-c-border-subtle"
                  >
                    <div className="flex items-center gap-3">
                      <IconComp size={16} className="text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-c-text">
                          {opt ? tp(opt.labelKey) : rule.triggerType}
                        </p>
                        <p className="text-xs text-c-text-muted">
                          {tp('throttleHours')}: {rule.throttleHours}h · Fires: {rule.fireCount}
                          {rule.conditions && Object.keys(rule.conditions).length > 0 && (
                            <span> · {JSON.stringify(rule.conditions)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                          rule.isActive
                            ? 'bg-emerald-600 text-c-text'
                            : 'bg-slate-700 text-c-text-secondary'
                        }`}
                      >
                        {rule.isActive ? tp('active') : tp('paused')}
                      </span>
                      <button
                        onClick={() => handleDeleteTrigger(rule.id)}
                        className="p-1 text-c-text-muted hover:text-danger-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add trigger form */}
          {showAddTrigger && (
            <div className="mt-4 p-4 bg-c-surface-raised rounded-lg border border-c-border-subtle space-y-3">
              <div>
                <label className="block text-xs text-c-text-secondary mb-1">{tp('triggerType')}</label>
                <select
                  value={triggerFormType}
                  onChange={(e) => setTriggerFormType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
                >
                  {TRIGGER_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {tp(o.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              {triggerFormType === 'delay_threshold' && (
                <div>
                  <label className="block text-xs text-c-text-secondary mb-1">{tp('delayDays')}</label>
                  <input
                    type="number"
                    value={triggerFormDelayDays}
                    onChange={(e) => setTriggerFormDelayDays(Number(e.target.value))}
                    min={1}
                    className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
                  />
                </div>
              )}

              {triggerFormType === 'risk_high' && (
                <div>
                  <label className="block text-xs text-c-text-secondary mb-1">{tp('riskSeverity')}</label>
                  <select
                    value={triggerFormSeverity}
                    onChange={(e) => setTriggerFormSeverity(e.target.value)}
                    className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
                  >
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              )}

              {triggerFormType === 'budget_threshold' && (
                <div>
                  <label className="block text-xs text-c-text-secondary mb-1">{tp('budgetPercent')}</label>
                  <input
                    type="number"
                    value={triggerFormBudgetPct}
                    onChange={(e) => setTriggerFormBudgetPct(Number(e.target.value))}
                    min={50}
                    max={100}
                    className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-c-text-secondary mb-1">{tp('throttleHours')}</label>
                <input
                  type="number"
                  value={triggerFormThrottleHours}
                  onChange={(e) => setTriggerFormThrottleHours(Number(e.target.value))}
                  min={1}
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddTrigger}
                  disabled={actionLoading === 'add-trigger'}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-c-text text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'add-trigger' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  {tp('addTrigger')}
                </button>
                <button
                  onClick={() => setShowAddTrigger(false)}
                  className="px-4 py-2 text-c-text-secondary hover:text-c-text text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderHistoryTab() {
    if (executions.length === 0) {
      return (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-c-text-secondary mx-auto mb-3" />
          <p className="text-sm text-c-text-secondary">{tp('noHistory')}</p>
          <p className="text-xs text-c-text-muted mt-1">{tp('noHistoryHint')}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {executions.map((exec) => (
          <div
            key={exec.id}
            className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] flex items-start justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {statusBadge(exec.status)}
                {exec.triggerType && (
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-700 text-c-text-secondary">
                    {exec.triggerType}
                  </span>
                )}
                {exec.deliverableType && (
                  <span className="text-xs text-c-text-muted">{exec.deliverableType}</span>
                )}
              </div>
              {exec.triggerReason && (
                <p className="text-xs text-c-text-secondary mt-1">
                  {tp('triggerReason')}: {exec.triggerReason}
                </p>
              )}
              {exec.error && <p className="text-xs text-danger-400 mt-1">{exec.error}</p>}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-c-text-secondary">
                <span>Started: {new Date(exec.startedAt).toLocaleString()}</span>
                {exec.completedAt && (
                  <span>Completed: {new Date(exec.completedAt).toLocaleString()}</span>
                )}
              </div>
              {exec.deliveryResults.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  {exec.deliveryResults.map((dr, i) => (
                    <span
                      key={i}
                      className={`px-1.5 py-0.5 text-[10px] rounded ${
                        dr.status === 'success'
                          ? 'bg-emerald-600/20 text-emerald-300'
                          : 'bg-danger-600/20 text-danger-300'
                      }`}
                    >
                      {dr.method}: {dr.status}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ============================================
  // CREATE MODAL
  // ============================================

  function renderCreateModal() {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-c-surface rounded-2xl border border-slate-200/60 dark:border-white/[0.03] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle">
            <h3 className="text-lg font-semibold text-c-text">{tp('newSchedule')}</h3>
            <button
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="p-1 text-c-text-secondary hover:text-c-text transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-c-text-secondary mb-1">{tp('scheduleName')}</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={tp('scheduleNamePlaceholder')}
                className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text placeholder-slate-600"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-c-text-secondary mb-1">Description</label>
              <input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text placeholder-slate-600"
              />
            </div>

            {/* Schedule type */}
            <div>
              <label className="block text-xs text-c-text-secondary mb-1">{tp('scheduleType')}</label>
              <select
                value={formScheduleType}
                onChange={(e) => setFormScheduleType(e.target.value)}
                className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
              >
                {SCHEDULE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {tp(o.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* Deliverable type */}
            <div>
              <label className="block text-xs text-c-text-secondary mb-1">{tp('deliverableType')}</label>
              <select
                value={formDeliverableType}
                onChange={(e) => setFormDeliverableType(e.target.value)}
                className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
              >
                {DELIVERABLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {tp(o.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* Frequency (for time-based) */}
            {formScheduleType !== 'event_triggered' && (
              <div>
                <label className="block text-xs text-c-text-secondary mb-1">{tp('frequency')}</label>
                <select
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(e.target.value)}
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
                >
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {tp(o.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cron expression (for custom frequency) */}
            {formFrequency === 'custom' && formScheduleType !== 'event_triggered' && (
              <div>
                <label className="block text-xs text-c-text-secondary mb-1">{tp('cronExpression')}</label>
                <input
                  value={formCron}
                  onChange={(e) => setFormCron(e.target.value)}
                  placeholder="0 9 * * 1"
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text font-mono placeholder-slate-600"
                />
              </div>
            )}

            {/* Timezone */}
            <div>
              <label className="block text-xs text-c-text-secondary mb-1">{tp('timezone')}</label>
              <input
                value={formTimezone}
                onChange={(e) => setFormTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
              />
            </div>

            {/* Scope */}
            <div>
              <label className="block text-xs text-c-text-secondary mb-1">{tp('scope')}</label>
              <select
                value={formScopeType}
                onChange={(e) => setFormScopeType(e.target.value)}
                className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text"
              >
                {SCOPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {tp(o.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipients */}
            <div>
              <label className="block text-xs text-c-text-secondary mb-1">{tp('recipients')}</label>
              <input
                value={formRecipients}
                onChange={(e) => setFormRecipients(e.target.value)}
                placeholder={tp('recipientsPlaceholder')}
                className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text placeholder-slate-600"
              />
            </div>

            {/* Delivery methods */}
            <div>
              <label className="block text-xs text-c-text-secondary mb-1">{tp('delivery')}</label>
              <div className="flex items-center gap-4 mt-1">
                {(['dashboard', 'email', 'webhook'] as const).map((method) => (
                  <label key={method} className="flex items-center gap-1.5 text-sm text-c-text-secondary">
                    <input
                      type="checkbox"
                      checked={formDeliveryMethods.includes(method)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormDeliveryMethods((prev) => [...prev, method]);
                        } else {
                          setFormDeliveryMethods((prev) => prev.filter((m) => m !== method));
                        }
                      }}
                      className="rounded border-c-border-subtle"
                    />
                    {tp(`delivery${method.charAt(0).toUpperCase() + method.slice(1)}`)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-c-border-subtle">
            <button
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="px-4 py-2 text-sm text-c-text-secondary hover:text-c-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formName.trim() || actionLoading === 'create'}
              className="flex items-center gap-2 px-5 py-2 bg-navy-900 hover:bg-c-surface text-c-text dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading === 'create' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {tp('newSchedule')}
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default ReportingAutomationWorkspace;
