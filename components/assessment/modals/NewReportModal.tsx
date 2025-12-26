/**
 * NewReportModal
 * 
 * Modal for creating a new report from an approved assessment.
 * Fetches list of approved assessments and allows selecting one to create a report.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, X, Loader2, CheckCircle2, AlertCircle, FileOutput, Plus, Search } from 'lucide-react';

interface ApprovedAssessment {
    id: string;
    name: string;
    projectName: string;
    completedAt: string;
    createdBy: string;
    progress: number;
}

interface NewReportModalProps {
    projectId?: string;
    preselectedAssessmentId?: string;
    onClose: () => void;
    onCreated: (reportId: string) => void;
}

export const NewReportModal: React.FC<NewReportModalProps> = ({
    projectId,
    preselectedAssessmentId,
    onClose,
    onCreated
}) => {
    const [assessments, setAssessments] = useState<ApprovedAssessment[]>([]);
    const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(preselectedAssessmentId || null);
    const [reportName, setReportName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Fetch approved assessments
    useEffect(() => {
        const fetchAssessments = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('token');
                const url = projectId
                    ? `/api/assessments?status=APPROVED&projectId=${projectId}`
                    : '/api/assessments?status=APPROVED';
                    
                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setAssessments(data.assessments || []);
                    
                    // Auto-select if preselected
                    if (preselectedAssessmentId) {
                        const found = (data.assessments || []).find(
                            (a: ApprovedAssessment) => a.id === preselectedAssessmentId
                        );
                        if (found) {
                            setReportName(`Report - ${found.name}`);
                        }
                    }
                } else {
                    setError('Nie udało się pobrać listy assessmentów');
                }
            } catch (err) {
                console.error('[NewReportModal] Error fetching assessments:', err);
                setError('Błąd połączenia');
            } finally {
                setLoading(false);
            }
        };

        fetchAssessments();
    }, [projectId, preselectedAssessmentId]);

    // Handle assessment selection
    const handleSelectAssessment = useCallback((assessmentId: string) => {
        setSelectedAssessmentId(assessmentId);
        const selected = assessments.find(a => a.id === assessmentId);
        if (selected && !reportName) {
            setReportName(`Report - ${selected.name}`);
        }
    }, [assessments, reportName]);

    // Create report
    const handleCreate = async () => {
        if (!selectedAssessmentId) {
            setError('Wybierz assessment');
            return;
        }

        if (!reportName.trim()) {
            setError('Podaj nazwę raportu');
            return;
        }

        setCreating(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/assessment-reports', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assessmentId: selectedAssessmentId,
                    name: reportName.trim(),
                    projectId
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSuccess(true);
                setTimeout(() => {
                    onCreated(data.id);
                    onClose();
                }, 1500);
            } else {
                const data = await response.json();
                setError(data.error || 'Nie udało się utworzyć raportu');
            }
        } catch (err) {
            console.error('[NewReportModal] Create error:', err);
            setError('Błąd połączenia');
        } finally {
            setCreating(false);
        }
    };

    // Filter assessments by search
    const filteredAssessments = assessments.filter(a => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            a.name.toLowerCase().includes(query) ||
            a.projectName.toLowerCase().includes(query)
        );
    });

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <FileOutput className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                    Nowy Raport
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Utwórz raport z zatwierdzonego assessmentu
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
                <div className="px-6 py-4 max-h-[500px] overflow-y-auto">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-lg font-medium text-navy-900 dark:text-white">
                                Raport utworzony!
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Możesz teraz edytować treść raportu
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                        </div>
                    ) : assessments.length === 0 ? (
                        <div className="text-center py-8">
                            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                                Brak zatwierdzonych assessmentów
                            </p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                Najpierw zatwierdź assessment w procesie recenzji
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Report Name Input */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Nazwa raportu
                                </label>
                                <input
                                    type="text"
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    placeholder="np. Raport DRD Q1 2025"
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400"
                                />
                            </div>

                            {/* Search */}
                            {assessments.length > 3 && (
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Szukaj assessmentu..."
                                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white text-sm"
                                    />
                                </div>
                            )}

                            {/* Assessment Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Wybierz assessment ({filteredAssessments.length})
                                </label>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {filteredAssessments.map(assessment => {
                                        const isSelected = selectedAssessmentId === assessment.id;
                                        return (
                                            <button
                                                key={assessment.id}
                                                onClick={() => handleSelectAssessment(assessment.id)}
                                                className={`
                                                    w-full text-left p-3 rounded-lg border-2 transition-all
                                                    ${isSelected
                                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`
                                                            w-5 h-5 rounded-full flex items-center justify-center border-2
                                                            ${isSelected
                                                                ? 'bg-purple-600 border-purple-600'
                                                                : 'border-slate-300 dark:border-slate-600'
                                                            }
                                                        `}>
                                                            {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-navy-900 dark:text-white text-sm">
                                                                {assessment.name}
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {assessment.projectName}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                                                            <CheckCircle2 size={10} />
                                                            Zatwierdzony
                                                        </span>
                                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                            {assessment.completedAt ? formatDate(assessment.completedAt) : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 mt-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!success && !loading && assessments.length > 0 && (
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!selectedAssessmentId || !reportName.trim() || creating}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                    ${selectedAssessmentId && reportName.trim() && !creating
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    }
                                `}
                            >
                                {creating ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Tworzę...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} />
                                        Utwórz raport
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

