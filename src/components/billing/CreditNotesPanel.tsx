/**
 * Credit Notes Panel
 * Manages credit notes creation, viewing, and application to invoices
 */

import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../services/api';

interface CreditNote {
  id: string;
  credit_note_number: string;
  organization_id: string;
  organization_name?: string;
  invoice_id?: string;
  total: number;
  amount_applied: number;
  amount_remaining: number;
  refund_amount: number;
  currency: string;
  status: 'draft' | 'issued' | 'applied' | 'voided' | 'refunded';
  reason: string;
  reason_details?: string;
  memo?: string;
  customer_memo?: string;
  issued_at: string;
  created_at: string;
}

interface CreditNoteStats {
  total_count: number;
  issued_count: number;
  applied_count: number;
  refunded_count: number;
  voided_count: number;
  total_value: number;
  total_applied: number;
  total_refunded: number;
  total_remaining: number;
}

function normalizeCreditNoteStats(raw: any): CreditNoteStats {
  return {
    total_count: raw.total_count ?? raw.totalCount ?? 0,
    issued_count: raw.issued_count ?? raw.issuedCount ?? 0,
    applied_count: raw.applied_count ?? raw.appliedCount ?? 0,
    refunded_count: raw.refunded_count ?? raw.refundedCount ?? 0,
    voided_count: raw.voided_count ?? raw.voidedCount ?? 0,
    total_value: raw.total_value ?? raw.totalValue ?? 0,
    total_applied: raw.total_applied ?? raw.totalApplied ?? 0,
    total_refunded: raw.total_refunded ?? raw.totalRefunded ?? 0,
    total_remaining: raw.total_remaining ?? raw.totalRemaining ?? 0,
  };
}

interface CreditNoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  organization_id: string;
  total: number;
  amount_due: number;
  currency: string;
  status: string;
}

interface CreditNotesPanelProps {
  organizationId?: string;
  isAdmin?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  draft: {
    bg: 'bg-slate-100 dark:bg-slate-700',
    text: 'text-slate-600 dark:text-slate-300',
    icon: <Clock className="w-3 h-3" />,
  },
  issued: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    icon: <FileText className="w-3 h-3" />,
  },
  applied: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  voided: {
    bg: 'bg-danger-100 dark:bg-danger-900/30',
    text: 'text-danger-600 dark:text-danger-400',
    icon: <XCircle className="w-3 h-3" />,
  },
  refunded: {
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    text: 'text-primary-600 dark:text-primary-400',
    icon: <RotateCcw className="w-3 h-3" />,
  },
};

const REASON_LABELS: Record<string, string> = {
  duplicate: 'Duplicate Invoice',
  fraudulent: 'Fraudulent Charge',
  order_change: 'Order Change',
  product_unsatisfactory: 'Product Unsatisfactory',
  service_issue: 'Service Issue',
  billing_error: 'Billing Error',
  other: 'Other',
};

export const CreditNotesPanel: React.FC<CreditNotesPanelProps> = ({
  organizationId,
  isAdmin = false,
}) => {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [stats, setStats] = useState<CreditNoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<CreditNote | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    fetchData();
  }, [organizationId, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isAdmin ? '/billing/admin/credit-notes' : '/billing/credit-notes';
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (organizationId) params.append('organizationId', organizationId);

      const [notesRes, statsRes] = await Promise.all([
        Api.get(`${endpoint}?${params.toString()}`),
        isAdmin
          ? Api.get(
              `/billing/admin/credit-notes/stats${organizationId ? `?organizationId=${organizationId}` : ''}`
            )
          : null,
      ]);

      setCreditNotes(notesRes.creditNotes || []);
      if (statsRes) setStats(normalizeCreditNoteStats(statsRes.stats));
    } catch (err: any) {
      setError(err.message || 'Failed to load credit notes');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | undefined | null, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format((amount || 0) / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleApplyCredit = async (creditNoteId: string, invoiceId: string, amount?: number) => {
    try {
      await Api.post(`/billing/credit-notes/${creditNoteId}/apply`, { invoiceId, amount });
      setShowApplyModal(false);
      setSelectedNote(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to apply credit note');
    }
  };

  const handleRefund = async (creditNoteId: string) => {
    if (!window.confirm('Are you sure you want to refund this credit note?')) return;
    try {
      await Api.post(`/billing/credit-notes/${creditNoteId}/refund`, {});
      void fetchData();
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refund credit note';
      setError(errorMessage);
    }
  };

  const handleVoid = async (creditNoteId: string) => {
    if (!window.confirm('Are you sure you want to void this credit note?')) return;
    try {
      await Api.post(`/billing/credit-notes/${creditNoteId}/void`, {});
      void fetchData();
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to void credit note';
      setError(errorMessage);
    }
  };

  const filteredNotes = creditNotes.filter(
    (note) =>
      note.credit_note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      REASON_LABELS[note.reason]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Credit Notes</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.total_count}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Value</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(stats.total_value)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                <DollarSign className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Applied</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(stats.total_applied)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Remaining</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(stats.total_remaining)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search credit notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="issued">Issued</option>
          <option value="applied">Applied</option>
          <option value="refunded">Refunded</option>
          <option value="voided">Voided</option>
        </select>

        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Credit Note
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-danger-500" />
          <p className="text-danger-700 dark:text-danger-400">{error}</p>
        </div>
      )}

      {/* Credit Notes Table */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto text-slate-600 dark:text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No Credit Notes
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {searchTerm || statusFilter
                ? 'No credit notes match your filters'
                : 'No credit notes have been created yet'}
            </p>
          </div>
        ) : (
          <table
            /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */ className="w-full"
          >
            <thead className="bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Number
                </th>
                {isAdmin && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Organization
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Reason
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Amount
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Remaining
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Date
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {filteredNotes.map((note) => (
                <tr
                  key={note.id}
                  className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-slate-900 dark:text-white">
                      {note.credit_note_number}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {note.organization_name || 'N/A'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {REASON_LABELS[note.reason] || note.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {formatCurrency(note.total, note.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-medium ${
                        note.amount_remaining > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-600 dark:text-slate-500'
                      }`}
                    >
                      {formatCurrency(note.amount_remaining, note.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[note.status]?.bg || ''
                      } ${STATUS_COLORS[note.status]?.text || ''}`}
                    >
                      {STATUS_COLORS[note.status]?.icon}
                      {note.status.charAt(0).toUpperCase() + note.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(note.issued_at || note.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {note.status === 'issued' && note.amount_remaining > 0 && (
                        <button
                          onClick={() => {
                            setSelectedNote(note);
                            setShowApplyModal(true);
                          }}
                          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          title="Apply to Invoice"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && note.status === 'issued' && note.amount_remaining > 0 && (
                        <button
                          onClick={() => handleRefund(note.id)}
                          className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          title="Refund"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin &&
                        (note.status === 'draft' || note.status === 'issued') &&
                        note.amount_applied === 0 && (
                          <button
                            onClick={() => handleVoid(note.id)}
                            className="p-1.5 rounded-lg text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                            title="Void"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Apply Credit Modal */}
      {showApplyModal && selectedNote && (
        <ApplyCreditModal
          creditNote={selectedNote}
          onApply={handleApplyCredit}
          onClose={() => {
            setShowApplyModal(false);
            setSelectedNote(null);
          }}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Create Credit Note Modal */}
      {showCreateModal && (
        <CreateCreditNoteModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

// Apply Credit Modal Component
interface ApplyCreditModalProps {
  creditNote: CreditNote;
  onApply: (creditNoteId: string, invoiceId: string, amount?: number) => void;
  onClose: () => void;
  formatCurrency: (amount: number, currency?: string) => string;
}

const ApplyCreditModal: React.FC<ApplyCreditModalProps> = ({
  creditNote,
  onApply,
  onClose,
  formatCurrency,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await Api.get('/billing/invoices?status=open');
        setInvoices(res.invoices || []);
      } catch (err) {
        console.error('Failed to load invoices', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInvoice) {
      onApply(creditNote.id, selectedInvoice, amount);
    }
  };

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Apply Credit Note
        </h3>

        <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-navy-900/50">
          <p className="text-sm text-slate-500 dark:text-slate-400">Credit Note</p>
          <p className="font-mono text-slate-900 dark:text-white">
            {creditNote.credit_note_number}
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Available: {formatCurrency(creditNote.amount_remaining, creditNote.currency)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Invoice
            </label>
            <select
              value={selectedInvoice}
              onChange={(e) => setSelectedInvoice(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            >
              <option value="">Select an invoice...</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} - {formatCurrency(inv.amount_due, inv.currency)} due
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amount (optional, leave blank for full available amount)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={creditNote.amount_remaining / 100}
              value={amount !== undefined ? amount / 100 : ''}
              onChange={(e) =>
                setAmount(e.target.value ? parseFloat(e.target.value) * 100 : undefined)
              }
              placeholder="Full amount"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedInvoice || loading}
              className="flex-1 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply Credit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Create Credit Note Modal (simplified - full version would have more fields)
interface CreateCreditNoteModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateCreditNoteModal: React.FC<CreateCreditNoteModalProps> = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    organizationId: '',
    invoiceId: '',
    reason: 'billing_error',
    reasonDetails: '',
    memo: '',
    customerMemo: '',
    items: [{ description: '', quantity: 1, unitPrice: 0 }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitPrice: 0 }],
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await Api.post('/billing/credit-notes', {
        ...formData,
        items: formData.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice * 100),
        })),
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create credit note');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = formData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Create Credit Note
        </h3>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Organization ID *
              </label>
              <input
                type="text"
                value={formData.organizationId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, organizationId: e.target.value }))
                }
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Related Invoice (optional)
              </label>
              <input
                type="text"
                value={formData.invoiceId}
                onChange={(e) => setFormData((prev) => ({ ...prev, invoiceId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason *
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            >
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason Details
            </label>
            <textarea
              value={formData.reasonDetails}
              onChange={(e) => setFormData((prev) => ({ ...prev, reasonDetails: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Line Items
              </label>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {formData.items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    required
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                    }
                    step="0.01"
                    min="0"
                    className="w-28 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                  />
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm">
              <span className="text-slate-500 dark:text-slate-400">Total: </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                ${totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.organizationId || formData.items.length === 0}
              className="flex-1 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Credit Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreditNotesPanel;
