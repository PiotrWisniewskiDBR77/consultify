/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FullRoadmapView } from '@/views/FullRoadmapView';

// Mock dependencies
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (options?.returnObjects) {
        return {
          title: 'Roadmap',
          chatTitle: 'AI Assistant',
          chatSubtitle: 'Plan your transformation',
        };
      }
      return key;
    },
  }),
}));

const mockInitiatives = [
  {
    id: 'init-1',
    title: 'Digital Transformation',
    status: 'planned',
    quarter: 'Q1',
    wave: 'Wave 1',
    priority: 'high',
  },
  {
    id: 'init-2',
    title: 'Process Automation',
    status: 'planned',
    quarter: 'Q2',
    wave: 'Wave 1',
    priority: 'medium',
  },
];

vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    currentUser: { id: 'user-1', name: 'John' },
    fullSessionData: {
      initiatives: mockInitiatives,
      step3Completed: true,
    },
    setFullSessionData: vi.fn(),
    setIsBotTyping: vi.fn(),
    addChatMessage: vi.fn(),
    activeChatMessages: [],
    currentProjectId: 'proj-1',
    setCurrentView: vi.fn(),
  })),
}));

vi.mock('@/services/api', () => ({
  Api: {
    post: vi.fn().mockResolvedValue({
      summaryText: 'Roadmap summary',
      riskText: 'Low risk',
      recommendation: 'Proceed as planned',
    }),
    aiRoadmap: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/components/SplitLayout', () => ({
  SplitLayout: ({ children, title, subtitle, onSendMessage }: any) => (
    <div data-testid="split-layout">
      <div data-testid="layout-title">{title}</div>
      <div data-testid="layout-subtitle">{subtitle}</div>
      <button data-testid="send-message" onClick={() => onSendMessage('test message')}>
        Send
      </button>
      {children}
    </div>
  ),
}));

vi.mock('@/components/workspaces/FullStep3Workspace', () => ({
  FullStep3Workspace: ({ initiatives, onUpdate }: any) => (
    <div data-testid="step3-workspace">
      Workspace with {initiatives?.length || 0} initiatives
      <button onClick={() => onUpdate([])}>Clear</button>
    </div>
  ),
}));

vi.mock('@/components/WorkloadChart', () => ({
  WorkloadChart: () => <div data-testid="workload-chart">Workload Chart</div>,
}));

vi.mock('@/components/RoadmapSummary', () => ({
  RoadmapSummary: ({ summary, isLoading }: any) => (
    <div data-testid="roadmap-summary">
      {isLoading ? 'Loading...' : summary?.summaryText || 'No summary'}
    </div>
  ),
}));

vi.mock('@/components/RebalanceModal', () => ({
  RebalanceModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="rebalance-modal">
        Rebalance Modal
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/AIFeedbackButton', () => ({
  AIFeedbackButton: () => <button data-testid="ai-feedback">AI Feedback</button>,
}));

// Pending: this suite targets the retired SplitLayout/chat contract. The mounted
// roadmap now renders the execution workspace directly; replacement coverage
// belongs with the canonical Execution module acceptance packet.
describe.skip('FullRoadmapView (retired layout contract)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    it('renders split layout', () => {
      render(<FullRoadmapView />);

      expect(screen.getByTestId('split-layout')).toBeInTheDocument();
    });

    it('renders with AI Assistant title', () => {
      render(<FullRoadmapView />);

      expect(screen.getByTestId('layout-title')).toHaveTextContent('AI Assistant');
    });

    it('renders workspace component', () => {
      render(<FullRoadmapView />);

      expect(screen.getByTestId('step3-workspace')).toBeInTheDocument();
    });

    it('shows initiative count in workspace', () => {
      render(<FullRoadmapView />);

      expect(screen.getByText(/2 initiatives/)).toBeInTheDocument();
    });
  });

  describe('AI Summary', () => {
    it('fetches summary on mount', async () => {
      const { Api } = await import('@/services/api');

      render(<FullRoadmapView />);

      await waitFor(() => {
        expect(Api.post).toHaveBeenCalledWith('/ai/roadmap-summary', {
          initiatives: mockInitiatives,
        });
      });
    });

    it('displays summary when loaded', async () => {
      render(<FullRoadmapView />);

      await waitFor(() => {
        expect(screen.getByTestId('roadmap-summary')).toHaveTextContent('Roadmap summary');
      });
    });

    it('shows loading state while fetching', () => {
      const { Api } = require('@/services/api');
      Api.post.mockImplementation(() => new Promise(() => {}));

      render(<FullRoadmapView />);

      expect(screen.getByTestId('roadmap-summary')).toHaveTextContent('Loading...');
    });
  });

  describe('AI Chat', () => {
    it('sends message when chat is used', async () => {
      const { useAppStore } = await import('@/store/useAppStore');
      const mockAddChatMessage = vi.fn();

      (useAppStore as any).mockReturnValue({
        currentUser: { id: 'user-1' },
        fullSessionData: { initiatives: mockInitiatives },
        setFullSessionData: vi.fn(),
        setIsBotTyping: vi.fn(),
        addChatMessage: mockAddChatMessage,
        activeChatMessages: [],
        currentProjectId: 'proj-1',
        setCurrentView: vi.fn(),
      });

      render(<FullRoadmapView />);

      await user.click(screen.getByTestId('send-message'));

      expect(mockAddChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          content: 'test message',
        })
      );
    });
  });

  describe('Workload Chart', () => {
    it('renders workload chart', () => {
      render(<FullRoadmapView />);

      expect(screen.getByTestId('workload-chart')).toBeInTheDocument();
    });
  });

  describe('Rebalance Modal', () => {
    it('does not show rebalance modal initially', () => {
      render(<FullRoadmapView />);

      expect(screen.queryByTestId('rebalance-modal')).not.toBeInTheDocument();
    });
  });

  describe('AI Feedback', () => {
    it('renders AI feedback button', () => {
      render(<FullRoadmapView />);

      expect(screen.getByTestId('ai-feedback')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('handles empty initiatives', async () => {
      const { useAppStore } = await import('@/store/useAppStore');

      (useAppStore as any).mockReturnValue({
        currentUser: { id: 'user-1' },
        fullSessionData: { initiatives: [] },
        setFullSessionData: vi.fn(),
        setIsBotTyping: vi.fn(),
        addChatMessage: vi.fn(),
        activeChatMessages: [],
        currentProjectId: 'proj-1',
        setCurrentView: vi.fn(),
      });

      render(<FullRoadmapView />);

      expect(screen.getByText(/0 initiatives/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles summary fetch error gracefully', async () => {
      const { Api } = await import('@/services/api');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (Api.post as any).mockRejectedValue(new Error('API Error'));

      render(<FullRoadmapView />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Summary fetch failed', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });
});
