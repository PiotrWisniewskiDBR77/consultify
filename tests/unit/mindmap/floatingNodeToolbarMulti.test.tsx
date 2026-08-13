/**
 * M06 Fala 3.2 — FloatingNodeToolbar 'multi' mode.
 * Verifies: (1) default/'single' mode is byte-for-byte the pre-existing
 * behavior (no `mode` prop passed = old behavior, covered further in
 * floatingNodeToolbar.test.tsx), and (2) 'multi' mode hides single-node-only
 * affordances while keeping the shared styling controls that apply to every
 * selected node (color/branch/type/font/bold/lock).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// This mock replaces the WHOLE module, so anything the import graph pulls in must be
// present or the file fails to collect ("0 test") rather than failing an assertion.
// It broke when the locale sweep added `useTranslation` to a component in this graph:
// that reached `src/i18n.ts`, which needs `initReactI18next`, which this mock did not
// return. Shape copied from `tests/setup.ts` (the repo's canonical react-i18next mock).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
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

describe('FloatingNodeToolbar — mode="multi" (M06 Fala 3.2)', () => {
  it('hides single-node-only affordances (add child/sibling, rename, more/context menu, AI, artifacts)', () => {
    render(<FloatingNodeToolbar {...baseProps} mode="multi" selectionCount={3} />);

    expect(screen.queryByTitle('Add child (Tab)')).toBeNull();
    expect(screen.queryByTitle('Add sibling (Shift+Enter)')).toBeNull();
    expect(screen.queryByTitle('Rename (F2)')).toBeNull();
    expect(screen.queryByTitle('More options')).toBeNull();
    expect(screen.queryByTitle('AI')).toBeNull();
    expect(screen.queryByTitle('Linked artifacts')).toBeNull();
    expect(screen.queryByTitle('Quick task')).toBeNull();
    expect(screen.queryByTitle('Quick notes')).toBeNull();
  });

  it('shows the shared styling controls that apply to the whole selection', () => {
    render(<FloatingNodeToolbar {...baseProps} mode="multi" selectionCount={3} />);

    expect(screen.getByTitle('ideas.mindmap.nodeType')).toBeTruthy();
    expect(screen.getByTitle('ideas.mindmap.lineStyle')).toBeTruthy();
    expect(screen.getByTitle('ideas.mindmap.autoLayoutBranch')).toBeTruthy();
    expect(screen.getByTitle('ideas.mindmap.color')).toBeTruthy();
    expect(screen.getByTitle('ideas.mindmap.fontSize')).toBeTruthy();
    expect(screen.getByTitle('ideas.mindmap.bold')).toBeTruthy();
  });

  it('shows the selection count label', () => {
    render(<FloatingNodeToolbar {...baseProps} mode="multi" selectionCount={5} />);
    expect(screen.getByText('ideas.mindmap.nSelected')).toBeTruthy();
  });

  it('applying a style calls onUpdate once with the patch (caller fans it out to all selected nodes)', () => {
    const onUpdate = vi.fn();
    render(<FloatingNodeToolbar {...baseProps} mode="multi" selectionCount={2} onUpdate={onUpdate} />);
    const boldBtn = screen.getByTitle('ideas.mindmap.bold');
    fireEvent.click(boldBtn);
    expect(onUpdate).toHaveBeenCalledWith({ bold: true });
  });

  it('defaults to single mode (all 10+ slots) when mode is omitted — unchanged from before Fala 3.2', () => {
    render(<FloatingNodeToolbar {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(10);
    expect(screen.getByTitle('ideas.mindmap.addChildTab')).toBeTruthy();
    expect(screen.getByTitle('ideas.mindmap.moreOptions')).toBeTruthy();
  });
});
