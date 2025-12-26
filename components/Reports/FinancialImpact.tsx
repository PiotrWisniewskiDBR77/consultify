/**
 * FinancialImpact
 * 
 * ROI calculator and financial projections section:
 * - Investment required (ranges)
 * - ROI timeline
 * - Payback period
 * - NPV/IRR estimates
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';
import {
    DollarSign,
    TrendingUp,
    Clock,
    Calculator,
    AlertCircle,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

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
        descriptionPl: 'Chmura, systemy, integracje'
    },
    {
        category: 'Training & Change Management',
        categoryPl: 'Szkolenia i Zarządzanie Zmianą',
        minAmount: 50000,
        maxAmount: 150000,
        description: 'Upskilling, workshops, communication',
        descriptionPl: 'Podnoszenie kwalifikacji, warsztaty, komunikacja'
    },
    {
        category: 'External Consulting',
        categoryPl: 'Konsulting Zewnętrzny',
        minAmount: 100000,
        maxAmount: 300000,
        description: 'Strategy, implementation support',
        descriptionPl: 'Strategia, wsparcie wdrożenia'
    },
    {
        category: 'Data & Analytics',
        categoryPl: 'Dane i Analityka',
        minAmount: 80000,
        maxAmount: 200000,
        description: 'Data platform, BI tools, AI pilots',
        descriptionPl: 'Platforma danych, narzędzia BI, piloty AI'
    },
    {
        category: 'Cybersecurity',
        categoryPl: 'Cyberbezpieczeństwo',
        minAmount: 50000,
        maxAmount: 150000,
        description: 'Security tools, audits, compliance',
        descriptionPl: 'Narzędzia bezpieczeństwa, audyty, zgodność'
    }
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
    className = ''
}) => {
    const { i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    const [showDetails, setShowDetails] = useState(false);

    const investments = customInvestments || DEFAULT_INVESTMENTS;

    // Calculate totals
    const totals = useMemo(() => {
        const minTotal = investments.reduce((sum, inv) => sum + inv.minAmount, 0);
        const maxTotal = investments.reduce((sum, inv) => sum + inv.maxAmount, 0);
        const avgTotal = (minTotal + maxTotal) / 2;

        // Estimate based on gap (more gap = more investment needed)
        const gapMultiplier = 1 + (totalGap / 20);
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
                year: `${isPolish ? 'Rok' : 'Year'} ${year}`,
                investment: -cumulativeInvestment,
                returns: cumulativeReturns,
                net: cumulativeReturns - cumulativeInvestment
            });
        }

        return data;
    }, [totals, isPolish]);

    // Calculate key metrics
    const metrics = useMemo(() => {
        const paybackYear = roiData.findIndex(d => d.net >= 0);
        const year5Net = roiData[5]?.net || 0;
        const roi = ((year5Net + totals.avgTotal) / totals.avgTotal - 1) * 100;

        return {
            paybackPeriod: paybackYear >= 0 ? `${paybackYear} ${isPolish ? 'lata' : 'years'}` : '> 5 years',
            roi5Year: Math.round(roi),
            npv: year5Net,
            monthlyBreakdown: Math.round(totals.avgTotal / 24)
        };
    }, [roiData, totals, isPolish]);

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Disclaimer */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/30">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        {isPolish ? 'Oszacowanie orientacyjne' : 'Indicative Estimates'}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        {isPolish 
                            ? 'Poniższe wartości są szacunkowe i mogą różnić się w zależności od specyfiki organizacji. Szczegółowe budżetowanie powinno być przeprowadzone w ramach planowania projektu.'
                            : 'The values below are estimates and may vary based on organization specifics. Detailed budgeting should be conducted during project planning.'
                        }
                    </p>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-3 opacity-90">
                        <DollarSign className="w-5 h-5" />
                        <span className="text-xs font-medium uppercase tracking-wider">
                            {isPolish ? 'Szacunkowa Inwestycja' : 'Est. Investment'}
                        </span>
                    </div>
                    <div className="text-2xl font-bold">
                        {formatCurrency(totals.minTotal, currency)} - {formatCurrency(totals.maxTotal, currency)}
                    </div>
                    <div className="text-xs opacity-75 mt-2">
                        {isPolish ? 'Rozłożone na 18-24 miesiące' : 'Spread over 18-24 months'}
                    </div>
                </div>

                <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
                        <Clock className="w-5 h-5" />
                        <span className="text-xs font-medium uppercase tracking-wider">
                            {isPolish ? 'Okres Zwrotu' : 'Payback Period'}
                        </span>
                    </div>
                    <div className="text-2xl font-bold text-navy-900 dark:text-white">
                        {metrics.paybackPeriod}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {isPolish ? 'Od początku wdrożenia' : 'From implementation start'}
                    </div>
                </div>

                <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-xs font-medium uppercase tracking-wider">
                            {isPolish ? 'ROI (5 lat)' : 'ROI (5 years)'}
                        </span>
                    </div>
                    <div className={`text-2xl font-bold ${metrics.roi5Year > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.roi5Year > 0 ? '+' : ''}{metrics.roi5Year}%
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {isPolish ? 'Skumulowany zwrot' : 'Cumulative return'}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-3 opacity-90">
                        <Calculator className="w-5 h-5" />
                        <span className="text-xs font-medium uppercase tracking-wider">
                            {isPolish ? 'NPV (5 lat)' : 'NPV (5 years)'}
                        </span>
                    </div>
                    <div className="text-2xl font-bold">
                        {formatCurrency(Math.abs(metrics.npv), currency)}
                    </div>
                    <div className="text-xs opacity-75 mt-2">
                        {metrics.npv >= 0 
                            ? (isPolish ? 'Dodatnia wartość netto' : 'Positive net value')
                            : (isPolish ? 'Ujemna wartość netto' : 'Negative net value')
                        }
                    </div>
                </div>
            </div>

            {/* ROI Timeline Chart */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
                <h4 className="font-semibold text-navy-900 dark:text-white mb-4">
                    {isPolish ? 'Prognoza Zwrotu z Inwestycji' : 'ROI Projection'}
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={roiData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-white/10" />
                        <XAxis 
                            dataKey="year" 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                        />
                        <YAxis 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            tickFormatter={(value) => formatCurrency(Math.abs(value), '')}
                        />
                        <Tooltip 
                            formatter={(value: number) => [formatCurrency(Math.abs(value), currency), '']}
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '12px'
                            }}
                        />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey="investment"
                            name={isPolish ? 'Inwestycja (kumulatywna)' : 'Investment (cumulative)'}
                            stroke="#ef4444"
                            fill="#fee2e2"
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="returns"
                            name={isPolish ? 'Korzyści (kumulatywne)' : 'Benefits (cumulative)'}
                            stroke="#10b981"
                            fill="#d1fae5"
                            strokeWidth={2}
                        />
                        <Line
                            type="monotone"
                            dataKey="net"
                            name={isPolish ? 'Wynik netto' : 'Net Result'}
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Investment Breakdown */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    <h4 className="font-semibold text-navy-900 dark:text-white">
                        {isPolish ? 'Podział Inwestycji' : 'Investment Breakdown'}
                    </h4>
                    {showDetails ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </button>

                {showDetails && (
                    <div className="px-6 pb-6">
                        <div className="space-y-4">
                            {investments.map((investment, index) => {
                                const percentage = ((investment.minAmount + investment.maxAmount) / 2) / totals.avgTotal * 100;

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
                                                {formatCurrency(investment.minAmount, currency)} - {formatCurrency(investment.maxAmount, currency)}
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
                                            <span>{percentage.toFixed(0)}% {isPolish ? 'budżetu' : 'of budget'}</span>
                                            <span>
                                                ~{formatCurrency(Math.round((investment.minAmount + investment.maxAmount) / 24), currency)}/{isPolish ? 'mies.' : 'mo.'}
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
                                    {isPolish ? 'RAZEM' : 'TOTAL'}
                                </span>
                                <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                    {formatCurrency(totals.minTotal, currency)} - {formatCurrency(totals.maxTotal, currency)}
                                </span>
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                {isPolish ? 'Średnio' : 'Average'}: {formatCurrency(totals.avgTotal, currency)} 
                                ({formatCurrency(metrics.monthlyBreakdown, currency)}/{isPolish ? 'miesiąc' : 'month'})
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Key assumptions */}
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-medium">{isPolish ? 'Założenia:' : 'Assumptions:'}</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>{isPolish ? 'Stopa dyskontowa: 10%' : 'Discount rate: 10%'}</li>
                    <li>{isPolish ? 'Roczne korzyści z transformacji: 15% wartości inwestycji' : 'Annual transformation benefits: 15% of investment value'}</li>
                    <li>{isPolish ? 'Okres wdrożenia: 18-24 miesiące' : 'Implementation period: 18-24 months'}</li>
                    <li>{isPolish ? 'Korzyści zaczynają się od roku 2' : 'Benefits start from year 2'}</li>
                </ul>
            </div>
        </div>
    );
};

export default FinancialImpact;

