/**
 * Initiative Side Panel
 *
 * Slide-in panel with tabbed initiative details.
 */

import {
    Activity,
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    Edit2,
    ExternalLink,
    FileText,
    Target,
    TrendingUp,
    Users,
    X,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { getAxisColor, getPriorityClasses, getStatusClasses } from '../../config/portfolioColors';
import { InitiativeStatus, PortfolioInitiative } from '../../types';

interface InitiativeSidePanelProps {
    initiative: PortfolioInitiative | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updated: PortfolioInitiative) => void;
}

type TabId = 'overview' | 'financials' | 'stakeholders' | 'risks' | 'timeline' | 'activity';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <FileText size={16} /> },
    { id: 'financials', label: 'Financials', icon: <DollarSign size={16} /> },
    { id: 'stakeholders', label: 'Stakeholders', icon: <Users size={16} /> },
    { id: 'risks', label: 'Risks', icon: <AlertTriangle size={16} /> },
    { id: 'timeline', label: 'Timeline', icon: <Calendar size={16} /> },
    { id: 'activity', label: 'Activity', icon: <Activity size={16} /> },
];

export const InitiativeSidePanel: React.FC<InitiativeSidePanelProps> = ({ initiative, isOpen, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    // Reset tab when initiative changes
    useEffect(() => {
        if (initiative) {
            setActiveTab('overview');
        }
    }, [initiative?.id]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // ============================================
    // TAB CONTENT RENDERERS
    // ============================================

    const renderOverview = () => {
        if (!initiative) return null;

        return (
            <div className="space-y-6">
                {/* Summary */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Summary</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                        {initiative.summary || 'No summary provided.'}
                    </p>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <Target size={14} />
                            Progress
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-purple-500 rounded-full"
                                    style={{ width: `${initiative.progress}%` }}
                                />
                            </div>
                            <span className="text-sm font-medium text-navy-900 dark:text-white">
                                {initiative.progress}%
                            </span>
                        </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <TrendingUp size={14} />
                            Expected ROI
                        </div>
                        <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                            {initiative.expectedRoi ? `${initiative.expectedRoi.toFixed(1)}x` : '-'}
                        </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <AlertTriangle size={14} />
                            Risk Score
                        </div>
                        <div
                            className={`text-lg font-semibold ${
                                (initiative.riskScore || 0) > 70
                                    ? 'text-red-600 dark:text-red-400'
                                    : (initiative.riskScore || 0) > 40
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-green-600 dark:text-green-400'
                            }`}
                        >
                            {initiative.riskScore || 0}/100
                        </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <CheckCircle2 size={14} />
                            Value Score
                        </div>
                        <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                            {initiative.valueScore || 0}/100
                        </div>
                    </div>
                </div>

                {/* Details */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">Details</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Axis</span>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getAxisColor(initiative.axis)}`} />
                                <span className="text-sm font-medium text-navy-900 dark:text-white capitalize">
                                    {initiative.axis.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Target Quarter</span>
                            <span className="text-sm font-medium text-navy-900 dark:text-white">
                                {initiative.targetQuarter || '-'}
                            </span>
                        </div>

                        {initiative.waveName && (
                            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5">
                                <span className="text-sm text-slate-500 dark:text-slate-400">Wave</span>
                                <span className="text-sm font-medium text-navy-900 dark:text-white">
                                    {initiative.waveName}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Dependencies</span>
                            <span className="text-sm font-medium text-navy-900 dark:text-white">
                                {initiative.dependencies?.length || 0} initiatives
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderFinancials = () => {
        if (!initiative) return null;

        return (
            <div className="space-y-6">
                {/* Budget Overview */}
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
                    <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Total Budget</div>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(initiative.budget)}
                    </div>
                </div>

                {/* Budget Breakdown */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        Budget Breakdown
                    </h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5">
                            <span className="text-sm text-slate-500 dark:text-slate-400">CapEx</span>
                            <span className="text-sm font-medium text-navy-900 dark:text-white">
                                {formatCurrency(initiative.budget)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5">
                            <span className="text-sm text-slate-500 dark:text-slate-400">OpEx (Annual)</span>
                            <span className="text-sm font-medium text-navy-900 dark:text-white">-</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Expected ROI</span>
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                {initiative.expectedRoi ? `${initiative.expectedRoi.toFixed(1)}x` : '-'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Placeholder for budget tracking */}
                <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg text-center text-sm text-slate-500 dark:text-slate-400">
                    Detailed budget tracking coming soon
                </div>
            </div>
        );
    };

    const renderStakeholders = () => {
        if (!initiative) return null;

        return (
            <div className="space-y-6">
                {/* Business Owner */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        Business Owner
                    </h4>
                    {initiative.ownerBusiness ? (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-medium text-purple-700 dark:text-purple-300 overflow-hidden">
                                {initiative.ownerBusiness.avatarUrl ? (
                                    <img
                                        src={initiative.ownerBusiness.avatarUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    `${initiative.ownerBusiness.firstName[0]}${initiative.ownerBusiness.lastName[0]}`
                                )}
                            </div>
                            <div>
                                <div className="font-medium text-navy-900 dark:text-white">
                                    {initiative.ownerBusiness.firstName} {initiative.ownerBusiness.lastName}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Business Owner</div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg text-sm text-slate-500 dark:text-slate-400 italic">
                            No business owner assigned
                        </div>
                    )}
                </div>

                {/* Execution Owner */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        Execution Owner
                    </h4>
                    {initiative.ownerExecution ? (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-medium text-blue-700 dark:text-blue-300 overflow-hidden">
                                {initiative.ownerExecution.avatarUrl ? (
                                    <img
                                        src={initiative.ownerExecution.avatarUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    `${initiative.ownerExecution.firstName[0]}${initiative.ownerExecution.lastName[0]}`
                                )}
                            </div>
                            <div>
                                <div className="font-medium text-navy-900 dark:text-white">
                                    {initiative.ownerExecution.firstName} {initiative.ownerExecution.lastName}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Execution Owner</div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg text-sm text-slate-500 dark:text-slate-400 italic">
                            No execution owner assigned
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderRisks = () => {
        return (
            <div className="space-y-6">
                {/* Risk Score */}
                <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Overall Risk Score</span>
                        <span
                            className={`text-lg font-bold ${
                                (initiative?.riskScore || 0) > 70
                                    ? 'text-red-600 dark:text-red-400'
                                    : (initiative?.riskScore || 0) > 40
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-green-600 dark:text-green-400'
                            }`}
                        >
                            {initiative?.riskScore || 0}/100
                        </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${
                                (initiative?.riskScore || 0) > 70
                                    ? 'bg-red-500'
                                    : (initiative?.riskScore || 0) > 40
                                      ? 'bg-amber-500'
                                      : 'bg-green-500'
                            }`}
                            style={{ width: `${initiative?.riskScore || 0}%` }}
                        />
                    </div>
                </div>

                {/* Placeholder for RAID items */}
                <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg text-center text-sm text-slate-500 dark:text-slate-400">
                    RAID log integration coming soon
                </div>
            </div>
        );
    };

    const renderTimeline = () => {
        if (!initiative) return null;

        return (
            <div className="space-y-6">
                {/* Timeline Overview */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <Clock size={14} />
                            Planned Start
                        </div>
                        <div className="text-sm font-medium text-navy-900 dark:text-white">
                            {formatDate(initiative.plannedStartDate)}
                        </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <CheckCircle2 size={14} />
                            Planned End
                        </div>
                        <div className="text-sm font-medium text-navy-900 dark:text-white">
                            {formatDate(initiative.plannedEndDate)}
                        </div>
                    </div>
                </div>

                {/* Target Quarter */}
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Target Quarter</div>
                    <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                        {initiative.targetQuarter || 'Not Set'}
                    </div>
                </div>

                {/* Dependencies */}
                <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        Dependencies
                    </h4>
                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg text-sm text-slate-500 dark:text-slate-400">
                        {initiative.dependencies?.length
                            ? `${initiative.dependencies.length} dependencies`
                            : 'No dependencies defined'}
                    </div>
                </div>
            </div>
        );
    };

    const renderActivity = () => {
        return (
            <div className="space-y-4">
                {/* Placeholder for activity log */}
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Activity log coming soon</p>
                </div>
            </div>
        );
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return renderOverview();
            case 'financials':
                return renderFinancials();
            case 'stakeholders':
                return renderStakeholders();
            case 'risks':
                return renderRisks();
            case 'timeline':
                return renderTimeline();
            case 'activity':
                return renderActivity();
            default:
                return null;
        }
    };

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/30 z-40 transition-opacity ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-navy-900 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {initiative && (
                    <div className="h-full flex flex-col">
                        {/* Header */}
                        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-2 h-2 rounded-full ${getAxisColor(initiative.axis)}`} />
                                        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                                            {initiative.axis.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-bold text-navy-900 dark:text-white line-clamp-2">
                                        {initiative.name}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span
                                            className={`px-2 py-0.5 text-xs font-medium rounded-lg ${getStatusClasses(initiative.status)}`}
                                        >
                                            {initiative.status}
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityClasses(initiative.priority)}`}
                                        >
                                            {initiative.priority}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
                                        <ExternalLink size={18} />
                                    </button>
                                    <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="shrink-0 px-6 py-2 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
                            <div className="flex items-center gap-1">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                                            activeTab === tab.id
                                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                                        }`}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">{renderTabContent()}</div>
                    </div>
                )}
            </div>
        </>
    );
};

export default InitiativeSidePanel;


