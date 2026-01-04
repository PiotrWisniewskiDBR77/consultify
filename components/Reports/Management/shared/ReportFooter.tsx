/**
 * Report Footer Component
 * PMO Standards compliance audit trail
 */

import { FileCheck, Info, Shield } from 'lucide-react';
import React from 'react';

interface ReportFooterProps {
    reportId: string;
    generatedAt: string;
    version?: string;
    pmoDomain?: string;
    iso21500Mapping?: string;
    pmbokMapping?: string;
    prince2Mapping?: string;
    dataSnapshot?: {
        projectsIncluded?: number;
        tasksAnalyzed?: number;
        initiativesAnalyzed?: number;
        decisionsAnalyzed?: number;
        risksAnalyzed?: number;
        dataAsOf?: string;
    };
    className?: string;
}

export const ReportFooter: React.FC<ReportFooterProps> = ({
    reportId,
    generatedAt,
    version = '1.0',
    pmoDomain = 'PERFORMANCE_MONITORING',
    iso21500Mapping = 'Project Performance Measurement (Clause 4.4.22)',
    pmbokMapping = 'Measurement Performance Domain',
    prince2Mapping = 'Highlight Report / Progress Theme',
    dataSnapshot,
    className = '',
}) => {
    return (
        <div
            className={`bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-slate-200 dark:border-white/10 p-4 ${className}`}
        >
            {/* Standards Compliance Header */}
            <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-violet-500" />
                <span className="text-sm font-semibold text-navy-900 dark:text-white">PMO Standards Compliance</span>
            </div>

            {/* Standards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-start gap-2">
                    <FileCheck size={14} className="text-blue-500 mt-0.5" />
                    <div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                            ISO 21500:2021
                        </span>
                        <span className="text-xs text-navy-900 dark:text-white">{iso21500Mapping}</span>
                    </div>
                </div>
                <div className="flex items-start gap-2">
                    <FileCheck size={14} className="text-green-500 mt-0.5" />
                    <div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                            PMBOK 7th Edition
                        </span>
                        <span className="text-xs text-navy-900 dark:text-white">{pmbokMapping}</span>
                    </div>
                </div>
                <div className="flex items-start gap-2">
                    <FileCheck size={14} className="text-amber-500 mt-0.5" />
                    <div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">PRINCE2</span>
                        <span className="text-xs text-navy-900 dark:text-white">{prince2Mapping}</span>
                    </div>
                </div>
            </div>

            {/* Data Snapshot */}
            {dataSnapshot && (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200 dark:border-white/10">
                    <Info size={14} className="text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        Data analyzed: {dataSnapshot.projectsIncluded || 0} projects, {dataSnapshot.tasksAnalyzed || 0}{' '}
                        tasks, {dataSnapshot.initiativesAnalyzed || 0} initiatives,{' '}
                        {dataSnapshot.decisionsAnalyzed || 0} decisions, {dataSnapshot.risksAnalyzed || 0} risks
                    </span>
                </div>
            )}

            {/* Report Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span>
                    Report ID: <code className="px-1 py-0.5 bg-slate-200 dark:bg-navy-700 rounded">{reportId}</code>
                </span>
                <span>Version: {version}</span>
                <span>Domain: {pmoDomain}</span>
                <span>Generated: {new Date(generatedAt).toLocaleString()}</span>
            </div>
        </div>
    );
};

export default ReportFooter;


