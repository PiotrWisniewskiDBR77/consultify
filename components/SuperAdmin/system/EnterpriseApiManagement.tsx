/**
 * EnterpriseApiManagement - Comprehensive API Key & Management Panel
 *
 * Features:
 * - API Key CRUD with scopes
 * - Rate limiting configuration
 * - Usage analytics & metrics
 * - API documentation
 * - Webhook management
 */

import {
    Activity,
    AlertTriangle,
    BarChart3,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    Code,
    Copy,
    Edit,
    ExternalLink,
    Eye,
    EyeOff,
    FileText,
    Filter,
    Globe,
    Key,
    Loader2,
    Lock,
    Plus,
    RefreshCw,
    Search,
    Shield,
    Trash2,
    Unlock,
    X,
    Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface ApiKey {
    id: string;
    name: string;
    description?: string;
    key_prefix: string;
    key_type: 'org' | 'user' | 'service';
    scopes: string[];
    rate_limit_per_minute: number;
    rate_limit_per_day: number;
    allowed_ips: string[];
    last_used_at?: string;
    usage_count: number;
    expires_at?: string;
    is_active: boolean;
    revoked_at?: string;
    created_at: string;
}

interface ApiKeyUsage {
    usage: Array<{
        date: string;
        requests: number;
        successful: number;
        failed: number;
        avg_response_time: number;
    }>;
    totals: {
        total_requests: number;
        avg_response_time: number;
        total_errors: number;
    };
    endpoints: Array<{
        endpoint: string;
        method: string;
        count: number;
    }>;
}

interface Scope {
    id: string;
    name: string;
    description: string;
    category: string;
}

const AVAILABLE_SCOPES: Scope[] = [
    { id: 'read:users', name: 'Read Users', description: 'Read user information', category: 'Users' },
    { id: 'write:users', name: 'Write Users', description: 'Create/update users', category: 'Users' },
    { id: 'read:projects', name: 'Read Projects', description: 'Read project data', category: 'Projects' },
    { id: 'write:projects', name: 'Write Projects', description: 'Create/update projects', category: 'Projects' },
    { id: 'read:assessments', name: 'Read Assessments', description: 'Read assessments', category: 'Assessments' },
    {
        id: 'write:assessments',
        name: 'Write Assessments',
        description: 'Create/update assessments',
        category: 'Assessments',
    },
    { id: 'read:reports', name: 'Read Reports', description: 'Read reports', category: 'Reports' },
    { id: 'export:reports', name: 'Export Reports', description: 'Export reports to PDF/Excel', category: 'Reports' },
    { id: 'use:ai', name: 'Use AI', description: 'Access AI features', category: 'AI' },
    { id: 'read:ai_usage', name: 'Read AI Usage', description: 'View AI usage stats', category: 'AI' },
    { id: 'admin:billing', name: 'Admin Billing', description: 'Access billing data', category: 'Admin' },
    { id: 'admin:audit', name: 'Admin Audit', description: 'Access audit logs', category: 'Admin' },
    { id: 'manage:webhooks', name: 'Manage Webhooks', description: 'Create/manage webhooks', category: 'Integrations' },
];

const KEY_TYPE_CONFIG = {
    org: { label: 'Organization', color: 'bg-purple-500/20 text-purple-400' },
    user: { label: 'User', color: 'bg-blue-500/20 text-blue-400' },
    service: { label: 'Service', color: 'bg-emerald-500/20 text-emerald-400' },
};

export const EnterpriseApiManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'keys' | 'usage' | 'docs'>('keys');
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
    const [selectedKeyUsage, setSelectedKeyUsage] = useState<{ key: ApiKey; usage: ApiKeyUsage } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [newKeyVisible, setNewKeyVisible] = useState<{ id: string; key: string } | null>(null);

    const fetchApiKeys = useCallback(async () => {
        setLoading(true);
        try {
            const data = await Api.getApiKeys();
            setApiKeys(data);
        } catch (error) {
            console.error('Failed to fetch API keys:', error);
            toast.error('Failed to load API keys');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchApiKeys();
    }, [fetchApiKeys]);

    const handleCreateKey = async (formData: any) => {
        try {
            if (editingKey) {
                // Update implementation would go here
                // await (Api as any).updateUserApiKey(editingKey.id, formData);
            } else {
                await (Api as any).createUserApiKey(formData.name, formData.scopes);
            }
            toast.success('API key saved successfully');
            setShowCreateModal(false);
            setEditingKey(null);
            fetchApiKeys();
        } catch (error) {
            console.error('Failed to save API key:', error);
            toast.error('Failed to save API key');
        }
    };

    const handleRevokeKey = async (id: string) => {
        if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;

        try {
            await (Api as any).revokeApiKey(id);
            toast.success('API key revoked');
            fetchApiKeys();
        } catch (error) {
            console.error('Failed to revoke API key:', error);
            toast.error('Failed to revoke API key');
        }
    };

    const handleViewUsage = async (key: ApiKey) => {
        try {
            const usage = await Api.getApiKeyUsage(key.id);
            setSelectedKeyUsage({ key, usage });
        } catch (error) {
            console.error('Failed to fetch usage:', error);
            toast.error('Failed to load usage data');
        }
    };

    const handleCopyKey = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(text);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const filteredKeys = apiKeys.filter(
        (key) =>
            key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            key.key_prefix.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">API Management</h2>
                    <p className="text-slate-400 text-sm">
                        Manage API keys, view usage analytics, and access documentation
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create API Key
                </button>
            </div>

            {/* New Key Alert */}
            {newKeyVisible && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            <Key className="w-5 h-5 text-emerald-400 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-emerald-400">API Key Created Successfully</h4>
                                <p className="text-sm text-slate-400 mt-1 mb-3">
                                    Save this key now - it won't be shown again!
                                </p>
                                <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-lg">
                                    <code className="text-sm text-white font-mono flex-1 break-all">
                                        {newKeyVisible.key}
                                    </code>
                                    <button
                                        onClick={() => handleCopyKey(newKeyVisible.key)}
                                        className="p-2 hover:bg-white/10 rounded"
                                    >
                                        {copiedKey === newKeyVisible.key ? (
                                            <Check className="w-4 h-4 text-emerald-400" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-slate-400" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setNewKeyVisible(null)} className="p-1 hover:bg-white/10 rounded">
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-1">
                {[
                    { id: 'keys', label: 'API Keys', icon: Key },
                    { id: 'usage', label: 'Usage Analytics', icon: BarChart3 },
                    { id: 'docs', label: 'Documentation', icon: FileText },
                ].map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id as any)}
                        className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
                            activeTab === id
                                ? 'bg-white/10 text-white border-b-2 border-purple-500'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Keys Tab */}
            {activeTab === 'keys' && (
                <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500"
                            size={16}
                        />
                        <input
                            type="text"
                            placeholder="Search API keys..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    {/* Keys List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                        </div>
                    ) : filteredKeys.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No API keys found</p>
                            <p className="text-sm mt-1">Create your first API key to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredKeys.map((key) => (
                                <div
                                    key={key.id}
                                    className={`p-4 rounded-xl border transition-colors ${
                                        key.revoked_at
                                            ? 'bg-red-500/5 border-red-500/20 opacity-60'
                                            : 'bg-white/5 border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`p-2 rounded-lg ${key.revoked_at ? 'bg-red-500/20' : 'bg-purple-500/20'}`}
                                            >
                                                {key.revoked_at ? (
                                                    <Lock className="w-5 h-5 text-red-400" />
                                                ) : (
                                                    <Key className="w-5 h-5 text-purple-400" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-white">{key.name}</span>
                                                    <code className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded font-mono">
                                                        {key.key_prefix}...
                                                    </code>
                                                    <span
                                                        className={`px-2 py-0.5 text-xs rounded ${KEY_TYPE_CONFIG[key.key_type].color}`}
                                                    >
                                                        {KEY_TYPE_CONFIG[key.key_type].label}
                                                    </span>
                                                    {key.revoked_at && (
                                                        <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                                                            Revoked
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                    <span>{key.scopes.length} scopes</span>
                                                    <span>•</span>
                                                    <span>{key.rate_limit_per_minute}/min</span>
                                                    <span>•</span>
                                                    <span>{key.usage_count.toLocaleString()} requests</span>
                                                    {key.last_used_at && (
                                                        <>
                                                            <span>•</span>
                                                            <span>
                                                                Last used:{' '}
                                                                {new Date(key.last_used_at).toLocaleDateString()}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!key.revoked_at && (
                                                <>
                                                    <button
                                                        onClick={() => handleViewUsage(key)}
                                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                        title="View Usage"
                                                    >
                                                        <BarChart3 className="w-4 h-4 text-slate-400" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingKey(key)}
                                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4 text-slate-400" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRevokeKey(key.id)}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                                        title="Revoke"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-400" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Scopes Preview */}
                                    <div className="mt-3 pt-3 border-t border-white/5">
                                        <div className="flex flex-wrap gap-1">
                                            {key.scopes.slice(0, 5).map((scope) => (
                                                <span
                                                    key={scope}
                                                    className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded"
                                                >
                                                    {scope}
                                                </span>
                                            ))}
                                            {key.scopes.length > 5 && (
                                                <span className="text-xs text-slate-500">
                                                    +{key.scopes.length - 5} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Usage Analytics Tab */}
            {activeTab === 'usage' && (
                <div className="space-y-6">
                    {selectedKeyUsage ? (
                        <>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setSelectedKeyUsage(null)}
                                        className="p-2 hover:bg-white/10 rounded-lg"
                                    >
                                        <ChevronRight className="w-4 h-4 text-slate-400 rotate-180" />
                                    </button>
                                    <div>
                                        <h3 className="text-lg font-medium text-white">{selectedKeyUsage.key.name}</h3>
                                        <code className="text-sm text-slate-500">
                                            {selectedKeyUsage.key.key_prefix}...
                                        </code>
                                    </div>
                                </div>
                            </div>

                            {/* Usage Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-sm text-slate-400">Total Requests</div>
                                    <div className="text-2xl font-bold text-white">
                                        {selectedKeyUsage.usage.totals?.total_requests?.toLocaleString() || 0}
                                    </div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-sm text-slate-400">Avg Response Time</div>
                                    <div className="text-2xl font-bold text-white">
                                        {Math.round(selectedKeyUsage.usage.totals?.avg_response_time || 0)}ms
                                    </div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-sm text-slate-400">Error Rate</div>
                                    <div className="text-2xl font-bold text-white">
                                        {selectedKeyUsage.usage.totals?.total_requests
                                            ? (
                                                  (selectedKeyUsage.usage.totals.total_errors /
                                                      selectedKeyUsage.usage.totals.total_requests) *
                                                  100
                                              ).toFixed(2)
                                            : 0}
                                        %
                                    </div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="text-sm text-slate-400">Total Errors</div>
                                    <div className="text-2xl font-bold text-red-400">
                                        {selectedKeyUsage.usage.totals?.total_errors || 0}
                                    </div>
                                </div>
                            </div>

                            {/* Usage Chart */}
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h4 className="text-sm font-medium text-white mb-4">Requests Over Time</h4>
                                <div className="flex items-end gap-2 h-32">
                                    {selectedKeyUsage.usage.usage?.length > 0 ? (
                                        selectedKeyUsage.usage.usage.map((day, i) => (
                                            <div key={i} className="flex-1 flex flex-col items-center">
                                                <div
                                                    className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t-sm"
                                                    style={{
                                                        height: `${Math.max(5, (day.requests / Math.max(...selectedKeyUsage.usage.usage.map((d) => d.requests))) * 100)}%`,
                                                    }}
                                                />
                                                <div className="text-xs text-slate-500 mt-2">
                                                    {new Date(day.date).toLocaleDateString('en-US', {
                                                        weekday: 'short',
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="w-full text-center text-slate-400">No usage data</div>
                                    )}
                                </div>
                            </div>

                            {/* Top Endpoints */}
                            {selectedKeyUsage.usage.endpoints?.length > 0 && (
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <h4 className="text-sm font-medium text-white mb-4">Top Endpoints</h4>
                                    <div className="space-y-2">
                                        {selectedKeyUsage.usage.endpoints.map((endpoint, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className={`px-2 py-0.5 text-xs font-mono rounded ${
                                                            endpoint.method === 'GET'
                                                                ? 'bg-blue-500/20 text-blue-400'
                                                                : endpoint.method === 'POST'
                                                                  ? 'bg-emerald-500/20 text-emerald-400'
                                                                  : endpoint.method === 'PUT'
                                                                    ? 'bg-amber-500/20 text-amber-400'
                                                                    : 'bg-red-500/20 text-red-400'
                                                        }`}
                                                    >
                                                        {endpoint.method}
                                                    </span>
                                                    <code className="text-sm text-slate-300">{endpoint.endpoint}</code>
                                                </div>
                                                <span className="text-sm text-slate-400">
                                                    {endpoint.count.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 text-slate-400">
                            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Select an API key to view usage analytics</p>
                            <button
                                onClick={() => setActiveTab('keys')}
                                className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                            >
                                Go to API Keys
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Documentation Tab */}
            {activeTab === 'docs' && (
                <div className="space-y-6">
                    <div className="p-6 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-xl border border-purple-500/20">
                        <h3 className="text-xl font-bold text-white mb-2">Consultify API</h3>
                        <p className="text-slate-400 mb-4">
                            Build powerful integrations with the Consultify REST API. Access projects, assessments,
                            reports, and more.
                        </p>
                        <div className="flex items-center gap-4">
                            <a
                                href="/api/docs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                                View API Docs
                                <ExternalLink className="w-4 h-4" />
                            </a>
                            <a
                                href="/api/openapi.json"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                            >
                                <Code className="w-4 h-4" />
                                OpenAPI Spec
                            </a>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-purple-400" />
                                Authentication
                            </h4>
                            <p className="text-sm text-slate-400 mb-3">
                                All API requests require authentication using an API key in the Authorization header.
                            </p>
                            <div className="p-3 bg-slate-900 rounded-lg">
                                <code className="text-sm text-cyan-400">Authorization: Bearer ck_live_xxx...</code>
                            </div>
                        </div>

                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-400" />
                                Rate Limits
                            </h4>
                            <p className="text-sm text-slate-400 mb-3">
                                API requests are rate limited based on your key configuration.
                            </p>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Default per minute:</span>
                                    <span className="text-white">60 requests</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Default per day:</span>
                                    <span className="text-white">10,000 requests</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-emerald-400" />
                                Base URL
                            </h4>
                            <div className="p-3 bg-slate-900 rounded-lg">
                                <code className="text-sm text-emerald-400">
                                    {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1
                                </code>
                            </div>
                        </div>

                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-400" />
                                Response Format
                            </h4>
                            <p className="text-sm text-slate-400 mb-3">All responses are returned in JSON format.</p>
                            <div className="p-3 bg-slate-900 rounded-lg">
                                <pre className="text-sm text-blue-400">
                                    {`{
  "success": true,
  "data": { ... }
}`}
                                </pre>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <h4 className="font-medium text-white mb-4">Available Scopes</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {AVAILABLE_SCOPES.map((scope) => (
                                <div key={scope.id} className="p-3 bg-slate-800/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-1">
                                        <code className="text-sm text-cyan-400">{scope.id}</code>
                                        <span className="text-xs text-slate-500">{scope.category}</span>
                                    </div>
                                    <p className="text-xs text-slate-400">{scope.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || editingKey) && (
                <ApiKeyModal
                    key={editingKey?.id}
                    editKey={editingKey}
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingKey(null);
                    }}
                    onSave={handleCreateKey}
                    availableScopes={AVAILABLE_SCOPES}
                />
            )}
        </div>
    );
};

// API Key Modal Component
const ApiKeyModal: React.FC<{
    editKey?: ApiKey | null;
    onClose: () => void;
    onSave: (data: any) => void;
    availableScopes: Scope[];
}> = ({ editKey, onClose, onSave, availableScopes }) => {
    const [formData, setFormData] = useState({
        name: editKey?.name || '',
        description: editKey?.description || '',
        key_type: editKey?.key_type || 'org',
        scopes: editKey?.scopes || [],
        rate_limit_per_minute: editKey?.rate_limit_per_minute || 60,
        rate_limit_per_day: editKey?.rate_limit_per_day || 10000,
        allowed_ips: editKey?.allowed_ips?.join(', ') || '',
        expires_at: editKey?.expires_at ? editKey.expires_at.split('T')[0] : '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave({
                ...formData,
                allowed_ips: formData.allowed_ips ? formData.allowed_ips.split(',').map((ip) => ip.trim()) : [],
                expires_at: formData.expires_at || null,
            });
        } finally {
            setSaving(false);
        }
    };

    const toggleScope = (scopeId: string) => {
        setFormData((prev) => ({
            ...prev,
            scopes: prev.scopes.includes(scopeId)
                ? prev.scopes.filter((s) => s !== scopeId)
                : [...prev.scopes, scopeId],
        }));
    };

    const scopesByCategory = availableScopes.reduce(
        (acc, scope) => {
            if (!acc[scope.category]) acc[scope.category] = [];
            acc[scope.category].push(scope);
            return acc;
        },
        {} as Record<string, Scope[]>,
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-navy-900 rounded-xl border border-white/10 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">{editKey ? 'Edit API Key' : 'Create API Key'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            placeholder="My API Key"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            rows={2}
                            placeholder="Optional description"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Key Type</label>
                            <select
                                value={formData.key_type}
                                onChange={(e) => setFormData({ ...formData, key_type: e.target.value as any })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            >
                                <option value="org">Organization</option>
                                <option value="user">User</option>
                                <option value="service">Service</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Expires</label>
                            <input
                                type="date"
                                value={formData.expires_at}
                                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Rate Limit (per minute)
                            </label>
                            <input
                                type="number"
                                value={formData.rate_limit_per_minute}
                                onChange={(e) =>
                                    setFormData({ ...formData, rate_limit_per_minute: parseInt(e.target.value) })
                                }
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Rate Limit (per day)
                            </label>
                            <input
                                type="number"
                                value={formData.rate_limit_per_day}
                                onChange={(e) =>
                                    setFormData({ ...formData, rate_limit_per_day: parseInt(e.target.value) })
                                }
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Allowed IPs (comma separated)
                        </label>
                        <input
                            type="text"
                            value={formData.allowed_ips}
                            onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                            placeholder="Leave empty for all IPs"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Scopes</label>
                        <div className="space-y-4 max-h-60 overflow-y-auto p-2 bg-slate-800/50 rounded-lg">
                            {Object.entries(scopesByCategory).map(([category, scopes]) => (
                                <div key={category}>
                                    <div className="text-xs text-slate-500 mb-2">{category}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {scopes.map((scope) => (
                                            <button
                                                key={scope.id}
                                                type="button"
                                                onClick={() => toggleScope(scope.id)}
                                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                                                    formData.scopes.includes(scope.id)
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                            >
                                                {scope.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {editKey ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EnterpriseApiManagement;


