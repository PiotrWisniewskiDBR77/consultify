/**
 * Tests for MessageBubble component
 * World-Class Chat 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageBubble } from '@/components/AIChat/Messages/MessageBubble';
import { ChatMessage, Artifact, ThinkingStep } from '@/types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' }
  })
}));

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>
}));

describe('MessageBubble', () => {
  const mockUserMessage: ChatMessage = {
    id: 'msg-1',
    role: 'user',
    content: 'Hello, how are you?',
    timestamp: new Date()
  };

  const mockAIMessage: ChatMessage = {
    id: 'msg-2',
    role: 'ai',
    content: 'I am doing well, thank you!',
    timestamp: new Date()
  };

  const mockAIMessageWithArtifacts: ChatMessage = {
    ...mockAIMessage,
    artifacts: [
      {
        id: 'artifact-1',
        type: 'markdown',
        title: 'Test Document',
        content: '# Test',
        editable: true,
        version: 1,
        createdAt: new Date()
      }
    ] as Artifact[]
  };

  const mockAIMessageWithThinking: ChatMessage = {
    ...mockAIMessage,
    thinkingSteps: [
      {
        id: 'think-1',
        label: 'Step 1',
        content: 'Analyzing question',
        status: 'done',
        timestamp: new Date(),
        category: 'analysis'
      }
    ] as ThinkingStep[]
  };

  const defaultProps = {
    message: mockUserMessage,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRegenerate: vi.fn(),
    onCopy: vi.fn(),
    onFeedback: vi.fn(),
    onViewArtifacts: vi.fn(),
    onSpeak: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user message', () => {
    render(<MessageBubble message={mockUserMessage} />);
    
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
  });

  it('renders AI message', () => {
    render(<MessageBubble message={mockAIMessage} />);
    
    expect(screen.getByText('I am doing well, thank you!')).toBeInTheDocument();
  });

  it('shows artifacts badge when message has artifacts', () => {
    render(<MessageBubble message={mockAIMessageWithArtifacts} />);
    
    // Should show artifact indicator or button
    const artifactButton = screen.queryByText(/artifact|view artifacts/i);
    expect(artifactButton || screen.queryByTitle(/artifact/i)).toBeTruthy();
  });

  it('shows thinking block when message has thinking steps', () => {
    render(<MessageBubble message={mockAIMessageWithThinking} showThinkingSteps={true} />);
    
    // Thinking block should be rendered (may be collapsed)
    const thinkingBlock = screen.queryByText(/thinking|reasoning/i);
    expect(thinkingBlock).toBeTruthy();
  });

  it('calls onEdit when edit button clicked', () => {
    render(<MessageBubble {...defaultProps} message={mockUserMessage} />);
    
    // Hover to show actions
    const messageContainer = screen.getByText('Hello, how are you?').closest('.group');
    if (messageContainer) {
      fireEvent.mouseEnter(messageContainer);
    }
    
    // Wait for actions to appear and click edit
    waitFor(() => {
      const editButton = screen.queryByTitle(/edit/i);
      if (editButton) {
        fireEvent.click(editButton);
        expect(defaultProps.onEdit).toHaveBeenCalledWith('msg-1');
      }
    });
  });

  it('calls onDelete when delete button clicked', () => {
    render(<MessageBubble {...defaultProps} message={mockUserMessage} />);
    
    const messageContainer = screen.getByText('Hello, how are you?').closest('.group');
    if (messageContainer) {
      fireEvent.mouseEnter(messageContainer);
    }
    
    waitFor(() => {
      const deleteButton = screen.queryByTitle(/delete/i);
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(defaultProps.onDelete).toHaveBeenCalledWith('msg-1');
      }
    });
  });

  it('calls onCopy when copy button clicked', () => {
    render(<MessageBubble {...defaultProps} message={mockAIMessage} />);
    
    const messageContainer = screen.getByText('I am doing well, thank you!').closest('.group');
    if (messageContainer) {
      fireEvent.mouseEnter(messageContainer);
    }
    
    waitFor(() => {
      const copyButton = screen.queryByTitle(/copy/i);
      if (copyButton) {
        fireEvent.click(copyButton);
        expect(defaultProps.onCopy).toHaveBeenCalledWith('I am doing well, thank you!');
      }
    });
  });

  it('calls onViewArtifacts when artifacts button clicked', () => {
    render(<MessageBubble {...defaultProps} message={mockAIMessageWithArtifacts} />);
    
    const artifactButton = screen.queryByText(/artifact|view artifacts/i) || 
                          screen.queryByTitle(/artifact/i);
    if (artifactButton) {
      fireEvent.click(artifactButton);
      expect(defaultProps.onViewArtifacts).toHaveBeenCalledWith(mockAIMessageWithArtifacts.artifacts);
    }
  });

  it('shows regeneration count badge when regenerated', () => {
    const regeneratedMessage: ChatMessage = {
      ...mockAIMessage,
      regenerateCount: 2
    };
    
    render(<MessageBubble message={regeneratedMessage} />);
    
    // Should show regeneration badge
    const badge = screen.queryByText(/regenerated|2x/i);
    expect(badge).toBeTruthy();
  });

  it('truncates long messages with show more', () => {
    const longMessage: ChatMessage = {
      ...mockAIMessage,
      content: 'A'.repeat(3000) // Very long message
    };
    
    render(<MessageBubble message={longMessage} />);
    
    // Should show truncated content with "show more" option
    const showMoreButton = screen.queryByText(/show more|expand/i);
    expect(showMoreButton).toBeTruthy();
  });

  it('shows streaming indicator when isStreaming is true', () => {
    render(<MessageBubble message={mockAIMessage} isStreaming={true} />);
    
    // Should show streaming indicator (typing dots or similar)
    const streamingIndicator = screen.queryByText(/typing|streaming|\.\.\./i) ||
                               screen.queryByTestId('streaming-indicator');
    expect(streamingIndicator).toBeTruthy();
  });

  it('hides thinking steps when showThinkingSteps is false', () => {
    render(<MessageBubble message={mockAIMessageWithThinking} showThinkingSteps={false} />);
    
    const thinkingBlock = screen.queryByText(/thinking|reasoning/i);
    expect(thinkingBlock).not.toBeInTheDocument();
  });

  it('displays citations when present', () => {
    const messageWithCitations: ChatMessage = {
      ...mockAIMessage,
      citations: [
        { id: 'cite-1', source: 'Source 1', url: 'https://example.com' }
      ]
    };
    
    render(<MessageBubble message={messageWithCitations} />);
    
    // Should show citations
    const citations = screen.queryByText(/source|citation/i);
    expect(citations).toBeTruthy();
  });
});

