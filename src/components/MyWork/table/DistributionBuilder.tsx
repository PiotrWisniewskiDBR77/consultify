/**
 * DistributionBuilder — Create, manage, and execute data distributions
 * via email, Slack, Teams, or webhook.
 */
import {
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Power,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import { EmptyState, LoadingState } from '@/components/shared/states';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

interface DistributionBuilderProps {
  baseId: string;
  onClose: () => void;
}

type Channel = 'email' | 'slack' | 'teams' | 'webhook';
type Format = 'csv' | 'xlsx' | 'pdf' | 'png' | 'json';

interface DistributionFormState {
  name: string;
  sourceType: 'view' | 'table';
  sourceId: string;
  channel: Channel;
  channelConfig: Record<string, unknown>;
  format: Format;
  schedule: string;
}

const CHANNELS: {
  id: Channel;
  labelEn: string;
  labelPl: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: 'email', labelEn: 'Email', labelPl: 'Email', icon: Mail },
  { id: 'slack', labelEn: 'Slack', labelPl: 'Slack', icon: MessageSquare },
  { id: 'teams', labelEn: 'Teams', labelPl: 'Teams', icon: MessageSquare },
  { id: 'webhook', labelEn: 'Webhook', labelPl: 'Webhook', icon: Globe },
];

const FORMATS: { id: Format; label: string }[] = [
  { id: 'csv', label: 'CSV' },
  { id: 'xlsx', label: 'XLSX' },
  { id: 'json', label: 'JSON' },
  { id: 'pdf', label: 'PDF' },
  { id: 'png', label: 'PNG' },
];

const INITIAL_FORM: DistributionFormState = {
  name: '',
  sourceType: 'table',
  sourceId: '',
  channel: 'email',
  channelConfig: {},
  format: 'csv',
  schedule: '',
};

export function DistributionBuilder({ baseId, onClose }: DistributionBuilderProps) {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [distributions, setDistributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DistributionFormState>({ ...INITIAL_FORM });
  const [executingId, setExecutingId] = useState<string | null>(null);

  const loadDistributions = useCallback(async () => {
    try {
      setLoading(true);
      const list = await TablePlatformApi.listDistributions(baseId);
      setDistributions(Array.isArray(list) ? list : []);
    } catch {
      toast.error(t('myWorkTable.distributionBuilder.failedToLoadDistributions'));
    } finally {
      setLoading(false);
    }
  }, [baseId, isPl]);

  useEffect(() => {
    loadDistributions();
  }, [loadDistributions]);

  // Program B (E02) — dwie ścieżki, jedna funkcja rejestru (klik człowieka =
  // `ctx.params.run`, wykonuje ORYGINALNY callback wprost; Teresa = ta sama
  // funkcja rejestru woła REST bezpośrednio, patrz `runTableDistribution*Callback`
  // w `ideaActionRegistry.ts`, aliasowane `table.distribution_builder.*`).
  const runDistributionAction = (
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

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error(t('myWorkTable.distributionBuilder.nameIsRequired'));
      return;
    }
    runDistributionAction(
      'table.distribution_builder.create',
      async () => {
        try {
          setCreating(true);
          await TablePlatformApi.createDistribution(baseId, {
            name: form.name.trim(),
            sourceType: form.sourceType,
            sourceId: form.sourceId || baseId,
            channel: form.channel,
            channelConfig: form.channelConfig,
            format: form.format,
            schedule: form.schedule || undefined,
          });
          toast.success(t('myWorkTable.distributionBuilder.distributionCreated'));
          setShowForm(false);
          setForm({ ...INITIAL_FORM });
          await loadDistributions();
        } catch {
          toast.error(t('myWorkTable.distributionBuilder.failedToCreate'));
        } finally {
          setCreating(false);
        }
      },
      {
        baseId,
        name: form.name.trim(),
        sourceType: form.sourceType,
        sourceId: form.sourceId || baseId,
        channel: form.channel,
        channelConfig: form.channelConfig,
        format: form.format,
        schedule: form.schedule || undefined,
      }
    );
  };

  const handleDelete = (id: string) => {
    runDistributionAction(
      'table.distribution_builder.delete',
      async () => {
        try {
          await TablePlatformApi.deleteDistribution(id);
          toast.success(t('myWorkTable.distributionBuilder.deleted'));
          setDistributions((prev) => prev.filter((d) => d.id !== id));
        } catch {
          toast.error(t('myWorkTable.distributionBuilder.failedToDelete'));
        }
      },
      { distributionId: id }
    );
  };

  const handleToggle = async (id: string) => {
    try {
      const updated = await TablePlatformApi.toggleDistribution(id);
      setDistributions((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch {
      toast.error(t('myWorkTable.distributionBuilder.failedToToggle'));
    }
  };

  const handleExecute = (id: string) => {
    runDistributionAction(
      'table.distribution_builder.execute',
      async () => {
        try {
          setExecutingId(id);
          const result = await TablePlatformApi.executeDistribution(id);
          toast.success(
            t('myWorkTable.distributionBuilder.sentRecordsVia', {
              records: result.recordCount,
              channel: result.channel,
            })
          );
          await loadDistributions();
        } catch {
          toast.error(t('myWorkTable.distributionBuilder.sendFailed'));
        } finally {
          setExecutingId(null);
        }
      },
      { distributionId: id }
    );
  };

  const updateChannelConfig = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      channelConfig: { ...prev.channelConfig, [key]: value },
    }));
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: true, onClose, containerRef });

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="distribution-builder-heading"
        tabIndex={-1}
        className="w-[600px] max-w-[95vw] max-h-[85vh] bg-c-surface rounded-2xl border border-slate-200/60 dark:border-white/[0.03] shadow-2xl overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-blue-600 dark:text-blue-400" />
            <h2 id="distribution-builder-heading" className="text-sm font-semibold text-c-text">
              {t('myWorkTable.distributionBuilder.distributions')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="p-1 rounded-lg text-c-text-secondary hover:text-c-text-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Create button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={12} />
              {t('myWorkTable.distributionBuilder.newDistribution')}
            </button>
          )}

          {/* Create form */}
          {showForm && (
            <div className="rounded-xl border border-c-border-subtle p-4 space-y-3 bg-c-surface-raised">
              <div>
                <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                  {t('myWorkTable.distributionBuilder.name')}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder={t('myWorkTable.distributionBuilder.eGWeeklyReport')}
                />
              </div>

              {/* Source type */}
              <div>
                <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                  {t('myWorkTable.distributionBuilder.sourceType')}
                </label>
                <select
                  value={form.sourceType}
                  onChange={(e) => setForm((p) => ({ ...p, sourceType: e.target.value as any }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text outline-none"
                >
                  <option value="table">{t('myWorkTable.distributionBuilder.table')}</option>
                  <option value="view">{t('myWorkTable.distributionBuilder.view')}</option>
                </select>
              </div>

              {/* Source ID */}
              <div>
                <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                  {t('myWorkTable.distributionBuilder.sourceId')}
                </label>
                <input
                  type="text"
                  value={form.sourceId}
                  onChange={(e) => setForm((p) => ({ ...p, sourceId: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder={t('myWorkTable.distributionBuilder.tableOrViewId')}
                />
              </div>

              {/* Channel */}
              <div>
                <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                  {t('myWorkTable.distributionBuilder.channel')}
                </label>
                <div className="flex gap-1.5">
                  {CHANNELS.map((ch) => {
                    const Icon = ch.icon;
                    return (
                      <button
                        key={ch.id}
                        onClick={() =>
                          setForm((p) => ({ ...p, channel: ch.id, channelConfig: {} }))
                        }
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                          form.channel === ch.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                        }`}
                      >
                        <Icon size={12} />
                        {isPl ? ch.labelPl : ch.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Channel config */}
              <div>
                {form.channel === 'email' && (
                  <div>
                    <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                      {t('myWorkTable.distributionBuilder.emailAddressesCommaSeparated')}
                    </label>
                    <input
                      type="text"
                      value={(form.channelConfig.to as string) || ''}
                      onChange={(e) => updateChannelConfig('to', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="user@example.com, team@example.com"
                    />
                  </div>
                )}
                {(form.channel === 'slack' || form.channel === 'teams') && (
                  <div>
                    <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                      {t('ideas.table.distributionBuilder.webhookUrl', 'Webhook URL')}
                    </label>
                    <input
                      type="url"
                      value={(form.channelConfig.webhookUrl as string) || ''}
                      onChange={(e) => updateChannelConfig('webhookUrl', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                )}
                {form.channel === 'webhook' && (
                  <div>
                    <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                      {t('ideas.table.distributionBuilder.webhookUrl', 'Webhook URL')}
                    </label>
                    <input
                      type="url"
                      value={(form.channelConfig.url as string) || ''}
                      onChange={(e) => updateChannelConfig('url', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="https://api.example.com/webhook"
                    />
                  </div>
                )}
              </div>

              {/* Format */}
              <div>
                <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                  {t('myWorkTable.distributionBuilder.format')}
                </label>
                <div className="flex gap-1.5">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setForm((p) => ({ ...p, format: f.id }))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        form.format === f.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                  {t('myWorkTable.distributionBuilder.scheduleCronOptional')}
                </label>
                <input
                  type="text"
                  value={form.schedule}
                  onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="0 9 * * 1 (Mon 9am)"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating && <Loader2 size={12} className="animate-spin" />}
                  {t('myWorkTable.distributionBuilder.create')}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setForm({ ...INITIAL_FORM });
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-c-text-muted hover:text-c-text transition-colors"
                >
                  {t('myWorkTable.distributionBuilder.cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Distribution list */}
          {loading ? (
            <LoadingState template="list" rows={3} />
          ) : distributions.length === 0 && !showForm ? (
            <EmptyState
              variant="new"
              icon={Send}
              compact
              title={t('myWorkTable.distributionBuilder.noDistributionsYet')}
              description={t('myWorkTable.distributionBuilder.createYourFirstDistributionTo')}
            />
          ) : (
            <div className="space-y-2">
              {distributions.map((dist) => {
                const channelDef = CHANNELS.find((c) => c.id === dist.channel);
                const ChannelIcon = channelDef?.icon ?? Globe;
                const isExecuting = executingId === dist.id;

                return (
                  <div
                    key={dist.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface hover:border-c-border-subtle transition-colors"
                  >
                    <ChannelIcon size={14} className="text-c-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-c-text truncate">
                          {dist.name}
                        </span>
                        {!dist.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            {t('myWorkTable.distributionBuilder.paused')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-c-text-secondary mt-0.5">
                        {dist.format?.toUpperCase()} ·{' '}
                        {isPl ? channelDef?.labelPl : channelDef?.labelEn}
                        {dist.send_count > 0 && (
                          <>
                            {' '}
                            · {dist.send_count}x {t('myWorkTable.distributionBuilder.sent')}
                          </>
                        )}
                        {dist.last_sent_at && (
                          <> · {new Date(dist.last_sent_at).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleExecute(dist.id)}
                        disabled={isExecuting}
                        className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                        title={t('myWorkTable.distributionBuilder.sendNow')}
                      >
                        {isExecuting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Play size={12} />
                        )}
                      </button>
                      <button
                        onClick={() => handleToggle(dist.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          dist.is_active
                            ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                            : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        }`}
                        title={
                          dist.is_active
                            ? t('myWorkTable.distributionBuilder.pause')
                            : t('myWorkTable.distributionBuilder.resume')
                        }
                      >
                        {dist.is_active ? <Pause size={12} /> : <Power size={12} />}
                      </button>
                      <button
                        onClick={() => handleDelete(dist.id)}
                        className="p-1.5 rounded-lg text-danger-500 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                        title={t('myWorkTable.distributionBuilder.delete')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
