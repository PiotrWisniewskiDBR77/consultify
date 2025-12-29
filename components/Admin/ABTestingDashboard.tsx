/**
 * ABTestingDashboard Component
 * 
 * Super Admin dashboard for managing A/B testing experiments on AI prompts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Beaker,
    Plus,
    Play,
    Square,
    BarChart3,
    TrendingUp,
    Users,
    CheckCircle,
    XCircle,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Trophy,
    AlertCircle
} from 'lucide-react';
import { Button } from '../Button';
import api from '../../services/api';

interface Variant {
    index: number;
    name: string;
    sampleSize: number;
    outcomeCount: number;
    mean: number;
}

interface ExperimentAnalysis {
    isSignificant: boolean;
    zScore: number;
    requiredZ: number;
    controlMean: number;
    treatmentMean: number;
    lift: number;
    winner: number | null;
    message: string;
}

interface Experiment {
    id: string;
    name: string;
    description?: string;
    prompt_id: string;
    variants: any[];
    traffic_split: number[];
    min_sample_size: number;
    confidence_level: number;
    primary_metric: string;
    status: 'draft' | 'running' | 'stopped' | 'completed';
    stop_reason?: string;
    created_at: string;
    started_at?: string;
    ended_at?: string;
}

interface ExperimentStats {
    experiment: Experiment;
    variants: Variant[];
    analysis: ExperimentAnalysis;
    totalSamples: number;
    minSampleSize: number;
}

const STATUS_COLORS = {
    draft: 'bg-gray-100 text-gray-700',
    running: 'bg-green-100 text-green-700',
    stopped: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700'
};

const STATUS_LABELS = {
    draft: 'Szkic',
    running: 'Aktywny',
    stopped: 'Zatrzymany',
    completed: 'Zakończony'
};

export function ABTestingDashboard() {
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedExperiment, setSelectedExperiment] = useState<ExperimentStats | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState<string>('all');

    const fetchExperiments = useCallback(async () => {
        setLoading(true);
        try {
            const params = filter !== 'all' ? `?status=${filter}` : '';
            const response = await api.get(`/ai-ab-testing/experiments${params}`);
            if (response.data.success) {
                setExperiments(response.data.data || []);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchExperiments();
    }, [fetchExperiments]);

    const fetchExperimentStats = async (experimentId: string) => {
        try {
            const response = await api.get(`/ai-ab-testing/experiments/${experimentId}`);
            if (response.data.success) {
                setSelectedExperiment(response.data.data);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const startExperiment = async (experimentId: string) => {
        try {
            await api.post(`/ai-ab-testing/experiments/${experimentId}/start`);
            await fetchExperiments();
            if (selectedExperiment?.experiment.id === experimentId) {
                await fetchExperimentStats(experimentId);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const stopExperiment = async (experimentId: string) => {
        try {
            await api.post(`/ai-ab-testing/experiments/${experimentId}/stop`, { reason: 'manual' });
            await fetchExperiments();
            if (selectedExperiment?.experiment.id === experimentId) {
                await fetchExperimentStats(experimentId);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const filteredExperiments = experiments.filter(e => {
        if (filter === 'all') return true;
        return e.status === filter;
    });

    return (
        <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Beaker className="w-8 h-8 text-purple-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            A/B Testing
                        </h1>
                        <p className="text-sm text-gray-500">
                            Eksperymenty na promptach AI
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchExperiments}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Odśwież
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nowy eksperyment
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Wszystkie</span>
                        <Beaker className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {experiments.length}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Aktywne</span>
                        <Play className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                        {experiments.filter(e => e.status === 'running').length}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Zakończone</span>
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                        {experiments.filter(e => e.status === 'completed').length}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Ze zwycięzcą</span>
                        <Trophy className="w-5 h-5 text-yellow-500" />
                    </div>
                    <p className="text-2xl font-bold text-yellow-600 mt-1">
                        {experiments.filter(e => e.stop_reason === 'significant_result').length}
                    </p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                {['all', 'running', 'draft', 'completed', 'stopped'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filter === status
                                ? 'bg-purple-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        {status === 'all' ? 'Wszystkie' : STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                    </button>
                ))}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Experiments List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Nazwa
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Warianty
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Próbki
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Utworzono
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Akcje
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : filteredExperiments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        Brak eksperymentów
                                    </td>
                                </tr>
                            ) : (
                                filteredExperiments.map(exp => (
                                    <tr 
                                        key={exp.id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                        onClick={() => fetchExperimentStats(exp.id)}
                                    >
                                        <td className="px-4 py-4">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {exp.name}
                                                </p>
                                                {exp.description && (
                                                    <p className="text-sm text-gray-500 truncate max-w-xs">
                                                        {exp.description}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[exp.status]}`}>
                                                {STATUS_LABELS[exp.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                                            {exp.variants?.length || 2} warianty
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                                            {exp.min_sample_size} min
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                                            {new Date(exp.created_at).toLocaleDateString('pl-PL')}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                {exp.status === 'draft' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => startExperiment(exp.id)}
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {exp.status === 'running' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => stopExperiment(exp.id)}
                                                    >
                                                        <Square className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => fetchExperimentStats(exp.id)}
                                                >
                                                    <BarChart3 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Experiment Details Modal */}
            {selectedExperiment && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {selectedExperiment.experiment.name}
                                    </h2>
                                    <span className={`mt-1 inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedExperiment.experiment.status]}`}>
                                        {STATUS_LABELS[selectedExperiment.experiment.status]}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSelectedExperiment(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Progress */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-500">Postęp</span>
                                    <span className="text-gray-900 dark:text-white font-medium">
                                        {selectedExperiment.totalSamples} / {selectedExperiment.minSampleSize} próbek
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-purple-600 rounded-full transition-all"
                                        style={{ 
                                            width: `${Math.min(100, (selectedExperiment.totalSamples / selectedExperiment.minSampleSize) * 100)}%` 
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Variants */}
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                                    Warianty
                                </h3>
                                <div className="space-y-3">
                                    {selectedExperiment.variants.map(variant => (
                                        <div 
                                            key={variant.index}
                                            className={`p-4 rounded-lg border ${
                                                selectedExperiment.analysis.winner === variant.index
                                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                                    : 'border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium">
                                                    {variant.name}
                                                    {selectedExperiment.analysis.winner === variant.index && (
                                                        <Trophy className="w-4 h-4 inline ml-2 text-yellow-500" />
                                                    )}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {variant.sampleSize} próbek
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Wyniki</span>
                                                    <p className="font-medium">{variant.outcomeCount}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Średnia</span>
                                                    <p className="font-medium">{variant.mean?.toFixed(3) || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Konwersja</span>
                                                    <p className="font-medium">
                                                        {variant.sampleSize > 0 
                                                            ? `${((variant.outcomeCount / variant.sampleSize) * 100).toFixed(1)}%`
                                                            : '-'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Analysis */}
                            <div className={`p-4 rounded-lg ${
                                selectedExperiment.analysis.isSignificant
                                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200'
                                    : 'bg-gray-50 dark:bg-gray-700'
                            }`}>
                                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                                    Analiza statystyczna
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {selectedExperiment.analysis.message}
                                </p>
                                {selectedExperiment.analysis.lift !== 0 && (
                                    <p className="mt-2 text-sm">
                                        <span className="text-gray-500">Lift: </span>
                                        <span className={selectedExperiment.analysis.lift > 0 ? 'text-green-600' : 'text-red-600'}>
                                            {selectedExperiment.analysis.lift > 0 ? '+' : ''}{selectedExperiment.analysis.lift.toFixed(1)}%
                                        </span>
                                    </p>
                                )}
                                <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-gray-500">
                                    <div>Z-Score: {selectedExperiment.analysis.zScore}</div>
                                    <div>Wymagany Z: {selectedExperiment.analysis.requiredZ}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                            {selectedExperiment.experiment.status === 'draft' && (
                                <Button 
                                    variant="primary"
                                    onClick={() => startExperiment(selectedExperiment.experiment.id)}
                                >
                                    <Play className="w-4 h-4 mr-2" />
                                    Uruchom
                                </Button>
                            )}
                            {selectedExperiment.experiment.status === 'running' && (
                                <Button 
                                    variant="outline"
                                    onClick={() => stopExperiment(selectedExperiment.experiment.id)}
                                >
                                    <Square className="w-4 h-4 mr-2" />
                                    Zatrzymaj
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => setSelectedExperiment(null)}>
                                Zamknij
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ABTestingDashboard;

