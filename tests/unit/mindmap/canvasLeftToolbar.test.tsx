/**
 * Tests for CanvasLeftToolbar: correct slots per activeTool, event dispatch.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}));

import { CanvasLeftToolbar } from '@/components/MyWork/mindmap/CanvasLeftToolbar';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

const baseProps = {
  activeTool: 'mindmap' as const,
  selection: EMPTY_SELECTION,
  isAccepted: true,
  ideaId: 'test-123',
  onAction: vi.fn(),
  onOpenChat: vi.fn(),
  onApplyTemplate: vi.fn(),
  onSaveAsTemplate: vi.fn(),
};

describe('CanvasLeftToolbar', () => {
  it('renders when isAccepted is true', () => {
    const { container } = render(<CanvasLeftToolbar {...baseProps} />);
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('does not render when isAccepted is false', () => {
    const { container } = render(<CanvasLeftToolbar {...baseProps} isAccepted={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders mindmap-specific slots (GitBranch for Add node)', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    const addNodeBtn = buttons.find((b) => b.getAttribute('title') === 'Add node');
    expect(addNodeBtn).toBeTruthy();
  });

  it('dispatches action on immediate button click', () => {
    const onAction = vi.fn();
    render(<CanvasLeftToolbar {...baseProps} onAction={onAction} />);
    const selectBtn = screen.getAllByRole('button').find((b) => b.getAttribute('title') === 'Select');
    if (selectBtn) fireEvent.click(selectBtn);
    expect(onAction).toHaveBeenCalledWith('mm_select_mode');
  });

  it('opens AI popover on click', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    const aiBtn = screen.getAllByRole('button').find((b) => b.getAttribute('title') === 'AI');
    expect(aiBtn).toBeTruthy();
    if (aiBtn) fireEvent.click(aiBtn);
    expect(screen.getByText('New AI conversation')).toBeTruthy();
  });

  it('renders undo/redo buttons', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.find((b) => b.getAttribute('title') === 'Undo')).toBeTruthy();
    expect(buttons.find((b) => b.getAttribute('title') === 'Redo')).toBeTruthy();
  });
});
