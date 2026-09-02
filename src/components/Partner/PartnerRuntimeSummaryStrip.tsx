import { Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerEarningsSummary,
  type V8PartnerProgramStatus,
  type V8PartnerReferralAnalytics,
} from '../../services/api/v8';

export interface PartnerRuntimeSummary {
  analytics: V8PartnerReferralAnalytics;
  earnings: V8PartnerEarningsSummary;
  program: V8PartnerProgramStatus | null;
}

function unwrapLegacyPayload(payload: any): any {
  if (payload?.success && payload?.data) {
    return payload.data;
  }

  if (payload?.data && payload.data !== payload) {
    return payload.data;
  }

  return payload;
}

function normalizeReferralAnalytics(payload: any): V8PartnerReferralAnalytics {
  const data = unwrapLegacyPayload(payload);

  return {
    totalClicks: Number(data?.totalClicks ?? 0),
    uniqueClicks: Number(data?.uniqueClicks ?? 0),
    signups: Number(data?.signups ?? 0),
    trials: Number(data?.trials ?? 0),
    paidCustomers: Number(data?.paidCustomers ?? data?.conversions ?? 0),
    conversionRate: Number(data?.conversionRate ?? 0),
    clicksByDay: Array.isArray(data?.clicksByDay) ? data.clicksByDay : [],
    clicksBySource: Array.isArray(data?.clicksBySource) ? data.clicksBySource : [],
  };
}

function normalizeEarningsSummary(payload: any): V8PartnerEarningsSummary {
  const data = unwrapLegacyPayload(payload);

  return {
    totalEarned: Number(data?.totalEarned ?? data?.totalEarnedYTD ?? 0),
    totalPending: Number(data?.totalPending ?? data?.pendingApproval ?? 0),
    totalApproved: Number(data?.totalApproved ?? 0),
    totalPaid: Number(data?.totalPaid ?? data?.totalPaidOut ?? 0),
    thisMonth: Number(data?.thisMonth ?? 0),
    thisMonthCount: Number(data?.thisMonthCount ?? 0),
    lastMonth: Number(data?.lastMonth ?? 0),
    readyForPayout: Number(data?.readyForPayout ?? 0),
    currency: String(data?.currency ?? 'EUR'),
  };
}

async function getReferralAnalyticsWithFallback(): Promise<V8PartnerReferralAnalytics> {
  try {
    const response = await V8PartnerApi.getReferralAnalytics();
    return normalizeReferralAnalytics(response?.analytics);
  } catch (error) {
    if (!shouldFallbackToLegacyPartner(error)) {
      throw error;
    }

    const response = await Api.get('/api/partners/referral-analytics');
    return normalizeReferralAnalytics(response);
  }
}

async function getEarningsSummaryWithFallback(): Promise<V8PartnerEarningsSummary> {
  try {
    const response = await V8PartnerApi.getEarningsSummary();
    return normalizeEarningsSummary(response?.earnings);
  } catch (error) {
    if (!shouldFallbackToLegacyPartner(error)) {
      throw error;
    }

    const response = await Api.get('/api/partners/earnings');
    return normalizeEarningsSummary(response);
  }
}

export async function loadPartnerRuntimeSummary(): Promise<PartnerRuntimeSummary> {
  const [analytics, earnings, program] = await Promise.all([
    getReferralAnalyticsWithFallback(),
    getEarningsSummaryWithFallback(),
    V8PartnerApi.getProgramStatus().catch(() => null),
  ]);

  return { analytics, earnings, program };
}

export const PartnerRuntimeSummaryStrip: React.FC<{ summary: PartnerRuntimeSummary }> = ({
  summary,
}) => {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-navy-700 dark:bg-navy-800">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Sparkles className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            {t('partner.metrics.runtimeTitle', 'Partner Runtime Summary')}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t(
              'partner.metrics.runtimeSubtitle',
              'Live partner-authenticated governed reads from partner runtime seams.'
            )}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: t('partner.metrics.runtimeReferralClicks', 'Referral clicks'),
            value: String(summary.analytics.totalClicks ?? 0),
            detail: `${summary.analytics.uniqueClicks ?? 0} unique`,
          },
          {
            label: t('partner.metrics.runtimePaidCustomers', 'Paid customers'),
            value: String(summary.analytics.paidCustomers ?? 0),
            detail: `${summary.analytics.signups ?? 0} signups`,
          },
          {
            label: t('partner.metrics.runtimeConversionRate', 'Conversion rate'),
            value: `${summary.analytics.conversionRate ?? 0}%`,
            detail: `${summary.analytics.trials ?? 0} trials`,
          },
          {
            label: t('partner.metrics.runtimeReadyForPayout', 'Ready for payout'),
            value: `${summary.program?.balances.currency ?? summary.earnings.currency ?? 'EUR'} ${(
              summary.program?.balances.availableToPayout ??
              summary.earnings.readyForPayout ??
              0
            ).toLocaleString()}`,
            detail: summary.program
              ? `${summary.program.lifecyclePhase} lifecycle`
              : `${summary.earnings.totalPending ?? 0} pending`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-navy-700/60 dark:bg-navy-900/40"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {card.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {card.value}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{card.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PartnerRuntimeSummaryStrip;
