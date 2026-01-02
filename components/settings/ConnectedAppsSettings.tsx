/**
 * ConnectedAppsSettings - Manage connected applications
 * 
 * Uses the User-Level Integration System for OAuth connections.
 * Each user can connect their own Slack, Teams, Jira, ClickUp accounts.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Link2, RefreshCw, Check, AlertCircle, Loader2,
    MessageSquare, Database, CheckCircle2, AlertTriangle, Clock, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUserIntegrations, Provider, UserIntegration } from '../../hooks/useUserIntegrations';

// Slack icon
const SlackIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
);

// Provider icons mapping
const PROVIDER_ICONS: Record<string, React.ElementType> = {
    slack: SlackIcon,
    teams: MessageSquare,
    jira: Database,
    clickup: CheckCircle2
};

// Provider descriptions and features
const PROVIDER_INFO: Record<string, { description: string; features: string[] }> = {
    slack: {
        description: 'Receive notifications and create tasks from Slack',
        features: ['Real-time notifications', 'Interactive buttons']
    },
    teams: {
        description: 'Get notified in Microsoft Teams',
        features: ['Adaptive cards', 'Direct messages']
    },
    jira: {
        description: 'Sync tasks and issues with Jira',
        features: ['Bi-directional sync', 'Status mapping']
    },
    clickup: {
        description: 'Sync tasks with ClickUp',
        features: ['Task sync', 'Status sync']
    }
};

interface ConnectedAppsSettingsProps {
    className?: string;
}

export const ConnectedAppsSettings: React.FC<ConnectedAppsSettingsProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    
    const {
        integrations,
        providers,
        connectedCount,
        loading,
        error,
        connect,
        disconnect,
        testConnection,
        refresh
    } = useUserIntegrations();

    // Handle connect
    const handleConnect = async (provider: string) => {
        try {
            await connect(provider);
        } catch (err) {
            toast.error(t('settings.integrations.connectError', 'Failed to initiate connection'));
        }
    };

    // Handle disconnect
    const handleDisconnect = async (provider: string) => {
        const confirmed = window.confirm(
            t('settings.integrations.disconnectConfirm', 'Are you sure you want to disconnect this integration?')
        );
        if (confirmed) {
            const success = await disconnect(provider);
            if (success) {
                toast.success(t('settings.integrations.disconnected', 'Disconnected successfully'));
            }
        }
    };

    // Handle test connection
    const handleTest = async (provider: string) => {
        setTestingProvider(provider);
        try {
            const result = await testConnection(provider);
            if (result.success) {
                toast.success(t('settings.integrations.testSuccess', 'Connection working!'));
            } else {
                toast.error(result.error || t('settings.integrations.testFailed', 'Connection test failed'));
            }
        } catch {
            toast.error(t('settings.integrations.testFailed', 'Connection test failed'));
        } finally {
            setTestingProvider(null);
        }
    };

    // Get provider icon
    const getProviderIcon = (providerId: string) => {
        const Icon = PROVIDER_ICONS[providerId] || Link2;
        return <Icon className="w-5 h-5" />;
    };

    if (loading) {
        return (
            <div className={`space-y-6 ${className}`}>
                <div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <Link2 size={20} />
                        {t('settings.integrations.appsTitle', 'Connected Apps')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('settings.integrations.appsDesc', 'Manage third-party applications connected to your account.')}
                    </p>
                </div>
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-brand" />
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <Link2 size={20} />
                        {t('settings.integrations.appsTitle', 'Connected Apps')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('settings.integrations.appsDesc', 'Manage third-party applications connected to your account.')}
                    </p>
                </div>
                <button
                    onClick={refresh}
                    className="p-2 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    title={t('common.refresh', 'Refresh')}
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Connection count badge */}
            {connectedCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Check size={16} />
                    {t('settings.integrations.connectedCount', '{{count}} app(s) connected', { count: connectedCount })}
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {/* Provider cards */}
            <div className="space-y-3">
                {providers.map((provider) => {
                    const connection = integrations.find(i => i.provider === provider.id);
                    const isConnected = provider.isConnected;
                    const isError = connection?.status === 'error';
                    const isExpired = connection?.status === 'expired';
                    const needsReauth = isError || isExpired;
                    const info = PROVIDER_INFO[provider.id] || { description: '', features: [] };

                    return (
                        <div
                            key={provider.id}
                            className={`p-4 rounded-xl border transition-all ${
                                isConnected 
                                    ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' 
                                    : needsReauth
                                        ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                                        : 'bg-slate-50 dark:bg-navy-800/50 border-slate-200 dark:border-white/10'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                {/* Provider info */}
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${
                                        isConnected 
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                            : 'bg-white dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                                    }`}>
                                        {getProviderIcon(provider.id)}
                                    </div>
                                    
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {provider.name}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {info.description}
                                        </p>
                                        
                                        {/* Status badges */}
                                        {isConnected && connection && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                                    <Check size={10} />
                                                    {t('settings.integrations.connected', 'Connected')}
                                                </span>
                                                {connection.externalWorkspaceName && (
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {connection.externalWorkspaceName}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        
                                        {needsReauth && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                                                    {isExpired ? <Clock size={10} /> : <AlertTriangle size={10} />}
                                                    {isExpired 
                                                        ? t('settings.integrations.expired', 'Token Expired')
                                                        : t('settings.integrations.error', 'Connection Error')
                                                    }
                                                </span>
                                            </div>
                                        )}

                                        {connection?.lastSyncAt && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                {t('settings.integrations.lastSync', 'Last sync')}: {new Date(connection.lastSyncAt).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Action buttons */}
                                <div className="flex items-center gap-2">
                                    {isConnected && (
                                        <button
                                            onClick={() => handleTest(provider.id)}
                                            disabled={testingProvider === provider.id}
                                            className="p-2 text-slate-400 hover:text-brand rounded-lg hover:bg-white dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
                                            title={t('settings.integrations.testConnection', 'Test connection')}
                                        >
                                            {testingProvider === provider.id ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <RefreshCw size={16} />
                                            )}
                                        </button>
                                    )}
                                    
                                    {isConnected ? (
                                        <button
                                            onClick={() => handleDisconnect(provider.id)}
                                            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            {t('settings.integrations.disconnect', 'Disconnect')}
                                        </button>
                                    ) : needsReauth ? (
                                        <button
                                            onClick={() => handleConnect(provider.id)}
                                            className="px-3 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                        >
                                            {t('settings.integrations.reconnect', 'Reconnect')}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleConnect(provider.id)}
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors"
                                        >
                                            <ExternalLink size={14} />
                                            {t('settings.integrations.connect', 'Connect')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Features tags */}
                            {info.features.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200/50 dark:border-white/5">
                                    {info.features.map((feature, idx) => (
                                        <span 
                                            key={idx}
                                            className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-navy-700 px-2 py-0.5 rounded"
                                        >
                                            {feature}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Error message */}
                            {connection?.lastError && (
                                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
                                    {connection.lastError}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Help text */}
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800/50 rounded-lg p-3 space-y-1">
                <p className="font-medium">{t('settings.integrations.note', 'Note:')}</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    <li>{t('settings.integrations.notePersonal', 'These are your personal connections.')}</li>
                    <li>{t('settings.integrations.noteOAuth', 'We use secure OAuth - we never store your passwords.')}</li>
                </ul>
            </div>
        </div>
    );
};

export default ConnectedAppsSettings;
