/**
 * InitiativeDetailsModal
 * 
 * Full details view for a transformation initiative.
 * Shows:
 * - Overview: name, status, priority
 * - Description & hypothesis
 * - Financial metrics: ROI, budget, timeline
 * - Risk assessment
 * - Source: linked report/assessment
 * - Actions: Edit, Approve, Delete, Add to Roadmap
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    X,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Clock,
    DollarSign,
    TrendingUp,
    Calendar,
    User,
    FileText,
    Target,
    AlertTriangle,
    Lightbulb,
    Award,
    BarChart3,
    MapPin,
    ArrowRight,
    Edit,
    Trash2,
    ThumbsUp,
    ExternalLink
} from 'lucide-react';

interface Owner {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatarUrl?: string;
}

interface Initiative {
    id: string;
    name: string;
    axis: string;
    area: string;
    summary: string;
    description?: string;
    hypothesis: string;
    status: string;
    progress: number;
    currentStage?: string;
    businessValue: number;
    costCapex: number;
    costOpex: number;
    expectedRoi: number;
    valueDriver?: string;
    confidenceLevel?: string;
    valueTiming?: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
    actualStartDate?: string;
    actualEndDate?: string;
    problemStatement?: string;
    deliverables: string[];
    successCriteria: string[];
    scopeIn: string[];
    scopeOut: string[];
    keyRisks: string[];
    competenciesRequired: string[];
    ownerBusiness?: Owner;
    ownerExecution?: Owner;
    sourceAssessmentId?: string;
    assessmentName?: string;
    taskCount: number;
    createdAt: string;
    updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    'DRAFT': { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: <Clock size={14} /> },
    'PROPOSED': { label: 'Proposed', color: 'bg-amber-100 text-amber-700', icon: <Lightbulb size={14} /> },
    'APPROVED': { label: 'Approved', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={14} /> },
    'IN_PROGRESS': { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: <TrendingUp size={14} /> },
    'COMPLETED': { label: 'Completed', color: 'bg-purple-100 text-purple-700', icon: <Award size={14} /> },
    'PLANNED': { label: 'Planned', color: 'bg-cyan-100 text-cyan-700', icon: <MapPin size={14} /> }
};

const AXIS_LABELS: Record<string, string> = {
    processes: 'Procesy',
    digitalProducts: 'Produkty Cyfrowe',
    businessModels: 'Modele Biznesowe',
    dataManagement: 'Zarządzanie Danymi',
    culture: 'Kultura',
    cybersecurity: 'Cyberbezpieczeństwo',
    aiMaturity: 'Dojrzałość AI'
};

interface InitiativeDetailsModalProps {
    initiativeId: string;
    onClose: () => void;
    onEdit?: (id: string) => void;
    onApprove?: (id: string) => void;
    onDelete?: (id: string) => void;
    onAddToRoadmap?: (id: string) => void;
    /** If true, renders as embedded panel instead of modal overlay */
    embedded?: boolean;
}

export const InitiativeDetailsModal: React.FC<InitiativeDetailsModalProps> = ({
    initiativeId,
    onClose,
    onEdit,
    onApprove,
    onDelete,
    onAddToRoadmap,
    embedded = false
}) => {
    const [initiative, setInitiative] = useState<Initiative | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch initiative details
    useEffect(() => {
        const fetchInitiative = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/initiatives/${initiativeId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setInitiative(data);
                } else {
                    setError('Nie udało się pobrać szczegółów inicjatywy');
                }
            } catch (err) {
                console.error('[InitiativeDetailsModal] Fetch error:', err);
                setError('Błąd połączenia');
            } finally {
                setLoading(false);
            }
        };

        fetchInitiative();
    }, [initiativeId]);

    // Format currency
    const formatCurrency = (value: number | null | undefined) => {
        if (value == null) return '-';
        return new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: 'PLN',
            maximumFractionDigits: 0
        }).format(value);
    };

    // Format date
    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    // Get status config
    const getStatusConfig = (status: string) => {
        return STATUS_CONFIG[status] || STATUS_CONFIG['DRAFT'];
    };

    if (loading) {
        if (embedded) {
            return (
                <div className="h-full flex items-center justify-center bg-white dark:bg-navy-900">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
            );
        }
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-navy-900 rounded-xl p-8">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
                </div>
            </div>
        );
    }

    if (error || !initiative) {
        if (embedded) {
            return (
                <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-navy-900 p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">{error || 'Nie znaleziono inicjatywy'}</p>
                    <button onClick={onClose} className="mt-4 text-purple-600 hover:underline">
                        Zamknij
                    </button>
                </div>
            );
        }
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-navy-900 rounded-xl p-8 text-center max-w-sm">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">{error || 'Nie znaleziono inicjatywy'}</p>
                    <button onClick={onClose} className="mt-4 text-purple-600 hover:underline">
                        Zamknij
                    </button>
                </div>
            </div>
        );
    }

    const statusConfig = getStatusConfig(initiative.status);

    // Content to be rendered (shared between modal and embedded modes)
    const content = (
        <div className={`bg-white dark:bg-navy-900 ${embedded ? 'h-full' : 'rounded-xl w-full max-w-3xl max-h-[90vh] shadow-2xl'} overflow-hidden flex flex-col`}>
                {/* Header */}
                <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/10 dark:to-navy-900">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                    {statusConfig.icon}
                                    {statusConfig.label}
                                </span>
                                {initiative.axis && (
                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 rounded-full text-xs">
                                        {AXIS_LABELS[initiative.axis] || initiative.axis}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-navy-900 dark:text-white truncate">
                                {initiative.name}
                            </h2>
                            {initiative.area && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Obszar: {initiative.area}
                                </p>
                            )}
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
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Financial Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-200 dark:border-green-500/20">
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                                <TrendingUp size={16} />
                                <span className="text-xs font-medium">ROI</span>
                            </div>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                {initiative.expectedRoi ? `${initiative.expectedRoi}%` : '-'}
                            </p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-4 border border-purple-200 dark:border-purple-500/20">
                            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                                <DollarSign size={16} />
                                <span className="text-xs font-medium">Wartość biznesowa</span>
                            </div>
                            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                                {formatCurrency(initiative.businessValue)}
                            </p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                                <BarChart3 size={16} />
                                <span className="text-xs font-medium">CAPEX</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                {formatCurrency(initiative.costCapex)}
                            </p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/20">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                                <Calendar size={16} />
                                <span className="text-xs font-medium">OPEX (rocznie)</span>
                            </div>
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                                {formatCurrency(initiative.costOpex)}
                            </p>
                        </div>
                    </div>

                    {/* Description & Hypothesis */}
                    {(initiative.summary || initiative.hypothesis) && (
                        <div className="space-y-4">
                            {initiative.summary && (
                                <div>
                                    <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                                        <FileText size={16} className="text-purple-500" />
                                        Opis
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-navy-950 rounded-lg p-4">
                                        {initiative.summary}
                                    </p>
                                </div>
                            )}
                            {initiative.hypothesis && (
                                <div>
                                    <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                                        <Lightbulb size={16} className="text-amber-500" />
                                        Hipoteza
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-4 border border-amber-200 dark:border-amber-500/20">
                                        {initiative.hypothesis}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Timeline */}
                    <div>
                        <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3 flex items-center gap-2">
                            <Calendar size={16} className="text-blue-500" />
                            Harmonogram
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-navy-950 rounded-lg p-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Planowany start</p>
                                <p className="text-sm font-medium text-navy-900 dark:text-white">
                                    {formatDate(initiative.plannedStartDate)}
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-navy-950 rounded-lg p-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Planowane zakończenie</p>
                                <p className="text-sm font-medium text-navy-900 dark:text-white">
                                    {formatDate(initiative.plannedEndDate)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Risk Assessment */}
                    {initiative.keyRisks && initiative.keyRisks.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-500" />
                                Kluczowe ryzyka ({initiative.keyRisks.length})
                            </h3>
                            <div className="space-y-2">
                                {initiative.keyRisks.map((risk, index) => (
                                    <div key={index} className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-500/20">
                                        <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                            {index + 1}
                                        </span>
                                        <p className="text-sm text-red-700 dark:text-red-300">{risk}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Owners */}
                    {(initiative.ownerBusiness || initiative.ownerExecution) && (
                        <div>
                            <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3 flex items-center gap-2">
                                <User size={16} className="text-slate-500" />
                                Właściciele
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {initiative.ownerBusiness && (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                            <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                                {initiative.ownerBusiness.firstName?.charAt(0)}{initiative.ownerBusiness.lastName?.charAt(0)}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Business Owner</p>
                                            <p className="text-sm font-medium text-navy-900 dark:text-white">
                                                {initiative.ownerBusiness.firstName} {initiative.ownerBusiness.lastName}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {initiative.ownerExecution && (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                                {initiative.ownerExecution.firstName?.charAt(0)}{initiative.ownerExecution.lastName?.charAt(0)}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Execution Owner</p>
                                            <p className="text-sm font-medium text-navy-900 dark:text-white">
                                                {initiative.ownerExecution.firstName} {initiative.ownerExecution.lastName}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Source */}
                    {initiative.assessmentName && (
                        <div className="bg-slate-50 dark:bg-navy-950 rounded-lg p-4 border border-slate-200 dark:border-white/10">
                            <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                                <Target size={16} className="text-purple-500" />
                                Źródło
                            </h3>
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                                <p>Assessment: <span className="font-medium">{initiative.assessmentName}</span></p>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-200 dark:border-white/10">
                        <span>Utworzono: {formatDate(initiative.createdAt)}</span>
                        <span>{initiative.taskCount} zadań</span>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {onDelete && initiative.status === 'DRAFT' && (
                                <button
                                    onClick={() => onDelete(initiative.id)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Usuń
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {onEdit && (
                                <button
                                    onClick={() => onEdit(initiative.id)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Edit size={16} />
                                    Edytuj
                                </button>
                            )}
                            {onApprove && (initiative.status === 'DRAFT' || initiative.status === 'PROPOSED') && (
                                <button
                                    onClick={() => onApprove(initiative.id)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <ThumbsUp size={16} />
                                    Zatwierdź
                                </button>
                            )}
                            {onAddToRoadmap && initiative.status === 'APPROVED' && (
                                <button
                                    onClick={() => onAddToRoadmap(initiative.id)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <MapPin size={16} />
                                    Dodaj do Roadmap
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
    );

    // Embedded mode: return content directly
    if (embedded) {
        return content;
    }

    // Modal mode: wrap in overlay
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            {content}
        </div>
    );
};

