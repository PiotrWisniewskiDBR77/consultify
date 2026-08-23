import {
  AlertCircle,
  Building2,
  Calculator,
  CheckCircle,
  Coins,
  CreditCard,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { V8FinanceApi } from '../../services/api/v8/finance';
import { User } from '../../types';

interface OrganizationSettingsProps {
  currentUser: User;
  onUpdateUser?: (updates: Partial<User>) => void;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);

  // Create Organization Modal
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Member Add Form
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('MEMBER');

  // Finance Defaults
  const [financeSettings, setFinanceSettings] = useState<{
    defaultWacc: number;
    defaultCurrency: string;
    defaultHorizonYears: number;
  }>({ defaultWacc: 12, defaultCurrency: 'PLN', defaultHorizonYears: 5 });
  const [financeSettingsVersion, setFinanceSettingsVersion] = useState(0);
  const [savingFinance, setSavingFinance] = useState(false);

  const loadFinanceSettings = useCallback(async () => {
    try {
      const data = await V8FinanceApi.getSettings();
      if (data) {
        const { version, ...settings } = data;
        setFinanceSettings((prev) => ({ ...prev, ...settings }));
        setFinanceSettingsVersion(version);
      }
    } catch {
      /* not configured yet */
    }
  }, []);

  const handleSaveFinanceSettings = useCallback(async () => {
    setSavingFinance(true);
    try {
      const result = await V8FinanceApi.updateSettings(
        financeSettings,
        financeSettingsVersion,
        crypto.randomUUID()
      );
      const { version, ...savedSettings } = result.state;
      setFinanceSettings(savedSettings);
      setFinanceSettingsVersion(version);
      toast.success(t('settings.financeSaved', 'Finance defaults saved'));
    } catch {
      toast.error(t('settings.financeError', 'Failed to save finance defaults'));
    } finally {
      setSavingFinance(false);
    }
  }, [financeSettings, financeSettingsVersion, t]);

  useEffect(() => {
    fetchOrganizations();
  }, [currentUser]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const orgs = await Api.getUserOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0) {
        // Select first one or current active if stored
        // For now, default to first
        const org = orgs[0];
        await loadOrgDetails(org.id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const loadOrgDetails = async (orgId: string) => {
    try {
      const [org, orgMembers, tokenData, ledger] = await Promise.all([
        Api.getOrganization(orgId),
        Api.getOrganizationMembers(orgId),
        Api.getOrgTokenBalance(orgId).catch(() => null),
        Api.getOrgTokenLedger(orgId, 20).catch(() => []),
      ]);
      // Merge token data into org object for display
      setSelectedOrg({
        ...org,
        token_balance: tokenData?.balance ?? org.token_balance,
        billing_status: tokenData?.billingStatus ?? org.billing_status,
        organization_type: tokenData?.organizationType ?? org.organization_type,
        // Trial budget from API (no hardcode!)
        trialBudgetTotal: tokenData?.trialBudgetTotal ?? null,
        trialBudgetRemaining: tokenData?.trialBudgetRemaining ?? null,
        paygoStatus: tokenData?.paygoStatus ?? null,
        ledger,
      });
      setMembers(orgMembers);
      loadFinanceSettings();
    } catch (error) {
      console.error(error);
      toast.error('Failed to load organization details');
    }
  };

  const handleOrgChange = async (orgId: string) => {
    await loadOrgDetails(orgId);
  };

  const handleAddMember = async () => {
    if (!selectedOrg || !newMemberEmail) return;
    try {
      // Note: passing email as targetUserId which backend might reject if not implementing lookup
      // This is a known gap we accepted for the Skeleton phase.
      // Ideally we should look up user ID by email first or have backend do it.
      // For now, let's assume valid UUID is passed OR backend handles email.
      // If backend rejects, we show error.
      await Api.addOrganizationMember(selectedOrg.id, newMemberEmail, newMemberRole);
      toast.success('Member added successfully');
      setNewMemberEmail('');
      setIsAddMemberOpen(false);
      loadOrgDetails(selectedOrg.id);
    } catch (error: any) {
      // If error suggests invalid ID, user knows they need ID
      toast.error(error.message || 'Failed to add member');
    }
  };
  const handleActivateBilling = async () => {
    if (!selectedOrg) return;
    try {
      await Api.activateBilling(selectedOrg.id);
      toast.success('Billing activated! Tokens added.');
      loadOrgDetails(selectedOrg.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate billing');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-c-text-muted">Loading organization details...</div>;
  }

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast.error('Organization name is required');
      return;
    }
    setCreatingOrg(true);
    try {
      await Api.createOrganization(newOrgName.trim());
      toast.success('Organization created successfully!');
      setIsCreateOrgModalOpen(false);
      setNewOrgName('');
      await fetchOrganizations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  if (organizations.length === 0) {
    return (
      <>
        <div className="p-8 text-center bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 shadow-sm">
          <Building2 size={48} className="mx-auto text-c-text-secondary mb-4" />
          <h3 className="text-lg font-semibold text-navy-900 mb-2">No Organization Found</h3>
          <p className="text-c-text-muted mb-6 max-w-md mx-auto">
            You are not currently a member of any organization. Create one to get started with team
            collaboration and token sharing.
          </p>
          <button
            onClick={() => setIsCreateOrgModalOpen(true)}
            className="bg-c-text hover:bg-c-text text-c-surface px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Create Organization
          </button>
        </div>

        {/* Create Organization Modal */}
        {isCreateOrgModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
            <div className="bg-c-surface rounded-xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                  <Building2 size={20} className="text-c-accent" />
                  Create Organization
                </h3>
                <button
                  onClick={() => setIsCreateOrgModalOpen(false)}
                  className="p-2 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised text-c-text-muted"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g., Acme Corporation"
                    className="w-full px-4 py-3 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] text-navy-900"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateOrganization()}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    onClick={() => setIsCreateOrgModalOpen(false)}
                    className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateOrganization}
                    disabled={creatingOrg || !newOrgName.trim()}
                    className="px-6 py-2 bg-c-text hover:bg-c-text text-c-surface rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {creatingOrg && <Loader2 size={16} className="animate-spin" />}
                    {creatingOrg ? 'Creating...' : 'Create Organization'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative">
      {/* Header / Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Building2 className="text-c-accent" />
            Organization Settings
          </h2>
          <p className="text-c-text-muted text-sm mt-1">Manage members, billing, and tokens.</p>
        </div>
        {organizations.length > 1 && (
          <select
            className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg px-3 py-2 text-sm"
            value={selectedOrg?.id}
            onChange={(e) => handleOrgChange(e.target.value)}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Billing & Tokens Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2 mb-4">
            <CreditCard size={20} className="text-c-text-muted" />
            Billing Status
          </h3>
          <div className="flex items-center justify-between mb-4">
            <span className="text-c-text-secondary">Status</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                selectedOrg?.billing_status === 'ACTIVE'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
              }`}
            >
              {selectedOrg?.billing_status || 'TRIAL'}
            </span>
          </div>
          {selectedOrg?.billing_status !== 'ACTIVE' && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4 mb-4">
              <div className="flex gap-3">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-500 shrink-0" />
                <div>
                  <h4 className="font-semibold text-amber-900 dark:text-amber-400 text-sm">
                    Trial Active
                  </h4>
                  <p className="text-amber-700 dark:text-amber-500/80 text-xs mt-1">
                    Upgrade to a paid plan to unlock full features and remove limits.
                  </p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleActivateBilling}
            disabled={selectedOrg?.billing_status === 'ACTIVE'}
            className="w-full bg-c-surface dark:bg-c-surface text-white dark:text-navy-900 px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedOrg?.billing_status === 'ACTIVE' ? 'Billing Active' : 'Activate Billing'}
          </button>
        </div>

        <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2 mb-4">
            <Coins size={20} className="text-c-text-muted" />
            Token Balance & Usage
          </h3>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-4xl font-bold text-navy-900 mb-1">
              {selectedOrg?.token_balance?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-c-text-muted">Available Tokens</div>
          </div>

          {/* Trial Usage Bar - uses API values, no hardcode */}
          {(selectedOrg?.billing_status === 'TRIAL' ||
            selectedOrg?.organization_type === 'TRIAL') &&
            selectedOrg?.trialBudgetTotal &&
            selectedOrg?.trialBudgetRemaining !== null && (
              <div className="mt-4 pt-4 border-t border-c-border-subtle dark:border-navy-700">
                {(() => {
                  const total = selectedOrg.trialBudgetTotal;
                  const remaining = selectedOrg.trialBudgetRemaining ?? 0;
                  const usedPct = Math.min(
                    100,
                    Math.max(0, Math.round((1 - remaining / total) * 100))
                  );
                  const lowThreshold = total * 0.1;
                  const medThreshold = total * 0.3;
                  return (
                    <>
                      <div className="flex justify-between text-xs text-c-text-muted mb-2">
                        <span>Trial Usage</span>
                        <span>{usedPct}% Used</span>
                      </div>
                      <div className="w-full bg-c-surface-raised rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${
                            remaining < lowThreshold
                              ? 'bg-danger-500'
                              : remaining < medThreshold
                                ? 'bg-amber-500'
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${usedPct}%` }}
                        />
                      </div>
                      {remaining < lowThreshold && (
                        <p className="text-xs text-danger-600 dark:text-danger-400 mt-2 text-center">
                          ⚠️ Low balance! Upgrade to continue using AI features.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

          <div className="mt-4 pt-4 border-t border-c-border-subtle dark:border-navy-700 text-xs text-c-text-muted text-center">
            {selectedOrg?.billing_status === 'ACTIVE'
              ? 'Pay-as-you-go billing active'
              : selectedOrg?.paygoStatus === 'PAYGO_PENDING'
                ? '⚠️ Payment required - usage exceeds balance'
                : 'Trial tokens refresh on upgrade'}
          </div>
        </div>
      </div>

      {/* Token Ledger / Recent Activity */}
      <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-c-border-subtle dark:border-navy-700 bg-c-surface-raised">
          <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Coins size={20} className="text-c-text-muted" />
            Recent Token Activity
          </h3>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {!selectedOrg?.ledger || selectedOrg.ledger.length === 0 ? (
            <div className="p-8 text-center text-c-text-muted text-sm">No token activity yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-c-surface-raised sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-c-text-muted uppercase">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-c-text-muted uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-c-text-muted uppercase">
                    Reason
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-c-text-muted uppercase">
                    When
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-c-border-subtle dark:divide-white/5">
                {selectedOrg.ledger.slice(0, 10).map((entry: any) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
                  >
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          entry.type === 'CREDIT'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400'
                        }`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-navy-900">
                      {entry.type === 'CREDIT' ? '+' : '-'}
                      {entry.amount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-c-text-secondary truncate max-w-xs">
                      {entry.reason || entry.ref_entity_type || '-'}
                    </td>
                    <td className="px-4 py-2 text-c-text-muted text-xs">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Finance Defaults Card */}
      <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2 mb-4">
          <Calculator size={20} className="text-c-text-muted" />
          {t('settings.financeDefaults', 'Finance Defaults')}
        </h3>
        <p className="text-xs text-c-text-muted mb-4">
          {t(
            'settings.financeDefaultsDesc',
            'Default values for new valuations, budgets, and financial models across the organization.'
          )}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-c-text-muted mb-1">
              {t('settings.defaultWacc', 'Default WACC (%)')}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={financeSettings.defaultWacc}
              onChange={(e) =>
                setFinanceSettings((p) => ({ ...p, defaultWacc: Number(e.target.value) }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-c-text-muted mb-1">
              {t('settings.defaultCurrency', 'Default Currency')}
            </label>
            <select
              value={financeSettings.defaultCurrency}
              onChange={(e) =>
                setFinanceSettings((p) => ({ ...p, defaultCurrency: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-sm"
            >
              <option value="PLN">PLN</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-c-text-muted mb-1">
              {t('settings.defaultHorizon', 'Default Horizon (years)')}
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={financeSettings.defaultHorizonYears}
              onChange={(e) =>
                setFinanceSettings((p) => ({ ...p, defaultHorizonYears: Number(e.target.value) }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSaveFinanceSettings}
            disabled={savingFinance}
            className="flex items-center gap-2 bg-c-text hover:bg-c-text text-c-surface px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {savingFinance ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {savingFinance ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-c-border-subtle dark:border-navy-700 flex items-center justify-between bg-c-surface-raised">
          <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
            <Users size={20} className="text-c-text-muted" />
            Team Members
          </h3>
          <button
            onClick={() => setIsAddMemberOpen(!isAddMemberOpen)}
            className="flex items-center gap-1.5 bg-c-text hover:bg-c-text text-c-surface px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Member
          </button>
        </div>

        {isAddMemberOpen && (
          <div className="p-4 bg-c-surface-raised border-b border-c-border-subtle dark:border-navy-700 animate-in slide-in-from-top-2">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-c-text-muted mb-1">
                  User ID / Email
                </label>
                <input
                  type="text"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="Enter User ID (or Email if supported)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-sm"
                />
              </div>
              <div className="w-40">
                <label className="block text-xs font-semibold text-c-text-muted mb-1">Role</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface text-sm"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="CONSULTANT">Consultant</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <button
                onClick={handleAddMember}
                className="bg-c-surface dark:bg-c-surface text-white dark:text-navy-900 px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90"
              >
                Send Invite
              </button>
            </div>
            <p className="text-[10px] text-c-text-muted mt-2">
              * Note: For this release, please use User ID if Email lookup is not configured.
            </p>
          </div>
        )}

        <div className="divide-y divide-c-border-subtle dark:divide-white/5">
          {members.map((member) => (
            <div
              key={member.id}
              className="p-4 flex items-center justify-between hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-c-surface-raised flex items-center justify-center text-c-text-muted font-bold">
                  {member.first_name ? member.first_name[0] : <UserCircle size={20} />}
                </div>
                <div>
                  <div className="font-semibold text-navy-900 text-sm">
                    {member.first_name} {member.last_name}{' '}
                    {member.user_id === currentUser.id && '(You)'}
                  </div>
                  <div className="text-xs text-c-text-muted">{member.email || member.user_id}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${
                    member.role === 'OWNER'
                      ? 'bg-c-accent-soft text-c-accent border-c-accent dark:border-c-accent'
                      : member.role === 'ADMIN'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-500/30'
                        : 'bg-c-surface-raised text-c-text-secondary border-c-border-subtle'
                  }`}
                >
                  {member.role === 'OWNER' && <ShieldCheck size={12} className="mr-1" />}
                  {member.role}
                </span>
                <div className="text-xs text-c-text-muted">
                  Joined {new Date(member.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="p-8 text-center text-c-text-muted text-sm">No members found.</div>
          )}
        </div>
      </div>
    </div>
  );
};
