import { CreditCard, Gauge, Receipt, Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components/ui/primitives';
import { Api } from '../../services/api';
import { cn } from '../../utils/cn';
import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { TableColumn } from '../shared/ModuleHub/FilterableTable';
import { FilterableTable } from '../shared/ModuleHub/FilterableTable';

type TabId = 'summary' | 'plan' | 'payments' | 'invoices' | 'controls';

type PlanOption = {
  id: string;
  name: string;
  price_monthly?: number;
  token_limit?: number;
  storage_limit_gb?: number;
};

type PlanAssignmentForm = {
  planId: string;
  planName: string;
  status: string;
  tokenLimit: string;
  storageLimitMb: string;
  seats: string;
  aiCallsPerDay: string;
  tokenBalance: string;
  expiresAt: string;
};

const EMPTY_PLAN_FORM: PlanAssignmentForm = {
  planId: '',
  planName: '',
  status: 'active',
  tokenLimit: '',
  storageLimitMb: '',
  seats: '',
  aiCallsPerDay: '',
  tokenBalance: '',
  expiresAt: '',
};

export const AdminBillingFinOpsPanel: React.FC<{ screen?: TabId }> = ({ screen }) => {
  const { t } = useTranslation();
  const stripeEnabled = ['true', '1', 'yes'].includes(
    String(import.meta.env.VITE_STRIPE_ENABLED || '')
      .trim()
      .toLowerCase()
  );
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'summary', label: t('admin.billing.tabs.summary', { defaultValue: 'Summary' }) },
    { id: 'plan', label: t('admin.billing.tabs.plan', { defaultValue: 'Plan & limits' }) },
    {
      id: 'payments',
      label: t('admin.billing.tabs.payments', { defaultValue: 'Payment methods' }),
    },
    { id: 'invoices', label: t('admin.billing.tabs.invoices', { defaultValue: 'Invoices' }) },
    { id: 'controls', label: t('admin.billing.tabs.controls', { defaultValue: 'Budgets & tax' }) },
  ];
  const [localActiveTab, setActiveTab] = useState<TabId>('summary');
  const activeTab = screen ?? localActiveTab;
  const [summary, setSummary] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  // M15-H02: progi budżetowe mogą być NIEDOSTĘPNE (brak trwałego magazynu).
  // Nie wolno wtedy pokazywać wartości domyślnych jako gdyby były zapisane.
  const [alertsAvailable, setAlertsAvailable] = useState(true);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [taxSettings, setTaxSettings] = useState<any>(null);
  const [usageDetails, setUsageDetails] = useState<any>(null);
  const [newPaymentMethodId, setNewPaymentMethodId] = useState('');
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [planForm, setPlanForm] = useState<PlanAssignmentForm>(EMPTY_PLAN_FORM);
  const [savingPlan, setSavingPlan] = useState(false);
  const [invoiceFilters, setInvoiceFilters] = useState<FilterChip[]>([]);
  const [paymentFilters, setPaymentFilters] = useState<FilterChip[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [
          summaryResult,
          paymentResult,
          invoiceResult,
          alertResult,
          taxResult,
          usageResult,
          plansResult,
        ] = await Promise.all([
          Api.getAdminBillingSummary(),
          Api.getAdminBillingPaymentMethods(),
          Api.getAdminBillingInvoices(),
          Api.getAdminBillingAlerts(),
          Api.getAdminBillingTaxSettings(),
          Api.getAdminBillingUsageDetails(),
          Api.getAdminBillingPlans().catch(() => ({ plans: [] })),
        ]);
        setSummary(summaryResult);
        setPaymentMethods(paymentResult?.paymentMethods || []);
        setInvoices(invoiceResult?.invoices || []);
        const nextAlerts = Array.isArray(alertResult?.alerts) ? alertResult.alerts : [];
        setAlertsAvailable(alertResult?.available !== false);
        setAlerts(nextAlerts);
        setTaxSettings(taxResult?.settings || taxResult);
        setUsageDetails(usageResult?.summary || usageResult);
        setPlanOptions(Array.isArray(plansResult?.plans) ? plansResult.plans : []);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load billing summary');
      }
    };

    void load();
  }, []);

  const assignPlan = async () => {
    try {
      setSavingPlan(true);
      const payload = {
        planId: planForm.planId || null,
        planName: planForm.planName.trim() || null,
        status: planForm.status || 'active',
        tokenLimit: planForm.tokenLimit === '' ? null : Number(planForm.tokenLimit),
        storageLimitMb: planForm.storageLimitMb === '' ? null : Number(planForm.storageLimitMb),
        seats: planForm.seats === '' ? null : Number(planForm.seats),
        aiCallsPerDay: planForm.aiCallsPerDay === '' ? null : Number(planForm.aiCallsPerDay),
        tokenBalance: planForm.tokenBalance === '' ? null : Number(planForm.tokenBalance),
        expiresAt: planForm.expiresAt ? new Date(planForm.expiresAt).toISOString() : null,
      };
      await Api.assignAdminBillingPlan(payload);
      const refreshed = await Api.getAdminBillingSummary();
      const persistedPlan = refreshed?.summary?.plan;
      const expectedPlan = payload.planName || planForm.planName || undefined;
      if (!refreshed?.summary || (expectedPlan && persistedPlan?.name !== expectedPlan)) {
        throw new Error('Plan request completed, but provider readback did not match the target.');
      }
      setSummary(refreshed);
      toast.success(t('admin.billing.plan.saved', { defaultValue: 'Plan and limits assigned' }));
    } catch (error: any) {
      const validationErrors = error?.validationErrors;
      if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        toast.error(validationErrors.join('; '));
      } else {
        toast.error(error?.message || 'Failed to assign plan');
      }
    } finally {
      setSavingPlan(false);
    }
  };

  const addPaymentMethod = async () => {
    if (!newPaymentMethodId.trim()) {
      toast.error(
        t('admin.billing.payments.idRequired', { defaultValue: 'Enter a payment method id.' })
      );
      return;
    }
    try {
      await Api.addAdminBillingPaymentMethod({
        paymentMethodId: newPaymentMethodId.trim(),
      });
      const readback = await Api.getAdminBillingPaymentMethods();
      const persisted = readback?.paymentMethods || [];
      if (!persisted.some((method: any) => method.id === newPaymentMethodId.trim())) {
        throw new Error('Payment request completed, but provider readback did not confirm it.');
      }
      setPaymentMethods(persisted);
      setNewPaymentMethodId('');
      toast.success('Payment method added');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add payment method');
    }
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      await Api.setAdminBillingDefaultPaymentMethod(paymentMethodId);
      const readback = await Api.getAdminBillingPaymentMethods();
      const persisted = readback?.paymentMethods || [];
      if (!persisted.some((method: any) => method.id === paymentMethodId && method.is_default)) {
        throw new Error('Default change was not confirmed by provider readback.');
      }
      setPaymentMethods(persisted);
      toast.success('Default payment method updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update default payment method');
    }
  };

  const removePaymentMethod = async (paymentMethodId: string) => {
    try {
      await Api.removeAdminBillingPaymentMethod(paymentMethodId);
      const readback = await Api.getAdminBillingPaymentMethods();
      const persisted = readback?.paymentMethods || [];
      if (persisted.some((method: any) => method.id === paymentMethodId)) {
        throw new Error(
          'Removal request completed, but provider readback still contains the method.'
        );
      }
      setPaymentMethods(persisted);
      toast.success('Payment method removed');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove payment method');
    }
  };

  const saveAlerts = async () => {
    // M15-H02: sukces melduje WYŁĄCZNIE serwer, po potwierdzonym read-backu.
    // Brak potwierdzenia = błąd + oznaczenie progów jako niedostępnych, nigdy
    // zielony toast nad niezapisanymi danymi.
    try {
      setSavingAlerts(true);
      const result = await Api.updateAdminBillingAlerts(alerts);
      if (!result?.success) {
        setAlertsAvailable(false);
        toast.error(
          result?.message ||
            t('admin.billing.alerts.saveFailed', {
              defaultValue: 'Nie udało się zapisać progów budżetowych.',
            })
        );
        return;
      }
      if (Array.isArray(result?.alerts)) setAlerts(result.alerts);
      setAlertsAvailable(true);
      toast.success(t('admin.billing.alerts.saved', { defaultValue: 'Progi budżetowe zapisane' }));
    } catch (error: any) {
      setAlertsAvailable(false);
      toast.error(
        error?.message ||
          t('admin.billing.alerts.saveFailed', {
            defaultValue: 'Nie udało się zapisać progów budżetowych.',
          })
      );
    } finally {
      setSavingAlerts(false);
    }
  };

  const saveTaxSettings = async () => {
    try {
      await Api.updateAdminBillingTaxSettings(taxSettings || {});
      const readback = await Api.getAdminBillingTaxSettings();
      if (!readback?.settings && !readback?.tax && !readback?.company) {
        throw new Error('Tax settings request completed, but durable readback was unavailable.');
      }
      setTaxSettings(readback?.settings || readback);
      toast.success('Billing tax settings updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update billing tax settings');
    }
  };

  const invoiceColumns: TableColumn[] = [
    {
      id: 'invoiceNumber',
      label: 'Invoice',
      width: '180px',
      render: (row) => <span className="text-slate-900 dark:text-white">{row.invoiceNumber}</span>,
    },
    {
      id: 'invoiceStatus',
      label: 'Status',
      width: '120px',
      filterable: true,
      filterOptions: [
        { value: 'paid', label: 'Paid' },
        { value: 'open', label: 'Open' },
        { value: 'draft', label: 'Draft' },
        { value: 'void', label: 'Void' },
        { value: 'uncollectible', label: 'Uncollectible' },
      ],
      render: (row) => (
        <span className="text-slate-600 dark:text-slate-300">{row.invoiceStatus}</span>
      ),
    },
    {
      id: 'amountDue',
      label: 'Amount due',
      width: '140px',
      align: 'right',
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.amountDue}</span>,
    },
    {
      id: 'amountPaid',
      label: 'Amount paid',
      width: '140px',
      align: 'right',
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.amountPaid}</span>,
    },
    {
      id: 'dueDate',
      label: 'Due date',
      width: '140px',
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.dueDate}</span>,
    },
  ];

  const paymentColumns: TableColumn[] = [
    {
      id: 'cardInfo',
      label: 'Card',
      width: '220px',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-white">{row.cardInfo}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{row.expiry}</div>
        </div>
      ),
    },
    {
      id: 'isDefault',
      label: 'Default',
      width: '120px',
      render: (row) => (
        <span className="text-slate-600 dark:text-slate-300">{row.isDefault ? 'Yes' : '—'}</span>
      ),
    },
  ];

  const renderTab = () => {
    if (activeTab === 'plan') {
      const inputClass =
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white';
      const labelClass =
        'block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('admin.billing.plan.title', { defaultValue: 'Assign plan & limits' })}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t('admin.billing.plan.subtitle', {
                defaultValue:
                  'Manual billing: assign a plan, credit balance, storage, seats, and expiry. Leave a field blank to keep its current value.',
              })}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="admin-billing-plan-select" className={labelClass}>
                  {t('admin.billing.plan.planLabel', { defaultValue: 'Subscription plan' })}
                </label>
                <select
                  id="admin-billing-plan-select"
                  value={planForm.planId}
                  onChange={(event) => {
                    const planId = event.target.value;
                    const matched = planOptions.find((plan) => plan.id === planId);
                    setPlanForm((current) => ({
                      ...current,
                      planId,
                      planName: matched?.name || current.planName,
                    }));
                  }}
                  className={cn(inputClass, 'mt-1')}
                >
                  <option value="">
                    {t('admin.billing.plan.keepCurrent', { defaultValue: 'Keep current plan' })}
                  </option>
                  {planOptions.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="admin-billing-plan-name" className={labelClass}>
                  {t('admin.billing.plan.planName', { defaultValue: 'Plan label (override)' })}
                </label>
                <input
                  id="admin-billing-plan-name"
                  type="text"
                  value={planForm.planName}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, planName: event.target.value }))
                  }
                  className={cn(inputClass, 'mt-1')}
                />
              </div>

              <div>
                <label htmlFor="admin-billing-status" className={labelClass}>
                  {t('admin.billing.plan.status', { defaultValue: 'Billing status' })}
                </label>
                <select
                  id="admin-billing-status"
                  value={planForm.status}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, status: event.target.value }))
                  }
                  className={cn(inputClass, 'mt-1')}
                >
                  {['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused'].map(
                    (status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="admin-billing-expiry" className={labelClass}>
                  {t('admin.billing.plan.expiry', { defaultValue: 'Expiry / period end' })}
                </label>
                <input
                  id="admin-billing-expiry"
                  type="date"
                  value={planForm.expiresAt}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, expiresAt: event.target.value }))
                  }
                  className={cn(inputClass, 'mt-1')}
                />
              </div>

              <div>
                <label htmlFor="admin-billing-token-limit" className={labelClass}>
                  {t('admin.billing.plan.tokenLimit', { defaultValue: 'Token / credit limit' })}
                </label>
                <input
                  id="admin-billing-token-limit"
                  type="number"
                  min={0}
                  value={planForm.tokenLimit}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, tokenLimit: event.target.value }))
                  }
                  className={cn(inputClass, 'mt-1')}
                />
              </div>

              <div>
                <label htmlFor="admin-billing-token-balance" className={labelClass}>
                  {t('admin.billing.plan.tokenBalance', {
                    defaultValue: 'Credit balance (tokens)',
                  })}
                </label>
                <input
                  id="admin-billing-token-balance"
                  type="number"
                  min={0}
                  value={planForm.tokenBalance}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, tokenBalance: event.target.value }))
                  }
                  className={cn(inputClass, 'mt-1')}
                />
              </div>

              <div>
                <label htmlFor="admin-billing-storage" className={labelClass}>
                  {t('admin.billing.plan.storageLimit', { defaultValue: 'Storage limit (MB)' })}
                </label>
                <input
                  id="admin-billing-storage"
                  type="number"
                  min={0}
                  value={planForm.storageLimitMb}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, storageLimitMb: event.target.value }))
                  }
                  className={cn(inputClass, 'mt-1')}
                />
              </div>

              <div>
                <label htmlFor="admin-billing-seats" className={labelClass}>
                  {t('admin.billing.plan.seats', { defaultValue: 'Seats (max users)' })}
                </label>
                <input
                  id="admin-billing-seats"
                  type="number"
                  min={0}
                  value={planForm.seats}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, seats: event.target.value }))
                  }
                  className={cn(inputClass, 'mt-1')}
                />
              </div>

              <div>
                <label htmlFor="admin-billing-ai-calls" className={labelClass}>
                  {t('admin.billing.plan.aiCalls', { defaultValue: 'AI calls per day' })}
                </label>
                <input
                  id="admin-billing-ai-calls"
                  type="number"
                  min={0}
                  value={planForm.aiCallsPerDay}
                  onChange={(event) =>
                    setPlanForm((current) => ({ ...current, aiCallsPerDay: event.target.value }))
                  }
                  className={cn(inputClass, 'mt-1')}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                variant="brand"
                onClick={() => void assignPlan()}
                loading={savingPlan}
                disabled={savingPlan}
              >
                {t('admin.billing.plan.save', { defaultValue: 'Assign plan & limits' })}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'payments') {
      return (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newPaymentMethodId}
              onChange={(event) => setNewPaymentMethodId(event.target.value)}
              placeholder={t('admin.billing.payments.idPlaceholder', {
                defaultValue: 'Payment method id',
              })}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
            />
            <button
              onClick={() => void addPaymentMethod()}
              className="rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary"
            >
              Add method
            </button>
          </div>
          <FilterableTable
            columns={paymentColumns}
            data={paymentMethods.map((method) => ({
              id: method.id,
              cardInfo: `${method.brand || 'Card'} ending in ${method.last4}`,
              expiry: `Expires ${method.exp_month}/${method.exp_year}`,
              isDefault: Boolean(method.is_default),
            }))}
            getRowActions={(row) => {
              const method = paymentMethods.find((m) => m.id === row.id);
              if (!method || method.is_default) return [];
              return [
                {
                  id: 'make-default',
                  label: 'Make default',
                  onClick: () => void setDefaultPaymentMethod(row.id),
                },
                {
                  id: 'remove',
                  label: 'Remove',
                  variant: 'danger' as const,
                  onClick: () => void removePaymentMethod(row.id),
                },
              ];
            }}
            activeFilters={paymentFilters}
            onFilterChange={setPaymentFilters}
            emptyMessage="No payment methods added yet."
            persistKey="admin-payments-table"
            canvasClassName=""
          />
        </div>
      );
    }

    if (activeTab === 'invoices') {
      return (
        <FilterableTable
          columns={invoiceColumns}
          data={invoices.map((invoice) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoice_number || invoice.id,
            invoiceStatus: invoice.status || '-',
            amountDue: invoice.amount_due || 0,
            amountPaid: invoice.amount_paid || 0,
            dueDate: invoice.due_date || '-',
          }))}
          hideRowActions
          activeFilters={invoiceFilters}
          onFilterChange={setInvoiceFilters}
          emptyMessage="No invoices yet for this workspace."
          persistKey="admin-invoices-table"
          canvasClassName=""
        />
      );
    }

    if (activeTab === 'controls') {
      return (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Spend alerts</div>
            {!alertsAvailable && (
              <div
                role="alert"
                data-testid="billing-alerts-unavailable"
                className="rounded-lg border border-c-warning/40 bg-c-warning/10 px-3 py-2 text-sm text-c-text"
              >
                {t('admin.billing.alerts.unavailable', {
                  defaultValue:
                    'Progi budżetowe są teraz niedostępne — magazyn ustawień nie odpowiada. Nic nie zostało zapisane i nie pokazujemy wartości, których nie ma.',
                })}
              </div>
            )}
            {alertsAvailable && alerts.length === 0 && (
              <div className="text-sm text-c-text-muted" data-testid="billing-alerts-empty">
                {t('admin.billing.alerts.empty', {
                  defaultValue: 'Nie ustawiono jeszcze żadnego progu budżetowego.',
                })}
              </div>
            )}
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
              disabled={!alertsAvailable || savingAlerts}
              data-testid="billing-alerts-save"
              className="rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary"
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
        <h2 className="flex items-center gap-2 text-slate-900 dark:text-white">
          <CreditCard className="h-5 w-5 text-primary-500" />
          Billing, FinOps, and commercial controls
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          P32 now exposes subscriptions, payment methods, invoices, budgets, tax settings, and usage
          posture as first-class tenant admin capabilities.
        </p>
      </div>
      {!screen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-medium transition',
                  activeTab === tab.id
                    ? 'bg-c-text text-c-bg'
                    : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {renderTab()}
    </div>
  );
};

export default AdminBillingFinOpsPanel;
