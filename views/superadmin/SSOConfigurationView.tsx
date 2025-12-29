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

import React, { useState, useEffect, useCallback } from 'react';
import {
    Key,
    Shield,
    Building2,
    Globe,
    Settings,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Copy,
    ExternalLink,
    Download,
    Upload,
    RefreshCw,
    Search,
    Filter,
    MoreVertical,
    ChevronRight,
    Lock,
    Loader2,
    Info,
    Zap
} from 'lucide-react';
import { Api } from '../../services/api';
import { InfoButton } from '../../components/shared/InfoButton';

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
        domainRestriction: ''
    });
    
    // Google SSO form state
    const [googleForm, setGoogleForm] = useState({
        organizationId: '',
        clientId: '',
        clientSecret: '',
        allowedDomains: ''
    });
    
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
                .map(d => d.trim())
                .filter(d => d.length > 0);
                
            await Api.post('/sso/superadmin/google/config', {
                organizationId: googleForm.organizationId,
                clientId: googleForm.clientId,
                clientSecret: googleForm.clientSecret,
                allowedDomains
            });
            
            setMessage({ type: 'success', text: 'Google SSO configuration saved successfully!' });
            setGoogleForm({ organizationId: '', clientId: '', clientSecret: '', allowedDomains: '' });
            fetchSSOConfigs();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save configuration' });
        } finally {
            setSaving(false);
        }
    };
    
    // Toggle SSO config active status
    const toggleSSOConfig = async (configId: string, isActive: boolean) => {
        try {
            await Api.put(`/sso/superadmin/config/${configId}/toggle`, { isActive: !isActive });
            fetchSSOConfigs();
        } catch (error) {
            console.error('Failed to toggle SSO config:', error);
        }
    };
    
    // Delete SSO config
    const deleteSSOConfig = async (configId: string) => {
        if (!window.confirm('Are you sure you want to delete this SSO configuration? Users will no longer be able to use SSO to login.')) {
            return;
        }
        
        try {
            await Api.delete(`/sso/superadmin/config/${configId}`);
            fetchSSOConfigs();
        } catch (error) {
            console.error('Failed to delete SSO config:', error);
        }
    };

    const fetchSSOConfigs = useCallback(async () => {
        setLoading(true);
        try {
            // Use SuperAdmin endpoint to get all SSO configs at once
            const result = await Api.get('/sso/superadmin/configs');
            setSsoConfigs(result.configs || []);
        } catch (error) {
            console.error('Failed to fetch SSO configs:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSSOConfigs();
        fetchOrganizations();
    }, [fetchSSOConfigs, fetchOrganizations]);

    const filteredConfigs = ssoConfigs.filter(config => {
        const matchesSearch = config.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            config.providerName?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && config.isActive) ||
            (filterStatus === 'inactive' && !config.isActive);
        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: ssoConfigs.length,
        active: ssoConfigs.filter(c => c.isActive).length,
        saml: ssoConfigs.filter(c => c.providerType === 'saml').length,
        google: ssoConfigs.filter(c => c.providerType === 'google' || c.providerType === 'oidc').length
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const renderOverviewTab = () => (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <Key className="text-violet-500" size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
                            <div className="text-sm text-slate-500">Total SSO Configs</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="text-emerald-500" size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.active}</div>
                            <div className="text-sm text-slate-500">Active</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Shield className="text-blue-500" size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.saml}</div>
                            <div className="text-sm text-slate-500">SAML 2.0</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Globe className="text-amber-500" size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.google}</div>
                            <div className="text-sm text-slate-500">Google/OIDC</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search organizations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500/20"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                    className="px-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                </select>
                <button
                    onClick={() => setShowConfigModal(true)}
                    className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                    <Key size={18} />
                    Configure SSO
                </button>
            </div>

            {/* SSO Configs Table */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10">
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Provider</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Policies</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                            <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {filteredConfigs.map((config) => (
                            <tr key={config.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                            {config.organizationName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-white">{config.organizationName}</div>
                                            <div className="text-xs text-slate-500 font-mono">{config.organizationId.slice(0, 8)}...</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {config.providerType === 'google' && <img src="/assets/google-logo.png" alt="Google" className="w-5 h-5" />}
                                        {config.providerType === 'saml' && <Shield size={18} className="text-blue-500" />}
                                        {config.providerType === 'azure_ad' && <Shield size={18} className="text-sky-500" />}
                                        {config.providerType === 'okta' && <Shield size={18} className="text-indigo-500" />}
                                        <span className="text-slate-700 dark:text-slate-300 capitalize">
                                            {config.providerName || config.providerType.replace('_', ' ')}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {config.isActive ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                <CheckCircle2 size={12} />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400">
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
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {config.enforceSso && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">SSO Only</span>
                                        )}
                                        {config.autoProvisionUsers && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400">Auto-provision</span>
                                        )}
                                        {config.allowPasswordLogin && (
                                            <span className="text-xs px-2 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400">Password fallback</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {new Date(config.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => toggleSSOConfig(config.id, config.isActive)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                config.isActive 
                                                    ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' 
                                                    : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                            }`}
                                        >
                                            {config.isActive ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button
                                            onClick={() => deleteSSOConfig(config.id)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={() => setEditingConfig(config)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                        >
                                            <MoreVertical size={16} className="text-slate-400" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredConfigs.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <div className="text-slate-500">
                                        <Key size={40} className="mx-auto mb-3 opacity-30" />
                                        <p className="font-medium">No SSO configurations found</p>
                                        <p className="text-sm">Configure SSO for organizations to enable enterprise authentication</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderGoogleTab = () => (
        <div className="space-y-6">
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center">
                        <Globe size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Google Workspace SSO</h3>
                        <p className="text-slate-500 mt-1">Configure OAuth 2.0 / OpenID Connect for Google Workspace authentication</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Status message */}
                    {message && (
                        <div className={`p-4 rounded-lg border ${message.type === 'success' 
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
                        }`}>
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
                                    <li>Add authorized redirect URI: <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded">{`${window.location.origin}/api/sso/google/callback`}</code></li>
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
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                        >
                            <option value="">Select organization...</option>
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
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
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
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
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
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
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">Only users from these domains can authenticate. Leave empty to allow all domains.</p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={saveGoogleConfig}
                            disabled={saving || !googleForm.organizationId || !googleForm.clientId}
                            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
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
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                        <Shield size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">SAML 2.0 Configuration</h3>
                        <p className="text-slate-500 mt-1">Configure generic SAML 2.0 for enterprise identity providers</p>
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
                            <label className="text-xs text-slate-500 mb-1 block">Entity ID (SP)</label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm bg-white dark:bg-navy-800 px-3 py-2 rounded border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 truncate">
                                    {`${window.location.origin}/sso/metadata/[ORG_ID]`}
                                </code>
                                <button onClick={() => copyToClipboard(`${window.location.origin}/sso/metadata/[ORG_ID]`)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded">
                                    <Copy size={14} className="text-slate-400" />
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">ACS URL</label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm bg-white dark:bg-navy-800 px-3 py-2 rounded border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 truncate">
                                    {`${window.location.origin}/api/sso/callback/[ORG_ID]`}
                                </code>
                                <button onClick={() => copyToClipboard(`${window.location.origin}/api/sso/callback/[ORG_ID]`)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded">
                                    <Copy size={14} className="text-slate-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <button className="mt-3 px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-colors flex items-center gap-2">
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
                            IdP Metadata URL or XML
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="https://idp.example.com/metadata.xml"
                                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                            />
                            <button className="px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
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
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                SSO URL
                            </label>
                            <input
                                type="text"
                                placeholder="https://idp.example.com/sso"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
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
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button className="px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            Validate Configuration
                        </button>
                        <button className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors">
                            Save SAML Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderDomainsTab = () => (
        <div className="space-y-6">
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Globe size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Domain Mapping</h3>
                        <p className="text-slate-500 mt-1">Route users to the correct organization based on their email domain</p>
                    </div>
                    <button className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors">
                        <Globe size={16} />
                        Add Domain
                    </button>
                </div>

                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-4 mb-6 border border-amber-200 dark:border-amber-500/20">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-amber-900 dark:text-amber-300">Domain Verification Required</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                                Each domain must be verified via DNS TXT record before it can be used for SSO routing.
                            </p>
                        </div>
                    </div>
                </div>

                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Domain</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Added</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                No domain mappings configured yet
                            </td>
                        </tr>
                    </tbody>
                </table>
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
                    <p className="text-slate-500 mt-1">Manage Single Sign-On for enterprise organizations</p>
                </div>
                <button
                    onClick={fetchSSOConfigs}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={18} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
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
                                ? 'bg-white dark:bg-navy-800 text-violet-600 dark:text-violet-400 shadow-sm'
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
                    <Loader2 size={32} className="animate-spin text-violet-500" />
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

