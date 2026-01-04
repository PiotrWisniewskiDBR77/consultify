/**
 * Financial Analysis Panel
 *
 * Comprehensive financial analysis view that integrates:
 * - Financial Input Form
 * - Financial Metrics Display
 * - Cash Flow Chart
 * - Sensitivity Analysis
 * - Initiative Linking
 * - Business Case Generation
 */

import {
    Activity,
    AlertCircle,
    Calculator,
    ChevronDown,
    ChevronUp,
    DollarSign,
    FileText,
    Link2,
    Loader2,
    RefreshCw,
    Save,
    Target,
    TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { BenefitsTrackingDashboard } from './BenefitsTrackingDashboard';
import { BusinessCaseGenerator } from './BusinessCaseGenerator';
import { CashFlowChart } from './CashFlowChart';
import { FinancialInputForm } from './FinancialInputForm';
import { FinancialMetricsPanel } from './FinancialMetricsPanel';
import { InitiativeLinkingPanel } from './InitiativeLinkingPanel';
import { SensitivityChart } from './SensitivityChart';
import { DigitizationAnalysis } from './types';

interface FinancialAnalysisPanelProps {
    analysis: DigitizationAnalysis;
    onUpdate?: (analysis: DigitizationAnalysis) => void;
}

interface FinancialData {
    initialInvestment: number;
    implementationCost: number;
    annualOperatingCost: number;
    trainingCost: number;
    contingencyPercent: number;
    annualCostSavings: number;
    annualRevenueIncrease: number;
    productivityGainsPercent: number;
    riskReductionValue: number;
    implementationMonths: number;
    benefitRealizationMonths: number;
    analysisHorizonYears: number;
    discountRate: number;
    currency: string;
    assumptions: string[];
}

interface CalculatedMetrics {
    npv: number | null;
    irr: number | null;
    paybackPeriod: number | null;
    roi: number | null;
    totalCosts: number;
    totalBenefits: number;
    netBenefit: number;
    cashFlows: Array<{
        year: number;
        costs: number;
        benefits: number;
        netCashFlow: number;
        cumulativeCashFlow: number;
    }>;
}

type ActiveSection = 'input' | 'metrics' | 'cashflow' | 'sensitivity' | 'initiative' | 'benefits' | 'businesscase';

export const FinancialAnalysisPanel: React.FC<FinancialAnalysisPanelProps> = ({ analysis, onUpdate }) => {
    const [financialData, setFinancialData] = useState<FinancialData | null>(null);
    const [calculatedMetrics, setCalculatedMetrics] = useState<CalculatedMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<ActiveSection, boolean>>({
        input: true,
        metrics: true,
        cashflow: false,
        sensitivity: false,
        initiative: false,
        benefits: false,
        businesscase: false,
    });

    // Load financial data
    useEffect(() => {
        const loadFinancialData = async () => {
            setIsLoading(true);
            try {
                const data = await Api.getAnalysisFinancials(analysis.id);
                if (data) {
                    setFinancialData(data);
                }
            } catch (error) {
                console.error('Failed to load financial data:', error);
                // Initialize with defaults
            } finally {
                setIsLoading(false);
            }
        };

        loadFinancialData();
    }, [analysis.id]);

    // Calculate metrics when financial data changes
    const calculateMetrics = useCallback((data: FinancialData): CalculatedMetrics => {
        const horizon = data.analysisHorizonYears;
        const discountRate = data.discountRate / 100;

        // Calculate total upfront costs
        const totalInitialCost = data.initialInvestment + data.implementationCost + data.trainingCost;
        const contingency = totalInitialCost * (data.contingencyPercent / 100);
        const totalUpfront = totalInitialCost + contingency;

        // Calculate annual benefits
        const annualBenefits = data.annualCostSavings + data.annualRevenueIncrease + data.riskReductionValue;

        // Build cash flow array
        const cashFlows: CalculatedMetrics['cashFlows'] = [];
        let cumulativeCashFlow = 0;

        // Year 0 - initial investment
        cumulativeCashFlow -= totalUpfront;
        cashFlows.push({
            year: 0,
            costs: totalUpfront,
            benefits: 0,
            netCashFlow: -totalUpfront,
            cumulativeCashFlow,
        });

        // Years 1 to horizon
        for (let year = 1; year <= horizon; year++) {
            const yearBenefits = annualBenefits;
            const yearCosts = data.annualOperatingCost;
            const netCashFlow = yearBenefits - yearCosts;
            cumulativeCashFlow += netCashFlow;

            cashFlows.push({
                year,
                costs: yearCosts,
                benefits: yearBenefits,
                netCashFlow,
                cumulativeCashFlow,
            });
        }

        // Calculate NPV
        let npv = -totalUpfront;
        for (let year = 1; year <= horizon; year++) {
            const netCashFlow = annualBenefits - data.annualOperatingCost;
            npv += netCashFlow / Math.pow(1 + discountRate, year);
        }

        // Calculate IRR using Newton-Raphson
        let irr: number | null = null;
        const irrCashFlows = [-totalUpfront, ...Array(horizon).fill(annualBenefits - data.annualOperatingCost)];

        const calculateNPVForRate = (rate: number) => {
            let npvCalc = 0;
            for (let i = 0; i < irrCashFlows.length; i++) {
                npvCalc += irrCashFlows[i] / Math.pow(1 + rate, i);
            }
            return npvCalc;
        };

        let irrGuess = 0.1;
        for (let iteration = 0; iteration < 100; iteration++) {
            const npvAtGuess = calculateNPVForRate(irrGuess);
            const npvAtGuessPlus = calculateNPVForRate(irrGuess + 0.0001);
            const derivative = (npvAtGuessPlus - npvAtGuess) / 0.0001;

            if (Math.abs(npvAtGuess) < 0.01) {
                irr = irrGuess;
                break;
            }
            if (derivative === 0) break;

            irrGuess = irrGuess - npvAtGuess / derivative;
            if (irrGuess < -1 || irrGuess > 10) break;
        }

        // Calculate Payback Period
        let paybackPeriod: number | null = null;
        for (let i = 1; i < cashFlows.length; i++) {
            if (cashFlows[i].cumulativeCashFlow >= 0 && cashFlows[i - 1].cumulativeCashFlow < 0) {
                const previousCumulative = Math.abs(cashFlows[i - 1].cumulativeCashFlow);
                const currentNet = cashFlows[i].netCashFlow;
                paybackPeriod = i - 1 + previousCumulative / currentNet;
                break;
            }
        }

        // Calculate ROI
        const totalCosts = totalUpfront + data.annualOperatingCost * horizon;
        const totalBenefits = annualBenefits * horizon;
        const netBenefit = totalBenefits - totalCosts;
        const roi = totalCosts > 0 ? netBenefit / totalCosts : null;

        return {
            npv,
            irr,
            paybackPeriod,
            roi,
            totalCosts,
            totalBenefits,
            netBenefit,
            cashFlows,
        };
    }, []);

    // Update metrics when data changes
    useEffect(() => {
        if (financialData) {
            const metrics = calculateMetrics(financialData);
            setCalculatedMetrics(metrics);
        }
    }, [financialData, calculateMetrics]);

    const handleSaveFinancials = async (data: FinancialData) => {
        setIsSaving(true);
        try {
            await Api.updateAnalysisFinancials(analysis.id, {
                costs: [
                    { year: 0, amount: data.initialInvestment, description: 'Inwestycja początkowa' },
                    { year: 0, amount: data.implementationCost, description: 'Koszty wdrożenia' },
                    { year: 0, amount: data.trainingCost, description: 'Koszty szkoleń' },
                ],
                benefits: [
                    { year: 1, amount: data.annualCostSavings, description: 'Roczne oszczędności' },
                    { year: 1, amount: data.annualRevenueIncrease, description: 'Wzrost przychodów' },
                ],
                discountRate: data.discountRate,
                investmentHorizon: data.analysisHorizonYears,
            });

            setFinancialData(data);
            toast.success('Dane finansowe zapisane');
        } catch (error: any) {
            toast.error(error.message || 'Nie udało się zapisać danych');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLinkInitiative = async (initiativeId: string) => {
        await Api.linkAnalysisToInitiative(analysis.id, initiativeId);
        if (onUpdate) {
            const updated = await Api.getDigitizationAnalysis(analysis.id);
            onUpdate(updated);
        }
    };

    const toggleSection = (section: ActiveSection) => {
        setExpandedSections((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    // Prepare sensitivity data
    const sensitivityVariables = useMemo(() => {
        if (!financialData || !calculatedMetrics) return [];

        const baseData = financialData;
        const changes = [-0.2, -0.1, 0, 0.1, 0.2];

        const generateSensitivityData = (
            name: string,
            namePl: string,
            baseValue: number,
            modifyData: (data: FinancialData, factor: number) => FinancialData,
            color: string,
        ) => {
            return {
                name,
                namePl,
                baseValue,
                unit: financialData.currency,
                color,
                data: changes.map((change) => {
                    const modifiedData = modifyData({ ...baseData }, 1 + change);
                    const metrics = calculateMetrics(modifiedData);
                    return {
                        change,
                        variableValue: baseValue * (1 + change),
                        npv: metrics.npv || 0,
                    };
                }),
            };
        };

        return [
            generateSensitivityData(
                'initialInvestment',
                'Inwestycja początkowa',
                baseData.initialInvestment,
                (data, factor) => ({ ...data, initialInvestment: data.initialInvestment * factor }),
                '#ef4444',
            ),
            generateSensitivityData(
                'annualCostSavings',
                'Roczne oszczędności',
                baseData.annualCostSavings,
                (data, factor) => ({ ...data, annualCostSavings: data.annualCostSavings * factor }),
                '#10b981',
            ),
            generateSensitivityData(
                'discountRate',
                'Stopa dyskontowa',
                baseData.discountRate,
                (data, factor) => ({ ...data, discountRate: data.discountRate * factor }),
                '#3b82f6',
            ),
            generateSensitivityData(
                'annualOperatingCost',
                'Roczne koszty operacyjne',
                baseData.annualOperatingCost,
                (data, factor) => ({ ...data, annualOperatingCost: data.annualOperatingCost * factor }),
                '#f59e0b',
            ),
        ];
    }, [financialData, calculatedMetrics, calculateMetrics]);

    const SectionHeader: React.FC<{
        title: string;
        icon: React.ReactNode;
        section: ActiveSection;
        badge?: string;
    }> = ({ title, icon, section, badge }) => (
        <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-700/50 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                    {icon}
                </div>
                <div className="text-left">
                    <h3 className="font-semibold text-navy-900 dark:text-white">{title}</h3>
                    {badge && <span className="text-xs text-slate-500 dark:text-slate-400">{badge}</span>}
                </div>
            </div>
            {expandedSections[section] ? (
                <ChevronUp size={20} className="text-slate-400" />
            ) : (
                <ChevronDown size={20} className="text-slate-400" />
            )}
        </button>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 size={32} className="animate-spin text-emerald-500 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Ładowanie danych finansowych...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Calculator size={24} className="text-white" />
                        </div>
                        Analiza finansowa
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Kompleksowa ocena ekonomiczna dla: {analysis.name}
                    </p>
                </div>

                {calculatedMetrics && (
                    <div className="flex items-center gap-4">
                        <div
                            className={`px-4 py-2 rounded-xl ${calculatedMetrics.npv && calculatedMetrics.npv > 0 ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}
                        >
                            <p className="text-xs text-slate-500 dark:text-slate-400">NPV</p>
                            <p
                                className={`font-bold ${calculatedMetrics.npv && calculatedMetrics.npv > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                            >
                                {calculatedMetrics.npv
                                    ? new Intl.NumberFormat('pl-PL', {
                                          style: 'currency',
                                          currency: financialData?.currency || 'PLN',
                                          maximumFractionDigits: 0,
                                      }).format(calculatedMetrics.npv)
                                    : '—'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Financial Input Section */}
            <div className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <SectionHeader
                    title="Dane wejściowe"
                    icon={<DollarSign size={20} />}
                    section="input"
                    badge="Koszty i korzyści"
                />
                {expandedSections.input && (
                    <div className="p-6 border-t border-slate-100 dark:border-white/5">
                        <FinancialInputForm
                            initialData={financialData || undefined}
                            onSave={handleSaveFinancials}
                            onCalculate={(data) => {
                                const metrics = calculateMetrics(data);
                                setCalculatedMetrics(metrics);
                            }}
                            isLoading={isSaving}
                            currency={financialData?.currency || 'PLN'}
                        />
                    </div>
                )}
            </div>

            {/* Financial Metrics Section */}
            {calculatedMetrics && (
                <div className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    <SectionHeader
                        title="Wskaźniki finansowe"
                        icon={<TrendingUp size={20} />}
                        section="metrics"
                        badge="NPV, IRR, ROI, Payback"
                    />
                    {expandedSections.metrics && (
                        <div className="p-6 border-t border-slate-100 dark:border-white/5">
                            <FinancialMetricsPanel
                                metrics={calculatedMetrics}
                                currency={financialData?.currency}
                                discountRate={financialData?.discountRate}
                                horizon={financialData?.analysisHorizonYears}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Cash Flow Chart Section */}
            {calculatedMetrics && calculatedMetrics.cashFlows.length > 0 && (
                <div className="space-y-0">
                    <SectionHeader
                        title="Przepływy pieniężne"
                        icon={<Activity size={20} />}
                        section="cashflow"
                        badge="Wizualizacja cash flow"
                    />
                    {expandedSections.cashflow && (
                        <div className="mt-4">
                            <CashFlowChart
                                cashFlows={calculatedMetrics.cashFlows}
                                currency={financialData?.currency}
                                showCumulative={true}
                                showBreakeven={true}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Sensitivity Analysis Section */}
            {sensitivityVariables.length > 0 && (
                <div className="space-y-0">
                    <SectionHeader
                        title="Analiza wrażliwości"
                        icon={<Activity size={20} />}
                        section="sensitivity"
                        badge="Wpływ zmian parametrów"
                    />
                    {expandedSections.sensitivity && (
                        <div className="mt-4">
                            <SensitivityChart
                                variables={sensitivityVariables}
                                baseNpv={calculatedMetrics?.npv || 0}
                                currency={financialData?.currency}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Initiative Linking Section */}
            <div className="space-y-0">
                <SectionHeader
                    title="Powiązanie z inicjatywą"
                    icon={<Link2 size={20} />}
                    section="initiative"
                    badge="Integracja z portfolio"
                />
                {expandedSections.initiative && (
                    <div className="mt-4">
                        <InitiativeLinkingPanel
                            analysisId={analysis.id}
                            linkedInitiativeId={(analysis as any).linked_initiative_id}
                            onLink={handleLinkInitiative}
                        />
                    </div>
                )}
            </div>

            {/* Benefits Tracking Section */}
            <div className="space-y-0">
                <SectionHeader
                    title="Śledzenie korzyści"
                    icon={<Target size={20} />}
                    section="benefits"
                    badge="Plan vs realizacja"
                />
                {expandedSections.benefits && (
                    <div className="mt-4 bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
                        <BenefitsTrackingDashboard
                            analysisId={analysis.id}
                            analysisName={analysis.name}
                            currency={financialData?.currency || 'PLN'}
                        />
                    </div>
                )}
            </div>

            {/* Business Case Generator Section */}
            <div className="space-y-0">
                <SectionHeader
                    title="Generator Business Case"
                    icon={<FileText size={20} />}
                    section="businesscase"
                    badge="Dokument uzasadnienia"
                />
                {expandedSections.businesscase && (
                    <div className="mt-4">
                        <BusinessCaseGenerator
                            analysisId={analysis.id}
                            analysisName={analysis.name}
                            hasFinancialData={!!financialData && financialData.initialInvestment > 0}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default FinancialAnalysisPanel;
