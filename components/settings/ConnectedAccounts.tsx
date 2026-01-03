/**
 * ConnectedAccounts - Social/OAuth account connections
 * 
 * Features:
 * - Connect with Google
 * - Connect with LinkedIn
 * - View connection status
 * - Disconnect accounts
 * 
 * Note: Full OAuth implementation is Phase 2 - this is UI + placeholders
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Link2, 
    Unlink, 
    Check, 
    ExternalLink,
    Loader2,
    AlertTriangle,
    Shield
} from 'lucide-react';
import { User, LinkedAccounts as LinkedAccountsType } from '../../types';
import toast from 'react-hot-toast';

interface ConnectedAccountsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

// Provider configurations
const PROVIDERS = [
    {
        id: 'google',
        name: 'Google',
        icon: (props: any) => (
            <svg {...props} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
        ),
        color: 'bg-white border border-slate-200 dark:border-white/20 hover:bg-slate-50 dark:hover:bg-white/10',
        textColor: 'text-slate-700 dark:text-white',
        description: 'Sign in faster with your Google account',
        benefits: ['Quick sign-in', 'Sync calendar', 'Import contacts']
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        icon: (props: any) => (
            <svg {...props} viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
        ),
        color: 'bg-[#0A66C2] hover:bg-[#004182]',
        textColor: 'text-white',
        description: 'Connect your professional network',
        benefits: ['Import work history', 'Professional profile', 'Network insights']
    }
];

export const ConnectedAccounts: React.FC<ConnectedAccountsProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const [connecting, setConnecting] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState<string | null>(null);

    const linkedAccounts: LinkedAccountsType = currentUser.linkedAccounts || {};

    // Handle connect (placeholder - would redirect to OAuth flow)
    const handleConnect = async (providerId: string) => {
        setConnecting(providerId);
        
        // Simulate OAuth redirect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For now, show coming soon message
        toast.success(
            t('settings.connectedAccounts.comingSoon', 
              `${PROVIDERS.find(p => p.id === providerId)?.name} integration coming soon!`
            ),
            { duration: 3000 }
        );
        
        setConnecting(null);
        
        // In real implementation:
        // window.location.href = `/api/auth/${providerId}/connect`;
    };

    // Handle disconnect
    const handleDisconnect = async (providerId: string) => {
        setDisconnecting(providerId);
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update local state (in real implementation, call API)
            const newLinkedAccounts = { ...linkedAccounts };
            delete newLinkedAccounts[providerId as keyof LinkedAccountsType];
            
            onUpdateUser({ linkedAccounts: newLinkedAccounts });
            toast.success(t('settings.connectedAccounts.disconnected', 'Account disconnected'));
        } catch (error) {
            toast.error(t('settings.connectedAccounts.disconnectError', 'Failed to disconnect account'));
        } finally {
            setDisconnecting(null);
        }
    };

    const isConnected = (providerId: string): boolean => {
        return !!(linkedAccounts as any)[providerId];
    };

    const getConnectionInfo = (providerId: string) => {
        return (linkedAccounts as any)[providerId];
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t('settings.connectedAccounts.title', 'Connected Accounts')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('settings.connectedAccounts.subtitle', 'Connect external accounts for easier sign-in and enhanced features')}
                </p>
            </div>

            {/* Account Cards */}
            <div className="space-y-4">
                {PROVIDERS.map((provider) => {
                    const connected = isConnected(provider.id);
                    const connectionInfo = getConnectionInfo(provider.id);
                    const isConnecting = connecting === provider.id;
                    const isDisconnecting = disconnecting === provider.id;

                    return (
                        <div 
                            key={provider.id}
                            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-5"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    {/* Provider Icon */}
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                                        <provider.icon className="w-6 h-6" />
                                    </div>

                                    {/* Provider Info */}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-slate-900 dark:text-white">
                                                {provider.name}
                                            </h4>
                                            {connected && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                                                    <Check size={12} />
                                                    Connected
                                                </span>
                                            )}
                                        </div>
                                        
                                        {connected && connectionInfo ? (
                                            <div className="mt-1">
                                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                                    {connectionInfo.email || connectionInfo.name}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Connected {new Date(connectionInfo.linkedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                {provider.description}
                                            </p>
                                        )}

                                        {/* Benefits (when not connected) */}
                                        {!connected && (
                                            <div className="flex items-center gap-3 mt-3">
                                                {provider.benefits.map((benefit, idx) => (
                                                    <span 
                                                        key={idx}
                                                        className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded"
                                                    >
                                                        {benefit}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Button */}
                                <div>
                                    {connected ? (
                                        <button
                                            onClick={() => handleDisconnect(provider.id)}
                                            disabled={isDisconnecting}
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isDisconnecting ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Unlink size={14} />
                                            )}
                                            Disconnect
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleConnect(provider.id)}
                                            disabled={isConnecting}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${provider.color} ${provider.textColor} disabled:opacity-50`}
                                        >
                                            {isConnecting ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Link2 size={16} />
                                            )}
                                            Connect
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                <div className="flex items-start gap-3">
                    <Shield size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t('settings.connectedAccounts.securityTitle', 'Your data is secure')}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {t('settings.connectedAccounts.securityText', 
                                'We only request minimal permissions. Your credentials are never stored. You can disconnect at any time.'
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Beta Notice */}
            <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-100 dark:border-amber-500/20">
                <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                            {t('settings.connectedAccounts.betaTitle', 'Coming Soon')}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            {t('settings.connectedAccounts.betaText', 
                                'Social account connections are currently in development. Full OAuth integration will be available soon.'
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConnectedAccounts;







