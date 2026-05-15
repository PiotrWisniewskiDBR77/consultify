import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Cpu,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '../../services/api';

type OrgSummary = {
  id: string;
  name: string;
  status?: string;
  plan?: string;
  user_count?: number;
  usersCount?: number;
  monthly_budget_usd?: number;
  budget_spent_current_period?: number;
};

type OrgPolicy = {
  organization_id: string;
  retention_days: number | null;
  legal_hold_enabled: number;
  residency_region: string | null;
};

type TenantResourceEnvelope = {
  budget?: {
    monthlyBudgetUsd?: number;
    spentCurrentPeriod?: number;
    remainingBudget?: number;
    utilizationPercent?: number;
    alertTriggered?: boolean;
  };
  subscription?: {
    planName?: string;
    memoryLimitMb?: number;
    cpuQuotaPercent?: number;
    maxConcurrentAiJobs?: number;
  };
};

const metricTone = (value: number, warningThreshold: number, criticalThreshold: number) => {
  if (value >= criticalThreshold) return 'text-rose-600 dark:text-rose-400';
  if (value >= warningThreshold) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
};

const formatCurrency = (value?: number | null) =>
  typeof value === 'number'
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value)
    : 'n/a';

const formatCount = (value?: number | null) =>
  typeof value === 'number' ? new Intl.NumberFormat().format(value) : 'n/a';

export const TenantCommandCenterView: React.FC = () => {
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [policies, setPolicies] = useState<OrgPolicy[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [resources, setResources] = useState<TenantResourceEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgs, policyResult, dashboardResult] = await Promise.all([
        Api.getOrganizations(),
        Api.getOrgPolicies(),
        Api.getSuperAdminDashboard(),
      ]);
      setOrganizations(Array.isArray(orgs) ? orgs : []);
      setPolicies(policyResult?.policies || []);
      setDashboard(dashboardResult || null);
      setSelectedOrgId((current) => current || orgs?.[0]?.id || '');
    } catch (err: any) {
      setError(err?.message || 'Failed to load tenant command center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (!selectedOrgId) return;

    let cancelled = false;
    const fetchTenantDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const [billingResult, resourceResult] = await Promise.all([
          Api.getOrganizationBillingDetails(selectedOrgId),
          Api.get(`/superadmin/organizations/${encodeURIComponent(selectedOrgId)}/resources`),
        ]);
        if (cancelled) return;
        setBilling(billingResult || null);
        setResources(resourceResult || null);
      } catch (error) {
        if (cancelled) return;
        console.error('[TenantCommandCenterView] Failed to fetch tenant details', error);
        setBilling(null);
        setResources(null);
        setDetailsError(
          'Detailed tenant billing and resource telemetry is temporarily unavailable.'
        );
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    fetchTenantDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.id === selectedOrgId) || null,
    [organizations, selectedOrgId]
  );

  const selectedPolicy = useMemo(
    () => policies.find((policy) => policy.organization_id === selectedOrgId) || null,
    [policies, selectedOrgId]
  );

  const posture = useMemo(() => {
    const legalHoldCount = policies.filter((policy) => policy.legal_hold_enabled).length;
    const residencyReviewCount = policies.filter((policy) => !policy.residency_region).length;
    const suspendedCount = organizations.filter(
      (org) => String(org.status || '').toLowerCase() === 'suspended'
    ).length;
    return { legalHoldCount, residencyReviewCount, suspendedCount };
  }, [organizations, policies]);

  const userCount =
    selectedOrg?.user_count ?? selectedOrg?.usersCount ?? billing?.organization?.userCount ?? null;
  const budgetUtilization =
    resources?.budget?.utilizationPercent ??
    (selectedOrg?.monthly_budget_usd && selectedOrg?.budget_spent_current_period
      ? (selectedOrg.budget_spent_current_period / selectedOrg.monthly_budget_usd) * 100
      : null);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Tenant Command Center
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
            Single operator landing for tenant lifecycle, commercial state, quotas, policy posture,
            and platform risk.
          </p>
        </div>
        <button
          onClick={fetchOverview}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-indigo-500" />
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Tenants</div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                {loading ? '...' : formatCount(organizations.length)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Suspended: <span className="font-medium">{posture.suspendedCount}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-sky-500" />
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Active users 7d</div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                {loading ? '...' : formatCount(dashboard?.counts?.active_users_7d)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Total users:{' '}
            <span className="font-medium">{formatCount(dashboard?.counts?.total_users)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Legal holds</div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                {loading ? '...' : posture.legalHoldCount}
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Residency review: <span className="font-medium">{posture.residencyReviewCount}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-emerald-500" />
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">AI calls</div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                {loading ? '...' : formatCount(dashboard?.ai?.total_ai_calls)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Tokens: <span className="font-medium">{formatCount(dashboard?.ai?.total_tokens)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Tenant focus queue
              </h3>
              <p className="text-xs text-slate-500">
                Select a tenant to inspect commercial and quota posture.
              </p>
            </div>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {organizations.slice(0, 8).map((org) => {
              const policy = policies.find((item) => item.organization_id === org.id);
              const needsAttention =
                String(org.status || '').toLowerCase() !== 'active' ||
                !!policy?.legal_hold_enabled ||
                !policy?.residency_region;
              return (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrgId(org.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    org.id === selectedOrgId
                      ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/10'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-navy-700 dark:bg-navy-950/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{org.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {String(org.plan || 'custom').toUpperCase()} plan
                      </div>
                    </div>
                    {needsAttention ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Status: {org.status || 'active'}</span>
                    <span>Users: {formatCount(org.user_count ?? org.usersCount)}</span>
                    <span>Residency: {policy?.residency_region || 'review'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
          {detailsError && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              {detailsError}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {selectedOrg?.name || 'Tenant details'}
              </h3>
              <p className="text-sm text-slate-500">
                Command summary across lifecycle, billing, quotas, AI usage, and governance.
              </p>
            </div>
            {detailsLoading && (
              <div className="text-xs text-slate-500">Loading tenant posture...</div>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-navy-700">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <CircleDollarSign className="h-4 w-4 text-emerald-500" />
                Commercial governance
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Plan</span>
                  <span className="font-medium">
                    {billing?.subscription?.planName || selectedOrg?.plan || 'n/a'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">MRR / budget</span>
                  <span className="font-medium">
                    {formatCurrency(
                      resources?.budget?.monthlyBudgetUsd ?? selectedOrg?.monthly_budget_usd
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Spent this period</span>
                  <span className="font-medium">
                    {formatCurrency(
                      resources?.budget?.spentCurrentPeriod ??
                        selectedOrg?.budget_spent_current_period
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-navy-700">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <SlidersHorizontal className="h-4 w-4 text-sky-500" />
                Quotas and budgets
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Budget utilization</span>
                  <span
                    className={`font-medium ${metricTone(Number(budgetUtilization || 0), 75, 90)}`}
                  >
                    {budgetUtilization != null ? `${Math.round(budgetUtilization)}%` : 'n/a'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Memory limit</span>
                  <span className="font-medium">
                    {resources?.subscription?.memoryLimitMb
                      ? `${resources.subscription.memoryLimitMb} MB`
                      : 'n/a'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Concurrent AI jobs</span>
                  <span className="font-medium">
                    {resources?.subscription?.maxConcurrentAiJobs ?? 'n/a'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-navy-700">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Shield className="h-4 w-4 text-amber-500" />
                Governance posture
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Legal hold</span>
                  <span className="font-medium">
                    {selectedPolicy?.legal_hold_enabled ? 'Enabled' : 'Not active'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Retention</span>
                  <span className="font-medium">
                    {selectedPolicy?.retention_days
                      ? `${selectedPolicy.retention_days} days`
                      : 'default'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Residency</span>
                  <span className="font-medium">
                    {selectedPolicy?.residency_region || 'review'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-navy-700">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Operator risk notes
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>
                  {selectedPolicy?.legal_hold_enabled
                    ? 'Tenant is under legal hold; destructive actions should remain blocked.'
                    : 'No legal hold is active for this tenant.'}
                </li>
                <li>
                  {budgetUtilization && budgetUtilization >= 90
                    ? 'Budget utilization is above 90%; review AI and connector spend before approving increases.'
                    : 'Budget posture is within normal operating range.'}
                </li>
                <li>
                  {String(selectedOrg?.status || '').toLowerCase() === 'suspended'
                    ? 'Tenant is suspended; support and billing actions should follow explicit recovery flow.'
                    : 'Tenant lifecycle is not blocked by suspension state.'}
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-navy-700">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Enterprise operator checklist
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                {[
                  {
                    label: 'Commercial state visible',
                    ok: Boolean(selectedOrg),
                  },
                  {
                    label: 'Quota posture visible',
                    ok: Boolean(resources?.subscription || resources?.budget),
                  },
                  {
                    label: 'Residency and legal hold visible',
                    ok: Boolean(selectedPolicy),
                  },
                  {
                    label: 'User and activity signals visible',
                    ok: Boolean(userCount != null || dashboard?.counts),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-navy-950/50"
                  >
                    <span>{item.label}</span>
                    <span
                      className={
                        item.ok
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {item.ok ? 'Ready' : 'Partial'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedOrg && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-navy-700 dark:bg-navy-950/40 dark:text-slate-300">
              <span className="font-medium text-slate-900 dark:text-white">{selectedOrg.name}</span>{' '}
              currently has <span className="font-medium">{formatCount(userCount)}</span> users,
              budget remaining of{' '}
              <span className="font-medium">
                {formatCurrency(resources?.budget?.remainingBudget)}
              </span>
              , and residency posture set to{' '}
              <span className="font-medium">{selectedPolicy?.residency_region || 'review'}</span>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantCommandCenterView;
