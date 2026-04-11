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

import {
  Activity,
  BarChart3,
  Flag,
  HardDrive,
  Key,
  Settings,
  Shield,
  Webhook,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { InfoButton } from '../../components/shared/InfoButton';
import {
  EnterpriseAnalyticsPanel,
  EnterpriseAuditLog,
  EnterpriseBackupPanel,
  EnterpriseConfigurationPanel,
  EnterpriseFeatureFlags,
  EnterpriseHealthMonitor,
  EnterpriseIntegrationsHub,
  EnterpriseSecurityPanel,
} from '../../components/SuperAdmin/system';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { useHelpSidePanel } from '../../contexts/HelpContext';
import { APIManagementView } from './APIManagementView';

interface SystemModuleProps {
  initialTab?: string;
}

// Map tab IDs to help content IDs
const TAB_TO_HELP_MAP: Record<string, string> = {
  health: 'superadmin-system-health',
  'audit-log': 'superadmin-system-audit',
  'feature-flags': 'superadmin-system-flags',
  integrations: 'superadmin-system-integrations',
  security: 'superadmin-system-security',
  configuration: 'superadmin-system-configuration',
  analytics: 'superadmin-system-analytics',
  backup: 'superadmin-system-backup',
  'api-keys': 'superadmin-system-api-keys',
};

export const SystemModule: React.FC<SystemModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'integrations');
  const { setHelpDocumentIdOverride } = useHelpSidePanel();

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const helpContentId = TAB_TO_HELP_MAP[activeTab] || 'superadmin-system';

  useEffect(() => {
    const mapping: Record<string, string> = {
      health: 'superadmin_system_health',
      'audit-log': 'superadmin_system_audit',
      'feature-flags': 'superadmin_system_flags',
      integrations: 'superadmin_system_integrations',
      security: 'superadmin_system_security',
      configuration: 'superadmin_system_configuration',
      analytics: 'superadmin_system_analytics',
      backup: 'superadmin_system_backup',
      'api-keys': 'superadmin_system_api_keys',
    };
    setHelpDocumentIdOverride(mapping[activeTab] || 'superadmin_system');
    return () => setHelpDocumentIdOverride(null);
  }, [activeTab, setHelpDocumentIdOverride]);

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
        // Platform-level API keys (SuperAdmin) live here
        return (
          <div className="p-6 overflow-y-auto h-full">
            <APIManagementView />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Connector Ops"
      subtitle="Operate integrations, platform health, observability, and system configuration"
      actions={<InfoButton cardId={helpContentId} />}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default SystemModule;
