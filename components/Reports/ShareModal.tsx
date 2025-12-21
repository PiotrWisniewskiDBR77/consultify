import React, { useState } from 'react';
import {
    Share2, Link2, Copy, Check, Calendar,
    Loader2, X, AlertTriangle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityType: 'ORG_REPORT' | 'INITIATIVE_REPORT';
    entityId?: string;
    entityTitle: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
    isOpen,
    onClose,
    entityType,
    entityId,
    entityTitle
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [expiryDays, setExpiryDays] = useState(7);

    const handleCreateLink = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');

            const response = await fetch('/api/reports/share', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    entityType,
                    entityId,
                    expiresInHours: expiryDays * 24
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create share link');
            }

            const data = await response.json();
            const fullUrl = `${window.location.origin}${data.shareUrl}`;
            setShareUrl(fullUrl);
            setExpiresAt(data.expiresAt);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!shareUrl) return;

        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = shareUrl;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                            <Share2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-gray-900 dark:text-white">
                                {t('reports.shareReport')}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {entityTitle}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {!shareUrl ? (
                        <>
                            {/* Expiry Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('reports.linkExpiry')}
                                </label>
                                <div className="flex gap-2">
                                    {[1, 7, 30].map((days) => (
                                        <button
                                            key={days}
                                            onClick={() => setExpiryDays(days)}
                                            className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${expiryDays === days
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            {days} {days === 1 ? t('reports.day') : t('reports.days')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Info Notice */}
                            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <Link2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-blue-700 dark:text-blue-300">
                                    <p>{t('reports.shareDescription')}</p>
                                    <ul className="mt-2 list-disc list-inside text-blue-600 dark:text-blue-400">
                                        <li>{t('reports.readOnly')}</li>
                                        <li>{t('reports.noLoginRequired')}</li>
                                        <li>{t('reports.snapshotOnly')}</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-sm">{error}</span>
                                </div>
                            )}

                            {/* Create Button */}
                            <button
                                onClick={handleCreateLink}
                                disabled={loading}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        {t('reports.generating')}
                                    </>
                                ) : (
                                    <>
                                        <Link2 className="w-5 h-5" />
                                        {t('reports.createLink')}
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Success State */}
                            <div className="text-center py-4">
                                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                    {t('reports.linkCreated')}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('reports.copyAndShare')}
                                </p>
                            </div>

                            {/* Link Display */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={shareUrl}
                                    readOnly
                                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                                />
                                <button
                                    onClick={handleCopy}
                                    className={`p-2 rounded-lg transition-colors ${copied
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>

                            {/* Expiry Info */}
                            {expiresAt && (
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <Calendar className="w-4 h-4" />
                                    <span>
                                        {t('reports.expiresOn')}: {new Date(expiresAt).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
