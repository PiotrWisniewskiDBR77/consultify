/**
 * ReportEditor
 * 
 * Full report editor for assessment reports.
 * Allows editing:
 * - Executive Summary
 * - Key Findings
 * - Recommendations
 * - Notes
 * 
 * Shows assessment data as reference (read-only).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft,
    Save,
    CheckCircle2,
    Loader2,
    FileText,
    Lightbulb,
    AlertCircle,
    Plus,
    Trash2,
    Target,
    TrendingUp,
    X,
    Sparkles
} from 'lucide-react';

interface ReportContent {
    executiveSummary: string;
    keyFindings: string[];
    recommendations: string[];
    notes: string;
}

interface AxisData {
    actual?: number;
    target?: number;
    justification?: string;
}

interface Report {
    id: string;
    name: string;
    status: 'DRAFT' | 'FINAL';
    assessmentId: string;
    assessmentName: string;
    content: ReportContent;
    axisData: Record<string, AxisData>;
    progress: number;
    isComplete: boolean;
    createdAt: string;
    updatedAt: string;
}

interface ReportEditorProps {
    reportId: string;
    onClose: () => void;
    onSaved: () => void;
    onFinalized: () => void;
}

const AXIS_LABELS: Record<string, string> = {
    processes: 'Procesy',
    digitalProducts: 'Produkty Cyfrowe',
    businessModels: 'Modele Biznesowe',
    dataManagement: 'Zarządzanie Danymi',
    culture: 'Kultura',
    cybersecurity: 'Cyberbezpieczeństwo',
    aiMaturity: 'Dojrzałość AI'
};

export const ReportEditor: React.FC<ReportEditorProps> = ({
    reportId,
    onClose,
    onSaved,
    onFinalized
}) => {
    // State
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [finalizing, setFinalizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Editable content
    const [name, setName] = useState('');
    const [executiveSummary, setExecutiveSummary] = useState('');
    const [keyFindings, setKeyFindings] = useState<string[]>([]);
    const [recommendations, setRecommendations] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    // New item inputs
    const [newFinding, setNewFinding] = useState('');
    const [newRecommendation, setNewRecommendation] = useState('');

    // Fetch report
    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/assessment-reports/${reportId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setReport(data);
                    setName(data.name);
                    setExecutiveSummary(data.content.executiveSummary || '');
                    setKeyFindings(data.content.keyFindings || []);
                    setRecommendations(data.content.recommendations || []);
                    setNotes(data.content.notes || '');
                } else {
                    setError('Nie udało się pobrać raportu');
                }
            } catch (err) {
                console.error('[ReportEditor] Fetch error:', err);
                setError('Błąd połączenia');
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [reportId]);

    // Track changes
    useEffect(() => {
        if (report) {
            const changed = 
                name !== report.name ||
                executiveSummary !== (report.content.executiveSummary || '') ||
                JSON.stringify(keyFindings) !== JSON.stringify(report.content.keyFindings || []) ||
                JSON.stringify(recommendations) !== JSON.stringify(report.content.recommendations || []) ||
                notes !== (report.content.notes || '');
            setHasChanges(changed);
        }
    }, [name, executiveSummary, keyFindings, recommendations, notes, report]);

    // Save report
    const handleSave = useCallback(async () => {
        if (!hasChanges) return;

        setSaving(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    content: {
                        executiveSummary,
                        keyFindings,
                        recommendations,
                        notes
                    }
                })
            });

            if (response.ok) {
                setLastSaved(new Date());
                setHasChanges(false);
                // Update local report state
                setReport(prev => prev ? {
                    ...prev,
                    name,
                    content: { executiveSummary, keyFindings, recommendations, notes }
                } : null);
                onSaved();
            } else {
                const data = await response.json();
                setError(data.error || 'Nie udało się zapisać');
            }
        } catch (err) {
            console.error('[ReportEditor] Save error:', err);
            setError('Błąd połączenia');
        } finally {
            setSaving(false);
        }
    }, [reportId, name, executiveSummary, keyFindings, recommendations, notes, hasChanges, onSaved]);

    // Finalize report
    const handleFinalize = useCallback(async () => {
        if (hasChanges) {
            await handleSave();
        }

        if (!confirm('Czy na pewno chcesz sfinalizować ten raport? Po finalizacji nie będzie można go edytować.')) {
            return;
        }

        setFinalizing(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessment-reports/${reportId}/finalize`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                onFinalized();
                onClose();
            } else {
                const data = await response.json();
                setError(data.error || 'Nie udało się sfinalizować raportu');
            }
        } catch (err) {
            console.error('[ReportEditor] Finalize error:', err);
            setError('Błąd połączenia');
        } finally {
            setFinalizing(false);
        }
    }, [reportId, hasChanges, handleSave, onFinalized, onClose]);

    // Add finding
    const addFinding = () => {
        if (newFinding.trim()) {
            setKeyFindings([...keyFindings, newFinding.trim()]);
            setNewFinding('');
        }
    };

    // Remove finding
    const removeFinding = (index: number) => {
        setKeyFindings(keyFindings.filter((_, i) => i !== index));
    };

    // Add recommendation
    const addRecommendation = () => {
        if (newRecommendation.trim()) {
            setRecommendations([...recommendations, newRecommendation.trim()]);
            setNewRecommendation('');
        }
    };

    // Remove recommendation
    const removeRecommendation = (index: number) => {
        setRecommendations(recommendations.filter((_, i) => i !== index));
    };

    // Calculate gap summary
    const getGapSummary = () => {
        if (!report?.axisData) return [];
        
        return Object.entries(report.axisData)
            .filter(([_, data]) => data.actual && data.target)
            .map(([axis, data]) => ({
                axis,
                label: AXIS_LABELS[axis] || axis,
                actual: data.actual || 0,
                target: data.target || 0,
                gap: (data.target || 0) - (data.actual || 0)
            }))
            .sort((a, b) => b.gap - a.gap);
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-white dark:bg-navy-900">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="h-full flex items-center justify-center bg-white dark:bg-navy-900">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">Nie znaleziono raportu</p>
                    <button onClick={onClose} className="mt-4 text-purple-600 hover:underline">
                        Wróć
                    </button>
                </div>
            </div>
        );
    }

    const gapSummary = getGapSummary();
    const isReadOnly = report.status === 'FINAL';

    return (
        <div className="h-full flex flex-col bg-white dark:bg-navy-900">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={isReadOnly}
                                    className="text-xl font-bold text-navy-900 dark:text-white bg-transparent border-none outline-none focus:ring-2 focus:ring-purple-500 rounded px-1 -ml-1"
                                />
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    report.status === 'FINAL'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                    {report.status}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Z assessmentu: {report.assessmentName}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {hasChanges && (
                            <span className="text-xs text-amber-500 flex items-center gap-1">
                                <AlertCircle size={12} />
                                Niezapisane zmiany
                            </span>
                        )}
                        {lastSaved && !hasChanges && (
                            <span className="text-xs text-green-500 flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Zapisano {lastSaved.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        {error && (
                            <span className="text-xs text-red-500">{error}</span>
                        )}

                        {!isReadOnly && (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={!hasChanges || saving}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                        hasChanges && !saving
                                            ? 'bg-green-600 hover:bg-green-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Zapisz
                                </button>
                                <button
                                    onClick={handleFinalize}
                                    disabled={finalizing}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium text-sm transition-colors"
                                >
                                    {finalizing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    Finalizuj
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-6 space-y-8">
                    {/* Gap Analysis Summary (Read-only) */}
                    {gapSummary.length > 0 && (
                        <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                            <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                                <Target size={20} className="text-purple-500" />
                                Podsumowanie Gap Analysis
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {gapSummary.slice(0, 4).map(item => (
                                    <div key={item.axis} className="bg-white dark:bg-navy-900 rounded-lg p-4 border border-slate-200 dark:border-white/10">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{item.label}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-bold text-navy-900 dark:text-white">{item.actual}</span>
                                            <TrendingUp size={16} className="text-purple-500" />
                                            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{item.target}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">Gap: {item.gap} poziomów</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Executive Summary */}
                    <div>
                        <label className="block text-sm font-semibold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                            <FileText size={16} className="text-purple-500" />
                            Executive Summary
                        </label>
                        <textarea
                            value={executiveSummary}
                            onChange={(e) => setExecutiveSummary(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Podsumowanie wykonawcze raportu..."
                            rows={6}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    {/* Key Findings */}
                    <div>
                        <label className="block text-sm font-semibold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                            <Lightbulb size={16} className="text-amber-500" />
                            Kluczowe Wnioski ({keyFindings.length})
                        </label>
                        <div className="space-y-2 mb-3">
                            {keyFindings.map((finding, index) => (
                                <div key={index} className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
                                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                        {index + 1}
                                    </span>
                                    <p className="flex-1 text-sm text-navy-900 dark:text-white">{finding}</p>
                                    {!isReadOnly && (
                                        <button
                                            onClick={() => removeFinding(index)}
                                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {!isReadOnly && (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newFinding}
                                    onChange={(e) => setNewFinding(e.target.value)}
                                    placeholder="Dodaj nowy wniosek..."
                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && addFinding()}
                                />
                                <button
                                    onClick={addFinding}
                                    disabled={!newFinding.trim()}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    <Plus size={16} />
                                    Dodaj
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Recommendations */}
                    <div>
                        <label className="block text-sm font-semibold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                            <Sparkles size={16} className="text-green-500" />
                            Rekomendacje ({recommendations.length})
                        </label>
                        <div className="space-y-2 mb-3">
                            {recommendations.map((rec, index) => (
                                <div key={index} className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-500/20">
                                    <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                        {index + 1}
                                    </span>
                                    <p className="flex-1 text-sm text-navy-900 dark:text-white">{rec}</p>
                                    {!isReadOnly && (
                                        <button
                                            onClick={() => removeRecommendation(index)}
                                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {!isReadOnly && (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newRecommendation}
                                    onChange={(e) => setNewRecommendation(e.target.value)}
                                    placeholder="Dodaj nową rekomendację..."
                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && addRecommendation()}
                                />
                                <button
                                    onClick={addRecommendation}
                                    disabled={!newRecommendation.trim()}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    <Plus size={16} />
                                    Dodaj
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-navy-900 dark:text-white mb-2">
                            Notatki dodatkowe
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Dodatkowe uwagi i notatki..."
                            rows={4}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

