/**
 * Initiative Financial Integration Component
 *
 * Provides bidirectional integration between Initiatives and Economics modules.
 * Shows linked analysis status and allows creating/navigating to financial analysis.
 */

import {
    AlertCircle,
    ArrowRight,
    BarChart2,
    Calculator,
    Check,
    DollarSign,
    ExternalLink,
    Link2,
    Loader2,
    Plus,
    TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

interface LinkedAnalysis {
    id: string;
    name: string;
    status: string;
    overallScore: number | null;
    completionPercent: number;
    createdAt: string;
    npv?: number | null;
    roi?: number | null;
}

interface InitiativeData {
    id: string;
    name: string;
    costCapex?: number;
    costOpex?: number;
    annualBenefit?: number;
    expectedRoi?: number;
    valueDriver?: string;
}

interface InitiativeFinancialIntegrationProps {
    initiative: InitiativeData;
    onNavigateToAnalysis?: (analysisId: string) => void;
    currency?: string;
}

export const InitiativeFinancialIntegration: React.FC<InitiativeFinancialIntegrationProps> = ({
    initiative,
    onNavigateToAnalysis,
    currency = 'PLN',
}) => {
    const [linkedAnalysis, setLinkedAnalysis] = useState<LinkedAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Load linked analysis
    useEffect(() => {
        const loadLinkedAnalysis = async () => {
            setIsLoading(true);
            try {
                // Try to find analysis linked to this initiative
                const analyses = await Api.getDigitizationAnalyses({ search: initiative.name });
                const linked = analyses.analyses?.find(
                    (a: any) => a.linked_initiative_id === initiative.id || a.projectId === initiative.id,
                );

                if (linked) {
                    // Load full analysis with financial data
                    const fullAnalysis = await Api.getDigitizationAnalysis(linked.id);
                    try {
                        const financials = await Api.getAnalysisFinancials(linked.id);
                        if (financials) {
                            // Calculate NPV/ROI if financials exist
                            fullAnalysis.npv = financials.npv || null;
                            fullAnalysis.roi = financials.roi || null;
                        }
                    } catch (e) {
                        // Financials may not exist yet
                    }
                    setLinkedAnalysis(fullAnalysis);
                }
            } catch (error) {
                console.error('Failed to load linked analysis:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadLinkedAnalysis();
    }, [initiative.id, initiative.name]);

    const handleCreateAnalysis = async () => {
        setIsCreating(true);
        try {
            // Create new analysis with initiative data pre-filled
            const newAnalysis = await Api.createDigitizationAnalysis({
                name: `Analiza ekonomiczna: ${initiative.name}`,
                description: `Analiza ekonomiczna dla inicjatywy: ${initiative.name}`,
                projectId: initiative.id,
            });

            // Link to initiative
            await Api.linkAnalysisToInitiative(newAnalysis.id, initiative.id);

            // Pre-fill financial data if available
            if (initiative.costCapex || initiative.costOpex || initiative.annualBenefit) {
                await Api.updateAnalysisFinancials(newAnalysis.id, {
                    costs: [
                        { year: 0, amount: initiative.costCapex || 0, description: 'CAPEX' },
                        { year: 1, amount: initiative.costOpex || 0, description: 'OPEX (roczne)' },
                    ],
                    benefits: initiative.annualBenefit
                        ? [{ year: 1, amount: initiative.annualBenefit, description: 'Roczne korzyści' }]
                        : [],
                    discountRate: 10,
                    investmentHorizon: 5,
                });
            }

            setLinkedAnalysis({
                id: newAnalysis.id,
                name: newAnalysis.name,
                status: 'draft',
                overallScore: null,
                completionPercent: 0,
                createdAt: new Date().toISOString(),
            });

            toast.success('Utworzono analizę ekonomiczną');

            // Navigate to the new analysis
            if (onNavigateToAnalysis) {
                onNavigateToAnalysis(newAnalysis.id);
            }
        } catch (error: any) {
            toast.error(error.message || 'Nie udało się utworzyć analizy');
        } finally {
            setIsCreating(false);
        }
    };

    const handleNavigateToAnalysis = () => {
        if (linkedAnalysis && onNavigateToAnalysis) {
            onNavigateToAnalysis(linkedAnalysis.id);
        } else if (linkedAnalysis) {
            // Fallback: open in new tab
            window.open(`/economics?analysis=${linkedAnalysis.id}`, '_blank');
        }
    };

    const formatCurrency = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '—';
        return new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatPercent = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '—';
        return `${(value * 100).toFixed(1)}%`;
    };

    if (isLoading) {
        return (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30 p-6">
                <div className="flex items-center justify-center py-4">
                    <Loader2 size={24} className="animate-spin text-emerald-500" />
                </div>
            </div>
        );
    }

    // Linked Analysis Exists
    if (linkedAnalysis) {
        return (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                            <Calculator size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-navy-900 dark:text-white">Analiza ekonomiczna</h3>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Link2 size={12} />
                                Powiązana analiza
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleNavigateToAnalysis}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <ExternalLink size={16} />
                        Otwórz analizę
                    </button>
                </div>

                {/* Analysis Summary */}
                <div className="bg-white/50 dark:bg-navy-800/50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-navy-900 dark:text-white truncate">
                            {linkedAnalysis.name}
                        </span>
                        <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                linkedAnalysis.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                    : linkedAnalysis.status === 'in_progress'
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400'
                            }`}
                        >
                            {linkedAnalysis.status === 'completed'
                                ? 'Zakończona'
                                : linkedAnalysis.status === 'in_progress'
                                  ? 'W trakcie'
                                  : 'Szkic'}
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>Postęp</span>
                            <span>{linkedAnalysis.completionPercent}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${linkedAnalysis.completionPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Quick Metrics */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-2 bg-white/50 dark:bg-navy-900/50 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Wynik dojrzałości</p>
                            <p className="text-lg font-bold text-navy-900 dark:text-white">
                                {linkedAnalysis.overallScore?.toFixed(1) || '—'}/7
                            </p>
                        </div>
                        <div className="text-center p-2 bg-white/50 dark:bg-navy-900/50 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">NPV</p>
                            <p
                                className={`text-lg font-bold ${
                                    linkedAnalysis.npv && linkedAnalysis.npv > 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-red-600 dark:text-red-400'
                                }`}
                            >
                                {formatCurrency(linkedAnalysis.npv)}
                            </p>
                        </div>
                        <div className="text-center p-2 bg-white/50 dark:bg-navy-900/50 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">ROI</p>
                            <p
                                className={`text-lg font-bold ${
                                    linkedAnalysis.roi && linkedAnalysis.roi > 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-red-600 dark:text-red-400'
                                }`}
                            >
                                {formatPercent(linkedAnalysis.roi)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <BarChart2 size={14} />
                    <span>
                        Kliknij "Otwórz analizę" aby zobaczyć pełne wyniki i przeprowadzić szczegółową analizę finansową
                    </span>
                </div>
            </div>
        );
    }

    // No Linked Analysis - Create New
    return (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-navy-800 dark:to-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
                    <Calculator size={32} className="text-emerald-500" />
                </div>
                <h3 className="font-bold text-navy-900 dark:text-white mb-2">Szczegółowa analiza ekonomiczna</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
                    Przeprowadź pełną analizę NPV, IRR, okresu zwrotu i wrażliwości dla tej inicjatywy.
                </p>

                {/* Pre-filled Data Preview */}
                {(initiative.costCapex || initiative.costOpex || initiative.annualBenefit) && (
                    <div className="bg-white dark:bg-navy-800 rounded-lg p-4 mb-4 text-left">
                        <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                            <Check size={12} className="text-emerald-500" />
                            Dane zostaną automatycznie przeniesione:
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                            {initiative.costCapex && (
                                <div>
                                    <p className="text-xs text-slate-400">CAPEX</p>
                                    <p className="font-medium text-navy-900 dark:text-white">
                                        {formatCurrency(initiative.costCapex)}
                                    </p>
                                </div>
                            )}
                            {initiative.costOpex && (
                                <div>
                                    <p className="text-xs text-slate-400">OPEX</p>
                                    <p className="font-medium text-navy-900 dark:text-white">
                                        {formatCurrency(initiative.costOpex)}
                                    </p>
                                </div>
                            )}
                            {initiative.annualBenefit && (
                                <div>
                                    <p className="text-xs text-slate-400">Korzyści roczne</p>
                                    <p className="font-medium text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(initiative.annualBenefit)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <button
                    onClick={handleCreateAnalysis}
                    disabled={isCreating}
                    className="flex items-center gap-2 px-6 py-3 mx-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                    {isCreating ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Tworzenie analizy...
                        </>
                    ) : (
                        <>
                            <Plus size={18} />
                            Utwórz analizę ekonomiczną
                        </>
                    )}
                </button>

                <p className="text-xs text-slate-400 mt-4">
                    Analiza zostanie powiązana z tą inicjatywą i będzie dostępna w module Economics
                </p>
            </div>
        </div>
    );
};

export default InitiativeFinancialIntegration;
