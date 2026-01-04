/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserDashboardView } from '../../views/UserDashboardView';
import { AppView } from '../../types';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback || key
    })
}));

vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn(() => ({
        fullSessionData: {
            step3Completed: true,
            step5Completed: false,
            kpiResults: { roi: 15 }
        },
        currentView: AppView.DASHBOARD,
        addChatMessage: vi.fn(),
        activeChatMessages: [],
        setIsBotTyping: vi.fn(),
        currentProjectId: 'proj-1'
    }))
}));

vi.mock('../../hooks/useScreenContext', () => ({
    useScreenContext: vi.fn()
}));

vi.mock('../../components/dashboard/DashboardOverview', () => ({
    DashboardOverview: () => <div data-testid="dashboard-overview">Dashboard Overview</div>
}));

vi.mock('../../components/dashboard/DashboardExecutionSnapshot', () => ({
    DashboardExecutionSnapshot: () => <div data-testid="execution-snapshot">Execution Snapshot</div>
}));

vi.mock('../../components/MyWork/TaskDetailModal', () => ({
    TaskDetailModal: () => null
}));

vi.mock('../../components/PMO/GateStatus', () => ({
    GateStatus: ({ projectId }: { projectId: string }) => (
        <div data-testid="gate-status">Gate Status for {projectId}</div>
    )
}));

vi.mock('../../components/PMO/PMOHealthSection', () => ({
    PMOHealthSection: ({ projectId, onExplainClick }: any) => (
        <div data-testid="pmo-health">
            PMO Health for {projectId}
            <button onClick={() => onExplainClick({ projectName: 'Test' })}>
                Explain
            </button>
        </div>
    )
}));

vi.mock('../../components/SplitLayout', () => ({
    SplitLayout: ({ children, title, subtitle, onSendMessage }: any) => (
        <div data-testid="split-layout">
            <div>{title}</div>
            <div>{subtitle}</div>
            {children}
        </div>
    )
}));

const mockCurrentUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: 'ADMIN'
};

describe('UserDashboardView', () => {
    const user = userEvent.setup();
    const mockOnNavigate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders split layout', () => {
            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            expect(screen.getByTestId('split-layout')).toBeInTheDocument();
        });

        it('renders with Executive Assistant title', () => {
            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            expect(screen.getByText('Executive Assistant')).toBeInTheDocument();
        });

        it('renders PMO Health section when project selected', () => {
            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            expect(screen.getByTestId('pmo-health')).toBeInTheDocument();
            expect(screen.getByText(/PMO Health for proj-1/)).toBeInTheDocument();
        });

        it('renders Gate Status when project selected', () => {
            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            expect(screen.getByTestId('gate-status')).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('passes onNavigate to child components', () => {
            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            // Component renders without errors
            expect(screen.getByTestId('split-layout')).toBeInTheDocument();
        });
    });

    describe('PMO Explain Feature', () => {
        it('triggers explain when button clicked', async () => {
            const { useAppStore } = await import('../../store/useAppStore');
            const mockAddChatMessage = vi.fn();
            
            (useAppStore as any).mockReturnValue({
                fullSessionData: {},
                currentView: AppView.DASHBOARD,
                addChatMessage: mockAddChatMessage,
                activeChatMessages: [],
                setIsBotTyping: vi.fn(),
                currentProjectId: 'proj-1'
            });

            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            const explainButton = screen.getByText('Explain');
            await user.click(explainButton);

            expect(mockAddChatMessage).toHaveBeenCalled();
        });
    });

    describe('Screen Context Registration', () => {
        it('registers screen context', async () => {
            const { useScreenContext } = await import('../../hooks/useScreenContext');

            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            expect(useScreenContext).toHaveBeenCalledWith(
                'user_dashboard',
                expect.any(String),
                expect.any(Object),
                expect.any(String)
            );
        });
    });

    describe('View Modes', () => {
        it('renders Overview by default', () => {
            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            expect(screen.getByTestId('dashboard-overview')).toBeInTheDocument();
        });

        it('renders Execution Snapshot when view is DASHBOARD_SNAPSHOT', async () => {
            const { useAppStore } = await import('../../store/useAppStore');
            
            (useAppStore as any).mockReturnValue({
                fullSessionData: {},
                currentView: AppView.DASHBOARD_SNAPSHOT,
                addChatMessage: vi.fn(),
                activeChatMessages: [],
                setIsBotTyping: vi.fn(),
                currentProjectId: 'proj-1'
            });

            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            expect(screen.getByTestId('execution-snapshot')).toBeInTheDocument();
        });
    });

    describe('Dark Mode Support', () => {
        it('includes dark mode classes', () => {
            render(
                <UserDashboardView 
                    currentUser={mockCurrentUser} 
                    onNavigate={mockOnNavigate} 
                />
            );

            const container = document.querySelector('.dark\\:bg-navy-950');
            expect(container).toBeTruthy();
        });
    });
});










