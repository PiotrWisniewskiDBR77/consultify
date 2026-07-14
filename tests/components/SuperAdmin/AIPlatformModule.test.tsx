/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { AIPlatformModule } from '../../../src/views/superadmin/AIPlatformModule/AIPlatformModule';
import { Api } from '../../../src/services/api';

vi.mock('../../../src/services/api', () => ({
  Api: {
    getAIGovernancePolicy: vi.fn(),
  },
}));

vi.mock('../../../src/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setHelpDocumentIdOverride: vi.fn(),
  }),
}));

vi.mock('../../../src/components/shared/InfoButton', () => ({
  InfoButton: () => <div>InfoButton</div>,
}));

vi.mock('../../../src/components/SuperAdmin/ModelRegistry', () => ({
  ModelRegistryHub: () => <div>Model Registry Hub</div>,
}));

vi.mock('../../../src/views/superadmin/components/AI/AICoreRuntimePanel', () => ({
  AICoreRuntimePanel: () => <div>AI core runtime panel</div>,
}));

vi.mock('../../../src/views/superadmin/components/AI/PromptOsRuntimeSummaryPanel', () => ({
  PromptOsRuntimeSummaryPanel: () => <div>Prompt OS runtime panel</div>,
}));

vi.mock('../../../src/views/superadmin/AIPlatformModule/Analytics/CostAnalyticsTab', () => ({
  CostAnalyticsTab: () => <div>Cost Analytics</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Analytics/CustomReportsTab', () => ({
  CustomReportsTab: () => <div>Custom Reports</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Analytics/LLMObservatoryTab', () => ({
  LLMObservatoryTab: () => <div>LLM Observatory</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Analytics/PerformanceMetricsTab', () => ({
  PerformanceMetricsTab: () => <div>Performance Metrics</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Analytics/PricingRegistryTab', () => ({
  PricingRegistryTab: () => <div>Pricing Registry</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Analytics/UsageAnalyticsTab', () => ({
  UsageAnalyticsTab: () => <div>Usage Analytics</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Configuration/AIGovernanceTab', () => ({
  AIGovernanceTab: () => <div>AI Governance</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Configuration/GlobalSettingsTab', () => ({
  GlobalSettingsTab: () => <div>Global Settings</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Configuration/LLMProvidersTab', () => ({
  LLMProvidersTab: () => <div>LLM Providers</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Configuration/ModelTiersTab', () => ({
  ModelTiersTab: () => <div>Model Tiers</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Configuration/OrgAIPolicyTab', () => ({
  OrgAIPolicyTab: () => <div>Org AI Policy</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Configuration/PurposeAssignmentsTab', () => ({
  PurposeAssignmentsTab: () => <div>Purpose Assignments</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Configuration/RoutingRulesTab', () => ({
  RoutingRulesTab: () => <div>Routing Rules</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Development/ExperimentsTab', () => ({
  ExperimentsTab: () => <div>Experiments</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Development/ModelRegistryTab', () => ({
  ModelRegistryTab: () => <div>Model Registry</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Development/PromptBuilderTab', () => ({
  PromptBuilderTab: () => <div>Prompt Builder</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Development/PromptsLibraryTab', () => ({
  PromptsLibraryTab: () => <div>Prompts Library</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab', () => ({
  DocumentsRAGTab: () => <div>Documents RAG</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Knowledge/KnowledgeBaseTab', () => ({
  KnowledgeBaseTab: () => <div>Knowledge Base</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Knowledge/StrategicDirectionsTab', () => ({
  StrategicDirectionsTab: () => <div>Strategic Directions</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Operations/HealthMonitoringTab', () => ({
  HealthMonitoringTab: () => <div>Health Monitoring</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Operations/MarketInboxTab', () => ({
  MarketInboxTab: () => <div>Market Inbox</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Operations/MissionControlTab', () => ({
  MissionControlTab: () => <div>Mission Control</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Operations/PerformanceDashboardTab', () => ({
  PerformanceDashboardTab: () => <div>Performance Dashboard</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Operations/SLAManagementTab', () => ({
  SLAManagementTab: () => <div>SLA Management</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Security/AccessControlTab', () => ({
  AccessControlTab: () => <div>Access Control</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Security/APIKeysTab', () => ({
  APIKeysTab: () => <div>API Keys</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Security/AuditLogsTab', () => ({
  AuditLogsTab: () => <div>Audit Logs</div>,
}));
vi.mock('../../../src/views/superadmin/AIPlatformModule/Security/ComplianceTab', () => ({
  ComplianceTab: () => <div>Compliance</div>,
}));

describe('SuperAdmin AIPlatformModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAIGovernancePolicy).mockResolvedValue({
      data: {
        summary: { internetEnabled: true },
        runtime: { tavilyConfigured: true, webSearchAvailable: true },
      },
    } as any);
  });

  it('shows Prompt OS runtime as an operations sub-tab', async () => {
    render(<AIPlatformModule initialTab="operations" />);

    expect(await screen.findByRole('button', { name: 'AI core runtime' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Prompt OS runtime' })).toBeInTheDocument();
  });

  it('renders AI core runtime panel when selected', async () => {
    render(<AIPlatformModule initialTab="operations" initialSubTab="ai-core-runtime" />);

    expect(await screen.findByText('AI core runtime panel')).toBeInTheDocument();
  });

  it('renders Prompt OS runtime panel when selected', async () => {
    render(<AIPlatformModule initialTab="operations" initialSubTab="prompt-os-runtime" />);

    expect(await screen.findByText('Prompt OS runtime panel')).toBeInTheDocument();
  });

  it('shows unknown internet policy status for malformed signal payloads', async () => {
    vi.mocked(Api.getAIGovernancePolicy).mockResolvedValue({
      data: { data: { unexpected: true } },
    } as any);

    render(<AIPlatformModule initialTab="operations" />);

    await waitFor(() => {
      expect(screen.getByText('Internet: UNKNOWN')).toBeInTheDocument();
    });
    expect(screen.queryByText('Internet: OFF')).not.toBeInTheDocument();
  });
});
