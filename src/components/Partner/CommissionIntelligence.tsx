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
import { useTranslation } from 'react-i18next';

import { CommissionStatement, PARTNER_PMO_MAPPING, PartnerDeal } from '../../views/partner/types';
import { PMODomainBadge } from './EcosystemAnalytics';
import { formatListNumber } from '@/utils/listDateFormat';

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
  const { t } = useTranslation();
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
        title: t('partner.commissionIntel.insights.strongWinRate.title', 'Strong win rate'),
        description: t(
          'partner.commissionIntel.insights.strongWinRate.description',
          'Your {{percent}}% win rate is above average. Keep leveraging what works.',
          { percent: winRate.toFixed(0) }
        ),
      });
    } else if (winRate > 0 && winRate < 30) {
      insights.push({
        type: 'warning',
        title: t('partner.commissionIntel.insights.winRateOptimization.title', 'Win rate optimization'),
        description: t(
          'partner.commissionIntel.insights.winRateOptimization.description',
          'The current win rate is {{percent}}%. Consider reviewing your deal qualification criteria.',
          { percent: winRate.toFixed(0) }
        ),
        action: 'review-qualification',
        actionLabel: t('partner.commissionIntel.actions.viewAcademyModule', 'View academy module'),
      });
    }

    // Pipeline value analysis
    const pipelineValue = inProgressDeals.reduce((sum, d) => sum + d.commissionAmount, 0);
    if (pipelineValue > 10000) {
      insights.push({
        type: 'opportunity',
        title: t('partner.commissionIntel.insights.pipeline.title', 'Commission pipeline'),
        description: t(
          'partner.commissionIntel.insights.pipeline.description',
          '{{amount}} in potential commission from {{count}} active deals.',
          { amount: `$${formatListNumber(pipelineValue, '0')}`, count: inProgressDeals.length }
        ),
        action: 'view-pipeline',
        actionLabel: t('partner.commissionIntel.actions.reviewDeals', 'Review deals'),
      });
    }

    // Stalled deals warning
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const stalledDeals = inProgressDeals.filter((d) => new Date(d.registeredAt) < thirtyDaysAgo);
    if (stalledDeals.length > 0) {
      insights.push({
        type: 'warning',
        title: t('partner.commissionIntel.insights.stalled.title', 'Stalled deals detected'),
        description: t(
          'partner.commissionIntel.insights.stalled.description',
          '{{count}} deals have been in progress for over 30 days without moving forward.',
          { count: stalledDeals.length }
        ),
        action: 'review-stalled',
        actionLabel: t('partner.commissionIntel.actions.viewDetails', 'View details'),
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
        title: t('partner.commissionIntel.insights.pendingPayouts.title', 'Pending payouts'),
        description: t(
          'partner.commissionIntel.insights.pendingPayouts.description',
          '{{amount}} in commission statements awaiting payment.',
          { amount: `$${formatListNumber(pendingAmount, '0')}` }
        ),
        action: 'view-statements',
        actionLabel: t('partner.commissionIntel.actions.viewStatements', 'View statements'),
      });
    }

    return insights;
  }, [deals, statements, t]);

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
              {t('partner.commissionIntel.title', 'Commission intelligence')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('partner.commissionIntel.subtitle', 'AI-powered insights and predictions')}
            </p>
          </div>
          <PMODomainBadge mapping={PARTNER_PMO_MAPPING.COMMISSION_SETTLEMENT} />
        </div>

        {/* AI Insights List */}
        <div className="space-y-3">
          {aiInsights.length === 0 ? (
            <div className="rounded-xl bg-white/50 p-4 text-center text-sm text-slate-500 dark:text-slate-400 dark:bg-navy-900/50">
              <Sparkles size={20} className="mx-auto mb-2 text-brand" />
              {t(
                'partner.commissionIntel.noInsights',
                'No insights yet. Keep registering deals to unlock AI recommendations.'
              )}
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
            {t('partner.commissionIntel.projectionsTitle', 'Commission projections')}
          </h3>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Calendar size={12} />
            {t('partner.commissionIntel.forecastLabel', 'Q1 2026 forecast')}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ProjectionCard
            label={t('partner.commissionIntel.projection.earned', 'Earned')}
            value={`$${formatListNumber(projections.earned, '0')}`}
            status="completed"
            subtitle={t('partner.commissionIntel.projection.earnedSubtitle', 'Closed won deals')}
          />
          <ProjectionCard
            label={t('partner.commissionIntel.projection.pipeline', 'Pipeline')}
            value={`$${formatListNumber(projections.pipeline, '0')}`}
            status="pending"
            subtitle={t('partner.commissionIntel.projection.pipelineSubtitle', 'Active opportunities')}
          />
          <ProjectionCard
            label={t('partner.commissionIntel.projection.projected', 'Projected')}
            value={`$${formatListNumber(projections.projected, '0')}`}
            status="projected"
            subtitle={t(
              'partner.commissionIntel.projection.projectedSubtitle',
              'Based on a {{percent}}% win rate',
              { percent: projections.winRate.toFixed(0) }
            )}
          />
          <ProjectionCard
            label={t('partner.commissionIntel.projection.quarterTotal', 'Q1 total')}
            value={`$${formatListNumber(projections.quarterlyTotal, '0')}`}
            status="total"
            subtitle={t(
              'partner.commissionIntel.projection.quarterTotalSubtitle',
              'Expected quarterly total'
            )}
            highlight
          />
        </div>
      </div>

      {/* Deal Pipeline Overview */}
      <div className="rounded-xl border border-slate-200 bg-white/90 p-6 dark:border-navy-700 dark:bg-navy-900/60">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
            {t('partner.commissionIntel.activeDeals', 'Active deals')}
          </h3>
          <button
            onClick={() => onViewDeal?.('all')}
            className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            {t('partner.commissionIntel.viewAll', 'View all')} <ChevronRight size={14} />
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
              {t('partner.commissionIntel.noActiveDeals', 'No active deals in the pipeline')}
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
              <div className="font-semibold text-navy-900 dark:text-white">
                {t('partner.commissionIntel.submitInquiry', 'Submit inquiry')}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('partner.commissionIntel.submitInquiryHint', 'Commission questions or updates')}
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
              <div className="font-semibold text-navy-900 dark:text-white">
                {t('partner.commissionIntel.viewStatements', 'View statements')}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('partner.commissionIntel.viewStatementsHint', 'Historical payouts and reports')}
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
  const { t } = useTranslation();
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
            {t('partner.commissionIntel.dealValue', '{{amount}} deal value', {
              amount: `$${formatListNumber(deal.dealValue, '0')}`,
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-semibold text-emerald-600 dark:text-emerald-400">
            ${formatListNumber(deal.commissionAmount, '0')}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">
            {t('partner.commissionIntel.commissionRate', '{{percent}}% rate', {
              percent: deal.commissionRate,
            })}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[deal.status]}`}
        >
          {t(`partner.commissionIntel.dealStatus.${deal.status}`, deal.status)}
        </span>
      </div>
    </div>
  );
};

export default CommissionIntelligence;
