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
  ExternalLink,
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
import { useNavigate } from 'react-router-dom';

import type { UnifiedOutputRow } from '@/components/ReportsAndPresentations/types';
import { useArtifactOutputsForInitiative } from '@/components/ReportsAndPresentations/useRapData';
import { getArtifactPath } from '@/utils/artifactLinks';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { StatusChip } from '../ui/primitives';
import { BenefitsTrackingDashboard } from './BenefitsTrackingDashboard';
import { BusinessCaseGenerator } from './BusinessCaseGenerator';
import { CashFlowChart } from './CashFlowChart';
import { useFinanceChartColors } from './financeChartTokens';
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

type ActiveSection =
  | 'input'
  | 'metrics'
  | 'cashflow'
  | 'sensitivity'
  | 'scenarios'
  | 'gates'
  | 'initiative'
  | 'outputs'
  | 'benefits'
  | 'businesscase';

export const FinancialAnalysisPanel: React.FC<FinancialAnalysisPanelProps> = ({
  analysis,
  onUpdate,
}) => {
  const navigate = useNavigate();
  const chart = useFinanceChartColors();
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [calculatedMetrics, setCalculatedMetrics] = useState<CalculatedMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const currentUser = useAppStore((state) => state.currentUser);
  const [expandedSections, setExpandedSections] = useState<Record<ActiveSection, boolean>>({
    input: true,
    metrics: true,
    cashflow: false,
    sensitivity: false,
    scenarios: false,
    gates: false,
    initiative: false,
    outputs: false,
    benefits: false,
    businesscase: false,
  });
  const {
    rows: linkedOutputs,
    loading: linkedOutputsLoading,
    error: linkedOutputsError,
  } = useArtifactOutputsForInitiative(analysis.initiativeId, 8);

  const loadScenarios = useCallback(async () => {
    setIsLoadingScenarios(true);
    try {
      const response = await Api.getAnalysisScenarios(analysis.id);
      setScenarios(response.scenarios || []);
    } catch (error) {
      console.error('Failed to load scenarios:', error);
      setScenarios([]);
    } finally {
      setIsLoadingScenarios(false);
    }
  }, [analysis.id]);

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
    loadScenarios();
  }, [analysis.id, loadScenarios]);

  // Calculate metrics when financial data changes
  const calculateMetrics = useCallback((data: FinancialData): CalculatedMetrics => {
    const horizon = data.analysisHorizonYears;
    const discountRate = data.discountRate / 100;

    // Calculate total upfront costs
    const totalInitialCost = data.initialInvestment + data.implementationCost + data.trainingCost;
    const contingency = totalInitialCost * (data.contingencyPercent / 100);
    const totalUpfront = totalInitialCost + contingency;

    // Calculate annual benefits
    const baseAnnualBenefits =
      data.annualCostSavings + data.annualRevenueIncrease + data.riskReductionValue;
    const annualBenefits = baseAnnualBenefits * (1 + data.productivityGainsPercent / 100);

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
    const irrCashFlows = [
      -totalUpfront,
      ...Array(horizon).fill(annualBenefits - data.annualOperatingCost),
    ];

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
        financialData: data,
        costs: [
          { year: 0, amount: data.initialInvestment, description: 'Initial Investment' },
          { year: 0, amount: data.implementationCost, description: 'Implementation Costs' },
          { year: 0, amount: data.trainingCost, description: 'Training Costs' },
        ],
        benefits: [
          { year: 1, amount: data.annualCostSavings, description: 'Annual Savings' },
          { year: 1, amount: data.annualRevenueIncrease, description: 'Revenue Increase' },
        ],
        discountRate: data.discountRate,
        investmentHorizon: data.analysisHorizonYears,
      });

      setFinancialData(data);
      await loadScenarios();
      toast.success('Dane financial zapisane');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save data');
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

  const handleActivateScenario = async (scenarioId: string) => {
    try {
      await Api.activateAnalysisScenario(analysis.id, scenarioId);
      await loadScenarios();
      toast.success('Selected scenario active');
    } catch (error: any) {
      toast.error(error.message || 'Failed to set scenario');
    }
  };

  const handleCreateInitiative = async () => {
    try {
      const result = await Api.createInitiativeFromAnalysis(analysis.id);
      toast.success('Created initiative z analysis');
      if (onUpdate && result?.initiativeId) {
        const updated = await Api.getDigitizationAnalysis(analysis.id);
        onUpdate(updated);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create initiative');
    }
  };

  const handleStatusChange = async (status: 'DRAFT' | 'REVIEW' | 'APPROVED') => {
    try {
      await Api.updateDigitizationAnalysis(analysis.id, { status });
      if (onUpdate) {
        const updated = await Api.getDigitizationAnalysis(analysis.id);
        onUpdate(updated);
      }
      toast.success('Changed status analysis');
    } catch (error: any) {
      toast.error(error.message || 'Failed to change status');
    }
  };

  const handleCreateDecision = async (
    decisionType: 'approve-analysis' | 'select-scenario' | 'go-no-go'
  ) => {
    if (!currentUser?.id) {
      toast.error('No usera decision maker');
      return;
    }
    try {
      await Api.createAnalysisDecision(analysis.id, {
        decisionType,
        decisionMakerId: currentUser.id,
      });
      toast.success('Created decision');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create decision');
    }
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
      color: string
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
        'Initial Investment',
        baseData.initialInvestment,
        (data, factor) => ({ ...data, initialInvestment: data.initialInvestment * factor }),
        chart.cost
      ),
      generateSensitivityData(
        'annualCostSavings',
        'Annual Savings',
        baseData.annualCostSavings,
        (data, factor) => ({ ...data, annualCostSavings: data.annualCostSavings * factor }),
        chart.benefit
      ),
      generateSensitivityData(
        'discountRate',
        'Stopa dyskontowa',
        baseData.discountRate,
        (data, factor) => ({ ...data, discountRate: data.discountRate * factor }),
        chart.net
      ),
      generateSensitivityData(
        'annualOperatingCost',
        'Roczne costs operacyjne',
        baseData.annualOperatingCost,
        (data, factor) => ({ ...data, annualOperatingCost: data.annualOperatingCost * factor }),
        chart.warning
      ),
    ];
  }, [financialData, calculatedMetrics, calculateMetrics, chart]);

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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white">
          {icon}
        </div>
        <div className="text-left">
          <h3 className="font-semibold text-navy-900 dark:text-white">{title}</h3>
          {badge && <span className="text-xs text-slate-500 dark:text-slate-400">{badge}</span>}
        </div>
      </div>
      {expandedSections[section] ? (
        <ChevronUp size={20} className="text-slate-600 dark:text-slate-500" />
      ) : (
        <ChevronDown size={20} className="text-slate-600 dark:text-slate-500" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Loading financial data...</p>
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
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
              className={`px-4 py-2 rounded-xl ${calculatedMetrics.npv && calculatedMetrics.npv > 0 ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-rose-100 dark:bg-rose-500/20'}`}
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">NPV</p>
              <p
                className={`font-bold ${calculatedMetrics.npv && calculatedMetrics.npv > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
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

      {/* Status & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(
            [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'REVIEW', label: 'Review' },
              { value: 'APPROVED', label: 'Approved' },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              onClick={() => handleStatusChange(item.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                analysis.status === item.value
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {!analysis.initiativeId && (
          <button
            onClick={handleCreateInitiative}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            Create Initiative
          </button>
        )}
      </div>

      {/* Financial Input Section */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <SectionHeader
          title="Input Data"
          icon={<DollarSign size={20} />}
          section="input"
          badge="Costs i benefits"
        />
        {expandedSections.input && (
          <div className="p-6 border-t border-slate-200 dark:border-navy-700">
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
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <SectionHeader
            title="Financial Metrics"
            icon={<TrendingUp size={20} />}
            section="metrics"
            badge="NPV, IRR, ROI, Payback"
          />
          {expandedSections.metrics && (
            <div className="p-6 border-t border-slate-200 dark:border-navy-700">
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
            title="Cash Flows"
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
            title="Sensitivity Analysis"
            icon={<Activity size={20} />}
            section="sensitivity"
            badge="Impact of Parameter Changes"
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

      {/* Scenarios Section */}
      <div className="space-y-0">
        <SectionHeader
          title="Scenariusze"
          icon={<TrendingUp size={20} />}
          section="scenarios"
          badge="Base / Optimistic / Conservative"
        />
        {expandedSections.scenarios && (
          <div className="mt-4">
            {isLoadingScenarios ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-emerald-500" />
              </div>
            ) : scenarios.length === 0 ? (
              <div className="bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6 text-center text-slate-500 dark:text-slate-400">
                No scenarios to display
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      scenario.isActive
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-navy-900 dark:text-white">
                        {scenario.name || scenario.scenarioType}
                      </h4>
                      {scenario.isActive && <StatusChip tone="success" label="Active" />}
                    </div>
                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>NPV</span>
                        <span className="font-semibold text-navy-900 dark:text-white">
                          {scenario.metrics?.npv
                            ? new Intl.NumberFormat('pl-PL', {
                                style: 'currency',
                                currency: financialData?.currency || 'PLN',
                                maximumFractionDigits: 0,
                              }).format(scenario.metrics.npv)
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>ROI</span>
                        <span className="font-semibold text-navy-900 dark:text-white">
                          {scenario.metrics?.roi !== null && scenario.metrics?.roi !== undefined
                            ? `${(scenario.metrics.roi * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Payback</span>
                        <span className="font-semibold text-navy-900 dark:text-white">
                          {scenario.metrics?.paybackPeriod
                            ? `${scenario.metrics.paybackPeriod.toFixed(1)}y`
                            : '—'}
                        </span>
                      </div>
                    </div>
                    {!scenario.isActive && (
                      <button
                        onClick={() => handleActivateScenario(scenario.id)}
                        className="mt-4 w-full px-3 py-2 text-sm font-medium rounded-lg border border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 transition-colors"
                      >
                        Ustaw jako active
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gate Decisions Section */}
      <div className="space-y-0">
        <SectionHeader
          title="Decyzje bramkowe"
          icon={<AlertCircle size={20} />}
          section="gates"
          badge="Approve / Scenario / Go-No-Go"
        />
        {expandedSections.gates && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleCreateDecision('approve-analysis')}
              className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:border-emerald-400 transition-colors text-left"
            >
              <p className="text-sm font-semibold text-navy-900 dark:text-white">
                Approve Analysis
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Zatwierdzenie analysis financialj
              </p>
            </button>
            <button
              onClick={() => handleCreateDecision('select-scenario')}
              className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:border-emerald-400 transition-colors text-left"
            >
              <p className="text-sm font-semibold text-navy-900 dark:text-white">
                Select Active Scenario
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Selection of scenario active
              </p>
            </button>
            <button
              onClick={() => handleCreateDecision('go-no-go')}
              className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:border-emerald-400 transition-colors text-left"
            >
              <p className="text-sm font-semibold text-navy-900 dark:text-white">
                Investment Go/No-Go
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Decyzja inwestycyjna Go/No-Go
              </p>
            </button>
          </div>
        )}
      </div>

      {/* Initiative Linking Section */}
      <div className="space-y-0">
        <SectionHeader
          title="Initiative Linking"
          icon={<Link2 size={20} />}
          section="initiative"
          badge="Integracja z portfolio"
        />
        {expandedSections.initiative && (
          <div className="mt-4">
            <InitiativeLinkingPanel
              analysisId={analysis.id}
              linkedInitiativeId={analysis.initiativeId}
              onLink={handleLinkInitiative}
            />
          </div>
        )}
      </div>

      {analysis.initiativeId && (
        <div className="space-y-0">
          <SectionHeader
            title="Linked Outputs"
            icon={<FileText size={20} />}
            section="outputs"
            badge="Canonical artifact outputs for the linked initiative"
          />
          {expandedSections.outputs && (
            <div className="mt-4">
              <LinkedOutputsSection
                rows={linkedOutputs}
                loading={linkedOutputsLoading}
                error={linkedOutputsError}
                onOpen={(row) => {
                  const targetPath =
                    row.kind === 'sheet'
                      ? '/presentations?tab=sheets'
                      : getArtifactPath(
                          row.kind === 'presentation' ? 'presentation' : 'report',
                          row.originRecordId
                        );
                  navigate(targetPath);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Benefits Tracking Section */}
      <div className="space-y-0">
        <SectionHeader
          title="Benefits Tracking"
          icon={<Target size={20} />}
          section="benefits"
          badge="Plan vs realizacja"
        />
        {expandedSections.benefits && (
          <div className="mt-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
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

const LinkedOutputsSection: React.FC<{
  rows: UnifiedOutputRow[];
  loading: boolean;
  error: string | null;
  onOpen: (row: UnifiedOutputRow) => void;
}> = ({ rows, loading, error, onOpen }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-navy-700 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        No governed outputs are linked to this initiative yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rows.map((row) => (
        <button
          key={`${row.kind}:${row.originRecordId}`}
          type="button"
          onClick={() => onOpen(row)}
          className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-4 py-4 text-left hover:border-emerald-400 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-navy-900 dark:text-white">
                {row.title}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {row.kind} · {row.statusKey} · {row.governance?.visibilityScope || 'private'}
              </div>
            </div>
            <ExternalLink size={14} className="flex-shrink-0 text-slate-600" />
          </div>
        </button>
      ))}
    </div>
  );
};

export default FinancialAnalysisPanel;
