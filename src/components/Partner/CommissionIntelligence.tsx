/**
 * CommissionIntelligence Component
 *
 * AI-powered commission insights and predictions
 * Aligned with BENEFITS_REALIZATION PMO domain
 */

import {
  AlertTriangle,
  ArrowUpRight,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo } from 'react';

import { CommissionStatement, PARTNER_PMO_MAPPING, PartnerDeal } from '../../views/partner/types';
import { PMODomainBadge } from './EcosystemAnalytics';

interface CommissionIntelligenceProps {
  deals: PartnerDeal[];
  statements: CommissionStatement[];
  onViewDeal?: (dealId: string) => void;
  onSubmitInquiry?: () => void;
}

interface AIInsight {
  type: 'opportunity' | 'warning' | 'success';
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
}

export const CommissionIntelligence: React.FC<CommissionIntelligenceProps> = ({
  deals,
  statements,
  onViewDeal,
  onSubmitInquiry,
}) => {
  // AI-generated insights based on deal data
  const aiInsights = useMemo<AIInsight[]>(() => {
    const insights: AIInsight[] = [];

    // Analyze deal pipeline
    const inProgressDeals = deals.filter(
      (d) => d.status === 'QUALIFIED' || d.status === 'PROPOSAL' || d.status === 'NEGOTIATION'
    );
    const wonDeals = deals.filter((d) => d.status === 'WON');
    const lostDeals = deals.filter((d) => d.status === 'LOST');

    // Win rate analysis
    const totalClosed = wonDeals.length + lostDeals.length;
    const winRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;

    if (winRate >= 50) {
      insights.push({
        type: 'success',
        title: 'Strong Win Rate',
        description: `Your ${winRate.toFixed(0)}% win rate is above average. Continue leveraging successful patterns.`,
      });
    } else if (winRate > 0 && winRate < 30) {
      insights.push({
        type: 'warning',
        title: 'Win Rate Optimization',
        description: `Current win rate is ${winRate.toFixed(0)}%. Consider reviewing deal qualification criteria.`,
        action: 'review-qualification',
        actionLabel: 'View Academy Module',
      });
    }

    // Pipeline value analysis
    const pipelineValue = inProgressDeals.reduce((sum, d) => sum + d.commissionAmount, 0);
    if (pipelineValue > 10000) {
      insights.push({
        type: 'opportunity',
        title: 'Commission Pipeline',
        description: `$${pipelineValue.toLocaleString()} in potential commission from ${inProgressDeals.length} active deals.`,
        action: 'view-pipeline',
        actionLabel: 'Review Deals',
      });
    }

    // Stalled deals warning
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const stalledDeals = inProgressDeals.filter((d) => new Date(d.registeredAt) < thirtyDaysAgo);
    if (stalledDeals.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Stalled Deals Detected',
        description: `${stalledDeals.length} deal(s) have been in progress for over 30 days without advancement.`,
        action: 'review-stalled',
        actionLabel: 'View Details',
      });
    }

    // Pending payments
    const pendingStatements = statements.filter(
      (s) => s.status === 'PENDING' || s.status === 'APPROVED'
    );
    if (pendingStatements.length > 0) {
      const pendingAmount = pendingStatements.reduce((sum, s) => sum + s.totalAmount, 0);
      insights.push({
        type: 'opportunity',
        title: 'Pending Payouts',
        description: `$${pendingAmount.toLocaleString()} in commission statements awaiting payment.`,
        action: 'view-statements',
        actionLabel: 'View Statements',
      });
    }

    return insights;
  }, [deals, statements]);

  // Commission projections
  const projections = useMemo(() => {
    const wonDeals = deals.filter((d) => d.status === 'WON');
    const inProgressDeals = deals.filter(
      (d) => d.status === 'QUALIFIED' || d.status === 'PROPOSAL' || d.status === 'NEGOTIATION'
    );

    const earnedCommission = wonDeals.reduce((sum, d) => sum + d.commissionAmount, 0);
    const pipelineCommission = inProgressDeals.reduce((sum, d) => sum + d.commissionAmount, 0);

    // Simple projection based on historical win rate
    const totalClosed = wonDeals.length + deals.filter((d) => d.status === 'LOST').length;
    const winRate = totalClosed > 0 ? wonDeals.length / totalClosed : 0.3; // Default 30%

    const projectedFromPipeline = pipelineCommission * winRate;
    const quarterlyProjection = earnedCommission + projectedFromPipeline;

    return {
      earned: earnedCommission,
      pipeline: pipelineCommission,
      projected: projectedFromPipeline,
      quarterlyTotal: quarterlyProjection,
      winRate: winRate * 100,
    };
  }, [deals]);

  return (
    <div className="space-y-6">
      {/* AI Insights Header */}
      <div className="rounded-xl border border-c-ai/20 bg-gradient-to-br from-c-ai/5 to-c-surface-raised p-6 dark:from-c-ai/10 dark:to-c-surface-raised">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
            <Brain size={20} className="text-brand" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
              Commission Intelligence
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI-powered insights and predictions
            </p>
          </div>
          <PMODomainBadge mapping={PARTNER_PMO_MAPPING.COMMISSION_SETTLEMENT} />
        </div>

        {/* AI Insights List */}
        <div className="space-y-3">
          {aiInsights.length === 0 ? (
            <div className="rounded-xl bg-white/50 p-4 text-center text-sm text-slate-500 dark:text-slate-400 dark:bg-navy-900/50">
              <Sparkles size={20} className="mx-auto mb-2 text-brand" />
              No insights available yet. Keep registering deals to unlock AI recommendations.
            </div>
          ) : (
            aiInsights.map((insight, index) => <InsightCard key={index} insight={insight} />)
          )}
        </div>
      </div>

      {/* Commission Projections */}
      <div className="rounded-xl border border-slate-200 bg-white/90 p-6 dark:border-navy-700 dark:bg-navy-900/60">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
            Commission Projections
          </h3>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Calendar size={12} />
            Q1 2026 Forecast
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ProjectionCard
            label="Earned"
            value={`$${projections.earned.toLocaleString()}`}
            status="completed"
            subtitle="Closed won deals"
          />
          <ProjectionCard
            label="Pipeline"
            value={`$${projections.pipeline.toLocaleString()}`}
            status="pending"
            subtitle="Active opportunities"
          />
          <ProjectionCard
            label="Projected"
            value={`$${projections.projected.toLocaleString()}`}
            status="projected"
            subtitle={`Based on ${projections.winRate.toFixed(0)}% win rate`}
          />
          <ProjectionCard
            label="Q1 Total"
            value={`$${projections.quarterlyTotal.toLocaleString()}`}
            status="total"
            subtitle="Expected quarterly total"
            highlight
          />
        </div>
      </div>

      {/* Deal Pipeline Overview */}
      <div className="rounded-xl border border-slate-200 bg-white/90 p-6 dark:border-navy-700 dark:bg-navy-900/60">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Active Deals</h3>
          <button
            onClick={() => onViewDeal?.('all')}
            className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            View All <ChevronRight size={14} />
          </button>
        </div>

        <div className="space-y-3">
          {deals
            .filter((d) => d.status !== 'WON' && d.status !== 'LOST')
            .slice(0, 5)
            .map((deal) => (
              <DealRow key={deal.id} deal={deal} onView={() => onViewDeal?.(deal.id)} />
            ))}

          {deals.filter((d) => d.status !== 'WON' && d.status !== 'LOST').length === 0 && (
            <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:text-slate-400 dark:bg-navy-950/40">
              No active deals in pipeline
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={onSubmitInquiry}
          className="flex items-center justify-between rounded-xl border border-brand/20 bg-brand/5 p-4 text-left transition hover:bg-brand/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
              <DollarSign size={18} className="text-brand" />
            </div>
            <div>
              <div className="font-semibold text-navy-900 dark:text-white">Submit Inquiry</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Commission questions or updates
              </div>
            </div>
          </div>
          <ArrowUpRight size={18} className="text-brand" />
        </button>

        <button className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 p-4 text-left transition hover:border-brand/30 dark:border-navy-700 dark:bg-navy-900/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10">
              <TrendingUp size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <div className="font-semibold text-navy-900 dark:text-white">View Statements</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Historical payouts & reports
              </div>
            </div>
          </div>
          <ArrowUpRight size={18} className="text-slate-400 dark:text-slate-500" />
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const InsightCard: React.FC<{ insight: AIInsight }> = ({ insight }) => {
  const iconMap = {
    opportunity: <TrendingUp size={16} className="text-emerald-500" />,
    warning: <AlertTriangle size={16} className="text-amber-500" />,
    success: <CheckCircle2 size={16} className="text-emerald-500" />,
  };

  const bgMap = {
    opportunity:
      'bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    warning: 'bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20',
    success: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20',
  };

  return (
    <div className={`rounded-xl border p-4 ${bgMap[insight.type]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{iconMap[insight.type]}</div>
        <div className="flex-1">
          <div className="font-semibold text-navy-900 dark:text-white">{insight.title}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {insight.description}
          </div>
          {insight.actionLabel && (
            <button className="mt-2 text-xs font-semibold text-brand hover:underline">
              {insight.actionLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ProjectionCardProps {
  label: string;
  value: string;
  status: 'completed' | 'pending' | 'projected' | 'total';
  subtitle: string;
  highlight?: boolean;
}

const ProjectionCard: React.FC<ProjectionCardProps> = ({
  label,
  value,
  status,
  subtitle,
  highlight,
}) => {
  const statusColors = {
    completed: 'text-emerald-500',
    pending: 'text-amber-500',
    projected: 'text-blue-500',
    total: 'text-brand',
  };

  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? 'border-brand/30 bg-brand/5 dark:border-brand/20 dark:bg-brand/10'
          : 'border-slate-100 bg-slate-50/50 dark:border-navy-700 dark:bg-navy-950/40'
      }`}
    >
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${statusColors[status]}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{subtitle}</div>
    </div>
  );
};

const DealRow: React.FC<{ deal: PartnerDeal; onView: () => void }> = ({ deal, onView }) => {
  const statusColors: Record<string, string> = {
    REGISTERED: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    QUALIFIED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    NEGOTIATION: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  };

  return (
    <div
      onClick={onView}
      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 p-4 transition hover:border-brand/30 dark:border-navy-700"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10 text-sm font-bold text-slate-600 dark:text-slate-300">
          {deal.clientName.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold text-navy-900 dark:text-white">{deal.clientName}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            ${deal.dealValue.toLocaleString()} deal value
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-semibold text-emerald-600 dark:text-emerald-400">
            ${deal.commissionAmount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">
            {deal.commissionRate}% rate
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[deal.status]}`}
        >
          {deal.status}
        </span>
      </div>
    </div>
  );
};

export default CommissionIntelligence;
