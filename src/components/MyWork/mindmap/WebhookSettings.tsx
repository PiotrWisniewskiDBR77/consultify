/**
 * WebhookSettings — Configure webhook URLs for map events.
 * Stores config in localStorage; dispatches mm-webhook-trigger events.
 */
import { Bell, Plus, Save, Trash2, Webhook, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
}

interface WebhookSettingsProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
}

const STORAGE_KEY_PREFIX = 'mm-webhooks-';
const AVAILABLE_EVENTS = [
  'node_added',
  'node_deleted',
  'node_edited',
  'ai_action',
  'status_change',
  'comment_added',
  'map_exported',
];

function loadWebhooks(ideaId: string): WebhookConfig[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${ideaId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWebhooks(ideaId: string, configs: WebhookConfig[]) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${ideaId}`, JSON.stringify(configs));
}

export function triggerWebhooks(ideaId: string, eventType: string, payload: any) {
  const configs = loadWebhooks(ideaId);
  const matching = configs.filter((c) => c.enabled && c.events.includes(eventType));

  for (const config of matching) {
    fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventType, ideaId, timestamp: Date.now(), ...payload }),
    }).catch(() => {
      /* silently fail for now */
    });
  }

  window.dispatchEvent(
    new CustomEvent('mm-webhook-trigger', {
      detail: { ideaId, eventType, payload, webhookCount: matching.length },
    })
  );
}

export const WebhookSettings: React.FC<WebhookSettingsProps> = ({ open, onClose, ideaId }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);

  useEffect(() => {
    if (open) setWebhooks(loadWebhooks(ideaId));
  }, [ideaId, open]);

  const addWebhook = useCallback(() => {
    setWebhooks((prev) => [
      ...prev,
      {
        id: `wh-${Date.now()}`,
        name: '',
        url: '',
        events: ['node_added'],
        enabled: true,
      },
    ]);
  }, []);

  const updateWebhook = useCallback((id: string, updates: Partial<WebhookConfig>) => {
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  }, []);

  const removeWebhook = useCallback((id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const toggleEvent = useCallback((webhookId: string, event: string) => {
    setWebhooks((prev) =>
      prev.map((w) => {
        if (w.id !== webhookId) return w;
        const events = w.events.includes(event)
          ? w.events.filter((e) => e !== event)
          : [...w.events, event];
        return { ...w, events };
      })
    );
  }, []);

  const handleSave = useCallback(() => {
    saveWebhooks(ideaId, webhooks);
    toast.success(isPl ? 'Zapisano konfigurację webhooków' : 'Webhook configuration saved', {
      duration: 1200,
    });
    onClose();
  }, [ideaId, isPl, onClose, webhooks]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Webhook size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'Konfiguracja webhooków' : 'Webhook Settings'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {webhooks.length === 0 && (
            <div className="text-center py-6">
              <Bell size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-[10px] text-slate-400 mb-3">
                {isPl ? 'Brak skonfigurowanych webhooków.' : 'No webhooks configured.'}
              </p>
            </div>
          )}

          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="p-3 rounded-xl border border-slate-200/30 dark:border-navy-700/30 bg-slate-50/30 dark:bg-navy-950/10"
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={wh.name}
                  onChange={(e) => updateWebhook(wh.id, { name: e.target.value })}
                  placeholder={isPl ? 'Nazwa (np. Slack)' : 'Name (e.g. Slack)'}
                  className="flex-1 px-2 py-1 rounded-lg border border-slate-200/30 dark:border-navy-700/30 bg-white/50 dark:bg-navy-950/30 text-[11px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wh.enabled}
                    onChange={(e) => updateWebhook(wh.id, { enabled: e.target.checked })}
                    className="w-3 h-3 rounded"
                  />
                  <span className="text-[9px] text-slate-400">{isPl ? 'Aktywny' : 'Active'}</span>
                </label>
                <button
                  onClick={() => removeWebhook(wh.id)}
                  className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <input
                value={wh.url}
                onChange={(e) => updateWebhook(wh.id, { url: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-2 py-1 rounded-lg border border-slate-200/30 dark:border-navy-700/30 bg-white/50 dark:bg-navy-950/30 text-[10px] text-slate-600 dark:text-slate-300 placeholder:text-slate-400 mb-2 font-mono"
              />
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_EVENTS.map((evt) => (
                  <button
                    key={evt}
                    onClick={() => toggleEvent(wh.id, evt)}
                    className={`px-2 py-0.5 rounded-md text-[8px] font-bold transition-colors ${wh.events.includes(evt) ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-navy-800 text-slate-400'}`}
                  >
                    {evt.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center gap-2">
          <button
            onClick={addWebhook}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200/40 dark:border-navy-700/40 transition-colors"
          >
            <Plus size={12} />
            {isPl ? 'Dodaj webhook' : 'Add webhook'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-amber-500/15 to-amber-500/10 text-amber-700 dark:text-amber-300 hover:from-amber-500/25 hover:to-amber-500/15 border border-amber-500/10 transition-all"
          >
            <Save size={12} />
            {isPl ? 'Zapisz' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebhookSettings;
