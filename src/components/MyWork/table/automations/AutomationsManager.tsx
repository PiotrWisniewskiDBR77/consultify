/**
 * AutomationsManager — Full management UI for table automations.
 * List, create (wizard), toggle, delete, and view run history.
 */
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  PowerOff,
  Settings2,
  Trash2,
  Webhook,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { AutomationBuilder, type AutomationFormData } from './AutomationBuilder';

// ─── Types ───────────────────────────────────────────────────────

interface Automation {
  id: string;
  baseId: string;
  tableId: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actions: Array<{
    id: string;
    actionOrder: number;
    actionType: string;
    actionConfig: Record<string, unknown>;
  }>;
}

interface AutomationRun {
  id: string;
  automation_id: string;
  trigger_record_id: string | null;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error: string | null;
  action_results: any[] | null;
}

type ManagerView = 'list' | 'create' | 'edit' | 'history';

interface AutomationsManagerProps {
  tableId: string;
  baseId: string;
  fields?: Array<{ id: string; name: string; fieldType: string }>;
  onClose: () => void;
}

// ─── Trigger label helpers ───────────────────────────────────────

const TRIGGER_LABELS: Record<string, { en: string; pl: string }> = {
  record_created: { en: 'When record created', pl: 'Gdy rekord utworzony' },
  record_updated: { en: 'When record updated', pl: 'Gdy rekord zmieniony' },
  record_matches_conditions: { en: 'When conditions met', pl: 'Gdy warunki spełnione' },
  scheduled: { en: 'Scheduled', pl: 'Zaplanowane' },
  webhook_received: { en: 'Webhook received', pl: 'Webhook odebrany' },
};

function triggerDescription(auto: Automation, isPl: boolean): string {
  const base = TRIGGER_LABELS[auto.triggerType]?.[isPl ? 'pl' : 'en'] ?? auto.triggerType;
  if (auto.triggerType === 'scheduled' && auto.triggerConfig?.cron) {
    return `${base}: ${auto.triggerConfig.cron}`;
  }
  return base;
}

// ─── Component ───────────────────────────────────────────────────

export const AutomationsManager: React.FC<AutomationsManagerProps> = ({
  tableId,
  baseId,
  fields = [],
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [view, setView] = useState<ManagerView>('list');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Automation | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Run history
  const [historyTarget, setHistoryTarget] = useState<Automation | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TablePlatformApi.listAutomations(tableId);
      setAutomations(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t('myWorkTable.automationsManager.failedToLoadAutomations'));
    } finally {
      setLoading(false);
    }
  }, [tableId, isPl]);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const handleToggle = async (auto: Automation) => {
    try {
      await TablePlatformApi.toggleAutomation(auto.id, !auto.enabled);
      setAutomations((prev) =>
        prev.map((a) => (a.id === auto.id ? { ...a, enabled: !a.enabled } : a))
      );
      toast.success(
        auto.enabled
          ? t('myWorkTable.automationsManager.automationPaused')
          : t('myWorkTable.automationsManager.automationActivated')
      );
    } catch {
      toast.error(t('myWorkTable.automationsManager.failedToToggle'));
    }
  };

  // Program B (E02) — dwie ścieżki, jedna funkcja rejestru: klik człowieka =
  // `ctx.params.run` (rejestr wykonuje ORYGINALNY callback wprost); Teresa =
  // ta sama funkcja rejestru woła REST bezpośrednio (`runTableAutomation*Callback`
  // w `ideaActionRegistry.ts`).
  const runAutomationAction = (
    actionId: string,
    run: () => void,
    params?: Record<string, unknown>
  ) => {
    const ctx: ActionContext = {
      ideaId: baseId,
      tool: 'table',
      selection: EMPTY_SELECTION,
      surface: 'panel',
      source: 'ui',
      language: isPl ? 'pl' : 'en',
      params: { run, ...(params || {}) },
    };
    void runIdeaAction(actionId, ctx);
  };

  const handleDelete = (id: string) => {
    runAutomationAction(
      'table.automation.delete',
      async () => {
        try {
          await TablePlatformApi.deleteAutomation(id);
          setAutomations((prev) => prev.filter((a) => a.id !== id));
          toast.success(t('myWorkTable.automationsManager.automationDeleted'));
        } catch {
          toast.error(t('myWorkTable.automationsManager.failedToDelete'));
        }
      },
      { automationId: id }
    );
  };

  const handleRunNow = (auto: Automation) => {
    runAutomationAction(
      'table.automation.run_now',
      async () => {
        try {
          await TablePlatformApi.runAutomationNow(auto.id);
          toast.success(t('myWorkTable.automationsManager.triggered'));
        } catch {
          toast.error(t('myWorkTable.automationsManager.failedToTrigger'));
        }
      },
      { automationId: auto.id }
    );
  };

  const handleCreate = async (data: AutomationFormData) => {
    setSaving(true);
    try {
      await TablePlatformApi.createAutomation(tableId, {
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig,
        actions: data.actions.map((a) => ({
          actionType: a.actionType,
          actionConfig: a.actionConfig,
        })),
      });
      toast.success(t('myWorkTable.automationsManager.automationCreated'));
      setView('list');
      await fetchAutomations();
    } catch {
      toast.error(t('myWorkTable.automationsManager.failedToCreate'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (data: AutomationFormData) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await TablePlatformApi.deleteAutomation(editTarget.id);
      await TablePlatformApi.createAutomation(tableId, {
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig,
        actions: data.actions.map((a) => ({
          actionType: a.actionType,
          actionConfig: a.actionConfig,
        })),
      });
      toast.success(t('myWorkTable.automationsManager.automationUpdated'));
      setView('list');
      setEditTarget(null);
      await fetchAutomations();
    } catch {
      toast.error(t('myWorkTable.automationsManager.failedToUpdate'));
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (auto: Automation) => {
    setHistoryTarget(auto);
    setView('history');
    setRunsLoading(true);
    try {
      const data = await TablePlatformApi.getAutomationRuns(auto.id, 50);
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t('myWorkTable.automationsManager.failedToLoadHistory'));
    } finally {
      setRunsLoading(false);
    }
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(isPl ? 'pl-PL' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(iso);
    }
  };

  // ─── Create / Edit view ──────────────────────────────────────
  if (view === 'create' || view === 'edit') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-c-border-subtle px-5 py-4 border-c-border-subtle">
          <button
            onClick={() => {
              setView('list');
              setEditTarget(null);
            }}
            className="rounded-lg p-1 transition-colors hover:bg-c-surface-raised"
          >
            <ChevronLeft size={16} className="text-c-text-secondary" />
          </button>
          <Zap size={16} className="text-c-warning" />
          <h3 className="text-sm font-semibold text-c-text">
            {view === 'edit'
              ? t('myWorkTable.automationsManager.editAutomation')
              : t('myWorkTable.automationsManager.newAutomation')}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <AutomationBuilder
            initialData={
              editTarget
                ? {
                    name: editTarget.name,
                    description: editTarget.description ?? '',
                    triggerType: editTarget.triggerType as any,
                    triggerConfig: editTarget.triggerConfig,
                    actions: editTarget.actions.map((a) => ({
                      id: a.id,
                      actionType: a.actionType as any,
                      actionConfig: a.actionConfig,
                    })),
                    enabled: editTarget.enabled,
                  }
                : undefined
            }
            onSave={view === 'edit' ? handleEdit : handleCreate}
            onCancel={() => {
              setView('list');
              setEditTarget(null);
            }}
            saving={saving}
            fields={fields}
          />
        </div>
      </div>
    );
  }

  // ─── History view ────────────────────────────────────────────
  if (view === 'history' && historyTarget) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-c-border-subtle px-5 py-4 border-c-border-subtle">
          <button
            onClick={() => {
              setView('list');
              setHistoryTarget(null);
            }}
            className="rounded-lg p-1 transition-colors hover:bg-c-surface-raised"
          >
            <ChevronLeft size={16} className="text-c-text-secondary" />
          </button>
          <Clock size={16} className="text-c-info" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('myWorkTable.automationsManager.runHistory')}
            <span className="ml-1 font-normal text-c-text-secondary">— {historyTarget.name}</span>
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {runsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-c-text-secondary" />
            </div>
          ) : runs.length === 0 ? (
            <div className="py-12 text-center text-xs text-c-text-secondary">
              {t('myWorkTable.automationsManager.noRunHistoryYet')}
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3 border-c-border-subtle bg-c-surface"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {run.status === 'completed' && (
                      <CheckCircle2 size={16} className="text-c-success" />
                    )}
                    {run.status === 'failed' && <XCircle size={16} className="text-c-danger" />}
                    {run.status === 'running' && (
                      <Loader2 size={16} className="animate-spin text-c-info" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-c-text">
                        {run.status === 'completed'
                          ? t('myWorkTable.automationsManager.success')
                          : run.status === 'failed'
                            ? t('myWorkTable.automationsManager.error')
                            : t('myWorkTable.automationsManager.running')}
                      </span>
                      {run.duration_ms != null && (
                        <span className="text-[10px] text-c-text-secondary">
                          {run.duration_ms}ms
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-c-text-muted">
                      {formatTime(run.started_at)}
                    </div>
                    {run.error && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] px-2.5 py-1.5 text-[11px] text-c-danger bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)] text-c-danger">
                        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                        <span className="break-all">{run.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── List view (default) ─────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-c-border-subtle px-5 py-4 border-c-border-subtle">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-c-surface-raised"
          >
            <ChevronLeft size={16} className="text-c-text-secondary" />
          </button>
          <Zap size={18} className="text-c-warning" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('myWorkTable.automationsManager.automations')}
            {automations.length > 0 && (
              <span className="ml-1 font-normal text-c-text-secondary">({automations.length})</span>
            )}
          </h3>
        </div>
        <button
          onClick={() => setView('create')}
          className="inline-flex items-center gap-1 rounded-lg bg-c-warning px-2.5 py-1.5 text-xs font-medium text-c-warning transition-colors hover:bg-c-warning text-c-warning hover:bg-c-warning"
        >
          <Plus size={12} />
          {t('myWorkTable.automationsManager.new')}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-c-text-secondary" />
          </div>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-2xl bg-c-surface-raised p-4 bg-c-surface-raised">
              <Zap size={28} className="text-c-text-muted" />
            </div>
            <p className="mb-1 text-sm font-medium text-c-text-muted">
              {t('myWorkTable.automationsManager.noAutomationsYet')}
            </p>
            <p className="mb-4 max-w-xs text-xs text-c-text-muted">
              {t('myWorkTable.automationsManager.automateRepetitiveTasksUpdateRecords')}
            </p>
            <button
              onClick={() => setView('create')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-c-warning px-4 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-warning"
            >
              <Plus size={14} />
              {t('myWorkTable.automationsManager.createAutomation')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {automations.map((auto) => (
              <div
                key={auto.id}
                className="group flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3 transition-colors hover:border-c-border-subtle bg-c-surface hover:border-c-border-subtle"
              >
                {/* Status dot */}
                <div className="flex-shrink-0">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      auto.enabled ? 'bg-c-success' : 'bg-c-surface-raised'
                    }`}
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-c-text">{auto.name}</span>
                    {!auto.enabled && (
                      <span className="rounded bg-c-surface-raised px-1.5 py-0.5 text-[10px] text-c-text-secondary bg-c-surface-raised">
                        {t('myWorkTable.automationsManager.paused')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-c-text-muted">
                    {triggerDescription(auto, !!isPl)}
                    <span className="ml-2 text-c-text-secondary">
                      → {auto.actions.length} {t('myWorkTable.automationsManager.actionS')}
                    </span>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(auto)}
                  className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                    auto.enabled ? 'bg-c-success' : 'bg-c-surface-raised'
                  }`}
                  title={
                    auto.enabled
                      ? t('myWorkTable.automationsManager.disable')
                      : t('myWorkTable.automationsManager.enable')
                  }
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-c-surface shadow transition-transform ${
                      auto.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>

                {/* Actions menu */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setMenuOpen(menuOpen === auto.id ? null : auto.id)}
                    className="rounded-lg p-1.5 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text-muted"
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {menuOpen === auto.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface py-1 shadow-xl border-c-border-subtle bg-c-surface">
                        <MenuBtn
                          icon={<Play size={13} />}
                          label={t('myWorkTable.automationsManager.runNow')}
                          onClick={() => {
                            setMenuOpen(null);
                            handleRunNow(auto);
                          }}
                        />
                        <MenuBtn
                          icon={<Clock size={13} />}
                          label={t('myWorkTable.automationsManager.history')}
                          onClick={() => {
                            setMenuOpen(null);
                            openHistory(auto);
                          }}
                        />
                        <MenuBtn
                          icon={<Pencil size={13} />}
                          label={t('myWorkTable.automationsManager.edit')}
                          onClick={() => {
                            setMenuOpen(null);
                            setEditTarget(auto);
                            setView('edit');
                          }}
                        />
                        <div className="my-1 border-t border-c-border-subtle" />
                        <MenuBtn
                          icon={<Trash2 size={13} />}
                          label={t('myWorkTable.automationsManager.delete')}
                          danger
                          onClick={() => {
                            setMenuOpen(null);
                            handleDelete(auto.id);
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Shared menu button ──────────────────────────────────────────

const MenuBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon, label, danger, onClick }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors ${
      danger
        ? 'text-c-danger hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] text-c-danger hover:bg-c-danger'
        : 'text-c-text-secondary hover:bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default AutomationsManager;
