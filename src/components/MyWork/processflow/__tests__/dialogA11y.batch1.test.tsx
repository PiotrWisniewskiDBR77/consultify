/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG (processflow) batch 1 — ProcessFlowNodeCommentThread converted
 * onto the shared `useDialogA11y` contract (G4-MODALS-REST).
 *
 * Same shape as Whiteboard's sibling — no dialog semantics at all previously,
 * not a `fixed inset-0` overlay (side-drawer), so earlier sweeps missed it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ProcessFlowNodeCommentThread } from '../ProcessFlowNodeCommentThread';
import type { ProcessFlowNodeComment } from '../nodeComments';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
  }),
}));

function Harness({
  comments = [],
}: {
  comments?: ProcessFlowNodeComment[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button data-testid="trigger" onClick={() => setOpen(true)}>
        Open comments
      </button>
      <ProcessFlowNodeCommentThread
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

describe('ProcessFlowNodeCommentThread — dialog a11y contract', () => {
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
