/**
 * ReportHeader
 * 
 * Header component for the Report Builder:
 * - Report title and status badge
 * - Organization and assessment info
 * - Export buttons (PDF, Excel)
 * - Save, Finalize, Regenerate actions
 * - Progress indicator
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Save,
    CheckCircle,
    Download,
    FileText,
    FileSpreadsheet,
    RefreshCw,
    Loader2,
    MoreVertical,
    Clock,
    Calendar,
    Building2,
    Target,
    Sparkles,
    Lock,
    Maximize2,
    Minimize2
} from 'lucide-react';

interface ReportHeaderProps {
    name: string;
    status: 'DRAFT' | 'FINAL' | 'ARCHIVED';
    organizationName?: string;
    assessmentName?: string;
    progress: number;
    hasUnsavedChanges: boolean;
    isSaving: boolean;
    isLoading: boolean;
    createdAt?: string;
    updatedAt?: string;
    isFullscreen?: boolean;
    onBack: () => void;
    onSave: () => void;
    onFinalize: () => void;
    onRegenerate: () => void;
    onExportPdf: () => void;
    onExportExcel: () => void;
    onFullscreen?: () => void;
}

// Status badge configuration
const STATUS_CONFIG: Record<string, { label: string; labelPl: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
    'DRAFT': {
        label: 'Draft',
        labelPl: 'Szkic',
        color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
        icon: Clock
    },
    'FINAL': {
        label: 'Final',
        labelPl: 'Finalny',
        color: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30',
        icon: CheckCircle
    },
    'ARCHIVED': {
        label: 'Archived',
        labelPl: 'Zarchiwizowany',
        color: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/30',
        icon: Lock
    }
};

export const ReportHeader: React.FC<ReportHeaderProps> = ({
    name,
    status,
    organizationName,
    assessmentName,
    progress,
    hasUnsavedChanges,
    isSaving,
    isLoading,
    createdAt,
    updatedAt,
    isFullscreen,
    onBack,
    onSave,
    onFinalize,
    onRegenerate,
    onExportPdf,
    onExportExcel,
    onFullscreen
}) => {
    const { t, i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG['DRAFT'];
    const StatusIcon = statusConfig.icon;
    const isEditable = status === 'DRAFT';

    // Format date
    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <header className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10 sticky top-0 z-30">
            {/* Main header row */}
            <div className="px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                    {/* Left side: Back button, title, status */}
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            onClick={onBack}
                            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
                            title={t('common.back', 'Back')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-xl font-bold text-navy-900 dark:text-white truncate">
                                    {name || t('reports.untitledReport', 'Untitled Report')}
                                </h1>
                                
                                {/* Status badge */}
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${statusConfig.color}`}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {isPolish ? statusConfig.labelPl : statusConfig.label}
                                </span>
                                
                                {/* Unsaved indicator */}
                                {hasUnsavedChanges && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-full">
                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                        {t('common.unsaved', 'Unsaved')}
                                    </span>
                                )}
                            </div>
                            
                            {/* Subtitle */}
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {organizationName && (
                                    <span className="inline-flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5" />
                                        {organizationName}
                                    </span>
                                )}
                                {assessmentName && (
                                    <span className="inline-flex items-center gap-1">
                                        <Target className="w-3.5 h-3.5" />
                                        {assessmentName}
                                    </span>
                                )}
                                {updatedAt && (
                                    <span className="hidden sm:inline-flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(updatedAt)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right side: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Fullscreen button */}
                        {onFullscreen && (
                            <button
                                onClick={onFullscreen}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                                title={isPolish ? (isFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran') : (isFullscreen ? 'Exit fullscreen' : 'Fullscreen')}
                            >
                                {isFullscreen ? (
                                    <Minimize2 className="w-4 h-4" />
                                ) : (
                                    <Maximize2 className="w-4 h-4" />
                                )}
                                <span className="hidden sm:inline">
                                    {isPolish ? (isFullscreen ? 'Zamknij' : 'Pełny ekran') : (isFullscreen ? 'Exit' : 'Fullscreen')}
                                </span>
                            </button>
                        )}

                        {/* Export dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">{t('common.export', 'Export')}</span>
                            </button>
                            
                            {showExportMenu && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-10" 
                                        onClick={() => setShowExportMenu(false)} 
                                    />
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-white/10 py-1 z-20">
                                        <button
                                            onClick={() => {
                                                onExportPdf();
                                                setShowExportMenu(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <FileText className="w-4 h-4 text-red-500" />
                                            <span className="text-navy-900 dark:text-white">
                                                {t('reports.exportPdf', 'Export as PDF')}
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onExportExcel();
                                                setShowExportMenu(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-green-500" />
                                            <span className="text-navy-900 dark:text-white">
                                                {t('reports.exportExcel', 'Export as Excel')}
                                            </span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Save button (only for DRAFT) */}
                        {isEditable && (
                            <button
                                onClick={onSave}
                                disabled={!hasUnsavedChanges || isSaving}
                                className={`
                                    inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                                    ${hasUnsavedChanges 
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                        : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                    }
                                `}
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                <span className="hidden sm:inline">{t('common.save', 'Save')}</span>
                            </button>
                        )}

                        {/* Finalize button (only for DRAFT) */}
                        {isEditable && (
                            <button
                                onClick={onFinalize}
                                disabled={hasUnsavedChanges || isLoading}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">{t('reports.finalize', 'Finalize')}</span>
                            </button>
                        )}

                        {/* More menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMoreMenu(!showMoreMenu)}
                                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            
                            {showMoreMenu && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-10" 
                                        onClick={() => setShowMoreMenu(false)} 
                                    />
                                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-white/10 py-1 z-20">
                                        {isEditable && (
                                            <button
                                                onClick={() => {
                                                    onRegenerate();
                                                    setShowMoreMenu(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <RefreshCw className="w-4 h-4 text-purple-500" />
                                                <div>
                                                    <span className="text-navy-900 dark:text-white block">
                                                        {t('reports.regenerate', 'Regenerate Report')}
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {t('reports.regenerateHint', 'AI will recreate all sections')}
                                                    </span>
                                                </div>
                                            </button>
                                        )}
                                        <div className="border-t border-slate-100 dark:border-white/5 my-1" />
                                        <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                            <div className="flex justify-between">
                                                <span>{t('reports.created', 'Created')}:</span>
                                                <span>{formatDate(createdAt)}</span>
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span>{t('reports.lastUpdated', 'Updated')}:</span>
                                                <span>{formatDate(updatedAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-100 dark:bg-white/5">
                <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-white/50 dark:bg-navy-900/50 flex items-center justify-center z-40">
                    <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-navy-800 rounded-lg shadow-lg">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        <span className="text-sm text-navy-900 dark:text-white">
                            {t('common.loading', 'Loading...')}
                        </span>
                    </div>
                </div>
            )}
        </header>
    );
};

export default ReportHeader;

