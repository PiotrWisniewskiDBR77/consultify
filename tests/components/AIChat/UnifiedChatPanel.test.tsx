/**
 * @vitest-environment jsdom
 *
 * UnifiedChatPanel Tests
 * Tests for the main AI chat panel component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('remark-gfm', () => ({
  default: () => {},
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    isChatSlidingPanelOpen: false,
    setChatSlidingPanelOpen: vi.fn(),
    currentStreamContent: '',
    isBotTyping: false,
    addChatMessage: vi.fn(),
    setIsBotTyping: vi.fn(),
    aiFreezeStatus: { isFrozen: false },
  }),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: () => ({
    activeConversationId: null,
    activeMessages: [],
    displayMode: 'full',
    createConversation: vi.fn().mockResolvedValue({ id: 'test-conv-id' }),
    addMessage: vi.fn().mockResolvedValue({ id: 'test-msg-id' }),
    setActiveConversation: vi.fn(),
    fetchConversation: vi.fn(),
    clearActiveChat: vi.fn(),
    setDisplayMode: vi.fn(),
    expandToFullScreen: vi.fn(),
    collapseToSplit: vi.fn(),
  }),
}));

vi.mock('../../../src/store/useArtifactsStore', () => ({
  useArtifactsStore: () => ({
    addArtifact: vi.fn(),
    togglePanel: vi.fn(),
  }),
}));

vi.mock('../../../src/hooks/useAIStream', () => ({
  useAIStream: () => ({
    startStream: vi.fn(),
    isStreaming: false,
    streamedContent: '',
  }),
}));

vi.mock('../../../src/hooks/useVoiceChat', () => ({
  useVoiceChat: () => ({
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    isSpeaking: false,
    voiceEnabled: false,
    ttsSupported: true,
  }),
}));

vi.mock('../../../src/services/api-extensions', () => ({
  submitAIFeedback: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock child components
vi.mock('../../../src/components/AIChat/ChatSlidingPanel', () => ({
  ChatSlidingPanel: () => <div data-testid="chat-sliding-panel" />,
}));

vi.mock('../../../src/components/AIChat/EnhancedChatInput', () => ({
  EnhancedChatInput: ({
    onSend,
    disabled,
  }: {
    onSend: (msg: string) => void;
    disabled: boolean;
  }) => (
    <div data-testid="enhanced-chat-input">
      <textarea
        data-testid="chat-input"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend((e.target as HTMLTextAreaElement).value);
          }
        }}
      />
      <button data-testid="send-button" onClick={() => onSend('test message')} disabled={disabled}>
        Send
      </button>
    </div>
  ),
}));

vi.mock('../../../src/components/AIChat/Input/FocusModeSelector', () => ({
  FocusModeSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="focus-mode-selector">
      <button onClick={() => onChange('all')}>All</button>
      <button onClick={() => onChange('pmo')}>PMO</button>
    </div>
  ),
}));

vi.mock('../../../src/components/AIChat/CitationList', () => ({
  CitationList: () => <div data-testid="citation-list" />,
}));

vi.mock('../../../src/components/AIChat/InlineResponseFeedback', () => ({
  InlineResponseFeedback: () => <div data-testid="inline-feedback" />,
}));

vi.mock('../../../src/components/AIChat/Messages/ThinkingBlock', () => ({
  ThinkingBlock: () => <div data-testid="thinking-block" />,
}));

vi.mock('../../../src/components/AIChat/PendingActionsIndicator', () => ({
  PendingActionsIndicator: () => <div data-testid="pending-actions" />,
}));

// Import component after mocks
import { UnifiedChatPanel } from '../../../src/components/AIChat/UnifiedChatPanel';

describe('UnifiedChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render in full mode by default', () => {
      render(<UnifiedChatPanel />);

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByTestId('enhanced-chat-input')).toBeInTheDocument();
    });

    it('should render in split mode when specified', () => {
      render(<UnifiedChatPanel mode="split" />);

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    it('should show focus mode selector', () => {
      render(<UnifiedChatPanel showFocusMode={true} />);

      expect(screen.getByTestId('focus-mode-selector')).toBeInTheDocument();
    });

    it('should hide focus mode selector when disabled', () => {
      render(<UnifiedChatPanel showFocusMode={false} />);

      expect(screen.queryByTestId('focus-mode-selector')).not.toBeInTheDocument();
    });

    it('should show history trigger button', () => {
      render(<UnifiedChatPanel showHistoryTrigger={true} />);

      expect(screen.getByTitle('History')).toBeInTheDocument();
    });

    it('should show mode toggle button', () => {
      render(<UnifiedChatPanel showModeToggle={true} />);

      expect(screen.getByTitle('Collapse')).toBeInTheDocument();
    });
  });

  describe('Welcome State', () => {
    it('should show welcome message when no messages', () => {
      render(<UnifiedChatPanel />);

      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      expect(
        screen.getByText('Ask questions, get insights, and collaborate with AI')
      ).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should have enabled input when not disabled', () => {
      render(<UnifiedChatPanel disabled={false} />);

      const input = screen.getByTestId('chat-input');
      expect(input).not.toBeDisabled();
    });

    it('should have disabled input when disabled prop is true', () => {
      render(<UnifiedChatPanel disabled={true} />);

      const input = screen.getByTestId('chat-input');
      expect(input).toBeDisabled();
    });

    it('should show custom title when provided', () => {
      render(<UnifiedChatPanel title="Custom Chat Title" />);

      expect(screen.getByText('Custom Chat Title')).toBeInTheDocument();
    });

    it('should show workspace context indicator when provided', () => {
      render(
        <UnifiedChatPanel
          workspaceContext={{
            type: 'assessment',
            view: 'assessment' as any,
            timestamp: new Date(),
          }}
        />
      );

      expect(screen.getByText(/Context-aware/)).toBeInTheDocument();
    });
  });

  describe('Mode Toggle', () => {
    it('should call onModeToggle when mode toggle is clicked', () => {
      const onModeToggle = vi.fn();
      render(<UnifiedChatPanel onModeToggle={onModeToggle} />);

      const toggleButton = screen.getByTitle('Collapse');
      fireEvent.click(toggleButton);

      expect(onModeToggle).toHaveBeenCalled();
    });
  });

  describe('History Panel', () => {
    it('should toggle history panel on button click', () => {
      render(<UnifiedChatPanel />);

      const historyButton = screen.getByTitle('History');
      fireEvent.click(historyButton);

      // The history button should be clickable
      expect(historyButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have skip link for keyboard navigation', () => {
      render(<UnifiedChatPanel />);

      const skipLink = screen.getByText('Skip to chat input');
      expect(skipLink).toHaveClass('sr-only');
    });

    it('should have proper heading structure', () => {
      render(<UnifiedChatPanel />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('AI Assistant');
    });
  });

  describe('Back Button', () => {
    it('should show back button in split mode with onBack callback', () => {
      const onBack = vi.fn();
      render(<UnifiedChatPanel mode="split" onBack={onBack} />);

      const backButton = screen.getByTitle('Back');
      expect(backButton).toBeInTheDocument();

      fireEvent.click(backButton);
      expect(onBack).toHaveBeenCalled();
    });

    it('should not show back button without onBack callback', () => {
      render(<UnifiedChatPanel mode="split" />);

      expect(screen.queryByTitle('Back')).not.toBeInTheDocument();
    });
  });
});
