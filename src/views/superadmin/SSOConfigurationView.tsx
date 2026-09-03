/**
 * SSOConfigurationView - Super Admin SSO/SAML Configuration
 *
 * Enterprise SSO management with support for:
 * - Google Workspace (OIDC)
 * - Generic SAML 2.0
 * - Azure AD
 * - Okta
 * - Domain mapping
 */

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Info,
  Key,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Upload,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import type {
  StandardRowMenu,
  TableColumn,
  TableRow,
} from '../../components/standard/StandardTable';
import { StandardTable } from '../../components/standard/StandardTable';
import { Api } from '../../services/api';

interface SSOConfig {
  id: string;
  organizationId: string;
  organizationName: string;
  providerType: 'saml' | 'oidc' | 'google' | 'microsoft' | 'okta' | 'azure_ad';
  providerName: string;
  isActive: boolean;
  isVerified: boolean;
  enforceSso: boolean;
  allowPasswordLogin: boolean;
  autoProvisionUsers: boolean;
  defaultRole: string;
  createdAt: string;
  lastLoginAt?: string;
  totalLogins?: number;
}

type TabType = 'overview' | 'google' | 'saml' | 'domains';

export const SSOConfigurationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [ssoConfigs, setSsoConfigs] = useState<SSOConfig[]>([]);
  const [domainMappings, setDomainMappings] = useState<any[]>([]);
  const [ssoConfigsLoadError, setSsoConfigsLoadError] = useState<string | null>(null);
  const [domainMappingsLoadError, setDomainMappingsLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<SSOConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Form state for new SSO config
  const [configForm, setConfigForm] = useState({
    organizationId: '',
    providerType: 'saml' as SSOConfig['providerType'],
    providerName: '',
    // SAML
    idpEntityId: '',
    idpSsoUrl: '',
    idpSloUrl: '',
    idpCertificate: '',
    // OIDC
    clientId: '',
    clientSecret: '',
    authorizationUrl: '',
    tokenUrl: '',
    userinfoUrl: '',
    // Policies
    enforceSso: false,
    allowPasswordLogin: true,
    autoProvisionUsers: true,
    defaultRole: 'USER',
    // Domain restriction
    domainRestriction: '',
  });

  // Google SSO form state
  const [googleForm, setGoogleForm] = useState({
    organizationId: '',
    clientId: '',
    clientSecret: '',
    allowedDomains: '',
  });

  const [samlForm, setSamlForm] = useState({
    organizationId: '',
    metadataUrl: '',
    entityId: '',
    ssoUrl: '',
    certificate: '',
  });

  const [showAddDomainModal, setShowAddDomainModal] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain: '', organizationId: '' });
  const [savingSaml, setSavingSaml] = useState(false);
  const [validatingSaml, setValidatingSaml] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);

  // Organizations list for dropdowns
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch organizations for dropdown
  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      setOrganizations(orgs);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  }, []);

  // Save Google SSO config
  const saveGoogleConfig = async () => {
    if (!googleForm.organizationId || !googleForm.clientId) {
      setMessage({ type: 'error', text: 'Organization and Client ID are required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const allowedDomains = googleForm.allowedDomains
        .split(',')
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      await (Api as any).saveGoogleSsoConfig({
        organizationId: googleForm.organizationId,
        clientId: googleForm.clientId,
        clientSecret: googleForm.clientSecret,
        allowedDomains,
      });

      setMessage({ type: 'success', text: 'Google SSO configuration saved successfully!' });
      setGoogleForm({ organizationId: '', clientId: '', clientSecret: '', allowedDomains: '' });
      fetchSSOConfigs();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to save configuration',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSaml = async () => {
    const samlConfig = {
      organizationId: samlForm.organizationId,
      metadataUrl: samlForm.metadataUrl,
      entityId: samlForm.entityId,
      ssoUrl: samlForm.ssoUrl,
      certificate: samlForm.certificate,
    };
    setSavingSaml(true);
    try {
      await Api.post('/sso/saml/config', samlConfig);
      toast.success('SAML configuration saved');
      setSamlForm({
        organizationId: '',
        metadataUrl: '',
        entityId: '',
        ssoUrl: '',
        certificate: '',
      });
      fetchSSOConfigs();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || err?.message || 'Failed to save SAML configuration'
      );
    } finally {
      setSavingSaml(false);
    }
  };

  const handleValidateSaml = async () => {
    const samlConfig = {
      organizationId: samlForm.organizationId,
      metadataUrl: samlForm.metadataUrl,
      entityId: samlForm.entityId,
      ssoUrl: samlForm.ssoUrl,
      certificate: samlForm.certificate,
    };
    setValidatingSaml(true);
    try {
      const res = await Api.post('/sso/saml/validate', samlConfig);
      const data = res?.data ?? res;
      if (data?.valid || data?.success) {
        toast.success(data?.message || 'Configuration is valid');
      } else {
        toast.error(data?.message || data?.error || 'Validation failed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Validation failed');
    } finally {
      setValidatingSaml(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.domain || !newDomain.organizationId) {
      toast.error('Domain and organization are required');
      return;
    }
    setSavingDomain(true);
    try {
      await Api.post('/sso/domains', newDomain);
      toast.success('Domain added');
      setNewDomain({ domain: '', organizationId: '' });
      setShowAddDomainModal(false);
      fetchDomainMappings();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to add domain');
    } finally {
      setSavingDomain(false);
    }
  };

  // Toggle SSO config active status
  const toggleSSOConfig = async (configId: string, isActive: boolean) => {
    try {
      await (Api as any).toggleSsoConfig(configId, !isActive);
      fetchSSOConfigs();
    } catch (error) {
      console.error('Failed to toggle SSO config:', error);
    }
  };

  // Delete SSO config
  const deleteSSOConfig = async (configId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this SSO configuration? Users will no longer be able to use SSO to login.'
      )
    ) {
      return;
    }

    try {
      await (Api as any).deleteSsoConfig(configId);
      fetchSSOConfigs();
    } catch (error) {
      console.error('Failed to delete SSO config:', error);
    }
  };

  const fetchSSOConfigs = useCallback(async () => {
    setLoading(true);
    setSsoConfigsLoadError(null);
    try {
      // Use SuperAdmin endpoint to get all SSO configs at once
      const result = await (Api as any).getSsoConfigs();
      setSsoConfigs(result.configs || []);
    } catch (error: any) {
      console.error('Failed to fetch SSO configs:', error);
      setSsoConfigsLoadError(error?.message || 'Failed to fetch SSO configurations');
      setSsoConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDomainMappings = useCallback(async () => {
    setDomainMappingsLoadError(null);
    try {
      const res = await Api.get('/sso/domains');
      const payload = res?.data ?? res;
      setDomainMappings(payload?.mappings || []);
    } catch (error: any) {
      console.error('Failed to fetch domain mappings:', error);
      setDomainMappingsLoadError(error?.message || 'Failed to fetch SSO domain mappings');
      setDomainMappings([]);
    }
  }, []);

  useEffect(() => {
    fetchSSOConfigs();
    fetchOrganizations();
    fetchDomainMappings();
  }, [fetchSSOConfigs, fetchOrganizations, fetchDomainMappings]);

  const filteredConfigs = ssoConfigs.filter((config) => {
    const matchesSearch =
      config.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.providerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && config.isActive) ||
      (filterStatus === 'inactive' && !config.isActive);
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: ssoConfigs.length,
    active: ssoConfigs.filter((c) => c.isActive).length,
    saml: ssoConfigs.filter((c) => c.providerType === 'saml').length,
    google: ssoConfigs.filter((c) => c.providerType === 'google' || c.providerType === 'oidc')
      .length,
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // ── Kanon §27: SSO Configs → StandardTable ───────────────────────────────
  const ssoConfigRows: TableRow[] = filteredConfigs.map((c) => ({ ...c, id: c.id }));

  const ssoConfigColumns: TableColumn[] = [
    {
      id: 'organizationName',
      label: 'Organization',
      sortable: true,
      render: (row: TableRow) => {
        const config = row as unknown as SSOConfig;
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold">
              {config.organizationName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-slate-900 dark:text-white">
                {config.organizationName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {config.organizationId.slice(0, 8)}...
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'providerType',
      label: 'Provider',
      sortable: true,
      filterable: true,
      filterOptions: [
        { value: 'google', label: 'Google' },
        { value: 'saml', label: 'SAML' },
        { value: 'azure_ad', label: 'Azure AD' },
        { value: 'okta', label: 'Okta' },
        { value: 'oidc', label: 'OIDC' },
        { value: 'microsoft', label: 'Microsoft' },
      ],
      render: (row: TableRow) => {
        const config = row as unknown as SSOConfig;
        return (
          <div className="flex items-center gap-2">
            {config.providerType === 'google' && (
              <img src="/assets/google-logo.png" alt="Google" className="w-5 h-5" />
            )}
            {config.providerType === 'saml' && <Shield size={18} className="text-blue-500" />}
            {config.providerType === 'azure_ad' && <Shield size={18} className="text-sky-500" />}
            {config.providerType === 'okta' && <Shield size={18} className="text-indigo-500" />}
            <span className="text-slate-700 dark:text-slate-300 capitalize">
              {config.providerName || (config.providerType ?? '').replace('_', ' ')}
            </span>
          </div>
        );
      },
    },
    {
      id: 'status',
      label: 'Status',
      render: (row: TableRow) => {
        const config = row as unknown as SSOConfig;
        return (
          <div className="flex items-center gap-2">
            {config.isActive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-400">
                <XCircle size={12} />
                Inactive
              </span>
            )}
            {config.isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Verified
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'policies',
      label: 'Policies',
      render: (row: TableRow) => {
        const config = row as unknown as SSOConfig;
        return (
          <div className="flex flex-wrap gap-1">
            {config.enforceSso && (
              <span className="text-xs px-2 py-0.5 rounded bg-danger-500/10 text-danger-600 dark:text-danger-400">
                SSO Only
              </span>
            )}
            {config.autoProvisionUsers && (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Auto-provision
              </span>
            )}
            {config.allowPasswordLogin && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-400">
                Password fallback
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (row: TableRow) => (
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {new Date((row as unknown as SSOConfig).createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const ssoConfigRowMenu = (row: TableRow): StandardRowMenu => {
    const config = row as unknown as SSOConfig;
    return {
      statusTransitions: [
        {
          id: 'toggle-active',
          label: config.isActive ? 'Deactivate' : 'Activate',
          icon: config.isActive ? XCircle : CheckCircle2,
          onClick: () => toggleSSOConfig(config.id, config.isActive),
        },
      ],
      universalHandlers: {
        edit: () => setEditingConfig(config),
      },
      destructive: {
        label: 'Delete',
        onClick: () => deleteSSOConfig(config.id),
      },
    };
  };

  // ── Kanon §27: Domain Mappings → StandardTable ───────────────────────────
  const domainMappingRows: TableRow[] = domainMappings.map((m: any) => ({ ...m, id: m.id }));

  const domainMappingColumns: TableColumn[] = [
    {
      id: 'domain',
      label: 'Domain',
      sortable: true,
      sortAccessor: (row: any) => row.domain || (Array.isArray(row.domains) ? row.domains[0] : ''),
      render: (row: TableRow) => (
        <span className="text-sm text-slate-900 dark:text-white font-mono">
          {row.domain || (Array.isArray(row.domains) ? row.domains[0] : '—')}
        </span>
      ),
    },
    {
      id: 'organization',
      label: 'Organization',
      sortable: true,
      sortAccessor: (row: any) => row.organizationName || row.organizationId || '',
      render: (row: TableRow) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {row.organizationName || row.organizationId}
        </span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (row: TableRow) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            row.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-200/60 text-slate-600 dark:bg-navy-700/50 dark:text-slate-400'
          }`}
        >
          {row.status || 'active'}
        </span>
      ),
    },
    {
      id: 'createdAt',
      label: 'Added',
      sortable: true,
      render: (row: TableRow) => (
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {row.createdAt ? new Date(row.createdAt as string).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  const domainMappingRowMenu = (row: TableRow): StandardRowMenu => ({
    destructive: {
      label: 'Delete',
      onClick: async () => {
        if (!window.confirm('Delete this domain mapping?')) return;
        try {
          await (Api as any).deleteSsoConfig(row.id);
          fetchDomainMappings();
        } catch {
          toast.error('Failed to delete domain mapping');
        }
      },
    },
  });

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <Key className="text-primary-500" size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Total SSO Configs</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="text-emerald-500" size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.active}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Active</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Shield className="text-blue-500" size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.saml}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">SAML 2.0</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Globe className="text-amber-500" size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.google}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Google/OIDC</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            size={18}
          />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-c-focus"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
        <button
          onClick={() => setShowConfigModal(true)}
          className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Key size={18} />
          Configure SSO
        </button>
      </div>

      {/* SSO Configs Table */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {ssoConfigsLoadError ? (
          <div className="p-6">
            <DegradedState
              title="SSO configurations unavailable"
              description={ssoConfigsLoadError}
            />
          </div>
        ) : (
          <StandardTable
            columns={ssoConfigColumns}
            data={ssoConfigRows}
            rowMenu={ssoConfigRowMenu}
            empty={{
              title: 'No SSO configurations found',
              description: 'Configure SSO for organizations to enable enterprise authentication',
              icon: Key,
            }}
            persistKey="superadmin.ssoConfigs.list"
          />
        )}
      </div>
    </div>
  );

  const renderGoogleTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-danger-500 flex items-center justify-center">
            <Globe size={24} className="text-c-text" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Google Workspace SSO
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Configure OAuth 2.0 / OpenID Connect for Google Workspace authentication
            </p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-4 mb-6 border border-amber-200 dark:border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 dark:text-amber-300">
                OIDC login flow is active
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                This panel writes to the SSO router used by `/api/sso/oidc/authorize` and
                `/api/sso/oidc/callback`. Verify the provider before enforcing SSO.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Status message */}
          {message && (
            <div
              className={`p-4 rounded-lg border ${
                message.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/20 text-danger-700 dark:text-danger-400'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4 border border-blue-200 dark:border-blue-500/20">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300">Setup Instructions</h4>
                <ol className="text-sm text-blue-800 dark:text-blue-400 mt-2 space-y-2 list-decimal list-inside">
                  <li>Go to Google Cloud Console → APIs & Services → Credentials</li>
                  <li>Create an OAuth 2.0 Client ID (Web Application)</li>
                  <li>
                    Add authorized redirect URI:{' '}
                    <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded">{`${window.location.origin}/api/sso/google/callback`}</code>
                  </li>
                  <li>Copy the Client ID and Client Secret below</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Organization selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Organization *
            </label>
            <select
              value={googleForm.organizationId}
              onChange={(e) => setGoogleForm({ ...googleForm, organizationId: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="">Select organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Client ID *
              </label>
              <input
                type="text"
                placeholder="xxxx.apps.googleusercontent.com"
                value={googleForm.clientId}
                onChange={(e) => setGoogleForm({ ...googleForm, clientId: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Client Secret
              </label>
              <input
                type="password"
                placeholder="Enter client secret"
                value={googleForm.clientSecret}
                onChange={(e) => setGoogleForm({ ...googleForm, clientSecret: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Allowed Domains (comma-separated)
            </label>
            <input
              type="text"
              placeholder="company.com, subsidiary.com"
              value={googleForm.allowedDomains}
              onChange={(e) => setGoogleForm({ ...googleForm, allowedDomains: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Only users from these domains can authenticate. Leave empty to allow all domains.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={saveGoogleConfig}
              disabled={saving || !googleForm.organizationId || !googleForm.clientId}
              className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSAMLTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Shield size={24} className="text-c-text" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              SAML 2.0 Configuration
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Configure generic SAML 2.0 for enterprise identity providers
            </p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-4 mb-6 border border-amber-200 dark:border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 dark:text-amber-300">
                SAML login flow is active
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                This panel writes to the SSO router used by `/api/sso/saml/login` and
                `/api/sso/saml/callback`. Validate metadata before enforcing SSO.
              </p>
            </div>
          </div>
        </div>

        {/* SP Metadata */}
        <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Download size={16} />
            Service Provider Metadata
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                Entity ID (SP)
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-white dark:bg-navy-800 px-3 py-2 rounded border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 truncate">
                  {`${window.location.origin}/sso/metadata/${samlForm.organizationId || '[ORG_ID]'}`}
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/sso/metadata/${samlForm.organizationId || '[ORG_ID]'}`
                    )
                  }
                  className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded"
                >
                  <Copy size={14} className="text-slate-600 dark:text-slate-500" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                ACS URL
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-white dark:bg-navy-800 px-3 py-2 rounded border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 truncate">
                  {`${window.location.origin}/api/sso/callback/${samlForm.organizationId || '[ORG_ID]'}`}
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/api/sso/callback/${samlForm.organizationId || '[ORG_ID]'}`
                    )
                  }
                  className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded"
                >
                  <Copy size={14} className="text-slate-600 dark:text-slate-500" />
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const xml = `<EntityDescriptor entityID="${window.location.origin}/sso/saml/metadata">\n  <SPSSODescriptor>\n    <AssertionConsumerService Location="${window.location.origin}/api/sso/saml/callback" />\n  </SPSSODescriptor>\n</EntityDescriptor>`;
              const blob = new Blob([xml], { type: 'application/xml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'sp-metadata.xml';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="mt-3 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download size={14} />
            Download SP Metadata XML
          </button>
        </div>

        {/* IdP Configuration */}
        <div className="space-y-4">
          <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Upload size={16} />
            Identity Provider Configuration
          </h4>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Organization *
            </label>
            <select
              value={samlForm.organizationId}
              onChange={(e) => setSamlForm({ ...samlForm, organizationId: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="">Select organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              IdP Metadata URL or XML
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://idp.example.com/metadata.xml"
                value={samlForm.metadataUrl}
                onChange={(e) => setSamlForm({ ...samlForm, metadataUrl: e.target.value })}
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
              <button
                onClick={async () => {
                  if (!samlForm.metadataUrl) return;
                  try {
                    const res = await Api.post('/sso/saml/validate', {
                      metadataUrl: samlForm.metadataUrl,
                    });
                    const data = res?.data ?? res;
                    if (data?.entityId)
                      setSamlForm((prev: any) => ({
                        ...prev,
                        entityId: data.entityId,
                        ssoUrl: data.ssoUrl || prev.ssoUrl,
                      }));
                    toast.success('Metadata fetched successfully');
                  } catch (err: any) {
                    toast.error(err?.response?.data?.error || 'Failed to fetch metadata');
                  }
                }}
                className="px-4 py-2.5 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors"
              >
                Fetch
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                IdP Entity ID
              </label>
              <input
                type="text"
                placeholder="urn:idp:example"
                value={samlForm.entityId}
                onChange={(e) => setSamlForm({ ...samlForm, entityId: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                SSO URL
              </label>
              <input
                type="text"
                placeholder="https://idp.example.com/sso"
                value={samlForm.ssoUrl}
                onChange={(e) => setSamlForm({ ...samlForm, ssoUrl: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              IdP X.509 Certificate
            </label>
            <textarea
              rows={4}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              value={samlForm.certificate}
              onChange={(e) => setSamlForm({ ...samlForm, certificate: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleValidateSaml}
              disabled={validatingSaml}
              className="px-4 py-2.5 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {validatingSaml && <Loader2 size={16} className="animate-spin" />}
              Validate Configuration
            </button>
            <button
              onClick={handleSaveSaml}
              disabled={savingSaml || !samlForm.organizationId}
              className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {savingSaml && <Loader2 size={16} className="animate-spin" />}
              Save SAML Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDomainsTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
            <Globe size={24} className="text-c-text" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Domain Mapping</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Route users to the correct organization based on their email domain
            </p>
          </div>
          <button
            onClick={() => setShowAddDomainModal(true)}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Globe size={16} />
            Add Domain
          </button>
        </div>

        {showAddDomainModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 shadow-xl w-full max-w-md border border-slate-200 dark:border-navy-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Add Domain</h3>
                <button
                  onClick={() => {
                    setShowAddDomainModal(false);
                    setNewDomain({ domain: '', organizationId: '' });
                  }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-navy-700 rounded"
                >
                  <XCircle size={20} className="text-slate-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Domain *
                  </label>
                  <input
                    type="text"
                    placeholder="example.com"
                    value={newDomain.domain}
                    onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Organization *
                  </label>
                  <select
                    value={newDomain.organizationId}
                    onChange={(e) => setNewDomain({ ...newDomain, organizationId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="">Select organization...</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowAddDomainModal(false);
                      setNewDomain({ domain: '', organizationId: '' });
                    }}
                    className="px-4 py-2 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddDomain}
                    disabled={savingDomain || !newDomain.domain || !newDomain.organizationId}
                    className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
                  >
                    {savingDomain && <Loader2 size={16} className="animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-4 mb-6 border border-amber-200 dark:border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 dark:text-amber-300">
                Domain Verification Required
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                Each domain must be verified via DNS TXT record before it can be used for SSO
                routing.
              </p>
            </div>
          </div>
        </div>

        {domainMappingsLoadError ? (
          <div className="p-6">
            <DegradedState
              title="SSO domain mappings unavailable"
              description={domainMappingsLoadError}
            />
          </div>
        ) : (
          <StandardTable
            columns={domainMappingColumns}
            data={domainMappingRows}
            rowMenu={domainMappingRowMenu}
            empty={{ title: 'No domain mappings configured yet' }}
            persistKey="superadmin.ssoDomainMappings.list"
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 relative">
      <InfoButton cardId="superadmin-sso" position="top-right" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SSO Configuration</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage Single Sign-On for enterprise organizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton
            cardId="superadmin-sso"
            position="header-inline"
            size="md"
            showLabel
            label="Help"
          />
          <button
            onClick={fetchSSOConfigs}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: <Building2 size={16} /> },
          { id: 'google', label: 'Google Workspace', icon: <Globe size={16} /> },
          { id: 'saml', label: 'SAML 2.0', icon: <Shield size={16} /> },
          { id: 'domains', label: 'Domain Mapping', icon: <Globe size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'google' && renderGoogleTab()}
          {activeTab === 'saml' && renderSAMLTab()}
          {activeTab === 'domains' && renderDomainsTab()}
        </>
      )}
    </div>
  );
};

export default SSOConfigurationView;
