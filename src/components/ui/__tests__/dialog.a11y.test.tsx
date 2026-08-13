/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — `src/components/ui/dialog.tsx` is the repo's shared
 * "Dialog" primitive (used by processflow/ExportDialog — an in-scope Idea
 * Workspace tool — plus 2 other call sites) but `DialogContent` rendered
 * with ZERO `role="dialog"` / `aria-modal` / `aria-labelledby` / Escape /
 * focus-trap / focus-restore despite the name. Fixed by wiring the shared
 * `useDialogA11y` hook and linking `DialogTitle`/`DialogDescription` ids via
 * context.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../dialog';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

function Fixture({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export process</DialogTitle>
          <DialogDescription>Choose export format</DialogDescription>
        </DialogHeader>
        <button type="button">Some action</button>
      </DialogContent>
    </Dialog>
  );
}

function Trigger() {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open trigger
      </button>
      <Fixture open={open} onOpenChange={setOpen} />
    </div>
  );
}

describe('ui/dialog.tsx DialogContent — a11y contract', () => {
  it('exposes role=dialog with an accessible name and description linked via context ids', () => {
    render(<Fixture open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: /Export process/i });
    expect(dialog).toHaveAccessibleDescription(/Choose export format/i);
  });

  it('Escape calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(<Fixture open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(<Trigger />);
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps Tab inside the dialog: Tab on the last control cycles to the first', () => {
    render(<Fixture open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThanOrEqual(2);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
  });
});
