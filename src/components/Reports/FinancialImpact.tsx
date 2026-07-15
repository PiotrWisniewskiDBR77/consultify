/**
 * FinancialImpact
 *
 * ROI calculator and financial projections section:
 * - Investment required (ranges)
 * - ROI timeline
 * - Payback period
 * - NPV/IRR estimates
 */

import { motion } from 'framer-motion';
import {
  AlertCircle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface InvestmentItem {
  category: string;
  categoryPl: string;
  minAmount: number;
  maxAmount: number;
  description?: string;
  descriptionPl?: string;
}

interface FinancialImpactProps {
  totalGap?: number; // Used to estimate investment
  initiativesCount?: number;
  currency?: string;
  currencySymbol?: string;
  customInvestments?: InvestmentItem[];
  className?: string;
}

// Default investment categories
const DEFAULT_INVESTMENTS: InvestmentItem[] = [
  {
    category: 'Technology & Infrastructure',
    categoryPl: 'Technologia i Infrastruktura',
    minAmount: 200000,
    maxAmount: 500000,
    description: 'Cloud, systems, integrations',
    descriptionPl: 'Chmura, systemy, integracje',
  },
  {
    category: 'Training & Change Management',
    categoryPl: 'Szkolenia i Zarządzanie Zmianą',
    minAmount: 50000,
    maxAmount: 150000,
    description: 'Upskilling, workshops, communication',
    descriptionPl: 'Podnoszenie kwalifikacji, warsztaty, komunikacja',
  },
  {
    category: 'External Consulting',
    categoryPl: 'Konsulting Zewnętrzny',
    minAmount: 100000,
    maxAmount: 300000,
    description: 'Strategy, implementation support',
    descriptionPl: 'Strategia, wsparcie wdrożenia',
  },
  {
    category: 'Data & Analytics',
    categoryPl: 'Dane i Analityka',
    minAmount: 80000,
    maxAmount: 200000,
    description: 'Data platform, BI tools, AI pilots',
    descriptionPl: 'Platforma danych, narzędzia BI, piloty AI',
  },
  {
    category: 'Cybersecurity',
    categoryPl: 'Cyberbezpieczeństwo',
    minAmount: 50000,
    maxAmount: 150000,
    description: 'Security tools, audits, compliance',
    descriptionPl: 'Narzędzia bezpieczeństwa, audyty, zgodność',
  },
];

// Format currency
const formatCurrency = (amount: number, symbol: string = 'PLN'): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${symbol}`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K ${symbol}`;
  }
  return `${amount} ${symbol}`;
};

export const FinancialImpact: React.FC<FinancialImpactProps> = ({
  totalGap = 10,
  initiativesCount = 7,
  currency = 'PLN',
  currencySymbol = 'zł',
  customInvestments,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [showDetails, setShowDetails] = useState(false);

  const investments = customInvestments || DEFAULT_INVESTMENTS;

  // Calculate totals
  const totals = useMemo(() => {
    const minTotal = investments.reduce((sum, inv) => sum + inv.minAmount, 0);
    const maxTotal = investments.reduce((sum, inv) => sum + inv.maxAmount, 0);
    const avgTotal = (minTotal + maxTotal) / 2;

    // Estimate based on gap (more gap = more investment needed)
    const gapMultiplier = 1 + totalGap / 20;
    const adjustedMin = Math.round(minTotal * gapMultiplier);
    const adjustedMax = Math.round(maxTotal * gapMultiplier);
    const adjustedAvg = Math.round(avgTotal * gapMultiplier);

    return { minTotal: adjustedMin, maxTotal: adjustedMax, avgTotal: adjustedAvg };
  }, [investments, totalGap]);

  // Estimate ROI timeline
  const roiData = useMemo(() => {
    const data = [];
    const investmentPerYear = totals.avgTotal / 2; // Spread over 2 years
    let cumulativeInvestment = 0;
    let cumulativeReturns = 0;
    const annualBenefitRate = 0.15; // 15% annual benefit from digital transformation

    for (let year = 0; year <= 5; year++) {
      if (year <= 2) {
        cumulativeInvestment += investmentPerYear;
      }

      // Benefits start in year 2 and grow
      if (year >= 1) {
        const benefitMultiplier = Math.min(1, (year - 1) * 0.4); // Ramp up to full benefits
        cumulativeReturns += totals.avgTotal * annualBenefitRate * benefitMultiplier * year;
      }

      data.push({
        year: t('reports.financialImpact.yearLabel', 'Year {{year}}', { year }),
        investment: -cumulativeInvestment,
        returns: cumulativeReturns,
        net: cumulativeReturns - cumulativeInvestment,
      });
    }

    return data;
  }, [totals, t]);

  // Calculate key metrics
  const metrics = useMemo(() => {
    const paybackYear = roiData.findIndex((d) => d.net >= 0);
    const year5Net = roiData[5]?.net || 0;
    const roi = ((year5Net + totals.avgTotal) / totals.avgTotal - 1) * 100;

    return {
      paybackPeriod:
        paybackYear >= 0
          ? t('reports.financialImpact.paybackYears', '{{count}} years', { count: paybackYear })
          : '> 5 years',
      roi5Year: Math.round(roi),
      npv: year5Net,
      monthlyBreakdown: Math.round(totals.avgTotal / 24),
    };
  }, [roiData, totals, t]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/30">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {t('reports.financialImpact.indicativeEstimatesTitle', 'Indicative Estimates')}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            {t(
              'reports.financialImpact.indicativeEstimatesBody',
              'The values below are estimates and may vary based on organization specifics. Detailed budgeting should be conducted during project planning.'
            )}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-3 opacity-90">
            <DollarSign className="w-5 h-5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              {t('reports.financialImpact.estInvestmentLabel', 'Est. Investment')}
            </span>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(totals.minTotal, currency)} -{' '}
            {formatCurrency(totals.maxTotal, currency)}
          </div>
          <div className="text-xs opacity-75 mt-2">
            {t('reports.financialImpact.spreadMonths', 'Spread over 18-24 months')}
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
            <Clock className="w-5 h-5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              {t('reports.financialImpact.paybackPeriodLabel', 'Payback Period')}
            </span>
          </div>
          <div className="text-2xl font-bold text-navy-900 dark:text-white">
            {metrics.paybackPeriod}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {t('reports.financialImpact.fromImplementationStart', 'From implementation start')}
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              {t('reports.financialImpact.roi5YearLabel', 'ROI (5 years)')}
            </span>
          </div>
          <div
            className={`text-2xl font-bold ${metrics.roi5Year > 0 ? 'text-green-600' : 'text-danger-600'}`}
          >
            {metrics.roi5Year > 0 ? '+' : ''}
            {metrics.roi5Year}%
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {t('reports.financialImpact.cumulativeReturn', 'Cumulative return')}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-3 opacity-90">
            <Calculator className="w-5 h-5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              {t('reports.financialImpact.npv5YearLabel', 'NPV (5 years)')}
            </span>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(Math.abs(metrics.npv), currency)}
          </div>
          <div className="text-xs opacity-75 mt-2">
            {metrics.npv >= 0
              ? t('reports.financialImpact.positiveNetValue', 'Positive net value')
              : t('reports.financialImpact.negativeNetValue', 'Negative net value')}
          </div>
        </div>
      </div>

      {/* ROI Timeline Chart */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h4 className="font-semibold text-navy-900 dark:text-white mb-4">
          {t('reports.financialImpact.roiProjectionTitle', 'ROI Projection')}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={roiData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              className="dark:stroke-white/10"
            />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(Math.abs(value), '')}
            />
            <Tooltip
              formatter={(value: any) =>
                [formatCurrency(Math.abs(Number(value)), currency), ''] as any
              }
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="investment"
              name={t('reports.financialImpact.investmentCumulative', 'Investment (cumulative)')}
              stroke="#f43f5e"
              fill="#fee2e2"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="returns"
              name={t('reports.financialImpact.benefitsCumulative', 'Benefits (cumulative)')}
              stroke="#10b981"
              fill="#d1fae5"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="net"
              name={t('reports.financialImpact.netResult', 'Net Result')}
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Investment Breakdown */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        >
          <h4 className="font-semibold text-navy-900 dark:text-white">
            {t('reports.financialImpact.investmentBreakdownTitle', 'Investment Breakdown')}
          </h4>
          {showDetails ? (
            <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-500" />
          )}
        </button>

        {showDetails && (
          <div className="px-6 pb-6">
            <div className="space-y-4">
              {investments.map((investment, index) => {
                const percentage =
                  ((investment.minAmount + investment.maxAmount) / 2 / totals.avgTotal) * 100;

                return (
                  <motion.div
                    key={investment.category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-navy-900 dark:text-white">
                          {isPolish ? investment.categoryPl : investment.category}
                        </p>
                        {(investment.description || investment.descriptionPl) && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {isPolish ? investment.descriptionPl : investment.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {formatCurrency(investment.minAmount, currency)} -{' '}
                        {formatCurrency(investment.maxAmount, currency)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: 0.2 + index * 0.05, duration: 0.5 }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {percentage.toFixed(0)}%{' '}
                        {t('reports.financialImpact.ofBudgetSuffix', 'of budget')}
                      </span>
                      <span>
                        ~
                        {formatCurrency(
                          Math.round((investment.minAmount + investment.maxAmount) / 24),
                          currency
                        )}
                        /{t('reports.financialImpact.moSuffix', 'mo.')}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Total */}
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  {t('reports.financialImpact.totalLabel', 'TOTAL')}
                </span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(totals.minTotal, currency)} -{' '}
                  {formatCurrency(totals.maxTotal, currency)}
                </span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {t('reports.financialImpact.averageLabel', 'Average')}:{' '}
                {formatCurrency(totals.avgTotal, currency)}(
                {formatCurrency(metrics.monthlyBreakdown, currency)}/
                {t('reports.financialImpact.monthLabel', 'month')})
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Key assumptions */}
      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <p className="font-medium">
          {t('reports.financialImpact.assumptionsTitle', 'Assumptions:')}
        </p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>{t('reports.financialImpact.discountRateAssumption', 'Discount rate: 10%')}</li>
          <li>
            {t(
              'reports.financialImpact.annualBenefitsAssumption',
              'Annual transformation benefits: 15% of investment value'
            )}
          </li>
          <li>
            {t(
              'reports.financialImpact.implementationPeriodAssumption',
              'Implementation period: 18-24 months'
            )}
          </li>
          <li>
            {t('reports.financialImpact.benefitsStartAssumption', 'Benefits start from year 2')}
          </li>
        </ul>
      </div>
    </div>
  );
};

export default FinancialImpact;
