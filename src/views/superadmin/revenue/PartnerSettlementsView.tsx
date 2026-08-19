/**
 * PartnerSettlementsView - SuperAdmin Partner Commission Settlements
 *
 * Features:
 * - Overview of all partner commissions
 * - Approve pending commissions
 * - Process and complete payouts
 * - Attribution manager (manual org-partner linking)
 * - Expiring attributions & discounts
 * - Referral code analytics
 *
 * Part of SuperAdmin Revenue Module.
 *
 * Kanon TRIADA: 4 z 5 zakładek renderują listy encji (Commissions/Attribution/
 * Expiring/Analytics) → StandardModuleBar (Menu 2 tabs + search/CTA/bulk) +
 * StandardTable + StandardPreview per zakładka. Zakładka Payouts to karty
 * procesu (proces zatwierdzania), nie lista encji — poza zakresem kanonu list,
 * bez zmian.
 */

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  Check,
  CheckCircle,
  Clock,
  DollarSign,
  Link2,
  Plus,
  RefreshCw,
  TrendingUp,
  Unlink,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/shared/states';
import {
  StandardModuleBar,
  StandardPreview,
  type StandardPreviewActions,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
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

// Neutral identity chip (canon §4.0a) — dot + text, never a crimson/colored fill.
const NEUTRAL_CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-c-border bg-c-surface-raised px-2 py-0.5 text-xs font-medium text-c-text-secondary';

const ATTRIBUTION_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'EXPIRED', label: 'Expired' },
];

const formatDate = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

// ── FIX (odkryte podczas migracji, blokowało render — realny bug produkcyjny) ──
// `Api.get()` (services/api.ts `toAxiosLikeResponse`) proxuje surowy JSON tak,
// że `response.data` alias-uje CAŁY body (kompatybilność "axios style:
// response.data.success"), NIE zagnieżdżone pole `data`. Backend tego
// modułu (server/src/routes/partners.routes.ts) odpowiada `{success, data}`,
// więc realna wartość to `response.data.data` — poprzedni kod robił
// `setX(res.data)` i zapisywał CAŁY obiekt `{success,data}` zamiast tablicy,
// co wywalało `.map is not a function` na każdej z 5 zakładek. Odkryte
// wizualnie przy weryfikacji tej migracji (zero danych = strona zawsze pusta/
// crashowała w produkcji, niezależnie od kanonu tabel).
const unwrapApiData = <T,>(res: any): T | undefined => {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T | undefined;
};

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
  const [commissionSearch, setCommissionSearch] = useState('');
  const [attributionSearch, setAttributionSearch] = useState('');
  const [expiringDays, setExpiringDays] = useState(30);

  // Per-tabela lejki kolumn (StandardTable/FilterableTable) — niezależne per zakładka.
  const [commissionFilters, setCommissionFilters] = useState<
    { id: string; column: string; value: string; label: string }[]
  >([]);
  const [attributionFilters, setAttributionFilters] = useState<
    { id: string; column: string; value: string; label: string }[]
  >([]);

  // Preview panel — jeden aktywny podglad na zakladke (rozne encje per tab).
  const [previewCommissionId, setPreviewCommissionId] = useState<string | null>(null);
  const [previewAttributionId, setPreviewAttributionId] = useState<string | null>(null);
  const [previewExpiringId, setPreviewExpiringId] = useState<string | null>(null);
  const [previewAnalyticsCode, setPreviewAnalyticsCode] = useState<string | null>(null);

  // Fetch data from API. Kazdy fetch niezalezny (Promise.allSettled) — jeden
  // endpoint 503/nieudany (np. attributions bywa "feature unavailable" na
  // backendzie) NIE moze ubijac pozostalych 5 zakladek (poprzednio jeden
  // sekwencyjny try/catch przerywal caly lancuch na pierwszym bledzie).
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [summaryR, commissionsR, payoutsR, attributionsR, expiringR, analyticsR] =
      await Promise.allSettled([
        Api.get('/api/superadmin/partner-settlements/summary'),
        Api.get('/api/superadmin/partner-settlements/pending-commissions'),
        Api.get('/api/superadmin/partner-settlements/pending-payouts'),
        Api.get('/api/superadmin/partner-settlements/attributions'),
        Api.get(`/api/superadmin/partner-settlements/expiring-attributions?days=${expiringDays}`),
        Api.get('/api/superadmin/partner-settlements/code-analytics?days=90'),
      ]);

    if (summaryR.status === 'fulfilled' && summaryR.value?.success) {
      setSummary(unwrapApiData<SettlementsSummary>(summaryR.value) ?? null);
    }
    if (commissionsR.status === 'fulfilled' && commissionsR.value?.success) {
      setCommissions(unwrapApiData<PendingCommission[]>(commissionsR.value) ?? []);
    }
    if (payoutsR.status === 'fulfilled' && payoutsR.value?.success) {
      setPayouts(unwrapApiData<PendingPayout[]>(payoutsR.value) ?? []);
    }
    if (attributionsR.status === 'fulfilled' && attributionsR.value?.success) {
      setAttributions(unwrapApiData<Attribution[]>(attributionsR.value) ?? []);
    }
    if (expiringR.status === 'fulfilled' && expiringR.value?.success) {
      setExpiringAttributions(unwrapApiData<ExpiringAttribution[]>(expiringR.value) ?? []);
    }
    if (analyticsR.status === 'fulfilled' && analyticsR.value?.success) {
      setCodeAnalytics(unwrapApiData<CodeAnalytics[]>(analyticsR.value) ?? []);
    }

    const firstRejected = [
      summaryR,
      commissionsR,
      payoutsR,
      attributionsR,
      expiringR,
      analyticsR,
    ].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (firstRejected) {
      console.error('Error fetching settlements:', firstRejected.reason);
      setError(firstRejected.reason?.message || 'Failed to load data');
    }

    setLoading(false);
  }, [expiringDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // AMD-PRT-ECONOMICS-002: this surface is historical read-only. Economic
  // commands are deliberately absent from the client, not merely allowed to
  // fail with the server's 410 policy response.

  // ── Zakladka Commissions: filtrowanie + wiersze + kolumny + kebab ─────────
  const filteredCommissions = useMemo(() => {
    if (!commissionSearch.trim()) return commissions;
    const q = commissionSearch.toLowerCase();
    return commissions.filter(
      (c) =>
        c.partnerName?.toLowerCase().includes(q) || c.organizationName?.toLowerCase().includes(q)
    );
  }, [commissions, commissionSearch]);

  const commissionRows = useMemo<TableRow[]>(
    () => filteredCommissions.map((c) => ({ ...c, id: c.id })),
    [filteredCommissions]
  );

  const previewCommission = previewCommissionId
    ? (commissions.find((c) => c.id === previewCommissionId) ?? null)
    : null;

  const commissionColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'partnerName',
        label: 'Partner',
        sortable: true,
        render: (row: TableRow) => (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-c-text-muted" />
            <span className="font-medium text-c-text">{row.partnerName as string}</span>
          </div>
        ),
      },
      {
        id: 'organizationName',
        label: 'Customer',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text-secondary">{row.organizationName as string}</span>
        ),
      },
      {
        id: 'transactionType',
        label: 'Type',
        width: '120px',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-sm text-c-text-secondary capitalize">
            {String(row.transactionType || '').toLowerCase()}
          </span>
        ),
      },
      {
        id: 'grossAmount',
        label: 'Amount',
        width: '120px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text-secondary">
            €{(row.grossAmount as number).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'commissionAmount',
        label: 'Commission',
        width: '140px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => (
          <span>
            <span className="font-medium text-emerald-400">
              €{(row.commissionAmount as number).toLocaleString()}
            </span>
            <span className="text-xs text-c-text-muted ml-1">({row.commissionRate}%)</span>
          </span>
        ),
      },
      {
        id: 'transactionDate',
        label: 'Date',
        width: '120px',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-sm text-c-text-secondary">{row.transactionDate as string}</span>
        ),
      },
    ],
    []
  );

  const commissionRowMenu = useCallback((row: TableRow): StandardRowMenu => {
    const commission = row as unknown as PendingCommission;
    return {
      universalHandlers: {
        preview: () => setPreviewCommissionId(commission.id),
      },
      destructive: { note: 'Historical read-only under AMD-PRT-ECONOMICS-002' },
    };
  }, []);

  const commissionPreviewActions: StandardPreviewActions | undefined = undefined;

  // ── Zakladka Attribution: filtrowanie + wiersze + kolumny + kebab ────────
  const filteredAttributions = useMemo(() => {
    if (!attributionSearch.trim()) return attributions;
    const q = attributionSearch.toLowerCase();
    return attributions.filter(
      (a) =>
        a.organizationName?.toLowerCase().includes(q) || a.partnerName?.toLowerCase().includes(q)
    );
  }, [attributions, attributionSearch]);

  const attributionRows = useMemo<TableRow[]>(
    () => filteredAttributions.map((a) => ({ ...a, id: a.id })),
    [filteredAttributions]
  );

  const previewAttribution = previewAttributionId
    ? (attributions.find((a) => a.id === previewAttributionId) ?? null)
    : null;

  const attributionColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'organizationName',
        label: 'Organization',
        sortable: true,
        render: (row: TableRow) => (
          <span className="font-medium text-c-text">
            {(row.organizationName as string) || (row.organizationId as string)}
          </span>
        ),
      },
      {
        id: 'partnerName',
        label: 'Partner',
        sortable: true,
        render: (row: TableRow) => (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-c-text-muted" />
            <span className="text-c-text-secondary">
              {(row.partnerName as string) || (row.partnerOrgId as string)}
            </span>
          </div>
        ),
      },
      {
        id: 'attributionType',
        label: 'Type',
        width: '140px',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-sm text-c-text-secondary">
            {String(row.attributionType || '').replace('_', ' ')}
          </span>
        ),
      },
      {
        id: 'referralCodeUsed',
        label: 'Code Used',
        width: '130px',
        render: (row: TableRow) =>
          row.referralCodeUsed ? (
            <code className={NEUTRAL_CHIP}>{row.referralCodeUsed as string}</code>
          ) : (
            <span className="text-c-text-muted">—</span>
          ),
      },
      {
        id: 'status',
        label: 'Status',
        width: '110px',
        align: 'center',
        sortable: true,
        filterable: true,
        filterOptions: ATTRIBUTION_STATUS_OPTIONS,
        render: (row: TableRow) => (
          <span
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-full',
              row.status === 'ACTIVE' && 'bg-emerald-500/20 text-emerald-400',
              row.status === 'PENDING' && 'bg-amber-500/20 text-amber-400',
              row.status === 'EXPIRED' && 'bg-c-surface-raised text-c-text-secondary'
            )}
          >
            {String(row.status || '').toLowerCase()}
          </span>
        ),
      },
      {
        id: 'attributedAt',
        label: 'Date',
        width: '120px',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-sm text-c-text-secondary">
            {formatDate(row.attributedAt as string)}
          </span>
        ),
      },
    ],
    []
  );

  const attributionRowMenu = useCallback((row: TableRow): StandardRowMenu => {
    const attribution = row as unknown as Attribution;
    return {
      universalHandlers: {
        preview: () => setPreviewAttributionId(attribution.id),
      },
      destructive: { note: 'Historical read-only under AMD-PRT-ECONOMICS-002' },
    };
  }, []);

  const attributionPreviewActions: StandardPreviewActions | undefined = undefined;

  // ── Zakladka Expiring: wiersze + kolumny + kebab (read-only) ─────────────
  const expiringRows = useMemo<TableRow[]>(
    () => expiringAttributions.map((a) => ({ ...a, id: a.id })),
    [expiringAttributions]
  );

  const previewExpiring = previewExpiringId
    ? (expiringAttributions.find((a) => a.id === previewExpiringId) ?? null)
    : null;

  const expiringColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'organizationName',
        label: 'Organization',
        sortable: true,
        render: (row: TableRow) => (
          <span>
            <span className="font-medium text-c-text">{row.organizationName as string}</span>
            {row.referralCodeUsed ? (
              <span className="ml-2 text-xs text-c-text-muted">
                ({row.referralCodeUsed as string})
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'partnerName',
        label: 'Partner',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text-secondary">{row.partnerName as string}</span>
        ),
      },
      {
        id: 'discountPercent',
        label: 'Discount',
        width: '110px',
        align: 'center',
        sortable: true,
        render: (row: TableRow) =>
          row.discountPercent ? (
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
              {row.discountPercent as number}% off
            </span>
          ) : (
            <span className="text-c-text-muted">—</span>
          ),
      },
      {
        id: 'daysRemaining',
        label: 'Expires In',
        width: '110px',
        align: 'center',
        sortable: true,
        render: (row: TableRow) => {
          const days = row.daysRemaining as number;
          return (
            <span
              className={cn(
                'px-2 py-1 text-xs rounded-full',
                days <= 7
                  ? 'bg-danger-500/20 text-danger-400'
                  : days <= 14
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-c-surface-raised text-c-text-secondary'
              )}
            >
              {days} days
            </span>
          );
        },
      },
      {
        id: 'lifetimeValue',
        label: 'Lifetime Value',
        width: '140px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text font-medium">
            €{(row.lifetimeValue as number).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'totalCommissionEarned',
        label: 'Commission Earned',
        width: '150px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-emerald-400">
            €{(row.totalCommissionEarned as number).toLocaleString()}
          </span>
        ),
      },
    ],
    []
  );

  const expiringRowMenu = useCallback((row: TableRow): StandardRowMenu => {
    const attr = row as unknown as ExpiringAttribution;
    return {
      universalHandlers: {
        preview: () => setPreviewExpiringId(attr.id),
      },
    };
  }, []);

  // ── Zakladka Analytics: wiersze + kolumny + kebab (read-only) ────────────
  const analyticsRows = useMemo<TableRow[]>(
    () => codeAnalytics.map((c) => ({ ...c, id: c.referralCode })),
    [codeAnalytics]
  );

  const previewAnalytics = previewAnalyticsCode
    ? (codeAnalytics.find((c) => c.referralCode === previewAnalyticsCode) ?? null)
    : null;

  const analyticsColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'referralCode',
        label: 'Code',
        sortable: true,
        render: (row: TableRow) => (
          <code className={`${NEUTRAL_CHIP} font-mono`}>{row.referralCode as string}</code>
        ),
      },
      {
        id: 'partnerName',
        label: 'Partner',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text-secondary">{row.partnerName as string}</span>
        ),
      },
      {
        id: 'totalClicks',
        label: 'Clicks',
        width: '90px',
        align: 'center',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text">{(row.totalClicks as number).toLocaleString()}</span>
        ),
      },
      {
        id: 'totalSignups',
        label: 'Signups',
        width: '90px',
        align: 'center',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text">{(row.totalSignups as number).toLocaleString()}</span>
        ),
      },
      {
        id: 'conversionRate',
        label: 'Conv. Rate',
        width: '100px',
        align: 'center',
        sortable: true,
        render: (row: TableRow) => {
          const rate = row.conversionRate as number;
          return (
            <span
              className={cn(
                'text-sm font-medium',
                rate >= 20
                  ? 'text-emerald-400'
                  : rate >= 10
                    ? 'text-amber-400'
                    : 'text-c-text-secondary'
              )}
            >
              {rate}%
            </span>
          );
        },
      },
      {
        id: 'activeAttributions',
        label: 'Active Orgs',
        width: '110px',
        align: 'center',
        sortable: true,
        render: (row: TableRow) => (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            {row.activeAttributions as number}
          </span>
        ),
      },
      {
        id: 'totalRevenue',
        label: 'Revenue',
        width: '120px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-c-text font-medium">
            €{(row.totalRevenue as number).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'totalCommissions',
        label: 'Commissions',
        width: '130px',
        align: 'right',
        sortable: true,
        render: (row: TableRow) => (
          <span className="text-emerald-400 font-medium">
            €{(row.totalCommissions as number).toLocaleString()}
          </span>
        ),
      },
    ],
    []
  );

  const analyticsRowMenu = useCallback((row: TableRow): StandardRowMenu => {
    const code = row as unknown as CodeAnalytics;
    return {
      universalHandlers: {
        preview: () => setPreviewAnalyticsCode(code.referralCode),
      },
    };
  }, []);

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
            {t('superadmin.settlements.subtitle', 'Review historical partner economics')}
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

      <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="font-medium text-c-text">Partner economics are read-only</p>
        <p className="mt-1 text-sm text-c-text-secondary">
          Commission, attribution, accrual and payout mutations are unavailable under
          AMD-PRT-ECONOMICS-002.
        </p>
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
          <p className="text-2xl font-bold text-c-text">{summary?.totalPendingCommissions}</p>
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
          <p className="text-2xl font-bold text-c-text">{summary?.totalPendingPayouts}</p>
          <p className="text-sm text-c-text-muted mt-1">
            €{summary?.pendingPayoutAmount.toLocaleString()} total
          </p>
        </div>

        <div className="bg-c-surface rounded-xl border border-c-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-c-success/20">
              <TrendingUp className="w-5 h-5 text-c-success" />
            </div>
            <span className="text-sm text-c-text-secondary">This Month Commissions</span>
          </div>
          <p className="text-2xl font-bold text-c-text">
            €{summary?.thisMonthCommissions.toLocaleString()}
          </p>
        </div>

        <div className="bg-c-surface rounded-xl border border-c-border p-4">
          <div className="p-2 rounded-lg bg-c-surface-raised w-fit mb-3">
            <DollarSign className="w-5 h-5 text-c-text-secondary" />
          </div>
          <span className="text-sm text-c-text-secondary">This Month Payouts</span>
          <p className="text-2xl font-bold text-c-text">
            €{summary?.thisMonthPayouts.toLocaleString()}
          </p>
        </div>
      </div>

      {/* MENU 2 — pigulki zakladek (Commissions/Payouts/Attribution/Expiring/Analytics) */}
      <StandardModuleBar
        tabs={[
          { id: 'commissions', label: 'Pending Commissions' },
          { id: 'payouts', label: 'Pending Payouts' },
          { id: 'attribution', label: 'Attribution Manager' },
          {
            id: 'expiring',
            label: 'Expiring',
            icon: <AlertTriangle className="w-4 h-4" />,
          },
          { id: 'analytics', label: 'Code Analytics', icon: <BarChart3 className="w-4 h-4" /> },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabType)}
        onSearch={
          activeTab === 'commissions'
            ? setCommissionSearch
            : activeTab === 'attribution'
              ? setAttributionSearch
              : undefined
        }
        searchValue={
          activeTab === 'commissions'
            ? commissionSearch
            : activeTab === 'attribution'
              ? attributionSearch
              : undefined
        }
        primaryCta={undefined}
        filterControls={
          activeTab === 'expiring' ? (
            <div className="flex items-center gap-2">
              <select
                value={expiringDays}
                onChange={(e) => setExpiringDays(Number(e.target.value))}
                className="h-9 px-3 bg-c-surface border border-c-border-subtle rounded-lg text-sm text-c-text"
              >
                <option value={7}>Next 7 days</option>
                <option value={14}>Next 14 days</option>
                <option value={30}>Next 30 days</option>
                <option value={60}>Next 60 days</option>
                <option value={90}>Next 90 days</option>
              </select>
              <button
                onClick={fetchData}
                className="p-2 text-c-text-secondary hover:text-c-text border border-c-border-subtle rounded-lg"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          ) : activeTab === 'analytics' ? (
            <button
              onClick={fetchData}
              className="p-2 text-c-text-secondary hover:text-c-text border border-c-border-subtle rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          ) : undefined
        }
        bulk={null}
        activeFilters={
          activeTab === 'commissions'
            ? commissionFilters
            : activeTab === 'attribution'
              ? attributionFilters
              : []
        }
        onRemoveFilter={(id) => {
          if (activeTab === 'commissions') {
            setCommissionFilters((prev) => prev.filter((f) => f.id !== id));
          } else if (activeTab === 'attribution') {
            setAttributionFilters((prev) => prev.filter((f) => f.id !== id));
          }
        }}
        onClearFilters={() => {
          if (activeTab === 'commissions') setCommissionFilters([]);
          else if (activeTab === 'attribution') setAttributionFilters([]);
        }}
      />

      {/* Commissions Tab */}
      {activeTab === 'commissions' && (
        <div className="flex min-h-0 overflow-hidden -mx-0">
          <div className="flex-1 min-w-0 overflow-auto">
            <StandardTable
              columns={commissionColumns}
              data={commissionRows}
              empty={{
                icon: CheckCircle,
                title: 'No pending commissions to approve',
              }}
              selectedRowId={previewCommissionId}
              onRowClick={(row) => setPreviewCommissionId(String(row.id))}
              rowMenu={commissionRowMenu}
              activeFilters={commissionFilters}
              onFilterChange={setCommissionFilters}
              persistKey="superadmin.settlements.commissions"
              selection={{ selectedIds: selectedCommissions, onChange: setSelectedCommissions }}
            />
          </div>

          {previewCommission ? (
            <aside className="w-[380px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={previewCommission.partnerName || previewCommission.id}
                onClose={() => setPreviewCommissionId(null)}
                meta={{
                  pills: [
                    { label: previewCommission.transactionType, tone: 'neutral' },
                    { label: previewCommission.status, tone: 'neutral' },
                  ],
                  trailing: (
                    <span className="text-xs text-c-text-secondary">
                      {previewCommission.transactionDate}
                    </span>
                  ),
                }}
                details={{
                  text: [
                    `Customer: ${previewCommission.organizationName || '—'}`,
                    `Gross amount: €${previewCommission.grossAmount.toLocaleString()}`,
                    `Commission: €${previewCommission.commissionAmount.toLocaleString()} (${previewCommission.commissionRate}%)`,
                  ].join('\n\n'),
                  onCopy: () => {
                    void navigator.clipboard?.writeText(previewCommission.id);
                  },
                }}
                actions={commissionPreviewActions}
              />
            </aside>
          ) : null}
        </div>
      )}

      {/* Payouts Tab — proces zatwierdzania (karty), nie lista encji: poza kanonem list */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-white/5 p-4"
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
                    <p className="font-medium text-c-text-secondary dark:text-white">
                      {payout.partnerName}
                    </p>
                    <p className="text-sm text-c-text-secondary">
                      {payout.transactionCount} transactions • {payout.periodStart} to{' '}
                      {payout.periodEnd}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xl font-bold text-c-text-secondary dark:text-white">
                      €{payout.netAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-c-text-muted">
                      Gross: €{payout.grossAmount.toLocaleString()} • Fees: €
                      {payout.fees.toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-c-surface-raised px-3 py-1 text-xs text-c-text-muted">
                    Historical read-only · economics unavailable
                  </span>
                </div>
              </div>
            </div>
          ))}

          {payouts.length === 0 && (
            <div className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-white/5 p-12 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-c-text-secondary">No pending payouts to process</p>
            </div>
          )}
        </div>
      )}

      {/* Attribution Tab */}
      {activeTab === 'attribution' && (
        <div className="flex min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto">
            <StandardTable
              columns={attributionColumns}
              data={attributionRows}
              empty={{
                icon: Link2,
                title: 'No attributions found',
                description: 'Create a new attribution to link an organization with a partner',
              }}
              selectedRowId={previewAttributionId}
              onRowClick={(row) => setPreviewAttributionId(String(row.id))}
              rowMenu={attributionRowMenu}
              activeFilters={attributionFilters}
              onFilterChange={setAttributionFilters}
              persistKey="superadmin.settlements.attribution"
            />
          </div>

          {previewAttribution ? (
            <aside className="w-[380px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={previewAttribution.organizationName || previewAttribution.organizationId}
                onClose={() => setPreviewAttributionId(null)}
                meta={{
                  pills: [
                    {
                      label: previewAttribution.attributionType.replace('_', ' '),
                      tone: 'neutral',
                    },
                    {
                      label: previewAttribution.status,
                      tone:
                        previewAttribution.status === 'ACTIVE'
                          ? 'success'
                          : previewAttribution.status === 'PENDING'
                            ? 'warning'
                            : 'neutral',
                    },
                  ],
                  trailing: (
                    <span className="text-xs text-c-text-secondary">
                      {formatDate(previewAttribution.attributedAt)}
                    </span>
                  ),
                }}
                details={{
                  text: [
                    `Partner: ${previewAttribution.partnerName || previewAttribution.partnerOrgId}`,
                    previewAttribution.referralCodeUsed
                      ? `Referral code: ${previewAttribution.referralCodeUsed}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join('\n\n'),
                  onCopy: () => {
                    void navigator.clipboard?.writeText(previewAttribution.id);
                  },
                }}
                actions={attributionPreviewActions}
              />
            </aside>
          ) : null}
        </div>
      )}

      {/* GAP-PARTNER-004: Expiring Attributions Tab */}
      {activeTab === 'expiring' && (
        <div className="flex min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto">
            <StandardTable
              columns={expiringColumns}
              data={expiringRows}
              empty={{
                icon: CheckCircle,
                title: 'No expiring discounts in the selected timeframe',
              }}
              selectedRowId={previewExpiringId}
              onRowClick={(row) => setPreviewExpiringId(String(row.id))}
              rowMenu={expiringRowMenu}
              persistKey="superadmin.settlements.expiring"
            />
          </div>

          {previewExpiring ? (
            <aside className="w-[380px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={previewExpiring.organizationName}
                onClose={() => setPreviewExpiringId(null)}
                meta={{
                  pills: [
                    previewExpiring.discountPercent
                      ? { label: `${previewExpiring.discountPercent}% off`, tone: 'success' }
                      : { label: 'No discount', tone: 'neutral' },
                  ],
                  trailing: (
                    <span className="text-xs text-c-text-secondary">
                      {previewExpiring.daysRemaining} days left
                    </span>
                  ),
                }}
                details={{
                  text: [
                    `Partner: ${previewExpiring.partnerName}`,
                    previewExpiring.referralCodeUsed
                      ? `Referral code: ${previewExpiring.referralCodeUsed}`
                      : '',
                    `Lifetime value: €${previewExpiring.lifetimeValue.toLocaleString()}`,
                    `Commission earned: €${previewExpiring.totalCommissionEarned.toLocaleString()}`,
                  ]
                    .filter(Boolean)
                    .join('\n\n'),
                }}
              />
            </aside>
          ) : null}
        </div>
      )}

      {/* GAP-PARTNER-003: Code Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="flex min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto">
            <StandardTable
              columns={analyticsColumns}
              data={analyticsRows}
              empty={{
                icon: BarChart3,
                title: 'No code analytics data available',
              }}
              selectedRowId={previewAnalyticsCode}
              onRowClick={(row) => setPreviewAnalyticsCode(String(row.id))}
              rowMenu={analyticsRowMenu}
              persistKey="superadmin.settlements.analytics"
            />
          </div>

          {previewAnalytics ? (
            <aside className="w-[380px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={previewAnalytics.referralCode}
                onClose={() => setPreviewAnalyticsCode(null)}
                meta={{
                  pills: [{ label: previewAnalytics.partnerName, tone: 'neutral' }],
                  trailing: (
                    <span className="text-xs text-c-text-secondary">
                      {previewAnalytics.conversionRate}% conv.
                    </span>
                  ),
                }}
                details={{
                  text: [
                    `Clicks: ${previewAnalytics.totalClicks.toLocaleString()}`,
                    `Signups: ${previewAnalytics.totalSignups.toLocaleString()}`,
                    `Active orgs: ${previewAnalytics.activeAttributions}`,
                    `Revenue: €${previewAnalytics.totalRevenue.toLocaleString()}`,
                    `Commissions: €${previewAnalytics.totalCommissions.toLocaleString()}`,
                  ].join('\n\n'),
                  onCopy: () => {
                    void navigator.clipboard?.writeText(previewAnalytics.referralCode);
                  },
                }}
              />
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default PartnerSettlementsView;
