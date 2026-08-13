/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG (whiteboard) batch 1 — WhiteboardNodeCommentThread converted
 * onto the shared `useDialogA11y` contract (G4-MODALS-REST).
 *
 * This side-drawer previously had NO dialog semantics at all (no role,
 * no aria-modal, no accessible name, no Escape handling, no focus
 * management) — it is not a `fixed inset-0` overlay, so it was missed by
 * earlier sweeps that only grepped for that class string.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { WhiteboardNodeCommentThread } from '../nodes/WhiteboardNodeCommentThread';
import type { WhiteboardNodeComment } from '../nodes/whiteboardNodeComments';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

function Harness({
  comments = [],
}: {
  comments?: WhiteboardNodeComment[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button data-testid="trigger" onClick={() => setOpen(true)}>
        Open comments
      </button>
      <WhiteboardNodeCommentThread
        open={open}
        onClose={() => setOpen(false)}
        nodeId="node-1"
        nodeLabel="Node label"
        comments={comments}
        locked={false}
        currentUser="tester"
        isPl={false}
        onAddComment={vi.fn()}
        onDeleteComment={vi.fn()}
      />
    </div>
  );
}

describe('WhiteboardNodeCommentThread — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('trigger'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Comments');
  });

  it('focuses the comment textarea on open', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('trigger'));
    await screen.findByRole('dialog');
    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('TEXTAREA');
    });
  });

  it('Escape closes the drawer and restores focus to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
