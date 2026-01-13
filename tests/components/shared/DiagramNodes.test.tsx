/**
 * Shared Diagram Nodes Tests
 *
 * Tests for the shared diagram node components used across
 * Discovery Canvas and AI Chat artifacts.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import {
  ProcessStepNode,
  DecisionNode,
  StartEndNode,
  MindmapNode,
  TextNode,
} from '../../../src/components/shared/DiagramNodes';

// Mock React Flow
jest.mock('reactflow', () => ({
  Handle: ({ type, position }: any) => (
    <div data-testid={`handle-${type}-${position}`} />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

describe('ProcessStepNode', () => {
  const defaultProps = {
    id: 'step-1',
    type: 'processStep',
    data: {
      label: 'Review Document',
      description: 'Review and approve the document',
      status: 'pending' as const,
    },
    selected: false,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    dragging: false,
  };

  it('renders without crashing', () => {
    render(<ProcessStepNode {...defaultProps} />);
    expect(screen.getByText('Review Document')).toBeInTheDocument();
  });

  it('displays label', () => {
    render(<ProcessStepNode {...defaultProps} />);
    expect(screen.getByText('Review Document')).toBeInTheDocument();
  });

  it('displays description', () => {
    render(<ProcessStepNode {...defaultProps} />);
    expect(screen.getByText('Review and approve the document')).toBeInTheDocument();
  });

  it('applies status styling', () => {
    const activeProps = {
      ...defaultProps,
      data: { ...defaultProps.data, status: 'active' as const },
    };
    const { container } = render(<ProcessStepNode {...activeProps} />);
    // Should have blue styling for active
    expect(container.firstChild).toHaveClass('border-blue-500');
  });

  it('renders connection handles', () => {
    render(<ProcessStepNode {...defaultProps} />);
    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
  });
});

describe('DecisionNode', () => {
  const defaultProps = {
    id: 'decision-1',
    type: 'decision',
    data: {
      label: 'Is Approved?',
      yesLabel: 'Yes',
      noLabel: 'No',
    },
    selected: false,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    dragging: false,
  };

  it('renders without crashing', () => {
    render(<DecisionNode {...defaultProps} />);
    expect(screen.getByText('Is Approved?')).toBeInTheDocument();
  });

  it('displays yes/no labels', () => {
    render(<DecisionNode {...defaultProps} />);
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders multiple handles for branching', () => {
    render(<DecisionNode {...defaultProps} />);
    expect(screen.getByTestId('handle-target-top')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-bottom')).toBeInTheDocument();
  });
});

describe('StartEndNode', () => {
  const startProps = {
    id: 'start-1',
    type: 'startEnd',
    data: {
      label: 'Process Start',
      isStart: true,
    },
    selected: false,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    dragging: false,
  };

  const endProps = {
    ...startProps,
    id: 'end-1',
    data: {
      label: 'Process End',
      isStart: false,
    },
  };

  it('renders start node', () => {
    render(<StartEndNode {...startProps} />);
    expect(screen.getByText('Process Start')).toBeInTheDocument();
  });

  it('renders end node', () => {
    render(<StartEndNode {...endProps} />);
    expect(screen.getByText('Process End')).toBeInTheDocument();
  });

  it('start node has only source handle', () => {
    render(<StartEndNode {...startProps} />);
    expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    expect(screen.queryByTestId('handle-target-left')).not.toBeInTheDocument();
  });

  it('end node has only target handle', () => {
    render(<StartEndNode {...endProps} />);
    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    expect(screen.queryByTestId('handle-source-right')).not.toBeInTheDocument();
  });
});

describe('MindmapNode', () => {
  const defaultProps = {
    id: 'mindmap-1',
    type: 'mindmap',
    data: {
      label: 'Central Topic',
      level: 0 as const,
      color: 'blue' as const,
    },
    selected: false,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    dragging: false,
  };

  it('renders without crashing', () => {
    render(<MindmapNode {...defaultProps} />);
    expect(screen.getByText('Central Topic')).toBeInTheDocument();
  });

  it('applies level-based sizing', () => {
    const level2Props = {
      ...defaultProps,
      data: { ...defaultProps.data, level: 2 as const },
    };
    const { container } = render(<MindmapNode {...level2Props} />);
    // Level 2 should be smaller
    expect(container.firstChild).toHaveClass('w-20');
  });

  it('applies color styling', () => {
    const greenProps = {
      ...defaultProps,
      data: { ...defaultProps.data, color: 'green' as const },
    };
    const { container } = render(<MindmapNode {...greenProps} />);
    expect(container.firstChild).toHaveClass('border-green-500');
  });

  it('renders radial connection handles', () => {
    render(<MindmapNode {...defaultProps} />);
    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-top')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-bottom')).toBeInTheDocument();
  });
});

describe('TextNode', () => {
  const defaultProps = {
    id: 'text-1',
    type: 'textNode',
    data: {
      text: 'Annotation text',
      fontSize: 'base' as const,
      fontWeight: 'normal' as const,
    },
    selected: false,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    dragging: false,
  };

  it('renders without crashing', () => {
    render(<TextNode {...defaultProps} />);
    expect(screen.getByText('Annotation text')).toBeInTheDocument();
  });

  it('applies font size classes', () => {
    const largeProps = {
      ...defaultProps,
      data: { ...defaultProps.data, fontSize: 'lg' as const },
    };
    const { container } = render(<TextNode {...largeProps} />);
    expect(container.firstChild).toHaveClass('text-lg');
  });

  it('applies font weight classes', () => {
    const boldProps = {
      ...defaultProps,
      data: { ...defaultProps.data, fontWeight: 'bold' as const },
    };
    const { container } = render(<TextNode {...boldProps} />);
    expect(container.firstChild).toHaveClass('font-bold');
  });

  it('applies selected styling', () => {
    const { container } = render(<TextNode {...defaultProps} selected={true} />);
    expect(container.firstChild).toHaveClass('ring-2');
  });
});
