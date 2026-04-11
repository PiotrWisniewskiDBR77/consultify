import { Gauge, Receipt, Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { OrganizationAdminPanel } from '../Organization/OrganizationAdminPanel';

type AdminBillingSummary = {
  summary?: {
    billing?: { status?: string; currentPeriodEnd?: string | null };
    plan?: { name?: string; priceMonthly?: number; tokenLimit?: number; storageLimitGb?: number };
    usage?: {
      tokenBalance?: number;
      tokensUsed?: number;
      usersUsed?: number;
      usersLimit?: number;
      projectsUsed?: number;
      projectsLimit?: number;
    };
    alerts?: { costCapMonthly?: number; emailNotifications?: boolean };
  };
};

export const AdminBillingFinOpsPanel: React.FC = () => {
  const [summary, setSummary] = useState<AdminBillingSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await Api.getAdminBillingSummary();
        setSummary(result);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load billing summary');
      }
    };

    void load();
  }, []);

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
          Billing, subscriptions, and invoices
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Tenant billing and commercial controls are now first-class Admin capabilities rather than
          scattered organization fragments.
        </p>
      </div>

      <OrganizationAdminPanel section="billing" />
      <OrganizationAdminPanel section="limits" />
    </div>
  );
};

export default AdminBillingFinOpsPanel;
