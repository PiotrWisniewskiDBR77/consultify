/**
 * RapidLean Results Display
 */

import React from 'react';
import { TrendingUp, Trash2, Layers, CheckCircle, RefreshCw, Eye, Award, Target, BarChart3, Link } from 'lucide-react';

interface RapidLeanResultsCardProps {
    assessment: {
        id: string;
        value_stream_score: number;
        waste_elimination_score: number;
        flow_pull_score: number;
        quality_source_score: number;
        continuous_improvement_score: number;
        visual_management_score: number;
        overall_score: number;
        industry_benchmark: number;
        top_gaps: string[];
        ai_recommendations?: any[];
        drdMapping?: Record<string, number>;
        observationsCount?: number;
    };
}

const DIMENSION_ICONS: Record<string, any> = {
    value_stream: TrendingUp,
    waste_elimination: Trash2,
    flow_pull: Layers,
    quality_source: CheckCircle,
    continuous_improvement: RefreshCw,
    visual_management: Eye
};

const DIMENSION_NAMES: Record<string, string> = {
    value_stream: 'Value Stream',
    waste_elimination: 'Waste Elimination',
    flow_pull: 'Flow & Pull',
    quality_source: 'Quality at Source',
    continuous_improvement: 'Continuous Improvement',
    visual_management: 'Visual Management'
};

export const RapidLeanResultsCard: React.FC<RapidLeanResultsCardProps> = ({ assessment }) => {
    const gap = assessment.industry_benchmark - assessment.overall_score;
    const scorePercentage = (assessment.overall_score / 5) * 100;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Award className="w-6 h-6 text-yellow-500" />
                    RapidLean Assessment Results
                </h3>
                <div className="text-right">
                    <p className="text-3xl font-bold text-blue-500">{assessment.overall_score.toFixed(1)}</p>
                    <p className="text-sm text-gray-500">/ 5.0</p>
                </div>
            </div>

            {/* Overall Score Bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Lean Maturity</span>
                    <span className="text-sm text-gray-500">{scorePercentage.toFixed(0)}%</span>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                        style={{ width: `${scorePercentage}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">Benchmark: {assessment.industry_benchmark.toFixed(1)}</span>
                    <span className={`text-xs font-medium ${gap > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {gap > 0 ? `Gap: -${gap.toFixed(1)}` : `Ahead: +${Math.abs(gap).toFixed(1)}`}
                    </span>
                </div>
            </div>

            {/* Dimension Scores */}
            <div className="space-y-3 mb-6">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Dimension Breakdown</h4>
                {Object.keys(DIMENSION_ICONS).map(dimension => {
                    const score = assessment[`${dimension}_score` as keyof typeof assessment] as number;
                    const Icon = DIMENSION_ICONS[dimension];
                    const percentage = (score / 5) * 100;

                    return (
                        <div key={dimension} className="flex items-center gap-3">
                            <Icon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium">{DIMENSION_NAMES[dimension]}</span>
                                    <span className="text-sm text-gray-600">{score.toFixed(1)}</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${score >= 4 ? 'bg-green-500' :
                                                score >= 3 ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                            }`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Top Gaps */}
            {assessment.top_gaps && assessment.top_gaps.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-6">
                    <h4 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4" />
                        Priority Improvement Areas
                    </h4>
                    <ul className="space-y-1">
                        {assessment.top_gaps.map((gap, index) => (
                            <li key={index} className="text-sm text-red-600 dark:text-red-300">
                                • {DIMENSION_NAMES[gap] || gap}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* DRD Mapping Section */}
            {assessment.drdMapping && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-4 mb-6">
                    <h4 className="font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4" />
                        DRD Maturity Mapping
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        RapidLean scores mapped to DRD maturity levels (1-7 scale)
                    </p>
                    <div className="space-y-2">
                        {Object.entries(assessment.drdMapping).map(([axis, level]: [string, any]) => (
                            <div key={axis} className="flex items-center justify-between">
                                <span className="text-sm font-medium capitalize">
                                    DRD Axis {axis === 'processes' ? '1' : axis === 'culture' ? '5' : axis}: {axis}
                                </span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-500 transition-all"
                                            style={{ width: `${(level / 7) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-semibold text-purple-600 w-12 text-right">
                                        {level.toFixed(1)}/7
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {assessment.observationsCount && assessment.observationsCount > 0 && (
                        <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                            <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                <Link className="w-3 h-3" />
                                Based on {assessment.observationsCount} production floor observations
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* AI Recommendations */}
            {assessment.ai_recommendations && assessment.ai_recommendations.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">
                        💡 AI Recommendations
                    </h4>
                    <div className="space-y-3">
                        {assessment.ai_recommendations.slice(0, 3).map((rec, index) => (
                            <div key={index} className="text-sm">
                                <p className="font-medium text-gray-800 dark:text-white">
                                    {rec.dimension}: {rec.recommendation}
                                </p>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    Expected Impact: {rec.expectedImpact}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
