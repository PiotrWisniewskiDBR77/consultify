/**
 * Tests for FloatingNodeToolbar: renders slots, dropdown interactions.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}));

import { FloatingNodeToolbar } from '@/components/MyWork/mindmap/FloatingNodeToolbar';

const baseProps = {
  nodeId: 'node-1',
  nodeData: { label: 'Test Node' },
  style: {},
  position: { x: 200, y: 100 },
  onUpdate: vi.fn(),
  onAddChild: vi.fn(),
  onAddSibling: vi.fn(),
  onOpenContextMenu: vi.fn(),
  onOpenArtifactModal: vi.fn(),
  onOpenNodeDetail: vi.fn(),
  onRemoveArtifact: vi.fn(),
  onOpenLinkedArtifact: vi.fn(),
  onOpenChatAboutNode: vi.fn(),
  onAction: vi.fn(),
};

describe('FloatingNodeToolbar', () => {
  it('renders all 10 toolbar slots', () => {
    render(<FloatingNodeToolbar {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(10);
  });

  it('toggles auto-layout on click', () => {
    const onUpdate = vi.fn();
    render(<FloatingNodeToolbar {...baseProps} onUpdate={onUpdate} />);
    const autoBtn = screen.getAllByRole('button').find((b) => b.getAttribute('title') === 'ideas.mindmap.autoLayoutBranch');
    expect(autoBtn).toBeTruthy();
    if (autoBtn) fireEvent.click(autoBtn);
    expect(onUpdate).toHaveBeenCalledWith({ autoLayout: true });
  });

  it('opens semantic type dropdown on click', () => {
    render(<FloatingNodeToolbar {...baseProps} />);
    const typeBtn = screen.getAllByRole('button').find((b) => b.getAttribute('title') === 'ideas.mindmap.nodeType');
    expect(typeBtn).toBeTruthy();
    if (typeBtn) fireEvent.click(typeBtn);
    expect(screen.getByText('Topic')).toBeTruthy();
    expect(screen.getByText('Hypothesis')).toBeTruthy();
  });

  it('toggles bold on click', () => {
    const onUpdate = vi.fn();
    render(<FloatingNodeToolbar {...baseProps} onUpdate={onUpdate} />);
    const boldBtn = screen.getAllByRole('button').find((b) => b.getAttribute('title') === 'ideas.mindmap.bold');
    expect(boldBtn).toBeTruthy();
    if (boldBtn) fireEvent.click(boldBtn);
    expect(onUpdate).toHaveBeenCalledWith({ bold: true });
  });

  it('calls onOpenArtifactModal on link click', () => {
    const onOpenArtifactModal = vi.fn();
    render(<FloatingNodeToolbar {...baseProps} onOpenArtifactModal={onOpenArtifactModal} />);
    const linkBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'ideas.mindmap.linkedArtifacts');
    expect(linkBtn).toBeTruthy();
    if (linkBtn) fireEvent.click(linkBtn);
    fireEvent.click(screen.getByRole('button', { name: 'ideas.mindmap.attach' }));
    expect(onOpenArtifactModal).toHaveBeenCalled();
  });

  it('calls onOpenContextMenu on more click', () => {
    const onOpenContextMenu = vi.fn();
    render(<FloatingNodeToolbar {...baseProps} onOpenContextMenu={onOpenContextMenu} />);
    const moreBtn = screen.getAllByRole('button').find((b) => b.getAttribute('title') === 'ideas.mindmap.moreOptions');
    if (moreBtn) fireEvent.click(moreBtn);
    expect(onOpenContextMenu).toHaveBeenCalled();
  });

  it('resets dropdown when nodeId changes', () => {
    const { rerender } = render(<FloatingNodeToolbar {...baseProps} />);
    const typeBtn = screen.getAllByRole('button').find((b) => b.getAttribute('title') === 'ideas.mindmap.nodeType');
    if (typeBtn) fireEvent.click(typeBtn);
    expect(screen.getByText('Topic')).toBeTruthy();

    rerender(<FloatingNodeToolbar {...baseProps} nodeId="node-2" />);
    expect(screen.queryByText('Topic')).toBeNull();
  });
});
