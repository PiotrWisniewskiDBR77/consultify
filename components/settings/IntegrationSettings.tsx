import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Plus, Trash2, ExternalLink, CheckCircle } from 'lucide-react';
import { Slack, Trello, MessageCircle, Database, CheckSquare, Calendar, FileText, MessageSquare } from 'lucide-react'; // Simulating icons for Jira/Teams/etc if not available

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
    { id: 'basecamp', name: 'Basecamp', icon: MessageSquare, description: 'Project management and communication' }
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
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [configInput, setConfigInput] = useState('');

    // Fetch Integrations
    const fetchIntegrations = async () => {
        if (!currentUser.organizationId) return;
        try {
            const res = await fetch(`http://localhost:3005/api/settings/integrations?organizationId=${currentUser.organizationId}`);
            if (res.ok) {
                const data = await res.json();
                setIntegrations(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchIntegrations();
    }, [currentUser.organizationId]);

    const handleConnect = (providerId: string) => {
        setSelectedProvider(providerId);
        setConfigInput('');
        setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!selectedProvider || !configInput) return;
        setLoading(true);
        try {
            // Simplified config parsing - in real app would be form fields per provider
            const config = { webhook_url: configInput, api_token: configInput };

            const res = await fetch('http://localhost:3005/api/settings/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizationId: currentUser.organizationId,
                    provider: selectedProvider,
                    config
                })
            });

            if (res.ok) {
                await fetchIntegrations();
                setIsModalOpen(false);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Disconnect this integration?')) return;
        try {
            await fetch('http://localhost:3005/api/settings/integrations/' + id, { method: 'DELETE' });
            fetchIntegrations();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations</h2>
                <p className="text-slate-500 dark:text-slate-400">Connect external tools to streamline your workflow.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {INTEGRATION_PROVIDERS.map(p => {
                    const connected = integrations.find(i => i.provider === p.id);
                    const Icon = p.icon;

                    return (
                        <div key={p.id} className="bg-white dark:bg-navy-800 p-6 rounded-xl border border-slate-200 dark:border-white/10 flex flex-col justify-between hover:shadow-lg transition-shadow">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-lg ${connected ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'}`}>
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
                                onClick={() => connected ? handleDelete(connected.id) : handleConnect(p.id)}
                                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${connected
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

            {/* Connection Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-navy-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">
                            Connect {INTEGRATION_PROVIDERS.find(p => p.id === selectedProvider)?.name}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Webhook URL / API Token
                                </label>
                                <input
                                    type="text"
                                    value={configInput}
                                    onChange={e => setConfigInput(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="https://hooks.slack.com/..."
                                />
                            </div>
                            <div className="flex gap-3 justify-end pt-4">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !configInput}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {loading ? 'Connecting...' : 'Save Integration'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
