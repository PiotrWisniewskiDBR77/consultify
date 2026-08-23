/**
 * UserIntegrations
 *
 * Component for managing user-level integrations.
 * Each user can connect/disconnect their own accounts (Slack, Teams, Jira, ClickUp).
 *
 * Part of: User-Level Notifications & Integrations System
 */

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Database,
  MessageSquare,
  Plug,
  RefreshCw,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Provider, UserIntegration, useUserIntegrations } from '../../../hooks/useUserIntegrations';
import IntegrationCard from './IntegrationCard';

// Slack icon (simple version)
const SlackIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

// Provider icons mapping
const PROVIDER_ICONS: Record<string, React.ElementType> = {
  slack: SlackIcon,
  teams: MessageSquare,
  jira: Database,
  clickup: CheckCircle2,
};

// Provider descriptions
const PROVIDER_INFO: Record<string, { description: string; features: string[] }> = {
  slack: {
    description: 'Receive notifications and create tasks directly from Slack',
    features: ['Real-time notifications', 'Task creation from messages', 'Interactive buttons'],
  },
  teams: {
    description: 'Get notified in Microsoft Teams',
    features: ['Adaptive cards', 'Channel notifications', 'Direct messages'],
  },
  jira: {
    description: 'Sync tasks and issues with Jira',
    features: ['Bi-directional sync', 'Status mapping', 'Comment sync'],
  },
  clickup: {
    description: 'Sync tasks with ClickUp',
    features: ['Task sync', 'Status sync', 'Time tracking'],
  },
};

interface UserIntegrationsProps {
  className?: string;
}

export const UserIntegrations: React.FC<UserIntegrationsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    message?: string;
  } | null>(null);

  const {
    integrations,
    providers,
    connectedCount,
    loading,
    error,
    connect,
    disconnect,
    testConnection,
    refresh,
  } = useUserIntegrations();

  // Handle connect
  const handleConnect = async (provider: string) => {
    try {
      await connect(provider);
    } catch (err) {
      console.error('Connect error:', err);
    }
  };

  // Handle disconnect
  const handleDisconnect = async (provider: string) => {
    const confirmed = window.confirm(
      t(
        'settings.integrations.disconnectConfirm',
        'Are you sure you want to disconnect this integration?'
      )
    );
    if (confirmed) {
      await disconnect(provider);
    }
  };

  // Handle test connection
  const handleTest = async (provider: string) => {
    setTestingProvider(provider);
    setTestResult(null);

    try {
      const result = await testConnection(provider);
      setTestResult({
        provider,
        success: result.success,
        message: result.error || 'Connection successful',
      });
    } catch (err) {
      setTestResult({
        provider,
        success: false,
        message: 'Test failed',
      });
    } finally {
      setTestingProvider(null);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className={className} />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-c-text flex items-center gap-2">
              <Plug size={24} />
              {t('settings.integrations.title', 'My Connected Apps')}
            </h2>
            <p className="text-c-text-muted mt-1">
              {t(
                'settings.integrations.description',
                'Connect your personal accounts to receive notifications and sync data.'
              )}
            </p>
          </div>
          <button
            onClick={refresh}
            className="p-2 text-c-text-secondary hover:text-brand transition-colors"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Connection count */}
      {connectedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Check size={16} />
          {t('settings.integrations.connectedCount', '{{count}} app(s) connected', {
            count: connectedCount,
          })}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg flex items-center gap-2 text-danger-700 dark:text-danger-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400'
          }`}
        >
          {testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
          <span className="capitalize">{testResult.provider}:</span> {testResult.message}
        </div>
      )}

      {/* Provider cards */}
      <div className="grid gap-4">
        {providers.map((provider) => {
          const Icon = PROVIDER_ICONS[provider.id] || Plug;
          const info = PROVIDER_INFO[provider.id] || { description: '', features: [] };
          const connection = integrations.find((i) => i.provider === provider.id);

          return (
            <IntegrationCard
              key={provider.id}
              provider={{
                id: provider.id,
                name: provider.name,
                icon: Icon,
                description: info.description,
                features: info.features,
                capabilities: provider.capabilities,
              }}
              connection={connection}
              isConnected={provider.isConnected}
              isTesting={testingProvider === provider.id}
              onConnect={() => handleConnect(provider.id)}
              onDisconnect={() => handleDisconnect(provider.id)}
              onTest={() => handleTest(provider.id)}
            />
          );
        })}
      </div>

      {/* Help text */}
      <div className="text-sm text-c-text-muted bg-c-surface-raised rounded-lg p-4">
        <p className="font-medium mb-2">{t('settings.integrations.note', 'Note:')}</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            {t(
              'settings.integrations.notePersonal',
              'These are your personal connections. Each team member sets up their own.'
            )}
          </li>
          <li>
            {t(
              'settings.integrations.noteOAuth',
              'We use secure OAuth to connect. We never store your passwords.'
            )}
          </li>
          <li>
            {t(
              'settings.integrations.noteRevoke',
              "You can revoke access at any time from here or from the provider's settings."
            )}
          </li>
        </ul>
      </div>
    </div>
  );
};

export default UserIntegrations;
