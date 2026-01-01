/**
 * SystemModule - System Administration
 * 
 * Tabs: Health | Audit Log | Feature Flags | Integrations
 */

import React, { useState } from 'react';
import { Activity, Shield, Flag, Webhook } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { SystemHealth } from '../../components/SystemHealth';
import { AuditLogViewer } from '../../components/Admin/AuditLogViewer';
import { FeatureFlagsPanel } from '../../components/SuperAdmin/FeatureFlagsPanel';
import { IntegrationsPanel } from '../../components/SuperAdmin/IntegrationsPanel';

interface SystemModuleProps {
    initialTab?: string;
}

// Extended System Health View with more details
const SystemHealthView: React.FC = () => {
    return (
        <div className="p-6 space-y-6">
            {/* Quick Status */}
            <div className="flex items-center gap-4">
                <SystemHealth />
            </div>

            {/* Health Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-medium text-white">API Server</span>
                    </div>
                    <div className="text-2xl font-bold text-green-400">Healthy</div>
                    <div className="text-xs text-slate-500 mt-1">Response time: ~45ms</div>
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-medium text-white">Database</span>
                    </div>
                    <div className="text-2xl font-bold text-green-400">Connected</div>
                    <div className="text-xs text-slate-500 mt-1">PostgreSQL</div>
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-medium text-white">AI Services</span>
                    </div>
                    <div className="text-2xl font-bold text-green-400">Online</div>
                    <div className="text-xs text-slate-500 mt-1">All providers operational</div>
                </div>
            </div>

            {/* System Info */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                <h3 className="text-sm font-medium text-white mb-4">System Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div className="text-xs text-slate-500">Version</div>
                        <div className="text-sm text-white">v2.5.0</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Environment</div>
                        <div className="text-sm text-white">Production</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Node.js</div>
                        <div className="text-sm text-white">v20.x</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Uptime</div>
                        <div className="text-sm text-white">99.9%</div>
                    </div>
                </div>
            </div>
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
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'health':
                return <SystemHealthView />;
            case 'audit-log':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AuditLogViewer />
                    </div>
                );
            case 'feature-flags':
                return <FeatureFlagsPanel />;
            case 'integrations':
                return <IntegrationsPanel />;
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

