/**
 * DistributionManager — Full management UI for automated artifact distribution.
 * List, create, preview, execute, toggle, and delete distributions.
 */
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Eye,
  FileText,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Power,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

// ─── Types ───────────────────────────────────────────────────────

interface Distribution {
  id: string;
  name: string;
  base_id: string;
  source_type: string;
  source_id: string;
  channel: string;
  channel_config: Record<string, unknown>;
  schedule: string | null;
  format: string;
  is_active: boolean;
  last_sent_at: string | null;
  send_count: number;
  created_at: string;
}

type Channel = 'email' | 'slack' | 'teams' | 'webhook';
type Format = 'csv' | 'json' | 'pdf' | 'xlsx' | 'link';
type WizardStep = 'what' | 'format' | 'channel' | 'schedule' | 'review';

interface DistributionManagerProps {
  baseId: string;
  tableId: string;
  views?: Array<{ id: string; name: string }>;
  onClose: () => void;
}

const CHANNELS: {
  id: Channel;
  en: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: 'email', en: 'Email', icon: Mail },
  { id: 'slack', en: 'Slack', icon: MessageSquare },
  { id: 'teams', en: 'Teams', icon: MessageSquare },
  { id: 'webhook', en: 'Webhook', icon: Globe },
];

const FORMATS: { id: Format; label: string }[] = [
  { id: 'csv', label: 'CSV' },
  { id: 'json', label: 'JSON' },
  { id: 'xlsx', label: 'XLSX' },
  { id: 'pdf', label: 'PDF' },
  { id: 'link', label: 'Link' },
];

const SCHEDULES = [
  { value: '', key: 'onDemand', en: 'On demand' },
  { value: '0 9 * * *', key: 'daily', en: 'Daily at 9:00' },
  { value: '0 9 * * 1', key: 'weekly', en: 'Weekly (Mon 9:00)' },
  { value: '0 9 1 * *', key: 'monthly', en: 'Monthly (1st, 9:00)' },
];

const WIZARD_STEPS: { key: WizardStep; en: string }[] = [
  { key: 'what', en: 'What to distribute' },
  { key: 'format', en: 'Format' },
  { key: 'channel', en: 'Channel' },
  { key: 'schedule', en: 'Schedule' },
  { key: 'review', en: 'Review' },
];

// ─── Component ───────────────────────────────────────────────────

export const DistributionManager: React.FC<DistributionManagerProps> = ({
  baseId,
  tableId,
  views = [],
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState<WizardStep>('what');
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<'view' | 'table'>('table');
  const [sourceId, setSourceId] = useState(tableId);
  const [format, setFormat] = useState<Format>('csv');
  const [channel, setChannel] = useState<Channel>('email');
  const [channelConfig, setChannelConfig] = useState<Record<string, unknown>>({});
  const [schedule, setSchedule] = useState('');
  const [creating, setCreating] = useState(false);

  // Preview
  const [previewId, setPreviewId] = useState<string | null>(null);

  const fetchDistributions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TablePlatformApi.listDistributions(baseId);
      setDistributions(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t('ideas.table.failedToLoadDistributions', 'Failed to load distributions'));
    } finally {
      setLoading(false);
    }
  }, [baseId, isPl]);

  useEffect(() => {
    fetchDistributions();
  }, [fetchDistributions]);

  // Program B (E02) — dwie ścieżki, jedna funkcja rejestru: klik człowieka =
  // `ctx.params.run` (rejestr wykonuje ORYGINALNY callback wprost); Teresa =
  // ta sama funkcja rejestru woła REST bezpośrednio
  // (`runTableDistribution*Callback` w `ideaActionRegistry.ts`, aliasowane
  // `table.distribution.*` — INNY id niż legacy `table.distribution_builder.*`
  // z `DistributionBuilder.tsx`, choć te same endpointy REST).
  const runDistributionManagerAction = (
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
    runDistributionManagerAction(
      'table.distribution.delete',
      async () => {
        try {
          await TablePlatformApi.deleteDistribution(id);
          setDistributions((prev) => prev.filter((d) => d.id !== id));
          toast.success(t('ideas.table.deleted', 'Deleted'));
        } catch {
          toast.error(t('ideas.table.failedToDelete', 'Failed to delete'));
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
      toast.error(t('ideas.table.failedToToggle', 'Failed to toggle'));
    }
  };

  const handleExecute = (id: string) => {
    runDistributionManagerAction(
      'table.distribution.execute',
      async () => {
        setExecutingId(id);
        try {
          const result = await TablePlatformApi.executeDistribution(id);
          toast.success(
            t('ideas.table.sentRecordsVia', 'Sent {{count}} records via {{channel}}', {
              count: result.recordCount,
              channel: result.channel,
            })
          );
          await fetchDistributions();
        } catch {
          toast.error(t('ideas.table.sendFailed', 'Send failed'));
        } finally {
          setExecutingId(null);
        }
      },
      { distributionId: id }
    );
  };

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error(t('ideas.table.nameIsRequired', 'Name is required'));
      return;
    }
    runDistributionManagerAction(
      'table.distribution.create',
      async () => {
        setCreating(true);
        try {
          await TablePlatformApi.createDistribution(baseId, {
            name: name.trim(),
            sourceType,
            sourceId: sourceId || tableId,
            channel,
            channelConfig,
            format,
            schedule: schedule || undefined,
          });
          toast.success(t('ideas.table.distributionCreated', 'Distribution created'));
          resetWizard();
          await fetchDistributions();
        } catch {
          toast.error(t('ideas.table.failedToCreate', 'Failed to create'));
        } finally {
          setCreating(false);
        }
      },
      {
        baseId,
        name: name.trim(),
        sourceType,
        sourceId: sourceId || tableId,
        channel,
        channelConfig,
        format,
        schedule: schedule || undefined,
      }
    );
  };

  const resetWizard = () => {
    setShowWizard(false);
    setStep('what');
    setName('');
    setSourceType('table');
    setSourceId(tableId);
    setFormat('csv');
    setChannel('email');
    setChannelConfig({});
    setSchedule('');
  };

  const updateConfig = (key: string, value: string) => {
    setChannelConfig((prev) => ({ ...prev, [key]: value }));
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

  const getChannelDef = (ch: string) => CHANNELS.find((c) => c.id === ch) ?? CHANNELS[0];
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);

  // ─── Wizard view ─────────────────────────────────────────────
  if (showWizard) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-c-border-subtle px-5 py-4 border-c-border-subtle">
          <button
            onClick={resetWizard}
            className="rounded-lg p-1 transition-colors hover:bg-c-surface-raised"
          >
            <ChevronLeft size={16} className="text-c-text-secondary" />
          </button>
          <Send size={16} className="text-c-tag-4" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('ideas.table.newDistribution', 'New Distribution')}
          </h3>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 border-b border-c-border-subtle px-5 py-3 border-c-border-subtle">
          {WIZARD_STEPS.map((s, idx) => (
            <React.Fragment key={s.key}>
              {idx > 0 && <ArrowRight size={10} className="text-c-text-secondary" />}
              <button
                onClick={() => idx <= stepIndex && setStep(s.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  idx === stepIndex
                    ? 'bg-c-tag-4 text-c-text'
                    : idx < stepIndex
                      ? 'bg-c-tag-4 text-c-tag-4 bg-c-tag-4 text-c-tag-4'
                      : 'text-c-text-secondary'
                }`}
              >
                {t(`ideas.table.wizardStep.${s.key}`, s.en)}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'what' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-c-text-muted">
                  {t('ideas.table.distributionName', 'Distribution name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('ideas.table.eGWeeklyReport', 'e.g. Weekly Report')}
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm border-c-border-subtle bg-c-surface"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-c-text-muted">
                  {t('ideas.table.whatToDistribute', 'What to distribute')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSourceType('table');
                      setSourceId(tableId);
                    }}
                    className={`rounded-xl border p-3 text-center text-xs font-medium transition-colors ${
                      sourceType === 'table'
                        ? 'border-c-tag-4 bg-c-tag-4 text-c-tag-4 border-c-tag-4 bg-c-tag-4'
                        : 'border-c-border-subtle text-c-text-secondary border-c-border-subtle'
                    }`}
                  >
                    <FileText size={16} className="mx-auto mb-1" />
                    {t('ideas.table.table', 'Table')}
                  </button>
                  <button
                    onClick={() => setSourceType('view')}
                    className={`rounded-xl border p-3 text-center text-xs font-medium transition-colors ${
                      sourceType === 'view'
                        ? 'border-c-tag-4 bg-c-tag-4 text-c-tag-4 border-c-tag-4 bg-c-tag-4'
                        : 'border-c-border-subtle text-c-text-secondary border-c-border-subtle'
                    }`}
                  >
                    <Eye size={16} className="mx-auto mb-1" />
                    {t('ideas.table.view', 'View')}
                  </button>
                </div>
              </div>
              {sourceType === 'view' && views.length > 0 && (
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm border-c-border-subtle bg-c-surface"
                >
                  <option value="">{t('ideas.table.selectView', 'Select view...')}</option>
                  {views.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {step === 'format' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                {t('ideas.table.exportFormat', 'Export Format')}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`rounded-xl border p-3 text-center text-xs font-medium transition-colors ${
                      format === f.id
                        ? 'border-c-tag-4 bg-c-tag-4 text-c-tag-4 border-c-tag-4 bg-c-tag-4'
                        : 'border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'channel' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                {t('ideas.table.deliveryChannel', 'Delivery Channel')}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map((ch) => {
                  const Icon = ch.icon;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setChannel(ch.id);
                        setChannelConfig({});
                      }}
                      className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors ${
                        channel === ch.id
                          ? 'border-c-tag-4 bg-c-tag-4 text-c-tag-4 border-c-tag-4 bg-c-tag-4'
                          : 'border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                      }`}
                    >
                      <Icon size={16} />
                      {t(`ideas.table.channel.${ch.id}`, ch.en)}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 space-y-2">
                {channel === 'email' && (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-c-text-muted">
                      {t('ideas.table.emailAddresses', 'Email addresses')}
                    </label>
                    <input
                      type="text"
                      value={(channelConfig.to as string) || ''}
                      onChange={(e) => updateConfig('to', e.target.value)}
                      placeholder="user@example.com, team@example.com"
                      className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs border-c-border-subtle bg-c-surface"
                    />
                  </div>
                )}
                {(channel === 'slack' || channel === 'teams') && (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-c-text-muted">
                      {t('ideas.table.webhookUrl', 'Webhook URL')}
                    </label>
                    <input
                      type="url"
                      value={(channelConfig.webhookUrl as string) || ''}
                      onChange={(e) => updateConfig('webhookUrl', e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs border-c-border-subtle bg-c-surface"
                    />
                  </div>
                )}
                {channel === 'webhook' && (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-c-text-muted">
                      {t('ideas.table.webhookUrl', 'Webhook URL')}
                    </label>
                    <input
                      type="url"
                      value={(channelConfig.url as string) || ''}
                      onChange={(e) => updateConfig('url', e.target.value)}
                      placeholder="https://api.example.com/webhook"
                      className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs border-c-border-subtle bg-c-surface"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'schedule' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                {t('ideas.table.scheduleLabel', 'Schedule')}
              </h4>
              <div className="space-y-1.5">
                {SCHEDULES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSchedule(s.value)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium transition-colors ${
                      schedule === s.value
                        ? 'border-c-tag-4 bg-c-tag-4 text-c-tag-4 border-c-tag-4 bg-c-tag-4'
                        : 'border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                    }`}
                  >
                    {schedule === s.value && <Check size={14} className="text-c-tag-4" />}
                    <Clock
                      size={14}
                      className={schedule === s.value ? 'text-c-tag-4' : 'text-c-text-secondary'}
                    />
                    {t(`ideas.table.schedule.${s.key}`, s.en)}
                    {s.value && (
                      <span className="ml-auto text-[10px] text-c-text-secondary">{s.value}</span>
                    )}
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-c-text-muted">
                  {t('ideas.table.customCronOptional', 'Custom cron (optional)')}
                </label>
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="0 9 * * 1"
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs border-c-border-subtle bg-c-surface"
                />
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                {t('ideas.table.summary', 'Summary')}
              </h4>
              <div className="space-y-2 rounded-xl border border-c-border-subtle bg-c-surface-raised p-4 border-c-border-subtle bg-c-surface">
                <SummaryRow label={t('ideas.table.name', 'Name')} value={name || '—'} />
                <SummaryRow
                  label={t('ideas.table.source', 'Source')}
                  value={
                    sourceType === 'table'
                      ? t('ideas.table.table', 'Table')
                      : t('ideas.table.view', 'View')
                  }
                />
                <SummaryRow
                  label={t('ideas.table.format', 'Format')}
                  value={format.toUpperCase()}
                />
                <SummaryRow
                  label={t('ideas.table.channelLabel', 'Channel')}
                  value={t(
                    `ideas.table.channel.${getChannelDef(channel).id}`,
                    getChannelDef(channel).en
                  )}
                />
                <SummaryRow
                  label={t('ideas.table.scheduleLabel', 'Schedule')}
                  value={schedule || t('ideas.table.onDemand', 'On demand')}
                />
              </div>

              {/* Preview box */}
              <div className="rounded-xl border border-dashed border-c-border-subtle bg-c-surface p-4 border-c-border-subtle bg-c-surface">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-c-text-muted">
                  <Eye size={14} />
                  {t('ideas.table.preview', 'Preview')}
                </div>
                <div className="text-[11px] text-c-text-muted">
                  {channel === 'email' && (
                    <p>
                      {t('ideas.table.emailWithAttachment', 'Email with attachment')}{' '}
                      <strong>
                        {name}.{format}
                      </strong>{' '}
                      {t('ideas.table.to', 'to')}:{' '}
                      {(channelConfig.to as string) || '(no recipients)'}
                    </p>
                  )}
                  {channel === 'slack' && (
                    <p>
                      {t('ideas.table.slackMessageWithDataIn', 'Slack message with data in')}{' '}
                      <strong>{format.toUpperCase()}</strong>
                    </p>
                  )}
                  {channel === 'teams' && (
                    <p>
                      {t('ideas.table.teamsCardWithDataSummary', 'Teams card with data summary')}
                    </p>
                  )}
                  {channel === 'webhook' && (
                    <p>
                      {t('ideas.table.postTo', 'POST to')}:{' '}
                      {(channelConfig.url as string) || '(no URL)'} ({format.toUpperCase()})
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-c-border-subtle px-5 py-3 border-c-border-subtle">
          <button
            onClick={() => {
              if (stepIndex === 0) resetWizard();
              else setStep(WIZARD_STEPS[stepIndex - 1].key);
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-c-text-muted transition-colors hover:text-c-text-secondary"
          >
            {stepIndex === 0 ? t('ideas.table.cancel', 'Cancel') : t('ideas.table.back', 'Back')}
          </button>
          {step === 'review' ? (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-c-tag-4 px-4 py-1.5 text-xs font-medium text-c-text transition-colors hover:bg-c-tag-4 disabled:opacity-50"
            >
              {creating && <Loader2 size={12} className="animate-spin" />}
              {t('ideas.table.createDistribution', 'Create Distribution')}
            </button>
          ) : (
            <button
              onClick={() => setStep(WIZARD_STEPS[stepIndex + 1].key)}
              disabled={step === 'what' && !name.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-c-tag-4 px-3 py-1.5 text-xs font-medium text-c-text transition-colors hover:bg-c-tag-4 disabled:opacity-50"
            >
              {t('ideas.table.next', 'Next')}
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── List view ───────────────────────────────────────────────
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
          <Send size={18} className="text-c-tag-4" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('ideas.table.distributions', 'Distributions')}
            {distributions.length > 0 && (
              <span className="ml-1 font-normal text-c-text-secondary">
                ({distributions.length})
              </span>
            )}
          </h3>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-c-tag-4 px-2.5 py-1.5 text-xs font-medium text-c-tag-4 transition-colors hover:bg-c-tag-4 text-c-tag-4 hover:bg-c-tag-4"
        >
          <Plus size={12} />
          {t('ideas.table.new', 'New')}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-c-text-secondary" />
          </div>
        ) : distributions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-2xl bg-c-surface-raised p-4 bg-c-surface-raised">
              <Send size={28} className="text-c-text-muted" />
            </div>
            <p className="mb-1 text-sm font-medium text-c-text-muted">
              {t('ideas.table.noDistributionsYet', 'No distributions yet')}
            </p>
            <p className="mb-4 max-w-xs text-xs text-c-text-muted">
              {t(
                'ideas.table.automaticallySendTableDataViaEmailSlackTeamsOrWebhook',
                'Automatically send table data via email, Slack, Teams, or webhook.'
              )}
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-c-tag-4 px-4 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-tag-4"
            >
              <Plus size={14} />
              {t('ideas.table.createDistribution2', 'Create distribution')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {distributions.map((dist) => {
              const chDef = getChannelDef(dist.channel);
              const ChannelIcon = chDef.icon;
              const isExecuting = executingId === dist.id;

              return (
                <div
                  key={dist.id}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3 transition-colors hover:border-c-border-subtle bg-c-surface hover:border-c-border-subtle"
                >
                  <ChannelIcon size={16} className="flex-shrink-0 text-c-text-muted" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-c-text">{dist.name}</span>
                      {!dist.is_active && (
                        <span className="rounded bg-c-warning px-1.5 py-0.5 text-[10px] text-c-warning bg-c-warning text-c-warning">
                          {t('ideas.table.paused', 'Paused')}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-c-text-muted">
                      {dist.format?.toUpperCase()} ·{' '}
                      {t(`ideas.table.channel.${chDef.id}`, chDef.en)}
                      {dist.schedule && (
                        <>
                          {' '}
                          · <Clock size={9} className="inline" /> {dist.schedule}
                        </>
                      )}
                      {dist.send_count > 0 && (
                        <>
                          {' '}
                          · {dist.send_count}× {t('ideas.table.sent', 'sent')}
                        </>
                      )}
                      {dist.last_sent_at && <> · {formatTime(dist.last_sent_at)}</>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleExecute(dist.id)}
                      disabled={isExecuting}
                      className="rounded-lg p-1.5 text-c-tag-4 transition-colors hover:bg-c-tag-4 disabled:opacity-50 text-c-tag-4 hover:bg-c-tag-4"
                      title={t('ideas.table.sendNow', 'Send now')}
                    >
                      {isExecuting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                    </button>
                    <button
                      onClick={() => handleToggle(dist.id)}
                      className={`rounded-lg p-1.5 transition-colors ${
                        dist.is_active
                          ? 'text-c-success hover:bg-c-success text-c-success hover:bg-c-success'
                          : 'text-c-warning hover:bg-c-warning text-c-warning hover:bg-c-warning'
                      }`}
                      title={
                        dist.is_active
                          ? t('ideas.table.pause', 'Pause')
                          : t('ideas.table.resume', 'Resume')
                      }
                    >
                      {dist.is_active ? <Pause size={12} /> : <Power size={12} />}
                    </button>
                    <button
                      onClick={() => handleDelete(dist.id)}
                      className="rounded-lg p-1.5 text-c-danger transition-colors hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] text-c-danger dark:hover:bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)]"
                      title={t('ideas.table.delete', 'Delete')}
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
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-[11px] text-c-text-muted">{label}</span>
    <span className="text-xs font-medium text-c-text-muted">{value}</span>
  </div>
);

export default DistributionManager;
