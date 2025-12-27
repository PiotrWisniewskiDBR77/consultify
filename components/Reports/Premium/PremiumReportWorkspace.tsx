/**
 * PremiumReportWorkspace
 * 
 * Full workspace component for premium report editing with
 * split layout, AI assistant, and real-time preview.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { JSONContent } from '@tiptap/react';
import { PremiumReportEditor } from './Editor/PremiumReportEditor';
import {
    FileText,
    Download,
    Eye,
    EyeOff,
    Settings,
    ChevronLeft,
    Loader2,
    FileDown,
    Printer
} from 'lucide-react';

import './Editor/PremiumEditor.css';

interface PremiumReportWorkspaceProps {
    reportId?: string;
    assessmentId?: string;
    assessmentName?: string;
    organizationName?: string;
    onClose?: () => void;
}

export const PremiumReportWorkspace: React.FC<PremiumReportWorkspaceProps> = ({
    reportId,
    assessmentId,
    assessmentName,
    organizationName,
    onClose
}) => {
    const [reportContent, setReportContent] = useState<JSONContent | null>(null);
    const [reportMeta, setReportMeta] = useState<{
        name: string;
        status: 'DRAFT' | 'FINAL';
        updatedAt: string;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Fetch report data
    useEffect(() => {
        const fetchReport = async () => {
            if (!reportId) {
                // New report - use default structure
                setReportContent(null);
                setReportMeta({
                    name: 'Nowy Raport',
                    status: 'DRAFT',
                    updatedAt: new Date().toISOString()
                });
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/assessment-reports/${reportId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setReportContent(data.content ? JSON.parse(data.content) : null);
                    setReportMeta({
                        name: data.name,
                        status: data.status,
                        updatedAt: data.updated_at
                    });
                }
            } catch (error) {
                console.error('Failed to fetch report:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReport();
    }, [reportId]);

    // Save report
    const handleSave = useCallback(async (content: JSONContent) => {
        setIsSaving(true);
        try {
            const endpoint = reportId
                ? `/api/assessment-reports/${reportId}`
                : '/api/assessment-reports';

            const method = reportId ? 'PUT' : 'POST';

            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    assessmentId,
                    name: reportMeta?.name || 'Nowy Raport',
                    content: JSON.stringify(content),
                    status: reportMeta?.status || 'DRAFT'
                })
            });

            if (response.ok) {
                setHasUnsavedChanges(false);
                setReportMeta(prev => prev ? {
                    ...prev,
                    updatedAt: new Date().toISOString()
                } : null);
            }
        } catch (error) {
            console.error('Failed to save report:', error);
        } finally {
            setIsSaving(false);
        }
    }, [reportId, assessmentId, reportMeta]);

    // Handle content change
    const handleContentChange = useCallback((content: JSONContent) => {
        setReportContent(content);
        setHasUnsavedChanges(true);
    }, []);

    // Generate PDF
    const handleGeneratePDF = async () => {
        if (!reportId) {
            alert('Zapisz raport przed wygenerowaniem PDF');
            return;
        }

        setIsGeneratingPDF(true);
        try {
            const response = await fetch(`/api/reports/premium/${reportId}/pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${reportMeta?.name || 'report'}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } else {
                const error = await response.json();
                alert(`Błąd generowania PDF: ${error.message}`);
            }
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert('Wystąpił błąd podczas generowania PDF');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // Print preview
    const handlePrint = () => {
        window.print();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-navy-900">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-slate-500">Ładowanie raportu...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-slate-100 dark:bg-navy-950">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-4">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-900 dark:text-white">
                                {reportMeta?.name || 'Nowy Raport'}
                            </h1>
                            <p className="text-xs text-slate-500">
                                {assessmentName} • {organizationName}
                            </p>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`
            px-2 py-1 text-xs font-medium rounded-full
            ${reportMeta?.status === 'FINAL'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }
          `}>
                        {reportMeta?.status === 'FINAL' ? 'Finalny' : 'Szkic'}
                    </span>

                    {hasUnsavedChanges && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                            • Niezapisane zmiany
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {showPreview ? 'Edytor' : 'Podgląd'}
                    </button>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <Printer className="w-4 h-4" />
                        Drukuj
                    </button>

                    <button
                        onClick={handleGeneratePDF}
                        disabled={isGeneratingPDF || !reportId}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50"
                    >
                        {isGeneratingPDF ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <FileDown className="w-4 h-4" />
                        )}
                        Generuj PDF
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden p-6">
                <div className="h-full max-w-5xl mx-auto">
                    <PremiumReportEditor
                        initialContent={reportContent || undefined}
                        reportId={reportId}
                        assessmentId={assessmentId}
                        readOnly={showPreview}
                        onContentChange={handleContentChange}
                        onSave={handleSave}
                        className="h-full"
                    />
                </div>
            </main>
        </div>
    );
};

export default PremiumReportWorkspace;
