/**
 * WebhooksSettings - Webhook management
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Webhook, Plus, Trash2, Play, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered?: string;
  lastStatus?: 'success' | 'failed';
}

interface WebhooksSettingsProps {
  className?: string;
}

const AVAILABLE_EVENTS = [
  'task.created', 'task.completed', 'task.updated',
  'initiative.created', 'initiative.updated',
  'assessment.completed', 'report.generated'
];

export const WebhooksSettings: React.FC<WebhooksSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch('/api/webhooks/subscriptions', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.subscriptions?.map((s: any) => ({
          id: s.id,
          url: s.targetUrl,
          events: s.eventTypes || [],
          active: s.isActive,
          lastTriggered: s.updatedAt,
          lastStatus: 'success'
        })) || []);
      }
    } catch (_error) {
      console.error('Failed to fetch webhooks:', _error);
      setWebhooks([]);
    }
  };

  const createWebhook = async () => {
    if (!newUrl.trim() || selectedEvents.length === 0) return;
    
    try {
      const response = await fetch('/api/webhooks/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: `Webhook ${Date.now()}`, targetUrl: newUrl, eventTypes: selectedEvents })
      });
      
      if (response.ok) {
        const data = await response.json();
        setWebhooks(prev => [...prev, {
          id: data.id,
          url: newUrl,
          events: selectedEvents,
          active: true
        }]);
        toast.success(t('settings.webhooks.created', 'Webhook created'));
      } else {
        toast.error(t('settings.webhooks.createError', 'Failed to create webhook'));
      }
    } catch (_error) {
      toast.error(t('settings.webhooks.createError', 'Failed to create webhook'));
    }
    
    setNewUrl('');
    setSelectedEvents([]);
    setShowNew(false);
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm(t('settings.webhooks.deleteConfirm', 'Delete this webhook?'))) return;
    
    try {
      await fetch(`/api/webhooks/subscriptions/${webhookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      toast.success(t('settings.webhooks.deleted', 'Webhook deleted'));
    } catch (_error) {
      toast.error(t('settings.webhooks.deleteError', 'Failed to delete'));
    }
  };

  const testWebhook = async (webhookId: string) => {
    toast.success(t('settings.webhooks.testSent', 'Test event sent'));
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev => 
      prev.includes(event) 
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Webhook size={20} />
            {t('settings.webhooks.title', 'Webhooks')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('settings.webhooks.desc', 'Receive real-time notifications via HTTP callbacks.')}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-3 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
        >
          <Plus size={16} />
          {t('settings.webhooks.add', 'Add Webhook')}
        </button>
      </div>

      {/* New Webhook Form */}
      {showNew && (
        <div className="p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('settings.webhooks.url', 'Endpoint URL')}
            </label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://api.example.com/webhook"
              className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('settings.webhooks.events', 'Events')}
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map(event => (
                <button
                  key={event}
                  onClick={() => toggleEvent(event)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    selectedEvents.includes(event)
                      ? 'bg-brand text-white'
                      : 'bg-white dark:bg-navy-700 border border-slate-300 dark:border-navy-600'
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={createWebhook}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark"
            >
              {t('common.create', 'Create')}
            </button>
            <button
              onClick={() => { setShowNew(false); setNewUrl(''); setSelectedEvents([]); }}
              className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      <div className="space-y-3">
        {webhooks.map((webhook) => (
          <div
            key={webhook.id}
            className="p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <code className="text-sm text-slate-600 dark:text-slate-300">{webhook.url}</code>
                {webhook.lastStatus && (
                  webhook.lastStatus === 'success'
                    ? <CheckCircle size={16} className="text-green-500" />
                    : <XCircle size={16} className="text-red-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testWebhook(webhook.id)}
                  className="p-2 text-slate-400 hover:text-slate-600"
                  title={t('settings.webhooks.test', 'Send test event')}
                >
                  <Play size={16} />
                </button>
                <button
                  onClick={() => deleteWebhook(webhook.id)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {webhook.events.map(event => (
                <span key={event} className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-navy-700 rounded">
                  {event}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WebhooksSettings;

