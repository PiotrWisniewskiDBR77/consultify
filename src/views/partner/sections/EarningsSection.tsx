/**
 * EarningsSection - Partner Commission Earnings and Payouts
 *
 * Features:
 * - Earnings summary dashboard with Statements/Payments tabs (HubSpot style)
 * - Commission transaction history
 * - Payout requests and history
 * - Bank/Tax info alert
 *
 * Part of Partner Portal - Commission System
 */

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  Check,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { cn } from '@/utils/cn';

interface EarningsSummary {
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

interface CommissionTransaction {
  id: string;
  partnerOrgId: string;
  organizationId: string;
  organizationName?: string;
  transactionType: string;
  transactionDate: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  currency: string;
  status: string;
  approvedAt?: string;
  payoutId?: string;
  createdAt: string;
}

interface Payout {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  fees: number;
  netAmount: number;
  currency: string;
  transactionCount: number;
  status: string;
  payoutMethod?: string;
  payoutReference?: string;
  requestedAt: string;
  completedAt?: string;
}

interface EarningsSectionProps {
  subsection?: 'earnings' | 'payouts' | 'payout-settings';
}

export const EarningsSection: React.FC<EarningsSectionProps> = ({ subsection = 'earnings' }) => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [activeTab, setActiveTab] = useState<'statements' | 'payments'>('statements');
  const [bankInfoComplete, setBankInfoComplete] = useState(true);
  const [nextPaymentDate, setNextPaymentDate] = useState<string | null>(null);

  // Fetch earnings data from API
  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch earnings summary
      const summaryResponse = await Api.get('/api/partners/earnings');
      if (summaryResponse?.success && summaryResponse?.data) {
        setSummary(summaryResponse.data);
        setBankInfoComplete(summaryResponse.data.bankInfoComplete !== false);
        setNextPaymentDate(summaryResponse.data.nextPaymentDate || null);
      }

      // Fetch commission transactions
      const txResponse = await Api.get('/api/partners/commission-transactions');
      if (txResponse?.success && txResponse?.data) {
        setTransactions(txResponse.data);
      }

      // Fetch payouts
      const payoutsResponse = await Api.get('/api/partners/payouts');
      if (payoutsResponse?.success && payoutsResponse?.data) {
        setPayouts(payoutsResponse.data);
      }
    } catch (err: any) {
      console.error('Error fetching earnings:', err);
      setError(
        err?.response?.data?.error ||
          t('partner.earnings.loadError', 'Failed to load earnings data')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  // Request payout via API
  const handleRequestPayout = async () => {
    if (!summary || summary.readyForPayout < 100) {
      toast.error(t('partner.earnings.minimumNotReached', 'Minimum payout amount is €100'));
      return;
    }

    if (!bankInfoComplete) {
      toast.error(
        t('partner.earnings.bankInfoRequired', 'Please complete your bank information first')
      );
      return;
    }

    try {
      setRequestingPayout(true);
      const response = await Api.post('/api/partners/payouts/request', {
        amount: summary.readyForPayout,
      });

      if (response?.success) {
        toast.success(t('partner.earnings.payoutRequested', 'Payout request submitted!'));
        // Refresh data
        await fetchEarnings();
      } else {
        toast.error(
          response?.error || t('partner.earnings.payoutFailed', 'Failed to request payout')
        );
      }
    } catch (err: any) {
      console.error('Error requesting payout:', err);
      toast.error(
        err?.response?.data?.error || t('partner.earnings.payoutFailed', 'Failed to request payout')
      );
    } finally {
      setRequestingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-4 rounded-full bg-red-500/10 mb-4">
          <DollarSign className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-slate-400 dark:text-slate-500 mb-4">{error}</p>
        <button
          onClick={fetchEarnings}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {t('common.retry', 'Try Again')}
        </button>
      </div>
    );
  }

  // Earnings Overview (main subsection)
  if (subsection === 'earnings') {
    return (
      <div className="space-y-6">
        {/* Bank/Tax Info Alert - HubSpot style */}
        {!bankInfoComplete && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-200 font-medium">
                  {t(
                    'partner.earnings.bankInfoRequired',
                    'Up-to-date bank and tax information is required to receive commission payments.'
                  )}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <a
                    href="#"
                    className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    {t('partner.earnings.learnMore', 'Learn more about commission requirements')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">
                    {t('partner.earnings.updateDocuments', 'Update documents')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header with Next Payment Date */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('partner.earnings.title', 'Partner Commission')}
            </h2>
            <p className="text-slate-400 dark:text-slate-500">
              {t('partner.earnings.subtitle', 'Track your earnings and commissions')}
            </p>
          </div>
          {nextPaymentDate && (
            <div className="text-right">
              <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {t('partner.earnings.nextPayment', 'NEXT COMMISSION PAYMENT')}
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {nextPaymentDate}
              </p>
            </div>
          )}
        </div>

        {/* Statements / Payments Tabs - HubSpot style */}
        <div className="flex items-center justify-between border-b border-white/10 pb-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('statements')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'statements'
                  ? 'text-slate-900 dark:text-white border-violet-500'
                  : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-white'
              )}
            >
              {t('partner.earnings.statements', 'Statements')}
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'payments'
                  ? 'text-slate-900 dark:text-white border-violet-500'
                  : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-white'
              )}
            >
              {t('partner.earnings.payments', 'Payments')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
            >
              <HelpCircle className="w-4 h-4" />
              {t('partner.earnings.howItWorks', 'How commissions work')}
            </a>
            <button className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('partner.earnings.submitTicket', 'Submit a commission ticket')}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-sm text-slate-400 dark:text-slate-500">Total Earned (YTD)</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              €{summary?.totalEarned.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 mt-1 text-sm text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
              <span>+32% vs last year</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <TrendingUp className="w-5 h-5 text-violet-400" />
              </div>
              <span className="text-sm text-slate-400 dark:text-slate-500">This Month</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              €{summary?.thisMonth.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              From {summary?.thisMonthCount} referrals
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-slate-400 dark:text-slate-500">Pending Approval</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              €{summary?.totalPending.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Processing...</p>
          </div>

          <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Banknote className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-slate-400 dark:text-slate-500">Ready for Payout</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              €{summary?.readyForPayout.toLocaleString()}
            </p>
            <button
              onClick={handleRequestPayout}
              disabled={requestingPayout || (summary?.readyForPayout || 0) < 100}
              className={cn(
                'mt-2 px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                (summary?.readyForPayout || 0) >= 100
                  ? 'bg-violet-600 hover:bg-violet-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
              )}
            >
              {requestingPayout ? 'Requesting...' : 'Request Payout'}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'statements' ? (
          /* Statements Tab - Recent Transactions */
          <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('partner.earnings.recentTransactions', 'Recent Commission Statements')}
              </h3>
              <button className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300">
                <Download className="w-4 h-4" />
                {t('common.exportCSV', 'Export CSV')}
              </button>
            </div>

            {transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                        Customer
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                        Type
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                        Amount
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                        Commission
                      </th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                        Status
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5">
                        <td className="px-3 py-3">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {tx.organizationName}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-sm text-slate-400 dark:text-slate-500 capitalize">
                            {tx.transactionType.toLowerCase().replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-slate-600 dark:text-slate-300">
                            €{tx.grossAmount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-medium text-emerald-400">
                            €{tx.commissionAmount.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                            ({tx.commissionRate}%)
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={cn(
                              'px-2 py-1 text-xs font-medium rounded-full',
                              tx.status === 'PAID' && 'bg-emerald-500/20 text-emerald-400',
                              tx.status === 'APPROVED' && 'bg-blue-500/20 text-blue-400',
                              tx.status === 'PENDING' && 'bg-amber-500/20 text-amber-400'
                            )}
                          >
                            {tx.status.toLowerCase()}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-sm text-slate-400 dark:text-slate-500">
                            {tx.transactionDate}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500">
                  {t('partner.earnings.noStatements', "We couldn't find any statements")}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t(
                    'partner.earnings.noStatementsDesc',
                    'Once you make your first commission statement, it will appear here.'
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Payments Tab - Payout History */
          <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('partner.earnings.paymentHistory', 'Payment History')}
              </h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                {t(
                  'partner.earnings.paymentHistoryDesc',
                  'A list of payments made from Consultinity to your organization.'
                )}
              </p>
            </div>

            {payouts.length > 0 ? (
              <div className="space-y-4">
                {payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          payout.status === 'COMPLETED' && 'bg-emerald-500/20',
                          payout.status === 'PROCESSING' && 'bg-blue-500/20',
                          payout.status === 'PENDING' && 'bg-amber-500/20'
                        )}
                      >
                        {payout.status === 'COMPLETED' ? (
                          <Check className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          €{payout.netAmount.toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500">
                          {payout.transactionCount} transactions • {payout.periodStart} to{' '}
                          {payout.periodEnd}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          'px-2 py-1 text-xs font-medium rounded-full',
                          payout.status === 'COMPLETED' && 'bg-emerald-500/20 text-emerald-400',
                          payout.status === 'PROCESSING' && 'bg-blue-500/20 text-blue-400',
                          payout.status === 'PENDING' && 'bg-amber-500/20 text-amber-400'
                        )}
                      >
                        {payout.status.toLowerCase()}
                      </span>
                      {payout.completedAt && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Completed {payout.completedAt}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Banknote className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500">
                  {t('partner.earnings.noPayments', "We couldn't find any payments to show.")}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t(
                    'partner.earnings.noPaymentsDesc',
                    'Payments are processed on the 15th of each month.'
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Payouts subsection
  if (subsection === 'payouts') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.payouts.title', 'Payout History')}
          </h2>
          <p className="text-slate-400 dark:text-slate-500">
            {t('partner.payouts.subtitle', 'View your past and pending payouts')}
          </p>
        </div>

        {/* Payout List */}
        <div className="space-y-4">
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      payout.status === 'COMPLETED' && 'bg-emerald-500/20',
                      payout.status === 'PROCESSING' && 'bg-blue-500/20',
                      payout.status === 'PENDING' && 'bg-amber-500/20'
                    )}
                  >
                    {payout.status === 'COMPLETED' ? (
                      <Check className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <Clock className="w-6 h-6 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      €{payout.netAmount.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      {payout.transactionCount} transactions • {payout.periodStart} to{' '}
                      {payout.periodEnd}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      payout.status === 'COMPLETED' && 'bg-emerald-500/20 text-emerald-400',
                      payout.status === 'PROCESSING' && 'bg-blue-500/20 text-blue-400',
                      payout.status === 'PENDING' && 'bg-amber-500/20 text-amber-400'
                    )}
                  >
                    {payout.status.toLowerCase()}
                  </span>
                  {payout.completedAt && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Completed {payout.completedAt}
                    </p>
                  )}
                  {payout.payoutReference && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ref: {payout.payoutReference}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Payout Settings subsection
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('partner.payoutSettings.title', 'Payout Settings')}
        </h2>
        <p className="text-slate-400 dark:text-slate-500">
          {t(
            'partner.payoutSettings.subtitle',
            'Configure your payout preferences and bank details'
          )}
        </p>
      </div>

      {/* Payout Method */}
      <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Payout Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 rounded-xl border-2 border-violet-500 bg-violet-500/10 text-left">
            <Wallet className="w-6 h-6 text-violet-400 mb-2" />
            <p className="font-medium text-slate-900 dark:text-white">Bank Transfer</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Direct to your bank account
            </p>
          </button>
          <button className="p-4 rounded-xl border border-white/10 hover:border-white/20 text-left">
            <DollarSign className="w-6 h-6 text-slate-400 dark:text-slate-500 mb-2" />
            <p className="font-medium text-slate-600 dark:text-slate-300">PayPal</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">PayPal business account</p>
          </button>
          <button className="p-4 rounded-xl border border-white/10 hover:border-white/20 text-left">
            <ExternalLink className="w-6 h-6 text-slate-400 dark:text-slate-500 mb-2" />
            <p className="font-medium text-slate-600 dark:text-slate-300">Stripe</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Stripe Connect</p>
          </button>
        </div>
      </div>

      {/* Bank Details */}
      <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Bank Account Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400 dark:text-slate-500 mb-1 block">
              Account Holder Name
            </label>
            <input
              type="text"
              defaultValue="Acme Consulting GmbH"
              className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 dark:text-slate-500 mb-1 block">IBAN</label>
            <input
              type="text"
              defaultValue="DE89 3704 0044 0532 0130 00"
              className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 dark:text-slate-500 mb-1 block">
              BIC/SWIFT
            </label>
            <input
              type="text"
              defaultValue="COBADEFFXXX"
              className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 dark:text-slate-500 mb-1 block">
              Bank Name
            </label>
            <input
              type="text"
              defaultValue="Commerzbank AG"
              className="w-full px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium">
            Save Changes
          </button>
        </div>
      </div>

      {/* Payout Preferences */}
      <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl border border-white/5 p-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Payout Preferences
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Minimum Payout Threshold</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Minimum amount before requesting payout
              </p>
            </div>
            <select className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white">
              <option value="100">€100</option>
              <option value="250">€250</option>
              <option value="500">€500</option>
              <option value="1000">€1,000</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Auto-request Payout</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Automatically request payout when threshold is reached
              </p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-violet-600">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition translate-x-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EarningsSection;
