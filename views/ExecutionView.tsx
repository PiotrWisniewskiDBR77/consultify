/**
 * ExecutionView - Full KPI Monitoring & Corrective Actions
 *
 * PMO Execution Phase Management
 *
 * Standards Compliance:
 * - ISO 21500:2021 - Performance Monitoring, Benefits Realization
 * - PMI PMBOK 7th Edition - Measure & Control, Earned Value
 * - PRINCE2 - Controlling a Stage, Benefits Reviews
 *
 * PMO Domains: PERFORMANCE_MONITORING, BENEFITS_REALIZATION
 */

import { AlertTriangle, BarChart3, CalendarDays, FileText, Target, TrendingUp } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BenefitsTracker } from '../components/Execution/BenefitsTracker';
import { CorrectiveActions } from '../components/Execution/CorrectiveActions';
import { KPIDashboard } from '../components/Execution/KPIDashboard';

type ExecutionTab = 'kpis' | 'actions' | 'benefits' | 'monthly';

export const ExecutionView: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<ExecutionTab>('kpis');

    const renderContent = () => {
        switch (activeTab) {
            case 'kpis':
                return <KPIDashboard projectId="default" />;
            case 'actions':
                return <CorrectiveActions projectId="default" />;
            case 'benefits':
                return <BenefitsTracker projectId="default" />;
            case 'monthly':
                return renderMonthlyReport();
            default:
                return null;
        }
    };

    const renderMonthlyReport = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <CalendarDays className="text-blue-500" size={24} />
                        Monthly Performance Report
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        December 2024 - Transformation Program
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select className="px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm">
                        <option value="2024-12">December 2024</option>
                        <option value="2024-11">November 2024</option>
                        <option value="2024-10">October 2024</option>
                    </select>
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        <FileText size={16} />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Executive Summary */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
                <h4 className="text-lg font-bold mb-4">Executive Summary</h4>
                <div className="grid grid-cols-4 gap-6">
                    <div>
                        <div className="text-3xl font-bold">88%</div>
                        <div className="text-sm opacity-80">Overall Health</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold">12/14</div>
                        <div className="text-sm opacity-80">KPIs On Target</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold">320k</div>
                        <div className="text-sm opacity-80">Benefits Realized (PLN)</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold">2</div>
                        <div className="text-sm opacity-80">Open Actions</div>
                    </div>
                </div>
            </div>

            {/* Key Highlights */}
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
                    <h4 className="font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-green-500" />
                        Key Achievements
                    </h4>
                    <ul className="space-y-3">
                        <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mt-0.5 shrink-0">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                            Process Efficiency KPI exceeded target by 5%
                        </li>
                        <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mt-0.5 shrink-0">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                            GDPR compliance achieved 100%
                        </li>
                        <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mt-0.5 shrink-0">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                            3 initiatives successfully completed
                        </li>
                    </ul>
                </div>

                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
                    <h4 className="font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-amber-500" />
                        Attention Required
                    </h4>
                    <ul className="space-y-3">
                        <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mt-0.5 shrink-0">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                            </div>
                            User Adoption below target - corrective action in progress
                        </li>
                        <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mt-0.5 shrink-0">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                            </div>
                            Budget variance at 8% - mitigation required
                        </li>
                        <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mt-0.5 shrink-0">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                            </div>
                            1 corrective action overdue
                        </li>
                    </ul>
                </div>
            </div>

            {/* Trend Charts Placeholder */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
                <h4 className="font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 size={18} className="text-blue-500" />
                    Performance Trends
                </h4>
                <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-white/10 rounded-lg">
                    <div className="text-center">
                        <BarChart3 size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Monthly KPI trend charts</p>
                        <p className="text-sm">(Interactive charts coming soon)</p>
                    </div>
                </div>
            </div>

            {/* Next Month Focus */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-6">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                    <Target size={18} />
                    January 2025 Focus Areas
                </h4>
                <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-400">
                    <li>• Increase user adoption training sessions (target: +15%)</li>
                    <li>• Complete Phase 2 scope reduction to address budget variance</li>
                    <li>• Launch BI Dashboard initiative pilot</li>
                    <li>• Q1 benefits review preparation</li>
                </ul>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
            {/* Header */}
            <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
                                <TrendingUp size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
                                    Execution Monitoring
                                </h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Track KPIs, corrective actions, and benefits realization
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-1 rounded">
                                ISO 21500 | PMBOK 7 | PRINCE2
                            </span>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-1">
                        {[
                            { id: 'kpis' as ExecutionTab, label: 'KPI Dashboard', icon: BarChart3 },
                            { id: 'actions' as ExecutionTab, label: 'Corrective Actions', icon: AlertTriangle },
                            { id: 'benefits' as ExecutionTab, label: 'Benefits Tracker', icon: TrendingUp },
                            { id: 'monthly' as ExecutionTab, label: 'Monthly Report', icon: CalendarDays },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                                }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">{renderContent()}</div>
        </div>
    );
};

export default ExecutionView;





