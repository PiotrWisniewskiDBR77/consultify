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
  const { i18n } = useTranslation();
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
      toast.error(isPl ? 'Nie udało się pobrać automatyzacji' : 'Failed to load automations');
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
          ? isPl
            ? 'Automatyzacja wstrzymana'
            : 'Automation paused'
          : isPl
            ? 'Automatyzacja aktywowana'
            : 'Automation activated'
      );
    } catch {
      toast.error(isPl ? 'Nie udało się zmienić statusu' : 'Failed to toggle');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await TablePlatformApi.deleteAutomation(id);
      setAutomations((prev) => prev.filter((a) => a.id !== id));
      toast.success(isPl ? 'Automatyzacja usunięta' : 'Automation deleted');
    } catch {
      toast.error(isPl ? 'Nie udało się usunąć' : 'Failed to delete');
    }
  };

  const handleRunNow = async (auto: Automation) => {
    try {
      await TablePlatformApi.runAutomationNow(auto.id);
      toast.success(isPl ? 'Uruchomiono' : 'Triggered');
    } catch {
      toast.error(isPl ? 'Nie udało się uruchomić' : 'Failed to trigger');
    }
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
      toast.success(isPl ? 'Automatyzacja utworzona' : 'Automation created');
      setView('list');
      await fetchAutomations();
    } catch {
      toast.error(isPl ? 'Nie udało się utworzyć' : 'Failed to create');
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
      toast.success(isPl ? 'Automatyzacja zaktualizowana' : 'Automation updated');
      setView('list');
      setEditTarget(null);
      await fetchAutomations();
    } catch {
      toast.error(isPl ? 'Nie udało się zaktualizować' : 'Failed to update');
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
      toast.error(isPl ? 'Nie udało się pobrać historii' : 'Failed to load history');
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
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-navy-700">
          <button
            onClick={() => {
              setView('list');
              setEditTarget(null);
            }}
            className="rounded-lg p-1 transition-colors hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <ChevronLeft size={16} className="text-slate-400" />
          </button>
          <Zap size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            {view === 'edit'
              ? isPl
                ? 'Edytuj automatyzację'
                : 'Edit Automation'
              : isPl
                ? 'Nowa automatyzacja'
                : 'New Automation'}
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
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-navy-700">
          <button
            onClick={() => {
              setView('list');
              setHistoryTarget(null);
            }}
            className="rounded-lg p-1 transition-colors hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <ChevronLeft size={16} className="text-slate-400" />
          </button>
          <Clock size={16} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            {isPl ? 'Historia uruchomień' : 'Run History'}
            <span className="ml-1 font-normal text-slate-400">— {historyTarget.name}</span>
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {runsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : runs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {isPl ? 'Brak historii uruchomień.' : 'No run history yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-navy-700 dark:bg-navy-900"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {run.status === 'completed' && (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    )}
                    {run.status === 'failed' && <XCircle size={16} className="text-rose-500" />}
                    {run.status === 'running' && (
                      <Loader2 size={16} className="animate-spin text-blue-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-800 dark:text-white">
                        {run.status === 'completed'
                          ? isPl
                            ? 'Sukces'
                            : 'Success'
                          : run.status === 'failed'
                            ? isPl
                              ? 'Błąd'
                              : 'Error'
                            : isPl
                              ? 'W toku'
                              : 'Running'}
                      </span>
                      {run.duration_ms != null && (
                        <span className="text-[10px] text-slate-400">{run.duration_ms}ms</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {formatTime(run.started_at)}
                    </div>
                    {run.error && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
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
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <ChevronLeft size={16} className="text-slate-400" />
          </button>
          <Zap size={18} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            {isPl ? 'Automatyzacje' : 'Automations'}
            {automations.length > 0 && (
              <span className="ml-1 font-normal text-slate-400">({automations.length})</span>
            )}
          </h3>
        </div>
        <button
          onClick={() => setView('create')}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
        >
          <Plus size={12} />
          {isPl ? 'Nowa' : 'New'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-2xl bg-slate-100 p-4 dark:bg-navy-800">
              <Zap size={28} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              {isPl ? 'Brak automatyzacji' : 'No automations yet'}
            </p>
            <p className="mb-4 max-w-xs text-xs text-slate-500 dark:text-slate-400">
              {isPl
                ? 'Automatyzuj powtarzalne zadania — aktualizuj rekordy, wysyłaj powiadomienia i więcej.'
                : 'Automate repetitive tasks — update records, send notifications, and more.'}
            </p>
            <button
              onClick={() => setView('create')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              <Plus size={14} />
              {isPl ? 'Utwórz automatyzację' : 'Create automation'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {automations.map((auto) => (
              <div
                key={auto.id}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 dark:border-navy-700 dark:bg-navy-900 dark:hover:border-navy-600"
              >
                {/* Status dot */}
                <div className="flex-shrink-0">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      auto.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-white">
                      {auto.name}
                    </span>
                    {!auto.enabled && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-navy-800">
                        {isPl ? 'Wstrzymana' : 'Paused'}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {triggerDescription(auto, !!isPl)}
                    <span className="ml-2 text-slate-400">
                      → {auto.actions.length} {isPl ? 'akcji' : 'action(s)'}
                    </span>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(auto)}
                  className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                    auto.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                  title={auto.enabled ? (isPl ? 'Wyłącz' : 'Disable') : isPl ? 'Włącz' : 'Enable'}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      auto.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>

                {/* Actions menu */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setMenuOpen(menuOpen === auto.id ? null : auto.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-navy-800 dark:hover:text-slate-300"
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {menuOpen === auto.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-navy-700 dark:bg-navy-900">
                        <MenuBtn
                          icon={<Play size={13} />}
                          label={isPl ? 'Uruchom teraz' : 'Run now'}
                          onClick={() => {
                            setMenuOpen(null);
                            handleRunNow(auto);
                          }}
                        />
                        <MenuBtn
                          icon={<Clock size={13} />}
                          label={isPl ? 'Historia' : 'History'}
                          onClick={() => {
                            setMenuOpen(null);
                            openHistory(auto);
                          }}
                        />
                        <MenuBtn
                          icon={<Pencil size={13} />}
                          label={isPl ? 'Edytuj' : 'Edit'}
                          onClick={() => {
                            setMenuOpen(null);
                            setEditTarget(auto);
                            setView('edit');
                          }}
                        />
                        <div className="my-1 border-t border-slate-100 dark:border-navy-800" />
                        <MenuBtn
                          icon={<Trash2 size={13} />}
                          label={isPl ? 'Usuń' : 'Delete'}
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
        ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default AutomationsManager;
