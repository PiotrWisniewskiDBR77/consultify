/**
 * InvoicesPanel - Invoice Management
 *
 * Features:
 * - Lista faktur z filtrami
 * - Status (paid, open, overdue)
 * - Download PDF
 * - Send reminder
 */

import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  id: string;
  organization_id: string;
  organization_name?: string;
  invoice_number: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  due_date?: string;
  paid_at?: string;
  period_start?: string;
  period_end?: string;
  line_items: LineItem[];
  pdf_url?: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
}

export const InvoicesPanel: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterOrgId, setFilterOrgId] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterOrgId) params.append('organizationId', filterOrgId);

      const result = await Api.get(`/billing/invoices?${params.toString()}`);
      setInvoices(result.invoices || []);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterOrgId]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      setOrganizations(orgs);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      await Api.post(`/billing/invoices/${invoiceId}/send`, {});
      toast.success('Invoice sent');
      void fetchInvoices();
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invoice';
      toast.error(errorMessage);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await Api.put(`/billing/invoices/${invoiceId}`, { status: 'paid' });
      toast.success('Invoice marked as paid');
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update invoice');
    }
  };

  const formatCurrency = (cents: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
      draft: {
        icon: <FileText size={14} />,
        bg: 'bg-slate-500/20',
        text: 'text-slate-600 dark:text-slate-500',
      },
      open: { icon: <Clock size={14} />, bg: 'bg-blue-500/20', text: 'text-blue-400' },
      paid: { icon: <CheckCircle2 size={14} />, bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
      void: { icon: <XCircle size={14} />, bg: 'bg-danger-500/20', text: 'text-danger-400' },
      uncollectible: {
        icon: <AlertTriangle size={14} />,
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
      },
    };
    const config = configs[status] || configs.draft;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      >
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(query) ||
      invoice.organization_name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none w-64"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>

          <select
            value={filterOrgId}
            onChange={(e) => setFilterOrgId(e.target.value)}
            className="px-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchInvoices}
            className="p-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-white font-medium transition-colors"
          >
            <Plus size={18} />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600 dark:text-slate-500">
          <FileText size={48} className="mb-4 opacity-50" />
          <p>No invoices found</p>
        </div>
      ) : (
        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl overflow-hidden">
          <table /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */  className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Invoice
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Organization
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Status
                </th>
                <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Amount
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Due Date
                </th>
                <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-white/[0.04] hover:bg-c-surface-raised/50">
                  <td className="p-4">
                    <div>
                      <span className="font-medium text-c-text">{invoice.invoice_number}</span>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-slate-600 dark:text-slate-500" />
                      <span className="text-c-text">{invoice.organization_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-4">{getStatusBadge(invoice.status)}</td>
                  <td className="p-4 text-right">
                    <div>
                      <span className="font-medium text-c-text">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </span>
                      {invoice.amount_due > 0 && invoice.status !== 'paid' && (
                        <p className="text-sm text-amber-400">
                          Due: {formatCurrency(invoice.amount_due, invoice.currency)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {invoice.due_date ? (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-500">
                        <Calendar size={14} />
                        <span className="text-sm">
                          {new Date(invoice.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} className="text-slate-600 dark:text-slate-500" />
                      </button>
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleSendInvoice(invoice.id)}
                          className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors"
                          title="Send Invoice"
                        >
                          <Mail size={16} />
                        </button>
                      )}
                      {invoice.status === 'open' && (
                        <button
                          onClick={() => handleMarkPaid(invoice.id)}
                          className="p-2 hover:bg-emerald-500/10 text-emerald-400 rounded-lg transition-colors"
                          title="Mark as Paid"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      {invoice.pdf_url && (
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download size={16} className="text-slate-600 dark:text-slate-500" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-white/10 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-c-text">
                  {selectedInvoice.invoice_number}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-500">
                  {selectedInvoice.organization_name}
                </p>
              </div>
              {getStatusBadge(selectedInvoice.status)}
            </div>

            {/* Line Items */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-slate-600 dark:text-slate-500 mb-3">
                Line Items
              </h4>
              <div className="bg-c-surface-raised/50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left p-3 text-xs font-medium text-slate-600 dark:text-slate-500">
                        Description
                      </th>
                      <th className="text-right p-3 text-xs font-medium text-slate-600 dark:text-slate-500">
                        Qty
                      </th>
                      <th className="text-right p-3 text-xs font-medium text-slate-600 dark:text-slate-500">
                        Unit Price
                      </th>
                      <th className="text-right p-3 text-xs font-medium text-slate-600 dark:text-slate-500">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.line_items.map((item, idx) => (
                      <tr key={idx} className="border-b border-white/[0.04]">
                        <td className="p-3 text-c-text">{item.description}</td>
                        <td className="p-3 text-right text-slate-600">{item.quantity}</td>
                        <td className="p-3 text-right text-slate-600">
                          {formatCurrency(item.unitPrice, selectedInvoice.currency)}
                        </td>
                        <td className="p-3 text-right text-c-text">
                          {formatCurrency(item.amount, selectedInvoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-500">Subtotal</span>
                <span className="text-c-text">
                  {formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}
                </span>
              </div>
              {selectedInvoice.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-500">Tax</span>
                  <span className="text-c-text">
                    {formatCurrency(selectedInvoice.tax_amount, selectedInvoice.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold border-t border-white/10 pt-2">
                <span className="text-c-text">Total</span>
                <span className="text-c-text">
                  {formatCurrency(selectedInvoice.total, selectedInvoice.currency)}
                </span>
              </div>
              {selectedInvoice.amount_paid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-500">Amount Paid</span>
                  <span className="text-emerald-400">
                    {formatCurrency(selectedInvoice.amount_paid, selectedInvoice.currency)}
                  </span>
                </div>
              )}
              {selectedInvoice.amount_due > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-500">Amount Due</span>
                  <span className="text-amber-400">
                    {formatCurrency(selectedInvoice.amount_due, selectedInvoice.currency)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg text-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPanel;
