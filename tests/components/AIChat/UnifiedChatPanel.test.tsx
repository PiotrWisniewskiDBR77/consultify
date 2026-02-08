/**
 * @vitest-environment jsdom
 *
 * UnifiedChatPanel Tests
 * Tests for the main AI chat panel component
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fix JSDOM navigation error
if (typeof window !== 'undefined') {
  const noop = () => { };
  Object.defineProperty(window, 'location', {
    value: {
      ...window.location,
      assign: vi.fn(noop),
      replace: vi.fn(noop),
      reload: vi.fn(noop),
    },
    writable: true,
  });
}

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => { },
  },
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('remark-gfm', () => ({
  default: () => { },
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
    draftChatLanguage: null,
    chatLanguageByConversationId: {},
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

vi.mock('../../../src/hooks/useUniversalVoice', () => ({
  useUniversalVoice: () => ({
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    state: { isSpeaking: false, isListening: false },
    startListening: vi.fn(),
    stopListening: vi.fn(),
    settings: {},
    updateSettings: vi.fn(),
    isSupported: true,
  }),
}));

vi.mock('../../../src/hooks/useDemoSession', () => ({
  useDemoSession: () => ({
    isDemo: false,
    timeRemainingMs: 1000000,
    aiInteractionsRemaining: 100,
    aiInteractionsLimit: 100,
    consumeAIInteraction: vi.fn(),
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

vi.mock('../../../src/components/AIChat/ThinkingStatusLine', () => ({
  ThinkingStatusLine: () => null,
}));

// Import component after mocks
import { UnifiedChatPanel } from '../../../src/components/AIChat/UnifiedChatPanel';

describe('UnifiedChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the chat panel', () => {
      render(<UnifiedChatPanel />);

      expect(screen.getByTestId('enhanced-chat-input')).toBeInTheDocument();
    });

    it('should render in split mode when specified', () => {
      render(<UnifiedChatPanel mode="split" />);

      expect(screen.getByTestId('enhanced-chat-input')).toBeInTheDocument();
    });

    it('should show history trigger button when enabled', () => {
      render(<UnifiedChatPanel showHistoryTrigger={true} />);

      // History button exists with data-testid
      expect(screen.getByTestId('chat-history-button')).toBeInTheDocument();
    });

    it('should show new chat button', () => {
      render(<UnifiedChatPanel />);

      expect(screen.getByTestId('chat-new-button')).toBeInTheDocument();
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
  });

  describe('History Panel', () => {
    it('should have clickable history button', () => {
      render(<UnifiedChatPanel showHistoryTrigger={true} />);

      const historyButton = screen.getByTestId('chat-history-button');
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
  });

  describe('New Chat Button', () => {
    it('should have new chat button', () => {
      render(<UnifiedChatPanel />);

      const newChatButton = screen.getByTestId('chat-new-button');
      expect(newChatButton).toBeInTheDocument();

      fireEvent.click(newChatButton);
      // Should not throw
    });
  });

  describe('Autoread Toggle', () => {
    it('should show autoread toggle when TTS is supported', () => {
      render(<UnifiedChatPanel />);

      const autoreadButton = screen.getByTestId('chat-autoread-button');
      expect(autoreadButton).toBeInTheDocument();
    });
  });
});
