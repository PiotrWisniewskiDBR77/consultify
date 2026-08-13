import {
  Check,
  ChevronLeft,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Webhook,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

interface WebhookRelay {
  id: string;
  base_id: string;
  name: string;
  target_url: string;
  secret: string | null;
  event_types: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_by: string;
  created_at: string;
}

const EVENT_OPTIONS = [
  { value: 'record.created', labelEn: 'Record Created', labelPl: 'Rekord utworzony' },
  { value: 'record.updated', labelEn: 'Record Updated', labelPl: 'Rekord zaktualizowany' },
  { value: 'record.deleted', labelEn: 'Record Deleted', labelPl: 'Rekord usunięty' },
];

interface WebhookRelayPanelProps {
  workspaceId: string;
  onClose: () => void;
}

export const WebhookRelayPanel: React.FC<WebhookRelayPanelProps> = ({ workspaceId, onClose }) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [baseId, setBaseId] = useState<string | null>(null);
  const [relays, setRelays] = useState<WebhookRelay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRelay, setEditingRelay] = useState<WebhookRelay | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchRelays = useCallback(async () => {
    setLoading(true);
    try {
      const bases = await TablePlatformApi.listBases(workspaceId);
      const firstBase = Array.isArray(bases) ? bases[0] : null;
      if (!firstBase) {
        setLoading(false);
        return;
      }
      const resolvedBaseId = String((firstBase as Record<string, unknown>).id ?? '');
      setBaseId(resolvedBaseId);
      const data = await TablePlatformApi.listWebhookRelays(resolvedBaseId);
      setRelays(data?.relays ?? []);
    } catch {
      toast.error(t('myWorkTable.webhookRelayPanel.failedToLoadWebhooks'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isPl]);

  useEffect(() => {
    fetchRelays();
  }, [fetchRelays]);

  // Program B (E02) — klik człowieka = `ctx.params.run` (rejestr wykonuje
  // ORYGINALNY callback wprost); Teresa = ta sama funkcja rejestru woła REST
  // bezpośrednio (`runTableWebhookRelayDeleteCallback` w `ideaActionRegistry.ts`).
  const handleDelete = (relayId: string) => {
    const ctx: ActionContext = {
      ideaId: baseId ?? workspaceId,
      tool: 'table',
      selection: EMPTY_SELECTION,
      surface: 'panel',
      source: 'ui',
      language: isPl ? 'pl' : 'en',
      params: {
        relayId,
        run: async () => {
          try {
            await TablePlatformApi.deleteWebhookRelay(relayId);
            setRelays((prev) => prev.filter((r) => r.id !== relayId));
            toast.success(t('myWorkTable.webhookRelayPanel.webhookDeleted'));
          } catch {
            toast.error(t('myWorkTable.webhookRelayPanel.failedToDelete'));
          }
        },
      },
    };
    void runIdeaAction('table.webhook_relay.delete', ctx);
  };

  const handleToggle = async (relay: WebhookRelay) => {
    try {
      const updated = await TablePlatformApi.updateWebhookRelay(relay.id, {
        isActive: !relay.is_active,
      });
      setRelays((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      toast.error(t('myWorkTable.webhookRelayPanel.failedToToggleStatus'));
    }
  };

  const handleTest = async (relayId: string) => {
    setTestingId(relayId);
    try {
      const result = await TablePlatformApi.testWebhookRelay(relayId);
      if (result.success) {
        toast.success(t('myWorkTable.webhookRelayPanel.testPassed', { value: result.statusCode }));
      } else {
        toast.error(
          t('myWorkTable.webhookRelayPanel.testFailedWithReason', {
            value: result.error ?? result.statusCode,
          })
        );
      }
    } catch {
      toast.error(t('myWorkTable.webhookRelayPanel.testFailed'));
    } finally {
      setTestingId(null);
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
      return iso;
    }
  };

  const truncateUrl = (url: string, max = 40) => {
    if (url.length <= max) return url;
    return url.slice(0, max) + '…';
  };

  if ((showForm || editingRelay) && baseId) {
    return (
      <RelayForm
        baseId={baseId}
        relay={editingRelay}
        isPl={!!isPl}
        onBack={() => {
          setShowForm(false);
          setEditingRelay(null);
        }}
        onSaved={(relay) => {
          if (editingRelay) {
            setRelays((prev) => prev.map((r) => (r.id === relay.id ? relay : r)));
          } else {
            setRelays((prev) => [relay, ...prev]);
          }
          setShowForm(false);
          setEditingRelay(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <ChevronLeft size={16} className="text-c-text-secondary" />
          </button>
          <Webhook size={18} className="text-c-tag-2" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('myWorkTable.webhookRelayPanel.webhookRelays')}
            {relays.length > 0 && (
              <span className="text-c-text-secondary font-normal ml-1">({relays.length})</span>
            )}
          </h3>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-c-tag-2 px-2.5 py-1.5 text-xs font-medium text-c-tag-2 hover:bg-c-tag-2 transition-colors"
        >
          <Plus size={12} />
          {t('myWorkTable.webhookRelayPanel.add')}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-c-text-secondary" />
        </div>
      )}

      {/* Empty */}
      {!loading && relays.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-2xl bg-c-surface-raised p-4 mb-4">
            <Webhook size={28} className="text-c-text-muted" />
          </div>
          <p className="text-sm font-medium text-c-text-muted mb-1">
            {t('myWorkTable.webhookRelayPanel.noWebhookRelaysConfigured')}
          </p>
          <p className="text-xs text-c-text-muted mb-4 max-w-xs">
            {t('myWorkTable.webhookRelayPanel.forwardTableEventsToZapier')}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-c-tag-2 px-4 py-2 text-sm font-medium text-c-text hover:bg-c-tag-2 transition-colors"
          >
            <Plus size={14} />
            {t('myWorkTable.webhookRelayPanel.addWebhook')}
          </button>
        </div>
      )}

      {/* List */}
      {!loading && relays.length > 0 && (
        <div className="space-y-2 flex-1 overflow-y-auto">
          {relays.map((relay) => (
            <div
              key={relay.id}
              className="group flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3 hover:border-c-border-subtle transition-colors"
            >
              <div className="flex-shrink-0">
                <div
                  className={`w-2 h-2 rounded-full ${relay.is_active ? 'bg-c-success' : 'bg-c-surface-raised'}`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-c-text truncate">{relay.name}</span>
                  {!relay.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-c-surface-raised text-c-text-secondary">
                      {t('myWorkTable.webhookRelayPanel.off')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-c-text-muted">
                  <span className="truncate max-w-[180px]" title={relay.target_url}>
                    {truncateUrl(relay.target_url)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-c-text-muted">
                  <span>
                    {t('myWorkTable.webhookRelayPanel.last')} {formatTime(relay.last_triggered_at)}
                  </span>
                  <span>×{relay.trigger_count ?? 0}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMenuOpen(menuOpen === relay.id ? null : relay.id)}
                  className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-muted hover:bg-c-surface-raised transition-colors"
                >
                  <MoreHorizontal size={16} />
                </button>

                {menuOpen === relay.id && (
                  <>
                    <div className="fixed inset-0 z-dropdown" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-full mt-1 z-overlay w-48 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl py-1">
                      <MenuBtn
                        icon={
                          testingId === relay.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Play size={13} />
                          )
                        }
                        label={t('myWorkTable.webhookRelayPanel.test')}
                        onClick={() => {
                          setMenuOpen(null);
                          handleTest(relay.id);
                        }}
                      />
                      <MenuBtn
                        icon={relay.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                        label={
                          relay.is_active
                            ? t('myWorkTable.webhookRelayPanel.disable')
                            : t('myWorkTable.webhookRelayPanel.enable')
                        }
                        onClick={() => {
                          setMenuOpen(null);
                          handleToggle(relay);
                        }}
                      />
                      <MenuBtn
                        icon={<Pencil size={13} />}
                        label={t('myWorkTable.webhookRelayPanel.edit')}
                        onClick={() => {
                          setMenuOpen(null);
                          setEditingRelay(relay);
                        }}
                      />
                      <div className="my-1 border-t border-c-border-subtle" />
                      <MenuBtn
                        icon={<Trash2 size={13} />}
                        label={t('myWorkTable.webhookRelayPanel.delete')}
                        danger
                        onClick={() => {
                          setMenuOpen(null);
                          handleDelete(relay.id);
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
  );
};

/* ------------------------------------------------------------------ */
/*  Relay Form (create / edit)                                         */
/* ------------------------------------------------------------------ */

interface RelayFormProps {
  baseId: string;
  relay: WebhookRelay | null;
  isPl: boolean;
  onBack: () => void;
  onSaved: (relay: WebhookRelay) => void;
}

const RelayForm: React.FC<RelayFormProps> = ({ baseId, relay, isPl, onBack, onSaved }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(relay?.name ?? '');
  const [targetUrl, setTargetUrl] = useState(relay?.target_url ?? '');
  const [secret, setSecret] = useState(relay?.secret ?? '');
  const [eventTypes, setEventTypes] = useState<string[]>(
    relay?.event_types ?? ['record.created', 'record.updated', 'record.deleted']
  );
  const [saving, setSaving] = useState(false);

  const toggleEvent = (ev: string) => {
    setEventTypes((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetUrl.trim()) {
      toast.error(t('myWorkTable.webhookRelayPanel.nameAndUrlAreRequired'));
      return;
    }
    if (eventTypes.length === 0) {
      toast.error(t('myWorkTable.webhookRelayPanel.selectAtLeastOneEvent'));
      return;
    }

    setSaving(true);
    try {
      let result: WebhookRelay;
      if (relay) {
        result = await TablePlatformApi.updateWebhookRelay(relay.id, {
          name: name.trim(),
          targetUrl: targetUrl.trim(),
          secret: secret || undefined,
          eventTypes,
        });
      } else {
        result = await TablePlatformApi.createWebhookRelay(baseId, {
          name: name.trim(),
          targetUrl: targetUrl.trim(),
          secret: secret || undefined,
          eventTypes,
        });
      }
      toast.success(
        relay
          ? t('myWorkTable.webhookRelayPanel.webhookUpdated')
          : t('myWorkTable.webhookRelayPanel.webhookCreated')
      );
      onSaved(result);
    } catch {
      toast.error(t('myWorkTable.webhookRelayPanel.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={onBack}
          className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
        >
          <ChevronLeft size={16} className="text-c-text-secondary" />
        </button>
        <h3 className="text-sm font-semibold text-c-text">
          {relay
            ? t('myWorkTable.webhookRelayPanel.editWebhook')
            : t('myWorkTable.webhookRelayPanel.newWebhook')}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-c-text-muted mb-1">
            {t('myWorkTable.webhookRelayPanel.name')}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('myWorkTable.webhookRelayPanel.eGZapierNewRecords')}
            className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-tag-2 focus:border-c-tag-2"
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-xs font-medium text-c-text-muted mb-1">
            {t('myWorkTable.webhookRelayPanel.targetUrl')}
          </label>
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            type="url"
            className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-tag-2 focus:border-c-tag-2"
          />
        </div>

        {/* Secret */}
        <div>
          <label className="block text-xs font-medium text-c-text-muted mb-1">
            {t('myWorkTable.webhookRelayPanel.hmacSecretOptional')}
          </label>
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t('myWorkTable.webhookRelayPanel.keyForHmacSha256Signing')}
            type="password"
            autoComplete="off"
            className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-tag-2 focus:border-c-tag-2"
          />
          <p className="mt-1 text-[10px] text-c-text-secondary">
            {t('myWorkTable.webhookRelayPanel.xConsultifySignatureHeaderWill')}
          </p>
        </div>

        {/* Event Types */}
        <div>
          <label className="block text-xs font-medium text-c-text-muted mb-2">
            {t('myWorkTable.webhookRelayPanel.events')}
          </label>
          <div className="space-y-1.5">
            {EVENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 hover:bg-c-surface-raised transition-colors"
              >
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    eventTypes.includes(opt.value)
                      ? 'bg-c-tag-2 border-c-tag-2'
                      : 'border-c-border-subtle'
                  }`}
                  onClick={() => toggleEvent(opt.value)}
                >
                  {eventTypes.includes(opt.value) && <Check size={10} className="text-c-text" />}
                </div>
                <span className="text-sm text-c-text-muted" onClick={() => toggleEvent(opt.value)}>
                  {isPl ? opt.labelPl : opt.labelEn}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-c-tag-2 px-4 py-2.5 text-sm font-medium text-c-text hover:bg-c-tag-2 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {relay
              ? t('myWorkTable.webhookRelayPanel.saveChanges')
              : t('myWorkTable.webhookRelayPanel.createWebhook')}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Menu button                                                        */
/* ------------------------------------------------------------------ */

const MenuBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon, label, danger, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium transition-colors ${
      danger
        ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10'
        : 'text-c-text-muted hover:bg-c-surface-raised'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default WebhookRelayPanel;
