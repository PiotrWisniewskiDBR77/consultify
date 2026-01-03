/**
 * BenefitsTracker Component
 * 
 * PMO Benefits Realization Tracking
 * 
 * Standards Compliance:
 * - ISO 21500:2021 - Benefits Realization (Clause 4.6)
 * - PMI PMBOK 7th Edition - Benefits Management
 * - PRINCE2 - Benefits Review
 * 
 * PMO Domain: BENEFITS_REALIZATION
 */

import React, { useState } from 'react';
import {
    TrendingUp,
    DollarSign,
    Clock,
    Users,
    CheckCircle2,
    Target,
    Calendar,
    BarChart3,
    PieChart
} from 'lucide-react';

export type BenefitStatus = 'PLANNED' | 'PARTIALLY_REALIZED' | 'FULLY_REALIZED' | 'NOT_ACHIEVED';
export type BenefitType = 'FINANCIAL' | 'EFFICIENCY' | 'QUALITY' | 'STRATEGIC' | 'COMPLIANCE';

export interface Benefit {
    id: string;
    name: string;
    description: string;
    type: BenefitType;
    status: BenefitStatus;
    targetValue: number;
    currentValue: number;
    unit: string;
    targetDate: string;
    linkedInitiativeId?: string;
    linkedInitiativeName?: string;
    measurementCriteria: string;
}

interface BenefitsTrackerProps {
    projectId: string;
    benefits?: Benefit[];
}

const STATUS_CONFIG: Record<BenefitStatus, { color: string; bgColor: string; label: string }> = {
    PLANNED: { 
        color: 'text-slate-600', 
        bgColor: 'bg-slate-100 dark:bg-slate-800', 
        label: 'Planned'
    },
    PARTIALLY_REALIZED: { 
        color: 'text-amber-600', 
        bgColor: 'bg-amber-100 dark:bg-amber-900/20', 
        label: 'Partial'
    },
    FULLY_REALIZED: { 
        color: 'text-green-600', 
        bgColor: 'bg-green-100 dark:bg-green-900/20', 
        label: 'Achieved'
    },
    NOT_ACHIEVED: { 
        color: 'text-red-600', 
        bgColor: 'bg-red-100 dark:bg-red-900/20', 
        label: 'Not Achieved'
    }
};

const TYPE_CONFIG: Record<BenefitType, { icon: React.ElementType; color: string }> = {
    FINANCIAL: { icon: DollarSign, color: 'text-green-500' },
    EFFICIENCY: { icon: Clock, color: 'text-blue-500' },
    QUALITY: { icon: CheckCircle2, color: 'text-purple-500' },
    STRATEGIC: { icon: Target, color: 'text-amber-500' },
    COMPLIANCE: { icon: Users, color: 'text-cyan-500' }
};

export const BenefitsTracker: React.FC<BenefitsTrackerProps> = ({
    projectId,
    benefits = []
}) => {
    const [selectedType, setSelectedType] = useState<'all' | BenefitType>('all');

    // Mock benefits
    const [localBenefits] = useState<Benefit[]>([
        {
            id: 'ben-1',
            name: 'Cost Reduction from Automation',
            description: 'Annual cost savings from automated processes',
            type: 'FINANCIAL',
            status: 'PARTIALLY_REALIZED',
            targetValue: 500000,
            currentValue: 320000,
            unit: 'PLN',
            targetDate: '2025-06-30',
            linkedInitiativeName: 'Digital Process Automation',
            measurementCriteria: 'Total annual OpEx reduction in automated departments'
        },
        {
            id: 'ben-2',
            name: 'Process Cycle Time Reduction',
            description: 'Reduction in average process completion time',
            type: 'EFFICIENCY',
            status: 'FULLY_REALIZED',
            targetValue: 40,
            currentValue: 45,
            unit: '%',
            targetDate: '2024-12-31',
            linkedInitiativeName: 'Workflow Optimization',
            measurementCriteria: 'Average time from request to completion'
        },
        {
            id: 'ben-3',
            name: 'Customer Satisfaction Improvement',
            description: 'Increase in NPS score',
            type: 'QUALITY',
            status: 'PARTIALLY_REALIZED',
            targetValue: 50,
            currentValue: 42,
            unit: 'NPS',
            targetDate: '2025-03-31',
            measurementCriteria: 'Quarterly NPS survey results'
        },
        {
            id: 'ben-4',
            name: 'Data-Driven Decision Making',
            description: 'Percentage of decisions backed by analytics',
            type: 'STRATEGIC',
            status: 'PLANNED',
            targetValue: 80,
            currentValue: 35,
            unit: '%',
            targetDate: '2025-09-30',
            linkedInitiativeName: 'BI Dashboard Implementation',
            measurementCriteria: 'Audit of management decisions with data evidence'
        },
        {
            id: 'ben-5',
            name: 'GDPR Compliance Rate',
            description: 'Compliance with data protection requirements',
            type: 'COMPLIANCE',
            status: 'FULLY_REALIZED',
            targetValue: 100,
            currentValue: 100,
            unit: '%',
            targetDate: '2024-06-30',
            measurementCriteria: 'Internal audit results'
        }
    ]);

    const filteredBenefits = selectedType === 'all' 
        ? localBenefits 
        : localBenefits.filter(b => b.type === selectedType);

    // Calculate totals
    const totalFinancialTarget = localBenefits
        .filter(b => b.type === 'FINANCIAL')
        .reduce((sum, b) => sum + b.targetValue, 0);
    const totalFinancialCurrent = localBenefits
        .filter(b => b.type === 'FINANCIAL')
        .reduce((sum, b) => sum + b.currentValue, 0);

    const stats = {
        total: localBenefits.length,
        achieved: localBenefits.filter(b => b.status === 'FULLY_REALIZED').length,
        partial: localBenefits.filter(b => b.status === 'PARTIALLY_REALIZED').length,
        planned: localBenefits.filter(b => b.status === 'PLANNED').length,
        avgRealization: Math.round(
            localBenefits.reduce((sum, b) => {
                const rate = b.targetValue > 0 ? (b.currentValue / b.targetValue) * 100 : 0;
                return sum + Math.min(rate, 100);
            }, 0) / localBenefits.length
        )
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="text-green-500" size={24} />
                        Benefits Realization
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Track transformation benefits and ROI
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                    <div className="text-sm opacity-80 mb-1">Financial Benefits</div>
                    <div className="text-2xl font-bold">
                        {(totalFinancialCurrent / 1000).toFixed(0)}k PLN
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                        of {(totalFinancialTarget / 1000).toFixed(0)}k target
                    </div>
                </div>
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Avg. Realization</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.avgRealization}%
                    </div>
                </div>
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Benefits Achieved</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {stats.achieved} / {stats.total}
                    </div>
                </div>
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">In Progress</div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {stats.partial}
                    </div>
                </div>
            </div>

            {/* Type Filter */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                {(['all', 'FINANCIAL', 'EFFICIENCY', 'QUALITY', 'STRATEGIC', 'COMPLIANCE'] as const).map(type => {
                    const config = type !== 'all' ? TYPE_CONFIG[type] : null;
                    return (
                        <button
                            key={type}
                            onClick={() => setSelectedType(type)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                selectedType === type
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                            }`}
                        >
                            {config && <config.icon size={14} className={config.color} />}
                            {type === 'all' ? 'All Types' : type.charAt(0) + type.slice(1).toLowerCase()}
                        </button>
                    );
                })}
            </div>

            {/* Benefits Cards */}
            <div className="space-y-4">
                {filteredBenefits.map(benefit => {
                    const statusConfig = STATUS_CONFIG[benefit.status];
                    const typeConfig = TYPE_CONFIG[benefit.type];
                    const TypeIcon = typeConfig.icon;
                    const realizationPercent = benefit.targetValue > 0 
                        ? Math.round((benefit.currentValue / benefit.targetValue) * 100) 
                        : 0;
                    const isOverAchieved = realizationPercent > 100;

                    return (
                        <div
                            key={benefit.id}
                            className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-5"
                        >
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-lg ${typeConfig.color} bg-opacity-10 flex items-center justify-center`}>
                                        <TypeIcon size={20} className={typeConfig.color} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-navy-900 dark:text-white">
                                                {benefit.name}
                                            </h4>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            {benefit.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Target Date */}
                                <div className="text-right shrink-0">
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <Calendar size={12} />
                                        Target: {new Date(benefit.targetDate).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            {/* Progress Section */}
                            <div className="flex items-center gap-6">
                                {/* Current vs Target */}
                                <div className="flex-1">
                                    <div className="flex items-end justify-between mb-2">
                                        <div>
                                            <span className="text-2xl font-bold text-navy-900 dark:text-white">
                                                {benefit.type === 'FINANCIAL' 
                                                    ? `${(benefit.currentValue / 1000).toFixed(0)}k`
                                                    : benefit.currentValue
                                                }
                                            </span>
                                            <span className="text-sm text-slate-400 ml-1">{benefit.unit}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm text-slate-500">
                                                Target: {benefit.type === 'FINANCIAL' 
                                                    ? `${(benefit.targetValue / 1000).toFixed(0)}k`
                                                    : benefit.targetValue
                                                } {benefit.unit}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="h-3 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                isOverAchieved ? 'bg-green-500' : 
                                                realizationPercent >= 80 ? 'bg-green-500' :
                                                realizationPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${Math.min(realizationPercent, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Percentage Circle */}
                                <div className="w-20 h-20 relative shrink-0">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle
                                            cx="40"
                                            cy="40"
                                            r="35"
                                            stroke="currentColor"
                                            strokeWidth="6"
                                            fill="transparent"
                                            className="text-slate-100 dark:text-navy-800"
                                        />
                                        <circle
                                            cx="40"
                                            cy="40"
                                            r="35"
                                            stroke="currentColor"
                                            strokeWidth="6"
                                            fill="transparent"
                                            strokeDasharray={`${Math.min(realizationPercent, 100) * 2.2} 220`}
                                            className={
                                                isOverAchieved ? 'text-green-500' : 
                                                realizationPercent >= 80 ? 'text-green-500' :
                                                realizationPercent >= 50 ? 'text-amber-500' : 'text-red-500'
                                            }
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-lg font-bold ${
                                            isOverAchieved ? 'text-green-600' : 
                                            realizationPercent >= 80 ? 'text-green-600' :
                                            realizationPercent >= 50 ? 'text-amber-600' : 'text-red-600'
                                        }`}>
                                            {realizationPercent}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    <strong>Measurement:</strong> {benefit.measurementCriteria}
                                </div>
                                {benefit.linkedInitiativeName && (
                                    <span className="text-xs text-purple-500">
                                        Initiative: {benefit.linkedInitiativeName}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};






