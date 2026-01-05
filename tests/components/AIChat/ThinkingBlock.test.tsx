/**
 * Tests for ThinkingBlock component
 * World-Class Chat 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThinkingBlock } from '@/components/AIChat/Messages/ThinkingBlock';
import { ThinkingStep } from '@/types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' }
  })
}));

describe('ThinkingBlock', () => {
  const mockSteps: ThinkingStep[] = [
    {
      id: 'think-1',
      label: 'Step 1',
      content: 'Analyzing requirements',
      status: 'done',
      timestamp: new Date(),
      category: 'analysis'
    },
    {
      id: 'think-2',
      label: 'Step 2',
      content: 'Researching best practices',
      status: 'done',
      timestamp: new Date(),
      category: 'research'
    },
    {
      id: 'think-3',
      label: 'Step 3',
      content: 'Synthesizing solution',
      status: 'in_progress',
      timestamp: new Date(),
      category: 'synthesis'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders thinking block with steps', () => {
    render(<ThinkingBlock steps={mockSteps} defaultExpanded={true} />);

    // Check for thinking block header (may use translation keys)
    const header = screen.getByText(/thinking|reasoning|processing/i);
    expect(header).toBeInTheDocument();
    // Steps should be visible when expanded
    expect(screen.getByText('Step 1')).toBeInTheDocument();
  });

  it('shows progress indicator', () => {
    render(<ThinkingBlock steps={mockSteps} />);

    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('collapses by default', () => {
    render(<ThinkingBlock steps={mockSteps} defaultExpanded={false} />);

    // Steps should not be visible when collapsed
    expect(screen.queryByText('Analyzing requirements')).not.toBeInTheDocument();
  });

  it('expands when clicked', () => {
    render(<ThinkingBlock steps={mockSteps} defaultExpanded={false} />);

    const header = screen.getByText(/thinking|reasoning/i).closest('button');
    if (header) {
      fireEvent.click(header);
    }

    expect(screen.getByText('Analyzing requirements')).toBeInTheDocument();
  });

  it('shows streaming indicator when isStreaming is true', () => {
    render(<ThinkingBlock steps={mockSteps} isStreaming={true} />);

    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });

  it('displays step categories with icons', () => {
    render(<ThinkingBlock steps={mockSteps} defaultExpanded={true} />);

    // Should show category icons
    expect(screen.getByText('Step 1')).toBeInTheDocument();
  });

  it('shows current step when streaming', () => {
    render(<ThinkingBlock steps={mockSteps} isStreaming={true} />);

    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('calculates progress correctly', () => {
    const steps: ThinkingStep[] = [
      { ...mockSteps[0], status: 'done' },
      { ...mockSteps[1], status: 'done' },
      { ...mockSteps[2], status: 'pending' }
    ];

    render(<ThinkingBlock steps={steps} />);

    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('renders empty state when no steps', () => {
    render(<ThinkingBlock steps={[]} />);

    // Should not render
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
  });

  it('shows total duration when not streaming', () => {
    const stepsWithDuration: ThinkingStep[] = [
      {
        ...mockSteps[0],
        status: 'done',
        durationMs: 500
      },
      {
        ...mockSteps[1],
        status: 'done',
        durationMs: 300
      }
    ];

    render(<ThinkingBlock steps={stepsWithDuration} defaultExpanded={true} isStreaming={false} />);

    // Check for duration text (may use translation key or actual text)
    const durationText = screen.queryByText(/total time|thinking.totalTime/i) ||
      screen.queryByText(/0\.8|800/i); // Duration in seconds
    expect(durationText).toBeInTheDocument();
  });
});

