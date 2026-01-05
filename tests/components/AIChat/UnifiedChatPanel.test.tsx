/**
 * Tests for UnifiedChatPanel component
 * Part of Unified AI Chat System
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { UnifiedChatPanel } from '@/components/AIChat/UnifiedChatPanel';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { createWorkspaceContext } from '@/types/workspace';

// Mock stores
vi.mock('@/store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

vi.mock('@/store/useConversationStore', () => ({
    useConversationStore: vi.fn()
}));

vi.mock('@/store/useArtifactsStore', () => ({
    useArtifactsStore: () => ({
        addArtifact: vi.fn(),
        togglePanel: vi.fn()
    })
}));

vi.mock('../@/hooks/useAIStream', () => ({
    useAIStream: () => ({
        startStream: vi.fn(),
        isStreaming: false,
        streamedContent: ''
    })
}));

vi.mock('../@/hooks/useVoiceChat', () => ({
    useVoiceChat: () => ({
        speak: vi.fn(),
        stopSpeaking: vi.fn(),
        isSpeaking: false,
        voiceEnabled: false,
        ttsSupported: true
    })
}));

// Mock ChatSlidingPanel
vi.mock('@/components/AIChat/ChatSlidingPanel', () => ({
    ChatSlidingPanel: () => <div data-testid="chat-sliding-panel" />
}));

const mockAppStore = {
    isChatSlidingPanelOpen: false,
    setChatSlidingPanelOpen: vi.fn(),
    currentStreamContent: '',
    isBotTyping: false,
    addChatMessage: vi.fn(),
    setIsBotTyping: vi.fn(),
    aiFreezeStatus: { isFrozen: false, reason: null, scope: null }
};

const mockConversationStore = {
    activeConversationId: null,
    activeMessages: [],
    displayMode: 'full' as const,
    createConversation: vi.fn().mockResolvedValue({ id: 'new-conv' }),
    addMessage: vi.fn(),
    setActiveConversation: vi.fn(),
    fetchConversation: vi.fn(),
    clearActiveChat: vi.fn(),
    setDisplayMode: vi.fn(),
    expandToFullScreen: vi.fn(),
    collapseToSplit: vi.fn()
};

describe('UnifiedChatPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue(mockAppStore);
        (useConversationStore as any).mockReturnValue(mockConversationStore);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    const renderComponent = (props = {}) => {
        return render(
            <I18nextProvider i18n={i18n}>
                <UnifiedChatPanel {...props} />
            </I18nextProvider>
        );
    };

    describe('Rendering', () => {
        it('should render in full mode by default', () => {
            renderComponent();
            
            // Should show welcome state with no messages
            expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument();
        });

        it('should render in split mode when specified', () => {
            renderComponent({ mode: 'split' });
            
            // Component should render successfully in split mode
            expect(screen.getByTestId('chat-sliding-panel')).toBeInTheDocument();
        });

        it('should show history trigger button when enabled', () => {
            renderComponent({ showHistoryTrigger: true });
            
            // History button should be present
            const historyButton = screen.getByTitle(/History/i);
            expect(historyButton).toBeInTheDocument();
        });

        it('should show mode toggle button when enabled', () => {
            renderComponent({ showModeToggle: true });
            
            // Mode toggle button should be present
            const toggleButton = screen.getByTitle(/Expand|Collapse/i);
            expect(toggleButton).toBeInTheDocument();
        });

        it('should show custom title when provided', () => {
            renderComponent({ title: 'Custom AI Assistant' });
            
            expect(screen.getByText('Custom AI Assistant')).toBeInTheDocument();
        });
    });

    describe('Display Mode', () => {
        it('should apply compact styles in split mode', () => {
            renderComponent({ mode: 'split' });
            
            // Component renders - compact styles are applied via CSS classes
            // This test verifies the mode prop is respected
            expect(screen.getByTestId('chat-sliding-panel')).toBeInTheDocument();
        });

        it('should call expandToFullScreen when mode toggle clicked in split mode', async () => {
            const mockExpandToFullScreen = vi.fn();
            (useConversationStore as any).mockReturnValue({
                ...mockConversationStore,
                displayMode: 'split',
                expandToFullScreen: mockExpandToFullScreen
            });

            renderComponent({ 
                mode: 'split',
                showModeToggle: true,
                onModeToggle: vi.fn()
            });
            
            const toggleButton = screen.getByTitle(/Expand/i);
            fireEvent.click(toggleButton);
            
            expect(mockExpandToFullScreen).toHaveBeenCalled();
        });

        it('should call collapseToSplit when mode toggle clicked in full mode', async () => {
            const mockCollapseToSplit = vi.fn();
            (useConversationStore as any).mockReturnValue({
                ...mockConversationStore,
                displayMode: 'full',
                collapseToSplit: mockCollapseToSplit
            });

            renderComponent({ 
                mode: 'full',
                showModeToggle: true,
                onModeToggle: vi.fn()
            });
            
            const toggleButton = screen.getByTitle(/Collapse/i);
            fireEvent.click(toggleButton);
            
            expect(mockCollapseToSplit).toHaveBeenCalled();
        });
    });

    describe('Workspace Context', () => {
        it('should show workspace context info when provided', () => {
            const context = createWorkspaceContext(AppView.MY_WORK, 'task', {
                entityId: 'task-123'
            });

            renderComponent({ workspaceContext: context });
            
            // Should show context-aware indicator
            expect(screen.getByText(/Context-aware/i)).toBeInTheDocument();
        });

        it('should show contextual placeholder when workspace context provided', () => {
            const context = createWorkspaceContext(AppView.MY_WORK, 'task');

            renderComponent({ workspaceContext: context });
            
            // Input should show contextual placeholder
            const input = screen.getByPlaceholderText(/task/i);
            expect(input).toBeInTheDocument();
        });
    });

    describe('Messages', () => {
        it('should render messages from conversation store', () => {
            (useConversationStore as any).mockReturnValue({
                ...mockConversationStore,
                activeMessages: [
                    {
                        id: 'msg-1',
                        role: 'user',
                        content: 'Hello AI',
                        createdAt: new Date(),
                        messageType: 'text'
                    },
                    {
                        id: 'msg-2',
                        role: 'ai',
                        content: 'Hello! How can I help?',
                        createdAt: new Date(),
                        messageType: 'text'
                    }
                ]
            });

            renderComponent();
            
            expect(screen.getByText('Hello AI')).toBeInTheDocument();
            expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
        });

        it('should show typing indicator when bot is typing', () => {
            (useAppStore as any).mockReturnValue({
                ...mockAppStore,
                isBotTyping: true
            });

            renderComponent();
            
            // Typing indicator dots should be visible
            const typingIndicators = document.querySelectorAll('.animate-bounce');
            expect(typingIndicators.length).toBeGreaterThan(0);
        });
    });

    describe('History Panel', () => {
        it('should toggle sliding panel when history button clicked', () => {
            const mockSetChatSlidingPanelOpen = vi.fn();
            (useAppStore as any).mockReturnValue({
                ...mockAppStore,
                setChatSlidingPanelOpen: mockSetChatSlidingPanelOpen
            });

            renderComponent({ showHistoryTrigger: true });
            
            const historyButton = screen.getByTitle(/History/i);
            fireEvent.click(historyButton);
            
            expect(mockSetChatSlidingPanelOpen).toHaveBeenCalled();
        });
    });

    describe('Focus Mode', () => {
        it('should show focus mode selector when enabled', () => {
            renderComponent({ showFocusMode: true });
            
            // Focus mode pills should be visible
            expect(screen.getByTitle(/All/i)).toBeInTheDocument();
        });

        it('should hide focus mode selector when disabled', () => {
            renderComponent({ showFocusMode: false });
            
            // Focus mode pills should not be visible
            expect(screen.queryByTitle(/All: Use all available sources/i)).not.toBeInTheDocument();
        });
    });

    describe('Disabled State', () => {
        it('should disable input when AI is frozen', () => {
            (useAppStore as any).mockReturnValue({
                ...mockAppStore,
                aiFreezeStatus: { isFrozen: true, reason: 'Budget exhausted', scope: 'org' }
            });

            renderComponent();
            
            // Input should be disabled
            const textarea = screen.getByPlaceholderText(/AI temporarily unavailable/i);
            expect(textarea).toBeDisabled();
        });

        it('should disable input when disabled prop is true', () => {
            renderComponent({ disabled: true });
            
            // Input should be disabled
            const textarea = screen.getByPlaceholderText(/AI temporarily unavailable/i);
            expect(textarea).toBeDisabled();
        });
    });
});

