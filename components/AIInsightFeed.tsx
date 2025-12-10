import React, { useEffect, useState } from 'react';
import { FullSession } from '../types';
import { Agent } from '../services/ai/agent';
import { Lightbulb, AlertTriangle, TrendingUp, Sparkles, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface AIInsightFeedProps {
    session: FullSession;
}

interface Insight {
    type: 'risk' | 'opportunity' | 'anomaly';
    text: string;
    impact: string;
}

export const AIInsightFeed: React.FC<AIInsightFeedProps> = ({ session }) => {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(false);
    const { currentUser } = useAppStore();

    const generateInsights = async () => {
        setLoading(true);
        try {
            // Call the Agent to analyze the full session state
            const results = await Agent.analyzeSessionForInsights(session, currentUser?.companyName || 'Client');
            setInsights(results);
        } catch (e) {
            console.error("Failed to generate insights", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Generate on mount if empty
        if (insights.length === 0) {
            generateInsights();
        }
    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case 'risk': return <AlertTriangle className="text-red-500" size={18} />;
            case 'opportunity': return <TrendingUp className="text-green-500" size={18} />;
            case 'anomaly': return <Lightbulb className="text-amber-500" size={18} />;
            default: return <Sparkles className="text-blue-500" size={18} />;
        }
    };

    const getBg = (type: string) => {
        switch (type) {
            case 'risk': return 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30';
            case 'opportunity': return 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30';
            default: return 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30';
        }
    };

    return (
        <div className="bg-white dark:bg-navy-800 rounded-xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-bold text-navy-900 dark:text-white">AI Strategy Watch</h3>
                </div>
                <button
                    onClick={generateInsights}
                    disabled={loading}
                    className={`p-1.5 rounded hover:bg-white dark:hover:bg-white/10 text-slate-500 transition-all ${loading ? 'animate-spin' : ''}`}
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {loading && insights.length === 0 ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-slate-100 dark:bg-white/5 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : (
                    insights.map((insight, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${getBg(insight.type)} flex gap-3`}>
                            <div className="mt-0.5 shrink-0">{getIcon(insight.type)}</div>
                            <div>
                                <p className="text-sm font-medium text-navy-900 dark:text-white leading-snug">
                                    {insight.text}
                                </p>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                        Impact: {insight.impact}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {!loading && insights.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                        No critical alerts at this time.
                    </div>
                )}
            </div>
        </div>
    );
};
