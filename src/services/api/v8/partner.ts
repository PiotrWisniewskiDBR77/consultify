import { v8Get } from './client';

export interface V8PartnerReferralAnalytics {
  totalClicks: number;
  uniqueClicks: number;
  signups: number;
  trials: number;
  paidCustomers: number;
  conversionRate: number;
  clicksByDay: { date: string; clicks: number }[];
  clicksBySource: { source: string; clicks: number }[];
}

export interface V8PartnerEarningsSummary {
  totalEarned: number;
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  thisMonth: number;
  thisMonthCount: number;
  lastMonth: number;
  readyForPayout: number;
  currency: string;
}

export const V8PartnerApi = {
  getReferralAnalytics: (days = 30) =>
    v8Get<{ analytics: V8PartnerReferralAnalytics; days: number }>('/partner/referral-analytics', {
      days: String(days),
    }),
  getEarningsSummary: () => v8Get<{ earnings: V8PartnerEarningsSummary }>('/partner/earnings-summary'),
};
