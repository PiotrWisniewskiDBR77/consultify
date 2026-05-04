import { CreditCard, Gauge, Receipt, Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { cn } from '../../utils/cn';

type TabId = 'summary' | 'payments' | 'invoices' | 'controls';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'payments', label: 'Payment methods' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'controls', label: 'Budgets & tax' },
];

const DEFAULT_BILLING_ALERTS = [
  { id: 'default-tokens', type: 'tokens', threshold: 80, isActive: true },
  { id: 'default-spend', type: 'spend', threshold: 75, isActive: true },
];

export const AdminBillingFinOpsPanel: React.FC = () => {
  const stripeEnabled = ['true', '1', 'yes'].includes(
    String(import.meta.env.VITE_STRIPE_ENABLED || '')
      .trim()
      .toLowerCase()
  );
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [summary, setSummary] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [taxSettings, setTaxSettings] = useState<any>(null);
  const [usageDetails, setUsageDetails] = useState<any>(null);
  const [newPaymentMethodId, setNewPaymentMethodId] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryResult, paymentResult, invoiceResult, alertResult, taxResult, usageResult] =
          await Promise.all([
            Api.getAdminBillingSummary(),
            Api.getAdminBillingPaymentMethods(),
            Api.getAdminBillingInvoices(),
            Api.getAdminBillingAlerts(),
            Api.getAdminBillingTaxSettings(),
            Api.getAdminBillingUsageDetails(),
          ]);
        setSummary(summaryResult);
        setPaymentMethods(paymentResult?.paymentMethods || []);
        setInvoices(invoiceResult?.invoices || []);
        const nextAlerts = Array.isArray(alertResult?.alerts) ? alertResult.alerts : [];
        setAlerts(nextAlerts.length > 0 ? nextAlerts : DEFAULT_BILLING_ALERTS);
        setTaxSettings(taxResult?.settings || taxResult);
        setUsageDetails(usageResult?.summary || usageResult);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load billing summary');
      }
    };

    void load();
  }, []);

  const addPaymentMethod = async () => {
    if (!newPaymentMethodId.trim()) {
      toast.error('Enter a payment method id, for example pm_demo_4242');
      return;
    }
    try {
      const result = await Api.addAdminBillingPaymentMethod({
        paymentMethodId: newPaymentMethodId.trim(),
      });
      setPaymentMethods((current) => [result?.paymentMethod, ...current].filter(Boolean));
      setNewPaymentMethodId('');
      toast.success('Payment method added');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add payment method');
    }
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      await Api.setAdminBillingDefaultPaymentMethod(paymentMethodId);
      setPaymentMethods((current) =>
        current.map((method) => ({ ...method, is_default: method.id === paymentMethodId ? 1 : 0 }))
      );
      toast.success('Default payment method updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update default payment method');
    }
  };

  const removePaymentMethod = async (paymentMethodId: string) => {
    try {
      await Api.removeAdminBillingPaymentMethod(paymentMethodId);
      setPaymentMethods((current) => current.filter((method) => method.id !== paymentMethodId));
      toast.success('Payment method removed');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove payment method');
    }
  };

  const saveAlerts = async () => {
    try {
      await Api.updateAdminBillingAlerts(alerts);
      toast.success('Billing alerts updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update billing alerts');
    }
  };

  const saveTaxSettings = async () => {
    try {
      await Api.updateAdminBillingTaxSettings(taxSettings || {});
      toast.success('Billing tax settings updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update billing tax settings');
    }
  };

  const renderTab = () => {
    if (activeTab === 'payments') {
      return (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newPaymentMethodId}
              onChange={(event) => setNewPaymentMethodId(event.target.value)}
              placeholder="pm_demo_4242"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
            />
            <button
              onClick={() => void addPaymentMethod()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
            >
              Add method
            </button>
          </div>
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {method.brand || 'Card'} ending in {method.last4}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Expires {method.exp_month}/{method.exp_year}{' '}
                    {method.is_default ? '| Default' : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!method.is_default && (
                    <button
                      onClick={() => void setDefaultPaymentMethod(method.id)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10"
                    >
                      Make default
                    </button>
                  )}
                  {!method.is_default && (
                    <button
                      onClick={() => void removePaymentMethod(method.id)}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600 dark:border-rose-500/20 dark:text-rose-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'invoices') {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Invoice</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Amount due</th>
                <th className="py-3 pr-4">Amount paid</th>
                <th className="py-3">Due date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No invoices yet for this workspace.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="py-3 pr-4 text-slate-900 dark:text-white">
                      {invoice.invoice_number || invoice.id}
                    </td>
                    <td className="py-3 pr-4">{invoice.status || '-'}</td>
                    <td className="py-3 pr-4">{invoice.amount_due || 0}</td>
                    <td className="py-3 pr-4">{invoice.amount_paid || 0}</td>
                    <td className="py-3">{invoice.due_date || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'controls') {
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Spend alerts</div>
            {alerts.map((alert, index) => (
              <div key={alert.id || index} className="grid gap-2">
                <input
                  type="number"
                  value={alert.threshold || 0}
                  onChange={(event) =>
                    setAlerts((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, threshold: Number(event.target.value || 0) }
                          : item
                      )
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
                />
              </div>
            ))}
            <button
              onClick={() => void saveAlerts()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
            >
              Save alerts
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Tax and invoicing
            </div>
            <input
              type="text"
              value={taxSettings?.company?.legalName || ''}
              onChange={(event) =>
                setTaxSettings((current: any) => ({
                  ...current,
                  company: { ...(current?.company || {}), legalName: event.target.value },
                }))
              }
              placeholder="Legal company name"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
            />
            <input
              type="text"
              value={taxSettings?.tax?.taxId || ''}
              onChange={(event) =>
                setTaxSettings((current: any) => ({
                  ...current,
                  tax: { ...(current?.tax || {}), taxId: event.target.value },
                }))
              }
              placeholder="Tax ID"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
            />
            <button
              onClick={() => void saveTaxSettings()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
            >
              Save tax settings
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Wallet className="h-4 w-4" />
              Plan
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
              {summary?.summary?.plan?.name || 'Unknown'}
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Status: {summary?.summary?.billing?.status || 'unknown'}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Gauge className="h-4 w-4" />
              Limits & Usage
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
              {summary?.summary?.usage?.tokensUsed || 0} / {summary?.summary?.plan?.tokenLimit || 0}
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Token balance: {summary?.summary?.usage?.tokenBalance || 0}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Receipt className="h-4 w-4" />
              Spend posture
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
              {summary?.summary?.alerts?.costCapMonthly || 0}
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Monthly cost cap | Email alerts{' '}
              {summary?.summary?.alerts?.emailNotifications ? 'enabled' : 'disabled'}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Usage and overage posture
          </h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm text-slate-600 dark:text-slate-300">
            <div>Token overage rate: {usageDetails?.overageRates?.tokenOverageRate || 0}</div>
            <div>Storage overage rate: {usageDetails?.overageRates?.storageOverageRate || 0}</div>
            <div>Tracked usage rows: {usageDetails?.usageRecords?.length || 0}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!stripeEnabled && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-5 py-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="text-sm font-semibold">Self-service checkout is currently disabled.</p>
          <p className="mt-1 text-sm">
            Enjoy your 7-day trial. To securely activate an enterprise tier, please contact sales.
          </p>
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <CreditCard className="h-5 w-5 text-primary-500" />
          Billing, FinOps, and commercial controls
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          P32 now exposes subscriptions, payment methods, invoices, budgets, tax settings, and usage
          posture as first-class tenant admin capabilities.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition',
                activeTab === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {renderTab()}
    </div>
  );
};

export default AdminBillingFinOpsPanel;
