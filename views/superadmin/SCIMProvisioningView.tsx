/**
 * SCIM Provisioning View
 *
 * Manages SCIM 2.0 provisioning configuration for enterprise organizations.
 * Allows configuration of tokens, group mappings, and sync monitoring.
 */

import {
    AlertTriangle,
    Check,
    ChevronRight,
    Copy,
    Download,
    Eye,
    EyeOff,
    History,
    Key,
    Link2,
    Plus,
    RefreshCw,
    Settings,
    Shield,
    Trash2,
    Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../services/api';

interface SCIMToken {
    id: string;
    name: string;
    description: string | null;
    tokenPrefix: string;
    scopes: string[];
    lastUsedAt: string | null;
    usageCount: number;
    expiresAt: string | null;
    isActive: boolean;
    createdAt: string;
}

interface GroupMapping {
    id: string;
    externalGroupId: string;
    externalGroupName: string;
    internalRole: string;
    customRoleId: string | null;
    isActive: boolean;
}

interface SyncLog {
    id: string;
    operation: string;
    resourceType: string;
    resourceId: string;
    externalId: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: string;
}

interface ServiceProvider {
    id: string;
    organizationId: string;
    baseUrl: string;
    patchSupported: boolean;
    filterSupported: boolean;
    isActive: boolean;
    lastSyncAt: string | null;
    syncStatus: string;
}

type TabType = 'overview' | 'tokens' | 'mappings' | 'logs';

const SCIMProvisioningView: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(false);

    // Data state
    const [serviceProvider, setServiceProvider] = useState<ServiceProvider | null>(null);
    const [tokens, setTokens] = useState<SCIMToken[]>([]);
    const [groupMappings, setGroupMappings] = useState<GroupMapping[]>([]);
    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

    // UI state
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [newToken, setNewToken] = useState<{ name: string; description: string; scopes: string[] }>({
        name: '',
        description: '',
        scopes: ['users:read', 'users:write', 'groups:read', 'groups:write'],
    });
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [newMapping, setNewMapping] = useState({
        externalGroupId: '',
        externalGroupName: '',
        internalRole: 'member',
    });

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [spResponse, tokensResponse, mappingsResponse, logsResponse] = await Promise.all([
                api.get('/scim/admin/service-provider').catch(() => ({ data: { data: null } })),
                api.get('/scim/admin/tokens').catch(() => ({ data: { data: [] } })),
                api.get('/scim/admin/group-mappings').catch(() => ({ data: { data: [] } })),
                api.get('/scim/admin/sync-logs?limit=50').catch(() => ({ data: { data: [] } })),
            ]);

            setServiceProvider(spResponse.data.data);
            setTokens(tokensResponse.data.data || []);
            setGroupMappings(mappingsResponse.data.data || []);
            setSyncLogs(logsResponse.data.data || []);
        } catch (error) {
            console.error('[SCIM] Fetch data error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Enable SCIM
    const handleEnableSCIM = async () => {
        try {
            await api.post('/scim/admin/service-provider', { isActive: true });
            fetchData();
        } catch (error) {
            console.error('[SCIM] Enable error:', error);
        }
    };

    // Generate Token
    const handleGenerateToken = async () => {
        if (!newToken.name) return;

        try {
            const response = await api.post('/scim/admin/tokens', newToken);
            setGeneratedToken(response.data.data.token);
            setTokens([...tokens, response.data.data]);
        } catch (error) {
            console.error('[SCIM] Generate token error:', error);
        }
    };

    // Revoke Token
    const handleRevokeToken = async (tokenId: string) => {
        if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) return;

        try {
            await api.delete(`/scim/admin/tokens/${tokenId}`);
            setTokens(tokens.filter((t) => t.id !== tokenId));
        } catch (error) {
            console.error('[SCIM] Revoke token error:', error);
        }
    };

    // Create Group Mapping
    const handleCreateMapping = async () => {
        if (!newMapping.externalGroupId || !newMapping.externalGroupName) return;

        try {
            const response = await api.post('/scim/admin/group-mappings', newMapping);
            fetchData();
            setShowMappingModal(false);
            setNewMapping({ externalGroupId: '', externalGroupName: '', internalRole: 'member' });
        } catch (error) {
            console.error('[SCIM] Create mapping error:', error);
        }
    };

    // Delete Group Mapping
    const handleDeleteMapping = async (mappingId: string) => {
        if (!confirm('Delete this group mapping?')) return;

        try {
            await api.delete(`/scim/admin/group-mappings/${mappingId}`);
            setGroupMappings(groupMappings.filter((m) => m.id !== mappingId));
        } catch (error) {
            console.error('[SCIM] Delete mapping error:', error);
        }
    };

    // Copy to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const tabs = [
        { id: 'overview' as TabType, label: 'Overview', icon: Settings },
        { id: 'tokens' as TabType, label: 'API Tokens', icon: Key },
        { id: 'mappings' as TabType, label: 'Group Mappings', icon: Users },
        { id: 'logs' as TabType, label: 'Sync Logs', icon: History },
    ];

    const renderOverview = () => (
        <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                serviceProvider?.isActive ? 'bg-green-500/20' : 'bg-gray-700'
                            }`}
                        >
                            <Link2 className={serviceProvider?.isActive ? 'text-green-400' : 'text-gray-400'} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">SCIM 2.0 Provisioning</h3>
                            <p className="text-sm text-gray-400">
                                {serviceProvider?.isActive
                                    ? 'Automatic user provisioning is active'
                                    : 'Enable to sync users from your identity provider'}
                            </p>
                        </div>
                    </div>
                    {!serviceProvider?.isActive && (
                        <button
                            onClick={handleEnableSCIM}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                        >
                            Enable SCIM
                        </button>
                    )}
                </div>

                {serviceProvider && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-900/50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-white">{tokens.length}</div>
                            <div className="text-sm text-gray-400">Active Tokens</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-white">{groupMappings.length}</div>
                            <div className="text-sm text-gray-400">Group Mappings</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-white">
                                {syncLogs.filter((l) => l.status === 'success').length}
                            </div>
                            <div className="text-sm text-gray-400">Successful Syncs (24h)</div>
                        </div>
                    </div>
                )}
            </div>

            {/* SCIM Endpoint Info */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">SCIM Endpoint Configuration</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Base URL</label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-gray-900 rounded-lg text-sm text-violet-400 font-mono">
                                {window.location.origin}/api/scim/v2
                            </code>
                            <button
                                onClick={() => copyToClipboard(`${window.location.origin}/api/scim/v2`)}
                                className="p-2 text-gray-400 hover:text-white transition-colors"
                            >
                                {copied ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-400">Users Endpoint:</span>
                            <code className="ml-2 text-violet-400">/Users</code>
                        </div>
                        <div>
                            <span className="text-gray-400">Groups Endpoint:</span>
                            <code className="ml-2 text-violet-400">/Groups</code>
                        </div>
                        <div>
                            <span className="text-gray-400">Authentication:</span>
                            <code className="ml-2 text-violet-400">Bearer Token</code>
                        </div>
                        <div>
                            <span className="text-gray-400">PATCH Support:</span>
                            <code className="ml-2 text-green-400">Yes</code>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Setup Guide */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Setup Guide</h3>
                <div className="space-y-3">
                    {[
                        { step: 1, text: 'Generate a SCIM API token in the Tokens tab', done: tokens.length > 0 },
                        { step: 2, text: 'Configure your IdP with the SCIM endpoint URL', done: false },
                        {
                            step: 3,
                            text: 'Set up group mappings to assign roles automatically',
                            done: groupMappings.length > 0,
                        },
                        {
                            step: 4,
                            text: 'Test provisioning with a test user',
                            done: syncLogs.some((l) => l.status === 'success'),
                        },
                    ].map((item) => (
                        <div key={item.step} className="flex items-center gap-3">
                            <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    item.done ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
                                }`}
                            >
                                {item.done ? <Check size={14} /> : item.step}
                            </div>
                            <span className={item.done ? 'text-gray-300' : 'text-gray-400'}>{item.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderTokens = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">SCIM API Tokens</h3>
                    <p className="text-sm text-gray-400">Tokens for authenticating SCIM requests from your IdP</p>
                </div>
                <button
                    onClick={() => setShowTokenModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    Generate Token
                </button>
            </div>

            {tokens.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
                    <Key className="mx-auto text-gray-500 mb-4" size={48} />
                    <p className="text-gray-400">No tokens generated yet</p>
                    <p className="text-sm text-gray-500 mt-1">Generate a token to enable SCIM provisioning</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {tokens.map((token) => (
                        <div key={token.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                            token.isActive ? 'bg-green-500/20' : 'bg-red-500/20'
                                        }`}
                                    >
                                        <Key className={token.isActive ? 'text-green-400' : 'text-red-400'} size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-white">{token.name}</h4>
                                        <p className="text-sm text-gray-400">
                                            {token.tokenPrefix}••••••••
                                            {token.lastUsedAt &&
                                                ` • Last used: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">{token.usageCount} requests</span>
                                    <button
                                        onClick={() => handleRevokeToken(token.id)}
                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {token.scopes.map((scope) => (
                                    <span key={scope} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                                        {scope}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Token Modal */}
            {showTokenModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full">
                        {generatedToken ? (
                            <>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                        <Check className="text-green-400" size={20} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-white">Token Generated</h3>
                                </div>
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
                                        <p className="text-sm text-yellow-300">
                                            Copy this token now. It won't be shown again.
                                        </p>
                                    </div>
                                </div>
                                <div className="relative mb-4">
                                    <code className="block w-full p-3 bg-gray-900 rounded-lg text-sm text-violet-400 font-mono break-all">
                                        {generatedToken}
                                    </code>
                                    <button
                                        onClick={() => copyToClipboard(generatedToken)}
                                        className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-white bg-gray-800 rounded"
                                    >
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowTokenModal(false);
                                        setGeneratedToken(null);
                                        setNewToken({
                                            name: '',
                                            description: '',
                                            scopes: ['users:read', 'users:write', 'groups:read', 'groups:write'],
                                        });
                                    }}
                                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    Done
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-semibold text-white mb-4">Generate SCIM Token</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Token Name *</label>
                                        <input
                                            type="text"
                                            value={newToken.name}
                                            onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                                            placeholder="e.g., Azure AD SCIM"
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Description</label>
                                        <input
                                            type="text"
                                            value={newToken.description}
                                            onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                                            placeholder="Optional description"
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">Scopes</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['users:read', 'users:write', 'groups:read', 'groups:write'].map(
                                                (scope) => (
                                                    <label
                                                        key={scope}
                                                        className="flex items-center gap-2 text-sm text-gray-300"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={newToken.scopes.includes(scope)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setNewToken({
                                                                        ...newToken,
                                                                        scopes: [...newToken.scopes, scope],
                                                                    });
                                                                } else {
                                                                    setNewToken({
                                                                        ...newToken,
                                                                        scopes: newToken.scopes.filter(
                                                                            (s) => s !== scope,
                                                                        ),
                                                                    });
                                                                }
                                                            }}
                                                            className="rounded border-gray-600 bg-gray-900 text-violet-500"
                                                        />
                                                        {scope}
                                                    </label>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setShowTokenModal(false)}
                                        className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleGenerateToken}
                                        disabled={!newToken.name}
                                        className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                                    >
                                        Generate
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderMappings = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Group Mappings</h3>
                    <p className="text-sm text-gray-400">Map IdP groups to Consultify roles</p>
                </div>
                <button
                    onClick={() => setShowMappingModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    Add Mapping
                </button>
            </div>

            {groupMappings.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
                    <Users className="mx-auto text-gray-500 mb-4" size={48} />
                    <p className="text-gray-400">No group mappings configured</p>
                    <p className="text-sm text-gray-500 mt-1">Map IdP groups to automatically assign roles</p>
                </div>
            ) : (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-900/50">
                            <tr>
                                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                                    External Group
                                </th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">→</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Internal Role</th>
                                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {groupMappings.map((mapping) => (
                                <tr key={mapping.id} className="hover:bg-gray-800/30">
                                    <td className="px-4 py-3">
                                        <div className="text-white font-medium">{mapping.externalGroupName}</div>
                                        <div className="text-sm text-gray-500">{mapping.externalGroupId}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <ChevronRight className="text-gray-500" size={18} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 bg-violet-500/20 text-violet-300 rounded text-sm">
                                            {mapping.internalRole}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleDeleteMapping(mapping.id)}
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Mapping Modal */}
            {showMappingModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold text-white mb-4">Add Group Mapping</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">External Group ID *</label>
                                <input
                                    type="text"
                                    value={newMapping.externalGroupId}
                                    onChange={(e) => setNewMapping({ ...newMapping, externalGroupId: e.target.value })}
                                    placeholder="e.g., 00000000-0000-0000-0000-000000000000"
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">External Group Name *</label>
                                <input
                                    type="text"
                                    value={newMapping.externalGroupName}
                                    onChange={(e) =>
                                        setNewMapping({ ...newMapping, externalGroupName: e.target.value })
                                    }
                                    placeholder="e.g., Consultify Admins"
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Internal Role</label>
                                <select
                                    value={newMapping.internalRole}
                                    onChange={(e) => setNewMapping({ ...newMapping, internalRole: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="member">Member</option>
                                    <option value="project_manager">Project Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowMappingModal(false)}
                                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateMapping}
                                disabled={!newMapping.externalGroupId || !newMapping.externalGroupName}
                                className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                            >
                                Add Mapping
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderLogs = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Sync Logs</h3>
                    <p className="text-sm text-gray-400">Recent SCIM provisioning activity</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                    <RefreshCw size={18} />
                    Refresh
                </button>
            </div>

            {syncLogs.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
                    <History className="mx-auto text-gray-500 mb-4" size={48} />
                    <p className="text-gray-400">No sync activity yet</p>
                    <p className="text-sm text-gray-500 mt-1">Logs will appear here when your IdP syncs users</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {syncLogs.map((log) => (
                        <div key={log.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-2 h-2 rounded-full ${
                                            log.status === 'success'
                                                ? 'bg-green-400'
                                                : log.status === 'error'
                                                  ? 'bg-red-400'
                                                  : 'bg-yellow-400'
                                        }`}
                                    />
                                    <span className="text-white font-medium">{log.operation}</span>
                                    <span className="text-gray-400">{log.resourceType}</span>
                                    {log.externalId && (
                                        <code className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded">
                                            {log.externalId}
                                        </code>
                                    )}
                                </div>
                                <span className="text-sm text-gray-500">
                                    {new Date(log.createdAt).toLocaleString()}
                                </span>
                            </div>
                            {log.errorMessage && (
                                <div className="mt-2 text-sm text-red-400 bg-red-500/10 rounded px-3 py-1">
                                    {log.errorMessage}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">SCIM Provisioning</h2>
                    <p className="text-gray-400 mt-1">Automatic user provisioning via SCIM 2.0</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-700">
                <div className="flex gap-6">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-violet-500 text-white'
                                        : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="animate-spin text-violet-500" size={32} />
                </div>
            ) : (
                <>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'tokens' && renderTokens()}
                    {activeTab === 'mappings' && renderMappings()}
                    {activeTab === 'logs' && renderLogs()}
                </>
            )}
        </div>
    );
};

export default SCIMProvisioningView;


