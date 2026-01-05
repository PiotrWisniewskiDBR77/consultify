/**
 * @vitest-environment jsdom
 * 
 * AI Modular Platform Tests (Variant A - 3 Modules)
 * 
 * Tests for the new AI Platform modules:
 * - AIInfrastructureModule (LLM Providers, Tiers, Settings, Health)
 * - AIDevelopmentModule (Prompts, Intelligence, Experiments, Knowledge)
 * - AIOperationsModule (Mission Control, Performance, Costs, SLA, Analytics)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIInfrastructureModule from '@/views/superadmin/AIInfrastructureModule';
import AIDevelopmentModule from '@/views/superadmin/AIDevelopmentModule';
import AIOperationsModule from '@/views/superadmin/AIOperationsModule';

// Mock all child components
vi.mock('@/views/superadmin/LLMManagementView', () => ({
    LLMManagementView: () => <div data-testid="llm-management">LLM Management</div>
}));

vi.mock('@/components/SuperAdmin/ModelTierAssignments', () => ({
    ModelTierAssignments: () => <div data-testid="tier-assignments">Tier Assignments</div>
}));

vi.mock('@/components/SuperAdmin/SuperAdminAISettings', () => ({
    SuperAdminAISettings: () => <div data-testid="ai-settings">AI Settings</div>
}));

vi.mock('@/components/Admin/LLMHealthPanel', () => ({
    LLMHealthPanel: () => <div data-testid="health-panel">Health Panel</div>
}));

vi.mock('@/components/Admin/PromptManagementUI', () => ({
    PromptManagementUI: () => <div data-testid="prompt-management">Prompt Management</div>
}));

vi.mock('@/views/superadmin/AIIntelligenceView', () => ({
    AIIntelligenceView: () => <div data-testid="ai-intelligence">AI Intelligence</div>
}));

vi.mock('@/components/Admin/ABTestingDashboard', () => ({
    ABTestingDashboard: () => <div data-testid="ab-testing">AB Testing</div>
}));

vi.mock('@/views/admin/AdminKnowledgeView', () => ({
    AdminKnowledgeView: () => <div data-testid="knowledge-view">Knowledge View</div>
}));

vi.mock('@/components/Admin/AIMissionControl', () => ({
    AIMissionControl: () => <div data-testid="mission-control">Mission Control</div>
}));

vi.mock('@/components/Admin/AIPerformanceDashboard', () => ({
    AIPerformanceDashboard: () => <div data-testid="performance-dashboard">Performance Dashboard</div>
}));

vi.mock('@/components/Admin/AICostDashboard', () => ({
    AICostDashboard: () => <div data-testid="cost-dashboard">Cost Dashboard</div>
}));

vi.mock('@/components/Admin/SLADashboard', () => ({
    SLADashboard: () => <div data-testid="sla-dashboard">SLA Dashboard</div>
}));

vi.mock('@/components/Admin/AI/UsageAnalyticsDashboard', () => ({
    UsageAnalyticsDashboard: () => <div data-testid="analytics-dashboard">Analytics Dashboard</div>
}));

// Mock TabLayout
vi.mock('@/components/SuperAdmin/TabLayout', () => ({
    TabLayout: ({ children, title, tabs, activeTab, onTabChange }: any) => (
        <div data-testid="tab-layout">
            <h1>{title}</h1>
            <div className="tabs">
                {tabs.map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={activeTab === tab.id ? 'active' : ''}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="content">{children}</div>
        </div>
    ),
    Tab: () => null
}));

describe('AIInfrastructureModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default llm-config tab', () => {
        render(<AIInfrastructureModule />);
        
        expect(screen.getByRole('heading', { name: 'AI Infrastructure' })).toBeInTheDocument();
        expect(screen.getByTestId('llm-management')).toBeInTheDocument();
    });

    it('should render all four tabs', () => {
        render(<AIInfrastructureModule />);
        
        expect(screen.getByText('LLM Providers')).toBeInTheDocument();
        expect(screen.getByText('Model Tiers')).toBeInTheDocument();
        expect(screen.getByText('Global Settings')).toBeInTheDocument();
        expect(screen.getByText('Health Monitoring')).toBeInTheDocument();
    });

    it('should switch to tier-assignments tab', () => {
        render(<AIInfrastructureModule />);
        
        fireEvent.click(screen.getByText('Model Tiers'));
        expect(screen.getByTestId('tier-assignments')).toBeInTheDocument();
    });

    it('should switch to settings tab', () => {
        render(<AIInfrastructureModule />);
        
        fireEvent.click(screen.getByText('Global Settings'));
        expect(screen.getByTestId('ai-settings')).toBeInTheDocument();
    });

    it('should switch to health tab', () => {
        render(<AIInfrastructureModule />);
        
        fireEvent.click(screen.getByText('Health Monitoring'));
        expect(screen.getByTestId('health-panel')).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<AIInfrastructureModule initialTab="health" />);
        
        expect(screen.getByTestId('health-panel')).toBeInTheDocument();
    });
});

describe('AIDevelopmentModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default prompts tab', () => {
        render(<AIDevelopmentModule />);
        
        expect(screen.getByRole('heading', { name: 'AI Development' })).toBeInTheDocument();
        expect(screen.getByTestId('prompt-management')).toBeInTheDocument();
    });

    it('should render all four tabs', () => {
        render(<AIDevelopmentModule />);
        
        expect(screen.getByText('Prompt Library')).toBeInTheDocument();
        expect(screen.getByText('AI Intelligence')).toBeInTheDocument();
        expect(screen.getByText('Experiments')).toBeInTheDocument();
        expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
    });

    it('should switch to intelligence tab', () => {
        render(<AIDevelopmentModule />);
        
        fireEvent.click(screen.getByText('AI Intelligence'));
        expect(screen.getByTestId('ai-intelligence')).toBeInTheDocument();
    });

    it('should switch to experiments tab', () => {
        render(<AIDevelopmentModule />);
        
        fireEvent.click(screen.getByText('Experiments'));
        expect(screen.getByTestId('ab-testing')).toBeInTheDocument();
    });

    it('should switch to knowledge tab', () => {
        render(<AIDevelopmentModule />);
        
        fireEvent.click(screen.getByText('Knowledge Base'));
        expect(screen.getByTestId('knowledge-view')).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<AIDevelopmentModule initialTab="experiments" />);
        
        expect(screen.getByTestId('ab-testing')).toBeInTheDocument();
    });
});

describe('AIOperationsModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default mission-control tab', () => {
        render(<AIOperationsModule />);
        
        expect(screen.getByRole('heading', { name: 'AI Operations' })).toBeInTheDocument();
        expect(screen.getByTestId('mission-control')).toBeInTheDocument();
    });

    it('should render all five tabs', () => {
        render(<AIOperationsModule />);
        
        // Use getAllByText as some tab names match content (e.g. Mission Control)
        expect(screen.getAllByText('Mission Control').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Performance').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Costs').length).toBeGreaterThan(0);
        expect(screen.getAllByText('SLA').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
    });

    it('should switch to performance tab', () => {
        render(<AIOperationsModule />);
        
        // Get the first match (the tab button)
        fireEvent.click(screen.getAllByText('Performance')[0]);
        expect(screen.getByTestId('performance-dashboard')).toBeInTheDocument();
    });

    it('should switch to costs tab', () => {
        render(<AIOperationsModule />);
        
        fireEvent.click(screen.getAllByText('Costs')[0]);
        expect(screen.getByTestId('cost-dashboard')).toBeInTheDocument();
    });

    it('should switch to sla tab', () => {
        render(<AIOperationsModule />);
        
        fireEvent.click(screen.getAllByText('SLA')[0]);
        expect(screen.getByTestId('sla-dashboard')).toBeInTheDocument();
    });

    it('should switch to analytics tab', () => {
        render(<AIOperationsModule />);
        
        fireEvent.click(screen.getAllByText('Analytics')[0]);
        expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<AIOperationsModule initialTab="costs" />);
        
        expect(screen.getByTestId('cost-dashboard')).toBeInTheDocument();
    });
});

describe('AI Modules Integration', () => {
    it('AIInfrastructureModule should focus on infrastructure concerns', () => {
        render(<AIInfrastructureModule />);
        
        // Should have infrastructure-focused tabs (use getAllByText for potential duplicates)
        expect(screen.getAllByText('LLM Providers').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Model Tiers').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Global Settings').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Health Monitoring').length).toBeGreaterThan(0);
        
        // Should NOT have development or operations tabs
        expect(screen.queryByText('Prompt Library')).not.toBeInTheDocument();
        expect(screen.queryByText('Mission Control')).not.toBeInTheDocument();
    });

    it('AIDevelopmentModule should focus on development concerns', () => {
        render(<AIDevelopmentModule />);
        
        // Should have development-focused tabs (use getAllByText for potential duplicates)
        expect(screen.getAllByText('Prompt Library').length).toBeGreaterThan(0);
        expect(screen.getAllByText('AI Intelligence').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Experiments').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Knowledge Base').length).toBeGreaterThan(0);
        
        // Should NOT have infrastructure or operations tabs
        expect(screen.queryByText('LLM Providers')).not.toBeInTheDocument();
        expect(screen.queryByText('Mission Control')).not.toBeInTheDocument();
    });

    it('AIOperationsModule should focus on operations concerns', () => {
        render(<AIOperationsModule />);
        
        // Should have operations-focused tabs (use getAllByText as tab name matches content)
        expect(screen.getAllByText('Mission Control').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Performance').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Costs').length).toBeGreaterThan(0);
        expect(screen.getAllByText('SLA').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
        
        // Should NOT have infrastructure or development tabs
        expect(screen.queryByText('LLM Providers')).not.toBeInTheDocument();
        expect(screen.queryByText('Prompt Library')).not.toBeInTheDocument();
    });
});

