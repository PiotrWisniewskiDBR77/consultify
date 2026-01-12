import {
    AlertCircle,
    Building2,
    CheckCircle,
    Copy,
    ExternalLink,
    Eye,
    EyeOff,
    Info,
    Plus,
    RefreshCw,
    Send,
    Trash2,
    Webhook,
} from 'lucide-react';
import {
    Calendar,
    CheckSquare,
    Database,
    FileText,
    Loader2,
    MessageCircle,
    MessageSquare,
    Slack,
    Trello,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { User } from '../../types';
import { InfoButton } from '../shared/InfoButton';

// Webhook types
interface WebhookSubscription {
    id: string;
    name: string;
    targetUrl: string;
    eventTypes: string[];
    isActive: boolean;
    secretKey?: string;
    createdAt: string;
}

interface EventCategory {
    category: string;
    events: { type: string; description: string }[];
}

// Provider Config
const INTEGRATION_PROVIDERS = [
    { id: 'slack', name: 'Slack', icon: Slack, description: 'Connect channel for updates' }, // Lucide has Slack
    { id: 'teams', name: 'Microsoft Teams', icon: MessageCircle, description: 'Webhook integration' }, // Fallback icon
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, description: 'Business API notifications' },
    { id: 'trello', name: 'Trello', icon: Trello, description: 'Sync boards and cards' }, // Lucide has Trello
    { id: 'jira', name: 'Jira', icon: Database, description: 'Issue tracking sync' },
    { id: 'clickup', name: 'ClickUp', icon: CheckSquare, description: 'Task management sync' },
    { id: 'asana', name: 'Asana', icon: CheckSquare, description: 'Task and project tracking' },
    { id: 'monday', name: 'Monday.com', icon: Calendar, description: 'Work OS and project management' },
    { id: 'notion', name: 'Notion', icon: FileText, description: 'All-in-one workspace' },
    { id: 'basecamp', name: 'Basecamp', icon: MessageSquare, description: 'Project management and communication' },
];

interface IntegrationSettingsProps {
    currentUser: User;
}

interface Integration {
    id: string;
    provider: string;
    config: any;
    status: 'active' | 'error' | 'disabled';
}

export const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({ currentUser }) => {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [configInput, setConfigInput] = useState('');
    const [connecting, setConnecting] = useState(false);

    // Webhooks state
    const [activeTab, setActiveTab] = useState<'integrations' | 'webhooks'>('integrations');
    const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
    const [availableEvents, setAvailableEvents] = useState<EventCategory[]>([]);
    const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
    const [webhookForm, setWebhookForm] = useState({
        name: '',
        targetUrl: '',
        eventTypes: [] as string[],
    });
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [showSecret, setShowSecret] = useState<string | null>(null);

    // Fetch Webhooks
    const fetchWebhooks = useCallback(async () => {
        try {
            const result = await Api.get('/webhooks');
            setWebhooks(result.subscriptions || []);
        } catch (error) {
            console.error('Failed to fetch webhooks:', error);
        }
    }, []);

    // Fetch Available Events
    const fetchAvailableEvents = useCallback(async () => {
        try {
            const result = await Api.get('/webhooks/events');
            setAvailableEvents(result.events || []);
        } catch (error) {
            console.error('Failed to fetch events:', error);
        }
    }, []);

    // Fetch Integrations
    const fetchIntegrations = async () => {
        if (!currentUser.organizationId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await Api.getIntegrations(currentUser.organizationId);
            setIntegrations(data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load integrations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIntegrations();
        fetchWebhooks();
        fetchAvailableEvents();
    }, [currentUser.organizationId, fetchWebhooks, fetchAvailableEvents]);

    // Show message if user has no organization
    if (!currentUser.organizationId) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations</h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        Connect external tools to streamline your workflow.
                    </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-8 text-center">
                    <Building2 size={48} className="mx-auto text-amber-600 dark:text-amber-500 mb-4" />
                    <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-400 mb-2">
                        Organization Required
                    </h3>
                    <p className="text-amber-700 dark:text-amber-500/80 text-sm max-w-md mx-auto">
                        Integrations are configured at the organization level. Please create or join an organization
                        first in the Organization settings.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-purple-600" />
            </div>
        );
    }

    const handleConnect = (providerId: string) => {
        setSelectedProvider(providerId);
        setConfigInput('');
        setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!selectedProvider || !configInput) {
            toast.error('Please provide a webhook URL or API token');
            return;
        }
        setConnecting(true);
        try {
            // Simplified config parsing - in real app would be form fields per provider
            const config = { webhook_url: configInput, api_token: configInput };

            await Api.saveIntegration({
                organizationId: currentUser.organizationId,
                provider: selectedProvider,
                config,
            });

            toast.success(
                `${INTEGRATION_PROVIDERS.find((p) => p.id === selectedProvider)?.name} connected successfully!`,
            );
            await fetchIntegrations();
            setIsModalOpen(false);
            setConfigInput('');
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to connect integration');
        } finally {
            setConnecting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Disconnect this integration?')) return;
        try {
            await Api.deleteIntegration(id);
            toast.success('Integration disconnected');
            fetchIntegrations();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to disconnect integration');
        }
    };

    // Webhook handlers
    const handleCreateWebhook = async () => {
        if (!webhookForm.name || !webhookForm.targetUrl || webhookForm.eventTypes.length === 0) {
            toast.error('Please fill all required fields');
            return;
        }

        setConnecting(true);
        try {
            await Api.post('/webhooks', webhookForm);
            toast.success('Webhook created successfully!');
            setIsWebhookModalOpen(false);
            setWebhookForm({ name: '', targetUrl: '', eventTypes: [] });
            fetchWebhooks();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create webhook');
        } finally {
            setConnecting(false);
        }
    };

    const handleDeleteWebhook = async (id: string) => {
        if (!confirm('Delete this webhook?')) return;
        try {
            await Api.delete(`/webhooks/${id}`);
            toast.success('Webhook deleted');
            fetchWebhooks();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete webhook');
        }
    };

    const handleTestWebhook = async (targetUrl: string) => {
        setTestingWebhook(true);
        try {
            const result = await Api.post('/webhooks/test', { targetUrl });
            if (result.success) {
                toast.success(`Test successful! Response: ${result.statusCode} (${result.duration}ms)`);
            } else {
                toast.error(`Test failed: ${result.error}`);
            }
        } catch (error: any) {
            toast.error('Failed to test webhook');
        } finally {
            setTestingWebhook(false);
        }
    };

    const toggleEventType = (eventType: string) => {
        if (webhookForm.eventTypes.includes(eventType)) {
            setWebhookForm({
                ...webhookForm,
                eventTypes: webhookForm.eventTypes.filter((e) => e !== eventType),
            });
        } else {
            setWebhookForm({
                ...webhookForm,
                eventTypes: [...webhookForm.eventTypes, eventType],
            });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 relative">
            <InfoButton cardId="settings-integrations" position="top-right" />
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations</h2>
                <p className="text-slate-500 dark:text-slate-400">Connect external tools and configure webhooks.</p>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('integrations')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        activeTab === 'integrations'
                            ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    External Tools
                </button>
                <button
                    onClick={() => setActiveTab('webhooks')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                        activeTab === 'webhooks'
                            ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Webhook size={16} />
                    Webhooks
                </button>
            </div>
            {activeTab === 'integrations' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {INTEGRATION_PROVIDERS.map((p) => {
                        const connected = integrations.find((i) => i.provider === p.id);
                        const Icon = p.icon;

                        return (
                            <div
                                key={p.id}
                                className="bg-white dark:bg-navy-800 p-6 rounded-xl border border-slate-200 dark:border-white/10 flex flex-col justify-between hover:shadow-lg transition-shadow"
                            >
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div
                                            className={`p-2 rounded-lg ${connected ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'}`}
                                        >
                                            <Icon size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                                            <p className="text-xs text-slate-500">{p.description}</p>
                                        </div>
                                    </div>
                                    {connected && (
                                        <div className="mb-4 text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded inline-flex items-center gap-1">
                                            <CheckCircle size={12} /> Connected
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => (connected ? handleDelete(connected.id) : handleConnect(p.id))}
                                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                                        connected
                                            ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                >
                                    {connected ? 'Disconnect' : 'Connect'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}{' '}
            {/* Connection Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-navy-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">
                            Connect {INTEGRATION_PROVIDERS.find((p) => p.id === selectedProvider)?.name}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Webhook URL / API Token
                                </label>
                                <input
                                    type="text"
                                    value={configInput}
                                    onChange={(e) => setConfigInput(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="https://hooks.slack.com/..."
                                />
                            </div>
                            <div className="flex gap-3 justify-end pt-4">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={connecting || !configInput}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
                                >
                                    {connecting && <Loader2 size={16} className="animate-spin" />}
                                    {connecting ? 'Connecting...' : 'Save Integration'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Webhooks Tab */}
            {activeTab === 'webhooks' && (
                <div className="space-y-6">
                    {/* Info Banner */}
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <Info size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-blue-900 dark:text-blue-300">Webhooks</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                                    Webhooks allow you to receive real-time notifications when events happen in
                                    Consultify. Configure a URL to receive HTTP POST requests with event data.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Add Webhook Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsWebhookModalOpen(true)}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                            <Plus size={18} />
                            Add Webhook
                        </button>
                    </div>

                    {/* Webhooks List */}
                    {webhooks.length === 0 ? (
                        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-12 text-center">
                            <Webhook size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                No webhooks configured
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                                Create a webhook to start receiving real-time event notifications.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {webhooks.map((webhook) => (
                                <div
                                    key={webhook.id}
                                    className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-6"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                                {webhook.name}
                                                {webhook.isActive ? (
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600 rounded-full">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-slate-500/10 text-slate-600 rounded-full">
                                                        Inactive
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-1 break-all">
                                                {webhook.targetUrl}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleTestWebhook(webhook.targetUrl)}
                                                disabled={testingWebhook}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 hover:text-violet-600 transition-colors"
                                                title="Test webhook"
                                            >
                                                {testingWebhook ? (
                                                    <Loader2 size={18} className="animate-spin" />
                                                ) : (
                                                    <Send size={18} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteWebhook(webhook.id)}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                                                title="Delete webhook"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {webhook.eventTypes.map((event) => (
                                            <span
                                                key={event}
                                                className="px-2 py-1 text-xs font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded"
                                            >
                                                {event}
                                            </span>
                                        ))}
                                    </div>

                                    {webhook.secretKey && (
                                        <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Secret Key:</span>
                                                <code className="text-xs bg-slate-100 dark:bg-navy-900 px-2 py-1 rounded font-mono">
                                                    {showSecret === webhook.id ? webhook.secretKey : '••••••••••••••••'}
                                                </code>
                                                <button
                                                    onClick={() =>
                                                        setShowSecret(showSecret === webhook.id ? null : webhook.id)
                                                    }
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-400"
                                                >
                                                    {showSecret === webhook.id ? (
                                                        <EyeOff size={14} />
                                                    ) : (
                                                        <Eye size={14} />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => copyToClipboard(webhook.secretKey || '')}
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-400"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {/* Webhook Modal */}
            {isWebhookModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-navy-800 rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Create Webhook</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={webhookForm.name}
                                    onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    placeholder="My Webhook"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Target URL *
                                </label>
                                <input
                                    type="url"
                                    value={webhookForm.targetUrl}
                                    onChange={(e) => setWebhookForm({ ...webhookForm, targetUrl: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    placeholder="https://your-server.com/webhook"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Events to Subscribe *
                                </label>
                                <div className="space-y-4 max-h-60 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-lg p-4">
                                    {availableEvents.map((category) => (
                                        <div key={category.category}>
                                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                {category.category}
                                            </h4>
                                            <div className="space-y-2">
                                                {category.events.map((event) => (
                                                    <label
                                                        key={event.type}
                                                        className="flex items-center gap-3 cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={webhookForm.eventTypes.includes(event.type)}
                                                            onChange={() => toggleEventType(event.type)}
                                                            className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                                        />
                                                        <div>
                                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                                {event.type}
                                                            </span>
                                                            <p className="text-xs text-slate-500">
                                                                {event.description}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4">
                                <button
                                    onClick={() => {
                                        setIsWebhookModalOpen(false);
                                        setWebhookForm({ name: '', targetUrl: '', eventTypes: [] });
                                    }}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateWebhook}
                                    disabled={
                                        connecting ||
                                        !webhookForm.name ||
                                        !webhookForm.targetUrl ||
                                        webhookForm.eventTypes.length === 0
                                    }
                                    className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-medium flex items-center gap-2"
                                >
                                    {connecting && <Loader2 size={16} className="animate-spin" />}
                                    {connecting ? 'Creating...' : 'Create Webhook'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
