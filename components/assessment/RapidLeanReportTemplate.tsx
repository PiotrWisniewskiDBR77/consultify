/**
 * RapidLean Report Template - DBR77 Standard Format
 * Standardized report view for RapidLean assessments
 * 
 * Sections:
 * 1. Executive Summary
 * 2. Lean Dimensions Breakdown
 * 3. Observations Summary
 * 4. DRD Integration
 * 5. Recommendations & Action Plan
 * 6. Appendix
 */

import React from 'react';
import {
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle,
    Target,
    BarChart3,
    FileText,
    Lightbulb,
    Download,
    Printer
} from 'lucide-react';

interface DimensionScore {
    name: string;
    score: number;
    benchmark: number;
    status: 'excellent' | 'good' | 'needs_improvement' | 'critical';
}

interface DRDMapping {
    axis: string;
    score: number;
    target: number;
    gap: number;
    priority: string;
}

interface Recommendation {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    area: string;
    recommendation: string;
    expectedImpact: string;
}

interface RapidLeanReportData {
    id: string;
    generatedAt: string;
    organizationName?: string;
    projectName?: string;
    summary: {
        overallScore: number;
        benchmark: number;
        topGaps: string[];
        keyFindings: string[];
    };
    dimensions: DimensionScore[];
    drdMapping: DRDMapping[];
    recommendations: Recommendation[];
    observations?: {
        template: string;
        location: string;
        findings: string[];
        photos: string[];
    }[];
}

interface RapidLeanReportTemplateProps {
    reportData: RapidLeanReportData;
    onDownloadPDF?: () => void;
    onDownloadExcel?: () => void;
    onPrint?: () => void;
}

export const RapidLeanReportTemplate: React.FC<RapidLeanReportTemplateProps> = ({
    reportData,
    onDownloadPDF,
    onDownloadExcel,
    onPrint
}) => {
    const { summary, dimensions, drdMapping, recommendations, observations } = reportData;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'excellent': return 'text-green-600 bg-green-100';
            case 'good': return 'text-blue-600 bg-blue-100';
            case 'needs_improvement': return 'text-yellow-600 bg-yellow-100';
            case 'critical': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'HIGH': return 'bg-red-500 text-white';
            case 'MEDIUM': return 'bg-yellow-500 text-white';
            case 'LOW': return 'bg-green-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 print:bg-white">
            {/* Report Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 print:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">RapidLean Assessment</h1>
                        <p className="text-blue-100 mt-1">Lean Maturity Report - DBR77 Format</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-blue-200">Generated</p>
                        <p className="font-medium">{new Date(reportData.generatedAt).toLocaleDateString('pl-PL')}</p>
                    </div>
                </div>

                {/* Action Buttons - Hide in print */}
                <div className="flex gap-2 mt-4 print:hidden">
                    {onDownloadPDF && (
                        <button
                            onClick={onDownloadPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
                        >
                            <Download className="w-4 h-4" />
                            Download PDF
                        </button>
                    )}
                    {onDownloadExcel && (
                        <button
                            onClick={onDownloadExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
                        >
                            <FileText className="w-4 h-4" />
                            Download Excel
                        </button>
                    )}
                    {onPrint && (
                        <button
                            onClick={onPrint}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>
                    )}
                </div>
            </div>

            {/* Section 1: Executive Summary */}
            <section className="p-8 border-b dark:border-gray-700 print:p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-6">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    1. Executive Summary
                </h2>

                {/* Score Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-6 text-center">
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Overall Score</p>
                        <p className={`text-5xl font-bold mt-2 ${summary.overallScore >= summary.benchmark ? 'text-green-600' : 'text-red-600'}`}>
                            {summary.overallScore.toFixed(1)}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">out of 5.0</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Industry Benchmark</p>
                        <p className="text-5xl font-bold mt-2 text-gray-700 dark:text-gray-300">{summary.benchmark.toFixed(1)}</p>
                        <p className="text-sm text-gray-500 mt-1">average</p>
                    </div>
                    <div className={`rounded-xl p-6 text-center ${summary.overallScore >= summary.benchmark ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Gap Analysis</p>
                        <p className={`text-5xl font-bold mt-2 flex items-center justify-center ${summary.overallScore >= summary.benchmark ? 'text-green-600' : 'text-red-600'}`}>
                            {summary.overallScore >= summary.benchmark ? (
                                <><TrendingUp className="w-8 h-8 mr-2" />+{(summary.overallScore - summary.benchmark).toFixed(1)}</>
                            ) : (
                                <><TrendingDown className="w-8 h-8 mr-2" />-{(summary.benchmark - summary.overallScore).toFixed(1)}</>
                            )}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">{summary.overallScore >= summary.benchmark ? 'Above benchmark' : 'Below benchmark'}</p>
                    </div>
                </div>

                {/* Top Gaps */}
                {summary.topGaps.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
                        <h3 className="font-semibold text-red-800 dark:text-red-400 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Priority Improvement Areas
                        </h3>
                        <ul className="mt-2 space-y-1">
                            {summary.topGaps.map((gap, i) => (
                                <li key={i} className="text-red-700 dark:text-red-300 text-sm">
                                    • {gap.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            {/* Section 2: Lean Dimensions Breakdown */}
            <section className="p-8 border-b dark:border-gray-700 print:p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-6">
                    <Target className="w-5 h-5 text-blue-600" />
                    2. Lean Dimensions Breakdown
                </h2>

                <div className="space-y-4">
                    {dimensions.map((dim, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-800 dark:text-white">{dim.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(dim.status)}`}>
                                        {dim.status.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                    <span className="font-bold text-lg">{dim.score.toFixed(1)}</span>
                                </div>
                            </div>
                            {/* Progress Bar */}
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${dim.status === 'excellent' ? 'bg-green-500' :
                                            dim.status === 'good' ? 'bg-blue-500' :
                                                dim.status === 'needs_improvement' ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                    style={{ width: `${(dim.score / 5) * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-gray-500">
                                <span>1 - Ad-Hoc</span>
                                <span className="text-blue-600">Benchmark: {dim.benchmark.toFixed(1)}</span>
                                <span>5 - World-Class</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Section 3: DRD Integration */}
            <section className="p-8 border-b dark:border-gray-700 print:p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-6">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    3. DRD Integration Mapping
                </h2>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    RapidLean scores mapped to Digital Roadmap Diagnostic (DRD) framework:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {drdMapping.map((mapping, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-800 dark:text-white">
                                    {mapping.axis === 'processes' ? 'DRD Axis 1 - Processes' : 'DRD Axis 5 - Culture'}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(mapping.priority)}`}>
                                    {mapping.priority}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-blue-600">{mapping.score.toFixed(1)}</span>
                                <span className="text-gray-500">/ 7.0</span>
                                <span className="text-sm text-gray-500">(Target: {mapping.target.toFixed(1)})</span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="h-full bg-blue-500"
                                    style={{ width: `${(mapping.score / 7) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Section 4: Recommendations */}
            <section className="p-8 border-b dark:border-gray-700 print:p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-6">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                    4. Recommendations & Action Plan
                </h2>

                <div className="space-y-4">
                    {recommendations.map((rec, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${getPriorityColor(rec.priority)}`}>
                                            {rec.priority}
                                        </span>
                                        <span className="font-semibold text-gray-800 dark:text-white">{rec.area}</span>
                                    </div>
                                    <p className="text-gray-700 dark:text-gray-300">{rec.recommendation}</p>
                                    {rec.expectedImpact && (
                                        <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4" />
                                            Expected Impact: {rec.expectedImpact}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 print:p-6">
                <p>RapidLean Assessment Report | DBR77 Format | © {new Date().getFullYear()} Consultify</p>
                <p className="mt-1">Report ID: {reportData.id.substring(0, 8)}</p>
            </footer>
        </div>
    );
};
