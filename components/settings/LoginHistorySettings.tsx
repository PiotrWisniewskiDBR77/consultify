/**
 * LoginHistorySettings - View login history
 */

import { AlertTriangle, CheckCircle, History, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface LoginEvent {
    id: string;
    timestamp: string;
    status: 'success' | 'failed' | 'suspicious';
    location: string;
    ip: string;
    device: string;
}

interface LoginHistorySettingsProps {
    className?: string;
}

export const LoginHistorySettings: React.FC<LoginHistorySettingsProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const [history, setHistory] = useState<LoginEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const historyData = await Api.getLoginHistory();
            setHistory(historyData);
        } catch (error) {
            console.error('Failed to fetch login history:', error);
            // Use mock data if API not available
            setHistory([
                {
                    id: '1',
                    timestamp: new Date().toISOString(),
                    status: 'success',
                    location: 'Warsaw, Poland',
                    ip: '192.168.1.1',
                    device: 'Chrome on Windows',
                },
                {
                    id: '2',
                    timestamp: new Date(Date.now() - 86400000).toISOString(),
                    status: 'success',
                    location: 'Warsaw, Poland',
                    ip: '192.168.1.1',
                    device: 'Safari on iOS',
                },
                {
                    id: '3',
                    timestamp: new Date(Date.now() - 172800000).toISOString(),
                    status: 'failed',
                    location: 'Unknown',
                    ip: '10.0.0.1',
                    device: 'Unknown',
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="text-green-500" size={18} aria-label="Successful" />;
            case 'failed':
                return <XCircle className="text-red-500" size={18} aria-label="Failed" />;
            case 'suspicious':
                return <AlertTriangle className="text-amber-500" size={18} aria-label="Suspicious" />;
            default:
                return null;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className={`space-y-6 ${className}`}>
            <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <History size={20} />
                    {t('settings.security.loginHistoryTitle', 'Login History')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('settings.security.loginHistoryDesc', 'Review recent login activity on your account.')}
                </p>
            </div>

            {loading ? (
                <div className="text-center py-8 text-slate-400">{t('common.loading', 'Loading...')}</div>
            ) : (
                <div className="space-y-2">
                    {(history || []).map((event) => (
                        <div
                            key={event.id}
                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg"
                        >
                            <div className="flex items-center gap-4">
                                {getStatusIcon(event.status || 'success')}
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {event.device || 'Unknown Device'}
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {event.location || 'Unknown Location'} · {event.ip || 'Unknown IP'}
                                    </p>
                                </div>
                            </div>
                            <span className="text-sm text-slate-400">
                                {formatDate(event.timestamp || new Date().toISOString())}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LoginHistorySettings;



