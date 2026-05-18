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
  onOpenTemplateGallery: vi.fn(),
};

describe('CanvasLeftToolbar', () => {
  it('renders when isAccepted is true', () => {
    render(<CanvasLeftToolbar {...baseProps} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('still renders the toolbar shell when isAccepted is false', () => {
    render(<CanvasLeftToolbar {...baseProps} isAccepted={false} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
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
    const selectBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title')?.startsWith('Select'));
    if (selectBtn) fireEvent.click(selectBtn);
    expect(onAction).toHaveBeenCalledWith('mm_pan_mode');
  });

  it('toggles connect back to select when already in connect mode', () => {
    const onAction = vi.fn();
    render(
      <CanvasLeftToolbar
        {...baseProps}
        interactionMode="connect"
        onAction={onAction}
      />
    );

    const connectBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'Finish connecting and return to select');

    if (connectBtn) fireEvent.click(connectBtn);
    expect(onAction).toHaveBeenCalledWith('mm_select_mode');
    expect(
      screen
        .getAllByRole('button')
        .find((b) => b.getAttribute('title') === 'Connect — click Connect or empty canvas to return to select')
    ).toBeTruthy();
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
