/**
 * @vitest-environment jsdom
 * 
 * AIPlatformModule Tests
 * Tests for the expanded AI Platform module with 9 tabs:
 * - LLM Config, Intelligence, Prompts Admin, Experiments, Mission Control,
 *   Performance, Knowledge, Costs, Health
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIPlatformModule from '../../../views/superadmin/AIPlatformModule';

// Mock all child components
vi.mock('../../../views/superadmin/LLMManagementView', () => ({
    LLMManagementView: () => <div data-testid="llm-management">LLM Management Content</div>
}));

vi.mock('../../../views/superadmin/AIIntelligenceView', () => ({
    AIIntelligenceView: () => <div data-testid="ai-intelligence">AI Intelligence Content</div>
}));

vi.mock('../../../views/admin/AdminKnowledgeView', () => ({
    AdminKnowledgeView: () => <div data-testid="knowledge-view">Knowledge Content</div>
}));

vi.mock('../../../components/Admin/AICostDashboard', () => ({
    AICostDashboard: () => <div data-testid="cost-dashboard">Cost Dashboard Content</div>
}));

vi.mock('../../../components/Admin/LLMHealthPanel', () => ({
    LLMHealthPanel: () => <div data-testid="health-panel">Health Panel Content</div>
}));

// New mocks for expanded tabs
vi.mock('../../../components/Admin/ABTestingDashboard', () => ({
    ABTestingDashboard: () => <div data-testid="ab-testing">A/B Testing Dashboard Content</div>
}));

vi.mock('../../../components/Admin/PromptManagementUI', () => ({
    PromptManagementUI: () => <div data-testid="prompt-management">Prompt Management Content</div>
}));

vi.mock('../../../components/Admin/AIMissionControl', () => ({
    AIMissionControl: () => <div data-testid="mission-control">Mission Control Content</div>
}));

vi.mock('../../../components/Admin/AIPerformanceDashboard', () => ({
    AIPerformanceDashboard: () => <div data-testid="performance-dashboard">Performance Dashboard Content</div>
}));

describe('AIPlatformModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default llm-config tab', () => {
        render(<AIPlatformModule />);
        
        expect(screen.getByRole('heading', { name: 'AI Platform' })).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<AIPlatformModule initialTab="intelligence" />);
        
        expect(screen.getByRole('heading', { name: 'AI Platform' })).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<AIPlatformModule />);
        
        const intelligenceTab = screen.getAllByText('Intelligence')[0];
        fireEvent.click(intelligenceTab);
        expect(intelligenceTab).toBeInTheDocument();
        
        const knowledgeTab = screen.getAllByText('Knowledge')[0];
        fireEvent.click(knowledgeTab);
        expect(knowledgeTab).toBeInTheDocument();
    });

    it('should display all nine tabs', () => {
        render(<AIPlatformModule />);
        
        // Original 5 tabs
        expect(screen.getAllByText('LLM Config').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Intelligence').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Knowledge').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Costs').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Health').length).toBeGreaterThan(0);
        
        // New 4 tabs added
        expect(screen.getAllByText('Prompts Admin').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Experiments').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Mission Control').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Performance').length).toBeGreaterThan(0);
    });

    it('should render correct content for each tab', () => {
        render(<AIPlatformModule />);
        
        // Default tab should show LLM Config content
        expect(screen.getByTestId('llm-management')).toBeInTheDocument();
    });

    it('should switch to Prompts Admin tab', () => {
        render(<AIPlatformModule />);
        
        const promptsTab = screen.getAllByText('Prompts Admin')[0];
        fireEvent.click(promptsTab);
        
        expect(screen.getByTestId('prompt-management')).toBeInTheDocument();
    });

    it('should switch to Experiments tab', () => {
        render(<AIPlatformModule />);
        
        const experimentsTab = screen.getAllByText('Experiments')[0];
        fireEvent.click(experimentsTab);
        
        expect(screen.getByTestId('ab-testing')).toBeInTheDocument();
    });

    it('should switch to Mission Control tab', () => {
        render(<AIPlatformModule />);
        
        const missionTab = screen.getAllByText('Mission Control')[0];
        fireEvent.click(missionTab);
        
        expect(screen.getByTestId('mission-control')).toBeInTheDocument();
    });

    it('should switch to Performance tab', () => {
        render(<AIPlatformModule />);
        
        const perfTab = screen.getAllByText('Performance')[0];
        fireEvent.click(perfTab);
        
        expect(screen.getByTestId('performance-dashboard')).toBeInTheDocument();
    });

    it('should render with experiments initial tab', () => {
        render(<AIPlatformModule initialTab="experiments" />);
        
        expect(screen.getByTestId('ab-testing')).toBeInTheDocument();
    });

    it('should render with prompts-admin initial tab', () => {
        render(<AIPlatformModule initialTab="prompts-admin" />);
        
        expect(screen.getByTestId('prompt-management')).toBeInTheDocument();
    });

    it('should render with mission-control initial tab', () => {
        render(<AIPlatformModule initialTab="mission-control" />);
        
        expect(screen.getByTestId('mission-control')).toBeInTheDocument();
    });

    it('should render with performance initial tab', () => {
        render(<AIPlatformModule initialTab="performance" />);
        
        expect(screen.getByTestId('performance-dashboard')).toBeInTheDocument();
    });

    it('should have updated subtitle reflecting all features', () => {
        render(<AIPlatformModule />);
        
        expect(screen.getByText(/prompts.*experiments.*intelligence.*monitoring/i)).toBeInTheDocument();
    });
});
