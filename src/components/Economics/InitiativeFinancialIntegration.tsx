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
import { V8FinanceApi } from '../../services/api/v8/finance';
import { LoadingState } from '../ui/primitives';

interface LinkedAnalysis {
  id: string;
  name: string;
  status: string;
  analysisType?: string;
  overallScore: number | null;
  completionPercent: number;
  createdAt: string;
  npv?: number | null;
  roi?: number | null;
  /** FIN-006/A O2: from GET /api/economics/analyses/:id/financials → currency. */
  currency?: string | null;
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
  /** Last-resort fallback only — the real value is read from the linked
   * analysis's own currency (analysis_financials.currency) once loaded. */
  currency?: string;
}

export const InitiativeFinancialIntegration: React.FC<InitiativeFinancialIntegrationProps> = ({
  initiative,
  onNavigateToAnalysis,
  // FIN-006/A O2: EUR (not PLN) is the neutral last-resort default — same
  // reasoning as economics.routes.ts and FullROIView.tsx.
  currency = 'EUR',
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
        const analyses = await Api.getDigitizationAnalyses({
          initiativeId: initiative.id,
          analysisType: 'financial',
        });
        const linked = analyses.analyses?.find(
          (a: any) => a.initiativeId === initiative.id || a.projectId === initiative.id
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
              // FIN-006/A O2: thread the real currency through from
              // analysis_financials.currency instead of leaving the display
              // stuck on the `currency` prop's static default.
              fullAnalysis.currency = financials.currency || null;
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
      const newAnalysis = await V8FinanceApi.createDigitizationAnalysis(
        {
          name: `Analiza ekonomiczna: ${initiative.name}`,
          description: `Analiza ekonomiczna dla initiative: ${initiative.name}`,
          initiativeId: initiative.id,
          analysisType: 'financial',
          sourceType: 'initiative',
          sourceId: initiative.id,
        },
        `initiative-analysis:${initiative.id}`
      );

      // Pre-fill financial data if available
      if (initiative.costCapex || initiative.costOpex || initiative.annualBenefit) {
        await Api.updateAnalysisFinancials(newAnalysis.id, {
          costs: [
            { year: 0, amount: initiative.costCapex || 0, description: 'CAPEX' },
            { year: 1, amount: initiative.costOpex || 0, description: 'OPEX (roczne)' },
          ],
          benefits: initiative.annualBenefit
            ? [{ year: 1, amount: initiative.annualBenefit, description: 'Roczne benefits' }]
            : [],
          discountRate: 10,
          investmentHorizon: 5,
        });
      }

      setLinkedAnalysis({
        id: newAnalysis.id,
        name: newAnalysis.name,
        status: 'DRAFT',
        overallScore: null,
        completionPercent: 0,
        createdAt: new Date().toISOString(),
      });

      toast.success('Created analysis financial');

      // Navigate to the new analysis
      if (onNavigateToAnalysis) {
        onNavigateToAnalysis(newAnalysis.id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create analysis');
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
    // FIN-006/A O2: prefer the linked analysis's own currency (real data
    // from analysis_financials.currency); the `currency` prop is only a
    // last-resort fallback for when no analysis has loaded yet.
    const effectiveCurrency = linkedAnalysis?.currency || currency;
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: effectiveCurrency,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return `${(value * 100).toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-500/10 dark:to-blue-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30 p-6">
        <LoadingState variant="spinner" className="py-4" />
      </div>
    );
  }

  // Linked Analysis Exists
  if (linkedAnalysis) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-500/10 dark:to-blue-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Calculator size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-navy-900 dark:text-white">Analiza ekonomiczna</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Link2 size={12} />
                Linked analysis
              </p>
            </div>
          </div>
          <button
            onClick={handleNavigateToAnalysis}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            <ExternalLink size={16} />
            Open analysis
          </button>
        </div>

        {/* Analysis Totalmary */}
        <div className="bg-white/50 dark:bg-navy-800/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-navy-900 dark:text-white truncate">
              {linkedAnalysis.name}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                linkedAnalysis.status === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : linkedAnalysis.status === 'REVIEW'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400'
              }`}
            >
              {linkedAnalysis.analysisType === 'financial'
                ? linkedAnalysis.status === 'APPROVED'
                  ? 'Approved'
                  : linkedAnalysis.status === 'REVIEW'
                    ? 'Review'
                    : 'Draft'
                : linkedAnalysis.status === 'APPROVED'
                  ? 'Completed'
                  : linkedAnalysis.status === 'REVIEW'
                    ? 'W trakcie'
                    : 'Szkic'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Progress</span>
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
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Maturity Score</p>
              <p className="text-lg font-bold text-navy-900 dark:text-white">
                {linkedAnalysis.overallScore?.toFixed(1) || '—'}/7
              </p>
            </div>
            <div className="text-center p-2 bg-white/50 dark:bg-navy-900/50 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">NPV</p>
              <p
                className={`text-lg font-bold ${
                  linkedAnalysis.npv && linkedAnalysis.npv > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-danger-600 dark:text-danger-400'
                }`}
              >
                {formatCurrency(linkedAnalysis.npv)}
              </p>
            </div>
            <div className="text-center p-2 bg-white/50 dark:bg-navy-900/50 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">ROI</p>
              <p
                className={`text-lg font-bold ${
                  linkedAnalysis.roi && linkedAnalysis.roi > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-danger-600 dark:text-danger-400'
                }`}
              >
                {formatPercent(linkedAnalysis.roi)}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <BarChart2 size={14} />
          <span>
            Click "Open Analysis" to see full scores and perform detailed analysis financial
          </span>
        </div>
      </div>
    );
  }

  // No Linked Analysis - Create New
  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-navy-800 dark:to-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
          <Calculator size={32} className="text-emerald-500" />
        </div>
        <h3 className="font-bold text-navy-900 dark:text-white mb-2">
          Detailed analysis ekonomiczna
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
          Perform full analysis NPV, IRR, payback period and sensitivity for this initiative.
        </p>

        {/* Pre-filled Data Preview */}
        {(initiative.costCapex || initiative.costOpex || initiative.annualBenefit) && (
          <div className="bg-white dark:bg-navy-800 rounded-lg p-4 mb-4 text-left">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
              <Check size={12} className="text-emerald-500" />
              Data will be automatically transferred:
            </p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {initiative.costCapex && (
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-500">CAPEX</p>
                  <p className="font-medium text-navy-900 dark:text-white">
                    {formatCurrency(initiative.costCapex)}
                  </p>
                </div>
              )}
              {initiative.costOpex && (
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-500">OPEX</p>
                  <p className="font-medium text-navy-900 dark:text-white">
                    {formatCurrency(initiative.costOpex)}
                  </p>
                </div>
              )}
              {initiative.annualBenefit && (
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-500">Annual Benefits</p>
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
              Creating analysis...
            </>
          ) : (
            <>
              <Plus size={18} />
              Create analysis financial
            </>
          )}
        </button>

        <p className="text-xs text-slate-600 dark:text-slate-500 mt-4">
          Analysis will be linked to this initiative and available w module Economics
        </p>
      </div>
    </div>
  );
};

export default InitiativeFinancialIntegration;
