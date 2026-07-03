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
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-c-bg">
      <div className="w-full max-w-lg rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border">
          <div className="flex items-center gap-2">
            <Webhook size={16} className="text-c-warning" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text">
              {isPl ? 'Konfiguracja webhooków' : 'Webhook Settings'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {webhooks.length === 0 && (
            <div className="text-center py-6">
              <Bell size={28} className="text-c-text-muted dark:text-c-text-secondary mx-auto mb-2" />
              <p className="text-[10px] text-c-text-muted mb-3">
                {isPl ? 'Brak skonfigurowanych webhooków.' : 'No webhooks configured.'}
              </p>
            </div>
          )}

          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="p-3 rounded-xl border border-c-border-subtle dark:border-c-border bg-c-surface-raised dark:bg-c-surface"
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={wh.name}
                  onChange={(e) => updateWebhook(wh.id, { name: e.target.value })}
                  placeholder={isPl ? 'Nazwa (np. Slack)' : 'Name (e.g. Slack)'}
                  className="flex-1 px-2 py-1 rounded-lg border border-c-border-subtle dark:border-c-border bg-c-surface-raised dark:bg-c-surface text-[11px] text-c-text-secondary dark:text-c-text placeholder:text-c-text-muted"
                />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wh.enabled}
                    onChange={(e) => updateWebhook(wh.id, { enabled: e.target.checked })}
                    className="w-3 h-3 rounded"
                  />
                  <span className="text-[9px] text-c-text-muted">{isPl ? 'Aktywny' : 'Active'}</span>
                </label>
                <button
                  onClick={() => removeWebhook(wh.id)}
                  className="p-1 rounded text-c-danger hover:text-c-danger hover:bg-c-danger transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <input
                value={wh.url}
                onChange={(e) => updateWebhook(wh.id, { url: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-2 py-1 rounded-lg border border-c-border-subtle dark:border-c-border bg-c-surface-raised dark:bg-c-surface text-[10px] text-c-text-secondary dark:text-c-text-muted placeholder:text-c-text-muted mb-2 font-mono"
              />
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_EVENTS.map((evt) => (
                  <button
                    key={evt}
                    onClick={() => toggleEvent(wh.id, evt)}
                    className={`px-2 py-0.5 rounded-md text-[8px] font-bold transition-colors ${wh.events.includes(evt) ? 'bg-c-warning text-c-warning dark:text-c-warning' : 'bg-c-surface-raised dark:bg-c-surface text-c-text-muted'}`}
                  >
                    {evt.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border flex items-center gap-2">
          <button
            onClick={addWebhook}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface border border-c-border-subtle dark:border-c-border transition-colors"
          >
            <Plus size={12} />
            {isPl ? 'Dodaj webhook' : 'Add webhook'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r   text-c-warning dark:text-c-warning hover: hover: border border-c-warning transition-all"
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
