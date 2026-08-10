/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — AddColumnDialog rendered a plain `fixed inset-0`
 * overlay with ZERO `role="dialog"` / `aria-modal` / focus-trap /
 * focus-restore, and a native `autoFocus` on the name field that (as
 * discovered while fixing the sibling Mind Map modals) races ahead of any
 * mount-time focus-restore capture — removed in favor of the shared
 * `useDialogA11y` hook's `initialFocusRef`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AddColumnDialog } from '../AddColumnDialog';

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

describe('AddColumnDialog — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(<AddColumnDialog open onClose={vi.fn()} onAdd={vi.fn()} existingKeys={[]} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/add.*column/i);
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<AddColumnDialog open onClose={onClose} onAdd={vi.fn()} existingKeys={[]} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape (native autoFocus no longer races the restore capture)', async () => {
    render(
      <Trigger>
        {(open, close) =>
          open && (
            <AddColumnDialog open onClose={close} onAdd={vi.fn()} existingKeys={[]} />
          )
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
