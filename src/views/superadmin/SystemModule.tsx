/**
 * SystemModule - Enterprise System Administration
 *
 * Full enterprise system administration module with:
 * - Health Monitoring with real-time metrics and alerting
 * - Comprehensive Audit Logging with compliance support
 * - Feature Flags with A/B testing and targeting
 * - Integrations Hub with webhooks and connectors
 * - Security & Compliance management
 * - Configuration Management
 * - Analytics & Reporting
 * - Backup & Disaster Recovery
 * - API Key Management
 */

import { Activity, BarChart3, Flag, HardDrive, Key, Loader2, RefreshCw, Settings, Shield, Webhook } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { AuditLogViewer } from '../../components/Admin/AuditLogViewer';
import { AnalyticsPanel } from '../../components/SuperAdmin/AnalyticsPanel';
import { ApiManagementPanel } from '../../components/SuperAdmin/ApiManagementPanel';
import { BackupPanel } from '../../components/SuperAdmin/BackupPanel';
import { ConfigurationPanel } from '../../components/SuperAdmin/ConfigurationPanel';
import { FeatureFlagsPanel } from '../../components/SuperAdmin/FeatureFlagsPanel';
import { IntegrationsPanel } from '../../components/SuperAdmin/IntegrationsPanel';
import { SecurityPanel } from '../../components/SuperAdmin/SecurityPanel';
// Enterprise System Components
import {
    EnterpriseAnalyticsPanel,
    EnterpriseApiManagement,
    EnterpriseAuditLog,
    EnterpriseBackupPanel,
    EnterpriseConfigurationPanel,
    EnterpriseFeatureFlags,
    EnterpriseHealthMonitor,
    EnterpriseIntegrationsHub,
    EnterpriseSecurityPanel,
} from '../../components/SuperAdmin/system';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { SystemHealth } from '../../components/SystemHealth';
import { Api } from '../../services/api';

interface SystemModuleProps {
    initialTab?: string;
}

interface HealthData {
    api: { status: string; responseTime: number; version: string };
    database: { status: string; responseTime: number; type: string };
    ai: { status: string; providers: { openai: boolean; anthropic: boolean; groq: boolean } };
    system: {
        nodeVersion: string;
        environment: string;
        uptime: { seconds: number; formatted: string };
        memory: { used: number; total: number };
    };
    timestamp: string;
}

// Extended System Health View with real data
const SystemHealthView: React.FC = () => {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHealth = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await Api.getSystemHealth();
            setHealth(data);
        } catch (err) {
            console.error('Failed to fetch system health:', err);
            setError('Failed to fetch system health');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        // Refresh every 30 seconds
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !health) {
        return (
            <div className="p-6 flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        if (status === 'healthy' || status === 'online' || status === 'Connected') return 'bg-green-500';
        if (status === 'error' || status === 'offline') return 'bg-red-500';
        return 'bg-yellow-500';
    };

    const getStatusText = (status: string) => {
        if (status === 'healthy' || status === 'online') return 'text-green-400';
        if (status === 'error' || status === 'offline') return 'text-red-400';
        return 'text-yellow-400';
    };

    return (
        <div className="p-6 space-y-6">
            {/* Quick Status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <SystemHealth />
                </div>
                <button
                    onClick={fetchHealth}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Health Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div
                            className={`w-2 h-2 rounded-full ${getStatusColor(health?.api?.status || 'unknown')} animate-pulse`}
                        />
                        <span className="text-sm font-medium text-white">API Server</span>
                    </div>
                    <div className={`text-2xl font-bold ${getStatusText(health?.api?.status || 'unknown')}`}>
                        {health?.api?.status === 'healthy' ? 'Healthy' : health?.api?.status || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Response time: ~{health?.api?.responseTime || 0}ms
                    </div>
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div
                            className={`w-2 h-2 rounded-full ${getStatusColor(health?.database?.status || 'unknown')} animate-pulse`}
                        />
                        <span className="text-sm font-medium text-white">Database</span>
                    </div>
                    <div className={`text-2xl font-bold ${getStatusText(health?.database?.status || 'unknown')}`}>
                        {health?.database?.status === 'healthy' ? 'Connected' : health?.database?.status || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{health?.database?.type || 'Unknown'}</div>
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div
                            className={`w-2 h-2 rounded-full ${getStatusColor(health?.ai?.status || 'unknown')} animate-pulse`}
                        />
                        <span className="text-sm font-medium text-white">AI Services</span>
                    </div>
                    <div className={`text-2xl font-bold ${getStatusText(health?.ai?.status || 'unknown')}`}>
                        {health?.ai?.status === 'online'
                            ? 'Online'
                            : health?.ai?.status === 'no_keys'
                              ? 'No Keys'
                              : health?.ai?.status || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        {health?.ai?.providers
                            ? [
                                  health.ai.providers.openai && 'OpenAI',
                                  health.ai.providers.anthropic && 'Anthropic',
                                  health.ai.providers.groq && 'Groq',
                              ]
                                  .filter(Boolean)
                                  .join(', ') || 'No providers'
                            : 'Unknown'}
                    </div>
                </div>
            </div>

            {/* System Info */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                <h3 className="text-sm font-medium text-white mb-4">System Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div className="text-xs text-slate-500">Version</div>
                        <div className="text-sm text-white">{health?.api?.version || 'v2.5.0'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Environment</div>
                        <div className="text-sm text-white capitalize">{health?.system?.environment || 'Unknown'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Node.js</div>
                        <div className="text-sm text-white">{health?.system?.nodeVersion || 'Unknown'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Uptime</div>
                        <div className="text-sm text-white">{health?.system?.uptime?.formatted || 'Unknown'}</div>
                    </div>
                </div>
            </div>

            {/* Memory Usage */}
            {health?.system?.memory && (
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <h3 className="text-sm font-medium text-white mb-4">Memory Usage</h3>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <div className="h-2 bg-navy-950 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{
                                        width: `${Math.min(100, (health.system.memory.used / health.system.memory.total) * 100)}%`,
                                    }}
                                />
                            </div>
                        </div>
                        <div className="text-sm text-slate-400">
                            {health.system.memory.used}MB / {health.system.memory.total}MB
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const SystemModule: React.FC<SystemModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'health');

    const tabs: Tab[] = [
        { id: 'health', label: 'Health', icon: <Activity size={16} /> },
        { id: 'audit-log', label: 'Audit Log', icon: <Shield size={16} /> },
        { id: 'feature-flags', label: 'Feature Flags', icon: <Flag size={16} /> },
        { id: 'integrations', label: 'Integrations', icon: <Webhook size={16} /> },
        { id: 'security', label: 'Security', icon: <Shield size={16} /> },
        { id: 'configuration', label: 'Configuration', icon: <Settings size={16} /> },
        { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
        { id: 'backup', label: 'Backup', icon: <HardDrive size={16} /> },
        { id: 'api-keys', label: 'API Keys', icon: <Key size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'health':
                // Use enterprise health monitor for comprehensive monitoring
                return <EnterpriseHealthMonitor />;
            case 'audit-log':
                // Use enterprise audit log with compliance and export features
                return <EnterpriseAuditLog />;
            case 'feature-flags':
                // Use enterprise feature flags with A/B testing and targeting
                return <EnterpriseFeatureFlags />;
            case 'integrations':
                // Use enterprise integrations hub with connectors catalog and webhooks
                return <EnterpriseIntegrationsHub />;
            case 'security':
                // Use enterprise security panel with sessions, IP rules, compliance
                return <EnterpriseSecurityPanel />;
            case 'configuration':
                // Use enterprise configuration with categories, versioning, environments
                return <EnterpriseConfigurationPanel />;
            case 'analytics':
                // Use enterprise analytics with dashboards, custom reports, scheduling
                return <EnterpriseAnalyticsPanel />;
            case 'backup':
                // Use enterprise backup panel with DR testing
                return <EnterpriseBackupPanel />;
            case 'api-keys':
                // Use enterprise API management with docs and usage analytics
                return <EnterpriseApiManagement />;
            default:
                return null;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title="System"
            subtitle="Platform health, audit logs, and system configuration"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default SystemModule;
