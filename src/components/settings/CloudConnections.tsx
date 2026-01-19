/**
 * CloudConnections - Manage cloud storage OAuth connections
 * Connect/disconnect Google Drive, OneDrive, Dropbox
 *
 * @version 1.0.0
 */

import {
  AlertCircle,
  Check,
  ChevronRight,
  Cloud,
  ExternalLink,
  HardDrive,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  Unplug,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Cloud provider icons as inline SVGs
const GoogleDriveIcon = () => (
  <svg viewBox="0 0 87.3 78" className="w-6 h-6">
    <path fill="#0066DA" d="M6.6 66.85L14.55 78h58.2l7.95-11.15-36.85-.05L6.6 66.85z" />
    <path fill="#00AC47" d="M29.45 0L.75 50.3l13.85 16.55L58 0H29.45z" />
    <path fill="#EA4335" d="M58 0l28.85 50.3H50.1L21.25 0H58z" />
    <path fill="#00832D" d="M43.8 66.8L21.25 0 7.4 50.3l36.4 16.5z" />
    <path fill="#2684FC" d="M43.85 66.85L80.25 50.3 58 0 21.25 0l22.6 66.85z" />
    <path fill="#FFBA00" d="M80.25 50.3L43.85 66.85l29.2-.05 7.2-16.5z" />
  </svg>
);

const OneDriveIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#0078D4]" fill="currentColor">
    <path d="M10.5 18.5h8.25a3.75 3.75 0 001.41-7.23 5.25 5.25 0 00-10.32 0A3.75 3.75 0 0010.5 18.5z" />
    <path
      d="M6.75 18.5h1.5a4.5 4.5 0 018.68-1.66 3 3 0 00-3.18-4.59 6 6 0 00-11.5 1.5A4.5 4.5 0 006.75 18.5z"
      opacity="0.7"
    />
  </svg>
);

const DropboxIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#0061FF]" fill="currentColor">
    <path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 13.25L6 9.5l6 3.75-6 3.75-6-3.75zm18-3.75l6 3.75-6 3.75-6-3.75 6-3.75zM6 18.25l6-3.75 6 3.75-6 3.75-6-3.75z" />
  </svg>
);

interface CloudProvider {
  id: 'google-drive' | 'onedrive' | 'dropbox';
  name: string;
  icon: React.ReactNode;
  description: string;
  connected: boolean;
  email?: string;
  quota?: {
    used: number;
    total: number;
  };
  lastSync?: string;
}

interface CloudConnectionsProps {
  onConnect: (provider: string) => Promise<void>;
  onDisconnect: (provider: string) => Promise<void>;
  onRefresh: (provider: string) => Promise<void>;
}

export const CloudConnections: React.FC<CloudConnectionsProps> = ({
  onConnect,
  onDisconnect,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<CloudProvider[]>([
    {
      id: 'google-drive',
      name: 'Google Drive',
      icon: <GoogleDriveIcon />,
      description: t('cloud.googleDrive.description', 'Access your Google Drive files'),
      connected: false,
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      icon: <OneDriveIcon />,
      description: t('cloud.oneDrive.description', 'Access your OneDrive and SharePoint files'),
      connected: false,
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      icon: <DropboxIcon />,
      description: t('cloud.dropbox.description', 'Access your Dropbox files'),
      connected: false,
    },
  ]);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load connection status
  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const loadConnectionStatus = async () => {
    try {
      // In production, fetch from API
      // const status = await Api.getCloudConnectionStatus();
      // setProviders(prevProviders => prevProviders.map(p => ({
      //   ...p,
      //   ...status[p.id]
      // })));

      // Demo: Show Google Drive as connected
      setProviders((prev) =>
        prev.map((p) =>
          p.id === 'google-drive'
            ? {
                ...p,
                connected: false, // Change to true to demo connected state
                // email: 'user@example.com',
                // quota: { used: 5.2 * 1024 * 1024 * 1024, total: 15 * 1024 * 1024 * 1024 },
                // lastSync: new Date().toISOString(),
              }
            : p
        )
      );
    } catch (err) {
      console.error('Failed to load connection status:', err);
    }
  };

  const handleConnect = async (providerId: string) => {
    setIsLoading(providerId);
    setError(null);

    try {
      await onConnect(providerId);

      // Update provider state after successful connection
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                connected: true,
                lastSync: new Date().toISOString(),
              }
            : p
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    if (!confirm(t('cloud.confirmDisconnect', 'Are you sure you want to disconnect this account?'))) {
      return;
    }

    setIsLoading(providerId);
    setError(null);

    try {
      await onDisconnect(providerId);

      // Update provider state
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                connected: false,
                email: undefined,
                quota: undefined,
                lastSync: undefined,
              }
            : p
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(null);
    }
  };

  const handleRefresh = async (providerId: string) => {
    setIsLoading(providerId);
    setError(null);

    try {
      await onRefresh(providerId);

      // Update last sync time
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                lastSync: new Date().toISOString(),
              }
            : p
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
          {t('cloud.title', 'Cloud Storage')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('cloud.description', 'Connect your cloud storage accounts to access files in AI conversations')}
        </p>
      </div>

      {/* Security Note */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t(
                'cloud.securityNote',
                'Your cloud credentials are securely stored and encrypted. We only request read access to files you explicitly select.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Provider List */}
      <div className="space-y-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-navy-700 flex items-center justify-center">
                  {provider.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-800 dark:text-white">{provider.name}</h4>
                    {provider.connected && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-full">
                        <Check size={12} />
                        {t('common.connected', 'Connected')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{provider.description}</p>
                  {provider.connected && provider.email && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{provider.email}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isLoading === provider.id ? (
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                ) : provider.connected ? (
                  <>
                    <button
                      onClick={() => handleRefresh(provider.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                      title={t('common.refresh', 'Refresh')}
                    >
                      <RefreshCw size={18} />
                    </button>
                    <button
                      onClick={() => handleDisconnect(provider.id)}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t('common.disconnect', 'Disconnect')}
                    >
                      <Unplug size={18} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(provider.id)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                  >
                    <Cloud size={16} />
                    {t('common.connect', 'Connect')}
                  </button>
                )}
              </div>
            </div>

            {/* Connected Details */}
            {provider.connected && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-t border-slate-200 dark:border-navy-700">
                <div className="flex items-center justify-between text-sm">
                  {/* Storage Quota */}
                  {provider.quota && (
                    <div className="flex items-center gap-3">
                      <HardDrive size={14} className="text-slate-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 dark:text-slate-400">
                            {formatBytes(provider.quota.used)} / {formatBytes(provider.quota.total)}
                          </span>
                        </div>
                        <div className="w-32 h-1.5 bg-slate-200 dark:bg-navy-600 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{
                              width: `${Math.min(100, (provider.quota.used / provider.quota.total) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Last Sync */}
                  {provider.lastSync && (
                    <span className="text-xs text-slate-400">
                      {t('cloud.lastSync', 'Last synced')}: {formatDate(provider.lastSync)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Help Text */}
      <div className="text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('cloud.helpText', 'Need help setting up?')}{' '}
          <a
            href="/docs/cloud-integration"
            className="text-primary-500 hover:text-primary-600 hover:underline"
          >
            {t('cloud.viewDocs', 'View documentation')}
            <ExternalLink size={12} className="inline ml-1" />
          </a>
        </p>
      </div>
    </div>
  );
};

export default CloudConnections;
