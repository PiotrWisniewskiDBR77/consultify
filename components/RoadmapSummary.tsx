import React from 'react';
import { AlertTriangle, Lightbulb, Map } from 'lucide-react';

interface RoadmapSummaryProps {
    summary: {
        summaryText: string;
        riskText: string; // The biggest structural risk
        recommendation: string; // Final advice
    };
    isLoading?: boolean;
}

export const RoadmapSummary: React.FC<RoadmapSummaryProps> = ({ summary, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/5 rounded-xl p-6 shadow-sm animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-1/3 mb-4"></div>
                <div className="space-y-2">
                    <div className="h-3 bg-slate-100 dark:bg-navy-700 rounded w-full"></div>
                    <div className="h-3 bg-slate-100 dark:bg-navy-700 rounded w-5/6"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-white to-slate-50 dark:from-navy-800 dark:to-navy-900 border border-slate-200 dark:border-white/5 rounded-xl p-5 shadow-sm relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

            <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500">
                    <Map size={16} />
                </div>
                Strategic Roadmap Summary (AI)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {/* 1. Logic / Narrative */}
                <div className="md:col-span-2 space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {summary.summaryText || "No summary available. Add initiatives to generate a strategic outlook."}
                    </p>
                </div>

                {/* 2. Risks & Recommendations */}
                <div className="space-y-4 border-l border-slate-200 dark:border-white/5 pl-6">
                    {summary.riskText && (
                        <div>
                            <span className="text-xs font-bold text-amber-500 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                                <AlertTriangle size={12} /> Key Risk
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {summary.riskText}
                            </p>
                        </div>
                    )}

                    {summary.recommendation && (
                        <div>
                            <span className="text-xs font-bold text-blue-500 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                                <Lightbulb size={12} /> Recommendation
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {summary.recommendation}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
