/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — MindmapCommandPalette (Cmd+K) is a full-screen modal
 * overlay (`fixed inset-0` backdrop + centered panel) that had no
 * `role="dialog"`/`aria-modal`, no Tab-trap, and no focus-restore (it did
 * already have a local Escape handler on the input, which stays). Fixed via
 * the shared `useDialogA11y` hook.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { MindmapCommandPalette } from '../MindmapCommandPalette';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

function Trigger({
  children,
}: {
  children: (open: boolean, close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open trigger
      </button>
      {children(open, () => setOpen(false))}
    </div>
  );
}

describe('MindmapCommandPalette — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(<MindmapCommandPalette open onClose={vi.fn()} onAction={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /Command palette/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<MindmapCommandPalette open onClose={onClose} onAction={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) =>
          open && <MindmapCommandPalette open onClose={close} onAction={vi.fn()} />
        }
      </Trigger>
    );
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
