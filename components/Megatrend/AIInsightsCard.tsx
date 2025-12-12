// components/Megatrend/AIInsightsCard.tsx
// Card 5: AI Insights & Recommendations
// Shows top critical megatrends, risks, opportunities, and actionable next steps.
// -----------------------------------------------------------------------------

import React, { useMemo } from 'react';
import { MegatrendDetail } from './TrendDetailCard';
import { ArrowRight, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';

interface AIInsightsCardProps {
    megatrends: MegatrendDetail[]; // The full list to analyze
    loading?: boolean;
}

export const AIInsightsCard: React.FC<AIInsightsCardProps> = ({ megatrends, loading }) => {

    // Derived analytics from the full list
    const analytics = useMemo(() => {
        if (!megatrends.length) return null;

        // Top 5 Critical: Highest impact score, filtered for "impact now" or "watch closely" usually
        const critical = [...megatrends]
            .sort((a, b) => b.impactScore - a.impactScore)
            .slice(0, 5);

        // Risks: Typically Business/Societal with high "Competitive pressure" or "Unavoidability"
        // Heuristic: Business/Societal type + high score
        const risks = megatrends
            .filter(m => m.type !== 'Technology')
            .sort((a, b) => b.impactScore - a.impactScore)
            .slice(0, 3);

        // Opportunities: Typically Technology type
        const opportunities = megatrends
            .filter(m => m.type === 'Technology')
            .sort((a, b) => b.impactScore - a.impactScore)
            .slice(0, 3);

        return { critical, risks, opportunities };
    }, [megatrends]);

    if (loading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Analyzing strategic landscape...</div>;
    }

    if (!analytics) {
        return <div className="p-8 text-center text-slate-500">No data available for analysis.</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header / Context */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl p-6 text-white shadow-lg">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <SparklesIcon /> Strategic AI Synthesis
                </h2>
                <p className="mt-2 text-purple-100 max-w-2xl">
                    By analyzing {megatrends.length} global megatrends against your industry profile,
                    I've identified the following priority areas for your 3-5 year roadmap.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. Critical Megatrends */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-slate-100 dark:border-white/5 col-span-1 md:col-span-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-red-500" size={20} />
                        Top 5 Critical Megatrends (3-5 Years)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                        {analytics.critical.map(trend => (
                            <div key={trend.id} className="bg-slate-50 dark:bg-navy-900 p-3 rounded-lg border border-slate-200 dark:border-white/10">
                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">{trend.type}</div>
                                <div className="font-bold text-sm text-navy-900 dark:text-gray-100 leading-tight mb-2 h-10 overflow-hidden">
                                    {trend.label}
                                </div>
                                <div className="flex items-center gap-1 text-xs font-bold text-purple-600">
                                    Impact: {trend.impactScore}/7
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Top External Risks */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-slate-100 dark:border-white/5">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-orange-500" size={20} />
                        Top 3 External Risks
                    </h3>
                    <ul className="space-y-3">
                        {analytics.risks.map(risk => (
                            <li key={risk.id} className="flex items-start gap-3">
                                <span className="bg-orange-100 text-orange-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">!</span>
                                <div>
                                    <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{risk.label}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Pressure: {risk.competitivePressure || 'High'}</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* 3. Top Opportunities */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-slate-100 dark:border-white/5">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="text-green-500" size={20} />
                        Top 3 Strategic Opportunities
                    </h3>
                    <ul className="space-y-3">
                        {analytics.opportunities.map(opp => (
                            <li key={opp.id} className="flex items-start gap-3">
                                <span className="bg-green-100 text-green-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">✓</span>
                                <div>
                                    <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{opp.label}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Potential: High Value</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* 4. Recommended Actions */}
            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-6 border border-purple-100 dark:border-white/5">
                <h3 className="text-lg font-bold text-purple-900 dark:text-purple-300 mb-4 flex items-center gap-2">
                    <CheckCircle size={20} />
                    Recommended Next Steps
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ActionCard
                        title="Run a Pilot"
                        desc="Start a low-cost PoC for 'Digital Twin' in the assembly line to test ROI."
                        label="Immediate"
                    />
                    <ActionCard
                        title="Strategic Review"
                        desc="Schedule a workshop to address 'Workforce Shortages' via automation."
                        label="Q3 2025"
                    />
                    <ActionCard
                        title="Monitor Watchlist"
                        desc="Set up automated alerts for 'Carbon Tax' regulation changes."
                        label="Ongoing"
                    />
                </div>
            </div>
        </div>
    );
};

// Helper for UI icons
const SparklesIcon = () => (
    <svg className="w-6 h-6 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
    </svg>
);

const ActionCard = ({ title, desc, label }: { title: string, desc: string, label: string }) => (
    <div className="bg-white dark:bg-navy-800 p-4 rounded-lg shadow-sm border border-purple-100 dark:border-white/5 flex flex-col justify-between">
        <div>
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-navy-900 dark:text-white">{title}</h4>
                <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded">{label}</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{desc}</p>
        </div>
        <button className="mt-4 text-xs font-bold text-purple-600 flex items-center gap-1 hover:underline">
            Add to Roadmap <ArrowRight size={12} />
        </button>
    </div>
);
