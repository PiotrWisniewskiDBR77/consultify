/**
 * Tests for FloatingNodeToolbar: renders slots, dropdown interactions.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Whole-module mock: anything the import graph reaches must be returned here, or the
// file fails to COLLECT ("0 test") instead of failing an assertion — and a file that
// was already red hides that completely. That is exactly what happened here: this file
// ran 7 tests at `origin/demo` (5 passing) and collected 0 after the locale sweep pulled
// `src/i18n.ts` into the graph via a newly-translated component. Five passing tests
// disappeared silently. Shape copied from `tests/setup.ts`.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  Trans: ({ children, i18nKey }: any) => children || i18nKey,
  I18nextProvider: ({ children }: any) => children,
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
    const autoBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'Auto-layout branch');
    expect(autoBtn).toBeTruthy();
    if (autoBtn) fireEvent.click(autoBtn);
    expect(onUpdate).toHaveBeenCalledWith({ autoLayout: true });
  });

  it('opens semantic type dropdown on click', () => {
    render(<FloatingNodeToolbar {...baseProps} />);
    const typeBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'Node type');
    expect(typeBtn).toBeTruthy();
    if (typeBtn) fireEvent.click(typeBtn);
    expect(screen.getByText('Topic')).toBeTruthy();
    expect(screen.getByText('Hypothesis')).toBeTruthy();
  });

  it('toggles bold on click', () => {
    const onUpdate = vi.fn();
    render(<FloatingNodeToolbar {...baseProps} onUpdate={onUpdate} />);
    const boldBtn = screen.getAllByRole('button').find((b) => b.getAttribute('title') === 'Bold');
    expect(boldBtn).toBeTruthy();
    if (boldBtn) fireEvent.click(boldBtn);
    expect(onUpdate).toHaveBeenCalledWith({ bold: true });
  });

  it('calls onOpenArtifactModal on link click', () => {
    const onOpenArtifactModal = vi.fn();
    render(<FloatingNodeToolbar {...baseProps} onOpenArtifactModal={onOpenArtifactModal} />);
    const linkBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'Linked artifacts');
    expect(linkBtn).toBeTruthy();
    if (linkBtn) fireEvent.click(linkBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));
    expect(onOpenArtifactModal).toHaveBeenCalled();
  });

  it('calls onOpenContextMenu on more click', () => {
    const onOpenContextMenu = vi.fn();
    render(<FloatingNodeToolbar {...baseProps} onOpenContextMenu={onOpenContextMenu} />);
    const moreBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'More options');
    if (moreBtn) fireEvent.click(moreBtn);
    expect(onOpenContextMenu).toHaveBeenCalled();
  });

  it('resets dropdown when nodeId changes', () => {
    const { rerender } = render(<FloatingNodeToolbar {...baseProps} />);
    const typeBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('title') === 'Node type');
    if (typeBtn) fireEvent.click(typeBtn);
    expect(screen.getByText('Topic')).toBeTruthy();

    rerender(<FloatingNodeToolbar {...baseProps} nodeId="node-2" />);
    expect(screen.queryByText('Topic')).toBeNull();
  });
});
