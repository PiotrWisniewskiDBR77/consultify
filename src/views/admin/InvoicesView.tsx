/**
 * InvoicesView - Invoices & Billing History
 *
 * Features:
 * - List all invoices
 * - Download PDF invoices
 * - Filter by date/status
 * - View invoice details
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  Clock,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  EmptyState as SharedEmptyState,
  LoadingState as SharedLoadingState,
} from '@/components/shared/states';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { useAppStore } from '../../store/useAppStore';

interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'overdue' | 'void';
  description: string;
  pdfUrl?: string;
  items: InvoiceItem[];
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface InvoicesViewProps {
  className?: string;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/billing/invoices`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      // Transform backend format to frontend format
      const invoices = (data.invoices || []).map((inv: any) => ({
        id: inv.id,
        number: inv.invoice_number || inv.number || `INV-${inv.id.slice(0, 8)}`,
        date: inv.invoice_date || inv.created_at || inv.date,
        dueDate: inv.due_date || inv.dueDate,
        amount: inv.total || inv.amount || 0,
        currency: inv.currency || 'USD',
        status: inv.status || 'pending',
        description: inv.description || `Invoice #${inv.invoice_number || inv.id.slice(0, 8)}`,
        pdfUrl: inv.pdf_url || inv.pdfUrl,
        items: inv.items || [],
      }));
      setInvoices(invoices);
    } catch (error) {
      console.error('Failed to load invoices:', error);
      setInvoices([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to load invoices');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [currentOrganization?.id, loadInvoices]);

  const handleDownload = async (invoice: Invoice) => {
    setDownloading(invoice.id);
    try {
      // In production, this would download from Stripe or your invoice service
      const res = await fetch(`/api/billing/invoices/${invoice.id}/download`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.number}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded');
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error('Failed to download invoice');
    }
    setDownloading(null);
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      paid: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      overdue: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400',
      void: 'bg-c-surface-raised text-c-text-muted',
    };

    const icons = {
      paid: <Check size={12} />,
      pending: <Clock size={12} />,
      overdue: <AlertCircle size={12} />,
      void: <X size={12} />,
    };

    return (
      <span
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (
      searchTerm &&
      !inv.number.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !inv.description.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    if (statusFilter !== 'all' && inv.status !== statusFilter) {
      return false;
    }
    if (dateRange !== 'all') {
      const invoiceDate = new Date(inv.date);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      if (dateRange === 'month' && invoiceDate < startOfMonth) return false;
      if (dateRange === 'year' && invoiceDate < startOfYear) return false;
    }
    return true;
  });

  const totalPaid = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0);

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <SharedLoadingState template="list" rows={6} />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <InfoButton cardId="admin-invoices" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-c-text flex items-center gap-2">
            <FileText size={24} />
            {t('admin.billing.invoices', 'Invoices & Billing History')}
          </h2>
          <p className="text-sm text-c-text-muted mt-1">
            {t('admin.billing.invoicesDesc', 'View and download your billing history')}
          </p>
        </div>
        {!loadError && (
          <div className="text-right">
            <p className="text-sm text-c-text-muted">Total Paid (All Time)</p>
            <p className="text-2xl font-bold text-c-text">{formatCurrency(totalPaid, 'USD')}</p>
          </div>
        )}
      </div>

      {loadError && <DegradedState title="Invoices unavailable" description={loadError} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
            size={18}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoices..."
            disabled={!!loadError}
            className="w-full pl-10 pr-4 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-c-text"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          disabled={!!loadError}
          className="px-3 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-c-text"
        >
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          disabled={!!loadError}
          className="px-3 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-c-text"
        >
          <option value="all">All Time</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Invoices List */}
      {loadError ? (
        <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
          <DegradedState title="Billing history unavailable" description={loadError} />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-c-surface rounded-xl border border-c-border-subtle">
          {searchTerm || statusFilter !== 'all' || dateRange !== 'all' ? (
            <SharedEmptyState
              variant="filter"
              icon={FileText}
              title={t('admin.billing.noInvoicesMatch', 'No invoices match your filters')}
              description={t(
                'admin.billing.noInvoicesMatchDesc',
                'Try a wider date range or clear the filters to see your full billing history.'
              )}
              primaryAction={{
                label: t('common.clearFilters', 'Clear filters'),
                onClick: () => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setDateRange('all');
                },
              }}
            />
          ) : (
            <SharedEmptyState
              variant="new"
              icon={FileText}
              title={t('admin.billing.noInvoices', 'No invoices yet')}
              description={t(
                'admin.billing.noInvoicesDesc',
                'Invoices will appear here once your organization has billing activity.'
              )}
            />
          )}
        </div>
      ) : (
        <div className="bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden">
          <table
            /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
          >
            <thead className="bg-c-surface-raised">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-c-text-muted uppercase">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-c-text-muted uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-c-text-muted uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-c-text-muted uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-c-text-muted uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-c-surface-raised/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-c-text">{invoice.number}</div>
                    <div className="text-sm text-c-text-muted">{invoice.description}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-c-text-secondary">
                    {formatDate(invoice.date)}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(invoice.status)}</td>
                  <td className="px-6 py-4 text-right font-medium text-c-text">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="p-2 hover:bg-c-surface-raised rounded-lg text-c-text-muted hover:text-c-text-secondary"
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleDownload(invoice)}
                        disabled={downloading === invoice.id}
                        className="p-2 hover:bg-c-surface-raised rounded-lg text-c-text-muted hover:text-primary-600"
                        title="Download PDF"
                      >
                        {downloading === invoice.id ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-c-surface rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
            >
              <div className="p-6 border-b border-c-border-subtle flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-c-text">{selectedInvoice.number}</h3>
                  <p className="text-sm text-c-text-muted">{formatDate(selectedInvoice.date)}</p>
                </div>
                {getStatusBadge(selectedInvoice.status)}
              </div>
              <div className="p-6 space-y-4">
                {/* Line Items */}
                <div>
                  <h4 className="text-sm font-medium text-c-text-secondary mb-3">Items</h4>
                  <div className="space-y-2">
                    {selectedInvoice.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between py-2 border-b border-c-border-subtle"
                      >
                        <div>
                          <p className="text-sm text-c-text">{item.description}</p>
                          <p className="text-xs text-c-text-muted">
                            Qty: {item.quantity} ×{' '}
                            {formatCurrency(item.unitPrice, selectedInvoice.currency)}
                          </p>
                        </div>
                        <p className="font-medium text-c-text">
                          {formatCurrency(item.amount, selectedInvoice.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="pt-4 border-t border-c-border-subtle flex justify-between">
                  <span className="font-semibold text-c-text">Total</span>
                  <span className="text-xl font-bold text-c-text">
                    {formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}
                  </span>
                </div>
              </div>
              <div className="p-6 border-t border-c-border-subtle flex justify-between">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 text-c-text-secondary"
                >
                  Close
                </button>
                <button
                  onClick={() => handleDownload(selectedInvoice)}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoicesView;
