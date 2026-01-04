/**
 * IntegrationsModule - Apps & API Integrations
 *
 * Tabs: Apps | API Keys | Webhooks | Calendar
 */

import { Calendar, Grid3X3, Key, Webhook } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IntegrationSettings } from '../../components/settings/IntegrationSettings';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { User } from '../../types';

interface IntegrationsModuleProps {
    initialTab?: string;
    currentUser: User;
}

// API Keys Component
const APIKeysSettings: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [apiKeys, setApiKeys] = useState([
        { id: '1', name: 'Production Key', prefix: 'pk_live_****', created: '2024-11-15', lastUsed: '2 hours ago' },
        { id: '2', name: 'Development Key', prefix: 'pk_test_****', created: '2024-10-20', lastUsed: '3 days ago' },
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {t('settings.apiKeys.title', 'API Keys')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('settings.apiKeys.description', 'Manage your API keys for programmatic access')}
                    </p>
                </div>
                <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                    {t('settings.apiKeys.create', 'Create New Key')}
                </button>
            </div>

            <div className="space-y-3">
                {apiKeys.map((key) => (
                    <div
                        key={key.id}
                        className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">{key.name}</p>
                                <p className="text-sm text-slate-500 font-mono">{key.prefix}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500">
                                    {t('settings.apiKeys.created', 'Created')}: {key.created}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {t('settings.apiKeys.lastUsed', 'Last used')}: {key.lastUsed}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button className="px-3 py-1 text-sm bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 rounded-lg transition-colors">
                                {t('settings.apiKeys.copy', 'Copy')}
                            </button>
                            <button className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                {t('settings.apiKeys.revoke', 'Revoke')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Webhooks Component
const WebhooksSettings: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [webhooks, setWebhooks] = useState([
        {
            id: '1',
            url: 'https://api.example.com/webhook',
            events: ['task.created', 'task.completed'],
            status: 'active',
        },
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {t('settings.webhooks.title', 'Webhooks')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('settings.webhooks.description', 'Receive real-time notifications about events')}
                    </p>
                </div>
                <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                    {t('settings.webhooks.add', 'Add Webhook')}
                </button>
            </div>

            {webhooks.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-white/5 rounded-xl">
                    <Webhook className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">
                        {t('settings.webhooks.empty', 'No webhooks configured')}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {webhooks.map((webhook) => (
                        <div
                            key={webhook.id}
                            className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white font-mono text-sm">
                                        {webhook.url}
                                    </p>
                                    <div className="flex gap-1 mt-2">
                                        {webhook.events.map((event) => (
                                            <span
                                                key={event}
                                                className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded"
                                            >
                                                {event}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span
                                        className={`px-2 py-0.5 text-xs rounded-full ${
                                            webhook.status === 'active'
                                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                                : 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        {webhook.status}
                                    </span>
                                    <button className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                        {t('settings.webhooks.delete', 'Delete')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Calendar Sync Component
const CalendarSyncSettings: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [googleConnected, setGoogleConnected] = useState(false);
    const [outlookConnected, setOutlookConnected] = useState(false);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t('settings.calendar.title', 'Calendar Sync')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('settings.calendar.description', 'Sync your tasks and deadlines with external calendars')}
                </p>
            </div>

            <div className="space-y-4">
                {/* Google Calendar */}
                <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-lg flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">Google Calendar</p>
                                <p className="text-sm text-slate-500">
                                    {googleConnected
                                        ? t('settings.calendar.connected', 'Connected')
                                        : t('settings.calendar.notConnected', 'Not connected')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setGoogleConnected(!googleConnected)}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                googleConnected
                                    ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/30'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                        >
                            {googleConnected
                                ? t('settings.calendar.disconnect', 'Disconnect')
                                : t('settings.calendar.connect', 'Connect')}
                        </button>
                    </div>
                </div>

                {/* Outlook Calendar */}
                <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">Outlook Calendar</p>
                                <p className="text-sm text-slate-500">
                                    {outlookConnected
                                        ? t('settings.calendar.connected', 'Connected')
                                        : t('settings.calendar.notConnected', 'Not connected')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setOutlookConnected(!outlookConnected)}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                outlookConnected
                                    ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/30'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                        >
                            {outlookConnected
                                ? t('settings.calendar.disconnect', 'Disconnect')
                                : t('settings.calendar.connect', 'Connect')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const IntegrationsModule: React.FC<IntegrationsModuleProps> = ({ initialTab, currentUser }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab || 'apps');

    const tabs: Tab[] = [
        {
            id: 'apps',
            label: t('settings.tabs.apps', 'Apps'),
            icon: <Grid3X3 size={16} />,
        },
        {
            id: 'api-keys',
            label: t('settings.tabs.apiKeys', 'API Keys'),
            icon: <Key size={16} />,
        },
        {
            id: 'webhooks',
            label: t('settings.tabs.webhooks', 'Webhooks'),
            icon: <Webhook size={16} />,
        },
        {
            id: 'calendar',
            label: t('settings.tabs.calendar', 'Calendar'),
            icon: <Calendar size={16} />,
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'apps':
                return <IntegrationSettings currentUser={currentUser} />;
            case 'api-keys':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <APIKeysSettings currentUser={currentUser} />
                    </div>
                );
            case 'webhooks':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <WebhooksSettings currentUser={currentUser} />
                    </div>
                );
            case 'calendar':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <CalendarSyncSettings currentUser={currentUser} />
                    </div>
                );
            default:
                return <IntegrationSettings currentUser={currentUser} />;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={t('settings.modules.integrations', 'Integrations')}
            subtitle={t('settings.modules.integrationsDesc', 'Connect apps, manage API keys, and configure webhooks')}
        >
            {renderContent()}
        </TabLayout>
    );
};

export default IntegrationsModule;



