import { Activity, Brain, FileText, Shield, Users, Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

type OverviewResponse = {
  organizationId: string;
  overview: {
    membersByRole: Record<string, number>;
    totalMembers: number;
    pendingOwnershipTransfers: number;
    securityPolicy: {
      mfaRequired?: boolean;
      ssoEnabled?: boolean;
      ssoEnforced?: boolean;
    };
    collaboration: {
      guestAccessEnabled?: boolean;
      externalLinkSharing?: boolean;
      toolApprovalRequired?: boolean;
    };
    billing: {
      billing?: { status?: string };
      plan?: { name?: string; priceMonthly?: number };
      usage?: { tokenBalance?: number; tokensUsed?: number };
    };
    ai: {
      governanceSummary?: {
        policyLevel?: string;
        modelCount?: number;
        budgetStatus?: string;
      };
      llmPolicy?: {
        review_state?: string;
      };
    };
    audit: {
      totalLogs: number;
      unresolvedCount: number;
      highRiskCount: number;
    };
  };
};

const MetricCard: React.FC<{
  title: string;
  value: string;
  detail: string;
  icon: React.ElementType;
}> = ({ title, value, detail, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      </div>
      <div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-white/10 dark:text-slate-200">
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detail}</div>
  </div>
);

export const AdminEnterpriseOverviewPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await Api.getAdminOverview();
        setData(result);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load admin overview');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
        Loading enterprise admin overview...
      </div>
    );
  }

  if (!data) return null;

  const membersByRole = Object.entries(data.overview.membersByRole || {})
    .map(([role, count]) => `${role}: ${count}`)
    .join(' | ');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="People & Access"
          value={String(data.overview.totalMembers || 0)}
          detail={membersByRole || 'No member distribution available'}
          icon={Users}
        />
        <MetricCard
          title="Security Posture"
          value={data.overview.securityPolicy?.mfaRequired ? 'MFA enforced' : 'MFA optional'}
          detail={`SSO ${data.overview.securityPolicy?.ssoEnabled ? 'enabled' : 'disabled'} | ${data.overview.securityPolicy?.ssoEnforced ? 'enforced' : 'not enforced'}`}
          icon={Shield}
        />
        <MetricCard
          title="Billing & FinOps"
          value={String(data.overview.billing?.plan?.name || 'Unknown')}
          detail={`Status: ${data.overview.billing?.billing?.status || 'unknown'} | Token balance: ${data.overview.billing?.usage?.tokenBalance || 0}`}
          icon={Wallet}
        />
        <MetricCard
          title="AI Governance"
          value={String(data.overview.ai?.governanceSummary?.policyLevel || 'Unspecified')}
          detail={`LLM review: ${data.overview.ai?.llmPolicy?.review_state || 'n/a'} | Models: ${data.overview.ai?.governanceSummary?.modelCount || 0}`}
          icon={Brain}
        />
        <MetricCard
          title="Audit & Risk"
          value={String(data.overview.audit?.highRiskCount || 0)}
          detail={`High-risk changes | Unresolved: ${data.overview.audit?.unresolvedCount || 0} | Total logs: ${data.overview.audit?.totalLogs || 0}`}
          icon={FileText}
        />
        <MetricCard
          title="Tenant Operations"
          value={String(data.overview.pendingOwnershipTransfers || 0)}
          detail={`Pending ownership transfers | Guests ${data.overview.collaboration?.guestAccessEnabled ? 'enabled' : 'disabled'} | External links ${data.overview.collaboration?.externalLinkSharing ? 'enabled' : 'disabled'}`}
          icon={Activity}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Enterprise command center posture
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            P32 now aggregates tenant-critical posture for identity, billing, AI governance, audit,
            and operational ownership in one place.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Immediate follow-up signals
          </h3>
          <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div>
              Review privileged changes if unresolved audit items stay above{' '}
              <strong>{data.overview.audit?.unresolvedCount || 0}</strong>.
            </div>
            <div>
              Confirm access review cadence and break-glass readiness in the IAM policy section.
            </div>
            <div>
              Validate plan limits against AI usage and token balance before the next billing cycle.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEnterpriseOverviewPanel;
