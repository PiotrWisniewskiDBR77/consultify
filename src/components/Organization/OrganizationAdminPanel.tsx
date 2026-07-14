/**
 * T063 — OrganizationAdminPanel — Premium admin sections
 */

import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Gauge,
  Globe,
  Loader2,
  Palette,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { useAppStore } from '../../store/useAppStore';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { TableColumn } from '../shared/ModuleHub/FilterableTable';
import { FilterableTable } from '../shared/ModuleHub/FilterableTable';
import { ErrorState, LoadingState, MetaChip } from '../ui/primitives';
import { CompetencyCatalog } from './CompetencyCatalog';
import type { OrganizationSection } from './OrganizationSidebar';

type ApprovedDomainRow = {
  id?: string;
  domain?: string;
};

type OrganizationDomainSnapshot = {
  customDomain: string;
  customDomainVerified: boolean;
};

interface OrganizationAdminPanelProps {
  section: OrganizationSection;
}

export const OrganizationAdminPanel: React.FC<OrganizationAdminPanelProps> = ({ section }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);

  const fetchOrgData = useCallback(async () => {
    try {
      setLoading(true);
      const orgs = await Api.getUserOrganizations();
      const preferredOrgId = currentOrganization?.id;
      const org = Array.isArray(orgs)
        ? orgs.find((candidate: any) => candidate.id === preferredOrgId) || orgs[0]
        : null;
      if (org) {
        setOrgData(org);
        if (section === 'members') {
          const m = await Api.getOrganizationMembers(org.id);
          setMembers(m || []);
        }
      } else {
        setOrgData(null);
        setMembers([]);
      }
    } catch (error) {
      toast.error(t('organization.admin.loadFailed', 'Failed to load organization admin data'));
      setOrgData(null);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, section, t]);

  useEffect(() => {
    fetchOrgData();
  }, [fetchOrgData]);

  if (loading) {
    return <LoadingState variant="spinner" label={t('common.loading', 'Loading…')} />;
  }

  switch (section) {
    case 'members':
      return <MembersSection orgData={orgData} members={members} onRefresh={fetchOrgData} />;
    case 'competencies':
      return <CompetencyCatalog />;
    case 'billing':
      return <BillingSection orgData={orgData} />;
    case 'limits':
      return <LimitsSection orgData={orgData} />;
    case 'domains':
      return <DomainsSection orgData={orgData} />;
    case 'branding':
      return <BrandingSection orgData={orgData} />;
    default:
      return null;
  }
};

const MembersSection: React.FC<{ orgData: any; members: any[]; onRefresh: () => void }> = ({
  orgData,
  members,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [memberFilters, setMemberFilters] = useState<FilterChip[]>([]);

  // §27 — canonical FilterableTable columns (replaces the raw <table>). Preserves
  // the prior columns/rendering: Name, Email, Role (MetaChip), Status (active chip).
  const memberColumns: TableColumn[] = [
    {
      id: 'name',
      label: t('organization.members.name', 'Name'),
      width: '200px',
      render: (row) => <span className="font-medium text-c-text">{row.name}</span>,
    },
    {
      id: 'email',
      label: t('organization.members.emailCol', 'Email'),
      width: '220px',
      render: (row) => <span className="text-c-text-secondary">{row.email}</span>,
    },
    {
      id: 'role',
      label: t('organization.members.roleCol', 'Role'),
      width: '140px',
      render: (row) => <MetaChip label={row.role} />,
    },
    {
      id: 'memberStatus',
      label: t('organization.members.status', 'Status'),
      width: '140px',
      render: (row) => (
        <span className="flex items-center gap-1 text-xs text-c-success">
          <CheckCircle size={12} /> {row.memberStatus}
        </span>
      ),
    },
  ];

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgData?.id) return;
    try {
      setInviting(true);
      // M16 P1-2: send a real email invitation via /api/invitations (production route
      // re-enabled in P0-1) instead of directly adding a membership row.
      await Api.createOrganizationInvitation(inviteEmail.trim(), inviteRole);
      toast.success(t('organization.members.inviteSent', 'Invitation sent'));
      trackFunnelEvent('org_member_invite_sent', { role: inviteRole });
      setInviteEmail('');
      setShowInviteForm(false);
      onRefresh();
    } catch (_err) {
      toast.error(t('organization.members.inviteFailed', 'Failed to send invitation'));
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <div className="flex items-start gap-3">
          <Users size={18} className="text-c-text-secondary mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-c-text">
              {t('organization.members.title', 'Team Members')}
            </h3>
            <p className="text-sm text-c-text-muted mt-1">
              {t('organization.members.desc', '{{count}} members in this organization', {
                count: members.length,
              })}
            </p>
          </div>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] transition-colors"
          >
            {t('organization.members.invite', 'Invite')}
          </button>
        </div>
        {showInviteForm && (
          <div className="mt-4 pt-4 border-t border-c-border-subtle flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-c-text-muted mb-1">
                {t('organization.members.email', 'Email')}
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-sm text-c-text placeholder:text-c-text-muted"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-c-text-muted mb-1">
                {t('organization.members.role', 'Role')}
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-sm text-c-text"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 transition-colors"
            >
              {inviting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                t('organization.members.sendInvite', 'Send')
              )}
            </button>
          </div>
        )}
      </div>
      <FilterableTable
        columns={memberColumns}
        data={members.map((m: any) => ({
          id: m.id || m.email,
          name: m.name || m.email?.split('@')[0],
          email: m.email,
          role: m.role || 'Member',
          memberStatus: m.status || 'Active',
        }))}
        hideRowActions
        activeFilters={memberFilters}
        onFilterChange={setMemberFilters}
        emptyMessage={t(
          'organization.members.empty',
          'No members yet. Invite your first team member.'
        )}
        persistKey="org-admin-members-table"
        canvasClassName=""
      />
    </div>
  );
};

const BillingSection: React.FC<{ orgData: any }> = ({ orgData }) => {
  const { t } = useTranslation();
  // M16 P2-3: prefer live subscription + token usage from the policy snapshot,
  // falling back to whatever fields getUserOrganizations happened to expose.
  const { snapshot } = useLimits(orgData?.id);
  const livePlan = snapshot
    ? snapshot.subscriptionStatus ||
      (snapshot.isPaid ? 'active' : snapshot.isTrial ? 'trial' : null)
    : null;
  const plan = livePlan || orgData?.subscription_plan || 'trial';
  const tokens = snapshot?.usageToday?.tokensUsed ?? orgData?.token_balance ?? 0;
  const tokenLimit = snapshot?.limits?.maxTotalTokens || orgData?.token_limit || 10000;
  const usagePercent = tokenLimit > 0 ? Math.round((tokens / tokenLimit) * 100) : 0;
  const isTrialPlan = String(plan).toLowerCase().includes('trial');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <div className="flex items-start gap-3">
          <CreditCard size={18} className="text-c-text-secondary mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-c-text">
              {t('organization.billing.planTitle', 'Current Plan')}
            </h3>
            <p className="text-2xl font-bold mt-1 text-c-text capitalize">{plan}</p>
            <p className="text-sm text-c-text-muted mt-1">
              {isTrialPlan
                ? t(
                    'organization.billing.trialDesc',
                    'You are on a free trial. Upgrade to unlock full features.'
                  )
                : t('organization.billing.activeDesc', 'Your subscription is active.')}
            </p>
          </div>
          {isTrialPlan && (
            // DP-11: Billing is managed by DBR77 — no live checkout in v1. The CTA
            // is an honest "managed" affordance (not a dead no-op): it keeps the
            // funnel signal and explains who to contact instead of pretending to act.
            <button
              type="button"
              onClick={() => {
                trackFunnelEvent('org_admin_cta_clicked', { action: 'billing_activate' });
                toast(
                  t(
                    'organization.billing.managedByDbr77',
                    'Billing is managed by DBR77 — contact your account manager to upgrade.'
                  ),
                  { icon: 'ℹ️' }
                );
              }}
              title={t(
                'organization.billing.managedByDbr77',
                'Billing is managed by DBR77 — contact your account manager to upgrade.'
              )}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-c-surface-raised text-c-text-secondary border border-c-border-subtle cursor-help transition-colors"
            >
              {t('organization.billing.managedByDbr77Short', 'Managed by DBR77')}
              <ExternalLink size={12} />
            </button>
          )}
        </div>
        {isTrialPlan && (
          <p className="mt-3 text-xs text-c-text-muted">
            {t(
              'organization.billing.managedByDbr77',
              'Billing is managed by DBR77 — contact your account manager to upgrade.'
            )}
          </p>
        )}
      </div>
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <h3 className="text-sm font-semibold text-c-text flex items-center gap-2">
          <Gauge size={16} className="text-c-text-secondary" strokeWidth={1.5} />
          {t('organization.billing.tokensTitle', 'Token Balance')}
        </h3>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-3xl font-bold text-c-text">{tokens.toLocaleString()}</span>
          <span className="text-sm text-c-text-muted pb-1">
            / {tokenLimit.toLocaleString()} {t('organization.billing.tokensUnit', 'tokens')}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-c-surface-raised overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usagePercent > 95 ? 'bg-danger-500' : usagePercent > 80 ? 'bg-c-warning' : 'bg-c-border-strong'}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-c-text-secondary">
          {usagePercent}% {t('organization.billing.used', 'used')}
        </p>
      </div>
    </div>
  );
};

/**
 * M16 P0-5: live plan limits + current usage from GET /api/organization/policy-snapshot
 * (mounted via organization-limits.routes). Returns nullable so the section can show
 * skeleton/error states instead of fabricated zeros.
 */
interface PolicyLimits {
  maxProjects: number;
  maxUsers: number;
  maxAICallsPerDay: number;
  maxStorageMb: number;
  maxTotalTokens: number;
}
interface PolicyUsage {
  aiCalls: number;
  projects: number;
  users: number;
  storageMb: number;
  tokensUsed: number;
}
interface PolicySnapshotResponse {
  limits: PolicyLimits | null;
  usageToday: PolicyUsage;
  subscriptionStatus?: string | null;
  isTrial?: boolean;
  isPaid?: boolean;
}

function useLimits(orgId: string | undefined) {
  const [snapshot, setSnapshot] = useState<PolicySnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = (await Api.organizationPolicySnapshot()) as PolicySnapshotResponse;
      setSnapshot(data || null);
    } catch {
      setError(true);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, orgId]);

  return { snapshot, loading, error, reload: load };
}

const LimitsSection: React.FC<{ orgData: any }> = ({ orgData }) => {
  const { t } = useTranslation();
  const { snapshot, loading, error, reload } = useLimits(orgData?.id);

  const limitsConfig = snapshot?.limits;
  const usage = snapshot?.usageToday;
  const limits = [
    {
      key: 'members',
      label: t('organization.limits.members', 'Team Members'),
      current: usage?.users ?? 0,
      max: limitsConfig?.maxUsers ?? 0,
    },
    {
      key: 'projects',
      label: t('organization.limits.projects', 'Projects'),
      current: usage?.projects ?? 0,
      max: limitsConfig?.maxProjects ?? 0,
    },
    {
      key: 'storage',
      label: t('organization.limits.storage', 'Storage (MB)'),
      current: usage?.storageMb ?? 0,
      max: limitsConfig?.maxStorageMb ?? 0,
    },
    {
      key: 'ai_calls',
      label: t('organization.limits.aiCalls', 'AI Calls / day'),
      current: usage?.aiCalls ?? 0,
      max: limitsConfig?.maxAICallsPerDay ?? 0,
    },
    {
      key: 'tokens',
      label: t('organization.limits.tokens', 'Tokens'),
      current: usage?.tokensUsed ?? 0,
      max: limitsConfig?.maxTotalTokens ?? 0,
    },
  ];

  if (loading) {
    return <LoadingState variant="spinner" label={t('common.loading', 'Loading…')} />;
  }

  if (error || !snapshot) {
    return (
      <div className="max-w-4xl rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface">
        <ErrorState
          message={t('organization.limits.loadFailed', 'Could not load plan limits.')}
          retry={() => void reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge size={16} className="text-c-text-secondary" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-c-text">
            {t('organization.limits.title', 'Plan Limits & Current Usage')}
          </h3>
        </div>
        <div className="space-y-4">
          {limits.map((l) => {
            const pct = l.max > 0 ? Math.round((l.current / l.max) * 100) : 0;
            const isCrit = pct > 95;
            const isWarn = pct > 80;
            return (
              <div key={l.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-c-text-secondary">{l.label}</span>
                  <span className="text-c-text-muted">
                    {l.current} / {l.max}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-c-surface-raised overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isCrit ? 'bg-danger-500' : isWarn ? 'bg-c-warning' : 'bg-c-border-strong'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-c-border-subtle p-5 text-center">
        <p className="text-sm text-c-text-muted">
          {t(
            'organization.limits.managedByDbr77Hint',
            'Plans and limits are managed by DBR77. Contact your account manager to adjust them.'
          )}
        </p>
        {/* DP-11: no live checkout in v1 — honest "managed" affordance instead of a dead no-op. */}
        <button
          type="button"
          onClick={() => {
            trackFunnelEvent('org_admin_cta_clicked', { action: 'limits_view' });
            toast(
              t(
                'organization.limits.managedByDbr77Hint',
                'Plans and limits are managed by DBR77. Contact your account manager to adjust them.'
              ),
              { icon: 'ℹ️' }
            );
          }}
          title={t(
            'organization.limits.managedByDbr77Hint',
            'Plans and limits are managed by DBR77. Contact your account manager to adjust them.'
          )}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-c-surface-raised text-c-text-secondary border border-c-border-subtle cursor-help transition-colors"
        >
          {t('organization.billing.managedByDbr77Short', 'Managed by DBR77')}
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
};

const DomainsSection: React.FC<{ orgData: any }> = ({ orgData }) => {
  const { t } = useTranslation();
  const [customDomain, setCustomDomain] = useState(orgData?.custom_domain || '');
  const [customDomainVerified, setCustomDomainVerified] = useState(
    Boolean(orgData?.domain_verified)
  );
  const [customDomainDraft, setCustomDomainDraft] = useState(orgData?.custom_domain || '');
  const [savingCustomDomain, setSavingCustomDomain] = useState(false);
  const [approvedDomains, setApprovedDomains] = useState<ApprovedDomainRow[]>([]);
  const [newApprovedDomain, setNewApprovedDomain] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [domainActionError, setDomainActionError] = useState<string | null>(null);

  const normalizeApprovedDomains = (rows: unknown): ApprovedDomainRow[] =>
    Array.isArray(rows)
      ? rows.reduce<ApprovedDomainRow[]>((acc, row) => {
          if (!row || typeof row !== 'object') return acc;
          const candidate = row as { id?: unknown; domain?: unknown };
          const normalized = {
            id: candidate.id ? String(candidate.id) : undefined,
            domain: candidate.domain ? String(candidate.domain).trim().toLowerCase() : undefined,
          };
          if (normalized.domain) acc.push(normalized);
          return acc;
        }, [])
      : [];

  const loadOrganizationDomainSnapshot =
    useCallback(async (): Promise<OrganizationDomainSnapshot | null> => {
      if (!orgData?.id) return null;
      const orgs = await Api.getUserOrganizations();
      const org = Array.isArray(orgs)
        ? orgs.find((candidate) => {
            if (!candidate || typeof candidate !== 'object') return false;
            return String((candidate as { id?: unknown }).id) === String(orgData.id);
          })
        : null;
      if (!org) return null;
      return {
        customDomain: String(org.custom_domain || org.customDomain || '')
          .trim()
          .toLowerCase(),
        customDomainVerified: Boolean(org.domain_verified || org.customDomainVerified),
      };
    }, [orgData?.id]);

  useEffect(() => {
    setCustomDomain(orgData?.custom_domain || '');
    setCustomDomainDraft(orgData?.custom_domain || '');
    setCustomDomainVerified(Boolean(orgData?.domain_verified));
  }, [orgData?.custom_domain, orgData?.domain_verified]);

  const loadApprovedDomains = useCallback(async (): Promise<ApprovedDomainRow[]> => {
    if (!orgData?.id) return [];
    try {
      const rows = await Api.get(`/organizations/${orgData.id}/approved-domains`);
      const normalizedRows = normalizeApprovedDomains(rows);
      setApprovedDomains(normalizedRows);
      return normalizedRows;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load approved domains');
      setApprovedDomains([]);
      setDomainActionError(message);
      toast.error(message);
      return [];
    }
  }, [orgData?.id]);

  useEffect(() => {
    void loadApprovedDomains();
  }, [loadApprovedDomains]);

  const handleAddApprovedDomain = async () => {
    if (!orgData?.id) return;
    if (!newApprovedDomain.trim()) {
      toast.error('Enter a domain, for example company.com');
      return;
    }
    try {
      setSavingDomain(true);
      setDomainActionError(null);
      const expectedDomain = newApprovedDomain.trim().toLowerCase();
      await Api.post(`/organizations/${orgData.id}/approved-domains`, {
        domain: expectedDomain,
        autoJoin: true,
      });
      const refreshedDomains = await loadApprovedDomains();
      if (!refreshedDomains.some((domain) => domain.domain === expectedDomain)) {
        throw new Error('Approved email domain was not confirmed by the server');
      }
      setNewApprovedDomain('');
      toast.success('Approved domain added');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to add approved domain');
      setDomainActionError(message);
      toast.error(message);
    } finally {
      setSavingDomain(false);
    }
  };

  const handleRemoveApprovedDomain = async (domainId: string) => {
    if (!orgData?.id) return;
    try {
      setDomainActionError(null);
      const target = approvedDomains.find((domain) => domain.id === domainId);
      await Api.delete(`/organizations/${orgData.id}/approved-domains/${domainId}`);
      const refreshedDomains = await loadApprovedDomains();
      if (target?.domain && refreshedDomains.some((domain) => domain.domain === target.domain)) {
        throw new Error('Approved email domain removal was not confirmed by the server');
      }
      toast.success('Approved domain removed');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to remove approved domain');
      setDomainActionError(message);
      toast.error(message);
    }
  };

  const handleSaveCustomDomain = async () => {
    if (!orgData?.id) return;
    const nextDomain = customDomainDraft.trim().toLowerCase();
    if (!nextDomain) {
      toast.error('Enter a custom domain, for example app.company.com');
      return;
    }
    try {
      setSavingCustomDomain(true);
      setDomainActionError(null);
      await Api.patch(`/branding/${orgData.id}`, {
        customDomain: nextDomain,
        customDomainVerified: false,
        customDomainSslStatus: 'pending',
      });
      const persisted = await loadOrganizationDomainSnapshot();
      if (!persisted || persisted.customDomain !== nextDomain) {
        throw new Error('Custom domain save was not confirmed by the server');
      }
      setCustomDomain(nextDomain);
      setCustomDomainVerified(persisted.customDomainVerified);
      toast.success('Custom domain saved. Verify DNS before using it in production.');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to save custom domain');
      setDomainActionError(message);
      toast.error(message);
    } finally {
      setSavingCustomDomain(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {domainActionError && (
        <div
          role="alert"
          className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200"
        >
          {domainActionError}
        </div>
      )}
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <div className="flex items-start gap-3">
          <Globe size={18} className="text-c-text-secondary mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-c-text">
              {t('organization.domains.title', 'Custom Domain')}
            </h3>
            <div className="mt-2 space-y-3">
              {customDomain ? (
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-c-surface-raised px-2 py-1 rounded text-c-text">
                    {customDomain}
                  </code>
                  <span
                    className={`flex items-center gap-1 text-xs font-medium ${customDomainVerified ? 'text-c-success' : 'text-c-warning'}`}
                  >
                    {customDomainVerified ? (
                      <>
                        <CheckCircle size={12} /> {t('organization.domains.verified', 'Verified')}
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} />{' '}
                        {t('organization.domains.pending', 'Pending verification')}
                      </>
                    )}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-c-text-muted">
                  {t('organization.domains.noDomain', 'No custom domain configured.')}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={customDomainDraft}
                  onChange={(event) => setCustomDomainDraft(event.target.value)}
                  placeholder="app.company.com"
                  className="flex-1 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm text-c-text"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveCustomDomain()}
                  disabled={savingCustomDomain}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-c-border-subtle px-3 py-2 text-sm text-c-text-secondary disabled:opacity-50"
                >
                  {savingCustomDomain
                    ? t('common.saving', 'Saving...')
                    : t('organization.domains.saveCustomDomain', 'Save domain')}
                </button>
              </div>
              <p className="text-xs text-c-text-muted">
                DNS verification remains a separate operator step before the domain can be marked
                verified.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <h3 className="text-sm font-semibold text-c-text mb-3">
          {t('organization.domains.approvedTitle', 'Approved Email Domains')}
        </h3>
        <p className="text-sm text-c-text-muted mb-3">
          {t(
            'organization.domains.approvedDesc',
            'Users with these email domains can auto-join your organization.'
          )}
        </p>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newApprovedDomain}
            onChange={(event) => setNewApprovedDomain(event.target.value)}
            placeholder="company.com"
            className="flex-1 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm text-c-text"
          />
          <button
            type="button"
            onClick={() => void handleAddApprovedDomain()}
            disabled={savingDomain}
            className="rounded-lg bg-navy-900 dark:bg-[#F4F7FB] px-4 py-2 text-sm font-medium text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 transition-colors"
          >
            {savingDomain ? t('common.saving', 'Saving...') : t('common.add', 'Add')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {approvedDomains.length > 0 ? (
            approvedDomains.map((d) => (
              <span
                key={d.id || d.domain}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-c-surface-raised text-c-text-secondary"
              >
                @{d.domain}
                <button
                  type="button"
                  onClick={() => {
                    if (d.id) void handleRemoveApprovedDomain(d.id);
                  }}
                  disabled={!d.id}
                  title={!d.id ? 'Cannot remove a domain without a server id' : undefined}
                  className="text-c-text-secondary hover:text-c-danger"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))
          ) : (
            <p className="text-sm text-c-text-secondary italic">
              {t('organization.domains.noApproved', 'No approved domains set.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const BrandingSection: React.FC<{ orgData: any }> = ({ orgData }) => {
  const { t } = useTranslation();
  const [primaryColor, setPrimaryColor] = useState(orgData?.brand_color || '#6366f1');
  const [logoUrl, setLogoUrl] = useState(orgData?.logo_url || '');
  const [savingColor, setSavingColor] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBranding = async () => {
      if (!orgData?.id) {
        setPrimaryColor('#6366f1');
        setLogoUrl('');
        return;
      }

      try {
        const response = await Api.get(`/branding/${orgData.id}`);
        if (cancelled) return;
        const payload = response?.data ?? response;
        const branding = payload?.branding;
        const defaults = payload?.defaults;
        setPrimaryColor(
          branding?.primaryColor || defaults?.primaryColor || orgData?.brand_color || '#6366f1'
        );
        setLogoUrl(branding?.logoLightUrl || orgData?.logo_url || '');
      } catch {
        if (cancelled) return;
        setPrimaryColor(orgData?.brand_color || '#6366f1');
        setLogoUrl(orgData?.logo_url || '');
      }
    };

    void loadBranding();

    return () => {
      cancelled = true;
    };
  }, [orgData?.brand_color, orgData?.id, orgData?.logo_url]);

  const savePrimaryColor = async (nextColor: string) => {
    if (!orgData?.id) return;
    try {
      setSavingColor(true);
      setPrimaryColor(nextColor);
      await Api.patch(`/branding/${orgData.id}`, { primaryColor: nextColor });
      toast.success('Brand color updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update brand color');
      setPrimaryColor(orgData?.brand_color || '#6366f1');
    } finally {
      setSavingColor(false);
    }
  };

  const handleLogoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !orgData?.id) return;

    try {
      setUploadingLogo(true);
      const upload = await Api.upload(file, { orgId: orgData.id, type: 'light' });
      await Api.patch(`/branding/${orgData.id}`, { logoLightUrl: upload.url });
      setLogoUrl(upload.url);
      toast.success('Logo updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={16} className="text-c-text-secondary" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-c-text">
            {t('organization.branding.visualTitle', 'Visual Identity')}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-c-text-muted mb-2">
              {t('organization.branding.logo', 'Logo')}
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-c-border-subtle flex items-center justify-center text-c-text-secondary hover:border-c-border-strong transition-colors cursor-pointer disabled:opacity-50"
            >
              {uploadingLogo ? (
                <Loader2 size={24} className="animate-spin" />
              ) : logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Org logo"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <Plus size={24} />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoSelected}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-c-text-muted mb-2">
              {t('organization.branding.primaryColor', 'Primary Color')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                disabled={savingColor}
                onChange={(event) => void savePrimaryColor(event.target.value)}
                className="h-10 w-10 cursor-pointer rounded-lg border border-c-border-subtle bg-transparent p-0 disabled:opacity-50"
              />
              <code className="text-sm text-c-text-secondary">{primaryColor}</code>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-c-text-secondary" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-c-text">
            {t('organization.branding.regionalTitle', 'Regional Settings')}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow
            label={t('organization.branding.timezone', 'Timezone')}
            value={orgData?.timezone || 'UTC'}
          />
          <InfoRow
            label={t('organization.branding.language', 'Language')}
            value={orgData?.language || 'en'}
          />
          <InfoRow
            label={t('organization.branding.dateFormat', 'Date Format')}
            value={orgData?.date_format || 'YYYY-MM-DD'}
          />
          <InfoRow
            label={t('organization.branding.currency', 'Currency')}
            value={orgData?.currency || 'USD'}
          />
        </div>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-xs font-medium text-c-text-muted">{label}</dt>
    <dd className="mt-1 text-sm font-medium text-c-text">{value}</dd>
  </div>
);
