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
  BellRing,
  FileCheck,
  Flag,
  HardDrive,
  Key,
  Settings,
  Shield,
  ShieldAlert,
  TrendingUp,
  Webhook,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import {
  applyDashboardDeepLinkToLocation,
  type DashboardDeepLink,
  type DashboardTab,
  readDashboardDeepLinkFromLocation,
} from '../../services/presentationGovernanceDeepLinks';
import { APIManagementView } from './APIManagementView';
import PresentationBenchmarkTrendView from './PresentationBenchmarkTrendView';
import PresentationGovernanceAlertSubscriptionsView from './PresentationGovernanceAlertSubscriptionsView';
import PresentationGovernanceWatchlistView from './PresentationGovernanceWatchlistView';
import PresentationOperationsHealthView from './PresentationOperationsHealthView';
import PlatformOperationsView from './PlatformOperationsView';
import PresentationTemplateGovernanceView from './PresentationTemplateGovernanceView';

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
  'presentation-watchlist': 'superadmin-system-presentation-watchlist',
  'presentation-operations-health': 'superadmin-system-presentation-operations-health',
  'presentation-benchmark-trend': 'superadmin-system-presentation-benchmark-trend',
  'presentation-alert-subscriptions': 'superadmin-system-presentation-alert-subscriptions',
  'presentation-template-governance': 'superadmin-system-presentation-template-governance',
};

// Set of tab IDs we know how to render in this module. Deep-link tab values
// outside this set are silently ignored on first mount so a stale share
// link cannot land the user on a blank tab body.
const RENDERABLE_TABS: ReadonlySet<string> = new Set<string>([
  'health',
  'audit-log',
  'feature-flags',
  'integrations',
  'security',
  'configuration',
  'analytics',
  'backup',
  'api-keys',
  'presentation-watchlist',
  'presentation-operations-health',
  'presentation-benchmark-trend',
  'presentation-alert-subscriptions',
  'presentation-template-governance',
  'platform-operations',
]);

// Tab IDs that participate in the cross-tab deep-link contract. We only
// write the URL when transitioning between these tabs (so opening
// "Integrations" from "Watchlist" doesn't leak deep-link params into
// unrelated surfaces).
const DEEP_LINK_TABS: ReadonlySet<DashboardTab> = new Set<DashboardTab>([
  'presentation-telemetry',
  'presentation-watchlist',
  'presentation-operations-health',
  'presentation-alert-subscriptions',
]);

function isDeepLinkTab(tab: string): tab is DashboardTab {
  return DEEP_LINK_TABS.has(tab as DashboardTab);
}

export const SystemModule: React.FC<SystemModuleProps> = ({ initialTab }) => {
  // Deep-link state on first mount — the spec calls this the source of
  // truth for the very first render, then user actions take over.
  const initialDeepLinkRef = useRef<DashboardDeepLink>(readDashboardDeepLinkFromLocation());
  const [deepLink, setDeepLink] = useState<DashboardDeepLink>(initialDeepLinkRef.current);

  const [activeTab, setActiveTab] = useState<string>(() => {
    const fromUrl = initialDeepLinkRef.current.tab;
    if (fromUrl && RENDERABLE_TABS.has(fromUrl)) return fromUrl;
    return initialTab || 'integrations';
  });
  const { setHelpDocumentIdOverride } = useHelpSidePanel();

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = useCallback(
    (nextTab: string) => {
      setActiveTab(nextTab);
      // Only write the URL for tabs that participate in the deep-link
      // contract. Other tabs reset deep-link params to keep the URL honest
      // about which surface is currently visible.
      if (isDeepLinkTab(nextTab)) {
        const next: DashboardDeepLink = {
          ...deepLink,
          tab: nextTab,
        };
        setDeepLink(next);
        applyDashboardDeepLinkToLocation(next, { replace: true });
      } else {
        const cleared: DashboardDeepLink = {
          tab: null,
          deckId: null,
          slo: null,
          presetId: null,
          windowDays: null,
        };
        setDeepLink(cleared);
        applyDashboardDeepLinkToLocation(cleared, { replace: true });
      }
    },
    [deepLink]
  );

  // popstate keeps the active tab in sync with browser back/forward and
  // any external history mutation. We read the URL fresh and apply it
  // without writing it back, to avoid an infinite loop.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const next = readDashboardDeepLinkFromLocation();
      setDeepLink(next);
      if (next.tab && RENDERABLE_TABS.has(next.tab)) {
        setActiveTab(next.tab);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Children receive the initial deep-link snapshot so their once-on-mount
  // consumption (highlight, preselect, prefill) fires from a stable value.
  // Tab-driven re-renders inside SystemModule do not retrigger consumption
  // because each child uses its own internal "consumed" guard.
  const presentationDeepLink = useMemo<DashboardDeepLink>(
    () => ({
      tab: deepLink.tab,
      deckId: deepLink.deckId,
      slo: deepLink.slo,
      presetId: deepLink.presetId,
      windowDays: deepLink.windowDays,
    }),
    [deepLink]
  );

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
      'presentation-watchlist': 'superadmin_system_presentation_watchlist',
      'presentation-operations-health': 'superadmin_system_presentation_operations_health',
      'presentation-benchmark-trend': 'superadmin_system_presentation_benchmark_trend',
      'presentation-alert-subscriptions': 'superadmin_system_presentation_alert_subscriptions',
      'presentation-template-governance': 'superadmin_system_presentation_template_governance',
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
    { id: 'platform-operations', label: 'Operacje platformowe', icon: <ShieldAlert size={16} /> },
    {
      id: 'presentation-watchlist',
      label: 'Governance Watchlist',
      icon: <ShieldAlert size={16} />,
    },
    {
      id: 'presentation-operations-health',
      label: 'Operations Health',
      icon: <Activity size={16} />,
    },
    {
      id: 'presentation-benchmark-trend',
      label: 'Benchmark Trend',
      icon: <TrendingUp size={16} />,
    },
    {
      id: 'presentation-alert-subscriptions',
      label: 'Alert Subscriptions',
      icon: <BellRing size={16} />,
    },
    {
      id: 'presentation-template-governance',
      label: 'Template Governance',
      icon: <FileCheck size={16} />,
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'health':
        // Use enterprise health monitor for comprehensive monitoring
        return <EnterpriseHealthMonitor />;
      case 'platform-operations':
        return <PlatformOperationsView />;
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
      case 'presentation-watchlist':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PresentationGovernanceWatchlistView deepLink={presentationDeepLink} />
          </div>
        );
      case 'presentation-operations-health':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PresentationOperationsHealthView deepLink={presentationDeepLink} />
          </div>
        );
      case 'presentation-benchmark-trend':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PresentationBenchmarkTrendView />
          </div>
        );
      case 'presentation-alert-subscriptions':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PresentationGovernanceAlertSubscriptionsView />
          </div>
        );
      case 'presentation-template-governance':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PresentationTemplateGovernanceView />
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
      onTabChange={handleTabChange}
      title="Connector Ops"
      subtitle="Operate integrations, platform health, observability, and system configuration"
      actions={<InfoButton cardId={helpContentId} />}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default SystemModule;
