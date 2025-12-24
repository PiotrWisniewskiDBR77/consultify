/**
 * Benchmark Comparison Component
 * Shows "Your score vs. industry average"
 */

import React from 'react';
import { TrendingUp, TrendingDown, Award } from 'lucide-react';

interface BenchmarkComparisonProps {
    score: number;
    benchmarkScore: number;
    dimension?: string;
    percentile?: number;
}

export const BenchmarkComparison: React.FC<BenchmarkComparisonProps> = ({
    score,
    benchmarkScore,
    dimension = 'Overall',
    percentile
}) => {
    const delta = score - benchmarkScore;
    const deltaPercentage = ((delta / benchmarkScore) * 100).toFixed(1);
    const isAbove = delta > 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">{dimension}</h4>
                {percentile && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${percentile >= 75 ? 'bg-green-100 text-green-700' :
                            percentile >= 50 ? 'bg-blue-100 text-blue-700' :
                                percentile >= 25 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                        }`}>
                        {percentile >= 90 ? 'Top 10%' :
                            percentile >= 75 ? 'Top 25%' :
                                percentile >= 50 ? 'Above Avg' :
                                    percentile >= 25 ? 'Below Avg' : 'Bottom 25%'}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                    <div className="text-xs text-gray-500 mb-1">Your Score</div>
                    <div className="text-2xl font-bold text-blue-600">{score.toFixed(1)}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-500 mb-1">Industry Avg</div>
                    <div className="text-2xl font-bold text-gray-600">{benchmarkScore.toFixed(1)}</div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {isAbove ? (
                    <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                )}
                <span className={`text-sm font-medium ${isAbove ? 'text-green-600' : 'text-red-600'}`}>
                    {isAbove ? '+' : ''}{deltaPercentage}% vs. benchmark
                </span>
            </div>

            {/* Visual Bar */}
            <div className="mt-3 relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className="absolute h-full bg-gray-400 dark:bg-gray-500"
                    style={{ width: `${(benchmarkScore / 7) * 100}%` }}
                />
                <div
                    className={`absolute h-full ${isAbove ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${(score / 7) * 100}%` }}
                />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>1.0</span>
                <span>7.0</span>
            </div>
        </div>
    );
};
