// components/Megatrend/IndustryBaselineCard.tsx
// Card 1: Industry Baseline
// ---------------------------------------------------------------
// Shows the default megatrends for the selected industry.
// Controlled component that accepts industry prop.
// ---------------------------------------------------------------

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { MegatrendDetail } from './TrendDetailCard';

interface IndustryBaselineCardProps {
    industry: string;
    megatrends: MegatrendDetail[];
    loading?: boolean;
    error?: string | null;
    onTrendSelect: (trendId: string) => void;
}

export const IndustryBaselineCard: React.FC<IndustryBaselineCardProps> = ({ industry, megatrends, loading, error, onTrendSelect }) => {

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg flex items-start gap-3 border border-blue-100 dark:border-white/5">
                <Sparkles className="text-blue-600 mt-1" size={18} />
                <div>
                    <h4 className="font-bold text-blue-900 dark:text-blue-300">Industry Standard Trends: {industry.charAt(0).toUpperCase() + industry.slice(1)}</h4>
                    <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                        Below are the top megatrends affecting your industry globally.
                        AI has prioritized these based on market signals and your context.
                    </p>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-12 text-slate-500 animate-pulse">
                    Loading industry baseline...
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-100 text-red-600 rounded">
                    Error loading baseline: {error}
                </div>
            )}

            {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {megatrends.map((trend) => (
                        <div key={trend.id} className="p-5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-500/30 transition-all duration-200 group relative overflow-hidden">
                            {/* Accent Bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${trend.type === 'Technology' ? 'bg-blue-500' :
                                trend.type === 'Business' ? 'bg-purple-500' : 'bg-orange-500'
                                }`}></div>

                            <div className="flex justify-between items-start mb-2 pl-3">
                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${trend.type === 'Technology' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                    trend.type === 'Business' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                        'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                    }`}>
                                    {trend.type}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded ${trend.impactScore >= 6 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300' :
                                    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                    Impact: {trend.impactScore}/7
                                </span>
                            </div>

                            <h3 className="font-bold text-navy-900 dark:text-white text-lg pl-3 mb-2 group-hover:text-purple-500 transition-colors">
                                {trend.label}
                            </h3>

                            <p className="text-xs text-slate-500 dark:text-slate-400 pl-3 mb-4 line-clamp-2">
                                {trend.shortDescription}
                            </p>

                            <div
                                className="pl-3 mt-auto flex items-center gap-2 text-xs font-bold text-purple-600 hover:text-purple-700 cursor-pointer"
                                onClick={() => onTrendSelect(trend.id)}
                            >
                                See Strategic Impact <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
