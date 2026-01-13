/**
 * DiscoveryConsultantView Tests
 *
 * Tests for the main Discovery Consultant view component that
 * integrates AI chat with the discovery canvas.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the store before importing the component
const mockDiscoveryStore = {
  activeSessionId: 'test-session',
  currentPhase: 'welcome',
  nodes: [],
  edges: [],
  clientContext: {},
  recommendations: {
    transformationType: null,
    matchScore: 0,
    reasoning: '',
    frameworks: [],
    tools: [],
    initiatives: [],
  },
  isLoading: false,
  isSaving: false,
  actions: {
    createSession: jest.fn(() => 'new-session-id'),
    loadSession: jest.fn(),
    saveSession: jest.fn(),
    setPhase: jest.fn(),
    addNode: jest.fn(() => 'new-node-id'),
    updateNode: jest.fn(),
    removeNode: jest.fn(),
    moveNode: jest.fn(),
    addEdge: jest.fn(() => 'new-edge-id'),
    removeEdge: jest.fn(),
    updateClientContext: jest.fn(),
    setRecommendations: jest.fn(),
    processExtraction: jest.fn(),
    saveVersion: jest.fn(() => 1),
    loadVersion: jest.fn(),
    reset: jest.fn(),
  },
};

jest.mock('../../../src/store/useDiscoveryStore', () => ({
  useDiscoveryStore: () => mockDiscoveryStore,
}));

// Mock useAIStream
jest.mock('../../../src/hooks/useAIStream', () => ({
  useAIStream: () => ({
    isStreaming: false,
    streamedContent: '',
    thinkingSteps: [],
    artifacts: [],
    progress: 0,
    startStream: jest.fn(),
    stopStream: jest.fn(),
    reset: jest.fn(),
  }),
}));

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

// Mock React Flow
jest.mock('reactflow', () => ({
  ...jest.requireActual('reactflow'),
  ReactFlow: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
  useReactFlow: () => ({
    fitView: jest.fn(),
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
  }),
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
}));

// Import after mocks
import { DiscoveryConsultantView } from '../../../src/components/Discovery/DiscoveryConsultantView';

describe('DiscoveryConsultantView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<DiscoveryConsultantView />);
    // Should render the split view layout
    expect(document.querySelector('.flex')).toBeInTheDocument();
  });

  it('creates a new session if none exists', () => {
    const storeWithNoSession = {
      ...mockDiscoveryStore,
      activeSessionId: null,
    };

    jest.doMock('../../../src/store/useDiscoveryStore', () => ({
      useDiscoveryStore: () => storeWithNoSession,
    }));

    render(<DiscoveryConsultantView />);
    // Session should be created on mount
    expect(mockDiscoveryStore.actions.createSession).toHaveBeenCalled();
  });

  it('displays the chat input', () => {
    render(<DiscoveryConsultantView />);
    const input = document.querySelector('textarea, input[type="text"]');
    expect(input).toBeInTheDocument();
  });

  it('displays the canvas area', () => {
    render(<DiscoveryConsultantView />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });
});
