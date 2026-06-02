import { Activity, Brain, FileText, Shield, Users, Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

type OverviewResponse = {
  organizationId: string;
  sectionErrors?: Record<string, string>;
  overview: {
    membersByRole: Record<string, number>;
    totalMembers: number | null;
    pendingOwnershipTransfers: number | null;
    securityPolicy: {
      mfaRequired?: boolean;
      ssoEnabled?: boolean;
      ssoEnforced?: boolean;
    } | null;
    collaboration: {
      guestAccessEnabled?: boolean;
      externalLinkSharing?: boolean;
      toolApprovalRequired?: boolean;
    } | null;
    billing: {
      billing?: { status?: string };
      plan?: { name?: string; priceMonthly?: number };
      usage?: { tokenBalance?: number; tokensUsed?: number };
    } | null;
    ai: {
      governanceSummary?: {
        policyLevel?: string;
        modelCount?: number;
        budgetStatus?: string;
      };
      llmPolicy?: {
        review_state?: string;
      };
    } | null;
    audit: {
      totalLogs: number;
      unresolvedCount: number;
      highRiskCount: number;
    } | null;
  };
};

const MetricCard: React.FC<{
  title: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  unavailable?: boolean;
}> = ({ title, value, detail, icon: Icon, unavailable = false }) => (
  <div
    className={`rounded-2xl border p-5 ${
      unavailable
        ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
        : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'
    }`}
  >
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
        <div
          className={`mt-2 text-2xl font-semibold ${
            unavailable ? 'text-amber-900 dark:text-amber-100' : 'text-slate-900 dark:text-white'
          }`}
        >
          {value}
        </div>
      </div>
      <div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-white/10 dark:text-slate-200">
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <div
      className={`mt-3 text-xs ${
        unavailable ? 'text-amber-800 dark:text-amber-200' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {detail}
    </div>
  </div>
);

export const AdminEnterpriseOverviewPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const result = await Api.getAdminOverview();
      setData(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load admin overview';
      setData(null);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
        Loading enterprise admin overview...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-500/20 dark:bg-amber-500/10">
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
          Admin overview is unavailable
        </h3>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          {errorMessage || 'No overview data was returned for this organization.'}
        </p>
        <button
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
        >
          Retry overview
        </button>
      </div>
    );
  }

  const membersByRole = Object.entries(data.overview.membersByRole || {})
    .map(([role, count]) => `${role}: ${count}`)
    .join(' | ');
  const sectionErrors = data.sectionErrors || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="People & Access"
          value={sectionErrors.people ? 'Unavailable' : String(data.overview.totalMembers || 0)}
          detail={sectionErrors.people || membersByRole || 'No member distribution available'}
          icon={Users}
          unavailable={!!sectionErrors.people}
        />
        <MetricCard
          title="Security Posture"
          value={
            sectionErrors.security
              ? 'Unavailable'
              : data.overview.securityPolicy?.mfaRequired
                ? 'MFA enforced'
                : 'MFA optional'
          }
          detail={
            sectionErrors.security ||
            `SSO ${data.overview.securityPolicy?.ssoEnabled ? 'enabled' : 'disabled'} | ${data.overview.securityPolicy?.ssoEnforced ? 'enforced' : 'not enforced'}`
          }
          icon={Shield}
          unavailable={!!sectionErrors.security}
        />
        <MetricCard
          title="Billing & FinOps"
          value={
            sectionErrors.billing
              ? 'Unavailable'
              : String(data.overview.billing?.plan?.name || 'Unknown')
          }
          detail={
            sectionErrors.billing ||
            `Status: ${data.overview.billing?.billing?.status || 'unknown'} | Token balance: ${data.overview.billing?.usage?.tokenBalance ?? 'unknown'}`
          }
          icon={Wallet}
          unavailable={!!sectionErrors.billing}
        />
        <MetricCard
          title="AI Governance"
          value={
            sectionErrors.ai
              ? 'Unavailable'
              : String(data.overview.ai?.governanceSummary?.policyLevel || 'Unspecified')
          }
          detail={
            sectionErrors.ai ||
            `LLM review: ${data.overview.ai?.llmPolicy?.review_state || 'n/a'} | Models: ${data.overview.ai?.governanceSummary?.modelCount ?? 'unknown'}`
          }
          icon={Brain}
          unavailable={!!sectionErrors.ai}
        />
        <MetricCard
          title="Audit & Risk"
          value={
            sectionErrors.audit ? 'Unavailable' : String(data.overview.audit?.highRiskCount || 0)
          }
          detail={
            sectionErrors.audit ||
            `High-risk changes | Unresolved: ${data.overview.audit?.unresolvedCount || 0} | Total logs: ${data.overview.audit?.totalLogs || 0}`
          }
          icon={FileText}
          unavailable={!!sectionErrors.audit}
        />
        <MetricCard
          title="Tenant Operations"
          value={
            sectionErrors.ownership
              ? 'Unavailable'
              : String(data.overview.pendingOwnershipTransfers || 0)
          }
          detail={
            sectionErrors.ownership ||
            sectionErrors.collaboration ||
            `Pending ownership transfers | Guests ${data.overview.collaboration?.guestAccessEnabled ? 'enabled' : 'disabled'} | External links ${data.overview.collaboration?.externalLinkSharing ? 'enabled' : 'disabled'}`
          }
          icon={Activity}
          unavailable={!!sectionErrors.ownership || !!sectionErrors.collaboration}
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
