import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Edit2,
  Eye,
  Key,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { Organization } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { SuperAdminOrgDetailsModal } from './SuperAdminOrgDetailsModal';

interface AccessRequest {
  id: string;
  organization_name: string;
  first_name: string;
  last_name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  rejection_reason?: string;
}

interface AccessCode {
  id: string;
  code: string;
  role: string;
  max_uses: number;
  current_uses: number;
  expires_at: string | null;
  created_by_email?: string;
}

type ActiveTab = 'organizations' | 'pending' | 'codes';

interface OrganizationsViewProps {
  onViewUsers?: (organizationId: string) => void;
}

type OrganizationRow = Organization & {
  organization_name?: string;
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

const getAccessRequestsPayload = (value: unknown) =>
  getListPayload<AccessRequest>(value, ['requests', 'accessRequests', 'items']).map((request) => ({
    ...request,
    status: String(request.status || 'pending').toLowerCase() as AccessRequest['status'],
  }));

const getAccessCodesPayload = (value: unknown) =>
  getListPayload<AccessCode>(value, ['codes', 'accessCodes', 'items']);

export const OrganizationsView: React.FC<OrganizationsViewProps> = ({ onViewUsers }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('organizations');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [nonBlockingLoadErrors, setNonBlockingLoadErrors] = useState<string[]>([]);
  const [loadErrors, setLoadErrors] = useState<{
    organizations: string | null;
    requests: string | null;
    codes: string | null;
  }>({ organizations: null, requests: null, codes: null });
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal States
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [newCodeData, setNewCodeData] = useState({
    code: '',
    role: 'USER',
    maxUses: 100,
    expiresAt: '',
  });

  // Inline Edit State
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    plan: string;
    status: string;
    discount_percent: number;
  }>({
    plan: 'free',
    status: 'active',
    discount_percent: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setNonBlockingLoadErrors([]);
    setLoadErrors({ organizations: null, requests: null, codes: null });
    try {
      const [orgsRes, reqsRes, codesRes] = await Promise.allSettled([
        Api.getOrganizations(),
        Api.getAccessRequests(),
        Api.getAccessCodes(),
      ]);

      if (orgsRes.status === 'rejected') throw orgsRes.reason;
      if (!hasListShape(orgsRes.value, ['organizations', 'items'])) {
        throw new Error('Organizations response was not a list');
      }
      setOrganizations(getOrganizationsPayload(orgsRes.value));

      const errors: string[] = [];
      const nextLoadErrors: {
        organizations: string | null;
        requests: string | null;
        codes: string | null;
      } = { organizations: null, requests: null, codes: null };
      if (reqsRes.status === 'fulfilled') {
        if (hasListShape(reqsRes.value, ['requests', 'accessRequests', 'items'])) {
          setRequests(getAccessRequestsPayload(reqsRes.value));
        } else {
          setRequests([]);
          nextLoadErrors.requests = 'Access requests failed to load.';
          errors.push(nextLoadErrors.requests);
        }
      } else {
        setRequests([]);
        nextLoadErrors.requests = 'Access requests failed to load.';
        errors.push(nextLoadErrors.requests);
      }

      if (codesRes.status === 'fulfilled') {
        if (hasListShape(codesRes.value, ['codes', 'accessCodes', 'items'])) {
          setCodes(getAccessCodesPayload(codesRes.value));
        } else {
          setCodes([]);
          nextLoadErrors.codes = 'Access codes failed to load.';
          errors.push(nextLoadErrors.codes);
        }
      } else {
        setCodes([]);
        nextLoadErrors.codes = 'Access codes failed to load.';
        errors.push(nextLoadErrors.codes);
      }

      setLoadErrors(nextLoadErrors);
      if (errors.length) {
        setNonBlockingLoadErrors(errors);
        toast.error(errors.join(' '));
      }
    } catch (err) {
      setOrganizations([]);
      setRequests([]);
      setCodes([]);
      setLoadErrors({
        organizations: normalizeApiErrorMessage(err, 'Organizations failed to load.'),
        requests: 'Access requests are unavailable because organizations failed to load.',
        codes: 'Access codes are unavailable because organizations failed to load.',
      });
      toast.error(normalizeApiErrorMessage(err, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;

  const formatDate = (value?: string | null, fallback = '-') => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
  };

  const formatDateTime = (value?: string | null, fallback = '-') => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
  };

  // Organization Actions
  const handleDeleteOrg = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${name}" and all its users? This cannot be undone.`
      )
    )
      return;
    setProcessingId(id);
    try {
      setActionError(null);
      await Api.deleteOrganization(id);
      const refreshedOrganizations = await Api.getOrganizations();
      if (!hasListShape(refreshedOrganizations, ['organizations', 'items'])) {
        throw new Error('Organization deletion could not be confirmed by read-back');
      }
      const normalizedOrganizations = getOrganizationsPayload(refreshedOrganizations);
      setOrganizations(normalizedOrganizations);
      setLoadErrors((prev) => ({ ...prev, organizations: null }));
      if (normalizedOrganizations.some((org) => org.id === id)) {
        throw new Error('Organization deletion was not confirmed by the server');
      }
      toast.success('Organization deleted');
    } catch (err) {
      const message = normalizeApiErrorMessage(err, 'Failed to delete organization');
      setActionError(message);
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const startInlineEdit = (org: Organization) => {
    setEditingOrgId(org.id);
    setEditForm({
      plan: org.plan,
      status: org.status,
      discount_percent: org.discount_percent || 0,
    });
  };

  const cancelInlineEdit = () => {
    setEditingOrgId(null);
  };

  const saveInlineEdit = async (orgId: string) => {
    setProcessingId(orgId);
    try {
      setActionError(null);
      await Api.updateOrganization(orgId, {
        plan: editForm.plan,
        status: editForm.status,
        discount_percent: editForm.discount_percent,
      });
      const refreshedOrganizations = await Api.getOrganizations();
      if (!hasListShape(refreshedOrganizations, ['organizations', 'items'])) {
        throw new Error('Organization update could not be confirmed by read-back');
      }
      const normalizedOrganizations = getOrganizationsPayload(refreshedOrganizations);
      setOrganizations(normalizedOrganizations);
      setLoadErrors((prev) => ({ ...prev, organizations: null }));
      const updatedOrganization = normalizedOrganizations.find((org) => org.id === orgId);
      if (
        !updatedOrganization ||
        updatedOrganization.plan !== editForm.plan ||
        updatedOrganization.status !== editForm.status ||
        (updatedOrganization.discount_percent || 0) !== editForm.discount_percent
      ) {
        throw new Error('Organization update was not confirmed by the server');
      }
      toast.success('Organization updated');
      setEditingOrgId(null);
    } catch (err) {
      const message = normalizeApiErrorMessage(err, 'Failed to update organization');
      setActionError(message);
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  // Access Request Actions
  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      setActionError(null);
      await Api.approveAccessRequest(id);
      const refreshedRequests = await Api.getAccessRequests();
      if (!hasListShape(refreshedRequests, ['requests', 'accessRequests', 'items'])) {
        throw new Error('Access request approval could not be confirmed by read-back');
      }
      const normalizedRequests = getAccessRequestsPayload(refreshedRequests);
      setRequests(normalizedRequests);
      setLoadErrors((prev) => ({ ...prev, requests: null }));
      const updatedRequest = normalizedRequests.find((request) => request.id === id);
      if (updatedRequest && updatedRequest.status !== 'approved') {
        throw new Error('Access request approval was not confirmed by the server');
      }
      toast.success('Access request approved');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to approve request');
      setActionError(message);
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;

    setProcessingId(id);
    try {
      setActionError(null);
      await Api.rejectAccessRequest(id, reason);
      const refreshedRequests = await Api.getAccessRequests();
      if (!hasListShape(refreshedRequests, ['requests', 'accessRequests', 'items'])) {
        throw new Error('Access request rejection could not be confirmed by read-back');
      }
      const normalizedRequests = getAccessRequestsPayload(refreshedRequests);
      setRequests(normalizedRequests);
      setLoadErrors((prev) => ({ ...prev, requests: null }));
      const updatedRequest = normalizedRequests.find((request) => request.id === id);
      if (updatedRequest && updatedRequest.status !== 'rejected') {
        throw new Error('Access request rejection was not confirmed by the server');
      }
      toast.success('Access request rejected');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to reject request');
      setActionError(message);
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  // Access Code Actions
  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const maxUses = Number(newCodeData.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1) {
      toast.error('Max uses must be a positive number');
      return;
    }
    try {
      setProcessingId('new-access-code');
      setActionError(null);
      const expectedCode = newCodeData.code.trim().toUpperCase();
      const previousCodeCount = codes.length;
      await Api.generateAccessCode({
        ...newCodeData,
        code: expectedCode || undefined,
        maxUses,
        expiresAt: newCodeData.expiresAt || undefined,
      });
      const refreshedCodes = await Api.getAccessCodes();
      if (!hasListShape(refreshedCodes, ['codes', 'accessCodes', 'items'])) {
        throw new Error('Access code generation could not be confirmed by read-back');
      }
      const normalizedCodes = getAccessCodesPayload(refreshedCodes);
      setCodes(normalizedCodes);
      setLoadErrors((prev) => ({ ...prev, codes: null }));
      if (expectedCode && !normalizedCodes.some((code) => code.code === expectedCode)) {
        throw new Error('Access code generation was not confirmed by the server');
      }
      if (!expectedCode && normalizedCodes.length <= previousCodeCount) {
        throw new Error('Access code generation was not confirmed by the server');
      }
      toast.success('Access code generated');
      setShowCodeModal(false);
      setNewCodeData({ code: '', role: 'USER', maxUses: 100, expiresAt: '' });
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to generate code');
      setActionError(message);
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeactivateCode = async (codeId: string) => {
    if (!confirm('Deactivate this access code? Users will no longer be able to register with it.'))
      return;
    setProcessingId(codeId);
    try {
      setActionError(null);
      await Api.deactivateAccessCode(codeId);
      const refreshedCodes = await Api.getAccessCodes();
      if (!hasListShape(refreshedCodes, ['codes', 'accessCodes', 'items'])) {
        throw new Error('Access code deactivation could not be confirmed by read-back');
      }
      const normalizedCodes = getAccessCodesPayload(refreshedCodes);
      setCodes(normalizedCodes);
      setLoadErrors((prev) => ({ ...prev, codes: null }));
      if (normalizedCodes.some((code) => code.id === codeId)) {
        throw new Error('Access code deactivation was not confirmed by the server');
      }
      toast.success('Access code deactivated');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to deactivate access code');
      setActionError(message);
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const getOrgName = (org: Organization) =>
    String(
      (org as OrganizationRow).name ||
        (org as OrganizationRow).organization_name ||
        'Unknown Organization'
    );

  // Filtered Data
  const filteredOrgs = organizations.filter((org) => {
    const name = getOrgName(org);
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) || (org.id || '').includes(searchTerm)
    );
  });

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-primary-500/10 text-primary-700 border-primary-500/20 dark:bg-primary-500/20 dark:text-primary-400 dark:border-primary-500/30';
      case 'pro':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30';
      case 'trial':
        return 'bg-amber-500/10 text-amber-800 border-amber-500/20 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-c-border-subtle';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-emerald-700 dark:text-emerald-400';
      case 'blocked':
        return 'text-danger-700 dark:text-danger-400';
      case 'pending':
        return 'text-amber-700 dark:text-yellow-400';
      default:
        return 'text-slate-600 dark:text-slate-500';
    }
  };

  return (
    <div className="p-8 overflow-y-auto h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-primary-600 flex items-center justify-center">
              <Building2 size={20} className="text-c-text" />
            </div>
            Organizations
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            Manage organizations, subscriptions, and access requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton
            cardId="superadmin-organizations"
            position="header-inline"
            size="md"
            showLabel
            label="Help"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 rounded-lg text-sm transition-colors border border-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 dark:text-white dark:border-c-border-subtle disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {nonBlockingLoadErrors.length > 0 && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-200 rounded-xl px-4 py-3 text-sm">
          {nonBlockingLoadErrors.join(' ')}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('organizations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'organizations'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-navy-800 dark:text-slate-400 dark:border-c-border-subtle dark:hover:text-white dark:hover:bg-navy-700'
          }`}
        >
          <Building2 size={16} />
          All Organizations
          <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-xs">
            {organizations.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pending'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-navy-800 dark:text-slate-400 dark:border-c-border-subtle dark:hover:text-white dark:hover:bg-navy-700'
          }`}
        >
          <Clock size={16} />
          Pending Requests
          {pendingRequestsCount > 0 && (
            <span className="ml-1 bg-yellow-500 text-black px-1.5 py-0.5 rounded text-xs font-bold">
              {pendingRequestsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('codes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'codes'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-navy-800 dark:text-slate-400 dark:border-c-border-subtle dark:hover:text-white dark:hover:bg-navy-700'
          }`}
        >
          <Key size={16} />
          Access Codes
        </button>
      </div>

      {/* Organizations Tab */}
      {activeTab === 'organizations' && (
        <>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search
                className="absolute left-3 top-2.5 text-slate-500 dark:text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!!loadErrors.organizations}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Organizations Table */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-xl overflow-hidden">
            <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-950 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Organization</th>
                  <th className="p-4 font-medium">Users</th>
                  <th className="p-4 font-medium">Plan</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Discount</th>
                  <th className="p-4 font-medium">Created</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : loadErrors.organizations ? (
                  <tr>
                    <td colSpan={7} className="p-6">
                      <DegradedState
                        title="Organizations unavailable"
                        description={loadErrors.organizations}
                      />
                    </td>
                  </tr>
                ) : filteredOrgs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      No organizations found
                    </td>
                  </tr>
                ) : (
                  filteredOrgs.map((org) => {
                    const isEditing = editingOrgId === org.id;

                    return (
                      <tr
                        key={org.id}
                        className="hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors group"
                      >
                        <td className="p-4">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {getOrgName(org)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {org.id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="p-4 text-slate-700 dark:text-slate-300">{org.user_count}</td>
                        <td className="p-4">
                          {isEditing ? (
                            <select
                              value={editForm.plan}
                              onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                              className="bg-white dark:bg-navy-950 border border-slate-300 dark:border-blue-500/50 rounded px-2 py-1 text-slate-900 dark:text-white text-xs focus:outline-none"
                            >
                              <option value="free">Free</option>
                              <option value="trial">Trial</option>
                              <option value="pro">Pro</option>
                              <option value="enterprise">Enterprise</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getPlanColor(org.plan)}`}
                            >
                              {org.plan}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {isEditing ? (
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="bg-white dark:bg-navy-950 border border-slate-300 dark:border-blue-500/50 rounded px-2 py-1 text-slate-900 dark:text-white text-xs focus:outline-none"
                            >
                              <option value="active">Active</option>
                              <option value="pending">Pending</option>
                              <option value="blocked">Blocked</option>
                            </select>
                          ) : (
                            <span
                              className={`flex items-center gap-1.5 ${getStatusColor(org.status)}`}
                            >
                              {org.status === 'active' ? (
                                <CheckCircle size={14} />
                              ) : (
                                <AlertCircle size={14} />
                              )}
                              {org.status}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={editForm.discount_percent}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    discount_percent: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-16 bg-white dark:bg-navy-950 border border-slate-300 dark:border-blue-500/50 rounded px-2 py-1 text-slate-900 dark:text-white text-xs focus:outline-none"
                              />
                              <span className="text-slate-500 dark:text-slate-400 text-xs">%</span>
                            </div>
                          ) : org.discount_percent ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                              -{org.discount_percent}%
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">
                          {formatDate(org.created_at)}
                        </td>
                        <td className="p-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => saveInlineEdit(org.id)}
                                disabled={processingId === org.id}
                                className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded transition-colors disabled:opacity-60"
                                title="Save"
                              >
                                {processingId === org.id ? (
                                  <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>
                              <button
                                onClick={cancelInlineEdit}
                                disabled={processingId === org.id}
                                className="p-1.5 bg-danger-500/20 text-danger-400 hover:bg-danger-500/30 rounded transition-colors disabled:opacity-60"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {onViewUsers && (
                                <button
                                  onClick={() => onViewUsers(org.id)}
                                  className="p-1.5 hover:bg-indigo-500/20 text-slate-600 dark:text-slate-500 hover:text-indigo-400 rounded transition-colors"
                                  title="View Users"
                                >
                                  <Users size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedOrg(org)}
                                className="p-1.5 hover:bg-blue-500/20 text-slate-600 dark:text-slate-500 hover:text-blue-400 rounded transition-colors"
                                title="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => startInlineEdit(org)}
                                className="p-1.5 hover:bg-yellow-500/20 text-slate-600 dark:text-slate-500 hover:text-yellow-400 rounded transition-colors"
                                title="Quick Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteOrg(org.id, getOrgName(org))}
                                disabled={processingId === org.id}
                                className="p-1.5 hover:bg-danger-500/20 text-slate-600 dark:text-slate-500 hover:text-danger-400 rounded transition-colors disabled:opacity-60"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-c-border-subtle flex justify-between items-center">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Pending Organization Requests
            </h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-950 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Organization</th>
                <th className="p-4 font-medium">Contact</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : loadErrors.requests ? (
                <tr>
                  <td colSpan={5} className="p-6">
                    <DegradedState
                      title="Access requests unavailable"
                      description={loadErrors.requests}
                    />
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                    No access requests found.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors"
                  >
                    <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">
                      {formatDateTime(req.requested_at)}
                    </td>
                    <td className="p-4 text-slate-900 dark:text-white font-medium">
                      {req.organization_name}
                    </td>
                    <td className="p-4">
                      <div className="text-slate-900 dark:text-white">
                        {req.first_name} {req.last_name}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-xs">{req.email}</div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          req.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : req.status === 'rejected'
                              ? 'bg-danger-500/20 text-danger-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {req.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={processingId === req.id}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors disabled:opacity-50"
                            title="Approve"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={processingId === req.id}
                            className="p-1.5 bg-danger-500/10 hover:bg-danger-500/20 text-danger-400 rounded transition-colors disabled:opacity-50"
                            title="Reject"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      )}
                      {req.status === 'rejected' && req.rejection_reason && (
                        <span className="text-xs text-danger-400 italic">
                          Reason: {req.rejection_reason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Access Codes Tab */}
      {activeTab === 'codes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCodeModal(true)}
              disabled={!!loadErrors.codes}
              className="bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={16} /> Generate New Code
            </button>
          </div>

          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-950 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Code</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Usage</th>
                  <th className="p-4 font-medium">Expires</th>
                  <th className="p-4 font-medium">Created By</th>
                  <th className="p-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : loadErrors.codes ? (
                  <tr>
                    <td colSpan={6} className="p-6">
                      <DegradedState
                        title="Access codes unavailable"
                        description={loadErrors.codes}
                      />
                    </td>
                  </tr>
                ) : codes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      No access codes generated yet.
                    </td>
                  </tr>
                ) : (
                  codes.map((code) => (
                    <tr
                      key={code.id}
                      className="hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <code className="bg-slate-50 dark:bg-navy-950 px-2 py-1 rounded text-blue-700 dark:text-blue-400 font-mono text-xs border border-slate-200 dark:border-blue-500/20">
                            {code.code}
                          </code>
                          <button
                            onClick={() => copyCode(code.code)}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 font-medium text-xs">
                        {code.role}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-100 dark:bg-navy-950 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{
                                width: `${Math.min(100, (code.current_uses / code.max_uses) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-600 dark:text-slate-500">
                            {code.current_uses}/{code.max_uses}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">
                        {formatDate(code.expires_at, 'Never')}
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">
                        {code.created_by_email || 'Super Admin'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeactivateCode(code.id)}
                          disabled={processingId === code.id}
                          className="text-slate-500 dark:text-slate-400 hover:text-danger-400 transition-colors disabled:opacity-50"
                          title="Deactivate code"
                        >
                          <XCircle size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Organization Details Modal */}
      {selectedOrg && (
        <SuperAdminOrgDetailsModal
          org={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onUpdate={() => {
            setSelectedOrg(null);
            fetchData();
          }}
        />
      )}

      {/* Generate Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key size={20} className="text-primary-500" /> Generate Access Code
              </h3>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleGenerateCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                  Custom Code (Optional)
                </label>
                <input
                  type="text"
                  value={newCodeData.code}
                  onChange={(e) =>
                    setNewCodeData({ ...newCodeData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="Leave empty for random"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded text-slate-900 dark:text-white focus:border-primary-500 outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                    Max Uses
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCodeData.maxUses}
                    onChange={(e) =>
                      setNewCodeData({ ...newCodeData, maxUses: Number(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded text-slate-900 dark:text-white focus:border-primary-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                    Role
                  </label>
                  <select
                    value={newCodeData.role}
                    onChange={(e) => setNewCodeData({ ...newCodeData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded text-slate-900 dark:text-white focus:border-primary-500 outline-none text-sm"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="CEO">CEO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                  Expires At (Optional)
                </label>
                <input
                  type="date"
                  value={newCodeData.expiresAt}
                  onChange={(e) => setNewCodeData({ ...newCodeData, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded text-slate-900 dark:text-white focus:border-primary-500 outline-none text-sm"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="flex-1 py-2 bg-transparent border border-slate-200 dark:border-c-border-subtle hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === 'new-access-code'}
                  className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {processingId === 'new-access-code' ? 'Generating...' : 'Generate Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationsView;
