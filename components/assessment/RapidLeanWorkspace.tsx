/**
 * RapidLean Assessment Workspace - DBR77 Format
 * Production floor observation-based assessment
 * Follows DRD principles: diagnosis, not questionnaire
 * Maps to DRD Axes 1 (Processes) and 5 (Culture)
 * 
 * Sprint 4 Enhancements:
 * - Assessment history dashboard with trend analysis
 * - Quick actions (Start New, Continue, View Reports)
 * - Comparison with previous assessments
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    TrendingUp, CheckCircle, Camera, MapPin, Clock,
    FileText, Download, Save, Play, BarChart3, Target, Award, AlertCircle,
    History, RefreshCw, ChevronRight, ArrowUpRight, ArrowDownRight, Minus,
    Calendar, User, Zap, ClipboardList, ArrowLeft
} from 'lucide-react';
import { RAPID_LEAN_OBSERVATION_TEMPLATES, ObservationTemplate } from '../../data/rapidLeanObservationTemplates';
import { RapidLeanObservationForm } from './RapidLeanObservationForm';
import { RapidLeanResultsCard } from './RapidLeanResultsCard';
import axios from 'axios';

interface RapidLeanWorkspaceProps {
    projectId?: string;
    organizationId: string;
}

interface AssessmentHistoryItem {
    id: string;
    created_at: string;
    overall_score: number;
    assessment_type?: 'quick' | 'full';
    dimension_scores?: Record<string, number>;
}

type WorkspaceView = 'overview' | 'observation' | 'results' | 'report' | 'history';

export const RapidLeanWorkspace: React.FC<RapidLeanWorkspaceProps> = ({
    projectId,
    organizationId
}) => {
    const { t } = useTranslation();
    const [currentView, setCurrentView] = useState<WorkspaceView>('overview');
    const [currentTemplateIndex, setCurrentTemplateIndex] = useState(0);
    const [observations, setObservations] = useState<any[]>([]);
    const [assessment, setAssessment] = useState<any>(null);
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Assessment history state
    const [assessmentHistory, setAssessmentHistory] = useState<AssessmentHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);

    // Check for draft on mount
    useEffect(() => {
        const draft = localStorage.getItem('rapidlean_wizard_draft');
        setHasDraft(!!draft);
    }, []);

    // Load existing assessment and history if available
    useEffect(() => {
        loadExistingAssessment();
        loadAssessmentHistory();
    }, [projectId, organizationId]);

    const loadExistingAssessment = async () => {
        if (!projectId) return;

        try {
            const response = await axios.get(`/api/rapidlean/project/${projectId}`);
            if (response.data && response.data.assessments && response.data.assessments.length > 0) {
                const latest = response.data.assessments[0];
                const fullAssessment = await axios.get(`/api/rapidlean/${latest.id}`);
                setAssessment(fullAssessment.data.assessment);
            }
        } catch (error) {
            // No existing assessment - this is fine
        }
    };

    const loadAssessmentHistory = async () => {
        if (!projectId && !organizationId) return;

        setHistoryLoading(true);
        try {
            const url = projectId
                ? `/api/rapidlean/project/${projectId}`
                : `/api/rapidlean/organization/${organizationId}`;
            const response = await axios.get(url);
            if (response.data && response.data.assessments) {
                setAssessmentHistory(response.data.assessments);
            }
        } catch (error) {
            console.error('Failed to load assessment history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Calculate trend compared to previous assessment
    const getTrend = (current: number, previous?: number) => {
        if (previous === undefined) return null;
        const diff = current - previous;
        if (diff > 0.2) return { direction: 'up', value: diff };
        if (diff < -0.2) return { direction: 'down', value: Math.abs(diff) };
        return { direction: 'stable', value: 0 };
    };

    const handleStartObservation = () => {
        setCurrentView('observation');
        setCurrentTemplateIndex(0);
        setObservations([]);
        setError(null);
    };

    const handleContinueDraft = () => {
        // The draft will be picked up automatically by the RapidLeanWizard
        setCurrentView('observation');
    };

    const handleViewAssessment = async (assessmentId: string) => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/rapidlean/${assessmentId}`);
            setAssessment(response.data.assessment);
            setCurrentView('results');
        } catch (error: any) {
            setError('Failed to load assessment');
        } finally {
            setLoading(false);
        }
    };

    const handleObservationComplete = async (observationData: any) => {
        setObservations(prev => [...prev, observationData]);

        // If all templates completed, generate assessment
        if (currentTemplateIndex === RAPID_LEAN_OBSERVATION_TEMPLATES.length - 1) {
            await generateAssessment();
        } else {
            setCurrentTemplateIndex(prev => prev + 1);
        }
    };

    const generateAssessment = async () => {
        setLoading(true);
        setError(null);

        try {
            // Prepare FormData for file upload
            const formData = new FormData();

            // Add all photos from observations
            observations.forEach((obs, obsIndex) => {
                obs.photos?.forEach((photo: string, photoIndex: number) => {
                    // Convert data URL to blob if needed
                    if (photo.startsWith('data:')) {
                        fetch(photo)
                            .then(res => res.blob())
                            .then(blob => {
                                formData.append('photos', blob, `obs_${obsIndex}_photo_${photoIndex}.jpg`);
                            });
                    }
                });
            });

            // Add observations data
            formData.append('projectId', projectId || '');
            formData.append('observations', JSON.stringify(observations));

            const response = await axios.post('/api/rapidlean/observations', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setAssessment(response.data.assessment);
            setReport(response.data.report);
            setCurrentView('results');
        } catch (error: any) {
            console.error('Error generating assessment:', error);
            setError(error.response?.data?.error || 'Failed to generate assessment');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!assessment) return;

        setLoading(true);
        try {
            const response = await axios.post(`/api/rapidlean/${assessment.id}/report`, {
                format: 'pdf',
                template: 'detailed',
                includeCharts: true
            });

            setReport(response.data);
            setCurrentView('report');
        } catch (error: any) {
            console.error('Error generating report:', error);
            setError(error.response?.data?.error || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    // OVERVIEW VIEW - Entry point with Dashboard
    if (currentView === 'overview') {
        const latestAssessment = assessmentHistory[0];
        const previousAssessment = assessmentHistory[1];
        const trend = latestAssessment && previousAssessment
            ? getTrend(latestAssessment.overall_score, previousAssessment.overall_score)
            : null;

        return (
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header - DBR77 Format */}
                <div className="mb-8 flex items-start justify-between">
                    <div>
                        <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
                            <TrendingUp className="w-10 h-10 text-green-500" />
                            RapidLean Assessment
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                            Production floor observation-based Lean maturity assessment
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <Target className="w-4 h-4" />
                                Maps to DRD: Axis 1 (Processes) & Axis 5 (Culture)
                            </span>
                        </div>
                    </div>
                    {/* History Toggle */}
                    <button
                        onClick={() => setCurrentView('history')}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                        <History className="w-4 h-4" />
                        View History ({assessmentHistory.length})
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <p className="text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    </div>
                )}

                {/* Quick Actions Panel */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        Quick Actions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Continue Draft */}
                        {hasDraft && (
                            <button
                                onClick={handleContinueDraft}
                                className="p-4 border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors text-left"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <RefreshCw className="w-5 h-5 text-yellow-600" />
                                    <span className="font-semibold text-gray-900 dark:text-white">Continue Draft</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Resume your unfinished assessment
                                </p>
                            </button>
                        )}

                        {/* Start New - Quick */}
                        <button
                            onClick={handleStartObservation}
                            className="p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-5 h-5 text-blue-500" />
                                <span className="font-semibold text-gray-900 dark:text-white">Quick Assessment</span>
                                <span className="text-xs text-gray-500 ml-auto">15-20 min</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                18 questions for rapid maturity evaluation
                            </p>
                        </button>

                        {/* Start New - Full */}
                        <button
                            onClick={handleStartObservation}
                            className="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <ClipboardList className="w-5 h-5 text-green-500" />
                                <span className="font-semibold text-gray-900 dark:text-white">Full Observation</span>
                                <span className="text-xs text-gray-500 ml-auto">60-90 min</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Gemba Walk with photo documentation
                            </p>
                        </button>

                        {/* View Latest Results */}
                        {assessment && (
                            <button
                                onClick={() => setCurrentView('results')}
                                className="p-4 border-2 border-purple-200 dark:border-purple-800 rounded-lg hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left group"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <BarChart3 className="w-5 h-5 text-purple-500" />
                                    <span className="font-semibold text-gray-900 dark:text-white">View Results</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    See latest assessment results
                                </p>
                            </button>
                        )}
                    </div>
                </div>

                {/* Latest Assessment Summary (if exists) */}
                {latestAssessment && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold flex items-center gap-2">
                                <Award className="w-5 h-5 text-yellow-500" />
                                Latest Assessment
                            </h3>
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(latestAssessment.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-8">
                            {/* Score Display */}
                            <div className="text-center">
                                <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">
                                    {latestAssessment.overall_score.toFixed(1)}
                                </div>
                                <div className="text-sm text-gray-500">/ 5.0</div>
                            </div>
                            {/* Trend Indicator */}
                            {trend && (
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${trend.direction === 'up' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                    trend.direction === 'down' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                    }`}>
                                    {trend.direction === 'up' && <ArrowUpRight className="w-5 h-5" />}
                                    {trend.direction === 'down' && <ArrowDownRight className="w-5 h-5" />}
                                    {trend.direction === 'stable' && <Minus className="w-5 h-5" />}
                                    <span className="font-medium">
                                        {trend.direction === 'stable' ? 'Stable' : `${trend.value.toFixed(1)} ${trend.direction === 'up' ? 'improvement' : 'regression'}`}
                                    </span>
                                </div>
                            )}
                            {/* Quick Action */}
                            <button
                                onClick={() => handleViewAssessment(latestAssessment.id)}
                                className="ml-auto px-4 py-2 text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                                View Details
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* DRD Context Card */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        DRD Integration
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        RapidLean observations will be automatically mapped to DRD maturity levels:
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-medium">DRD Axis 1:</span> Digital Processes
                            <ul className="list-disc list-inside ml-2 mt-1 text-gray-600 dark:text-gray-400">
                                <li>Process Standardization (1A)</li>
                                <li>Performance Measurement (1B)</li>
                                <li>Flow Optimization (1C)</li>
                            </ul>
                        </div>
                        <div>
                            <span className="font-medium">DRD Axis 5:</span> Organizational Culture
                            <ul className="list-disc list-inside ml-2 mt-1 text-gray-600 dark:text-gray-400">
                                <li>Continuous Improvement (5A)</li>
                                <li>Visual Management (5B)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // HISTORY VIEW - Assessment History Dashboard
    if (currentView === 'history') {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-3xl font-bold flex items-center gap-2">
                        <History className="w-8 h-8 text-blue-500" />
                        Assessment History
                    </h2>
                    <button
                        onClick={() => setCurrentView('overview')}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Overview
                    </button>
                </div>

                {historyLoading ? (
                    <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                        <p className="mt-2 text-gray-500">Loading history...</p>
                    </div>
                ) : assessmentHistory.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                        <Award className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                            No Assessments Yet
                        </h3>
                        <p className="text-gray-500 mb-6">
                            Start your first RapidLean assessment to begin tracking your Lean maturity.
                        </p>
                        <button
                            onClick={handleStartObservation}
                            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                            Start First Assessment
                        </button>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {assessmentHistory.map((item, index) => {
                                    const prevItem = assessmentHistory[index + 1];
                                    const itemTrend = prevItem ? getTrend(item.overall_score, prevItem.overall_score) : null;

                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-900 dark:text-white">
                                                        {new Date(item.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs rounded-full ${item.assessment_type === 'quick'
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                    }`}>
                                                    {item.assessment_type === 'quick' ? 'Quick' : 'Full'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                    {item.overall_score.toFixed(1)}
                                                </span>
                                                <span className="text-sm text-gray-500"> / 5.0</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {itemTrend ? (
                                                    <span className={`flex items-center gap-1 text-sm ${itemTrend.direction === 'up' ? 'text-green-600' :
                                                        itemTrend.direction === 'down' ? 'text-red-600' :
                                                            'text-gray-500'
                                                        }`}>
                                                        {itemTrend.direction === 'up' && <ArrowUpRight className="w-4 h-4" />}
                                                        {itemTrend.direction === 'down' && <ArrowDownRight className="w-4 h-4" />}
                                                        {itemTrend.direction === 'stable' && <Minus className="w-4 h-4" />}
                                                        {itemTrend.value > 0 ? `+${itemTrend.value.toFixed(1)}` : itemTrend.value.toFixed(1)}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => handleViewAssessment(item.id)}
                                                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    // OBSERVATION VIEW - Mobile-friendly form
    if (currentView === 'observation') {
        const currentTemplate = RAPID_LEAN_OBSERVATION_TEMPLATES[currentTemplateIndex];

        return (
            <div className="h-full">
                <RapidLeanObservationForm
                    template={currentTemplate}
                    templateIndex={currentTemplateIndex}
                    totalTemplates={RAPID_LEAN_OBSERVATION_TEMPLATES.length}
                    onComplete={handleObservationComplete}
                    onCancel={() => setCurrentView('overview')}
                />
            </div>
        );
    }

    // RESULTS VIEW - Assessment results with DRD mapping
    if (currentView === 'results' && assessment) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-3xl font-bold flex items-center gap-2">
                        <Award className="w-8 h-8 text-yellow-500" />
                        RapidLean Assessment Results
                    </h2>
                    <button
                        onClick={handleGenerateReport}
                        disabled={loading}
                        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 disabled:opacity-50"
                    >
                        <Download className="w-5 h-5" />
                        {loading ? 'Generating...' : 'Generate Report'}
                    </button>
                </div>

                {/* RapidLean Results */}
                <RapidLeanResultsCard assessment={assessment} />

                {/* DRD Mapping Section */}
                {assessment.drdMapping && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-6">
                        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <BarChart3 className="w-6 h-6" />
                            DRD Maturity Mapping
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Based on RapidLean observations, suggested DRD maturity levels:
                        </p>

                        <div className="space-y-4">
                            {Object.entries(assessment.drdMapping).map(([axis, level]: [string, any]) => (
                                <div key={axis} className="border-l-4 border-blue-500 pl-4">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium capitalize">
                                            DRD Axis {axis === 'processes' ? '1' : axis === 'culture' ? '5' : axis}: {axis}
                                        </span>
                                        <span className="text-2xl font-bold text-blue-600">
                                            {level.toFixed(1)} / 7.0
                                        </span>
                                    </div>
                                    <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all"
                                            style={{ width: `${(level / 7) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recommendations */}
                {assessment.ai_recommendations && assessment.ai_recommendations.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-6">
                        <h3 className="text-xl font-semibold mb-4">AI Recommendations</h3>
                        <div className="space-y-3">
                            {assessment.ai_recommendations.map((rec: any, index: number) => (
                                <div key={index} className="border-l-4 border-green-500 pl-4 py-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold capitalize">{rec.dimension}</span>
                                        <span className={`px-2 py-1 text-xs rounded ${rec.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {rec.priority} Priority
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{rec.recommendation}</p>
                                    {rec.expectedImpact && (
                                        <p className="text-xs text-gray-500 mt-1">Expected Impact: {rec.expectedImpact}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // REPORT VIEW
    if (currentView === 'report' && report) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-3xl font-bold">RapidLean Assessment Report</h2>
                    <a
                        href={report.fileUrl}
                        download
                        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                    >
                        <Download className="w-5 h-5" />
                        Download PDF
                    </a>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <p className="text-gray-600">Report generated successfully. Download PDF to view full report.</p>
                </div>
            </div>
        );
    }

    return null;
};

