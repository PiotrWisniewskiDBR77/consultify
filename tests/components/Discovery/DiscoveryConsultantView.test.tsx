/**
 * DiscoveryConsultantView Tests
 *
 * Tests for the main Discovery Consultant view component that
 * integrates AI chat with the discovery canvas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  createSession: vi.fn(() => 'new-session-id'),
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  setPhase: vi.fn(),
  addNode: vi.fn(() => 'new-node-id'),
  updateNode: vi.fn(),
  removeNode: vi.fn(),
  moveNode: vi.fn(),
  addEdge: vi.fn(() => 'new-edge-id'),
  removeEdge: vi.fn(),
  updateClientContext: vi.fn(),
  setRecommendations: vi.fn(),
  processExtraction: vi.fn(),
  saveVersion: vi.fn(() => 1),
  loadVersion: vi.fn(),
  reset: vi.fn(),
  autoLayout: vi.fn(),
  getNodesInCategory: vi.fn(() => []),
};

vi.mock('../../../src/store/useDiscoveryStore', () => ({
  useDiscoveryStore: () => mockDiscoveryStore,
}));

// Mock useAIStream
vi.mock('../../../src/hooks/useAIStream', () => ({
  useAIStream: () => ({
    isStreaming: false,
    streamedContent: '',
    thinkingSteps: [],
    artifacts: [],
    progress: 0,
    startStream: vi.fn(),
    stopStream: vi.fn(),
    reset: vi.fn(),
  }),
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || key,
    i18n: { language: 'en' },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

// Mock React Flow
vi.mock('reactflow', () => ({
  ReactFlow: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  Background: () => <div data-testid="background" />,
  BackgroundVariant: { Dots: 'dots' },
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
  useReactFlow: () => ({
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  }),
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  applyNodeChanges: vi.fn(),
  addEdge: vi.fn(),
}));

// Import after mocks
import { DiscoveryConsultantView } from '../../../src/components/Discovery/DiscoveryConsultantView';

describe('DiscoveryConsultantView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<DiscoveryConsultantView />);
    // Should render the split view layout
    expect(document.querySelector('.flex') || document.querySelector('div')).toBeInTheDocument();
  });

  it('creates a new session if none exists', () => {
    render(<DiscoveryConsultantView />);
    expect(mockDiscoveryStore.createSession).toHaveBeenCalledTimes(1);
  });

  it('displays the canvas area', () => {
    render(<DiscoveryConsultantView />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('renders controls', () => {
    render(<DiscoveryConsultantView />);
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });
});
