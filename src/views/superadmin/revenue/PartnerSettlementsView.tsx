/**
 * PartnerSettlementsView - SuperAdmin Partner Commission Settlements
 *
 * Features:
 * - Overview of all partner commissions
 * - Approve pending commissions
 * - Process and complete payouts
 * - Attribution manager (manual org-partner linking)
 * - Settlement analytics
 *
 * Part of SuperAdmin Revenue Module
 */

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Eye,
  Filter,
  Link2,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Unlink,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/shared/states';
import { Api } from '@/services/api';
import { cn } from '@/utils/cn';

interface SettlementsSummary {
  totalPendingCommissions: number;
  totalPendingPayouts: number;
  pendingCommissionAmount: number;
  pendingPayoutAmount: number;
  thisMonthCommissions: number;
  thisMonthPayouts: number;
}

interface PendingCommission {
  id: string;
  partnerOrgId: string;
  partnerName?: string;
  organizationId: string;
  organizationName?: string;
  transactionType: string;
  transactionDate: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface PendingPayout {
  id: string;
  partnerOrgId: string;
  partnerName?: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  fees: number;
  netAmount: number;
  currency: string;
  transactionCount: number;
  status: string;
  payoutMethod?: string;
  requestedAt: string;
}

interface Attribution {
  id: string;
  partnerOrgId: string;
  partnerName?: string;
  organizationId: string;
  organizationName?: string;
  attributionType: string;
  referralCodeUsed?: string;
  status: string;
  attributedAt: string;
}

// GAP-PARTNER-004: Expiring attribution interface
interface ExpiringAttribution {
  id: string;
  partnerOrgId: string;
  partnerName: string;
  organizationId: string;
  organizationName: string;
  referralCodeUsed?: string;
  status: string;
  attributedAt: string;
  discountEndDate?: string;
  daysRemaining: number;
  discountPercent?: number;
  lifetimeValue: number;
  totalCommissionEarned: number;
}

// GAP-PARTNER-003: Code analytics interface
interface CodeAnalytics {
  referralCode: string;
  partnerOrgId: string;
  partnerName: string;
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  conversionRate: number;
  totalRevenue: number;
  totalCommissions: number;
  avgCommissionRate: number;
  activeAttributions: number;
  firstUsed?: string;
  lastUsed?: string;
}

type TabType = 'commissions' | 'payouts' | 'attribution' | 'expiring' | 'analytics';

export const PartnerSettlementsView: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('commissions');
  const [summary, setSummary] = useState<SettlementsSummary | null>(null);
  const [commissions, setCommissions] = useState<PendingCommission[]>([]);
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [expiringAttributions, setExpiringAttributions] = useState<ExpiringAttribution[]>([]);
  const [codeAnalytics, setCodeAnalytics] = useState<CodeAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommissions, setSelectedCommissions] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expiringDays, setExpiringDays] = useState(30);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch summary
      const summaryRes = await Api.get('/api/superadmin/partner-settlements/summary');
      if (summaryRes?.success && summaryRes?.data) {
        setSummary(summaryRes.data);
      }

      // Fetch pending commissions
      const commissionsRes = await Api.get(
        '/api/superadmin/partner-settlements/pending-commissions'
      );
      if (commissionsRes?.success && commissionsRes?.data) {
        setCommissions(commissionsRes.data);
      }

      // Fetch pending payouts
      const payoutsRes = await Api.get('/api/superadmin/partner-settlements/pending-payouts');
      if (payoutsRes?.success && payoutsRes?.data) {
        setPayouts(payoutsRes.data);
      }

      // Fetch attributions
      const attributionsRes = await Api.get('/api/superadmin/partner-settlements/attributions');
      if (attributionsRes?.success && attributionsRes?.data) {
        setAttributions(attributionsRes.data);
      }

      // GAP-PARTNER-004: Fetch expiring attributions
      const expiringRes = await Api.get(
        `/api/superadmin/partner-settlements/expiring-attributions?days=${expiringDays}`
      );
      if (expiringRes?.success && expiringRes?.data) {
        setExpiringAttributions(expiringRes.data);
      }

      // GAP-PARTNER-003: Fetch code analytics
      const analyticsRes = await Api.get(
        '/api/superadmin/partner-settlements/code-analytics?days=90'
      );
      if (analyticsRes?.success && analyticsRes?.data) {
        setCodeAnalytics(analyticsRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching settlements:', err);
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [expiringDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle commission selection
  const toggleCommissionSelection = (id: string) => {
    setSelectedCommissions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all commissions
  const selectAllCommissions = () => {
    if (selectedCommissions.size === commissions.length) {
      setSelectedCommissions(new Set());
    } else {
      setSelectedCommissions(new Set(commissions.map((c) => c.id)));
    }
  };

  // Approve selected commissions
  const handleApproveCommissions = async () => {
    if (selectedCommissions.size === 0) {
      toast.error('No commissions selected');
      return;
    }

    try {
      setProcessing(true);
      const response = await Api.post('/api/superadmin/partner-settlements/approve-commissions', {
        commissionIds: Array.from(selectedCommissions),
      });

      if (response?.success) {
        toast.success(`Approved ${selectedCommissions.size} commissions`);
        setSelectedCommissions(new Set());
        await fetchData();
      } else {
        toast.error(response?.error || 'Failed to approve commissions');
      }
    } catch (err: any) {
      console.error('Error approving commissions:', err);
      toast.error(err?.message || 'Failed to approve commissions');
    } finally {
      setProcessing(false);
    }
  };

  // Process payout
  const handleProcessPayout = async (payoutId: string) => {
    const reason = window.prompt(
      'Podaj powód zatwierdzenia payoutu do processing:',
      'Approve payout'
    );
    if (!reason || reason.trim().length < 3) {
      toast.error('Confirmation reason is required');
      return;
    }

    try {
      setProcessing(true);
      const response = await Api.post(
        `/api/superadmin/partner-settlements/process-payout/${payoutId}`,
        {
          payoutId,
          confirmation: true,
          reason: reason.trim(),
        }
      );

      if (response?.success) {
        toast.success('Payout marked as processing');
        await fetchData();
      } else {
        toast.error(response?.error || 'Failed to process payout');
      }
    } catch (err: any) {
      console.error('Error processing payout:', err);
      toast.error(err?.message || 'Failed to process payout');
    } finally {
      setProcessing(false);
    }
  };

  // Complete payout
  const handleCompletePayout = async (payoutId: string) => {
    const reason = window.prompt(
      'Podaj powód wykonania i reconciliacji payoutu:',
      'Reconciled provider payout'
    );
    if (!reason || reason.trim().length < 3) {
      toast.error('Confirmation reason is required');
      return;
    }

    try {
      setProcessing(true);
      const response = await Api.post(
        `/api/superadmin/partner-settlements/complete-payout/${payoutId}`,
        {
          payoutId,
          confirmation: true,
          reason: reason.trim(),
        }
      );

      if (response?.success) {
        toast.success('Payout completed successfully');
        await fetchData();
      } else {
        toast.error(response?.error || 'Failed to complete payout');
      }
    } catch (err: any) {
      console.error('Error completing payout:', err);
      toast.error(err?.message || 'Failed to complete payout');
    } finally {
      setProcessing(false);
    }
  };

  // Remove attribution
  const handleRemoveAttribution = async (attributionId: string) => {
    if (!confirm('Are you sure you want to remove this attribution?')) {
      return;
    }

    try {
      setProcessing(true);
      const response = await Api.delete(
        `/api/superadmin/partner-settlements/attributions/${attributionId}`
      );

      if (response?.success) {
        toast.success('Attribution removed');
        await fetchData();
      } else {
        toast.error(response?.error || 'Failed to remove attribution');
      }
    } catch (err: any) {
      console.error('Error removing attribution:', err);
      toast.error(err?.message || 'Failed to remove attribution');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingState template="list" className="py-12" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-c-text">
            {t('superadmin.settlements.title', 'Partner Settlements')}
          </h1>
          <p className="text-c-text-secondary">
            {t('superadmin.settlements.subtitle', 'Manage partner commissions and payouts')}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 text-sm text-c-text-secondary hover:text-c-text transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-c-surface rounded-xl border border-c-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-c-warning/20">
              <Clock className="w-5 h-5 text-c-warning" />
            </div>
            <span className="text-sm text-c-text-secondary">Pending Commissions</span>
          </div>
          <p className="text-2xl font-bold text-c-text">
            {summary?.totalPendingCommissions}
          </p>
          <p className="text-sm text-c-text-muted mt-1">
            €{summary?.pendingCommissionAmount.toLocaleString()} total
          </p>
        </div>

        <div className="bg-c-surface rounded-xl border border-c-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-c-info/20">
              <Banknote className="w-5 h-5 text-c-info" />
            </div>
            <span className="text-sm text-c-text-secondary">Pending Payouts</span>
          </div>
          <p className="text-2xl font-bold text-c-text">
            {summary?.totalPendingPayouts}
          </p>
          <p className="text-sm text-c-text-muted mt-1">
            €{summary?.pendingPayoutAmount.toLocaleString()} total
          </p>
        </div>

        <div className="bg-c-surface rounded-xl border border-c-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-c-success/20">
              <TrendingUp className="w-5 h-5 text-c-success" />
            </div>
            <span className="text-sm text-c-text-secondary">
              This Month Commissions
            </span>
          </div>
          <p className="text-2xl font-bold text-c-text">
            €{summary?.thisMonthCommissions.toLocaleString()}
          </p>
        </div>

        <div className="bg-c-surface rounded-xl border border-c-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-c-accent/20">
              <DollarSign className="w-5 h-5 text-c-accent" />
            </div>
            <span className="text-sm text-c-text-secondary">This Month Payouts</span>
          </div>
          <p className="text-2xl font-bold text-c-text">
            €{summary?.thisMonthPayouts.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-white/5 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('commissions')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'commissions'
              ? 'bg-c-accent text-white'
              : 'text-c-text-secondary hover:text-c-text'
          )}
        >
          Pending Commissions
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'payouts'
              ? 'bg-c-accent text-white'
              : 'text-c-text-secondary hover:text-c-text'
          )}
        >
          Pending Payouts
        </button>
        <button
          onClick={() => setActiveTab('attribution')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'attribution'
              ? 'bg-c-accent text-white'
              : 'text-c-text-secondary hover:text-c-text'
          )}
        >
          Attribution Manager
        </button>
        <button
          onClick={() => setActiveTab('expiring')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2',
            activeTab === 'expiring'
              ? 'bg-c-accent text-white'
              : 'text-c-text-secondary hover:text-c-text'
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          Expiring
          {expiringAttributions.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
              {expiringAttributions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2',
            activeTab === 'analytics'
              ? 'bg-c-accent text-white'
              : 'text-c-text-secondary hover:text-c-text'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Code Analytics
        </button>
      </div>

      {/* Commissions Tab */}
      {activeTab === 'commissions' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 p-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search partners..."
                  className="pl-9 pr-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white w-64"
                />
              </div>
              <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10 rounded-lg">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
            {selectedCommissions.size > 0 && (
              <button
                onClick={handleApproveCommissions}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Approve Selected ({selectedCommissions.size})
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th className="text-left px-3 py-2">
                    <input
                      type="checkbox"
                      checked={
                        selectedCommissions.size === commissions.length && commissions.length > 0
                      }
                      onChange={selectAllCommissions}
                      className="rounded text-primary-600"
                    />
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                    Partner
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                    Customer
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                    Type
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                    Amount
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                    Commission
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                    Date
                  </th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {commissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCommissions.has(commission.id)}
                        onChange={() => toggleCommissionSelection(commission.id)}
                        className="rounded text-primary-600"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="font-medium text-slate-900 dark:text-white">
                          {commission.partnerName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-slate-700 dark:text-slate-300">
                        {commission.organizationName}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-slate-600 dark:text-slate-500 capitalize">
                        {commission.transactionType.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-slate-700 dark:text-slate-300">
                        €{commission.grossAmount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-medium text-emerald-400">
                        €{commission.commissionAmount.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                        ({commission.commissionRate}%)
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-slate-600 dark:text-slate-500">
                        {commission.transactionDate}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {commissions.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-500">
                No pending commissions to approve
              </p>
            </div>
          )}
        </div>
      )}

      {/* Payouts Tab */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      payout.status === 'PENDING' && 'bg-amber-500/20',
                      payout.status === 'PROCESSING' && 'bg-blue-500/20'
                    )}
                  >
                    {payout.status === 'PROCESSING' ? (
                      <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                    ) : (
                      <Clock className="w-6 h-6 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {payout.partnerName}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {payout.transactionCount} transactions • {payout.periodStart} to{' '}
                      {payout.periodEnd}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      €{payout.netAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Gross: €{payout.grossAmount.toLocaleString()} • Fees: €
                      {payout.fees.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {payout.status === 'PENDING' && (
                      <button
                        onClick={() => handleProcessPayout(payout.id)}
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Process
                      </button>
                    )}
                    {payout.status === 'PROCESSING' && (
                      <button
                        onClick={() => handleCompletePayout(payout.id)}
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Complete
                      </button>
                    )}
                    <button
                      className="p-2 text-slate-600 dark:text-slate-500 hover:text-danger-400 rounded transition-colors"
                      title="Reject"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {payouts.length === 0 && (
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 p-12 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">No pending payouts to process</p>
            </div>
          )}
        </div>
      )}

      {/* Attribution Tab */}
      {activeTab === 'attribution' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('superadmin.settlements.attributionManager', 'Attribution Manager')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t(
                  'superadmin.settlements.attributionDesc',
                  'Manually link organizations to partners or view existing attributions'
                )}
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" />
              {t('superadmin.settlements.createAttribution', 'Create Attribution')}
            </button>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search by organization or partner name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Attributions Table */}
          {attributions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10">
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Organization
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Partner
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Type
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Code Used
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Date
                    </th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {attributions
                    .filter(
                      (a) =>
                        !searchTerm ||
                        a.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.partnerName?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((attribution) => (
                      <tr
                        key={attribution.id}
                        className="hover:bg-slate-50 dark:hover:bg-navy-800/20"
                      >
                        <td className="px-3 py-3">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {attribution.organizationName || attribution.organizationId}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {attribution.partnerName || attribution.partnerOrgId}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-sm text-slate-600 dark:text-slate-500">
                            {attribution.attributionType?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {attribution.referralCodeUsed ? (
                            <code className="text-xs bg-navy-900 px-2 py-1 rounded text-primary-400">
                              {attribution.referralCodeUsed}
                            </code>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={cn(
                              'px-2 py-1 text-xs font-medium rounded-full',
                              attribution.status === 'ACTIVE' &&
                                'bg-emerald-500/20 text-emerald-400',
                              attribution.status === 'PENDING' && 'bg-amber-500/20 text-amber-400',
                              attribution.status === 'EXPIRED' &&
                                'bg-slate-500/20 text-slate-600 dark:text-slate-500'
                            )}
                          >
                            {attribution.status?.toLowerCase()}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-sm text-slate-600 dark:text-slate-500">
                            {attribution.attributedAt
                              ? new Date(attribution.attributedAt).toLocaleDateString()
                              : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-white rounded transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveAttribution(attribution.id)}
                              disabled={processing}
                              className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-danger-400 rounded transition-colors"
                              title="Remove attribution"
                            >
                              <Unlink className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Link2 className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">No attributions found</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Create a new attribution to link an organization with a partner
              </p>
            </div>
          )}
        </div>
      )}

      {/* GAP-PARTNER-004: Expiring Attributions Tab */}
      {activeTab === 'expiring' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Expiring Attributions & Discounts
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Partner discounts expiring within the selected timeframe
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={expiringDays}
                onChange={(e) => setExpiringDays(Number(e.target.value))}
                className="px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white"
              >
                <option value={7}>Next 7 days</option>
                <option value={14}>Next 14 days</option>
                <option value={30}>Next 30 days</option>
                <option value={60}>Next 60 days</option>
                <option value={90}>Next 90 days</option>
              </select>
              <button
                onClick={fetchData}
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10 rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {expiringAttributions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10">
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Organization
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Partner
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Discount
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Expires In
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Lifetime Value
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Commission Earned
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {expiringAttributions.map((attr) => (
                    <tr key={attr.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
                      <td className="px-3 py-3">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {attr.organizationName}
                        </span>
                        {attr.referralCodeUsed && (
                          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                            ({attr.referralCodeUsed})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-slate-700 dark:text-slate-300">
                          {attr.partnerName}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {attr.discountPercent ? (
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                            {attr.discountPercent}% off
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            'px-2 py-1 text-xs rounded-full',
                            attr.daysRemaining <= 7
                              ? 'bg-danger-500/20 text-danger-400'
                              : attr.daysRemaining <= 14
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-500/20 text-slate-600 dark:text-slate-500'
                          )}
                        >
                          {attr.daysRemaining} days
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-slate-900 dark:text-white font-medium">
                          €{attr.lifetimeValue.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-emerald-400">
                          €{attr.totalCommissionEarned.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                No expiring discounts in the selected timeframe
              </p>
            </div>
          )}
        </div>
      )}

      {/* GAP-PARTNER-003: Code Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary-400" />
                Referral Code Analytics
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Performance metrics per partner referral code (last 90 days)
              </p>
            </div>
            <button
              onClick={fetchData}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {codeAnalytics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10">
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Code
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Partner
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Clicks
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Signups
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Conv. Rate
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Active Orgs
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Revenue
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 uppercase">
                      Commissions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {codeAnalytics.map((code) => (
                    <tr
                      key={code.referralCode}
                      className="hover:bg-slate-50 dark:hover:bg-navy-800/20"
                    >
                      <td className="px-3 py-3">
                        <span className="font-mono text-sm px-2 py-1 bg-primary-500/20 text-primary-300 rounded">
                          {code.referralCode}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-slate-700 dark:text-slate-300">
                          {code.partnerName}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-slate-900 dark:text-white">
                          {code.totalClicks.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-slate-900 dark:text-white">
                          {code.totalSignups.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            code.conversionRate >= 20
                              ? 'text-emerald-400'
                              : code.conversionRate >= 10
                                ? 'text-amber-400'
                                : 'text-slate-600 dark:text-slate-500'
                          )}
                        >
                          {code.conversionRate}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                          {code.activeAttributions}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-slate-900 dark:text-white font-medium">
                          €{code.totalRevenue.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-emerald-400 font-medium">
                          €{code.totalCommissions.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">No code analytics data available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PartnerSettlementsView;
