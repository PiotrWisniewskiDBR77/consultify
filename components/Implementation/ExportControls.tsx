/**
 * ExportControls Component
 *
 * Unified export functionality for Implementation module.
 * Supports PDF, PPTX, and Excel exports.
 *
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Documentation Requirements
 * - PMI PMBOK 7th Edition - Information Management
 * - PRINCE2 - Management Products
 *
 * PMO Domain: PERFORMANCE_MONITORING
 */

import { Check, ChevronDown, Download, FileText, Loader2, Presentation, Table, X } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

export type ExportFormat = 'pdf' | 'pptx' | 'xlsx';
export type ExportType = 'status-report' | 'initiative' | 'portfolio' | 'raid' | 'budget';

interface ExportOption {
    format: ExportFormat;
    label: string;
    icon: React.ReactNode;
    description: string;
    available: boolean;
}

interface ExportControlsProps {
    exportType: ExportType;
    entityId?: string;
    entityName?: string;
    onExportStart?: (format: ExportFormat) => void;
    onExportComplete?: (format: ExportFormat, success: boolean) => void;
    variant?: 'button' | 'dropdown' | 'icon-only';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const EXPORT_OPTIONS: Record<ExportType, ExportOption[]> = {
    'status-report': [
        {
            format: 'pdf',
            label: 'PDF Report',
            icon: <FileText size={16} />,
            description: 'Formatted status report',
            available: true,
        },
        {
            format: 'pptx',
            label: 'PowerPoint',
            icon: <Presentation size={16} />,
            description: 'Presentation slides',
            available: true,
        },
    ],
    initiative: [
        {
            format: 'pdf',
            label: 'PDF Summary',
            icon: <FileText size={16} />,
            description: 'Initiative overview',
            available: true,
        },
        {
            format: 'xlsx',
            label: 'Excel Export',
            icon: <Table size={16} />,
            description: 'Task and data export',
            available: true,
        },
    ],
    portfolio: [
        {
            format: 'pdf',
            label: 'Portfolio Report',
            icon: <FileText size={16} />,
            description: 'Executive summary',
            available: true,
        },
        {
            format: 'pptx',
            label: 'PowerPoint',
            icon: <Presentation size={16} />,
            description: 'Board presentation',
            available: true,
        },
        {
            format: 'xlsx',
            label: 'Excel Dashboard',
            icon: <Table size={16} />,
            description: 'Full data export',
            available: true,
        },
    ],
    raid: [
        {
            format: 'pdf',
            label: 'RAID Report',
            icon: <FileText size={16} />,
            description: 'Risk & issue summary',
            available: true,
        },
        {
            format: 'xlsx',
            label: 'Excel Export',
            icon: <Table size={16} />,
            description: 'Full RAID register',
            available: true,
        },
    ],
    budget: [
        {
            format: 'pdf',
            label: 'Budget Report',
            icon: <FileText size={16} />,
            description: 'Financial summary',
            available: true,
        },
        {
            format: 'xlsx',
            label: 'Excel Export',
            icon: <Table size={16} />,
            description: 'Budget breakdown',
            available: true,
        },
    ],
};

const getExportEndpoint = (exportType: ExportType, entityId: string, format: ExportFormat): string => {
    switch (exportType) {
        case 'status-report':
            return `/api/status-reports/${entityId}/export/${format}`;
        case 'initiative':
            return `/api/initiatives/${entityId}/export/${format}`;
        case 'portfolio':
            return `/api/portfolio/export/${format}`;
        case 'raid':
            return `/api/raid/export/${format}${entityId ? `?initiativeId=${entityId}` : ''}`;
        case 'budget':
            return `/api/budget/${entityId}/export/${format}`;
        default:
            return '';
    }
};

const getFileName = (exportType: ExportType, entityName: string | undefined, format: ExportFormat): string => {
    const timestamp = new Date().toISOString().split('T')[0];
    const safeName = (entityName || exportType).replace(/[^a-zA-Z0-9]/g, '-');
    return `${safeName}-${timestamp}.${format}`;
};

export const ExportControls: React.FC<ExportControlsProps> = ({
    exportType,
    entityId,
    entityName,
    onExportStart,
    onExportComplete,
    variant = 'dropdown',
    size = 'md',
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
    const [exportProgress, setExportProgress] = useState(0);

    const options = EXPORT_OPTIONS[exportType] || [];

    const handleExport = async (format: ExportFormat) => {
        if (!entityId && exportType !== 'portfolio') {
            toast.error('Please select an item to export');
            return;
        }

        setIsExporting(format);
        setExportProgress(0);
        onExportStart?.(format);
        setIsOpen(false);

        try {
            // Simulate progress for UX
            const progressInterval = setInterval(() => {
                setExportProgress((prev) => Math.min(prev + 10, 90));
            }, 200);

            const token = localStorage.getItem('token');
            const endpoint = getExportEndpoint(exportType, entityId || '', format);

            const response = await fetch(endpoint, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                throw new Error(`Export failed: ${response.statusText}`);
            }

            setExportProgress(100);

            // Get the blob and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = getFileName(exportType, entityName, format);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success(`Exported as ${format.toUpperCase()}`);
            onExportComplete?.(format, true);
        } catch (error: any) {
            console.error('[ExportControls] Error:', error);
            toast.error(error.message || 'Export failed');
            onExportComplete?.(format, false);
        } finally {
            setIsExporting(null);
            setExportProgress(0);
        }
    };

    const sizeClasses = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-2.5 text-base',
    };

    // Icon-only variant
    if (variant === 'icon-only') {
        return (
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors ${className}`}
                    title="Export"
                >
                    {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 py-1 z-50">
                            {options.map((option) => (
                                <button
                                    key={option.format}
                                    onClick={() => handleExport(option.format)}
                                    disabled={!option.available || isExporting !== null}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                                        !option.available ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                >
                                    {option.icon}
                                    <span className="flex-1">{option.label}</span>
                                    {isExporting === option.format && <Loader2 size={14} className="animate-spin" />}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Button variant (single format)
    if (variant === 'button') {
        const primaryOption = options[0];
        if (!primaryOption) return null;

        return (
            <button
                onClick={() => handleExport(primaryOption.format)}
                disabled={isExporting !== null}
                className={`flex items-center gap-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg font-medium transition-colors ${sizeClasses[size]} ${className}`}
            >
                {isExporting ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Exporting...
                    </>
                ) : (
                    <>
                        <Download size={16} />
                        Export {primaryOption.format.toUpperCase()}
                    </>
                )}
            </button>
        );
    }

    // Dropdown variant (default)
    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isExporting !== null}
                className={`flex items-center gap-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg font-medium transition-colors ${sizeClasses[size]}`}
            >
                {isExporting ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Exporting...</span>
                    </>
                ) : (
                    <>
                        <Download size={16} />
                        <span>Export</span>
                        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-navy-900 rounded-xl shadow-lg border border-slate-200 dark:border-white/10 py-2 z-50">
                        <div className="px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Export Format
                        </div>
                        {options.map((option) => (
                            <button
                                key={option.format}
                                onClick={() => handleExport(option.format)}
                                disabled={!option.available || isExporting !== null}
                                className={`w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                                    !option.available ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                <div
                                    className={`p-1.5 rounded ${
                                        option.format === 'pdf'
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                            : option.format === 'pptx'
                                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                              : 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                    }`}
                                >
                                    {option.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-navy-900 dark:text-white text-sm">
                                        {option.label}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {option.description}
                                    </div>
                                </div>
                                {isExporting === option.format && (
                                    <Loader2 size={14} className="animate-spin text-purple-500 mt-1" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* Export Progress Overlay */}
            {isExporting && exportProgress > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
                    <div className="bg-white dark:bg-navy-900 rounded-xl p-6 shadow-xl w-72">
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-medium text-navy-900 dark:text-white">Exporting...</span>
                            <span className="text-sm text-slate-500">{exportProgress}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-500 rounded-full transition-all duration-300"
                                style={{ width: `${exportProgress}%` }}
                            />
                        </div>
                        {exportProgress === 100 && (
                            <div className="flex items-center gap-2 mt-3 text-green-600 text-sm">
                                <Check size={16} />
                                Download starting...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportControls;
