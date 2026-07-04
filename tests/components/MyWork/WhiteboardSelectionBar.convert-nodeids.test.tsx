/**
 * A4 — WhiteboardSelectionBar convert dispatches carry the selection.
 *
 * The wb_convert_decision / wb_convert_action buttons must include the selected
 * node ids as `nodeIds` in the `idea-workspace-quick-action` CustomEvent detail.
 * IdeaMapWorkspace's listener forwards that detail to handleConvert as
 * explicitNodeIds; without it the server-side /my-ideas/:id/convert falls back
 * to converting the WHOLE idea whenever the parent's synced selection state is
 * empty (the A4 gap).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WhiteboardSelectionBar } from '@/components/MyWork/whiteboard/WhiteboardSelectionBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

function makeProps(over: Partial<React.ComponentProps<typeof WhiteboardSelectionBar>> = {}) {
  return {
    isPl: false,
    locked: false,
    selectedCount: 2,
    hasSelectedFrame: false,
    ideaId: 'idea-1',
    selectedNodeIds: ['n1', 'n2'],
    onAlignNodes: vi.fn(),
    onDistributeNodes: vi.fn(),
    onGroupSelected: vi.fn(),
    onUngroupSelected: vi.fn(),
    onDuplicateSelected: vi.fn(),
    onLockSelected: vi.fn(),
    onDeleteSelected: vi.fn(),
    ...over,
  };
}

describe('WhiteboardSelectionBar — convert dispatches (A4)', () => {
  let received: Array<Record<string, unknown>>;
  const listener = (e: Event) => {
    received.push((e as CustomEvent).detail);
  };

  beforeEach(() => {
    received = [];
    window.addEventListener('idea-workspace-quick-action', listener);
  });

  afterEach(() => {
    window.removeEventListener('idea-workspace-quick-action', listener);
  });

  it('wb_convert_decision carries ideaId + selected nodeIds', () => {
    render(<WhiteboardSelectionBar {...makeProps()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'myWork.whiteboard.selectionBar.convertDecision' })
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      action: 'wb_convert_decision',
      ideaId: 'idea-1',
      nodeIds: ['n1', 'n2'],
    });
  });

  it('wb_convert_action carries ideaId + selected nodeIds', () => {
    render(<WhiteboardSelectionBar {...makeProps()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'myWork.whiteboard.selectionBar.convertAction' })
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      action: 'wb_convert_action',
      ideaId: 'idea-1',
      nodeIds: ['n1', 'n2'],
    });
  });

  it('omits nodeIds when selection ids are not provided (back-compat with selection.ids fallback)', () => {
    render(<WhiteboardSelectionBar {...makeProps({ selectedNodeIds: undefined })} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'myWork.whiteboard.selectionBar.convertDecision' })
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ action: 'wb_convert_decision', ideaId: 'idea-1' });
    expect('nodeIds' in received[0]).toBe(false);
  });

  it('convert buttons are disabled when the board is locked', () => {
    render(<WhiteboardSelectionBar {...makeProps({ locked: true })} />);
    expect(
      screen.getByRole('button', { name: 'myWork.whiteboard.selectionBar.convertDecision' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'myWork.whiteboard.selectionBar.convertAction' })
    ).toBeDisabled();
  });
});
