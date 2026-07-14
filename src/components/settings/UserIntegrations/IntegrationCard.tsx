/**
 * IntegrationCard
 *
 * Card component for displaying and managing a single integration.
 */

import { AlertTriangle, Check, Clock, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { UserIntegration } from '../../../hooks/useUserIntegrations';

interface ProviderConfig {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  features: string[];
  capabilities: string[];
}

interface IntegrationCardProps {
  provider: ProviderConfig;
  connection: UserIntegration | undefined;
  isConnected: boolean;
  isTesting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onTest: () => void;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  provider,
  connection,
  isConnected,
  isTesting,
  onConnect,
  onDisconnect,
  onTest,
}) => {
  const { t } = useTranslation();
  const Icon = provider.icon;

  // Determine status
  const status = connection?.status || 'disconnected';
  const isError = status === 'error';
  const isExpired = status === 'expired';
  const needsReauth = isError || isExpired;

  return (
    <div
      className={`bg-c-surface rounded-xl border transition-all ${
        isConnected
          ? 'border-green-200 dark:border-green-900/50'
          : needsReauth
            ? 'border-amber-200 dark:border-amber-900/50'
            : 'border-c-border-subtle dark:border-navy-700'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          {/* Provider info */}
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl ${
                isConnected
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-c-surface-raised text-c-text-muted'
              }`}
            >
              <Icon />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-c-text">{provider.name}</h3>
              <p className="text-sm text-c-text-muted mt-0.5">{provider.description}</p>

              {/* Connection status */}
              {isConnected && connection && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                    <Check size={12} />
                    {t('settings.integrations.connected', 'Connected')}
                  </span>
                  {connection.externalWorkspaceName && (
                    <span className="text-xs text-c-text-muted">
                      as {connection.externalWorkspaceName}
                    </span>
                  )}
                </div>
              )}

              {/* Error status */}
              {needsReauth && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                    {isExpired ? <Clock size={12} /> : <AlertTriangle size={12} />}
                    {isExpired
                      ? t('settings.integrations.expired', 'Token Expired')
                      : t('settings.integrations.error', 'Connection Error')}
                  </span>
                </div>
              )}

              {/* Last sync */}
              {connection?.lastSyncAt && (
                <p className="text-xs text-c-text-secondary mt-1">
                  {t('settings.integrations.lastSync', 'Last sync')}:{' '}
                  {new Date(connection.lastSyncAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                {/* Test button */}
                <button
                  onClick={onTest}
                  disabled={isTesting}
                  className="p-2 text-c-text-secondary hover:text-brand transition-colors disabled:opacity-50"
                  title={t('settings.integrations.testConnection', 'Test connection')}
                >
                  {isTesting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <RefreshCw size={18} />
                  )}
                </button>

                {/* Disconnect button */}
                <button
                  onClick={onDisconnect}
                  className="px-4 py-2 text-sm font-medium text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 border border-danger-200 dark:border-danger-900/50 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                >
                  {t('settings.integrations.disconnect', 'Disconnect')}
                </button>
              </>
            ) : needsReauth ? (
              <button
                onClick={onConnect}
                className="px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                {t('settings.integrations.reconnect', 'Reconnect')}
              </button>
            ) : (
              <button
                onClick={onConnect}
                className="px-4 py-2 text-sm font-medium text-white dark:text-navy-950 bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
              >
                {t('settings.integrations.connect', 'Connect')}
              </button>
            )}
          </div>
        </div>

        {/* Features */}
        {provider.features.length > 0 && (
          <div className="mt-4 pt-4 border-t border-c-border-subtle dark:border-navy-700">
            <div className="flex flex-wrap gap-2">
              {provider.features.map((feature, idx) => (
                <span
                  key={idx}
                  className="text-xs text-c-text-muted bg-c-surface-raised px-2 py-1 rounded"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {connection?.lastError && (
          <div className="mt-4 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
            <p className="text-xs text-danger-600 dark:text-danger-400">{connection.lastError}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationCard;
