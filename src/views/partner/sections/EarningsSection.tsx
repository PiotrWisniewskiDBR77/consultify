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

import { FilterableTable, type FilterChip } from '@/components/shared/ModuleHub';
import { EntityStatusChip } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerCommissionTransaction,
  type V8PartnerEarningsSummary,
  type V8PartnerPayoutAccount,
  type V8PartnerPayoutHistoryItem,
  type V8PartnerPayoutSettings,
  type V8PartnerProgramStatus,
} from '@/services/api/v8';
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

interface PayoutSettings {
  minimumThreshold: number;
  payoutMethod: 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE' | 'WISE';
  autoPayoutEnabled: boolean;
  payoutAccount: V8PartnerPayoutAccount | null;
}

interface EarningsSectionProps {
  subsection?: 'earnings' | 'statements' | 'payouts' | 'payout-settings';
}

const unwrapApiData = (response: any) => {
  const descriptor = response ? Object.getOwnPropertyDescriptor(response, 'data') : undefined;
  return descriptor?.value ?? response?.data ?? response;
};

const normalizeEarningsSummary = (payload: any): EarningsSummary | null => {
  const data = payload?.data && payload?.data !== payload ? payload.data : payload;
  if (!data) return null;

  return {
    totalEarned: data.totalEarned ?? data.totalEarnedYTD ?? 0,
    totalPending: data.totalPending ?? data.pendingApproval ?? 0,
    totalApproved: data.totalApproved ?? 0,
    totalPaid: data.totalPaid ?? data.totalPaidOut ?? 0,
    thisMonth: data.thisMonth ?? 0,
    thisMonthCount: data.thisMonthCount ?? 0,
    lastMonth: data.lastMonth ?? 0,
    readyForPayout: data.readyForPayout ?? 0,
    currency: data.currency ?? 'EUR',
  };
};

const normalizeCommissionTransaction = (payload: any): CommissionTransaction => ({
  id: String(payload?.id ?? ''),
  partnerOrgId: String(payload?.partnerOrgId ?? ''),
  organizationId: String(payload?.organizationId ?? ''),
  organizationName: payload?.organizationName ? String(payload.organizationName) : undefined,
  transactionType: String(payload?.transactionType ?? 'UNKNOWN'),
  transactionDate: String(payload?.transactionDate ?? ''),
  grossAmount: Number(payload?.grossAmount ?? 0),
  commissionRate: Number(payload?.commissionRate ?? 0),
  commissionAmount: Number(payload?.commissionAmount ?? 0),
  currency: String(payload?.currency ?? 'EUR'),
  status: String(payload?.status ?? 'PENDING'),
  approvedAt: payload?.approvedAt ? String(payload.approvedAt) : undefined,
  payoutId: payload?.payoutId ? String(payload.payoutId) : undefined,
  createdAt: String(payload?.createdAt ?? ''),
});

const normalizePayout = (payload: any): Payout => ({
  id: String(payload?.id ?? ''),
  periodStart: String(payload?.periodStart ?? ''),
  periodEnd: String(payload?.periodEnd ?? ''),
  grossAmount: Number(payload?.grossAmount ?? 0),
  fees: Number(payload?.fees ?? 0),
  netAmount: Number(payload?.netAmount ?? 0),
  currency: String(payload?.currency ?? 'EUR'),
  transactionCount: Number(payload?.transactionCount ?? 0),
  status: String(payload?.status ?? 'PENDING'),
  payoutMethod: payload?.payoutMethod ? String(payload.payoutMethod) : undefined,
  payoutReference: payload?.payoutReference ? String(payload.payoutReference) : undefined,
  requestedAt: String(payload?.requestedAt ?? ''),
  completedAt: payload?.completedAt ? String(payload.completedAt) : undefined,
});

const defaultPayoutSettings: PayoutSettings = {
  minimumThreshold: 100,
  payoutMethod: 'BANK_TRANSFER',
  autoPayoutEnabled: false,
  payoutAccount: {
    accountHolderName: '',
    iban: '',
    bicSwift: '',
    bankName: '',
  },
};

const normalizePayoutSettings = (payload: any): PayoutSettings => {
  const data =
    payload?.settings ??
    (payload?.data && payload.data !== payload ? payload.data : payload) ??
    defaultPayoutSettings;
  const payoutAccount = data?.payoutAccount ?? {};

  return {
    minimumThreshold: Number(data?.minimumThreshold ?? 100),
    payoutMethod: String(
      data?.payoutMethod ?? 'BANK_TRANSFER'
    ).toUpperCase() as PayoutSettings['payoutMethod'],
    // Automatic payout is deliberately outside the Partner workspace policy.
    // Ignore stale/legacy truthy values so this UI cannot persist or advertise it.
    autoPayoutEnabled: false,
    payoutAccount: {
      accountHolderName: String(payoutAccount?.accountHolderName ?? ''),
      iban: String(payoutAccount?.iban ?? ''),
      bicSwift: String(payoutAccount?.bicSwift ?? ''),
      bankName: String(payoutAccount?.bankName ?? ''),
    },
  };
};

const normalizeProgramStatus = (payload: V8PartnerProgramStatus | null | undefined) =>
  payload ?? null;

export const EarningsSection: React.FC<EarningsSectionProps> = ({ subsection = 'earnings' }) => {
  const { t, i18n } = useTranslation();
  const fmtDate = (iso: string | undefined) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [v8Summary, setV8Summary] = useState<V8PartnerEarningsSummary | null>(null);
  const [programStatus, setProgramStatus] = useState<V8PartnerProgramStatus | null>(null);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  // Canon §5 — per-column filters (status). Source data unchanged.
  const [txFilters, setTxFilters] = useState<FilterChip[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [activeTab, setActiveTab] = useState<'statements' | 'payments'>('statements');
  const [bankInfoComplete, setBankInfoComplete] = useState(true);
  const [nextPaymentDate, setNextPaymentDate] = useState<string | null>(null);
  const [payoutSettings, setPayoutSettings] = useState<PayoutSettings>(defaultPayoutSettings);
  const [savingPayoutSettings, setSavingPayoutSettings] = useState(false);

  // Single currency formatter driven by API-provided currency code.
  // Falls back to the summary currency, the first payout/transaction currency,
  // then 'EUR' only if nothing else is available.
  const activeCurrency =
    summary?.currency || payouts[0]?.currency || transactions[0]?.currency || 'EUR';

  const formatCurrency = useCallback(
    (amount: number | null | undefined, currency?: string) => {
      const code = currency || activeCurrency || 'EUR';
      const value = amount ?? 0;
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: code,
          maximumFractionDigits: 0,
        }).format(value);
      } catch {
        // Invalid/unknown ISO code — degrade gracefully to "<CODE> <number>".
        return `${code} ${value.toLocaleString()}`;
      }
    },
    [activeCurrency]
  );

  // Real month-over-month change derived from the earnings summary in state.
  const monthOverMonthChange = (() => {
    const current = summary?.thisMonth ?? 0;
    const previous = summary?.lastMonth ?? 0;
    if (!previous) return null;
    return ((current - previous) / previous) * 100;
  })();

  const getCommissionTransactionsWithFallback = useCallback(async (): Promise<
    CommissionTransaction[]
  > => {
    try {
      const response = await V8PartnerApi.getCommissionTransactions();
      return Array.isArray(response?.transactions)
        ? response.transactions.map((tx: V8PartnerCommissionTransaction) =>
            normalizeCommissionTransaction(tx)
          )
        : [];
    } catch (error) {
      if (!shouldFallbackToLegacyPartner(error)) {
        throw error;
      }
      const response = await Api.get('/api/partners/commission-transactions');
      const legacyTransactions = unwrapApiData(response);
      return response?.success && Array.isArray(legacyTransactions)
        ? legacyTransactions.map((tx: CommissionTransaction) => normalizeCommissionTransaction(tx))
        : [];
    }
  }, []);

  const getPayoutsWithFallback = useCallback(async (): Promise<Payout[]> => {
    try {
      const response = await V8PartnerApi.getPayouts();
      return Array.isArray(response?.payouts)
        ? response.payouts.map((payout: V8PartnerPayoutHistoryItem) => normalizePayout(payout))
        : [];
    } catch (error) {
      if (!shouldFallbackToLegacyPartner(error)) {
        throw error;
      }
      const response = await Api.get('/api/partners/payouts');
      const legacyPayouts = unwrapApiData(response);
      return response?.success && Array.isArray(legacyPayouts)
        ? legacyPayouts.map((payout: Payout) => normalizePayout(payout))
        : [];
    }
  }, []);

  const getPayoutSettingsWithFallback = useCallback(async (): Promise<PayoutSettings> => {
    try {
      const response = await V8PartnerApi.getPayoutSettings();
      return normalizePayoutSettings(response?.settings);
    } catch (error) {
      if (!shouldFallbackToLegacyPartner(error)) {
        throw error;
      }
      const response = await Api.get('/api/partners/payout-settings');
      return normalizePayoutSettings(unwrapApiData(response) ?? response);
    }
  }, []);

  const getEarningsSummaryWithFallback = useCallback(async (): Promise<{
    earnings: V8PartnerEarningsSummary | EarningsSummary;
  }> => {
    try {
      return await V8PartnerApi.getEarningsSummary();
    } catch (error) {
      if (!shouldFallbackToLegacyPartner(error)) {
        throw error;
      }
      const response = await Api.get('/api/partners/earnings');
      const legacy = unwrapApiData(response) ?? response?.earnings ?? response;
      return { earnings: legacy };
    }
  }, []);

  const savePayoutSettingsWithFallback = useCallback(async (settings: PayoutSettings) => {
    const governedSettings = { ...settings, autoPayoutEnabled: false };
    try {
      const response = await V8PartnerApi.updatePayoutSettings(governedSettings);
      return normalizePayoutSettings(response?.settings);
    } catch (error) {
      if (!shouldFallbackToLegacyPartner(error)) {
        throw error;
      }
      const response = await Api.put('/api/partners/payout-settings', governedSettings);
      return normalizePayoutSettings(unwrapApiData(response) ?? response);
    }
  }, []);

  // Fetch earnings data from API
  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [summaryResponse, txResponse, payoutsResponse, programResponse] =
        await Promise.allSettled([
          getEarningsSummaryWithFallback(),
          getCommissionTransactionsWithFallback(),
          getPayoutsWithFallback(),
          V8PartnerApi.getProgramStatus(),
        ]);

      if (summaryResponse.status === 'fulfilled') {
        const normalizedSummary = normalizeEarningsSummary(summaryResponse.value?.earnings);
        if (normalizedSummary) {
          setSummary(normalizedSummary);
          setV8Summary(summaryResponse.value?.earnings ?? null);
          setNextPaymentDate(null);
        }
      }

      if (txResponse.status === 'fulfilled') {
        setTransactions(Array.isArray(txResponse.value) ? txResponse.value : []);
      } else {
        setTransactions([]);
      }

      if (payoutsResponse.status === 'fulfilled') {
        setPayouts(Array.isArray(payoutsResponse.value) ? payoutsResponse.value : []);
      } else {
        setPayouts([]);
      }

      if (programResponse.status === 'fulfilled') {
        const normalizedProgramStatus = normalizeProgramStatus(programResponse.value);
        setProgramStatus(normalizedProgramStatus);
        setBankInfoComplete(Boolean(normalizedProgramStatus?.payoutSettingsComplete));
      } else {
        setProgramStatus(null);
        setBankInfoComplete(false);
      }

      if (
        summaryResponse.status !== 'fulfilled' ||
        !normalizeEarningsSummary(summaryResponse.value?.earnings)
      ) {
        throw new Error(t('partner.earnings.loadError', 'Failed to load earnings data'));
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
  }, [
    getCommissionTransactionsWithFallback,
    getEarningsSummaryWithFallback,
    getPayoutsWithFallback,
    t,
  ]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  useEffect(() => {
    if (subsection === 'statements') {
      setActiveTab('statements');
    }
  }, [subsection]);

  useEffect(() => {
    if (subsection !== 'payout-settings') {
      return;
    }

    let cancelled = false;

    const loadPayoutSettings = async () => {
      try {
        const settings = await getPayoutSettingsWithFallback();
        if (!cancelled) {
          setPayoutSettings(settings);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching payout settings:', err);
        }
      }
    };

    void loadPayoutSettings();

    return () => {
      cancelled = true;
    };
  }, [getPayoutSettingsWithFallback, subsection]);

  const renderV8SummaryBlock = () => {
    if (!v8Summary) return null;

    return (
      <div className="bg-c-surface rounded-xl border border-primary-200 dark:border-primary-900/40 p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              {t('partner.earnings.v8RuntimeTitle', 'V8 Earnings Summary')}
            </h3>
            <p className="text-sm text-c-text-muted mt-1">
              {t(
                'partner.earnings.v8RuntimeSubtitle',
                'Governed partner payout readiness and earnings totals from the V8 namespace.'
              )}
            </p>
            {programStatus && (
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-300">
                {`Lifecycle: ${programStatus.lifecyclePhase}`}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: t('partner.earnings.v8TotalEarned', 'Governed total earned'),
              value: `${v8Summary.currency ?? 'EUR'} ${(v8Summary.totalEarned ?? 0).toLocaleString()}`,
              // `totalPaid` is now projected from the same settled-payout
              // register the Payouts list renders, so this can no longer read
              // "0 paid" above a COMPLETED payout.
              detail: `${v8Summary.currency ?? 'EUR'} ${(v8Summary.totalPaid ?? 0).toLocaleString()} ${t('partner.earnings.paidSuffix', 'wypłacone')}`,
            },
            {
              label: t('partner.earnings.v8ThisMonth', 'Governed this month'),
              value: `${v8Summary.currency ?? 'EUR'} ${(v8Summary.thisMonth ?? 0).toLocaleString()}`,
              detail: `${v8Summary.thisMonthCount ?? 0} items`,
            },
            {
              label: t('partner.earnings.v8Pending', 'Governed pending'),
              value: `${v8Summary.currency ?? 'EUR'} ${(v8Summary.totalPending ?? 0).toLocaleString()}`,
              detail: `${v8Summary.totalApproved ?? 0} approved`,
            },
            {
              label: t('partner.earnings.v8ReadyForPayout', 'Governed ready for payout'),
              value: `${programStatus?.balances.currency ?? v8Summary.currency ?? 'EUR'} ${(
                programStatus?.balances.availableToPayout ??
                v8Summary.readyForPayout ??
                0
              ).toLocaleString()}`,
              detail:
                programStatus?.hold && programStatus.hold.amount > 0
                  ? `Hold: ${programStatus.hold.amount}`
                  : `${v8Summary.lastMonth ?? 0} last month`,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-c-border-subtle/60 bg-c-surface-raised/40 p-4"
            >
              <div className="text-xs uppercase tracking-wide text-c-text-muted">{card.label}</div>
              <div className="mt-2 text-2xl font-semibold text-c-text">{card.value}</div>
              <div className="mt-1 text-sm text-c-text-muted">{card.detail}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Export commission statements to CSV (client-side, no server dependency).
  const handleExportCsv = () => {
    if (!transactions.length) {
      toast.error(t('partner.earnings.noDataToExport', 'No transactions to export'));
      return;
    }
    const escapeCsv = (val: unknown): string => {
      const s = String(val ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [
      'Customer',
      'Type',
      'Gross Amount',
      'Currency',
      'Commission Rate (%)',
      'Commission Amount',
      'Status',
      'Date',
    ];
    const rows = transactions.map((tx) => [
      tx.organizationName || tx.organizationId,
      tx.transactionType,
      tx.grossAmount ?? 0,
      tx.currency || 'EUR',
      tx.commissionRate ?? 0,
      tx.commissionAmount ?? 0,
      tx.status,
      tx.transactionDate || tx.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    // Prepend UTF-8 BOM so Excel reads accented characters correctly.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    link.download = `consultify-commissions-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(
      t('partner.earnings.exported', 'Exported {{n}} transactions', { n: transactions.length })
    );
  };

  // Request payout via API
  const handleRequestPayout = async () => {
    if (!summary || summary.readyForPayout < 100) {
      toast.error(
        t('partner.earnings.minimumNotReached', 'Minimalna kwota wypłaty to {{amount}}', {
          amount: formatCurrency(100),
        })
      );
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
      const response = await V8PartnerApi.requestPayout({
        amount: summary.readyForPayout,
      });

      if (response?.payout) {
        toast.success(t('partner.earnings.payoutRequested', 'Payout request submitted!'));
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

  const updatePayoutAccountField = (
    field: keyof NonNullable<PayoutSettings['payoutAccount']>,
    value: string
  ) => {
    setPayoutSettings((prev) => ({
      ...prev,
      payoutAccount: {
        ...(prev.payoutAccount || defaultPayoutSettings.payoutAccount!),
        [field]: value,
      },
    }));
  };

  const handleSavePayoutSettings = async () => {
    try {
      setSavingPayoutSettings(true);
      await savePayoutSettingsWithFallback(payoutSettings);
      const readBack = await getPayoutSettingsWithFallback();
      setPayoutSettings(readBack);
      toast.success(t('partner.payoutSettings.saved', 'Payout settings updated'));
    } catch (err: any) {
      console.error('Error saving payout settings:', err);
      toast.error(t('partner.payoutSettings.saveFailed', 'Failed to update payout settings'));
    } finally {
      setSavingPayoutSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-4 rounded-full bg-danger-500/10 mb-4">
          <DollarSign className="w-8 h-8 text-danger-400" />
        </div>
        <p className="text-c-text-secondary mb-4">{error}</p>
        <button
          onClick={fetchEarnings}
          className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors"
        >
          {t('common.retry', 'Try Again')}
        </button>
      </div>
    );
  }

  // Earnings Overview (main subsection)
  if (subsection === 'earnings' || subsection === 'statements') {
    return (
      <div className="space-y-6">
        {renderV8SummaryBlock()}

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
                  <div className="text-sm text-amber-300">
                    {t(
                      'partner.earnings.bankInfoRuntimeNotice',
                      'Use the governed payout settings surface to keep payout details up to date.'
                    )}
                  </div>
                </div>
                {programStatus?.whatNext?.length ? (
                  <div className="mt-3 text-xs text-amber-200">{programStatus.whatNext[0]}</div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Header with Next Payment Date */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-c-text">
              {subsection === 'statements'
                ? t('partner.earnings.statementsHeading', 'Wyciągi prowizyjne')
                : t('partner.earnings.title', 'Prowizja partnerska')}
            </h2>
            <p className="text-c-text-secondary">
              {subsection === 'statements'
                ? t(
                    'partner.earnings.statementsSubtitle',
                    'Wyciągi i historia rozliczeń prowizji w ujęciu okresowym'
                  )
                : t('partner.earnings.subtitle', 'Śledź swoje przychody i prowizje')}
            </p>
          </div>
          {nextPaymentDate && (
            <div className="text-right">
              <p className="text-xs text-c-text-secondary uppercase tracking-wide">
                {t('partner.earnings.nextPayment', 'NEXT COMMISSION PAYMENT')}
              </p>
              <p className="text-lg font-semibold text-c-text">{nextPaymentDate}</p>
            </div>
          )}
        </div>

        {/* Statements / Payments Tabs - HubSpot style */}
        <div className="flex items-center justify-between border-b border-c-border-subtle dark:border-white/10 pb-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('statements')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'statements'
                  ? 'text-c-text border-primary-500'
                  : 'text-c-text-secondary border-transparent hover:text-c-text dark:hover:text-white'
              )}
            >
              {t('partner.earnings.statements', 'Statements')}
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'payments'
                  ? 'text-c-text border-primary-500'
                  : 'text-c-text-secondary border-transparent hover:text-c-text dark:hover:text-white'
              )}
            >
              {t('partner.earnings.payments', 'Payments')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="text-sm text-c-text-muted flex items-center gap-1"
              title={t(
                'partner.earnings.commissionDocsUnavailable',
                'Commission help links return only when a governed partner help contract lands.'
              )}
            >
              <HelpCircle className="w-4 h-4" />
              {t('partner.earnings.howItWorksUnavailable', 'Commission help routing unavailable')}
            </div>
            <button
              disabled
              title={t(
                'partner.earnings.ticketUnavailable',
                'Commission inquiry routing is intentionally disabled until a governed partner-user contract exists.'
              )}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-c-text-muted rounded-lg text-sm font-medium flex items-center gap-2 cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              {t(
                'partner.earnings.submitTicketUnavailable',
                'Commission inquiry routing unavailable'
              )}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-sm text-c-text-secondary">
                {t('partner.earnings.totalEarnedYtd', 'Łącznie zarobione (od początku roku)')}
              </span>
            </div>
            <p className="text-2xl font-bold text-c-text">{formatCurrency(summary?.totalEarned)}</p>
            {monthOverMonthChange !== null && (
              <div
                className={cn(
                  'flex items-center gap-1 mt-1 text-sm',
                  monthOverMonthChange >= 0 ? 'text-emerald-400' : 'text-danger-400'
                )}
              >
                {monthOverMonthChange >= 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                <span>
                  {t('partner.earnings.momChange', '{{value}}% mies./mies.', {
                    value: `${monthOverMonthChange >= 0 ? '+' : ''}${monthOverMonthChange.toFixed(1)}`,
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary-500/20">
                <TrendingUp className="w-5 h-5 text-primary-400" />
              </div>
              <span className="text-sm text-c-text-secondary">
                {t('partner.earnings.thisMonth', 'W tym miesiącu')}
              </span>
            </div>
            <p className="text-2xl font-bold text-c-text">{formatCurrency(summary?.thisMonth)}</p>
            <p className="text-sm text-c-text-muted mt-1">
              {t('partner.earnings.fromReferrals', 'Z {{n}} poleceń', {
                n: summary?.thisMonthCount ?? 0,
              })}
            </p>
          </div>

          <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-c-text-secondary">
                {t('partner.earnings.pendingApproval', 'Oczekuje na zatwierdzenie')}
              </span>
            </div>
            <p className="text-2xl font-bold text-c-text">
              {formatCurrency(summary?.totalPending)}
            </p>
            <p className="text-sm text-c-text-muted mt-1">
              {t('partner.earnings.processing', 'Przetwarzanie...')}
            </p>
          </div>

          <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Banknote className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-c-text-secondary">
                {t('partner.earnings.readyForPayout', 'Gotowe do wypłaty')}
              </span>
            </div>
            <p className="text-2xl font-bold text-c-text">
              {formatCurrency(summary?.readyForPayout)}
            </p>
            <button
              onClick={handleRequestPayout}
              disabled={requestingPayout || (summary?.readyForPayout || 0) < 100}
              className={cn(
                'mt-2 px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                (summary?.readyForPayout || 0) >= 100
                  ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]'
                  : 'bg-slate-200 dark:bg-slate-700 text-c-text-muted cursor-not-allowed'
              )}
            >
              {requestingPayout
                ? t('partner.earnings.requesting', 'Wysyłanie...')
                : t('partner.earnings.requestPayout', 'Zażądaj wypłaty')}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'statements' ? (
          /* Statements Tab - Recent Transactions */
          <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-c-text">
                {t('partner.earnings.recentTransactions', 'Recent Commission Statements')}
              </h3>
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300"
              >
                <Download className="w-4 h-4" />
                {t('common.exportCSV', 'Export CSV')}
              </button>
            </div>

            <FilterableTable
              canvasClassName="p-0"
              persistKey="partner.earnings.transactions"
              columns={[
                {
                  id: 'organizationName',
                  label: t('partner.earnings.col.customer', 'Customer'),
                  render: (tx) => (
                    <span className="font-medium text-c-text truncate block">
                      {tx.organizationName}
                    </span>
                  ),
                },
                {
                  id: 'transactionType',
                  label: t('partner.earnings.col.type', 'Type'),
                  width: '140px',
                  render: (tx) => (
                    <span className="text-sm text-c-text-secondary capitalize">
                      {String(tx.transactionType).toLowerCase().replace('_', ' ')}
                    </span>
                  ),
                },
                {
                  id: 'grossAmount',
                  label: t('partner.earnings.col.amount', 'Amount'),
                  width: '120px',
                  align: 'right',
                  render: (tx) => (
                    <span className="text-sm text-c-text-secondary">
                      {formatCurrency(tx.grossAmount, tx.currency)}
                    </span>
                  ),
                },
                {
                  id: 'commissionAmount',
                  label: t('partner.earnings.col.commission', 'Commission'),
                  width: '150px',
                  align: 'right',
                  render: (tx) => (
                    <span>
                      <span className="font-medium text-c-success">
                        {formatCurrency(tx.commissionAmount, tx.currency)}
                      </span>
                      <span className="text-xs text-c-text-muted ml-1">({tx.commissionRate}%)</span>
                    </span>
                  ),
                },
                {
                  id: 'status',
                  label: t('partner.earnings.col.status', 'Status'),
                  width: '130px',
                  filterable: true,
                  filterOptions: [
                    { value: 'PAID', label: t('partner.earnings.status.paid', 'Paid') },
                    {
                      value: 'APPROVED',
                      label: t('partner.earnings.status.approved', 'Approved'),
                    },
                    { value: 'PENDING', label: t('partner.earnings.status.pending', 'Pending') },
                  ],
                  render: (tx) => <EntityStatusChip status={String(tx.status)} />,
                },
                {
                  id: 'transactionDate',
                  label: t('partner.earnings.col.date', 'Date'),
                  width: '130px',
                  render: (tx) => (
                    <span className="text-sm text-c-text-secondary">
                      {fmtDate(tx.transactionDate)}
                    </span>
                  ),
                },
              ]}
              data={transactions.map((tx) => ({ ...tx, id: tx.id }))}
              activeFilters={txFilters}
              onFilterChange={setTxFilters}
              hideRowActions
              emptyMessage={t('partner.earnings.noStatements', "We couldn't find any statements")}
            />
          </div>
        ) : (
          /* Payments Tab - Payout History */
          <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-c-text">
                {t('partner.earnings.paymentHistory', 'Payment History')}
              </h3>
              <p className="text-sm text-c-text-secondary mt-1">
                {t(
                  'partner.earnings.paymentHistoryDesc',
                  'A list of payments made from Consultify to your organization.'
                )}
              </p>
            </div>

            {payouts.length > 0 ? (
              <div className="space-y-4">
                {payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between p-4 bg-c-surface-raised/50 rounded-lg border border-c-border-subtle dark:border-white/5"
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
                        <p className="font-medium text-c-text">
                          {formatCurrency(payout.netAmount, payout.currency)}
                        </p>
                        <p className="text-sm text-c-text-secondary">
                          {payout.transactionCount} transactions • {fmtDate(payout.periodStart)} to{' '}
                          {fmtDate(payout.periodEnd)}
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
                        <p className="text-xs text-c-text-muted mt-1">
                          Completed {fmtDate(payout.completedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Banknote className="w-12 h-12 text-c-text-secondary mx-auto mb-3" />
                <p className="text-c-text-secondary">
                  {t('partner.earnings.noPayments', "We couldn't find any payments to show.")}
                </p>
                <p className="text-sm text-c-text-muted mt-1">
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
        {renderV8SummaryBlock()}

        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-c-text">
            {t('partner.payouts.title', 'Payout History')}
          </h2>
          <p className="text-c-text-secondary">
            {t('partner.payouts.subtitle', 'View your past and pending payouts')}
          </p>
        </div>

        {/* Payout List */}
        {payouts.length > 0 ? (
          <div className="space-y-4">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4"
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
                      <p className="font-medium text-c-text">
                        {formatCurrency(payout.netAmount, payout.currency)}
                      </p>
                      <p className="text-sm text-c-text-secondary">
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
                      <p className="text-xs text-c-text-muted mt-1">
                        Completed {payout.completedAt}
                      </p>
                    )}
                    {payout.payoutReference && (
                      <p className="text-xs text-c-text-muted">Ref: {payout.payoutReference}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Banknote className="w-12 h-12 text-c-text-secondary mx-auto mb-3" />
            <p className="text-c-text-secondary">{t('partner.payouts.empty', 'No payouts yet')}</p>
            <p className="text-sm text-c-text-muted mt-1">
              {t(
                'partner.payouts.emptyDesc',
                'Your payout history will appear here after payout processing.'
              )}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Payout Settings subsection
  return (
    <div className="space-y-6">
      {renderV8SummaryBlock()}

      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-c-text">
          {t('partner.payoutSettings.title', 'Payout Settings')}
        </h2>
        <p className="text-c-text-secondary">
          {t(
            'partner.payoutSettings.subtitle',
            'Configure your payout preferences and bank details'
          )}
        </p>
      </div>

      {/* Payout Method */}
      <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4">
        <h3 className="text-lg font-semibold text-c-text mb-4">Payout Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() =>
              setPayoutSettings((prev) => ({ ...prev, payoutMethod: 'BANK_TRANSFER' }))
            }
            className={cn(
              'p-4 rounded-xl border-2 text-left',
              payoutSettings.payoutMethod === 'BANK_TRANSFER'
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-c-border-subtle dark:border-white/10 hover:border-c-border dark:hover:border-white/20'
            )}
          >
            <Wallet className="w-6 h-6 text-primary-400 mb-2" />
            <p className="font-medium text-c-text">Bank Transfer</p>
            <p className="text-xs text-c-text-secondary">Direct to your bank account</p>
          </button>
          <button
            onClick={() => setPayoutSettings((prev) => ({ ...prev, payoutMethod: 'PAYPAL' }))}
            className={cn(
              'p-4 rounded-xl border text-left',
              payoutSettings.payoutMethod === 'PAYPAL'
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-c-border-subtle dark:border-white/10 hover:border-c-border dark:hover:border-white/20'
            )}
          >
            <DollarSign className="w-6 h-6 text-c-text-secondary mb-2" />
            <p className="font-medium text-c-text-secondary">PayPal</p>
            <p className="text-xs text-c-text-muted">PayPal business account</p>
          </button>
          <button
            onClick={() => setPayoutSettings((prev) => ({ ...prev, payoutMethod: 'STRIPE' }))}
            className={cn(
              'p-4 rounded-xl border text-left',
              payoutSettings.payoutMethod === 'STRIPE'
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-c-border-subtle dark:border-white/10 hover:border-c-border dark:hover:border-white/20'
            )}
          >
            <ExternalLink className="w-6 h-6 text-c-text-secondary mb-2" />
            <p className="font-medium text-c-text-secondary">Stripe</p>
            <p className="text-xs text-c-text-muted">Stripe Connect</p>
          </button>
        </div>
      </div>

      {/* Bank Details */}
      <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4">
        <h3 className="text-lg font-semibold text-c-text mb-4">Bank Account Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-c-text-secondary mb-1 block">Account Holder Name</label>
            <input
              type="text"
              value={payoutSettings.payoutAccount?.accountHolderName ?? ''}
              onChange={(e) => updatePayoutAccountField('accountHolderName', e.target.value)}
              className="w-full px-4 py-2 bg-c-surface border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text"
            />
          </div>
          <div>
            <label className="text-sm text-c-text-secondary mb-1 block">IBAN</label>
            <input
              type="text"
              value={payoutSettings.payoutAccount?.iban ?? ''}
              onChange={(e) => updatePayoutAccountField('iban', e.target.value)}
              className="w-full px-4 py-2 bg-c-surface border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text"
            />
          </div>
          <div>
            <label className="text-sm text-c-text-secondary mb-1 block">BIC/SWIFT</label>
            <input
              type="text"
              value={payoutSettings.payoutAccount?.bicSwift ?? ''}
              onChange={(e) => updatePayoutAccountField('bicSwift', e.target.value)}
              className="w-full px-4 py-2 bg-c-surface border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text"
            />
          </div>
          <div>
            <label className="text-sm text-c-text-secondary mb-1 block">Bank Name</label>
            <input
              type="text"
              value={payoutSettings.payoutAccount?.bankName ?? ''}
              onChange={(e) => updatePayoutAccountField('bankName', e.target.value)}
              className="w-full px-4 py-2 bg-c-surface border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSavePayoutSettings}
            disabled={savingPayoutSettings}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {savingPayoutSettings ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Payout Preferences */}
      <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle dark:border-white/5 p-4">
        <h3 className="text-lg font-semibold text-c-text mb-4">Payout Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-c-text">Minimum Payout Threshold</p>
              <p className="text-sm text-c-text-secondary">
                Minimum amount before requesting payout
              </p>
            </div>
            <select
              value={String(payoutSettings.minimumThreshold)}
              onChange={(e) =>
                setPayoutSettings((prev) => ({
                  ...prev,
                  minimumThreshold: Number(e.target.value),
                }))
              }
              className="px-3 py-2 bg-c-surface border border-c-border-subtle dark:border-white/10 rounded-lg text-c-text"
            >
              <option value="100">€100</option>
              <option value="250">€250</option>
              <option value="500">€500</option>
              <option value="1000">€1,000</option>
            </select>
          </div>
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-500/10"
            role="note"
          >
            <div>
              <p className="font-medium text-c-text">Manual payout requests only</p>
              <p className="mt-1 text-sm text-c-text-secondary">
                Automatic payout and self-approval are unavailable. Requests require independent
                review outside the Partner workspace.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EarningsSection;
