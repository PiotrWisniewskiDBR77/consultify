/**
 * VersionHistoryPanel
 * 
 * Slide-in panel showing version history of an assessment.
 * Allows viewing past versions and restoring them.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X,
    History,
    RotateCcw,
    User,
    Clock,
    Loader2,
    AlertCircle,
    CheckCircle2,
    FileText,
    ChevronRight
} from 'lucide-react';

interface Version {
    version: number;
    createdAt: string;
    createdBy: string;
    createdByName: string;
    description?: string;
    changes?: string;
}

interface VersionHistoryPanelProps {
    assessmentId: string;
    assessmentName: string;
    isOpen: boolean;
    onClose: () => void;
    onRestored: () => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
    assessmentId,
    assessmentName,
    isOpen,
    onClose,
    onRestored
}) => {
    const panelRef = useRef<HTMLDivElement>(null);

    // State
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
    const [success, setSuccess] = useState(false);

    // Fetch version history
    useEffect(() => {
        if (!isOpen || !assessmentId) return;

        const fetchVersions = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/assessment-workflow/${assessmentId}/versions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setVersions(data.versions || []);
                } else {
                    setError('Nie udało się pobrać historii wersji');
                }
            } catch (err) {
                console.error('[VersionHistoryPanel] Fetch error:', err);
                setError('Błąd połączenia');
            } finally {
                setLoading(false);
            }
        };

        fetchVersions();
    }, [isOpen, assessmentId]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when panel is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Restore version
    const handleRestore = useCallback(async (version: number) => {
        if (!confirm(`Czy na pewno chcesz przywrócić wersję ${version}? Obecne dane zostaną nadpisane.`)) {
            return;
        }

        setRestoringVersion(version);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-workflow/${assessmentId}/restore/${version}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => {
                    onRestored();
                    onClose();
                }, 1500);
            } else {
                const data = await response.json();
                setError(data.error || 'Nie udało się przywrócić wersji');
            }
        } catch (err) {
            console.error('[VersionHistoryPanel] Restore error:', err);
            setError('Błąd połączenia');
        } finally {
            setRestoringVersion(null);
        }
    }, [assessmentId, onRestored, onClose]);

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get relative time
    const getRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'przed chwilą';
        if (diffMins < 60) return `${diffMins} min temu`;
        if (diffHours < 24) return `${diffHours}h temu`;
        if (diffDays < 7) return `${diffDays} dni temu`;
        return formatDate(dateStr);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                className={`
                    fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-navy-900 shadow-2xl z-50
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                                        Historia Wersji
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                        {assessmentName}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {success ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                                </div>
                                <p className="text-lg font-medium text-navy-900 dark:text-white">
                                    Wersja przywrócona!
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Dane zostały zaktualizowane
                                </p>
                            </div>
                        ) : loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                                <p className="text-slate-500 dark:text-slate-400">{error}</p>
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                                <p className="text-slate-500 dark:text-slate-400 font-medium">
                                    Brak zapisanych wersji
                                </p>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                    Historia pojawi się po zapisaniu zmian
                                </p>
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Timeline line */}
                                <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-white/10" />

                                {/* Versions */}
                                <div className="space-y-4">
                                    {versions.map((version, index) => (
                                        <div key={version.version} className="relative flex gap-4">
                                            {/* Timeline dot */}
                                            <div className={`
                                                shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10
                                                ${index === 0
                                                    ? 'bg-purple-100 dark:bg-purple-900/30 ring-4 ring-white dark:ring-navy-900'
                                                    : 'bg-slate-100 dark:bg-navy-800'
                                                }
                                            `}>
                                                <span className={`text-sm font-bold ${
                                                    index === 0
                                                        ? 'text-purple-600 dark:text-purple-400'
                                                        : 'text-slate-500 dark:text-slate-400'
                                                }`}>
                                                    v{version.version}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div className={`
                                                flex-1 p-4 rounded-xl border transition-all
                                                ${index === 0
                                                    ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-500/30'
                                                    : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                                                }
                                            `}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                {getRelativeTime(version.createdAt)}
                                                            </span>
                                                            {index === 0 && (
                                                                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium rounded">
                                                                    Aktualna
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <User size={14} className="text-slate-400" />
                                                            <span className="text-sm text-navy-900 dark:text-white font-medium">
                                                                {version.createdByName || 'Użytkownik'}
                                                            </span>
                                                        </div>
                                                        {version.description && (
                                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                                                {version.description}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                                                            <Clock size={12} />
                                                            {formatDate(version.createdAt)}
                                                        </div>
                                                    </div>

                                                    {/* Restore button - not for current version */}
                                                    {index !== 0 && (
                                                        <button
                                                            onClick={() => handleRestore(version.version)}
                                                            disabled={restoringVersion !== null}
                                                            className={`
                                                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0
                                                                ${restoringVersion === version.version
                                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-wait'
                                                                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-purple-100 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400'
                                                                }
                                                            `}
                                                        >
                                                            {restoringVersion === version.version ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <RotateCcw size={14} />
                                                            )}
                                                            Przywróć
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Info */}
                    {!success && !loading && versions.length > 0 && (
                        <div className="shrink-0 px-6 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                {versions.length} wersji • Przywrócenie zastąpi obecne dane
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

