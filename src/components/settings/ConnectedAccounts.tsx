/**
 * ConnectedAccounts - Social/OAuth account connections
 * Bundle 30.5 (T112) — Real OAuth connect/disconnect
 */

import { AlertTriangle, Check, Loader2, Shield, Unlink } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface ConnectedAccountsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface ConnectedAccount {
  provider: string;
  email: string | null;
  displayName: string | null;
  connectedAt: string;
  status: string;
}

const PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    icon: (props: any) => (
      <svg {...props} viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
    color:
      'bg-c-surface border border-c-border-subtle hover:bg-c-surface-raised dark:hover:bg-c-surface-raised',
    textColor: 'text-c-text-secondary',
    description: 'settings.connectedAccounts.googleDesc',
    benefits: ['Quick sign-in', 'Sync calendar', 'Import contacts'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: (props: any) => (
      <svg {...props} viewBox="0 0 24 24" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    color: 'bg-[#0A66C2] hover:bg-[#004182]',
    textColor: 'text-white',
    description: 'settings.connectedAccounts.linkedinDesc',
    benefits: ['Import work history', 'Professional profile', 'Network insights'],
  },
];

export const ConnectedAccounts: React.FC<ConnectedAccountsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadAccounts();

    // Check URL params for connect result
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const connectError = params.get('connect_error');

    if (connected) {
      toast.success(
        t('settings.connectedAccounts.connectSuccess', {
          provider: connected.charAt(0).toUpperCase() + connected.slice(1),
          defaultValue: `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!`,
        })
      );
      window.history.replaceState({}, '', window.location.pathname);
      loadAccounts();
    } else if (connectError) {
      toast.error(
        t('settings.connectedAccounts.connectFailed', {
          defaultValue: `Failed to connect: ${connectError}`,
        })
      );
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [currentUser.id]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await (Api as any).get('/settings/connected-accounts');
      setAccounts(data?.accounts || []);
    } catch {
      setLoadError(true);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    setDisconnecting(providerId);
    try {
      await (Api as any).delete(`/settings/connected-accounts/${providerId}`);
      toast.success(t('settings.connectedAccounts.disconnected', 'Account disconnected'));
      await loadAccounts();
    } catch {
      toast.error(t('settings.connectedAccounts.disconnectError', 'Failed to disconnect account'));
    } finally {
      setDisconnecting(null);
    }
  };

  const isConnected = (providerId: string): boolean => {
    return accounts.some((a) => a.provider === providerId);
  };

  const getConnectionInfo = (providerId: string): ConnectedAccount | undefined => {
    return accounts.find((a) => a.provider === providerId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text">
          {t('settings.connectedAccounts.title', 'Connected Accounts')}
        </h3>
        <p className="text-sm text-c-text-muted mt-1">
          {t(
            'settings.connectedAccounts.managedSubtitle',
            'Review or revoke accounts connected before external sign-in was disabled'
          )}
        </p>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle size={16} />
          <span>
            {t(
              'settings.connectedAccounts.loadError',
              'Unable to load connection status. Shown status may be inaccurate.'
            )}
          </span>
          <button
            type="button"
            onClick={loadAccounts}
            className="ml-auto text-xs underline hover:no-underline"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {!loading && !loadError && accounts.length === 0 && (
          <p className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-4 text-sm text-c-text-muted">
            {t(
              'settings.connectedAccounts.noExistingConnections',
              'No external accounts are connected.'
            )}
          </p>
        )}
        {PROVIDERS.filter((provider) => isConnected(provider.id)).map((provider) => {
          const connected = isConnected(provider.id);
          const connectionInfo = getConnectionInfo(provider.id);
          const isDisconnecting = disconnecting === provider.id;

          return (
            <div
              key={provider.id}
              className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-c-surface-raised flex items-center justify-center">
                    <provider.icon className="w-6 h-6" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-c-text">{provider.name}</h4>
                      {connected && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                          <Check size={12} />
                          {t('settings.connectedAccounts.connected', 'Connected')}
                        </span>
                      )}
                    </div>

                    {connected && connectionInfo ? (
                      <div className="mt-1">
                        <p className="text-sm text-c-text-secondary">
                          {connectionInfo.email || connectionInfo.displayName}
                        </p>
                        <p className="text-xs text-c-text-secondary mt-0.5">
                          {t('settings.connectedAccounts.connectedOn', 'Connected')}{' '}
                          {new Date(connectionInfo.connectedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-c-text-muted mt-1">
                        {t(provider.description, provider.description)}
                      </p>
                    )}

                    {!connected && (
                      <div className="flex items-center gap-3 mt-3">
                        {provider.benefits.map((benefit, idx) => (
                          <span
                            key={idx}
                            className="text-xs text-c-text-muted bg-c-surface-raised px-2 py-1 rounded"
                          >
                            {benefit}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDisconnect(provider.id)}
                  disabled={isDisconnecting}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-danger-600 hover:text-danger-700 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Unlink size={14} />
                  )}
                  {t('settings.connectedAccounts.disconnect', 'Disconnect')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-c-surface-raised rounded-lg border border-c-border-subtle dark:border-navy-700">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-c-text-muted mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-c-text-secondary">
              {t('settings.connectedAccounts.securityTitle', 'Your data is secure')}
            </p>
            <p className="text-xs text-c-text-muted mt-1">
              {t(
                'settings.connectedAccounts.securityText',
                'We only request minimal permissions. Your credentials are never stored. You can disconnect at any time.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectedAccounts;
