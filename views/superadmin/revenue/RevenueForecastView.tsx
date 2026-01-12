import React, { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/BaseCard';
import { Api } from '../../../services/api';

interface RevenueForecast {
    id: string;
    forecast_type: 'monthly' | 'quarterly' | 'yearly';
    period_start: string;
    period_end: string;
    forecasted_amount: number;
    currency: string;
    confidence_level: number;
    method: 'linear' | 'exponential' | 'moving_average' | 'ml_based';
    input_data_json: string;
    created_at: string;
    updated_at: string;
}

interface ForecastStats {
    totalForecasts: number;
    averageConfidence: number;
    nextQuarterForecast: number;
    yearlyForecast: number;
    forecastMethods: { method: string; count: number }[];
}

export const RevenueForecastView: React.FC = () => {
    const [forecasts, setForecasts] = useState<RevenueForecast[]>([]);
    const [stats, setStats] = useState<ForecastStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [generating, setGenerating] = useState(false);

    const [generateParams, setGenerateParams] = useState({
        forecast_type: 'quarterly',
        method: 'linear',
        periods: 4,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [forecastsRes, statsRes] = await Promise.all([
                Api.getRevenueForecasts(),
                Api.getRevenueForecastStats(),
            ]);
            setForecasts(forecastsRes || []);
            setStats(statsRes);
        } catch (err: any) {
            setError(err.message || 'Failed to load revenue forecasts');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateForecast = async () => {
        try {
            setGenerating(true);
            await Api.generateRevenueForecast({
                forecastType: generateParams.forecast_type,
                periodMonths: generateParams.periods,
            });
            await fetchData();
            setShowGenerateModal(false);
        } catch (err: any) {
            setError(err.message || 'Failed to generate forecast');
        } finally {
            setGenerating(false);
        }
    };

    const handleDeleteForecast = async (id: string) => {
        if (!confirm('Are you sure you want to delete this forecast?')) return;
        try {
            await Api.deleteRevenueForecast(id);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Failed to delete forecast');
        }
    };

    const formatCurrency = (amount: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    const getMethodBadge = (method: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            linear: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Linear' },
            exponential: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Exponential' },
            moving_average: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Moving Average' },
            ml_based: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'ML-Based' },
        };
        const badge = badges[method] || { bg: 'bg-gray-500/20', text: 'text-gray-400', label: method };
        return <span className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>;
    };

    const getTypeBadge = (type: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            monthly: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
            quarterly: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
            yearly: { bg: 'bg-green-500/20', text: 'text-green-400' },
        };
        const badge = badges[type] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
        return (
            <span className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text}`}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
        );
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return 'text-green-400';
        if (confidence >= 0.6) return 'text-yellow-400';
        return 'text-red-400';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Revenue Forecasting</h2>
                    <p className="text-gray-400 mt-1">
                        Generate and analyze revenue predictions using multiple methods
                    </p>
                </div>
                <button
                    onClick={() => setShowGenerateModal(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    Generate Forecast
                </button>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
                    {error}
                    <button onClick={() => setError(null)} className="float-right text-red-300 hover:text-red-100">
                        ×
                    </button>
                </div>
            )}

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-white">{stats.totalForecasts}</div>
                            <div className="text-sm text-gray-400">Total Forecasts</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-xl font-bold text-green-400">
                                {formatCurrency(stats.nextQuarterForecast || 0)}
                            </div>
                            <div className="text-sm text-gray-400">Next Quarter</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-xl font-bold text-blue-400">
                                {formatCurrency(stats.yearlyForecast || 0)}
                            </div>
                            <div className="text-sm text-gray-400">Yearly Forecast</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className={`text-2xl font-bold ${getConfidenceColor(stats.averageConfidence || 0)}`}>
                                {Math.round((stats.averageConfidence || 0) * 100)}%
                            </div>
                            <div className="text-sm text-gray-400">Avg. Confidence</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Forecast Chart Placeholder */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                    <CardTitle className="text-white">Revenue Forecast Trend</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex items-center justify-center bg-gray-900/50 rounded-lg">
                        {/* Chart visualization would go here */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-end gap-2 h-32">
                                {forecasts.slice(0, 8).map((forecast, index) => (
                                    <div
                                        key={forecast.id}
                                        className="w-12 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-300"
                                        style={{
                                            height: `${Math.min(100, (forecast.forecasted_amount / (Math.max(...forecasts.map((f) => f.forecasted_amount)) || 1)) * 100)}%`,
                                            opacity: 0.6 + index * 0.05,
                                        }}
                                        title={`${forecast.forecast_type}: ${formatCurrency(forecast.forecasted_amount, forecast.currency)}`}
                                    />
                                ))}
                            </div>
                            <div className="text-sm text-gray-400">
                                {forecasts.length > 0
                                    ? 'Revenue forecast trend by period'
                                    : 'No forecast data available'}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Forecasts Table */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                    <CardTitle className="text-white">Forecast History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Period</th>
                                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Type</th>
                                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Method</th>
                                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Forecast</th>
                                    <th className="text-center py-3 px-4 text-gray-400 font-medium">Confidence</th>
                                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Created</th>
                                    <th className="text-center py-3 px-4 text-gray-400 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {forecasts.map((forecast) => (
                                    <tr key={forecast.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                        <td className="py-3 px-4">
                                            <span className="text-white">
                                                {new Date(forecast.period_start).toLocaleDateString()} -{' '}
                                                {new Date(forecast.period_end).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">{getTypeBadge(forecast.forecast_type)}</td>
                                        <td className="py-3 px-4">{getMethodBadge(forecast.method)}</td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="text-white font-medium">
                                                {formatCurrency(forecast.forecasted_amount, forecast.currency)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-16 bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full ${
                                                            forecast.confidence_level >= 0.8
                                                                ? 'bg-green-500'
                                                                : forecast.confidence_level >= 0.6
                                                                  ? 'bg-yellow-500'
                                                                  : 'bg-red-500'
                                                        }`}
                                                        style={{ width: `${forecast.confidence_level * 100}%` }}
                                                    />
                                                </div>
                                                <span
                                                    className={`text-sm ${getConfidenceColor(forecast.confidence_level)}`}
                                                >
                                                    {Math.round(forecast.confidence_level * 100)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-gray-400 text-sm">
                                            {new Date(forecast.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <button
                                                onClick={() => handleDeleteForecast(forecast.id)}
                                                className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {forecasts.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                            No forecasts generated yet. Click "Generate Forecast" to create your first prediction.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Generate Modal */}
            {showGenerateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Generate Revenue Forecast</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Forecast Type</label>
                                <select
                                    value={generateParams.forecast_type}
                                    onChange={(e) =>
                                        setGenerateParams({ ...generateParams, forecast_type: e.target.value })
                                    }
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                >
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Forecast Method</label>
                                <select
                                    value={generateParams.method}
                                    onChange={(e) => setGenerateParams({ ...generateParams, method: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                >
                                    <option value="linear">Linear Regression</option>
                                    <option value="exponential">Exponential Smoothing</option>
                                    <option value="moving_average">Moving Average</option>
                                    <option value="ml_based">Machine Learning</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Periods to Forecast
                                </label>
                                <input
                                    type="number"
                                    value={generateParams.periods}
                                    onChange={(e) =>
                                        setGenerateParams({ ...generateParams, periods: parseInt(e.target.value) })
                                    }
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                    min="1"
                                    max="24"
                                />
                            </div>

                            {/* Method Description */}
                            <div className="p-3 bg-gray-900/50 rounded-lg text-sm text-gray-400">
                                {generateParams.method === 'linear' && (
                                    <p>
                                        Linear regression fits a straight line to historical data, best for stable
                                        growth patterns.
                                    </p>
                                )}
                                {generateParams.method === 'exponential' && (
                                    <p>
                                        Exponential smoothing gives more weight to recent data, good for trending data.
                                    </p>
                                )}
                                {generateParams.method === 'moving_average' && (
                                    <p>Moving average smooths out fluctuations, best for volatile data.</p>
                                )}
                                {generateParams.method === 'ml_based' && (
                                    <p>
                                        Machine learning uses advanced algorithms for complex patterns and multiple
                                        variables.
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setShowGenerateModal(false)}
                                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                                    disabled={generating}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGenerateForecast}
                                    disabled={generating}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {generating ? 'Generating...' : 'Generate'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RevenueForecastView;

