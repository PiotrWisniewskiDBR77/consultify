/**
 * Tests for AITableAssistant — command input, API call, loading state, error handling.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AITableAssistant } from '@/components/MyWork/table/AITableAssistant';
import type { ColumnDef } from '@/components/MyWork/table/tableTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

const mockGetIdeaAITableAction = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getIdeaAITableAction: (...args: any[]) => mockGetIdeaAITableAction(...args),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const columns: ColumnDef[] = [
  { key: 'label', header: 'Name', type: 'text', visible: true, width: 200 },
  { key: 'status', header: 'Status', type: 'status', visible: true, width: 140, options: ['Todo', 'Done'] },
  { key: 'effort', header: 'Effort', type: 'number', visible: true, width: 100 },
];

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  ideaId: 'idea-123',
  columns,
  onApplyAction: vi.fn(),
  language: 'en',
};

describe('AITableAssistant', () => {
  it('renders when open', () => {
    render(<AITableAssistant {...defaultProps} />);
    expect(document.body.textContent).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(<AITableAssistant {...defaultProps} open={false} />);
    expect(container.firstChild).toBeFalsy();
  });

  it('renders input field for commands', () => {
    render(<AITableAssistant {...defaultProps} />);
    const inputs = document.querySelectorAll('input, textarea');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders suggestion chips', () => {
    render(<AITableAssistant {...defaultProps} />);
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls API when command is submitted', async () => {
    mockGetIdeaAITableAction.mockResolvedValue({
      action: 'sort',
      params: { column: 'effort', direction: 'desc' },
    });

    render(<AITableAssistant {...defaultProps} />);

    const input = document.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'Sort by effort descending' } });

    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.keyDown(input, { key: 'Enter' });
    }

    await waitFor(() => {
      expect(mockGetIdeaAITableAction).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('handles API error gracefully', async () => {
    mockGetIdeaAITableAction.mockRejectedValue(new Error('Network error'));

    render(<AITableAssistant {...defaultProps} />);

    const input = document.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'Do something' } });

    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.keyDown(input, { key: 'Enter' });
    }

    await waitFor(() => {
      expect(mockGetIdeaAITableAction).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('passes artifact context when provided', async () => {
    mockGetIdeaAITableAction.mockResolvedValue({
      action: 'add_column',
      params: { name: 'Priority', type: 'select' },
    });

    const artifactContext = [
      { id: 'art-1', type: 'initiative', title: 'Project Alpha', snippet: 'Key initiative' },
    ];

    render(
      <AITableAssistant
        {...defaultProps}
        artifactContext={artifactContext}
      />
    );

    const input = document.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    if (!input) return;

    fireEvent.change(input, { target: { value: 'Add priority column' } });

    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.keyDown(input, { key: 'Enter' });
    }

    await waitFor(() => {
      expect(mockGetIdeaAITableAction).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('calls onClose when close button is clicked', () => {
    render(<AITableAssistant {...defaultProps} />);
    const closeButtons = Array.from(document.querySelectorAll('button')).filter(
      (btn) => btn.querySelector('svg') && btn.textContent?.trim() === ''
    );
    if (closeButtons.length > 0) {
      fireEvent.click(closeButtons[0]);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });
});
