/**
 * DiscoveryCanvas Tests
 *
 * Tests for the Discovery Canvas component that renders pain points,
 * insights, and recommendations as nodes on a React Flow canvas.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ReactFlowProvider } from 'reactflow';

import { DiscoveryCanvas } from '../../../src/components/Discovery/DiscoveryCanvas';
import { DiscoveryNode, DiscoveryEdge } from '../../../src/types/discovery';

// Mock React Flow
jest.mock('reactflow', () => ({
  ...jest.requireActual('reactflow'),
  ReactFlow: ({ children, nodes, edges }: any) => (
    <div data-testid="react-flow">
      <div data-testid="nodes-count">{nodes?.length || 0}</div>
      <div data-testid="edges-count">{edges?.length || 0}</div>
      {children}
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
  useReactFlow: () => ({
    fitView: jest.fn(),
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    getNodes: jest.fn(() => []),
  }),
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

const mockNodes: DiscoveryNode[] = [
  {
    id: 'pain-1',
    type: 'painPoint',
    position: { x: 100, y: 100 },
    data: {
      text: 'Manual approval process takes 3 days',
      severity: 4,
      area: 'operations',
      source: 'user',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'insight-1',
    type: 'insight',
    position: { x: 300, y: 100 },
    data: {
      text: 'Automation could reduce time by 80%',
      linkedPainIds: ['pain-1'],
      source: 'ai',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockEdges: DiscoveryEdge[] = [
  {
    id: 'edge-1',
    source: 'pain-1',
    target: 'insight-1',
    type: 'smoothstep',
  },
];

describe('DiscoveryCanvas', () => {
  const defaultProps = {
    nodes: mockNodes,
    edges: mockEdges,
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
    onNodeClick: jest.fn(),
    onSaveVersion: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('displays correct number of nodes', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('nodes-count')).toHaveTextContent('2');
  });

  it('displays correct number of edges', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('edges-count')).toHaveTextContent('1');
  });

  it('renders canvas controls', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  it('renders minimap', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
  });

  it('renders with empty nodes array', () => {
    render(<DiscoveryCanvas {...defaultProps} nodes={[]} edges={[]} />);
    expect(screen.getByTestId('nodes-count')).toHaveTextContent('0');
  });
});
