/**
 * InvoiceCenterView - Super Admin Invoice & Billing Management
 *
 * Enterprise billing management:
 * - Invoice generation and management
 * - Credit notes
 * - Tax configuration
 * - Usage-based billing
 * - Subscription management
 */

import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../../components/standard/StandardTable';
import {
  CreditNotesPanel,
  InvoiceTemplateEditor,
  TaxSettingsPanel,
} from '../../components/billing';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  organizationName: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  amount: number;
  currency: string;
  tax: number;
  total: number;
  dueDate: string;
  paidAt?: string;
  createdAt: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  stripeInvoiceId?: string;
}

interface BillingStats {
  totalRevenue: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  overdueAmount: number;
  monthlyGrowth: number;
}

interface UsagePricingTier {
  id: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  currency: string;
  tierType: string;
  minQuantity: number;
  maxQuantity: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type TabType = 'invoices' | 'credits' | 'tax' | 'usage' | 'templates';
type DateFilter = '7d' | '30d' | '90d' | '1y' | 'all';

export const InvoiceCenterView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('invoices');
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    organizationId: '',
    description: '',
    amount: 0,
    currency: 'USD',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  // Usage Pricing Tiers state
  const [usageTiers, setUsageTiers] = useState<UsagePricingTier[]>([]);
  const [usageTiersLoading, setUsageTiersLoading] = useState(false);
  const [usageTiersLoadError, setUsageTiersLoadError] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<UsagePricingTier | null>(null);
  const [showCreateTier, setShowCreateTier] = useState(false);
  const [tierFormData, setTierFormData] = useState({
    name: '',
    unit: '',
    pricePerUnit: 0,
    currency: 'USD',
    tierType: 'standard',
    minQuantity: 0,
    maxQuantity: null as number | null,
    isActive: true,
  });
  const [savingTier, setSavingTier] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const [invoicesResult, statsResult] = await Promise.all([
        Api.getSuperAdminInvoices({ period: dateFilter }),
        Api.getSuperAdminInvoiceStats(),
      ]);
      setInvoices((invoicesResult as any)?.invoices || []);
      // Map API response to expected interface
      const mappedStats = statsResult as any;
      setStats({
        totalRevenue: mappedStats.totalRevenue || mappedStats.total || 0,
        paidInvoices: mappedStats.paidInvoices || mappedStats.paid || 0,
        pendingInvoices: mappedStats.pendingInvoices || mappedStats.pending || 0,
        overdueInvoices: mappedStats.overdueInvoices || mappedStats.overdue || 0,
        overdueAmount: mappedStats.overdueAmount || 0,
        monthlyGrowth: mappedStats.monthlyGrowth || 0,
      });
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      setInvoices([]);
      setStats(null);
      setLoadError(error instanceof Error ? error.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  const fetchUsageTiers = useCallback(async () => {
    setUsageTiersLoading(true);
    try {
      setUsageTiersLoadError(null);
      const result = await Api.getUsagePricingTiers();
      setUsageTiers((result as any)?.tiers || []);
    } catch (error) {
      console.error('Failed to fetch usage pricing tiers:', error);
      setUsageTiers([]);
      setUsageTiersLoadError(
        error instanceof Error ? error.message : 'Failed to load usage pricing tiers'
      );
    } finally {
      setUsageTiersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'usage') {
      fetchUsageTiers();
    }
  }, [activeTab, fetchUsageTiers]);

  const resetTierForm = () => {
    setTierFormData({
      name: '',
      unit: '',
      pricePerUnit: 0,
      currency: 'USD',
      tierType: 'standard',
      minQuantity: 0,
      maxQuantity: null,
      isActive: true,
    });
  };

  const openEditTier = (tier: UsagePricingTier) => {
    setEditingTier(tier);
    setTierFormData({
      name: tier.name,
      unit: tier.unit,
      pricePerUnit: tier.pricePerUnit,
      currency: tier.currency,
      tierType: tier.tierType,
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      isActive: tier.isActive,
    });
    setShowCreateTier(false);
  };

  const openCreateTier = () => {
    setEditingTier(null);
    resetTierForm();
    setShowCreateTier(true);
  };

  const handleSaveTier = async () => {
    if (!tierFormData.name.trim() || !tierFormData.unit.trim()) {
      toast.error('Name and unit are required');
      return;
    }
    setSavingTier(true);
    try {
      if (editingTier) {
        await Api.updateUsagePricingTier(editingTier.id, tierFormData);
        toast.success('Pricing tier updated');
      } else {
        await Api.createUsagePricingTier(tierFormData);
        toast.success('Pricing tier created');
      }
      setEditingTier(null);
      setShowCreateTier(false);
      resetTierForm();
      fetchUsageTiers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save pricing tier');
    } finally {
      setSavingTier(false);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Delete this pricing tier?')) return;
    try {
      await Api.deleteUsagePricingTier(id);
      toast.success('Pricing tier deleted');
      fetchUsageTiers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete pricing tier');
    }
  };

  const handleToggleTierActive = async (tier: UsagePricingTier) => {
    try {
      await Api.updateUsagePricingTier(tier.id, { isActive: !tier.isActive });
      toast.success(tier.isActive ? 'Tier deactivated' : 'Tier activated');
      fetchUsageTiers();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to toggle tier');
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.organizationName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSendReminder = async (invoiceId: string) => {
    try {
      await Api.post(`/api/superadmin/invoices/${invoiceId}/remind`, {});
      toast.success('Invoice reminder sent');
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error('Failed to send invoice reminder');
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await Api.post(`/api/superadmin/invoices/${invoiceId}/mark-paid`, {});
      fetchData();
      toast.success('Invoice marked as paid');
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      toast.error('Failed to mark invoice as paid');
    }
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/superadmin/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Invoice downloaded');
    } catch (error: any) {
      toast.error('Failed to download invoice');
      console.error('Failed to download PDF:', error);
    }
  };

  const handleCreateInvoice = async () => {
    if (
      !newInvoice.organizationId?.trim() ||
      !newInvoice.description?.trim() ||
      newInvoice.amount <= 0
    ) {
      toast.error('Organization, description, and amount are required');
      return;
    }
    setCreatingInvoice(true);
    try {
      const dueDate = newInvoice.dueDate ? `${newInvoice.dueDate}T00:00:00.000Z` : undefined;
      await Api.post('/superadmin/invoices', {
        organizationId: newInvoice.organizationId.trim(),
        lineItems: [
          {
            description: newInvoice.description.trim(),
            quantity: 1,
            unitPrice: newInvoice.amount,
          },
        ],
        currency: newInvoice.currency,
        dueDate,
      });
      toast.success('Invoice created');
      setNewInvoice({
        organizationId: '',
        description: '',
        amount: 0,
        currency: 'USD',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      setShowCreateInvoice(false);
      fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create invoice');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      draft: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
      pending: 'bg-amber-500/10 text-amber-600',
      paid: 'bg-emerald-500/10 text-emerald-600',
      overdue: 'bg-danger-500/10 text-danger-600',
      cancelled: 'bg-slate-500/10 text-slate-500 dark:text-slate-400',
      refunded: 'bg-blue-500/10 text-blue-600',
    };
    const icons = {
      draft: <FileText size={12} />,
      pending: <Clock size={12} />,
      paid: <CheckCircle2 size={12} />,
      overdue: <AlertTriangle size={12} />,
      cancelled: <XCircle size={12} />,
      refunded: <ArrowDownRight size={12} />,
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const invoiceColumns: TableColumn[] = React.useMemo(
    () => [
      {
        id: 'invoice',
        label: 'Invoice',
        render: (row: TableRow) => (
          <div className="font-medium text-slate-900 dark:text-white font-mono">
            {row.invoiceNumber}
          </div>
        ),
      },
      {
        id: 'organization',
        label: 'Organization',
        render: (row: TableRow) => (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-sm">
              {String(row.organizationName || '').charAt(0)}
            </div>
            <span className="text-slate-700 dark:text-slate-300">{row.organizationName}</span>
          </div>
        ),
      },
      {
        id: 'amount',
        label: 'Amount',
        render: (row: TableRow) => {
          const invoice = row.__invoice as Invoice;
          return (
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {formatCurrency(invoice.total, invoice.currency)}
              </div>
              {invoice.tax > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  incl. {formatCurrency(invoice.tax, invoice.currency)} tax
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        render: (row: TableRow) => getStatusBadge((row.__invoice as Invoice).status),
      },
      {
        id: 'date',
        label: 'Date',
        render: (row: TableRow) => (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'dueDate',
        label: 'Due Date',
        render: (row: TableRow) => (
          <span
            className={`text-sm ${
              row.status === 'overdue'
                ? 'text-danger-600 font-medium'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {new Date(row.dueDate).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'actions',
        label: 'Actions',
        align: 'right',
        render: (row: TableRow) => {
          const invoice = row.__invoice as Invoice;
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => setSelectedInvoice(invoice)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
                title="View"
              >
                <Eye size={16} className="text-slate-600 dark:text-slate-500" />
              </button>
              <button
                onClick={() => handleDownloadPdf(invoice.id)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
                title="Download Invoice"
              >
                <Download size={16} className="text-slate-600 dark:text-slate-500" />
              </button>
              {(invoice.status === 'pending' || invoice.status === 'overdue') && (
                <button
                  onClick={() => handleSendReminder(invoice.id)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
                  title="Send Reminder"
                >
                  <Send size={16} className="text-slate-600 dark:text-slate-500" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const invoiceRows: TableRow[] = React.useMemo(
    () =>
      filteredInvoices.map((invoice) => ({
        ...invoice,
        id: String(invoice.id),
        __invoice: invoice,
      })),
    [filteredInvoices]
  );

  const tierColumns: TableColumn[] = React.useMemo(
    () => [
      {
        id: 'name',
        label: 'Name',
        render: (row: TableRow) => (
          <div className="font-medium text-slate-900 dark:text-white">{row.name}</div>
        ),
      },
      {
        id: 'unit',
        label: 'Unit',
        render: (row: TableRow) => (
          <span className="text-sm text-slate-500 dark:text-slate-400">{row.unit}</span>
        ),
      },
      {
        id: 'price',
        label: 'Price',
        render: (row: TableRow) => (
          <span className="text-lg font-semibold text-slate-900 dark:text-white">
            {formatCurrency(row.pricePerUnit, row.currency)}
          </span>
        ),
      },
      {
        id: 'type',
        label: 'Type',
        render: (row: TableRow) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300">
            {row.tierType}
          </span>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        render: (row: TableRow) => {
          const tier = row.__tier as any;
          return (
            <button
              onClick={() => handleToggleTierActive(tier)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                tier.isActive
                  ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                  : 'bg-slate-500/10 text-slate-500 hover:bg-slate-500/20'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${tier.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              {tier.isActive ? 'Active' : 'Inactive'}
            </button>
          );
        },
      },
      {
        id: 'actions',
        label: 'Actions',
        align: 'right',
        render: (row: TableRow) => {
          const tier = row.__tier as any;
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => openEditTier(tier)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
                title="Edit"
              >
                <Pencil size={16} className="text-primary-500" />
              </button>
              <button
                onClick={() => handleDeleteTier(tier.id)}
                className="p-2 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg"
                title="Delete"
              >
                <Trash2 size={16} className="text-danger-400" />
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const tierRows: TableRow[] = React.useMemo(
    () =>
      usageTiers.map((tier) => ({
        ...tier,
        id: String(tier.id),
        __tier: tier,
      })),
    [usageTiers]
  );

  const renderInvoicesTab = () => (
    <div className="space-y-6">
      {loadError && <DegradedState title="Invoice overview unavailable" description={loadError} />}

      {/* Stats Cards */}
      {!loadError && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Total Revenue</span>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="text-emerald-500" size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(stats.totalRevenue)}
            </div>
            <div
              className={`mt-1 text-sm flex items-center gap-1 ${stats.monthlyGrowth >= 0 ? 'text-emerald-600' : 'text-danger-600'}`}
            >
              {stats.monthlyGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(stats.monthlyGrowth)}% vs last month
            </div>
          </div>

          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Paid Invoices</span>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CheckCircle2 className="text-blue-500" size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.paidInvoices}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">This period</div>
          </div>

          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Pending</span>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="text-amber-500" size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.pendingInvoices}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Awaiting payment</div>
          </div>

          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Overdue</span>
              <div className="w-10 h-10 rounded-lg bg-danger-500/10 flex items-center justify-center">
                <AlertTriangle className="text-danger-500" size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-danger-600">{stats.overdueInvoices}</div>
            <div className="mt-1 text-sm text-danger-500">
              {formatCurrency(stats.overdueAmount)} outstanding
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            size={18}
          />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={!!loadError}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          disabled={!!loadError}
          className="px-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          disabled={!!loadError}
          className="px-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
          <option value="all">All time</option>
        </select>
        <button
          onClick={() => setShowCreateInvoice(true)}
          disabled={!!loadError}
          className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2"
        >
          <Plus size={18} />
          Create Invoice
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {loadError ? (
          <div className="p-6">
            <DegradedState title="Invoices unavailable" description={loadError} />
          </div>
        ) : (
          <StandardTable
            columns={invoiceColumns}
            data={invoiceRows}
            empty={{
              title: 'No invoices found',
              description: 'Invoices will appear here once created',
              icon: Receipt,
            }}
            persistKey="superadmin.invoices.list"
            canvasClassName="p-0"
          />
        )}
      </div>

      {showCreateInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create Invoice</h2>
              <button
                onClick={() => setShowCreateInvoice(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Organization ID
                </label>
                <input
                  type="text"
                  value={newInvoice.organizationId}
                  onChange={(e) =>
                    setNewInvoice((prev) => ({ ...prev, organizationId: e.target.value }))
                  }
                  placeholder="UUID"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newInvoice.description}
                  onChange={(e) =>
                    setNewInvoice((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Invoice line description"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newInvoice.amount || ''}
                  onChange={(e) =>
                    setNewInvoice((prev) => ({
                      ...prev,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  value={newInvoice.currency}
                  onChange={(e) => setNewInvoice((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="PLN">PLN</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newInvoice.dueDate}
                  onChange={(e) => setNewInvoice((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateInvoice(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={creatingInvoice}
                className="flex-1 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {creatingInvoice ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Plus size={18} />
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCreditsTab = () => <CreditNotesPanel isAdmin={true} />;

  const renderTaxTab = () => <TaxSettingsPanel isAdmin={true} />;

  const renderTemplatesTab = () => <InvoiceTemplateEditor />;

  const renderTierModal = () => {
    if (!editingTier && !showCreateTier) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {editingTier ? 'Edit Pricing Tier' : 'Create Pricing Tier'}
            </h2>
            <button
              onClick={() => {
                setEditingTier(null);
                setShowCreateTier(false);
                resetTierForm();
              }}
              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={tierFormData.name}
                onChange={(e) => setTierFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Token Overage Rate"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Unit
              </label>
              <input
                type="text"
                value={tierFormData.unit}
                onChange={(e) => setTierFormData((p) => ({ ...p, unit: e.target.value }))}
                placeholder="e.g. per 1,000 tokens"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Price per Unit
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={tierFormData.pricePerUnit || ''}
                  onChange={(e) =>
                    setTierFormData((p) => ({
                      ...p,
                      pricePerUnit: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  value={tierFormData.currency}
                  onChange={(e) => setTierFormData((p) => ({ ...p, currency: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="PLN">PLN</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tier Type
              </label>
              <select
                value={tierFormData.tierType}
                onChange={(e) => setTierFormData((p) => ({ ...p, tierType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              >
                <option value="standard">Standard</option>
                <option value="overage">Overage</option>
                <option value="volume">Volume</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tierFormData.isActive}
                onChange={(e) => setTierFormData((p) => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
            </label>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setEditingTier(null);
                setShowCreateTier(false);
                resetTierForm();
              }}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTier}
              disabled={savingTier}
              className="flex-1 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {savingTier ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Save size={18} />
                  {editingTier ? 'Update' : 'Create'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderUsageTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Usage-Based Pricing Tiers
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure per-unit rates for overage billing, storage, tokens, and more.
          </p>
        </div>
        <button
          onClick={openCreateTier}
          disabled={!!usageTiersLoadError}
          className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2"
        >
          <Plus size={18} />
          Add Tier
        </button>
      </div>

      {/* Tiers Table */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {usageTiersLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary-500" />
          </div>
        ) : usageTiersLoadError ? (
          <div className="p-6">
            <DegradedState
              title="Usage pricing tiers unavailable"
              description={usageTiersLoadError}
            />
          </div>
        ) : usageTiers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <DollarSign size={40} className="mx-auto mb-3 text-slate-600" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              No pricing tiers configured
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-500 mt-1">
              Add a tier to start configuring usage-based billing rates.
            </p>
          </div>
        ) : (
          <StandardTable
            columns={tierColumns}
            data={tierRows}
            persistKey="superadmin.invoices.usageTiers"
            canvasClassName="p-0"
          />
        )}
      </div>

      {renderTierModal()}
    </div>
  );

  // Invoice Detail Modal
  const renderInvoiceModal = () => {
    if (!selectedInvoice) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Invoice {selectedInvoice.invoiceNumber}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                {selectedInvoice.organizationName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadPdf(selectedInvoice.id)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
                title="Print Invoice"
              >
                <Printer size={20} className="text-slate-600 dark:text-slate-500" />
              </button>
              <button
                onClick={() => handleDownloadPdf(selectedInvoice.id)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
                title="Download Invoice"
              >
                <Download size={20} className="text-slate-600 dark:text-slate-500" />
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
              >
                <XCircle size={20} className="text-slate-600 dark:text-slate-500" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="flex justify-between mb-6">
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Issue Date</div>
                <div className="font-medium text-slate-900 dark:text-white">
                  {new Date(selectedInvoice.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Due Date</div>
                <div className="font-medium text-slate-900 dark:text-white">
                  {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Status</div>
                <div className="mt-1">{getStatusBadge(selectedInvoice.status)}</div>
              </div>
            </div>

            <table /* §27-exempt: sub-tabela w widoku szczegolow (pozycje faktury w modalu), tabela dokumentowa, nie samodzielna lista */ className="w-full mb-6">
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700">
                  <th className="text-left py-3 text-sm text-slate-500 dark:text-slate-400">
                    Description
                  </th>
                  <th className="text-right py-3 text-sm text-slate-500 dark:text-slate-400">
                    Qty
                  </th>
                  <th className="text-right py-3 text-sm text-slate-500 dark:text-slate-400">
                    Price
                  </th>
                  <th className="text-right py-3 text-sm text-slate-500 dark:text-slate-400">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-200 dark:border-navy-700">
                    <td className="py-3 text-slate-900 dark:text-white">{item.description}</td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                      {item.quantity}
                    </td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(item.unitPrice, selectedInvoice.currency)}
                    </td>
                    <td className="py-3 text-right font-medium text-slate-900 dark:text-white">
                      {formatCurrency(item.amount, selectedInvoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-2 border-t border-slate-200 dark:border-navy-700 pt-4">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Tax</span>
                <span>{formatCurrency(selectedInvoice.tax, selectedInvoice.currency)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-navy-700">
                <span>Total</span>
                <span>{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</span>
              </div>
            </div>
          </div>

          {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'overdue') && (
            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
              <button
                onClick={() => handleSendReminder(selectedInvoice.id)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/20 flex items-center gap-2"
              >
                <Send size={16} />
                Send Reminder
              </button>
              <button
                onClick={() => {
                  handleMarkPaid(selectedInvoice.id);
                  setSelectedInvoice(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                Mark as Paid
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative">
      <InfoButton cardId="superadmin-invoices" position="top-right" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoice Center</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage invoices and billing</p>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton
            cardId="superadmin-invoices"
            position="header-inline"
            size="md"
            showLabel
            label="Help"
          />
          <button
            onClick={fetchData}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg w-fit overflow-x-auto">
        {[
          { id: 'invoices', label: 'Invoices', icon: <Receipt size={16} /> },
          { id: 'credits', label: 'Credit Notes', icon: <CreditCard size={16} /> },
          { id: 'tax', label: 'Tax Settings', icon: <FileText size={16} /> },
          { id: 'usage', label: 'Usage Billing', icon: <TrendingUp size={16} /> },
          { id: 'templates', label: 'Templates', icon: <FileText size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-navy-800 text-[var(--c-info)] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {activeTab === 'invoices' && renderInvoicesTab()}
          {activeTab === 'credits' && renderCreditsTab()}
          {activeTab === 'tax' && renderTaxTab()}
          {activeTab === 'usage' && renderUsageTab()}
          {activeTab === 'templates' && renderTemplatesTab()}
        </>
      )}

      {/* Invoice Modal */}
      {renderInvoiceModal()}
    </div>
  );
};

export default InvoiceCenterView;
