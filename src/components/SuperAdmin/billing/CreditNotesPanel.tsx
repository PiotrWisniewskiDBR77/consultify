/**
 * CreditNotesPanel - Credit Notes Management
 *
 * Features:
 * - Credit notes management
 * - Issue refunds
 */

import {
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface CreditNote {
  id: string;
  organization_id: string;
  organization_name?: string;
  invoice_id?: string;
  note_number: string;
  amount: number;
  reason?: string;
  status: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
}

export const CreditNotesPanel: React.FC = () => {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    organizationId: '',
    amount: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchCreditNotes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await Api.get('/billing/credit-notes');
      setCreditNotes(result.creditNotes || []);
    } catch (error) {
      console.error('Failed to fetch credit notes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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
    fetchCreditNotes();
  }, [fetchOrganizations, fetchCreditNotes]);

  const handleCreateCreditNote = async () => {
    if (!createForm.organizationId || !createForm.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await Api.post('/billing/credit-notes', {
        organizationId: createForm.organizationId,
        amount: Math.round(parseFloat(createForm.amount) * 100), // Convert to cents
        reason: createForm.reason,
      });
      toast.success('Credit note created');
      setShowCreateModal(false);
      setCreateForm({ organizationId: '', amount: '', reason: '' });
      fetchCreditNotes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create credit note');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const filteredCreditNotes = creditNotes.filter((cn) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cn.note_number.toLowerCase().includes(query) ||
      cn.organization_name?.toLowerCase().includes(query)
    );
  });

  const totalCredited = creditNotes.reduce((sum, cn) => sum + cn.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-primary-500/20 to-crimson-700/10 border border-primary-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary-300">Total Credits Issued</p>
            <p className="text-3xl font-bold text-c-text mt-1">{formatCurrency(totalCredited)}</p>
            <p className="text-sm text-primary-400 mt-1">{creditNotes.length} credit notes</p>
          </div>
          <div className="w-16 h-16 rounded-xl bg-primary-500/20 flex items-center justify-center">
            <Receipt size={32} className="text-primary-400" />
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
          />
          <input
            type="text"
            placeholder="Search credit notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none w-64"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCreditNotes}
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
            Issue Credit Note
          </button>
        </div>
      </div>

      {/* Credit Notes List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : filteredCreditNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600 dark:text-slate-500">
          <Receipt size={48} className="mb-4 opacity-50" />
          <p>No credit notes found</p>
        </div>
      ) : (
        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl overflow-hidden">
          <table /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */  className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Credit Note
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Organization
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Reason
                </th>
                <th className="text-right p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Amount
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Status
                </th>
                <th className="text-left p-4 text-sm font-medium text-slate-600 dark:text-slate-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCreditNotes.map((cn) => (
                <tr key={cn.id} className="border-b border-white/[0.04] hover:bg-c-surface-raised/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <FileText size={16} className="text-primary-400" />
                      </div>
                      <span className="font-medium text-c-text">{cn.note_number}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-slate-600 dark:text-slate-500" />
                      <span className="text-c-text">{cn.organization_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-600 dark:text-slate-500">{cn.reason || '-'}</span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-medium text-emerald-400">
                      {formatCurrency(cn.amount)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 size={14} />
                      {cn.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-500">
                      <Calendar size={14} />
                      <span className="text-sm">
                        {new Date(cn.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Credit Note Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-c-text mb-6">Issue Credit Note</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Organization
                </label>
                <select
                  value={createForm.organizationId}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, organizationId: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text focus:border-primary-500/50 outline-none"
                >
                  <option value="">Select organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Amount (USD)
                </label>
                <div className="relative">
                  <DollarSign
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Reason</label>
                <textarea
                  value={createForm.reason}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Enter reason for credit note..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-white/10 rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-primary-500/50 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCreditNote}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Issue Credit Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditNotesPanel;
