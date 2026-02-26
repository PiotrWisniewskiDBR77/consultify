/**
 * AIPlatformModule - Unified AI Platform Management
 *
 * New structure with 6 main tabs:
 * 1. Configuration - LLM providers, model tiers, routing, settings
 * 2. Development - Prompts, builder, experiments, model registry
 * 3. Operations - Mission control, health, performance, SLA
 * 4. Analytics - Usage, costs, metrics, custom reports
 * 5. Security - API keys, access control, audit, compliance
 * 6. Knowledge - Knowledge base, documents (RAG), strategic directions
 */

import {
  Activity,
  BarChart2,
  BookOpen,
  Code,
  Cpu,
  Database,
  DollarSign,
  FileBarChart,
  FileCheck,
  FileSearch,
  FileText,
  FlaskConical,
  Gauge,
  Globe,
  HeartPulse,
  Key,
  Layers,
  Lock,
  Radar,
  Route,
  Settings,
  Shield,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { InfoButton } from '../../../components/shared/InfoButton';
import { ModelRegistryHub } from '../../../components/SuperAdmin/ModelRegistry';
import { CostAnalyticsTab } from './Analytics/CostAnalyticsTab';
import { CustomReportsTab } from './Analytics/CustomReportsTab';
import { PerformanceMetricsTab } from './Analytics/PerformanceMetricsTab';
import { PricingRegistryTab } from './Analytics/PricingRegistryTab';
// Analytics Tab Components
import { UsageAnalyticsTab } from './Analytics/UsageAnalyticsTab';
import { AIGovernanceTab } from './Configuration/AIGovernanceTab';
import { GlobalSettingsTab } from './Configuration/GlobalSettingsTab';
// Configuration Tab Components
import { LLMProvidersTab } from './Configuration/LLMProvidersTab';
import { ModelTiersTab } from './Configuration/ModelTiersTab';
import { OrgAIPolicyTab } from './Configuration/OrgAIPolicyTab';
import { PurposeAssignmentsTab } from './Configuration/PurposeAssignmentsTab';
import { RoutingRulesTab } from './Configuration/RoutingRulesTab';
import { ExperimentsTab } from './Development/ExperimentsTab';
import { ModelRegistryTab } from './Development/ModelRegistryTab';
import { PromptBuilderTab } from './Development/PromptBuilderTab';
// Development Tab Components
import { PromptsLibraryTab } from './Development/PromptsLibraryTab';
import { DocumentsRAGTab } from './Knowledge/DocumentsRAGTab';
// Knowledge Tab Components
import { KnowledgeBaseTab } from './Knowledge/KnowledgeBaseTab';
import { StrategicDirectionsTab } from './Knowledge/StrategicDirectionsTab';
import { HealthMonitoringTab } from './Operations/HealthMonitoringTab';
import { MarketInboxTab } from './Operations/MarketInboxTab';
// Operations Tab Components
import { MissionControlTab } from './Operations/MissionControlTab';
import { PerformanceDashboardTab } from './Operations/PerformanceDashboardTab';
import { SLAManagementTab } from './Operations/SLAManagementTab';
import { AccessControlTab } from './Security/AccessControlTab';
// Security Tab Components
import { APIKeysTab } from './Security/APIKeysTab';
import { AuditLogsTab } from './Security/AuditLogsTab';
import { ComplianceTab } from './Security/ComplianceTab';

// Types
interface SubTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

interface MainTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  subTabs: SubTab[];
}

// Tab configuration
const AI_PLATFORM_TABS: MainTab[] = [
  {
    id: 'configuration',
    label: 'Configuration',
    icon: <Settings size={20} />,
    description: 'LLM providers, model tiers, routing, and global settings',
    subTabs: [
      { id: 'llm-providers', label: 'LLM Providers', icon: <Cpu size={16} /> },
      { id: 'model-tiers', label: 'Model Tiers', icon: <Layers size={16} /> },
      { id: 'routing-rules', label: 'Routing Rules', icon: <Route size={16} /> },
      { id: 'purposes-assignments', label: 'Purposes & Assignments', icon: <Target size={16} /> },
      { id: 'org-ai-policy', label: 'Org AI Policy', icon: <Globe size={16} /> },
      { id: 'ai-governance', label: 'AI Governance', icon: <Shield size={16} /> },
      { id: 'global-settings', label: 'Global Settings', icon: <Settings size={16} /> },
    ],
  },
  {
    id: 'development',
    label: 'Development',
    icon: <Code size={20} />,
    description: 'Prompts, experiments, and model management',
    subTabs: [
      { id: 'prompts-library', label: 'Prompts Library', icon: <FileText size={16} /> },
      { id: 'prompt-builder', label: 'Prompt Builder', icon: <Code size={16} /> },
      { id: 'experiments', label: 'Experiments', icon: <FlaskConical size={16} /> },
      { id: 'model-registry', label: 'Model Registry', icon: <Database size={16} /> },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: <Activity size={20} />,
    description: 'Mission control, health, performance, and SLA',
    subTabs: [
      { id: 'mission-control', label: 'Mission Control', icon: <Radar size={16} /> },
      { id: 'health-monitoring', label: 'Health Monitoring', icon: <HeartPulse size={16} /> },
      { id: 'performance-dashboard', label: 'Performance', icon: <Activity size={16} /> },
      { id: 'sla-management', label: 'SLA Management', icon: <Shield size={16} /> },
      { id: 'market-inbox', label: 'Market Inbox', icon: <Database size={16} /> },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart2 size={20} />,
    description: 'Usage, costs, performance metrics, and reports',
    subTabs: [
      { id: 'usage-analytics', label: 'Usage Analytics', icon: <TrendingUp size={16} /> },
      { id: 'cost-analytics', label: 'Cost Analytics', icon: <DollarSign size={16} /> },
      { id: 'pricing-registry', label: 'Pricing Registry', icon: <DollarSign size={16} /> },
      { id: 'performance-metrics', label: 'Performance Metrics', icon: <Gauge size={16} /> },
      { id: 'custom-reports', label: 'Custom Reports', icon: <FileBarChart size={16} /> },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: <Shield size={20} />,
    description: 'API keys, access control, audit logs, and compliance',
    subTabs: [
      { id: 'api-keys', label: 'API Keys', icon: <Key size={16} /> },
      { id: 'access-control', label: 'Access Control', icon: <Lock size={16} /> },
      { id: 'audit-logs', label: 'Audit Logs', icon: <FileSearch size={16} /> },
      { id: 'compliance', label: 'Compliance', icon: <ShieldCheck size={16} /> },
    ],
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: <BookOpen size={20} />,
    description: 'Knowledge base, documents, and strategic directions',
    subTabs: [
      { id: 'knowledge-base', label: 'Knowledge Base', icon: <BookOpen size={16} /> },
      { id: 'documents-rag', label: 'Documents (RAG)', icon: <FileText size={16} /> },
      { id: 'strategic-directions', label: 'Strategic Directions', icon: <Target size={16} /> },
    ],
  },
];

interface AIPlatformModuleProps {
  initialTab?: string;
  initialSubTab?: string;
}

export const AIPlatformModule: React.FC<AIPlatformModuleProps> = ({
  initialTab,
  initialSubTab,
}) => {
  const [activeMainTab, setActiveMainTab] = useState(initialTab || 'configuration');
  const [activeSubTab, setActiveSubTab] = useState<string | null>(initialSubTab || null);

  // Get current main tab configuration
  const currentMainTab = AI_PLATFORM_TABS.find((tab) => tab.id === activeMainTab);

  // Set default sub-tab when main tab changes
  useEffect(() => {
    if (currentMainTab && currentMainTab.subTabs.length > 0) {
      if (!activeSubTab || !currentMainTab.subTabs.find((st) => st.id === activeSubTab)) {
        setActiveSubTab(currentMainTab.subTabs[0].id);
      }
    }
  }, [activeMainTab, currentMainTab, activeSubTab]);

  // Handle main tab change
  const handleMainTabChange = (tabId: string) => {
    setActiveMainTab(tabId);
    const newTab = AI_PLATFORM_TABS.find((t) => t.id === tabId);
    if (newTab && newTab.subTabs.length > 0) {
      setActiveSubTab(newTab.subTabs[0].id);
    }
  };

  // Render content based on active tabs
  const renderContent = () => {
    const key = `${activeMainTab}/${activeSubTab}`;

    switch (key) {
      // Configuration
      case 'configuration/llm-providers':
        return <LLMProvidersTab />;
      case 'configuration/model-tiers':
        return <ModelTiersTab />;
      case 'configuration/routing-rules':
        return <RoutingRulesTab />;
      case 'configuration/purposes-assignments':
        return <PurposeAssignmentsTab />;
      case 'configuration/org-ai-policy':
        return <OrgAIPolicyTab />;
      case 'configuration/ai-governance':
        return <AIGovernanceTab />;
      case 'configuration/global-settings':
        return <GlobalSettingsTab />;

      // Development
      case 'development/prompts-library':
        return <PromptsLibraryTab />;
      case 'development/prompt-builder':
        return <PromptBuilderTab />;
      case 'development/experiments':
        return <ExperimentsTab />;
      case 'development/model-registry':
        return <ModelRegistryHub />;

      // Operations
      case 'operations/mission-control':
        return <MissionControlTab />;
      case 'operations/health-monitoring':
        return <HealthMonitoringTab />;
      case 'operations/performance-dashboard':
        return <PerformanceDashboardTab />;
      case 'operations/sla-management':
        return <SLAManagementTab />;
      case 'operations/market-inbox':
        return <MarketInboxTab />;

      // Analytics
      case 'analytics/usage-analytics':
        return <UsageAnalyticsTab />;
      case 'analytics/cost-analytics':
        return <CostAnalyticsTab />;
      case 'analytics/pricing-registry':
        return <PricingRegistryTab />;
      case 'analytics/performance-metrics':
        return <PerformanceMetricsTab />;
      case 'analytics/custom-reports':
        return <CustomReportsTab />;

      // Security
      case 'security/api-keys':
        return <APIKeysTab />;
      case 'security/access-control':
        return <AccessControlTab />;
      case 'security/audit-logs':
        return <AuditLogsTab />;
      case 'security/compliance':
        return <ComplianceTab />;

      // Knowledge
      case 'knowledge/knowledge-base':
        return <KnowledgeBaseTab />;
      case 'knowledge/documents-rag':
        return <DocumentsRAGTab />;
      case 'knowledge/strategic-directions':
        return <StrategicDirectionsTab />;

      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            Select a tab to view content
          </div>
        );
    }
  };

  // Get help card ID based on active tabs
  const getHelpCardId = () => {
    return `superadmin-ai-${activeMainTab}-${activeSubTab || 'overview'}`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800">
        {/* Title row */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">AI Platform</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {currentMainTab?.description || 'Unified AI management and configuration'}
            </p>
          </div>
          <InfoButton cardId={getHelpCardId()} />
        </div>

        {/* Main Tabs */}
        <div className="px-6 flex gap-1 overflow-x-auto">
          {AI_PLATFORM_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleMainTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                border-b-2 transition-all duration-200
                ${
                  activeMainTab === tab.id
                    ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                }
              `}
            >
              <span className={activeMainTab === tab.id ? 'text-indigo-500' : ''}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      {currentMainTab && currentMainTab.subTabs.length > 0 && (
        <div className="shrink-0 px-6 py-2 bg-slate-100 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-800 flex gap-1 overflow-x-auto">
          {currentMainTab.subTabs.map((subTab) => (
            <button
              key={subTab.id}
              onClick={() => setActiveSubTab(subTab.id)}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap
                rounded-lg transition-all duration-200
                ${
                  activeSubTab === subTab.id
                    ? 'text-slate-900 dark:text-white bg-white dark:bg-navy-800 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-white/50 dark:hover:bg-navy-800/50'
                }
              `}
            >
              {subTab.icon}
              {subTab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">{renderContent()}</div>
    </div>
  );
};

export default AIPlatformModule;
