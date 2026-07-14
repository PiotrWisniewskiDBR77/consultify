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

import { AICoreRuntimePanel } from '../components/AI/AICoreRuntimePanel';
import { PromptOsRuntimeSummaryPanel } from '../components/AI/PromptOsRuntimeSummaryPanel';
import { InfoButton } from '../../../components/shared/InfoButton';
import { ModelRegistryHub } from '../../../components/SuperAdmin/ModelRegistry';
import { useHelpSidePanel } from '../../../contexts/HelpContext';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { CostAnalyticsTab } from './Analytics/CostAnalyticsTab';
import { CustomReportsTab } from './Analytics/CustomReportsTab';
import { LLMObservatoryTab } from './Analytics/LLMObservatoryTab';
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
import { PolicyEnforcementTab } from './Policy/PolicyEnforcementTab';
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
      { id: 'ai-core-runtime', label: 'AI core runtime', icon: <Code size={16} /> },
      { id: 'prompt-os-runtime', label: 'Prompt OS runtime', icon: <Code size={16} /> },
      { id: 'market-inbox', label: 'Market Inbox', icon: <Database size={16} /> },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart2 size={20} />,
    description: 'Usage, costs, performance metrics, and reports',
    subTabs: [
      { id: 'llm-observatory', label: 'LLM Observatory', icon: <BarChart2 size={16} /> },
      { id: 'usage-analytics', label: 'Usage Analytics', icon: <TrendingUp size={16} /> },
      { id: 'cost-analytics', label: 'Cost Analytics', icon: <DollarSign size={16} /> },
      { id: 'pricing-registry', label: 'Pricing Registry', icon: <DollarSign size={16} /> },
      { id: 'performance-metrics', label: 'Performance Metrics', icon: <Gauge size={16} /> },
      { id: 'custom-reports', label: 'Custom Reports', icon: <FileBarChart size={16} /> },
    ],
  },
  {
    id: 'policy',
    label: 'Policy Plane',
    icon: <ShieldCheck size={20} />,
    description: 'Enforcement, drift detection, kill-switches, and propagation state',
    subTabs: [
      { id: 'enforcement-state', label: 'Enforcement State', icon: <ShieldCheck size={16} /> },
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getObjectPayload = (value: unknown): unknown => {
  let current = value;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isRecord(current) || !('data' in current)) break;
    current = current.data;
  }

  return current;
};

const toBool = (value: unknown): boolean => value === true || value === 'true' || value === 1;

const asText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const AIPlatformModule: React.FC<AIPlatformModuleProps> = ({
  initialTab,
  initialSubTab,
}) => {
  const [activeMainTab, setActiveMainTab] = useState(initialTab || 'configuration');
  const [activeSubTab, setActiveSubTab] = useState<string | null>(initialSubTab || null);
  const [internetSignal, setInternetSignal] = useState<{
    loading: boolean;
    error: string | null;
    internetEnabled: boolean;
    tavilyConfigured: boolean;
    webSearchAvailable: boolean;
    searchProvider: string | null;
  }>({
    loading: true,
    error: null,
    internetEnabled: false,
    tavilyConfigured: false,
    webSearchAvailable: false,
    searchProvider: null,
  });
  const { setHelpDocumentIdOverride } = useHelpSidePanel();

  // Get current main tab configuration
  const currentMainTab = AI_PLATFORM_TABS.find((tab) => tab.id === activeMainTab);

  useEffect(() => {
    if (initialTab) setActiveMainTab(initialTab);
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialTab, initialSubTab]);

  // Set default sub-tab when main tab changes
  useEffect(() => {
    if (currentMainTab && currentMainTab.subTabs.length > 0) {
      if (!activeSubTab || !currentMainTab.subTabs.find((st) => st.id === activeSubTab)) {
        setActiveSubTab(currentMainTab.subTabs[0].id);
      }
    }
  }, [activeMainTab, currentMainTab, activeSubTab]);

  useEffect(() => {
    const mapping: Record<string, string> = {
      'configuration/llm-providers': 'superadmin_ai_configuration_llm_providers',
      'configuration/model-tiers': 'superadmin_ai_configuration_model_tiers',
      'configuration/routing-rules': 'superadmin_ai_configuration_routing_rules',
      'configuration/purposes-assignments': 'superadmin_ai_configuration_purposes_assignments',
      'configuration/org-ai-policy': 'superadmin_ai_configuration_org_policy',
      'configuration/ai-governance': 'superadmin_ai_configuration_governance',
      'configuration/global-settings': 'superadmin_ai_configuration_global_settings',
      'development/prompts-library': 'superadmin_ai_development_prompts_library',
      'development/prompt-builder': 'superadmin_ai_development_prompt_builder',
      'development/experiments': 'superadmin_ai_development_experiments',
      'development/model-registry': 'superadmin_ai_development_model_registry',
      'operations/mission-control': 'superadmin_ai_operations_mission_control',
      'operations/health-monitoring': 'superadmin_ai_operations_health',
      'operations/performance-dashboard': 'superadmin_ai_operations_performance',
      'operations/sla-management': 'superadmin_ai_operations_sla',
      'operations/ai-core-runtime': 'superadmin_ai_operations',
      'operations/prompt-os-runtime': 'superadmin_ai_operations',
      'operations/market-inbox': 'superadmin_ai_operations_market_inbox',
      'analytics/llm-observatory': 'superadmin_ai_analytics_llm_observatory',
      'analytics/usage-analytics': 'superadmin_ai_analytics_usage',
      'analytics/cost-analytics': 'superadmin_ai_analytics_cost',
      'analytics/pricing-registry': 'superadmin_ai_analytics_pricing_registry',
      'analytics/performance-metrics': 'superadmin_ai_analytics_performance_metrics',
      'analytics/custom-reports': 'superadmin_ai_analytics_custom_reports',
      'policy/enforcement-state': 'superadmin_ai_policy_plane',
      'security/api-keys': 'superadmin_ai_security_api_keys',
      'security/access-control': 'superadmin_ai_security_access_control',
      'security/audit-logs': 'superadmin_ai_security_audit_logs',
      'security/compliance': 'superadmin_ai_security_compliance',
      'knowledge/knowledge-base': 'superadmin_ai_knowledge_base',
      'knowledge/documents-rag': 'superadmin_ai_knowledge_documents_rag',
      'knowledge/strategic-directions': 'superadmin_ai_knowledge_strategic_directions',
    };
    const key = `${activeMainTab}/${activeSubTab ?? ''}`;
    const mainFallback: Record<string, string> = {
      configuration: 'superadmin_ai_configuration',
      development: 'superadmin_ai_development',
      operations: 'superadmin_ai_operations',
      analytics: 'superadmin_ai_analytics',
      policy: 'superadmin_ai_policy_plane',
      security: 'superadmin_ai_security',
      knowledge: 'superadmin_ai_intelligence',
    };
    setHelpDocumentIdOverride(
      mapping[key] || mainFallback[activeMainTab] || 'superadmin_ai_configuration'
    );
    return () => setHelpDocumentIdOverride(null);
  }, [activeMainTab, activeSubTab, setHelpDocumentIdOverride]);

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
      case 'operations/ai-core-runtime':
        return <AICoreRuntimePanel />;
      case 'operations/prompt-os-runtime':
        return <PromptOsRuntimeSummaryPanel />;
      case 'operations/market-inbox':
        return <MarketInboxTab />;

      // Analytics
      case 'analytics/llm-observatory':
        return <LLMObservatoryTab />;
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

      // Policy plane
      case 'policy/enforcement-state':
        return <PolicyEnforcementTab />;

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
          <div className="flex items-center justify-center h-full text-slate-600">
            Select a tab to view content
          </div>
        );
    }
  };

  // Get help card ID based on active tabs
  const getHelpCardId = () => {
    const key = `${activeMainTab}/${activeSubTab || ''}`.replace(/\/$/, '');

    const byKey: Record<string, string> = {
      // Configuration (matches SuperAdmin IA + existing doc IDs)
      'configuration/llm-providers': 'superadmin-llm-management',
      'configuration/model-tiers': 'superadmin-ai-model-tiers',
      'configuration/routing-rules': 'superadmin-ai-routing-rules',
      'configuration/purposes-assignments': 'superadmin-ai-purposes-assignments',
      'configuration/org-ai-policy': 'superadmin-ai-org-ai-policy',
      'configuration/ai-governance': 'superadmin-ai-governance',
      'configuration/global-settings': 'superadmin-ai-global-settings',

      // Development
      'development/prompts-library': 'superadmin-ai-prompts-library',
      'development/prompt-builder': 'superadmin-ai-intelligence',
      'development/experiments': 'superadmin-ai-ab-testing',
      'development/model-registry': 'superadmin-ai-model-registry',
      'operations/prompt-os-runtime': 'superadmin-ai-operations',
      'analytics/llm-observatory': 'superadmin-ai-operations',
      'policy/enforcement-state': 'superadmin-ai-governance',

      // Security (reuse existing Settings docs where applicable)
      'security/api-keys': 'settings-api-keys',

      // Knowledge
      'knowledge/knowledge-base': 'admin-knowledge',
      'knowledge/documents-rag': 'superadmin-ai-knowledge',
      'knowledge/strategic-directions': 'superadmin-ai-knowledge',
    };

    const byMainTab: Record<string, string> = {
      configuration: 'superadmin-ai-infrastructure',
      development: 'superadmin-ai-development',
      operations: 'superadmin-ai-operations',
      analytics: 'superadmin-ai-operations',
      policy: 'superadmin-ai-governance',
      security: 'superadmin-security',
      knowledge: 'superadmin-ai-knowledge',
    };

    return byKey[key] || byMainTab[activeMainTab] || 'superadmin-ai-infrastructure';
  };

  // Internet status signal (green/red) in SuperAdmin header.
  useEffect(() => {
    let mounted = true;
    Api.getAIGovernancePolicy()
      .then((json: unknown) => {
        if (!mounted) return;
        const payload = getObjectPayload(json);

        if (!isRecord(payload) || !isRecord(payload.summary) || !isRecord(payload.runtime)) {
          throw new Error('Internet policy response was malformed');
        }

        const summary = payload.summary;
        const runtime = payload.runtime;

        setInternetSignal({
          loading: false,
          error: null,
          internetEnabled: toBool(summary.internetEnabled),
          tavilyConfigured: toBool(runtime.tavilyConfigured),
          webSearchAvailable: toBool(runtime.webSearchAvailable),
          searchProvider: asText(runtime.provider),
        });
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setInternetSignal((prev) => ({
          ...prev,
          loading: false,
          error: normalizeApiErrorMessage(error, 'Unable to load internet policy'),
        }));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const internetDotClass = internetSignal.loading
    ? 'bg-slate-300 dark:bg-slate-600'
    : internetSignal.error
      ? 'bg-amber-500'
      : internetSignal.webSearchAvailable
        ? 'bg-emerald-500'
        : 'bg-danger-500';

  const internetLabel = internetSignal.loading
    ? 'Internet: checking'
    : internetSignal.error
      ? 'Internet: UNKNOWN'
      : internetSignal.webSearchAvailable
        ? 'Internet: ON'
        : internetSignal.internetEnabled && !internetSignal.tavilyConfigured
          ? 'Internet: KEY MISSING'
          : 'Internet: OFF';

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
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950"
              title={
                internetSignal.loading
                  ? 'Checking internet & web search configuration'
                  : internetSignal.error
                    ? `Internet policy status unavailable: ${internetSignal.error}`
                    : `Policy: ${internetSignal.internetEnabled ? 'enabled' : 'disabled'}; Provider: ${
                        internetSignal.searchProvider || 'unavailable'
                      }; Tavily key: ${internetSignal.tavilyConfigured ? 'configured' : 'missing'}`
              }
            >
              <span className={`w-2 h-2 rounded-full ${internetDotClass}`} />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {internetLabel}
              </span>
            </div>
            <InfoButton cardId={getHelpCardId()} position="header-inline" size="md" />
          </div>
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
