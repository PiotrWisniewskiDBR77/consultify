/**
 * @vitest-environment jsdom
 *
 * CB-01 — canonical dialog/drawer accessibility hook (Modal.tsx's focus-trap
 * pattern extracted for reuse by bespoke drawer/dialog surfaces): Escape
 * closes, focus enters the dialog (or a given initial target) on open, Tab
 * is trapped between the first and last focusable descendants, and focus
 * returns to the trigger element on close.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useRef } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { useDialogA11y } from '../useDialogA11y';

// jsdom never computes layout, so `offsetParent` is always null — the hook's
// focus-trap uses it to skip hidden elements (matches the codebase's existing
// NotebookLibraryContent.tsx focus-trap convention). Stub it for this test so
// the visible-element filter behaves as it would in a real browser.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

const TestDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;
  return (
    <div ref={containerRef} role="dialog" aria-modal="true" tabIndex={-1} data-testid="dialog">
      <button type="button">First</button>
      <button type="button">Last</button>
    </div>
  );
};

const Harness: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <TestDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

describe('useDialogA11y', () => {
  it('closes on Escape', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByTestId('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByTestId('dialog')).not.toBeInTheDocument());
  });

  it('returns focus to the trigger element on close', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps Tab within the dialog: Tab on the last element cycles to the first', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    last.focus();
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
  });

  it('traps Shift+Tab on the first element back to the last', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    first.focus();
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('does not call onClose while closed', () => {
    const onClose = vi.fn();
    const containerRef: React.RefObject<HTMLDivElement | null> = { current: null };
    const Wrapper = () => {
      useDialogA11y({ open: false, onClose, containerRef });
      return null;
    };
    render(<Wrapper />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
