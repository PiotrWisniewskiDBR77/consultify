import { BarChart, Building, CreditCard, FileText, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { ConfirmDialog } from '../../components/MyWork/shared/ConfirmDialog';
import { Api } from '../../services/api';
import { Organization } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface SuperAdminOrgDetailsModalProps {
  org: Organization;
  onClose: () => void;
  onUpdate: () => void;
}

type BillingDetails = {
  billing?: Record<string, unknown>;
  usage?: Record<string, unknown>;
  invoices?: InvoiceRow[];
};

type InvoiceRow = {
  id: string;
  created_at?: string | null;
  amount_due?: unknown;
  status?: string;
  pdf_url?: string;
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
};

const getOrganizationsPayload = (value: unknown) =>
  getListPayload<Organization>(value, ['organizations', 'items']);

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const hasBillingShape = (value: unknown) =>
  isRecord(value) &&
  (isRecord(value.billing) || isRecord(value.usage) || Array.isArray(value.invoices));

export const SuperAdminOrgDetailsModal: React.FC<SuperAdminOrgDetailsModalProps> = ({
  org,
  onClose,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'billing' | 'users'>('general');
  const [loading, setLoading] = useState(false);
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(null);
  const [billingLoadError, setBillingLoadError] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization>(org);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusConfirmationOpen, setStatusConfirmationOpen] = useState(false);
  const [statusChangeReason, setStatusChangeReason] = useState('');

  const fetchBillingDetails = useCallback(async () => {
    setLoading(true);
    setBillingLoadError(null);
    try {
      const data = await Api.getOrganizationBillingDetails(org.id);
      const payload = getObjectPayload(data);
      if (!isRecord(payload)) {
        throw new Error('Billing details response was not an object');
      }
      if (!hasBillingShape(payload)) {
        throw new Error('Billing details response was incomplete');
      }
      setBillingDetails({
        billing: isRecord(payload.billing) ? payload.billing : undefined,
        usage: isRecord(payload.usage) ? payload.usage : undefined,
        invoices: Array.isArray(payload.invoices) ? (payload.invoices as InvoiceRow[]) : undefined,
      });
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load billing details');
      setBillingDetails(null);
      setBillingLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [org.id]);

  // Fetch billing details when tab changes to billing
  useEffect(() => {
    if (activeTab === 'billing' && !billingDetails) {
      void fetchBillingDetails();
    }
  }, [activeTab, billingDetails, fetchBillingDetails]);

  const saveGeneral = async (confirmation?: { confirmation: true; reason: string }) => {
    try {
      setSavingGeneral(true);
      setActionError(null);
      await Api.updateOrganization(org.id, {
        plan: editingOrg.plan,
        status: editingOrg.status,
        discount_percent: editingOrg.discount_percent,
        ...confirmation,
      });
      const refreshedOrganizations = await Api.getOrganizations();
      if (!hasListShape(refreshedOrganizations, ['organizations', 'items'])) {
        throw new Error('Organization update could not be confirmed by read-back');
      }
      const refreshedOrg = getOrganizationsPayload(refreshedOrganizations).find(
        (candidate) => candidate.id === org.id
      );
      if (
        !refreshedOrg ||
        refreshedOrg.plan !== editingOrg.plan ||
        refreshedOrg.status !== editingOrg.status ||
        (refreshedOrg.discount_percent || 0) !== (editingOrg.discount_percent || 0)
      ) {
        throw new Error('Organization update was not confirmed by the server');
      }
      toast.success('Organization updated');
      onUpdate();
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to update organization');
      setActionError(message);
      toast.error(message);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      editingOrg.status !== org.status &&
      ['suspended', 'blocked', 'cancelled'].includes(editingOrg.status)
    ) {
      setStatusConfirmationOpen(true);
      return;
    }
    void saveGeneral();
  };

  const formatDate = (value?: string | null, fallback = 'Unknown date') => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
  };

  const safeNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatMoney = (value: unknown) => `$${safeNumber(value).toFixed(2)}`;

  const formatText = (value: unknown, fallback = '-') =>
    typeof value === 'string' && value.trim()
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : fallback;

  const formatInteger = (value: unknown, fallback = '0') => {
    const parsed = safeNumber(value, Number.NaN);
    return Number.isFinite(parsed) ? Math.round(parsed).toLocaleString() : fallback;
  };

  const getUsagePercent = (usedValue: unknown, includedValue: unknown) => {
    const used = safeNumber(usedValue);
    const included = safeNumber(includedValue);
    if (included <= 0) return 0;
    return Math.min(100, Math.max(0, (used / included) * 100));
  };

  const renderGeneralTab = () => (
    <form onSubmit={handleSaveGeneral} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
            Organization Name
          </label>
          <input
            disabled
            value={editingOrg.name}
            className="w-full px-3 py-2 bg-c-bg border border-white/10 rounded text-slate-500 dark:text-slate-400"
          />
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">ID: {editingOrg.id}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
            Created At
          </label>
          <input
            disabled
            value={formatDate(org.created_at || org.createdAt)}
            className="w-full px-3 py-2 bg-c-bg border border-white/10 rounded text-slate-500 dark:text-slate-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
            Plan
          </label>
          <select
            value={editingOrg.plan}
            onChange={(e) =>
              setEditingOrg({ ...editingOrg, plan: e.target.value as Organization['plan'] })
            }
            className="w-full px-3 py-2 bg-c-text text-c-bg border border-white/10 rounded focus:border-blue-500 outline-none"
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
            Status
          </label>
          <select
            value={editingOrg.status}
            onChange={(e) =>
              setEditingOrg({ ...editingOrg, status: e.target.value as Organization['status'] })
            }
            className="w-full px-3 py-2 bg-c-text text-c-bg border border-white/10 rounded focus:border-blue-500 outline-none"
          >
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
          Discount (%)
        </label>
        <div className="flex items-center gap-4">
          <input
            type="number"
            min="0"
            max="100"
            value={editingOrg.discount_percent || 0}
            onChange={(e) =>
              setEditingOrg({ ...editingOrg, discount_percent: parseInt(e.target.value) || 0 })
            }
            className="w-32 px-3 py-2 bg-c-text text-c-bg border border-white/10 rounded focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Discount applied to all future invoices.
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 flex justify-end">
        {actionError && (
          <div role="alert" className="mr-auto text-sm text-danger-400">
            {actionError}
          </div>
        )}
        <button
          type="submit"
          disabled={savingGeneral}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium shadow-lg shadow-blue-500/20 transition-all disabled:opacity-60"
        >
          {savingGeneral ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );

  const renderBillingTab = () => {
    if (loading)
      return (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          Loading billing details...
        </div>
      );
    if (billingLoadError)
      return <DegradedState title="Billing details unavailable" description={billingLoadError} />;
    if (!billingDetails)
      return (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          No billing details available.
        </div>
      );

    const billing = billingDetails.billing ?? {};
    const usage = billingDetails.usage ?? {};
    const invoices = billingDetails.invoices ?? [];
    const billingStatus = formatText(billing.status, 'unknown');
    const tokenUsagePercent = getUsagePercent(usage?.tokens_used, usage?.tokens_included);

    return (
      <div className="space-y-6">
        {/* Subscription Card */}
        <div className="bg-c-bg rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
                <CreditCard size={20} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-c-text">Current Subscription</h4>
                <p className="text-xs text-slate-600 dark:text-slate-500">
                  {formatText(billing.plan_name, org.plan?.toUpperCase() || '-')} Plan
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-1 rounded text-xs font-bold uppercase ${billingStatus === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}
            >
              {billingStatus}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-c-surface rounded p-3">
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Monthly Cost</p>
              <p className="font-medium text-c-text">{formatMoney(billing.price_monthly)}</p>
            </div>
            <div className="bg-c-surface rounded p-3">
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Billing Email</p>
              <p className="font-medium text-c-text truncate">
                {formatText(billing.billing_email)}
              </p>
            </div>
            <div className="bg-c-surface rounded p-3">
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Next Invoice</p>
              <p className="font-medium text-c-text">
                {typeof billing.current_period_end === 'string'
                  ? formatDate(billing.current_period_end)
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-c-bg rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-semibold text-c-text mb-4 flex items-center gap-2">
              <BarChart size={16} className="text-blue-400" /> Token Usage
            </h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-500">Used</span>
                  <span className="text-c-text font-medium">
                    {formatInteger(usage?.tokens_used)}
                  </span>
                </div>
                <div className="w-full bg-c-surface h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{
                      width: `${tokenUsagePercent}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1 text-slate-500 dark:text-slate-400">
                  <span>Limit: {formatInteger(usage?.tokens_included, 'Unlimited')}</span>
                  <span>{tokenUsagePercent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-c-bg rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-semibold text-c-text mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-primary-400" /> Overage
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm border-b border-white/5 pb-2">
                <span className="text-slate-600 dark:text-slate-500">Tokens Overage</span>
                <span className="text-c-text">{formatInteger(usage?.tokens_overage)}</span>
              </div>
              <div className="flex justify-between text-sm pt-1">
                <span className="text-slate-600 dark:text-slate-500">Estimated Cost</span>
                <span className="text-green-400 font-bold">
                  {formatMoney(usage?.overage_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-c-bg rounded-lg border border-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 bg-c-surface/50 flex justify-between items-center">
            <h4 className="text-sm font-semibold text-c-text flex items-center gap-2">
              <FileText size={16} className="text-slate-600 dark:text-slate-500" /> Invoice History
            </h4>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <table
              /* §27-exempt: sub-tabela w widoku szczegolow (Invoice History w modalu org, read-only max-h-56), nie samodzielna lista (przetagowane z §27-todo, m27-b 07-15) */ className="w-full text-left border-collapse"
            >
              <thead className="bg-slate-50 dark:bg-navy-900 text-slate-500 dark:text-slate-400 text-xs uppercase sticky top-0">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Amount</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {invoices && invoices.length > 0 ? (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
                      <td className="p-3 text-slate-600">{formatDate(inv.created_at)}</td>
                      <td className="p-3 text-c-text font-medium">{formatMoney(inv.amount_due)}</td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${inv.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-danger-500/20 text-danger-400'}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {inv.pdf_url ? (
                          <a
                            href={inv.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500 dark:text-slate-400">
                      No invoices found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-c-surface border border-white/10 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-c-bg rounded-t-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <Building size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-c-text">{org.name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                Organization Settings & Billing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-full text-slate-600 dark:text-slate-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/10 px-6 bg-c-surface">
          <div className="flex items-center gap-8">
            {[
              { id: 'general', label: 'General Info', icon: <Building size={16} /> },
              { id: 'billing', label: 'Billing & Settlement', icon: <CreditCard size={16} /> },
              { id: 'users', label: 'Users & Access', icon: <Users size={16} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'general' | 'billing' | 'users')}
                className={`py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-c-text'
                    : 'border-transparent text-slate-600 dark:text-slate-500 hover:text-slate-300 hover:border-c-border'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-c-surface">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'billing' && renderBillingTab()}
          {activeTab === 'users' && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>User management is available in the "Users" section of the sidebar.</p>
              <p className="text-xs mt-2">Filter by this organization to manage its users.</p>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={statusConfirmationOpen}
        onCancel={() => {
          setStatusConfirmationOpen(false);
          setStatusChangeReason('');
        }}
        onConfirm={() => {
          if (statusChangeReason.trim().length < 3) return;
          setStatusConfirmationOpen(false);
          void saveGeneral({ confirmation: true, reason: statusChangeReason.trim() });
        }}
        title="Confirm critical organization status change"
        description={`Changing status to ${editingOrg.status} can interrupt tenant access.`}
        confirmLabel="Confirm status change"
        variant="danger"
      >
        <label className="mt-4 block text-sm text-slate-600 dark:text-slate-300">
          Reason
          <textarea
            className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2 text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]"
            value={statusChangeReason}
            onChange={(event) => setStatusChangeReason(event.target.value)}
            rows={3}
            required
          />
        </label>
      </ConfirmDialog>
    </div>
  );
};
