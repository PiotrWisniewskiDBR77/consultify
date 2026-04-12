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
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { useAppStore } from '../../store/useAppStore';
import { CompetencyCatalog } from './CompetencyCatalog';
import type { OrganizationSection } from './OrganizationSidebar';

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
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">{t('common.loading', 'Loading…')}</span>
      </div>
    );
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

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgData?.id) return;
    try {
      setInviting(true);
      await Api.addOrganizationMember(orgData.id, inviteEmail, inviteRole);
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
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/40 p-5">
        <div className="flex items-start gap-3">
          <Users size={18} className="text-slate-400 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('organization.members.title', 'Team Members')}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {t('organization.members.desc', '{{count}} members in this organization', {
                count: members.length,
              })}
            </p>
          </div>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            <Plus size={14} />
            {t('organization.members.invite', 'Invite')}
          </button>
        </div>
        {showInviteForm && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-navy-700/60 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t('organization.members.email', 'Email')}
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t('organization.members.role', 'Role')}
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors"
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
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-navy-700/60">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('organization.members.name', 'Name')}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('organization.members.emailCol', 'Email')}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('organization.members.roleCol', 'Role')}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('organization.members.status', 'Status')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-700/40">
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">
                  {t(
                    'organization.members.empty',
                    'No members yet. Invite your first team member.'
                  )}
                </td>
              </tr>
            ) : (
              members.map((m: any) => (
                <tr
                  key={m.id || m.email}
                  className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                    {m.name || m.email?.split('@')[0]}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{m.email}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                      {m.role || 'Member'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle size={12} /> {m.status || 'Active'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BillingSection: React.FC<{ orgData: any }> = ({ orgData }) => {
  const { t } = useTranslation();
  const plan = orgData?.subscription_plan || 'trial';
  const tokens = orgData?.token_balance ?? 0;
  const tokenLimit = orgData?.token_limit ?? 10000;
  const usagePercent = tokenLimit > 0 ? Math.round((tokens / tokenLimit) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/40 p-5">
        <div className="flex items-start gap-3">
          <CreditCard size={18} className="text-slate-400 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('organization.billing.planTitle', 'Current Plan')}
            </h3>
            <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white capitalize">
              {plan}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {plan === 'trial'
                ? t(
                    'organization.billing.trialDesc',
                    'You are on a free trial. Upgrade to unlock full features.'
                  )
                : t('organization.billing.activeDesc', 'Your subscription is active.')}
            </p>
          </div>
          {plan === 'trial' && (
            <button
              onClick={() =>
                trackFunnelEvent('org_admin_cta_clicked', { action: 'billing_activate' })
              }
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              {t('organization.billing.upgrade', 'Upgrade')}
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/40 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Gauge size={16} className="text-slate-400" strokeWidth={1.5} />
          {t('organization.billing.tokensTitle', 'Token Balance')}
        </h3>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            {tokens.toLocaleString()}
          </span>
          <span className="text-sm text-slate-500 pb-1">
            / {tokenLimit.toLocaleString()} {t('organization.billing.tokensUnit', 'tokens')}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usagePercent > 95 ? 'bg-red-500' : usagePercent > 80 ? 'bg-amber-500' : 'bg-slate-400'}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {usagePercent}% {t('organization.billing.used', 'used')}
        </p>
      </div>
    </div>
  );
};

const LimitsSection: React.FC<{ orgData: any }> = ({ orgData }) => {
  const { t } = useTranslation();
  const limits = [
    {
      key: 'members',
      label: t('organization.limits.members', 'Team Members'),
      current: orgData?.member_count ?? 1,
      max: orgData?.member_limit ?? 5,
    },
    {
      key: 'projects',
      label: t('organization.limits.projects', 'Projects'),
      current: orgData?.project_count ?? 0,
      max: orgData?.project_limit ?? 3,
    },
    {
      key: 'storage',
      label: t('organization.limits.storage', 'Storage (GB)'),
      current: orgData?.storage_used_gb ?? 0,
      max: orgData?.storage_limit_gb ?? 1,
    },
    {
      key: 'ai_calls',
      label: t('organization.limits.aiCalls', 'AI Calls / month'),
      current: orgData?.ai_calls_used ?? 0,
      max: orgData?.ai_calls_limit ?? 100,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge size={16} className="text-slate-400" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
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
                  <span className="text-slate-700 dark:text-slate-300">{l.label}</span>
                  <span className="text-slate-500">
                    {l.current} / {l.max}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isCrit ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-slate-400'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-navy-700 p-5 text-center">
        <p className="text-sm text-slate-500">
          {t('organization.limits.upgradeHint', 'Need more? Upgrade your plan to increase limits.')}
        </p>
        <button
          onClick={() => trackFunnelEvent('org_admin_cta_clicked', { action: 'limits_view' })}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
        >
          {t('organization.limits.viewPlans', 'View Plans')}
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
};

const DomainsSection: React.FC<{ orgData: any }> = ({ orgData }) => {
  const { t } = useTranslation();
  const domain = orgData?.custom_domain || null;
  const verified = orgData?.domain_verified || false;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/40 p-5">
        <div className="flex items-start gap-3">
          <Globe size={18} className="text-slate-400 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('organization.domains.title', 'Custom Domain')}
            </h3>
            {domain ? (
              <div className="mt-2 flex items-center gap-2">
                <code className="text-sm bg-slate-100 dark:bg-navy-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200">
                  {domain}
                </code>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${verified ? 'text-green-600' : 'text-amber-500'}`}
                >
                  {verified ? (
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
              <p className="mt-2 text-sm text-slate-500">
                {t('organization.domains.noDomain', 'No custom domain configured.')}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/40 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          {t('organization.domains.approvedTitle', 'Approved Email Domains')}
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          {t(
            'organization.domains.approvedDesc',
            'Users with these email domains can auto-join your organization.'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {(orgData?.approved_domains || []).length > 0 ? (
            (orgData.approved_domains as string[]).map((d: string) => (
              <span
                key={d}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300"
              >
                @{d}
                <button className="text-slate-400 hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-400 italic">
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
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={16} className="text-slate-400" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('organization.branding.visualTitle', 'Visual Identity')}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">
              {t('organization.branding.logo', 'Logo')}
            </label>
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-700 flex items-center justify-center text-slate-400 hover:border-slate-300 transition-colors cursor-pointer">
              {orgData?.logo_url ? (
                <img
                  src={orgData.logo_url}
                  alt="Org logo"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <Plus size={24} />
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">
              {t('organization.branding.primaryColor', 'Primary Color')}
            </label>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg border border-slate-200 dark:border-navy-700"
                style={{ backgroundColor: orgData?.brand_color || '#6366f1' }}
              />
              <code className="text-sm text-slate-600 dark:text-slate-400">
                {orgData?.brand_color || '#6366f1'}
              </code>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-slate-400" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
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
    <dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</dd>
  </div>
);
