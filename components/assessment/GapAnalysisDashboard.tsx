/**
 * AI Gap Analysis & Initiative Generator Integration
 * Analyzes cross-framework inconsistencies and generates initiatives
 */

import React, { useState, useEffect } from 'react';
import { Target, TrendingDown, Zap, AlertCircle, PlusCircle, Activity } from 'lucide-react';
import axios from 'axios';

interface GapAnalysisDashboardProps {
    projectId: string;
    organizationId: string;
}

export const GapAnalysisDashboard: React.FC<GapAnalysisDashboardProps> = ({
    projectId,
    organizationId
}) => {
    const [overview, setOverview] = useState<any>(null);
    const [generatedInitiatives, setGeneratedInitiatives] = useState<any[]>([]);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        fetchOverview();
    }, [projectId]);

    const fetchOverview = async () => {
        try {
            const response = await axios.get(`/api/sessions/${projectId}/assessment-overview`);
            setOverview(response.data);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const generateInitiatives = async () => {
        setGenerating(true);
        try {
            // Call initiative generator service
            const response = await axios.post('/api/initiatives/generate-from-assessments', {
                projectId,
                organizationId,
                drdAssessmentId: null, // TODO: get from overview
                leanAssessmentId: null,
                externalAssessmentIds: []
            });

            setGeneratedInitiatives(response.data.initiatives || []);
            alert(`Generated ${response.data.initiatives?.length || 0} initiative drafts`);
        } catch (error) {
            console.error('Error generating initiatives:', error);
            alert('Failed to generate initiatives');
        } finally {
            setGenerating(false);
        }
    };

    if (!overview) {
        return <div className="p-6">Loading...</div>;
    }

    const hasMultipleAssessments = overview.consolidated.totalAssessments >= 2;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Target className="w-8 h-8 text-red-500" />
                Gap Analysis & Initiatives
            </h2>

            {/* Multi-Framework Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <h3 className="text-xl font-semibold mb-4">Assessment Coverage</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-lg ${overview.drd.exists ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="text-sm text-gray-600 dark:text-gray-400">DRD</div>
                        <div className="text-2xl font-bold">{overview.drd.exists ? '✓' : '—'}</div>
                    </div>
                    <div className={`p-4 rounded-lg ${overview.rapidLean.exists ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="text-sm text-gray-600 dark:text-gray-400">RapidLean</div>
                        <div className="text-2xl font-bold">{overview.rapidLean.exists ? '✓' : '—'}</div>
                    </div>
                    <div className={`p-4 rounded-lg ${overview.externalDigital.exists ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="text-sm text-gray-600 dark:text-gray-400">External</div>
                        <div className="text-2xl font-bold">{overview.externalDigital.totalCount || '—'}</div>
                    </div>
                    <div className={`p-4 rounded-lg ${overview.genericReports.exists ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Reports</div>
                        <div className="text-2xl font-bold">{overview.genericReports.totalCount || '—'}</div>
                    </div>
                </div>
            </div>

            {/* Initiative Generator */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-xl shadow-2xl p-8 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Zap className="w-6 h-6" />
                            AI Initiative Generator
                        </h3>
                        <p className="text-blue-100 mt-2">
                            {hasMultipleAssessments
                                ? 'Generate actionable initiatives from identified gaps'
                                : 'Complete at least 2 assessments to generate initiatives'}
                        </p>
                    </div>
                    <button
                        onClick={generateInitiatives}
                        disabled={!hasMultipleAssessments || generating}
                        className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                    >
                        {generating ? (
                            <>
                                <Activity className="w-5 h-5 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <PlusCircle className="w-5 h-5" />
                                Generate Initiatives
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Generated Initiatives */}
            {generatedInitiatives.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">Generated Initiative Drafts</h3>
                    <div className="space-y-4">
                        {generatedInitiatives.map((initiative, index) => (
                            <div key={index} className="border dark:border-gray-700 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-semibold text-lg">{initiative.name}</h4>
                                    <span className={`px-3 py-1 rounded-full text-sm ${initiative.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                                        initiative.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                        {initiative.priority}
                                    </span>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-3">{initiative.summary}</p>

                                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded mb-3">
                                    <div className="text-sm font-medium mb-1">Gap Justification:</div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{initiative.gap_justification}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Sources:</span>
                                    {initiative.derived_from_assessments?.map((source: any, i: number) => (
                                        <span key={i} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                                            {source.source} ({source.dimension})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
