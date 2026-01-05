/**
 * EcosystemAnalytics Component
 *
 * Displays partner ecosystem metrics with PMO domain visualization
 * Aligned with ISO 21500 / PMBOK 7 / PRINCE2
 */

import {
    Activity,
    Award,
    BarChart3,
    CheckCircle2,
    DollarSign,
    Globe,
    Network,
    Shield,
    Target,
    TrendingUp,
    Users,
} from 'lucide-react';
import React, { useMemo } from 'react';

import { PartnerEcosystemMetrics, PMODomainId, PMOStandardsMapping } from '../../views/partner/types';

interface EcosystemAnalyticsProps {
    metrics: PartnerEcosystemMetrics | null;
    complianceScore: number;
    loading?: boolean;
}

const TIER_COLORS: Record<string, string> = {
    BRONZE: 'from-amber-600 to-amber-800',
    SILVER: 'from-slate-400 to-slate-600',
    GOLD: 'from-yellow-400 to-amber-500',
    PLATINUM: 'from-slate-300 to-slate-500',
};

const TIER_LABELS: Record<string, string> = {
    BRONZE: 'Bronze Partner',
    SILVER: 'Silver Partner',
    GOLD: 'Gold Partner',
    PLATINUM: 'Platinum Partner',
};

const PMO_DOMAIN_INFO: Record<PMODomainId, { label: string; icon: React.ReactNode; color: string }> = {
    GOVERNANCE_DECISION_MAKING: {
        label: 'Governance',
        icon: <Shield size={14} />,
        color: 'bg-purple-500',
    },
    SCOPE_CHANGE_CONTROL: {
        label: 'Scope Control',
        icon: <Target size={14} />,
        color: 'bg-blue-500',
    },
    SCHEDULE_MILESTONES: {
        label: 'Schedule',
        icon: <Activity size={14} />,
        color: 'bg-emerald-500',
    },
    RISK_ISSUE_MANAGEMENT: {
        label: 'Risk Mgmt',
        icon: <Shield size={14} />,
        color: 'bg-red-500',
    },
    RESOURCE_RESPONSIBILITY: {
        label: 'Resources',
        icon: <Users size={14} />,
        color: 'bg-orange-500',
    },
    PERFORMANCE_MONITORING: {
        label: 'Performance',
        icon: <BarChart3 size={14} />,
        color: 'bg-indigo-500',
    },
    BENEFITS_REALIZATION: {
        label: 'Benefits',
        icon: <TrendingUp size={14} />,
        color: 'bg-teal-500',
    },
};

export const PMODomainBadge: React.FC<{ mapping: PMOStandardsMapping; showTooltip?: boolean }> = ({
    mapping,
    showTooltip = true,
}) => {
    const domainInfo = PMO_DOMAIN_INFO[mapping.domain];

    return (
        <div className="group relative inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
            <span className={`h-2 w-2 rounded-full ${domainInfo.color}`} />
            {domainInfo.label}

            {showTooltip && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-navy-900 p-3 text-left text-xs text-white shadow-xl group-hover:block dark:bg-slate-800">
                    <div className="mb-2 font-semibold">{domainInfo.label}</div>
                    <div className="space-y-1 text-slate-300">
                        <div>
                            <span className="text-slate-400">ISO 21500:</span> {mapping.iso21500}
                        </div>
                        <div>
                            <span className="text-slate-400">PMBOK 7:</span> {mapping.pmbok}
                        </div>
                        <div>
                            <span className="text-slate-400">PRINCE2:</span> {mapping.prince2}
                        </div>
                    </div>
                    <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-navy-900 dark:bg-slate-800" />
                </div>
            )}
        </div>
    );
};

export const EcosystemAnalytics: React.FC<EcosystemAnalyticsProps> = ({ metrics, complianceScore, loading }) => {
    const tierGradient = useMemo(() => (metrics ? TIER_COLORS[metrics.partnerTier] : TIER_COLORS.BRONZE), [metrics]);

    const tierLabel = useMemo(() => (metrics ? TIER_LABELS[metrics.partnerTier] : TIER_LABELS.BRONZE), [metrics]);

    if (loading) {
        return (
            <div className="animate-pulse space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-6 dark:border-white/5 dark:bg-navy-900/60">
                <div className="h-6 w-48 rounded bg-slate-200 dark:bg-white/10" />
                <div className="grid gap-4 md:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-white/5" />
                    ))}
                </div>
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 text-center text-slate-500 dark:border-white/5 dark:bg-navy-900/60">
                Brak danych ekosystemu partnera
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Partner Tier & Compliance Banner */}
            <div className={`rounded-3xl bg-gradient-to-r ${tierGradient} p-6 text-white shadow-lg`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                            <Award size={28} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white/80">Status partnera</div>
                            <div className="text-2xl font-bold">{tierLabel}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <div className="text-sm font-medium text-white/80">Compliance Score</div>
                            <div className="flex items-center gap-2">
                                <div className="text-3xl font-bold">{complianceScore}%</div>
                                <CheckCircle2
                                    size={20}
                                    className={complianceScore >= 80 ? 'text-emerald-300' : 'text-white/50'}
                                />
                            </div>
                        </div>

                        <div className="text-center">
                            <div className="text-sm font-medium text-white/80">Network Effect</div>
                            <div className="flex items-center gap-2">
                                <Network size={20} />
                                <span className="text-3xl font-bold">
                                    {metrics.networkEffectMultiplier.toFixed(1)}x
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    icon={<DollarSign size={20} />}
                    label="Total Commission"
                    value={`$${metrics.totalCommissionEarned.toLocaleString()}`}
                    subtitle={`${metrics.totalDealsWon} deals won`}
                    trend="+12%"
                    trendUp
                />
                <MetricCard
                    icon={<Target size={20} />}
                    label="Deals Created"
                    value={metrics.totalDealsCreated.toString()}
                    subtitle={`${Math.round((metrics.totalDealsWon / metrics.totalDealsCreated) * 100)}% win rate`}
                    trend="+8%"
                    trendUp
                />
                <MetricCard
                    icon={<Users size={20} />}
                    label="Active Clients"
                    value={metrics.activeClients.toString()}
                    subtitle="With active access"
                    trend="+2"
                    trendUp
                />
                <MetricCard
                    icon={<Globe size={20} />}
                    label="Referral Conversions"
                    value={metrics.referralConversions.toString()}
                    subtitle={`${metrics.benchmarkContributions} benchmarks`}
                    trend="+15%"
                    trendUp
                />
            </div>

            {/* Ecosystem Health Score */}
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 dark:border-white/5 dark:bg-navy-900/60">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Ecosystem Health</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Activity size={14} />
                        Real-time monitoring
                    </div>
                </div>

                <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">Overall Health Score</span>
                        <span className="font-semibold text-navy-900 dark:text-white">
                            {metrics.ecosystemHealthScore}/100
                        </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                metrics.ecosystemHealthScore >= 80
                                    ? 'bg-emerald-500'
                                    : metrics.ecosystemHealthScore >= 60
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                            }`}
                            style={{ width: `${metrics.ecosystemHealthScore}%` }}
                        />
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    <HealthIndicator
                        label="Deal Pipeline"
                        status={metrics.totalDealsCreated > 10 ? 'healthy' : 'warning'}
                        value={`${metrics.totalDealsCreated} active`}
                    />
                    <HealthIndicator
                        label="Client Engagement"
                        status={metrics.activeClients >= 5 ? 'healthy' : 'warning'}
                        value={`${metrics.activeClients} clients`}
                    />
                    <HealthIndicator
                        label="Network Growth"
                        status={metrics.networkEffectMultiplier >= 1.2 ? 'healthy' : 'warning'}
                        value={`${metrics.networkEffectMultiplier.toFixed(1)}x multiplier`}
                    />
                </div>
            </div>

            {/* PMO Domains Legend */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/5 dark:bg-navy-900/40">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    PMO Standards Compliance Domains
                </div>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(PMO_DOMAIN_INFO).map(([domainId, info]) => (
                        <div
                            key={domainId}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:bg-navy-900 dark:text-slate-300"
                        >
                            <span className={`h-2 w-2 rounded-full ${info.color}`} />
                            {info.icon}
                            {info.label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subtitle: string;
    trend?: string;
    trendUp?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, subtitle, trend, trendUp }) => (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-white/5 dark:bg-navy-900/60">
        <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">{icon}</div>
            {trend && (
                <div
                    className={`flex items-center gap-1 text-xs font-semibold ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}
                >
                    <TrendingUp size={12} className={trendUp ? '' : 'rotate-180'} />
                    {trend}
                </div>
            )}
        </div>
        <div className="text-2xl font-bold text-navy-900 dark:text-white">{value}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
        <div className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</div>
    </div>
);

interface HealthIndicatorProps {
    label: string;
    status: 'healthy' | 'warning' | 'critical';
    value: string;
}

const HealthIndicator: React.FC<HealthIndicatorProps> = ({ label, status, value }) => {
    const statusColors = {
        healthy: 'bg-emerald-500',
        warning: 'bg-amber-500',
        critical: 'bg-red-500',
    };

    return (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-navy-950/40">
            <div className={`h-3 w-3 rounded-full ${statusColors[status]}`} />
            <div>
                <div className="text-xs font-semibold text-navy-900 dark:text-white">{label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{value}</div>
            </div>
        </div>
    );
};

export default EcosystemAnalytics;
