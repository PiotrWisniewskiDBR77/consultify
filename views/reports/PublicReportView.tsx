import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle, Clock, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OrganizationOverviewReport } from './OrganizationOverviewReport';
import { InitiativeExecutionReport } from './InitiativeExecutionReport';

interface ShareLinkData {
    entityType: 'ORG_REPORT' | 'INITIATIVE_REPORT';
    snapshot: unknown;
    expiresAt: string;
    createdAt: string;
}

export const PublicReportView: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const { t } = useTranslation();
    const [data, setData] = useState<ShareLinkData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchShareLink = async () => {
            try {
                const response = await fetch(`/api/reports/public/${token}`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    if (response.status === 404) {
                        throw new Error('notfound');
                    }
                    if (response.status === 410) {
                        // Revoked or expired
                        throw new Error(errorData.error?.includes('revoked') ? 'revoked' : 'expired');
                    }
                    throw new Error('Failed to load report');
                }
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchShareLink();
        }
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">{t('reports.loading')}</p>
                </div>
            </div>
        );
    }

    // Handle revoked links
    if (error === 'revoked') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-8 h-8 text-orange-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('reports.linkRevoked', 'Link Revoked')}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t('reports.linkRevokedDescription', 'This share link has been revoked by the organization.')}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Lock className="w-4 h-4" />
                        <span>{t('reports.contactOrg', 'Contact the organization for access')}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error === 'expired' || error === 'notfound' || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Clock className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('reports.linkExpired')}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t('reports.linkExpiredDescription')}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Lock className="w-4 h-4" />
                        <span>{t('reports.requestNewLink')}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center max-w-md mx-auto p-8">
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('reports.error')}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 relative">
            {/* Watermark Banner - Fixed at top */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-700 to-slate-800 text-white">
                <div className="max-w-5xl mx-auto px-6 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium bg-white/10 px-2 py-1 rounded">
                            <Lock className="w-3 h-3" />
                            <span>{t('reports.sharedSnapshot', 'Shared Snapshot')}</span>
                        </div>
                        <span className="text-xs text-white/70">
                            {t('reports.readOnly', 'Read-only')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/70">
                        <Clock className="w-3 h-3" />
                        <span>
                            {t('reports.expiresOn', 'Expires')}: {new Date(data.expiresAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content with padding for watermark */}
            <div className="pt-10">
                {/* Report Content */}
                {data.entityType === 'ORG_REPORT' && (
                    <OrganizationOverviewReport
                        isPublic={true}
                        snapshotData={data.snapshot as never}
                    />
                )}
                {data.entityType === 'INITIATIVE_REPORT' && (
                    <InitiativeExecutionReport
                        isPublic={true}
                        snapshotData={data.snapshot as never}
                    />
                )}
            </div>

            {/* Bottom watermark */}
            <div className="max-w-5xl mx-auto px-6 py-8 mt-4">
                <div className="text-center text-sm text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <p className="flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4" />
                        {t('reports.sharedSnapshotFooter', 'This is a read-only shared snapshot')} • Consultinity
                    </p>
                    <p className="text-xs mt-1 text-gray-400">
                        {t('reports.snapshotGeneratedAt', 'Generated')}: {new Date(data.createdAt).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PublicReportView;

