/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const v8ArtifactRunControlMock = vi.fn();
const v8ContextIndicatorMock = vi.fn();

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback || _key,
      i18n: { language: 'pl' },
    }),
  };
});

vi.mock('../../../src/contexts/AIContext', () => ({
  useAIContext: () => ({
    pmoContext: {},
    globalContext: {},
    screenContext: {},
  }),
}));

vi.mock('../../../src/hooks/useAIStream', () => ({
  useAIStream: () => ({
    isStreaming: false,
    streamedContent: '',
    startStream: vi.fn(),
    thinkingSteps: [],
    abortStream: vi.fn(),
    retryLastStream: vi.fn(),
    lastError: null,
    clearLastError: vi.fn(),
    researchProgress: null,
    streamStartedAt: null,
    streamCompletedSignal: 0,
    retryInfo: null,
  }),
}));

vi.mock('../../../src/hooks/useUniversalVoice', () => ({
  useUniversalVoice: () => ({
    state: { isSpeaking: false, isListening: false },
    startListening: vi.fn(),
    stopListening: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    isSupported: true,
    endConversation: vi.fn(),
  }),
}));

vi.mock('../../../src/hooks/useActionHandler', () => ({
  ACTION_TYPES: {},
  useActionHandler: () => ({
    executeAction: vi.fn(),
    confirmAction: vi.fn(),
    pendingActions: [],
    isExecuting: false,
  }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: {
      firstName: 'Piotr',
      role: 'Manager',
      organizationId: null,
    },
    currentProjectId: '11111111-1111-4111-8111-111111111111',
    aiConfig: {
      textToSpeech: false,
      privateMode: true,
    },
    currentOrganization: null,
    setCurrentView: vi.fn(),
    isChatCollapsed: false,
    toggleChatCollapse: vi.fn(),
    setAIConfig: vi.fn(),
    setChatKickoffMessage: vi.fn(),
  }),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: () => ({
    activeConversationId: 'conv-legacy-1',
    activeMessages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Prepare board update summary',
        createdAt: new Date().toISOString(),
        messageType: 'text',
        metadata: {},
      },
    ],
    isLoading: false,
    isSidebarOpen: false,
    workspaceContext: {
      entityId: '22222222-2222-4222-8222-222222222222',
      projectId: '11111111-1111-4111-8111-111111111111',
      type: 'project',
      entityName: 'Board Program',
    },
    createConversation: vi.fn(),
    addMessage: vi.fn(),
    setActiveConversation: vi.fn(),
    clearActiveChat: vi.fn(),
    truncateFromMessage: vi.fn(),
    generateTitle: vi.fn(),
    draftChatLanguage: null,
    chatLanguageByConversationId: {},
  }),
}));

vi.mock('../../../src/store/usePMOStore', () => ({
  usePMOStore: () => ({
    projectName: 'Board Program',
  }),
}));

vi.mock('../../../src/components/AIChat/ChatExportModal', () => ({
  ChatExportModal: () => null,
}));

vi.mock('../../../src/components/AIChat/ChatSlidingPanel', () => ({
  ChatSlidingPanel: () => <div data-testid="chat-sliding-panel" />,
}));

vi.mock('../../../src/components/AIChat/CitationList', () => ({
  CitationList: () => null,
}));

vi.mock('../../../src/components/AIChat/EnhancedChatInput', () => ({
  EnhancedChatInput: () => <div data-testid="enhanced-chat-input" />,
}));

vi.mock('../../../src/components/AIChat/Messages/MessageActions', () => ({
  MessageActions: () => <div data-testid="message-actions" />,
}));

vi.mock('../../../src/components/AIChat/Messages/ThinkingBlock', () => ({
  ThinkingBlock: () => null,
}));

vi.mock('../../../src/components/AIChat/ResearchProgress', () => ({
  ResearchProgress: () => null,
}));

vi.mock('../../../src/components/AIChat/ResponseActions', () => ({
  ResponseActions: () => null,
}));

vi.mock('../../../src/components/AIChat/SmartSuggestions', () => ({
  SmartSuggestions: () => null,
}));

vi.mock('../../../src/components/AIChat/ThinkingStatusLine', () => ({
  ThinkingStatusLine: () => null,
}));

vi.mock('../../../src/components/AIChat/TTSIndicator', () => ({
  TTSIndicator: () => null,
}));

vi.mock('../../../src/components/AIChat/V8ArtifactRunControl', () => ({
  V8ArtifactRunControl: (props: any) => {
    v8ArtifactRunControlMock(props);
    return <div data-testid="v8-artifact-run-control" />;
  },
}));

vi.mock('../../../src/components/AIChat/V8ContextIndicator', () => ({
  V8ContextIndicator: (props: any) => {
    v8ContextIndicatorMock(props);
    return <div data-testid="v8-context-indicator" />;
  },
}));

describe('AIChatWelcomeView governed V8 controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it('renders V8 context and artifact controls on the legacy full-screen chat surface', async () => {
    const { AIChatWelcomeView } = await import('../../../src/views/AIChatWelcomeView');

    render(<AIChatWelcomeView />);

    expect(screen.getByTestId('v8-artifact-run-control')).toBeInTheDocument();
    expect(screen.getByTestId('v8-context-indicator')).toBeInTheDocument();

    expect(v8ArtifactRunControlMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        conversationId: 'conv-legacy-1',
        defaultGoal: 'Prepare board update summary',
        snapshotContext: expect.objectContaining({
          workspaceId: '22222222-2222-4222-8222-222222222222',
          projectId: '11111111-1111-4111-8111-111111111111',
          effectiveScopeRef: 'workspace',
          resolvedRoleRef: 'manager',
          privacyMode: true,
        }),
      }),
    );

    expect(v8ContextIndicatorMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        conversationId: 'conv-legacy-1',
        defaultGoal: 'Prepare board update summary',
      }),
    );
  });
});
